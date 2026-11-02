import { describe, expect, it } from "vitest";

import { getProjectHoverTransition } from "@/app/components/projects/project-hover-motion";

describe("shared project-card and write-up hover motion", () => {
  it("keeps the same quick easing and duration", () => {
    expect(getProjectHoverTransition(false)).toEqual({
      duration: 0.28,
      ease: [0.22, 1, 0.36, 1],
    });
  });

  it("removes animated travel when reduced motion is requested", () => {
    expect(getProjectHoverTransition(true)).toEqual({ duration: 0 });
  });
});
