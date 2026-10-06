"use client";

import { Download, X } from "lucide-react";
import {
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { ControlAnchor, ControlButton } from "@/app/components/ui/control";

import {
  photoGraphControlRowClass,
  photoGraphControlTextClass,
  photoGraphIconControlClass,
  photoGraphModalClass,
  PHOTO_GRAPH_INSPECT_TRANSITION_MS,
} from "./config";
import type { InspectMetadata, InspectTarget } from "./types";
import { buildInspectFilename, convertSizeToMb, isAbortError } from "./utils";

type PhotoGraphInspectOverlayProps = {
  target: InspectTarget | null;
  returnFocusRef?: RefObject<HTMLElement | null>;
  onCloseComplete: () => void;
};

export default function PhotoGraphInspectOverlay({
  target,
  returnFocusRef,
  onCloseComplete,
}: PhotoGraphInspectOverlayProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [inspectOverlayOpen, setInspectOverlayOpen] = useState(false);
  const [displayUrl, setDisplayUrl] = useState<string | null>(null);
  const [inspectMetadata, setInspectMetadata] =
    useState<InspectMetadata | null>(null);
  const requestClose = useCallback(() => {
    setInspectOverlayOpen(false);
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    const returnFocusElement = returnFocusRef?.current;

    if (!target) {
      if (dialog?.open) {
        dialog.close();
      }
      setInspectOverlayOpen(false);
      setDisplayUrl(null);
      setInspectMetadata(null);
      return;
    }

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    setInspectOverlayOpen(false);
    setDisplayUrl(target.previewUrl);
    setInspectMetadata({
      resolution: null,
      sizeMb: null,
      downloadUrl: null,
      filename: buildInspectFilename(target.id, target.originalUrl),
      status: "loading",
    });

    const frame = window.requestAnimationFrame(() => {
      if (!dialog?.open) {
        dialog?.showModal();
      }
      setInspectOverlayOpen(true);
      dialogRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    });

    return () => {
      window.cancelAnimationFrame(frame);
      if (dialog?.open) {
        dialog.close();
      }

      const previousFocus = previousFocusRef.current;
      const focusTarget = returnFocusElement?.isConnected
        ? returnFocusElement
        : previousFocus?.isConnected && previousFocus !== document.body
          ? previousFocus
          : null;
      focusTarget?.focus({ preventScroll: true });
      previousFocusRef.current = null;
    };
  }, [returnFocusRef, target]);

  useEffect(() => {
    if (!target) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const previousOverscrollBehavior = document.body.style.overscrollBehavior;
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.overscrollBehavior = previousOverscrollBehavior;
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
                status: "ready",
              }
            : current,
        );
      } catch (error) {
        if (!isAbortError(error)) {
          console.error(error);
          setInspectMetadata((current) =>
            current
              ? {
                  ...current,
                  downloadUrl: null,
                  sizeMb: null,
                  status: "error",
                }
              : current,
          );
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

  const metadataStatus = inspectMetadata?.status ?? "loading";
  const resolutionText = inspectMetadata?.resolution
    ? `${inspectMetadata.resolution.width} x ${inspectMetadata.resolution.height}`
    : metadataStatus === "error"
      ? "Unavailable"
      : "Loading...";
  const sizeText =
    inspectMetadata?.sizeMb != null
      ? `${inspectMetadata.sizeMb.toFixed(2)} MB`
      : metadataStatus === "error"
        ? "Unavailable"
        : "Loading...";

  return (
    <dialog
      ref={dialogRef}
      aria-label={`Inspect photograph ${target.id}`}
      onCancel={(event) => {
        event.preventDefault();
        requestClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          requestClose();
        }
      }}
      className={`m-auto h-[min(75dvh,48rem)] max-h-none w-[min(75dvw,68rem)] max-w-none overflow-hidden border border-ink p-0 transition-opacity duration-200 backdrop:bg-canvas/[0.78] motion-reduce:transition-none max-md:m-0 max-md:h-dvh max-md:w-dvw [@media(orientation:landscape)_and_(max-width:1023px)_and_(max-height:500px)]:m-0 [@media(orientation:landscape)_and_(max-width:1023px)_and_(max-height:500px)]:h-dvh [@media(orientation:landscape)_and_(max-width:1023px)_and_(max-height:500px)]:w-dvw ${photoGraphModalClass} ${
        inspectOverlayOpen ? "opacity-100" : "opacity-0"
      }`}
    >
      <div
        className="flex size-full min-h-0 flex-col"
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className={`flex w-full shrink-0 items-stretch justify-between border-b border-ink pt-[env(safe-area-inset-top)] ${photoGraphControlRowClass}`}
        >
          <ControlButton
            className={`shrink-0 border-y-0 border-l-0 focus-visible:-outline-offset-2 ${photoGraphIconControlClass}`}
            size="sm"
            aria-label="Close inspect overlay"
            onClick={requestClose}
          >
            <X aria-hidden />
          </ControlButton>

          <div
            aria-live="polite"
            className={`flex min-w-0 flex-1 items-center justify-end gap-3 overflow-hidden px-3 text-right ${photoGraphControlTextClass}`}
          >
            <p className="truncate">
              <span className="hidden sm:inline">Resolution: </span>
              {resolutionText}
            </p>
            <p className="truncate">
              <span className="hidden sm:inline">Original Size: </span>
              {sizeText}
            </p>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 items-center justify-center p-4 max-md:p-2 [@media(orientation:landscape)_and_(max-width:1023px)_and_(max-height:500px)]:p-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- This inspect overlay needs the raw image element for natural-size reads and unrestricted sizing. */}
          <img
            src={displayUrl ?? target.previewUrl}
            alt={`Photograph ${target.id}`}
            className={`size-full object-contain transition-opacity duration-200 ease-out motion-reduce:transition-none ${
              inspectOverlayOpen ? "opacity-100" : "opacity-0"
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

        <div
          className={`flex w-full shrink-0 justify-end border-t border-ink pb-[env(safe-area-inset-bottom)] ${photoGraphControlRowClass}`}
        >
          <ControlAnchor
            href={inspectMetadata?.downloadUrl ?? undefined}
            download={inspectMetadata?.filename}
            layout="action"
            size="md"
            className={`shrink-0 gap-1 border-y-0 border-r-0 text-xs focus-visible:-outline-offset-2 ${photoGraphControlRowClass} ${
              inspectMetadata?.downloadUrl
                ? ""
                : "pointer-events-none opacity-50"
            }`}
            aria-disabled={!inspectMetadata?.downloadUrl}
          >
            Download Original
            <Download aria-hidden className="size-4" />
          </ControlAnchor>
        </div>
      </div>
    </dialog>
  );
}
