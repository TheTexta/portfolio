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

  it("separates Discord's deployed runtime, later source and fixture request counts", async () => {
    const article = await readFile(
      new URL(
        "../../app/write-ups/tvm-discord-bot/write-up.mdx",
        import.meta.url,
      ),
      "utf8",
    );
    const copy = article.replace(/\s+/g, " ");
    const publishedSource =
      "https://github.com/TheTexta/discord-shoot-manager/blob/6c0349605fc7e444019777eea56dbfb7e176c8d4";
    expect(article).toContain(
      'href="#section-testing-the-boundaries">Evidence and deployment scope',
    );
    expect(article).toContain(
      `${publishedSource}/docs/architecture/persistence-and-recovery.md`,
    );
    expect(article).not.toContain(
      "/blob/main/docs/architecture/persistence-and-recovery.md",
    );
    expect(article).toContain(`${publishedSource}/docs/deployments/tvm.md`);
    expect(copy).toContain("`e06dbf3` as deployed on November 2, 2026");
    expect(copy).toContain("November 18 source update");
    expect(copy).toContain("literal date/time text and invite-only roles");
    expect(copy).toContain("new schedule text appears as entered");
    expect(copy).toContain("not established production enablement");
    expect(article).toContain(
      `${publishedSource}/test/shoot-reliability.test.js#L98`,
    );
    expect(copy).toContain("synthetic 22-participant fixture");
    expect(copy).toContain("from 63 to 21");
    expect(copy).toContain("from 85 to 22");
    expect(copy).toContain(
      "fixture request counts, not measured production latency or operator time saved",
    );
    expect(copy).not.toContain(
      "Scheduled call times appear in each viewer’s local timezone",
    );
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

  it("makes Grailed's private implementation and demo boundaries clear before the technical sections", async () => {
    const article = await readFile(
      new URL("../../app/write-ups/grailed-plus/write-up.mdx", import.meta.url),
      "utf8",
    );
    const opening = article
      .slice(0, article.indexOf("## Combining metadata and image similarity"))
      .replace(/\s+/g, " ");
    expect(opening).toContain("I extended Grailed Plus");
    expect(opening).toContain("packaged worker");
    expect(opening).toContain("separate Node.js gateway");
    expect(opening).toContain(
      "The maintained extension and gateway source is private",
    );
    expect(opening).toContain(
      "not verified feature coverage of the current store package",
    );
    expect(opening).toContain("interactive demos use sample listings");
    expect(opening).toContain("replays recorded worker scores");
    expect(opening).toContain(
      'href="#section-demonstrating-the-product-and-evaluating-the-ranking"',
    );
    expect(opening).not.toContain("View source");

    const copy = article.replace(/\s+/g, " ");
    expect(copy).toContain("Completed image candidates can likewise survive");
    expect(copy).toContain("deadline-truncated results are not cached");
    expect(copy).toContain(
      "does not make the complete comparison workflow local",
    );
    expect(copy).toContain("November 2, 2026 gateway rollout at `4845673`");
    expect(copy).toContain("November 22 local gateway follow-up");
    expect(copy).toContain("offline verification, not deployment acceptance");
    expect(copy).toContain("representative response-size evidence");
    expect(copy).not.toContain("implementation reviewed in October 2026");
  });

  it("clarifies Grailed product provenance and remote processing without claiming store parity", async () => {
    const page = await readFile(
      new URL(
        "../../app/components/projects/grailed-plus/grailed-plus-install-page.tsx",
        import.meta.url,
      ),
      "utf8",
    );
    const copy = page.replace(/\s+/g, " ");
    expect(page).toContain('href="https://github.com/RVRX/grailed-plus"');
    expect(copy).toContain("open-source price-history foundation");
    expect(copy).toContain(
      "The maintained extension and gateway source is private",
    );
    expect(copy).toContain(
      "These sample demos do not verify the installed store version",
    );
    expect(copy).toContain(
      "eBay image search can send listing-image data through the gateway",
    );
  });
});
