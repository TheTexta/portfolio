"use client";

import { type RefObject, useLayoutEffect } from "react";

import { getRailAutoplayWeight } from "./project-rail-scroll";

type RailDirection = "forward" | "reverse";

type RailMotionConfig = {
  direction: RailDirection;
  groupRef: RefObject<HTMLDivElement | null>;
  offsetRatio: number;
  trackRef: RefObject<HTMLDivElement | null>;
};

type ProjectRailMotionOptions = {
  allowManualScroll: boolean;
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
const WHEEL_EVENT_GAP_SECONDS = 0.08;
const HANDOFF_EASING_SECONDS = 0.12;
const MANUAL_RECLAIM_SPEED_RATIO = 2;
const FINE_POINTER_QUERY = "(hover: hover) and (pointer: fine)";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function getBaseSpeed(travelWidth: number) {
  const targetSpeed = travelWidth / TARGET_LOOP_SECONDS;
  const minimumSpeed = travelWidth / MAX_LOOP_SECONDS;
  const maximumSpeed = travelWidth / MIN_LOOP_SECONDS;

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
  allowManualScroll,
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
    const travelWidths = configs.map(() => 0);
    const railOffsets = configs.map(() => 0);
    const initialChildren = configs.map(({ groupRef }) =>
      groupRef.current ? Array.from(groupRef.current.children) : [],
    );
    let referenceTravelWidth = 0;
    let baseSpeed = 0;
    let currentSpeed = 0;
    let targetSpeed = 0;
    let frameId: number | null = null;
    let lastTimestamp: number | null = null;
    let lastWheelTimestamp: number | null = null;
    let wheelIntervalSeconds = 1 / 60;
    let autoplayWeight = 1;
    let targetAutoplayWeight = 1;
    let pointerInside = false;
    let focusInside = false;

    const shouldAnimate = () =>
      finePointerQuery.matches && !reducedMotionQuery.matches;

    configs.forEach(({ trackRef }) => {
      if (trackRef.current) {
        trackRef.current.style.animation = "none";
      }
    });

    const recycleCards = (index: number) => {
      const group = configs[index]?.groupRef.current;
      if (!group) {
        return;
      }

      const gap = Number.parseFloat(getComputedStyle(group).columnGap) || 0;
      railOffsets[index] %= travelWidths[index];

      while (railOffsets[index] < 0) {
        const lastCard = group.lastElementChild as HTMLElement | null;
        const cardSpan = (lastCard?.getBoundingClientRect().width ?? 0) + gap;
        if (!lastCard || cardSpan <= 0) {
          break;
        }

        railOffsets[index] += cardSpan;
        group.prepend(lastCard);
      }

      let firstCard = group.firstElementChild as HTMLElement | null;

      while (firstCard) {
        const cardSpan = firstCard.getBoundingClientRect().width + gap;
        if (cardSpan <= 0 || railOffsets[index] < cardSpan) {
          break;
        }

        railOffsets[index] -= cardSpan;
        group.append(firstCard);
        firstCard = group.firstElementChild as HTMLElement | null;
      }
    };

    const applyTransforms = () => {
      configs.forEach(({ trackRef }, index) => {
        const track = trackRef.current;
        if (!track || travelWidths[index] <= 0) {
          return;
        }

        recycleCards(index);
        track.style.transform = `translate3d(${-railOffsets[index].toFixed(3)}px, 0, 0)`;
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
      configs.forEach(({ groupRef, offsetRatio }, index) => {
        const measured = groupRef.current?.getBoundingClientRect().width ?? 0;
        const previousWidth = travelWidths[index];
        travelWidths[index] = Math.max(0, measured);

        if (previousWidth > 0 && measured > 0 && previousWidth !== measured) {
          railOffsets[index] *= measured / previousWidth;
        } else if (previousWidth === 0 && measured > 0) {
          railOffsets[index] = measured * offsetRatio;
        }
      });

      referenceTravelWidth = travelWidths.find((width) => width > 0) ?? 0;
      baseSpeed =
        referenceTravelWidth > 0 ? getBaseSpeed(referenceTravelWidth) : 0;
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
        autoplayWeight = 1;
        targetAutoplayWeight = 1;
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

      // Recover after a missed wheel sample, not a fixed pause. Trackpad events
      // already contain momentum; only autoplay is integrated between events.
      const missedWheelSample =
        lastWheelTimestamp == null ||
        timestamp - lastWheelTimestamp >=
          Math.min(1 / 30, wheelIntervalSeconds * 1.5) * 1000;
      const frameAutoplayWeight = missedWheelSample ? 1 : targetAutoplayWeight;
      autoplayWeight +=
        (frameAutoplayWeight - autoplayWeight) *
        (1 - Math.exp(-deltaSeconds / HANDOFF_EASING_SECONDS));
      if (autoplayWeight > 0.999) autoplayWeight = 1;

      railOffsets.forEach((offset, index) => {
        railOffsets[index] =
          offset + currentSpeed * autoplayWeight * deltaSeconds;
      });
      applyTransforms();
      frameId = window.requestAnimationFrame(tick);
    };

    const start = () => {
      if (!shouldAnimate() || frameId != null || referenceTravelWidth <= 0) {
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
      lastWheelTimestamp = null;
      updateTargetSpeed();
    };

    const handleWheel = (event: WheelEvent) => {
      if (
        !shouldAnimate() ||
        focusInside ||
        referenceTravelWidth <= 0 ||
        event.defaultPrevented ||
        event.ctrlKey ||
        Math.abs(event.deltaX) <= Math.abs(event.deltaY)
      ) {
        return;
      }

      if (event.cancelable) event.preventDefault();

      const now = performance.now();
      const elapsedSeconds =
        lastWheelTimestamp == null
          ? Infinity
          : (now - lastWheelTimestamp) / 1000;
      const deltaSeconds =
        elapsedSeconds > WHEEL_EVENT_GAP_SECONDS
          ? 1 / 60
          : Math.max(elapsedSeconds, 1 / 240);
      const unit =
        event.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? Number.parseFloat(getComputedStyle(container).lineHeight) || 16
          : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? container.clientWidth
            : 1;
      const deltaPixels = event.deltaX * unit;
      const nextAutoplayWeight = getRailAutoplayWeight(
        deltaPixels,
        deltaSeconds,
        currentSpeed,
      );

      if (
        elapsedSeconds > WHEEL_EVENT_GAP_SECONDS ||
        Math.abs(deltaPixels) / deltaSeconds >=
          currentSpeed * MANUAL_RECLAIM_SPEED_RATIO
      ) {
        // A fresh gesture takes control immediately. Small fluctuations in an
        // existing momentum tail must not repeatedly interrupt the handoff.
        autoplayWeight = nextAutoplayWeight === 1 ? 1 : 0;
        targetAutoplayWeight = nextAutoplayWeight;
      } else {
        targetAutoplayWeight = Math.max(
          targetAutoplayWeight,
          nextAutoplayWeight,
        );
        if (targetAutoplayWeight === 0) autoplayWeight = 0;
      }
      lastWheelTimestamp = now;
      wheelIntervalSeconds = deltaSeconds;
      railOffsets.forEach((offset, index) => {
        railOffsets[index] = offset + deltaPixels * (1 - autoplayWeight);
      });
      applyTransforms();
    };

    const handleFocusIn = () => {
      focusInside = true;
      lastWheelTimestamp = null;
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
      lastWheelTimestamp = null;
      autoplayWeight = 1;
      targetAutoplayWeight = 1;
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
      lastWheelTimestamp = null;
    };

    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(container);
    configs.forEach(({ groupRef }) => {
      if (groupRef.current) {
        resizeObserver.observe(groupRef.current);
      }
    });

    container.addEventListener("pointerenter", handlePointerEnter);
    container.addEventListener("pointerleave", handlePointerLeave);
    container.addEventListener("focusin", handleFocusIn);
    container.addEventListener("focusout", handleFocusOut);
    if (allowManualScroll) {
      container.addEventListener("wheel", handleWheel, { passive: false });
    }
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
      container.removeEventListener("wheel", handleWheel);
      finePointerQuery.removeEventListener("change", handleMediaChange);
      reducedMotionQuery.removeEventListener("change", handleMediaChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearTransforms();
      configs.forEach(({ groupRef }, index) => {
        const group = groupRef.current;
        if (!group) {
          return;
        }
        initialChildren[index].forEach((child) => group.append(child));
      });
    };
  }, [allowManualScroll, containerRef, enabled, rails]);
}
