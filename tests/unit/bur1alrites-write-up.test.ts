import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const article = await readFile(
  new URL("../../app/write-ups/bur1alrites/write-up.mdx", import.meta.url),
  "utf8",
);

describe("bur1alrites write-up", () => {
  it("centres the visual implementation before resource management", () => {
    expect(article.match(/^## .+$/gm)).toEqual([
      "## Translating Allie's work into a website",
      "## Building the reactive scene",
      "## Presenting video spatially",
      "## Managing video and rendering costs",
      "## Publishing and maintaining the work",
    ]);
    expect(article.match(/^### .+$/gm)).toEqual([
      "### Playback lifecycle checks",
      "### Adaptive scene quality",
    ]);
    expect(article).toContain("automated media-processing pipeline");
    expect(article).not.toContain("automated playback pipeline");
  });

  it("places the inspection beside the reactive explanation and preserves the public screenshot sequence", () => {
    const figures = [...article.matchAll(/<Figure\s+[\s\S]*?\/>/g)].map(
      (match) => ({
        source: match[0].match(/src="([^"]+)"/)![1],
        position: match.index,
      }),
    );
    expect(figures.map(({ source }) => source)).toEqual(
      ["hero", "scene-inspection", "gallery", "projector"].map(
        (name) => `/projects/bur1alrites/write-up/${name}.webp`,
      ),
    );
    const reactiveSection = article.indexOf("## Building the reactive scene");
    const spatialSection = article.indexOf("## Presenting video spatially");
    const costSection = article.indexOf(
      "## Managing video and rendering costs",
    );
    expect(figures[0].position).toBeLessThan(reactiveSection);
    expect(figures[1].position).toBeGreaterThan(reactiveSection);
    expect(figures[1].position).toBeLessThan(spatialSection);
    for (const figure of figures.slice(2)) {
      expect(figure.position).toBeGreaterThan(spatialSection);
      expect(figure.position).toBeLessThan(costSection);
    }
    expect(article).toContain("Local inspection with wireframe");
    expect(article).toContain('<ProjectPreview projectId="bur1alrites" />');
  });

  it("explains the combined inputs and distinguishes mobile playback and the flat room screen", () => {
    const prose = article.replace(/\s+/g, " ");
    expect(prose).toContain("linear-light luminance");
    expect(prose).toContain("highlights lift while dark areas stay flat");
    expect(prose).toContain("raycast the pointer onto the video plane");
    expect(prose).toContain(
      "Both effects multiply the brightness-driven displacement",
    );
    expect(prose).toContain(
      "Unlike the reactive background, its screen stays flat",
    );
    expect(prose).toContain("8 × 8 image");
    expect(prose).toContain("Tapping a clip plays or pauses it inline");
    expect(prose).toContain(
      "the active preview is the hovered or keyboard-focused card",
    );
    expect(prose).not.toContain("it does not restore lost image detail");
  });

  it("retains pinned lifecycle evidence and closes on ownership rather than performance caveats", () => {
    const source =
      "https://github.com/TheTexta/bur1alrites/blob/33591fd36f586567a7d7ac058bf8bac9047d73a5";
    for (const path of [
      "src/lib/viewport-video-pool.ts",
      "src/lib/viewport-video-pool.test.ts",
      "src/app/scene-quality-controller.ts",
      "src/app/scene-quality-controller.test.ts",
    ]) {
      expect(article).toContain(`${source}/${path}`);
    }
    const ending = article.slice(article.lastIndexOf("\n\n")).trim();
    expect(ending).toContain("first Three.js project");
    expect(ending).toContain("when it could play and when to release it");
    expect(ending).not.toMatch(/pinned|measurements|performance claim/);
  });
});
