"use client";

import {
  type MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { ArrowDown, ArrowUpRight, LoaderCircle } from "lucide-react";

import GrailedPlusLiveDemo from "@/app/components/projects/grailed-plus/grailed-plus-live-demo";
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
const CTA_MOBILE_LABEL = "View in Chrome Web Store";
const CTA_OPENING_LABEL = "Opening Chrome Web Store...";
const DEFAULT_EXTENSION_VERSION = "2.4.0";
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

const FEATURES = [
  {
    id: "market-compare",
    number: "01",
    eyebrow: "Search beyond Grailed",
    title: "Market compare",
    description:
      "Compare candidates from eBay and Depop, then refine them locally with product and image similarity.",
    fallbackComparisonId: "price-trend",
  },
  {
    id: "pricing",
    number: "02",
    eyebrow: "Buy with context",
    title: "Pricing insights",
    description:
      "Track price drops, estimate the next change, and see seller context without leaving the item page.",
    fallbackComparisonId: "price-trend",
  },
  {
    id: "currency",
    number: "03",
    eyebrow: "Think in your currency",
    title: "Site-wide conversion",
    description:
      "Choose the currency you actually use. Prices update across Grailed while the original USD value stays one hover away.",
    fallbackComparisonId: "custom-currency",
  },
  {
    id: "dark-mode",
    number: "04",
    eyebrow: "Browse after dark",
    title: "Native-feeling dark mode",
    description:
      "Match your device, keep dark mode always on, and tune the interface with a custom primary color—without white flashes between pages.",
    fallbackComparisonId: "dm",
  },
] as const;

const HERO_FEATURE_LINKS = [
  { href: "#feature-market-compare", label: "Market compare" },
  { href: "#feature-pricing", label: "Price intelligence" },
  { href: "#feature-currency", label: "Custom currency" },
  { href: "#feature-dark-mode", label: "Dark mode" },
] as const;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

type InstallLinkProps = {
  className?: string;
  isRedirecting: boolean;
  onClick: (event: ReactMouseEvent<HTMLAnchorElement>) => void;
};

function InstallLink({ className, isRedirecting, onClick }: InstallLinkProps) {
  return (
    <a
      href={PROJECT_ROUTES.grailedPlusChromeWebStore}
      aria-busy={isRedirecting}
      aria-disabled={isRedirecting}
      className={cn(
        "grailed-plus-primary group inline-flex min-h-12 items-center justify-center gap-3 px-6 py-3 text-center text-sm font-semibold tracking-[0.08em] uppercase transition-[transform,background-color,color,opacity] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--gp-ink)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--gp-canvas)] active:scale-[0.98] sm:px-8",
        !isRedirecting && "hover:-translate-y-0.5",
        isRedirecting && "pointer-events-none opacity-65",
        className,
      )}
      onClick={onClick}
    >
      {isRedirecting ? (
        <>
          <LoaderCircle
            aria-hidden
            className="h-4 w-4 animate-spin"
            strokeWidth={1.75}
          />
          <span>{CTA_OPENING_LABEL}</span>
        </>
      ) : (
        <>
          <span className="sm:hidden">{CTA_MOBILE_LABEL}</span>
          <span className="hidden sm:inline">{CTA_LABEL}</span>
          <ArrowUpRight
            aria-hidden
            className="h-4 w-4 transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            strokeWidth={1.75}
          />
        </>
      )}
    </a>
  );
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
  const [extensionVersion, setExtensionVersion] = useState(
    DEFAULT_EXTENSION_VERSION,
  );
  const handleVersionChange = useCallback((version: string | null) => {
    setExtensionVersion(version ?? DEFAULT_EXTENSION_VERSION);
  }, []);
  const redirectStartedRef = useRef(false);
  const redirectCompletedRef = useRef(false);
  const timeoutIdsRef = useRef<Set<number>>(new Set());

  const schedule = useCallback((callback: () => void, delay: number) => {
    const timeoutId = window.setTimeout(() => {
      timeoutIdsRef.current.delete(timeoutId);
      callback();
    }, delay);
    timeoutIdsRef.current.add(timeoutId);
  }, []);

  useEffect(
    () => () => {
      for (const timeoutId of timeoutIdsRef.current) {
        window.clearTimeout(timeoutId);
      }
      timeoutIdsRef.current.clear();
    },
    [],
  );

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
      schedule(redirectToStore, CLICK_REDIRECT_DELAY_MS);
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
        schedule(completeRedirect, GOOGLE_ADS_REDIRECT_FALLBACK_MS);
        return;
      }

      if (Date.now() < deadline) {
        schedule(dispatchGoogleAdsConversion, 50);
        return;
      }

      schedule(redirectToStore, CLICK_REDIRECT_DELAY_MS);
    };

    dispatchGoogleAdsConversion();
  }, [googleAdsSendTo, redirectToStore, schedule]);

  const handleInstallClick = useCallback(
    (event: ReactMouseEvent<HTMLAnchorElement>) => {
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
    },
    [beginRedirect],
  );

  return (
    <main className="grailed-plus-page min-h-dvh overflow-clip font-light">
      <p className="sr-only" aria-live="polite">
        {isRedirecting ? CTA_OPENING_LABEL : ""}
      </p>
      <section className="grailed-plus-hero grailed-plus-rule relative isolate border-b">
        <header className="grailed-plus-rule mx-auto grid min-h-14 w-full max-w-[96rem] grid-cols-[1fr_auto] items-center border-b px-5 text-[0.6875rem] font-semibold tracking-[0.16em] uppercase sm:grid-cols-3 sm:px-8 lg:px-12">
          <p>Grailed Plus</p>
          <p className="grailed-plus-muted hidden text-center sm:block">
            Browser utility / Chrome / {extensionVersion}
          </p>
          <nav
            aria-label="Grailed Plus page navigation"
            className="flex items-center justify-end gap-5"
          >
            <a
              href="#features"
              className="transition-opacity hover:opacity-55 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current"
            >
              Index
            </a>
            <a
              href={PROJECT_ROUTES.grailedPlusChromeWebStore}
              aria-busy={isRedirecting}
              aria-disabled={isRedirecting}
              onClick={handleInstallClick}
              className={cn(
                "transition-opacity hover:opacity-55 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current",
                isRedirecting && "pointer-events-none opacity-50",
              )}
            >
              {isRedirecting ? "Opening…" : "Install ↗"}
            </a>
          </nav>
        </header>

        <div className="mx-auto grid min-h-[calc(100svh-3.5rem)] w-full max-w-[96rem] items-center gap-12 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-12 lg:gap-10 lg:px-12 lg:py-16">
          <div className="relative z-10 lg:col-span-5">
            <p
              data-hero-item
              className="grailed-plus-accent mb-7 flex items-center gap-3 text-xs font-semibold tracking-[0.2em] uppercase"
            >
              <span aria-hidden className="h-px w-8 bg-current" />A sharper
              layer for Grailed
            </p>

            <h1
              data-hero-item
              className="text-[clamp(4.5rem,11vw,9.5rem)] leading-[0.78] font-black tracking-[-0.065em]"
            >
              Grailed
              <span className="sr-only"> Plus</span>
              <span
                aria-hidden
                className="grailed-plus-accent ml-[0.04em] inline-block"
              >
                +
              </span>
            </h1>

            <p
              data-hero-item
              className="grailed-plus-muted mt-8 max-w-xl text-base leading-7 sm:text-lg sm:leading-8"
            >
              Market context, local currency, and a native-feeling dark mode,
              directly inside the pages you already browse.
            </p>

            <ul
              data-hero-item
              className="grailed-plus-rule mt-8 flex flex-wrap gap-x-5 gap-y-2 border-y py-4 text-xs font-semibold tracking-[0.14em] uppercase"
              aria-label="Grailed Plus features"
            >
              {HERO_FEATURE_LINKS.map((feature) => (
                <li key={feature.href}>
                  <a
                    href={feature.href}
                    className="inline-flex min-h-11 items-center underline-offset-4 transition-opacity hover:underline hover:opacity-55 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current"
                  >
                    {feature.label}
                  </a>
                </li>
              ))}
            </ul>

            <div
              data-hero-item
              className="mt-8 flex flex-col items-stretch gap-3 min-[430px]:flex-row min-[430px]:items-center"
            >
              <InstallLink
                isRedirecting={isRedirecting}
                onClick={handleInstallClick}
              />
              <a
                href="#features"
                className="grailed-plus-secondary group inline-flex min-h-12 items-center justify-center gap-3 px-6 py-3 text-sm font-semibold tracking-[0.08em] uppercase transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-[var(--gp-ink)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--gp-canvas)]"
              >
                Explore features
                <ArrowDown
                  aria-hidden
                  className="h-4 w-4 transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-y-0.5"
                  strokeWidth={1.75}
                />
              </a>
            </div>

            <p
              data-hero-item
              className="grailed-plus-muted mt-4 text-sm leading-6"
            >
              <span className="hidden sm:inline">
                Installs from the official Chrome Web Store.
              </span>
              <span className="sm:hidden">
                Chrome extensions install on desktop. Open the Store now or
                revisit this page on your computer.
              </span>
            </p>
          </div>

          <div data-hero-preview className="min-w-0 lg:col-span-7 lg:pl-4">
            <div className="grailed-plus-rule mb-3 flex items-end justify-between gap-5 border-b pb-3">
              <p className="text-xs font-semibold tracking-[0.18em] uppercase">
                Live product
              </p>
              <p className="grailed-plus-muted text-right text-xs">
                Running the extension’s current UI source.
              </p>
            </div>
            <div className="grailed-plus-preview-frame overflow-hidden">
              <GrailedPlusLiveDemo
                eager
                feature="overview"
                fallbackComparisonId="price-trend"
                onVersionChange={handleVersionChange}
                title="Live overview of the current Grailed Plus extension interface"
              />
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="scroll-mt-0">
        <header className="mx-auto grid max-w-[96rem] gap-8 px-5 py-20 sm:px-8 sm:py-24 lg:grid-cols-12 lg:px-12 lg:py-32">
          <p className="grailed-plus-accent text-xs font-semibold tracking-[0.2em] uppercase lg:col-span-3">
            Feature index
          </p>
          <div className="lg:col-span-6">
            <h2 className="text-[clamp(2.8rem,6vw,6rem)] leading-[0.92] font-bold tracking-[-0.045em]">
              Four upgrades.
              <br />
              Zero workflow change.
            </h2>
          </div>
          <p className="grailed-plus-muted max-w-md text-base leading-7 lg:col-span-3 lg:pt-2">
            Grailed Plus works where the decision happens—inside listings,
            search results, and messages—not in another tab.
          </p>
        </header>

        <div className="mx-auto max-w-[96rem] px-5 sm:px-8 lg:px-12">
          {FEATURES.map((feature, index) => {
            const textOnLeft = index % 2 === 0;

            return (
              <article
                key={feature.id}
                id={`feature-${feature.id}`}
                className="grailed-plus-rule grid gap-10 border-t py-16 sm:py-20 lg:grid-cols-12 lg:gap-12 lg:py-28"
              >
                <div
                  className={cn(
                    "min-w-0 lg:sticky lg:top-10 lg:col-span-4 lg:self-start",
                    textOnLeft ? "lg:order-1" : "lg:order-2",
                  )}
                >
                  <div className="flex items-start justify-between gap-6">
                    <p className="grailed-plus-accent text-xs font-semibold tracking-[0.2em] uppercase">
                      {feature.eyebrow}
                    </p>
                    <span
                      aria-hidden
                      className="grailed-plus-muted font-display text-sm"
                    >
                      / {feature.number}
                    </span>
                  </div>
                  <h3 className="mt-6 max-w-md text-[clamp(2.5rem,5vw,5rem)] leading-[0.92] font-bold tracking-[-0.045em]">
                    {feature.title}
                  </h3>
                  <p className="grailed-plus-muted mt-6 max-w-lg text-base leading-7 sm:text-lg sm:leading-8">
                    {feature.description}
                  </p>
                </div>

                <div
                  className={cn(
                    "min-w-0 lg:col-span-8",
                    textOnLeft ? "lg:order-2" : "lg:order-1",
                  )}
                >
                  <div className="grailed-plus-preview-frame overflow-hidden">
                    <GrailedPlusLiveDemo
                      feature={feature.id}
                      fallbackComparisonId={feature.fallbackComparisonId}
                      title={`Live Grailed Plus ${feature.title} demo`}
                    />
                  </div>
                  <p className="grailed-plus-muted mt-3 text-xs leading-5">
                    Live from the extension repository. Interactions use
                    deterministic sample data and never contact a marketplace.
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="grailed-plus-rule border-y">
        <div className="mx-auto grid max-w-[96rem] items-end gap-10 px-5 py-20 sm:px-8 sm:py-24 lg:grid-cols-12 lg:px-12 lg:py-32">
          <div className="lg:col-span-8">
            <p className="grailed-plus-accent mb-6 text-xs font-semibold tracking-[0.2em] uppercase">
              Ready when you are
            </p>
            <h2 className="max-w-5xl text-[clamp(3rem,7.5vw,7.5rem)] leading-[0.88] font-black tracking-[-0.055em]">
              Make every listing tell you more.
            </h2>
          </div>
          <div className="lg:col-span-4 lg:justify-self-end">
            <InstallLink
              className="w-full min-[430px]:w-auto"
              isRedirecting={isRedirecting}
              onClick={handleInstallClick}
            />
            <p className="grailed-plus-muted mt-4 max-w-sm text-sm leading-6">
              Official Chrome Web Store install. No automatic redirect.
            </p>
          </div>
        </div>
      </section>

      <footer className="mx-auto flex max-w-[96rem] flex-col gap-3 px-5 py-8 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
        <p className="grailed-plus-muted">Grailed Plus for Chrome</p>
        <Link
          href={PROJECT_ROUTES.home}
          className="w-fit font-medium underline decoration-[var(--gp-rule)] underline-offset-4 transition-colors hover:text-[var(--gp-accent)]"
        >
          dextery.dev
        </Link>
      </footer>
    </main>
  );
}
