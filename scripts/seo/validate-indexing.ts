import assert from "node:assert/strict";
import { parseArgs } from "node:util";

import { projectCatalog } from "@/app/components/projects/project-catalog";
import { PROJECT_ROUTES } from "@/app/components/projects/project-routes";
import { absoluteUrl, PUBLIC_PAGES } from "@/lib/seo";
import { SITE_ORIGIN } from "@/lib/site-config";

const USER_AGENTS = {
  browser: "Mozilla/5.0 (compatible; PortfolioSEOSmokeCheck/1.0)",
  googlebot:
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
};
const EXPERIENCE_PATHS = [
  PROJECT_ROUTES.photoGraphExperience,
  PROJECT_ROUTES.grailedPlusExperience,
];
const REMOVED_PREVIEW =
  "/components/projects/nepobabiesruntheunderground/preview";
const REDIRECTS = [
  ["/", PROJECT_ROUTES.home],
  ["/projects/spotify-nodify", PROJECT_ROUTES.portfolioProjects],
  ["/projects/spotify-nodify/experience", PROJECT_ROUTES.portfolioProjects],
  ["/components/projects/spotify-nodify", PROJECT_ROUTES.portfolioProjects],
  ["/auth/spotify/callback", PROJECT_ROUTES.portfolioProjects],
  ["/components/projects/photo-graph", PROJECT_ROUTES.photoGraph],
  ["/components/projects/grailed-plus", PROJECT_ROUTES.grailedPlus],
  [
    "/components/projects/nepobabiesruntheunderground",
    PROJECT_ROUTES.nepobabiesLive,
  ],
  ["/admin/photo-graph", PROJECT_ROUTES.admin],
  ["/admin/photo-graph/login", PROJECT_ROUTES.admin],
  ["/admin/photo-graph/upload", PROJECT_ROUTES.admin],
  ["/go/grailed-plus", PROJECT_ROUTES.grailedPlus],
  ["/projects/grailed-plus", PROJECT_ROUTES.grailedPlus],
  ["/projects/grailed-plus/experience", PROJECT_ROUTES.grailedPlusExperience],
] as const;

function decodeEntities(value: string) {
  return value.replace(
    /&(#x[\da-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi,
    (entity, name: string) => {
      if (name.startsWith("#")) {
        const code =
          name[1].toLowerCase() === "x"
            ? parseInt(name.slice(2), 16)
            : parseInt(name.slice(1), 10);
        return code > 0 && code <= 0x10ffff
          ? String.fromCodePoint(code)
          : entity;
      }
      const entities: Record<string, string> = {
        amp: "&",
        quot: '"',
        apos: "'",
        lt: "<",
        gt: ">",
        nbsp: " ",
      };
      return entities[name.toLowerCase()];
    },
  );
}

function attributes(tag: string) {
  return Object.fromEntries(
    [...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)].map(
      (match) => [
        match[1].toLowerCase(),
        decodeEntities(match[2] ?? match[3] ?? match[4]),
      ],
    ),
  );
}

