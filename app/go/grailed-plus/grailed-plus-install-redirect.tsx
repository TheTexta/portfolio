"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { PROJECT_ROUTES } from "@/app/components/projects/project-routes";

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
const INITIAL_STATUS_MESSAGE = "Redirecting to the Chrome Web Store.";
const OPENING_STATUS_MESSAGE = "Opening the Chrome Web Store.";
const MANUAL_STATUS_MESSAGE = "Automatic redirect is paused.";
const INITIAL_SECONDARY_MESSAGE = "If nothing happens, use the link below.";
const MANUAL_SECONDARY_MESSAGE = "Use the link below when you're ready.";
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
  const [{ autoRedirectEnabled, statusMessage }, setRedirectState] = useState({
    autoRedirectEnabled: true,
    statusMessage: INITIAL_STATUS_MESSAGE,
  });
  const redirectStartedRef = useRef(false);
  const redirectCompletedRef = useRef(false);

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
        current.statusMessage === OPENING_STATUS_MESSAGE
          ? current
          : {
              ...current,
              statusMessage: OPENING_STATUS_MESSAGE,
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
    <main className="flex min-h-dvh items-center justify-center px-6 text-center">
      <div className="max-w-sm">
        <p className="text-sm sm:text-base">{statusMessage}</p>
        <p className="mt-2 text-sm text-black/55 dark:text-white/55">
          {autoRedirectEnabled
            ? INITIAL_SECONDARY_MESSAGE
            : MANUAL_SECONDARY_MESSAGE}
        </p>
        <p className="mt-5 text-sm">
          <a
            href={PROJECT_ROUTES.grailedPlusChromeWebStore}
            className="underline decoration-current underline-offset-4"
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
            Chrome Web Store
          </a>
        </p>
      </div>
    </main>
  );
}
