import { expect, test } from "@playwright/test";
import {
  browserProjects,
  projectCatalog,
} from "../../app/components/projects/project-catalog";

test.beforeEach(async ({ context }) => {
  await context.route("**/api/photo-graph/graph", (route) =>
    route.fulfill({ json: { nodes: [], links: [] } }),
  );
  await context.route("**/grailed-plus?view=hero", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<p>Local product preview</p>",
    }),
  );
  await context.route("https://**/*", (route) => {
    const url = new URL(route.request().url());
    if (
      [
        "elliotmairet.com",
        "bur1alrites.vercel.app",
        "thetexta.github.io",
      ].includes(url.hostname)
    ) {
      return route.fulfill({
        contentType: "text/html",
        body: `<button onclick='parent.postMessage({source:"dextery-preview-navigation",type:"open-link",href:"https://elliotmairet.com/photos/test"},"*")'>Open photograph</button><script>parent.postMessage({source:"dextery-preview-navigation",type:"ready"},"*")</script>`,
      });
    }
    return route.abort();
  });
});

for (const colorScheme of ["light", "dark"] as const) {
  test(`text selection uses the site palette in ${colorScheme} mode`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme });
    for (const path of [
      "/portfolio",
      "/write-ups/elliot-mairet",
      "/grailed-plus",
    ]) {
      await page.goto(path);
      await expect(page.locator("[data-header-gutter-ticks]")).toHaveCSS(
        "border-left-color",
        colorScheme === "light" ? "rgb(0, 0, 0)" : "rgb(235, 235, 235)",
      );
      await expect(page.locator("[data-header-content-ticks]")).toHaveCSS(
        "border-left-color",
        colorScheme === "light" ? "rgb(0, 0, 0)" : "rgb(235, 235, 235)",
      );
      for (const selector of ["main h1", "main p", "main a"]) {
        const colors = await page
          .locator(selector)
          .first()
          .evaluate((element) => {
            const selection = getComputedStyle(element, "::selection");
            return {
              background: selection.backgroundColor,
              color: selection.color,
            };
          });
        expect(colors).toEqual(
          colorScheme === "light"
            ? { background: "rgb(0, 0, 0)", color: "rgb(255, 255, 255)" }
            : { background: "rgb(235, 235, 235)", color: "rgb(0, 0, 0)" },
        );
      }
    }
  });
}

test("site header rails and inner ticks follow the shared padding and content column", async ({
  page,
}) => {
  for (const path of ["/portfolio", "/write-ups/bot-or-not"]) {
    await page.goto(path);
    const header = page.locator("main > header");
    const navigation = header.locator(":scope > nav");
    const ticks = header.locator("[data-header-gutter-ticks]");
    const innerTicks = ticks.locator("[data-header-content-ticks]");
    await expect(ticks).toHaveCount(1);
    await expect(ticks).toHaveAttribute("aria-hidden", "true");
    await expect(ticks).toHaveCSS("pointer-events", "none");
    await expect(ticks).toHaveCSS("border-left-width", "1px");
    await expect(ticks).toHaveCSS("border-right-width", "1px");
    await expect(innerTicks).toHaveCount(1);
    await expect(innerTicks).toHaveCSS("border-left-width", "1px");
    await expect(innerTicks).toHaveCSS("border-right-width", "1px");
    for (const [width, gutter] of [
      [320, 20],
      [768, 32],
      [977, 32],
      [980, 32],
      [1024, 48],
      [1280, 48],
      [1440, 48],
    ]) {
      await page.setViewportSize({ width, height: 844 });
      await expect(ticks).toHaveCSS(
        "transform",
        /^(none|matrix\(1, 0, 0, 1, 0, 0\))$/,
      );
      const headerBounds = (await header.boundingBox())!;
      const tickBounds = (await ticks.boundingBox())!;
      expect(tickBounds.x).toBeCloseTo(gutter, 0);
      expect(width - tickBounds.x - tickBounds.width).toBeCloseTo(gutter, 0);
      expect(tickBounds.y).toBeCloseTo(
        headerBounds.y + headerBounds.height - 4,
        0,
      );
      expect(tickBounds.height).toBeCloseTo(28, 0);
      expect(tickBounds.y + tickBounds.height).toBeCloseTo(
        headerBounds.y + headerBounds.height + 24,
        0,
      );
      expect(headerBounds.height).toBeCloseTo(32, 0);
      await expect(navigation).toHaveCSS("padding-left", `${gutter}px`);
      await expect(navigation).toHaveCSS("padding-right", `${gutter}px`);
      if (width - 2 * gutter <= 915) {
        await expect(innerTicks).toBeHidden();
      } else {
        await expect(innerTicks).toBeVisible();
        const innerBounds = (await innerTicks.boundingBox())!;
        expect(innerBounds.x).toBeCloseTo((width - 913) / 2, 0);
        expect(innerBounds.width).toBeCloseTo(913, 0);
        expect(innerBounds.y).toBeCloseTo(
          headerBounds.y + headerBounds.height,
          0,
        );
        expect(innerBounds.height).toBeCloseTo(12, 0);
        if (path === "/portfolio") {
          const contentBounds = (await page
            .locator("[data-about-introduction]")
            .locator("..")
            .boundingBox())!;
          expect(innerBounds.x).toBeCloseTo(contentBounds.x, 0);
          expect(innerBounds.width).toBeCloseTo(contentBounds.width, 0);
        }
      }
      expect(await page.evaluate(() => document.body.scrollWidth)).toBe(width);
      await expect(
        header.getByRole("link", { name: "Dexter Young" }),
      ).toBeVisible();
    }
  }
});

