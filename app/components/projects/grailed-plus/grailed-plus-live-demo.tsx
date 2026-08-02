"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/cn";

export type GrailedPlusDemoFeature =
  | "overview"
  | "pricing"
  | "market-compare"
  | "currency"
  | "dark-mode";

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
  "market-compare": { min: 180, max: 420 },
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
  const demoUrl = useMemo(() => getDemoUrl(feature), [feature]);
  const demoOrigin = useMemo(() => new URL(demoUrl).origin, [demoUrl]);
  const shouldLoad = eager || hasEnteredViewport;

  const clearReadyTimeout = useCallback(() => {
    if (readyTimeoutRef.current != null) {
      window.clearTimeout(readyTimeoutRef.current);
      readyTimeoutRef.current = null;
    }
  }, []);

  const sendCommand = useCallback(
    (
      type: "setCurrency" | "setDarkMode" | "theme" | "reset",
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
        demoOrigin,
      );
    },
    [demoOrigin],
  );

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
        ...(darkModeEnabled == null ? {} : { darkMode: darkModeEnabled }),
        ...(parentDarkMode == null ? {} : { parentDarkMode }),
      },
      demoOrigin,
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
    }, READY_TIMEOUT_MS);

    return clearReadyTimeout;
  }, [attempt, clearReadyTimeout, shouldLoad]);

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

  return (
    <div
      ref={containerRef}
      className={cn("relative overflow-hidden bg-transparent", className)}
      style={{ minHeight: frameBounds.min }}
    >
      {!isReady ? (
        <div
          className="editorial-muted absolute inset-x-0 top-0 z-0 flex items-center justify-center px-6 text-center text-xs tracking-[0.12em] uppercase"
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
          scrolling="no"
          className={cn(
            "relative z-10 block w-full h-full border-0 bg-transparent transition-opacity duration-300",
            isReady ? "opacity-100" : "opacity-0",
          )}
          style={{ height: frameHeight, colorScheme: "light", overflow: "hidden" }}
        />
      ) : (
        <div style={{ height: frameBounds.min }} aria-hidden />
      )}
    </div>
  );
}
