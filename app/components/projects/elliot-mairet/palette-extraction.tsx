"use client";

import Image from "next/image";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import AnimationPlayer from "@/app/components/ui/animation-player";
import type { AnimationFrame } from "@/lib/animation/timeline";
import {
  createPaletteRenderer,
  layoutPaletteScene,
  PALETTE_LAYOUT,
  PALETTE_STAGES,
  palettePoseAt,
  paletteTileRectAt,
  PALETTE_DURATION,
  type PalettePose,
} from "@/lib/elliot-mairet/palette-animation";
import recording from "@/public/projects/elliot-mairet/palette-extraction/mmcq-v1/recording.json";

const { width, height, photo } = PALETTE_LAYOUT;
const { swatches, tiles } = layoutPaletteScene(recording);
const mix = (from: number, to: number, amount: number) =>
  from + (to - from) * amount;

export default function PaletteExtraction() {
  const root = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const palette = useRef<HTMLOListElement>(null);
  const renderer = useRef<ReturnType<typeof createPaletteRenderer> | null>(
    null,
  );
  const imageReady = useRef(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const onFrame = useCallback(
    (frame: AnimationFrame) => renderer.current?.(frame),
    [],
  );

  useLayoutEffect(() => {
    const element = root.current;
    const surface = canvas.current;
    const paletteElement = palette.current;
    if (!element || !surface || !paletteElement) return;
    const context = surface.getContext("2d");
    if (!context) return; // The server-rendered photograph/palette stay usable.
    let disposed = false;
    let pose = palettePoseAt(PALETTE_DURATION);
    const draw = (next: PalettePose) => {
      if (disposed || !element.isConnected) return;
      pose = next;
      if (!imageReady.current) return;
      context.setTransform(
        surface.width / width,
        0,
        0,
        surface.height / height,
        0,
        0,
      );
      context.clearRect(0, 0, width, height);
      paletteElement.style.opacity = String(pose.palette);
      element.dataset.sampleProgress = String(pose.sample);
      element.dataset.groupProgress = String(pose.group);
      element.dataset.paletteProgress = String(pose.palette);
      const opacity = pose.sample * (1 - pose.palette);
      if (opacity < 0.001) return;
      context.globalAlpha = opacity;
      const sampling = pose.group === 0 && pose.palette === 0;
      const scaleX = surface.width / width;
      const scaleY = surface.height / height;
      // Shared, device-pixel-aligned edges prevent hairline seams on mobile
      // and other fractional canvas scales, not just the explicit 1px gap.
      if (sampling) context.resetTransform();
      for (const tile of tiles) {
        const rect = paletteTileRectAt(tile, pose);
        context.fillStyle =
          pose.palette === 0
            ? tile.hex
            : `rgb(${tile.rgb.map((channel, index) => Math.round(mix(channel, tile.targetRgb[index], pose.palette))).join(" ")})`;
        if (sampling) {
          const left = Math.round(rect.x * scaleX);
          const right = Math.round((rect.x + rect.width) * scaleX);
          const top = Math.round(rect.y * scaleY);
          const bottom = Math.round((rect.y + rect.height) * scaleY);
          context.fillRect(left, top, right - left, bottom - top);
        } else context.fillRect(rect.x, rect.y, rect.width, rect.height);
      }
      context.globalAlpha = 1;
    };
    renderer.current = createPaletteRenderer(draw);
    const resize = () => {
      if (disposed || !element.isConnected) return;
      const scale = Math.min(devicePixelRatio || 1, 2);
      surface.width = Math.round(element.clientWidth * scale);
      surface.height = Math.round(
        ((element.clientWidth * height) / width) * scale,
      );
      draw(pose);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    resize();
    return () => {
      // Layout cleanup precedes DOM/ref teardown; queued observer/frame callbacks
      // still close over stable elements and become inert immediately.
      disposed = true;
      renderer.current = null;
      observer.disconnect();
    };
  }, []);

  return (
    <figure
      className="my-10"
      aria-label={`${recording.palette.length}-swatch MMCQ extraction from Elliot Mairet’s photograph`}
    >
      <AnimationPlayer
        label="Colour extraction"
        stages={PALETTE_STAGES}
        onFrame={onFrame}
        ready={ready}
      >
        <div
          ref={root}
          data-palette-scene
          className="relative aspect-[28/23] w-full"
        >
          <Image
            src={recording.photograph.asset}
            alt="Golden leaves and dark branches against blue sky, photographed by Elliot Mairet."
            width={recording.photograph.width}
            height={recording.photograph.height}
            unoptimized
            className={`absolute h-auto ${failed ? "invisible" : ""}`}
            style={{
              left: `${(photo.x / width) * 100}%`,
              top: `${(photo.y / height) * 100}%`,
              width: `${(photo.width / width) * 100}%`,
            }}
            onLoad={() => {
              imageReady.current = true;
              setReady(true);
            }}
            onError={() => setFailed(true)}
          />
          <canvas
            ref={canvas}
            width={width}
            height={height}
            aria-hidden
            className="pointer-events-none absolute inset-0 size-full"
          />
          <ol
            ref={palette}
            aria-label="Extracted palette, in production selection order"
            className="absolute m-0 flex justify-between [&&]:list-none [&&]:p-0 [&&>li]:m-0"
            style={{
              left: `${(swatches.x / width) * 100}%`,
              top: `${(swatches.y / height) * 100}%`,
              width: `${(swatches.width / width) * 100}%`,
              height: `${(swatches.height / height) * 100}%`,
            }}
          >
            {recording.palette.map((colour) => (
              <li
                key={colour.hex}
                style={{
                  width: `${(swatches.size / swatches.width) * 100}%`,
                  backgroundColor: colour.hex,
                }}
              >
                <span className="sr-only">{colour.hex}</span>
              </li>
            ))}
          </ol>
          {failed ? (
            <p
              role="status"
              className="absolute inset-x-0 top-1/3 text-center text-sm text-muted"
            >
              The photograph could not load. Its extracted palette is shown
              below.
            </p>
          ) : null}
        </div>
      </AnimationPlayer>
      <figcaption className="mt-3 text-[0.8125rem] leading-relaxed text-muted">
        Current MMCQ model, frozen 23 November 2026: {recording.palette.length}{" "}
        genuine swatches in selection order, not weight order. Sample grouping
        and timing are illustrative, not solver steps or measured latency.{" "}
        <a
          href={recording.photograph.pageUrl}
          className="text-ink underline underline-offset-4"
        >
          Photograph: Elliot Mairet.
        </a>
      </figcaption>
    </figure>
  );
}
