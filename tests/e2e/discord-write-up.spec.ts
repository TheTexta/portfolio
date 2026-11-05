import { expect, test } from "@playwright/test";
import { getProject } from "../../app/components/projects/project-catalog";

test("Discord Shoot Manager explains the workflow before recovery and keeps its evidence accessible", async ({
  page,
  context,
}, info) => {
  await context.route("https://**/*", (route) => route.abort());
  await page.goto("/write-ups/tvm-discord-bot");
  const article = page.getByRole("article");
  const header = article.locator("[data-write-up-header]");
  await expect(article.getByRole("heading", { level: 1 })).toHaveText(
    "Discord Shoot Manager",
  );
  await expect(header.locator("[data-write-up-lead]")).toContainText(
    "private production workspaces",
  );
  await expect(header.getByRole("link")).toHaveCount(1);
  await expect(
    header.getByRole("link", { name: "Source and setup" }),
  ).toHaveAttribute(
    "href",
    "https://github.com/TheTexta/discord-shoot-manager",
  );
  await expect(article.getByRole("heading", { level: 2 })).toHaveText([
    "Connecting membership with production",
    "Giving each shoot a lifecycle",
    "Separating management from visibility",
    "Reviewing changes before applying them",
    "Recovering without repeating the original action",
    "Testing the boundaries",
    "From a TVM workflow to a reusable application",
  ]);
  await expect(article.locator("#write-up-content > ol > li")).toHaveCount(3);
  await expect(
    article.locator("#write-up-content > ol > li > strong"),
  ).toHaveText(["Set up.", "Join.", "Archive."]);
  await expect(
    article.getByRole("link", { name: "EmailVerify" }),
  ).toHaveAttribute("href", "https://github.com/lkaesberg/EmailVerify");
  await expect(article.locator("figure")).toHaveCount(1);
  await expect(article.locator("figure [data-shoot-scene]")).toHaveCount(1);
  await expect(article.locator("figure img")).toHaveCount(0);
  await expect(article.locator("figcaption")).toContainText(
    "Illustrated workflow using synthetic members—not a recording",
  );
  await expect(
    article.getByRole("link", { name: "lost-confirmation regression" }),
  ).toHaveAttribute("href", /\/test\/roster-preview\.test\.js#L167$/);
  await expect(
    article.getByRole("link", { name: "historical CI run" }),
  ).toHaveAttribute(
    "href",
    "https://github.com/TheTexta/discord-shoot-manager/actions/runs/40571855904",
  );
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    getProject("tvm-discord-bot").summary,
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://dextery.dev/write-ups/tvm-discord-bot",
  );
  await expect(
    article.getByRole("link", { name: "Back to projects" }),
  ).toHaveAttribute("href", "/portfolio#about");
  await expect(article.locator("p p")).toHaveCount(0);
  if (info.project.name === "mobile") {
    await page.setViewportSize({ width: 320, height: 800 });
  } else {
    await expect(
      page
        .getByRole("navigation", { name: "Table of contents" })
        .locator("[data-contents-section]"),
    ).toHaveCount(7);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    page.viewportSize()!.width,
  );
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: info.outputPath("discord-write-up.png"),
    fullPage: true,
  });
});
