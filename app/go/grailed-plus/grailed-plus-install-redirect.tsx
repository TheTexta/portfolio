"use client";

import { ArrowLeft, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { PROJECT_ROUTES } from "@/app/components/projects/project-routes";
import { useTheme } from "@/app/components/theme/theme-provider";
import OverlayNavBar from "@/app/components/ui/overlay-nav-bar";
import { cn } from "@/lib/cn";

type GrailedPlusInstallRedirectProps = {
  googleAdsSendTo?: string;
};

type RedirectMode = "auto" | "manual";

type TrackingPayload = {
  autoRedirectEnabled: boolean;
  redirectMode: RedirectMode;
  referrer: string | null;
} & Partial<
  Record<
    | "gclid"
    | "gbraid"
    | "wbraid"
    | "gad_source"
    | "utm_id"
    | "utm_source"
    | "utm_medium"
    | "utm_campaign"
    | "utm_term"
    | "utm_content",
    string | null
  >
>;

const TRACKING_ENDPOINT = "/api/marketing/grailed-plus-redirect";
const AUTO_REDIRECT_DELAY_MS = 180;
const GOOGLE_ADS_READY_WAIT_MS = 600;
const GOOGLE_ADS_REDIRECT_FALLBACK_MS = 1200;
const MANUAL_REDIRECT_VALUES = new Set(["1", "true", "manual"]);
const INITIAL_STATUS_MESSAGE = "Preparing your Chrome Web Store redirect.";
const MANUAL_STATUS_MESSAGE =
  "Automatic redirect is paused. Continue to the Chrome Web Store when ready.";
const TRACKED_QUERY_KEYS = [
  "gclid",
  "gbraid",
  "wbraid",
  "gad_source",
  "utm_id",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
] as const;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

function readSearchValue(searchParams: URLSearchParams, key: string) {
  const value = searchParams.get(key)?.trim();
  return value ? value.slice(0, 240) : null;
}

function buildTrackingPayload(
  searchParams: URLSearchParams,
  autoRedirectEnabled: boolean,
  redirectMode: RedirectMode,
): TrackingPayload {
  const payload: TrackingPayload = {
    autoRedirectEnabled,
    redirectMode,
    referrer: document.referrer || null,
  };

  for (const key of TRACKED_QUERY_KEYS) {
    payload[key] = readSearchValue(searchParams, key);
  }

  return payload;
}

function queueTrackingRequest(payload: TrackingPayload) {
  const body = JSON.stringify(payload);

  try {
    if (navigator.sendBeacon) {
      const queued = navigator.sendBeacon(
        TRACKING_ENDPOINT,
        new Blob([body], { type: "application/json" }),
      );

      if (queued) {
        return;
      }
    }
  } catch {
    // Ignore beacon errors and fall back to fetch keepalive below.
  }

  void fetch(TRACKING_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body,
    keepalive: true,
  }).catch(() => {
    // Tracking is best-effort and should not block the redirect.
  });
}

function isManualRedirect(searchParams: URLSearchParams) {
  const manualValue = searchParams.get("manual")?.trim().toLowerCase();
  const redirectValue = searchParams.get("redirect")?.trim().toLowerCase();

  return (
    (manualValue !== undefined && MANUAL_REDIRECT_VALUES.has(manualValue)) ||
    redirectValue === "manual"
  );
}

