import { expect, test } from "@playwright/test";

test.beforeEach(async ({ context }) => {
  await context.route("https://**/*", (route) => {
    const url = new URL(route.request().url());
    if (!["elliotmairet.com", "bur1alrites.vercel.app"].includes(url.hostname))
      return route.abort();
    if (url.hostname === "bur1alrites.vercel.app") {
      return route.fulfill({
        contentType: "text/html",
        body: "<h1>Lighting archive</h1>",
      });
    }
    return route.fulfill({
      contentType: "text/html",
      body:
        url.pathname === "/photos/test"
          ? '<h1>Selected photograph</h1><a href="/">Back to index</a>'
          : `<!doctype html><html><body style="margin:16px;font-family:sans-serif">
          <button onclick="this.textContent='Count: '+(++window.count)">Count: 0</button>
          <input aria-label="Preview search" />
          <a href="/photos/test">Open photograph</a>
          <div style="height:1600px">Scrollable photograph archive</div>
          <script>
            window.count=0;
            if(document.referrer && /localhost|127\\.0\\.0\\.1|dextery\\.dev/.test(new URL(document.referrer).hostname)) {
              document.addEventListener('click',event=>{
                const anchor=event.target.closest('a[href]');
                event.preventDefault();event.stopPropagation();
                parent.postMessage({source:'dextery-preview-navigation',type:anchor?'open-link':'open-site',href:anchor?.href},'*');
              },true);
              parent.postMessage({source:'dextery-preview-navigation',type:'ready'},'*');
            }
          </script></body></html>`,
    });
  });
  await context.route("**/api/photo-graph/graph", (route) =>
    route.fulfill({
      json: {
        nodes: [
          {
            id: "write-up-test",
            sourceUrl: "/projects/posters/elliot-mairet.png",
            baseSize: 120,
            aspectRatio: 1.6,
            hasKnownAspectRatio: true,
            layerNoise: 0,
            w: 160,
            h: 100,
            renderArea: 16000,
          },
        ],
        links: [],
      },
    }),
  );
});

const writeUps = [
  { path: "/projects/photo-graph", title: "Photo Node-Gallery", figures: 3 },
  { path: "/projects/elliot-mairet", title: "Elliot Mairet", figures: 3 },
  { path: "/projects/bur1alrites", title: "bur1alrites", figures: 4 },
];

for (const { path, title, figures } of writeUps) {
  test(`${title} has an MDX opening, interactive preview, and responsive article`, async ({
    page,
  }) => {
    const backendRequests: string[] = [];
    page.on("request", (request) => {
      if (/\/api\/photo-graph\/|api\.dextery\.dev/.test(request.url()))
        backendRequests.push(request.url());
    });
    await page.goto(path);
    const article = page.getByRole("article");
    await expect(
      article.getByRole("heading", { name: title, level: 1 }),
    ).toBeVisible();
    await expect(article.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(article.locator("h1")).toHaveCSS(
      "line-height",
      page.viewportSize()!.width >= 640 ? "45px" : "37.5px",
    );
    await expect(article.locator("nav")).toHaveCSS("line-height", "25.2px");
    await expect(article.locator("[data-write-up-lead]")).toHaveCSS(
      "margin-top",
      "16px",
    );
    await expect(article.locator("[data-write-up-lead]")).toHaveCSS(
      "margin-bottom",
      "0px",
    );
    await expect(article.locator("[data-write-up-lead]")).not.toBeEmpty();
    await expect(article.locator("[data-write-up-lead] p")).toHaveCount(0);
    await expect(article.locator("h2").first()).toHaveCSS("margin-top", "48px");
    await expect(article.getByRole("link").first()).toHaveCSS(
      "text-decoration-line",
      "underline",
    );
    const preview = article.getByRole("region", {
      name: `${title} interactive preview`,
      exact: true,
    });
    await expect(preview).toBeVisible();
    await expect(preview).toHaveCSS("margin-top", "40px");
    if (path === "/projects/photo-graph") {
      await expect(preview.locator("canvas").first()).toBeVisible();
    } else {
      await expect(preview.locator("iframe")).toHaveAttribute(
        "referrerpolicy",
        "no-referrer",
      );
    }
    await expect(article.locator("figure")).toHaveCount(figures);
    await expect(article.locator("figcaption p")).toHaveCount(0);
    await expect(
      article.locator(
        "figure iframe, figure canvas, figure button, figure video, figure select, figure input",
      ),
    ).toHaveCount(0);
    for (const image of await article.getByRole("img").all()) {
      await image.scrollIntoViewIfNeeded();
      await expect(image).toHaveJSProperty("complete", true);
      await expect(image).not.toHaveJSProperty("naturalWidth", 0);
    }
    const dimensions = await article.evaluate((element) => {
      const box = element.getBoundingClientRect();
      return {
        left: box.left,
        right: innerWidth - box.right,
        width: box.width,
        viewport: innerWidth,
        overflows: document.documentElement.scrollWidth > innerWidth,
      };
    });
    expect(dimensions.overflows).toBe(false);
    expect(Math.abs(dimensions.left - dimensions.right)).toBeLessThan(2);
    if (dimensions.viewport >= 1024)
      expect(dimensions.width).toBeCloseTo(
        Math.min((dimensions.viewport * 2) / 3, 672),
        0,
      );
    else expect(dimensions.width).toBeGreaterThan(dimensions.viewport * 0.8);
    if (path === "/projects/photo-graph")
      expect(
        backendRequests.some((url) => url.endsWith("/api/photo-graph/graph")),
      ).toBe(true);
    else expect(backendRequests).toEqual([]);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      `https://dextery.dev${path}`,
    );
    await expect(
      article.getByRole("link", { name: "Back to projects" }),
    ).toBeVisible();
  });
}

