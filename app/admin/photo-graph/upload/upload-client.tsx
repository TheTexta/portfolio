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
  GRAPH_COLLISION_SLIDERS,
  GRAPH_CONTROL_SLIDERS,
} from "@/app/components/projects/photo-graph/config";
import {
  ControlButton,
  ControlLabel,
} from "@/app/components/ui/control";
import { SiteHeader } from "@/app/components/ui/editorial";
import ThemeToggle from "@/app/components/ui/theme-toggle";
import { extractPhotoGraphColorFeatureV1 } from "@/lib/photo-graph/color-features";
import {
  DEFAULT_PHOTO_GRAPH_RUNTIME_CONTROLS,
  PHOTO_GRAPH_RUNTIME_CONTROL_LIMITS,
} from "@/lib/photo-graph/graph-controls";
import { PHOTO_GRAPH_CACHE_CONTROL_SECONDS } from "@/lib/photo-graph/config";
import { featureFromRgb, rgbToHex } from "@/lib/photo-graph/feature-extraction";
import {
  DEFAULT_SPARSE_EDGE_GENERATION_CONFIG,
  SPARSE_EDGE_GENERATION_LIMITS,
} from "@/lib/photo-graph/sparse-edge-generation";
import { PHOTO_GRAPH_SIMILARITY_MODELS } from "@/lib/photo-graph/similarity-models";
import type {
  GraphFeature,
  GraphImageDimensions,
  PhotoGraphEdgeGenerationConfig,
  PhotoGraphRuntimeControls,
  PhotoGraphSimilarityModelId,
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
  defaultGraphControls: PhotoGraphRuntimeControls;
  error?: string;
};

type SaveEdgeDefaultsResponse = {
  ok: boolean;
  source: "database" | "static";
  edgeCount: number;
  config: PhotoGraphEdgeGenerationConfig;
  error?: string;
};

type SaveGraphDefaultsResponse = {
  ok: boolean;
  controls: PhotoGraphRuntimeControls;
  error?: string;
};

type DeletePhotoResponse = {
  ok: boolean;
  deletedId: string;
  nodeCount: number;
  error?: string;
};

type ComputedFeaturePayload = GraphFeature & {
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
  syncGraphControls?: boolean;
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

function formatModelDistance(value: number) {
  return value >= 2 ? value.toFixed(1) : value.toFixed(3);
}

function compareNodeIds(leftId: string, rightId: string) {
  const leftNumber = Number(leftId);
  const rightNumber = Number(rightId);

  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
    return leftNumber - rightNumber;
  }

  return leftId.localeCompare(rightId);
}

function areEdgeConfigsEqual(
  left: PhotoGraphEdgeGenerationConfig,
  right: PhotoGraphEdgeGenerationConfig,
) {
  return (
    left.model === right.model &&
    left.neighborsPerNode === right.neighborsPerNode &&
    Math.abs(left.maxDistance - right.maxDistance) < 1e-9
  );
}

