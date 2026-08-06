import type { Metadata } from "next";

import ProjectCaseStudyShell from "@/app/components/projects/project-case-study-shell";
import {
  type ProjectDefinition,
  type ProjectLink,
} from "@/app/components/projects/project-catalog";
import { PROJECT_ROUTES } from "@/app/components/projects/project-routes";
import { SITE_ORIGIN } from "@/lib/site-config";

const spotifyLinks: readonly ProjectLink[] = [];

const project: ProjectDefinition = {
  id: "spotify-nodify",
  number: "04",
  title: "Spotify Nodify",
  eyebrow: "API experiment / Listening data",
  summary:
    "A Spotify API experiment for inspecting profile context and recent listening taste.",
  technologies: ["Next.js", "Spotify API", "OAuth PKCE"],
  caseStudyHref: PROJECT_ROUTES.spotifyNodify,
  experienceHref: PROJECT_ROUTES.spotifyNodifyExperience,
  posterSrc: "/projects/posters/spotify-nodify.webp",
  posterAlt: "Spotify Nodify disconnected authorization interface",
  previewKind: "spotify",
  posterAspectRatio: 1.64,
  role: "TBD",
  date: "TBD",
  outcome: "TBD",
  links: spotifyLinks,
};

export const metadata: Metadata = {
  title: "Spotify Nodify — Dexter Young",
  description: project.summary,
  alternates: {
    canonical: `${SITE_ORIGIN}${project.caseStudyHref}`,
  },
};

export default function Page() {
  return <ProjectCaseStudyShell project={project} />;
}
