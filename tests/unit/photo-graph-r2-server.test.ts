import {
  CopyObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { describe, expect, it, vi } from "vitest";

import {
  photoGraphR2Configuration,
  photoGraphR2StagedObjectStatus,
  publishPhotoGraphR2Upload,
  removePhotoGraphR2StagedObject,
  signPhotoGraphR2Upload,
} from "@/lib/server/photo-graph-r2";

const source = "staging/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.png";
const sha256 = "a".repeat(64);
const expected = {
  source,
  nodeId: "127",
  contentType: "image/png",
  size: 123,
  sha256,
};

function fakeClient(options?: {
  copyLosesResponse?: boolean;
  foreignDestination?: boolean;
}) {
  let copied = Boolean(options?.foreignDestination);
  const send = vi.fn(async (command: unknown) => {
    if (command instanceof HeadObjectCommand) {
      if (command.input.Bucket === "dextery-photo-graph-staging") {
        return {
          ContentLength: expected.size,
          ContentType: expected.contentType,
          Metadata: {
            sourcesha256: sha256,
            expectedsize: String(expected.size),
          },
          ETag: '"source-etag"',
        };
      }
      if (!copied) throw { $metadata: { httpStatusCode: 404 } };
      return {
        ContentLength: expected.size,
        ContentType: expected.contentType,
        Metadata: {
          sourcesha256: options?.foreignDestination ? "wrong" : sha256,
          sourceetag: "source-etag",
        },
      };
    }
    if (command instanceof CopyObjectCommand) {
      copied = true;
      if (options?.foreignDestination) throw new Error("Destination exists");
      if (options?.copyLosesResponse) throw new Error("Lost response");
      return {};
    }
    if (command instanceof DeleteObjectCommand) return {};
    throw new Error("Unexpected R2 command");
  });
  return { client: { send } as unknown as S3Client, send };
}

describe("Photo Graph R2 server operations", () => {
  it("accepts only the approved account endpoint and explicit server credentials", () => {
    const valid = {
      PHOTO_GRAPH_R2_S3_ENDPOINT:
        "https://9ccb474d564d74115b71265bb22b16ad.r2.cloudflarestorage.com",
      PHOTO_GRAPH_R2_ACCESS_KEY_ID: "test-access-id",
      PHOTO_GRAPH_R2_SECRET_ACCESS_KEY: "test-secret",
    };
    expect(photoGraphR2Configuration(valid).endpoint).toBe(
      valid.PHOTO_GRAPH_R2_S3_ENDPOINT,
    );
    expect(() =>
      photoGraphR2Configuration({
        ...valid,
        PHOTO_GRAPH_R2_S3_ENDPOINT: "https://elsewhere.example",
      }),
    ).toThrow("approved account");
    expect(() =>
      photoGraphR2Configuration({
        ...valid,
        PHOTO_GRAPH_R2_SECRET_ACCESS_KEY: "",
      }),
    ).toThrow("credentials");
  });

  it("presigns only a checked private staging upload without contacting R2", async () => {
    const client = new S3Client({
      region: "auto",
      endpoint:
        "https://9ccb474d564d74115b71265bb22b16ad.r2.cloudflarestorage.com",
      credentials: {
        accessKeyId: "test-access-id",
        secretAccessKey: "test-secret",
      },
    });
    try {
      const signed = await signPhotoGraphR2Upload(
        { key: source, contentType: "image/png", size: expected.size, sha256 },
        client,
      );
      const url = new URL(signed.signedUrl);
      expect(url.hostname).toMatch(/^dextery-photo-graph-staging\./);
      expect(url.pathname).toBe(`/${source}`);
      expect(signed.expiresInSeconds).toBe(3600);
      expect(signed.headers["Content-Type"]).toBe("image/png");
      expect(url.searchParams.get("x-amz-checksum-sha256")).toBe(
        Buffer.from(sha256, "hex").toString("base64"),
      );
      expect(url.searchParams.get("x-amz-meta-sourcesha256")).toBe(sha256);
      await expect(
        signPhotoGraphR2Upload(
          {
            key: "photography-images/_pending/1.png",
            contentType: "image/png",
            size: 1,
            sha256,
          },
          client,
        ),
      ).rejects.toThrow("staging key");
    } finally {
      client.destroy();
    }
  });

  it("verifies staging identity, copies once, and reuses only a matching destination", async () => {
    const { client, send } = fakeClient();
    expect(await publishPhotoGraphR2Upload(expected, client)).toBe(
      "photography-images/127.png",
    );
    const copy = send.mock.calls
      .map(([command]) => command)
      .find(
        (command) => command instanceof CopyObjectCommand,
      ) as CopyObjectCommand;
    expect(copy.input).toMatchObject({
      Bucket: "dextery-photo-graph",
      Key: "photography-images/127.png",
      CopySource: `dextery-photo-graph-staging/${source}`,
      IfNoneMatch: "*",
      CopySourceIfMatch: '"source-etag"',
    });
    expect(await publishPhotoGraphR2Upload(expected, client)).toBe(
      "photography-images/127.png",
    );
    expect(
      send.mock.calls.filter(
        ([command]) => command instanceof CopyObjectCommand,
      ),
    ).toHaveLength(1);
  });

  it("recovers a lost copy response but refuses a foreign destination", async () => {
    const ambiguous = fakeClient({ copyLosesResponse: true });
    expect(await publishPhotoGraphR2Upload(expected, ambiguous.client)).toBe(
      "photography-images/127.png",
    );
    const foreign = fakeClient({ foreignDestination: true });
    await expect(
      publishPhotoGraphR2Upload(expected, foreign.client),
    ).rejects.toThrow("Destination exists");
  });

  it("distinguishes a missing staged object and scopes cleanup to private staging", async () => {
    const missing = {
      send: vi.fn(async () => {
        throw { $metadata: { httpStatusCode: 404 } };
      }),
    } as unknown as S3Client;
    expect(await photoGraphR2StagedObjectStatus(source, missing)).toBeNull();
    const { client, send } = fakeClient();
    await removePhotoGraphR2StagedObject(source, client);
    expect(
      send.mock.calls.find(
        ([command]) => command instanceof DeleteObjectCommand,
      )?.[0],
    ).toBeInstanceOf(DeleteObjectCommand);
    await expect(
      removePhotoGraphR2StagedObject("photography-images/127.png", client),
    ).rejects.toThrow("staging key");
  });
});
