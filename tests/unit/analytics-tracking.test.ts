import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/marketing/grailed-plus-redirect/route";

const contextKey = Symbol.for("@vercel/request-context");
const originalContext = Object.getOwnPropertyDescriptor(globalThis, contextKey);
let pending: Promise<unknown>[];
const send = vi.fn(async () => new Response("ok"));

beforeEach(() => {
  pending = [];
  vi.stubEnv(
    "VERCEL_WEB_ANALYTICS_ENDPOINT",
    "https://analytics.example.test/event",
  );
  vi.stubEnv("VERCEL_AUTOMATION_BYPASS_SECRET", "");
  vi.stubGlobal("fetch", send);
  Object.defineProperty(globalThis, contextKey, {
    configurable: true,
    value: {
      get: () => ({
        url: "https://portfolio.example.test/grailed-plus",
        headers: new Headers({
          "user-agent": "offline-regression",
          cookie: "synthetic-only",
        }),
        waitUntil: (promise: Promise<unknown>) => pending.push(promise),
      }),
    },
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  if (originalContext)
    Object.defineProperty(globalThis, contextKey, originalContext);
  else Reflect.deleteProperty(globalThis, contextKey);
});

describe("actual Analytics 2 server tracking with synthetic request context", () => {
  it("preserves the install event and primitive allowlisted properties without network I/O", async () => {
    const response = await POST(
      new Request(
        "https://portfolio.example.test/api/marketing/grailed-plus-redirect",
        {
          method: "POST",
          body: JSON.stringify({
            utm_source: "  portfolio  ",
            utm_campaign: "x".repeat(300),
            autoRedirectEnabled: true,
            unexpected: "discard",
            referrer: { nested: true },
          }),
        },
      ),
    );
    await Promise.all(pending);
    expect(response.status).toBe(204);
    expect(send).toHaveBeenCalledTimes(1);
    const [url, init] = send.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://analytics.example.test/event");
    const event = JSON.parse(String(init.body));
    expect(event.en).toBe("grailed_plus_install_redirect");
    expect(event.ed).toEqual({
      utm_source: "portfolio",
      utm_campaign: "x".repeat(240),
      autoRedirectEnabled: true,
      destination:
        "https://chromewebstore.google.com/detail/grailed-plus/bgblnhmkbofpgmibnogimfheipedkegd",
      sourcePath: "/grailed-plus",
    });
    expect(event.sdkn).toBe("@vercel/analytics/server");
  });
});