test("project browsing omits per-project number labels", async ({
  page,
}, info) => {
  await page.goto("/portfolio");
  const labels =
    info.project.name === "mobile"
      ? page.locator('button[aria-controls$="-preview"]')
      : page.locator(".project-mini-view-info");
  await expect(labels).toHaveCount(browserProjects.length);
  await expect(labels.getByText(/^\d{2}$/)).toHaveCount(0);
});

test("mobile project previews include their stack and short description", async ({
  page,
}) => {
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/portfolio");
    for (const project of browserProjects) {
      const toggle = page.getByRole("button", {
        name: project.title,
        exact: true,
      });
      if ((await toggle.getAttribute("aria-expanded")) !== "true") {
        await toggle.click();
      }
      const panel = page.locator(
        `#${await toggle.getAttribute("aria-controls")}`,
      );
      await expect(panel.locator("p")).toHaveText([
        project.technologies.join(" · "),
        project.summary,
      ]);
      for (const paragraph of await panel.locator("p").all()) {
        await expect(paragraph).toBeVisible();
        expect(
          await paragraph.evaluate(
            (element) => element.scrollWidth <= element.clientWidth,
          ),
        ).toBe(true);
      }
    }
    expect(await page.evaluate(() => document.body.scrollWidth)).toBe(width);
  }
});

test("launch experience is primary and owns the outgoing arrow", async ({
  page,
}) => {
  await page.goto("/portfolio#project-photo-graph");
  const focusView = page.getByRole("region", {
    name: "Photo Node-Gallery focus view",
  });
  const writeUp = focusView.getByRole("link", {
    name: "write up",
    exact: true,
  });
  const experience = focusView.getByRole("link", {
    name: "Launch experience",
  });

  await expect(writeUp).toHaveClass(/\bbg-transparent\b/);
  await expect(writeUp.locator("svg")).toHaveCount(0);
  await expect(writeUp).toHaveAttribute("href", "/write-ups/photo-graph");
  await expect(
    focusView.getByRole("group", {
      name: "Photo Node-Gallery preview controls",
    }),
  ).toHaveCount(0);
  await expect(experience).toHaveClass(/\bbg-ink\b/);
  await expect(experience.locator("svg")).toHaveCount(1);
  await expect(experience).toHaveAttribute(
    "href",
    "/projects/photo-graph/experience",
  );
});