function areGraphControlsEqual(
  left: PhotoGraphRuntimeControls,
  right: PhotoGraphRuntimeControls,
) {
  return (
    left.hideConnections === right.hideConnections &&
    Math.abs(left.chargeMult - right.chargeMult) < 1e-9 &&
    Math.abs(left.collideBoxScale - right.collideBoxScale) < 1e-9 &&
    Math.abs(left.collideIterations - right.collideIterations) < 1e-9 &&
    Math.abs(left.collidePad - right.collidePad) < 1e-9 &&
    Math.abs(left.collideStrength - right.collideStrength) < 1e-9 &&
    Math.abs(left.distMinMult - right.distMinMult) < 1e-9 &&
    Math.abs(left.distMaxMult - right.distMaxMult) < 1e-9
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function countAdminGraphEdges(nodes: AdminGraphNode[]) {
  let count = 0;

  for (const node of nodes) {
    for (const [targetId, correlation] of Object.entries(
      node.correlations ?? {},
    )) {
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

  const imageData = context.getImageData(0, 0, targetWidth, targetHeight);
  const { data } = imageData;

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
  feature.colorV1 = extractPhotoGraphColorFeatureV1(imageData);

  return {
    rgb: feature.rgb,
    lab: feature.lab,
    hue: feature.hue,
    longSide: feature.longSide,
    colorV1: feature.colorV1,
    dimensions: {
      width: normalizedWidth,
      height: normalizedHeight,
      aspectRatio: normalizedWidth / normalizedHeight,
    },
    colour: rgbToHex(feature.rgb),
  };
}

function buildPreviewGraphUrl(
  config: PhotoGraphEdgeGenerationConfig,
  revision: number,
) {
  const searchParams = new URLSearchParams({
    model: config.model,
    neighborsPerNode: config.neighborsPerNode.toString(),
    maxDistance: config.maxDistance.toString(),
    revision: revision.toString(),
  });

  return `/api/admin/photo-graph/graph-preview?${searchParams.toString()}`;
}

export default function PhotoGraphUploadClient() {
  const router = useRouter();

  const [files, setFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSavingEdgeDefaults, setIsSavingEdgeDefaults] = useState(false);
  const [isSavingGraphDefaults, setIsSavingGraphDefaults] = useState(false);
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
      DEFAULT_SPARSE_EDGE_GENERATION_CONFIG,
    );
  const [savedGraphControls, setSavedGraphControls] =
    useState<PhotoGraphRuntimeControls>(DEFAULT_PHOTO_GRAPH_RUNTIME_CONTROLS);
  const [previewConfig, setPreviewConfig] =
    useState<PhotoGraphEdgeGenerationConfig>(
      DEFAULT_SPARSE_EDGE_GENERATION_CONFIG,
    );
  const [debouncedPreviewConfig, setDebouncedPreviewConfig] =
    useState<PhotoGraphEdgeGenerationConfig>(
      DEFAULT_SPARSE_EDGE_GENERATION_CONFIG,
    );
  const [previewGraphControls, setPreviewGraphControls] =
    useState<PhotoGraphRuntimeControls>(DEFAULT_PHOTO_GRAPH_RUNTIME_CONTROLS);
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
    () => areEdgeConfigsEqual(previewConfig, savedEdgeGeneration),
    [previewConfig, savedEdgeGeneration],
  );
  const graphControlsMatchSavedDefaults = useMemo(
    () => areGraphControlsEqual(previewGraphControls, savedGraphControls),
    [previewGraphControls, savedGraphControls],
  );

  const previewIsUpdating = useMemo(
    () => !areEdgeConfigsEqual(previewConfig, debouncedPreviewConfig),
    [debouncedPreviewConfig, previewConfig],
  );

  const previewGraphUrl = useMemo(
    () => buildPreviewGraphUrl(debouncedPreviewConfig, previewRevision),
    [debouncedPreviewConfig, previewRevision],
  );
  const persistenceUnavailable = !writesEnabled;
  const previewStatusLabel = useMemo(() => {
    if (previewIsUpdating) {
      return "Updating model preview...";
    }

    if (!previewMatchesSavedDefaults && !graphControlsMatchSavedDefaults) {
      return "Unsaved model + graph defaults";
    }

    if (!previewMatchesSavedDefaults) {
      return "Unsaved model defaults";
    }

    if (!graphControlsMatchSavedDefaults) {
      return "Unsaved graph defaults";
    }

    return "Matches saved defaults";
  }, [
    graphControlsMatchSavedDefaults,
    previewIsUpdating,
    previewMatchesSavedDefaults,
  ]);

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
      setDebouncedPreviewConfig(previewConfig);
    }, PREVIEW_UPDATE_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [previewConfig]);

  const fetchGraphNodes = useCallback(
    async ({
      silent = false,
      syncGraphControls = false,
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
        setSavedGraphControls(body.defaultGraphControls);

        if (syncPreviewParams) {
          setPreviewConfig(body.defaultEdgeGeneration);
          setDebouncedPreviewConfig(body.defaultEdgeGeneration);
        }
        if (syncGraphControls) {
          setPreviewGraphControls(body.defaultGraphControls);
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
      syncGraphControls: true,
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

  const handleModelChange = useCallback((model: PhotoGraphSimilarityModelId) => {
    const definition = PHOTO_GRAPH_SIMILARITY_MODELS.find(
      (entry) => entry.id === model,
    );
    setPreviewConfig((current) => ({
      ...current,
      model,
      maxDistance: definition?.defaultMaxDistance ?? current.maxDistance,
    }));
  }, []);

  const handleNeighborsChange = useCallback((value: number) => {
    setPreviewConfig((current) => ({
      ...current,
      neighborsPerNode: Math.round(clamp(value, 1, 12)),
    }));
  }, []);

  const handleMaxDistanceChange = useCallback((value: number) => {
    setPreviewConfig((current) => {
      const definition = PHOTO_GRAPH_SIMILARITY_MODELS.find(
        (entry) => entry.id === current.model,
      );
      return {
        ...current,
        maxDistance: clamp(
          value,
          SPARSE_EDGE_GENERATION_LIMITS.maxDistance.min,
          definition?.maxDistanceLimit ?? 1,
        ),
      };
    });
  }, []);

  const handleGraphControlChange = useCallback(
    (key: keyof PhotoGraphRuntimeControls, value: boolean | number) => {
      setPreviewGraphControls((current) => {
        const nextValue =
          key === "hideConnections"
            ? Boolean(value)
            : (() => {
                const limits = PHOTO_GRAPH_RUNTIME_CONTROL_LIMITS[key];
                const normalizedValue = clamp(
                  Number(value),
                  limits.min,
                  limits.max,
                );

                return limits.integer
                  ? Math.round(normalizedValue)
                  : normalizedValue;
              })();

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
    setPreviewConfig(savedEdgeGeneration);
    setDebouncedPreviewConfig(savedEdgeGeneration);
    setStatusWithLog("Preview reset to the saved model defaults.", "info");
  }, [savedEdgeGeneration, setStatusWithLog]);

  const handleResetGraphControls = useCallback(() => {
    setPreviewGraphControls(savedGraphControls);
    setStatusWithLog("Graph controls reset to the saved defaults.", "info");
  }, [savedGraphControls, setStatusWithLog]);

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
    setStatusWithLog("Saving similarity model defaults on the server...");

    try {
      const response = await fetch("/api/admin/photo-graph/edge-defaults", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ config: previewConfig }),
      });

      const body = await parseJsonOrThrow<SaveEdgeDefaultsResponse>(response);
      if (!response.ok || !body.ok) {
        throw new Error(body.error ?? "Failed to save edge defaults.");
      }

      setSavedEdgeGeneration(body.config);
      setPreviewConfig(body.config);
      setDebouncedPreviewConfig(body.config);
      await fetchGraphNodes({
        silent: true,
        syncPreviewParams: false,
      });

      setStatusWithLog(
        `Saved ${body.config.model} defaults (${body.edgeCount} persisted edges, ${body.config.neighborsPerNode} neighbors, max distance ${formatModelDistance(body.config.maxDistance)}).`,
        "success",
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Saving model defaults failed unexpectedly.";
      setErrorMessage(message);
      appendVerboseLog(`Saving model defaults failed: ${message}`, "error");
    } finally {
      setIsSavingEdgeDefaults(false);
    }
  }, [
    appendVerboseLog,
    fetchGraphNodes,
    isSavingEdgeDefaults,
    persistenceUnavailable,
    previewMatchesSavedDefaults,
    previewConfig,
    setStatusWithLog,
  ]);

  const handleSaveGraphDefaults = useCallback(async () => {
    if (
      persistenceUnavailable ||
      isSavingGraphDefaults ||
      graphControlsMatchSavedDefaults
    ) {
      return;
    }

    setIsSavingGraphDefaults(true);
    setErrorMessage(null);
    setStatusWithLog("Saving graph runtime defaults on the server...");

    try {
      const response = await fetch("/api/admin/photo-graph/graph-defaults", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          controls: previewGraphControls,
        }),
      });

      const body = await parseJsonOrThrow<SaveGraphDefaultsResponse>(response);
      if (!response.ok || !body.ok) {
        throw new Error(body.error ?? "Failed to save graph defaults.");
      }

      setSavedGraphControls(body.controls);
      setPreviewGraphControls(body.controls);
      setStatusWithLog(
        `Saved graph defaults (lines ${body.controls.hideConnections ? "hidden" : "shown"}, repel ${body.controls.chargeMult.toFixed(1)}x, collision ${body.controls.collideStrength.toFixed(1)}x).`,
        "success",
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Saving graph defaults failed unexpectedly.";
      setErrorMessage(message);
      appendVerboseLog(`Saving graph defaults failed: ${message}`, "error");
    } finally {
      setIsSavingGraphDefaults(false);
    }
  }, [
    appendVerboseLog,
    graphControlsMatchSavedDefaults,
    isSavingGraphDefaults,
    persistenceUnavailable,
    previewGraphControls,
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
    [
      appendVerboseLog,
      fetchGraphNodes,
      persistenceUnavailable,
      setStatusWithLog,
    ],
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
            colorV1: featurePayload.colorV1,
          },
          dimensions: featurePayload.dimensions,
        });

        appendVerboseLog(
          `Direct upload complete: ${file.name} -> ${uploadUrlBody.objectPath}.`,
          "success",
        );
      }

      setStatusWithLog("Registering uploaded files and updating sparse neighborhoods...");

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
        `Server generated ${registerBody.edgeCount} persisted edge(s) using ${registerBody.edgeGenerationConfig.model}, ${registerBody.edgeGenerationConfig.neighborsPerNode} neighbors, and max distance ${formatModelDistance(registerBody.edgeGenerationConfig.maxDistance)}.`,
        "success",
      );

      await fetchGraphNodes({
        silent: true,
      });

      setStatusWithLog(
        `Done. Added ${registerBody.createdIds.length} image(s) and updated the ${registerBody.edgeCount}-edge public snapshot.`,
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
    isSavingGraphDefaults ||
    isSavingEdgeDefaults ||
    persistenceUnavailable;
  const adminBusy =
    isProcessing ||
    isSavingGraphDefaults ||
    isSavingEdgeDefaults ||
    loadingGraphNodes ||
    deletingNodeId !== null;

  return (
    <main className="editorial-page min-h-dvh">
      <SiteHeader>
        <ThemeToggle />
        <ControlButton
          onClick={handleLogout}
          layout="action"
          size="sm"
          className="min-h-9"
        >
          Log Out
        </ControlButton>
      </SiteHeader>
      <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-8">
        <div className="border-rule mb-6 flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-3xl">
            <p className="text-[11px] font-medium tracking-[0.28em] uppercase opacity-55">
              Colour Similarity Studio
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              Photo Graph Upload Admin
            </h1>
            <p className="mt-2 text-sm leading-6 opacity-70">
              Uploads still extract image features in the browser, but edge
              generation, live preview, and saved defaults now run on the
              server. The public project graph continues to read the persisted
              edge snapshot.
            </p>
          </div>
        </div>

        <section className="border-rule bg-surface overflow-hidden border p-4 sm:p-5">
          <div className="grid gap-5 xl:grid-cols-[minmax(18rem,24rem)_minmax(0,1fr)]">
            <div className="flex flex-col gap-4">
              <div className="border-rule bg-canvas border p-4">
                <div className="flex items-center justify-between gap-3 text-[11px] tracking-[0.22em] uppercase opacity-60">
                  <span>Similarity Model</span>
                  <span>{graphSource}</span>
                </div>
                <p className="mt-3 text-sm leading-6 opacity-75">
                  Compare versioned color models using direct graph semantics,
                  then save the selected model and sparse neighborhood policy.
                </p>
                {persistenceUnavailable && (
                  <p className="border-warning bg-canvas text-warning mt-3 border px-3 py-2 text-xs leading-5">
                    Supabase photo graph persistence is currently unavailable.
                    Preview still works, but saving defaults, uploading, and
                    deleting are disabled until the database connection is
                    restored.
                  </p>
                )}

                <div className="mt-5 space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="photo-graph-model" className="text-sm font-medium">
                      Color model
                    </label>
                    <select
                      id="photo-graph-model"
                      value={previewConfig.model}
                      onChange={(event) =>
                        handleModelChange(
                          event.target.value as PhotoGraphSimilarityModelId,
                        )
                      }
                      className="border-rule bg-surface min-h-11 w-full border px-3 text-sm"
                    >
                      {PHOTO_GRAPH_SIMILARITY_MODELS.map((model) => (
                        <option key={model.id} value={model.id}>
                          {model.label}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs leading-5 opacity-60">
                      Mean models are baselines; distribution and palette models
                      use the versioned Oklab feature.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-end justify-between gap-3">
                      <label
                        htmlFor="photo-graph-neighbors"
                        className="text-sm font-medium"
                      >
                        Neighbors per photo
                      </label>
                      <output
                        htmlFor="photo-graph-neighbors"
                        className="text-sm opacity-70"
                      >
                        {previewConfig.neighborsPerNode}
                      </output>
                    </div>
                    <input
                      id="photo-graph-neighbors"
                      type="range"
                      min={1}
                      max={12}
                      step={1}
                      value={Math.min(12, previewConfig.neighborsPerNode)}
                      onChange={(event) =>
                        handleNeighborsChange(Number(event.target.value))
                      }
                      className="range-sm bg-surface accent-ink h-2 w-full border-none"
                    />
                    <p className="text-xs leading-5 opacity-60">
                      Caps each directed neighborhood before links are merged.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-end justify-between gap-3">
                      <label htmlFor="photo-graph-max-distance" className="text-sm font-medium">
                        Maximum color distance
                      </label>
                      <output htmlFor="photo-graph-max-distance" className="text-sm opacity-70">
                        {formatModelDistance(previewConfig.maxDistance)}
                      </output>
                    </div>
                    <input
                      id="photo-graph-max-distance"
                      type="range"
                      min={SPARSE_EDGE_GENERATION_LIMITS.maxDistance.min}
                      max={
                        PHOTO_GRAPH_SIMILARITY_MODELS.find(
                          (model) => model.id === previewConfig.model,
                        )?.maxDistanceLimit ?? 1
                      }
                      step={previewConfig.maxDistance >= 2 ? 0.5 : 0.005}
                      value={previewConfig.maxDistance}
                      onChange={(event) =>
                        handleMaxDistanceChange(Number(event.target.value))
                      }
                      className="range-sm bg-surface accent-ink h-2 w-full border-none"
                    />
                    <p className="text-xs leading-5 opacity-60">
                      Rejects visually distant candidates even when fewer than
                      the requested neighbors remain.
                    </p>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  <ControlButton
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
                  </ControlButton>
                  <ControlButton
                    onClick={handleResetPreview}
                    disabled={adminBusy || previewMatchesSavedDefaults}
                    layout="action"
                    size="sm"
                  >
                    Reset to Saved Defaults
                  </ControlButton>
                  <ControlButton
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
                  </ControlButton>
                </div>
              </div>

              <div className="border-rule bg-canvas border p-4">
                <div className="flex items-center justify-between gap-3 text-[11px] tracking-[0.22em] uppercase opacity-60">
                  <span>Graph Defaults</span>
                  <span>Runtime + Collision</span>
                </div>
                <p className="mt-3 text-sm leading-6 opacity-75">
                  These values seed the public graph controls at load time.
                  Visitors can still change the visible controls locally after
                  the graph loads. Collision tuning stays admin-only.
                </p>

                <div className="mt-5 space-y-4">
                  <div className="space-y-4">
                    <div className="text-[11px] font-medium tracking-[0.18em] uppercase opacity-55">
                      Public Runtime Controls
                    </div>

                    <label className="flex min-h-8 items-center justify-between gap-3 text-sm font-medium">
                      <span>Show connecting lines</span>
                      <input
                        type="checkbox"
                        checked={!previewGraphControls.hideConnections}
                        onChange={(event) =>
                          handleGraphControlChange(
                            "hideConnections",
                            !event.target.checked,
                          )
                        }
                        className="accent-ink m-0 h-4 w-4 shrink-0"
                      />
                    </label>

                    {GRAPH_CONTROL_SLIDERS.map(
                      ({ key, label, min, max, scale = 1, formatValue }) => {
                        const inputId = `photo-graph-default-${key}`;
                        const valueText = formatValue(
                          previewGraphControls[key],
                        );

                        return (
                          <div key={key} className="space-y-2">
                            <div className="flex items-end justify-between gap-3">
                              <label
                                htmlFor={inputId}
                                className="text-sm font-medium"
                              >
                                {label}
                              </label>
                              <output
                                htmlFor={inputId}
                                className="text-sm opacity-70"
                              >
                                {valueText}
                              </output>
                            </div>
                            <input
                              id={inputId}
                              type="range"
                              min={min}
                              max={max}
                              value={previewGraphControls[key] / scale}
                              onChange={(event) =>
                                handleGraphControlChange(
                                  key,
                                  Number(event.target.value) * scale,
                                )
                              }
                              className="range-sm bg-surface accent-ink h-2 w-full border-none"
                            />
                          </div>
                        );
                      },
                    )}
                  </div>

                  <div className="border-rule border-t pt-4">
                    <div className="text-[11px] font-medium tracking-[0.18em] uppercase opacity-55">
                      Admin Collision Tuning
                    </div>
                    <p className="mt-2 text-xs leading-5 opacity-60">
                      These values affect the layout solver directly and apply
                      to the public graph when you save them as defaults.
                    </p>
                  </div>

                  {GRAPH_COLLISION_SLIDERS.map(
                    ({ key, label, min, max, scale = 1, formatValue }) => {
                      const inputId = `photo-graph-default-${key}`;
                      const valueText = formatValue(previewGraphControls[key]);

                      return (
                        <div key={key} className="space-y-2">
                          <div className="flex items-end justify-between gap-3">
                            <label
                              htmlFor={inputId}
                              className="text-sm font-medium"
                            >
                              {label}
                            </label>
                            <output
                              htmlFor={inputId}
                              className="text-sm opacity-70"
                            >
                              {valueText}
                            </output>
                          </div>
                          <input
                            id={inputId}
                            type="range"
                            min={min}
                            max={max}
                            value={previewGraphControls[key] / scale}
                            onChange={(event) =>
                              handleGraphControlChange(
                                key,
                                Number(event.target.value) * scale,
                              )
                            }
                            className="range-sm bg-surface accent-ink h-2 w-full border-none"
                          />
                        </div>
                      );
                    },
                  )}
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  <ControlButton
                    onClick={() => void handleSaveGraphDefaults()}
                    disabled={
                      adminBusy ||
                      graphControlsMatchSavedDefaults ||
                      persistenceUnavailable
                    }
                    layout="action"
                    size="sm"
                  >
                    {isSavingGraphDefaults ? "Saving..." : "Save as Default"}
                  </ControlButton>
                  <ControlButton
                    onClick={handleResetGraphControls}
                    disabled={adminBusy || graphControlsMatchSavedDefaults}
                    layout="action"
                    size="sm"
                  >
                    Reset to Saved Defaults
                  </ControlButton>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <div className="border-rule bg-canvas border p-3">
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

                <div className="border-rule bg-canvas border p-3">
                  <p className="text-[11px] tracking-[0.18em] uppercase opacity-55">
                    Saved Model Defaults
                  </p>
                  <p className="mt-2 text-sm font-medium">
                    {savedEdgeGeneration.model}
                  </p>
                  <p className="mt-1 text-xs opacity-65">
                    {savedEdgeGeneration.neighborsPerNode} neighbors, max{" "}
                    {formatModelDistance(savedEdgeGeneration.maxDistance)}
                  </p>
                </div>

                <div className="border-rule bg-canvas border p-3">
                  <p className="text-[11px] tracking-[0.18em] uppercase opacity-55">
                    Saved Graph Defaults
                  </p>
                  <p className="mt-2 text-sm font-medium">
                    {savedGraphControls.hideConnections
                      ? "Lines hidden"
                      : "Lines shown"}
                  </p>
                  <p className="mt-1 text-xs opacity-65">
                    repel {savedGraphControls.chargeMult.toFixed(1)}x, min{" "}
                    {savedGraphControls.distMinMult.toFixed(1)}x, max{" "}
                    {savedGraphControls.distMaxMult.toFixed(1)}x
                  </p>
                  <p className="mt-1 text-xs opacity-65">
                    collision {savedGraphControls.collideStrength.toFixed(1)}x,
                    box {savedGraphControls.collideBoxScale.toFixed(2)}x, pad{" "}
                    {savedGraphControls.collidePad.toFixed(0)} px, passes{" "}
                    {savedGraphControls.collideIterations.toFixed(0)}
                  </p>
                </div>

                <div className="border-rule bg-canvas border p-3">
                  <p className="text-[11px] tracking-[0.18em] uppercase opacity-55">
                    Preview Status
                  </p>
                  <p className="mt-2 text-sm font-medium">
                    {previewStatusLabel}
                  </p>
                  <p className="mt-1 text-xs opacity-65">
                    Model preview refresh is debounced by{" "}
                    {PREVIEW_UPDATE_DEBOUNCE_MS} ms. Graph and collision
                    controls apply live.
                  </p>
                </div>
              </div>
            </div>

            <div className="border-rule bg-surface overflow-hidden border">
              <div className="border-rule flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3 text-xs">
                <div>
                  <p className="font-medium">Server Preview Graph</p>
                  <p className="mt-1 opacity-65">
                    Generated from the selected model without touching the
                    persisted public snapshot until you save.
                  </p>
                </div>
                <div className="border-rule border px-3 py-1 text-[11px] tracking-[0.18em] uppercase opacity-70">
                  {previewIsUpdating
                    ? "Updating"
                    : previewMatchesSavedDefaults &&
                        graphControlsMatchSavedDefaults
                      ? "Saved Default View"
                      : "Preview Only"}
                </div>
              </div>

              <div className="h-[min(42rem,70vh)] min-h-[22rem]">
                <PhotoGraphCanvas
                  controls={previewGraphControls}
                  graphUrl={previewGraphUrl}
                  fitToCanvas
                  showControls={false}
                  showNavigation={false}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="border-rule mt-6 border p-4">
          <div
            onDrop={handleDrop}
            onDragOver={(event) => event.preventDefault()}
            className="border-rule border border-dashed p-6 text-center"
          >
            <p className="text-sm">Drag and drop images here</p>
            <p className="my-2 text-xs opacity-70">or</p>
            <ControlLabel layout="action">
              Select Files
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                onChange={handleInputChange}
                className="hidden"
              />
            </ControlLabel>
          </div>

          <div className="mt-4 flex items-center justify-between text-sm">
            <p>{files.length} file(s) selected</p>
            <p>{bytesToMb(totalBytes)}</p>
          </div>

          {files.length > 0 && (
            <ul className="border-rule mt-3 max-h-56 overflow-y-auto border p-3 text-sm">
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
            <ControlButton
              onClick={handleUpload}
              disabled={uploadDisabled}
              layout="action"
              size="lg"
              className="font-medium"
            >
              {isProcessing ? "Processing..." : "Upload + Update Graph"}
            </ControlButton>

            {files.length > 0 && (
              <ControlButton
                onClick={() => setFiles([])}
                disabled={isProcessing}
                layout="action"
              >
                Clear
              </ControlButton>
            )}

            <ControlButton
              onClick={() => setVerbosePanelOpen((current) => !current)}
              layout="action"
            >
              {verbosePanelOpen ? "Hide Verbose Panel" : "Show Verbose Panel"}
            </ControlButton>

            <ControlButton onClick={clearVerboseLogs} layout="action">
              Clear Logs
            </ControlButton>
          </div>

          {statusMessage && (
            <p className="text-ink mt-4 text-sm">{statusMessage}</p>
          )}
          {errorMessage && (
            <p className="text-danger mt-2 text-sm">{errorMessage}</p>
          )}

          {createdIds.length > 0 && (
            <p className="mt-2 text-xs opacity-70">
              Created node IDs: {createdIds.join(", ")}
            </p>
          )}
        </section>

        <section className="border-rule mt-6 border p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">Manage Photos</h2>
            <div className="flex items-center gap-2 text-xs">
              <span className="opacity-70">
                {graphNodes.length} total node(s)
              </span>
              <ControlButton
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
              </ControlButton>
            </div>
          </div>

          <div className="mt-3">
            <input
              type="text"
              value={manageQuery}
              onChange={(event) => setManageQuery(event.target.value)}
              placeholder="Filter by node ID or storage path..."
              className="border-rule w-full border bg-transparent px-3 py-2 text-sm outline-none focus-visible:outline-2 focus-visible:outline-[rgb(var(--color-focus))]"
            />
          </div>

          <div className="border-rule mt-3 max-h-64 overflow-y-auto border p-2 text-xs">
            {filteredGraphNodes.length === 0 ? (
              <p className="px-2 py-2 opacity-70">
                No nodes match your filter.
              </p>
            ) : (
              <ul className="space-y-1">
                {filteredGraphNodes.map((node) => {
                  const isDeleting = deletingNodeId === node.id;
                  return (
                    <li
                      key={node.id}
                      className="border-rule flex flex-col gap-2 border p-2"
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
                              className="h-11 w-11 object-cover"
                            />
                          ) : (
                            <div className="border-rule h-11 w-11 border" />
                          )}

                          <div className="min-w-0 font-mono text-[11px]">
                            <div>
                              <span className="font-semibold">
                                ID {node.id}
                              </span>{" "}
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
                        <ControlButton
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
                          tone="danger"
                        >
                          {isDeleting ? "Deleting..." : "Delete"}
                        </ControlButton>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        <section className="border-rule mt-6 border p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">Verbose Activity</h2>
            <p className="text-xs opacity-70">
              {verboseLogs.length} log entries
            </p>
          </div>

          {verbosePanelOpen ? (
            <div className="border-rule bg-surface mt-3 max-h-64 overflow-y-auto border p-3 text-xs">
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
                            ? "text-danger"
                            : entry.level === "warn"
                              ? "text-warning"
                              : entry.level === "success"
                                ? "text-success"
                                : "text-ink"
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
      </div>
    </main>
  );
}
