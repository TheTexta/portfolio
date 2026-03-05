"use client";

import {
  ChangeEvent,
  DragEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import NextImage from "next/image";
import { useRouter } from "next/navigation";

import {
  MIN_CORRELATION,
  computeCorrelation,
} from "@/lib/photo-graph/correlation";
import { featureFromRgb, rgbToHex } from "@/lib/photo-graph/feature-extraction";
import type {
  GraphFeature,
  GraphImageDimensions,
} from "@/lib/photo-graph/types";

type UploadApiResponse = {
  ok: boolean;
  createdIds: string[];
  nodeCount: number;
  error?: string;
};

type UploadUrlResponse = {
  ok: boolean;
  objectPath: string;
  uploadUrl: string;
  requiredHeaders?: Record<string, string>;
  expiresInSeconds: number;
  error?: string;
};

type AdminGraphNode = {
  id: string;
  scale?: number;
  colour?: string;
  storagePath?: string;
  url?: string;
  previewUrl?: string;
  correlations: Record<string, number>;
  feature?: GraphFeature;
  dimensions?: GraphImageDimensions;
};

type AdminGraphResponse = {
  source: "runtime" | "static";
  nodes: AdminGraphNode[];
  error?: string;
};

type ApplyCorrelationsResponse = {
  ok: boolean;
  appliedCount: number;
  touchedNodeCount: number;
  error?: string;
};

type DeletePhotoResponse = {
  ok: boolean;
  deletedId: string;
  nodeCount: number;
  error?: string;
};

type CorrelationUpdate = {
  leftId: string;
  rightId: string;
  correlation: number | null;
};

type ComputedFeaturePayload = {
  rgb: [number, number, number];
  lab: [number, number, number];
  hue: number;
  longSide: number;
  dimensions: GraphImageDimensions;
  colour: string;
};

type UploadRegistration = {
  storagePath: string;
  feature: Omit<ComputedFeaturePayload, "colour" | "dimensions">;
  dimensions: GraphImageDimensions;
};

type VerboseLogLevel = "info" | "success" | "warn" | "error";

type VerboseLogEntry = {
  id: number;
  createdAt: number;
  level: VerboseLogLevel;
  message: string;
};

const EDGE_UPDATE_BATCH_SIZE = 2000;
const COMPUTE_YIELD_INTERVAL = 750;

function bytesToMb(size: number) {
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

function formatLogTimestamp(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString(undefined, {
    hour12: false,
  });
}

async function parseJsonOrThrow<T>(response: Response): Promise<T> {
  const text = await response.text();

  try {
    return JSON.parse(text) as T;
  } catch {
    const fallback = text.trim() || `Request failed with status ${response.status}.`;
    throw new Error(fallback);
  }
}

function sortNodesById(nodes: AdminGraphNode[]) {
  return [...nodes].sort((left, right) => {
    const leftNumber = Number(left.id);
    const rightNumber = Number(right.id);

    if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
      return leftNumber - rightNumber;
    }

    return left.id.localeCompare(right.id);
  });
}

async function yieldToMainThread() {
  await new Promise<void>((resolve) => {
    window.setTimeout(() => resolve(), 0);
  });
}

async function loadImage(file: File) {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();

      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error(`Failed to load image: ${file.name}`));
      element.src = objectUrl;
    });

    return image;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function computeFeaturePayload(file: File): Promise<ComputedFeaturePayload> {
  const image = await loadImage(file);
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  if (!width || !height) {
    throw new Error(`Image has invalid dimensions: ${file.name}`);
  }

  const normalizedWidth = Math.max(1, Math.round(width));
  const normalizedHeight = Math.max(1, Math.round(height));
  const longSide = Math.max(1, Math.max(width, height));

  const ratio = longSide > 1024 ? 1024 / longSide : 1;
  const targetWidth = Math.max(1, Math.round(width * ratio));
  const targetHeight = Math.max(1, Math.round(height * ratio));

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    throw new Error("Unable to extract image data.");
  }

  context.drawImage(image, 0, 0, targetWidth, targetHeight);

  const { data } = context.getImageData(0, 0, targetWidth, targetHeight);

  let redSum = 0;
  let greenSum = 0;
  let blueSum = 0;
  let weightSum = 0;

  for (let index = 0; index < data.length; index += 4) {
    const alphaWeight = data[index + 3] / 255;
    if (alphaWeight <= 0) {
      continue;
    }

    redSum += data[index] * alphaWeight;
    greenSum += data[index + 1] * alphaWeight;
    blueSum += data[index + 2] * alphaWeight;
    weightSum += alphaWeight;
  }

  const safeWeight = weightSum || 1;

  const rgb: [number, number, number] = [
    redSum / safeWeight,
    greenSum / safeWeight,
    blueSum / safeWeight,
  ];

  const feature = featureFromRgb(rgb, longSide);

  return {
    rgb: feature.rgb,
    lab: feature.lab,
    hue: feature.hue,
    longSide: feature.longSide,
    dimensions: {
      width: normalizedWidth,
      height: normalizedHeight,
      aspectRatio: normalizedWidth / normalizedHeight,
    },
    colour: rgbToHex(feature.rgb),
  };
}

