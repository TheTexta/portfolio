import {
  completePhotoGraphR2CleanupJob,
  listPendingPhotoGraphR2CleanupJobs,
  loadPhotoGraphR2CleanupJob,
  photoGraphR2PathIsReferenced,
} from "@/lib/photo-graph/database";
import { isPhotoGraphR2PublishedKey } from "@/lib/photo-graph/r2-paths";
import { removePhotoGraphR2PublishedObject } from "@/lib/server/photo-graph-r2";

/** A job retains the immutable provider/key even after its graph node is gone. */
export async function processPhotoGraphR2CleanupJob(id: number) {
  const job = await loadPhotoGraphR2CleanupJob(id);
  if (job.completed_at) return;
  if (!isPhotoGraphR2PublishedKey(job.storage_path)) {
    throw new Error("Invalid R2 cleanup target; object retained for review.");
  }
  if (await photoGraphR2PathIsReferenced(job.storage_path)) {
    throw new Error("R2 cleanup target is still referenced; object retained.");
  }
  await removePhotoGraphR2PublishedObject(job.storage_path);
  await completePhotoGraphR2CleanupJob(job.id);
}

export async function retryPhotoGraphR2CleanupJobs() {
  const jobs = await listPendingPhotoGraphR2CleanupJobs(20);
  let resolved = 0;
  let failed = 0;
  for (const job of jobs) {
    try {
      await processPhotoGraphR2CleanupJob(job.id);
      resolved++;
    } catch {
      failed++;
    }
  }
  return { attempted: jobs.length, resolved, failed };
}
