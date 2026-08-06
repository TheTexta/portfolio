"use client";

import { Fragment } from "react";
import { Menu, Minimize, X } from "lucide-react";

import { ControlButton } from "@/app/components/ui/control";
import ThemeToggle from "@/app/components/ui/theme-toggle";

import {
  GRAPH_CONTROL_SLIDERS,
  photoGraphControlsPositionClass,
  photoGraphControlTextClass,
  photoGraphPanelClass,
  sliderClass,
} from "./config";
import type { GraphControls } from "./types";
import { ActionButton, ActionLink } from "../../ui/editorial";

type PhotoGraphControlsProps = {
  menuOpen: boolean;
  controls: GraphControls;
  showTheme?: boolean;
  onMenuOpen: () => void;
  onMenuClose: () => void;
  onControlChange: (key: keyof GraphControls, value: boolean | number) => void;
};

export default function PhotoGraphControls({
  menuOpen,
  controls,
  showTheme = false,
  onMenuOpen,
  onMenuClose,
  onControlChange,
}: PhotoGraphControlsProps) {
  return (
    <>
      <div
        className={`border select-none ${photoGraphControlsPositionClass} ${photoGraphPanelClass}`}
      >
        <div
          className={`flex w-full items-start justify-between ${menuOpen ? "border-rule border-b" : ""}`}
        >
          <div className="flex items-start">
            {menuOpen && (
              <ControlButton
                onClick={onMenuClose}
                className="h-8 w-8 border-y-0 border-l-0"
                aria-label="Close graph controls"
              >
                <X />
              </ControlButton>
            )}

            {!menuOpen && (
              <ControlButton
                onClick={onMenuOpen}
                className="h-8 w-8 border-y-0 border-l-0"
                aria-label="Open graph controls"
              >
                <Menu />
              </ControlButton>
            )}
          </div>

          <label
            className={`m-auto flex h-full flex-1 items-center justify-end gap-2 pr-3 text-right ${photoGraphControlTextClass}`}
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

        {menuOpen && showTheme && (
          <div className="border-rule border-b px-3">
            <ThemeToggle className="w-full justify-between" />
          </div>
        )}

        {menuOpen && (
          <div className="flex flex-col gap-3 p-3">
            {GRAPH_CONTROL_SLIDERS.map(
              ({ key, label, min, max, scale = 1, formatValue }) => {
                const inputId = `photo-graph-control-${key}`;
                const valueId = `${inputId}-value`;
                const valueText = formatValue(controls[key]);

                return (
                  <Fragment key={key}>
                    <div className="flex items-center justify-between gap-3">
                      <label
                        htmlFor={inputId}
                        className={photoGraphControlTextClass}
                      >
                        {label}
                      </label>
                      <output
                        id={valueId}
                        htmlFor={inputId}
                        className={`${photoGraphControlTextClass} text-right`}
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
            )}{" "}
          </div>
        )}
      </div>
    </>
  );
}
