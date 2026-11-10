import { expect, test, type Locator, type Page } from "@playwright/test";
import sharp from "sharp";
import { DEFAULT_PHOTO_GRAPH_RUNTIME_CONTROLS } from "../../lib/photo-graph/graph-controls";
import archive from "../../public/projects/photo-graph/worked-example/fixture.json";
import {
  PHOTO_GRAPH_RENDER_PIXEL_BUDGET,
  photoGraphRenderPixelRatio,
} from "../../app/components/projects/photo-graph/render-quality";
import {
  PHOTO_GRAPH_MAX_TEXTURE_SIDE,
  PHOTO_GRAPH_TEXTURE_BUDGET,
} from "../../app/components/projects/photo-graph/texture-budget";

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
    page.getByRole("button", { name: "Reset", exact: true }),
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
    page.getByRole("button", { name: "Reset", exact: true }),
  ).toBeVisible();
  await toggle(page).uncheck();
  await page.mouse.move(0, page.viewportSize()!.height - 1);
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
  // Canvas screenshots include the overlaid controls; compare neutral hover states.
  await page.mouse.move(bounds.width * 0.7, bounds.height * 0.7);
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
  await page.mouse.move(bounds.width * 0.7, bounds.height * 0.7);
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
    page.getByRole("button", { name: "Reset", exact: true }),
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
  await page.getByRole("button", { name: "Reset", exact: true }).click();
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

test("reset stays beside compact in both modes without overlapping narrow controls", async ({
  page,
}) => {
  await page.goto(experience);
  const reset = page.getByRole("button", { name: "Reset", exact: true });
  const compact = page.getByRole("link", {
    name: "Return to project write up",
    exact: true,
  });
  await expect(reset).toBeEnabled();
  for (const width of [320, 390, 844, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    const resetBox = (await reset.boundingBox())!;
    const compactBox = (await compact.boundingBox())!;
    const controlsBox = (await page
      .getByRole("button", { name: "Open graph controls", exact: true })
      .locator("../..")
      .boundingBox())!;
    expect(resetBox.x + resetBox.width).toBeLessThan(compactBox.x);
    expect(resetBox.y).toBe(compactBox.y);
    expect(controlsBox.x + controlsBox.width).toBeLessThan(resetBox.x);
  }
  await openSettings(page);
  await toggle(page).check();
  await expect(mode(page, "3d").locator("canvas")).toBeVisible({
    timeout: 30_000,
  });
  await page
    .getByRole("button", { name: "Close graph controls", exact: true })
    .click();
  await expect(reset).toBeVisible();
  expect(errors.get(page)).toEqual([]);
});

test("only buttons and square slider handles invert, with stable borders and tracks", async ({
  page,
  isMobile,
}, info) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto(experience);
  await openSettings(page);
  const checkbox = page.getByRole("checkbox", {
    name: "Show connecting lines",
    exact: true,
  });
  await expect(checkbox).toHaveCSS("border-radius", "0px");
  await expect(checkbox).toHaveCSS("appearance", "none");
  await checkbox.focus();
  await page.keyboard.press("Space");
  await expect(checkbox).not.toBeChecked();
  const slider = page.getByRole("slider", {
    name: "Repel strength",
    exact: true,
  });
  const thumbRadii = await slider.evaluate((input) => {
    const selectors = (input as HTMLInputElement).className
      .split(/\s+/)
      .map((name) => `.${CSS.escape(name)}::-`);
    return Array.from(document.styleSheets)
      .flatMap((sheet) => Array.from(sheet.cssRules))
      .filter(
        (rule): rule is CSSStyleRule =>
          rule instanceof CSSStyleRule &&
          selectors.some((selector) =>
            rule.selectorText.startsWith(selector),
          ) &&
          rule.selectorText.includes("::-webkit-slider-thumb"),
      )
      .map((rule) => rule.style.borderRadius)
      .filter(Boolean);
  });
  // Chromium omits unsupported Gecko pseudo-elements from its CSSOM.
  expect(thumbRadii).toEqual(["0px"]);
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme });
    await expect(page.locator("html")).toHaveClass(
      colorScheme === "dark" ? /dark/ : /^(?!.*dark)/,
    );
    if (!isMobile) {
      const reset = page.getByRole("button", { name: "Reset", exact: true });
      const original = await reset.evaluate(() => {
        const tokens = getComputedStyle(document.documentElement);
        const color = (token: string) =>
          `rgb(${tokens.getPropertyValue(token).trim().split(/\s+/).join(", ")})`;
        return { background: color("--canvas-rgb"), color: color("--ink-rgb") };
      });
      await expect(reset).toHaveCSS("background-color", original.background);
      await expect(reset).toHaveCSS("color", original.color);
      const border = await reset.evaluate(
        (element) => getComputedStyle(element).borderColor,
      );
      await reset.hover();
      await expect(reset).toHaveCSS("background-color", original.color);
      await expect(reset).toHaveCSS("color", original.background);
      await expect(reset).toHaveCSS("border-color", border);
      const compact = page.getByRole("link", {
        name: "Return to project write up",
        exact: true,
      });
      await compact.hover();
      await expect(compact).toHaveCSS("background-color", original.color);
      await expect(compact).toHaveCSS("border-color", original.color);
      const appearance = (input: Locator) =>
        input.locator("..").evaluate((label) => {
          const style = getComputedStyle(label);
          const checkbox = label.querySelector("input")!;
          return {
            background: style.backgroundColor,
            color: style.color,
            inputBackground: getComputedStyle(checkbox).backgroundColor,
          };
        });
      for (const input of [
        checkbox,
        toggle(page),
        page.getByRole("checkbox", { name: /^(Light|Dark)$/ }),
      ]) {
        await page.mouse.move(0, page.viewportSize()!.height - 1);
        const before = await appearance(input);
        const switchBefore =
          input === checkbox ? null : await switchAppearance(input);
        await input.locator("..").hover();
        expect(await appearance(input)).toEqual(before);
        if (switchBefore)
          expect(await switchAppearance(input)).toEqual(switchBefore);
      }
      const bounds = (await slider.boundingBox())!;
      const fraction = await slider.evaluate((input) => {
        const range = input as HTMLInputElement;
        return (
          (range.valueAsNumber - Number(range.min)) /
          (Number(range.max) - Number(range.min))
        );
      });
      const thumbX = 8 + (bounds.width - 16) * fraction;
      const samples = async () => {
        const { data, info } = await sharp(
          await slider.screenshot({ scale: "css", animations: "disabled" }),
        )
          .removeAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });
        const pixel = (x: number) => [
          ...data.subarray(
            (Math.floor(info.height / 2) * info.width + Math.round(x)) *
              info.channels,
            (Math.floor(info.height / 2) * info.width + Math.round(x)) *
              info.channels +
              3,
          ),
        ];
        return { thumb: pixel(thumbX), track: pixel(info.width - 4) };
      };
      await page.mouse.move(0, page.viewportSize()!.height - 1);
      const beforeSlider = await samples();
      await page.mouse.move(bounds.x + thumbX, bounds.y + bounds.height / 2);
      await expect.poll(samples).toEqual({
        thumb: original.background.match(/\d+/g)!.map(Number),
        track: beforeSlider.track,
      });
      await page.mouse.move(
        bounds.x + bounds.width - 4,
        bounds.y + bounds.height / 2,
      );
      await expect.poll(samples).toEqual(beforeSlider);
      await page.mouse.move(0, page.viewportSize()!.height - 1);
    }
    await page
      .getByRole("button", { name: "Close graph controls", exact: true })
      .locator("../..")
      .screenshot({
        path: `.tmp/playwright-results/photo-graph-square-${info.project.name}-${colorScheme}.png`,
        animations: "disabled",
      });
  }
  expect(errors.get(page)).toEqual([]);
});

