"use client";

import {
  Fragment,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Pause, Play } from "lucide-react";
import {
  createAnimationTimeline,
  type AnimationFrame,
  type AnimationStage,
} from "@/lib/animation/timeline";

/** Reusable scene-agnostic animation shell. onFrame can draw SVG/canvas, set
 * paused CSS-animation times, or forward time to a validated iframe renderer. */
export default function AnimationPlayer({
  children,
  stages,
  onFrame,
  ready = true,
  label = "Animation",
}: {
  children: ReactNode;
  stages: readonly AnimationStage[];
  onFrame: (frame: AnimationFrame) => void;
  ready?: boolean;
  label?: string;
}) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const progress = useRef<HTMLProgressElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const clock = useRef<ReturnType<typeof createAnimationTimeline> | null>(null);
  const callback = useRef(onFrame);
  const activity = useRef({ visible: false, ready });
  const playback = useRef({ playing: true, reduced: false });
  const [playing, setPlaying] = useState(true);
  const [reduced, setReduced] = useState(false);
  const duration = stages.reduce((sum, stage) => sum + stage.durationMs, 0);

  useEffect(() => {
    callback.current = onFrame;
  }, [onFrame]);
  useEffect(() => {
    activity.current.ready = ready;
    clock.current?.setActive(
      ready && activity.current.visible && !document.hidden,
    );
  }, [ready]);
  useEffect(() => {
    const element = root.current!;
    const ticks = Array.from(
      element.querySelectorAll<HTMLElement>("[data-animation-stage]"),
    );
    const timeline = createAnimationTimeline(stages, (frame) => {
      // Transient values stay out of React state: no 60fps scene re-render.
      if (progress.current) progress.current.value = frame.timeMs;
      if (input.current) {
        input.current.value = String(stages.indexOf(frame.stage));
        input.current.setAttribute("aria-valuetext", frame.stage.label);
      }
      element.dataset.stage = frame.stage.id;
      element.dataset.time = String(frame.timeMs);
      element.dataset.cycle = String(frame.cycle);
      element.dataset.seeking = String(frame.seeking);
      element.dataset.resetting = String(frame.transition?.kind === "reset");
      element.dataset.transitionProgress = frame.transition
        ? String(frame.transition.progress)
        : "";
      ticks.forEach((tick) => {
        tick.dataset.active = String(
          tick.dataset.animationStage === frame.stage.id,
        );
      });
      if (playback.current.playing !== frame.playing) {
        playback.current.playing = frame.playing;
        setPlaying(frame.playing);
      }
      if (playback.current.reduced !== frame.reducedMotion) {
        playback.current.reduced = frame.reducedMotion;
        setReduced(frame.reducedMotion);
      }
      callback.current(frame);
    });
    clock.current = timeline;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotion = () => timeline.setReducedMotion(motion.matches);
    const syncActivity = () =>
      timeline.setActive(
        activity.current.ready && activity.current.visible && !document.hidden,
      );
    const hide = () => timeline.setActive(false);
    const observer = new IntersectionObserver(
      ([entry]) => {
        activity.current.visible =
          entry.isIntersecting && entry.intersectionRatio >= 0.5;
        syncActivity();
      },
      { threshold: [0, 0.5] },
    );
    observer.observe(element);
    motion.addEventListener("change", syncMotion);
    document.addEventListener("visibilitychange", syncActivity);
    window.addEventListener("pagehide", hide);
    window.addEventListener("pageshow", syncActivity);
    syncMotion();
    return () => {
      timeline.destroy();
      clock.current = null;
      observer.disconnect();
      motion.removeEventListener("change", syncMotion);
      document.removeEventListener("visibilitychange", syncActivity);
      window.removeEventListener("pagehide", hide);
      window.removeEventListener("pageshow", syncActivity);
    };
  }, [stages]);

  return (
    <div ref={root} data-animation-player aria-label={label}>
      {children}
      <div
        className="group/playback relative flex min-h-11 items-center gap-2"
        role="group"
        aria-label={`${label} playback`}
      >
        <button
          type="button"
          disabled={!ready || reduced}
          onClick={() => clock.current?.toggle()}
          aria-label={
            reduced
              ? "Autoplay disabled for reduced motion"
              : playing
                ? "Pause animation"
                : "Play animation"
          }
          className="flex size-11 shrink-0 items-center justify-center text-muted opacity-0 transition-opacity group-focus-within/playback:opacity-100 group-hover/playback:opacity-100 hover:text-ink focus-visible:opacity-100 focus-visible:outline-1 focus-visible:outline-ink disabled:cursor-default disabled:opacity-0 motion-reduce:transition-none [@media(hover:none)]:opacity-100"
        >
          {playing ? (
            <Pause aria-hidden className="size-3" strokeWidth={1.5} />
          ) : (
            <Play aria-hidden className="size-3" strokeWidth={1.5} />
          )}
        </button>
        <div className="relative h-11 min-w-0 flex-1 has-[:focus-visible]:outline-1 has-[:focus-visible]:outline-offset-4 has-[:focus-visible]:outline-ink">
          <progress
            ref={progress}
            max={duration}
            value={0}
            aria-hidden
            className="pointer-events-none absolute top-1/2 block h-px w-full appearance-none border-0 bg-muted/40 text-ink [&::-moz-progress-bar]:bg-ink [&::-webkit-progress-bar]:bg-muted/40 [&::-webkit-progress-value]:bg-ink"
          />
          {stages.map((stage, index) => {
            const start = stages
              .slice(0, index)
              .reduce((sum, entry) => sum + entry.durationMs, 0);
            const left = (start / duration) * 100;
            return (
              <Fragment key={stage.id}>
                <span
                  data-animation-stage={stage.id}
                  data-active={index === 0}
                  className="pointer-events-none absolute top-1/2 z-10 size-px -translate-y-1/2 bg-muted outline-1 outline-canvas transition-[height,background-color] duration-150 data-[active=true]:h-3 data-[active=true]:bg-ink motion-reduce:transition-none"
                  style={{ left: `${left}%` }}
                />
                <span
                  style={{ left: `${left}%` }}
                  className={`pointer-events-none absolute top-[calc(50%+16px)] text-[0.6875rem] leading-none whitespace-nowrap text-muted opacity-0 transition-opacity group-focus-within/playback:opacity-100 group-hover/playback:opacity-100 motion-reduce:transition-none ${index > 0 && index < stages.length - 1 ? "-translate-x-1/2" : ""}`}
                >
                  {stage.label}
                </span>
              </Fragment>
            );
          })}
          <label htmlFor={id} className="sr-only">
            {label} timeline
          </label>
          <input
            id={id}
            ref={input}
            type="range"
            min={0}
            max={stages.length - 1}
            step={1}
            defaultValue={0}
            disabled={!ready}
            aria-describedby={`${id}-help`}
            className="absolute inset-0 z-20 m-0 size-full cursor-pointer opacity-0 disabled:cursor-default"
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              event.preventDefault();
              event.currentTarget.focus();
              const bounds = event.currentTarget.getBoundingClientRect();
              clock.current?.seek(
                ((event.clientX - bounds.left) / bounds.width) * duration,
              );
            }}
            onChange={(event) => {
              const index = Number(event.currentTarget.value);
              clock.current?.seek(
                stages
                  .slice(0, index)
                  .reduce((sum, stage) => sum + stage.durationMs, 0),
              );
            }}
            onKeyDown={(event) => {
              const timeline = clock.current;
              if (!timeline) return;
              if (event.key === " ") {
                event.preventDefault();
                timeline.toggle();
              }
              const points = stages.map((_, index) =>
                stages
                  .slice(0, index)
                  .reduce((sum, stage) => sum + stage.durationMs, 0),
              );
              const index = stages.indexOf(timeline.getFrame().stage);
              const targets: Record<string, number> = {
                ArrowLeft: points[Math.max(0, index - 1)],
                ArrowDown: points[Math.max(0, index - 1)],
                ArrowRight: points[Math.min(stages.length - 1, index + 1)],
                ArrowUp: points[Math.min(stages.length - 1, index + 1)],
                Home: 0,
                End: points.at(-1)!,
              };
              if (event.key in targets) {
                event.preventDefault();
                timeline.seek(targets[event.key]);
              }
            }}
          />
        </div>
        <p id={`${id}-help`} className="sr-only">
          Click to choose the nearest stage. Arrow keys move between stages;
          Home and End choose the first and last stage. Space pauses or resumes.
          Reduced motion disables autoplay.
        </p>
      </div>
    </div>
  );
}
