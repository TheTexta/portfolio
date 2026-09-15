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
import { useTheme } from "@/app/components/theme/theme-provider";
import { PROJECT_ROUTES } from "@/app/components/projects/project-routes";
import { EditorialContainer, SiteHeader } from "@/app/components/ui/editorial";
import ThemeToggle from "@/app/components/ui/theme-toggle";
import { cn } from "@/lib/cn";

type GrailedPlusInstallPageProps = {
  googleAdsSendTo?: string;
  heroOnly?: boolean;
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
  },
  {
    id: "pricing",
    number: "02",
    eyebrow: "Buy with context",
    title: "Pricing insights",
    description:
      "Track price drops, estimate the next change, and see seller context without leaving the item page.",
  },
  {
    id: "currency",
    number: "03",
    eyebrow: "Think in your currency",
    title: "Site-wide conversion",
    description:
      "Choose the currency you actually use. Prices update across Grailed while the original USD value stays one hover away.",
  },
  {
    id: "dark-mode",
    number: "04",
    eyebrow: "Browse after dark",
    title: "Native-feeling dark mode",
    description:
      "Match your device, keep dark mode always on, and tune the interface with a custom primary color—without white flashes between pages.",
  },
] as const;

const HERO_FEATURE_LINKS = [
  { href: "#feature-market-compare", label: "Market compare" },
  { href: "#feature-pricing", label: "Price intelligence" },
  { href: "#feature-currency", label: "Custom currency" },
  { href: "#feature-dark-mode", label: "Dark mode" },
] as const;

const heroItemClass =
  "animate-[editorial-enter_700ms_cubic-bezier(0.16,1,0.3,1)_both]";

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
        "group inline-flex min-h-12 items-center justify-center gap-3 bg-ink px-6 py-3 text-center text-sm font-semibold tracking-[0.08em] text-canvas uppercase transition-[transform,background-color,color,opacity] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] outline-none hover:bg-action-hover hover:text-canvas focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus active:scale-[0.98] sm:px-8",
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
            className="size-4 animate-spin"
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
            className="size-4 transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
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

