import HtmlProjectPreview from "@/app/components/projects/html-project-preview";
import ProjectPageShell from "@/app/components/projects/project-page-shell";
import { PROJECT_ROUTES } from "@/app/components/projects/project-routes";

export default function Page() {
  return (
    <ProjectPageShell>
      <HtmlProjectPreview
        title="nepobabiesruntheunderground"
        previewSrc={PROJECT_ROUTES.nepobabiesPreview}
        projectHref={PROJECT_ROUTES.nepobabies}
        isFullPage
      />
    </ProjectPageShell>
  );
}
