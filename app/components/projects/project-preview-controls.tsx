import { Maximize2 } from "lucide-react";

import { ActionLink } from "@/app/components/ui/editorial";

export default function ProjectPreviewControls({
  title,
  href,
}: {
  title: string;
  href: string;
}) {
  return (
    <div
      role="group"
      aria-label={`${title} preview controls`}
      className="flex shrink-0 items-stretch justify-between border-t border-ink bg-canvas text-ink"
    >
      <span className="flex min-h-11 max-w-[calc(100%-2.75rem)] min-w-0 items-center border-r border-ink px-3 text-xs font-semibold">
        <span className="truncate">{title}</span>
      </span>
      <ActionLink
        href={href}
        size="icon"
        className="shrink-0 border-y-0 border-r-0"
        aria-label={`Open ${title} directly in a new tab`}
        title={`Open ${title} directly in a new tab`}
        target="_blank"
        rel="noopener noreferrer"
      >
        <Maximize2 aria-hidden className="size-4" />
      </ActionLink>
    </div>
  );
}
