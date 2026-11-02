import { expect, test } from "@playwright/test";
import { projectCatalog } from "../../app/components/projects/project-catalog";

test.beforeEach(async ({ context }) => {
  await context.route("https://**/*", (route) => route.abort());
  await context.route("**/api/photo-graph/graph", (route) =>
    route.fulfill({ json: { nodes: [], links: [] } }),
  );
});

test("Elliot's shared article matches the reference frame and preview geometry", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/write-ups/elliot-mairet");
  await page.evaluate(() => document.fonts.ready);
  const article = page.getByRole("article");
  await expect(article).toHaveCSS("padding-top", "80px");
  await expect(article).toHaveCSS("padding-bottom", "112px");
  const frame = article.locator("[data-write-up-title]");
  const title = article.locator("h1");
  expect((await frame.boundingBox())!.width).toBeCloseTo(672, 0);
  expect((await frame.boundingBox())!.height).toBeCloseTo(330, 0);
  expect((await title.boundingBox())!.width).toBeCloseTo(584, 0);
  expect((await title.boundingBox())!.height).toBeCloseTo(114, 0);
  await expect(title).toHaveCSS("font-size", "96px");
  await expect(frame).toHaveCSS("padding-top", "48px");
  const preview = article.locator("[data-write-up-preview]");
  const media = preview.locator(":scope > div").first();
  const controls = preview.getByRole("group");
  expect((await media.boundingBox())!.height).toBeCloseTo(371.5, 0);
  expect((await controls.boundingBox())!.height).toBeCloseTo(48, 0);
  await expect(controls).toHaveCSS("border-top-width", "0px");
  await expect(controls.getByText("Homepage", { exact: true })).toBeVisible();
  const icon = controls.locator("img");
  expect((await icon.boundingBox())!.width).toBe(24);
  expect((await icon.boundingBox())!.height).toBe(24);
  await expect(icon).toHaveJSProperty("complete", true);
  await expect(icon).toHaveJSProperty("naturalWidth", 24);
  for (const separator of await article.locator("dl img").all()) {
    const bounds = (await separator.boundingBox())!;
    expect(bounds.width).toBeCloseTo(1, 0);
    expect(bounds.height).toBeCloseTo(20, 0);
    await expect(separator).toHaveJSProperty("naturalWidth", 20);
  }
  const images = article.locator("figure img");
  await expect(images).toHaveCount(3);
  for (const image of await images.all()) {
    await image.scrollIntoViewIfNeeded();
    await expect(image).toHaveJSProperty("complete", true);
    await expect(image).not.toHaveJSProperty("naturalWidth", 0);
    const bounds = (await image.boundingBox())!;
    expect(bounds.width).toBeCloseTo(672, 0);
    expect(bounds.height).toBeCloseTo((672 * 1000) / 1440, 0);
  }
});

test("previous and next write-ups cycle through every article in catalogue order", async ({
  page,
}) => {
  const articles = projectCatalog.filter((project) => project.writeUpHref);
  expect(articles).toHaveLength(7);
  for (let i = 0; i < articles.length; i++) {
    const project = articles[i];
    const previous = articles[(i - 1 + articles.length) % articles.length];
    const next = articles[(i + 1) % articles.length];
    await page.goto(project.writeUpHref!);
    const footer = page.locator("article > footer");
    await expect(footer).toHaveCSS("margin-top", "64px");
    await expect(footer).toHaveCSS("padding-top", "48px");
    await expect(footer).toHaveCSS("padding-bottom", "48px");
    const nav = footer.getByRole("navigation", { name: "More write-ups" });
    await expect(nav.locator('a[rel="prev"]')).toHaveAttribute(
      "href",
      previous.writeUpHref!,
    );
    await expect(nav.locator('a[rel="prev"]')).toHaveText(
      `← ${previous.title}`,
    );
    await expect(nav.locator('a[rel="next"]')).toHaveAttribute(
      "href",
      next.writeUpHref!,
    );
    await expect(nav.locator('a[rel="next"]')).toHaveText(`${next.title} →`);
    await expect(nav.locator('a[rel="next"]')).toHaveCSS("text-align", "right");
    expect(
      await page.evaluate(() => document.body.scrollWidth > innerWidth),
    ).toBe(false);
  }
  const next = page.locator('article > footer a[rel="next"]');
  await next.focus();
  await expect(next).toBeFocused();
  await expect(next).toHaveCSS("outline-style", "solid");
  await next.press("Enter");
  await expect(page).toHaveURL(articles[0].writeUpHref!);
  await expect(page.locator("h1")).toHaveText(articles[0].title);
});
