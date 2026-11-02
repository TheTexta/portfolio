import Image from "next/image";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

import {
  getProjectReturnHref,
  type ProjectDefinition,
} from "./project-catalog";
import { PROJECT_ROUTES } from "./project-routes";
import { BorderContainer, SiteHeader } from "@/app/components/ui/editorial";
import ThemeToggle from "@/app/components/ui/theme-toggle";
import { cn } from "@/lib/cn";

export default function ProjectWriteUp({
  children,
  project,
}: {
  children: ReactNode;
  project: ProjectDefinition;
}) {
  return (
    <main className="min-h-dvh bg-canvas text-ink">
      <SiteHeader ariaLabel={`${project.title} navigation`}>
        <Link
          href={PROJECT_ROUTES.portfolioProjects}
          className="flex min-h-7 items-center transition-opacity hover:opacity-55"
        >
          Index
        </Link>
        <ThemeToggle />
      </SiteHeader>

      <article
        className="mx-auto w-[calc(100%-2.5rem)] max-w-2xl pt-16 pb-20 text-base leading-[1.8] wrap-break-word sm:w-[calc(100%-4rem)] sm:pt-20 sm:pb-28 lg:w-2/3"
        aria-labelledby="write-up-title"
      >
        <div
          className={cn(
            "[&>:first-child]:mt-0",
            "[&>h2]:mt-12 [&>h2]:mb-4 [&>h2]:text-2xl [&>h2]:leading-tight [&>h2]:font-semibold [&>h2]:text-balance",
            "[&>h3]:mt-8 [&>h3]:mb-3 [&>h3]:text-lg [&>h3]:leading-[1.4] [&>h3]:font-semibold",
            "[&>header>nav]:mt-5 [&>header>nav]:flex [&>header>nav]:flex-wrap [&>header>nav]:justify-center [&>header>nav]:gap-x-5 [&>header>nav]:gap-y-2 [&>header>nav]:text-center [&>header>nav]:text-sm [&>header>nav]:leading-[1.8]",
            "[&_li+li]:mt-2 [&_ol]:list-decimal [&_ol]:ps-5 [&_ul]:list-disc [&_ul]:ps-5 [&>ol]:my-5 [&>p:not([data-write-up-lead])]:my-5 [&>ul]:my-5",
            "[&>:not([data-write-up-preview])_a]:underline [&>:not([data-write-up-preview])_a]:underline-offset-[0.2em]",
          )}
        >
          {children}
        </div>

        <footer className="mx-auto mt-16 max-w-2xl border-t border-ink pt-5 text-sm">
          <Link
            href={getProjectReturnHref(project)}
            className="underline underline-offset-4"
          >
            Back to projects
          </Link>
        </footer>
      </article>
    </main>
  );
}

export function WriteUpTitle({ className, ...props }: ComponentProps<"h1">) {
  return (
    <BorderContainer data-write-up-title className="h-44 sm:h-56">
      <h1
        {...props}
        id="write-up-title"
        className={cn(
          "m-0 px-3 py-4 text-center font-display text-3xl leading-tight font-semibold tracking-[-0.025em] text-balance sm:px-4 sm:py-5 sm:text-4xl",
          className,
        )}
      />
    </BorderContainer>
  );
}

export function WriteUpFigure({
  src,
  alt,
  width,
  height,
  children,
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  children: ReactNode;
}) {
  return (
    <figure className="my-10">
      <Image
        className="block h-auto w-full"
        src={src}
        alt={alt}
        width={width}
        height={height}
        sizes="(min-width: 736px) 672px, (min-width: 640px) calc(100vw - 64px), calc(100vw - 40px)"
      />
      <figcaption className="mx-auto mt-3 max-w-2xl text-[0.8125rem] leading-[1.6] text-muted">
        {children}
      </figcaption>
    </figure>
  );
}

export function WriteUpMediaPlaceholder({ children }: { children: ReactNode }) {
  return (
    <figure className="my-10">
      <div className="flex min-h-48 items-center justify-center border border-dashed border-muted p-6 text-center text-sm leading-[1.8] text-muted">
        Image / video placeholder
      </div>
      <figcaption className="mt-3 text-[0.8125rem] leading-[1.6] text-muted">
        {children}
      </figcaption>
    </figure>
  );
}

export function WriteUpProjectDetails({
  project,
}: {
  project: ProjectDefinition;
}) {
  return (
    <dl
      aria-label="Project details"
      className="mt-5 flex flex-wrap gap-x-3 gap-y-1 text-sm leading-5 text-muted"
    >
      {[
        ["Period", project.date],
        ["Contribution", project.role],
        ["Status", project.status],
      ].map(([label, value], index) => (
        <div key={label}>
          <dt className="sr-only">{label}</dt>
          <dd>
            {index > 0 ? (
              <span aria-hidden className="mr-3">
                ·
              </span>
            ) : null}
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
