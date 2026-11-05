"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";

import { useReducedMotion } from "@/app/hooks/use-reduced-motion";
import { cn } from "@/lib/cn";

const horizontalRuleTransition = {
  duration: 0.65,
  ease: [0.22, 1, 0.36, 1],
} as const;

type AnimatedHorizontalRuleProps = {
  className?: string;
  edge: "top" | "bottom";
  gutterTicks?: boolean;
};

export function AnimatedHorizontalRule({
  className,
  edge,
  gutterTicks = false,
}: AnimatedHorizontalRuleProps) {
  const ruleRef = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ruleRef, { once: true, amount: 0.8 });
  const shouldReduceMotion = useReducedMotion();
  const lineScale = shouldReduceMotion || isInView ? 1 : 0;
  const transition = shouldReduceMotion
    ? { duration: 0 }
    : horizontalRuleTransition;

  return (
    <>
      <motion.span
        ref={ruleRef}
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 z-10 h-px origin-center bg-ink",
          edge === "top" ? "top-0" : "bottom-0",
          className,
        )}
        initial={{ scaleX: shouldReduceMotion ? 1 : 0 }}
        animate={{ scaleX: lineScale }}
        transition={transition}
      />
      {gutterTicks && edge === "bottom" ? (
        <motion.div
          aria-hidden
          data-header-gutter-ticks
          className="@container/header-gutters pointer-events-none absolute inset-x-5 top-[calc(100%-0.25rem)] z-10 h-7 origin-[center_0.25rem] border-x border-ink sm:inset-x-8 lg:inset-x-12"
          initial={{ scaleY: shouldReduceMotion ? 1 : 0 }}
          animate={{ scaleY: lineScale }}
          transition={transition}
        >
          <div
            data-header-content-ticks
            className="absolute inset-x-0 top-1 mx-auto hidden h-3 max-w-228.25 border-x border-ink @min-[57.125rem]/header-gutters:block"
          />
        </motion.div>
      ) : null}
    </>
  );
}
