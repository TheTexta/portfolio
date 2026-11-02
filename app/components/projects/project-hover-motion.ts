import type { Transition } from "framer-motion";

const projectHoverTransition = {
  duration: 0.28,
  ease: [0.22, 1, 0.36, 1],
} as const;

export function getProjectHoverTransition(
  shouldReduceMotion: boolean | null,
): Transition {
  return shouldReduceMotion ? { duration: 0 } : projectHoverTransition;
}
