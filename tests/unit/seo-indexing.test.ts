import { describe, expect, it } from "vitest";

import {
  checkCanonicalRedirect,
  checkPublicHtml,
} from "@/scripts/seo/indexing-checks";

const canonical = "https://dextery.dev/portfolio";
const canonicalLink = `<link rel="canonical" href="${canonical}">`;

function documentHtml(head = canonicalLink, body = "") {
  return `<!doctype html><html><head><title>Portfolio</title><meta name="description" content="Portfolio description">${head}</head><body><main><h1>Dexter Young</h1><p>${"Server-rendered project content. ".repeat(10)}</p>${body}</main></body></html>`;
}

function checkHtml(html: string) {
  return checkPublicHtml(
    html,
    new Response(html, { headers: { "content-type": "text/html" } }),
    canonical,
  );
}

describe("public-page canonical validation", () => {
  it("accepts exactly one matching canonical inside head", () => {
    expect(checkHtml(documentHtml()).headCanonicals).toEqual([canonical]);
  });

  it("rejects a canonical emitted only in the body", () => {
    expect(() => checkHtml(documentHtml("", canonicalLink))).toThrow(
      "Expected exactly one canonical URL inside <head>",
    );
  });

  it("rejects duplicate canonicals inside head", () => {
    expect(() => checkHtml(documentHtml(canonicalLink.repeat(2)))).toThrow(
      "Expected exactly one canonical URL inside <head>",
    );
  });

  it("rejects an additional canonical outside head", () => {
    expect(() => checkHtml(documentHtml(canonicalLink, canonicalLink))).toThrow(
      "Expected exactly one canonical URL in the document",
    );
  });

  it("rejects a different canonical", () => {
    expect(() =>
      checkHtml(
        documentHtml('<link rel="canonical" href="https://example.com">'),
      ),
    ).toThrow("Expected exactly one canonical URL inside <head>");
  });

  it("ignores script payloads, styles, and comments", () => {
    const payload = `<script>${JSON.stringify(canonicalLink)}</script><style>/* ${canonicalLink} */</style><!-- ${canonicalLink} -->`;
    expect(checkHtml(documentHtml(canonicalLink, payload)).canonicals).toEqual([
      canonical,
    ]);
  });

  it("does not count SVG accessibility titles as document titles", () => {
    expect(
      checkHtml(
        documentHtml(
          canonicalLink,
          "<svg><title>Graph node description</title></svg>",
        ),
      ).titles,
    ).toEqual(["Portfolio"]);
  });

  it("does not accept an SVG title in place of a document title", () => {
    expect(() =>
      checkHtml(
        documentHtml(
          canonicalLink,
          "<svg><title>Graph node description</title></svg>",
        ).replace("<title>Portfolio</title>", ""),
      ),
    ).toThrow("Expected one title");
  });
});

const redirectSource = new URL(
  "http://www.dextery.dev/grailed-plus?view=hero&x=1",
);
const redirectDestination = new URL(
  "https://dextery.dev/grailed-plus?view=hero&x=1",
);

function redirect(location: string, status = 308) {
  return new Response(null, { status, headers: { location } });
}

describe("production canonical redirect chains", () => {
  it("allows HTTP to HTTPS to non-www while preserving path and query", async () => {
    const requested: string[] = [];
    await checkCanonicalRedirect(
      redirectSource,
      redirectDestination,
      async (url) => {
        requested.push(url.href);
        if (url.protocol === "http:") {
          return redirect("https://www.dextery.dev/grailed-plus?view=hero&x=1");
        }
        if (url.hostname.startsWith("www.")) {
          return redirect(redirectDestination.href, 301);
        }
        return new Response("ok");
      },
    );
    expect(requested).toEqual([
      redirectSource.href,
      "https://www.dextery.dev/grailed-plus?view=hero&x=1",
      redirectDestination.href,
    ]);
  });

  it.each([
    ["path", "https://dextery.dev/portfolio?view=hero&x=1"],
    ["query", "https://dextery.dev/grailed-plus?view=hero"],
    ["fragment", `${redirectDestination.href}#unexpected`],
  ])("rejects a changed %s", async (field, location) => {
    await expect(
      checkCanonicalRedirect(redirectSource, redirectDestination, async () =>
        redirect(location),
      ),
    ).rejects.toThrow(`Redirect changed ${field}`);
  });

  it.each([
    "http://dextery.dev/grailed-plus?view=hero&x=1",
    "https://example.com/grailed-plus?view=hero&x=1",
    "https://user:password@dextery.dev/grailed-plus?view=hero&x=1",
  ])("rejects an unsafe destination %s", async (location) => {
    await expect(
      checkCanonicalRedirect(redirectSource, redirectDestination, async () =>
        redirect(location),
      ),
    ).rejects.toThrow("HTTPS canonical or www origin");
  });

  it("rejects temporary redirects", async () => {
    await expect(
      checkCanonicalRedirect(redirectSource, redirectDestination, async () =>
        redirect(redirectDestination.href, 307),
      ),
    ).rejects.toThrow("Expected permanent redirect");
  });

  it("rejects missing Location headers", async () => {
    await expect(
      checkCanonicalRedirect(
        redirectSource,
        redirectDestination,
        async () => new Response(null, { status: 308 }),
      ),
    ).rejects.toThrow("Missing Location header");
  });

  it("rejects redirect loops", async () => {
    await expect(
      checkCanonicalRedirect(redirectSource, redirectDestination, async () =>
        redirect("https://www.dextery.dev/grailed-plus?view=hero&x=1"),
      ),
    ).rejects.toThrow("Redirect loop detected");
  });

  it("requires the final canonical URL to return 200", async () => {
    await expect(
      checkCanonicalRedirect(
        redirectSource,
        redirectDestination,
        async (url) =>
          url.href === redirectDestination.href
            ? new Response(null, { status: 403 })
            : redirect(redirectDestination.href),
      ),
    ).rejects.toThrow("Canonical destination must return 200");
  });
});
