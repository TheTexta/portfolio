import {
  cloneGraphNodes,
  ensureGraphStoragePaths,
  ensureProcessingFeatures,
  loadGraphWithFallback,
} from "@/lib/photo-graph/graph-store";
import {
  beginPhotoGraphUpload,
  commitPhotoGraphUpload,
  loadPhotoGraphEdgeGenerationConfig,
  loadPhotoGraphNeighbors,
  loadPhotoGraphUploadRevision,
} from "@/lib/photo-graph/database";
import { PHOTO_GRAPH_SIMILARITY_MODELS } from "@/lib/photo-graph/similarity-models";
import type { PhotoGraphUploadResponse } from "@/lib/photo-graph/admin-types";
import {
  nextPhotoGraphNodeId,
  planPhotoGraphUploadNodes,
  planPhotoGraphUploadGraph,
  type ParsedUploadRegistration,
} from "@/lib/photo-graph/upload-plan";
import { getPhotoGraphStorageBucket } from "@/lib/supabase/config";
import { getServiceRoleSupabase } from "./supabase";
import {
  publishPhotoGraphR2Upload,
  removePhotoGraphR2StagedObject,
} from "./photo-graph-r2";
import {
  cleanupPhotoGraphUploadAssets,
  preparePhotoGraphUploadAssets,
} from "./photo-graph-upload-storage";

type RegistrationOutcome =
  | { kind: "registered"; result: PhotoGraphUploadResponse }
  | { kind: "unavailable" | "missing-features"; error: string };

/** Transport-independent registration. Exceptions retain sources for replay with the same key. */
export async function registerPhotoGraphUpload(
  uploadId: string,
  adminId: string,
  uploads: ParsedUploadRegistration[],
): Promise<RegistrationOutcome> {
  // Read before any graph queries so commit detects changes during generation.
  const revision = await loadPhotoGraphUploadRevision();
  const loaded = await loadGraphWithFallback();
  if (!loaded.databaseAvailable) {
    return {
      kind: "unavailable",
      error:
        "Photo graph persistence is unavailable. Restore Supabase connectivity before uploading new photos.",
    };
  }
  const reservation = await beginPhotoGraphUpload(
    uploadId,
    adminId,
    uploads,
    nextPhotoGraphNodeId(loaded.nodes) - 1,
  );
  const legacyUploads = uploads.filter(
    (upload) => upload.storageProvider !== "r2",
  );
  const r2Uploads = uploads.filter((upload) => upload.storageProvider === "r2");
  const storage = legacyUploads.length
    ? getServiceRoleSupabase().storage.from(getPhotoGraphStorageBucket())
    : null;
  async function cleanupSources() {
    const warnings: string[] = [];
    if (storage) {
      const warning = await cleanupPhotoGraphUploadAssets(
        storage,
        legacyUploads.map((upload) => upload.storagePath),
      );
      if (warning) warnings.push(warning);
    }
    for (const upload of r2Uploads) {
      try {
        await removePhotoGraphR2StagedObject(upload.storagePath);
      } catch {
        warnings.push(
          "Photos were registered, but private R2 upload cleanup remains. Retry registration to retry cleanup.",
        );
      }
    }
    return warnings.length ? warnings.join(" ") : undefined;
  }
  if (reservation.result) {
    const warning = await cleanupSources();
    return { kind: "registered", result: { ...reservation.result, warning } };
  }
  const config = await loadPhotoGraphEdgeGenerationConfig();
  const model = PHOTO_GRAPH_SIMILARITY_MODELS.find(
    (entry) => entry.id === config.model,
  );
  const missingColorFeatures = model?.requiresColorV1
    ? loaded.nodes.filter((node) => !node.feature?.colorV1)
    : [];
  if (missingColorFeatures.length) {
    return {
      kind: "missing-features",
      error: `The active ${config.model} model requires versioned color features. Apply the schema migration and backfill before uploading (${missingColorFeatures.length} existing node(s) missing).`,
    };
  }
  const existingNodes = cloneGraphNodes(loaded.nodes);
  // Normalize the shared existing-node objects before planning, as in the original route.
  const maxLongSide = ensureProcessingFeatures(existingNodes);
  ensureGraphStoragePaths(existingNodes);
  const plan = planPhotoGraphUploadNodes(
    existingNodes,
    maxLongSide,
    uploads,
    reservation.nodeIds,
  );
  if (storage && plan.legacyAssets.length)
    await preparePhotoGraphUploadAssets(storage, plan.legacyAssets);
  for (const asset of plan.r2Assets) await publishPhotoGraphR2Upload(asset);
  // Preserve neighbor-read timing: originals are published before graph generation.
  const previousNeighbors =
    loaded.source === "static"
      ? []
      : await loadPhotoGraphNeighbors(config.model);
  const graph = planPhotoGraphUploadGraph(
    plan,
    previousNeighbors,
    loaded.source,
    config,
  );
  const result = await commitPhotoGraphUpload(
    uploadId,
    revision,
    graph.generatedNodes,
    graph.sourceIds,
    graph.neighbors,
    config,
    {
      ok: true,
      createdIds: plan.createdIds,
      nodeCount: plan.nodes.length,
      edgeGenerationConfig: config,
    },
  );
  const warning = await cleanupSources();
  return { kind: "registered", result: { ...result, warning } };
}