async function buildCorrelationUpdates(
  nodes: AdminGraphNode[],
  newNodeIds: string[],
  onProgress: (processed: number, total: number) => void,
) {
  const sortedNodes = sortNodesById(nodes);
  const newNodeSet = new Set(newNodeIds.map(String));
  const updates: CorrelationUpdate[] = [];

  let totalPairs = 0;
  for (let index = 0; index < sortedNodes.length; index += 1) {
    const left = sortedNodes[index];

    for (let offset = index + 1; offset < sortedNodes.length; offset += 1) {
      const right = sortedNodes[offset];
      if (newNodeSet.has(left.id) || newNodeSet.has(right.id)) {
        totalPairs += 1;
      }
    }
  }

  let processedPairs = 0;

  for (let index = 0; index < sortedNodes.length; index += 1) {
    const left = sortedNodes[index];

    for (let offset = index + 1; offset < sortedNodes.length; offset += 1) {
      const right = sortedNodes[offset];
      if (!(newNodeSet.has(left.id) || newNodeSet.has(right.id))) {
        continue;
      }

      processedPairs += 1;

      if (left.feature && right.feature) {
        const correlation = computeCorrelation(left.feature, right.feature);

        updates.push({
          leftId: left.id,
          rightId: right.id,
          correlation: correlation >= MIN_CORRELATION ? correlation : null,
        });
      }

      if (processedPairs % COMPUTE_YIELD_INTERVAL === 0) {
        onProgress(processedPairs, totalPairs);
        await yieldToMainThread();
      }
    }
  }

  onProgress(totalPairs, totalPairs);

  return {
    updates,
    totalPairs,
  };
}

