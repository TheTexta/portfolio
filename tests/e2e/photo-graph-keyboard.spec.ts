import { expect, test, type Locator, type Page } from "@playwright/test";
import sharp from "sharp";

const experience = "/projects/photo-graph/experience";
const embedded = "/test-fixtures/photo-graph-keyboard";
const summary = (root: Page | Locator) =>
  root.locator("summary", { hasText: "Browse photographs" });
const selector = (root: Page | Locator) =>
  root.getByLabel("Select a photograph", { exact: true });
const openPhoto = (root: Page | Locator) =>
  root.getByRole("button", { name: "Open selected photograph", exact: true });
const inspect = (page: Page) =>
  page.getByRole("dialog", { name: /Inspect photograph/ });
const graphPayload = (ids = ["first", "related", "third", "isolated"]) => ({
  nodes: ids.map((id, index) => ({
    id,
    sourceUrl: `/__photo-graph-keyboard.svg?id=${id}`,
    baseSize: 100,
    aspectRatio: 1.6,
    hasKnownAspectRatio: true,
    layerNoise: 0,
    w: 160,
    h: 100,
    renderArea: 16000,
    x: index * 200,
    y: 0,
  })),
  links: ids.includes("related")
    ? [
        { source: "first", target: "related", value: 0.8, baseValue: 0.8 },
        { source: "related", target: "third", value: 0.5, baseValue: 0.5 },
      ]
    : [],
});
const svg =
  '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="100"><rect width="160" height="100" fill="#c43b2c"/></svg>';

test.beforeEach(async ({ context }) => {
  await context.route("https://**/*", (route) => route.abort());
  await context.route("**/__photo-graph-keyboard.svg*", (route) =>
    route.fulfill({ contentType: "image/svg+xml", body: svg }),
  );
  await context.route("**/api/photo-graph/graph*", (route) =>
    route.fulfill({ json: graphPayload() }),
  );
});

async function browse(page: Page, root: Page | Locator = page) {
  await expect(selector(root)).toHaveValue("first");
  await summary(root).focus();
  await summary(root).press("Enter");
  await expect(openPhoto(root)).toBeVisible();
}

