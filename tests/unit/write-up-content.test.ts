import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { getProject } from "@/app/components/projects/project-catalog";
import { PROJECT_ROUTES } from "@/app/components/projects/project-routes";

describe("write-up source and contribution copy", () => {
  it("links the TVM case study and its historical evidence to the renamed repository", async () => {
    const source = "https://github.com/TheTexta/discord-shoot-manager";
    const article = await readFile(
      new URL(
        "../../app/write-ups/tvm-discord-bot/write-up.mdx",
        import.meta.url,
      ),
      "utf8",
    );
    expect(PROJECT_ROUTES.tvmDiscordBotGithub).toBe(source);
    expect(getProject("tvm-discord-bot").sourceHref).toBe(source);
    expect(article).toContain("Discord Shoot Manager");
    expect(article).toContain("remains TVM Bot");
    expect(article).not.toContain("github.com/TheTexta/tvm-discord-bot");
    expect(article).toContain(
      `${source}/blob/045de1ed714677147e6a8b74efe57f8619a70dee/`,
    );
    expect(article).toContain(`${source}/actions/runs/40571855904`);
    expect(getProject("tvm-discord-bot").writeUpHref).toBe(
      "/write-ups/tvm-discord-bot",
    );
  });

  it("describes Grailed Plus's authored product work without fork framing or invented percentages", async () => {
    const article = await readFile(
      new URL("../../app/write-ups/grailed-plus/write-up.mdx", import.meta.url),
      "utf8",
    );
    expect(article).toContain("I built Grailed Plus");
    expect(article).not.toMatch(/RVRX|\bfork\b|99\s*%/i);
    expect(getProject("grailed-plus").role).toBe(
      "Design and product development",
    );
    expect(article).toContain("deterministic sample listings");
    expect(article).toContain("not measured latency");
  });
});
