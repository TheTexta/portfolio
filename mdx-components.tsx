import type { MDXComponents } from "mdx/types";
import type { ComponentProps, ReactNode } from "react";

import {
  WriteUpFigure,
  WriteUpProjectDetails,
  WriteUpMediaPlaceholder,
  WriteUpTitle,
} from "@/app/components/projects/project-write-up";
import WriteUpProjectPreview from "@/app/components/projects/project-write-up-preview";
import {
  WriteUpComparison,
  WriteUpGallery,
} from "@/app/components/projects/project-write-up-gallery";

function Lead({ children }: { children: ReactNode }) {
  return (
    <p data-write-up-lead className="mt-4 mb-0 text-muted">
      {children}
    </p>
  );
}

function Figure({
  caption,
  ...props
}: Omit<ComponentProps<typeof WriteUpFigure>, "children"> & {
  caption: ReactNode;
}) {
  return <WriteUpFigure {...props}>{caption}</WriteUpFigure>;
}

function MediaPlaceholder({ caption }: { caption: ReactNode }) {
  return <WriteUpMediaPlaceholder>{caption}</WriteUpMediaPlaceholder>;
}

const components = {
  h1: WriteUpTitle,
  Lead,
  Figure,
  MediaPlaceholder,
  ProjectDetails: WriteUpProjectDetails,
  ProjectPreview: WriteUpProjectPreview,
  Gallery: WriteUpGallery,
  Comparison: WriteUpComparison,
} satisfies MDXComponents;

export function useMDXComponents(): MDXComponents {
  return components;
}
