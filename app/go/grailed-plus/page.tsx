import type { Metadata } from "next";
import Script from "next/script";

import { PROJECT_ROUTES } from "@/app/components/projects/project-routes";
import { SITE_ORIGIN } from "@/lib/site-config";
import GrailedPlusInstallRedirect from "./grailed-plus-install-redirect";

const DEFAULT_GOOGLE_ADS_ID = "AW-18008800880";

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
  undefined;
const googleAdsSendTo =
  googleAdsId && googleAdsInstallLabel
    ? `${googleAdsId}/${googleAdsInstallLabel}`
    : undefined;

export const metadata: Metadata = {
  title: "Grailed Plus Install",
  description: "Redirect page for the Grailed Plus Chrome Web Store listing.",
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
