import { expect, test } from "@playwright/test";
import { projectCatalog } from "../../app/components/projects/project-catalog";

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
      "/projects/elliot-mairet",
      "/grailed-plus",
    ]) {
      await page.goto(path);
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

test("project browsing omits per-project number labels", async ({
  page,
}, info) => {
  await page.goto("/portfolio");
  const labels =
    info.project.name === "mobile"
      ? page.locator('button[aria-controls$="-preview"]')
      : page.locator(".project-mini-view-info");
  await expect(labels).toHaveCount(5);
  await expect(labels.getByText(/^\d{2}$/)).toHaveCount(0);
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
  await expect(writeUp).toHaveAttribute("href", "/projects/photo-graph");
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

test("About pairs the introduction with every write-up in a scrollable contact-style list", async ({
  page,
}, info) => {
  await page.goto("/portfolio#about");
  const about = page.getByRole("region", { name: "About", exact: true });
  await expect(about.getByRole("heading", { name: "About" })).toBeVisible();
  await expect(about.locator("p").first()).toContainText("McGill");
  const writeUpsHeading = about.getByText("Write ups", { exact: true });
  await expect(writeUpsHeading).toBeVisible();
  await expect(writeUpsHeading).toHaveCSS("text-transform", "uppercase");
  const writeUpsRules = writeUpsHeading
    .locator("..")
    .locator("span[aria-hidden]");
  await expect(writeUpsRules).toHaveCount(2);
  for (const rule of await writeUpsRules.all())
    await expect(rule).toHaveCSS("height", "1px");
  const navigation = about.getByRole("navigation", {
    name: "Project write-ups",
  });
  const projects = projectCatalog.filter((project) => project.writeUpHref);
  const links = navigation.getByRole("link");
  await expect(links).toHaveCount(projects.length);
  await expect(links).toHaveText(projects.map((project) => project.title));
  for (const [index, project] of projects.entries()) {
    await expect(links.nth(index)).toHaveAttribute(
      "href",
      project.writeUpHref!,
    );
    await expect(links.nth(index)).toContainText(project.title);
  }
  const paragraph = await about.locator("p").first().boundingBox();
  const list = await navigation.locator("..").boundingBox();
  if (info.project.name === "desktop") {
    expect(paragraph!.x + paragraph!.width).toBeLessThan(list!.x);
    expect(Math.abs(paragraph!.width - list!.width)).toBeLessThan(2);
    expect(Math.abs(paragraph!.y - list!.y)).toBeLessThan(2);
    expect(Math.abs(paragraph!.height - list!.height)).toBeLessThan(2);
  } else {
    expect(paragraph!.y + paragraph!.height).toBeLessThan(list!.y);
  }
  const writeUpRow = await links.first().boundingBox();
  const contactRow = await page.locator("#contact a").first().boundingBox();
  expect(writeUpRow!.height).toBeCloseTo(contactRow!.height, 0);
  await expect(links.first()).toHaveCSS("padding-top", "0px");
  await expect(links.first()).toHaveCSS("padding-bottom", "0px");
  expect(
    await navigation.evaluate(
      (element) => element.scrollHeight > element.clientHeight,
    ),
  ).toBe(true);
  await navigation.focus();
  await page.keyboard.press("End");
  await expect
    .poll(() => navigation.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(0);
  await links.last().focus();
  await expect(links.last()).toBeInViewport();
  const contactSweep = page.locator("#contact a span[aria-hidden]").first();
  const writeUpSweep = links.last().locator("span[aria-hidden]");
  await expect(writeUpSweep).toHaveCSS(
    "background-color",
    await contactSweep.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    ),
  );
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new RegExp(`${projects.at(-1)!.writeUpHref}$`));
});

test("keyboard close restores the originating project after changing projects", async ({
  page,
}, info) => {
  await page.goto("/portfolio");
  const mobile = info.project.name === "mobile";
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
  await expect(page).toHaveURL(/#project-elliotmairet$/);
  await page
    .getByRole("region", { name: "Elliot Mairet focus view" })
    .press("Escape");
  await expect(trigger).toBeFocused();
});

test("back and forward synchronize the focus view and restore focus", async ({
  page,
}, info) => {
  await page.goto("/portfolio");
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
