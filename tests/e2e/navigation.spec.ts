import { expect, test, type Page } from "@playwright/test";
import {
  browserProjects,
  projectCatalog,
} from "../../app/components/projects/project-catalog";
import {
  LEGACY_WRITE_UP_REDIRECTS,
  PROJECT_ROUTES,
} from "../../app/components/projects/project-routes";

const writeUps = browserProjects.filter((project) => project.writeUpHref);

test.beforeEach(async ({ context }) => {
  await context.route("https://**/*", (route) =>
    route.request().resourceType() === "document"
      ? route.fulfill({
          contentType: "text/html",
          body: "<p>Project preview</p>",
        })
      : route.abort(),
  );
  await context.route("**/api/photo-graph/graph", (route) =>
    route.fulfill({ json: { nodes: [], links: [] } }),
  );
});

async function expectHome(page: Page) {
  await expect(page).toHaveURL(/\/portfolio$/);
  await expect(page.locator(".project-focus-view")).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
}

async function expectSection(page: Page, id: string) {
  await expect(page).toHaveURL(new RegExp(`#${id}$`));
  await expect(page.locator(".project-focus-view")).toHaveCount(0);
  await expect(page.locator(`#${id}`)).toHaveCSS("outline-style", "none");
  await expect
    .poll(() =>
      page.locator(`#${id}`).evaluate((element) => {
        const top = element.getBoundingClientRect().top + window.scrollY;
        const margin = parseFloat(getComputedStyle(element).scrollMarginTop);
        const max = document.documentElement.scrollHeight - window.innerHeight;
        return Math.abs(
          window.scrollY - Math.min(max, Math.max(0, top - margin)),
        );
      }),
    )
    .toBeLessThan(2);
}

test("article return links do not highlight section targets", async ({
  page,
}) => {
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme });
    for (const [article, label, target] of [
      ["tvm-discord-bot", "Back to projects", "about"],
      ["elliot-mairet", "Index", "projects"],
    ]) {
      await page.goto(`/write-ups/${article}`);
      const link = page.getByRole("link", { name: label, exact: true });
      await link.focus();
      await link.press("Enter");
      await expectSection(page, target);
      const section = page.locator(`#${target}`);
      await section.focus();
      await expect(section).toBeFocused();
      await expect(section).toHaveCSS("outline-style", "none");
    }
    const about = page
      .getByRole("navigation", { name: "Site navigation" })
      .getByRole("link", { name: "About", exact: true });
    await about.focus();
    await expect(about).toHaveCSS("outline-style", "solid");
    await expect(about).toHaveCSS("outline-width", "2px");
  }
});

test("the home brand resets project focus, section scroll, and history", async ({
  page,
}) => {
  for (const hash of ["", "#about", "#contact", "#project-elliotmairet"]) {
    await page.goto(`/portfolio${hash}`);
    if (!hash)
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    if (hash.startsWith("#project-"))
      await expect(page.locator(".project-focus-view")).toBeVisible();
    await page
      .getByRole("navigation", { name: "Site navigation" })
      .getByRole("link", { name: "Dexter Young", exact: true })
      .click();
    await expectHome(page);
    if (!hash) continue;
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`${hash}$`));
    if (hash.startsWith("#project-"))
      await expect(page.locator(".project-focus-view")).toBeVisible();
    await page.goForward();
    await expectHome(page);
  }
});

test("directory home and projects links reset the focused homepage", async ({
  page,
}, info) => {
  test.skip(info.project.name === "mobile", "Directory is desktop-only");
  for (const label of ["portfolio", "projects"]) {
    await page.goto("/portfolio#project-elliotmairet");
    await expect(page.locator(".project-focus-view")).toBeVisible();
    await page
      .locator('[aria-label="Directory"]')
      .getByRole("link", { name: label, exact: true })
      .click();
    if (label === "portfolio") await expectHome(page);
    else await expectSection(page, "projects");
  }
});

for (const reducedMotion of ["reduce", "no-preference"] as const) {
  test(`section links leave project focus at the requested section with ${reducedMotion} motion`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion });
    for (const label of ["About", "Contact"]) {
      await page.goto("/portfolio#project-elliotmairet");
      await expect(page.locator(".project-focus-view")).toBeVisible();
      await page
        .getByRole("navigation", { name: "Site navigation" })
        .getByRole("link", { name: label, exact: true })
        .click();
      await expectSection(page, label.toLowerCase());
      await page.goBack();
      await expect(page).toHaveURL(/#project-elliotmairet$/);
      await expect(page.locator(".project-focus-view")).toBeVisible();
    }
  });
}

for (const project of writeUps) {
  test(`${project.title} write-up returns to its project, the index, and home`, async ({
    page,
  }) => {
    await page.goto(`/portfolio#project-${project.id}`);
    await page
      .getByRole("region", { name: `${project.title} focus view` })
      .getByRole("link", { name: "write up", exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`${project.writeUpHref}$`));
    await page
      .getByRole("link", { name: "Back to projects", exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`#project-${project.id}$`));
    await expect(
      page.getByRole("region", { name: `${project.title} focus view` }),
    ).toBeVisible();
    await page
      .getByRole("region", { name: `${project.title} focus view` })
      .getByRole("link", { name: "write up", exact: true })
      .click();
    await page.getByRole("link", { name: "Index", exact: true }).click();
    await expectSection(page, "projects");
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`${project.writeUpHref}$`));
    await page
      .getByRole("link", { name: "Dexter Young", exact: true })
      .press("Enter");
    await expectHome(page);
  });
}