test("Tab discovers the single clipped entry and completes native selection, related and inspection journeys", async ({
  page,
}) => {
  await page.goto(experience);
  const entry = summary(page);
  await expect(entry.locator("..")).toHaveCSS("width", "1px");
  for (
    let step = 0;
    step < 16 && !(await entry.evaluate((el) => el === document.activeElement));
    step += 1
  ) {
    await page.keyboard.press("Tab");
  }
  await expect(entry).toBeFocused();
  await expect(entry).toHaveCSS("outline-style", "solid");
  expect((await entry.boundingBox())!.width).toBeGreaterThan(100);
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  await expect(selector(page)).toBeFocused();
  // Native type-ahead avoids automating an OS-owned popup menu.
  await page.keyboard.type("Photograph related");
  await expect(selector(page)).toHaveValue("related");
  await page.keyboard.press("Escape");
  await expect(entry.locator("..")).toHaveAttribute("open", "");
  await expect(inspect(page)).toHaveCount(0);
  await page.keyboard.press("Tab");
  await expect(openPhoto(page)).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Select photograph first", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(selector(page)).toBeFocused();
  await expect(selector(page)).toHaveValue("third");
  await expect(
    page.getByText("No subject description is available for this photograph.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(inspect(page)).toHaveAccessibleName("Inspect photograph third");
  const close = inspect(page).getByRole("button", {
    name: "Close inspect overlay",
  });
  await expect(close).toBeFocused();
  await expect(inspect(page).locator("img")).toHaveAttribute(
    "alt",
    /subject description unavailable/,
  );
  const download = inspect(page).getByRole("link", {
    name: "Download Original",
  });
  await expect(download).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(download).toBeFocused();
  await page.keyboard.press("Tab");
  expect(
    await page.evaluate(
      () =>
        document.activeElement === document.body ||
        !!document.activeElement?.closest("dialog[open]"),
    ),
  ).toBe(true);
  if (!(await close.evaluate((button) => button === document.activeElement)))
    await page.keyboard.press("Tab");
  await expect(close).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  if (!(await download.evaluate((link) => link === document.activeElement)))
    await page.keyboard.press("Shift+Tab");
  await expect(download).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(inspect(page)).toHaveCount(0);
  await expect(openPhoto(page)).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(entry).toBeFocused();
  await expect(entry.locator("..")).not.toHaveAttribute("open", "");
});

test("settings reveal the same entry without adding permanent chrome", async ({
  page,
}) => {
  await page.goto(experience);
  const entry = summary(page);
  await expect(entry).toHaveCount(1);
  await expect(entry.locator("..")).toHaveCSS("width", "1px");
  await page
    .getByRole("button", { name: "Open graph controls", exact: true })
    .click();
  expect((await entry.boundingBox())!.width).toBeGreaterThan(100);
  await entry.click();
  await expect(selector(page)).toBeVisible();
  await page
    .getByRole("button", { name: "Close graph controls", exact: true })
    .click();
  await expect(entry.locator("..")).toHaveAttribute("open", "");
  await entry.click();
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(entry.locator("..")).toHaveCSS("width", "1px");
});

test("embedded instances keep unique labels, native selector keys and opt-outs", async ({
  page,
}) => {
  await page.goto(embedded);
  const first = page.getByRole("region", {
    name: "First embedded graph",
    exact: true,
  });
  const second = page.getByRole("region", {
    name: "Second embedded graph",
    exact: true,
  });
  await browse(page, first);
  await browse(page, second);
  expect(await selector(first).getAttribute("id")).not.toBe(
    await selector(second).getAttribute("id"),
  );
  await selector(first).selectOption("isolated");
  await expect(
    first.getByText("No connected photographs.", { exact: true }),
  ).toBeVisible();
  await selector(first).press("ArrowLeft");
  await selector(first).press("Escape");
  await expect(summary(first).locator("..")).toHaveAttribute("open", "");
  await expect(inspect(page)).toHaveCount(0);
  await expect(selector(second)).toHaveValue("first");
  await expect(
    page
      .getByRole("region", { name: "Opt-out graph", exact: true })
      .locator("details, select"),
  ).toHaveCount(0);
  await page.goto("/write-ups/photo-graph");
  await expect(page.locator("[data-write-up-preview] details")).toHaveCount(0);
});

test("selection is camera-neutral standalone and preserves embedded recentering", async ({
  page,
}) => {
  const camera = (canvas: Locator) =>
    canvas.evaluate((element) => {
      const transform = (element as HTMLCanvasElement)
        .getContext("2d")!
        .getTransform();
      return [transform.a, transform.d, transform.e, transform.f];
    });
  await page.goto(experience);
  await browse(page);
  const standaloneCanvas = page
    .locator('[data-graph-mode="2d"] canvas')
    .first();
  await standaloneCanvas.screenshot();
  const before = await camera(standaloneCanvas);
  await selector(page).selectOption("third");
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  expect(await camera(standaloneCanvas)).toEqual(before);

  await page.goto(embedded);
  const first = page.getByRole("region", {
    name: "First embedded graph",
    exact: true,
  });
  await browse(page, first);
  const embeddedCanvas = first.locator("canvas").first();
  await embeddedCanvas.screenshot();
  const embeddedBefore = await camera(embeddedCanvas);
  await selector(first).selectOption("third");
  await expect
    .poll(async () => JSON.stringify(await camera(embeddedCanvas)))
    .not.toBe(JSON.stringify(embeddedBefore));
});

test("graph replacement recovers removed browser focus without stealing other focus", async ({
  page,
  context,
}) => {
  await context.route("**/api/photo-graph/graph?fixture=replacement", (route) =>
    route.fulfill({ json: graphPayload(["new"]) }),
  );
  await page.goto(embedded);
  const first = page.getByRole("region", {
    name: "First embedded graph",
    exact: true,
  });
  await browse(page, first);
  await selector(first).selectOption("related");
  const related = first.getByRole("button", {
    name: "Select photograph third",
    exact: true,
  });
  await related.focus();
  await page.evaluate(() =>
    window.dispatchEvent(new Event("photo-graph-fixture-replace")),
  );
  await expect(selector(first)).toHaveValue("new");
  await expect(summary(first)).toBeFocused();
  await page.reload();
  const replace = page.getByRole("button", {
    name: "Replace graph",
    exact: true,
  });
  await replace.focus();
  await replace.press("Enter");
  await expect(selector(first)).toHaveValue("new");
  await expect(replace).toBeFocused();
});

test("inspection retains its snapshot through graph replacement and rejects a stale opener", async ({
  page,
  context,
}) => {
  await context.route("**/api/photo-graph/graph?fixture=replacement", (route) =>
    route.fulfill({ json: graphPayload(["new"]) }),
  );
  await page.goto(embedded);
  const first = page.getByRole("region", {
    name: "First embedded graph",
    exact: true,
  });
  await browse(page, first);
  await openPhoto(first).click();
  await expect(inspect(page)).toBeVisible();
  await page.evaluate(() =>
    window.dispatchEvent(new Event("photo-graph-fixture-replace")),
  );
  await expect(selector(first)).toHaveValue("new");
  await expect(inspect(page)).toHaveAccessibleName("Inspect photograph first");
  await expect(
    inspect(page).getByRole("button", { name: "Close inspect overlay" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(selector(first)).toBeFocused();
});

for (const invalid of ["hidden", "disabled", "collapsed"] as const) {
  test(`inspection recovers when its opener becomes ${invalid}`, async ({
    page,
  }) => {
    await page.goto(experience);
    await browse(page);
    await openPhoto(page).click();
    await expect(inspect(page)).toBeVisible();
    await openPhoto(page).evaluate((button, invalid) => {
      if (invalid === "hidden") (button as HTMLElement).hidden = true;
      if (invalid === "disabled") (button as HTMLButtonElement).disabled = true;
      if (invalid === "collapsed") button.closest("details")!.open = false;
    }, invalid);
    await page.keyboard.press("Escape");
    await expect(inspect(page)).toHaveCount(0);
    await expect(
      invalid === "collapsed" ? summary(page) : selector(page),
    ).toBeFocused();
  });
}

test("loading, empty and error/retry expose no stale photograph actions", async ({
  page,
  context,
}) => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let ready = false;
  await context.route("**/api/photo-graph/graph", async (route) => {
    if (!ready) {
      await held;
      return route.fulfill({ status: 503, json: {} });
    }
    return route.fulfill({ json: graphPayload(["isolated"]) });
  });
  try {
    await page.goto(experience);
    await expect(
      page.getByText("Loading photographs", { exact: true }),
    ).toBeVisible();
    await summary(page).focus();
    await summary(page).press("Enter");
    await expect(selector(page)).toHaveCount(0);
    release();
    await expect(
      page
        .getByRole("region", {
          name: "Interactive photograph graph",
          exact: true,
        })
        .getByRole("alert"),
    ).toContainText("Photo graph unavailable");
    await expect(openPhoto(page)).toHaveCount(0);
    ready = true;
    await page.getByRole("button", { name: "Try again", exact: true }).click();
    await expect(selector(page)).toHaveValue("isolated");
    await expect(
      page.getByText("No connected photographs.", { exact: true }),
    ).toBeVisible();
    await context.route("**/api/photo-graph/graph", (route) =>
      route.fulfill({ json: { nodes: [], links: [] } }),
    );
    await page.reload();
    await expect(page.getByRole("status")).toHaveText(
      "No photographs available",
    );
    await expect(selector(page)).toHaveCount(0);
    await expect(summary(page)).toHaveCount(1);
  } finally {
    release();
  }
});

test("original metadata loading, failure and local download retain dialog keyboard control", async ({
  page,
  context,
}) => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let fail = true;
  await context.route("**/__photo-graph-keyboard.svg*", async (route) => {
    if (route.request().resourceType() === "fetch") {
      await held;
      if (fail) return route.fulfill({ status: 503 });
    }
    return route.fulfill({ contentType: "image/svg+xml", body: svg });
  });
  try {
    await page.goto(experience);
    await browse(page);
    await openPhoto(page).click();
    const download = inspect(page).locator("a", {
      hasText: "Download Original",
    });
    await expect(inspect(page)).toBeVisible();
    await expect(inspect(page).getByRole("button")).toBeFocused();
    await expect(download).toHaveAttribute("aria-disabled", "true");
    await page.keyboard.press("Tab");
    // Native modal tabbing may visit browser chrome (activeElement === body).
    expect(
      await page.evaluate(
        () =>
          document.activeElement === document.body ||
          !!document.activeElement?.closest("dialog[open]"),
      ),
    ).toBe(true);
    if (
      !(await inspect(page)
        .getByRole("button")
        .evaluate((button) => button === document.activeElement))
    ) {
      await page.keyboard.press("Tab");
    }
    await expect(inspect(page).getByRole("button")).toBeFocused();
    release();
    await expect(inspect(page)).toContainText("Unavailable");
    await inspect(page)
      .getByRole("button", { name: "Close inspect overlay" })
      .click();
    await expect(openPhoto(page)).toBeFocused();
    fail = false;
    await openPhoto(page).press("Enter");
    await expect(download).toHaveAttribute("aria-disabled", "false");
    const downloaded = page.waitForEvent("download");
    await download.press("Enter");
    expect((await downloaded).suggestedFilename()).toContain("first");
    await page.keyboard.press("Escape");
    await expect(openPhoto(page)).toBeFocused();
  } finally {
    release();
  }
});

async function click2DPhotograph(page: Page, root: Page | Locator = page) {
  const canvas = root.locator('[data-graph-mode="2d"] canvas').first();
  const documentOrigin = () => page.evaluate(() => performance.timeOrigin);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const origin = await documentOrigin();
    let point = { x: 0, y: 0 };
    await expect
      .poll(async () => {
        const { data, info } = await sharp(
          await canvas.screenshot({ scale: "css" }),
        )
          .removeAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });
        // This fixture supplies one photograph, fitted at the canvas centre.
        point = {
          x: Math.floor(info.width / 2),
          y: Math.floor(info.height / 2),
        };
        const index = (point.y * info.width + point.x) * info.channels;
        return (
          data[index] > 150 && data[index + 1] < 90 && data[index + 2] < 90
        );
      })
      .toBe(true);
    if (origin !== (await documentOrigin())) continue;
    await canvas.hover({ position: point });
    await expect(canvas).toHaveCSS("cursor", "pointer");
    if (origin !== (await documentOrigin())) continue;
    await canvas.click({ position: point });
    // The dev fixture can navigate while its previews finish loading.
    // Restart hit-testing only for a changed document, never a stable-page miss.
    if (origin === (await documentOrigin())) return;
  }
  throw new Error(
    "The browser fixture repeatedly navigated during canvas input.",
  );
}

