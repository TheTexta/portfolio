import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { projectCatalog } from "@/app/components/projects/project-catalog";
import { PUBLIC_PAGES } from "@/lib/seo";

const resume = JSON.parse(readFileSync("docs/resume/resume.json", "utf8")) as {
  projects: { title: string; href: string }[];
};
const variants = JSON.parse(
  readFileSync("docs/resume/variants.json", "utf8"),
) as Record<string, { title: string; profile: string; projects: string[] }>;

describe("application evidence destinations", () => {
  it("links every CV project to a canonical, catalogued explanation", () => {
    const articlePaths = projectCatalog.flatMap((project) =>
      project.writeUpHref ? [project.writeUpHref] : [],
    );
    const publicPaths = Object.values(PUBLIC_PAGES).map((page) => page.path);
    for (const project of resume.projects) {
      const url = new URL(project.href);
      expect(url.origin).toBe("https://dextery.dev");
      expect(articlePaths).toContain(url.pathname);
      expect(publicPaths).toContain(url.pathname);
    }
  });

  it("selects existing projects without duplicating or fabricating evidence", () => {
    const titles = new Set(resume.projects.map((project) => project.title));
    expect(Object.keys(variants).sort()).toEqual([
      "interactive",
      "ml",
      "software",
    ]);
    for (const variant of Object.values(variants)) {
      expect(new Set(variant.projects).size).toBe(variant.projects.length);
      for (const title of variant.projects)
        expect(titles.has(title)).toBe(true);
      expect(variant.profile).toContain("McGill");
      expect(variant.profile).toContain("Summer 2027");
    }
    expect(variants.software.projects.slice(0, 2)).toEqual([
      "Grailed Plus",
      "TVM Discord Bot",
    ]);
    expect(variants.ml.projects.slice(0, 3)).toEqual([
      "Grailed Plus",
      "Bot or Not",
      "Photo Node-Gallery",
    ]);
    expect(variants.interactive.projects.slice(0, 2)).toEqual([
      "bur1alrites",
      "Photo Node-Gallery",
    ]);
  });
});
