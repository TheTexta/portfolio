import { expect, test } from "@playwright/test";
import recording from "../../public/projects/elliot-mairet/palette-extraction/mmcq-v1/recording.json";

const figureName = `${recording.palette.length}-swatch MMCQ extraction from Elliot Mairet’s photograph`;

for (const reducedMotion of ["no-preference", "reduce"] as const) {
  test(`Elliot's current MMCQ illustration loops and snaps to three explanatory stages (${reducedMotion})`, async ({
    page,
    context,
  }, info) => {
    await page.emulateMedia({
      reducedMotion,
      colorScheme: reducedMotion === "reduce" ? "dark" : "light",
    });
    await context.route("https://**/*", (route) => route.abort());
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/write-ups/elliot-mairet");
    const figure = page.getByRole("figure", {
      name: figureName,
    });
    await figure.scrollIntoViewIfNeeded();
    const player = figure.locator("[data-animation-player]");
    const scene = figure.locator("[data-palette-scene]");
    const range = figure.getByRole("slider", {
      name: "Colour extraction timeline",
    });
    const photograph = figure.locator("img");
    await expect(range).toBeEnabled();
    expect(
      await photograph.evaluate(
        (image) => new URL((image as HTMLImageElement).src).pathname,
      ),
    ).toBe(recording.photograph.asset);
    expect(
      await photograph.evaluate(
        (image) =>
          new URL((image as HTMLImageElement).src).origin === location.origin,
      ),
    ).toBe(true);
    const sourceBox = await photograph.boundingBox();
    await expect(
      figure.getByRole("list", {
        name: "Extracted palette, in production selection order",
      }),
    ).toBeAttached();
    await expect(figure.locator("ol > li")).toHaveCount(
      recording.palette.length,
    );
    await expect(figure.locator("figcaption")).toContainText(
      "not solver steps or measured latency",
    );
    await expect(figure.locator("iframe")).toHaveCount(0);

    if (reducedMotion === "no-preference") {
      await expect(player).toHaveAttribute("data-stage", "group", {
        timeout: 5000,
      });
      await expect(player).toHaveAttribute("data-stage", "palette");
      await expect(scene).toHaveAttribute("data-palette-progress", "1");
      await page.waitForFunction(
        (element) => {
          const progress = Number(
            element?.getAttribute("data-transition-progress"),
          );
          return (
            element?.getAttribute("data-resetting") === "true" &&
            progress > 0 &&
            progress < 1
          );
        },
        await player.elementHandle(),
        { polling: "raf", timeout: 5000 },
      );
      await expect
        .poll(async () => Number(await player.getAttribute("data-cycle")))
        .toBeGreaterThanOrEqual(1);
      await range.hover();
      await figure.getByRole("button", { name: "Pause animation" }).click();
    } else {
      await expect(player).toHaveAttribute("data-time", "7500");
      await expect(scene).toHaveAttribute("data-palette-progress", "1");
      await expect(
        figure.getByRole("button", {
          name: "Autoplay disabled for reduced motion",
        }),
      ).toBeDisabled();
    }

    await range.press("Home");
    await expect(player).toHaveAttribute("data-time", "0");
    await expect(scene).toHaveAttribute("data-sample-progress", "1");
    await expect(scene).toHaveAttribute("data-group-progress", "0");
    await expect(range).toHaveValue("0");
    const uncoveredPixels = await figure.locator("canvas").evaluate((node) => {
      const canvas = node as HTMLCanvasElement;
      const bounds = canvas.getBoundingClientRect();
      const photo = canvas
        .parentElement!.querySelector("img")!
        .getBoundingClientRect();
      const scaleX = canvas.width / bounds.width;
      const scaleY = canvas.height / bounds.height;
      const left = Math.ceil((photo.left - bounds.left) * scaleX);
      const top = Math.ceil((photo.top - bounds.top) * scaleY);
      const right = Math.floor((photo.right - bounds.left) * scaleX);
      const bottom = Math.floor((photo.bottom - bounds.top) * scaleY);
      const { data } = canvas
        .getContext("2d")!
        .getImageData(left, top, right - left, bottom - top);
      let gaps = 0;
      for (let index = 3; index < data.length; index += 4) {
        if (data[index] !== 255) gaps++;
      }
      return gaps;
    });
    expect(
      uncoveredPixels,
      "the sampling mosaic must completely cover the photograph",
    ).toBe(0);
    const sample = await figure
      .locator("canvas")
      .evaluate((canvas) => (canvas as HTMLCanvasElement).toDataURL());
    await figure.screenshot({
      path: info.outputPath(`sample-${reducedMotion}.png`),
    });

    const box = (await range.boundingBox())!;
    await range.click({ position: { x: box.width * 0.3, y: box.height / 2 } });
    await expect(player).toHaveAttribute("data-time", "2000");
    await expect(scene).toHaveAttribute("data-group-progress", "1");
    await expect(scene).toHaveAttribute("data-palette-progress", "0");
    await expect(range).toHaveValue("1");
    const grouped = await figure
      .locator("canvas")
      .evaluate((canvas) => (canvas as HTMLCanvasElement).toDataURL());
    expect(grouped).not.toBe(sample);
    await figure.screenshot({
      path: info.outputPath(`group-${reducedMotion}.png`),
    });

    await range.press("End");
    await expect(player).toHaveAttribute("data-time", "4500");
    await expect(scene).toHaveAttribute("data-palette-progress", "1");
    await expect(range).toHaveValue("2");
    expect(await photograph.boundingBox()).toEqual(sourceBox);
    await expect(figure.locator("ol")).toHaveCSS("opacity", "1");
    await expect(figure.locator("ol")).toHaveCSS("padding-inline-start", "0px");
    await expect(figure.locator("ol")).toHaveCSS("list-style-type", "none");
    expect(
      await figure
        .locator("li")
        .evaluateAll(
          (swatches) =>
            new Set(swatches.map((node) => node.getBoundingClientRect().top))
              .size,
        ),
    ).toBe(1);
    expect(await figure.locator("li").allTextContents()).toEqual(
      recording.palette.map(({ hex }) => hex),
    );
    await figure.screenshot({
      path: info.outputPath(`palette-${reducedMotion}.png`),
    });
    expect(
      await figure.evaluate((node) => node.scrollWidth <= node.clientWidth),
    ).toBe(true);
    expect(errors).toEqual([]);
  });
}

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });
  test("the photograph and real palette remain meaningful", async ({
    page,
    context,
  }, info) => {
    await context.route("https://**/*", (route) => route.abort());
    await page.goto("/write-ups/elliot-mairet");
    const figure = page.getByRole("figure", {
      name: figureName,
    });
    await figure.scrollIntoViewIfNeeded();
    await expect(figure.locator("img")).toBeVisible();
    await expect(figure.locator("ol")).toHaveCSS("opacity", "1");
    await expect(figure.locator("li")).toHaveCount(recording.palette.length);
    expect(await figure.locator("li").allTextContents()).toEqual(
      recording.palette.map(({ hex }) => hex),
    );
    await expect(figure.getByRole("slider")).toBeDisabled();
    await figure.screenshot({ path: info.outputPath("no-javascript.png") });
  });
});

