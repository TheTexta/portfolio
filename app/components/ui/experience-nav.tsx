"use client";

import { ArrowLeft, Maximize2 } from "lucide-react";

import { useTheme } from "@/app/components/theme/theme-provider";
import { ActionButton, ActionLink } from "@/app/components/ui/editorial";
import { cn } from "@/lib/cn";

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
        "absolute top-3 right-3 z-20 flex items-center gap-2",
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
        <ActionLink
          href={caseStudyHref}
          size="icon"
          variant="secondary"
          aria-label="Return to project case study"
        >
          <ArrowLeft aria-hidden className="h-4 w-4" />
        </ActionLink>
      ) : null}
    </nav>
  );
}
