import { expect, test, type Page } from "@playwright/test";

async function recordScrollSteps(page: Page) {
  return page.evaluateHandle(() => {
    const positions: number[] = [];
    const original = window.scrollTo.bind(window);
    Reflect.set(
      window,
      "scrollTo",
      (options: ScrollToOptions | number, y?: number) => {
        positions.push(
          typeof options === "number"
            ? (y ?? window.scrollY)
            : (options.top ?? window.scrollY),
        );
        if (typeof options === "number") original(options, y ?? 0);
        else original(options);
      },
    );
    return positions;
  });
}

async function sampleTickScales(page: Page, selector: string, top: number) {
  return page.evaluate(
    async ({ selector, top }) => {
      const tick = document.querySelector<HTMLElement>(selector)!;
      const scales: number[] = [];
      window.scrollTo({ top, behavior: "instant" });
      for (let frame = 0; frame < 24; frame++) {
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => resolve()),
        );
        const transform = getComputedStyle(tick).transform;
        const scale =
          transform === "none" ? 1 : new DOMMatrixReadOnly(transform).a;
        scales.push((scale - 1) / 10);
      }
      return scales;
    },
    { selector, top },
  );
}

const articles = [
  "photo-graph",
  "elliot-mairet",
  "bur1alrites",
  "grailed-plus",
  "tvm-discord-bot",
  "bot-or-not",
  "portfolio-design",
];

test.beforeEach(async ({ context }) => {
  await context.route("https://**/*", (route) => route.abort());
  await context.route("**/api/photo-graph/graph", (route) =>
    route.fulfill({ json: { nodes: [], links: [] } }),
  );
});

