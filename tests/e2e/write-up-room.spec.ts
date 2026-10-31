import { expect, test } from "@playwright/test";

// Chromium's headless shell rejects native pointer-lock with WrongDocumentError.
// Keep this real-capability test headed (use xvfb-run on display-less Linux CI).
test.use({ headless: false });

test("bur1alrites' write-up preview preserves native desktop room controls and mobile playback", async ({
  page,
  context,
}, info) => {
  await context.route("https://**/*", (route) => {
    if (new URL(route.request().url()).hostname !== "bur1alrites.vercel.app")
      return route.abort();
    return route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1" /></head><body>
        <button id="clip">Open clip</button><p id="status">Ready</p>
        <dialog id="room" aria-label="Projector room">
          <canvas id="projector" width="320" height="180" tabindex="0" style="display:block;background:#222"></canvas>
          <p id="look">Cursor free</p><p id="walk">Still</p><button id="close">Close room</button>
        </dialog>
        <script>
          const room=document.querySelector('#room');
          const projector=document.querySelector('#projector');
          document.querySelector('#clip').onclick=()=>{
            if(matchMedia('(max-width:767px)').matches) document.querySelector('#status').textContent='Mobile preview playing';
            else room.showModal();
          };
          projector.onclick=()=>projector.requestPointerLock().catch(error=>document.querySelector('#look').textContent=error.name+': '+error.message);
          document.addEventListener('pointerlockchange',()=>document.querySelector('#look').textContent=document.pointerLockElement===projector?'Looking around':'Cursor free');
          document.addEventListener('keydown',event=>{if(event.code==='KeyW' && document.pointerLockElement===projector) document.querySelector('#walk').textContent='Moving forward';});
          document.querySelector('#close').onclick=()=>room.close();
        </script></body></html>`,
    });
  });
  await page.goto("/projects/bur1alrites");
  const preview = page.getByRole("region", {
    name: "bur1alrites interactive preview",
    exact: true,
  });
  const iframe = preview.locator("iframe");
  const frame = preview.frameLocator("iframe");
  await expect(iframe).toHaveAttribute("sandbox", /allow-pointer-lock/);
  await expect(iframe).toHaveAttribute("allow", "autoplay");
  await expect(iframe).toHaveAttribute("referrerpolicy", "no-referrer");
  await expect(frame.getByRole("button", { name: "Open clip" })).toBeVisible();
  const frameWidth = await frame.locator("body").evaluate(() => innerWidth);
  // On macOS the first click in an inactive headed window can only activate it.
  // Establish focus before testing the embedded site's click behavior.
  await page.bringToFront();
  await expect.poll(() => page.evaluate(() => document.hasFocus())).toBe(true);
  if (info.project.name === "mobile") {
    expect(frameWidth).toBeLessThan(768);
    await expect(iframe).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, 0)");
    await frame.getByRole("button", { name: "Open clip" }).click();
    await expect(
      frame.getByText("Mobile preview playing", { exact: true }),
    ).toBeVisible();
    await expect(frame.getByRole("dialog")).not.toBeVisible();
  } else {
    expect(frameWidth).toBeGreaterThanOrEqual(768);
    await expect(iframe).toHaveCSS("transform", "matrix(0.8, 0, 0, 0.8, 0, 0)");
    await frame.getByRole("button", { name: "Open clip" }).click();
    await expect(
      frame.getByRole("dialog", { name: "Projector room" }),
    ).toBeVisible();
    await page.bringToFront();
    await frame.locator("canvas").click();
    await expect(frame.locator("#look")).toHaveText("Looking around");
    await page.keyboard.press("w");
    await expect(
      frame.getByText("Moving forward", { exact: true }),
    ).toBeVisible();
    await frame.locator("body").evaluate(() => document.exitPointerLock());
    await expect(frame.getByText("Cursor free", { exact: true })).toBeVisible();
    await frame.getByRole("button", { name: "Close room" }).focus();
    await page.keyboard.press("Enter");
    await expect(frame.getByRole("dialog")).not.toBeVisible();
    // The media-query subscription must also handle resizing an existing preview.
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(iframe).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, 0)");
    await frame.getByRole("button", { name: "Open clip" }).click();
    await expect(
      frame.getByText("Mobile preview playing", { exact: true }),
    ).toBeVisible();
  }
  await expect(page).toHaveURL(/\/projects\/bur1alrites$/);
});
