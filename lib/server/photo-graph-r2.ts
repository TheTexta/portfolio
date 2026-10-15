import {
  CopyObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import {
  isPhotoGraphR2StagingKey,
  isPhotoGraphR2PublishedKey,
  PHOTO_GRAPH_R2_MAX_UPLOAD_BYTES,
  PHOTO_GRAPH_R2_PUBLISHED_BUCKET,
  PHOTO_GRAPH_R2_STAGING_BUCKET,
  photoGraphR2Extension,
  photoGraphR2PublishedKey,
} from "@/lib/photo-graph/r2-paths";

const EXPECTED_R2_ENDPOINT =
  "https://9ccb474d564d74115b71265bb22b16ad.r2.cloudflarestorage.com";
const SIGNED_UPLOAD_SECONDS = 60 * 60;
const PUBLISHED_CACHE_CONTROL = "public, max-age=31536000, immutable";
const SHA256 = /^[a-f0-9]{64}$/;

type R2Environment = Record<string, string | undefined>;

export function photoGraphR2Configuration(env: R2Environment) {
  const endpoint = env.PHOTO_GRAPH_R2_S3_ENDPOINT?.trim();
  const accessKeyId = env.PHOTO_GRAPH_R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = env.PHOTO_GRAPH_R2_SECRET_ACCESS_KEY?.trim();

  if (endpoint !== EXPECTED_R2_ENDPOINT || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "Photo Graph R2 credentials and the approved account endpoint are required.",
    );
  }

  return { endpoint, accessKeyId, secretAccessKey };
}

let cachedClient: S3Client | undefined;

function r2Client() {
  if (!cachedClient) {
    const config = photoGraphR2Configuration(process.env);
    cachedClient = new S3Client({
      region: "auto",
      endpoint: config.endpoint,
      requestChecksumCalculation: "WHEN_REQUIRED",
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }
  return cachedClient;
}

function checkedUpload(input: {
  key: string;
  contentType: string;
  size: number;
  sha256: string;
}) {
  if (!isPhotoGraphR2StagingKey(input.key)) {
    throw new Error("Invalid Photo Graph R2 staging key.");
  }
  if (
    input.key.slice(input.key.lastIndexOf(".") + 1) !==
    photoGraphR2Extension(input.contentType)
  ) {
    throw new Error("Photo Graph R2 staging key and content type disagree.");
  }
  if (
    !Number.isSafeInteger(input.size) ||
    input.size < 1 ||
    input.size > PHOTO_GRAPH_R2_MAX_UPLOAD_BYTES ||
    !SHA256.test(input.sha256)
  ) {
    throw new Error("Invalid Photo Graph R2 upload size or checksum.");
  }
  return input;
}

export async function signPhotoGraphR2Upload(
  input: { key: string; contentType: string; size: number; sha256: string },
  client?: S3Client,
) {
  checkedUpload(input);
  const s3 = client ?? r2Client();
  const checksum = Buffer.from(input.sha256, "hex").toString("base64");
  const command = new PutObjectCommand({
    Bucket: PHOTO_GRAPH_R2_STAGING_BUCKET,
    Key: input.key,
    ContentType: input.contentType,
    ChecksumSHA256: checksum,
    Metadata: { sourcesha256: input.sha256, expectedsize: String(input.size) },
  });

  return {
    signedUrl: await getSignedUrl(s3, command, {
      expiresIn: SIGNED_UPLOAD_SECONDS,
    }),
    expiresInSeconds: SIGNED_UPLOAD_SECONDS,
    // The presigner places the checksum and metadata in the signed URL query;
    // sending duplicate browser headers is unnecessary and broadens CORS.
    headers: { "Content-Type": input.contentType },
  };
}

export async function photoGraphR2StagedObjectStatus(
  key: string,
  client?: S3Client,
) {
  if (!isPhotoGraphR2StagingKey(key))
    throw new Error("Invalid R2 staging key.");
  const s3 = client ?? r2Client();
  try {
    const head = await s3.send(
      new HeadObjectCommand({
        Bucket: PHOTO_GRAPH_R2_STAGING_BUCKET,
        Key: key,
      }),
    );
    return head;
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "$metadata" in error &&
      (error.$metadata as { httpStatusCode?: number }).httpStatusCode === 404
    ) {
      return null;
    }
    throw error;
  }
}

function copySource(key: string) {
  return `${PHOTO_GRAPH_R2_STAGING_BUCKET}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

export async function publishPhotoGraphR2Upload(
  input: {
    source: string;
    nodeId: string;
    contentType: string;
    size: number;
    sha256: string;
  },
  client?: S3Client,
) {
  checkedUpload({
    key: input.source,
    contentType: input.contentType,
    size: input.size,
    sha256: input.sha256,
  });
  const s3 = client ?? r2Client();
  const destination = photoGraphR2PublishedKey(input.nodeId, input.source);
  const source = await photoGraphR2StagedObjectStatus(input.source, s3);
  if (
    !source ||
    source.ContentLength !== input.size ||
    source.ContentType !== input.contentType ||
    source.Metadata?.sourcesha256 !== input.sha256 ||
    source.Metadata?.expectedsize !== String(input.size) ||
    !source.ETag
  ) {
    throw new Error(
      "Staged Photo Graph image does not match its reserved metadata.",
    );
  }
  const sourceETag = source.ETag;

  async function publishedMatches() {
    try {
      const existing = await s3.send(
        new HeadObjectCommand({
          Bucket: PHOTO_GRAPH_R2_PUBLISHED_BUCKET,
          Key: destination,
        }),
      );
      return (
        existing.ContentLength === input.size &&
        existing.ContentType === input.contentType &&
        existing.Metadata?.sourcesha256 === input.sha256 &&
        existing.Metadata?.sourceetag === sourceETag.replace(/^"|"$/g, "")
      );
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "$metadata" in error &&
        (error.$metadata as { httpStatusCode?: number }).httpStatusCode === 404
      ) {
        return false;
      }
      throw error;
    }
  }

  if (await publishedMatches()) return destination;
  try {
    await s3.send(
      new CopyObjectCommand({
        Bucket: PHOTO_GRAPH_R2_PUBLISHED_BUCKET,
        Key: destination,
        CopySource: copySource(input.source),
        CopySourceIfMatch: sourceETag,
        IfNoneMatch: "*",
        ContentType: input.contentType,
        CacheControl: PUBLISHED_CACHE_CONTROL,
        MetadataDirective: "REPLACE",
        Metadata: {
          sourcesha256: input.sha256,
          sourceetag: sourceETag.replace(/^"|"$/g, ""),
        },
      }),
    );
  } catch (error) {
    if (!(await publishedMatches())) throw error;
  }
  if (!(await publishedMatches())) {
    throw new Error("Published Photo Graph image did not pass verification.");
  }
  return destination;
}

export async function removePhotoGraphR2StagedObject(
  key: string,
  client?: S3Client,
) {
  if (!isPhotoGraphR2StagingKey(key))
    throw new Error("Invalid R2 staging key.");
  await (client ?? r2Client()).send(
    new DeleteObjectCommand({
      Bucket: PHOTO_GRAPH_R2_STAGING_BUCKET,
      Key: key,
    }),
  );
}

export async function removePhotoGraphR2PublishedObject(
  key: string,
  client?: S3Client,
) {
  if (!isPhotoGraphR2PublishedKey(key))
    throw new Error("Invalid published R2 image key.");
  await (client ?? r2Client()).send(
    new DeleteObjectCommand({
      Bucket: PHOTO_GRAPH_R2_PUBLISHED_BUCKET,
      Key: key,
    }),
  );
}
