"use client";

import { useCallback, useRef, useState } from "react";

import GrailedPlusPreview from "@/app/components/projects/grailed-plus/grailed-plus-preview";
import { PROJECT_ROUTES } from "@/app/components/projects/project-routes";
import { cn } from "@/lib/cn";
import { ChevronsDown } from 'lucide-react';


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

  const detailsView = useRef<HTMLDivElement>(null);
  const scrollToDetails = () => {
    detailsView.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <main className="bg-canvas text-ink font-light">
      <div className="my-auto flex h-screen max-w-3xl flex-col items-center justify-center mx-5 md:mx-auto">
        <h1 className="mb-4 text-center text-5xl font-bold sm:text-7xl">
          Grailed +
        </h1>
        <div className="text-overlay-ink/70 mb-6 space-y-2 text-center text-sm leading-6 sm:text-base">
          <p>
            Dark mode, price insights, seller metadata, and custom currency in
            one lightweight extension for Grailed.
          </p>
        </div>
        <a
          href={PROJECT_ROUTES.grailedPlusChromeWebStore}
          aria-busy={isRedirecting}
          aria-disabled={isRedirecting}
          className={cn(
            "inline-flex items-center justify-center rounded-full px-8 text-center text-sm font-medium uppercase ",
            " bg-black dark:bg-white hover:bg-white hover:dark:bg-black text-canvas  hover:text-black dark:hover:text-white hover:border-black dark:hover:border-white border-2",
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
        <p className="text-overlay-ink/45 mt-3 text-center text-xs italic">
          Installs from the official Chrome Web Store listing.
        </p>

        {<ChevronsDown className="bottom-10 absolute hover:cursor-pointer animate-hover" onClick={scrollToDetails}/>}
      </div>

      <div className="flex w-full flex-col" ref={detailsView}>
        <div className="my-20 flex h-125 w-full flex-row">
          <div className="max-h-full w-2/3">
            <GrailedPlusPreview comparisonId="price-trend" />
          </div>
          <div className="mx-5 mb-4 h-full w-1/3 text-right">
            <h2 className="text-3xl font-bold sm:text-5xl">PRICING INSIGHTS</h2>
            <p className="text-break text-xl md:text-3xl">
              Depop price comparisons and historical price drop data directly on
              every listing page — no extra tabs, no manual searching. See what
              the same item is moving for across markets, track how long a
              listing has been sitting, and spot a motivated seller before
              anyone else does.
            </p>
          </div>
        </div>
        <div className="my-20 flex h-125 w-full flex-row">
          <div className="mx-5 mb-4 h-full w-1/3 text-left">
            <h2 className="text-3xl font-bold sm:text-5xl">
              CUSTOM SITE-WIDE CURRENCY
            </h2>
            <p className="text-xl md:text-3xl">
              Grailed Plus converts every price into whatever currency you
              actually use, sitewide and in real time. Hover any converted price
              to see the original USD value. Rates are pulled from Frankfurter
              and cached hourly so you're always working with fresh
              numbers. 
            </p>
          </div>
          <div className="max-h-full w-2/3">
            <GrailedPlusPreview
              comparisonId="custom-currency"
              scrollStartPercent={10}
              zoomAmount={1.25}
            />
          </div>
        </div>
        <div className="my-20 flex h-125 w-full flex-row">
          <div className="max-h-full w-2/3">
            <GrailedPlusPreview comparisonId="dm" />
          </div>
          <div className="mx-5 mb-4 h-full w-1/3 text-right">
            <h2 className="text-3xl font-bold sm:text-5xl">DARK MODE</h2>
            <p className="text-xl md:text-3xl">
              Fully native dark mode across every page of the site — match your
              device theme automatically or lock it permanently. Fine-tune it
              further with a custom primary color to make it yours.
              No eye strain, no jarring white flashes, just a clean browsing
              experience built for long sessions.
            </p>
          </div>
        </div>
      </div>
      <footer className="flex justify-center mt-20">
        <a href="/" className="text-overlay-ink/45">dextery.dev</a>
      </footer>
    </main>
    
  );
}
