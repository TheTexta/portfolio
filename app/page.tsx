import AboutSection from "@/app/components/about/about";
import HtmlProjectPreview from "@/app/components/projects/html-project-preview";
import ProjectCard from "@/app/components/projects/project-card";
import PhotoGraphCanvas from "@/app/components/projects/photo-graph/PhotoGraphCanvas";
import ProjectsSection from "@/app/components/projects/projects-section";

export default function Page() {
  const nepobabiesProjectHref = "/components/projects/nepobabiesruntheunderground";
  const nepobabiesPreviewSrc = `${nepobabiesProjectHref}/preview`;

  const projects = [
    {
      title: "Node based Photo Gallery",
      description:
        "Interactive force-directed image graph where photographs dynamically cluster based on color similarity; an evolving canvas shaped by user interaction.",
      tags: ["Next.js", "D3", "Firebase"],
      preview: <PhotoGraphCanvas />,
    },
    {
      title: "nepobabiesruntheunderground",
      description:
        "Legacy multimedia web piece embedded as a live HTML preview, with its original CSS, JavaScript, shaders, and image assets preserved.",
      tags: ["HTML", "CSS", "JavaScript", "WebGL"],
      preview: (
        <HtmlProjectPreview
          title="nepobabiesruntheunderground"
          previewSrc={nepobabiesPreviewSrc}
          projectHref={nepobabiesProjectHref}
        />
      ),
    },
  ];

  return (
    <div className="relative w-full min-h-dvh px-5 pb-16">
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