test("Elliot's source precedes its write-up and the overview preview is scaled to 85%", async ({
  page,
}) => {
  await page.goto("/portfolio#project-elliotmairet");
  const focus = page.getByRole("region", { name: "Elliot Mairet focus view" });
  const source = focus.getByRole("link", { name: "View source", exact: true });
  const actions = source.locator("..");
  await expect(actions.getByRole("link")).toHaveText([
    "View source",
    "write up",
    "Launch experience",
  ]);
  const iframe = page.locator(
    '.project-focus-preview--current iframe[title="Elliot Mairet preview"]',
  );
  await expect(iframe).toHaveCSS("transform", "matrix(0.85, 0, 0, 0.85, 0, 0)");
  if (page.viewportSize()!.width >= 640) {
    const sourceBounds = await source.boundingBox();
    const writeUpBounds = await focus
      .getByRole("link", { name: "write up", exact: true })
      .boundingBox();
    expect(sourceBounds!.x + sourceBounds!.width).toBeLessThanOrEqual(
      writeUpBounds!.x,
    );
  }
});

test("the contact hover sweep uses the panel's white in dark mode", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/portfolio#contact");
  const link = page.locator("#contact").getByRole("link", { name: /GitHub/ });
  const sweep = link.locator('span[aria-hidden="true"]').first();
  await expect(sweep).toHaveCSS("background-color", "rgb(235, 235, 235)");
  await link.focus();
  await expect(link).toBeFocused();
  await expect(sweep).toHaveCSS(
    "transform",
    /^(none|matrix\(1, 0, 0, 1, 0, 0\))$/,
  );
});

test("About pairs the introduction with every write-up in a scrollable disclosure list", async ({
  page,
}, info) => {
  await page.goto("/portfolio#about");
  const about = page.getByRole("region", { name: "About", exact: true });
  await expect(about.getByRole("heading", { name: "About" })).toBeVisible();
  const introduction = about.locator("[data-about-introduction]");
  await expect(introduction.locator("p")).toHaveCount(3);
  await expect(introduction).toContainText("McGill");
  await expect(introduction).toContainText("As Technical Director");
  const writeUpsHeading = about.getByRole("heading", {
    name: "Write ups",
    level: 3,
  });
  await expect(writeUpsHeading).toBeVisible();
  await expect(writeUpsHeading).toHaveCSS("text-transform", "uppercase");
  await expect(writeUpsHeading.locator("..")).toHaveCSS("text-align", "center");
  const navigation = about.getByRole("navigation", {
    name: "Project write-ups",
  });
  const projects = projectCatalog.filter((project) => project.writeUpHref);
  const links = navigation.getByRole("link");
  await expect(links).toHaveCount(projects.length);
  await expect(links).toHaveText(projects.map((project) => project.title));
  await expect(links.first()).toHaveCSS("justify-content", "flex-end");
  await expect(links.first()).toHaveCSS("text-align", "right");
  for (const [index, project] of projects.entries()) {
    await expect(links.nth(index)).toHaveAttribute(
      "href",
      project.writeUpHref!,
    );
    await expect(links.nth(index)).toContainText(project.title);
  }
  const paragraph = await introduction.boundingBox();
  const frame = about.locator("[data-write-up-frame]");
  const list = await frame.boundingBox();
  const panel = navigation.locator("..");
  const panelBounds = (await panel.boundingBox())!;
  const heading = (await writeUpsHeading.boundingBox())!;
  expect(
    Math.abs(heading.x + heading.width / 2 - list!.x - list!.width / 2),
  ).toBeLessThan(1);
  expect(Math.abs(heading.y + heading.height / 2 - panelBounds.y)).toBeLessThan(
    1,
  );
  await expect(panel).toHaveCSS("outline-width", "1px");
  await expect(navigation).toHaveCSS("border-top-width", "0px");
  await expect(frame.locator(':scope > span[aria-hidden="true"]')).toHaveCount(
    4,
  );
  const canvasColor = await page
    .locator("main")
    .evaluate((element) => getComputedStyle(element).backgroundColor);
  await expect(writeUpsHeading.locator("..")).toHaveCSS(
    "background-color",
    canvasColor,
  );
  await expect(page.locator("#contact [data-border-label]")).toHaveCount(0);
  await expect(
    page.locator("h1").locator("..").locator("[data-border-label]"),
  ).toHaveCount(0);
  if (info.project.name === "desktop") {
    expect(paragraph!.x + paragraph!.width).toBeLessThan(list!.x);
    expect(Math.abs(paragraph!.width - list!.width)).toBeLessThan(2);
    expect(Math.abs(paragraph!.y - list!.y)).toBeLessThan(2);
    expect(Math.abs(paragraph!.height - list!.height)).toBeLessThan(2);
  } else {
    expect(paragraph!.y + paragraph!.height).toBeLessThan(list!.y);
    await expect(navigation).toHaveCSS("height", "256px");
    const listBounds = (await navigation.boundingBox())!;
    const contactHeading = (await page
      .getByRole("heading", { name: "Contact", exact: true })
      .boundingBox())!;
    expect(
      contactHeading.y - listBounds.y - listBounds.height,
    ).toBeGreaterThanOrEqual(96);
  }
  const writeUpRow = await links.first().boundingBox();
  const contactRow = await page.locator("#contact a").first().boundingBox();
  expect(writeUpRow!.height).toBeCloseTo(contactRow!.height, 0);
  await expect(links.first()).toHaveCSS("padding-top", "0px");
  await expect(links.first()).toHaveCSS("padding-bottom", "0px");
  await expect(navigation).toHaveCSS("overflow-y", "auto");
  const hasOverflow = await navigation.evaluate(
    (element) => element.scrollHeight > element.clientHeight,
  );
  await navigation.focus();
  await expect(navigation).toBeFocused();
  if (hasOverflow) {
    const labelBeforeScroll = (await writeUpsHeading.boundingBox())!;
    await page.keyboard.press("End");
    await expect
      .poll(() => navigation.evaluate((element) => element.scrollTop))
      .toBeGreaterThan(0);
    const labelAfterScroll = (await writeUpsHeading.boundingBox())!;
    expect(labelAfterScroll.y).toBeCloseTo(labelBeforeScroll.y, 0);
  }
  await links.last().focus();
  await expect(links.last()).toBeInViewport();
  const lastRow = navigation.locator(
    `[data-write-up-id="${projects.at(-1)!.id}"]`,
  );
  await expect(lastRow.getByRole("link")).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await expect(
    lastRow.getByText(projects.at(-1)!.summary, { exact: true }),
  ).toBeVisible();
  await expect(lastRow.locator("p")).toHaveCSS("text-align", "left");
  await expect(lastRow).toHaveCSS("border-bottom-width", "0px");
  await expect(navigation.locator('[class*="mix-blend"]')).toHaveCount(0);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new RegExp(`${projects.at(-1)!.writeUpHref}$`));
});

