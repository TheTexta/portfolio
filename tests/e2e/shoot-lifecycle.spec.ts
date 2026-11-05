import { expect, test } from "@playwright/test";

test.beforeEach(async ({ context }) => {
  await context.route("https://**/*", (route) => route.abort());
});

for (const reducedMotion of ["no-preference", "reduce"] as const) {
  test(`shoot lifecycle loops and selects three readable stages (${reducedMotion})`, async ({
    page,
  }, info) => {
    await page.emulateMedia({
      reducedMotion,
      colorScheme: reducedMotion === "reduce" ? "dark" : "light",
    });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/write-ups/tvm-discord-bot");
    const figure = page.getByRole("figure", {
      name: "Shoot lifecycle illustration",
    });
    await figure.scrollIntoViewIfNeeded();
    const player = figure.locator("[data-animation-player]");
    const scene = figure.locator("[data-shoot-lifecycle]");
    const range = figure.getByRole("slider", {
      name: "Shoot lifecycle timeline",
    });
    await expect(range).toBeEnabled();
    await expect(figure.locator("iframe, canvas, img")).toHaveCount(0);
    const message = await figure
      .locator("[data-shoot-message]")
      .elementHandle();

    if (reducedMotion === "no-preference") {
      await expect(player).toHaveAttribute("data-stage", "join", {
        timeout: 6000,
      });
      await expect(scene).toHaveAttribute("data-joined", "1");
      await expect(player).toHaveAttribute("data-stage", "archive");
      await expect(scene).toHaveAttribute("data-archived", "1");
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
        { polling: "raf", timeout: 6000 },
      );
      const resettingPose = Number(await scene.getAttribute("data-joined"));
      expect(resettingPose).toBeGreaterThan(0);
      expect(resettingPose).toBeLessThan(1);
      await expect
        .poll(async () => Number(await player.getAttribute("data-cycle")))
        .toBeGreaterThanOrEqual(1);
      await range.press(" ");
      await expect(
        figure.getByRole("button", { name: "Play animation" }),
      ).toBeEnabled();
    } else {
      await expect(player).toHaveAttribute("data-time", "12000");
      await expect(scene).toHaveAttribute("data-scene-stage", "archive");
      await expect(
        figure.getByRole("button", {
          name: "Autoplay disabled for reduced motion",
        }),
      ).toBeDisabled();
    }

    await range.press("Home");
    await expect(player).toHaveAttribute("data-time", "0");
    await expect(scene).toHaveAttribute("data-scene-stage", "create");
    await expect(figure.locator("[data-shoot-invitation]")).toHaveCSS(
      "opacity",
      "1",
    );
    await figure.screenshot({
      path: info.outputPath(`create-${reducedMotion}.png`),
    });
    await range.press("ArrowRight");
    await expect(player).toHaveAttribute("data-time", "4000");
    await expect(scene).toHaveAttribute("data-scene-stage", "join");
    await expect(figure.locator("[data-shoot-workspace]")).toHaveCSS(
      "opacity",
      "1",
    );
    await expect(figure.locator('[data-shoot-composer="open"]')).toHaveCSS(
      "opacity",
      "1",
    );
    await figure.screenshot({
      path: info.outputPath(`join-${reducedMotion}.png`),
    });
    await range.press("End");
    await expect(player).toHaveAttribute("data-time", "8000");
    await expect(scene).toHaveAttribute("data-scene-stage", "archive");
    await expect(figure.locator('[data-shoot-composer="closed"]')).toHaveCSS(
      "opacity",
      "1",
    );
    await expect(figure.locator('[data-shoot-composer="open"]')).toHaveCSS(
      "opacity",
      "0",
    );
    expect(
      await message!.evaluate(
        (node) => node === document.querySelector("[data-shoot-message]"),
      ),
    ).toBe(true);
    if (info.project.name === "desktop") {
      expect(
        await figure
          .locator("[data-shoot-channel]")
          .evaluate(
            (node) =>
              new DOMMatrixReadOnly(getComputedStyle(node).transform).m42,
          ),
      ).toBe(104);
    } else {
      await page.setViewportSize({ width: 320, height: 800 });
    }
    await figure.screenshot({
      path: info.outputPath(`archive-${reducedMotion}.png`),
    });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(page.viewportSize()!.width);
    await expect(range).toBeFocused();
    expect(errors).toEqual([]);
  });
}

test("scene and shared clock freeze offscreen and preserve an explicit pause", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/write-ups/tvm-discord-bot");
  const figure = page.getByRole("figure", {
    name: "Shoot lifecycle illustration",
  });
  const player = figure.locator("[data-animation-player]");
  await figure.scrollIntoViewIfNeeded();
  await expect
    .poll(async () => Number(await player.getAttribute("data-time")))
    .toBeGreaterThan(200);
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(150);
  const stoppedTime = await player.getAttribute("data-time");
  await page.waitForTimeout(200);
  expect(await player.getAttribute("data-time")).toBe(stoppedTime);
  await figure.scrollIntoViewIfNeeded();
  await expect
    .poll(async () => Number(await player.getAttribute("data-time")))
    .toBeGreaterThan(Number(stoppedTime));
  const range = figure.getByRole("slider");
  await range.press(" ");
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(100);
  const pausedTime = await player.getAttribute("data-time");
  await figure.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  expect(await player.getAttribute("data-time")).toBe(pausedTime);
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });
  test("the invitation and complete workflow summary remain readable", async ({
    page,
  }) => {
    await page.goto("/write-ups/tvm-discord-bot");
    const figure = page.getByRole("figure", {
      name: "Shoot lifecycle illustration",
    });
    await expect(figure.locator("[data-shoot-invitation]")).toHaveCSS(
      "opacity",
      "1",
    );
    await expect(figure.getByRole("slider")).toBeDisabled();
    await expect(figure).toContainText(
      "Archive: the channel moves into the archive",
    );
    await expect(figure.locator("figcaption")).toContainText("not a recording");
  });
});

test("sharing poster is captured from the archived scene", async ({
  browser,
  baseURL,
}, info) => {
  test.skip(info.project.name === "mobile", "One fixed-size sharing asset");
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 2.5,
    reducedMotion: "reduce",
    colorScheme: "light",
  });
  try {
    await context.route("https://**/*", (route) => route.abort());
    const page = await context.newPage();
    await page.goto("/write-ups/tvm-discord-bot");
    await page.evaluate(async () => {
      await document.fonts.ready;
      document.querySelector<HTMLElement>("article")!.style.width = "640px";
    });
    const scene = page.locator("[data-shoot-scene]");
    await scene.scrollIntoViewIfNeeded();
    await expect(page.locator("[data-shoot-lifecycle]")).toHaveAttribute(
      "data-scene-stage",
      "archive",
    );
    const box = (await scene.boundingBox())!;
    expect(box.width).toBe(640);
    expect(box.height).toBe(400);
    await page.screenshot({
      path: info.outputPath("shoot-lifecycle-poster.png"),
      clip: { x: box.x, y: box.y, width: 640, height: 400 },
    });
  } finally {
    await context.close();
  }
});
