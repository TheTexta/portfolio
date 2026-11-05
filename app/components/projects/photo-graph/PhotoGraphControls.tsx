"use client";

import { Menu, X } from "lucide-react";
import { useId } from "react";

import { ControlButton } from "@/app/components/ui/control";
import ThemeToggle from "@/app/components/ui/theme-toggle";

import GraphSliderField from "./GraphSliderField";
import {
  GRAPH_CONTROL_SLIDERS,
  photoGraphControlRowClass,
  photoGraphControlsPositionClass,
  photoGraphControlTextClass,
  photoGraphIconControlClass,
  photoGraphPanelClass,
} from "./config";
import type { GraphControls } from "./types";
import styles from "./photo-graph-controls.module.css";

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
  const panelId = useId();

  return (
    <div
      className={`w-[min(18rem,calc(100%-1rem))] border select-none data-[reserve-navigation=true]:w-[min(18rem,calc(100%-4.25rem))] ${photoGraphControlsPositionClass} ${photoGraphPanelClass}`}
      data-reserve-navigation={reserveNavigationSpace || undefined}
    >
      <div
        className={`flex w-full shrink-0 items-stretch justify-between ${photoGraphControlRowClass} ${menuOpen ? "border-b border-ink" : ""}`}
      >
        <ControlButton
          onClick={menuOpen ? onMenuClose : onMenuOpen}
          size="sm"
          className={`shrink-0 border-y-0 border-l-0 focus-visible:-outline-offset-2 ${photoGraphIconControlClass}`}
          aria-label={menuOpen ? "Close graph controls" : "Open graph controls"}
          aria-expanded={menuOpen}
          aria-controls={panelId}
        >
          {menuOpen ? <X aria-hidden /> : <Menu aria-hidden />}
        </ControlButton>

        <label
          className={`flex min-w-0 flex-1 cursor-pointer items-center justify-end gap-2 px-3 text-right has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-ink ${photoGraphControlTextClass} ${photoGraphControlRowClass}`}
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

      <div id={panelId} hidden={!menuOpen}>
        {showTheme && (
          <div className="border-b border-ink px-3">
            <ThemeToggle
              className={`w-full justify-between ${photoGraphControlRowClass}`}
            />
          </div>
        )}

        <div className="flex flex-col gap-3 p-3">
          {GRAPH_CONTROL_SLIDERS.map((config) => (
            <GraphSliderField
              key={config.key}
              config={config}
              controls={controls}
              idPrefix={panelId}
              onChange={onControlChange}
              inputClassName={`${styles.slider} ${photoGraphControlRowClass}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
