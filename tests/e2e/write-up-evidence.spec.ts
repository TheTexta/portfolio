import { expect, test } from "@playwright/test";

const flagships = [
  "grailed-plus",
  "tvm-discord-bot",
  "photo-graph",
  "elliot-mairet",
];

test.beforeEach(async ({ context }) => {
  await context.route("https://**/*", (route) => route.abort());
  await context.route("**/api/photo-graph/graph", (route) =>
    route.fulfill({ json: { nodes: [], links: [] } }),
  );
});

for (const slug of flagships) {
  test(`${slug} exposes readable evidence without changing its article frame`, async ({
    page,
  }, info) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`/write-ups/${slug}`);
    if (info.project.name === "mobile")
      await page.setViewportSize({ width: 320, height: 844 });

    const header = page.locator("[data-write-up-header]");
    await expect(header.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(header.locator("[data-write-up-lead]")).not.toBeEmpty();
    const links = header.getByRole("navigation").getByRole("link");
    expect(await links.count()).toBeGreaterThanOrEqual(2);
    for (const link of await links.all()) {
      await expect(link).toBeVisible();
      const bounds = (await link.boundingBox())!;
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(
        page.viewportSize()!.width,
      );
      await link.focus();
      await expect(link).toBeFocused();
    }
    await header.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: info.outputPath(`${slug}-evidence-opening.png`),
    });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(page.viewportSize()!.width);
    expect(errors).toEqual([]);
  });
}

test.describe("native evidence links", () => {
  test.use({ javaScriptEnabled: false });

  for (const slug of ["grailed-plus", "tvm-discord-bot", "photo-graph"]) {
    test(`${slug} reaches its evidence section without JavaScript`, async ({
      page,
    }) => {
      await page.goto(`/write-ups/${slug}`);
      const link = page.locator(
        '[data-write-up-header] nav a[href^="#section-"]',
      );
      await expect(link).toHaveCount(1);
      const href = (await link.getAttribute("href"))!;
      const target = page.locator(href);
      await expect(target).toHaveAttribute("data-write-up-heading", "");
      await link.click();
      await expect(page).toHaveURL(new RegExp(`${href}$`));
      await expect(target).toBeInViewport();
      await expect(target).toBeFocused();
    });
  }
});
