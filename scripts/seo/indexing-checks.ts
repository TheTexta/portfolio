import assert from "node:assert/strict";

export function decodeEntities(value: string) {
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

function canonicalLinks(html: string) {
  return [...html.matchAll(/<link\b[^>]*>/gi)]
    .map((match) => attributes(match[0]))
    .filter((link) =>
      link.rel?.toLowerCase().split(/\s+/).includes("canonical"),
    )
    .map((link) => link.href);
}

export function inspectHtml(body: string) {
  // Ignore script payloads, including Next.js's serialized component tree.
  const html = body
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");
  const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1] ?? "";
  const metas = [...html.matchAll(/<meta\b[^>]*>/gi)].map((match) =>
    attributes(match[0]),
  );
  return {
    titles: [...head.matchAll(/<title\b[^>]*>([\s\S]*?)<\/title>/gi)].map(
      (match) => readableText(match[1]),
    ),
    descriptions: metas
      .filter((meta) => meta.name?.toLowerCase() === "description")
      .map((meta) => meta.content),
    canonicals: canonicalLinks(html),
    headCanonicals: canonicalLinks(head),
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

export function checkPublicHtml(
  body: string,
  response: Response,
  canonical: string,
) {
  assert.equal(response.status, 200, "Expected HTTP 200 without redirect");
  assert.match(response.headers.get("content-type") ?? "", /text\/html/i);
  const html = inspectHtml(body);
  assert.equal(html.titles.length, 1, "Expected one title");
  assert.ok(html.titles[0], "Title is empty");
  assert.equal(html.descriptions.length, 1, "Expected one meta description");
  assert.ok(html.descriptions[0], "Description is empty");
  assert.deepEqual(
    html.headCanonicals,
    [canonical],
    "Expected exactly one canonical URL inside <head>",
  );
  assert.deepEqual(
    html.canonicals,
    [canonical],
    "Expected exactly one canonical URL in the document",
  );
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

export async function checkCanonicalRedirect(
  source: URL,
  destination: URL,
  get: (url: URL) => Promise<Response>,
) {
  const www = new URL(destination);
  www.hostname = `www.${destination.hostname}`;
  const visited = new Set<string>();
  let url = source;
  for (let hop = 0; hop <= 3; hop++) {
    assert.ok(!visited.has(url.href), "Redirect loop detected");
    visited.add(url.href);
    const response = await get(url);
    try {
      if (url.href === destination.href) {
        assert.equal(
          response.status,
          200,
          "Canonical destination must return 200",
        );
        return;
      }
      assert.ok(
        [301, 308].includes(response.status),
        `Expected permanent redirect, received ${response.status}`,
      );
      const location = response.headers.get("location");
      assert.ok(location, "Missing Location header");
      const next = new URL(location, url);
      assert.ok(
        !next.username &&
          !next.password &&
          [destination.origin, www.origin].includes(next.origin),
        "Redirect must stay on the HTTPS canonical or www origin",
      );
      assert.equal(
        next.pathname,
        destination.pathname,
        "Redirect changed path",
      );
      assert.equal(next.search, destination.search, "Redirect changed query");
      assert.equal(next.hash, destination.hash, "Redirect changed fragment");
      url = next;
    } finally {
      await response.body?.cancel();
    }
  }
  assert.fail("Redirect chain exceeded three hops");
}
