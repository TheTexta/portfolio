export type ProjectChromeVariant =
  | "home"
  | "html-preview"
  | "photo-graph"
  | "spotify"
  | "grailed-plus";

type ControlChrome = {
  icon: string;
  action: string;
  danger: string;
};

type ProjectChrome = {
  overlay: string;
  controls: ControlChrome;
  shell?: string;
  surface?: string;
  button?: string;
  item?: string;
  emptyState?: string;
  modal?: string;
  avatar?: string;
};

const OVERLAY_DARK = "overlay-tone-dark";
const OVERLAY_LIGHT_BASE = "overlay-tone-light-base";
const PANEL_DARK = "overlay-panel-dark";
const PANEL_LIGHT = "overlay-panel-light";
const BUTTON_DARK = "overlay-button-dark";
const BUTTON_LIGHT = "overlay-button-light";
const ITEM_DARK = "overlay-item-dark";
const ITEM_LIGHT = "overlay-item-light";
const BORDER_DARK = "overlay-border-dark";
const BORDER_LIGHT = "overlay-border-light";
const BORDER_DARK_STRONG = "overlay-border-dark-strong";
const BORDER_LIGHT_STRONG = "overlay-border-light-strong";
const CONTROL_ICON_DARK = "overlay-control-icon-dark";
const CONTROL_ICON_LIGHT = "overlay-control-icon-light";
const CONTROL_DANGER = "overlay-button-danger";

function resolveControlChrome(darkMode: boolean): ControlChrome {
  return {
    icon: darkMode ? CONTROL_ICON_DARK : CONTROL_ICON_LIGHT,
    action: darkMode ? BUTTON_DARK : BUTTON_LIGHT,
    danger: CONTROL_DANGER,
  };
}

export const ADMIN_CONTROL_CHROME: ControlChrome = {
  icon: "overlay-control-icon-light dark:overlay-control-icon-dark",
  action: "overlay-button-light dark:overlay-button-dark",
  danger: CONTROL_DANGER,
};

export function getProjectChrome(
  variant: ProjectChromeVariant,
  darkMode: boolean,
): ProjectChrome {
  const controls = resolveControlChrome(darkMode);
  switch (variant) {
    case "home":
      return {
        overlay: darkMode
          ? OVERLAY_DARK
          : `${OVERLAY_LIGHT_BASE} bg-surface-overlay-light-panel`,
        controls,
      };
    case "html-preview":
      return {
        overlay: OVERLAY_DARK,
        controls,
        shell: "bg-neutral-950 text-text-overlay-dark",
      };
    case "photo-graph":
      return {
        overlay: darkMode
          ? OVERLAY_DARK
          : `${OVERLAY_LIGHT_BASE} bg-surface-overlay-light-soft`,
        controls,
        shell: darkMode
          ? "bg-neutral-950 text-neutral-100"
          : "bg-stone-100 text-neutral-950",
        modal: darkMode
          ? "bg-surface-overlay-dark-modal text-text-overlay-dark"
          : "bg-surface-overlay-light-modal text-text-overlay-light",
      };
    case "spotify":
      return {
        overlay: darkMode
          ? OVERLAY_DARK
          : `${OVERLAY_LIGHT_BASE} bg-surface-overlay-light`,
        controls,
        shell: darkMode
          ? "bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.22),_transparent_40%),linear-gradient(160deg,#04120b_0%,#071a12_45%,#020617_100%)] text-neutral-100"
          : "bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.16),_transparent_45%),linear-gradient(160deg,#f6fff9_0%,#e7f8ef_48%,#f8fafc_100%)] text-neutral-950",
        surface: darkMode ? PANEL_DARK : PANEL_LIGHT,
        button: darkMode ? BUTTON_DARK : BUTTON_LIGHT,
        item: darkMode ? ITEM_DARK : ITEM_LIGHT,
        emptyState: darkMode ? BORDER_DARK_STRONG : BORDER_LIGHT_STRONG,
        avatar: darkMode ? BORDER_DARK : BORDER_LIGHT,
      };
    case "grailed-plus":
      return {
        overlay: darkMode
          ? `${BORDER_DARK_STRONG} bg-surface-overlay-dark-strong text-text-overlay-dark`
          : `${OVERLAY_LIGHT_BASE} bg-surface-overlay-light-strong`,
        controls,
        shell: darkMode
          ? "bg-[radial-gradient(circle_at_top,_rgba(251,146,60,0.18),_transparent_45%),linear-gradient(168deg,#23160b_0%,#17130f_55%,#090909_100%)] text-neutral-100"
          : "bg-[radial-gradient(circle_at_top,_rgba(251,146,60,0.2),_transparent_45%),linear-gradient(168deg,#fff8f2_0%,#f8f2ee_55%,#f6f5f4_100%)] text-neutral-950",
        surface: darkMode
          ? PANEL_DARK
          : `${BORDER_LIGHT} bg-surface-overlay-light-panel-strong`,
        button: darkMode
          ? BUTTON_DARK
          : `${BORDER_LIGHT} bg-surface-overlay-light-button-strong text-text-overlay-light hover:bg-surface-overlay-light-panel-strong`,
        item: darkMode
          ? `${BORDER_DARK} bg-surface-overlay-dark-item-strong`
          : ITEM_LIGHT,
      };
  }
}
