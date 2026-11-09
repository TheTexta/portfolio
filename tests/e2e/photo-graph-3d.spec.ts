import { expect, test, type Locator, type Page } from "@playwright/test";
import sharp from "sharp";
import { DEFAULT_PHOTO_GRAPH_RUNTIME_CONTROLS } from "../../lib/photo-graph/graph-controls";
import archive from "../../public/projects/photo-graph/worked-example/fixture.json";

const experience = "/projects/photo-graph/experience";
const mode = (page: Page, name: "2d" | "3d") =>
  page.locator(`[data-graph-mode="${name}"]`);
const toggle = (page: Page) =>
  page.getByRole("checkbox", { name: "3D view", exact: true });
const errors = new WeakMap<Page, string[]>();
const graphRequests = new WeakMap<Page, string[]>();

test.beforeEach(async ({ context, page }) => {
  const failures: string[] = [];
  errors.set(page, failures);
  page.on("pageerror", (error) => failures.push(error.message));
  const requests: string[] = [];
  graphRequests.set(page, requests);
  await context.route("https://**/*", (route) => route.abort());
  await context.route("**/__photo-graph-test.svg*", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="100"><rect width="160" height="100" fill="#c43b2c"/><path d="M0 0L160 100M160 0L0 100" stroke="#f2a168" stroke-width="6"/></svg>',
    }),
  );
  await context.route("**/api/photo-graph/graph", (route) => {
    requests.push(route.request().url());
    return route.fulfill({
      json: {
        nodes: ["first", "related", "third"].map((id, index) => ({
          id,
          sourceUrl: `/__photo-graph-test.svg?id=${id}`,
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
        links: [
          { source: "first", target: "related", value: 0.8, baseValue: 0.8 },
          { source: "related", target: "third", value: 0.5, baseValue: 0.5 },
        ],
        defaultGraphControls: DEFAULT_PHOTO_GRAPH_RUNTIME_CONTROLS,
      },
    });
  });
});

async function openSettings(page: Page) {
  await page
    .getByRole("button", { name: "Open graph controls", exact: true })
    .click();
}

async function enable3D(page: Page) {
  await page.goto(experience);
  await expect(mode(page, "2d").locator("canvas").first()).toBeVisible();
  await openSettings(page);
  await expect(toggle(page)).toBeEnabled();
  await toggle(page).check();
  await expect(mode(page, "3d").locator("canvas")).toBeVisible({
    timeout: 30_000,
  });
  await expect(
    page.getByRole("button", { name: "Reset view", exact: true }),
  ).toBeVisible();
  return graphRequests.get(page)!.length;
}

async function switchAppearance(input: Locator) {
  return input.locator("..").evaluate((label) => {
    const track = label.querySelector<HTMLElement>('span[aria-hidden="true"]')!;
    const thumb = track.firstElementChild!;
    const trackStyle = getComputedStyle(track);
    const thumbStyle = getComputedStyle(thumb);
    return {
      width: trackStyle.width,
      height: trackStyle.height,
      borderRadius: trackStyle.borderRadius,
      background: trackStyle.backgroundColor,
      thumbSize: thumbStyle.width,
      thumbColor: thumbStyle.backgroundColor,
      thumbTransform: thumbStyle.transform,
    };
  });
}

test("3D shares the theme switch styling without usage instructions", async ({
  page,
}, info) => {
  await page.emulateMedia({ colorScheme: "light" });
  await enable3D(page);
  const theme = page.getByRole("checkbox", { name: /^(Light|Dark)$/ });
  await expect(theme).not.toBeChecked();
  await expect(
    page.getByText(
      /Drag space to orbit|Right-drag to pan|two fingers to pan|Drag a photograph to/,
    ),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Reset view", exact: true }),
  ).toBeVisible();
  await toggle(page).uncheck();
  await expect
    .poll(
      async () =>
        JSON.stringify(await switchAppearance(toggle(page))) ===
        JSON.stringify(await switchAppearance(theme)),
    )
    .toBe(true);
  expect(await switchAppearance(toggle(page))).toMatchObject({
    width: "34px",
    height: "18px",
    borderRadius: "0px",
    thumbSize: "12px",
  });
  await toggle(page).focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(toggle(page)).toBeFocused();
  await expect(toggle(page).locator("..")).toHaveCSS("outline-style", "solid");
  await page.keyboard.press("Space");
  await expect(toggle(page)).toBeChecked();
  await expect(theme).not.toBeChecked();
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(theme).toBeChecked();
  await expect(toggle(page)).toBeChecked();
  await expect
    .poll(
      async () =>
        JSON.stringify(await switchAppearance(toggle(page))) ===
        JSON.stringify(await switchAppearance(theme)),
    )
    .toBe(true);
  await page
    .getByRole("button", { name: "Close graph controls", exact: true })
    .locator("../..")
    .screenshot({
      path: `.tmp/playwright-results/photo-graph-toggle-${info.project.name}.png`,
    });
  expect(errors.get(page)).toEqual([]);
});

async function photographPoint(page: Page) {
  const canvas = mode(page, "3d").locator("canvas");
  let point: { x: number; y: number } | undefined;
  await expect
    .poll(
      async () => {
        const { data, info } = await sharp(
          await canvas.screenshot({ scale: "css" }),
        )
          .removeAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });
        const isPhoto = (x: number, y: number) => {
          const index = (y * info.width + x) * info.channels;
          return (
            data[index] > 140 && data[index + 1] < 180 && data[index + 2] < 140
          );
        };
        for (let y = 60; y < info.height - 16; y += 4) {
          for (let x = 16; x < info.width - 16; x += 4) {
            const i = (y * info.width + x) * info.channels;
            if (
              data[i] > 140 &&
              data[i + 1] < 100 &&
              data[i + 2] < 90 &&
              [-8, 0, 8].every((dx) =>
                [-8, 0, 8].every((dy) => isPhoto(x + dx, y + dy)),
              )
            ) {
              point = { x, y };
              return true;
            }
          }
        }
        return false;
      },
      {
        timeout: 20_000,
        message: "3D photographs upload actual, coloured WebGL textures",
      },
    )
    .toBe(true);
  const bounds = (await canvas.boundingBox())!;
  return { x: bounds.x + point!.x, y: bounds.y + point!.y };
}

