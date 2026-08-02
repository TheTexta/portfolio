import type { Metadata } from "next";

import ProjectCaseStudyShell from "@/app/components/projects/project-case-study-shell";
import { getProject } from "@/app/components/projects/project-catalog";
import { SITE_ORIGIN } from "@/lib/site-config";

const project = getProject("photo-graph");

export const metadata: Metadata = {
  title: "Photo Node-Gallery — Dexter Young",
  description: project.summary,
  alternates: {
    canonical: `${SITE_ORIGIN}${project.caseStudyHref}`,
  },
};

export default function Page() {
  return <ProjectCaseStudyShell project={project} />;
}
