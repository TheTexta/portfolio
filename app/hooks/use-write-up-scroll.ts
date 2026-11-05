"use client";

import { animate } from "framer-motion";
import { type MouseEvent, useEffect, useRef } from "react";

import { useReducedMotion } from "./use-reduced-motion";

export function useWriteUpScroll() {
  const shouldReduceMotion = useReducedMotion();
  const scrolling = useRef<{
    controls: ReturnType<typeof animate>;
    target: HTMLElement;
    destination: number;
  } | null>(null);

  useEffect(() => {
    const stop = () => {
      scrolling.current?.controls.stop();
      scrolling.current = null;
    };
    const onKey = (event: KeyboardEvent) => {
      if (
        [
          "ArrowUp",
          "ArrowDown",
          "PageUp",
          "PageDown",
          "Home",
          "End",
          " ",
          "Escape",
          "Tab",
        ].includes(event.key)
      )
        stop();
    };
    window.addEventListener("wheel", stop, { passive: true });
    window.addEventListener("touchstart", stop, { passive: true });
    window.addEventListener("pointerdown", stop, { passive: true });
    window.addEventListener("keydown", onKey);
    window.addEventListener("popstate", stop);
    window.addEventListener("hashchange", stop);
    window.addEventListener("resize", stop);
    return () => {
      stop();
      window.removeEventListener("wheel", stop);
      window.removeEventListener("touchstart", stop);
      window.removeEventListener("pointerdown", stop);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("popstate", stop);
      window.removeEventListener("hashchange", stop);
      window.removeEventListener("resize", stop);
    };
  }, []);

  useEffect(() => {
    const current = scrolling.current;
    if (!shouldReduceMotion || !current) return;
    current.controls.stop();
    scrolling.current = null;
    window.scrollTo({ top: current.destination, behavior: "instant" });
    current.target.focus({ preventScroll: true });
  }, [shouldReduceMotion]);

  return (event: MouseEvent<HTMLAnchorElement>, id: string) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    const target = document.getElementById(id);
    if (!target) return;
    event.preventDefault();
    scrolling.current?.controls.stop();
    scrolling.current = null;

    const margin = parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
    const destination = Math.max(
      0,
      Math.min(
        target.getBoundingClientRect().top + window.scrollY - margin,
        document.documentElement.scrollHeight - window.innerHeight,
      ),
    );
    const hash = `#${id}`;
    if (window.location.hash !== hash) window.history.pushState(null, "", hash);

    if (shouldReduceMotion || Math.abs(destination - window.scrollY) < 1) {
      window.scrollTo({ top: destination, behavior: "instant" });
      target.focus({ preventScroll: true });
      return;
    }

    const controls = animate(window.scrollY, destination, {
      duration: 0.45,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (top) => window.scrollTo({ top, behavior: "instant" }),
      onComplete: () => {
        scrolling.current = null;
        target.focus({ preventScroll: true });
      },
    });
    scrolling.current = { controls, target, destination };
  };
}