for (const slug of articles) {
  test(`${slug} has an automatic desktop outline without changing the reading column`, async ({
    page,
  }, info) => {
    await page.goto(`/write-ups/${slug}`);
    await expect(page.locator("#write-up-content")).toBeVisible();
    await expect(
      page.locator("#write-up-content [data-write-up-header]"),
    ).toHaveCount(0);
    const contents = page.getByRole("navigation", {
      name: "Table of contents",
    });
    if (info.project.name === "mobile") {
      await expect(contents).toBeHidden();
      expect(await contents.getByRole("link").count()).toBe(0);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      return;
    }

    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(contents).toBeVisible();
    const headings = await page
      .locator("article [data-write-up-heading]")
      .evaluateAll((elements) =>
        elements.map((element) => ({
          id: element.id,
          title: element.textContent,
        })),
      );
    const links = await contents
      .locator("[data-contents-section]")
      .evaluateAll((elements) =>
        elements.map((element) => ({
          id: element.getAttribute("href")?.slice(1),
          title: element.textContent,
        })),
      );
    expect(links).toEqual(headings);
    expect(new Set(headings.map(({ id }) => id)).size).toBe(headings.length);
    const introGap = await page
      .locator("#write-up-content")
      .evaluate(
        (body) =>
          body.querySelector("[data-write-up-heading]")!.getBoundingClientRect()
            .top - body.getBoundingClientRect().top,
      );
    await expect(contents.locator("[data-contents-intro]")).toHaveCSS(
      "display",
      introGap > 50 ? "block" : "none",
    );

    for (const width of [1023, 1024, 1100, 1200, 1279, 1280, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      const article = await page.locator("#write-up-article").boundingBox();
      expect(article!.width).toBeCloseTo(672, 0);
      expect(article!.x).toBeCloseTo((width - 672) / 2, 0);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      if (width < 1024) await expect(contents).toBeHidden();
      else {
        await expect(contents).toBeVisible();
        const sidebar = await contents.boundingBox();
        expect(sidebar!.x).toBeGreaterThanOrEqual(20);
        expect(sidebar!.x + sidebar!.width).toBeLessThan(article!.x - 20);
      }
    }
  });
}

for (const reducedMotion of ["no-preference", "reduce"] as const) {
  test(`marker ticks expand on reading-window overlap with ${reducedMotion} motion`, async ({
    page,
  }, info) => {
    test.skip(info.project.name === "mobile", "Desktop-only navigation");
    await page.setViewportSize({ width: 1440, height: 600 });
    await page.emulateMedia({ reducedMotion });
    await page.goto("/write-ups/tvm-discord-bot");
    await page.evaluate(() => document.fonts.ready);
    const contents = page.getByRole("navigation", {
      name: "Table of contents",
    });
    await expect
      .poll(() =>
        contents
          .locator("ol")
          .evaluate((list) =>
            parseFloat(list.style.getPropertyValue("--reading-height")),
          ),
      )
      .toBeGreaterThan(0);

    const candidate = await page
      .locator("#write-up-content [data-write-up-heading]")
      .evaluateAll((headings) => {
        const maximum = document.documentElement.scrollHeight - innerHeight;
        const index = headings.findIndex((heading) => {
          const top = heading.getBoundingClientRect().top + scrollY;
          return top > innerHeight + 100 && top + 100 < maximum;
        });
        return {
          index,
          top:
            index >= 0
              ? headings[index].getBoundingClientRect().top + scrollY
              : 0,
        };
      });
    expect(candidate.index).toBeGreaterThanOrEqual(0);
    const link = contents
      .locator("[data-contents-section]")
      .nth(candidate.index);
    const href = await link.getAttribute("href");
    const marker = link.locator("[data-contents-marker]");
    const tick = marker.locator("[data-contents-tick]");
    const selector = `aside a[href="${href}"] [data-contents-tick]`;

    await sampleTickScales(page, selector, candidate.top - 700);
    await expect(marker).toHaveAttribute("data-contents-overlap", "false");
    await expect(marker.locator(":scope > *")).toHaveCount(1);
    await expect(marker).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await expect(marker).toHaveCSS("outline-width", "1px");
    await expect(marker).toHaveCSS("outline-style", "solid");
    const gapColour = await marker.evaluate(
      (element) => getComputedStyle(element).outlineColor,
    );
    expect((await tick.boundingBox())!.width).toBeCloseTo(1, 1);
    expect((await tick.boundingBox())!.height).toBeCloseTo(1, 1);
    await expect(contents.locator("ol")).toHaveCSS("border-left-width", "1px");
    const markerBefore = (await marker.boundingBox())!;

    const expanding = await sampleTickScales(
      page,
      selector,
      candidate.top - 500,
    );
    await expect(marker).toHaveAttribute("data-contents-overlap", "true");
    await expect(link).not.toHaveAttribute("aria-current", "location");
    await expect
      .poll(async () => (await tick.boundingBox())!.width)
      .toBeCloseTo(11, 1);
    const markerAfter = (await marker.boundingBox())!;
    const line = (await tick.boundingBox())!;
    expect(markerAfter.x).toBeCloseTo(markerBefore.x, 1);
    expect(markerAfter.y).toBeCloseTo(markerBefore.y, 1);
    expect(markerAfter.width).toBe(1);
    expect(markerAfter.height).toBe(1);
    expect(markerAfter.x - line.x).toBeCloseTo(5, 1);
    expect(line.x + line.width - markerAfter.x - markerAfter.width).toBeCloseTo(
      5,
      1,
    );
    const readingWindow = contents.locator("[data-contents-window]");
    expect(line.height).toBeCloseTo(
      (await readingWindow.boundingBox())!.width,
      1,
    );
    expect(line.height).toBeCloseTo(1, 1);
    expect(line.y + line.height / 2).toBeCloseTo(
      markerAfter.y + markerAfter.height / 2,
      1,
    );
    await expect(tick).toHaveCSS(
      "background-color",
      await readingWindow.evaluate(
        (element) => getComputedStyle(element).backgroundColor,
      ),
    );
    await expect(marker).toHaveCSS("outline-width", "1px");
    await expect(marker).toHaveCSS("outline-style", "solid");
    await expect(marker).toHaveCSS("outline-color", gapColour);

    await page.setViewportSize({ width: 1024, height: 600 });
    await expect(marker).toHaveAttribute("data-contents-overlap", "true");
    const narrowLine = (await tick.boundingBox())!;
    const rail = (await contents.boundingBox())!;
    expect(narrowLine.x).toBeGreaterThanOrEqual(rail.x);
    expect(narrowLine.x + narrowLine.width).toBeLessThanOrEqual(
      rail.x + rail.width,
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);

    await page.setViewportSize({ width: 1440, height: 600 });
    const retracting = await sampleTickScales(
      page,
      selector,
      candidate.top + 100,
    );
    await expect(marker).toHaveAttribute("data-contents-overlap", "false");
    await expect
      .poll(async () => (await tick.boundingBox())!.width)
      .toBeCloseTo(1, 1);
    expect((await tick.boundingBox())!.height).toBeCloseTo(1, 1);
    await expect(marker).toHaveCSS("outline-width", "1px");
    await expect(marker).toHaveCSS("outline-style", "solid");
    await expect(marker).toHaveCSS("outline-color", gapColour);
    if (reducedMotion === "reduce") {
      expect(
        [...expanding, ...retracting].every(
          (scale) => scale < 0.001 || scale > 0.999,
        ),
      ).toBe(true);
    } else {
      expect(expanding.some((scale) => scale > 0.01 && scale < 0.99)).toBe(
        true,
      );
      expect(retracting.some((scale) => scale > 0.01 && scale < 0.99)).toBe(
        true,
      );
    }
  });
}

test("contents follows scrolling, native anchor navigation and browser history", async ({
  page,
}, info) => {
  test.skip(info.project.name === "mobile", "Desktop-only navigation");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/write-ups/elliot-mairet");
  const contents = page.getByRole("navigation", { name: "Table of contents" });
  const links = contents.locator("[data-contents-section]");
  const first = links.nth(0);
  const second = links.nth(1);
  const firstHref = await first.getAttribute("href");
  const secondHref = await second.getAttribute("href");

  await first.focus();
  await expect(first).toBeFocused();
  await expect(first).toHaveCSS("outline-style", "solid");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new RegExp(`${firstHref}$`));
  await expect(first).toHaveAttribute("aria-current", "location");
  const target = page.locator(firstHref!);
  await expect(target).toBeFocused();
  expect((await target.boundingBox())!.y).toBeGreaterThanOrEqual(32);

  await second.click();
  await expect(second).toHaveAttribute("aria-current", "location");
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`${firstHref}$`));
  await expect(first).toHaveAttribute("aria-current", "location");
  await page.goForward();
  await expect(page).toHaveURL(new RegExp(`${secondHref}$`));
  await expect(second).toHaveAttribute("aria-current", "location");
  await page.reload();
  await expect(second).toHaveAttribute("aria-current", "location");

  await page.evaluate(() =>
    window.scrollTo(0, document.documentElement.scrollHeight),
  );
  await expect(links.last()).toHaveAttribute("aria-current", "location");
  await expect(page).toHaveURL(new RegExp(`${secondHref}$`));
  expect((await contents.boundingBox())!.y).toBeGreaterThanOrEqual(32);

  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(contents.locator("[data-contents-title]")).toHaveAttribute(
    "aria-current",
    "location",
  );
});

