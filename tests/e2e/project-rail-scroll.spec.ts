import { expect, test, type Page } from "@playwright/test";

async function openRail(page: Page) {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.route("https://**/*", (route) => route.abort());
  await page.goto("/portfolio#projects");
  await expect(page.locator(".project-rail")).toBeVisible();
  await page.locator(".project-rail").hover();
}

async function wheel(page: Page, deltaX: number, deltaY = 0, ctrlKey = false) {
  return page.locator(".project-rail").evaluate(
    (rail, options) => {
      const card = rail.querySelectorAll("article")[2];
      const before = card.getBoundingClientRect().left;
      const event = new WheelEvent("wheel", {
        ...options,
        bubbles: true,
        cancelable: true,
      });
      card.dispatchEvent(event);
      return {
        movement: card.getBoundingClientRect().left - before,
        prevented: event.defaultPrevented,
      };
    },
    { deltaX, deltaY, ctrlKey },
  );
}

async function trackX(page: Page) {
  return page.locator(".project-rail-track").evaluate((track) => {
    return new DOMMatrix(getComputedStyle(track).transform).m41;
  });
}

test.describe("desktop project rail scrolling", () => {
  test.beforeEach(({}, info) => {
    test.skip(
      info.project.name !== "desktop",
      "Fine-pointer project rail only",
    );
  });

  test("horizontal gestures move cards directly in both directions, not as a speed boost", async ({
    page,
  }) => {
    await openRail(page);
    const scrollY = await page.evaluate(() => window.scrollY);
    for (const delta of [120, -120]) {
      const result = await wheel(page, delta);
      expect(result.prevented).toBe(true);
      expect(result.movement).toBeCloseTo(-delta, 2);
    }
    expect(await page.evaluate(() => window.scrollY)).toBe(scrollY);

    const before = await trackX(page);
    await page.mouse.wheel(120, 0);
    await expect.poll(() => trackX(page)).toBeLessThan(before - 119);
  });

  test("wraps large swipes in either direction without gaps or duplicate cards", async ({
    page,
  }) => {
    await openRail(page);
    const results = await page.locator(".project-rail").evaluate((rail) => {
      const group = rail.querySelector(".project-rail-group")!;
      const width = group.getBoundingClientRect().width;
      const ids = Array.from(group.children, (card) =>
        card.getAttribute("data-project-id"),
      ).sort();
      return [width * 4 + 100, -width * 7 - 200, width * 3 + 100].map(
        (deltaX) => {
          rail.dispatchEvent(
            new WheelEvent("wheel", {
              deltaX,
              bubbles: true,
              cancelable: true,
            }),
          );
          const bounds = rail.getBoundingClientRect();
          const cards = Array.from(group.children);
          return {
            sameCards:
              JSON.stringify(
                cards
                  .map((card) => card.getAttribute("data-project-id"))
                  .sort(),
              ) === JSON.stringify(ids),
            coversLeft: cards[0].getBoundingClientRect().left <= bounds.left,
            coversRight:
              cards.at(-1)!.getBoundingClientRect().right >= bounds.right,
          };
        },
      );
    });
    for (const result of results) {
      expect(result).toEqual({
        sameCards: true,
        coversLeft: true,
        coversRight: true,
      });
    }
  });

  test("blends back to autoplay at the velocity threshold without adding momentum", async ({
    page,
  }) => {
    await page.clock.install();
    await openRail(page);
    await page.clock.pauseAt(new Date(Date.now() + 1000));
    await page.clock.runFor(3000);
    const animationSpeed = await page
      .locator(".project-rail-group")
      .evaluate((group) =>
        Math.min(
          8,
          Math.max(5, (group.getBoundingClientRect().width / 34) * 0.12),
        ),
      );

    for (const direction of [1, -1]) {
      await wheel(page, direction * 120);
      const manualPosition = await trackX(page);
      await page.clock.runFor(16);
      expect(await trackX(page)).toBeCloseTo(manualPosition, 3);

      let previousContribution = 0;
      // A realistic tail fluctuates around the threshold instead of falling
      // perfectly on every sample. It must not repeatedly interrupt autoplay.
      for (const ratio of [1.125, 1.02, 0.98, 1.18, 0.9, 1.24, 0.7, 0.2]) {
        const delta = direction * animationSpeed * ratio * 0.016;
        const result = await wheel(page, delta);
        expect(Math.abs(result.movement)).toBeLessThanOrEqual(
          Math.abs(delta) + 0.001,
        );
        const beforeFrame = await trackX(page);
        await page.clock.runFor(16);
        const contribution =
          (beforeFrame - (await trackX(page))) / (animationSpeed * 0.016);
        expect(contribution).toBeGreaterThanOrEqual(
          previousContribution - 0.01,
        );
        expect(contribution - previousContribution).toBeLessThan(0.15);
        previousContribution = contribution;
      }
      expect(previousContribution).toBeGreaterThan(0.5);

      await page.clock.runFor(900);
      const automaticPosition = await trackX(page);
      await page.clock.runFor(16);
      expect(automaticPosition - (await trackX(page))).toBeCloseTo(
        animationSpeed * 0.016,
        2,
      );
    }

    // Abruptly ending a gesture must also resume, even without a momentum tail.
    await wheel(page, -120);
    const stoppedPosition = await trackX(page);
    // Allow the missing-sample window plus one render frame at any RAF phase.
    await page.clock.runFor(48);
    expect(await trackX(page)).toBeLessThan(stoppedPosition);
    await page.clock.runFor(1500);
    const resumedPosition = await trackX(page);
    expect(resumedPosition).toBeLessThan(stoppedPosition);
    expect(stoppedPosition - resumedPosition).toBeLessThan(
      animationSpeed * 1.5,
    );
  });

  test("leaves vertical scrolling and pinch zoom alone", async ({ page }) => {
    await openRail(page);
    for (const result of [
      await wheel(page, 0, 120),
      await wheel(page, 2, 120),
      await wheel(page, 120, 0, true),
    ]) {
      expect(result).toEqual({ movement: 0, prevented: false });
    }
    const before = await page.evaluate(() => window.scrollY);
    await page.mouse.wheel(0, 160);
    await expect
      .poll(() => page.evaluate(() => window.scrollY))
      .toBeGreaterThan(before);
  });

  test("a delayed sample does not surrender a continuing sideways gesture", async ({
    page,
  }) => {
    await page.clock.install();
    await openRail(page);
    await page.clock.pauseAt(new Date(Date.now() + 1000));
    await page.clock.runFor(3000);
    const animationSpeed = await page
      .locator(".project-rail-group")
      .evaluate((group) =>
        Math.min(
          8,
          Math.max(5, (group.getBoundingClientRect().width / 34) * 0.12),
        ),
      );
    await wheel(page, 120);
    for (const interval of [16, 16, 32, 16, 16, 16, 16]) {
      await page.clock.runFor(interval);
      const delta = animationSpeed * 1.5 * (interval / 1000);
      expect((await wheel(page, delta)).movement).toBeCloseTo(-delta, 2);
    }
  });

  test("uses the moving autoplay speed when scrolling starts before hover slowdown finishes", async ({
    page,
  }) => {
    await page.clock.install();
    await openRail(page);
    await page.mouse.move(0, 0);
    await page.clock.pauseAt(new Date(Date.now() + 1000));
    await page.clock.runFor(3000);
    const animationSpeed = await page
      .locator(".project-rail-group")
      .evaluate((group) => group.getBoundingClientRect().width / 34);

    await page.locator(".project-rail").hover();
    const delta = (animationSpeed * 1.125) / 60;
    expect((await wheel(page, delta)).movement).toBeCloseTo(-delta, 2);
    const beforeFrame = await trackX(page);
    await page.clock.runFor(16);
    const contribution = beforeFrame - (await trackX(page));
    expect(contribution).toBeGreaterThan(0);
    expect(contribution).toBeLessThan(animationSpeed * 0.5 * 0.016);
  });

  test("preserves keyboard pause and the live reduced-motion fallback", async ({
    page,
  }) => {
    await openRail(page);
    await page.locator(".project-rail [data-project-trigger]").first().focus();
    const position = await trackX(page);
    expect(await wheel(page, 120)).toEqual({ movement: 0, prevented: false });
    await page.waitForTimeout(150);
    expect(await trackX(page)).toBe(position);

    await page.locator(".project-rail [data-project-trigger]").first().blur();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(page.locator(".project-rail-track")).toHaveCSS(
      "transform",
      "none",
    );
    expect(await wheel(page, 120)).toEqual({ movement: 0, prevented: false });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await expect(page.locator(".project-rail-track")).not.toHaveCSS(
      "transform",
      "none",
    );
    expect((await wheel(page, -120)).movement).toBeCloseTo(120, 2);
  });

  test("does not capture gestures in the article's embedded browser example", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.route("https://**/*", (route) => route.abort());
    await page.goto("/write-ups/portfolio-design");
    await expect(page.locator(".project-rail")).toBeVisible();
    expect(await wheel(page, 120)).toEqual({ movement: 0, prevented: false });
  });
});

test("mobile keeps the project accordion rather than an animated scroll rail", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "mobile", "Mobile accordion only");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/portfolio#projects");
  await expect(page.locator(".project-rail")).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Grailed Plus", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".project-rail-track")).toHaveCSS(
    "transform",
    "none",
  );
});
