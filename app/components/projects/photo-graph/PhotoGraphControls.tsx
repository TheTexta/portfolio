"use client";

import { Fragment } from "react";
import { Menu, X } from "lucide-react";

import {
  OverlayControlButton,
} from "@/app/components/ui/overlay-control-button";

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
          className="absolute top-[1vmin] left-[1vmin] z-6"
          aria-label="Open graph controls"
        >
          <Menu className="h-4 w-4" />
        </OverlayControlButton>
      )}

      {menuOpen && (
        <div
          className={`rounded-md border select-none ${overlayPanelClass} ${photoGraphOverlayClass}`}
        >
          <div className="flex w-full justify-end">
            <OverlayControlButton
              onClick={onMenuClose}
              size="sm"
              aria-label="Close graph controls"
            >
              <X className="h-4 w-4" />
            </OverlayControlButton>
          </div>

          <label
            className={`flex items-center justify-center gap-1 ${overlayTextClass}`}
          >
            Hide Connections{" "}
            <input
              type="checkbox"
              checked={controls.hideConnections}
              onChange={(event) =>
                onControlChange("hideConnections", event.target.checked)
              }
              className="m-0 h-2.5"
            />
          </label>

          {GRAPH_CONTROL_SLIDERS.map(({ key, label, min, max, scale = 1 }) => (
            <Fragment key={key}>
              <input
                type="range"
                min={min}
                max={max}
                value={controls[key] / scale}
                onChange={(event) =>
                  onControlChange(key, Number(event.target.value) * scale)
                }
                className={sliderClass}
              />
              <p className={overlayTextClass}>
                {label}: {controls[key].toFixed(2)}
              </p>
            </Fragment>
          ))}
        </div>
      )}
    </>
  );
}
