"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { RotateCw } from "lucide-react";

import { cn } from "@/lib/cn";
import AnimationPlayer from "@/app/components/ui/animation-player";
import type { AnimationFrame } from "@/lib/animation/timeline";
import comparisonTimeline from "@/public/projects/grailed-plus/recorded-demo/recorded-comparison-timeline.json";

export type GrailedPlusDemoFeature =
  "overview" | "pricing" | "market-compare" | "currency" | "dark-mode";

export const GRAILED_PLUS_DEMO_CURRENCIES = [
  "USD",
  "CAD",
  "EUR",
  "GBP",
  "AUD",
  "JPY",
] as const;

export type GrailedPlusDemoCurrency =
  (typeof GRAILED_PLUS_DEMO_CURRENCIES)[number];

type GrailedPlusLiveDemoProps = {
  className?: string;
  currencyCode?: GrailedPlusDemoCurrency;
  darkModeEnabled?: boolean;
  parentDarkMode?: boolean;
  eager?: boolean;
  feature: GrailedPlusDemoFeature;
  onVersionChange?: (version: string | null) => void;
  resetToken?: number;
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
const RECORDED_DEMO_PATH = "/projects/grailed-plus/recorded-demo/";
const DEMO_ORIGIN = normalizeDemoOrigin(
  process.env.NEXT_PUBLIC_GRAILED_PLUS_DEMO_ORIGIN,
);
const READY_TIMEOUT_MS = 8_000;
const FRAME_HEIGHTS: Record<
  GrailedPlusDemoFeature,
  { min: number; max: number }
> = {
  overview: { min: 680, max: 820 },
  pricing: { min: 340, max: 620 },
  "market-compare": { min: 330, max: 580 },
  currency: { min: 360, max: 520 },
  "dark-mode": { min: 390, max: 540 },
};
const MESSAGE_SOURCE = "grailed-plus-demo";
const PARENT_MESSAGE_SOURCE = "grailed-plus-site";
const MESSAGE_VERSION = 1;

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
  if (feature === "market-compare") {
    return `${RECORDED_DEMO_PATH}index.html?feature=market-compare`;
  }
  const url = new URL(DEMO_ORIGIN);
  url.searchParams.set("feature", feature);
  return url.toString();
}

