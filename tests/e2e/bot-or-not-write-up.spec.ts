import { expect, test } from "@playwright/test";

test("Bot or Not explains the classifier before scoped results and renders its evidence table", async ({
  context,
  page,
}) => {
  await context.route("https://**/*", (route) => route.abort());
  await page.goto("/write-ups/bot-or-not");

  const article = page.getByRole("article");
  await expect(article.getByRole("heading", { level: 1 })).toHaveText(
    "Bot or Not",
  );
  await expect(article.locator("[data-write-up-lead]")).toContainText(
    "profiles and posting histories",
  );
  await expect(article.getByRole("heading", { level: 2 })).toHaveText([
    "The classification task and my contribution",
    "Combining account and text features",
    "Selecting models and thresholds",
    "Finding overlap in practice data",
    "Preventing overlap in future runs",
  ]);

  const text = await article.innerText();
  const finding = text.indexOf(
    "The checked-in practice datasets contain extensive content overlap",
  );
  const qualification = text.indexOf(
    "The audit did not establish byte-for-byte identity",
  );
  expect(finding).toBeGreaterThan(
    text.indexOf("Combining account and text features"),
  );
  expect(qualification).toBeGreaterThan(finding);
  expect(text.indexOf("0.95238")).toBeGreaterThan(qualification);
  expect(text.indexOf("1.000")).toBeGreaterThan(qualification);

  const table = article.getByRole("table", {
    name: "Saved practice results and checked-in input overlap—not an independent assessment.",
  });
  await expect(table.getByRole("columnheader")).toHaveText([
    "Language",
    "Saved practice F1",
    "Accounts",
    "Exact text-timeline matches in checked-in official data",
  ]);
  await expect(table.getByRole("row")).toHaveCount(3);
  await expect(table.getByRole("row").nth(1).getByRole("cell")).toHaveText([
    "0.95238",
    "275",
    "252",
  ]);
  await expect(table.getByRole("row").nth(2).getByRole("cell")).toHaveText([
    "1.000",
    "171",
    "164",
  ]);
  for (const [language, directory] of [
    ["English", "en"],
    ["French", "fr"],
  ]) {
    await expect(table.getByRole("link", { name: language })).toHaveAttribute(
      "href",
      `https://github.com/TheTexta/bot-or-not-mcgill/blob/5539649f4757570eab0c1bdc8d304597492d7aa4/runs/20260404T162558Z-both-official-first-optimize/${directory}/practice-evaluation-report.json`,
    );
  }
  await expect(article).toContainText("That assessment has not been run.");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    /Classifying English and French social-media accounts from profiles and posting histories/,
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://dextery.dev/write-ups/bot-or-not",
  );

  const height = page.viewportSize()!.height;
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height });
    await table.scrollIntoViewIfNeeded();
    await expect(table).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});
