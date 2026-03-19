"use client";

import { cva } from "class-variance-authority";
import { ArrowLeft, ArrowLeftRight, ArrowRight } from "lucide-react";
import Image from "next/image";
import type { StaticImageData } from "next/image";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { getProjectChrome } from "@/app/components/projects/project-chrome";
import { useTheme } from "@/app/components/theme/theme-provider";
import { OverlayControlButton } from "@/app/components/ui/overlay-control-button";
import { cn } from "@/lib/cn";
import afterCustomCurrency from "./after-custom-currency.png";
import afterDm from "./after-dm.png";
import afterPriceTrend from "./after-price-trend.png";
import beforeCustomCurrency from "./before-custom-currency.png";
import beforeDm from "./before-dm.png";
import beforePriceTrend from "./before-price-trend.png";

type GrailedPlusPreviewProps = {
  forcedDarkMode?: boolean;
};

type ComparePage = {
  id: "dm" | "custom-currency" | "price-trend";
  label: string;
  before: StaticImageData;
  after: StaticImageData;
  beforeAlt: string;
  afterAlt: string;
};

const COMPARE_PAGES: ComparePage[] = [
  {
    id: "dm",
    label: "DARK MODE",
    before: beforeDm,
    after: afterDm,
    beforeAlt:
      "Grailed listing page before Grailed Plus dark mode and enhancements",
    afterAlt:
      "Grailed listing page after Grailed Plus dark mode and enhancements",
  },
  {
    id: "price-trend",
    label: "Price Insights",
    before: beforePriceTrend,
    after: afterPriceTrend,
    beforeAlt:
      "Grailed listing page before Grailed Plus price trend and seller metadata enhancements",
    afterAlt:
      "Grailed listing page after Grailed Plus price trend and seller metadata enhancements",
  },
  {
    id: "custom-currency",
    label: "Custom Currency",
    before: beforeCustomCurrency,
    after: afterCustomCurrency,
    beforeAlt:
      "Grailed browse page before Grailed Plus custom currency enhancements",
    afterAlt:
      "Grailed browse page after Grailed Plus custom currency enhancements",
  },
];

const IMAGE_SIZES = "(min-width: 1024px) 960px, (min-width: 768px) 80vw, 100vw";
const GRAILED_PREVIEW_IMAGE_QUALITY = 75;
const GRAILED_OVERLAY_MONO_FILTER = "grayscale(1) brightness(1.35)";

const grailedPreviewShell = cva("relative h-full w-full overflow-hidden");

function clampSplit(value: number) {
  return Math.min(100, Math.max(0, Math.round(value)));
}

