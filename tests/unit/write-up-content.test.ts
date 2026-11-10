import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { getProject } from "@/app/components/projects/project-catalog";
import { PROJECT_ROUTES } from "@/app/components/projects/project-routes";
import {
  createPageMetadata,
  createPageStructuredData,
  PUBLIC_PAGES,
} from "@/lib/seo";

describe("write-up source and contribution copy", () => {
  it("names Discord Shoot Manager consistently and preserves its historical evidence and route", async () => {
    const source = "https://github.com/TheTexta/discord-shoot-manager";
    const article = await readFile(
      new URL(
        "../../app/write-ups/tvm-discord-bot/write-up.mdx",
        import.meta.url,
      ),
      "utf8",
    );
    expect(PROJECT_ROUTES.tvmDiscordBotGithub).toBe(source);
    expect(getProject("tvm-discord-bot").title).toBe("Discord Shoot Manager");
    expect(getProject("tvm-discord-bot").sourceHref).toBe(source);
    expect(article).toContain("Discord Shoot Manager");
    expect(article).not.toMatch(/TVM (?:Discord )?Bot/i);
    expect(article).not.toContain("github.com/TheTexta/tvm-discord-bot");
    expect(article).toContain(
      `${source}/blob/045de1ed714677147e6a8b74efe57f8619a70dee/`,
    );
    expect(article).toContain(`${source}/actions/runs/40571855904`);
    expect(getProject("tvm-discord-bot").writeUpHref).toBe(
      "/write-ups/tvm-discord-bot",
    );
  });

  it("uses Discord Shoot Manager in search, sharing and structured metadata", () => {
    const page = PUBLIC_PAGES.tvmDiscordBot;
    const metadata = createPageMetadata(page);
    const title = "Discord Shoot Manager — Dexter Young";
    expect(metadata.title).toBe(title);
    expect(metadata.openGraph).toMatchObject({ title });
    expect(metadata.twitter).toMatchObject({ title });
    expect(page.image.posterAlt).toContain("Discord Shoot Manager");
    expect(createPageStructuredData(page)["@graph"]).toContainEqual(
      expect.objectContaining({
        mainEntity: expect.objectContaining({ name: "Discord Shoot Manager" }),
      }),
    );
  });

  it("introduces the shoot workflow before technical recovery evidence", async () => {
    const article = await readFile(
      new URL(
        "../../app/write-ups/tvm-discord-bot/write-up.mdx",
        import.meta.url,
      ),
      "utf8",
    );
    const header = article.slice(0, article.indexOf("</header>"));
    expect(header).toContain("private production workspaces");
    expect(header).not.toMatch(/Roster recovery tests|CI run/);
    expect(article.match(/^## .+$/gm)).toEqual([
      "## Connecting membership with production",
      "## Giving each shoot a lifecycle",
      "## Separating management from visibility",
      "## Reviewing changes before applying them",
      "## Recovering without repeating the original action",
      "## Testing the boundaries",
      "## From a TVM workflow to a reusable application",
    ]);
    expect(article).toContain("https://github.com/lkaesberg/EmailVerify");
    expect(article).toContain("**Set up.**");
    expect(article).toContain("**Join.**");
    expect(article).toContain("**Archive.**");
    expect(article).toContain("Independently assigned roles remain protected");
    expect(article).toContain("<ShootLifecycle />");
    expect(article.indexOf("<ShootLifecycle />")).toBeLessThan(
      article.indexOf("## Separating management from visibility"),
    );
    expect(article).not.toContain("/projects/posters/tvm-discord-bot.png");
    expect(article).toContain("does not support overlapping replicas");
    expect(article).not.toMatch(/\[Place |\[Use a |TODO/);
  });

  it("distinguishes Grailed Plus's authored comparison work from inherited price history and unmeasured demo claims", async () => {
    const article = await readFile(
      new URL("../../app/write-ups/grailed-plus/write-up.mdx", import.meta.url),
      "utf8",
    );
    const copy = article.replace(/\s+/g, " ");
    expect(copy).toContain(
      "I extended Grailed Plus with cross-market comparison and local image matching",
    );
    expect(copy).toContain(
      "price-history functionality originated in [RVRX/grailed-plus](https://github.com/RVRX/grailed-plus)",
    );
    expect(copy).not.toMatch(/99\s*%/i);
    expect(getProject("grailed-plus").role).toBe(
      "Design and product development",
    );
    expect(copy).toContain("deterministic sample listings");
    expect(copy).toContain("not measured inference latency");
  });
});
