import type {
  OklabColor,
  PhotoGraphColorFeatureV1,
  PhotoGraphPaletteEntry,
} from "@/lib/photo-graph/types";

export const PHOTO_GRAPH_COLOR_FEATURE_VERSION = 1 as const;
export const PHOTO_GRAPH_HISTOGRAM_BINS_PER_AXIS = 4;
export const PHOTO_GRAPH_HISTOGRAM_LENGTH =
  PHOTO_GRAPH_HISTOGRAM_BINS_PER_AXIS ** 3;

const MAX_SAMPLES = 65_536;
const PALETTE_SIZE = 6;
const PALETTE_ITERATIONS = 8;
const OKLAB_MIN: OklabColor = [0, -0.4, -0.4];
const OKLAB_MAX: OklabColor = [1, 0.4, 0.4];

type RgbaImageData = {
  data: ArrayLike<number>;
  width: number;
  height: number;
};

type WeightedColor = {
  color: OklabColor;
  weight: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function linearSrgb(channel: number) {
  const normalized = clamp(channel / 255, 0, 1);
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

export function rgbToOklab(rgb: [number, number, number]): OklabColor {
  const red = linearSrgb(rgb[0]);
  const green = linearSrgb(rgb[1]);
  const blue = linearSrgb(rgb[2]);

  const l = 0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue;
  const m = 0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue;
  const s = 0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue;
  const lRoot = Math.cbrt(l);
  const mRoot = Math.cbrt(m);
  const sRoot = Math.cbrt(s);

  return [
    0.2104542553 * lRoot + 0.793617785 * mRoot - 0.0040720468 * sRoot,
    1.9779984951 * lRoot - 2.428592205 * mRoot + 0.4505937099 * sRoot,
    0.0259040371 * lRoot + 0.7827717662 * mRoot - 0.808675766 * sRoot,
  ];
}

export function oklabDistance(left: OklabColor, right: OklabColor) {
  return Math.hypot(
    left[0] - right[0],
    left[1] - right[1],
    left[2] - right[2],
  );
}

function histogramIndex(lIndex: number, aIndex: number, bIndex: number) {
  const bins = PHOTO_GRAPH_HISTOGRAM_BINS_PER_AXIS;
  return lIndex * bins * bins + aIndex * bins + bIndex;
}

function binCenter(index: number): OklabColor {
  const bins = PHOTO_GRAPH_HISTOGRAM_BINS_PER_AXIS;
  const lIndex = Math.floor(index / (bins * bins));
  const aIndex = Math.floor((index % (bins * bins)) / bins);
  const bIndex = index % bins;

  return [
    OKLAB_MIN[0] + (lIndex / (bins - 1)) * (OKLAB_MAX[0] - OKLAB_MIN[0]),
    OKLAB_MIN[1] + (aIndex / (bins - 1)) * (OKLAB_MAX[1] - OKLAB_MIN[1]),
    OKLAB_MIN[2] + (bIndex / (bins - 1)) * (OKLAB_MAX[2] - OKLAB_MIN[2]),
  ];
}

function axisAssignments(value: number, axis: 0 | 1 | 2) {
  const bins = PHOTO_GRAPH_HISTOGRAM_BINS_PER_AXIS;
  const normalized =
    ((clamp(value, OKLAB_MIN[axis], OKLAB_MAX[axis]) - OKLAB_MIN[axis]) /
      (OKLAB_MAX[axis] - OKLAB_MIN[axis])) *
    (bins - 1);
  const lower = Math.floor(normalized);
  const upper = Math.min(bins - 1, lower + 1);
  const upperWeight = normalized - lower;

  return lower === upper
    ? [{ index: lower, weight: 1 }]
    : [
        { index: lower, weight: 1 - upperWeight },
        { index: upper, weight: upperWeight },
      ];
}

function addHistogramSample(
  histogram: number[],
  color: OklabColor,
  sampleWeight: number,
) {
  const lAssignments = axisAssignments(color[0], 0);
  const aAssignments = axisAssignments(color[1], 1);
  const bAssignments = axisAssignments(color[2], 2);

  for (const l of lAssignments) {
    for (const a of aAssignments) {
      for (const b of bAssignments) {
        histogram[histogramIndex(l.index, a.index, b.index)] +=
          sampleWeight * l.weight * a.weight * b.weight;
      }
    }
  }
}

function buildPalette(
  samples: WeightedColor[],
  histogram: number[],
  fallback: OklabColor,
): PhotoGraphPaletteEntry[] {
  const seeds = histogram
    .map((weight, index) => ({ color: binCenter(index), weight }))
    .filter((entry) => entry.weight > 0)
    .sort((left, right) => right.weight - left.weight)
    .slice(0, PALETTE_SIZE)
    .map((entry) => entry.color);

  while (seeds.length < PALETTE_SIZE) {
    seeds.push([...fallback]);
  }

  let centers = seeds;
  let clusterWeights = new Array<number>(PALETTE_SIZE).fill(0);

  for (let iteration = 0; iteration < PALETTE_ITERATIONS; iteration += 1) {
    const sums = Array.from({ length: PALETTE_SIZE }, () => [0, 0, 0]);
    clusterWeights = new Array<number>(PALETTE_SIZE).fill(0);

    for (const sample of samples) {
      let closestIndex = 0;
      let closestDistance = Number.POSITIVE_INFINITY;

      for (let index = 0; index < centers.length; index += 1) {
        const distance = oklabDistance(sample.color, centers[index]);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex = index;
        }
      }

      clusterWeights[closestIndex] += sample.weight;
      sums[closestIndex][0] += sample.color[0] * sample.weight;
      sums[closestIndex][1] += sample.color[1] * sample.weight;
      sums[closestIndex][2] += sample.color[2] * sample.weight;
    }

    centers = centers.map((center, index) => {
      const weight = clusterWeights[index];
      if (weight <= 0) {
        return center;
      }

      return [
        sums[index][0] / weight,
        sums[index][1] / weight,
        sums[index][2] / weight,
      ];
    });
  }

  const totalWeight = clusterWeights.reduce((sum, weight) => sum + weight, 0) || 1;

  return centers
    .map((color, index) => ({
      color,
      weight: clusterWeights[index] / totalWeight,
    }))
    .filter((entry) => entry.weight > 1e-6)
    .sort((left, right) => right.weight - left.weight);
}

export function extractPhotoGraphColorFeatureV1({
  data,
  width,
  height,
}: RgbaImageData): PhotoGraphColorFeatureV1 {
  if (width <= 0 || height <= 0 || data.length < width * height * 4) {
    throw new Error("Invalid RGBA image data for photo graph extraction.");
  }

  const pixelCount = width * height;
  const stride = Math.max(1, Math.ceil(Math.sqrt(pixelCount / MAX_SAMPLES)));
  const histogram = new Array<number>(PHOTO_GRAPH_HISTOGRAM_LENGTH).fill(0);
  const samples: WeightedColor[] = [];
  const mean: OklabColor = [0, 0, 0];
  let totalWeight = 0;

  for (let y = 0; y < height; y += stride) {
    for (let x = 0; x < width; x += stride) {
      const offset = (y * width + x) * 4;
      const alphaWeight = Number(data[offset + 3]) / 255;
      if (alphaWeight <= 0.01) {
        continue;
      }

      const color = rgbToOklab([
        Number(data[offset]),
        Number(data[offset + 1]),
        Number(data[offset + 2]),
      ]);
      samples.push({ color, weight: alphaWeight });
      addHistogramSample(histogram, color, alphaWeight);
      mean[0] += color[0] * alphaWeight;
      mean[1] += color[1] * alphaWeight;
      mean[2] += color[2] * alphaWeight;
      totalWeight += alphaWeight;
    }
  }

  if (totalWeight <= 0) {
    throw new Error("Image contains no visible pixels for color extraction.");
  }

  mean[0] /= totalWeight;
  mean[1] /= totalWeight;
  mean[2] /= totalWeight;

  for (let index = 0; index < histogram.length; index += 1) {
    histogram[index] /= totalWeight;
  }

  return {
    version: PHOTO_GRAPH_COLOR_FEATURE_VERSION,
    sampleCount: samples.length,
    meanOklab: mean,
    histogram,
    palette: buildPalette(samples, histogram, mean),
  };
}

export function photoGraphHistogramVector(feature: PhotoGraphColorFeatureV1) {
  return feature.histogram.map((value) => Math.sqrt(Math.max(0, value)));
}

function finiteTuple(value: unknown): OklabColor | null {
  if (
    !Array.isArray(value) ||
    value.length !== 3 ||
    value.some((entry) => typeof entry !== "number" || !Number.isFinite(entry))
  ) {
    return null;
  }
  return [value[0], value[1], value[2]];
}

export function parsePhotoGraphColorFeatureV1(
  value: unknown,
): PhotoGraphColorFeatureV1 | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const raw = value as Record<string, unknown>;
  const sampleCount = raw.sampleCount;
  const meanOklab = finiteTuple(raw.meanOklab);
  const histogram = raw.histogram;
  const palette = raw.palette;
  if (
    raw.version !== PHOTO_GRAPH_COLOR_FEATURE_VERSION ||
    !Number.isInteger(sampleCount) ||
    (sampleCount as number) < 1 ||
    !meanOklab ||
    !Array.isArray(histogram) ||
    histogram.length !== PHOTO_GRAPH_HISTOGRAM_LENGTH ||
    histogram.some(
      (entry) => typeof entry !== "number" || !Number.isFinite(entry) || entry < 0,
    ) ||
    !Array.isArray(palette) ||
    palette.length < 1 ||
    palette.length > PALETTE_SIZE
  ) {
    return null;
  }
  const histogramTotal = histogram.reduce<number>((sum, entry) => sum + entry, 0);
  if (Math.abs(histogramTotal - 1) > 1e-6) {
    return null;
  }

  const parsedPalette: PhotoGraphPaletteEntry[] = [];
  for (const entry of palette) {
    if (!entry || typeof entry !== "object") {
      return null;
    }
    const rawEntry = entry as Record<string, unknown>;
    const color = finiteTuple(rawEntry.color);
    const weight = rawEntry.weight;
    if (
      !color ||
      typeof weight !== "number" ||
      !Number.isFinite(weight) ||
      weight <= 0
    ) {
      return null;
    }
    parsedPalette.push({ color, weight });
  }
  const paletteTotal = parsedPalette.reduce(
    (sum, entry) => sum + entry.weight,
    0,
  );
  if (Math.abs(paletteTotal - 1) > 1e-6) {
    return null;
  }

  return {
    version: PHOTO_GRAPH_COLOR_FEATURE_VERSION,
    sampleCount: sampleCount as number,
    meanOklab,
    histogram: [...histogram],
    palette: parsedPalette,
  };
}