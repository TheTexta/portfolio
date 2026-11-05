import { describe, expect, it } from "vitest";
import type { AnimationFrame } from "@/lib/animation/timeline";
import {
  createShootRenderer,
  SHOOT_DURATION,
  SHOOT_STAGES,
  shootPoseAt,
  type ShootPose,
} from "@/lib/discord-shoot-manager/lifecycle";

function frame(
  timeMs: number,
  transition: AnimationFrame["transition"] = null,
): AnimationFrame {
  return {
    timeMs,
    durationMs: SHOOT_DURATION,
    progress: timeMs / SHOOT_DURATION,
    stage: SHOOT_STAGES[0],
    stageProgress: 0,
    cycle: 0,
    playing: true,
    seeking: transition !== null,
    reducedMotion: false,
    transition,
  };
}

describe("illustrated shoot lifecycle", () => {
  it("has three readable stages and settled selectable states", () => {
    expect(SHOOT_STAGES.map(({ id }) => id)).toEqual([
      "create",
      "join",
      "archive",
    ]);
    expect(
      SHOOT_STAGES.reduce((total, stage) => total + stage.durationMs, 0),
    ).toBe(SHOOT_DURATION);
    expect(shootPoseAt(0)).toEqual({ reacted: 0, joined: 0, archived: 0 });
    expect(shootPoseAt(4000)).toEqual({ reacted: 1, joined: 1, archived: 0 });
    expect(shootPoseAt(8000)).toEqual({ reacted: 1, joined: 1, archived: 1 });
    expect(shootPoseAt(SHOOT_DURATION)).toEqual(shootPoseAt(8000));
  });

  it("shows the reaction before granting access and archives only after joining", () => {
    expect(shootPoseAt(3000).reacted).toBeGreaterThan(0);
    expect(shootPoseAt(3000).joined).toBe(0);
    expect(shootPoseAt(3600).joined).toBeGreaterThan(0);
    expect(shootPoseAt(3600).joined).toBeLessThan(1);
    expect(shootPoseAt(7600).archived).toBeGreaterThan(0);
    expect(shootPoseAt(7600).archived).toBeLessThan(1);
    for (let time = -1000; time <= 14000; time += 100) {
      const { reacted, joined, archived } = shootPoseAt(time);
      expect(reacted).toBeGreaterThanOrEqual(joined);
      expect(joined).toBeGreaterThanOrEqual(archived);
      for (const value of [reacted, joined, archived]) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
    }
  });

  it("seeks and resets from the last rendered pose, including interrupted transitions", () => {
    const poses: ShootPose[] = [];
    const render = createShootRenderer((pose) => poses.push(pose));
    render(frame(0));
    render(frame(4000, { id: 1, kind: "seek", toTimeMs: 8000, progress: 0.5 }));
    expect(poses.at(-1)).toEqual({ reacted: 0.5, joined: 0.5, archived: 0.5 });
    render(frame(2000, { id: 2, kind: "seek", toTimeMs: 0, progress: 0 }));
    expect(poses.at(-1)).toEqual(poses.at(-2));
    render(frame(1000, { id: 2, kind: "seek", toTimeMs: 0, progress: 0.5 }));
    expect(poses.at(-1)).toEqual({
      reacted: 0.25,
      joined: 0.25,
      archived: 0.25,
    });
    render(frame(8000));
    render(frame(6000, { id: 3, kind: "reset", toTimeMs: 0, progress: 0.5 }));
    expect(poses.at(-1)).toEqual({ reacted: 0.5, joined: 0.5, archived: 0.5 });
    render(frame(0, { id: 3, kind: "reset", toTimeMs: 0, progress: 1 }));
    expect(poses.at(-1)).toEqual(shootPoseAt(0));
  });

  it("can render the reduced-motion completion immediately without an independent timer", () => {
    const poses: ShootPose[] = [];
    const render = createShootRenderer((pose) => poses.push(pose));
    render({ ...frame(SHOOT_DURATION), reducedMotion: true, playing: false });
    expect(poses).toEqual([{ reacted: 1, joined: 1, archived: 1 }]);
  });
});