async function pixelDifference(first: Buffer, second: Buffer) {
  const a = await sharp(first).removeAlpha().raw().toBuffer();
  const b = await sharp(second).removeAlpha().raw().toBuffer();
  return (
    a.reduce((sum, value, index) => sum + Math.abs(value - b[index]), 0) /
    a.length
  );
}

test("orbiting and dragging work, and both modes restore their own camera and layout", async ({
  page,
}) => {
  await page.goto(experience);
  const twoD = mode(page, "2d").locator("canvas").first();
  await expect(twoD).toBeVisible();
  await openSettings(page);
  await expect(toggle(page)).toBeEnabled();
  await page
    .getByRole("button", { name: "Close graph controls", exact: true })
    .click();
  const bounds = (await twoD.boundingBox())!;
  await page.mouse.move(bounds.width * 0.7, bounds.height * 0.7);
  await page.mouse.wheel(0, -250);
  let before2D = await twoD.screenshot({ scale: "css" });
  await expect
    .poll(async () => {
      const next = await twoD.screenshot({ scale: "css" });
      const difference = await pixelDifference(before2D, next);
      before2D = next;
      return difference;
    })
    .toBeLessThan(0.01);
  await openSettings(page);
  await toggle(page).check();
  const threeD = mode(page, "3d").locator("canvas");
  await expect(threeD).toBeVisible({ timeout: 30_000 });
  await page
    .getByRole("button", { name: "Close graph controls", exact: true })
    .click();
  await photographPoint(page);
  const beforeOrbit = await threeD.screenshot({ scale: "css" });
  await page.mouse.move(bounds.width - 20, bounds.height - 20);
  await page.mouse.down();
  await page.mouse.move(bounds.width - 150, bounds.height - 90, { steps: 8 });
  await page.mouse.up();
  expect(
    await pixelDifference(
      beforeOrbit,
      await threeD.screenshot({ scale: "css" }),
    ),
  ).toBeGreaterThan(0.05);
  const photo = await photographPoint(page);
  await page.mouse.move(photo.x, photo.y);
  await page.mouse.down();
  await page.mouse.move(photo.x + 25, photo.y + 15, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  let before3D = await threeD.screenshot({ scale: "css" });
  await expect
    .poll(async () => {
      const next = await threeD.screenshot({ scale: "css" });
      const difference = await pixelDifference(before3D, next);
      before3D = next;
      return difference;
    })
    .toBeLessThan(0.01);
  await openSettings(page);
  await toggle(page).uncheck();
  await page
    .getByRole("button", { name: "Close graph controls", exact: true })
    .click();
  await expect(twoD).toBeVisible();
  await expect
    .poll(async () =>
      pixelDifference(before2D, await twoD.screenshot({ scale: "css" })),
    )
    .toBeLessThan(0.1);
  await openSettings(page);
  await toggle(page).check();
  await page
    .getByRole("button", { name: "Close graph controls", exact: true })
    .click();
  await expect(threeD).toBeVisible();
  await expect
    .poll(async () =>
      pixelDifference(before3D, await threeD.screenshot({ scale: "css" })),
    )
    .toBeLessThan(0.1);
  expect(errors.get(page)).toEqual([]);
});

test("the saved 100-photo archive renders in both themes and resizes without reloading", async ({
  context,
  page,
}, info) => {
  await context.route("**/api/photo-graph/graph", (route) =>
    route.fulfill({
      json: {
        nodes: archive.nodes.map((photo) => ({
          id: photo.id,
          sourceUrl: photo.src,
          baseSize: 100,
          aspectRatio: photo.width / photo.height,
          hasKnownAspectRatio: true,
          layerNoise: 0,
          w: 100 * Math.sqrt(photo.width / photo.height),
          h: 100 / Math.sqrt(photo.width / photo.height),
          renderArea: 10000,
        })),
        links: archive.defaultGraph.edges.map((edge) => ({
          source: edge.source,
          target: edge.target,
          value: edge.weight,
          baseValue: edge.weight,
        })),
      },
    }),
  );
  let images = 0;
  page.on("response", (response) => {
    if (response.ok() && response.url().includes("/worked-example/thumbnails/"))
      images += 1;
  });
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await enable3D(page);
  await page
    .getByRole("button", { name: "Close graph controls", exact: true })
    .click();
  await expect.poll(() => images, { timeout: 20_000 }).toBeGreaterThan(40);
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme });
    await expect(page.locator("html")).toHaveClass(
      colorScheme === "dark" ? /dark/ : /^(?!.*dark)/,
    );
    await mode(page, "3d").screenshot({
      path: `.tmp/playwright-results/photo-graph-3d-${info.project.name}-${colorScheme}.png`,
    });
  }
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(mode(page, "3d").locator("canvas")).toBeVisible();
  await openSettings(page);
  await expect(
    page.getByRole("button", { name: "Reset view", exact: true }),
  ).toBeVisible();
  await expect(toggle(page)).toBeChecked();
  expect(errors.get(page)).toEqual([]);
});