export default function GrailedPlusLiveDemo({
  className,
  currencyCode,
  darkModeEnabled,
  parentDarkMode,
  eager = false,
  feature,
  onVersionChange,
  resetToken,
  title,
}: GrailedPlusLiveDemoProps) {
  const descriptionId = useId();
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
  const [hasTimedOut, setHasTimedOut] = useState(false);
  const demoUrl = useMemo(() => getDemoUrl(feature), [feature]);
  const demoOrigin = useMemo(
    () => (feature === "market-compare" ? "" : new URL(demoUrl).origin),
    [demoUrl, feature],
  );
  const shouldLoad = eager || hasEnteredViewport;

  const clearReadyTimeout = useCallback(() => {
    if (readyTimeoutRef.current != null) {
      window.clearTimeout(readyTimeoutRef.current);
      readyTimeoutRef.current = null;
    }
  }, []);

  const sendCommand = useCallback(
    (
      type: "setCurrency" | "setDarkMode" | "theme" | "reset" | "frame",
      payload?: object,
    ) => {
      const demoWindow = iframeRef.current?.contentWindow;
      if (!demoWindow) {
        return;
      }

      demoWindow.postMessage(
        {
          source: PARENT_MESSAGE_SOURCE,
          version: MESSAGE_VERSION,
          type,
          ...(payload ?? {}),
        },
        demoOrigin || window.location.origin,
      );
    },
    [demoOrigin],
  );

  const sendPlay = useCallback(() => {
    if (
      playSentRef.current ||
      !enteredViewportRef.current ||
      feature === "market-compare" ||
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
      demoOrigin || window.location.origin,
    );
  }, [demoOrigin, feature, isReady]);

  const renderAnimationFrame = useCallback(
    (frame: AnimationFrame) => {
      if (isReady)
        sendCommand("frame", {
          timeMs: frame.timeMs,
          transition: frame.transition,
        });
    },
    [isReady, sendCommand],
  );

  const requestReady = useCallback(() => {
    const demoWindow = iframeRef.current?.contentWindow;
    if (!demoWindow) {
      return;
    }

    try {
      if (
        demoWindow.location.origin !== (demoOrigin || window.location.origin)
      ) {
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
        ...(darkModeEnabled == null ? {} : { darkMode: darkModeEnabled }),
        ...(parentDarkMode == null ? {} : { parentDarkMode }),
      },
      demoOrigin || window.location.origin,
    );
  }, [darkModeEnabled, demoOrigin, parentDarkMode]);

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
    if (!shouldLoad) {
      return;
    }

    clearReadyTimeout();
    readyTimeoutRef.current = window.setTimeout(() => {
      setIsReady(false);
      setHasTimedOut(true);
    }, READY_TIMEOUT_MS);

    return clearReadyTimeout;
  }, [attempt, clearReadyTimeout, shouldLoad]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent<DemoMessage>) => {
      if (
        event.origin !== (demoOrigin || window.location.origin) ||
        event.source !== iframeRef.current?.contentWindow ||
        event.data?.source !== MESSAGE_SOURCE ||
        event.data.version !== MESSAGE_VERSION ||
        event.data.feature !== feature
      ) {
        return;
      }

      if (event.data.type === "ready") {
        clearReadyTimeout();
        setHasTimedOut(false);
        setIsReady(true);
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
    if (!shouldLoad || !isReady || !currencyCode) {
      return;
    }

    sendCommand("setCurrency", { code: currencyCode });
  }, [currencyCode, isReady, sendCommand, shouldLoad]);

  useEffect(() => {
    if (!shouldLoad || !isReady || darkModeEnabled == null) {
      return;
    }

    sendCommand("setDarkMode", { enabled: darkModeEnabled });
  }, [darkModeEnabled, isReady, sendCommand, shouldLoad]);

  useEffect(() => {
    if (!shouldLoad || !isReady || parentDarkMode == null) {
      return;
    }

    sendCommand("theme", { parentDarkMode });
  }, [isReady, parentDarkMode, sendCommand, shouldLoad]);

  const lastAppliedResetTokenRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!shouldLoad || !isReady || resetToken == null) {
      return;
    }

    if (lastAppliedResetTokenRef.current === resetToken) {
      return;
    }

    lastAppliedResetTokenRef.current = resetToken;
    sendCommand("reset");
  }, [isReady, resetToken, sendCommand, shouldLoad]);

  useEffect(
    () => () => {
      clearReadyTimeout();
    },
    [clearReadyTimeout],
  );

  const retryDemo = useCallback(() => {
    playSentRef.current = false;
    setHasTimedOut(false);
    setIsReady(false);
    setAttempt((currentAttempt) => currentAttempt + 1);
  }, []);

  const frame = (
    <div
      ref={containerRef}
      className={cn("relative overflow-hidden bg-transparent", className)}
      style={{ minHeight: frameBounds.min }}
    >
      {!isReady ? (
        <div
          className="absolute inset-x-0 top-0 z-0 flex items-center justify-center px-6 text-center text-xs tracking-[0.12em] text-muted uppercase"
          style={{ minHeight: frameBounds.min }}
          role="status"
        >
          {hasTimedOut ? (
            <span className="flex flex-col items-center gap-3">
              <span>Sample-data demo is temporarily unavailable</span>
              <button
                type="button"
                onClick={retryDemo}
                className="inline-flex size-8 items-center justify-center border transition-opacity hover:opacity-55 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
                aria-label="Retry loading live demo"
                title="Retry loading live demo"
              >
                <RotateCw aria-hidden className="size-4" strokeWidth={1.75} />
              </button>
            </span>
          ) : shouldLoad ? (
            "Loading the sample-data demo"
          ) : (
            "Sample-data demo loads as it approaches"
          )}
        </div>
      ) : null}

      {shouldLoad ? (
        <iframe
          key={`${feature}-${attempt}`}
          ref={iframeRef}
          src={demoUrl}
          title={title}
          aria-describedby={descriptionId}
          loading={eager ? "eager" : "lazy"}
          referrerPolicy="strict-origin"
          sandbox="allow-scripts allow-same-origin"
          onLoad={requestReady}
          scrolling="auto"
          inert={!isReady}
          tabIndex={isReady ? undefined : -1}
          className={cn(
            "relative z-10 block size-full border-0 bg-transparent transition-opacity duration-300",
            isReady ? "opacity-100" : "pointer-events-none opacity-0",
          )}
          style={{
            height: frameHeight,
            width: "100%",
            colorScheme: "light",
            overflow: "hidden",
          }}
        />
      ) : (
        <div style={{ height: frameBounds.min }} aria-hidden />
      )}
    </div>
  );

  return (
    <div>
      {feature !== "market-compare" ? (
        <p
          id={descriptionId}
          className="border-b border-ink px-3 py-2 text-xs leading-5 text-muted"
        >
          Interactive demo using sample listings. Scores, timestamps and state
          changes are illustrative; no live marketplace query is performed.
        </p>
      ) : null}
      {feature === "market-compare" ? (
        <AnimationPlayer
          stages={comparisonTimeline.stages}
          ready={isReady}
          onFrame={renderAnimationFrame}
          label="Image comparison"
        >
          {frame}
        </AnimationPlayer>
      ) : (
        frame
      )}
      {feature === "market-compare" ? (
        <p id={descriptionId} className="mt-3 text-xs leading-5 text-muted">
          Recorded MobileCLIP-S1 comparison · sample metadata. No live search or
          model download.{" "}
          <a
            href={`${RECORDED_DEMO_PATH}photo-credits.html`}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-4"
          >
            Photo credits
          </a>
        </p>
      ) : null}
    </div>
  );
}