test("only slider handles drag, tracks do not seek, and keyboard control remains", async ({
  page,
  context,
  isMobile,
}) => {
  await page.goto(experience);
  await openSettings(page);
  const slider = page.getByRole("slider", {
    name: "Repel strength",
    exact: true,
  });
  const initialValue = await slider.inputValue();
  const bounds = (await slider.boundingBox())!;
  const fraction = await slider.evaluate((input) => {
    const range = input as HTMLInputElement;
    return (
      (range.valueAsNumber - Number(range.min)) /
      (Number(range.max) - Number(range.min))
    );
  });
  const thumb = {
    x: bounds.x + 8 + (bounds.width - 16) * fraction,
    y: bounds.y + bounds.height / 2,
  };
  const track = { x: bounds.x + bounds.width - 8, y: thumb.y };
  expect(
    await page.evaluate(
      ({ x, y }) =>
        document.elementFromPoint(x, y)?.matches('input[type="range"]'),
      thumb,
    ),
  ).toBe(true);
  expect(
    await page.evaluate(
      ({ x, y }) =>
        document.elementFromPoint(x, y)?.matches('input[type="range"]'),
      track,
    ),
  ).toBe(false);
  if (isMobile) await page.touchscreen.tap(track.x, track.y);
  else {
    await page.mouse.click(track.x, track.y);
    await page.mouse.down();
    await page.mouse.move(track.x - 40, track.y, { steps: 4 });
    await page.mouse.up();
  }
  await expect(slider).toHaveValue(initialValue);
  if (isMobile) {
    const cdp = await context.newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [thumb],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: thumb.x + 40, y: thumb.y }],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await cdp.detach();
  } else {
    await page.mouse.move(thumb.x, thumb.y);
    await page.mouse.down();
    await page.mouse.move(thumb.x + 40, thumb.y, { steps: 8 });
    await page.mouse.up();
  }
  await expect(slider).not.toHaveValue(initialValue);
  const draggedValue = Number(await slider.inputValue());
  await slider.focus();
  await page.keyboard.press("ArrowRight");
  expect(Number(await slider.inputValue())).toBe(draggedValue + 1);
  expect(errors.get(page)).toEqual([]);
});

