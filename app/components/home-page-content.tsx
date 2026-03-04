"use client";

import AboutSection from "@/app/components/about/about";
import { getProjectChrome } from "@/app/components/projects/project-chrome";
import { projectCatalog } from "@/app/components/projects/project-catalog";
import ProjectCard from "@/app/components/projects/project-card";
import ProjectsSection from "@/app/components/projects/projects-section";
import { useTheme } from "@/app/components/theme/theme-provider";
import OverlayNavBar from "@/app/components/ui/overlay-nav-bar";

export default function HomePageContent() {
  const { darkMode, toggleTheme } = useTheme();
  const { overlay: homeOverlayClass } = getProjectChrome("home", darkMode);

  return (
    <div className="relative w-full min-h-dvh px-5 pb-16">
      <OverlayNavBar
        darkMode={darkMode}
        onToggleDarkMode={toggleTheme}
        toneClass={homeOverlayClass}
        className="right-5 top-5 z-20"
        ariaLabel="Site controls"
      />
      <AboutSection />
      <ProjectsSection>
        {projectCatalog.map((project) => (
          <ProjectCard
            key={project.id}
            title={project.title}
            description={project.description}
            tags={project.tags}
          >
            {project.renderPreview(darkMode)}
          </ProjectCard>
        ))}
      </ProjectsSection>
    </div>
  );
}
