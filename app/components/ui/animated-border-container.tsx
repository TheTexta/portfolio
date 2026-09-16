"use client";

import {
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
  useRef,
} from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";

import { cn } from "@/lib/cn";

const borderLineTransition = {
  duration: 0.65,
  ease: [0.22, 1, 0.36, 1],
} as const;

type BorderCorner = "top-left" | "top-right" | "bottom-left" | "bottom-right";

const cornerClassNames: Record<BorderCorner, string> = {
  "top-left": "",
  "top-right": "col-start-3",
  "bottom-left": "row-start-3",
  "bottom-right": "col-start-3 row-start-3",
};

const horizontalClassNames: Record<BorderCorner, string> = {
  "top-left": "bottom-0 origin-right",
  "top-right": "bottom-0 origin-left",
  "bottom-left": "top-0 origin-right",
  "bottom-right": "top-0 origin-left",
};

const verticalClassNames: Record<BorderCorner, string> = {
  "top-left": "right-0 origin-bottom",
  "top-right": "left-0 origin-bottom",
  "bottom-left": "right-0 origin-top",
  "bottom-right": "left-0 origin-top",
};

type AnimatedBorderCornerProps = {
  corner: BorderCorner;
  lineScale: number;
  initialScale: number;
};

function AnimatedBorderCorner({
  corner,
  lineScale,
  initialScale,
}: AnimatedBorderCornerProps) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative min-w-0 overflow-hidden",
        cornerClassNames[corner],
      )}
    >
      <motion.span
        className={cn(
          "absolute inset-x-0 h-px bg-ink",
          horizontalClassNames[corner],
        )}
        initial={{ scaleX: initialScale }}
        animate={{ scaleX: lineScale }}
        transition={borderLineTransition}
      />
      <motion.span
        className={cn(
          "absolute inset-y-0 w-px bg-ink",
          verticalClassNames[corner],
        )}
        initial={{ scaleY: initialScale }}
        animate={{ scaleY: lineScale }}
        transition={borderLineTransition}
      />
    </span>
  );
}

type AnimatedBorderContainerProps = HTMLAttributes<HTMLDivElement> & {
  centerWidth?: string;
  children: ReactNode;
};

export function AnimatedBorderContainer({
  className,
  children,
  centerWidth = "70%",
  style,
  ...props
}: AnimatedBorderContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: true, amount: 0.45 });
  const shouldReduceMotion = useReducedMotion();
  const lineScale = shouldReduceMotion || isInView ? 1 : 0;
  const initialScale = shouldReduceMotion ? 1 : 0;

  return (
    <div
      ref={containerRef}
      className={cn(
        "grid h-full w-full grid-cols-[minmax(0,1fr)_var(--border-center-width)_minmax(0,1fr)] grid-rows-[minmax(0,1fr)_fit-content(100%)_minmax(0,1fr)]",
        className,
      )}
      style={
        {
          ...style,
          "--border-center-width": centerWidth,
        } as CSSProperties
      }
      {...props}
    >
      <AnimatedBorderCorner
        corner="top-left"
        initialScale={initialScale}
        lineScale={lineScale}
      />
      <AnimatedBorderCorner
        corner="top-right"
        initialScale={initialScale}
        lineScale={lineScale}
      />
      <div className="col-start-2 row-start-2 min-w-0 outline-1 outline-ink outline-solid">
        {children}
      </div>
      <AnimatedBorderCorner
        corner="bottom-left"
        initialScale={initialScale}
        lineScale={lineScale}
      />
      <AnimatedBorderCorner
        corner="bottom-right"
        initialScale={initialScale}
        lineScale={lineScale}
      />
    </div>
  );
}
