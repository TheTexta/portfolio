"use client";

import { useCallback, useRef, useState } from "react";

import GrailedPlusPreview from "@/app/components/projects/grailed-plus/grailed-plus-preview";
import { PROJECT_ROUTES } from "@/app/components/projects/project-routes";
import { cn } from "@/lib/cn";

type GrailedPlusInstallRedirectProps = {
  googleAdsSendTo?: string;
};

type TrackingPayload = {
  autoRedirectEnabled: boolean;
  redirectMode: "manual";
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
const CLICK_REDIRECT_DELAY_MS = 180;
const GOOGLE_ADS_READY_WAIT_MS = 600;
const GOOGLE_ADS_REDIRECT_FALLBACK_MS = 1200;
const CTA_LABEL = "Add to Chrome";
const CTA_OPENING_LABEL = "Opening Chrome Web Store...";
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

function buildTrackingPayload(searchParams: URLSearchParams): TrackingPayload {
  const payload: TrackingPayload = {
    autoRedirectEnabled: false,
    redirectMode: "manual",
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
    // Tracking is best-effort and should never block the outbound click.
  }

  void fetch(TRACKING_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body,
    keepalive: true,
  }).catch(() => {
    // Ignore tracking failures and continue with the redirect.
  });
}

export default function GrailedPlusInstallRedirect({
  googleAdsSendTo,
}: GrailedPlusInstallRedirectProps) {
  const [isRedirecting, setIsRedirecting] = useState(false);
  const redirectStartedRef = useRef(false);
  const redirectCompletedRef = useRef(false);

  const redirectToStore = useCallback(() => {
    if (redirectCompletedRef.current) {
      return;
    }

    redirectCompletedRef.current = true;
    window.location.replace(PROJECT_ROUTES.grailedPlusChromeWebStore);
  }, []);

  const beginRedirect = useCallback(() => {
    if (redirectStartedRef.current) {
      return;
    }

    redirectStartedRef.current = true;
    setIsRedirecting(true);

    const searchParams = new URLSearchParams(window.location.search);
    const trackingPayload = buildTrackingPayload(searchParams);

    queueTrackingRequest(trackingPayload);

    if (!googleAdsSendTo) {
      window.setTimeout(redirectToStore, CLICK_REDIRECT_DELAY_MS);
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
        window.setTimeout(completeRedirect, GOOGLE_ADS_REDIRECT_FALLBACK_MS);
        return;
      }

      if (Date.now() < deadline) {
        window.setTimeout(dispatchGoogleAdsConversion, 50);
        return;
      }

      window.setTimeout(redirectToStore, CLICK_REDIRECT_DELAY_MS);
    };

    dispatchGoogleAdsConversion();
  }, [googleAdsSendTo, redirectToStore]);

  return (
    <main className="min-h-dvh px-5 py-8 sm:px-8 sm:py-12 bg-page-bg text-page-fg dark:bg-page-bg-dark dark:text-page-fg-dark font-sans">
      <section className="mx-auto flex flex-col items-center justify-center min-h-[calc(100dvh-4rem)] max-w-3xl">
        <p className="text-[0.72rem] font-medium tracking-[0.3em] uppercase mb-2" style={{ color: 'var(--color-text-overlay-light)', opacity: 0.5 }}>
          Chrome extension for Grailed
        </p>
        <h1 className="text-5xl font-bold sm:text-7xl text-center mb-4" style={{ color: 'var(--color-page-fg)' }}>
          Grailed +
        </h1>
        <div className="space-y-2 text-sm leading-6 sm:text-base text-center mb-6" style={{ color: 'var(--color-text-overlay-light)', opacity: 0.7 }}>
          <p>
            Dark mode, price insights, seller metadata, and custom currency in one lightweight extension for Grailed.
          </p>
          <p>
            Preview the changes below, then install directly from the Chrome Web Store.
          </p>
        </div>
        <a
          href={PROJECT_ROUTES.grailedPlusChromeWebStore}
          aria-busy={isRedirecting}
          aria-disabled={isRedirecting}
          className={cn(
            "inline-flex items-center justify-center rounded-full px-8 text-center text-sm font-medium tracking-[0.16em] uppercase transition-colors duration-200",
            "overlay-button-dark overlay-button-light bg-black text-white dark:bg-white dark:text-black",
            "h-12 min-w-45 sm:min-w-55",
            isRedirecting && "pointer-events-none opacity-70",
          )}
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
            beginRedirect();
          }}
        >
          {isRedirecting ? CTA_OPENING_LABEL : CTA_LABEL}
        </a>
        <p className="mt-3 text-center text-xs" style={{ color: 'var(--color-text-overlay-light)', opacity: 0.45 }}>
          Installs from the official Chrome Web Store listing.
        </p>
        <div className="relative aspect-video w-full max-w-3xl overflow-hidden rounded-md mt-8">
          <GrailedPlusPreview />
        </div>
      </section>
    </main>
  );
}
