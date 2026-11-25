import { expect, test, type Locator, type Page } from "@playwright/test";
import { THEME_MOBILE_QUERY } from "../../lib/theme";

const experience = "/projects/photo-graph/experience";
const entry = (page: Page) =>
  page.locator("summary", { hasText: "Browse photographs" });
const select = (page: Page) =>
  page.getByLabel("Select a photograph", { exact: true });
const openPhoto = (page: Page) =>
  page.getByRole("button", { name: "Open selected photograph", exact: true });
const inspector = (page: Page) =>
  page.getByRole("dialog", { name: /Inspect photograph/ });

test.beforeEach(async ({ context }) => {
  await context.route("https://**/*", (route) => route.abort());
  await context.route("**/__keyboard-layout.svg*", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="100"><rect width="160" height="100" fill="#c43b2c"/></svg>',
    }),
  );
  await context.route("**/api/photo-graph/graph", (route) =>
    route.fulfill({
      json: {
        nodes: ["first", "related"].map((id) => ({
          id,
          sourceUrl: `/__keyboard-layout.svg?id=${id}`,
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
});

async function settings(page: Page) {
  await page
    .getByRole("button", { name: "Open graph controls", exact: true })
    .click();
}

async function enable3D(page: Page) {
  await settings(page);
  await page.getByRole("checkbox", { name: "3D", exact: true }).check();
  await expect(page.locator('[data-graph-mode="3d"] canvas')).toBeVisible({
    timeout: 30_000,
  });
}

async function expectUncovered(control: Locator) {
  await expect
    .poll(() =>
      control.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        // Check actual painted hit targets, including corners, not just DOM bounds.
        return [
          [bounds.left + 3, bounds.top + 3],
          [bounds.right - 3, bounds.top + 3],
          [bounds.left + 3, bounds.bottom - 3],
          [bounds.right - 3, bounds.bottom - 3],
          [bounds.left + bounds.width / 2, bounds.top + bounds.height / 2],
        ].every(([x, y]) => {
          const target = document.elementFromPoint(x, y);
          return target !== null && element.contains(target);
        });
      }),
    )
    .toBe(true);
}

for (const mode of ["2d", "3d"] as const) {
  test(`${mode}: short both-open settings and browsing retain real pointer and keyboard access`, async ({
    page,
  }, info) => {
    for (const width of [844, 390]) {
      await page.setViewportSize({ width, height: 390 });
      await page.goto(experience);
      await expect(select(page)).toHaveValue("first");
      if (mode === "3d") await enable3D(page);
      else await settings(page);
      await entry(page).click();
      await expect(entry(page).locator("..")).toHaveAttribute("open", "");

      const theme = page.getByRole("checkbox", { name: /^(Light|Dark)$/ });
      const themeRow = theme.locator("..");
      await expectUncovered(themeRow);
      const checked = await theme.isChecked();
      await themeRow.click();
      if (
        await page.evaluate(
          (query) => window.matchMedia(query).matches,
          THEME_MOBILE_QUERY,
        )
      ) {
        // Narrow views intentionally follow the system theme, not manual toggles.
        await expect(theme).toBeChecked({ checked });
        await page.emulateMedia({ colorScheme: checked ? "light" : "dark" });
      }
      await expect(theme).toBeChecked({ checked: !checked });

      const slider = page.getByRole("slider", {
        name: "Repel strength",
        exact: true,
      });
      await slider.focus();
      await expect(slider).toBeFocused();
      const value = Number(await slider.inputValue());
      await page.keyboard.press("ArrowRight");
      await expect(slider).toHaveCSS("outline-style", "solid");
      await expect(slider).toHaveValue(String(value + 1));
      const thumb = await slider.evaluate((element) => {
        const input = element as HTMLInputElement;
        const box = input.getBoundingClientRect();
        const fraction =
          (input.valueAsNumber - Number(input.min)) /
          (Number(input.max) - Number(input.min));
        const x = box.left + 8 + (box.width - 16) * fraction;
        const y = box.top + box.height / 2;
        return { x, y, hit: document.elementFromPoint(x, y) === element };
      });
      expect(thumb.hit).toBe(true);
      await page.mouse.move(thumb.x, thumb.y);
      await page.mouse.down();
      await page.mouse.move(thumb.x + 12, thumb.y, { steps: 4 });
      await page.mouse.up();
      await expect(slider).not.toHaveValue(String(value + 1));

      await entry(page).focus();
      await page.keyboard.press("Tab");
      await expect(select(page)).toBeFocused();
      await expectUncovered(select(page));
      await page.keyboard.type("Photograph related");
      await expect(select(page)).toHaveValue("related");
      await page.keyboard.press("Tab");
      await expect(openPhoto(page)).toBeFocused();
      await expectUncovered(openPhoto(page));
      await page.screenshot({
        path: info.outputPath(`both-open-${mode}-${width}.png`),
      });
      await page.keyboard.press("Enter");
      await expect(inspector(page)).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(inspector(page)).toHaveCount(0);
      await expect(openPhoto(page)).toBeFocused();
      await expectUncovered(openPhoto(page));
    }
  });

  test(`${mode}: resizing an open inspector rejects a connected but scroll-clipped opener`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(experience);
    await expect(select(page)).toHaveValue("first");
    if (mode === "3d") {
      await enable3D(page);
      await page
        .getByRole("button", { name: "Close graph controls", exact: true })
        .click();
    }
    await entry(page).focus();
    await entry(page).press("Enter");
    await openPhoto(page).click();
    await expect(inspector(page)).toBeVisible();
    await page.setViewportSize({ width: 844, height: 320 });
    const clipped = await openPhoto(page).evaluate((element) => {
      const scroll = element
        .closest("details")!
        .querySelector("summary + div")!;
      const bounds = element.getBoundingClientRect();
      const clip = scroll.getBoundingClientRect();
      return {
        connected: element.isConnected,
        clipped: bounds.bottom > clip.bottom,
        scrollTop: scroll.scrollTop,
      };
    });
    expect(clipped.connected).toBe(true);
    expect(clipped.clipped).toBe(true);
    await page.keyboard.press("Escape");
    await expect(inspector(page)).toHaveCount(0);
    await expect(select(page)).toBeFocused();
    await expectUncovered(select(page));
    expect(
      await select(page).evaluate(
        (element) =>
          element.closest("details")!.querySelector("summary + div")!.scrollTop,
      ),
    ).toBe(clipped.scrollTop);
    await page.keyboard.press("Tab");
    await expect(openPhoto(page)).toBeFocused();
    await expectUncovered(openPhoto(page));
  });
}