test("Elliot's preview keeps controls, keyboard input, scrolling, and links in the frame", async ({
  page,
}) => {
  await page.goto("/projects/elliot-mairet");
  const preview = page.getByRole("region", {
    name: "Elliot Mairet interactive preview",
    exact: true,
  });
  const iframe = preview.locator("iframe");
  await expect(iframe).not.toHaveAttribute("sandbox", /allow-pointer-lock/);
  await expect(iframe).not.toHaveAttribute("allow", /autoplay/);
  await expect(iframe).toHaveCSS("transform", "matrix(0.85, 0, 0, 0.85, 0, 0)");
  const frame = preview.frameLocator("iframe");
  await expect(frame.getByRole("button", { name: "Count: 0" })).toBeVisible();
  expect(await frame.locator("body").evaluate(() => document.referrer)).toBe(
    "",
  );
  const counter = frame.getByRole("button", { name: /^Count:/ });
  await counter.click();
  await expect(counter).toHaveText("Count: 1");
  await counter.focus();
  await page.keyboard.press("Enter");
  await expect(counter).toHaveText("Count: 2");
  await frame.getByRole("textbox", { name: "Preview search" }).fill("colour");
  await expect(frame.getByRole("textbox")).toHaveValue("colour");
  const box = await iframe.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.wheel(0, 400);
  await expect
    .poll(() => frame.locator("body").evaluate(() => window.scrollY))
    .toBeGreaterThan(0);
  await frame.getByRole("link", { name: "Open photograph" }).click();
  await expect(
    frame.getByRole("heading", { name: "Selected photograph" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/projects\/elliot-mairet$/);
  await frame.getByRole("link", { name: "Back to index" }).click();
  await expect(frame.getByRole("button", { name: "Count: 0" })).toBeVisible();
  await expect(page).toHaveURL(/\/projects\/elliot-mairet$/);
});

test("Photo Graph's write-up preview opens and closes photograph inspection in place", async ({
  page,
}) => {
  await page.goto("/projects/photo-graph");
  const preview = page.getByRole("region", {
    name: "Photo Node-Gallery interactive preview",
    exact: true,
  });
  const canvas = preview.locator("canvas").first();
  await expect(canvas).toBeVisible();
  await expect(preview.getByRole("status")).toHaveCount(0);
  // A single fixture node settles at the canvas centre.
  await expect(async () => {
    await canvas.click();
    await expect(
      page.getByRole("dialog", { name: "Inspect photograph write-up-test" }),
    ).toBeVisible({ timeout: 1000 });
  }).toPass();
  const dialog = page.getByRole("dialog", {
    name: "Inspect photograph write-up-test",
  });
  await expect(dialog.locator("p").first()).toHaveCSS("margin-top", "0px");
  await expect(dialog.locator("a").first()).toHaveCSS(
    "text-decoration-line",
    "none",
  );
  await page.getByRole("button", { name: "Close inspect overlay" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).toHaveURL(/\/projects\/photo-graph$/);
});

test("Photo Graph preserves the benchmark context and separate experience", async ({
  page,
}) => {
  await page.goto("/projects/photo-graph");
  const article = page.getByRole("article");
  await expect(article).toContainText("26 August 2026");
  await expect(article).toContainText(
    "100 photographs and 7 reviewed query images",
  );
  await expect(article).toContainText("89.3%");
  await expect(article).toContainText("85.7%");
  await expect(article).toContainText("unjudged, not automatically wrong");
  await expect(
    article.getByRole("link", { name: "Launch experience" }),
  ).toHaveAttribute("href", "/projects/photo-graph/experience");
  await article.getByRole("link", { name: "Launch experience" }).click();
  await expect(page).toHaveURL(/\/projects\/photo-graph\/experience$/);
  await page.getByRole("link", { name: "Return to project write up" }).click();
  await expect(page).toHaveURL(/\/projects\/photo-graph$/);
  await expect(article.getByRole("heading", { level: 1 })).toHaveText(
    "Photo Node-Gallery",
  );
});

test("write-up media and text share the same width and horizontal inset", async ({
  page,
}) => {
  await page.goto("/projects/elliot-mairet");
  for (const width of [768, 1024, 1440, 1920, 2560]) {
    await page.setViewportSize({ width, height: 1000 });
    const dimensions = await page.getByRole("article").evaluate((article) => ({
      width: article.getBoundingClientRect().width,
      textWidth: article.querySelector("h2 + p")!.getBoundingClientRect().width,
      mediaWidth: article.querySelector("figure")!.getBoundingClientRect()
        .width,
      textLeft: article.querySelector("h2 + p")!.getBoundingClientRect().left,
      mediaLeft: article.querySelector("figure")!.getBoundingClientRect().left,
      overflows: document.documentElement.scrollWidth > innerWidth,
    }));
    const expectedWidth =
      width >= 1024
        ? Math.min((width * 2) / 3, 672)
        : Math.min(width - 64, 672);
    expect(dimensions.width).toBeCloseTo(expectedWidth, 0);
    expect(dimensions.mediaWidth).toBeCloseTo(dimensions.width, 0);
    expect(dimensions.mediaLeft).toBeCloseTo(dimensions.textLeft, 0);
    expect(dimensions.textWidth).toBeCloseTo(
      Math.min(dimensions.width, 672),
      0,
    );
    expect(dimensions.overflows).toBe(false);
  }
});

test("Photo Graph renders individual review images and ranked comparison rows", async ({
  page,
}) => {
  await page.goto("/projects/photo-graph");
  const review = page.locator("[data-write-up-gallery]");
  await expect(review.getByRole("listitem")).toHaveCount(7);
  await expect(review.getByRole("img")).toHaveCount(7);
  const comparison = page.locator("[data-write-up-comparison]");
  await expect(comparison.getByRole("img")).toHaveCount(9);
  await expect(
    comparison.getByRole("heading", { name: "Mean Oklab", exact: true }),
  ).toBeVisible();
  await expect(
    comparison.getByRole("heading", {
      name: "Mean LAB / CIEDE2000",
      exact: true,
    }),
  ).toBeVisible();
  const images = await comparison.getByRole("img").evaluateAll((elements) =>
    elements.map((image) => {
      const src = new URL(image.getAttribute("src")!, location.href);
      return src.searchParams.get("url") ?? src.pathname;
    }),
  );
  expect(images).toEqual(
    ["112", "75", "27", "105", "13", "75", "27", "24", "32"].map(
      (id) => `/projects/photo-graph/write-up/photographs/${id}.webp`,
    ),
  );
});

test("bur1alrites has a completed, indexable write-up grounded in its design brief", async ({
  page,
  request,
}) => {
  await page.goto("/projects/bur1alrites");
  const article = page.getByRole("article");
  await expect(article).toContainText("My friend Allie");
  await expect(article).toContainText("audio-reactive lighting");
  await expect(article).toContainText("first experiment with Three.js");
  await expect(article).toContainText("animated grain");
  await expect(article).not.toContainText(/in progress|placeholder/i);
  const robots = await page
    .locator('meta[name="robots"], meta[name="googlebot"]')
    .evaluateAll((metas) => metas.map((meta) => meta.getAttribute("content")));
  expect(robots.join(" ")).not.toMatch(/noindex/);
  await expect(page).toHaveTitle("bur1alrites — Dexter Young");
  const structuredData = await article
    .locator('script[type="application/ld+json"]')
    .textContent();
  expect(structuredData).toContain('"@type":"CreativeWork"');
  const sitemap = await request.get("/sitemap.xml");
  expect(await sitemap.text()).toContain(
    "<loc>https://dextery.dev/projects/bur1alrites</loc>",
  );
});

test("Elliot's completed write-up is linked, illustrated, and indexable", async ({
  page,
  request,
}) => {
  await page.goto("/portfolio#project-elliotmairet");
  const focus = page.getByRole("region", { name: "Elliot Mairet focus view" });
  await focus.getByRole("link", { name: "write up", exact: true }).click();
  await expect(page).toHaveURL(/\/projects\/elliot-mairet$/);
  const article = page.getByRole("article");
  await expect(article).not.toContainText(/in progress|placeholder/i);
  await expect(article).not.toContainText("Mairêt");
  await expect(article.locator("figure img")).toHaveCount(3);
  const robots = await page
    .locator('meta[name="robots"], meta[name="googlebot"]')
    .evaluateAll((metas) => metas.map((meta) => meta.getAttribute("content")));
  expect(robots.join(" ")).not.toMatch(/noindex/);
  await expect(page).toHaveTitle("Elliot Mairet — Dexter Young");
  const structuredData = await article
    .locator('script[type="application/ld+json"]')
    .textContent();
  expect(structuredData).toContain('"@type":"CreativeWork"');
  await expect(page.getByRole("link", { name: "Visit site" })).toHaveAttribute(
    "href",
    "https://elliotmairet.com/",
  );
  const sitemap = await request.get("/sitemap.xml");
  expect(await sitemap.text()).toContain(
    "<loc>https://dextery.dev/projects/elliot-mairet</loc>",
  );
});
