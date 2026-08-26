"use client";

import { type RefObject, useCallback } from "react";

import { getPhotoGraphLinkValue } from "@/lib/photo-graph/force-graph";

import type { PhotoGraphLink, PhotoGraphNode } from "./types";

type UsePhotoGraphIntroArgs = {
  revealProgressRef: RefObject<number>;
  linkColor: (link: PhotoGraphLink) => string;
};

function resolveNode(node: string | PhotoGraphNode) {
  return typeof node === "object" ? node : null;
}

export function usePhotoGraphIntro({
  revealProgressRef,
  linkColor,
}: UsePhotoGraphIntroArgs) {
  const linkCanvasObject = useCallback(
    (
      link: PhotoGraphLink,
      context: CanvasRenderingContext2D,
      globalScale: number,
    ) => {
      if (getPhotoGraphLinkValue(link) <= 0) {
        return;
      }

      const source = resolveNode(link.source);
      const target = resolveNode(link.target);
      if (
        !source ||
        !target ||
        !Number.isFinite(source.x) ||
        !Number.isFinite(source.y) ||
        !Number.isFinite(target.x) ||
        !Number.isFinite(target.y)
      ) {
        return;
      }

      const progress = revealProgressRef.current;
      if (progress <= 0) {
        return;
      }

      const sourceX = source.x ?? 0;
      const sourceY = source.y ?? 0;
      const targetX = target.x ?? 0;
      const targetY = target.y ?? 0;
      const midpointX = (sourceX + targetX) / 2;
      const midpointY = (sourceY + targetY) / 2;

      context.save();
      context.beginPath();
      context.moveTo(sourceX, sourceY);
      context.lineTo(
        sourceX + (midpointX - sourceX) * progress,
        sourceY + (midpointY - sourceY) * progress,
      );
      context.moveTo(targetX, targetY);
      context.lineTo(
        targetX + (midpointX - targetX) * progress,
        targetY + (midpointY - targetY) * progress,
      );
      context.strokeStyle = linkColor(link);
      context.lineWidth = 1 / Math.max(globalScale, Number.EPSILON);
      context.stroke();
      context.restore();
    },
    [linkColor, revealProgressRef],
  );

  return { linkCanvasObject };
}