"use client";

import { useRef } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";

import { cn } from "@/lib/cn";

const horizontalRuleTransition = {
  duration: 0.65,
  ease: [0.22, 1, 0.36, 1],
} as const;

type AnimatedHorizontalRuleProps = {
  className?: string;
  edge: "top" | "bottom";
};

export function AnimatedHorizontalRule({
  className,
  edge,
}: AnimatedHorizontalRuleProps) {
  const ruleRef = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ruleRef, { once: true, amount: 0.8 });
  const shouldReduceMotion = useReducedMotion();
  const lineScale = shouldReduceMotion || isInView ? 1 : 0;

  return (
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
      transition={horizontalRuleTransition}
    />
  );
}
