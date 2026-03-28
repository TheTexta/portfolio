"use client";

import {
  ChangeEvent,
  DragEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import PhotoGraphCanvas from "@/app/components/projects/photo-graph/PhotoGraphCanvas";
import {
  OVERLAY_CONTROL_DANGER_CLASS,
  OverlayControlButton,
  OverlayControlLabel,
} from "@/app/components/ui/overlay-control-button";
import {
  DEFAULT_LAB_EDGE_GENERATION_PARAMS,
  DEFAULT_PHOTO_GRAPH_EDGE_GENERATION_CONFIG,
  LAB_EDGE_PARAM_LIMITS,
} from "@/lib/photo-graph/edge-generation";
import { PHOTO_GRAPH_CACHE_CONTROL_SECONDS } from "@/lib/photo-graph/config";
import { featureFromRgb, rgbToHex } from "@/lib/photo-graph/feature-extraction";
import type {
  GraphFeature,
  GraphImageDimensions,
  LabEdgeGenerationParams,
  PhotoGraphEdgeGenerationConfig,
} from "@/lib/photo-graph/types";
import { getBrowserSupabaseClient } from "@/lib/supabase/browser";

type UploadApiResponse = {
  ok: boolean;
  createdIds: string[];
  nodeCount: number;
  edgeCount: number;
  edgeGenerationConfig: PhotoGraphEdgeGenerationConfig;
  error?: string;
};

type UploadUrlResponse = {
  ok: boolean;
  bucket: string;
  objectPath: string;
  token: string;
  signedUrl: string;
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
  source: "database" | "static";
  nodes: AdminGraphNode[];
  writesEnabled: boolean;
  defaultEdgeGeneration: PhotoGraphEdgeGenerationConfig;
  error?: string;
};

type SaveEdgeDefaultsResponse = {
  ok: boolean;
  source: "database" | "static";
  edgeCount: number;
  config: PhotoGraphEdgeGenerationConfig;
  error?: string;
};

type DeletePhotoResponse = {
  ok: boolean;
  deletedId: string;
  nodeCount: number;
  error?: string;
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

type FetchGraphNodesOptions = {
  silent?: boolean;
  syncPreviewParams?: boolean;
};

const PREVIEW_UPDATE_DEBOUNCE_MS = 250;

function bytesToMb(size: number) {
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

function formatLogTimestamp(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString(undefined, {
    hour12: false,
  });
}

function formatSigmaE(value: number) {
  return value.toFixed(1);
}

function formatMinCorrelation(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function compareNodeIds(leftId: string, rightId: string) {
  const leftNumber = Number(leftId);
  const rightNumber = Number(rightId);

  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
    return leftNumber - rightNumber;
  }

  return leftId.localeCompare(rightId);
}

function areLabParamsEqual(
  left: LabEdgeGenerationParams,
  right: LabEdgeGenerationParams,
) {
  return (
    Math.abs(left.sigmaE - right.sigmaE) < 1e-9 &&
    Math.abs(left.minCorrelation - right.minCorrelation) < 1e-9
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function countAdminGraphEdges(nodes: AdminGraphNode[]) {
  let count = 0;

  for (const node of nodes) {
    for (const [targetId, correlation] of Object.entries(node.correlations ?? {})) {
      if (
        !Number.isFinite(correlation) ||
        correlation <= 0 ||
        compareNodeIds(node.id, targetId) >= 0
      ) {
        continue;
      }

      count += 1;
    }
  }

  return count;
}

async function parseJsonOrThrow<T>(response: Response): Promise<T> {
  const text = await response.text();

  try {
    return JSON.parse(text) as T;
  } catch {
    const fallback =
      text.trim() || `Request failed with status ${response.status}.`;
    throw new Error(fallback);
  }
}

function sortNodesById(nodes: AdminGraphNode[]) {
  return [...nodes].sort((left, right) => compareNodeIds(left.id, right.id));
}

async function loadImage(file: File) {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();

      element.onload = () => resolve(element);
      element.onerror = () =>
        reject(new Error(`Failed to load image: ${file.name}`));
      element.src = objectUrl;
    });

    return image;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function computeFeaturePayload(
  file: File,
): Promise<ComputedFeaturePayload> {
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

function buildPreviewGraphUrl(
  params: LabEdgeGenerationParams,
  revision: number,
) {
  const searchParams = new URLSearchParams({
    sigmaE: params.sigmaE.toString(),
    minCorrelation: params.minCorrelation.toString(),
    revision: revision.toString(),
  });

  return `/api/admin/photo-graph/graph-preview?${searchParams.toString()}`;
}

export default function PhotoGraphUploadClient() {
  const router = useRouter();

  const [files, setFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSavingEdgeDefaults, setIsSavingEdgeDefaults] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdIds, setCreatedIds] = useState<string[]>([]);
  const [graphNodes, setGraphNodes] = useState<AdminGraphNode[]>([]);
  const [graphSource, setGraphSource] = useState<"database" | "static">(
    "database",
  );
  const [writesEnabled, setWritesEnabled] = useState(true);
  const [loadingGraphNodes, setLoadingGraphNodes] = useState(false);
  const [deletingNodeId, setDeletingNodeId] = useState<string | null>(null);
  const [manageQuery, setManageQuery] = useState("");
  const [verbosePanelOpen, setVerbosePanelOpen] = useState(true);
  const [verboseLogs, setVerboseLogs] = useState<VerboseLogEntry[]>([]);
  const [savedEdgeGeneration, setSavedEdgeGeneration] =
    useState<PhotoGraphEdgeGenerationConfig>(
      DEFAULT_PHOTO_GRAPH_EDGE_GENERATION_CONFIG,
    );
  const [previewParams, setPreviewParams] = useState<LabEdgeGenerationParams>(
    DEFAULT_LAB_EDGE_GENERATION_PARAMS,
  );
  const [debouncedPreviewParams, setDebouncedPreviewParams] =
    useState<LabEdgeGenerationParams>(DEFAULT_LAB_EDGE_GENERATION_PARAMS);
  const [previewRevision, setPreviewRevision] = useState(0);

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

  const persistedEdgeCount = useMemo(
    () => countAdminGraphEdges(graphNodes),
    [graphNodes],
  );

  const previewMatchesSavedDefaults = useMemo(
    () => areLabParamsEqual(previewParams, savedEdgeGeneration.params),
    [previewParams, savedEdgeGeneration.params],
  );

  const previewIsUpdating = useMemo(
    () => !areLabParamsEqual(previewParams, debouncedPreviewParams),
    [debouncedPreviewParams, previewParams],
  );

  const previewGraphUrl = useMemo(
    () => buildPreviewGraphUrl(debouncedPreviewParams, previewRevision),
    [debouncedPreviewParams, previewRevision],
  );
  const persistenceUnavailable = !writesEnabled;

  const appendVerboseLog = useCallback(
    (message: string, level: VerboseLogLevel = "info") => {
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
    },
    [],
  );

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

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedPreviewParams(previewParams);
    }, PREVIEW_UPDATE_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [previewParams]);

  const fetchGraphNodes = useCallback(
    async ({
      silent = false,
      syncPreviewParams = false,
    }: FetchGraphNodesOptions = {}) => {
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
        setGraphSource(body.source);
        setWritesEnabled(body.writesEnabled);
        setSavedEdgeGeneration(body.defaultEdgeGeneration);

        if (syncPreviewParams) {
          setPreviewParams(body.defaultEdgeGeneration.params);
          setDebouncedPreviewParams(body.defaultEdgeGeneration.params);
        }

        setPreviewRevision((current) => current + 1);
        appendVerboseLog(
          `Admin panel refreshed (${body.nodes.length} node(s), ${countAdminGraphEdges(body.nodes)} persisted edge(s), source: ${body.source}).`,
          "success",
        );
        if (!body.writesEnabled) {
          appendVerboseLog(
            "Supabase photo graph persistence is unavailable. Admin preview stays live, but save, upload, and delete actions are disabled.",
            "warn",
          );
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to load graph nodes.";
        appendVerboseLog(`Admin panel refresh failed: ${message}`, "error");
      } finally {
        setLoadingGraphNodes(false);
      }
    },
    [appendVerboseLog, setStatusWithLog],
  );

  useEffect(() => {
    void fetchGraphNodes({
      silent: true,
      syncPreviewParams: true,
    });
  }, [fetchGraphNodes]);

  const addFiles = useCallback((incomingFiles: FileList | File[]) => {
    const list = Array.from(incomingFiles);

    setFiles((current) => {
      const map = new Map(
        current.map((file) => [
          `${file.name}:${file.size}:${file.lastModified}`,
          file,
        ]),
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

  const handleEdgeParamChange = useCallback(
    (key: keyof LabEdgeGenerationParams, value: number) => {
      setPreviewParams((current) => {
        const nextValue =
          key === "sigmaE"
            ? clamp(
                value,
                LAB_EDGE_PARAM_LIMITS.sigmaE.min,
                LAB_EDGE_PARAM_LIMITS.sigmaE.max,
              )
            : clamp(
                value,
                LAB_EDGE_PARAM_LIMITS.minCorrelation.min,
                LAB_EDGE_PARAM_LIMITS.minCorrelation.max,
              );

        if (current[key] === nextValue) {
          return current;
        }

        return {
          ...current,
          [key]: nextValue,
        };
      });
    },
    [],
  );

  const handleResetPreview = useCallback(() => {
    setPreviewParams(savedEdgeGeneration.params);
    setDebouncedPreviewParams(savedEdgeGeneration.params);
    setStatusWithLog("Preview reset to the saved LAB defaults.", "info");
  }, [savedEdgeGeneration.params, setStatusWithLog]);

  const handleSaveEdgeDefaults = useCallback(async () => {
    if (
      persistenceUnavailable ||
      isSavingEdgeDefaults ||
      previewMatchesSavedDefaults
    ) {
      return;
    }

    setIsSavingEdgeDefaults(true);
    setErrorMessage(null);
    setStatusWithLog("Saving LAB edge defaults on the server...");

    try {
      const response = await fetch("/api/admin/photo-graph/edge-defaults", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          config: {
            mode: "lab",
            params: previewParams,
          },
        }),
      });

      const body = await parseJsonOrThrow<SaveEdgeDefaultsResponse>(response);
      if (!response.ok || !body.ok) {
        throw new Error(body.error ?? "Failed to save edge defaults.");
      }

      setSavedEdgeGeneration(body.config);
      setPreviewParams(body.config.params);
      setDebouncedPreviewParams(body.config.params);
      await fetchGraphNodes({
        silent: true,
        syncPreviewParams: false,
      });

      setStatusWithLog(
        `Saved LAB defaults (${body.edgeCount} persisted edges, sigmaE ${formatSigmaE(body.config.params.sigmaE)}, min correlation ${formatMinCorrelation(body.config.params.minCorrelation)}).`,
        "success",
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Saving LAB defaults failed unexpectedly.";
      setErrorMessage(message);
      appendVerboseLog(`Saving LAB defaults failed: ${message}`, "error");
    } finally {
      setIsSavingEdgeDefaults(false);
    }
  }, [
    appendVerboseLog,
    fetchGraphNodes,
    isSavingEdgeDefaults,
    persistenceUnavailable,
    previewMatchesSavedDefaults,
    previewParams,
    setStatusWithLog,
  ]);

  const handleDeleteNode = useCallback(
    async (node: AdminGraphNode) => {
      if (persistenceUnavailable) {
        return;
      }

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
        await fetchGraphNodes({
          silent: true,
        });
        setStatusWithLog(`Node ${body.deletedId} deleted.`, "success");
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Delete failed unexpectedly.";
        setErrorMessage(message);
        appendVerboseLog(
          `Delete failed for node ${node.id}: ${message}`,
          "error",
        );
      } finally {
        setDeletingNodeId(null);
      }
    },
    [appendVerboseLog, fetchGraphNodes, persistenceUnavailable, setStatusWithLog],
  );

  const handleUpload = async () => {
    if (!files.length || isProcessing || persistenceUnavailable) {
      return;
    }

    const supabase = getBrowserSupabaseClient();
    setIsProcessing(true);
    setErrorMessage(null);
    setStatusWithLog("Starting upload pipeline...", "info");

    try {
      appendVerboseLog(
        `Validated ${files.length} file(s) for upload.`,
        "success",
      );

      const registrations: UploadRegistration[] = [];

      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];

        setStatusWithLog(
          `Extracting image features (${index + 1}/${files.length}): ${file.name}`,
        );
        const featurePayload = await computeFeaturePayload(file);
        appendVerboseLog(
          `Feature extraction complete: ${file.name}.`,
          "success",
        );

        setStatusWithLog(
          `Requesting upload URL (${index + 1}/${files.length}): ${file.name}`,
        );
        const uploadUrlResponse = await fetch(
          "/api/admin/photo-graph/upload-url",
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
            },
            body: JSON.stringify({
              filename: file.name,
              contentType: file.type,
            }),
          },
        );

        const uploadUrlBody =
          await parseJsonOrThrow<UploadUrlResponse>(uploadUrlResponse);

        if (!uploadUrlResponse.ok || !uploadUrlBody.ok) {
          throw new Error(uploadUrlBody.error ?? "Failed to get upload URL.");
        }

        setStatusWithLog(
          `Uploading directly to Supabase (${index + 1}/${files.length}): ${file.name}`,
        );

        const { error: uploadError } = await supabase.storage
          .from(uploadUrlBody.bucket)
          .uploadToSignedUrl(
            uploadUrlBody.objectPath,
            uploadUrlBody.token,
            file,
            {
              cacheControl: PHOTO_GRAPH_CACHE_CONTROL_SECONDS,
              contentType: file.type,
            },
          );

        if (uploadError) {
          throw new Error(
            uploadError.message || `Direct upload failed for ${file.name}.`,
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

      setStatusWithLog("Registering uploaded files and regenerating edges...");

      const registerResponse = await fetch("/api/admin/photo-graph/upload", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          uploads: registrations,
        }),
      });

      const registerBody =
        await parseJsonOrThrow<UploadApiResponse>(registerResponse);

      if (!registerResponse.ok || !registerBody.ok) {
        throw new Error(registerBody.error ?? "Upload registration failed.");
      }

      setCreatedIds(registerBody.createdIds);
      setFiles([]);

      appendVerboseLog(
        `Registered ${registerBody.createdIds.length} new node(s): ${registerBody.createdIds.join(", ")}.`,
        "success",
      );
      appendVerboseLog(
        `Server regenerated ${registerBody.edgeCount} persisted edge(s) using sigmaE ${formatSigmaE(registerBody.edgeGenerationConfig.params.sigmaE)} and min correlation ${formatMinCorrelation(registerBody.edgeGenerationConfig.params.minCorrelation)}.`,
        "success",
      );

      await fetchGraphNodes({
        silent: true,
      });

      setStatusWithLog(
        `Done. Added ${registerBody.createdIds.length} image(s) and regenerated ${registerBody.edgeCount} default edges on the server.`,
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

  const uploadDisabled =
    !files.length ||
    isProcessing ||
    isSavingEdgeDefaults ||
    persistenceUnavailable;
  const adminBusy =
    isProcessing ||
    isSavingEdgeDefaults ||
    loadingGraphNodes ||
    deletingNodeId !== null;

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-10">
      <div className="mb-6 flex flex-col gap-4 border-b border-black/10 pb-6 sm:flex-row sm:items-end sm:justify-between dark:border-white/10">
        <div className="max-w-3xl">
          <p className="text-[11px] font-medium tracking-[0.28em] uppercase opacity-55">
            Server-Side LAB Edge Studio
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Photo Graph Upload Admin
          </h1>
          <p className="mt-2 text-sm leading-6 opacity-70">
            Uploads still extract image features in the browser, but edge
            generation, live preview, and saved defaults now run on the server.
            The public project graph continues to read the persisted edge
            snapshot.
          </p>
        </div>

        <OverlayControlButton onClick={handleLogout} layout="action">
          Log Out
        </OverlayControlButton>
      </div>

      <section className="overflow-hidden rounded-[1.5rem] border border-black/10 bg-[linear-gradient(180deg,rgba(238,237,232,0.8),rgba(255,255,255,0.96))] p-4 shadow-[0_24px_80px_-48px_rgba(27,31,35,0.45)] sm:p-5 dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(26,26,24,0.9),rgba(13,13,12,0.98))]">
        <div className="grid gap-5 xl:grid-cols-[minmax(18rem,24rem)_minmax(0,1fr)]">
          <div className="flex flex-col gap-4">
            <div className="rounded-[1.25rem] border border-black/10 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
              <div className="flex items-center justify-between gap-3 text-[11px] tracking-[0.22em] uppercase opacity-60">
                <span>Saved Defaults</span>
                <span>{graphSource}</span>
              </div>
              <p className="mt-3 text-sm leading-6 opacity-75">
                Preview uses pure LAB distance only. Adjust the falloff and the
                minimum accepted similarity, then save if you want the public
                graph snapshot to adopt the result.
              </p>
              {persistenceUnavailable && (
                <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-700 dark:text-amber-300">
                  Supabase photo graph persistence is currently unavailable.
                  Preview still works, but saving defaults, uploading, and
                  deleting are disabled until the database connection is
                  restored.
                </p>
              )}

              <div className="mt-5 space-y-4">
                <div className="space-y-2">
                  <div className="flex items-end justify-between gap-3">
                    <label
                      htmlFor="photo-graph-sigma-e"
                      className="text-sm font-medium"
                    >
                      Sigma E
                    </label>
                    <output
                      htmlFor="photo-graph-sigma-e"
                      className="text-sm opacity-70"
                    >
                      {formatSigmaE(previewParams.sigmaE)}
                    </output>
                  </div>
                  <input
                    id="photo-graph-sigma-e"
                    type="range"
                    min={LAB_EDGE_PARAM_LIMITS.sigmaE.min}
                    max={LAB_EDGE_PARAM_LIMITS.sigmaE.max}
                    step={0.5}
                    value={previewParams.sigmaE}
                    onChange={(event) =>
                      handleEdgeParamChange("sigmaE", Number(event.target.value))
                    }
                    className="range-sm h-2 w-full rounded-full border-none bg-black/10 accent-black dark:bg-white/20 dark:accent-white"
                  />
                  <p className="text-xs leading-5 opacity-60">
                    Higher values widen the LAB similarity falloff and create
                    denser edge neighborhoods.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-end justify-between gap-3">
                    <label
                      htmlFor="photo-graph-min-correlation"
                      className="text-sm font-medium"
                    >
                      Minimum correlation
                    </label>
                    <output
                      htmlFor="photo-graph-min-correlation"
                      className="text-sm opacity-70"
                    >
                      {formatMinCorrelation(previewParams.minCorrelation)}
                    </output>
                  </div>
                  <input
                    id="photo-graph-min-correlation"
                    type="range"
                    min={LAB_EDGE_PARAM_LIMITS.minCorrelation.min}
                    max={LAB_EDGE_PARAM_LIMITS.minCorrelation.max}
                    step={0.01}
                    value={previewParams.minCorrelation}
                    onChange={(event) =>
                      handleEdgeParamChange(
                        "minCorrelation",
                        Number(event.target.value),
                      )
                    }
                    className="range-sm h-2 w-full rounded-full border-none bg-black/10 accent-black dark:bg-white/20 dark:accent-white"
                  />
                  <p className="text-xs leading-5 opacity-60">
                    Higher thresholds prune weak matches sooner and preserve a
                    tighter persisted graph.
                  </p>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <OverlayControlButton
                  onClick={() => void handleSaveEdgeDefaults()}
                  disabled={
                    adminBusy ||
                    previewMatchesSavedDefaults ||
                    persistenceUnavailable
                  }
                  layout="action"
                  size="sm"
                >
                  {isSavingEdgeDefaults ? "Saving..." : "Save as Default"}
                </OverlayControlButton>
                <OverlayControlButton
                  onClick={handleResetPreview}
                  disabled={adminBusy || previewMatchesSavedDefaults}
                  layout="action"
                  size="sm"
                >
                  Reset to Saved Defaults
                </OverlayControlButton>
                <OverlayControlButton
                  onClick={() =>
                    void fetchGraphNodes({
                      syncPreviewParams: false,
                    })
                  }
                  disabled={adminBusy}
                  layout="action"
                  size="sm"
                >
                  {loadingGraphNodes ? "Refreshing..." : "Refresh Graph"}
                </OverlayControlButton>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <div className="rounded-[1rem] border border-black/10 bg-white/60 p-3 dark:border-white/10 dark:bg-white/5">
                <p className="text-[11px] tracking-[0.18em] uppercase opacity-55">
                  Stored Graph
                </p>
                <p className="mt-2 text-2xl font-semibold">
                  {persistedEdgeCount}
                </p>
                <p className="mt-1 text-xs opacity-65">
                  persisted edge(s) across {graphNodes.length} node(s)
                </p>
              </div>

              <div className="rounded-[1rem] border border-black/10 bg-white/60 p-3 dark:border-white/10 dark:bg-white/5">
                <p className="text-[11px] tracking-[0.18em] uppercase opacity-55">
                  Saved LAB Defaults
                </p>
                <p className="mt-2 text-sm font-medium">
                  sigmaE {formatSigmaE(savedEdgeGeneration.params.sigmaE)}
                </p>
                <p className="mt-1 text-xs opacity-65">
                  min correlation{" "}
                  {formatMinCorrelation(
                    savedEdgeGeneration.params.minCorrelation,
                  )}
                </p>
              </div>

              <div className="rounded-[1rem] border border-black/10 bg-white/60 p-3 dark:border-white/10 dark:bg-white/5">
                <p className="text-[11px] tracking-[0.18em] uppercase opacity-55">
                  Preview Status
                </p>
                <p className="mt-2 text-sm font-medium">
                  {previewIsUpdating
                    ? "Updating preview..."
                    : previewMatchesSavedDefaults
                      ? "Matches saved defaults"
                      : "Unsaved preview"}
                </p>
                <p className="mt-1 text-xs opacity-65">
                  Preview refresh is debounced by {PREVIEW_UPDATE_DEBOUNCE_MS}{" "}
                  ms.
                </p>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-[1.5rem] border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/10 px-4 py-3 text-xs dark:border-white/10">
              <div>
                <p className="font-medium">Server Preview Graph</p>
                <p className="mt-1 opacity-65">
                  Generated from LAB parameters without touching the persisted
                  public snapshot until you save.
                </p>
              </div>
              <div className="rounded-full border border-black/10 px-3 py-1 text-[11px] tracking-[0.18em] uppercase opacity-70 dark:border-white/10">
                {previewIsUpdating
                  ? "Updating"
                  : previewMatchesSavedDefaults
                    ? "Saved Default View"
                    : "Preview Only"}
              </div>
            </div>

            <div className="h-[min(42rem,70vh)] min-h-[22rem]">
              <PhotoGraphCanvas
                graphUrl={previewGraphUrl}
                fitToCanvas
                showNavigation={false}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-md border border-black/20 p-4 dark:border-white/20">
        <div
          onDrop={handleDrop}
          onDragOver={(event) => event.preventDefault()}
          className="rounded-lg border border-dashed border-black/30 p-6 text-center dark:border-white/30"
        >
          <p className="text-sm">Drag and drop images here</p>
          <p className="my-2 text-xs opacity-70">or</p>
          <OverlayControlLabel layout="action">
            Select Files
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              onChange={handleInputChange}
              className="hidden"
            />
          </OverlayControlLabel>
        </div>

        <div className="mt-4 flex items-center justify-between text-sm">
          <p>{files.length} file(s) selected</p>
          <p>{bytesToMb(totalBytes)}</p>
        </div>

        {files.length > 0 && (
          <ul className="mt-3 max-h-56 overflow-y-auto rounded-md border border-black/20 p-3 text-sm dark:border-white/20">
            {files.map((file) => (
              <li
                key={`${file.name}-${file.size}-${file.lastModified}`}
                className="py-1"
              >
                {file.name} ({bytesToMb(file.size)})
              </li>
            ))}
          </ul>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <OverlayControlButton
            onClick={handleUpload}
            disabled={uploadDisabled}
            layout="action"
            size="lg"
            className="font-medium"
          >
            {isProcessing ? "Processing..." : "Upload + Regenerate Defaults"}
          </OverlayControlButton>

          {files.length > 0 && (
            <OverlayControlButton
              onClick={() => setFiles([])}
              disabled={isProcessing}
              layout="action"
            >
              Clear
            </OverlayControlButton>
          )}

          <OverlayControlButton
            onClick={() => setVerbosePanelOpen((current) => !current)}
            layout="action"
          >
            {verbosePanelOpen ? "Hide Verbose Panel" : "Show Verbose Panel"}
          </OverlayControlButton>

          <OverlayControlButton onClick={clearVerboseLogs} layout="action">
            Clear Logs
          </OverlayControlButton>
        </div>

        {statusMessage && (
          <p className="mt-4 text-sm text-blue-700 dark:text-blue-300">
            {statusMessage}
          </p>
        )}
        {errorMessage && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-300">
            {errorMessage}
          </p>
        )}

        {createdIds.length > 0 && (
          <p className="mt-2 text-xs opacity-70">
            Created node IDs: {createdIds.join(", ")}
          </p>
        )}
      </section>

      <section className="mt-6 rounded-md border border-black/20 p-4 dark:border-white/20">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">Manage Photos</h2>
          <div className="flex items-center gap-2 text-xs">
            <span className="opacity-70">
              {graphNodes.length} total node(s)
            </span>
            <OverlayControlButton
              onClick={() =>
                void fetchGraphNodes({
                  syncPreviewParams: false,
                })
              }
              disabled={adminBusy}
              layout="action"
              size="sm"
            >
              {loadingGraphNodes ? "Refreshing..." : "Refresh"}
            </OverlayControlButton>
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
                          // eslint-disable-next-line @next/next/no-img-element -- This preview intentionally uses the Supabase render URL directly to bypass Vercel image transforms.
                          <img
                            src={node.previewUrl}
                            alt={`Node ${node.id}`}
                            width={44}
                            height={44}
                            className="h-11 w-11 rounded object-cover"
                          />
                        ) : (
                          <div className="h-11 w-11 rounded border border-black/20 dark:border-white/20" />
                        )}

                        <div className="min-w-0 font-mono text-[11px]">
                          <div>
                            <span className="font-semibold">ID {node.id}</span>{" "}
                            <span className="opacity-70">
                              ({Object.keys(node.correlations ?? {}).length}{" "}
                              edges)
                            </span>
                          </div>
                          {node.storagePath && (
                            <p className="mt-1 font-mono text-[10px] break-all opacity-70">
                              {node.storagePath}
                            </p>
                          )}
                        </div>
                      </div>
                      <OverlayControlButton
                        onClick={() => void handleDeleteNode(node)}
                        disabled={
                          persistenceUnavailable ||
                          isProcessing ||
                          isSavingEdgeDefaults ||
                          loadingGraphNodes ||
                          (deletingNodeId !== null && !isDeleting)
                        }
                        layout="action"
                        size="sm"
                        toneClass={OVERLAY_CONTROL_DANGER_CLASS}
                      >
                        {isDeleting ? "Deleting..." : "Delete"}
                      </OverlayControlButton>
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
                    <span className="opacity-70">
                      [{formatLogTimestamp(entry.createdAt)}]
                    </span>{" "}
                    <span
                      className={
                        entry.level === "error"
                          ? "text-red-600 dark:text-red-300"
                          : entry.level === "warn"
                            ? "text-amber-600 dark:text-amber-300"
                            : entry.level === "success"
                              ? "text-green-600 dark:text-green-300"
                              : "text-blue-600 dark:text-blue-300"
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
