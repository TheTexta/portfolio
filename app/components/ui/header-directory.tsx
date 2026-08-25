"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { PROJECT_ROUTES } from "@/app/components/projects/project-routes";

export type HeaderDirectorySegment = {
  label: string;
  href: string;
};

const DIRECTORY_SEGMENT_CLASS =
  "transition-opacity outline-none hover:underline hover:opacity-55 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[rgb(var(--color-focus))] active:opacity-80";

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
  const directorySegments = segments ?? getPathDirectorySegments(pathname);

  if (directorySegments.length === 0) {
    return "/";
  }

  return (
    <span aria-label="Directory">
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
    </span>
  );
}
