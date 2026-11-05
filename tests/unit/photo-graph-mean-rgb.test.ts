import { describe, expect, it } from "vitest";
import { measureMeanRgb } from "@/lib/photo-graph/mean-rgb";
import { rgbToLab } from "@/lib/photo-graph/feature-extraction";

describe("shared upload mean RGB measurement", () => {
  it("averages opaque channels before the nonlinear LAB conversion", () => {
    const measured = measureMeanRgb({ data: [0, 0, 255, 255, 255, 0, 0, 255] });
    expect(measured).toEqual({
      rgb: [127.5, 0, 127.5],
      sums: [255, 0, 255],
      weightSum: 2,
    });
    const labOfMean = rgbToLab(measured.rgb);
    const meanOfLab = rgbToLab([0, 0, 255]).map(
      (value, index) => (value + rgbToLab([255, 0, 0])[index]) / 2,
    );
    expect(labOfMean).not.toEqual(meanOfLab);
  });
  it("uses every nonzero opacity proportionally and excludes transparent pixels", () => {
    const measured = measureMeanRgb({
      data: [100, 40, 10, 255, 200, 20, 40, 128, 255, 255, 255, 0],
    });
    const weight = 128 / 255;
    expect(measured.weightSum).toBe(1 + weight);
    expect(measured.rgb).toEqual([
      (100 + 200 * weight) / (1 + weight),
      (40 + 20 * weight) / (1 + weight),
      (10 + 40 * weight) / (1 + weight),
    ]);
  });
  it("preserves the upload fallback for a fully transparent raster", () => {
    expect(measureMeanRgb({ data: [255, 100, 10, 0] })).toEqual({
      rgb: [0, 0, 0],
      sums: [0, 0, 0],
      weightSum: 0,
    });
  });
});
