import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { getProject } from "@/app/components/projects/project-catalog";
import { PUBLIC_PAGES } from "@/lib/seo";

const article = await readFile(
  new URL("../../app/write-ups/bot-or-not/write-up.mdx", import.meta.url),
  "utf8",
);
const prose = article.replace(/\s+/g, " ");
const revision = "5539649f4757570eab0c1bdc8d304597492d7aa4";
const source = `https://github.com/TheTexta/bot-or-not-mcgill/blob/${revision}`;

describe("Bot or Not write-up", () => {
  it("establishes the account-level task and solo contribution before the model comparison", () => {
    const header = article.slice(0, article.indexOf("</header>"));
    expect(header).toContain("I built a Python pipeline");
    expect(header).toContain("profiles and posting histories");
    expect(header).not.toMatch(
      /reproducible selection reports|Split-contract tests/,
    );
    expect(prose).toContain("This was a solo implementation.");
    expect(prose).toContain("the target is the account");
    expect(article.indexOf("This was a solo implementation.")).toBeLessThan(
      article.indexOf("## Combining account and text features"),
    );
    expect(article.match(/^## .+$/gm)).toEqual([
      "## The classification task and my contribution",
      "## Combining account and text features",
      "## Selecting models and thresholds",
      "## Finding overlap in practice data",
      "## Preventing overlap in future runs",
    ]);
  });

  it("explains feature representations and the tree ensemble before selection", () => {
    const features = prose.slice(
      prose.indexOf("## Combining account and text features"),
      prose.indexOf("## Selecting models and thresholds"),
    );
    for (const detail of [
      "duplicate-post ratio",
      "posting-hour entropy",
      "one document per account",
      "character 3–5-gram TF-IDF",
      "word 1–2-gram",
      "truncated SVD",
      "not pretrained language-model embeddings",
      "histogram gradient boosting and ExtraTrees",
      "selected the tree ensemble for both languages",
    ]) {
      expect(features).toContain(detail);
    }
  });

  it("distinguishes utility-based selection from an independent assessment and a reserved holdout", () => {
    expect(prose).toContain("validates on one whole shard at a time");
    expect(prose).toContain("2TP − 6FP − 2FN");
    expect(prose).toContain("rather than maximising F1");
    expect(prose).toContain(
      "These out-of-fold predictions are selection data, not an independent final test.",
    );
    expect(prose).toContain("selected separately for English and French");
    const methodology = article.slice(
      article.indexOf("### Training-command differences"),
      article.indexOf("## Finding overlap in practice data"),
    );
    expect(methodology).toContain("selected_holdout");
    expect(methodology).toContain(`${source}/tests/test_modeling.py`);
    expect(prose).toContain(
      "they do not establish that the historical numbers have been reproduced",
    );
  });

  it("puts the finding and historical-input limitation before both saved scores", () => {
    const finding = article.indexOf(
      "**The checked-in practice datasets contain extensive content overlap",
    );
    const qualification = article.indexOf(
      "The audit did not establish byte-for-byte identity",
    );
    expect(finding).toBeGreaterThan(0);
    expect(qualification).toBeGreaterThan(finding);
    for (const score of ["0.95238", "1.000"]) {
      expect(article.indexOf(score)).toBeGreaterThan(qualification);
    }
    const rows = [
      ...article.matchAll(
        /<tr className="border-b border-muted\/30">([\s\S]*?)<\/tr>/g,
      ),
    ];
    expect(rows).toHaveLength(2);
    for (const [index, expected] of [
      ["English", "0.95238", "275", "252"],
      ["French", "1.000", "171", "164"],
    ].entries()) {
      expect(rows[index][1]).toContain(expected[0]);
      expect(
        [...rows[index][1].matchAll(/<td[^>]*>([^<]+)<\/td>/g)].map(
          (match) => match[1],
        ),
      ).toEqual(expected.slice(1));
    }
    expect(prose).toContain(
      "It does not measure how much overlap affected the scores, nor establish that every official validation fold was invalid.",
    );
  });

  it("keeps audit mechanics separate from the finding and preserves pinned historical reports", () => {
    const method = article.slice(
      article.indexOf("### Overlap audit method"),
      article.indexOf("## Preventing overlap in future runs"),
    );
    expect(method).toContain("SHA-256");
    expect(method).toContain(revision);
    expect(method.replace(/\s+/g, " ")).toContain(
      "none were identical full records",
    );
    expect(method).toContain("131 also matched the ID-stripped full payload");
    for (const language of ["en", "fr"]) {
      expect(article).toContain(
        `${source}/runs/20260404T162558Z-both-official-first-optimize/${language}/practice-evaluation-report.json`,
      );
    }
    expect(prose).toContain(
      "These local safeguards postdate the pinned historical run and tests above",
    );
  });

  it("explains alias guards and ends with an unexecuted independent-assessment protocol", () => {
    expect(prose).toContain("new ID but with an identical list of post texts");
    expect(prose).toContain("boundaries fail before fitting");
    expect(prose).toContain("rather than quietly moving or dropping records");
    expect(prose).toContain("misses paraphrases, edited timelines");
    expect(prose).toContain(
      "affecting the probabilities used for threshold selection",
    );
    const assessment = article.slice(
      article.indexOf("### Evaluating on independent accounts"),
    );
    expect(
      [...assessment.matchAll(/^\d\. \*\*([^*]+)\*\*/gm)].map(
        (match) => match[1],
      ),
    ).toEqual([
      "Freeze the inputs and grouping rules.",
      "Reserve assessment data before selection.",
      "Fit within the permitted training partitions.",
      "Assess the fixed system on the reserved accounts.",
    ]);
    expect(assessment).toContain("That assessment has not been run.");
    expect(assessment).toContain(
      "independent predictive performance remains unresolved",
    );
  });

  it("keeps catalogue and search descriptions consistent without claiming reproduced results", () => {
    const project = getProject("bot-or-not");
    expect(project.role).toBe(
      "Solo feature extraction, model selection and reporting",
    );
    expect(project.summary).toContain("profiles and posting histories");
    expect(project.summary).not.toMatch(/reproducible|0\.95238|1\.000/);
    expect(project.outcome).toContain("independent assessment pending");
    expect(PUBLIC_PAGES.botOrNot.description).toBe(project.summary);
    expect(PUBLIC_PAGES.botOrNot.lastModified).toBe("2026-11-04");
    expect(project.writeUpHref).toBe("/write-ups/bot-or-not");
    expect(project.showInBrowser).toBe(false);
  });
});
