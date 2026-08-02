import type { Metadata } from "next";

import ProjectPageShell from "@/app/components/projects/project-page-shell";
import { PROJECT_ROUTES } from "@/app/components/projects/project-routes";
import SpotifyNodify from "@/app/components/projects/spotify-nodify/spotify-nodify";
import ExperienceNav from "@/app/components/ui/experience-nav";

export const metadata: Metadata = {
  title: "Spotify Nodify Experience — Dexter Young",
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <ProjectPageShell
      navigation={
        <ExperienceNav caseStudyHref={PROJECT_ROUTES.spotifyNodify} showTheme />
      }
    >
      <SpotifyNodify showNavigation={false} />
    </ProjectPageShell>
  );
}
