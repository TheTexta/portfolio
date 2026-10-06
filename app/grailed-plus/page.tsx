import Script from "next/script";

import GrailedPlusInstallPage from "@/app/components/projects/grailed-plus/grailed-plus-install-page";
import StructuredData from "@/app/components/structured-data";
import {
  createPageMetadata,
  createPageStructuredData,
  PUBLIC_PAGES,
} from "@/lib/seo";

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

export const metadata = createPageMetadata(PUBLIC_PAGES.grailedPlus);

type GrailedPlusPageProps = {
  searchParams: Promise<{
    view?: string | string[];
  }>;
};

export default async function Page({ searchParams }: GrailedPlusPageProps) {
  const { view } = await searchParams;
  const heroOnly = view === "hero";

  return (
    <>
      <StructuredData
        data={createPageStructuredData(PUBLIC_PAGES.grailedPlus)}
      />
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
      <GrailedPlusInstallPage
        googleAdsSendTo={googleAdsSendTo}
        heroOnly={heroOnly}
      />
    </>
  );
}
