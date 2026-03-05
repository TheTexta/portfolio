import type { GraphFeature } from "@/lib/photo-graph/types";

const LAB_REF_X = 95.047;
const LAB_REF_Y = 100.0;
const LAB_REF_Z = 108.883;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function toLinearSrgb(channel: number) {
  if (channel <= 0.04045) {
    return channel / 12.92;
  }

  return ((channel + 0.055) / 1.055) ** 2.4;
}

function labPivot(value: number) {
  const epsilon = 216 / 24389;
  const kappa = 24389 / 27;

  if (value > epsilon) {
    return Math.cbrt(value);
  }

  return (kappa * value + 16) / 116;
}

export function clamp01(value: number) {
  return clamp(value, 0, 1);
}

export function rgbToHex(rgb: [number, number, number]) {
  const [r, g, b] = rgb.map((value) =>
    Math.round(clamp(value, 0, 255)),
  ) as [number, number, number];

  return `#${r.toString(16).padStart(2, "0")}${g
    .toString(16)
    .padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

export function hexToRgb(hex: string): [number, number, number] | null {
  const normalized = hex.trim().toLowerCase();
  const shorthand = /^#([0-9a-f]{3})$/i;
  const full = /^#([0-9a-f]{6})$/i;

  const shorthandMatch = normalized.match(shorthand);
  if (shorthandMatch) {
    const [r, g, b] = shorthandMatch[1].split("");
    return [
      Number.parseInt(`${r}${r}`, 16),
      Number.parseInt(`${g}${g}`, 16),
      Number.parseInt(`${b}${b}`, 16),
    ];
  }

  const fullMatch = normalized.match(full);
  if (fullMatch) {
    const value = fullMatch[1];
    return [
      Number.parseInt(value.slice(0, 2), 16),
      Number.parseInt(value.slice(2, 4), 16),
      Number.parseInt(value.slice(4, 6), 16),
    ];
  }

  return null;
}

export function hueDegFromRgb(rgb: [number, number, number]) {
  const [r, g, b] = rgb.map((value) => clamp(value / 255, 0, 1)) as [
    number,
    number,
    number,
  ];

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  if (delta === 0) {
    return 0;
  }

  if (max === r) {
    return (60 * ((g - b) / delta) + 360) % 360;
  }

  if (max === g) {
    return (60 * ((b - r) / delta) + 120) % 360;
  }

  return (60 * ((r - g) / delta) + 240) % 360;
}

export function rgbToLab(rgb: [number, number, number]): [number, number, number] {
  const [sr, sg, sb] = rgb.map((value) =>
    toLinearSrgb(clamp(value / 255, 0, 1)),
  ) as [number, number, number];

  const x = (sr * 0.4124564 + sg * 0.3575761 + sb * 0.1804375) * 100;
  const y = (sr * 0.2126729 + sg * 0.7151522 + sb * 0.072175) * 100;
  const z = (sr * 0.0193339 + sg * 0.119192 + sb * 0.9503041) * 100;

  const fx = labPivot(x / LAB_REF_X);
  const fy = labPivot(y / LAB_REF_Y);
  const fz = labPivot(z / LAB_REF_Z);

  const l = 116 * fy - 16;
  const a = 500 * (fx - fy);
  const b = 200 * (fy - fz);

  return [l, a, b];
}

export function featureFromRgb(
  rgb: [number, number, number],
  longSide: number,
): GraphFeature {
  const lab = rgbToLab(rgb);
  const hue = hueDegFromRgb(rgb);

  return {
    rgb,
    lab,
    hue,
    longSide: Math.max(1, Math.round(longSide)),
  };
}