export default function GrailedPlusInstallPage({
  googleAdsSendTo,
  heroOnly = false,
}: GrailedPlusInstallPageProps) {
  const { darkMode } = useTheme();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const demoCurrency = "USD" as const;
  const demoDarkMode = darkMode;
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

  useEffect(() => {
    if (window.location.hash) {
      return;
    }

    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
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
    <main className="product-landing min-h-dvh overflow-clip bg-canvas font-light text-ink">
      <p className="sr-only" aria-live="polite">
        {isRedirecting ? CTA_OPENING_LABEL : ""}
      </p>
      {!heroOnly ? (
        <SiteHeader
          brand="dextery.dev"
          brandHref={PROJECT_ROUTES.home}
          ariaLabel="Grailed Plus page navigation"
          sticky={true}
        >
          <a
            href="#features"
            className="hidden min-h-7 items-center transition-opacity hover:opacity-55 min-[430px]:flex"
          >
            Index
          </a>
          <a
            href={PROJECT_ROUTES.grailedPlusChromeWebStore}
            aria-busy={isRedirecting}
            aria-disabled={isRedirecting}
            onClick={handleInstallClick}
            className={cn(
              "flex min-h-7 items-center transition-opacity hover:opacity-55",
              isRedirecting && "pointer-events-none opacity-50",
            )}
          >
            {isRedirecting ? "Opening…" : "Install ↗"}
          </a>
          <ThemeToggle />
        </SiteHeader>
      ) : null}
      <section className="product-landing-hero relative isolate border-b border-rule">
        <EditorialContainer className="grid min-h-[calc(100svh-3rem)] items-start gap-12 py-16 sm:py-20 lg:grid-cols-12 lg:gap-10 lg:py-8">
          <div className="relative z-10 lg:col-span-5 lg:py-8">
            <p
              className={cn(
                heroItemClass,
                "mb-7 flex items-center gap-3 text-xs font-semibold tracking-[0.2em] text-ink uppercase",
              )}
            >
              <span aria-hidden className="h-px w-8 bg-current" />A sharper
              layer for Grailed
            </p>

            <h1
              className={cn(
                heroItemClass,
                "text-[clamp(4.5rem,11vw,9.5rem)] leading-[0.78] font-black tracking-[-0.065em] [animation-delay:70ms]",
              )}
            >
              Grailed
              <span className="sr-only"> Plus</span>
              <span aria-hidden className="ml-[0.04em] inline-block text-ink">
                +
              </span>
            </h1>

            <p
              className={cn(
                heroItemClass,
                "mt-8 max-w-xl text-base leading-7 text-muted [animation-delay:140ms] sm:text-lg sm:leading-8",
              )}
            >
              Market context, local currency, and a native-feeling dark mode,
              directly inside the pages you already browse.
            </p>

            <ul
              className={cn(
                heroItemClass,
                "mt-8 flex flex-wrap gap-x-5 gap-y-2 border-y border-rule py-4 text-xs font-semibold tracking-[0.14em] uppercase [animation-delay:210ms]",
              )}
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
              className={cn(
                heroItemClass,
                "mt-8 flex flex-col items-stretch gap-3 [animation-delay:280ms] min-[430px]:flex-row min-[430px]:items-center",
              )}
            >
              <InstallLink
                isRedirecting={isRedirecting}
                onClick={handleInstallClick}
              />
              <a
                href="#features"
                className="group inline-flex min-h-12 items-center justify-center gap-3 border border-rule px-6 py-3 text-sm font-semibold tracking-[0.08em] text-ink uppercase transition-colors duration-200 outline-none hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                Explore features
                <ArrowDown
                  aria-hidden
                  className="size-4 transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-y-0.5"
                  strokeWidth={1.75}
                />
              </a>
            </div>

            <p
              className={cn(
                heroItemClass,
                "mt-4 text-sm leading-6 text-muted [animation-delay:350ms]",
              )}
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

          <div className="min-w-0 animate-[editorial-preview-enter_760ms_cubic-bezier(0.16,1,0.3,1)_260ms_both] lg:col-span-6 lg:col-start-7">
            <div className="flex flex-col gap-3">
              {/*<div className="border-rule flex items-end justify-between gap-5 border-b pb-3">
              <p className="text-xs font-semibold tracking-[0.18em] uppercase">
                Live product
              </p>
              <p className="text-muted text-right text-xs">
                Running the extension’s current UI source.
              </p>
            </div>*/}
              <div className="overflow-hidden border border-rule bg-transparent">
                <GrailedPlusLiveDemo
                  eager
                  currencyCode={demoCurrency}
                  darkModeEnabled={demoDarkMode}
                  parentDarkMode={darkMode}
                  feature="overview"
                  title="Live overview of the current Grailed Plus extension interface"
                />
              </div>
            </div>
          </div>
        </EditorialContainer>
      </section>

      {!heroOnly ? (
        <>
          <section id="features" className="scroll-mt-0">
            <EditorialContainer
              as="header"
              className="grid gap-8 py-20 sm:py-24 lg:grid-cols-12 lg:py-32"
            >
              <p className="text-xs font-semibold tracking-[0.2em] text-ink uppercase lg:col-span-3">
                Feature index
              </p>
              <div className="lg:col-span-6">
                <h2 className="text-[clamp(2.8rem,6vw,6rem)] leading-[0.92] font-bold tracking-[-0.045em]">
                  Four upgrades.
                  <br />
                  Zero workflow change.
                </h2>
              </div>
              <p className="max-w-md text-base leading-7 text-muted lg:col-span-3 lg:pt-2">
                Grailed Plus works where the decision happens—inside listings,
                search results, and messages—not in another tab.
              </p>
            </EditorialContainer>

            <EditorialContainer>
              {FEATURES.map((feature, index) => {
                const textOnLeft = index % 2 === 0;

                return (
                  <article
                    key={feature.id}
                    id={`feature-${feature.id}`}
                    className="grid snap-y snap-mandatory snap-start gap-10 border-t border-rule py-16 sm:py-20 lg:grid-cols-12 lg:gap-12 lg:py-28"
                  >
                    <div
                      className={cn(
                        "min-w-0 lg:top-10 lg:col-span-4 lg:self-start",
                        textOnLeft ? "lg:order-1" : "lg:order-2",
                      )}
                    >
                      <div className="flex items-start justify-between gap-6">
                        <p className="text-xs font-semibold tracking-[0.2em] text-ink uppercase">
                          {feature.eyebrow}
                        </p>
                        <span
                          aria-hidden
                          className="font-display text-sm text-muted"
                        >
                          / {feature.number}
                        </span>
                      </div>
                      <h3 className="mt-6 max-w-md text-[clamp(2.5rem,5vw,5rem)] leading-[0.92] font-bold tracking-[-0.045em]">
                        {feature.title}
                      </h3>
                      <p className="mt-6 max-w-lg text-base leading-7 text-muted sm:text-lg sm:leading-8">
                        {feature.description}
                      </p>
                    </div>

                    <div
                      className={cn(
                        "min-w-0 lg:col-span-8",
                        textOnLeft ? "lg:order-2" : "lg:order-1",
                      )}
                    >
                      <div className="overflow-hidden border border-rule bg-transparent">
                        <GrailedPlusLiveDemo
                          currencyCode={demoCurrency}
                          darkModeEnabled={demoDarkMode}
                          parentDarkMode={darkMode}
                          feature={feature.id}
                          title={`Live Grailed Plus ${feature.title} demo`}
                        />
                      </div>
                    </div>
                  </article>
                );
              })}
            </EditorialContainer>
          </section>

          <section className="border-y border-rule">
            <EditorialContainer className="grid items-end gap-10 py-20 sm:py-24 lg:grid-cols-12 lg:py-32">
              <div className="lg:col-span-8">
                <p className="mb-6 text-xs font-semibold tracking-[0.2em] text-ink uppercase">
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
                <p className="mt-4 max-w-sm text-sm leading-6 text-muted">
                  Official Chrome Web Store install. No subscription or hidden
                  payments required. Grailed Plus is completely free to use.
                </p>
              </div>
            </EditorialContainer>
          </section>

          <EditorialContainer
            as="footer"
            className="flex min-h-8 flex-col gap-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <p className="text-muted">Grailed Plus for Chrome</p>
            <Link
              href={PROJECT_ROUTES.home}
              className="w-fit font-medium underline decoration-rule underline-offset-4 transition-colors hover:text-action-hover"
            >
              dextery.dev
            </Link>
          </EditorialContainer>
        </>
      ) : null}
    </main>
  );
}
