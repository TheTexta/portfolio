import AboutSection from "@/app/components/about/about";
import PhotoGraphCanvas from "@/app/components/projects/photo-graph/PhotoGraphCanvas";
import ProjectsSection from "@/app/components/projects/projects-section";

export default function Page() {
  return (
    <div className="relative w-full h-dvh px-5">
      <AboutSection />
      <ProjectsSection>
        <PhotoGraphCanvas />
      </ProjectsSection>
    </div>
  );
}
