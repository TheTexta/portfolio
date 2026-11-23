import { readFile } from "node:fs/promises";
import { compile } from "@mdx-js/mdx";
import remarkMath from "remark-math";
import { describe, expect, it } from "vitest";
import remarkWriteUpContents from "@/lib/mdx/remark-write-up-contents.mjs";

const article = await readFile(
  new URL("../../app/write-ups/photo-graph/write-up.mdx", import.meta.url),
  "utf8",
);
const copy = article.replace(/\s+/g, " ");
const source =
  "https://github.com/TheTexta/portfolio/blob/4ef4a2de9e668f896f0a4024518a09f6a8756fdf/";
const evaluationId = "section-colour-model-comparison-and-review-method";

describe("Photo Graph article evidence boundaries", () => {
  it("opens with native source and evaluation links to the existing section", async () => {
    const header = article.slice(0, article.indexOf("</header>"));
    expect(header).toContain(
      "<a href={props.project.sourceHref}>Public source</a>",
    );
    expect(header).toMatch(
      /<a href="#section-colour-model-comparison-and-review-method">\s*Saved evaluation\s*<\/a>/,
    );
    expect(header.match(/href="#section-/g)).toHaveLength(1);
    expect(header).toContain("recoverable uploads");
    const compiled = String(
      await compile(article, {
        remarkPlugins: [remarkMath, remarkWriteUpContents],
      }),
    );
    expect(compiled).toContain(`id: "${evaluationId}"`);
  });

  it("distinguishes live, frozen November and historical August evidence before the preview", () => {
    const opening = copy.slice(0, copy.indexOf("<ProjectPreview"));
    expect(opening).toContain("The preview below loads the live archive.");
    expect(opening).toContain("frozen 4 November 2026 extraction");
    expect(opening).toContain("100 photographs and seven queries from August");
    expect(opening).toContain("Neither snapshot is a live catalogue count.");
    expect(opening).not.toMatch(
      /renderer-independent|keyboard browser|focus lifecycle|screen-reader|local acceptance/i,
    );
  });

  it("retains the review denominators, judged coverage and model-selection limits", () => {
    const method = copy.slice(
      copy.indexOf("### Colour-model comparison and review method"),
      copy.indexOf("## Turning similarity into a useful graph"),
    );
    expect(method).toContain("saved 26 August 2026 benchmark");
    expect(method).toContain("eight positive and eight negative examples");
    expect(method).toContain("28 evaluated positions across the seven queries");
    expect(method).toContain("The same queries informed model selection.");
    expect(method).toContain("Unjudged photographs were excluded");
    expect(method).toContain("CIEDE2000 used 16 and CIE76 used 19");
    expect(
      [...method.matchAll(/<td className="py-3">([^<]+)<\/td>/g)].map(
        (match) => match[1],
      ),
    ).toEqual(["24 / 28", "25 / 28", "21 / 28", "23 / 28", "20 / 28"]);
    expect(copy).toContain("not archive-wide retrieval accuracy");
    expect(copy).toContain("held-out review");
  });

  it("preserves the existing sections and inspectors without promising better 3D retrieval", () => {
    expect(article.match(/^#{2,3} .+$/gm)).toEqual([
      "## Browsing by colour",
      "## Defining what “similar” means",
      "### Colour-model comparison and review method",
      "## Turning similarity into a useful graph",
      "## Making the graph usable",
      "## Updating the archive",
      "### Recovering interrupted uploads",
    ]);
    expect(article).toContain("<ComparisonDemo />");
    expect(article).toContain("<NeighboursDemo />");
    expect(copy).toContain("photographs on my bedroom wall");
    expect(copy).toContain(
      "the complementary relationships on the wall remain outside its comparison model",
    );
    expect(copy).toContain("renders the same precomputed relationships");
    expect(copy).toContain(
      "does not use a different similarity model or establish that viewers find more useful photographs",
    );
  });

  it("pins locally inspectable proof while preserving publication, commit and recovery boundaries", async () => {
    for (const path of [
      "public/projects/photo-graph/color-model-benchmark-v1.json",
      "scripts/photo-graph/color-benchmark-judgments-v1.json",
      "scripts/photo-graph/benchmark-color-models.ts",
      "lib/photo-graph/sparse-edge-generation.ts",
      "tests/unit/photo-graph-nomination-semantics.test.ts",
      "tests/unit/upload-route.test.ts#L107",
      "tests/unit/upload-database.test.ts#L83",
      "docs/photo-graph-r2-migration.md#owner-approved-source-retirement--2026-10-15",
    ]) {
      expect(article).toContain(`${source}${path}`);
      await expect(
        readFile(new URL(`../../${path.split("#")[0]}`, import.meta.url)),
      ).resolves.toBeDefined();
    }
    expect(article).not.toContain("github.com/TheTexta/portfolio/blob/main/");
    expect(copy).toContain("registration rejects the stale work");
    expect(copy).toContain("committed together in a database transaction");
    expect(copy).toContain(
      "publishes and verifies the copy before committing graph registration",
    );
    expect(copy).toContain(
      "Private staging cleanup follows a successful commit",
    );
    expect(copy).toContain("not a production recovery drill");
    expect(copy).toContain("Upload recovery is not an archive backup");
    expect(copy).toContain(
      "a Supabase-only rollback requires reverse-copying and verifying every required R2 original",
    );
  });
});