test("write-up synopses expand on hover, keyboard focus and touch without losing title links", async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/portfolio#about");
  const navigation = page.getByRole("navigation", {
    name: "Project write-ups",
  });
  const projects = projectCatalog.filter((project) => project.writeUpHref);
  const first = navigation.locator(`[data-write-up-id="${projects[0].id}"]`);
  const second = navigation.locator(`[data-write-up-id="${projects[1].id}"]`);
  await expect(navigation.locator("svg, button")).toHaveCount(0);
  if (info.project.name === "mobile") {
    await first.getByRole("link").tap();
  } else {
    await first.getByRole("link").hover();
  }
  await expect(first.getByRole("link")).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await expect(
    first.getByText(projects[0].summary, { exact: true }),
  ).toBeVisible();
  await expect(first.getByRole("link")).toHaveAttribute(
    "href",
    projects[0].writeUpHref!,
  );
  if (info.project.name === "mobile") {
    await second.getByRole("link").tap();
  } else {
    await second.getByRole("link").hover();
  }
  await expect(first.getByRole("link")).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  await expect(second.getByRole("link")).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await expect
    .poll(() =>
      second
        .locator('[id^="write-up-synopsis-"]')
        .evaluate(
          (element) =>
            Math.abs(element.clientHeight - element.scrollHeight) < 1,
        ),
    )
    .toBe(true);
  await expect(navigation.locator('a[aria-expanded="true"]')).toHaveCount(1);
  if (info.project.name === "desktop") {
    // Animated rows must not keep sending hover events during keyboard checks.
    await page.mouse.move(0, 0);
  }
  await navigation.focus();
  await page.keyboard.press("Tab");
  await expect(first.getByRole("link")).toBeFocused();
  await expect(first.getByRole("link")).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await first.getByRole("link").press("Space");
  await expect(first.getByRole("link")).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  if (info.project.name === "mobile") {
    await first.getByRole("link").tap();
    await expect(page).toHaveURL(/\/portfolio#about$/);
    await expect(first.getByRole("link")).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    await first.getByRole("link").tap();
  } else {
    await first.getByRole("link").press("Enter");
  }
  await expect(page).toHaveURL(new RegExp(`${projects[0].writeUpHref}$`));
});

