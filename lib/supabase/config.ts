import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { TransformOptions } from "@supabase/storage-js";

const DEFAULT_PHOTO_GRAPH_BUCKET = "dextery.dev";
let publicStorageClient: SupabaseClient | null = null;

function readRequiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required Supabase env var: ${name}`);
  }

  return value;
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function getPublicStorageClient() {
  if (publicStorageClient) {
    return publicStorageClient;
  }

  publicStorageClient = createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });

  return publicStorageClient;
}

export function getSupabaseUrl() {
  return trimTrailingSlash(readRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"));
}

export function getSupabaseAnonKey() {
  return readRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

export function getSupabaseServiceRoleKey() {
  return readRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
}

export function getPhotoGraphStorageBucket() {
  return (
    process.env.SUPABASE_PHOTO_GRAPH_BUCKET ??
    process.env.NEXT_PUBLIC_SUPABASE_PHOTO_GRAPH_BUCKET ??
    DEFAULT_PHOTO_GRAPH_BUCKET
  );
}

export function getSupabaseProjectHostname() {
  return new URL(getSupabaseUrl()).hostname;
}

export function buildSupabaseStoragePublicUrl(
  objectPath: string,
  bucket = getPhotoGraphStorageBucket(),
) {
  return getPublicStorageClient().storage.from(bucket).getPublicUrl(objectPath)
    .data.publicUrl;
}

export function buildSupabaseStorageRenderUrl(
  objectPath: string,
  options: TransformOptions,
  bucket = getPhotoGraphStorageBucket(),
) {
  return getPublicStorageClient()
    .storage.from(bucket)
    .getPublicUrl(objectPath, {
      transform: options,
    }).data.publicUrl;
}
