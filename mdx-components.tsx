import type { MDXComponents } from "mdx/types";
import type { ComponentProps, ReactNode } from "react";

import {
  WriteUpFigure,
  WriteUpMediaPlaceholder,
} from "@/app/components/projects/project-write-up";
import WriteUpProjectPreview from "@/app/components/projects/project-write-up-preview";
import {
  WriteUpComparison,
  WriteUpGallery,
} from "@/app/components/projects/project-write-up-gallery";

function Heading(props: ComponentProps<"h1">) {
  return <h1 {...props} id="write-up-title" />;
}

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
  h1: Heading,
  Lead,
  Figure,
  MediaPlaceholder,
  ProjectPreview: WriteUpProjectPreview,
  Gallery: WriteUpGallery,
  Comparison: WriteUpComparison,
} satisfies MDXComponents;

export function useMDXComponents(): MDXComponents {
  return components;
}
