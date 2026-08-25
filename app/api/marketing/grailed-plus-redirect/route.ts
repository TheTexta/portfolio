import { track } from "@vercel/analytics/server";

import { PROJECT_ROUTES } from "@/app/components/projects/project-routes";

const TRACKABLE_STRING_KEYS = [
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
  "referrer",
  "redirectMode",
] as const;

type RedirectTrackingRequest = Partial<
  Record<(typeof TRACKABLE_STRING_KEYS)[number], unknown>
> & {
  autoRedirectEnabled?: unknown;
};

function readString(value: unknown, maxLength = 240) {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  if (!normalized) {
    return undefined;
  }

  return normalized.slice(0, maxLength);
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | RedirectTrackingRequest
    | null;

  const properties = Object.fromEntries(
    TRACKABLE_STRING_KEYS.flatMap((key) => {
      const value = readString(body?.[key], key === "referrer" ? 600 : 240);
      return value ? [[key, value]] : [];
    }),
  );

  await track("grailed_plus_install_redirect", {
    ...properties,
    autoRedirectEnabled: body?.autoRedirectEnabled === true,
    destination: PROJECT_ROUTES.grailedPlusChromeWebStore,
    sourcePath: PROJECT_ROUTES.grailedPlus,
  });

  return new Response(null, { status: 204 });
}
