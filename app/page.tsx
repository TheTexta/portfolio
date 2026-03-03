import AboutSection from "@/app/components/about/about";
import ProjectCard from "@/app/components/projects/project-card";
import PhotoGraphCanvas from "@/app/components/projects/photo-graph/PhotoGraphCanvas";
import ProjectsSection from "@/app/components/projects/projects-section";

export default function Page() {
  const projects = [
    {
      title: "Photo Graph",
      description:
        "Interactive force-directed image graph where photographs dynamically cluster based on color similarity, creating an evolving canvas shaped by user interaction.",
      tags: ["Next.js", "D3", "Firebase"],
      preview: <PhotoGraphCanvas />,
    },
  ];

  return (
    <div className="relative w-full h-dvh px-5">
      <AboutSection />
      <ProjectsSection>
        {projects.map((project) => (
          <ProjectCard
            key={project.title}
            title={project.title}
            description={project.description}
            tags={project.tags}
          >
            {project.preview}
          </ProjectCard>
        ))}
      </ProjectsSection>
    </div>
  );
}
