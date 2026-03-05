"use client";

import {
  ChangeEvent,
  DragEvent,
  useCallback,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import {
  MIN_CORRELATION,
  computeCorrelation,
} from "@/lib/photo-graph/correlation";
import { featureFromRgb, rgbToHex } from "@/lib/photo-graph/feature-extraction";
import type { GraphFeature } from "@/lib/photo-graph/types";

type UploadApiResponse = {
  ok: boolean;
  createdIds: string[];
  nodeCount: number;
  error?: string;
};

type AdminGraphNode = {
  id: string;
  correlations: Record<string, number>;
  feature?: GraphFeature;
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
  colour: string;
};

const EDGE_UPDATE_BATCH_SIZE = 2000;
const COMPUTE_YIELD_INTERVAL = 750;

function bytesToMb(size: number) {
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
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

  const [files, setFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdIds, setCreatedIds] = useState<string[]>([]);

  const totalBytes = useMemo(
    () => files.reduce((sum, file) => sum + file.size, 0),
    [files],
  );

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
      return;
    }

    const totalBatches = Math.ceil(updates.length / EDGE_UPDATE_BATCH_SIZE);

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex += 1) {
      const start = batchIndex * EDGE_UPDATE_BATCH_SIZE;
      const end = start + EDGE_UPDATE_BATCH_SIZE;
      const batch = updates.slice(start, end);

      setStatusMessage(
        `Applying edge updates (${batchIndex + 1}/${totalBatches})...`,
      );

      const response = await fetch("/api/admin/photo-graph/apply-correlations", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ updates: batch }),
      });

      const body = (await response.json()) as ApplyCorrelationsResponse;

      if (!response.ok || !body.ok) {
        throw new Error(body.error ?? "Failed to apply correlation updates.");
      }
    }
  };

  const handleUpload = async () => {
    if (!files.length || isProcessing) {
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    setStatusMessage("Extracting image features...");

    try {
      const featurePayloads: ComputedFeaturePayload[] = [];

      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        setStatusMessage(
          `Extracting image features (${index + 1}/${files.length}): ${file.name}`,
        );

        featurePayloads.push(await computeFeaturePayload(file));
      }

      const formData = new FormData();
      for (const file of files) {
        formData.append("files", file);
      }
      formData.append("features", JSON.stringify(featurePayloads));

      setStatusMessage("Uploading files and creating nodes...");

      const uploadResponse = await fetch("/api/admin/photo-graph/upload", {
        method: "POST",
        body: formData,
      });

      const uploadBody = (await uploadResponse.json()) as UploadApiResponse;

      if (!uploadResponse.ok || !uploadBody.ok) {
        throw new Error(uploadBody.error ?? "Upload request failed.");
      }

      setCreatedIds(uploadBody.createdIds);
      setFiles([]);

      setStatusMessage("Fetching graph snapshot for local edge generation...");

      const graphResponse = await fetch("/api/admin/photo-graph/graph", {
        method: "GET",
        cache: "no-store",
      });

      const graphBody = (await graphResponse.json()) as AdminGraphResponse;

      if (!graphResponse.ok || !Array.isArray(graphBody.nodes)) {
        throw new Error(graphBody.error ?? "Failed to load graph metadata.");
      }

      const correlationBuild = await buildCorrelationUpdates(
        graphBody.nodes,
        uploadBody.createdIds,
        (processed, total) => {
          const ratio = total > 0 ? Math.round((processed / total) * 100) : 100;
          setStatusMessage(`Generating edges in browser (${ratio}%)...`);
        },
      );

      await applyCorrelationBatches(correlationBuild.updates);

      setStatusMessage(
        `Done. Added ${uploadBody.createdIds.length} image(s) and generated ${correlationBuild.updates.length} edge updates.`,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Upload failed unexpectedly.";
      setErrorMessage(message);
      setStatusMessage(null);
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
            Batch upload images, then your browser generates node correlations and syncs updates.
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
      </div>

      {statusMessage && <p className="mt-4 text-sm text-blue-700">{statusMessage}</p>}
      {errorMessage && <p className="mt-2 text-sm text-red-600">{errorMessage}</p>}

      {createdIds.length > 0 && (
        <p className="mt-2 text-xs opacity-70">
          Created node IDs: {createdIds.join(", ")}
        </p>
      )}
    </main>
  );
}
