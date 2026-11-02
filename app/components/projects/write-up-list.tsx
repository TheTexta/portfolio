"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";

import type { ProjectDefinition, ProjectId } from "./project-catalog";
import { getProjectHoverTransition } from "./project-hover-motion";
import { useReducedMotion } from "@/app/hooks/use-reduced-motion";

export default function WriteUpList({
  projects,
}: {
  projects: readonly ProjectDefinition[];
}) {
  const [expandedId, setExpandedId] = useState<ProjectId | null>(null);
  const shouldReduceMotion = useReducedMotion();
  const transition = getProjectHoverTransition(shouldReduceMotion);

  return (
    <nav
      aria-label="Project write-ups"
      data-write-up-list
      tabIndex={0}
      className="h-64 min-h-0 min-w-0 overflow-y-auto overscroll-y-contain border-y border-ink focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-ink md:h-auto md:flex-1"
    >
      <ul>
        {projects.map((project) => {
          const expanded = expandedId === project.id;
          const synopsisId = `write-up-synopsis-${project.id}`;

          return (
            <li
              key={project.id}
              data-write-up-id={project.id}
              className="border-b border-ink last:border-b-0"
              onPointerEnter={(event) => {
                if (event.pointerType === "mouse") setExpandedId(project.id);
              }}
              onPointerLeave={(event) => {
                if (!event.currentTarget.contains(document.activeElement)) {
                  setExpandedId((current) =>
                    current === project.id ? null : current,
                  );
                }
              }}
              onFocusCapture={(event) => {
                if (
                  event.target instanceof HTMLAnchorElement &&
                  event.target.matches(":focus-visible")
                ) {
                  setExpandedId(project.id);
                }
              }}
              onBlurCapture={(event) => {
                if (
                  !event.currentTarget.contains(event.relatedTarget) &&
                  !event.currentTarget.matches(":hover")
                ) {
                  setExpandedId((current) =>
                    current === project.id ? null : current,
                  );
                }
              }}
            >
              <Link
                href={project.writeUpHref!}
                aria-expanded={expanded}
                aria-controls={synopsisId}
                aria-describedby={expanded ? synopsisId : undefined}
                className="flex min-h-12 min-w-0 items-center px-3 text-xs font-semibold tracking-[0.12em] uppercase hover:underline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink sm:text-sm"
                onClick={(event) => {
                  if (
                    !expanded &&
                    event.detail > 0 &&
                    !event.metaKey &&
                    !event.ctrlKey &&
                    !event.altKey &&
                    !event.shiftKey &&
                    window.matchMedia("(hover: none), (pointer: coarse)")
                      .matches
                  ) {
                    event.preventDefault();
                    setExpandedId(project.id);
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === " ") {
                    event.preventDefault();
                    setExpandedId(expanded ? null : project.id);
                  }
                }}
              >
                {project.title}
              </Link>
              <motion.div
                id={synopsisId}
                aria-hidden={!expanded}
                inert={!expanded}
                className="overflow-hidden"
                initial={false}
                animate={{
                  height: expanded ? "auto" : 0,
                  opacity: expanded ? 1 : 0,
                }}
                transition={transition}
              >
                <p className="px-3 pb-3 text-sm leading-6 text-muted">
                  {project.summary}
                </p>
              </motion.div>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