test("a failed photograph leaves its palette and explanation visible without starting playback", async ({
  page,
  context,
}) => {
  await context.route("https://**/*", (route) => route.abort());
  await context.route(`**${recording.photograph.asset}`, (route) =>
    route.abort(),
  );
  await page.goto("/write-ups/elliot-mairet");
  const figure = page.getByRole("figure", {
    name: figureName,
  });
  await figure.scrollIntoViewIfNeeded();
  await expect(figure.getByRole("status")).toContainText(
    "photograph could not load",
  );
  await expect(figure.getByRole("slider")).toBeDisabled();
  await expect(figure.locator("ol")).toHaveCSS("opacity", "1");
  await expect(figure.locator("li")).toHaveCount(recording.palette.length);
});

test("article return navigation makes queued palette resizes inert and remounts playback safely", async ({
  page,
  context,
}) => {
  await context.route("https://**/*", (route) => route.abort());
  await context.route("**/api/photo-graph/graph", (route) =>
    route.fulfill({ json: { nodes: [], links: [] } }),
  );
  await page.addInitScript(() => {
    type Pending = {
      target: Element;
      disconnected: boolean;
      deliver: () => void;
    };
    const pending: Pending[] = [];
    const NativeResizeObserver = window.ResizeObserver;
    // Keep native delivery while mounted, but retain one callback so the test
    // can deterministically deliver already-queued work after route teardown.
    window.ResizeObserver = class extends NativeResizeObserver {
      private tracked?: Pending;
      private readonly deliver: () => void;
      constructor(callback: ResizeObserverCallback) {
        super(callback);
        this.deliver = () => callback([], this);
      }
      observe(target: Element, options?: ResizeObserverOptions) {
        super.observe(target, options);
        if (target.hasAttribute("data-palette-scene") && !this.tracked) {
          this.tracked = {
            target,
            disconnected: false,
            deliver: this.deliver,
          };
          pending.push(this.tracked);
        }
      }
      disconnect() {
        super.disconnect();
        if (this.tracked) this.tracked.disconnected = true;
      }
    };
    Object.assign(window, {
      flushInactivePaletteResizes: () => {
        const inactive = pending.filter(
          ({ target, disconnected }) => disconnected || !target.isConnected,
        );
        inactive.forEach(({ deliver }) => deliver());
        return {
          delivered: inactive.length,
          disconnected: inactive.filter(({ disconnected }) => disconnected)
            .length,
        };
      },
    });
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const reducedMotion of ["no-preference", "reduce"] as const) {
    await page.emulateMedia({ reducedMotion });
    await page.goto("/write-ups/elliot-mairet");
    const figure = page.getByRole("figure", { name: figureName });
    const range = figure.getByRole("slider", {
      name: "Colour extraction timeline",
    });
    await figure.scrollIntoViewIfNeeded();
    await expect(range).toBeEnabled();
    const viewport = page.viewportSize()!;
    await page.setViewportSize({
      ...viewport,
      width: viewport.width - 1,
    });
    await page.getByRole("link", { name: "Index", exact: true }).press("Enter");
    await expect(page).toHaveURL(/\/portfolio#projects$/);
    await expect(figure).toHaveCount(0);
    const flushed = await page.evaluate(() =>
      (
        window as unknown as {
          flushInactivePaletteResizes: () => {
            delivered: number;
            disconnected: number;
          };
        }
      ).flushInactivePaletteResizes(),
    );
    expect(flushed.delivered).toBeGreaterThan(0);
    expect(flushed.disconnected).toBeGreaterThan(0);
    await page.goBack();
    await expect(page).toHaveURL(/\/write-ups\/elliot-mairet$/);
    await figure.scrollIntoViewIfNeeded();
    await expect(range).toBeEnabled();
    await range.press("End");
    await expect(figure.locator("[data-palette-scene]")).toHaveAttribute(
      "data-palette-progress",
      "1",
    );
    await expect(figure.locator("ol")).toHaveCSS("opacity", "1");
  }
  expect(errors).toEqual([]);
});