test("2D is default; 3D loads only on activation and is absent from article previews", async ({
  page,
}) => {
  const chunks: string[] = [];
  page.on("request", (request) => {
    if (/PhotoGraph3DRenderer|react-force-graph-3d/.test(request.url()))
      chunks.push(request.url());
  });
  await page.goto(experience);
  await expect(mode(page, "2d").locator("canvas").first()).toBeVisible();
  await openSettings(page);
  await expect(toggle(page)).not.toBeChecked();
  expect(chunks).toEqual([]);
  await toggle(page).focus();
  await page.keyboard.press("Space");
  await expect(mode(page, "3d").locator("canvas")).toBeVisible({
    timeout: 30_000,
  });
  expect(chunks.length).toBeGreaterThan(0);
  await expect(toggle(page)).toBeFocused();
  await page.reload();
  await expect(mode(page, "2d").locator("canvas").first()).toBeVisible();
  await page.goto("/write-ups/photo-graph");
  await expect(page.getByRole("article")).toBeVisible();
  await expect(page.getByLabel("3D view", { exact: true })).toHaveCount(0);
  expect(errors.get(page)).toEqual([]);
});

test("3D photographs inspect through the shared overlay and settings survive switching", async ({
  page,
}, info) => {
  const initialRequests = await enable3D(page);
  await expect(page.getByText("1600 units", { exact: true })).toBeVisible();
  const repel = page.getByRole("slider", {
    name: "Repel strength",
    exact: true,
  });
  await repel.focus();
  await page.keyboard.press("ArrowRight");
  const value = await repel.inputValue();
  await page
    .getByRole("checkbox", { name: "Show connecting lines", exact: true })
    .uncheck();
  await page.getByRole("button", { name: "Reset view", exact: true }).click();
  await page
    .getByRole("button", { name: "Close graph controls", exact: true })
    .click();
  const point = await photographPoint(page);
  await page.mouse.move(point.x, point.y);
  // The graph updates its native raycast/hover target on animation frames.
  await expect(mode(page, "3d").locator("canvas")).toHaveCSS(
    "cursor",
    /pointer|grab/,
  );
  if (info.project.name === "mobile")
    await page.touchscreen.tap(point.x, point.y);
  else await page.mouse.click(point.x, point.y);
  const dialog = page.getByRole("dialog", { name: /Inspect photograph/ });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("link", { name: "Download Original" }),
  ).not.toHaveAttribute("aria-disabled", "true");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await openSettings(page);
  await toggle(page).uncheck();
  await expect(mode(page, "2d").locator("canvas").first()).toBeVisible();
  await expect(repel).toHaveValue(value);
  await expect(
    page.getByRole("checkbox", { name: "Show connecting lines", exact: true }),
  ).not.toBeChecked();
  await toggle(page).check();
  await expect(mode(page, "3d").locator("canvas")).toBeVisible();
  expect(graphRequests.get(page)).toHaveLength(initialRequests);
  expect(errors.get(page)).toEqual([]);
});

