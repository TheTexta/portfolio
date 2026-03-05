import { FieldValue } from "firebase-admin/firestore";

import {
  MIN_CORRELATION,
  computeCorrelation,
} from "@/lib/photo-graph/correlation";
import {
  cloneGraphNodes,
  ensureProcessingFeatures,
  loadGraphWithFallback,
  writeRuntimeGraph,
} from "@/lib/photo-graph/graph-store";
import { getFirebaseAdminDb } from "@/lib/server/firebase-admin";
import type { GraphNode, PhotoGraphJobDocument } from "@/lib/photo-graph/types";

const JOB_COLLECTION = "photoGraphJobs";

function parseJobData(raw: unknown): PhotoGraphJobDocument | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const record = raw as Record<string, unknown>;
  const status = record.status;

  if (
    status !== "queued" &&
    status !== "running" &&
    status !== "completed" &&
    status !== "failed"
  ) {
    return null;
  }

  return {
    status,
    newNodeIds: Array.isArray(record.newNodeIds)
      ? record.newNodeIds.map(String)
      : [],
    progress:
      typeof record.progress === "number" && Number.isFinite(record.progress)
        ? record.progress
        : 0,
    totalComparisons:
      typeof record.totalComparisons === "number" &&
      Number.isFinite(record.totalComparisons)
        ? Math.max(0, Math.round(record.totalComparisons))
        : 0,
    doneComparisons:
      typeof record.doneComparisons === "number" &&
      Number.isFinite(record.doneComparisons)
        ? Math.max(0, Math.round(record.doneComparisons))
        : 0,
    pairCursor:
      typeof record.pairCursor === "number" && Number.isFinite(record.pairCursor)
        ? Math.max(0, Math.round(record.pairCursor))
        : 0,
    createdAtMs:
      typeof record.createdAtMs === "number" && Number.isFinite(record.createdAtMs)
        ? record.createdAtMs
        : Date.now(),
    updatedAtMs:
      typeof record.updatedAtMs === "number" && Number.isFinite(record.updatedAtMs)
        ? record.updatedAtMs
        : Date.now(),
    errorMessage:
      typeof record.errorMessage === "string" ? record.errorMessage : undefined,
  };
}

function sortNodesById(nodes: GraphNode[]) {
  return [...nodes].sort((left, right) => {
    const leftNumber = Number(left.id);
    const rightNumber = Number(right.id);

    if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
      return leftNumber - rightNumber;
    }

    return left.id.localeCompare(right.id);
  });
}

function buildComparisonPairs(nodes: GraphNode[], newNodeSet: Set<string>) {
  const pairs: Array<[string, string]> = [];

  for (let index = 0; index < nodes.length; index += 1) {
    const left = nodes[index];

    for (let offset = index + 1; offset < nodes.length; offset += 1) {
      const right = nodes[offset];

      if (!(newNodeSet.has(left.id) || newNodeSet.has(right.id))) {
        continue;
      }

      pairs.push([left.id, right.id]);
    }
  }

  return pairs;
}

function applyCorrelation(
  left: GraphNode,
  right: GraphNode,
  correlation: number,
) {
  if (correlation >= MIN_CORRELATION) {
    left.correlations[right.id] = correlation;
    right.correlations[left.id] = correlation;
    return;
  }

  delete left.correlations[right.id];
  delete right.correlations[left.id];
}

function comparisonCount(nodeCount: number, newNodeCount: number) {
  if (nodeCount <= 1 || newNodeCount <= 0) {
    return 0;
  }

  return newNodeCount * (nodeCount - newNodeCount) + (newNodeCount * (newNodeCount - 1)) / 2;
}

