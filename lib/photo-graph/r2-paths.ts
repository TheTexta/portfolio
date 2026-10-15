import { assertPhotoGraphR2ImageBasePath } from "@/lib/photo-graph/config";

export const PHOTO_GRAPH_R2_PUBLISHED_BUCKET = "dextery-photo-graph";
export const PHOTO_GRAPH_R2_STAGING_BUCKET = "dextery-photo-graph-staging";
export const PHOTO_GRAPH_R2_MAX_UPLOAD_BYTES = 524_288_000;

const UUID =
  "[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const STAGING_KEY = new RegExp(`^staging/(${UUID})\\.(png|jpg|webp)$`, "i");
const PUBLISHED_KEY = /^photography-images\/[0-9]+\.(?:png|jpg|webp)$/;

export function photoGraphR2Extension(contentType: string) {
  if (contentType === "image/png") return "png";
  if (contentType === "image/jpeg") return "jpg";
  if (contentType === "image/webp") return "webp";
  throw new Error("Unsupported Photo Graph image content type.");
}

export function photoGraphR2StagingKey(id: string, contentType: string) {
  const key = `staging/${id}.${photoGraphR2Extension(contentType)}`;
  if (!STAGING_KEY.test(key)) throw new Error("Invalid R2 staging object ID.");
  return key;
}

export function isPhotoGraphR2StagingKey(value: unknown): value is string {
  return typeof value === "string" && STAGING_KEY.test(value);
}

export function photoGraphR2PublishedKey(nodeId: string, stagingKey: string) {
  const match = STAGING_KEY.exec(stagingKey);
  if (!match || !/^[0-9]+$/.test(nodeId)) {
    throw new Error("Invalid R2 photograph destination.");
  }
  return `${assertPhotoGraphR2ImageBasePath()}/${nodeId}.${match[2].toLowerCase()}`;
}

export function isPhotoGraphR2PublishedKey(value: unknown): value is string {
  return typeof value === "string" && PUBLISHED_KEY.test(value);
}

export function photoGraphWriteProvider(
  configured: string | undefined = process.env.PHOTO_GRAPH_MEDIA_WRITE_PROVIDER,
): "supabase" | "r2" {
  if (configured === undefined || configured === "supabase") return "supabase";
  if (configured === "r2") return "r2";
  throw new Error("Invalid PHOTO_GRAPH_MEDIA_WRITE_PROVIDER.");
}
