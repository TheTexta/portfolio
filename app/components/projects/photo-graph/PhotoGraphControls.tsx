"use client";

import { Menu, X } from "lucide-react";

import { ControlButton } from "@/app/components/ui/control";
import ThemeToggle from "@/app/components/ui/theme-toggle";

import GraphSliderField from "./GraphSliderField";
import {
  GRAPH_CONTROL_SLIDERS,
  photoGraphControlsPositionClass,
  photoGraphControlTextClass,
  photoGraphPanelClass,
} from "./config";
import type { GraphControls } from "./types";

type PhotoGraphControlsProps = {
  menuOpen: boolean;
  controls: GraphControls;
  reserveNavigationSpace?: boolean;
  showTheme?: boolean;
  onMenuOpen: () => void;
  onMenuClose: () => void;
  onControlChange: (key: keyof GraphControls, value: boolean | number) => void;
};

export default function PhotoGraphControls({
  menuOpen,
  controls,
  reserveNavigationSpace = false,
  showTheme = false,
  onMenuOpen,
  onMenuClose,
  onControlChange,
}: PhotoGraphControlsProps) {
  return (
    <>
      <div
        className={`w-[min(18rem,calc(100%-1rem))] ring-1 ring-ink select-none ring-inset data-[reserve-navigation=true]:w-[min(18rem,calc(100%-4.25rem))] ${photoGraphControlsPositionClass} ${photoGraphPanelClass}`}
        data-reserve-navigation={reserveNavigationSpace || undefined}
      >
        <div
          className={`flex min-h-8 w-full shrink-0 items-start justify-between max-md:min-h-11! [@media(hover:none)]:min-h-11! [@media(orientation:landscape)_and_(max-width:1023px)_and_(max-height:500px)]:min-h-11! [@media(pointer:coarse)]:min-h-11! ${menuOpen ? "border-b border-ink" : ""}`}
        >
          <div className="flex items-start">
            {menuOpen && (
              <ControlButton
                onClick={onMenuClose}
                className="size-8 shrink-0 max-md:size-11 [@media(hover:none)]:size-11 [@media(orientation:landscape)_and_(max-width:1023px)_and_(max-height:500px)]:size-11 [@media(pointer:coarse)]:size-11"
                aria-label="Close graph controls"
              >
                <X />
              </ControlButton>
            )}

            {!menuOpen && (
              <ControlButton
                onClick={onMenuOpen}
                className="size-8 shrink-0 max-md:size-11 [@media(hover:none)]:size-11 [@media(orientation:landscape)_and_(max-width:1023px)_and_(max-height:500px)]:size-11 [@media(pointer:coarse)]:size-11"
                aria-label="Open graph controls"
              >
                <Menu />
              </ControlButton>
            )}
          </div>

          <label
            className={`m-auto flex h-full flex-1 items-center justify-end gap-2 self-stretch pr-3 text-right ${photoGraphControlTextClass}`}
          >
            <span>Show connecting lines</span>
            <input
              type="checkbox"
              checked={!controls.hideConnections}
              onChange={(event) =>
                onControlChange("hideConnections", !event.target.checked)
              }
              className="m-0 size-4 shrink-0 accent-ink"
            />
          </label>
        </div>

        {menuOpen && showTheme && (
          <div className="border-b border-ink px-3">
            <ThemeToggle className="w-full justify-between" />
          </div>
        )}

        {menuOpen && (
          <div className="flex flex-col gap-3 p-3">
            {GRAPH_CONTROL_SLIDERS.map((config) => (
              <GraphSliderField
                key={config.key}
                config={config}
                controls={controls}
                idPrefix="photo-graph-control"
                onChange={onControlChange}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
