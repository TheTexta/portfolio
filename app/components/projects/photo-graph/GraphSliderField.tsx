"use client";

import { useEffect, useEffectEvent, useRef } from "react";

import { cn } from "@/lib/cn";

import type { GraphControls, GraphSliderConfig } from "./types";

type GraphSliderFieldProps = {
  config: GraphSliderConfig;
  controls: GraphControls;
  idPrefix: string;
  onChange: (key: GraphSliderConfig["key"], value: number) => void;
  compact?: boolean;
  horizontalScroll?: boolean;
  textClassName?: string;
  inputClassName?: string;
};

export default function GraphSliderField({
  config,
  controls,
  idPrefix,
  onChange,
  compact = false,
  horizontalScroll = false,
  textClassName,
  inputClassName,
}: GraphSliderFieldProps) {
  const { key, label, min, max, scale = 1, formatValue } = config;
  const inputId = `${idPrefix}-${key}`;
  const valueId = `${inputId}-value`;
  const valueText = formatValue(controls[key]);
  const fieldRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const wheelRemainderRef = useRef(0);
  const lastWheelAtRef = useRef(0);

  const handleHorizontalWheel = useEffectEvent((event: WheelEvent) => {
    const input = inputRef.current;
    if (
      !input ||
      input.disabled ||
      event.defaultPrevented ||
      event.ctrlKey ||
      !Number.isFinite(event.deltaX) ||
      Math.abs(event.deltaX) <= Math.abs(event.deltaY)
    )
      return;

    const width = input.getBoundingClientRect().width;
    const range = Number(input.max) - Number(input.min);
    if (width <= 0 || range <= 0) return;
    const unit =
      event.deltaMode === WheelEvent.DOM_DELTA_LINE
        ? Number.parseFloat(getComputedStyle(input).lineHeight) || 16
        : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
          ? width
          : 1;
    if (event.cancelable) event.preventDefault();
    event.stopPropagation();
    if (event.timeStamp - lastWheelAtRef.current > 200)
      wheelRemainderRef.current = 0;
    lastWheelAtRef.current = event.timeStamp;
    const deltaPixels = Math.max(-width, Math.min(width, event.deltaX * unit));
    if (
      (deltaPixels > 0 && input.valueAsNumber >= Number(input.max)) ||
      (deltaPixels < 0 && input.valueAsNumber <= Number(input.min))
    ) {
      wheelRemainderRef.current = 0;
      return;
    }
    wheelRemainderRef.current +=
      ((deltaPixels / width) * range) / (Number(input.step) || 1);
    const steps = Math.trunc(wheelRemainderRef.current);
    if (!steps) return;
    wheelRemainderRef.current -= steps;
    const previousValue = input.valueAsNumber;
    // Native stepping preserves the input's bounds/step and its latest value,
    // even when several trackpad events arrive before a React render.
    input.stepUp(steps);
    if (
      input.valueAsNumber === Number(input.min) ||
      input.valueAsNumber === Number(input.max)
    )
      wheelRemainderRef.current = 0;
    if (input.valueAsNumber !== previousValue)
      onChange(key, input.valueAsNumber * scale);
  });

  useEffect(() => {
    const field = fieldRef.current;
    if (!horizontalScroll || !field) return;
    field.addEventListener("wheel", handleHorizontalWheel, { passive: false });
    return () => field.removeEventListener("wheel", handleHorizontalWheel);
  }, [horizontalScroll]);

  return (
    <div ref={fieldRef} className={compact ? "contents" : "space-y-2"}>
      <div className="flex items-center justify-between gap-3">
        <label
          htmlFor={inputId}
          className={cn("text-sm font-medium", textClassName)}
        >
          {label}
        </label>
        <output
          id={valueId}
          htmlFor={inputId}
          className={cn("text-sm opacity-70", textClassName)}
        >
          {valueText}
        </output>
      </div>
      <input
        ref={inputRef}
        id={inputId}
        type="range"
        min={min}
        max={max}
        value={controls[key] / scale}
        onChange={(event) => {
          wheelRemainderRef.current = 0;
          onChange(key, Number(event.target.value) * scale);
        }}
        aria-describedby={valueId}
        aria-valuetext={valueText}
        className={cn(
          "range-sm h-2 w-full border-none bg-surface accent-ink",
          inputClassName,
        )}
      />
    </div>
  );
}
