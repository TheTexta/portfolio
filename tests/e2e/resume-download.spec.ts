import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

test("portfolio keeps its résumé link and serves the current PDF downloads", async ({
  page,
  request,
}) => {
  await page.goto("/portfolio");
  await expect(
    page.locator('#contact a[href="/Dexter_Young_CV.pdf"]'),
  ).toHaveCount(1);

  for (const filename of [
    "Dexter_Young_CV.pdf",
    "Dexter_Young_CV_ml.pdf",
    "Dexter_Young_CV_interactive.pdf",
  ]) {
    const response = await request.get(`/${filename}`);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("application/pdf");
    const downloaded = await response.body();
    expect(downloaded.subarray(0, 5).toString()).toBe("%PDF-");
    expect(downloaded.equals(await readFile(`public/${filename}`))).toBe(true);
  }
});
