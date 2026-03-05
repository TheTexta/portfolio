"use client";
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
import afterCustomCurrency from "./after-custom-currency.png";
import afterDm from "./after-dm.png";
import beforeCustomCurrency from "./before-custom-currency.png";
import beforeDm from "./before-dm.png";

type GrailedPlusPreviewProps = {
  forcedDarkMode?: boolean;
};

type ComparePage = {
  id: "dm" | "custom-currency";
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
    beforeAlt: "Grailed listing page before Grailed Plus dark mode and enhancements",
    afterAlt: "Grailed listing page after Grailed Plus dark mode and enhancements",
  },
  {
    id: "custom-currency",
    label: "Custom Currency",
    before: beforeCustomCurrency,
    after: afterCustomCurrency,
    beforeAlt: "Grailed browse page before Grailed Plus custom currency enhancements",
    afterAlt: "Grailed browse page after Grailed Plus custom currency enhancements",
  },
];

const IMAGE_SIZES = "(min-width: 1024px) 960px, (min-width: 768px) 80vw, 100vw";

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

  const beforeScaleWidth = splitPercent === 0 ? "100%" : `${10000 / splitPercent}%`;

  useEffect(() => {
    const scrollElement = scrollRef.current;
    if (!scrollElement) {
      return;
    }

    const maxScroll = scrollElement.scrollHeight - scrollElement.clientHeight;
    if (maxScroll <= 0) {
      return;
    }

    const targetRatio = activePage.id === "dm" ? 0.05 : 0;
    scrollElement.scrollTop = maxScroll * targetRatio;
  }, [activePage.id]);

  return (
    <div
      ref={rootRef}
      className={`relative h-full w-full overflow-hidden ${chrome.surface ?? (darkMode ? " bg-black/30" : " bg-white/85")}`}
    >
      <div
        ref={scrollRef}
        className="relative h-full overflow-y-auto overflow-x-hidden"
      >
        <div className="relative w-full">
          <Image
            src={activePage.after}
            alt={activePage.afterAlt}
            className="pointer-events-none block h-auto w-full select-none"
            sizes={IMAGE_SIZES}
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
                  priority
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-0">
        <div
          className={`absolute inset-y-0 w-px ${darkMode ? "bg-white/70" : "bg-black/35"}`}
          style={{ left: `${splitPercent}%`, transform: "translateX(-0.5px)" }}
        />
        <button
          type="button"
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
          className={`pointer-events-auto absolute top-1/2 -translate-y-1/2 touch-none rounded-full border px-3 py-2 text-sm font-semibold shadow-sm transition-colors ${chrome.button ?? (darkMode ? "border-white/15 bg-black/55 text-white hover:bg-black/70" : "border-black/10 bg-white/85 text-neutral-950 hover:bg-white")}`}
          style={{ left: `${splitPercent}%`, transform: "translate(-50%, -50%)" }}
        >
          ↔
        </button>
      </div>

      <div
        className="pointer-events-none absolute right-3 top-3 z-10 px-1 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-white mix-blend-difference"
        style={{ filter: "grayscale(1) brightness(1.35)" }}
      >
        {activePage.label}
      </div>

      <div
        className="pointer-events-none absolute bottom-3 left-3 z-10 text-[10px] font-semibold uppercase tracking-[0.22em] text-white mix-blend-difference"
        style={{ filter: "grayscale(1) brightness(1.15)", opacity: 0.42 }}
      >
        Before
      </div>
      <div
        className="pointer-events-none absolute bottom-3 right-3 z-10 text-[10px] font-semibold uppercase tracking-[0.22em] text-white mix-blend-difference"
        style={{ filter: "grayscale(1) brightness(1.15)", opacity: 0.42 }}
      >
        After
      </div>

      <button
        type="button"
        onClick={handlePrevious}
        aria-label="Previous before and after page"
        className={`absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full border px-3 py-2 text-base font-semibold transition-colors md:left-4 ${chrome.button ?? (darkMode ? "border-white/15 bg-black/55 text-white hover:bg-black/70" : "border-black/10 bg-white/85 text-neutral-950 hover:bg-white")}`}
      >
        ←
      </button>
      <button
        type="button"
        onClick={handleNext}
        aria-label="Next before and after page"
        className={`absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full border px-3 py-2 text-base font-semibold transition-colors md:right-4 ${chrome.button ?? (darkMode ? "border-white/15 bg-black/55 text-white hover:bg-black/70" : "border-black/10 bg-white/85 text-neutral-950 hover:bg-white")}`}
      >
        →
      </button>
    </div>
  );
}
