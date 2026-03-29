import type { PhotoGraphRuntimeControls } from "@/lib/photo-graph/types";

export const DEFAULT_PHOTO_GRAPH_RUNTIME_CONTROLS: PhotoGraphRuntimeControls = {
  hideConnections: false,
  chargeMult: 1,
  distMinMult: 0,
  distMaxMult: 1,
};

export const PHOTO_GRAPH_RUNTIME_CONTROL_LIMITS = {
  chargeMult: {
    min: 0,
    max: 5,
  },
  distMinMult: {
    min: 0,
    max: 50,
  },
  distMaxMult: {
    min: 0,
    max: 5,
  },
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function parseFiniteNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return Number.NaN;
}

function normalizeControlValue(
  value: unknown,
  fallback: number,
  limits: { min: number; max: number },
) {
  const parsed = parseFiniteNumber(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return clamp(parsed, limits.min, limits.max);
}

export function normalizePhotoGraphRuntimeControls(
  value: unknown,
): PhotoGraphRuntimeControls {
  const record = isRecord(value) ? value : {};

  return {
    hideConnections:
      typeof record.hideConnections === "boolean"
        ? record.hideConnections
        : DEFAULT_PHOTO_GRAPH_RUNTIME_CONTROLS.hideConnections,
    chargeMult: normalizeControlValue(
      record.chargeMult,
      DEFAULT_PHOTO_GRAPH_RUNTIME_CONTROLS.chargeMult,
      PHOTO_GRAPH_RUNTIME_CONTROL_LIMITS.chargeMult,
    ),
    distMinMult: normalizeControlValue(
      record.distMinMult,
      DEFAULT_PHOTO_GRAPH_RUNTIME_CONTROLS.distMinMult,
      PHOTO_GRAPH_RUNTIME_CONTROL_LIMITS.distMinMult,
    ),
    distMaxMult: normalizeControlValue(
      record.distMaxMult,
      DEFAULT_PHOTO_GRAPH_RUNTIME_CONTROLS.distMaxMult,
      PHOTO_GRAPH_RUNTIME_CONTROL_LIMITS.distMaxMult,
    ),
  };
}

export function parsePhotoGraphRuntimeControls(
  value: unknown,
): PhotoGraphRuntimeControls | null {
  if (!isRecord(value) || typeof value.hideConnections !== "boolean") {
    return null;
  }

  const chargeMult = parseFiniteNumber(value.chargeMult);
  const distMinMult = parseFiniteNumber(value.distMinMult);
  const distMaxMult = parseFiniteNumber(value.distMaxMult);

  if (
    !Number.isFinite(chargeMult) ||
    !Number.isFinite(distMinMult) ||
    !Number.isFinite(distMaxMult) ||
    chargeMult < PHOTO_GRAPH_RUNTIME_CONTROL_LIMITS.chargeMult.min ||
    chargeMult > PHOTO_GRAPH_RUNTIME_CONTROL_LIMITS.chargeMult.max ||
    distMinMult < PHOTO_GRAPH_RUNTIME_CONTROL_LIMITS.distMinMult.min ||
    distMinMult > PHOTO_GRAPH_RUNTIME_CONTROL_LIMITS.distMinMult.max ||
    distMaxMult < PHOTO_GRAPH_RUNTIME_CONTROL_LIMITS.distMaxMult.min ||
    distMaxMult > PHOTO_GRAPH_RUNTIME_CONTROL_LIMITS.distMaxMult.max
  ) {
    return null;
  }

  return {
    hideConnections: value.hideConnections,
    chargeMult,
    distMinMult,
    distMaxMult,
  };
}
