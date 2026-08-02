import type { Metadata } from "next";

import ProjectPageShell from "@/app/components/projects/project-page-shell";
import PhotoGraphCanvas from "@/app/components/projects/photo-graph/PhotoGraphCanvas";
import { PROJECT_ROUTES } from "@/app/components/projects/project-routes";
import ExperienceNav from "@/app/components/ui/experience-nav";

export const metadata: Metadata = {
  title: "Photo Node-Gallery Experience — Dexter Young",
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <ProjectPageShell
      navigation={<ExperienceNav caseStudyHref={PROJECT_ROUTES.photoGraph} />}
    >
      <PhotoGraphCanvas showNavigation={false} />
    </ProjectPageShell>
  );
}