test("keyboard close restores the originating project after changing projects", async ({
  page,
}, info) => {
  await page.goto("/portfolio");
  const mobile = info.project.name === "mobile";
  if (mobile)
    await page
      .getByRole("button", { name: "Photo Node-Gallery", exact: true })
      .click();
  const trigger = page.getByRole("button", {
    name: mobile
      ? "Open Photo Node-Gallery focus view"
      : "Show Photo Node-Gallery in focus view",
    exact: true,
  });
  await trigger.focus();
  await trigger.press("Enter");
  const focusView = page.getByRole("region", {
    name: "Photo Node-Gallery focus view",
  });
  await expect(focusView).toBeFocused();
  await focusView.press("ArrowRight");
  const nextProject =
    browserProjects[
      (browserProjects.findIndex((project) => project.id === "photo-graph") +
        1) %
        browserProjects.length
    ];
  await expect(page).toHaveURL(new RegExp(`#project-${nextProject.id}$`));
  await page
    .getByRole("region", { name: `${nextProject.title} focus view` })
    .press("Escape");
  await expect(trigger).toBeFocused();
});

test("back and forward synchronize the focus view and restore focus", async ({
  page,
}, info) => {
  await page.goto("/portfolio");
  if (info.project.name === "mobile")
    await page
      .getByRole("button", { name: "Photo Node-Gallery", exact: true })
      .click();
  const trigger = page.getByRole("button", {
    name:
      info.project.name === "mobile"
        ? "Open Photo Node-Gallery focus view"
        : "Show Photo Node-Gallery in focus view",
    exact: true,
  });
  await trigger.focus();
  await trigger.press("Enter");
  await expect(page).toHaveURL(/#project-photo-graph$/);
  await page.goBack();
  await expect(trigger).toBeFocused();
  await page.goForward();
  await expect(
    page.getByRole("region", { name: "Photo Node-Gallery focus view" }),
  ).toBeFocused();
});

test("deep links open the right project and reject messages from the wrong frame", async ({
  page,
}) => {
  await page.goto("/portfolio#project-elliotmairet");
  await expect(
    page.getByRole("heading", { name: "Elliot Mairet", exact: true }),
  ).toBeVisible();
  await page.evaluate(() =>
    window.postMessage(
      {
        source: "dextery-preview-navigation",
        type: "open-link",
        href: "https://example.test/untrusted",
      },
      "*",
    ),
  );
  await expect(page).toHaveURL(/#project-elliotmairet$/);
  const currentFrame = page
    .locator(".project-focus-preview--current")
    .frameLocator('iframe[title="Elliot Mairet preview"]');
  await currentFrame.getByRole("button", { name: "Open photograph" }).click();
  await expect(page).toHaveURL("https://elliotmairet.com/photos/test");
});

test("mobile accordion opens another project and close restores its trigger", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "mobile", "Mobile project table only");
  await page.goto("/portfolio");
  const row = page.getByRole("button", { name: "bur1alrites", exact: true });
  await row.click();
  await expect(row).toHaveAttribute("aria-expanded", "true");
  const trigger = page.getByRole("button", {
    name: "Open bur1alrites focus view",
    exact: true,
  });
  await trigger.click();
  await page.getByRole("button", { name: "Close project focus" }).focus();
  await page
    .getByRole("button", { name: "Close project focus" })
    .press("Enter");
  await expect(trigger).toBeFocused();
});

test("closing a later desktop project restores visible keyboard focus", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop", "Desktop rail only");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/portfolio");
  const trigger = page.getByRole("button", {
    name: "Show nepobabiesruntheunderground in focus view",
    exact: true,
  });
  await trigger.focus();
  await trigger.press("Enter");
  await expect(
    page.getByRole("region", {
      name: "nepobabiesruntheunderground focus view",
    }),
  ).toBeFocused();
  await page
    .getByRole("region", { name: "nepobabiesruntheunderground focus view" })
    .press("Escape");
  await expect(trigger).toBeFocused();
  await expect(trigger).toBeInViewport({ ratio: 0.5 });
});
