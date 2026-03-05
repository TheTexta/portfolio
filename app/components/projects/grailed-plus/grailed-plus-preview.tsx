"use client";
import Image from "next/image";
import { useState } from "react";
import { getProjectChrome } from "@/app/components/projects/project-chrome";
import { useTheme } from "@/app/components/theme/theme-provider";

type GrailedPlusPreviewProps = {
  forcedDarkMode?: boolean;
};

const SCREENSHOTS = [
  {
    src: "/projects/grailed-plus/screenshots/pricing.webp",
    alt: "Grailed Plus pricing insights panel on a listing",
  },
  {
    src: "/projects/grailed-plus/screenshots/currency.webp",
    alt: "Grailed Plus currency conversion details on a listing",
  },
  {
    src: "/projects/grailed-plus/screenshots/theme.webp",
    alt: "Grailed Plus dark mode theme controls",
  },
];

export default function GrailedPlusPreview({
  forcedDarkMode,
}: GrailedPlusPreviewProps) {
  const { darkMode: siteDarkMode } = useTheme();
  const darkMode = forcedDarkMode ?? siteDarkMode;
  const chrome = getProjectChrome("grailed-plus", darkMode);
  const [activeIndex, setActiveIndex] = useState(0);
  const activeScreenshot = SCREENSHOTS[activeIndex];

  const handlePrevious = () => {
    setActiveIndex((current) =>
      current === 0 ? SCREENSHOTS.length - 1 : current - 1,
    );
  };

  const handleNext = () => {
    setActiveIndex((current) =>
      current === SCREENSHOTS.length - 1 ? 0 : current + 1,
    );
  };

  return (
    <div
      className={`relative w-full h-full overflow-hidden  ${chrome.surface ?? (darkMode ? " bg-black/30" : " bg-white/85")}`}
    >
      <Image
        src={activeScreenshot.src}
        alt={activeScreenshot.alt}
        fill
        className="object-cover"
        sizes="(min-width: 1024px) 960px, (min-width: 768px) 80vw, 100vw"
        priority
      />

      <button
        type="button"
        onClick={handlePrevious}
        aria-label="Previous screenshot"
        className={`absolute left-3 top-1/2 -translate-y-1/2 rounded-full border px-3 py-2 text-base font-semibold transition-colors md:left-4 ${chrome.button ?? (darkMode ? "border-white/15 bg-black/55 text-white hover:bg-black/70" : "border-black/10 bg-white/85 text-neutral-950 hover:bg-white")}`}
      >
        ←
      </button>
      <button
        type="button"
        onClick={handleNext}
        aria-label="Next screenshot"
        className={`absolute right-3 top-1/2 -translate-y-1/2 rounded-full border px-3 py-2 text-base font-semibold transition-colors md:right-4 ${chrome.button ?? (darkMode ? "border-white/15 bg-black/55 text-white hover:bg-black/70" : "border-black/10 bg-white/85 text-neutral-950 hover:bg-white")}`}
      >
        →
      </button>
    </div>
  );
}
