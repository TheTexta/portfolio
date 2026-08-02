"use client";

import { type RefObject, useLayoutEffect } from "react";

type RailDirection = "forward" | "reverse";

type RailMotionConfig = {
  direction: RailDirection;
  groupRef: RefObject<HTMLDivElement | null>;
  offsetRatio: number;
  trackRef: RefObject<HTMLDivElement | null>;
  copyCount?: number;
};

type ProjectRailMotionOptions = {
  containerRef: RefObject<HTMLDivElement | null>;
  enabled: boolean;
  rails: readonly RailMotionConfig[];
};

const TARGET_LOOP_SECONDS = 34;
const MIN_LOOP_SECONDS = 25;
const MAX_LOOP_SECONDS = 40;
const SLOW_SPEED_RATIO = 0.12;
const MIN_SLOW_SPEED_PX_PER_SECOND = 5;
const MAX_SLOW_SPEED_PX_PER_SECOND = 8;
const DECELERATION_TIME_SECONDS = 0.22;
const ACCELERATION_TIME_SECONDS = 0.36;
const MAX_FRAME_DELTA_SECONDS = 0.05;
const FINE_POINTER_QUERY = "(hover: hover) and (pointer: fine)";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function modulo(value: number, divisor: number) {
  return ((value % divisor) + divisor) % divisor;
}

function getBaseSpeed(loopWidth: number) {
  const targetSpeed = loopWidth / TARGET_LOOP_SECONDS;
  const minimumSpeed = loopWidth / MAX_LOOP_SECONDS;
  const maximumSpeed = loopWidth / MIN_LOOP_SECONDS;

  return clamp(targetSpeed, minimumSpeed, maximumSpeed);
}

function getSlowSpeed(baseSpeed: number) {
  return clamp(
    baseSpeed * SLOW_SPEED_RATIO,
    MIN_SLOW_SPEED_PX_PER_SECOND,
    MAX_SLOW_SPEED_PX_PER_SECOND,
  );
}