test("reading map reveals labels on hover and focus, measures sections and follows layout changes", async ({
  page,
}, info) => {
  test.skip(info.project.name === "mobile", "Desktop-only navigation");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/write-ups/tvm-discord-bot");
  const contents = page.getByRole("navigation", { name: "Table of contents" });
  const sections = contents.locator("[data-contents-section]");
  const label = sections.first().locator("[data-contents-label]");
  const list = contents.locator("ol");
  const windowTop = () =>
    list.evaluate((element) =>
      parseFloat(element.style.getPropertyValue("--reading-top")),
    );
  const windowHeight = () =>
    list.evaluate((element) =>
      parseFloat(element.style.getPropertyValue("--reading-height")),
    );

  await page.mouse.move(1000, 50);
  await expect(label).toHaveCSS("opacity", "0");
  await contents.hover();
  await expect(label).toHaveCSS("opacity", "1");
  await page.mouse.move(1000, 50);
  await expect(label).toHaveCSS("opacity", "0");
  await sections.first().focus();
  await expect(label).toHaveCSS("opacity", "1");
  await expect(label).toHaveCSS("transition-property", "none");
  await expect.poll(windowHeight).toBeGreaterThan(0);
  const initialTop = await windowTop();
  const weights = await sections.evaluateAll((links) =>
    links.map((link) =>
      parseFloat(
        (link.parentElement as HTMLElement).style.getPropertyValue(
          "--section-weight",
        ),
      ),
    ),
  );
  expect(weights.every((weight) => weight > 0)).toBe(true);
  expect(new Set(weights.map(Math.round)).size).toBeGreaterThan(1);

  const firstWeight = () =>
    sections
      .first()
      .locator("..")
      .evaluate((row) =>
        parseFloat(
          (row as HTMLElement).style.getPropertyValue("--section-weight"),
        ),
      );
  const originalWeight = await firstWeight();
  await page
    .locator("[data-write-up-heading]")
    .first()
    .evaluate((heading) => {
      (heading.nextElementSibling as HTMLElement).style.paddingBottom = "600px";
    });
  const expectedWeight = await page
    .locator("#write-up-content")
    .evaluate((body) => {
      const headings = body.querySelectorAll("[data-write-up-heading]");
      return (
        ((headings[1].getBoundingClientRect().top -
          headings[0].getBoundingClientRect().top) /
          body.getBoundingClientRect().height) *
        100
      );
    });
  await expect.poll(firstWeight).toBeCloseTo(expectedWeight, 3);
  expect(await firstWeight()).toBeGreaterThan(originalWeight);

  await page.evaluate(() =>
    window.scrollTo(0, document.documentElement.scrollHeight),
  );
  await expect.poll(windowTop).toBeGreaterThan(initialTop);
  await expect.poll(windowHeight).toBeGreaterThan(0);
  await contents.locator("[data-contents-title]").click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await expect(page.locator("#write-up-article")).toBeFocused();
});