export default function PhotoGraphUploadClient() {
  const router = useRouter();
  const correlationProgressRef = useRef(-1);

  const [files, setFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdIds, setCreatedIds] = useState<string[]>([]);
  const [graphNodes, setGraphNodes] = useState<AdminGraphNode[]>([]);
  const [loadingGraphNodes, setLoadingGraphNodes] = useState(false);
  const [deletingNodeId, setDeletingNodeId] = useState<string | null>(null);
  const [manageQuery, setManageQuery] = useState("");
  const [verbosePanelOpen, setVerbosePanelOpen] = useState(true);
  const [verboseLogs, setVerboseLogs] = useState<VerboseLogEntry[]>([]);

  const totalBytes = useMemo(
    () => files.reduce((sum, file) => sum + file.size, 0),
    [files],
  );

  const filteredGraphNodes = useMemo(() => {
    const query = manageQuery.trim().toLowerCase();
    const sortedNodes = sortNodesById(graphNodes);

    if (!query) {
      return sortedNodes;
    }

    return sortedNodes.filter((node) => {
      return (
        node.id.toLowerCase().includes(query) ||
        (node.storagePath ?? "").toLowerCase().includes(query)
      );
    });
  }, [graphNodes, manageQuery]);

  const appendVerboseLog = useCallback((message: string, level: VerboseLogLevel = "info") => {
    setVerboseLogs((current) => {
      const nextEntry: VerboseLogEntry = {
        id: Date.now() + Math.floor(Math.random() * 1000),
        createdAt: Date.now(),
        level,
        message,
      };

      const next = [...current, nextEntry];
      return next.length > 500 ? next.slice(next.length - 500) : next;
    });
  }, []);

  const setStatusWithLog = useCallback(
    (message: string, level: VerboseLogLevel = "info") => {
      setStatusMessage(message);
      appendVerboseLog(message, level);
    },
    [appendVerboseLog],
  );

  const clearVerboseLogs = useCallback(() => {
    setVerboseLogs([]);
  }, []);

  const fetchGraphNodes = useCallback(
    async (silent = false) => {
      if (!silent) {
        setStatusWithLog("Loading graph nodes for admin panel...");
      }

      setLoadingGraphNodes(true);

      try {
        const response = await fetch("/api/admin/photo-graph/graph", {
          method: "GET",
          cache: "no-store",
        });

        const body = await parseJsonOrThrow<AdminGraphResponse>(response);

        if (!response.ok || !Array.isArray(body.nodes)) {
          throw new Error(body.error ?? "Failed to load graph metadata.");
        }

        setGraphNodes(body.nodes);
        appendVerboseLog(
          `Admin panel refreshed (${body.nodes.length} node(s), source: ${body.source}).`,
          "success",
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to load graph nodes.";
        appendVerboseLog(`Admin panel refresh failed: ${message}`, "error");
      } finally {
        setLoadingGraphNodes(false);
      }
    },
    [appendVerboseLog, setStatusWithLog],
  );

  useEffect(() => {
    void fetchGraphNodes(true);
  }, [fetchGraphNodes]);

  const addFiles = useCallback((incomingFiles: FileList | File[]) => {
    const list = Array.from(incomingFiles);

    setFiles((current) => {
      const map = new Map(
        current.map((file) => [`${file.name}:${file.size}:${file.lastModified}`, file]),
      );

      for (const file of list) {
        map.set(`${file.name}:${file.size}:${file.lastModified}`, file);
      }

      return Array.from(map.values());
    });
  }, []);

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files?.length) {
      return;
    }

    addFiles(event.target.files);
    event.target.value = "";
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();

    if (!event.dataTransfer.files.length) {
      return;
    }

    addFiles(event.dataTransfer.files);
  };

  const applyCorrelationBatches = async (updates: CorrelationUpdate[]) => {
    if (!updates.length) {
      appendVerboseLog("No correlation updates to apply.", "warn");
      return;
    }

    const totalBatches = Math.ceil(updates.length / EDGE_UPDATE_BATCH_SIZE);
    appendVerboseLog(
      `Applying ${updates.length} edge updates in ${totalBatches} batch(es).`,
      "info",
    );

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex += 1) {
      const start = batchIndex * EDGE_UPDATE_BATCH_SIZE;
      const end = start + EDGE_UPDATE_BATCH_SIZE;
      const batch = updates.slice(start, end);

      setStatusWithLog(`Applying edge updates (${batchIndex + 1}/${totalBatches})...`);

      const response = await fetch("/api/admin/photo-graph/apply-correlations", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ updates: batch }),
      });

      const body = await parseJsonOrThrow<ApplyCorrelationsResponse>(response);

      if (!response.ok || !body.ok) {
        throw new Error(body.error ?? "Failed to apply correlation updates.");
      }

      appendVerboseLog(
        `Applied batch ${batchIndex + 1}/${totalBatches} (${batch.length} updates).`,
        "success",
      );
    }
  };

  const handleDeleteNode = useCallback(
    async (node: AdminGraphNode) => {
      const confirmed = window.confirm(
        `Delete node ${node.id}? This removes the photo and its graph edges.`,
      );

      if (!confirmed) {
        return;
      }

      setDeletingNodeId(node.id);
      setErrorMessage(null);
      setStatusWithLog(`Deleting node ${node.id}...`, "warn");

      try {
        const response = await fetch("/api/admin/photo-graph/delete", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({ nodeId: node.id }),
        });

        const body = await parseJsonOrThrow<DeletePhotoResponse>(response);

        if (!response.ok || !body.ok) {
          throw new Error(body.error ?? "Failed to delete node.");
        }

        appendVerboseLog(
          `Deleted node ${body.deletedId}. Remaining nodes: ${body.nodeCount}.`,
          "success",
        );

        setCreatedIds((current) => current.filter((id) => id !== node.id));
        await fetchGraphNodes(true);
        setStatusWithLog(`Node ${body.deletedId} deleted.`, "success");
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Delete failed unexpectedly.";
        setErrorMessage(message);
        appendVerboseLog(`Delete failed for node ${node.id}: ${message}`, "error");
      } finally {
        setDeletingNodeId(null);
      }
    },
    [appendVerboseLog, fetchGraphNodes, setStatusWithLog],
  );

  const handleUpload = async () => {
    if (!files.length || isProcessing) {
      return;
    }

    correlationProgressRef.current = -1;
    setIsProcessing(true);
    setErrorMessage(null);
    setStatusWithLog("Starting upload pipeline...", "info");

    try {
      appendVerboseLog(`Validated ${files.length} file(s) for upload.`, "success");

      const registrations: UploadRegistration[] = [];

      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];

        setStatusWithLog(`Extracting image features (${index + 1}/${files.length}): ${file.name}`);
        const featurePayload = await computeFeaturePayload(file);
        appendVerboseLog(`Feature extraction complete: ${file.name}.`, "success");

        setStatusWithLog(`Requesting upload URL (${index + 1}/${files.length}): ${file.name}`);
        const uploadUrlResponse = await fetch("/api/admin/photo-graph/upload-url", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            filename: file.name,
            contentType: file.type,
          }),
        });

        const uploadUrlBody = await parseJsonOrThrow<UploadUrlResponse>(uploadUrlResponse);

        if (!uploadUrlResponse.ok || !uploadUrlBody.ok) {
          throw new Error(uploadUrlBody.error ?? "Failed to get upload URL.");
        }

        setStatusWithLog(`Uploading directly to Firebase (${index + 1}/${files.length}): ${file.name}`);

        const directUploadResponse = await fetch(uploadUrlBody.uploadUrl, {
          method: "PUT",
          headers: uploadUrlBody.requiredHeaders ?? { "content-type": file.type },
          body: file,
        });

        if (!directUploadResponse.ok) {
          const failureText = await directUploadResponse.text();
          throw new Error(
            failureText.trim() ||
              `Direct upload failed for ${file.name} (status ${directUploadResponse.status}).`,
          );
        }

        registrations.push({
          storagePath: uploadUrlBody.objectPath,
          feature: {
            rgb: featurePayload.rgb,
            lab: featurePayload.lab,
            hue: featurePayload.hue,
            longSide: featurePayload.longSide,
          },
          dimensions: featurePayload.dimensions,
        });

        appendVerboseLog(
          `Direct upload complete: ${file.name} -> ${uploadUrlBody.objectPath}.`,
          "success",
        );
      }

      setStatusWithLog("Registering uploaded files as graph nodes...");

      const registerResponse = await fetch("/api/admin/photo-graph/upload", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          uploads: registrations,
        }),
      });

      const registerBody = await parseJsonOrThrow<UploadApiResponse>(registerResponse);

      if (!registerResponse.ok || !registerBody.ok) {
        throw new Error(registerBody.error ?? "Upload registration failed.");
      }

      setCreatedIds(registerBody.createdIds);
      setFiles([]);

      appendVerboseLog(
        `Registered ${registerBody.createdIds.length} new node(s): ${registerBody.createdIds.join(", ")}.`,
        "success",
      );

      setStatusWithLog("Fetching graph snapshot for local edge generation...");

      const graphResponse = await fetch("/api/admin/photo-graph/graph", {
        method: "GET",
        cache: "no-store",
      });

      const graphBody = await parseJsonOrThrow<AdminGraphResponse>(graphResponse);

      if (!graphResponse.ok || !Array.isArray(graphBody.nodes)) {
        throw new Error(graphBody.error ?? "Failed to load graph metadata.");
      }

      appendVerboseLog(
        `Loaded graph snapshot (${graphBody.nodes.length} node(s), source: ${graphBody.source}).`,
        "success",
      );

      const correlationBuild = await buildCorrelationUpdates(
        graphBody.nodes,
        registerBody.createdIds,
        (processed, total) => {
          const ratio = total > 0 ? Math.round((processed / total) * 100) : 100;
          setStatusWithLog(`Generating edges in browser (${ratio}%)...`);

          if (ratio >= correlationProgressRef.current + 10 || ratio === 100) {
            correlationProgressRef.current = ratio;
            appendVerboseLog(
              `Edge generation progress: ${processed}/${total} (${ratio}%).`,
              "info",
            );
          }
        },
      );

      appendVerboseLog(
        `Edge generation complete (${correlationBuild.totalPairs} comparisons, ${correlationBuild.updates.length} updates).`,
        "success",
      );

      await applyCorrelationBatches(correlationBuild.updates);
      await fetchGraphNodes(true);

      setStatusWithLog(
        `Done. Added ${registerBody.createdIds.length} image(s) and generated ${correlationBuild.updates.length} edge updates.`,
        "success",
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Upload failed unexpectedly.";
      setErrorMessage(message);
      setStatusMessage(null);
      appendVerboseLog(`Pipeline failed: ${message}`, "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/admin/photo-graph/logout", {
      method: "POST",
    });

    router.push("/admin/photo-graph/login");
    router.refresh();
  };

  const uploadDisabled = !files.length || isProcessing;

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Photo Graph Upload Admin</h1>
          <p className="mt-1 text-sm opacity-70">
            Batch upload images directly to Firebase, then your browser generates node correlations and syncs updates.
          </p>
        </div>

        <button
          onClick={handleLogout}
          className="rounded-md border border-black px-3 py-2 text-sm dark:border-white"
        >
          Log Out
        </button>
      </div>

      <div
        onDrop={handleDrop}
        onDragOver={(event) => event.preventDefault()}
        className="rounded-lg border border-dashed border-black/30 p-6 text-center dark:border-white/30"
      >
        <p className="text-sm">Drag and drop images here</p>
        <p className="my-2 text-xs opacity-70">or</p>
        <label className="inline-flex cursor-pointer items-center rounded-md border border-black px-3 py-2 text-sm dark:border-white">
          Select Files
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            onChange={handleInputChange}
            className="hidden"
          />
        </label>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm">
        <p>{files.length} file(s) selected</p>
        <p>{bytesToMb(totalBytes)}</p>
      </div>

      {files.length > 0 && (
        <ul className="mt-3 max-h-56 overflow-y-auto rounded-md border border-black/20 p-3 text-sm dark:border-white/20">
          {files.map((file) => (
            <li key={`${file.name}-${file.size}-${file.lastModified}`} className="py-1">
              {file.name} ({bytesToMb(file.size)})
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5 flex items-center gap-3">
        <button
          onClick={handleUpload}
          disabled={uploadDisabled}
          className="rounded-md border border-black px-4 py-2 text-sm font-medium disabled:opacity-50 dark:border-white"
        >
          {isProcessing ? "Processing..." : "Upload + Generate Edges"}
        </button>

        {files.length > 0 && (
          <button
            onClick={() => setFiles([])}
            disabled={isProcessing}
            className="rounded-md border border-black/50 px-4 py-2 text-sm disabled:opacity-50 dark:border-white/50"
          >
            Clear
          </button>
        )}

        <button
          onClick={() => setVerbosePanelOpen((current) => !current)}
          className="rounded-md border border-black/50 px-4 py-2 text-sm dark:border-white/50"
        >
          {verbosePanelOpen ? "Hide Verbose Panel" : "Show Verbose Panel"}
        </button>

        <button
          onClick={clearVerboseLogs}
          className="rounded-md border border-black/50 px-4 py-2 text-sm dark:border-white/50"
        >
          Clear Logs
        </button>
      </div>

      {statusMessage && <p className="mt-4 text-sm text-blue-700">{statusMessage}</p>}
      {errorMessage && <p className="mt-2 text-sm text-red-600">{errorMessage}</p>}

      {createdIds.length > 0 && (
        <p className="mt-2 text-xs opacity-70">
          Created node IDs: {createdIds.join(", ")}
        </p>
      )}

      <section className="mt-6 rounded-md border border-black/20 p-4 dark:border-white/20">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">Manage Photos</h2>
          <div className="flex items-center gap-2 text-xs">
            <span className="opacity-70">{graphNodes.length} total node(s)</span>
            <button
              onClick={() => void fetchGraphNodes()}
              disabled={loadingGraphNodes || isProcessing || deletingNodeId !== null}
              className="rounded-md border border-black/50 px-2 py-1 disabled:opacity-50 dark:border-white/50"
            >
              {loadingGraphNodes ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        <div className="mt-3">
          <input
            type="text"
            value={manageQuery}
            onChange={(event) => setManageQuery(event.target.value)}
            placeholder="Filter by node ID or storage path..."
            className="w-full rounded-md border border-black/20 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/50 dark:border-white/20 dark:focus:border-white/50"
          />
        </div>

        <div className="mt-3 max-h-64 overflow-y-auto rounded-md border border-black/10 p-2 text-xs dark:border-white/10">
          {filteredGraphNodes.length === 0 ? (
            <p className="px-2 py-2 opacity-70">No nodes match your filter.</p>
          ) : (
            <ul className="space-y-1">
              {filteredGraphNodes.map((node) => {
                const isDeleting = deletingNodeId === node.id;
                return (
                  <li
                    key={node.id}
                    className="flex flex-col gap-2 rounded-md border border-black/10 p-2 dark:border-white/10"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-2">
                        {node.previewUrl ? (
                          <NextImage
                            src={node.previewUrl}
                            alt={`Node ${node.id}`}
                            width={44}
                            height={44}
                            sizes="44px"
                            className="h-11 w-11 rounded object-cover"
                          />
                        ) : (
                          <div className="h-11 w-11 rounded border border-black/20 dark:border-white/20" />
                        )}

                        <div className="min-w-0 font-mono text-[11px]">
                          <div>
                            <span className="font-semibold">ID {node.id}</span>{" "}
                            <span className="opacity-70">
                              ({Object.keys(node.correlations ?? {}).length} edges)
                            </span>
                          </div>
                          {node.storagePath && (
                            <p className="mt-1 break-all font-mono text-[10px] opacity-70">
                              {node.storagePath}
                            </p>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => void handleDeleteNode(node)}
                        disabled={
                          isProcessing ||
                          loadingGraphNodes ||
                          (deletingNodeId !== null && !isDeleting)
                        }
                        className="rounded-md border border-red-500/70 px-2 py-1 text-red-600 disabled:opacity-50"
                      >
                        {isDeleting ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <section className="mt-6 rounded-md border border-black/20 p-4 dark:border-white/20">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">Verbose Activity</h2>
          <p className="text-xs opacity-70">{verboseLogs.length} log entries</p>
        </div>

        {verbosePanelOpen ? (
          <div className="mt-3 max-h-64 overflow-y-auto rounded-md border border-black/10 bg-black/5 p-3 text-xs dark:border-white/10 dark:bg-white/5">
            {verboseLogs.length === 0 ? (
              <p className="opacity-70">No activity yet.</p>
            ) : (
              <ul className="space-y-1">
                {verboseLogs.map((entry) => (
                  <li key={entry.id} className="font-mono leading-relaxed">
                    <span className="opacity-70">[{formatLogTimestamp(entry.createdAt)}]</span>{" "}
                    <span
                      className={
                        entry.level === "error"
                          ? "text-red-600"
                          : entry.level === "warn"
                            ? "text-amber-600"
                            : entry.level === "success"
                              ? "text-green-600"
                              : "text-blue-600"
                      }
                    >
                      {entry.level.toUpperCase()}
                    </span>{" "}
                    {entry.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <p className="mt-2 text-xs opacity-70">Panel hidden.</p>
        )}
      </section>
    </main>
  );
}
