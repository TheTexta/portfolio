import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { projectCatalog } from "@/app/components/projects/project-catalog";
import { PUBLIC_PAGES } from "@/lib/seo";

const resume = JSON.parse(readFileSync("docs/resume/resume.json", "utf8")) as {
  name: string;
  contact: { label: string; href?: string }[];
  education: { date: string; subtitle: string };
  experience: { roles: { title: string; date: string }[] };
  projects: { title: string; href: string; bullets: string[] }[];
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
      expect(variant.projects).toHaveLength(4);
      expect(new Set(variant.projects).size).toBe(variant.projects.length);
      for (const title of variant.projects)
        expect(titles.has(title)).toBe(true);
      expect(variant.profile).toContain("McGill");
      expect(variant.profile).toContain("Summer 2027");
      expect(variant.profile).toContain("software engineering internship");
    }
    expect(variants.software.projects).toEqual([
      "Grailed Plus",
      "Discord Shoot Manager",
      "Photo Node-Gallery",
      "Elliot Mairet photography archive",
    ]);
    expect(variants.ml.projects).toEqual([
      "Bot or Not",
      "Grailed Plus",
      "Photo Node-Gallery",
      "Discord Shoot Manager",
    ]);
    expect(variants.interactive.projects).toEqual([
      "bur1alrites",
      "Photo Node-Gallery",
      "Grailed Plus",
      "Discord Shoot Manager",
    ]);
  });

  it("preserves current contact details and owner-confirmed education and TVM progression", () => {
    expect(resume.name).toBe("Dexter Young");
    expect(resume.contact.map((item) => item.label)).toContain(
      "+1 (438) 407-6487",
    );
    expect(resume.education.date).toBe("2024 – June 2028 (expected)");
    expect(resume.education.subtitle).toContain("Music Technology");
    expect(
      resume.experience.roles.map(({ title, date }) => ({ title, date })),
    ).toEqual([
      { title: "Technical Director", date: "June 2026 – Present" },
      { title: "Assistant Technical Director", date: "Mar. – May 2026" },
    ]);
  });

  it("keeps the ML overlap audit visible without reviving historical F1 claims", () => {
    const project = resume.projects.find(({ title }) => title === "Bot or Not");
    expect(project?.bullets).toHaveLength(2);
    expect(project?.bullets[0]).toContain("shard-grouped validation");
    expect(project?.bullets[0]).toContain("language-specific thresholds");
    expect(project?.bullets[1]).toContain(
      "timelines shared with training inputs",
    );
    expect(project?.bullets[1]).toContain(
      "do not establish unseen-data performance",
    );
    expect(project?.bullets.join(" ")).not.toMatch(/0\.95238|1\.000/);
  });
});
