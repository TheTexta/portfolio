"use client";

import GrailedPlusLiveDemo from "./grailed-plus-live-demo";
import { useTheme } from "@/app/components/theme/theme-provider";

export default function GrailedPlusRecordedComparison() {
  const { darkMode } = useTheme();
  return (
    <figure className="my-10" aria-label="Recorded ONNX result reordering">
      <GrailedPlusLiveDemo
        feature="market-compare"
        parentDarkMode={darkMode}
        darkModeEnabled={darkMode}
        title="Five photographs reorder using recorded ONNX image comparisons"
      />
    </figure>
  );
}
