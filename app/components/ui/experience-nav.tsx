"use client";

import { ArrowLeft, Maximize2, Minimize } from "lucide-react";

import { useTheme } from "@/app/components/theme/theme-provider";
import { ActionButton, ActionLink } from "@/app/components/ui/editorial";
import { cn } from "@/lib/cn";
import { ControlLink } from "./control";

type ExperienceNavProps = {
  caseStudyHref?: string;
  experienceHref?: string;
  className?: string;
  showTheme?: boolean;
  ariaLabel?: string;
};

export default function ExperienceNav({
  caseStudyHref,
  experienceHref,
  className,
  showTheme = false,
  ariaLabel = "Experience controls",
}: ExperienceNavProps) {
  const { darkMode, toggleTheme } = useTheme();

  return (
    <nav
      aria-label={ariaLabel}
      className={cn(
        "absolute top-2 right-2 z-20 flex items-center gap-2",
        className,
      )}
    >
      {showTheme ? (
        <ActionButton
          size="sm"
          variant="secondary"
          onClick={toggleTheme}
          aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
          aria-pressed={darkMode}
        >
          {darkMode ? "Light" : "Dark"}
        </ActionButton>
      ) : null}
      {experienceHref ? (
        <ActionLink
          href={experienceHref}
          size="icon"
          variant="secondary"
          aria-label="Open full project experience"
        >
          <Maximize2 aria-hidden className="h-4 w-4" />
        </ActionLink>
      ) : null}
      {caseStudyHref ? (
        <ControlLink
          href={caseStudyHref}
          size="sm"

          aria-label="Return to project case study"
        >
          <Minimize aria-hidden className="h-4 w-4" />
        </ControlLink>
      ) : null}
    </nav>
  );
}
