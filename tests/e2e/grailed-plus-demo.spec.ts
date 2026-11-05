import { expect, test, type Route } from "@playwright/test";
import recording from "../../public/projects/grailed-plus/recorded-demo/recorded-comparison.json";
import timeline from "../../public/projects/grailed-plus/recorded-demo/recorded-comparison-timeline.json";

const analysisEnd = timeline.stages[0].durationMs;
const reorderEnd = analysisEnd + timeline.stages[1].durationMs;
const duration = reorderEnd + timeline.stages[2].durationMs;

test("the shared clock waits for visibility and freezes offscreen; message validation remains intact", async ({
  page,
  context,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const mockDemo = (route: Route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><script>
    window.commands = [];
    addEventListener("message", ({data, source, origin}) => {
      if(source !== parent || data?.source !== "grailed-plus-site" || data.version !== 1) return;
      window.commands.push(data);
      if(data.type === "connect") parent.postMessage({source:"grailed-plus-demo",version:1,type:"ready",feature:"market-compare",height:360}, origin);
    });</script>`,
    });
  await context.route("https://**/*", (route) => route.abort());
  await context.route(
    "**/recorded-demo/index.html?feature=market-compare",
    mockDemo,
  );
  await page.goto("/grailed-plus");
  const section = page.locator("#feature-market-compare");
  const frame = section.locator("iframe");
  const top = await section.evaluate(
    (node) =>
      node.querySelector("[data-animation-player]")!.getBoundingClientRect()
        .top + scrollY,
  );
  await page.evaluate((top) => scrollTo(0, top - innerHeight - 120), top);
  await expect(frame).not.toHaveAttribute("inert", "");
  const demo = frame.contentFrame();
  const frames = () =>
    demo
      .locator("html")
      .evaluate(() =>
        (Reflect.get(window, "commands") as { type: string; timeMs?: number }[])
          .filter((message) => message.type === "frame")
          .map((message) => message.timeMs!),
      );
  await page.waitForTimeout(300);
  expect((await frames()).every((time) => time === 0)).toBe(true);
  await frame.scrollIntoViewIfNeeded();
  await expect
    .poll(async () => (await frames()).some((time) => time > 100))
    .toBe(true);
  const height = await frame.evaluate(
    (node) => node.getBoundingClientRect().height,
  );
  await page.evaluate(() => {
    const frame = document.querySelector<HTMLIFrameElement>(
      "#feature-market-compare iframe",
    )!;
    dispatchEvent(
      new MessageEvent("message", {
        origin: "https://untrusted.example",
        source: frame.contentWindow,
        data: {
          source: "grailed-plus-demo",
          version: 1,
          feature: "market-compare",
          type: "resize",
          height: 999,
        },
      }),
    );
  });
  expect(
    await frame.evaluate((node) => node.getBoundingClientRect().height),
  ).toBe(height);
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(300);
  const count = (await frames()).length;
  await page.waitForTimeout(600);
  expect((await frames()).length).toBe(count);
  await frame.scrollIntoViewIfNeeded();
  await expect.poll(async () => (await frames()).length).toBeGreaterThan(count);
});

for (const reducedMotion of ["no-preference", "reduce"] as const) {
  test(`write-up loops, seeks and renders all three real recorded stages (${reducedMotion})`, async ({
    page,
    context,
  }, info) => {
    await page.emulateMedia({
      reducedMotion,
      colorScheme: reducedMotion === "reduce" ? "dark" : "light",
    });
    const external: string[] = [];
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await context.route("https://**/*", (route) => {
      external.push(route.request().url());
      return route.abort();
    });
    await page.goto("/write-ups/grailed-plus");
    const figure = page.getByRole("figure", {
      name: "Recorded ONNX result reordering",
    });
    await figure.scrollIntoViewIfNeeded();
    const iframe = figure.locator("iframe");
    await iframe.scrollIntoViewIfNeeded();
    const demo = iframe.contentFrame();
    const scene = demo.locator(".gp-demo__comparison");
    await expect(demo.locator("img")).toHaveCount(6);
    const player = figure.locator("[data-animation-player]");
    const range = figure.getByRole("slider", {
      name: "Image comparison timeline",
    });
    const ids = () =>
      demo
        .locator("li")
        .evaluateAll((rows) =>
          rows.map((row) => (row as HTMLElement).dataset.listingId),
        );
    await expect(range).toBeEnabled();
    if (reducedMotion === "no-preference") {
      await expect(player).toHaveAttribute("data-stage", "analysis");
      await expect(player).toHaveAttribute("data-stage", "reordering", {
        timeout: 5000,
      });
      await expect(player).toHaveAttribute("data-stage", "complete");
      await expect.poll(ids).toEqual(recording.refined.map((r) => r.id));
      // Locator assertions eventually poll at 500ms and can miss a 450ms reset.
      // Observe animation frames and require an actual intermediate reset pose.
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
      expect(
        await demo
          .locator(".gp-demo__comparison-results")
          .evaluate((node) => getComputedStyle(node).opacity),
      ).toBe("1");
      await expect
        .poll(async () => Number(await player.getAttribute("data-cycle")), {
          timeout: 6000,
        })
        .toBeGreaterThanOrEqual(1);
      await expect(player).toHaveAttribute("data-stage", "analysis");
      await range.hover();
      await figure.getByRole("button", { name: "Pause animation" }).click();
      await expect
        .poll(async () =>
          Math.abs(
            (await figure
              .locator("progress")
              .evaluate((node) => (node as HTMLProgressElement).value)) -
              Number(await player.getAttribute("data-time")),
          ),
        )
        .toBeLessThan(1);
    } else {
      await expect(player).toHaveAttribute("data-time", String(duration));
      await expect(
        figure.getByRole("button", {
          name: "Autoplay disabled for reduced motion",
        }),
      ).toBeDisabled();
    }
    await demo.locator("li").evaluateAll((rows) => {
      Reflect.set(window, "savedRows", rows);
    });
    const source = demo.locator(".gp-demo__comparison-source");
    const sourceBox = await source.boundingBox();
    const box = (await range.boundingBox())!;
    await range.click({
      position: { x: box.width * 0.44, y: box.height / 2 },
    });
    if (reducedMotion === "no-preference") {
      await expect(player).toHaveAttribute("data-seeking", "true");
      await expect(player).toHaveAttribute("data-seeking", "false");
    }
    await expect(player).toHaveAttribute("data-stage", "reordering");
    await expect(scene).toHaveAttribute("data-stage", "reordering");
    const time = Number(await player.getAttribute("data-time"));
    expect(time).toBe(analysisEnd);
    await expect(range).toHaveValue("1");
    await expect.poll(() => scene.getAttribute("data-time")).toBe(String(time));
    expect(
      await figure
        .locator("progress")
        .evaluate((node) => (node as HTMLProgressElement).value),
    ).toBe(time);
    await figure.screenshot({
      path: info.outputPath(`reordering-${reducedMotion}.png`),
    });
    await range.press("End");
    await expect(player).toHaveAttribute("data-time", String(reorderEnd));
    await expect(range).toHaveValue("2");
    await expect.poll(ids).toEqual(recording.refined.map((r) => r.id));
    expect(await source.boundingBox()).toEqual(sourceBox);
    await expect
      .poll(() =>
        demo
          .locator(".gp-demo__comparison-check")
          .evaluate((node) => getComputedStyle(node).opacity),
      )
      .toBe("1");
    await figure.screenshot({
      path: info.outputPath(`complete-${reducedMotion}.png`),
    });
    await range.click({ position: { x: box.width * 0.05, y: box.height / 2 } });
    await expect(player).toHaveAttribute("data-seeking", "false");
    await expect(scene).toHaveAttribute("data-stage", "analysis");
    await expect(player).toHaveAttribute("data-time", "0");
    await expect(range).toHaveValue("0");
    await expect.poll(ids).toEqual(recording.preliminary.map((r) => r.id));
    expect(
      await demo
        .locator("li")
        .evaluateAll((rows) =>
          (Reflect.get(window, "savedRows") as Element[]).every((row) =>
            rows.some((entry) => entry === row),
          ),
        ),
    ).toBe(true);
    await figure.screenshot({
      path: info.outputPath(`analysis-${reducedMotion}.png`),
    });
    if (reducedMotion === "no-preference") {
      await range.press(" ");
      await expect(
        figure.getByRole("button", { name: "Pause animation" }),
      ).toBeEnabled();
      await page.emulateMedia({ reducedMotion: "reduce" });
      await expect(player).toHaveAttribute("data-time", String(duration));
    }
    await expect(demo.locator("button, input, select, details, a")).toHaveCount(
      0,
    );
    await expect(demo.locator("body")).toHaveText("");
    expect(
      await demo
        .locator("html")
        .evaluate((html) => html.scrollWidth <= innerWidth),
    ).toBe(true);
    expect(
      external.filter((url) => /grailed-plus-demo|onnx|wasm/.test(url)),
    ).toEqual([]);
    expect(errors).toEqual([]);
  });
}
