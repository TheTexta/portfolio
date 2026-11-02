"use client";

import { useId, useRef } from "react";
import { ControlButton } from "@/app/components/ui/control";
import { getPhotographDescription } from "@/lib/photo-graph/descriptions";
import type { PhotoGraphData, PhotoGraphNode } from "./types";

type Props = {
  graph: PhotoGraphData;
  selectedId: string | null;
  onSelect: (node: PhotoGraphNode) => void;
  onOpen: (node: PhotoGraphNode) => void;
};

export default function PhotoGraphBrowser({
  graph,
  selectedId,
  onSelect,
  onOpen,
}: Props) {
  const selectId = useId();
  const selectRef = useRef<HTMLSelectElement>(null);
  const selected =
    graph.nodes.find((node) => node.id === selectedId) ?? graph.nodes[0];
  if (!selected) return null;
  const neighbors = graph.links
    .flatMap((link) => {
      const source =
        typeof link.source === "string" ? link.source : link.source.id;
      const target =
        typeof link.target === "string" ? link.target : link.target.id;
      const id =
        source === selected.id
          ? target
          : target === selected.id
            ? source
            : null;
      const node = graph.nodes.find((candidate) => candidate.id === id);
      return node ? [{ node, value: link.baseValue }] : [];
    })
    .sort((a, b) => b.value - a.value);

  return (
    <details className="absolute bottom-3 left-3 z-10 max-w-[calc(100%-1.5rem)] border border-ink bg-canvas text-ink">
      <summary className="min-h-11 cursor-pointer p-3 text-xs font-semibold">
        Browse photographs
      </summary>
      <div className="max-h-[min(60svh,24rem)] w-72 max-w-full space-y-3 overflow-y-auto border-t border-ink p-3 text-sm">
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
          onClick={() => onOpen(selected)}
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
      </div>
    </details>
  );
}