export function useProjectRailMotion({
  containerRef,
  enabled,
  rails,
}: ProjectRailMotionOptions) {
  useLayoutEffect(() => {
    if (!enabled) {
      return;
    }

    const container = containerRef.current;
    const configs = rails;
    if (
      !container ||
      configs.some(
        ({ groupRef, trackRef }) => !groupRef.current || !trackRef.current,
      )
    ) {
      return;
    }

    const finePointerQuery = window.matchMedia(FINE_POINTER_QUERY);
    const reducedMotionQuery = window.matchMedia(REDUCED_MOTION_QUERY);
    const loopWidths = configs.map(() => 0);
    let referenceLoopWidth = 0;
    let distance = 0;
    let baseSpeed = 0;
    let currentSpeed = 0;
    let targetSpeed = 0;
    let frameId: number | null = null;
    let lastTimestamp: number | null = null;
    let pointerInside = false;
    let focusInside = false;

    const shouldAnimate = () =>
      finePointerQuery.matches && !reducedMotionQuery.matches;

    configs.forEach(({ trackRef }) => {
      if (trackRef.current) {
        trackRef.current.style.animation = "none";
      }
    });

    const applyTransforms = () => {
      configs.forEach(({ direction, offsetRatio, trackRef }, index) => {
        const track = trackRef.current;
        const loopWidth = loopWidths[index];
        if (!track || loopWidth <= 0) {
          return;
        }

        const phase = modulo(distance + loopWidth * offsetRatio, loopWidth);
        const x = direction === "forward" ? -phase : -loopWidth + phase;
        track.style.transform = `translate3d(${x.toFixed(3)}px, 0, 0)`;
      });
    };

    const clearTransforms = () => {
      configs.forEach(({ trackRef }) => {
        if (trackRef.current) {
          trackRef.current.style.transform = "";
        }
      });
    };

    const updateTargetSpeed = () => {
      if (!shouldAnimate() || focusInside) {
        targetSpeed = 0;
        return;
      }

      targetSpeed = pointerInside ? getSlowSpeed(baseSpeed) : baseSpeed;
    };

    const measure = () => {
      const previousReferenceWidth = referenceLoopWidth;

      configs.forEach(({ groupRef, copyCount }, index) => {
        const measured = groupRef.current?.getBoundingClientRect().width ?? 0;
        loopWidths[index] = measured / (copyCount ?? 1);
      });

      referenceLoopWidth = loopWidths.find((width) => width > 0) ?? 0;
      if (
        previousReferenceWidth > 0 &&
        referenceLoopWidth > 0 &&
        previousReferenceWidth !== referenceLoopWidth
      ) {
        distance *= referenceLoopWidth / previousReferenceWidth;
      }

      baseSpeed = referenceLoopWidth > 0 ? getBaseSpeed(referenceLoopWidth) : 0;
      if (currentSpeed === 0 && !focusInside) {
        currentSpeed = pointerInside ? getSlowSpeed(baseSpeed) : baseSpeed;
      }
      updateTargetSpeed();
      applyTransforms();
    };

    const tick = (timestamp: number) => {
      if (!shouldAnimate()) {
        frameId = null;
        clearTransforms();
        return;
      }

      if (lastTimestamp == null) {
        lastTimestamp = timestamp;
      }

      const deltaSeconds = Math.min(
        Math.max((timestamp - lastTimestamp) / 1000, 0),
        MAX_FRAME_DELTA_SECONDS,
      );
      lastTimestamp = timestamp;

      if (focusInside) {
        currentSpeed = 0;
      } else {
        const responseTime =
          targetSpeed < currentSpeed
            ? DECELERATION_TIME_SECONDS
            : ACCELERATION_TIME_SECONDS;
        const blend = 1 - Math.exp(-deltaSeconds / responseTime);
        currentSpeed += (targetSpeed - currentSpeed) * blend;

        if (Math.abs(targetSpeed - currentSpeed) < 0.01) {
          currentSpeed = targetSpeed;
        }
      }

      distance += currentSpeed * deltaSeconds;
      applyTransforms();
      frameId = window.requestAnimationFrame(tick);
    };

    const start = () => {
      if (!shouldAnimate() || frameId != null || referenceLoopWidth <= 0) {
        if (!shouldAnimate()) {
          clearTransforms();
        }
        return;
      }

      lastTimestamp = null;
      frameId = window.requestAnimationFrame(tick);
    };

    const stop = () => {
      if (frameId != null) {
        window.cancelAnimationFrame(frameId);
        frameId = null;
      }
      lastTimestamp = null;
    };

    const handlePointerEnter = () => {
      if (!finePointerQuery.matches) {
        return;
      }
      pointerInside = true;
      updateTargetSpeed();
    };

    const handlePointerLeave = () => {
      pointerInside = false;
      updateTargetSpeed();
    };

    const handleFocusIn = () => {
      focusInside = true;
      currentSpeed = 0;
      updateTargetSpeed();
    };

    const handleFocusOut = (event: FocusEvent) => {
      if (
        event.relatedTarget instanceof Node &&
        container.contains(event.relatedTarget)
      ) {
        return;
      }

      focusInside = false;
      updateTargetSpeed();
    };

    const handleMediaChange = () => {
      stop();
      pointerInside = finePointerQuery.matches && container.matches(":hover");
      focusInside = container.contains(document.activeElement);
      measure();

      if (shouldAnimate()) {
        currentSpeed = focusInside
          ? 0
          : pointerInside
            ? getSlowSpeed(baseSpeed)
            : baseSpeed;
        updateTargetSpeed();
        start();
      } else {
        currentSpeed = 0;
        clearTransforms();
      }
    };

    const handleVisibilityChange = () => {
      lastTimestamp = null;
    };

    const resizeObserver = new ResizeObserver(measure);
    configs.forEach(({ groupRef }) => {
      if (groupRef.current) {
        resizeObserver.observe(groupRef.current);
      }
    });

    container.addEventListener("pointerenter", handlePointerEnter);
    container.addEventListener("pointerleave", handlePointerLeave);
    container.addEventListener("focusin", handleFocusIn);
    container.addEventListener("focusout", handleFocusOut);
    finePointerQuery.addEventListener("change", handleMediaChange);
    reducedMotionQuery.addEventListener("change", handleMediaChange);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    pointerInside = finePointerQuery.matches && container.matches(":hover");
    focusInside = container.contains(document.activeElement);
    measure();
    currentSpeed = focusInside
      ? 0
      : pointerInside
        ? getSlowSpeed(baseSpeed)
        : baseSpeed;
    updateTargetSpeed();
    applyTransforms();
    start();

    return () => {
      stop();
      resizeObserver.disconnect();
      container.removeEventListener("pointerenter", handlePointerEnter);
      container.removeEventListener("pointerleave", handlePointerLeave);
      container.removeEventListener("focusin", handleFocusIn);
      container.removeEventListener("focusout", handleFocusOut);
      finePointerQuery.removeEventListener("change", handleMediaChange);
      reducedMotionQuery.removeEventListener("change", handleMediaChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearTransforms();
    };
  }, [containerRef, enabled, rails]);
}
