import { expect, test, type Locator, type Page } from "@playwright/test";

const previewDocument = `<!doctype html><html><head><style>
  html { overflow: scroll; }
  body { margin: 0; }
  ::-webkit-scrollbar { width: 18px; height: 18px; }
  ::-webkit-scrollbar-track, ::-webkit-scrollbar-thumb { background: red; }
  main { width: 2500px; height: 3000px; background: #222; color: white; }
</style></head><body><main><button>Preview control</button></main><script>
  parent.postMessage({source:"dextery-preview-navigation",type:"ready"},"*");
</script></body></html>`;

test.beforeEach(async ({ context }) => {
  await context.route("https://**/*", (route) =>
    route.request().resourceType() === "document"
      ? route.fulfill({ contentType: "text/html", body: previewDocument })
      : route.abort(),
  );
  await context.route("**/grailed-plus?view=hero", (route) =>
    route.fulfill({ contentType: "text/html", body: previewDocument }),
  );
  await context.route("**/api/photo-graph/graph", (route) =>
    route.fulfill({ json: { nodes: [], links: [] } }),
  );
});

async function expectClippedScrollbars(iframe: Locator) {
  await expect(iframe).toBeVisible();
  await expect(iframe).toHaveAttribute("scrolling", "auto");
  await expect
    .poll(() =>
      iframe.evaluate((element) => {
        const viewport = element.parentElement!;
        const frame = element.getBoundingClientRect();
        const clip = viewport.getBoundingClientRect();
        const scale = frame.width / (element as HTMLIFrameElement).offsetWidth;
        return {
          overflowX: getComputedStyle(viewport).overflowX,
          overflowY: getComputedStyle(viewport).overflowY,
          rightClearance: Math.round((frame.right - clip.right) / scale),
          bottomClearance: Math.round((frame.bottom - clip.bottom) / scale),
        };
      }),
    )
    .toEqual({
      overflowX: "hidden",
      overflowY: "hidden",
      rightClearance: 24,
      bottomClearance: 24,
    });
}

async function scrollPreview(page: Page, iframe: Locator, touch: boolean) {
  await iframe.scrollIntoViewIfNeeded();
  const box = (await iframe.locator("..").boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height * 0.75;
  if (touch) {
    const session = await page.context().newCDPSession(page);
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y }],
    });
    for (let step = 1; step <= 6; step++) {
      await session.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x, y: y - step * 20 }],
      });
    }
    await session.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await session.detach();
  } else {
    await page.mouse.move(x, y);
    await page.mouse.wheel(0, 300);
  }
  const frame = iframe.contentFrame();
  await expect
    .poll(() => frame.locator("body").evaluate(() => window.scrollY))
    .toBeGreaterThan(0);
  const scrollY = await frame.locator("body").evaluate(() => window.scrollY);
  await frame
    .getByRole("button", { name: "Preview control" })
    .evaluate((button) => button.focus({ preventScroll: true }));
  await page.keyboard.press("PageDown");
  await expect
    .poll(() => frame.locator("body").evaluate(() => window.scrollY))
    .toBeGreaterThan(scrollY);
}

for (const slug of ["bur1alrites", "elliot-mairet"]) {
  test(`${slug} write-up clips iframe scrollbars without disabling scrolling`, async ({
    page,
  }, info) => {
    await page.goto(`/write-ups/${slug}`);
    const iframe = page.locator("[data-write-up-preview] iframe");
    await expectClippedScrollbars(iframe);
    await scrollPreview(page, iframe, info.project.name === "mobile");
    await expect(page).toHaveURL(`/write-ups/${slug}`);
  });
}

for (const project of [
  "bur1alrites",
  "elliotmairet",
  "nepobabiesruntheunderground",
  "grailed-plus",
]) {
  test(`${project} project-browser preview clips iframe scrollbars`, async ({
    page,
  }, info) => {
    test.skip(
      project === "grailed-plus" && info.project.name === "mobile",
      "Narrow Grailed Plus previews use a static launch panel, not an iframe",
    );
    await page.goto(`/portfolio#project-${project}`);
    const iframe = page.locator(".project-focus-preview--current iframe");
    await expectClippedScrollbars(iframe);
    await scrollPreview(page, iframe, info.project.name === "mobile");
    await expect(page).toHaveURL(`/portfolio#project-${project}`);
  });
}
