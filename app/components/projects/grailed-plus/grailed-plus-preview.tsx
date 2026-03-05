"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { getProjectChrome } from "@/app/components/projects/project-chrome";
import { PROJECT_ROUTES } from "@/app/components/projects/project-routes";
import { useTheme } from "@/app/components/theme/theme-provider";
import OverlayNavBar from "@/app/components/ui/overlay-nav-bar";
import { cn } from "@/lib/cn";

type GrailedPlusPreviewProps = {
  forcedDarkMode?: boolean;
};

type PreviewPanelId = "pricing" | "currency" | "theme";

type PanelContent = {
  label: string;
  heading: string;
  body: string;
  rows: Array<{
    metric: string;
    title: string;
    detail: string;
  }>;
  shipped: string[];
};

const PANEL_ORDER: PreviewPanelId[] = ["pricing", "currency", "theme"];

const PANEL_CONTENT: Record<PreviewPanelId, PanelContent> = {
  pricing: {
    label: "Pricing",
    heading: "Price history restored on listing pages",
    body: "Listing data is extracted from the page and normalized into pricing insights directly in the extension panel.",
    rows: [
      {
        metric: "Before",
        title: "No practical pricing context",
        detail:
          "Historical pricing signals disappeared from modern listing pages.",
      },
      {
        metric: "After",
        title: "Sidebar analytics panel",
        detail:
          "Price history, average drop, and next expected drop estimate are visible at a glance.",
      },
      {
        metric: "Impact",
        title: "Faster buy/sell decisions",
        detail:
          "Users can compare momentum and make offers with better context.",
      },
    ],
    shipped: [
      "Price history",
      "Average price drop",
      "Next expected drop estimate",
      "Listing metadata JSON button",
      "Seller account creation date",
    ],
  },
  currency: {
    label: "Currency",
    heading: "Automatic USD conversion with cached rates",
    body: "Users choose a target currency in settings and converted pricing is displayed with tooltips for original USD values.",
    rows: [
      {
        metric: "Before",
        title: "Manual mental conversion",
        detail: "International buyers had to switch tools to compare prices.",
      },
      {
        metric: "After",
        title: "Inline converted values",
        detail:
          "USD prices are converted with source values preserved on hover.",
      },
      {
        metric: "Impact",
        title: "Less friction across regions",
        detail:
          "Local currency context reduces errors and speeds up evaluation.",
      },
    ],
    shipped: [
      "Currency toggle in settings",
      "Custom 3-letter currency support",
      "Exchange rate cache in chrome.storage.local",
      "Stale cache fallback behavior",
    ],
  },
  theme: {
    label: "Theme",
    heading: "Site-wide dark mode with custom primary color",
    body: "Dark mode is applied at the page level with configurable behavior and a controlled color tint system.",
    rows: [
      {
        metric: "Before",
        title: "No consistent night workflow",
        detail:
          "Grailed sessions at night had inconsistent contrast and hard-to-read panels.",
      },
      {
        metric: "After",
        title: "Configurable dark mode",
        detail:
          "Users can match device theme or force permanent dark mode with a custom hue.",
      },
      {
        metric: "Impact",
        title: "Lower visual fatigue",
        detail:
          "Better contrast and color control make long sessions easier to sustain.",
      },
    ],
    shipped: [
      "Match device theme",
      "Permanent dark mode",
      "Custom primary color",
      "Media-safe counter filtering",
      "Pure-black overscroll backdrop",
    ],
  },
};

const CHROME_WEB_STORE_URL = "TODO: add chrome web store url";
const FIREFOX_ADDON_URL = "TODO: add firefox addon url";
const GITHUB_REPO_URL = "https://github.com/TheTexta/grailed-plus";

