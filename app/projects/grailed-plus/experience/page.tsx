import type { Metadata } from "next";

import GrailedPlusPreview from "@/app/components/projects/grailed-plus/grailed-plus-preview";
import ProjectPageShell from "@/app/components/projects/project-page-shell";
import ExperienceNav from "@/app/components/ui/experience-nav";

export const metadata: Metadata = {
  title: "Grailed Plus Experience — Dexter Young",
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <ProjectPageShell navigation={<ExperienceNav showTheme />}>
      <GrailedPlusPreview />
    </ProjectPageShell>
  );
}
