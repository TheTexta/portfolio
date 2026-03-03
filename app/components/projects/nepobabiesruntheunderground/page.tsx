import HtmlProjectPreview from "@/app/components/projects/html-project-preview";

const projectHref = "/components/projects/nepobabiesruntheunderground";
const previewSrc = "/components/projects/nepobabiesruntheunderground/preview";

export default function Page() {
  return (
    <div className="h-dvh w-full">
      <HtmlProjectPreview
        title="nepobabiesruntheunderground"
        previewSrc={previewSrc}
        projectHref={projectHref}
        isFullPage
      />
    </div>
  );
}
