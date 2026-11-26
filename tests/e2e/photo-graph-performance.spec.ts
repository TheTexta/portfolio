import { expect, test, type Locator } from "@playwright/test";
import { DEFAULT_PHOTO_GRAPH_RUNTIME_CONTROLS } from "../../lib/photo-graph/graph-controls";

type PaintWindow = Window & {
  graphPaints: WeakMap<HTMLCanvasElement, number>;
  graphAnimationFrames: number;
};
const svg =
  '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="#c43b2c"/></svg>';
const payload = {
  nodes: Array.from({ length: 8 }, (_, index) => ({
    id: String(index + 1),
    sourceUrl: `/__graph-performance.svg?id=${index + 1}`,
    baseSize: 400,
    aspectRatio: 1.5,
    hasKnownAspectRatio: true,
    layerNoise: 0,
    w: 600,
    h: 400,
    renderArea: 240000,
    x: (index % 4) * 240 - 360,
    y: Math.floor(index / 4) * 200 - 100,
  })),
  links: [{ source: "1", target: "2", value: 0.8, baseValue: 0.8 }],
  defaultGraphControls: {
    ...DEFAULT_PHOTO_GRAPH_RUNTIME_CONTROLS,
    chargeMult: 0,
    collideStrength: 0,
    collideIterations: 0,
  },
};

