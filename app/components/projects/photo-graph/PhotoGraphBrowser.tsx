"use client";

import { type RefObject, useId, useLayoutEffect, useRef } from "react";
import { ControlButton } from "@/app/components/ui/control";
import { getPhotographDescription } from "@/lib/photo-graph/descriptions";
import type { PhotoGraphData, PhotoGraphNode } from "./types";
import type { PhotoGraphLoadStatus } from "./usePhotoGraphData";
import styles from "./photo-graph-controls.module.css";

type Props = {
  graph: PhotoGraphData;
  loadStatus: PhotoGraphLoadStatus;
  selectedId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  standalone: boolean;
  revealEntry: boolean;
  statusId: string;
  entryRef: RefObject<HTMLElement | null>;
  selectRef: RefObject<HTMLSelectElement | null>;
  onSelect: (node: PhotoGraphNode) => void;
  onOpen: (node: PhotoGraphNode, opener: HTMLButtonElement) => void;
};

export default function PhotoGraphBrowser({
  graph,
  loadStatus,
  selectedId,
  open,
  onOpenChange,
  standalone,
  revealEntry,
  statusId,
  entryRef,
  selectRef,
  onSelect,
  onOpen,
}: Props) {
  const selectId = useId();
  const focusedElementRef = useRef<HTMLElement | null>(null);
  const selected =
    loadStatus === "ready"
      ? (graph.nodes.find((node) => node.id === selectedId) ?? graph.nodes[0])
      : undefined;
  useLayoutEffect(() => {
    // Removing a focused action during a data replacement leaves focus on body.
    // Do not steal focus from another control or an open native modal.
    if (
      focusedElementRef.current &&
      !focusedElementRef.current.isConnected &&
      document.activeElement === document.body &&
      !document.querySelector("dialog[open]")
    ) {
      entryRef.current?.focus({ preventScroll: true });
    }
  });
  const neighbors = graph.links
    .flatMap((link) => {
      const source =
        typeof link.source === "string" ? link.source : link.source.id;
      const target =
        typeof link.target === "string" ? link.target : link.target.id;
      const id =
        source === selected?.id
          ? target
          : target === selected?.id
            ? source
            : null;
      const node = graph.nodes.find((candidate) => candidate.id === id);
      return node ? [{ node, value: link.baseValue }] : [];
    })
    .sort((a, b) => b.value - a.value);

  return (
    <details
      open={open}
      onToggle={(event) => onOpenChange(event.currentTarget.open)}
      data-revealed={revealEntry}
      aria-describedby={loadStatus !== "ready" ? statusId : undefined}
      className={`pointer-events-auto m-1 max-w-[calc(100%-0.5rem)] border border-ink bg-canvas text-ink ${standalone ? styles.standaloneBrowser : ""}`}
      onFocusCapture={(event) => {
        if (event.target instanceof HTMLElement) {
          focusedElementRef.current = event.target;
        }
      }}
      onBlurCapture={(event) => {
        if (
          event.relatedTarget instanceof Node &&
          !event.currentTarget.contains(event.relatedTarget)
        ) {
          focusedElementRef.current = null;
        }
      }}
      onKeyDown={(event) => {
        if (!["Escape", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
        if (event.target instanceof HTMLSelectElement) {
          // Keep OS popup/selection defaults; do not activate host shortcuts.
          event.stopPropagation();
        } else if (open) {
          event.stopPropagation();
          if (event.key === "Escape") {
            event.preventDefault();
            onOpenChange(false);
            entryRef.current?.focus({ preventScroll: true });
          }
        }
      }}
    >
      <summary
        ref={entryRef}
        className="min-h-11 cursor-pointer p-3 text-xs font-semibold focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink focus-visible:outline-solid"
      >
        Browse photographs
      </summary>
      <div
        className={`${styles.browserContent} w-72 max-w-full space-y-3 overflow-y-auto border-t border-ink p-3 text-sm`}
      >
        {selected ? (
          <>
            <label htmlFor={selectId} className="block">
              Select a photograph
            </label>
            <select
              ref={selectRef}
              id={selectId}
              value={selected.id}
              className="min-h-11 w-full border border-ink bg-canvas px-2"
              onChange={(event) => {
                const node = graph.nodes.find(
                  (candidate) => candidate.id === event.target.value,
                );
                if (node) onSelect(node);
              }}
            >
              {graph.nodes.map((node) => (
                <option key={node.id} value={node.id}>
                  Photograph {node.id}
                </option>
              ))}
            </select>
            <p aria-live="polite">
              Photograph {selected.id}.{" "}
              {selected.aspectRatio > 1
                ? "Landscape"
                : selected.aspectRatio < 1
                  ? "Portrait"
                  : "Square"}{" "}
              image.
            </p>
            <p>
              {getPhotographDescription(selected) ??
                "No subject description is available for this photograph."}
            </p>
            <ControlButton
              layout="action"
              size="md"
              onClick={(event) => onOpen(selected, event.currentTarget)}
            >
              Open selected photograph
            </ControlButton>
            <p className="font-semibold">Related photographs</p>
            {neighbors.length ? (
              <ul className="space-y-1">
                {neighbors.map(({ node }) => (
                  <li key={node.id}>
                    <button
                      type="button"
                      className="min-h-11 text-left underline underline-offset-4"
                      onClick={() => {
                        onSelect(node);
                        selectRef.current?.focus();
                      }}
                    >
                      Select photograph {node.id}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No connected photographs.</p>
            )}
          </>
        ) : (
          <p>
            {loadStatus === "error"
              ? "Use Try again to reload the graph."
              : "Photograph selection is available when the graph has photographs."}
          </p>
        )}
      </div>
    </details>
  );
}
