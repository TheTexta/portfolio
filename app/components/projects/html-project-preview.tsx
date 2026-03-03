import ProjectViewControls from "@/app/components/projects/project-view-controls";

type HtmlProjectPreviewProps = {
  title: string;
  previewSrc: string;
  projectHref: string;
  exitHref?: string;
  isFullPage?: boolean;
};

export default function HtmlProjectPreview({
  title,
  previewSrc,
  projectHref,
  exitHref = "/",
  isFullPage = false,
}: HtmlProjectPreviewProps) {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-[inherit] bg-neutral-950 text-white">
      <iframe
        title={`${title} preview`}
        src={previewSrc}
        loading={isFullPage ? "eager" : "lazy"}
        className="absolute inset-0 h-full w-full border-0 bg-white"
      />

      <ProjectViewControls
        isFullPage={isFullPage}
        showDarkModeToggle={false}
        toneClass="border border-white/10 bg-black/35 text-neutral-100"
        expandHref={projectHref}
        exitHref={exitHref}
      />
    </div>
  );
}
