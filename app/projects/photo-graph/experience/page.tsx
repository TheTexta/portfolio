import type { Metadata } from "next";

import ProjectPageShell from "@/app/components/projects/project-page-shell";
import PhotoGraphCanvas from "@/app/components/projects/photo-graph/PhotoGraphCanvas";

export const metadata: Metadata = {
  title: "Photo Node-Gallery Experience — Dexter Young",
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <ProjectPageShell>
      <PhotoGraphCanvas fitToCanvas />
    </ProjectPageShell>
  );
}
