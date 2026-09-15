import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";

import type { ProjectTitleTreatment } from "@/app/components/projects/project-catalog";
import { cn } from "@/lib/cn";

const projectTitleStyles = cva("font-display [font-synthesis:none]", {
  variants: {
    context: {
      rail: "text-[1.3125rem]",
      mobile: "text-[1.3125rem]",
      focus: "text-[clamp(1.75rem,3vw,3rem)]",
      caseStudy: "text-[clamp(2.75rem,7vw,6.5rem)]",
    },
    treatment: {
      bur1alrites:
        "leading-[0.78] font-black tracking-[-0.085em] uppercase",
      grailed: "leading-[0.78] font-black tracking-[-0.065em]",
      "photo-graph":
        "font-editorial leading-[0.98] font-medium tracking-[-0.025em]",
      nepo: "font-experimental leading-[0.9] font-normal tracking-[-0.045em] italic",
      "elliot-mairet": null,
    } satisfies Record<ProjectTitleTreatment, string | null>,
  },
  compoundVariants: [
    { context: "rail", treatment: "bur1alrites", className: "text-[1.15rem]" },
    { context: "rail", treatment: "photo-graph", className: "text-[1.2rem]" },
    {
      context: "rail",
      treatment: "nepo",
      className: "text-[1.45rem] leading-[1.08]",
    },
    {
      context: "mobile",
      treatment: "bur1alrites",
      className: "text-[1.15rem]",
    },
    {
      context: "mobile",
      treatment: "photo-graph",
      className: "text-[1.2rem]",
    },
    {
      context: "mobile",
      treatment: "nepo",
      className: "text-sm leading-[1.08]",
    },
  ],
  defaultVariants: {
    context: "rail",
  },
});

type ProjectTitleProps = HTMLAttributes<HTMLElement> &
  VariantProps<typeof projectTitleStyles> & {
    as?: "h1" | "h2" | "h3" | "span";
    treatment: ProjectTitleTreatment;
  };

export default function ProjectTitle({
  as: Component = "span",
  className,
  context,
  treatment,
  ...props
}: ProjectTitleProps) {
  return (
    <Component
      className={cn(projectTitleStyles({ context, treatment }), className)}
      {...props}
    />
  );
}
