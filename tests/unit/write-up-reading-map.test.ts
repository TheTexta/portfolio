import { describe, expect, it } from "vitest";

import {
  getReadingWindow,
  getSectionScales,
  overlapsReadingWindow,
} from "@/lib/mdx/write-up-reading-map";

const points = [
  { documentY: 0, railY: 0 },
  { documentY: 100, railY: 100 },
  { documentY: 900, railY: 200 },
  { documentY: 1000, railY: 400 },
];

describe("reading-window marker overlap", () => {
  const visible = { top: 100, height: 50 };

  it("includes entry/exit contact and partial overlaps, not only the marker centre", () => {
    expect(overlapsReadingWindow(visible, { top: 150, bottom: 153 })).toBe(
      true,
    );
    expect(overlapsReadingWindow(visible, { top: 98, bottom: 101 })).toBe(true);
    expect(overlapsReadingWindow(visible, { top: 120, bottom: 123 })).toBe(
      true,
    );
  });

  it("excludes markers before/after the segment and an unmeasured window", () => {
    expect(overlapsReadingWindow(visible, { top: 96, bottom: 99 })).toBe(false);
    expect(overlapsReadingWindow(visible, { top: 151, bottom: 154 })).toBe(
      false,
    );
    expect(
      overlapsReadingWindow({ top: 100, height: 0 }, { top: 100, bottom: 103 }),
    ).toBe(false);
  });

  it("can cover several markers simultaneously", () => {
    const markers = [
      { top: 90, bottom: 93 },
      { top: 110, bottom: 113 },
      { top: 140, bottom: 143 },
    ];
    expect(
      markers.map((marker) => overlapsReadingWindow(visible, marker)),
    ).toEqual([false, true, true]);
  });
});

describe("write-up reading map", () => {
  it("maps the visible range through measured markers, not a single page percentage", () => {
    expect(getReadingWindow(points, 100, 500, 400)).toEqual({
      top: 100,
      height: 50,
    });
  });

  it("aligns the viewport exactly with section markers", () => {
    expect(getReadingWindow(points, 100, 900, 400)).toEqual({
      top: 100,
      height: 100,
    });
  });

  it("grows and shrinks for equally tall viewports across different section densities", () => {
    const introductory = getReadingWindow(points, 0, 50, 400);
    const longSection = getReadingWindow(points, 200, 250, 400);
    const shortSection = getReadingWindow(points, 900, 950, 400);

    expect(introductory.height).toBe(50);
    expect(longSection.height).toBe(10);
    expect(shortSection.height).toBe(100);
  });

  it("clamps above and below the article", () => {
    expect(getReadingWindow(points, -500, 2000, 400)).toEqual({
      top: 0,
      height: 400,
    });
  });

  it("keeps a small visible indicator inside the rail after the article ends", () => {
    expect(getReadingWindow(points, 1500, 2000, 400)).toEqual({
      top: 390,
      height: 10,
    });
  });

  it("does not overflow a rail shorter than the minimum indicator", () => {
    expect(
      getReadingWindow(
        [
          { documentY: 0, railY: 0 },
          { documentY: 100, railY: 4 },
        ],
        100,
        200,
        4,
      ),
    ).toEqual({ top: 0, height: 4 });
  });

  it("ignores coincident or out-of-order markers during layout changes", () => {
    expect(
      getReadingWindow(
        [
          { documentY: 0, railY: 0 },
          { documentY: 0, railY: 10 },
          { documentY: 100, railY: 50 },
          { documentY: 90, railY: 75 },
          { documentY: 200, railY: 100 },
        ],
        100,
        200,
        100,
      ),
    ).toEqual({ top: 50, height: 50 });
  });

  it("has no indicator until a usable layout exists", () => {
    expect(getReadingWindow([], 0, 900, 400)).toEqual({ top: 0, height: 0 });
    expect(getReadingWindow(points, 0, 900, 0)).toEqual({ top: 0, height: 0 });
  });
});

describe("content-only section scaling", () => {
  it("uses the content bounds and a separate introduction spacer", () => {
    expect(getSectionScales([1100, 1400], 1000, 2000)).toEqual({
      intro: 10,
      sections: [30, 60],
    });
  });

  it("does not change when the title/header above the content grows", () => {
    expect(getSectionScales([1600, 1900], 1500, 2500)).toEqual(
      getSectionScales([1100, 1400], 1000, 2000),
    );
  });

  it("does not add an introduction spacer for a gap of 50px or less", () => {
    expect(getSectionScales([1050, 1400], 1000, 2000)).toEqual({
      intro: 0,
      sections: [35, 60],
    });
  });

  it("handles content without sections or a usable height", () => {
    expect(getSectionScales([], 1000, 2000)).toEqual({
      intro: 0,
      sections: [],
    });
    expect(getSectionScales([1000], 1000, 1000)).toEqual({
      intro: 0,
      sections: [0],
    });
  });
});
