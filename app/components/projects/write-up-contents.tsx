"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

import { useReducedMotion } from "@/app/hooks/use-reduced-motion";
import { useWriteUpScroll } from "@/app/hooks/use-write-up-scroll";
import { cn } from "@/lib/cn";
import type { WriteUpContentsEntry } from "@/lib/mdx/write-up-contents";
import {
  getReadingWindow,
  getSectionScales,
  overlapsReadingWindow,
} from "@/lib/mdx/write-up-reading-map";

export default function WriteUpContents({
  entries,
  title,
}: {
  entries: WriteUpContentsEntry[];
  title: string;
}) {
  const [activeId, setActiveId] = useState("write-up-article");
  const [overlappingIds, setOverlappingIds] = useState<string[]>([]);
  const shouldReduceMotion = useReducedMotion();
  const overlapping = new Set(overlappingIds);
  const navigation = useRef<HTMLElement>(null);
  const track = useRef<HTMLOListElement>(null);
  const scrollToSection = useWriteUpScroll();

  useEffect(() => {
    const nav = navigation.current;
    const list = track.current;
    const body = document.getElementById("write-up-content");
    const header = document.querySelector<HTMLElement>("main > header");
    const articleHeader = body?.parentElement?.querySelector<HTMLElement>(
      "[data-write-up-header]",
    );
    const intro = list?.querySelector<HTMLElement>("[data-contents-intro]");
    if (!nav || !list || !body || !intro) return;
    const desktop = window.matchMedia("(min-width: 1024px)");
    const headings = entries
      .map(({ id }) => document.getElementById(id))
      .filter((heading) => heading !== null);
    const rows = Array.from(
      list.querySelectorAll("[data-contents-section]"),
    ).map((link) => link.parentElement!);
    const markers = Array.from(
      list.querySelectorAll<HTMLElement>("[data-contents-marker]"),
    );
    const markerIds = ["write-up-article", ...entries.map(({ id }) => id)];
    let frame = 0;
    let layoutChanged = true;
    let positions: number[] = [];
    let contentEnd = 0;
    let headerOffset = -1;

    const update = () => {
      frame = 0;
      if (!desktop.matches) return;
      const nextHeaderOffset = Math.max(
        0,
        header?.getBoundingClientRect().bottom ?? 0,
      );
      if (nextHeaderOffset !== headerOffset) {
        headerOffset = nextHeaderOffset;
        nav.style.setProperty("--write-up-header-height", `${headerOffset}px`);
        layoutChanged = true;
      }
      if (layoutChanged) {
        positions = headings.map(
          (heading) => heading.getBoundingClientRect().top + window.scrollY,
        );
        const contentBounds = body.getBoundingClientRect();
        contentEnd = contentBounds.bottom + window.scrollY;
        const scales = getSectionScales(
          positions,
          contentBounds.top + window.scrollY,
          contentEnd,
        );
        rows.forEach((row, index) => {
          row.style.setProperty(
            "--section-weight",
            String(scales.sections[index]),
          );
        });
        intro.style.setProperty("--section-weight", String(scales.intro));
        intro.style.setProperty(
          "--intro-display",
          scales.intro > 0 ? "block" : "none",
        );
        layoutChanged = false;
      }

      // Like the source's reading map, follow the section roughly a third of
      // the way down the viewport rather than the very first visible pixel.
      const readingLine = window.scrollY + Math.max(96, window.innerHeight / 3);
      let current = "write-up-article";
      headings.forEach((heading, index) => {
        if (positions[index] <= readingLine) current = heading.id;
      });
      if (
        window.scrollY + window.innerHeight >=
        document.documentElement.scrollHeight - 2
      )
        current = headings.at(-1)?.id ?? current;
      setActiveId(current);

      const listBounds = list.getBoundingClientRect();
      const markerBounds = markers.map((marker) => {
        const bounds = marker.getBoundingClientRect();
        return {
          top: bounds.top - listBounds.top,
          bottom: bounds.bottom - listBounds.top,
        };
      });
      const points = [
        { documentY: 0, railY: 0 },
        ...headings.map((_, index) => {
          const marker = markerBounds[index + 1];
          return {
            documentY: positions[index],
            railY: (marker.top + marker.bottom) / 2,
          };
        }),
        { documentY: contentEnd, railY: listBounds.height },
      ];
      const visible = getReadingWindow(
        points,
        window.scrollY,
        window.scrollY + window.innerHeight,
        listBounds.height,
      );
      list.style.setProperty("--reading-top", `${visible.top}px`);
      list.style.setProperty("--reading-height", `${visible.height}px`);
      const nextOverlappingIds = markerBounds.flatMap((bounds, index) =>
        overlapsReadingWindow(visible, bounds) ? [markerIds[index]] : [],
      );
      setOverlappingIds((previous) =>
        previous.length === nextOverlappingIds.length &&
        previous.every((id, index) => id === nextOverlappingIds[index])
          ? previous
          : nextOverlappingIds,
      );
    };
    const schedule = () => {
      if (!frame && desktop.matches)
        frame = window.requestAnimationFrame(update);
    };
    const measure = () => {
      layoutChanged = true;
      schedule();
    };
    const resize = new ResizeObserver(measure);
    resize.observe(body, { box: "border-box" });
    resize.observe(nav, { box: "border-box" });
    if (header) resize.observe(header, { box: "border-box" });
    if (articleHeader) resize.observe(articleHeader, { box: "border-box" });
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", measure);
    window.addEventListener("pageshow", measure);
    document.fonts.addEventListener("loadingdone", measure);
    desktop.addEventListener("change", measure);
    schedule();
    return () => {
      window.cancelAnimationFrame(frame);
      resize.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", measure);
      window.removeEventListener("pageshow", measure);
      document.fonts.removeEventListener("loadingdone", measure);
      desktop.removeEventListener("change", measure);
    };
  }, [entries]);

  useEffect(() => {
    const nav = navigation.current;
    const current = nav?.querySelector<HTMLElement>(
      '[aria-current="location"]',
    );
    if (!nav || !current) return;
    const bounds = nav.getBoundingClientRect();
    const row = current.getBoundingClientRect();
    if (row.top < bounds.top) nav.scrollTop -= bounds.top - row.top;
    else if (row.bottom > bounds.bottom)
      nav.scrollTop += row.bottom - bounds.bottom;
  }, [activeId]);

  if (entries.length < 2) return null;

  return (
    <nav
      ref={navigation}
      aria-label="Table of contents"
      className="sticky top-[var(--write-up-header-height,2rem)] -ml-1 h-[calc(100dvh-var(--write-up-header-height,2rem))] [scrollbar-width:thin] [scrollbar-color:var(--color-muted)_var(--color-canvas)] overflow-x-hidden overflow-y-auto overscroll-contain px-2 pt-[22px] text-[0.8125rem] leading-normal"
    >
      <ol
        ref={track}
        className="relative flex min-h-full flex-col border-l border-muted/40"
      >
        {[{ id: "write-up-article", title, depth: 1 }, ...entries].map(
          ({ id, title: label, depth }) => (
            <Fragment key={id}>
              <li
                className={cn(
                  "relative",
                  depth === 1
                    ? "shrink-0"
                    : "[flex-grow:var(--section-weight,1)] basis-0",
                )}
              >
                {depth === 1 && (
                  <span
                    aria-hidden
                    data-contents-window
                    className="pointer-events-none absolute top-[var(--reading-top,0px)] -left-px h-[var(--reading-height,0px)] w-px bg-ink"
                  />
                )}
                <a
                  href={`#${id}`}
                  onClick={(event) => scrollToSection(event, id)}
                  data-contents-section={depth > 1 ? "" : undefined}
                  data-contents-title={depth === 1 ? "" : undefined}
                  aria-current={id === activeId ? "location" : undefined}
                  className={cn(
                    "relative block min-h-7 py-1 pr-1 pl-4 text-muted no-underline hover:text-ink hover:no-underline focus-visible:-outline-offset-2",
                    id === activeId && "text-ink",
                  )}
                >
                  <span
                    aria-hidden
                    data-contents-marker
                    data-contents-overlap={
                      overlapping.has(id) ? "true" : "false"
                    }
                    className="pointer-events-none absolute top-[calc(0.7rem+1px)] -left-px size-px outline-1 outline-canvas"
                  >
                    <motion.span
                      data-contents-tick
                      initial={false}
                      animate={{
                        scaleX: overlapping.has(id) ? 11 : 1,
                      }}
                      transition={{
                        duration: shouldReduceMotion ? 0 : 0.18,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                      className={cn(
                        "absolute inset-0 origin-center bg-muted",
                        (overlapping.has(id) || id === activeId) && "bg-ink",
                      )}
                    />
                  </span>
                  <span
                    data-contents-label
                    className={cn(
                      "block opacity-0 transition-opacity duration-150 group-focus-within/contents:opacity-100 group-hover/contents:opacity-100 motion-reduce:transition-none [@media(hover:none)]:opacity-100",
                      depth === 1 && "font-display text-sm font-semibold",
                      depth === 3 && "pl-3",
                    )}
                  >
                    {label}
                  </span>
                </a>
              </li>
              {depth === 1 && (
                <li
                  aria-hidden
                  data-contents-intro
                  className="[display:var(--intro-display,none)] [flex-grow:var(--section-weight,0)] basis-0"
                />
              )}
            </Fragment>
          ),
        )}
      </ol>
    </nav>
  );
}
