import type { GraphFeature } from "@/lib/photo-graph/types";
import { clamp01 } from "@/lib/photo-graph/feature-extraction";

export const SIGMA_E = 15.0;
export const SIGMA_H = 10.0;
export const W_SIM = 1.0;
export const W_COMP = 0.5;
export const MIN_CORRELATION = 0.3;

function gauss(value: number, sigma: number) {
  return Math.exp(-((value * value) / (sigma * sigma)));
}

function hueDistance(leftHue: number, rightHue: number) {
  const delta = Math.abs(leftHue - rightHue) % 360;
  return delta > 180 ? 360 - delta : delta;
}

function deltaE76(leftLab: [number, number, number], rightLab: [number, number, number]) {
  const dl = leftLab[0] - rightLab[0];
  const da = leftLab[1] - rightLab[1];
  const db = leftLab[2] - rightLab[2];

  return Math.sqrt(dl * dl + da * da + db * db);
}

export function computeCorrelation(
  left: GraphFeature,
  right: GraphFeature,
) {
  const distanceE = deltaE76(left.lab, right.lab);
  const similarity = gauss(distanceE, SIGMA_E);

  const distanceHue = hueDistance(left.hue, right.hue);
  const complement = gauss(distanceHue - 180, SIGMA_H);

  return clamp01(W_SIM * similarity + W_COMP * complement);
}

export function scaleFromLongSide(longSidePx: number, maxLongSidePx: number) {
  const ratio = maxLongSidePx <= 0 ? 1 : clamp01(longSidePx / maxLongSidePx);
  return 0.5 + 0.5 * ratio;
}

export function shouldKeepEdge(correlation: number) {
  return correlation >= MIN_CORRELATION;
}
