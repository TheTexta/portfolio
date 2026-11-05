import { expect, test, type Page } from "@playwright/test";
import { renderToString } from "katex";

const route = "/write-ups/photo-graph";
const errors = new WeakMap<Page, string[]>();

test.beforeEach(async ({ context, page }) => {
  const messages: string[] = [];
  errors.set(page, messages);
  page.on("pageerror", (error) => messages.push(error.message));
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      /hydration|didn.t match|cannot be a descendant/i.test(message.text())
    )
      messages.push(message.text());
  });
  await context.route("https://**/*", (request) => request.abort());
  await context.route("**/api/photo-graph/graph", (request) =>
    request.fulfill({ json: { nodes: [], links: [] } }),
  );
});
test.afterEach(async ({ page }) => expect(errors.get(page) ?? []).toEqual([]));

test("authored equations render during compilation with local fonts and MathML", async ({
  page,
}, info) => {
  await page.goto(route);
  const article = page.getByRole("article");
  const equations = article.locator(".katex-display");
  await expect(equations).toHaveCount(2);
  await equations.first().scrollIntoViewIfNeeded();
  await expect(equations.first().locator("math")).toHaveAttribute(
    "display",
    "block",
  );
  await expect(equations.first().locator(".katex-html")).toHaveAttribute(
    "aria-hidden",
    "true",
  );
  await expect(article.locator(".katex-error")).toHaveCount(0);
  expect(
    await equations
      .first()
      .locator(".katex")
      .evaluate((element) => getComputedStyle(element).fontFamily),
  ).toContain("KaTeX_Main");
  expect(
    await page.evaluate(async () => {
      await document.fonts.ready;
      return document.fonts.check("16px KaTeX_Main");
    }),
  ).toBe(true);
  await expect(
    equations.last().locator('annotation[encoding="application/x-tex"]'),
  ).toContainText("\\frac{d}{\\tau}");
  await equations.first().screenshot({
    path: `.tmp/playwright-results/mdx-math-${info.project.name}.png`,
  });
});

test("default math remains fully rendered without JavaScript", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(`${baseURL}${route}`);
  await expect(page.locator(".katex-display")).toHaveCount(2);
  await expect(page.locator(".katex-mathml math")).toHaveCount(3);
  await expect(page.locator(".katex-error")).toHaveCount(0);
  await context.close();
});

test("wide equations scroll locally without clipping their start or widening the article", async ({
  page,
}, info) => {
  const wideEquation = renderToString(
    Array.from({ length: 40 }, (_, index) => `a_{${index + 1}}`).join("+"),
    { displayMode: true },
  );
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme });
    await page.goto(route);
    await page.locator("#write-up-content").evaluate((element, markup) => {
      const fixture = document.createElement("div");
      fixture.dataset.mathOverflowFixture = "";
      fixture.innerHTML = markup;
      element.appendChild(fixture);
    }, wideEquation);
    const display = page.locator("[data-math-overflow-fixture] .katex-display");
    for (const width of info.project.name === "mobile" ? [320, 390] : [1440]) {
      await page.setViewportSize({ width, height: 900 });
      await display.scrollIntoViewIfNeeded();
      const dimensions = await display.evaluate((element) => {
        element.scrollLeft = 0;
        const frame = element.getBoundingClientRect();
        const content = element
          .querySelector(".katex")!
          .getBoundingClientRect();
        return {
          pageOverflow: document.documentElement.scrollWidth > innerWidth,
          scrolls: element.scrollWidth > element.clientWidth,
          start: content.left,
          left: frame.left,
          right: frame.right,
        };
      });
      expect(dimensions.pageOverflow).toBe(false);
      expect(dimensions.scrolls).toBe(true);
      expect(dimensions.left).toBeGreaterThanOrEqual(0);
      expect(dimensions.right).toBeLessThanOrEqual(width);
      expect(dimensions.start).toBeCloseTo(dimensions.left, 0);
      expect(
        await display.evaluate((element) => {
          element.scrollLeft = element.scrollWidth;
          return element.scrollLeft;
        }),
      ).toBeGreaterThan(0);
    }
  }
});
