import { ReactNode } from "react";
import type { PreviewLink } from "./project-preview-link";
import { ArrowUpRight } from 'lucide-react';

type ProjectCardProps = {
  title: string;
  description: string;
  tags: string[];
  previewLinks?: PreviewLink[];
  children: ReactNode;
};

// TODO: Better scaling for mobile UI.
export default function ProjectCard({
  title,
  description,
  tags,
  previewLinks,
  children,
}: ProjectCardProps) {
  return (
    <article className="rounded-xl w-full md:w-5/6 max-w-3xl  justify-self-center">
      <header className="mb-4">
        <h3 className="text-xl sm:text-2xl font-semibold">{title}</h3>
        <p className="mt-2 text-sm">{description}</p>
        <div className="mt-3 flex flex-wrap items-start gap-2">
          <ul className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <li key={tag} className="rounded-md bg-white/10 px-2 py-1 text-xs">
                {tag}
              </li>
            ))}
          </ul>
          {previewLinks?.length ? (
            <ul className="ml-auto justify-end flex flex-wrap gap-2">
              {previewLinks.map((link) => (
                <li key={`${link.href}:${link.label}`} className="rounded-md bg-white/10 px-2 py-1 text-xs">
                  <a
                    href={link.href}
                    aria-label={link.ariaLabel ?? link.label}
                    className="underline-offset-2 hover:underline"
                  >
                    {link.label}
                  </a>
                   <ArrowUpRight className="inline-block ml-1 h-3.5 w-3.5" />

                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </header>
      <div className="relative overflow-hidden rounded-md mx-auto aspect-video">{children}</div>
    </article>
  );
}