async function paintDelta(canvas: Locator) {
  return canvas.evaluate(async (element) => {
    const counts = (window as unknown as PaintWindow).graphPaints;
    const before = counts.get(element as HTMLCanvasElement) ?? 0;
    // Sample real foreground frames, including while this canvas is hidden.
    await new Promise<void>((resolve) => {
      let remaining = 12;
      const tick = () => {
        if (--remaining) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });
    return (counts.get(element as HTMLCanvasElement) ?? 0) - before;
  });
}

async function backgroundFrameDelta(canvas: Locator) {
  return canvas.evaluate(async () => {
    const probe = window as unknown as PaintWindow;
    const before = probe.graphAnimationFrames;
    await new Promise<void>((resolve) => {
      let remaining = 12;
      const tick = () => {
        if (--remaining) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });
    return probe.graphAnimationFrames - before - 12;
  });
}

test.beforeEach(async ({ context, page }) => {
  await context.route("https://**/*", (route) => route.abort());
  await context.route("**/__graph-performance.svg*", (route) =>
    route.fulfill({ contentType: "image/svg+xml", body: svg }),
  );
  await context.route("**/api/photo-graph/graph*", (route) =>
    route.fulfill({ json: payload }),
  );
  await page.addInitScript(() => {
    const counts = new WeakMap<HTMLCanvasElement, number>();
    Object.assign(window, { graphPaints: counts, graphAnimationFrames: 0 });
    const requestFrame = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback) =>
      requestFrame((time) => {
        (window as unknown as PaintWindow).graphAnimationFrames++;
        callback(time);
      });
    const clear = CanvasRenderingContext2D.prototype.clearRect;
    CanvasRenderingContext2D.prototype.clearRect = function (...args) {
      counts.set(this.canvas, (counts.get(this.canvas) ?? 0) + 1);
      return clear.apply(this, args);
    };
  });
});

test("offscreen and document-hidden graphs pause without losing their canvas or selection", async ({
  page,
}) => {
  let graphRequests = 0;
  page.on("request", (request) => {
    if (request.url().includes("/api/photo-graph/graph")) graphRequests++;
  });
  await page.goto("/test-fixtures/photo-graph-keyboard");
  const graph = page.getByRole("region", {
    name: "First embedded graph",
    exact: true,
  });
  const canvas = graph.locator("canvas").first();
  await expect(canvas).toBeVisible();
  await expect.poll(() => paintDelta(canvas)).toBeGreaterThan(0);
  await graph.locator("summary").click();
  await graph
    .getByLabel("Select a photograph", { exact: true })
    .selectOption("2");
  const original = await canvas.elementHandle();
  const requests = graphRequests;

  await page.evaluate(() => {
    document.querySelector("main")!.style.paddingBottom = "120vh";
    window.scrollTo(0, document.body.scrollHeight);
  });
  await expect.poll(() => paintDelta(canvas)).toBe(0);
  // A visibility event alone must not wake an offscreen graph.
  await page.evaluate(() =>
    document.dispatchEvent(new Event("visibilitychange")),
  );
  expect(await paintDelta(canvas)).toBe(0);

  await graph.scrollIntoViewIfNeeded();
  await expect.poll(() => paintDelta(canvas)).toBeGreaterThan(0);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect.poll(() => paintDelta(canvas)).toBe(0);
  await page.evaluate(() => {
    Reflect.deleteProperty(document, "hidden");
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect.poll(() => paintDelta(canvas)).toBeGreaterThan(0);
  expect(await original!.evaluate((element) => element.isConnected)).toBe(true);
  await expect(
    graph.getByLabel("Select a photograph", { exact: true }),
  ).toHaveValue("2");
  expect(graphRequests).toBe(requests);
});

test("a CSS-hidden preview stays paused during its unfinished intro and resumes in place", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/test-fixtures/photo-graph-keyboard");
  await page.addStyleTag({
    content:
      'section[aria-label="Second embedded graph"], section[aria-label="Opt-out graph"] { display: none; }',
  });
  const graph = page.getByRole("region", {
    name: "First embedded graph",
    exact: true,
    includeHidden: true,
  });
  const canvas = graph.locator("canvas").first();
  await expect.poll(() => paintDelta(canvas)).toBeGreaterThan(0);
  const original = await canvas.elementHandle();
  await graph.evaluate((element) => (element.style.display = "none"));
  await expect.poll(() => paintDelta(canvas)).toBe(0);
  await expect.poll(() => backgroundFrameDelta(canvas)).toBe(0);
  // Multiple samples cover the old 1.3s intro completion, not only its first tick.
  for (let sample = 0; sample < 8; sample++)
    expect(await paintDelta(canvas)).toBe(0);
  await graph.evaluate((element) => (element.style.display = ""));
  await expect.poll(() => paintDelta(canvas)).toBeGreaterThan(0);
  // A second suspension catches orphan loops created by synchronous resume
  // callbacks and unfinished Motion drivers, not only visible canvas paints.
  await graph.evaluate((element) => (element.style.display = "none"));
  await expect.poll(() => paintDelta(canvas)).toBe(0);
  await expect.poll(() => backgroundFrameDelta(canvas)).toBe(0);
  await graph.evaluate((element) => (element.style.display = ""));
  await expect.poll(() => paintDelta(canvas)).toBeGreaterThan(0);
  expect(await original!.evaluate((element) => element.isConnected)).toBe(true);
  await expect(graph.getByRole("status")).toHaveCount(0);
});

test("a graph response arriving offscreen initializes when the retained preview returns", async ({
  context,
  page,
}) => {
  let release!: () => void;
  const response = new Promise<void>((resolve) => (release = resolve));
  await context.route(
    "**/api/photo-graph/graph?fixture=initial",
    async (route) => {
      await response;
      await route.fulfill({ json: payload });
    },
  );
  try {
    await page.goto("/test-fixtures/photo-graph-keyboard");
    const graph = page.getByRole("region", {
      name: "First embedded graph",
      exact: true,
    });
    const canvas = graph.locator("canvas").first();
    await expect(canvas).toBeVisible();
    await page.evaluate(() => {
      document.querySelector("main")!.style.paddingBottom = "120vh";
      window.scrollTo(0, document.body.scrollHeight);
    });
    await expect.poll(() => paintDelta(canvas)).toBe(0);
    release();
    await expect(
      graph.getByLabel("Select a photograph", { exact: true }),
    ).toHaveValue("1");
    expect(await paintDelta(canvas)).toBe(0);
    await graph.scrollIntoViewIfNeeded();
    await expect.poll(() => paintDelta(canvas)).toBeGreaterThan(0);
    await expect(graph.getByRole("status")).toHaveCount(0);
  } finally {
    release();
  }
});

test("initial thumbnails precede larger images and all requests use the same bounded queue", async ({
  context,
  page,
}) => {
  const requests: { id: string; width: number }[] = [];
  let active = 0;
  let maximum = 0;
  let release!: () => void;
  const thumbnails = new Promise<void>((resolve) => (release = resolve));
  await context.route("**/api/photo-graph/graph*", (route) =>
    route.fulfill({
      json: {
        ...payload,
        nodes: payload.nodes.map((node) => ({
          ...node,
          sourceUrl: `https://media.dextery.dev/photo-graph/photography-images/${node.id}.webp`,
          storagePath: `photography-images/${node.id}.webp`,
          storageProvider: "r2",
        })),
      },
    }),
  );
  await context.route(
    "https://images.dextery.dev/photo-graph/**",
    async (route) => {
      const url = new URL(route.request().url());
      const width = Number(url.searchParams.get("width"));
      requests.push({ id: url.pathname, width });
      maximum = Math.max(maximum, ++active);
      try {
        if (width <= 192) await thumbnails;
        await route.fulfill({
          contentType: "image/svg+xml",
          headers: { "access-control-allow-origin": "*" },
          body: svg,
        });
      } finally {
        active--;
      }
    },
  );
  try {
    await page.goto("/projects/photo-graph/experience");
    await expect.poll(() => requests.length).toBe(5);
    expect(requests.every(({ width }) => width <= 192)).toBe(true);
    release();
    await expect
      .poll(() => requests.some(({ width }) => width > 192))
      .toBe(true);
    await expect.poll(() => active).toBe(0);
    expect(maximum).toBeLessThanOrEqual(5);
    const firstRequests = new Map<string, number>();
    requests.forEach(({ id, width }) => {
      if (!firstRequests.has(id)) firstRequests.set(id, width);
    });
    expect([...firstRequests.values()].every((width) => width <= 192)).toBe(
      true,
    );
  } finally {
    release();
  }
});
