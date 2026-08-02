"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

import { ControlAnchor, ControlButton } from "@/app/components/ui/control";

import {
  photoGraphControlTextClass,
  photoGraphModalClass,
  PHOTO_GRAPH_INSPECT_TRANSITION_MS,
} from "./config";
import type { InspectMetadata, InspectTarget } from "./types";
import { buildInspectFilename, convertSizeToMb, isAbortError } from "./utils";

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
      className={`border-rule absolute inset-0 z-10 m-auto flex max-h-9/12 max-w-9/12 items-center justify-center border transition-opacity duration-200 ${photoGraphModalClass} ${
        inspectOverlayOpen ? "opacity-100" : "opacity-0"
      }`}
    >
      <div
        className={`relative flex h-full w-full flex-col items-center justify-center transition-[opacity,transform] duration-200 ease-out ${
          inspectOverlayOpen
            ? "scale-100 opacity-100"
            : "scale-[1.03] opacity-0"
        }`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-rule flex h-8 w-full items-stretch justify-between border-b">
          <ControlButton
            className="h-8 w-8 shrink-0 border-y-0 border-l-0"
            aria-label="Close inspect overlay"
            onClick={() => setInspectOverlayOpen(false)}
          >
            <X />
          </ControlButton>

          <div
            className={`flex min-w-0 flex-1 items-center justify-end gap-3 px-3 text-right ${photoGraphControlTextClass}`}
          >
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

          <ControlAnchor
            href={inspectMetadata?.downloadUrl ?? undefined}
            download={inspectMetadata?.filename}
            layout="action"
            size="sm"
            className={`h-8 min-h-8 shrink-0 gap-1 border-y-0 border-r-0 whitespace-nowrap ${
              inspectMetadata?.downloadUrl
                ? ""
                : "pointer-events-none opacity-50"
            }`}
            aria-disabled={!inspectMetadata?.downloadUrl}
          >
            Download<span className="hidden sm:inline"> Original</span>
            <Download className="h-4 w-4" />
          </ControlAnchor>
        </div>

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
      </div>
    </div>
  );
}
