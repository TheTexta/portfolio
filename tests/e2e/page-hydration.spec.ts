import { expect, test } from "@playwright/test";

for (const reducedMotion of ["reduce", "no-preference"] as const) {
  test(`homepage and write-ups hydrate cleanly with ${reducedMotion} motion`, async ({
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
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error" && /hydrat/i.test(message.text()))
        errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));

    for (const path of [
      "/portfolio#about",
      "/projects/photo-graph",
      "/projects/elliot-mairet",
      "/projects/bur1alrites",
    ]) {
      await page.goto(path);
      await page.evaluate(() => window.scrollTo(0, 0));
      // This rule is scaleX(0) in SSR. Its completed client animation establishes
      // hydration, unlike merely finding text in the server-rendered article.
      await expect(page.locator("main > header > span[aria-hidden]")).toHaveCSS(
        "transform",
        /^(none|matrix\(1, 0, 0, 1, 0, 0\))$/,
      );
      expect(errors, `Hydration errors on ${path}`).toEqual([]);
    }
  });
}

test("decorative rules follow motion preference changes without reloading", async ({
  page,
  context,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await context.route("https://**/*", (route) => route.abort());
  await context.route("**/api/photo-graph/graph", (route) =>
    route.fulfill({ json: { nodes: [], links: [] } }),
  );
  await page.goto("/portfolio");
  await expect(page.locator("main > header > span[aria-hidden]")).toHaveCSS(
    "transform",
    /^(none|matrix\(1, 0, 0, 1, 0, 0\))$/,
  );
  // Contact remains below the viewport, so only the live preference—not an
  // intersection or navigation—can reveal its decorative rules here.
  const rule = page
    .locator("#contact > div")
    .first()
    .locator("span[aria-hidden]")
    .first();
  await expect(rule).toHaveCSS("transform", "matrix(0, 0, 0, 1, 0, 0)");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(rule).toHaveCSS(
    "transform",
    /^(none|matrix\(1, 0, 0, 1, 0, 0\))$/,
  );
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(rule).toHaveCSS("transform", "matrix(0, 0, 0, 1, 0, 0)");
});
