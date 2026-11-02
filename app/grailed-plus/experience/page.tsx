import type { Metadata } from "next";

import GrailedPlusPreview from "@/app/components/projects/grailed-plus/grailed-plus-preview";
import ProjectPageShell from "@/app/components/projects/project-page-shell";
import ExperienceNav from "@/app/components/ui/experience-nav";
import { PROJECT_ROUTES } from "@/app/components/projects/project-routes";

export const metadata: Metadata = {
  title: "Grailed Plus Experience — Dexter Young",
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <ProjectPageShell
      navigation={
        <ExperienceNav
          showTheme
          writeUpHref={PROJECT_ROUTES.grailedPlusWriteUp}
          writeUpLabel="Return to Grailed Plus case study"
        />
      }
    >
      <GrailedPlusPreview />
    </ProjectPageShell>
  );
}
