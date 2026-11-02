import { expect, test } from "@playwright/test";

for (const reducedMotion of ["reduce", "no-preference"] as const) {
  test(`scrolling stays native with hidden scrollbars and ${reducedMotion} motion`, async ({
    page,
    context,
  }) => {
    await page.emulateMedia({ reducedMotion });
    await context.route("https://**/*", (route) =>
      route.request().resourceType() === "document"
        ? route.fulfill({
            contentType: "text/html",
            body: "<p>Project preview</p>",
          })
        : route.abort(),
    );
    await context.route("**/api/photo-graph/graph", (route) =>
      route.fulfill({ json: { nodes: [], links: [] } }),
    );

    for (const path of ["/portfolio", "/grailed-plus"]) {
      await page.goto(path);
      await expect(page.locator("html")).toHaveCSS("scroll-behavior", "auto");
      await expect(page.locator("html")).toHaveCSS("scrollbar-width", "none");
      await expect(page.locator("body")).toHaveCSS("scrollbar-width", "none");
    }

    await page.goto("/portfolio");
    await expect(page.locator("main > header > span[aria-hidden]")).toHaveCSS(
      "transform",
      /^(none|matrix\(1, 0, 0, 1, 0, 0\))$/,
    );
    const navigation = page.getByRole("navigation", {
      name: "Project write-ups",
    });
    await expect(navigation).toHaveCSS("scrollbar-width", "none");
    await expect(navigation).toHaveCSS("overflow-y", "auto");
    await expect(page.locator(".project-rail")).toHaveCSS(
      "scrollbar-width",
      "none",
    );

    const aboutTop = await page.evaluate(() => {
      window.scrollTo(0, 0);
      document.querySelector<HTMLAnchorElement>('a[href="#about"]')!.click();
      return document.getElementById("about")!.getBoundingClientRect().top;
    });
    expect(aboutTop).toBeCloseTo(48, 0);
    await expect(page).toHaveURL(/#about$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/portfolio$/);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  });
}