test("keyboard section links preserve their destination after opening a rail project", async ({
  page,
}, info) => {
  for (const label of ["About", "Contact"]) {
    await page.goto("/portfolio#projects");
    if (info.project.name === "mobile") {
      const accordion = page.getByRole("button", {
        name: "Photo Node-Gallery",
        exact: true,
      });
      if ((await accordion.getAttribute("aria-expanded")) !== "true")
        await accordion.click();
    }
    const trigger = page.getByRole("button", {
      name:
        info.project.name === "mobile"
          ? "Open Photo Node-Gallery focus view"
          : "Show Photo Node-Gallery in focus view",
      exact: true,
    });
    await trigger.focus();
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    await trigger.press("Enter");
    await expect(page.locator(".project-focus-view")).toBeFocused();
    await page
      .getByRole("navigation", { name: "Site navigation" })
      .getByRole("link", { name: label, exact: true })
      .press("Enter");
    await expectSection(page, label.toLowerCase());
    await page.keyboard.press("Tab");
    if (label === "About")
      await expect(
        page.getByRole("navigation", { name: "Project write-ups" }),
      ).toBeFocused();
    else
      await expect(
        page.locator("#contact").getByRole("link", { name: /GitHub/ }),
      ).toBeFocused();
    await page.goBack();
    await expect(page).toHaveURL(/#project-photo-graph$/);
    await expect(page.locator(".project-focus-view")).toBeFocused();
    await page.goForward();
    await expectSection(page, label.toLowerCase());
  }
});

test("Grailed Plus header and footer return to a reset homepage", async ({
  page,
}) => {
  for (const selector of ["header", "footer"]) {
    await page.goto("/portfolio#project-grailed-plus");
    await page
      .getByRole("region", { name: "Grailed Plus focus view" })
      .getByRole("link", { name: "Launch experience", exact: true })
      .click();
    await expect(page).toHaveURL(/\/grailed-plus$/);
    await page
      .locator(selector)
      .getByRole("link", { name: "dextery.dev", exact: true })
      .click();
    await expectHome(page);
  }
});

test("Grailed Plus experience has a return link to its case study", async ({
  page,
}) => {
  await page.goto("/grailed-plus/experience");
  const returnLink = page.getByRole("link", {
    name: "Return to Grailed Plus case study",
    exact: true,
  });
  await expect(returnLink).toHaveText("Return to Grailed Plus case study");
  await returnLink.click();
  await expect(page).toHaveURL(/\/write-ups\/grailed-plus$/);
});

for (const reducedMotion of ["reduce", "no-preference"] as const) {
  test(`Grailed Plus feature links reach their sections with ${reducedMotion} motion`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion });
    for (const label of [
      "Explore features",
      "Market compare",
      "Price intelligence",
      "Custom currency",
      "Dark mode",
    ]) {
      await page.goto("/grailed-plus");
      const link = page.getByRole("link", { name: label, exact: true });
      const hash = await link.getAttribute("href");
      await link.click();
      await expectSection(page, hash!.slice(1));
    }
  });
}

test("every Grailed Plus install link reaches the store without real tracking requests", async ({
  page,
  context,
}) => {
  await context.route("**/api/marketing/grailed-plus-redirect", (route) =>
    route.fulfill({ status: 202, json: { ok: true } }),
  );
  await page.goto("/portfolio");
  for (let index = 0; index < 3; index++) {
    await page.goto("/grailed-plus");
    const links = page.locator(
      `a[href="${PROJECT_ROUTES.grailedPlusChromeWebStore}"]`,
    );
    await expect(links).toHaveCount(3);
    await links.nth(index).click();
    await expect(page).toHaveURL(PROJECT_ROUTES.grailedPlusChromeWebStore);
    await page.goBack();
    await expect(page).toHaveURL(/\/grailed-plus$/);
    await expect(links.nth(index)).toHaveAttribute("aria-busy", "false");
  }
});