export default function GrailedPlusPreview({
  forcedDarkMode,
}: GrailedPlusPreviewProps) {
  const pathname = usePathname();
  const { darkMode: siteDarkMode, toggleTheme } = useTheme();
  const [activePanel, setActivePanel] = useState<PreviewPanelId>("pricing");

  const isFullPageRoute = pathname === PROJECT_ROUTES.grailedPlus;
  const darkMode = forcedDarkMode ?? siteDarkMode;
  const chrome = getProjectChrome("grailed-plus", darkMode);
  const panel = PANEL_CONTENT[activePanel];

  return (
    <div
      className={`relative h-full w-full overflow-hidden rounded-[inherit] transition-colors ${chrome.shell}`}
    >
      <OverlayNavBar
        darkMode={isFullPageRoute ? darkMode : undefined}
        onToggleDarkMode={
          isFullPageRoute && forcedDarkMode === undefined
            ? toggleTheme
            : undefined
        }
        expandHref={isFullPageRoute ? undefined : PROJECT_ROUTES.grailedPlus}
        exitHref={isFullPageRoute ? PROJECT_ROUTES.home : undefined}
        toneClass={chrome.overlay}
        ariaLabel="grailed plus controls"
      />

      <div className="h-full overflow-y-auto p-4 pt-12 md:p-6 md:pt-14">
        <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col gap-5">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <div>
              <p className="text-[11px] uppercase tracking-[0.35em] opacity-60">
                Browser extension
              </p>
              <h3 className="mt-2 text-2xl font-semibold md:text-3xl">
                Grailed Plus
              </h3>
              <p className="mt-3 max-w-2xl text-sm opacity-80 md:text-base">
                Grailed Plus (V2) restores pricing intelligence on modern
                grailed.com listings with drop metrics, metadata tooling, and
                configurable currency and theme controls.
              </p>
            </div>

            <section className={`rounded-2xl border p-4 ${chrome.surface}`}>
              <p className="text-xs uppercase tracking-[0.25em] opacity-60">
                Preview loop
              </p>
              <div
                className={cn(
                  "relative mt-3 overflow-hidden rounded-xl border border-black/10 bg-[radial-gradient(circle_at_top,_rgba(251,146,60,0.28),_transparent_55%),linear-gradient(170deg,#111111_0%,#2b1d10_100%)]",
                  darkMode ? "border-white/10" : "border-black/10",
                )}
              >
                <video
                  className="aspect-video w-full object-cover"
                  autoPlay
                  loop
                  muted
                  playsInline
                  preload={isFullPageRoute ? "auto" : "metadata"}
                  poster="/projects/grailed-plus/poster.webp"
                >
                  <source
                    src="/projects/grailed-plus/preview.webm"
                    type="video/webm"
                  />
                  <source
                    src="/projects/grailed-plus/preview.mp4"
                    type="video/mp4"
                  />
                </video>
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-black/10 to-transparent" />
                <p className="absolute bottom-2 left-2 right-2 rounded-md bg-black/50 px-2 py-1 text-[10px] text-white/85">
                  Drop your capture into
                  `/public/projects/grailed-plus/preview.webm` and
                  `poster.webp`.
                </p>
              </div>
            </section>
          </div>

          <section
            className={`rounded-3xl border p-5 md:p-6 ${chrome.surface}`}
          >
            <div className="flex flex-wrap gap-2">
              {PANEL_ORDER.map((panelId) => (
                <button
                  key={panelId}
                  type="button"
                  onClick={() => setActivePanel(panelId)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs uppercase tracking-[0.2em] transition-colors",
                    chrome.button,
                    panelId === activePanel && "ring-1 ring-current",
                  )}
                >
                  {PANEL_CONTENT[panelId].label}
                </button>
              ))}
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[1.1fr_minmax(0,1fr)]">
              <article
                className={`rounded-2xl border p-4 md:p-5 ${chrome.item}`}
              >
                <p className="text-xs uppercase tracking-[0.25em] opacity-60">
                  Interactive mock
                </p>
                <h4 className="mt-2 text-xl font-semibold">{panel.heading}</h4>
                <p className="mt-2 text-sm opacity-80">{panel.body}</p>

                <ul className="mt-4 space-y-2">
                  {panel.rows.map((row) => (
                    <li
                      key={row.title}
                      className={`rounded-xl border px-3 py-2 ${chrome.item}`}
                    >
                      <p className="text-[10px] uppercase tracking-[0.2em] opacity-60">
                        {row.metric}
                      </p>
                      <p className="mt-1 text-sm font-medium">{row.title}</p>
                      <p className="text-xs opacity-75">{row.detail}</p>
                    </li>
                  ))}
                </ul>
              </article>

              <aside className={`rounded-2xl border p-4 md:p-5 ${chrome.item}`}>
                <p className="text-xs uppercase tracking-[0.25em] opacity-60">
                  Shipped features
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {panel.shipped.map((feature) => (
                    <span
                      key={feature}
                      className={`rounded-full border px-3 py-1 text-xs ${chrome.item}`}
                    >
                      {feature}
                    </span>
                  ))}
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  {GITHUB_REPO_URL ? (
                    <Link
                      href={GITHUB_REPO_URL}
                      target="_blank"
                      rel="noreferrer"
                      className={`rounded-full border px-3 py-2 text-xs uppercase tracking-[0.2em] transition-colors ${chrome.button}`}
                    >
                      GitHub
                    </Link>
                  ) : (
                    <span
                      className={`rounded-full border px-3 py-2 text-xs uppercase tracking-[0.2em] ${chrome.item}`}
                    >
                      Add GitHub URL
                    </span>
                  )}
                  <Link
                    href={CHROME_WEB_STORE_URL}
                    target="_blank"
                    rel="noreferrer"
                    className={`rounded-full border px-3 py-2 text-xs uppercase tracking-[0.2em] transition-colors ${chrome.button}`}
                  >
                    Chrome Store
                  </Link>
                  <Link
                    href={FIREFOX_ADDON_URL}
                    target="_blank"
                    rel="noreferrer"
                    className={`rounded-full border px-3 py-2 text-xs uppercase tracking-[0.2em] transition-colors ${chrome.button}`}
                  >
                    Firefox Add-on
                  </Link>
                </div>

                {!isFullPageRoute ? (
                  <p className="mt-4 text-xs opacity-65">
                    Expand this card for the full-screen version.
                  </p>
                ) : null}

                {isFullPageRoute ? (
                  <div className="mt-5 border-t border-current/15 pt-4">
                    <p className="text-xs uppercase tracking-[0.25em] opacity-60">
                      Planned next
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {[
                        "Price history graph view",
                        "Depop autocomparison",
                        "Better hover inspect",
                        "Updated logo and screenshots",
                      ].map((item) => (
                        <span
                          key={item}
                          className={`rounded-full border px-3 py-1 text-xs ${chrome.item}`}
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </aside>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