test("real 2D clicks restore graph focus and modal keys do not escape into the host project carousel", async ({
  page,
  context,
}) => {
  await context.route("**/api/photo-graph/graph*", (route) =>
    route.fulfill({ json: graphPayload(["first"]) }),
  );
  await page.goto("/portfolio#project-photo-graph");
  const host = page.getByRole("region", {
    name: "Photo Node-Gallery focus view",
    exact: true,
  });
  await expect(host).toBeVisible();
  await expect(host).toBeFocused();
  await click2DPhotograph(page, host);
  await expect(inspect(page)).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(host).toBeVisible();
  await expect(page).toHaveURL(/#project-photo-graph$/);
  await page.keyboard.press("Escape");
  await expect(inspect(page)).toHaveCount(0);
  await expect(
    host.getByRole("region", {
      name: "Interactive photograph graph",
      exact: true,
    }),
  ).toBeFocused();
  await expect(page).toHaveURL(/#project-photo-graph$/);
});

test("responsive browser chrome keeps square focus, scroll access and existing navigation", async ({
  page,
}, info) => {
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    await page.goto(experience);
    for (const [width, height] of [
      [320, 844],
      [390, 844],
      [844, 390],
      [1440, 900],
    ]) {
      await page.setViewportSize({ width, height });
      await summary(page).focus();
      await summary(page).press("Enter");
      const details = summary(page).locator("..");
      await expect(details).toHaveCSS("border-radius", "0px");
      const bounds = (await details.boundingBox())!;
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
      expect(bounds.y).toBeGreaterThanOrEqual(0);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(height);
      expect(await page.evaluate(() => document.body.scrollWidth)).toBe(width);
      await selector(page).selectOption("isolated");
      await expect(openPhoto(page)).toBeVisible();
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.screenshot({
        path: info.outputPath(`browse-${colorScheme}-${width}.png`),
      });
      await openPhoto(page).press("Escape");
      await expect(summary(page)).toBeFocused();
    }
  }
});
