import { readFile, readdir } from "node:fs/promises";
import { compile, evaluate } from "@mdx-js/mdx";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as runtime from "react/jsx-runtime";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { describe, expect, it } from "vitest";
import remarkWriteUpContents from "@/lib/mdx/remark-write-up-contents.mjs";
import remarkWriteUpBody from "@/lib/mdx/remark-write-up-body.mjs";

const options = {
  remarkPlugins: [remarkMath, remarkWriteUpContents, remarkWriteUpBody],
  rehypePlugins: [rehypeKatex],
};

type HtmlNode = {
  type: string;
  tagName?: string;
  name?: string;
  children?: HtmlNode[];
};

// Markdown paragraphs inside authored <p> or <tr> elements cause hydration repair.
function assertValidParagraphNesting() {
  return (tree: HtmlNode) => {
    function visit(node: HtmlNode, parents: string[]) {
      const tag = node.tagName ?? node.name ?? "";
      if (tag === "p") {
        expect(parents).not.toContain("p");
        expect(parents.at(-1)).not.toBe("tr");
      }
      for (const child of node.children ?? []) visit(child, [...parents, tag]);
    }
    visit(tree, []);
  };
}

describe("MDX mathematics", () => {
  it("renders inline and display LaTeX as HTML and accessible MathML while preserving article transforms", async () => {
    const source = String.raw`<header data-write-up-header>

# Mathematics

</header>

## Comparing $s$

The colour difference is $\Delta E_{00}$.

$$
s = \max\left(0,\min\left(1,1-\frac{d}{\tau}\right)\right)
$$
`;
    const compiledMdx = await evaluate(source, { ...runtime, ...options });
    const markup = renderToStaticMarkup(
      createElement(compiledMdx.default, {
        components: { WriteUpBody: "section" },
      }),
    );
    expect(markup.match(/class="katex"/g)).toHaveLength(3);
    expect(markup).toContain('class="katex-display"');
    expect(markup).toContain('class="katex-mathml"');
    expect(markup).toContain('class="katex-html" aria-hidden="true"');
    expect(markup).toContain('xmlns="http://www.w3.org/1998/Math/MathML"');
    expect(markup).toContain('encoding="application/x-tex"');
    expect(markup).toMatch(/<section><h2[^>]+id="section-comparing-s"/);
    expect(compiledMdx.writeUpContents).toEqual([
      { id: "section-comparing-s", title: "Comparing s", depth: 2 },
    ]);
    expect(markup).not.toContain("katex-error");
    expect(markup).not.toContain("<script");
  });

  it("leaves escaped currency and code examples literal", async () => {
    const compiledMdx = await evaluate(
      "Prices: \\$10 and \\$20. Code: `$x$`.",
      {
        ...runtime,
        ...options,
      },
    );
    const markup = renderToStaticMarkup(createElement(compiledMdx.default));
    expect(markup).toContain("$10 and $20");
    expect(markup).toContain("<code>$x$</code>");
    expect(markup).not.toContain("katex");
  });

  it("compiles all current write-ups without KaTeX errors or changing their module declarations", async () => {
    const directory = new URL("../../app/write-ups/", import.meta.url);
    const entries = await readdir(directory, { withFileTypes: true });
    const articles = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory())
        .map(async (entry) => {
          const url = new URL(`${entry.name}/write-up.mdx`, directory);
          try {
            return { url, source: await readFile(url, "utf8") };
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
            throw error;
          }
        }),
    );
    const compiled = await Promise.all(
      articles
        .filter((article) => article !== null)
        .map(async ({ url, source }) => {
          const result = await compile(
            { value: source, path: url.pathname },
            {
              ...options,
              rehypePlugins: [rehypeKatex, assertValidParagraphNesting],
            },
          );
          expect(result.messages, url.pathname).toEqual([]);
          expect(String(result), url.pathname).toContain("writeUpContents");
          expect(String(result), url.pathname).not.toContain("katex-error");
          return url;
        }),
    );
    expect(compiled.length).toBeGreaterThanOrEqual(7);
  });
});
