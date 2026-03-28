import { PHOTO_GRAPH_IMAGE_WIDTHS } from "@/lib/image-optimization";
import type { GraphControls, GraphSliderConfig } from "./types";

export const GRAPH_CONFIG = {
  collidePad: 0,
  collideBoxScale: 1,
  collideStrength: 2,
  collideIterations: 1,
  distMin: 10,
  distMax: 1600,
  charge: -420,
  zoomExtent: [0.25, 4] as [number, number],
  initialZoom: 0.8,
  imageConcurrency: 5,
  initialImageMaxWidth: 192,
  initialVisibleImageCount: 36,
  initialImageFallbackCount: 12,
  fitToCanvasDurationMs: 250,
  fitToCanvasMinTicks: 6,
  fitToCanvasPaddingRatio: 0.08,
  viewportBufferRatio: 0.15,
} as const;

export const overlayPanelClass =
  "absolute left-[1vmin] top-[1vmin] z-[5] flex w-[min(18rem,calc(100vw-2vmin))] flex-col gap-3 p-2 backdrop-blur-[2px]";
export const overlayTextClass = "m-0 p-0 text-xs";
export const photoGraphShellClass = "bg-neutral-950 text-neutral-100";
export const photoGraphOverlayClass = "overlay-tone-base bg-overlay-fill-soft";
export const photoGraphModalClass = "bg-overlay-panel text-overlay-ink";
export const sliderClass =
  "range-sm h-2 rounded-full border-none bg-black/15 accent-ink dark:bg-white/35";
export const PHOTO_GRAPH_INSPECT_TRANSITION_MS = 220;
export const PHOTO_GRAPH_INSPECT_PREVIEW_WIDTH =
  PHOTO_GRAPH_IMAGE_WIDTHS[PHOTO_GRAPH_IMAGE_WIDTHS.length - 1];
export const PHOTO_GRAPH_INSPECT_PREVIEW_QUALITY = 75;

export const DEFAULT_GRAPH_CONTROLS: GraphControls = {
  hideConnections: false,
  chargeMult: 1,
  distMinMult: 0,
  distMaxMult: 0,
};

export const GRAPH_CONTROL_SLIDERS: readonly GraphSliderConfig[] = [
  {
    key: "chargeMult",
    label: "Repel strength",
    min: 0,
    max: 5,
    formatValue: (value) => `${value.toFixed(0)}x`,
  },
  {
    key: "distMinMult",
    label: "Closest link distance",
    min: 0,
    max: 500,
    scale: 0.1,
    formatValue: (value) => `${Math.round(GRAPH_CONFIG.distMin * value)} px`,
  },
  {
    key: "distMaxMult",
    label: "Widest link distance",
    min: 0,
    max: 50,
    scale: 0.1,
    formatValue: (value) => `${Math.round(GRAPH_CONFIG.distMax * value)} px`,
  },
];
