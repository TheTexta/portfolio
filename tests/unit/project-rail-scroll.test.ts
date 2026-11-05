import { describe, expect, it } from "vitest";

import { getRailAutoplayWeight } from "@/app/components/projects/project-rail-scroll";

describe("project rail scroll handoff", () => {
  const animationSpeed = 80;
  const deltaSeconds = 1 / 60;

  it.each([1, -1])(
    "follows fast swipes exactly in direction %s",
    (direction) => {
      const delta = 120 * direction;
      expect(getRailAutoplayWeight(delta, deltaSeconds, animationSpeed)).toBe(
        0,
      );
    },
  );

  it("starts easing at 1.25 times the animation speed", () => {
    expect(getRailAutoplayWeight(100, 1, animationSpeed)).toBe(0);
    expect(getRailAutoplayWeight(90, 1, animationSpeed)).toBe(0.5);
  });

  it.each([80, 60, 0, -60, -80])(
    "fully resumes autoplay when manual velocity is %s px/s",
    (speed) => {
      expect(getRailAutoplayWeight(speed, 1, animationSpeed)).toBe(1);
    },
  );

  it("uses the same takeover threshold for either scroll direction", () => {
    expect(getRailAutoplayWeight(-90, 1, animationSpeed)).toBe(0.5);
    expect(getRailAutoplayWeight(-90, 1, animationSpeed)).toBe(
      getRailAutoplayWeight(90, 1, animationSpeed),
    );
  });

  it("uses velocity rather than event distance to choose the handoff", () => {
    expect(getRailAutoplayWeight(1.8, 0.01, animationSpeed)).toBe(0);
    expect(getRailAutoplayWeight(1.8, 0.02, animationSpeed)).toBeCloseTo(0.5);
  });
});
