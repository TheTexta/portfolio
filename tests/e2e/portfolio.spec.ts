import { expect, test } from "@playwright/test";

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
  const row = page.getByRole("button", { name: "bur1alrites 03", exact: true });
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
