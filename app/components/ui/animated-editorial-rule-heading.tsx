"use client";

import { type ReactNode, useRef } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";

import { cn } from "@/lib/cn";

const editorialLineTransition = {
  duration: 0.65,
  ease: [0.22, 1, 0.36, 1],
} as const;

export function AnimatedEditorialRuleHeading({
  children,
  className,
  height = "contact",
}: {
  children: ReactNode;
  className?: string;
  height?: "contact" | "section";
}) {
  const headingRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(headingRef, { once: true, amount: 0.8 });
  const shouldReduceMotion = useReducedMotion();
  const lineScale = shouldReduceMotion || isInView ? 1 : 0;

  return (
    <div
      ref={headingRef}
      className={cn(
        "grid w-full grid-cols-[minmax(0,1fr)_fit-content(100%)_minmax(0,1fr)] items-center gap-3 px-5 sm:px-8 lg:px-12",
        height === "section" ? "h-[4.5rem]" : "h-[4.15625rem]",
        className,
      )}
    >
      <motion.span
        aria-hidden
        className="h-px origin-right bg-ink"
        initial={{ scaleX: shouldReduceMotion ? 1 : 0 }}
        animate={{ scaleX: lineScale }}
        transition={editorialLineTransition}
      />
      <h2 className="font-display text-[length:var(--medium-text-size)] leading-[1.10075] font-semibold tracking-[-0.0963125rem]">
        {children}
      </h2>
      <motion.span
        aria-hidden
        className="h-px origin-left bg-ink"
        initial={{ scaleX: shouldReduceMotion ? 1 : 0 }}
        animate={{ scaleX: lineScale }}
        transition={editorialLineTransition}
      />
    </div>
  );
}