function readableText(html: string) {
  return decodeEntities(html.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function inspectHtml(body: string) {
  // Ignore script payloads, including Next.js's serialized component tree.
  const html = body
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");
  const metas = [...html.matchAll(/<meta\b[^>]*>/gi)].map((match) =>
    attributes(match[0]),
  );
  return {
    titles: [...html.matchAll(/<title\b[^>]*>([\s\S]*?)<\/title>/gi)].map(
      (match) => readableText(match[1]),
    ),
    descriptions: metas
      .filter((meta) => meta.name?.toLowerCase() === "description")
      .map((meta) => meta.content),
    canonicals: [...html.matchAll(/<link\b[^>]*>/gi)]
      .map((match) => attributes(match[0]))
      .filter((link) =>
        link.rel?.toLowerCase().split(/\s+/).includes("canonical"),
      )
      .map((link) => link.href),
    robots: metas
      .filter((meta) =>
        ["robots", "googlebot"].includes(meta.name?.toLowerCase()),
      )
      .map((meta) => meta.content ?? ""),
    headings: [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((match) =>
      readableText(match[1]),
    ),
    mainText: readableText(
      html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] ?? "",
    ),
    links: [...html.matchAll(/<a\b[^>]*>/gi)]
      .map((match) => attributes(match[0]).href)
      .filter(Boolean),
  };
}

function checkPublicHtml(body: string, response: Response, canonical: string) {
  assert.equal(response.status, 200, "Expected HTTP 200 without redirect");
  assert.match(response.headers.get("content-type") ?? "", /text\/html/i);
  const html = inspectHtml(body);
  assert.equal(html.titles.length, 1, "Expected one title");
  assert.ok(html.titles[0], "Title is empty");
  assert.equal(html.descriptions.length, 1, "Expected one meta description");
  assert.ok(html.descriptions[0], "Description is empty");
  assert.deepEqual(html.canonicals, [canonical], "Canonical URL mismatch");
  for (const directive of [
    ...html.robots,
    response.headers.get("x-robots-tag") ?? "",
  ]) {
    assert.doesNotMatch(
      directive,
      /\b(?:noindex|none|unavailable_after)\b/i,
      "Indexing is prohibited",
    );
  }
  assert.ok(html.headings.some(Boolean), "Missing readable h1");
  assert.ok(
    html.mainText.length > 150,
    "Missing substantive server-rendered content",
  );
  return html;
}

// Evaluate the emitted robots policy, including agent-specific groups and Allow overrides.
function canCrawl(body: string, path: string, agent: string) {
  const groups: Array<{
    agents: string[];
    rules: Array<{ allow: boolean; pattern: string }>;
  }> = [];
  let group: (typeof groups)[number] | undefined;
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.split("#")[0].trim();
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const field = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    if (field === "user-agent") {
      if (!group || group.rules.length) {
        group = { agents: [], rules: [] };
        groups.push(group);
      }
      group.agents.push(value.toLowerCase());
    } else if (group && value && (field === "allow" || field === "disallow")) {
      group.rules.push({ allow: field === "allow", pattern: value });
    }
  }
  const specificity = (entry: (typeof groups)[number]) =>
    Math.max(
      -1,
      ...entry.agents.map((token) =>
        token === "*"
          ? 0
          : agent.toLowerCase().includes(token)
            ? token.length
            : -1,
      ),
    );
  const best = Math.max(-1, ...groups.map(specificity));
  if (best < 0) return true;
  const matches = groups
    .filter((entry) => specificity(entry) === best)
    .flatMap((entry) => entry.rules)
    .filter(({ pattern }) => {
      const anchored = pattern.endsWith("$");
      const source = (anchored ? pattern.slice(0, -1) : pattern)
        .split("*")
        .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join(".*");
      return new RegExp(`^${source}${anchored ? "$" : ""}`).test(path);
    })
    .sort(
      (a, b) =>
        b.pattern.replace(/[*$]/g, "").length -
          a.pattern.replace(/[*$]/g, "").length ||
        Number(b.allow) - Number(a.allow),
    );
  return matches[0]?.allow ?? true;
}

async function main() {
  const { values } = parseArgs({
    options: {
      "base-url": { type: "string", default: "http://localhost:3000" },
      help: { type: "boolean", short: "h" },
    },
  });
  if (values.help) {
    console.log(
      "Usage: npm run seo:validate -- --base-url <origin>\nDefault: http://localhost:3000\nRead-only HTTP smoke checks; requires a running server.",
    );
    return;
  }
  const base = new URL(values["base-url"]!);
  assert.ok(
    ["http:", "https:"].includes(base.protocol) &&
      !base.username &&
      !base.password &&
      base.pathname === "/" &&
      !base.search &&
      !base.hash,
    "--base-url must be an HTTP(S) origin without credentials, path, query, or fragment",
  );
  let passed = 0;
  let failed = 0;
  async function check(label: string, task: () => Promise<void>) {
    try {
      await task();
      passed++;
      console.log(`PASS ${label}`);
    } catch (error) {
      failed++;
      console.error(
        `FAIL ${label}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  console.log(
    `Read-only SEO checks against ${base.origin}. Canonicals must use ${SITE_ORIGIN}.`,
  );
  for (const [profile, userAgent] of Object.entries(USER_AGENTS)) {
    const get = async (path: string) => {
      const response = await fetch(new URL(path, base), {
        headers: { "User-Agent": userAgent },
        redirect: "manual",
        signal: AbortSignal.timeout(20_000),
      });
      return { response, body: await response.text() };
    };
    const titles = new Set<string>();
    const descriptions = new Set<string>();
    await check(`${profile}: robots policy`, async () => {
      const { response, body } = await get("/robots.txt");
      assert.equal(response.status, 200);
      assert.ok(
        body
          .split(/\r?\n/)
          .some(
            (line) => line.trim() === `Sitemap: ${absoluteUrl("/sitemap.xml")}`,
          ),
        "Missing canonical sitemap declaration",
      );
      for (const path of [
        ...Object.values(PUBLIC_PAGES).map((page) => page.path),
        ...EXPERIENCE_PATHS,
        ...REDIRECTS.map(([path]) => path).filter(
          (path) => !path.startsWith("/admin"),
        ),
        REMOVED_PREVIEW,
      ]) {
        assert.ok(
          canCrawl(body, path, userAgent),
          `${path} is blocked from crawling`,
        );
      }
      for (const path of [
        "/admin",
        "/admin/photo-graph",
        "/api/photo-graph/graph",
        "/api/admin/photo-graph/graph",
      ]) {
        assert.ok(
          !canCrawl(body, path, userAgent),
          `${path} must remain blocked`,
        );
      }
    });
    await check(`${profile}: sitemap URLs, images, and dates`, async () => {
      const { response, body } = await get("/sitemap.xml");
      assert.equal(response.status, 200);
      const entries = [...body.matchAll(/<url>([\s\S]*?)<\/url>/g)].map(
        (match) => match[1],
      );
      const urls = entries.map((entry) =>
        decodeEntities(entry.match(/<loc>(.*?)<\/loc>/)?.[1] ?? ""),
      );
      assert.deepEqual(
        urls.toSorted(),
        Object.values(PUBLIC_PAGES)
          .map((page) => absoluteUrl(page.path))
          .toSorted(),
        "Sitemap must contain exactly the public canonical URLs",
      );
      for (const page of Object.values(PUBLIC_PAGES)) {
        const entry = entries[urls.indexOf(absoluteUrl(page.path))];
        const images = [
          ...entry.matchAll(/<image:loc>(.*?)<\/image:loc>/g),
        ].map((match) => decodeEntities(match[1]));
        const expected =
          page.path === PUBLIC_PAGES.portfolio.path
            ? projectCatalog.map((project) => absoluteUrl(project.posterSrc))
            : [absoluteUrl(page.image.posterSrc)];
        assert.deepEqual(
          images.toSorted(),
          expected.toSorted(),
          `Images mismatch for ${page.path}`,
        );
        assert.equal(
          entry.match(/<lastmod>(.*?)<\/lastmod>/)?.[1],
          page.lastModified,
          `Content date mismatch for ${page.path}`,
        );
      }
    });
    for (const page of Object.values(PUBLIC_PAGES)) {
      await check(`${profile}: ${page.path} indexability`, async () => {
        const { response, body } = await get(page.path);
        const html = checkPublicHtml(body, response, absoluteUrl(page.path));
        assert.ok(!titles.has(html.titles[0]), "Duplicate public-page title");
        assert.ok(
          !descriptions.has(html.descriptions[0]),
          "Duplicate public-page description",
        );
        titles.add(html.titles[0]);
        descriptions.add(html.descriptions[0]);
        if (page.path === PUBLIC_PAGES.portfolio.path) {
          for (const projectPage of [
            PUBLIC_PAGES.photoGraph,
            PUBLIC_PAGES.grailedPlus,
          ]) {
            assert.ok(
              html.links.some(
                (href) => new URL(href, base).pathname === projectPage.path,
              ),
              `Missing crawlable link to ${projectPage.path}`,
            );
          }
        }
      });
    }
    await check(`${profile}: Grailed Plus hero canonical`, async () => {
      const { response, body } = await get(
        `${PROJECT_ROUTES.grailedPlus}?view=hero`,
      );
      checkPublicHtml(body, response, absoluteUrl(PROJECT_ROUTES.grailedPlus));
    });
    for (const path of EXPERIENCE_PATHS) {
      await check(`${profile}: ${path} noindex`, async () => {
        const { response, body } = await get(path);
        assert.equal(response.status, 200);
        const directives = inspectHtml(body).robots;
        assert.ok(
          directives.some(
            (value) =>
              /\bnoindex\b/i.test(value) && /\bnofollow\b/i.test(value),
          ),
          "Expected noindex, nofollow metadata",
        );
      });
    }
    for (const [path, destination] of REDIRECTS) {
      await check(`${profile}: ${path} permanent redirect`, async () => {
        const { response } = await get(path);
        assert.ok(
          [301, 308].includes(response.status),
          `Expected permanent redirect, received ${response.status}`,
        );
        const location = response.headers.get("location");
        assert.ok(location, "Missing Location header");
        assert.equal(
          new URL(location, base).href,
          new URL(destination, base).href,
          "Unexpected redirect destination",
        );
      });
    }
    await check(`${profile}: removed preview returns 404`, async () => {
      assert.equal((await get(REMOVED_PREVIEW)).response.status, 404);
    });
  }
  console.log(
    `\n${passed} passed; ${failed} failed. These checks do not prove Google indexing.`,
  );
  if (failed) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