export default function GrailedPlusPreview({
  forcedDarkMode,
}: GrailedPlusPreviewProps) {
  const { darkMode: siteDarkMode } = useTheme();
  const darkMode = forcedDarkMode ?? siteDarkMode;
  const chrome = getProjectChrome("grailed-plus", darkMode);
  const [activeIndex, setActiveIndex] = useState(0);
  const [splitPercent, setSplitPercent] = useState(50);
  const [draggingPointerId, setDraggingPointerId] = useState<number | null>(
    null,
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const activePage = COMPARE_PAGES[activeIndex];
  const controlToneClass = chrome.controls.icon;

  const updateSplitFromClientX = (clientX: number) => {
    const bounds = rootRef.current?.getBoundingClientRect();
    if (!bounds || bounds.width === 0) {
      return;
    }

    const nextSplit = ((clientX - bounds.left) / bounds.width) * 100;
    setSplitPercent(clampSplit(nextSplit));
  };

  const handlePrevious = () => {
    setActiveIndex((current) =>
      current === 0 ? COMPARE_PAGES.length - 1 : current - 1,
    );
  };

  const handleNext = () => {
    setActiveIndex((current) =>
      current === COMPARE_PAGES.length - 1 ? 0 : current + 1,
    );
  };

  const handleSliderPointerDown = (
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    event.preventDefault();
    setDraggingPointerId(event.pointerId);
    event.currentTarget.setPointerCapture(event.pointerId);
    updateSplitFromClientX(event.clientX);
  };
// TODO handle pages of different heights better
  const handleSliderPointerMove = (
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    if (event.pointerId !== draggingPointerId) {
      return;
    }

    event.preventDefault();
    updateSplitFromClientX(event.clientX);
  };

  const handleSliderPointerUp = (
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    if (event.pointerId !== draggingPointerId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDraggingPointerId(null);
  };

  const handleSliderKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
  ) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setSplitPercent((current) => clampSplit(current - 2));
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      setSplitPercent((current) => clampSplit(current + 2));
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      setSplitPercent(0);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      setSplitPercent(100);
    }
  };

  const beforeScaleWidth =
    splitPercent === 0 ? "100%" : `${10000 / splitPercent}%`;

  useEffect(() => {
    const scrollElement = scrollRef.current;
    if (!scrollElement) {
      return;
    }

    const maxScroll = scrollElement.scrollHeight - scrollElement.clientHeight;
    if (maxScroll <= 0) {
      return;
    }

    // Remove tiny scroll for DM showcase
    const targetRatio = 0;
    scrollElement.scrollTop = maxScroll * targetRatio;
  }, [activePage.id]);

  return (
    <div
      ref={rootRef}
      className={cn(
        grailedPreviewShell(),
        chrome.surface ??
          (darkMode
            ? "bg-surface-overlay-dark-panel"
            : "bg-surface-overlay-light-button"),
      )}
    >
      <div
        ref={scrollRef}
        className="relative h-full overflow-x-hidden overflow-y-auto"
      >
        <div className="relative w-full">
          <Image
            src={activePage.after}
            alt={activePage.afterAlt}
            className="pointer-events-none block h-auto w-full select-none"
            sizes={IMAGE_SIZES}
            quality={GRAILED_PREVIEW_IMAGE_QUALITY}
            priority
          />
          <div
            className="pointer-events-none absolute inset-y-0 left-0 overflow-hidden"
            style={{ width: `${splitPercent}%` }}
          >
            {splitPercent > 0 ? (
              <div style={{ width: beforeScaleWidth }}>
                <Image
                  src={activePage.before}
                  alt={activePage.beforeAlt}
                  className="block h-auto w-full select-none"
                  sizes={IMAGE_SIZES}
                  quality={GRAILED_PREVIEW_IMAGE_QUALITY}
                  priority
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-0">
        <div
          className={cn(
            "absolute inset-y-0 w-px",
            darkMode ? "bg-divider-overlay-dark" : "bg-divider-overlay-light",
          )}
          style={{ left: `${splitPercent}%`, transform: "translateX(-0.5px)" }}
        />
        <OverlayControlButton
          layout="icon"
          shape="round"
          toneClass={controlToneClass}
          role="slider"
          aria-label="Before and after comparison slider"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={splitPercent}
          aria-valuetext={`${splitPercent}% before`}
          onPointerDown={handleSliderPointerDown}
          onPointerMove={handleSliderPointerMove}
          onPointerUp={handleSliderPointerUp}
          onPointerCancel={handleSliderPointerUp}
          onLostPointerCapture={() => setDraggingPointerId(null)}
          onKeyDown={handleSliderKeyDown}
          className="pointer-events-auto absolute top-1/2 touch-none"
          style={{
            left: `${splitPercent}%`,
            transform: "translate(-50%, -50%)",
          }}
        >
          <ArrowLeftRight aria-hidden />
        </OverlayControlButton>
      </div>

      <div
        className="absolute top-3 right-3 z-10 px-1 py-1 text-xs font-semibold tracking-[0.14em] text-white uppercase mix-blend-difference pointer-events-none"
        style={{ filter: GRAILED_OVERLAY_MONO_FILTER }}
      >
        {activePage.label}
      </div>

      <div
        className="absolute bottom-3 left-3 z-10 text-[10px] font-semibold tracking-[0.22em] text-white uppercase mix-blend-difference pointer-events-none"
        style={{ filter: GRAILED_OVERLAY_MONO_FILTER, opacity: 0.42 }}
      >
        Before
      </div>
      <div
        className="absolute right-3 bottom-3 z-10 text-[10px] font-semibold tracking-[0.22em] text-white uppercase mix-blend-difference pointer-events-none"
        style={{ filter: GRAILED_OVERLAY_MONO_FILTER, opacity: 0.42 }}
      >
        After
      </div>

      <OverlayControlButton
        layout="icon"
        shape="round"
        toneClass={controlToneClass}
        onClick={handlePrevious}
        aria-label="Previous before and after page"
        className="absolute top-1/2 left-3 z-10 -translate-y-1/2 md:left-4"
      >
        <ArrowLeft aria-hidden />
      </OverlayControlButton>
      <OverlayControlButton
        layout="icon"
        shape="round"
        toneClass={controlToneClass}
        onClick={handleNext}
        aria-label="Next before and after page"
        className="absolute top-1/2 right-3 z-10 -translate-y-1/2 md:right-4"
      >
        <ArrowRight aria-hidden />
      </OverlayControlButton>
    </div>
  );
}
