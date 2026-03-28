"use client";

import { Fragment } from "react";
import { Menu, X } from "lucide-react";

import { OverlayControlButton } from "@/app/components/ui/overlay-control-button";

import {
  GRAPH_CONTROL_SLIDERS,
  overlayPanelClass,
  overlayTextClass,
  photoGraphOverlayClass,
  sliderClass,
} from "./config";
import type { GraphControls } from "./types";

type PhotoGraphControlsProps = {
  menuOpen: boolean;
  controls: GraphControls;
  onMenuOpen: () => void;
  onMenuClose: () => void;
  onControlChange: (key: keyof GraphControls, value: boolean | number) => void;
};

export default function PhotoGraphControls({
  menuOpen,
  controls,
  onMenuOpen,
  onMenuClose,
  onControlChange,
}: PhotoGraphControlsProps) {
  return (
    <>
      {!menuOpen && (
        <OverlayControlButton
          onClick={onMenuOpen}
          className="absolute top-[1vmin] left-[1vmin] z-[6]"
          aria-label="Open graph controls"
        >
          <Menu className="h-4 w-4" />
        </OverlayControlButton>
      )}

      {menuOpen && (
        <div
          className={`rounded-md border select-none ${overlayPanelClass} ${photoGraphOverlayClass}`}
        >
          <div className="flex w-full items-start justify-between gap-3">
            <OverlayControlButton
              onClick={onMenuClose}
              className="shrink-0"
              aria-label="Close graph controls"
            >
              <X className="h-4 w-4" />
            </OverlayControlButton>
            <label
              className={`flex min-h-8 flex-1 items-center justify-end gap-2 text-right ${overlayTextClass}`}
            >
              <span>Show connecting lines</span>
              <input
                type="checkbox"
                checked={!controls.hideConnections}
                onChange={(event) =>
                  onControlChange("hideConnections", !event.target.checked)
                }
                className="accent-ink m-0 h-4 w-4 shrink-0"
              />
            </label>
          </div>

          {GRAPH_CONTROL_SLIDERS.map(
            ({ key, label, min, max, scale = 1, formatValue }) => {
              const inputId = `photo-graph-control-${key}`;
              const valueId = `${inputId}-value`;
              const valueText = formatValue(controls[key]);

              return (
                <Fragment key={key}>
                  <div className="flex items-center justify-between gap-3">
                    <label htmlFor={inputId} className={overlayTextClass}>
                      {label}
                    </label>
                    <output
                      id={valueId}
                      htmlFor={inputId}
                      className={`${overlayTextClass} text-right`}
                    >
                      {valueText}
                    </output>
                  </div>
                  <input
                    id={inputId}
                    type="range"
                    min={min}
                    max={max}
                    value={controls[key] / scale}
                    onChange={(event) =>
                      onControlChange(key, Number(event.target.value) * scale)
                    }
                    aria-describedby={valueId}
                    aria-valuetext={valueText}
                    className={`${sliderClass} w-full`}
                  />
                </Fragment>
              );
            },
          )}
        </div>
      )}
    </>
  );
}
