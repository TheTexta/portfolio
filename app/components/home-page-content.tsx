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
  const chrome = getProjectChrome("home");

  return (
    <div className="relative min-h-dvh w-full pb-16 font-light">
      <OverlayNavBar
        darkMode={darkMode}
        onToggleDarkMode={toggleTheme}
        toneClass={chrome.controls.icon}
        containerMode="sticky"
        className="top-5 z-20 mr-5 ml-auto"
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
            previewLinks={project.previewLinks}
          >
            {project.renderPreview(darkMode)}
          </ProjectCard>
        ))}
      </ProjectsSection>
    </div>
  );
}
