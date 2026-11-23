import type { AnimationFrame, AnimationStage } from "@/lib/animation/timeline";

export const PALETTE_STAGES: readonly AnimationStage[] = [
  { id: "sample", label: "Sample", durationMs: 2000 },
  { id: "group", label: "Group", durationMs: 2500 },
  { id: "palette", label: "Palette", durationMs: 3000 },
];
export const PALETTE_DURATION = 7500;
export const PALETTE_LAYOUT = {
  width: 672,
  height: 552,
  photo: { x: 72, y: 12, width: 528, height: 352 },
  swatches: { x: 56, y: 464, width: 560, height: 32, size: 80, step: 120 },
} as const;

/** Equal-size navigation swatches retain production selection order. */
export function paletteSwatchLayout(count: number) {
  if (!Number.isInteger(count) || count < 1 || count > 5)
    throw new Error("A palette must contain one to five swatches.");
  const { swatches, width } = PALETTE_LAYOUT;
  const rowWidth = swatches.size + (count - 1) * swatches.step;
  return { ...swatches, x: (width - rowWidth) / 2, width: rowWidth };
}

type SceneRecording = {
  analysis: {
    sampleWidth: number;
    sampleHeight: number;
    displayedSampleStride: number;
  };
  palette: { hex: string }[];
  tiles: { x: number; y: number; hex: string; group: number }[];
};

/** Pure geometry shared by the canvas and variable-count layout regressions. */
export function layoutPaletteScene(recording: SceneRecording) {
  const { photo } = PALETTE_LAYOUT;
  const swatches = paletteSwatchLayout(recording.palette.length);
  const {
    sampleWidth,
    sampleHeight,
    displayedSampleStride: stride,
  } = recording.analysis;
  const rgb = (hex: string) =>
    [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
  const counts = recording.palette.map(
    (_, group) => recording.tiles.filter((tile) => tile.group === group).length,
  );
  const slots = recording.palette.map(() => 0);
  const tiles = recording.tiles.map((tile) => {
    const count = counts[tile.group];
    const slot = slots[tile.group]++;
    // Fit even a one-colour image's entire display sample below the photograph.
    const columns = Math.ceil(Math.sqrt((count * swatches.size) / 112));
    const rows = Math.ceil(count / columns);
    const spacing = Math.min(
      7,
      (swatches.size - 6) / Math.max(1, columns - 1),
      106 / Math.max(1, rows - 1),
    );
    const paletteX =
      swatches.x + tile.group * swatches.step + swatches.size / 2;
    const paletteY = swatches.y + swatches.height / 2;
    const sourceWidth =
      (Math.min(stride, sampleWidth - tile.x) / sampleWidth) * photo.width;
    const sourceHeight =
      (Math.min(stride, sampleHeight - tile.y) / sampleHeight) * photo.height;
    return {
      ...tile,
      rgb: rgb(tile.hex),
      targetRgb: rgb(recording.palette[tile.group].hex),
      sourceX: photo.x + (tile.x / sampleWidth) * photo.width + sourceWidth / 2,
      sourceY:
        photo.y + (tile.y / sampleHeight) * photo.height + sourceHeight / 2,
      sourceWidth,
      sourceHeight,
      groupX: paletteX + ((slot % columns) - (columns - 1) / 2) * spacing,
      groupY:
        paletteY + (Math.floor(slot / columns) - (rows - 1) / 2) * spacing,
      groupSize: Math.min(5, spacing * 0.8),
      paletteX,
      paletteY,
    };
  });
  return { swatches, tiles };
}

export type PalettePose = { sample: number; group: number; palette: number };
type PaletteTile = ReturnType<typeof layoutPaletteScene>["tiles"][number];
const mix = (from: number, to: number, amount: number) =>
  from + (to - from) * amount;

/** Sample and moving frames share the same clipped rectangle, including its
 * geometric centre (which need not be the sampled pixel's location). */
export function paletteTileRectAt(tile: PaletteTile, pose: PalettePose) {
  const x = mix(
    mix(tile.sourceX, tile.groupX, pose.group),
    tile.paletteX,
    pose.palette,
  );
  const y = mix(
    mix(tile.sourceY, tile.groupY, pose.group),
    tile.paletteY,
    pose.palette,
  );
  const width = mix(
    mix(tile.sourceWidth, tile.groupSize, pose.group),
    2,
    pose.palette,
  );
  const height = mix(
    mix(tile.sourceHeight, tile.groupSize, pose.group),
    2,
    pose.palette,
  );
  return { x: x - width / 2, y: y - height / 2, width, height };
}

const ease = (value: number) => 1 - (1 - Math.max(0, Math.min(1, value))) ** 3;
const anchors: Record<string, PalettePose> = {
  sample: { sample: 1, group: 0, palette: 0 },
  group: { sample: 1, group: 1, palette: 0 },
  palette: { sample: 1, group: 1, palette: 1 },
};

export function palettePoseAt(timeMs: number): PalettePose {
  return {
    sample: ease(timeMs / 850),
    group: ease((timeMs - 2000) / 1800),
    palette: ease((timeMs - 4500) / 700),
  };
}

/** The shared clock owns all timing. Capture actual poses, not raw timestamps,
 * so interrupted selections/reset never jump through a static timeline hold. */
export function createPaletteRenderer(draw: (pose: PalettePose) => void) {
  let pose = palettePoseAt(PALETTE_DURATION);
  let from = pose;
  let transitionId: number | null = null;
  let selectedStage: string | null = null;
  return (frame: AnimationFrame) => {
    const transition = frame.transition;
    if (transition) {
      if (transition.id !== transitionId) {
        transitionId = transition.id;
        from = { ...pose };
        selectedStage = transition.kind === "seek" ? frame.stage.id : null;
      }
      const target = selectedStage
        ? anchors[selectedStage]
        : palettePoseAt(transition.toTimeMs);
      pose = {
        sample:
          from.sample + (target.sample - from.sample) * transition.progress,
        group: from.group + (target.group - from.group) * transition.progress,
        palette:
          from.palette + (target.palette - from.palette) * transition.progress,
      };
    } else {
      transitionId = null;
      if (selectedStage !== frame.stage.id) selectedStage = null;
      // A selected stage shows its settled pose, including while paused. Hold
      // it until the next stage so autoplay cannot briefly undo the selection.
      pose = selectedStage
        ? { ...anchors[selectedStage] }
        : palettePoseAt(frame.timeMs);
    }
    draw(pose);
  };
}
