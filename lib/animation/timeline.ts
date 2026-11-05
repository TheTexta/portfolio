export type AnimationStage = { id: string; label: string; durationMs: number };
export type AnimationTransition = {
  id: number;
  kind: "seek" | "reset";
  toTimeMs: number;
  progress: number;
};
export type AnimationFrame = {
  timeMs: number;
  durationMs: number;
  stage: AnimationStage;
  stageProgress: number;
  progress: number;
  playing: boolean;
  seeking: boolean;
  reducedMotion: boolean;
  cycle: number;
  transition: AnimationTransition | null;
};

type Scheduler = {
  now: () => number;
  request: (callback: (now: number) => void) => number;
  cancel: (id: number) => void;
};

/** One clock for both scene and controls. Active gates elapsed time, not intent
 * to play; a user pause survives visibility and preference changes. */
export function createAnimationTimeline(
  stages: readonly AnimationStage[],
  onFrame: (frame: AnimationFrame) => void,
  scheduler: Scheduler = {
    now: () => performance.now(),
    request: (callback) => requestAnimationFrame(callback),
    cancel: (id) => cancelAnimationFrame(id),
  },
) {
  if (
    !stages.length ||
    stages.some((s) => !Number.isFinite(s.durationMs) || s.durationMs <= 0) ||
    new Set(stages.map((s) => s.id)).size !== stages.length
  ) {
    throw new Error(
      "Animation stages need unique IDs and positive finite durations.",
    );
  }
  const durationMs = stages.reduce((sum, s) => sum + s.durationMs, 0);
  const points = stages.map((_, index) =>
    stages.slice(0, index).reduce((sum, s) => sum + s.durationMs, 0),
  );
  let timeMs = 0;
  let cycle = 0;
  let active = false;
  let paused = false;
  let reducedMotion = false;
  let destroyed = false;
  let request: number | undefined;
  let previous: number | null = null;
  let transitionId = 0;
  let transition: AnimationTransition | null = null;
  let seek: {
    from: number;
    to: number;
    elapsed: number;
    id: number;
    kind: "seek" | "reset";
    whilePaused: boolean;
  } | null = null;

  function getFrame(): AnimationFrame {
    let start = 0;
    const stageTime = transition?.toTimeMs ?? timeMs;
    const stage = stages.find((s, index) => {
      if (stageTime < start + s.durationMs || index === stages.length - 1)
        return true;
      start += s.durationMs;
      return false;
    })!;
    return {
      timeMs,
      durationMs,
      stage,
      stageProgress: Math.min(
        1,
        Math.max(0, (stageTime - start) / stage.durationMs),
      ),
      progress: timeMs / durationMs,
      playing: !paused && !reducedMotion,
      seeking: !!seek,
      reducedMotion,
      cycle,
      transition,
    };
  }
  const emit = () => {
    if (!destroyed) onFrame(getFrame());
  };
  function stop() {
    if (request !== undefined) scheduler.cancel(request);
    request = undefined;
    previous = null;
  }
  function schedule() {
    if (
      destroyed ||
      !active ||
      reducedMotion ||
      (paused && !seek?.whilePaused)
    ) {
      previous = null;
      return;
    }
    if (request !== undefined) return;
    if (previous === null) previous = scheduler.now();
    request = scheduler.request(tick);
  }
  function tick(now: number) {
    request = undefined;
    if (destroyed) return;
    const delta = previous === null ? 0 : Math.max(0, now - previous);
    previous = now;
    transition = null;
    if (seek) {
      seek.elapsed = Math.min(450, seek.elapsed + delta);
      const progress = 1 - Math.pow(1 - seek.elapsed / 450, 3);
      timeMs = seek.from + (seek.to - seek.from) * progress;
      transition = {
        id: seek.id,
        kind: seek.kind,
        toTimeMs: seek.to,
        progress,
      };
      if (seek.elapsed === 450) {
        if (seek.kind === "reset") cycle += 1;
        seek = null;
      }
    } else if (!paused && !reducedMotion) {
      const next = timeMs + delta;
      timeMs = Math.min(durationMs, next);
      if (next >= durationMs) {
        seek = {
          from: durationMs,
          to: 0,
          elapsed: 0,
          id: ++transitionId,
          kind: "reset",
          whilePaused: false,
        };
        transition = { id: seek.id, kind: "reset", toTimeMs: 0, progress: 0 };
      }
    }
    emit();
    schedule();
  }
  return {
    getFrame,
    setActive(value: boolean) {
      active = value;
      if (!active) stop();
      emit();
      schedule();
    },
    setReducedMotion(value: boolean) {
      reducedMotion = value;
      if (value) {
        stop();
        seek = null;
        transition = null;
        timeMs = durationMs;
      }
      emit();
      schedule();
    },
    toggle() {
      if (reducedMotion || destroyed) return;
      paused = !paused;
      if (paused) {
        stop();
      } else if (seek) seek.whilePaused = false;
      emit();
      schedule();
    },
    seek(target: number) {
      if (!Number.isFinite(target) || destroyed) return;
      const to = points.reduce(
        (nearest, point) =>
          Math.abs(point - target) < Math.abs(nearest - target)
            ? point
            : nearest,
        points[0],
      );
      if (reducedMotion || !active) {
        timeMs = to;
        seek = null;
        transition = {
          id: ++transitionId,
          kind: "seek",
          toTimeMs: to,
          progress: 1,
        };
      } else {
        seek = {
          from: timeMs,
          to,
          elapsed: 0,
          id: ++transitionId,
          kind: "seek",
          whilePaused: paused,
        };
        transition = { id: seek.id, kind: "seek", toTimeMs: to, progress: 0 };
      }
      emit();
      schedule();
    },
    destroy() {
      destroyed = true;
      stop();
      seek = null;
      transition = null;
    },
  };
}