test("reading window changes size across sections and viewport heights", async ({
  page,
}, info) => {
  test.skip(info.project.name === "mobile", "Desktop-only navigation");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/write-ups/tvm-discord-bot");
  const contents = page.getByRole("navigation", { name: "Table of contents" });
  const list = contents.locator("ol");
  const height = () =>
    list.evaluate((element) =>
      parseFloat(element.style.getPropertyValue("--reading-height")),
    );
  await expect.poll(height).toBeGreaterThan(0);

  await expect(
    contents.locator("[data-contents-title]").locator(".."),
  ).toHaveCSS("flex-grow", "0");
  for (const link of await contents.locator("[data-contents-section]").all())
    await expect(link.locator("..")).toHaveCSS("flex-basis", "0px");

  const sizes: number[] = [];
  for (const fraction of [0.15, 0.3, 0.45, 0.6]) {
    sizes.push(
      await page.evaluate(async (position) => {
        window.scrollTo({
          top: (document.documentElement.scrollHeight - innerHeight) * position,
          behavior: "instant",
        });
        await new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        );
        return document
          .querySelector("[data-contents-window]")!
          .getBoundingClientRect().height;
      }, fraction),
    );
  }
  expect(Math.max(...sizes) - Math.min(...sizes)).toBeGreaterThan(2);
  expect(sizes.every((size) => size >= 10)).toBe(true);

  await page.evaluate(async () => {
    window.scrollTo({ top: 0, behavior: "instant" });
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
  });
  const tallerViewportSize = await height();
  await page.setViewportSize({ width: 1440, height: 700 });
  await expect.poll(height).toBeLessThan(tallerViewportSize);
});

test("rail uses the live header height and scales only the post content", async ({
  page,
}, info) => {
  test.skip(info.project.name === "mobile", "Desktop-only navigation");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/write-ups/elliot-mairet");
  const contents = page.getByRole("navigation", { name: "Table of contents" });
  const siteHeader = page.locator("main > header");
  const articleHeader = page.locator("[data-write-up-header]");
  const body = page.locator("#write-up-content");
  const intro = contents.locator("[data-contents-intro]");
  const sections = contents.locator("[data-contents-section]");
  const size = () =>
    contents
      .locator("ol")
      .evaluate((list) =>
        parseFloat(list.style.getPropertyValue("--reading-height")),
      );
  await expect.poll(size).toBeGreaterThan(0);

  const headerBounds = (await siteHeader.boundingBox())!;
  expect((await contents.boundingBox())!.y).toBeCloseTo(
    headerBounds.y + headerBounds.height,
    0,
  );
  expect((await contents.boundingBox())!.height).toBeCloseTo(
    900 - headerBounds.height,
    0,
  );
  expect((await contents.locator("ol").boundingBox())!.y).toBeCloseTo(
    headerBounds.height + 22,
    0,
  );
  expect((await body.boundingBox())!.y).toBeCloseTo(
    (await articleHeader.boundingBox())!.y +
      (await articleHeader.boundingBox())!.height,
    0,
  );

  const expected = await body.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const positions = Array.from(
      element.querySelectorAll("[data-write-up-heading]"),
    ).map((heading) => heading.getBoundingClientRect().top);
    return {
      intro: ((positions[0] - bounds.top) / bounds.height) * 100,
      sections: positions.map(
        (position, index) =>
          (((positions[index + 1] ?? bounds.bottom) - position) /
            bounds.height) *
          100,
      ),
    };
  });
  await expect(intro).toHaveCSS("display", "block");
  expect(
    await intro.evaluate((element) =>
      parseFloat(element.style.getPropertyValue("--section-weight")),
    ),
  ).toBeCloseTo(expected.intro, 3);
  const weights = () =>
    sections.evaluateAll((links) =>
      links.map((link) =>
        parseFloat(
          (link.parentElement as HTMLElement).style.getPropertyValue(
            "--section-weight",
          ),
        ),
      ),
    );
  (await weights()).forEach((weight, index) =>
    expect(weight).toBeCloseTo(expected.sections[index], 3),
  );

  const beforeSize = await size();
  await articleHeader.evaluate(
    (element) => (element.style.paddingBottom = "600px"),
  );
  await expect
    .poll(async () => Math.abs((await size()) - beforeSize))
    .toBeGreaterThan(2);
  (await weights()).forEach((weight, index) =>
    expect(weight).toBeCloseTo(expected.sections[index], 3),
  );

  await siteHeader.evaluate((element) => (element.style.minHeight = "96px"));
  await expect
    .poll(async () => (await contents.boundingBox())!.y)
    .toBeCloseTo(96, 0);
  expect((await contents.boundingBox())!.height).toBeCloseTo(804, 0);
  (await weights()).forEach((weight, index) =>
    expect(weight).toBeCloseTo(expected.sections[index], 3),
  );
});

