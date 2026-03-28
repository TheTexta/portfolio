"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

import {
  OverlayControlAnchor,
  OverlayControlButton,
} from "@/app/components/ui/overlay-control-button";

import {
  overlayTextClass,
  photoGraphModalClass,
  PHOTO_GRAPH_INSPECT_TRANSITION_MS,
} from "./config";
import type { InspectMetadata, InspectTarget } from "./types";
import {
  buildInspectFilename,
  convertSizeToMb,
  isAbortError,
} from "./utils";

type PhotoGraphInspectOverlayProps = {
  target: InspectTarget | null;
  onCloseComplete: () => void;
};

export default function PhotoGraphInspectOverlay({
  target,
  onCloseComplete,
}: PhotoGraphInspectOverlayProps) {
  const [inspectOverlayOpen, setInspectOverlayOpen] = useState(false);
  const [displayUrl, setDisplayUrl] = useState<string | null>(null);
  const [inspectMetadata, setInspectMetadata] =
    useState<InspectMetadata | null>(null);

  useEffect(() => {
    if (!target) {
      setInspectOverlayOpen(false);
      setDisplayUrl(null);
      setInspectMetadata(null);
      return;
    }

    setInspectOverlayOpen(false);
    setDisplayUrl(target.previewUrl);
    setInspectMetadata({
      resolution: null,
      sizeMb: null,
      downloadUrl: null,
      filename: buildInspectFilename(target.id, target.originalUrl),
    });

    const frame = window.requestAnimationFrame(() => {
      setInspectOverlayOpen(true);
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [target]);

  useEffect(() => {
    if (!target) {
      return;
    }

    const abortController = new AbortController();
    let objectUrl: string | null = null;

    const loadInspectMetadata = async () => {
      try {
        const response = await fetch(target.originalUrl, {
          cache: "no-store",
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error(
            `Failed to fetch original image: ${response.status} ${response.statusText}`,
          );
        }

        const blob = await response.blob();
        if (abortController.signal.aborted) {
          return;
        }

        objectUrl = URL.createObjectURL(blob);
        setDisplayUrl(objectUrl);
        setInspectMetadata((current) =>
          current
            ? {
                ...current,
                sizeMb: convertSizeToMb(blob.size),
                downloadUrl: objectUrl,
                filename: buildInspectFilename(
                  target.id,
                  target.originalUrl,
                  blob.type,
                ),
              }
            : current,
        );
      } catch (error) {
        if (!isAbortError(error)) {
          console.error(error);
        }
      }
    };

    void loadInspectMetadata();

    return () => {
      abortController.abort();
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [target]);

  useEffect(() => {
    if (!target || inspectOverlayOpen) {
      return;
    }

    const timeout = window.setTimeout(() => {
      onCloseComplete();
    }, PHOTO_GRAPH_INSPECT_TRANSITION_MS);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [inspectOverlayOpen, onCloseComplete, target]);

  if (!target) {
    return null;
  }

  return (
    <div
      onClick={() => setInspectOverlayOpen(false)}
      className={`absolute inset-0 z-10 m-auto flex max-h-9/12 max-w-9/12 items-center justify-center transition-[opacity,backdrop-filter] duration-200 ${photoGraphModalClass} ${
        inspectOverlayOpen
          ? "opacity-100 backdrop-blur-sm"
          : "backdrop-blur-0 opacity-0"
      }`}
    >
      <div
        className={`relative flex h-full w-full flex-col items-center justify-center transition-[opacity,transform,filter] duration-200 ease-out ${
          inspectOverlayOpen
            ? "blur-0 scale-100 opacity-100"
            : "scale-[1.06] opacity-0 blur-[2px]"
        }`}
        onClick={(event) => event.stopPropagation()}
      >
        <OverlayControlButton
          onClick={() => setInspectOverlayOpen(false)}
          className="absolute top-0 right-0 mx-2 my-2"
          aria-label="Close image inspection"
        >
          <X className="h-4 w-4" />
        </OverlayControlButton>

        {/* eslint-disable-next-line @next/next/no-img-element -- This inspect overlay needs the raw image element for natural-size reads and unrestricted sizing. */}
        <img
          src={displayUrl ?? target.previewUrl}
          alt=""
          className={`my-auto max-h-9/12 max-w-5/6 place-self-center align-middle transition-transform duration-200 ease-out ${
            inspectOverlayOpen ? "scale-100" : "scale-[1.1]"
          }`}
          onLoad={(event) => {
            const { naturalWidth, naturalHeight } = event.currentTarget;
            setInspectMetadata((current) =>
              current
                ? {
                    ...current,
                    resolution: {
                      width: naturalWidth,
                      height: naturalHeight,
                    },
                  }
                : current,
            );
          }}
        />

        <div
          className={`absolute bottom-0 flex h-1/8 w-full items-center justify-between gap-4 px-4 text-[9px] transition-opacity duration-200 sm:text-xs ${overlayTextClass} ${
            inspectOverlayOpen ? "opacity-100" : "opacity-0"
          }`}
        >
          <div className="flex items-center gap-4">
            <p>
              <span className="hidden sm:inline">Resolution: </span>
              {inspectMetadata?.resolution
                ? `${inspectMetadata.resolution.width} x ${inspectMetadata.resolution.height}`
                : "Loading..."}
            </p>
            <p>
              <span className="hidden sm:inline">Original Size: </span>
              {inspectMetadata?.sizeMb != null
                ? `${inspectMetadata.sizeMb.toFixed(2)} MB`
                : "Loading..."}
            </p>
          </div>

          <OverlayControlAnchor
            href={inspectMetadata?.downloadUrl ?? undefined}
            download={inspectMetadata?.filename}
            layout="action"
            size="sm"
            className={`gap-1 ${
              inspectMetadata?.downloadUrl ? "" : "pointer-events-none opacity-50"
            }`}
            aria-disabled={!inspectMetadata?.downloadUrl}
          >
            Download Original
            <Download className="h-4 w-4" />
          </OverlayControlAnchor>
        </div>
      </div>
    </div>
  );
}
