import type { AnimationFrame, AnimationStage } from "@/lib/animation/timeline";

export const SHOOT_STAGES: readonly AnimationStage[] = [
  { id: "create", label: "Create", durationMs: 4000 },
  { id: "join", label: "Join", durationMs: 4000 },
  { id: "archive", label: "Archive", durationMs: 4000 },
];
export const SHOOT_DURATION = 12000;
export type ShootPose = { reacted: number; joined: number; archived: number };

const ease = (value: number) => 1 - (1 - Math.max(0, Math.min(1, value))) ** 3;

/** Each selectable stage starts at its settled state. The previous hold ends
 * with the change into that state, leaving time to read before the next action. */
export function shootPoseAt(timeMs: number): ShootPose {
  return {
    reacted: ease((timeMs - 2800) / 400),
    joined: ease((timeMs - 3400) / 600),
    archived: ease((timeMs - 7200) / 800),
  };
}

/** Navigation and reset interpolate from the last drawn pose, including when
 * another selection interrupts them. The shared player is the only clock. */
export function createShootRenderer(draw: (pose: ShootPose) => void) {
  let pose = shootPoseAt(0);
  let from = pose;
  let transitionId: number | null = null;
  return (frame: AnimationFrame) => {
    const transition = frame.transition;
    if (transition) {
      if (transition.id !== transitionId) {
        transitionId = transition.id;
        from = { ...pose };
      }
      const target = shootPoseAt(transition.toTimeMs);
      pose = {
        reacted:
          from.reacted + (target.reacted - from.reacted) * transition.progress,
        joined:
          from.joined + (target.joined - from.joined) * transition.progress,
        archived:
          from.archived +
          (target.archived - from.archived) * transition.progress,
      };
    } else {
      transitionId = null;
      pose = shootPoseAt(frame.timeMs);
    }
    draw(pose);
  };
}
