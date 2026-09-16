"use client";

import {
  AnimatePresence,
  motion,
  type Transition,
  useReducedMotion,
} from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { PROJECT_ROUTES } from "@/app/components/projects/project-routes";

export type HeaderDirectorySegment = {
  label: string;
  href: string;
};

const DIRECTORY_SEGMENT_CLASS =
  "transition-opacity outline-none hover:underline hover:opacity-55 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-ink active:opacity-80";
const DIRECTORY_TRANSITION_EASE = [0.22, 1, 0.36, 1] as const;

function getDirectoryTransition(
  shouldReduceMotion: boolean | null,
): Transition {
  return shouldReduceMotion
    ? { duration: 0 }
    : { duration: 0.35, ease: DIRECTORY_TRANSITION_EASE };
}

function getPathDirectorySegments(pathname: string): HeaderDirectorySegment[] {
  const normalizedPathname = pathname.replace(/\/+$/, "");
  const pathSegments = normalizedPathname.split("/").filter(Boolean);

  return pathSegments.map((label, index) => {
    if (label === "portfolio") {
      return { label, href: PROJECT_ROUTES.home };
    }

    if (label === "projects") {
      return { label, href: PROJECT_ROUTES.portfolioProjects };
    }

    return {
      label,
      href: `/${pathSegments.slice(0, index + 1).join("/")}`,
    };
  });
}

export default function HeaderDirectory({
  segments,
}: {
  segments?: readonly HeaderDirectorySegment[];
}) {
  const pathname = usePathname();
  const shouldReduceMotion = useReducedMotion();
  const directorySegments = segments ?? getPathDirectorySegments(pathname);
  const directoryKey = directorySegments
    .map((segment) => `${segment.label}-${segment.href}`)
    .join("/");
  const directoryTransition = getDirectoryTransition(shouldReduceMotion);

  if (directorySegments.length === 0) {
    return "/";
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.span
        key={directoryKey}
        aria-label="Directory"
        initial={{ opacity: shouldReduceMotion ? 1 : 0, y: -2 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: shouldReduceMotion ? 1 : 0, y: 2 }}
        transition={directoryTransition}
      >
        <span aria-hidden>/</span>
        {directorySegments.map((segment) => (
          <span key={`${segment.label}-${segment.href}`}>
            {segment.href.includes("#") ? (
              <a href={segment.href} className={DIRECTORY_SEGMENT_CLASS}>
                {segment.label}
              </a>
            ) : (
              <Link href={segment.href} className={DIRECTORY_SEGMENT_CLASS}>
                {segment.label}
              </Link>
            )}
            <span aria-hidden>/</span>
          </span>
        ))}
      </motion.span>
    </AnimatePresence>
  );
}
