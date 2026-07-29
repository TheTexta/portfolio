"use client";

import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useTheme } from "@/app/components/theme/theme-provider";
import { cn } from "@/lib/cn";
import GrailedPlusPreview from "./grailed-plus-preview";

export type GrailedPlusDemoFeature =
  | "overview"
  | "pricing"
  | "market-compare"
  | "currency"
  | "dark-mode";

type PreviewFallback = "price-trend" | "custom-currency" | "dm";

type GrailedPlusLiveDemoProps = {
  className?: string;
  eager?: boolean;
  fallbackComparisonId: PreviewFallback;
  feature: GrailedPlusDemoFeature;
  onVersionChange?: (version: string | null) => void;
  title: string;
};

type DemoMessage = {
  source?: unknown;
  version?: unknown;
  type?: unknown;
  feature?: unknown;
  height?: unknown;
  extensionVersion?: unknown;
  state?: unknown;
};

const DEFAULT_DEMO_ORIGIN = "https://grailed-plus-demo.dextery.dev";
const DEMO_ORIGIN = normalizeDemoOrigin(
  process.env.NEXT_PUBLIC_GRAILED_PLUS_DEMO_ORIGIN,
);
const READY_TIMEOUT_MS = 8_000;
const FRAME_HEIGHTS: Record<
  GrailedPlusDemoFeature,
  { min: number; max: number }
> = {
  overview: { min: 680, max: 820 },
  pricing: { min: 300, max: 520 },
  "market-compare": { min: 160, max: 360 },
  currency: { min: 360, max: 520 },
  "dark-mode": { min: 390, max: 540 },
};
const MESSAGE_SOURCE = "grailed-plus-demo";
const PARENT_MESSAGE_SOURCE = "grailed-plus-site";
const MESSAGE_VERSION = 1;

function isSiteDarkMode() {
  return document.documentElement.classList.contains("dark");
}

function normalizeDemoOrigin(value: string | undefined) {
  try {
    const url = new URL(value || DEFAULT_DEMO_ORIGIN);
    if (url.protocol === "https:" || url.protocol === "http:") {
      return url.origin;
    }
  } catch {
    // Fall through to the production origin when an environment value is invalid.
  }

  return DEFAULT_DEMO_ORIGIN;
}

function clampFrameHeight(
  value: unknown,
  bounds: { min: number; max: number },
) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return bounds.min;
  }

  return Math.min(bounds.max, Math.max(bounds.min, parsed));
}

function getDemoUrl(feature: GrailedPlusDemoFeature) {
  const url = new URL(DEMO_ORIGIN);
  url.searchParams.set("feature", feature);
  return url.toString();
}

