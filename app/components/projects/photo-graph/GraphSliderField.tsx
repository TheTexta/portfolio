import type { GraphControls, GraphSliderConfig } from "./types";

type GraphSliderFieldProps = {
  config: GraphSliderConfig;
  controls: GraphControls;
  idPrefix: string;
  onChange: (key: GraphSliderConfig["key"], value: number) => void;
  compact?: boolean;
};

export default function GraphSliderField({
  config,
  controls,
  idPrefix,
  onChange,
  compact = false,
}: GraphSliderFieldProps) {
  const { key, label, min, max, scale = 1, formatValue } = config;
  const inputId = `${idPrefix}-${key}`;
  const valueId = `${inputId}-value`;
  const valueText = formatValue(controls[key]);

  return (
    <div className={compact ? "contents" : "space-y-2"}>
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={inputId} className="text-sm font-medium">
          {label}
        </label>
        <output id={valueId} htmlFor={inputId} className="text-sm opacity-70">
          {valueText}
        </output>
      </div>
      <input
        id={inputId}
        type="range"
        min={min}
        max={max}
        value={controls[key] / scale}
        onChange={(event) => onChange(key, Number(event.target.value) * scale)}
        aria-describedby={valueId}
        aria-valuetext={valueText}
        className="range-sm h-2 w-full border-none bg-surface accent-ink"
      />
    </div>
  );
}
