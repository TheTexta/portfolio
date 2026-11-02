import { Maximize2 } from "lucide-react";
import Image from "next/image";

import { ActionLink } from "@/app/components/ui/editorial";

export default function ProjectPreviewControls({
  title,
  href,
  viewLabel,
}: {
  title: string;
  href: string;
  viewLabel?: string;
}) {
  if (viewLabel) {
    return (
      <div
        role="group"
        aria-label={`${title} preview controls`}
        className="flex min-h-12 shrink-0 items-center justify-between bg-canvas text-xs leading-4 font-semibold text-ink"
      >
        <div className="flex min-w-0 items-center">
          <span className="min-w-0 border-r border-ink px-3">{title}</span>
          <span className="shrink-0 px-3">{viewLabel}</span>
        </div>
        <a
          href={href}
          className="flex size-12 shrink-0 items-center justify-center"
          aria-label={`Open ${title} directly in a new tab`}
          title={`Open ${title} directly in a new tab`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            src="/projects/write-up/open-preview.svg"
            alt=""
            width={24}
            height={24}
            className="max-w-none dark:invert"
          />
        </a>
      </div>
    );
  }
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
