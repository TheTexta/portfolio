"use client";

import { Menu, X } from "lucide-react";
import { useId } from "react";

import { ControlButton } from "@/app/components/ui/control";
import ThemeToggle from "@/app/components/ui/theme-toggle";
import Toggle from "@/app/components/ui/toggle";

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
  reserveResetSpace?: boolean;
  showTheme?: boolean;
  show3D?: boolean;
  threeDEnabled?: boolean;
  threeDLoading?: boolean;
  threeDDisabled?: boolean;
  modeMessage?: string;
  on3DChange?: (enabled: boolean) => void;
  onMenuOpen: () => void;
  onMenuClose: () => void;
  onControlChange: (key: keyof GraphControls, value: boolean | number) => void;
};

export default function PhotoGraphControls({
  menuOpen,
  controls,
  reserveNavigationSpace = false,
  reserveResetSpace = false,
  showTheme = false,
  show3D = false,
  threeDEnabled = false,
  threeDLoading = false,
  threeDDisabled = false,
  modeMessage = "",
  on3DChange,
  onMenuOpen,
  onMenuClose,
  onControlChange,
}: PhotoGraphControlsProps) {
  const panelId = useId();

  return (
    <div
      className={`w-[min(18rem,calc(100%-1rem))] border select-none data-[reserve-navigation=true]:w-[min(18rem,calc(100%-4.25rem))] data-[reserve-reset=true]:w-[min(18rem,calc(100%-8.75rem))] ${photoGraphControlsPositionClass} ${photoGraphPanelClass}`}
      data-reserve-navigation={reserveNavigationSpace || undefined}
      data-reserve-reset={reserveResetSpace || undefined}
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
          className={`${styles.invertingControl} flex min-w-0 flex-1 cursor-pointer items-center justify-end gap-2 px-3 text-right has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-ink ${photoGraphControlTextClass} ${photoGraphControlRowClass}`}
        >
          <span>Show connecting lines</span>
          <input
            type="checkbox"
            checked={!controls.hideConnections}
            onChange={(event) =>
              onControlChange("hideConnections", !event.target.checked)
            }
            className={styles.checkbox}
          />
        </label>
      </div>

      <div id={panelId} hidden={!menuOpen}>
        {show3D && (
          <div className="border-b border-ink px-3">
            <Toggle
              label="3D view"
              checked={threeDEnabled}
              disabled={threeDDisabled}
              onChange={(enabled) => on3DChange?.(enabled)}
              className={`${styles.invertingControl} w-full justify-between ${photoGraphControlRowClass}`}
            />
            <p
              role="status"
              aria-live="polite"
              className="text-xs leading-relaxed empty:hidden"
            >
              {threeDLoading ? "Loading 3D view…" : modeMessage}
            </p>
          </div>
        )}
        {showTheme && (
          <div className="border-b border-ink px-3">
            <ThemeToggle
              className={`${styles.invertingControl} w-full justify-between ${photoGraphControlRowClass}`}
            />
          </div>
        )}

        <div className="flex flex-col gap-3 p-3">
          {GRAPH_CONTROL_SLIDERS.map((config) => (
            <GraphSliderField
              key={config.key}
              config={
                threeDEnabled &&
                !threeDLoading &&
                (config.key === "distMinMult" || config.key === "distMaxMult")
                  ? {
                      ...config,
                      formatValue: (value) =>
                        config.formatValue(value).replace(" px", " units"),
                    }
                  : config
              }
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