test("horizontal trackpad scrolling adjusts only the hovered slider in both modes", async ({
  page,
}) => {
  await page.goto(experience);
  await openSettings(page);
  await expect(toggle(page)).toBeEnabled();
  const slider = page.getByRole("slider", {
    name: "Repel strength",
    exact: true,
  });
  const sliders = page.getByRole("slider");
  for (const graphMode of ["2d", "3d"] as const) {
    if (graphMode === "3d") {
      await toggle(page).check();
      await expect(mode(page, "3d").locator("canvas")).toBeVisible({
        timeout: 30_000,
      });
    }
    const otherValues = await sliders.evaluateAll((inputs) =>
      inputs.slice(1).map((input) => (input as HTMLInputElement).value),
    );
    const initial = Number(await slider.inputValue());
    const bounds = (await slider.boundingBox())!;
    // The track itself is not draggable, but its field still accepts wheel input.
    await page.mouse.move(
      bounds.x + bounds.width - 4,
      bounds.y + bounds.height / 2,
    );
    await page.mouse.wheel(48, 0);
    await expect
      .poll(async () => Number(await slider.inputValue()))
      .toBeGreaterThan(initial);
    const increased = Number(await slider.inputValue());
    await expect(slider).toHaveAttribute(
      "aria-valuetext",
      `${(increased * 0.1).toFixed(1)}x`,
    );
    await page.mouse.wheel(-48, 0);
    await expect
      .poll(async () => Number(await slider.inputValue()))
      .toBeLessThan(increased);
    expect(
      await sliders.evaluateAll((inputs) =>
        inputs.slice(1).map((input) => (input as HTMLInputElement).value),
      ),
    ).toEqual(otherValues);
    await expect(slider).not.toBeFocused();
  }
  expect(errors.get(page)).toEqual([]);
});

test("slider wheel input handles fractional gestures and bounds without hijacking vertical scroll or pinch", async ({
  page,
}) => {
  await page.goto(experience);
  await openSettings(page);
  await expect(toggle(page)).toBeEnabled();
  const slider = page.getByRole("slider", {
    name: "Repel strength",
    exact: true,
  });
  const initial = await slider.inputValue();
  for (const delta of [
    { deltaX: 0, deltaY: 60 },
    { deltaX: 8, deltaY: 60 },
    { deltaX: 60, deltaY: 0, ctrlKey: true },
  ]) {
    expect(
      await slider.evaluate((input, delta) => {
        const event = new WheelEvent("wheel", {
          bubbles: true,
          cancelable: true,
          ...delta,
        });
        input.parentElement!.dispatchEvent(event);
        return event.defaultPrevented;
      }, delta),
    ).toBe(false);
    await expect(slider).toHaveValue(initial);
  }
  await slider.focus();
  await page.keyboard.press("Home");
  const min = Number(await slider.getAttribute("min"));
  await slider.evaluate((input) => {
    const range = input as HTMLInputElement;
    const deltaX =
      ((range.getBoundingClientRect().width /
        (Number(range.max) - Number(range.min))) *
        2.5) /
      20;
    for (let index = 0; index < 20; index += 1)
      range.parentElement!.dispatchEvent(
        new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaX }),
      );
  });
  await expect(slider).toHaveValue(String(min + 2));
  expect(
    await slider.evaluate((input) => {
      const event = new WheelEvent("wheel", {
        bubbles: true,
        cancelable: true,
        deltaX: 1,
        deltaMode: WheelEvent.DOM_DELTA_PAGE,
      });
      input.parentElement!.dispatchEvent(event);
      return event.defaultPrevented;
    }),
  ).toBe(true);
  const max = Number(await slider.getAttribute("max"));
  await expect(slider).toHaveValue(String(max));
  await slider.evaluate((input) =>
    input.parentElement!.dispatchEvent(
      new WheelEvent("wheel", {
        bubbles: true,
        cancelable: true,
        deltaX: 100000,
      }),
    ),
  );
  await expect(slider).toHaveValue(String(max));
  await slider.evaluate((input) => {
    const range = input as HTMLInputElement;
    const pixelsPerStep =
      range.getBoundingClientRect().width /
      (Number(range.max) - Number(range.min));
    for (let index = 0; index < 10; index += 1)
      range.parentElement!.dispatchEvent(
        new WheelEvent("wheel", {
          bubbles: true,
          cancelable: true,
          deltaX: pixelsPerStep * 0.05,
        }),
      );
    range.parentElement!.dispatchEvent(
      new WheelEvent("wheel", {
        bubbles: true,
        cancelable: true,
        deltaX: -pixelsPerStep * 1.25,
      }),
    );
  });
  await expect(slider).toHaveValue(String(max - 1));
  await slider.evaluate((input) =>
    input.parentElement!.dispatchEvent(
      new WheelEvent("wheel", {
        bubbles: true,
        cancelable: true,
        deltaX: -1,
        deltaMode: WheelEvent.DOM_DELTA_PAGE,
      }),
    ),
  );
  await expect(slider).toHaveValue(String(min));
  await slider.evaluate((input) =>
    input.parentElement!.dispatchEvent(
      new WheelEvent("wheel", {
        bubbles: true,
        cancelable: true,
        deltaX: 1,
        deltaMode: WheelEvent.DOM_DELTA_LINE,
      }),
    ),
  );
  await expect
    .poll(async () => Number(await slider.inputValue()))
    .toBeGreaterThan(min);
  await page.setViewportSize({ width: 1000, height: 280 });
  const panel = page
    .getByRole("button", { name: "Close graph controls", exact: true })
    .locator("../..");
  const beforeVertical = await slider.inputValue();
  const bounds = (await slider.boundingBox())!;
  await page.mouse.move(
    bounds.x + bounds.width - 4,
    bounds.y + bounds.height / 2,
  );
  await page.mouse.wheel(0, 80);
  await expect
    .poll(() => panel.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(0);
  await expect(slider).toHaveValue(beforeVertical);
  expect(errors.get(page)).toEqual([]);
});

