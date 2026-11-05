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
export type PalettePose = { sample: number; group: number; palette: number };
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
