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

import { featureFromRgb, rgbToHex } from "@/lib/photo-graph/feature-extraction";
import type { PhotoGraphJobStatus } from "@/lib/photo-graph/types";

type UploadApiResponse = {
  ok: boolean;
  jobId: string;
  createdIds: string[];
  nodeCount: number;
  error?: string;
};

type JobStatusResponse = {
  id: string;
  status: PhotoGraphJobStatus;
  progress: number;
  totalComparisons: number;
  doneComparisons: number;
  errorMessage?: string;
};

type ComputedFeaturePayload = {
  rgb: [number, number, number];
  lab: [number, number, number];
  hue: number;
  longSide: number;
  colour: string;
};

function bytesToMb(size: number) {
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
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

export default function PhotoGraphUploadClient() {
  const router = useRouter();

  const [files, setFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [createdIds, setCreatedIds] = useState<string[]>([]);
  const [jobStatus, setJobStatus] = useState<JobStatusResponse | null>(null);

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

  const handleUpload = async () => {
    if (!files.length || isProcessing) {
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    setStatusMessage("Extracting image features...");
    setJobStatus(null);

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

      setStatusMessage("Uploading and enqueueing graph job...");

      const response = await fetch("/api/admin/photo-graph/upload", {
        method: "POST",
        body: formData,
      });

      const body = (await response.json()) as UploadApiResponse;

      if (!response.ok || !body.ok) {
        throw new Error(body.error ?? "Upload request failed.");
      }

      setJobId(body.jobId);
      setCreatedIds(body.createdIds);
      setStatusMessage("Upload complete. Processing correlations...");
      setFiles([]);
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

  useEffect(() => {
    if (!jobId) {
      return;
    }

    let cancelled = false;

    const poll = async () => {
      try {
        const response = await fetch(`/api/admin/photo-graph/jobs/${jobId}`, {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const body = (await response.json()) as JobStatusResponse;
        if (cancelled) {
          return;
        }

        setJobStatus(body);

        if (body.status === "completed") {
          setStatusMessage("Job completed. New images are live in the graph.");
          setErrorMessage(null);
        }

        if (body.status === "failed") {
          setErrorMessage(body.errorMessage ?? "Job failed.");
          setStatusMessage(null);
        }
      } catch {
        if (!cancelled) {
          setErrorMessage("Failed to poll job status.");
        }
      }
    };

    void poll();
    const intervalId = window.setInterval(() => {
      void poll();
    }, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [jobId]);

  const uploadDisabled = !files.length || isProcessing;

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Photo Graph Upload Admin</h1>
          <p className="mt-1 text-sm opacity-70">
            Batch upload images, then background jobs auto-generate correlation links.
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
          {isProcessing ? "Processing..." : "Upload + Queue Job"}
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

      {jobStatus && (
        <div className="mt-6 rounded-md border border-black/20 p-4 text-sm dark:border-white/20">
          <p>
            <strong>Job:</strong> {jobStatus.id}
          </p>
          <p>
            <strong>Status:</strong> {jobStatus.status}
          </p>
          <p>
            <strong>Progress:</strong>{" "}
            {Math.round((jobStatus.progress ?? 0) * 100)}% ({jobStatus.doneComparisons}/
            {jobStatus.totalComparisons})
          </p>
        </div>
      )}
    </main>
  );
}