test("3D uses real antialiasing and upgrades zoomed tiles to larger GPU textures", async ({
  context,
  page,
}) => {
  await context.route("**/api/photo-graph/graph", (route) =>
    route.fulfill({
      json: {
        nodes: [-2400, 0, 2400].map((x, index) => ({
          id: String(index + 1),
          sourceUrl: `https://media.dextery.dev/photo-graph/photography-images/${index + 1}.webp`,
          storagePath: `photography-images/${index + 1}.webp`,
          storageProvider: "r2",
          baseSize: 100,
          aspectRatio: 1.6,
          hasKnownAspectRatio: true,
          layerNoise: 0,
          w: 160,
          h: 100,
          renderArea: 16000,
          x,
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
  const widths: number[] = [];
  await context.route("https://images.dextery.dev/photo-graph/**", (route) => {
    const width = Number(
      new URL(route.request().url()).searchParams.get("width"),
    );
    widths.push(width);
    return route.fulfill({
      contentType: "image/svg+xml",
      headers: { "access-control-allow-origin": "*" },
      body: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${Math.round(width / 1.6)}"><rect width="100%" height="100%" fill="#c43b2c"/><path d="M0 0L${width} ${Math.round(width / 1.6)}" stroke="#f2a168" stroke-width="2"/></svg>`,
    });
  });
  await page.addInitScript(() => {
    const uploads: number[] = [];
    Object.assign(window, { graphTextureWidths: uploads });
    const original = WebGL2RenderingContext.prototype.texSubImage2D;
    WebGL2RenderingContext.prototype.texSubImage2D = function (
      this: WebGL2RenderingContext,
      ...args: Parameters<typeof original>
    ) {
      const image = args.at(-1);
      if (image instanceof HTMLCanvasElement) uploads.push(image.width);
      return Reflect.apply(original, this, args);
    } as typeof original;
  });
  await enable3D(page);
  const canvas = mode(page, "3d").locator("canvas");
  const resolution = await canvas.evaluate((element) => {
    const canvas = element as HTMLCanvasElement;
    const bounds = canvas.getBoundingClientRect();
    return {
      width: canvas.width,
      height: canvas.height,
      cssWidth: bounds.width,
      cssHeight: bounds.height,
      dpr: devicePixelRatio,
    };
  });
  const ratio = photoGraphRenderPixelRatio(
    resolution.cssWidth,
    resolution.cssHeight,
    resolution.dpr,
  );
  expect(Math.abs(resolution.width - resolution.cssWidth * ratio)).toBeLessThan(
    1,
  );
  expect(
    Math.abs(resolution.height - resolution.cssHeight * ratio),
  ).toBeLessThan(1);
  expect(
    await canvas.evaluate(
      (element) =>
        (element as HTMLCanvasElement)
          .getContext("webgl2")
          ?.getContextAttributes()?.antialias,
    ),
  ).toBe(true);
  const uploadedWidths = () =>
    page.evaluate(
      () =>
        (window as unknown as { graphTextureWidths: number[] })
          .graphTextureWidths,
    );
  await expect
    .poll(async () => (await uploadedWidths()).length)
    .toBeGreaterThanOrEqual(3);
  const initialWidth = Math.max(...(await uploadedWidths()));
  await page
    .getByRole("button", { name: "Close graph controls", exact: true })
    .click();
  const bounds = (await canvas.boundingBox())!;
  await page.mouse.move(
    bounds.x + bounds.width / 2,
    bounds.y + bounds.height * 0.75,
  );
  for (let step = 0; step < 8; step += 1) {
    await canvas.dispatchEvent("wheel", {
      deltaY: -500,
      deltaMode: 0,
      ctrlKey: false,
    });
  }
  await expect
    .poll(async () => Math.max(...(await uploadedWidths())), {
      timeout: 15_000,
    })
    .toBeGreaterThan(initialWidth);
  expect(Math.max(...widths)).toBeGreaterThan(initialWidth);
  expect(Math.max(...(await uploadedWidths()))).toBeLessThanOrEqual(
    PHOTO_GRAPH_MAX_TEXTURE_SIDE,
  );
  const count = widths.length;
  await page.waitForTimeout(1600);
  expect(widths).toHaveLength(count);
  expect(errors.get(page)).toEqual([]);
});

for (const density of [1, 2]) {
  test.describe(`crowded close-ups at density ${density}`, () => {
    test.use({ deviceScaleFactor: density });

    test("a viewport-filling photo upgrades with 102 visible background photos", async ({
      page,
      context,
    }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      const aspectRatio = 1.81;
      await context.route("**/api/photo-graph/graph", (route) =>
        route.fulfill({
          json: {
            nodes: Array.from({ length: 103 }, (_, index) => ({
              id: String(index + 1),
              sourceUrl: `https://media.dextery.dev/photo-graph/photography-images/${index + 1}.webp`,
              storagePath: `photography-images/${index + 1}.webp`,
              storageProvider: "r2",
              baseSize: 100,
              aspectRatio,
              hasKnownAspectRatio: true,
              layerNoise: 0,
              w: 160,
              h: 160 / aspectRatio,
              renderArea: (160 * 160) / aspectRatio,
              x: index === 0 ? 0 : (((index - 1) % 17) - 8) * 50,
              y: index === 0 ? 0 : (Math.floor((index - 1) / 17) - 2.5) * 50,
              z: index === 0 ? 0 : -2500,
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
      const requests: string[] = [];
      await context.route(
        "https://images.dextery.dev/photo-graph/**",
        (route) => {
          const url = new URL(route.request().url());
          const width = Number(url.searchParams.get("width"));
          requests.push(url.toString());
          return route.fulfill({
            contentType: "image/svg+xml",
            headers: { "access-control-allow-origin": "*" },
            body: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${Math.round(width / aspectRatio)}"><rect width="100%" height="100%" fill="#c43b2c"/></svg>`,
          });
        },
      );
      await page.addInitScript(() => {
        const state = {
          heroScreenWidth: 0,
          peakBytes: 0,
          textures: new Map<
            WebGLTexture,
            { id: string; width: number; height: number }
          >(),
        };
        Object.assign(window, { crowdedGraphTextures: state });
        const sources = new WeakMap<HTMLCanvasElement, string>();
        const drawImage = CanvasRenderingContext2D.prototype.drawImage;
        CanvasRenderingContext2D.prototype.drawImage = function (
          this: CanvasRenderingContext2D,
          ...args: Parameters<typeof drawImage>
        ) {
          const image = args[0];
          const id =
            image instanceof HTMLImageElement
              ? new URL(image.src, location.href).pathname.match(
                  /\/(\d+)\.webp$/,
                )?.[1]
              : image instanceof HTMLCanvasElement
                ? sources.get(image)
                : undefined;
          if (id) sources.set(this.canvas, id);
          return Reflect.apply(drawImage, this, args);
        } as typeof drawImage;
        const upload = WebGL2RenderingContext.prototype.texSubImage2D;
        WebGL2RenderingContext.prototype.texSubImage2D = function (
          this: WebGL2RenderingContext,
          ...args: Parameters<typeof upload>
        ) {
          const image = args.at(-1);
          if (image instanceof HTMLCanvasElement && sources.has(image)) {
            const texture = this.getParameter(
              this.TEXTURE_BINDING_2D,
            ) as WebGLTexture;
            state.textures.set(texture, {
              id: sources.get(image)!,
              width: image.width,
              height: image.height,
            });
            state.peakBytes = Math.max(
              state.peakBytes,
              [...state.textures.values()].reduce(
                (sum, entry) => sum + entry.width * entry.height * 4,
                0,
              ),
            );
          }
          return Reflect.apply(upload, this, args);
        } as typeof upload;
        const remove = WebGL2RenderingContext.prototype.deleteTexture;
        WebGL2RenderingContext.prototype.deleteTexture = function (texture) {
          if (texture) state.textures.delete(texture);
          return remove.call(this, texture);
        };
        const names = new WeakMap<WebGLUniformLocation, string>();
        const getUniformLocation =
          WebGL2RenderingContext.prototype.getUniformLocation;
        WebGL2RenderingContext.prototype.getUniformLocation = function (
          ...args
        ) {
          const result = Reflect.apply(getUniformLocation, this, args);
          if (result) names.set(result, args[1]);
          return result;
        };
        let projection = 0;
        const matrix = WebGL2RenderingContext.prototype.uniformMatrix4fv;
        WebGL2RenderingContext.prototype.uniformMatrix4fv = function (...args) {
          const name = args[0] && names.get(args[0]);
          const values = args[2] as Float32Array;
          if (name === "projectionMatrix") projection = values[0];
          // Only the foreground photograph is centred on both camera axes.
          if (
            name === "modelViewMatrix" &&
            Math.abs(values[12]) < 0.01 &&
            Math.abs(values[13]) < 0.01 &&
            values[14] < 0
          ) {
            state.heroScreenWidth =
              (Math.abs((values[0] * projection) / values[14]) *
                (this.canvas as HTMLCanvasElement).clientWidth) /
              2;
          }
          return Reflect.apply(matrix, this, args);
        };
      });
      await enable3D(page);
      const canvas = mode(page, "3d").locator("canvas");
      const sample = () =>
        page.evaluate(() => {
          const state = (
            window as unknown as {
              crowdedGraphTextures: {
                heroScreenWidth: number;
                peakBytes: number;
                textures: Map<
                  WebGLTexture,
                  { id: string; width: number; height: number }
                >;
              };
            }
          ).crowdedGraphTextures;
          return {
            screenWidth: state.heroScreenWidth,
            hero: [...state.textures.values()].find(({ id }) => id === "1"),
            count: state.textures.size,
            peakBytes: state.peakBytes,
          };
        });
      await expect
        .poll(async () => (await sample()).count, { timeout: 20_000 })
        .toBe(103);
      const initialWidth = (await sample()).hero!.width;
      await page
        .getByRole("button", { name: "Close graph controls", exact: true })
        .click();
      for (let pass = 0; pass < 2; pass += 1) {
        for (let step = 0; step < 80; step += 1) {
          const before = (await sample()).screenWidth;
          if (before >= 1440 * 0.8) break;
          await canvas.dispatchEvent("wheel", {
            deltaY: before < 1440 * 0.4 ? -100 : -10,
            deltaMode: 0,
            ctrlKey: false,
          });
          await expect
            .poll(async () => (await sample()).screenWidth)
            .toBeGreaterThan(before);
        }
        const screenWidth = (await sample()).screenWidth;
        expect(screenWidth).toBeGreaterThanOrEqual(1440 * 0.8);
        expect(screenWidth).toBeLessThan(1440 * 1.05);
        await expect
          .poll(async () => (await sample()).hero?.width ?? 0, {
            timeout: 15_000,
          })
          .toBeGreaterThanOrEqual(Math.floor(screenWidth * density) - 1);
        const closeUp = await sample();
        expect(closeUp.hero!.width).toBeGreaterThan(initialWidth);
        expect(closeUp.count).toBe(103);
        expect(closeUp.peakBytes).toBeLessThanOrEqual(
          PHOTO_GRAPH_TEXTURE_BUDGET,
        );
        if (density === 2) expect(closeUp.hero!.width).toBeGreaterThan(1280);
        // A static crowded scene must not keep fetching its rounded tiers.
        await page.waitForTimeout(600);
        const count = requests.length;
        await page.waitForTimeout(1600);
        expect(requests).toHaveLength(count);
        if (pass === 0) {
          await page
            .getByRole("button", { name: "Reset", exact: true })
            .click();
          await expect
            .poll(async () => (await sample()).hero?.width ?? Infinity)
            .toBeLessThan(initialWidth + 2);
        }
      }
      expect(errors.get(page)).toEqual([]);
    });
  });
}

test.describe("Retina rendering", () => {
  test.use({ deviceScaleFactor: 2 });

  test("3D keeps a sharp backing buffer through density, viewport and mode changes", async ({
    page,
    context,
    isMobile,
  }) => {
    await page.addInitScript(() => {
      const state = { tracking: false, allocations: [] as number[] };
      Object.assign(window, { graphBufferAllocations: state });
      for (const property of ["width", "height"] as const) {
        const descriptor = Object.getOwnPropertyDescriptor(
          HTMLCanvasElement.prototype,
          property,
        )!;
        Object.defineProperty(HTMLCanvasElement.prototype, property, {
          ...descriptor,
          set(this: HTMLCanvasElement, value: number) {
            descriptor.set!.call(this, value);
            if (state.tracking && this.closest('[data-graph-mode="3d"]'))
              state.allocations.push(this.width * this.height);
          },
        });
      }
    });
    await enable3D(page);
    const expectResolution = async (dpr: number) => {
      await expect
        .poll(async () => {
          const size = await mode(page, "3d")
            .locator("canvas")
            .evaluate((element) => {
              const canvas = element as HTMLCanvasElement;
              const bounds = canvas.getBoundingClientRect();
              const gl = canvas.getContext("webgl2")!;
              return {
                width: canvas.width,
                height: canvas.height,
                cssWidth: bounds.width,
                cssHeight: bounds.height,
                dpr: devicePixelRatio,
                viewport: [...(gl.getParameter(gl.VIEWPORT) as Int32Array)],
              };
            });
          const ratio = photoGraphRenderPixelRatio(
            size.cssWidth,
            size.cssHeight,
            dpr,
          );
          return {
            dpr: size.dpr,
            widthError: size.width - Math.floor(size.cssWidth * ratio),
            heightError: size.height - Math.floor(size.cssHeight * ratio),
            viewportMatches:
              size.viewport.join(",") ===
              [0, 0, size.width, size.height].join(","),
          };
        })
        .toEqual({ dpr, widthError: 0, heightError: 0, viewportMatches: true });
    };
    await expectResolution(2);
    await page.evaluate(() => {
      (
        window as unknown as { graphBufferAllocations: { tracking: boolean } }
      ).graphBufferAllocations.tracking = true;
    });
    const viewport = page.viewportSize()!;
    const cdp = await context.newCDPSession(page);
    // Change density without changing CSS dimensions, like moving between screens.
    for (const deviceScaleFactor of [1, 2]) {
      await cdp.send("Emulation.setDeviceMetricsOverride", {
        ...viewport,
        deviceScaleFactor,
        mobile: isMobile,
      });
      // CDP changes density without emitting the real browser's screen-change
      // notification, even though resolution queries now have different matches.
      await page.evaluate(() => window.dispatchEvent(new Event("resize")));
      await expectResolution(deviceScaleFactor);
    }
    for (const viewport of [
      { width: 3840, height: 2160 },
      { width: 1920, height: 1080 },
      { width: 1600, height: 2400 },
      { width: 2400, height: 1600 },
      { width: 844, height: 390 },
    ]) {
      await page.setViewportSize(viewport);
      await expectResolution(2);
    }
    await toggle(page).uncheck();
    await expect(mode(page, "2d").locator("canvas").first()).toBeVisible();
    await toggle(page).check();
    await expectResolution(2);
    const allocations = await page.evaluate(
      () =>
        (
          window as unknown as {
            graphBufferAllocations: { allocations: number[] };
          }
        ).graphBufferAllocations.allocations,
    );
    expect(allocations.length).toBeGreaterThan(0);
    expect(Math.max(...allocations)).toBeLessThanOrEqual(
      PHOTO_GRAPH_RENDER_PIXEL_BUDGET,
    );
    await cdp.detach();
    expect(errors.get(page)).toEqual([]);
  });
});

for (const reducedMotion of ["no-preference", "reduce"] as const) {
  test(`reset moves the camera without reloading, with ${reducedMotion} motion`, async ({
    context,
    page,
  }) => {
    await page.emulateMedia({ reducedMotion });
    await context.route("**/api/photo-graph/graph", (route) =>
      route.fulfill({
        json: {
          nodes: [-600, 0, 600].map((x, index) => ({
            id: String(index),
            sourceUrl: `/__photo-graph-test.svg?id=${index}`,
            baseSize: 100,
            aspectRatio: 1.6,
            hasKnownAspectRatio: true,
            layerNoise: 0,
            w: 160,
            h: 100,
            renderArea: 16000,
            x,
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
    await page.addInitScript(() => {
      type Sample = { mode: string; value: number; time: number };
      const state: { samples: Sample[]; tracking: boolean } = {
        samples: [],
        tracking: false,
      };
      Object.assign(window, { graphResetSamples: state });
      const drawImage = CanvasRenderingContext2D.prototype.drawImage;
      CanvasRenderingContext2D.prototype.drawImage = function (
        this: CanvasRenderingContext2D,
        ...args: Parameters<typeof drawImage>
      ) {
        if (state.tracking && this.canvas.closest('[data-graph-mode="2d"]'))
          state.samples.push({
            mode: "2d",
            value: this.getTransform().a,
            time: performance.now(),
          });
        return Reflect.apply(drawImage, this, args);
      } as typeof drawImage;
      const locations = new WeakSet<WebGLUniformLocation>();
      const getUniformLocation =
        WebGL2RenderingContext.prototype.getUniformLocation;
      WebGL2RenderingContext.prototype.getUniformLocation = function (
        this: WebGL2RenderingContext,
        ...args: Parameters<typeof getUniformLocation>
      ) {
        const location = Reflect.apply(getUniformLocation, this, args);
        if (location && args[1] === "modelViewMatrix") locations.add(location);
        return location;
      };
      const uniformMatrix = WebGL2RenderingContext.prototype.uniformMatrix4fv;
      WebGL2RenderingContext.prototype.uniformMatrix4fv = function (
        this: WebGL2RenderingContext,
        ...args: Parameters<typeof uniformMatrix>
      ) {
        if (state.tracking && args[0] && locations.has(args[0]))
          state.samples.push({
            mode: "3d",
            value: Number((args[2] as Float32Array)[14]),
            time: performance.now(),
          });
        return Reflect.apply(uniformMatrix, this, args);
      } as typeof uniformMatrix;
    });
    await page.goto(experience);
    await expect(
      page.getByRole("button", { name: "Reset", exact: true }),
    ).toBeEnabled();
    const initialRequests = graphRequests.get(page)!.length;
    for (const name of ["2d", "3d"] as const) {
      if (name === "3d") {
        await openSettings(page);
        await toggle(page).check();
        await expect(mode(page, "3d").locator("canvas")).toBeVisible({
          timeout: 30_000,
        });
        await page
          .getByRole("button", { name: "Close graph controls", exact: true })
          .click();
        await photographPoint(page);
      }
      const canvas = mode(page, name).locator("canvas").first();
      await expect(canvas).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Reset", exact: true }),
      ).toBeEnabled();
      const bounds = (await canvas.boundingBox())!;
      await page.mouse.move(
        bounds.x + bounds.width / 2,
        bounds.y + bounds.height * 0.75,
      );
      const before = await canvas.screenshot({ scale: "css" });
      await canvas.dispatchEvent("wheel", {
        deltaY: -1200,
        deltaMode: 0,
        ctrlKey: false,
      });
      await expect
        .poll(async () =>
          pixelDifference(before, await canvas.screenshot({ scale: "css" })),
        )
        .toBeGreaterThan(0.1);
      // Let wheel damping finish before measuring only the reset action.
      let previous = await canvas.screenshot({ scale: "css" });
      await expect
        .poll(async () => {
          const next = await canvas.screenshot({ scale: "css" });
          const difference = await pixelDifference(previous, next);
          previous = next;
          return difference;
        })
        .toBeLessThan(0.01);
      await page.evaluate(() => {
        const state = (
          window as unknown as {
            graphResetSamples: { samples: unknown[]; tracking: boolean };
          }
        ).graphResetSamples;
        state.samples = [];
        state.tracking = true;
      });
      await page.getByRole("button", { name: "Reset", exact: true }).click();
      await page.waitForTimeout(1100);
      const samples = await page.evaluate((mode) => {
        const state = (
          window as unknown as {
            graphResetSamples: {
              samples: { mode: string; value: number; time: number }[];
              tracking: boolean;
            };
          }
        ).graphResetSamples;
        state.tracking = false;
        const unique = new Map<string, number>();
        for (const sample of state.samples.filter(
          (sample) => sample.mode === mode,
        ))
          if (!unique.has(sample.value.toFixed(4)))
            unique.set(sample.value.toFixed(4), sample.time);
        return [...unique.values()];
      }, name);
      expect(samples.length).toBeGreaterThan(0);
      expect(
        await pixelDifference(
          previous,
          await canvas.screenshot({ scale: "css" }),
        ),
      ).toBeGreaterThan(0.1);
      if (reducedMotion === "reduce")
        expect(samples.length).toBeLessThanOrEqual(2);
      else {
        expect(samples.length).toBeGreaterThanOrEqual(4);
        expect(samples.at(-1)! - samples[0]).toBeGreaterThan(600);
      }
      expect(graphRequests.get(page)).toHaveLength(initialRequests);
    }
    expect(errors.get(page)).toEqual([]);
  });
}

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
