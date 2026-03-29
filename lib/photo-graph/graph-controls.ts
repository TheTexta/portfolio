import type {
  PhotoGraphNumericControlKey,
  PhotoGraphRuntimeControls,
} from "@/lib/photo-graph/types";

export const DEFAULT_PHOTO_GRAPH_RUNTIME_CONTROLS: PhotoGraphRuntimeControls = {
  hideConnections: false,
  chargeMult: 1,
  collideBoxScale: 1,
  collideIterations: 1,
  collidePad: 0,
  collideStrength: 2,
  distMinMult: 0,
  distMaxMult: 1,
};

type PhotoGraphRuntimeControlLimits = {
  max: number;
  min: number;
  integer?: boolean;
};

const NUMERIC_GRAPH_CONTROL_KEYS: readonly PhotoGraphNumericControlKey[] = [
  "chargeMult",
  "collideBoxScale",
  "collideIterations",
  "collidePad",
  "collideStrength",
  "distMinMult",
  "distMaxMult",
];

export const PHOTO_GRAPH_RUNTIME_CONTROL_LIMITS: Record<
  PhotoGraphNumericControlKey,
  PhotoGraphRuntimeControlLimits
> = {
  chargeMult: {
    min: 0,
    max: 5,
  },
  collideBoxScale: {
    min: 0.5,
    max: 2,
  },
  collideIterations: {
    min: 0,
    max: 6,
    integer: true,
  },
  collidePad: {
    min: 0,
    max: 48,
    integer: true,
  },
  collideStrength: {
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
  limits: PhotoGraphRuntimeControlLimits,
) {
  const parsed = parseFiniteNumber(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  const normalized = limits.integer ? Math.round(parsed) : parsed;
  return clamp(normalized, limits.min, limits.max);
}

export function normalizePhotoGraphRuntimeControlValue(
  key: PhotoGraphNumericControlKey,
  value: unknown,
  fallback: number,
) {
  return normalizeControlValue(
    value,
    fallback,
    PHOTO_GRAPH_RUNTIME_CONTROL_LIMITS[key],
  );
}

export function normalizePhotoGraphRuntimeControls(
  value: unknown,
): PhotoGraphRuntimeControls {
  const record = isRecord(value) ? value : {};
  const controls = {
    hideConnections:
      typeof record.hideConnections === "boolean"
        ? record.hideConnections
        : DEFAULT_PHOTO_GRAPH_RUNTIME_CONTROLS.hideConnections,
  } as PhotoGraphRuntimeControls;

  for (const key of NUMERIC_GRAPH_CONTROL_KEYS) {
    controls[key] = normalizePhotoGraphRuntimeControlValue(
      key,
      record[key],
      DEFAULT_PHOTO_GRAPH_RUNTIME_CONTROLS[key],
    );
  }

  return controls;
}

function parseNumericControlValue(
  key: PhotoGraphNumericControlKey,
  value: unknown,
) {
  const parsed = parseFiniteNumber(value);
  const limits = PHOTO_GRAPH_RUNTIME_CONTROL_LIMITS[key];

  if (!Number.isFinite(parsed)) {
    return null;
  }

  if (limits.integer && !Number.isInteger(parsed)) {
    return null;
  }

  if (parsed < limits.min || parsed > limits.max) {
    return null;
  }

  return parsed;
}

export function parsePhotoGraphRuntimeControls(
  value: unknown,
): PhotoGraphRuntimeControls | null {
  if (!isRecord(value) || typeof value.hideConnections !== "boolean") {
    return null;
  }

  const controls = {
    hideConnections: value.hideConnections,
  } as PhotoGraphRuntimeControls;

  for (const key of NUMERIC_GRAPH_CONTROL_KEYS) {
    const parsed = parseNumericControlValue(key, value[key]);
    if (parsed === null) {
      return null;
    }

    controls[key] = parsed;
  }

  return controls;
}
