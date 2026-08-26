import { PHOTO_GRAPH_IMAGE_WIDTHS } from "@/lib/image-optimization";
import {
  DEFAULT_PHOTO_GRAPH_RUNTIME_CONTROLS,
  PHOTO_GRAPH_RUNTIME_CONTROL_LIMITS,
} from "@/lib/photo-graph/graph-controls";
import type { GraphControls, GraphSliderConfig } from "./types";

export const GRAPH_CONFIG = {
  collidePad: 0,
  collideBoxScale: 1,
  collideStrength: 2,
  collideIterations: 1,
  distMin: 10,
  distMax: 1600,
  charge: -420,
  zoomExtent: [0.2, 4] as [number, number],
  initialZoom: 0.8,
  imageConcurrency: 5,
  initialImageMaxWidth: 192,
  initialVisibleImageCount: 36,
  initialImageFallbackCount: 12,
  settleTicks: 600,
  warmupTicks: 300,
  settleAlpha: 0.001,
  connectionIntroDragDistancePx: 8,
  fitToCanvasDurationMs: 250,
  fitToCanvasPaddingRatio: 0.08,
  viewportBufferRatio: 0.15,
} as const;

export const PHOTO_GRAPH_ALPHA_DECAY =
  1 - Math.pow(GRAPH_CONFIG.settleAlpha, 1 / GRAPH_CONFIG.settleTicks);

export const PHOTO_GRAPH_VISIBLE_SETTLE_TICKS =
  GRAPH_CONFIG.settleTicks - GRAPH_CONFIG.warmupTicks;

export const photoGraphControlsPositionClass =
  "absolute left-[1vmin] top-[1vmin] z-[5] flex w-[min(18rem,calc(100vw-2vmin))] flex-col";
export const photoGraphControlTextClass =
  "m-0 p-0 text-[0.6875rem] font-medium tracking-[0.04em]";
export const photoGraphShellClass = "bg-canvas text-ink";
export const photoGraphPanelClass = "border-rule bg-canvas text-ink";
export const photoGraphModalClass = "bg-canvas text-ink";
export const sliderClass = "range-sm h-2 border-none bg-surface accent-ink";
export const PHOTO_GRAPH_INSPECT_TRANSITION_MS = 220;
export const PHOTO_GRAPH_INSPECT_PREVIEW_WIDTH =
  PHOTO_GRAPH_IMAGE_WIDTHS[PHOTO_GRAPH_IMAGE_WIDTHS.length - 1];
export const PHOTO_GRAPH_INSPECT_PREVIEW_QUALITY = 75;

export const DEFAULT_GRAPH_CONTROLS: GraphControls = {
  ...DEFAULT_PHOTO_GRAPH_RUNTIME_CONTROLS,
};

export const GRAPH_CONTROL_SLIDERS: readonly GraphSliderConfig[] = [
  {
    key: "chargeMult",
    label: "Repel strength",
    min: PHOTO_GRAPH_RUNTIME_CONTROL_LIMITS.chargeMult.min,
    max: PHOTO_GRAPH_RUNTIME_CONTROL_LIMITS.chargeMult.max,
    formatValue: (value) => `${value.toFixed(0)}x`,
  },
  {
    key: "distMinMult",
    label: "Closest link distance",
    min: PHOTO_GRAPH_RUNTIME_CONTROL_LIMITS.distMinMult.min / 0.1,
    max: PHOTO_GRAPH_RUNTIME_CONTROL_LIMITS.distMinMult.max / 0.1,
    scale: 0.1,
    formatValue: (value) => `${Math.round(GRAPH_CONFIG.distMin * value)} px`,
  },
  {
    key: "distMaxMult",
    label: "Widest link distance",
    min: PHOTO_GRAPH_RUNTIME_CONTROL_LIMITS.distMaxMult.min / 0.1,
    max: PHOTO_GRAPH_RUNTIME_CONTROL_LIMITS.distMaxMult.max / 0.1,
    scale: 0.1,
    formatValue: (value) => `${Math.round(GRAPH_CONFIG.distMax * value)} px`,
  },
];

export const GRAPH_COLLISION_SLIDERS: readonly GraphSliderConfig[] = [
  {
    key: "collideStrength",
    label: "Collision strength",
    min: PHOTO_GRAPH_RUNTIME_CONTROL_LIMITS.collideStrength.min / 0.1,
    max: PHOTO_GRAPH_RUNTIME_CONTROL_LIMITS.collideStrength.max / 0.1,
    scale: 0.1,
    formatValue: (value) => `${value.toFixed(1)}x`,
  },
  {
    key: "collideBoxScale",
    label: "Collision box scale",
    min: PHOTO_GRAPH_RUNTIME_CONTROL_LIMITS.collideBoxScale.min / 0.05,
    max: PHOTO_GRAPH_RUNTIME_CONTROL_LIMITS.collideBoxScale.max / 0.05,
    scale: 0.05,
    formatValue: (value) => `${value.toFixed(2)}x`,
  },
  {
    key: "collidePad",
    label: "Collision padding",
    min: PHOTO_GRAPH_RUNTIME_CONTROL_LIMITS.collidePad.min,
    max: PHOTO_GRAPH_RUNTIME_CONTROL_LIMITS.collidePad.max,
    formatValue: (value) => `${value.toFixed(0)} px`,
  },
  {
    key: "collideIterations",
    label: "Collision passes",
    min: PHOTO_GRAPH_RUNTIME_CONTROL_LIMITS.collideIterations.min,
    max: PHOTO_GRAPH_RUNTIME_CONTROL_LIMITS.collideIterations.max,
    formatValue: (value) => `${value.toFixed(0)}`,
  },
];