test("Grailed Plus overview preview links open the full product destination", async ({
  page,
}, info) => {
  await page.goto("/portfolio#project-grailed-plus");
  if (info.project.name === "mobile") {
    await page
      .getByRole("link", {
        name: "Open the full Grailed Plus site",
        exact: true,
      })
      .click();
    await expect(page).toHaveURL(/\/grailed-plus$/);
  } else {
    await expect(
      page.locator('iframe[title="Grailed Plus product hero preview"]'),
    ).toHaveAttribute("data-preview-navigation-ready", "true");
    await page
      .frameLocator('iframe[title="Grailed Plus product hero preview"]')
      .getByRole("link", { name: "Price intelligence", exact: true })
      .click();
    await expect(page).toHaveURL(/\/grailed-plus#feature-pricing$/);
    await expectSection(page, "feature-pricing");
  }
});

test("a cached Grailed Plus page re-enables install links when restored", async ({
  page,
  context,
}) => {
  let trackingRequests = 0;
  await context.route("**/api/marketing/grailed-plus-redirect", (route) => {
    trackingRequests++;
    return route.fulfill({ status: 202, json: { ok: true } });
  });
  await page.clock.install();
  await page.goto("/grailed-plus");
  await expect(page.locator("main > header > span[aria-hidden]")).toHaveCSS(
    "transform",
    /^(none|matrix\(1, 0, 0, 1, 0, 0\))$/,
  );
  // Routing disables real bfcache. Reproduce restoration, retrying, and late
  // Ads callbacks locally; no real store or tracking request is sent.
  const attempts = await page.evaluate((href) => {
    const callbacks: Array<() => void> = [];
    window.gtag = (...args: unknown[]) => {
      if (args[0] === "event" && args[1] === "conversion") {
        callbacks.push(
          (args[2] as { event_callback: () => void }).event_callback,
        );
      }
    };
    for (let attempt = 0; attempt < 2; attempt++) {
      document.querySelector<HTMLAnchorElement>(`a[href="${href}"]`)!.click();
      window.dispatchEvent(
        new PageTransitionEvent("pageshow", { persisted: true }),
      );
      callbacks[attempt]?.();
    }
    return callbacks.length;
  }, PROJECT_ROUTES.grailedPlusChromeWebStore);
  expect(attempts).toBe(2);
  await expect.poll(() => trackingRequests).toBe(2);
  await page.clock.fastForward(2000);
  for (const link of await page
    .locator(`a[href="${PROJECT_ROUTES.grailedPlusChromeWebStore}"]`)
    .all()) {
    await expect(link).toHaveAttribute("aria-busy", "false");
    await expect(link).toHaveAttribute("aria-disabled", "false");
  }
  await expect(page).toHaveURL(/\/grailed-plus$/);
});

test("public page links resolve and their section targets exist", async ({
  page,
  request,
}) => {
  const routes = [
    "/portfolio",
    ...projectCatalog.flatMap((project) =>
      project.writeUpHref ? [project.writeUpHref] : [],
    ),
    "/projects/photo-graph/experience",
    "/grailed-plus",
    "/grailed-plus/experience",
  ];
  const targets = new Map<string, Set<string>>();
  const links = new Set<string>();
  for (const path of [
    ...routes,
    ...browserProjects.map((project) => `/portfolio#project-${project.id}`),
  ]) {
    const response = await page.goto(path);
    // Hash-only navigation stays in the document and has no HTTP response.
    if (response) expect(response.ok(), path).toBe(true);
    await expect(page).toHaveURL(new URL(path, page.url()).href);
    if (path.includes("#project-")) {
      const project = projectCatalog.find((project) =>
        path.endsWith(`#project-${project.id}`),
      )!;
      await expect(
        page.getByRole("region", { name: `${project.title} focus view` }),
      ).toBeVisible();
    }
    targets.set(
      new URL(page.url()).pathname,
      new Set(
        await page
          .locator("[id]")
          .evaluateAll((elements) => elements.map((element) => element.id)),
      ),
    );
    for (const href of await page
      .locator("a[href]")
      .evaluateAll((elements) =>
        elements.map((element) => (element as HTMLAnchorElement).href),
      )) {
      const url = new URL(href);
      if (url.origin === new URL(page.url()).origin) links.add(href);
    }
  }
  for (const href of links) {
    const url = new URL(href);
    const response = await request.get(`${url.pathname}${url.search}`);
    expect(response.ok(), href).toBe(true);
    if (!url.hash) continue;
    const id = decodeURIComponent(url.hash.slice(1));
    if (url.pathname === PROJECT_ROUTES.home && id.startsWith("project-")) {
      expect(
        projectCatalog.some((project) => `project-${project.id}` === id),
        href,
      ).toBe(true);
    } else {
      expect(targets.get(url.pathname)?.has(id), href).toBe(true);
    }
  }
});

test("write-ups use their own directory and preserve old article URLs", async ({
  page,
  request,
}, info) => {
  for (const [source, destination] of LEGACY_WRITE_UP_REDIRECTS) {
    const response = await request.get(`${source}?from=legacy`, {
      maxRedirects: 0,
    });
    expect(response.status()).toBe(308);
    expect(response.headers().location).toBe(`${destination}?from=legacy`);
  }
  await page.goto(PROJECT_ROUTES.elliotMairetWriteUp);
  if (info.project.name === "desktop") {
    const directory = page.locator('[aria-label="Directory"]');
    await expect(
      directory.getByRole("link", { name: "write-ups", exact: true }),
    ).toHaveAttribute("href", "/write-ups");
    await directory
      .getByRole("link", { name: "write-ups", exact: true })
      .click();
    await expect(page).toHaveURL(/\/portfolio#about$/);
    await expect(page.locator("#about")).toBeFocused();
  }
  const response = await request.get(PROJECT_ROUTES.photoGraphExperience);
  expect(response.status()).toBe(200);
});
