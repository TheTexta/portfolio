import { describe, expect, it } from "vitest";
import {
  createAnimationTimeline,
  type AnimationFrame,
} from "@/lib/animation/timeline";

const stages = [
  { id: "analysis", label: "Analysis", durationMs: 1800 },
  { id: "reordering", label: "Reordering", durationMs: 600 },
  { id: "complete", label: "Complete", durationMs: 2000 },
];
function fixture() {
  let now = 0;
  let id = 0;
  const pending = new Map<number, (time: number) => void>();
  const frames: AnimationFrame[] = [];
  const timeline = createAnimationTimeline(
    stages,
    (frame) => frames.push(frame),
    {
      now: () => now,
      request: (callback) => {
        pending.set(++id, callback);
        return id;
      },
      cancel: (key) => {
        pending.delete(key);
      },
    },
  );
  return {
    timeline,
    pending,
    frames,
    step(ms: number) {
      now += ms;
      const callbacks = [...pending.values()];
      pending.clear();
      callbacks.forEach((callback) => callback(now));
    },
  };
}

describe("shared animation timeline", () => {
  it("never lands manual selection between its three stage anchors", () => {
    const { timeline } = fixture();
    timeline.setReducedMotion(true);
    for (const [input, target] of [
      [100, 0],
      [1000, 1800],
      [2100, 1800],
      [2200, 2400],
      [4400, 2400],
    ]) {
      timeline.seek(input);
      expect(timeline.getFrame().timeMs).toBe(target);
    }
  });
  it("freezes and resumes a smooth reset without losing user pause", () => {
    const { timeline, step } = fixture();
    timeline.setActive(true);
    step(4400);
    step(100);
    timeline.toggle();
    const frozen = timeline.getFrame();
    step(1000);
    timeline.setActive(false);
    timeline.setActive(true);
    step(1000);
    expect(timeline.getFrame()).toEqual(frozen);
    timeline.toggle();
    step(350);
    expect(timeline.getFrame()).toMatchObject({
      timeMs: 0,
      cycle: 1,
      seeking: false,
    });
  });
  it("pauses an in-flight selection, but still permits a new selection while paused", () => {
    const { timeline, step } = fixture();
    timeline.setActive(true);
    timeline.seek(2400);
    step(100);
    timeline.toggle();
    const frozen = timeline.getFrame();
    step(1000);
    expect(timeline.getFrame()).toEqual(frozen);
    timeline.seek(0);
    step(450);
    expect(timeline.getFrame()).toMatchObject({
      timeMs: 0,
      playing: false,
      seeking: false,
    });
  });
  it("can pause again after resuming a selection that started while paused", () => {
    const { timeline, step, pending } = fixture();
    timeline.setActive(true);
    timeline.toggle();
    timeline.seek(2400);
    step(100);
    timeline.toggle();
    step(100);
    timeline.toggle();
    const frozen = timeline.getFrame();
    step(1000);
    expect(timeline.getFrame()).toEqual(frozen);
    expect(pending.size).toBe(0);
    timeline.toggle();
    step(250);
    expect(timeline.getFrame()).toMatchObject({
      timeMs: 2400,
      playing: true,
      seeking: false,
    });
  });
  it("does not count idle time between separate paused seeks", () => {
    const { timeline, step } = fixture();
    timeline.setActive(true);
    timeline.toggle();
    timeline.seek(3000);
    step(450);
    step(2000);
    timeline.seek(1000);
    step(225);
    expect(timeline.getFrame()).toMatchObject({
      timeMs: 1875,
      seeking: true,
      playing: false,
    });
    step(225);
    expect(timeline.getFrame()).toMatchObject({ timeMs: 1800, seeking: false });
  });
  it("uses one continuous clock for three duration-weighted phases and multiple loops", () => {
    const { timeline, step } = fixture();
    timeline.setActive(true);
    step(900);
    expect(timeline.getFrame()).toMatchObject({
      timeMs: 900,
      stageProgress: 0.5,
      stage: { id: "analysis" },
    });
    step(1200);
    expect(timeline.getFrame()).toMatchObject({
      timeMs: 2100,
      stageProgress: 0.5,
      stage: { id: "reordering" },
    });
    step(1300);
    expect(timeline.getFrame()).toMatchObject({
      timeMs: 3400,
      stageProgress: 0.5,
      stage: { id: "complete" },
    });
    step(1200);
    expect(timeline.getFrame()).toMatchObject({
      timeMs: 4400,
      cycle: 0,
      stage: { id: "analysis" },
      transition: { kind: "reset", progress: 0, toTimeMs: 0 },
    });
    step(225);
    expect(timeline.getFrame()).toMatchObject({
      timeMs: 550,
      cycle: 0,
      transition: { progress: 0.875 },
    });
    step(225);
    expect(timeline.getFrame()).toMatchObject({ timeMs: 0, cycle: 1 });
    for (let index = 0; index < 2; index++) {
      step(4400);
      step(450);
    }
    expect(timeline.getFrame()).toMatchObject({ timeMs: 0, cycle: 3 });
  });
  it("freezes offscreen/hidden time and preserves a user's explicit pause", () => {
    const { timeline, step, pending } = fixture();
    timeline.setActive(true);
    step(700);
    timeline.setActive(false);
    step(10_000);
    expect(timeline.getFrame().timeMs).toBe(700);
    expect(pending.size).toBe(0);
    timeline.setActive(true);
    step(100);
    expect(timeline.getFrame().timeMs).toBe(800);
    timeline.toggle();
    timeline.setActive(false);
    timeline.setActive(true);
    step(1000);
    expect(timeline.getFrame()).toMatchObject({ timeMs: 800, playing: false });
    timeline.toggle();
    step(100);
    expect(timeline.getFrame().timeMs).toBe(900);
  });
  it("snaps to the nearest stage, transitions smoothly, and resumes from that stage", () => {
    const { timeline, step } = fixture();
    timeline.setActive(true);
    timeline.seek(3000);
    step(225);
    expect(timeline.getFrame()).toMatchObject({
      timeMs: 2100,
      seeking: true,
      stage: { id: "complete" },
      transition: { toTimeMs: 2400, progress: 0.875 },
    });
    timeline.seek(1000);
    step(450);
    expect(timeline.getFrame()).toMatchObject({ timeMs: 1800, seeking: false });
    step(100);
    expect(timeline.getFrame().timeMs).toBe(1900);
    timeline.toggle();
    timeline.seek(2100);
    step(450);
    step(1000);
    expect(timeline.getFrame()).toMatchObject({
      timeMs: 1800,
      playing: false,
      stage: { id: "reordering" },
    });
  });
  it("pauses a seek when hidden and resumes its remaining duration rather than jumping", () => {
    const { timeline, step } = fixture();
    timeline.setActive(true);
    timeline.seek(3000);
    step(100);
    const before = timeline.getFrame().timeMs;
    timeline.setActive(false);
    step(5000);
    expect(timeline.getFrame().timeMs).toBe(before);
    timeline.setActive(true);
    step(350);
    expect(timeline.getFrame().timeMs).toBe(2400);
  });
  it("shows the final state for reduced motion and supports immediate manual inspection", () => {
    const { timeline, step, pending } = fixture();
    timeline.setActive(true);
    timeline.seek(2000);
    step(100);
    timeline.setReducedMotion(true);
    step(10_000);
    expect(timeline.getFrame()).toMatchObject({
      timeMs: 4400,
      playing: false,
      seeking: false,
      stage: { id: "complete" },
    });
    expect(pending.size).toBe(0);
    timeline.seek(600);
    expect(timeline.getFrame().timeMs).toBe(0);
    timeline.setReducedMotion(false);
    step(100);
    expect(timeline.getFrame().timeMs).toBe(100);
  });
  it("clamps seeks, rejects invalid stages, and cancels all work on disposal", () => {
    const { timeline, step, pending, frames } = fixture();
    timeline.seek(Infinity);
    expect(timeline.getFrame().timeMs).toBe(0);
    timeline.seek(9000);
    expect(timeline.getFrame().timeMs).toBe(2400);
    timeline.seek(-1);
    expect(timeline.getFrame().timeMs).toBe(0);
    timeline.setActive(true);
    timeline.seek(3000);
    timeline.destroy();
    const count = frames.length;
    step(10_000);
    timeline.setActive(true);
    timeline.seek(10);
    expect(frames.length).toBe(count);
    expect(pending.size).toBe(0);
    expect(() => createAnimationTimeline([], () => {})).toThrow();
    expect(() =>
      createAnimationTimeline(
        [{ id: "x", label: "X", durationMs: 0 }],
        () => {},
      ),
    ).toThrow();
    expect(() =>
      createAnimationTimeline([stages[0], stages[0]], () => {}),
    ).toThrow();
  });
});
