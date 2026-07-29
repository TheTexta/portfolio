import type { Metadata } from "next";
import Script from "next/script";

import { PROJECT_ROUTES } from "@/app/components/projects/project-routes";
import { SITE_ORIGIN } from "@/lib/site-config";
import GrailedPlusInstallRedirect from "./grailed-plus-install-redirect";

const DEFAULT_GOOGLE_ADS_ID = "AW-18008800880";
const DEFAULT_GOOGLE_ADS_GRAILED_PLUS_INSTALL_LABEL = "96j6CPOdxIwcEPD8oYtD";
const DEFAULT_GRAILED_PLUS_DEMO_ORIGIN =
  "https://grailed-plus-demo.dextery.dev";

function normalizeGoogleAdsId(value: string | undefined) {
  const normalized = value?.trim();
  if (!normalized) {
    return undefined;
  }

  return normalized.startsWith("AW-") ? normalized : `AW-${normalized}`;
}

const googleAdsId =
  normalizeGoogleAdsId(process.env.NEXT_PUBLIC_GOOGLE_ADS_ID) ??
  DEFAULT_GOOGLE_ADS_ID;
const googleAdsInstallLabel =
  process.env.NEXT_PUBLIC_GOOGLE_ADS_GRAILED_PLUS_INSTALL_LABEL?.trim() ||
  DEFAULT_GOOGLE_ADS_GRAILED_PLUS_INSTALL_LABEL;
const googleAdsSendTo =
  googleAdsId && googleAdsInstallLabel
    ? `${googleAdsId}/${googleAdsInstallLabel}`
    : undefined;

function normalizeDemoOrigin(value: string | undefined) {
  try {
    const url = new URL(value || DEFAULT_GRAILED_PLUS_DEMO_ORIGIN);
    if (url.protocol === "https:" || url.protocol === "http:") {
      return url.origin;
    }
  } catch {
    // Fall through to the production origin when an environment value is invalid.
  }

  return DEFAULT_GRAILED_PLUS_DEMO_ORIGIN;
}

const grailedPlusDemoOrigin = normalizeDemoOrigin(
  process.env.NEXT_PUBLIC_GRAILED_PLUS_DEMO_ORIGIN,
);

export const metadata: Metadata = {
  title:
    "Grailed Plus — Price Insights, Market Compare, Currency, and Dark Mode",
  description:
    "Explore live Grailed Plus demos for price insights, market comparison, custom currency conversion, seller context, and dark mode.",
  alternates: {
    canonical: `${SITE_ORIGIN}${PROJECT_ROUTES.grailedPlusInstall}`,
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function Page() {
  return (
    <>
      <link rel="preconnect" href={grailedPlusDemoOrigin} />
      {googleAdsId ? (
        <>
          <Script
            id="google-ads-loader"
            src={`https://www.googletagmanager.com/gtag/js?id=${googleAdsId}`}
            strategy="afterInteractive"
          />
          <Script id="google-ads-init" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              window.gtag = window.gtag || gtag;
              window.gtag("js", new Date());
              window.gtag("config", "${googleAdsId}");
            `}
          </Script>
        </>
      ) : null}
      <GrailedPlusInstallRedirect googleAdsSendTo={googleAdsSendTo} />
    </>
  );
}