test("repeated switches release owned WebGL contexts and never accumulate canvases", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    const contexts: {
      canvas: HTMLCanvasElement;
      gl: WebGL2RenderingContext;
    }[] = [];
    Object.assign(window, { graphContexts: contexts });
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      options?: unknown,
    ) {
      const result = original.call(
        this,
        type as "2d",
        options as CanvasRenderingContext2DSettings,
      );
      if (
        type === "webgl2" &&
        result &&
        !contexts.some(({ canvas }) => canvas === this)
      )
        contexts.push({
          canvas: this,
          gl: result as unknown as WebGL2RenderingContext,
        });
      return result;
    } as typeof original;
  });
  const initialRequests = await enable3D(page);
  for (let cycle = 0; cycle < 4; cycle += 1) {
    await toggle(page).uncheck();
    await expect(mode(page, "2d").locator("canvas").first()).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() => {
          const { graphContexts } = window as unknown as {
            graphContexts: {
              canvas: HTMLCanvasElement;
              gl: WebGL2RenderingContext;
            }[];
          };
          return graphContexts.every(
            ({ canvas, gl }) => !canvas.isConnected && gl.isContextLost(),
          );
        }),
      )
      .toBe(true);
    await toggle(page).check();
    await expect(mode(page, "3d").locator("canvas")).toHaveCount(1);
  }
  expect(graphRequests.get(page)).toHaveLength(initialRequests);
  expect(errors.get(page)).toEqual([]);
});

test("context loss restores 2D with an accessible explanation and a retry", async ({
  page,
}) => {
  const initialRequests = await enable3D(page);
  await page
    .getByRole("button", { name: "Close graph controls", exact: true })
    .click();
  await mode(page, "3d").locator("canvas").dispatchEvent("webglcontextlost");
  await expect(mode(page, "2d").locator("canvas").first()).toBeVisible();
  await expect(
    page.getByText(/3D is unavailable on this device/),
  ).toBeVisible();
  await openSettings(page);
  await expect(toggle(page)).not.toBeChecked();
  await toggle(page).check();
  await expect(mode(page, "3d").locator("canvas")).toBeVisible();
  expect(graphRequests.get(page)).toHaveLength(initialRequests);
});

test("force sliders still rearrange a restored view, including settings changed in the other mode", async ({
  page,
}) => {
  await enable3D(page);
  await toggle(page).uncheck();
  const twoD = mode(page, "2d").locator("canvas").first();
  await expect(twoD).toBeVisible();
  const before2D = await twoD.screenshot({ scale: "css" });
  const distance = page.getByRole("slider", {
    name: "Widest link distance",
    exact: true,
  });
  await distance.focus();
  await page.keyboard.press("End");
  await expect
    .poll(async () =>
      pixelDifference(before2D, await twoD.screenshot({ scale: "css" })),
    )
    .toBeGreaterThan(0.1);
  await toggle(page).check();
  const threeD = mode(page, "3d").locator("canvas");
  await expect(threeD).toBeVisible();
  await expect(page.getByText("8000 units", { exact: true })).toBeVisible();
  const before3D = await threeD.screenshot({ scale: "css" });
  await distance.focus();
  await page.keyboard.press("Home");
  await expect
    .poll(async () =>
      pixelDifference(before3D, await threeD.screenshot({ scale: "css" })),
    )
    .toBeGreaterThan(0.1);
  expect(errors.get(page)).toEqual([]);
});

