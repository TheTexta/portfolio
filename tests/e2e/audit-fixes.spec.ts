import { expect, test } from "@playwright/test";
import { projectCatalog } from "../../app/components/projects/project-catalog";

test.beforeEach(async ({ context }) => {
  await context.route("https://**/*", (route) => route.abort());
  await context.route("**/api/photo-graph/graph", (route) =>
    route.fulfill({ json: { nodes: [], links: [] } }),
  );
});

test("write-up-only projects stay out of cards and the opening follows owner copy", async ({
  page,
}) => {
  await page.goto("/portfolio");
  for (const id of ["tvm-discord-bot", "bot-or-not"]) {
    await expect(page.locator(`[data-project-id="${id}"]`)).toHaveCount(0);
    await expect(page.locator(`#about a[href="/write-ups/${id}"]`)).toHaveCount(
      1,
    );
    await page.goto(`/write-ups/${id}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Back to projects", exact: true }),
    ).toHaveAttribute("href", "/portfolio#about");
    await page.goto("/portfolio");
  }
  await expect(
    page.getByText(
      "Multimedia webworks, browser extensions and interactive image systems",
      {
        exact: true,
      },
    ),
  ).toBeVisible();
  await expect(
    page.getByText(/Computer science student at McGill, graduating/),
  ).toHaveCount(0);
  await expect(page.locator("[data-about-introduction] > p")).toHaveText([
    "I’m a software developer studying computer science at McGill, with a minor in music technology. I’m interested in how software shapes the way people present and explore visual media. My projects include photography galleries organised around colour and node graphs, alongside interactive 3D portfolios.",
    "At TVM, McGill’s student television service, I develop a Discord bot that supports membership and production workflows. As Technical Director, I also manage a CAD $15,000 equipment budget, maintain servers and lead workshops for a community of 150 members.",
    "I’m also interested in making second-hand shopping easier. I develop Grailed Plus, an open-source browser extension that helps shoppers compare resale listings across marketplaces and uses on-device image matching to find similar items.",
  ]);
});

test("portfolio design uses live shared components without changing the article URL", async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/write-ups/portfolio-design");
  const article = page.locator("main > article");
  await expect(article.getByRole("heading", { level: 1 })).toHaveText(
    "Portfolio design",
  );
  await expect(article.locator("p p")).toHaveCount(0);
  await expect(article.locator('img[src*="portfolio-design/"]')).toHaveCount(0);
  const frame = article.getByRole("figure", {
    name: "Portfolio frame example",
  });
  const theme = frame.getByRole("checkbox");
  if (info.project.name === "mobile") {
    await expect(theme).toHaveCount(0);
    await page.emulateMedia({ colorScheme: "dark" });
    await expect(page.locator("html")).toHaveClass(/dark/);
    await page.emulateMedia({ colorScheme: "light" });
    await expect(page.locator("html")).not.toHaveClass(/dark/);
  } else {
    const wasChecked = await theme.isChecked();
    await theme.focus();
    await theme.press("Space");
    await expect(theme).toBeChecked({ checked: !wasChecked });
    await theme.press("Space");
  }

  const browser = article.getByRole("region", {
    name: "Portfolio project browser example",
  });
  const isolatedCalls = await page.evaluateHandle(() => {
    const calls: string[] = [];
    const watch = (owner: object, name: string) => {
      const original = Reflect.get(owner, name);
      if (typeof original !== "function") return;
      Reflect.set(owner, name, function (this: unknown, ...args: unknown[]) {
        if (name === "scrollTo") {
          // Motion restores the current scroll position while measuring auto
          // height. A no-op is not document navigation by the embedded browser.
          const options = args[0] as ScrollToOptions | number;
          const left =
            typeof options === "number" ? options : (options.left ?? scrollX);
          const top =
            typeof options === "number" ? args[1] : (options.top ?? scrollY);
          if (left === scrollX && top === scrollY) {
            return Reflect.apply(original, this, args);
          }
        }
        calls.push(name);
        return Reflect.apply(original, this, args);
      });
    };
    watch(history, "pushState");
    watch(history, "replaceState");
    watch(document, "startViewTransition");
    watch(window, "scrollTo");
    watch(Element.prototype, "scrollIntoView");
    return calls;
  });
  if (info.project.name === "mobile") {
    await browser
      .getByRole("button", { name: "Photo Node-Gallery", exact: true })
      .click();
  }
  const trigger = browser.getByRole("button", {
    name:
      info.project.name === "mobile"
        ? "Open Photo Node-Gallery focus view"
        : "Show Photo Node-Gallery in focus view",
    exact: true,
  });
  await trigger.focus();
  await trigger.press("Enter");
  const focus = browser.getByRole("region", {
    name: "Photo Node-Gallery focus view",
  });
  await expect(focus).toBeFocused();
  await expect(page).toHaveURL(/\/write-ups\/portfolio-design$/);
  await focus.press("ArrowRight");
  const next = browser.getByRole("region", {
    name: "Elliot Mairet focus view",
  });
  await expect(next).toBeFocused();
  await expect(
    next.getByRole("group", { name: "Elliot Mairet preview controls" }),
  ).toHaveCount(0);
  const description = next
    .locator(".project-focus-detail-layout > div")
    .first();
  const actions = next.locator(".project-focus-actions");
  const descriptionBounds = (await description.boundingBox())!;
  const actionsBounds = (await actions.boundingBox())!;
  expect(descriptionBounds.width).toBeGreaterThan(200);
  expect(actionsBounds.y).toBeGreaterThanOrEqual(
    descriptionBounds.y + descriptionBounds.height,
  );
  await next.press("Escape");
  await expect(trigger).toBeFocused();
  await expect(page).toHaveURL(/\/write-ups\/portfolio-design$/);
  expect(await isolatedCalls.jsonValue()).toEqual([]);
  await isolatedCalls.dispose();
  expect(await page.evaluate(() => document.body.scrollWidth)).toBe(
    page.viewportSize()!.width,
  );
  await expect(
    article.getByRole("link", { name: "Back to projects", exact: true }),
  ).toHaveAttribute("href", "/portfolio#about");
});

test("Figma write-up metadata and links share a wrapping row above the lead", async ({
  page,
}) => {
  for (const project of projectCatalog.filter(
    (project) => project.writeUpHref,
  )) {
    await page.goto(project.writeUpHref!);
    const details = page.locator('dl[aria-label="Project details"]');
    await expect(details).toHaveCSS("display", "flex");
    await expect(details).toHaveCSS("flex-wrap", "wrap");
    await expect(details).toHaveCSS("border-top-width", "0px");
    await expect(details).toHaveCSS("border-bottom-width", "0px");
    const header = page.locator("[data-write-up-header]");
    const titleBounds = (await header.locator("h1").boundingBox())!;
    const frameBounds = (await header
      .locator("[data-write-up-title]")
      .boundingBox())!;
    const linksBounds = (await header.locator("nav").boundingBox())!;
    const leadBounds = (await header
      .locator("[data-write-up-lead]")
      .boundingBox())!;
    const meta = header.locator("[data-write-up-meta]");
    const metaBounds = (await meta.boundingBox())!;
    const detailsBounds = (await details.boundingBox())!;
    await expect(meta).toHaveCSS("display", "flex");
    await expect(meta).toHaveCSS("flex-wrap", "wrap");
    await expect(header.locator("h1")).toHaveCSS("text-align", "center");
    expect(
      Math.abs(
        titleBounds.x +
          titleBounds.width / 2 -
          frameBounds.x -
          frameBounds.width / 2,
      ),
    ).toBeLessThan(1);
    expect(linksBounds.y).toBeGreaterThanOrEqual(
      frameBounds.y + frameBounds.height,
    );
    expect(detailsBounds.y).toBeGreaterThanOrEqual(metaBounds.y);
    expect(linksBounds.y + linksBounds.height).toBeLessThanOrEqual(
      metaBounds.y + metaBounds.height,
    );
    expect(leadBounds.y).toBeGreaterThanOrEqual(
      metaBounds.y + metaBounds.height + 16,
    );
    if (project.id === "elliotmairet" && page.viewportSize()!.width >= 1024) {
      expect(
        Math.abs(
          detailsBounds.y +
            detailsBounds.height / 2 -
            (linksBounds.y + linksBounds.height / 2),
        ),
      ).toBeLessThan(1);
      expect(linksBounds.x).toBeGreaterThan(
        detailsBounds.x + detailsBounds.width,
      );
    }
    await expect(
      details.locator('img[src$="detail-separator.svg"]'),
    ).toHaveCount(2);
    await expect(details.locator("dd").nth(0)).toHaveText(project.date);
    await expect(details.locator("dd").nth(1)).toContainText(project.role);
    await expect(details.locator("dd").nth(2)).toContainText(project.status);
    for (const term of await details.locator("dt").all())
      await expect(term).toHaveClass("sr-only");
    expect(await page.evaluate(() => document.body.scrollWidth)).toBe(
      page.viewportSize()!.width,
    );
  }
});

test("framed write-up titles stay readable on mobile and share larger-screen scaling with the homepage", async ({
  page,
}) => {
  const widths = [320, 390, 640, 768, 1024, 1440];
  const homepageSizes = new Map<number, string>();
  await page.goto("/portfolio");
  for (const width of widths) {
    await page.setViewportSize({ width, height: 1000 });
    const homeType = await page.locator("h1").evaluate((title) => ({
      fontSize: getComputedStyle(title).fontSize,
      lineHeight: getComputedStyle(title).lineHeight,
    }));
    homepageSizes.set(width, homeType.fontSize);
    expect(
      Math.abs(
        parseFloat(homeType.lineHeight) -
          parseFloat(homeType.fontSize) * 0.7705,
      ),
    ).toBeLessThan(0.02);
  }
  for (const project of projectCatalog.filter(
    (project) => project.writeUpHref,
  )) {
    await page.goto(project.writeUpHref!);
    for (const width of widths) {
      await page.setViewportSize({ width, height: 1000 });
      const dimensions = await page
        .locator("[data-write-up-title]")
        .evaluate((frame) => {
          const title = frame.querySelector("h1")!;
          const frameBounds = frame.getBoundingClientRect();
          const titleBounds = title.getBoundingClientRect();
          return {
            fontSize: getComputedStyle(title).fontSize,
            lineHeight: getComputedStyle(title).lineHeight,
            fitsText: title.scrollWidth <= title.clientWidth,
            fitsFrame:
              titleBounds.top >= frameBounds.top &&
              titleBounds.bottom <= frameBounds.bottom,
            centreOffset: Math.abs(
              titleBounds.x +
                titleBounds.width / 2 -
                frameBounds.x -
                frameBounds.width / 2,
            ),
            pageOverflows: document.body.scrollWidth > innerWidth,
          };
        });
      expect(dimensions, `${project.title} at ${width}px`).toMatchObject({
        fontSize: width < 640 ? "36px" : homepageSizes.get(width),
        fitsText: true,
        fitsFrame: true,
        pageOverflows: false,
      });
      expect(dimensions.centreOffset).toBeLessThan(1);
      expect(parseFloat(dimensions.lineHeight)).toBeCloseTo(
        parseFloat(dimensions.fontSize) * 0.7705,
        1,
      );
      if (project.id === "portfolio-design") {
        const example = page.getByRole("figure", {
          name: "Portfolio frame example",
        });
        await expect(
          example.getByText("Dexter Young", { exact: true }),
        ).toHaveCSS("font-size", homepageSizes.get(width)!);
      }
    }
  }
});

for (const colorScheme of ["light", "dark"] as const) {
  test(`shared navigation focus is visible in ${colorScheme}`, async ({
    page,
  }, info) => {
    await page.emulateMedia({ colorScheme });
    for (const path of ["/portfolio", "/write-ups/photo-graph"]) {
      await page.goto(path);
      const brand = page.locator("header nav a").first();
      await brand.focus();
      await expect(brand).toHaveCSS("outline-style", "solid");
      await expect(brand).toHaveCSS("outline-width", "2px");
      if (info.project.name === "desktop") {
        const breadcrumb = page.locator('[aria-label="Directory"] a').first();
        await breadcrumb.focus();
        await expect(breadcrumb).toHaveCSS("outline-style", "solid");
        await expect(breadcrumb).toHaveCSS("outline-width", "2px");
      }
    }
  });
}

test("Contact moves the next keyboard step to contact actions", async ({
  page,
}) => {
  for (const hash of ["", "#project-photo-graph"]) {
    await page.goto(`/portfolio${hash}`);
    const link = page
      .getByRole("navigation", { name: "Site navigation" })
      .getByRole("link", { name: "Contact", exact: true });
    await link.focus();
    await link.press("Enter");
    await expect(page.locator("#contact")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.locator("#contact a").first()).toBeFocused();
    for (let i = 0; i < 3; i++) await page.keyboard.press("Tab");
    await expect(
      page.locator('#contact a[href="/Dexter_Young_CV.pdf"]'),
    ).toBeFocused();
  }
});

test("every marketplace demo discloses sample data before interaction", async ({
  page,
}) => {
  await page.goto("/grailed-plus");
  const notes = page.getByText(/Interactive demo using sample listings/);
  await expect(notes).toHaveCount(4);
  const recordingNote = page.getByText(
    "Recorded MobileCLIP-S1 comparison · sample metadata.",
  );
  await expect(recordingNote).toHaveCount(1);
  await expect(recordingNote).toContainText(
    "No live search or model download.",
  );
  for (const frame of await page
    .locator('iframe[title*="sample listings"]')
    .all()) {
    await expect(frame).toHaveAttribute("aria-describedby", /.+/);
  }
  await expect(
    page.getByRole("link", { name: "Engineering case study", exact: true }),
  ).toHaveAttribute("href", "/write-ups/grailed-plus");
});

test("blocked article preview keeps only an accessible direct-open icon", async ({
  page,
  context,
}) => {
  await page.goto("/write-ups/elliot-mairet");
  const preview = page.getByRole("region", {
    name: "Elliot Mairet interactive preview",
  });
  await preview.scrollIntoViewIfNeeded();
  const open = preview.getByRole("link", {
    name: "Open Elliot Mairet directly in a new tab",
    exact: true,
  });
  await expect(open).toHaveAttribute("href", "https://elliotmairet.com/");
  await expect(open).toHaveAttribute("target", "_blank");
  await expect(open.locator('img[src$="open-preview.svg"]')).toHaveCount(1);
  await expect(open).toHaveText("");
  await expect(preview.getByRole("button")).toHaveCount(0);
  await expect(preview.locator("details")).toHaveCount(0);
  await open.focus();
  await expect(open).toBeFocused();
  await context.route("https://elliotmairet.com/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<h1>Archive opened directly</h1>",
    }),
  );
  const popupPromise = context.waitForEvent("page");
  await open.press("Enter");
  const popup = await popupPromise;
  await expect(
    popup.getByRole("heading", { name: "Archive opened directly" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/write-ups\/elliot-mairet$/);
  await popup.close();
});

for (const failure of ["failed HEAD", "delayed frame load"] as const) {
  test(`a working iframe stays interactive after ${failure}`, async ({
    page,
    context,
  }) => {
    let release = () => {};
    const delayedImage = new Promise<void>((resolve) => {
      release = resolve;
    });
    const headRequests: string[] = [];
    await context.route("https://elliotmairet.com/**", async (route) => {
      if (new URL(route.request().url()).pathname === "/slow-image") {
        await delayedImage;
        return route.fulfill({ status: 204 });
      }
      if (route.request().method() === "HEAD") {
        headRequests.push(route.request().url());
        return failure === "failed HEAD"
          ? route.abort()
          : route.fulfill({ status: 200 });
      }
      return route.fulfill({
        contentType: "text/html",
        body: `<button onclick="this.textContent='Still interactive'">Preview action</button>${
          failure === "delayed frame load"
            ? '<img src="/slow-image" alt="" />'
            : ""
        }`,
      });
    });
    try {
      if (failure === "delayed frame load") await page.clock.install();
      await page.goto("/write-ups/elliot-mairet", {
        waitUntil: "domcontentloaded",
      });
      const preview = page.getByRole("region", {
        name: "Elliot Mairet interactive preview",
      });
      await preview.scrollIntoViewIfNeeded();
      const frame = preview.frameLocator("iframe");
      await expect(
        frame.getByRole("button", { name: "Preview action" }),
      ).toBeVisible();
      if (failure === "delayed frame load") {
        await page.clock.fastForward(8_500);
      }
      await expect(preview.getByRole("status")).toHaveCount(0);
      expect(headRequests).toEqual([]);
      await frame.getByRole("button", { name: "Preview action" }).click();
      await expect(
        frame.getByRole("button", { name: "Still interactive" }),
      ).toBeVisible();
      await expect(
        preview.getByRole("link", {
          name: "Open Elliot Mairet directly in a new tab",
        }),
      ).toBeVisible();
      if (failure === "delayed frame load") {
        release();
        await expect(preview.getByRole("status")).toHaveCount(0);
      }
    } finally {
      release();
    }
  });
}

test("full graph uses an icon-only return link without a photograph browser", async ({
  page,
  context,
}) => {
  await context.route("**/api/photo-graph/graph", (route) =>
    route.fulfill({
      json: {
        nodes: ["first", "related"].map((id) => ({
          id,
          sourceUrl: "/projects/posters/elliot-mairet.png",
          baseSize: 100,
          aspectRatio: 1.6,
          hasKnownAspectRatio: true,
          layerNoise: 0,
          w: 160,
          h: 100,
          renderArea: 16000,
        })),
        links: [
          { source: "first", target: "related", value: 0.8, baseValue: 0.8 },
        ],
      },
    }),
  );
  await page.goto("/projects/photo-graph/experience");
  const graph = page.getByRole("region", {
    name: "Interactive photograph graph",
  });
  await expect(graph.locator("canvas").first()).toBeVisible();
  await expect(page.getByRole("status")).toHaveCount(0);
  await expect(
    page.getByText("Browse photographs", { exact: true }),
  ).toHaveCount(0);
  await expect(graph.locator("details")).toHaveCount(0);
  await expect(page.getByLabel("Select a photograph")).toHaveCount(0);
  const returnLink = page.getByRole("link", {
    name: "Return to project write up",
    exact: true,
  });
  await expect(returnLink).toBeVisible();
  await expect(returnLink).toHaveText("");
  await expect(returnLink.locator("svg")).toBeVisible();
  const bounds = (await returnLink.boundingBox())!;
  expect(bounds.width).toBe(bounds.height);
  await returnLink.focus();
  await expect(returnLink).toBeFocused();
  await expect(returnLink).toHaveCSS("outline-style", "solid");
  await returnLink.press("Enter");
  await expect(page).toHaveURL(/\/write-ups\/photo-graph$/);
});

test("embedding refusal retains a direct-open recovery path", async ({
  page,
  context,
}) => {
  await context.route("https://elliotmairet.com/**", (route) =>
    route.fulfill({
      headers: {
        "x-frame-options": "DENY",
        "content-security-policy": "frame-ancestors 'none'",
      },
      contentType: "text/html",
      body: "<h1>Archive</h1>",
    }),
  );
  await page.goto("/write-ups/elliot-mairet");
  const preview = page.getByRole("region", {
    name: "Elliot Mairet interactive preview",
  });
  await preview.scrollIntoViewIfNeeded();
  const open = preview.getByRole("link", {
    name: "Open Elliot Mairet directly in a new tab",
    exact: true,
  });
  await expect(open).toBeVisible();
  await open.focus();
  await expect(open).toBeFocused();
  await expect(open).toHaveCSS("width", "48px");
  await expect(open).toHaveCSS("height", "48px");
  const controls = preview.getByRole("group", {
    name: "Elliot Mairet preview controls",
  });
  await expect(
    controls.getByText("Elliot Mairet", { exact: true }),
  ).toBeVisible();
  // The iframe extends past the clipped media to hide native scrollbars.
  const mediaBounds = (await preview
    .locator(":scope > div")
    .first()
    .boundingBox())!;
  const controlsBounds = (await controls.boundingBox())!;
  expect(controlsBounds.y).toBeGreaterThanOrEqual(
    mediaBounds.y + mediaBounds.height - 1,
  );
  await expect(preview.locator("details")).toHaveCount(0);
  await expect(preview.getByRole("button")).toHaveCount(0);
});

test("graph controls stay at the top-left beside the return icon", async ({
  page,
}) => {
  for (const [width, height] of [
    [320, 844],
    [390, 844],
    [844, 390],
    [1440, 900],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto("/projects/photo-graph/experience");
    const returnLink = page.getByRole("link", {
      name: "Return to project write up",
      exact: true,
    });
    const controls = page.getByRole("button", {
      name: "Open graph controls",
      exact: true,
    });
    await expect(returnLink).toBeVisible();
    await expect(controls).toBeVisible();
    const nav = (await returnLink.boundingBox())!;
    const panel = page
      .getByRole("checkbox", { name: "Show connecting lines", exact: true })
      .locator("../..");
    const row = (await panel.boundingBox())!;
    expect(nav.x).toBeGreaterThanOrEqual(0);
    expect(nav.x + nav.width).toBeLessThanOrEqual(width);
    expect(row.x).toBeGreaterThanOrEqual(8);
    expect(row.x).toBeLessThanOrEqual(9);
    expect(row.y).toBeGreaterThanOrEqual(8);
    expect(row.y).toBeLessThanOrEqual(9);
    expect(Math.abs(row.y - nav.y)).toBeLessThanOrEqual(1);
    expect(row.x + row.width + 8).toBeLessThanOrEqual(nav.x);
    await controls.click();
    await expect(
      page.getByRole("button", { name: "Close graph controls", exact: true }),
    ).toBeVisible();
    expect((await panel.boundingBox())!.y).toBe(row.y);
    await returnLink.click();
    await expect(page).toHaveURL(/\/write-ups\/photo-graph$/);
  }
});