export default function GrailedPlusInstallRedirect({
  googleAdsSendTo,
}: GrailedPlusInstallRedirectProps) {
  const { darkMode, toggleTheme } = useTheme();
  const [{ autoRedirectEnabled, statusMessage }, setRedirectState] = useState({
    autoRedirectEnabled: true,
    statusMessage: INITIAL_STATUS_MESSAGE,
  });
  const redirectStartedRef = useRef(false);
  const redirectCompletedRef = useRef(false);

  const buttonClass = cn(
    "inline-flex items-center justify-center gap-2 rounded-full border px-5 py-3 text-sm font-medium transition-colors duration-150",
    darkMode ? "overlay-button-dark-solid" : "overlay-button-light",
  );
  const secondaryLinkClass = cn(
    "inline-flex items-center justify-center gap-2 rounded-full border px-5 py-3 text-sm transition-colors duration-150",
    darkMode ? "overlay-item-dark" : "overlay-item-light",
  );

  const redirectToStore = useCallback(() => {
    if (redirectCompletedRef.current) {
      return;
    }

    redirectCompletedRef.current = true;
    window.location.replace(PROJECT_ROUTES.grailedPlusChromeWebStore);
  }, []);

  const beginRedirect = useCallback(
    (redirectMode: RedirectMode) => {
      if (redirectStartedRef.current) {
        return;
      }

      redirectStartedRef.current = true;

      const searchParams = new URLSearchParams(window.location.search);
      const trackingPayload = buildTrackingPayload(
        searchParams,
        autoRedirectEnabled,
        redirectMode,
      );

      setRedirectState((current) =>
        current.statusMessage === "Opening the Chrome Web Store listing."
          ? current
          : {
              ...current,
              statusMessage: "Opening the Chrome Web Store listing.",
            },
      );
      queueTrackingRequest(trackingPayload);

      if (!googleAdsSendTo) {
        window.setTimeout(redirectToStore, AUTO_REDIRECT_DELAY_MS);
        return;
      }

      const deadline = Date.now() + GOOGLE_ADS_READY_WAIT_MS;
      const dispatchGoogleAdsConversion = () => {
        if (typeof window.gtag === "function") {
          let settled = false;

          const completeRedirect = () => {
            if (settled) {
              return;
            }

            settled = true;
            redirectToStore();
          };

          window.gtag("event", "conversion", {
            send_to: googleAdsSendTo,
            event_callback: completeRedirect,
          });
          window.setTimeout(
            completeRedirect,
            GOOGLE_ADS_REDIRECT_FALLBACK_MS,
          );
          return;
        }

        if (Date.now() < deadline) {
          window.setTimeout(dispatchGoogleAdsConversion, 50);
          return;
        }

        window.setTimeout(redirectToStore, AUTO_REDIRECT_DELAY_MS);
      };

      dispatchGoogleAdsConversion();
    },
    [autoRedirectEnabled, googleAdsSendTo, redirectToStore],
  );

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);

    const timeoutId = window.setTimeout(() => {
      if (isManualRedirect(searchParams)) {
        setRedirectState((current) =>
          current.autoRedirectEnabled ||
          current.statusMessage !== MANUAL_STATUS_MESSAGE
            ? {
                autoRedirectEnabled: false,
                statusMessage: MANUAL_STATUS_MESSAGE,
              }
            : current,
        );
        return;
      }

      beginRedirect("auto");
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [beginRedirect]);

  return (
    <div className="relative min-h-dvh overflow-hidden px-5 py-5 sm:px-8">
      <div
        className={cn(
          "pointer-events-none absolute inset-0",
          darkMode
            ? "bg-[radial-gradient(circle_at_top,_rgb(255_255_255_/_0.1),_transparent_58%),linear-gradient(180deg,_rgb(255_255_255_/_0.02),_transparent_42%)]"
            : "bg-[radial-gradient(circle_at_top,_rgb(0_0_0_/_0.08),_transparent_58%),linear-gradient(180deg,_rgb(0_0_0_/_0.03),_transparent_42%)]",
        )}
      />

      <OverlayNavBar
        darkMode={darkMode}
        onToggleDarkMode={toggleTheme}
        exitHref={PROJECT_ROUTES.grailedPlus}
        toneClass={darkMode ? "overlay-control-icon-dark" : "overlay-control-icon-light"}
        className="top-5 z-20 mr-0 ml-auto"
        ariaLabel="Install page controls"
        containerMode="sticky"
      />

      <main className="relative z-10 mx-auto flex min-h-[calc(100dvh-4.5rem)] max-w-4xl items-center py-10">
        <section
          className={cn(
            "w-full rounded-[2rem] border px-6 py-8 backdrop-blur-xl sm:px-10 sm:py-12",
            darkMode ? "overlay-panel-dark" : "overlay-panel-light",
          )}
        >
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-[0.72rem] font-medium tracking-[0.32em] text-black/55 uppercase dark:text-white/55">
                Grailed Plus install
              </p>
              <h1 className="mt-4 text-4xl leading-[0.94] font-semibold sm:text-6xl">
                Chrome Web Store redirect
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-6 text-black/70 sm:text-base dark:text-white/70">
                Redirecting to the official Chrome Web Store listing for
                Grailed Plus. If your browser pauses or blocks the handoff, use
                the direct link below.
              </p>
            </div>

            <div
              className={cn(
                "w-full max-w-sm rounded-2xl border px-4 py-4 text-sm",
                darkMode ? "overlay-item-dark" : "overlay-item-light",
              )}
            >
              <p className="text-[0.7rem] tracking-[0.28em] text-black/50 uppercase dark:text-white/50">
                Status
              </p>
              <p className="mt-3 leading-6">{statusMessage}</p>
            </div>
          </div>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <a
              href={PROJECT_ROUTES.grailedPlusChromeWebStore}
              className={buttonClass}
              onClick={(event) => {
                if (
                  event.button !== 0 ||
                  event.metaKey ||
                  event.altKey ||
                  event.ctrlKey ||
                  event.shiftKey
                ) {
                  return;
                }

                event.preventDefault();
                beginRedirect("manual");
              }}
            >
              Continue to Chrome Web Store
              <ArrowUpRight className="h-4 w-4" strokeWidth={1.7} />
            </a>

            <Link href={PROJECT_ROUTES.grailedPlus} className={secondaryLinkClass}>
              <ArrowLeft className="h-4 w-4" strokeWidth={1.7} />
              View project page
            </Link>
          </div>

          <p className="mt-4 text-xs leading-5 text-black/55 dark:text-white/55">
            {autoRedirectEnabled
              ? "The redirect runs automatically unless you open this route with `?manual=1`."
              : "Automatic redirect is disabled because `manual=1` or `redirect=manual` is set in the URL."}
          </p>
        </section>
      </main>
    </div>
  );
}