export default function GrailedPlusLiveDemo({
  className,
  eager = false,
  fallbackComparisonId,
  feature,
  onVersionChange,
  title,
}: GrailedPlusLiveDemoProps) {
  const { darkMode: siteDarkMode } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const readyTimeoutRef = useRef<number | null>(null);
  const playSentRef = useRef(false);
  const enteredViewportRef = useRef(eager);
  const frameBounds = FRAME_HEIGHTS[feature];
  const [attempt, setAttempt] = useState(0);
  const [frameHeight, setFrameHeight] = useState(frameBounds.min);
  const [hasEnteredViewport, setHasEnteredViewport] = useState(eager);
  const [isReady, setIsReady] = useState(false);
  const [isUnavailable, setIsUnavailable] = useState(false);
  const demoUrl = useMemo(() => getDemoUrl(feature), [feature]);
  const demoOrigin = useMemo(() => new URL(demoUrl).origin, [demoUrl]);
  const shouldLoad = eager || hasEnteredViewport;

  const clearReadyTimeout = useCallback(() => {
    if (readyTimeoutRef.current != null) {
      window.clearTimeout(readyTimeoutRef.current);
      readyTimeoutRef.current = null;
    }
  }, []);

  const sendPlay = useCallback(() => {
    if (
      playSentRef.current ||
      !enteredViewportRef.current ||
      !isReady ||
      !iframeRef.current?.contentWindow
    ) {
      return;
    }

    playSentRef.current = true;
    iframeRef.current.contentWindow.postMessage(
      {
        source: PARENT_MESSAGE_SOURCE,
        version: MESSAGE_VERSION,
        type: "play",
      },
      demoOrigin,
    );
  }, [demoOrigin, isReady]);

  const requestReady = useCallback(() => {
    const demoWindow = iframeRef.current?.contentWindow;
    if (!demoWindow) {
      return;
    }

    try {
      if (demoWindow.location.origin !== demoOrigin) {
        return;
      }
    } catch {
      // Cross-origin access failing means the frame has left its local placeholder.
    }

    demoWindow.postMessage(
      {
        source: PARENT_MESSAGE_SOURCE,
        version: MESSAGE_VERSION,
        type: "connect",
        darkMode: isSiteDarkMode(),
      },
      demoOrigin,
    );
  }, [demoOrigin]);

  const sendTheme = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage(
      {
        source: PARENT_MESSAGE_SOURCE,
        version: MESSAGE_VERSION,
        type: "theme",
        darkMode: isSiteDarkMode(),
      },
      demoOrigin,
    );
  }, [demoOrigin]);

  useEffect(() => {
    if (eager) {
      return;
    }

    const container = containerRef.current;
    if (!container) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) {
          return;
        }

        enteredViewportRef.current = true;
        setHasEnteredViewport(true);
        observer.disconnect();
      },
      { rootMargin: "600px 0px" },
    );

    observer.observe(container);
    return () => observer.disconnect();
  }, [eager]);

  useEffect(() => {
    if (!shouldLoad || isUnavailable) {
      return;
    }

    clearReadyTimeout();
    readyTimeoutRef.current = window.setTimeout(() => {
      setIsUnavailable(true);
      setIsReady(false);
    }, READY_TIMEOUT_MS);

    return clearReadyTimeout;
  }, [attempt, clearReadyTimeout, isUnavailable, shouldLoad]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent<DemoMessage>) => {
      if (
        event.origin !== demoOrigin ||
        event.source !== iframeRef.current?.contentWindow ||
        event.data?.source !== MESSAGE_SOURCE ||
        event.data.version !== MESSAGE_VERSION ||
        event.data.feature !== feature
      ) {
        return;
      }

      if (event.data.type === "ready") {
        clearReadyTimeout();
        setIsReady(true);
        setIsUnavailable(false);
        setFrameHeight(clampFrameHeight(event.data.height, frameBounds));
        onVersionChange?.(
          typeof event.data.extensionVersion === "string"
            ? event.data.extensionVersion
            : null,
        );
      } else if (event.data.type === "resize") {
        setFrameHeight(clampFrameHeight(event.data.height, frameBounds));
      }
    };

    window.addEventListener("message", handleMessage);
    const requestId = window.requestAnimationFrame(requestReady);

    return () => {
      window.cancelAnimationFrame(requestId);
      window.removeEventListener("message", handleMessage);
    };
  }, [
    clearReadyTimeout,
    demoOrigin,
    feature,
    frameBounds,
    onVersionChange,
    requestReady,
  ]);

  useEffect(() => {
    sendPlay();
  }, [hasEnteredViewport, isReady, sendPlay]);

  useEffect(() => {
    if (shouldLoad) {
      sendTheme();
    }
  }, [isReady, sendTheme, shouldLoad, siteDarkMode]);

  useEffect(
    () => () => {
      clearReadyTimeout();
    },
    [clearReadyTimeout],
  );

  const retry = () => {
    clearReadyTimeout();
    playSentRef.current = false;
    setFrameHeight(frameBounds.min);
    setIsReady(false);
    setIsUnavailable(false);
    setAttempt((current) => current + 1);
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "grailed-plus-live-demo relative overflow-hidden bg-transparent",
        className,
      )}
      style={{ minHeight: frameBounds.min }}
    >
      {isUnavailable ? (
        <div className="relative h-[min(72vh,46rem)] min-h-[32rem]">
          <GrailedPlusPreview
            comparisonId={fallbackComparisonId}
            interactiveScroll={false}
            priority={eager}
          />
          <div className="absolute inset-x-3 bottom-3 z-30 flex items-center justify-between gap-3 bg-[var(--gp-canvas)] p-3 text-xs sm:inset-x-4 sm:bottom-4">
            <p className="grailed-plus-muted">
              The live source is unavailable. Showing the saved PNG preview.
            </p>
            <button
              type="button"
              onClick={retry}
              className="inline-flex min-h-11 shrink-0 items-center gap-2 border border-[var(--gp-rule)] px-3 font-semibold uppercase outline-none hover:bg-[var(--gp-surface)] focus-visible:ring-2 focus-visible:ring-[var(--gp-ink)]"
            >
              <RefreshCw aria-hidden className="h-3.5 w-3.5" />
              Retry
            </button>
          </div>
        </div>
      ) : (
        <>
          {!isReady ? (
            <div
              className="grailed-plus-muted absolute inset-x-0 top-0 z-0 flex items-center justify-center px-6 text-center text-xs tracking-[0.12em] uppercase"
              style={{ minHeight: frameBounds.min }}
              role="status"
            >
              {shouldLoad
                ? "Connecting to the current extension build"
                : "Live demo loads as it approaches"}
            </div>
          ) : null}

          {shouldLoad ? (
            <iframe
              key={`${feature}-${attempt}`}
              ref={iframeRef}
              src={demoUrl}
              title={title}
              loading={eager ? "eager" : "lazy"}
              referrerPolicy="strict-origin"
              sandbox="allow-scripts allow-same-origin"
              onLoad={requestReady}
              onError={() => setIsUnavailable(true)}
              className={cn(
                "relative z-10 block w-full border-0 bg-transparent transition-opacity duration-300",
                isReady ? "opacity-100" : "opacity-0",
              )}
              style={{ height: frameHeight }}
            />
          ) : (
            <div style={{ height: frameBounds.min }} aria-hidden />
          )}
        </>
      )}
    </div>
  );
}
