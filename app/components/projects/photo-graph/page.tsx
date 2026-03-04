import ProjectPageShell from "@/app/components/projects/project-page-shell";
import PhotoGraphCanvas from "@/app/components/projects/photo-graph/PhotoGraphCanvas";

export default function Page() {
  return (
    <ProjectPageShell>
      <PhotoGraphCanvas />
    </ProjectPageShell>
  );
}
