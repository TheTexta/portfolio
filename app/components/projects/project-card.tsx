import { cva } from "class-variance-authority";
import { ArrowUpRight } from "lucide-react";
import { type ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { PreviewLink } from "./project-preview-link";

type ProjectCardProps = {
  title: string;
  description: string;
  tags: string[];
  previewLinks?: PreviewLink[];
  children: ReactNode;
};

const projectCard = cva(
  "mx-auto w-full max-w-3xl justify-self-center rounded-xl",
  {
    variants: {
      width: {
        fluid: "md:w-5/6",
      },
    },
    defaultVariants: {
      width: "fluid",
    },
  },
);

const projectChip = cva("bg-overlay-item rounded-md px-2 py-1 text-xs");

const projectPreviewFrame = cva(
  "relative mx-auto aspect-video overflow-hidden rounded-md",
);

// TODO: Better scaling for mobile UI.
export default function ProjectCard({
  title,
  description,
  tags,
  previewLinks,
  children,
}: ProjectCardProps) {
  return (
    <article className={projectCard()}>
      <header className="mb-4">
        <h3 className="text-xl font-semibold sm:text-2xl">{title}</h3>
        <p className="mt-2 text-sm">{description}</p>
        <div className="mt-3 flex flex-wrap items-start gap-2">
          <ul className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <li key={tag} className={projectChip()}>
                {tag}
              </li>
            ))}
          </ul>
          {previewLinks?.length ? (
            <ul className="ml-auto flex flex-wrap justify-end gap-2">
              {previewLinks.map((link) => (
                <li
                  key={`${link.href}:${link.label}`}
                  className={projectChip()}
                >
                  <a
                    href={link.href}
                    aria-label={link.ariaLabel ?? link.label}
                    className={cn("link-normalized")}
                  >
                    {link.label}
                  </a>
                  <ArrowUpRight
                    className="ml-1 inline-block h-4 w-4"
                    strokeWidth={1}
                  />
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </header>
      <div className={projectPreviewFrame()}>{children}</div>
    </article>
  );
}