test("texture-budget pressure downscales visible photos without repeatedly fetching them", async ({
  context,
  page,
}) => {
  await context.route("**/api/photo-graph/graph", (route) =>
    route.fulfill({
      json: {
        nodes: Array.from({ length: 103 }, (_, index) => ({
          id: String(index),
          sourceUrl: `/__photo-graph-test.svg?id=${index}`,
          baseSize: 1000,
          aspectRatio: 1,
          hasKnownAspectRatio: true,
          layerNoise: 0,
          w: 1000,
          h: 1000,
          renderArea: 1000000,
          x: 0,
          y: 0,
          z: 0,
        })),
        links: [],
        defaultGraphControls: {
          ...DEFAULT_PHOTO_GRAPH_RUNTIME_CONTROLS,
          chargeMult: 0,
          collideStrength: 0,
          collideIterations: 0,
        },
      },
    }),
  );
  await context.route("**/__photo-graph-test.svg*", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="1024" height="1024" fill="#c43b2c"/></svg>',
    }),
  );
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("__photo-graph-test.svg"))
      requests.push(request.url());
  });
  await page.addInitScript(() => {
    const uploads: { width: number; height: number }[] = [];
    Object.assign(window, { graphTextureUploads: uploads });
    const original = WebGL2RenderingContext.prototype.texSubImage2D;
    WebGL2RenderingContext.prototype.texSubImage2D = function (
      this: WebGL2RenderingContext,
      ...args: Parameters<typeof original>
    ) {
      const image = args.at(-1);
      if (image instanceof HTMLCanvasElement)
        uploads.push({ width: image.width, height: image.height });
      return Reflect.apply(original, this, args);
    } as typeof original;
  });
  await enable3D(page);
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            (window as unknown as { graphTextureUploads: unknown[] })
              .graphTextureUploads.length,
        ),
      { timeout: 20_000 },
    )
    .toBeGreaterThanOrEqual(103);
  const uploads = await page.evaluate(
    () =>
      (
        window as unknown as {
          graphTextureUploads: { width: number; height: number }[];
        }
      ).graphTextureUploads,
  );
  expect(
    uploads.every(({ width, height }) => width <= 349 && height <= 349),
  ).toBe(true);
  const count = requests.length;
  // Observe several real 500 ms budget scans; a static viewport must stay quiet.
  await page.waitForTimeout(1600);
  expect(requests).toHaveLength(count);
  expect(errors.get(page)).toEqual([]);
});

test("unsupported WebGL falls back without breaking graph controls", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      options?: unknown,
    ) {
      if (/webgl/i.test(type)) return null;
      return original.call(
        this,
        type as "2d",
        options as CanvasRenderingContext2DSettings,
      );
    } as typeof original;
  });
  await page.goto(experience);
  await openSettings(page);
  await expect(toggle(page)).toBeEnabled();
  await toggle(page).check();
  await expect(page.getByText(/3D is unavailable on this device/)).toBeVisible({
    timeout: 30_000,
  });
  await expect(toggle(page)).not.toBeChecked();
  await expect(mode(page, "2d").locator("canvas").first()).toBeVisible();
  await expect(
    page.getByRole("slider", { name: "Repel strength", exact: true }),
  ).toBeEnabled();
});

test("a failed lazy chunk retains 2D and reports how to retry", async ({
  context,
  page,
}) => {
  await context.route("**/*PhotoGraph3DRenderer*", (route) => route.abort());
  await page.goto(experience);
  await openSettings(page);
  await expect(toggle(page)).toBeEnabled();
  await toggle(page).check();
  await expect(page.getByText(/3D could not load/)).toBeVisible({
    timeout: 30_000,
  });
  await expect(toggle(page)).not.toBeChecked();
  await expect(mode(page, "2d").locator("canvas").first()).toBeVisible();
});

test("turning off 3D during its download ignores the stale completion", async ({
  context,
  page,
}) => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await context.route("**/*PhotoGraph3DRenderer*", async (route) => {
    await held;
    await route.continue();
  });
  try {
    await page.goto(experience);
    await openSettings(page);
    await expect(toggle(page)).toBeEnabled();
    const initialRequests = graphRequests.get(page)!.length;
    await toggle(page).check();
    await expect(
      page.getByText("Loading 3D view…", { exact: true }),
    ).toBeVisible();
    await toggle(page).uncheck();
    release();
    await expect(mode(page, "2d").locator("canvas").first()).toBeVisible();
    await expect(toggle(page)).not.toBeChecked();
    await toggle(page).check();
    await expect(mode(page, "3d").locator("canvas")).toBeVisible({
      timeout: 30_000,
    });
    expect(graphRequests.get(page)).toHaveLength(initialRequests);
    expect(errors.get(page)).toEqual([]);
  } finally {
    release();
  }
});