test("contents and direct section links work without JavaScript", async ({
  browser,
  baseURL,
}, info) => {
  test.skip(info.project.name === "mobile", "Desktop-only navigation");
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 1440, height: 900 },
    baseURL,
  });
  await context.route("https://**/*", (route) => route.abort());
  try {
    const page = await context.newPage();
    await page.goto("/write-ups/tvm-discord-bot");
    const contents = page.getByRole("navigation", {
      name: "Table of contents",
    });
    const link = contents.locator("[data-contents-section]").nth(1);
    const href = await link.getAttribute("href");
    await link.click();
    await page.reload();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
    const heading = page.locator(href!);
    expect((await heading.boundingBox())!.y).toBeGreaterThanOrEqual(32);
    expect((await heading.boundingBox())!.y).toBeLessThan(450);
  } finally {
    await context.close();
  }
});

for (const reducedMotion of ["no-preference", "reduce"] as const) {
  test(`section clicks use ${reducedMotion === "reduce" ? "an instant jump" : "Framer Motion scroll steps"}`, async ({
    page,
  }, info) => {
    test.skip(info.project.name === "mobile", "Desktop-only navigation");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ reducedMotion });
    await page.goto("/write-ups/tvm-discord-bot");
    const contents = page.getByRole("navigation", {
      name: "Table of contents",
    });
    await expect
      .poll(() =>
        contents
          .locator("ol")
          .evaluate((list) =>
            parseFloat(list.style.getPropertyValue("--reading-height")),
          ),
      )
      .toBeGreaterThan(0);
    const link = contents.locator("[data-contents-section]").last();
    const href = await link.getAttribute("href");
    const target = page.locator(href!);
    const destination = await target.evaluate((element) =>
      Math.max(
        0,
        Math.min(
          element.getBoundingClientRect().top +
            window.scrollY -
            parseFloat(getComputedStyle(element).scrollMarginTop),
          document.documentElement.scrollHeight - window.innerHeight,
        ),
      ),
    );
    const steps = await recordScrollSteps(page);
    await link.click();
    await expect(target).toBeFocused();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
    expect(await page.evaluate(() => window.scrollY)).toBeCloseTo(
      destination,
      0,
    );
    const positions = await steps.jsonValue();
    if (reducedMotion === "reduce") expect(positions).toHaveLength(1);
    else {
      expect(positions.length).toBeGreaterThan(2);
      expect(
        positions.some(
          (position) => position > 0 && position < destination - 1,
        ),
      ).toBe(true);
    }
    await steps.dispose();
  });
}

test("manual keyboard input interrupts an animated section jump", async ({
  page,
}, info) => {
  test.skip(info.project.name === "mobile", "Desktop-only navigation");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/write-ups/tvm-discord-bot");
  const contents = page.getByRole("navigation", { name: "Table of contents" });
  await expect
    .poll(() =>
      contents
        .locator("ol")
        .evaluate((list) =>
          parseFloat(list.style.getPropertyValue("--reading-height")),
        ),
    )
    .toBeGreaterThan(0);
  const steps = await recordScrollSteps(page);
  const link = contents.locator("[data-contents-section]").last();
  const href = await link.getAttribute("href");
  await link.click();
  await expect
    .poll(() => steps.evaluate((positions) => positions.length))
    .toBeGreaterThan(1);
  await page.keyboard.press("Escape");
  const count = await steps.evaluate((positions) => positions.length);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        let frames = 0;
        const next = () => {
          if (++frames === 6) resolve();
          else requestAnimationFrame(next);
        };
        requestAnimationFrame(next);
      }),
  );
  expect(await steps.evaluate((positions) => positions.length)).toBe(count);
  await expect(page.locator(href!)).not.toBeFocused();
  await steps.dispose();
});
