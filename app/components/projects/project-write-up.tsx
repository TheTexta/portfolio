import Image from "next/image";
import Link from "next/link";
import { Fragment, type ComponentProps, type ReactNode } from "react";

import {
  getProjectReturnHref,
  projectCatalog,
  type ProjectDefinition,
} from "./project-catalog";
import { PROJECT_ROUTES } from "./project-routes";
import WriteUpContents from "./write-up-contents";
import {
  BorderContainer,
  BORDER_CONTAINER_TEXT_SCALE_CLASS,
  EDITORIAL_GUTTER_CLASS,
  SiteHeader,
} from "@/app/components/ui/editorial";
import ThemeToggle from "@/app/components/ui/theme-toggle";
import { cn } from "@/lib/cn";
import type { WriteUpContentsEntry } from "@/lib/mdx/write-up-contents";

export default function ProjectWriteUp({
  children,
  project,
  contents,
}: {
  children: ReactNode;
  project: ProjectDefinition;
  contents: WriteUpContentsEntry[];
}) {
  const writeUps = projectCatalog.filter((entry) => entry.writeUpHref);
  const index = writeUps.findIndex((entry) => entry.id === project.id);
  const previous = writeUps[(index - 1 + writeUps.length) % writeUps.length];
  const next = writeUps[(index + 1) % writeUps.length];

  return (
    <main className="relative min-h-dvh bg-canvas text-ink">
      <SiteHeader ariaLabel={`${project.title} navigation`}>
        <Link
          href={PROJECT_ROUTES.portfolioProjects}
          className="flex min-h-7 items-center transition-opacity hover:opacity-55"
        >
          Index
        </Link>
        <ThemeToggle />
      </SiteHeader>

      <aside
        className={cn(
          EDITORIAL_GUTTER_CLASS,
          "group/contents absolute inset-y-0 left-0 hidden w-[calc(50%-21rem)] lg:block lg:pr-8 print:hidden",
        )}
      >
        <WriteUpContents entries={contents} title={project.title} />
      </aside>
      <article
        id="write-up-article"
        tabIndex={-1}
        className="mx-auto w-[calc(100%-2.5rem)] max-w-2xl scroll-mt-20 pt-20 pb-28 text-base leading-[1.8] wrap-break-word outline-none sm:w-[calc(100%-4rem)] lg:w-2/3"
        aria-labelledby="write-up-title"
      >
        <div
          id="write-up-body"
          className="flow-root [&>:first-child]:mt-0 [&>:last-child]:mb-0 [&>[data-write-up-header]_a]:underline [&>[data-write-up-header]_a]:underline-offset-[0.2em]"
        >
          {children}
        </div>

        <footer className="mt-16 border-t border-ink py-12 text-sm leading-5">
          <nav
            aria-label="More write-ups"
            className="flex items-start justify-between gap-3"
          >
            <Link
              href={previous.writeUpHref!}
              rel="prev"
              className="flex-1 underline underline-offset-[0.2em]"
            >
              ← {previous.title}
            </Link>
            <Link
              href={next.writeUpHref!}
              rel="next"
              className="flex-1 text-right underline underline-offset-[0.2em]"
            >
              {next.title} →
            </Link>
          </nav>
          <Link
            href={getProjectReturnHref(project)}
            className="mt-8 block w-fit underline underline-offset-[0.2em]"
          >
            Back to projects
          </Link>
        </footer>
      </article>
    </main>
  );
}

export function WriteUpBody({ children }: { children: ReactNode }) {
  return (
    <div
      id="write-up-content"
      className={cn(
        "flow-root [&>:last-child]:mb-0",
        "[&_[data-write-up-heading]]:scroll-mt-20 [&_[data-write-up-heading]]:outline-none",
        "[&>h2]:mt-12 [&>h2]:mb-5 [&>h2]:text-2xl [&>h2]:leading-tight [&>h2]:font-semibold [&>h2]:text-balance",
        "[&>h3]:mt-8 [&>h3]:mb-3 [&>h3]:text-lg [&>h3]:leading-[1.4] [&>h3]:font-semibold",
        "[&_li+li]:mt-2 [&_ol]:list-decimal [&_ol]:ps-5 [&_ul]:list-disc [&_ul]:ps-5 [&>ol]:my-5 [&>p:not([data-write-up-lead])]:my-5 [&>ul]:my-5",
        "[&>:not([data-write-up-preview])_a]:underline [&>:not([data-write-up-preview])_a]:underline-offset-[0.2em]",
      )}
    >
      {children}
    </div>
  );
}

export function WriteUpTitle({
  className,
  children,
  ...props
}: ComponentProps<"h1">) {
  return (
    <BorderContainer
      data-write-up-title
      centerWidth="calc(100% - clamp(2rem, 8vw, 5.5rem))"
      className="h-auto min-h-[17rem] grid-rows-[minmax(3.75rem,1fr)_auto_minmax(3.75rem,1fr)] py-8 sm:min-h-[20.625rem] sm:py-12"
    >
      <h1
        {...props}
        id="write-up-title"
        className={cn(
          BORDER_CONTAINER_TEXT_SCALE_CLASS,
          "m-0 px-4 py-5 text-center font-display leading-[0.7705] font-semibold tracking-[-0.04586em] text-balance max-sm:text-4xl",
          className,
        )}
      >
        {typeof children === "string"
          ? children.split(" ").map((word, index) => (
              <Fragment key={index}>
                {index > 0 ? " " : null}
                <span className="whitespace-nowrap">{word}</span>
              </Fragment>
            ))
          : children}
      </h1>
    </BorderContainer>
  );
}

export function WriteUpProjectMeta({ children }: { children: ReactNode }) {
  return (
    <div
      data-write-up-meta
      className="flex flex-wrap items-center justify-between gap-x-8 gap-y-1 py-3 [&>nav]:flex [&>nav]:flex-wrap [&>nav]:gap-x-5 [&>nav]:gap-y-2 [&>nav]:text-sm [&>nav]:leading-[1.8]"
    >
      {children}
    </div>
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
      <figcaption className="mx-auto max-w-2xl text-[0.8125rem] leading-[1.6] text-muted">
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
      className="flex flex-wrap gap-x-3 gap-y-2 text-sm leading-5 text-muted sm:gap-x-0"
    >
      {[
        ["Period", project.date],
        ["Contribution", project.role],
        ["Status", project.status],
      ].map(([label, value], index) => (
        <div
          key={label}
          className={cn("flex min-w-0 items-start", index > 0 && "sm:ml-3")}
        >
          {index > 0 ? (
            <span
              aria-hidden
              className="relative mr-3 hidden h-5 w-px shrink-0 sm:block"
            >
              <Image
                src="/projects/write-up/detail-separator.svg"
                alt=""
                width={20}
                height={1}
                className="absolute top-1/2 left-1/2 max-w-none -translate-1/2 rotate-90 dark:invert"
              />
            </span>
          ) : null}
          <dt className="sr-only">{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
