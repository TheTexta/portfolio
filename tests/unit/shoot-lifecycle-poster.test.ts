import { readFile } from "node:fs/promises";
import { imageSize } from "image-size";
import { expect, it } from "vitest";
import { getProject } from "@/app/components/projects/project-catalog";
import { createPageMetadata, PUBLIC_PAGES } from "@/lib/seo";

it("uses the captured lifecycle scene rather than the old chart for sharing", async () => {
  const project = getProject("tvm-discord-bot");
  expect(project.posterSrc).toBe(
    "/projects/tvm-discord-bot/shoot-lifecycle.png",
  );
  const bytes = await readFile(
    new URL(
      "../../public/projects/tvm-discord-bot/shoot-lifecycle.png",
      import.meta.url,
    ),
  );
  expect(imageSize(bytes)).toMatchObject({
    width: project.posterWidth,
    height: project.posterHeight,
    type: "png",
  });
  expect(project.posterAlt).toContain("illustrated member view");
  expect(
    createPageMetadata(PUBLIC_PAGES.tvmDiscordBot).openGraph,
  ).toMatchObject({
    images: [
      expect.objectContaining({
        url: `https://dextery.dev${project.posterSrc}`,
      }),
    ],
  });
});