export async function createPhotoGraphJob(newNodeIds: string[], nodeCount: number) {
  const db = getFirebaseAdminDb();
  const jobRef = db.collection(JOB_COLLECTION).doc();
  const now = Date.now();
  const totalComparisons = comparisonCount(nodeCount, newNodeIds.length);

  await jobRef.set({
    status: "queued",
    newNodeIds,
    progress: totalComparisons === 0 ? 1 : 0,
    totalComparisons,
    doneComparisons: 0,
    pairCursor: 0,
    createdAtMs: now,
    updatedAtMs: now,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return jobRef.id;
}

export async function getPhotoGraphJobById(jobId: string) {
  const db = getFirebaseAdminDb();
  const snapshot = await db.collection(JOB_COLLECTION).doc(jobId).get();

  if (!snapshot.exists) {
    return null;
  }

  const parsed = parseJobData(snapshot.data());
  if (!parsed) {
    return null;
  }

  return {
    id: snapshot.id,
    ...parsed,
  };
}

async function findNextCandidateJob() {
  const db = getFirebaseAdminDb();
  const queuedSnapshot = await db
    .collection(JOB_COLLECTION)
    .where("status", "==", "queued")
    .limit(1)
    .get();

  if (!queuedSnapshot.empty) {
    const queuedDocument = queuedSnapshot.docs[0];
    const parsed = parseJobData(queuedDocument.data());

    if (parsed) {
      return {
        ref: queuedDocument.ref,
        data: parsed,
      };
    }
  }

  const runningSnapshot = await db
    .collection(JOB_COLLECTION)
    .where("status", "==", "running")
    .limit(1)
    .get();

  if (!runningSnapshot.empty) {
    const runningDocument = runningSnapshot.docs[0];
    const parsed = parseJobData(runningDocument.data());

    if (parsed) {
      return {
        ref: runningDocument.ref,
        data: parsed,
      };
    }
  }

  return null;
}

async function claimJob(candidateId: string) {
  const db = getFirebaseAdminDb();
  const jobRef = db.collection(JOB_COLLECTION).doc(candidateId);

  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(jobRef);
    if (!snapshot.exists) {
      return null;
    }

    const parsed = parseJobData(snapshot.data());
    if (!parsed) {
      return null;
    }

    if (parsed.status !== "queued" && parsed.status !== "running") {
      return null;
    }

    const now = Date.now();

    transaction.update(jobRef, {
      status: "running",
      updatedAtMs: now,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return {
      id: snapshot.id,
      ...parsed,
      status: "running" as const,
      updatedAtMs: now,
    };
  });
}

export async function runNextPhotoGraphJob(options?: { maxComparisons?: number }) {
  const maxComparisons = Math.max(1, Math.round(options?.maxComparisons ?? 300));
  const candidate = await findNextCandidateJob();

  if (!candidate) {
    return {
      state: "idle" as const,
      message: "No queued or running jobs.",
    };
  }

  const claimed = await claimJob(candidate.ref.id);
  if (!claimed) {
    return {
      state: "skipped" as const,
      message: "Job could not be claimed.",
    };
  }

  const db = getFirebaseAdminDb();
  const jobRef = db.collection(JOB_COLLECTION).doc(claimed.id);

  try {
    const loaded = await loadGraphWithFallback();
    const mutableNodes = sortNodesById(cloneGraphNodes(loaded.nodes));
    ensureProcessingFeatures(mutableNodes);

    const nodeById = new Map(mutableNodes.map((node) => [node.id, node]));
    const newNodeSet = new Set(claimed.newNodeIds.map(String));
    const pairs = buildComparisonPairs(mutableNodes, newNodeSet);
    const totalComparisons = pairs.length;

    const startCursor = Math.min(claimed.pairCursor, totalComparisons);
    const endCursor = Math.min(startCursor + maxComparisons, totalComparisons);

    for (let index = startCursor; index < endCursor; index += 1) {
      const [leftId, rightId] = pairs[index];
      const left = nodeById.get(leftId);
      const right = nodeById.get(rightId);

      if (!left || !right || !left.feature || !right.feature) {
        continue;
      }

      const correlation = computeCorrelation(left.feature, right.feature);
      applyCorrelation(left, right, correlation);
    }

    if (endCursor > startCursor || loaded.source === "static") {
      await writeRuntimeGraph(mutableNodes);
    }

    const completed = endCursor >= totalComparisons;
    const progress = totalComparisons === 0 ? 1 : endCursor / totalComparisons;
    const now = Date.now();

    await jobRef.update({
      status: completed ? "completed" : "running",
      totalComparisons,
      doneComparisons: endCursor,
      pairCursor: endCursor,
      progress,
      updatedAtMs: now,
      updatedAt: FieldValue.serverTimestamp(),
      errorMessage: FieldValue.delete(),
    });

    return {
      state: "processed" as const,
      jobId: claimed.id,
      completed,
      doneComparisons: endCursor,
      totalComparisons,
      progress,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown job error";

    await jobRef.update({
      status: "failed",
      errorMessage: message,
      updatedAtMs: Date.now(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return {
      state: "failed" as const,
      jobId: claimed.id,
      message,
    };
  }
}
