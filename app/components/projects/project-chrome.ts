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

const OVERLAY_TONE = "overlay-tone";
const OVERLAY_TONE_BASE = "overlay-tone-base";
const PANEL = "overlay-panel";
const BUTTON = "overlay-button";
const BUTTON_STRONG = "overlay-button-strong";
const ITEM = "overlay-item";
const ITEM_STRONG = "overlay-item-strong";
const BORDER = "overlay-border";
const BORDER_STRONG = "overlay-border-strong";
const CONTROL_ICON = "overlay-control-icon";
const CONTROL_DANGER = "overlay-button-danger";

function resolveControlChrome(): ControlChrome {
  return {
    icon: CONTROL_ICON,
    action: BUTTON,
    danger: CONTROL_DANGER,
  };
}

export const ADMIN_CONTROL_CHROME: ControlChrome = {
  icon: CONTROL_ICON,
  action: BUTTON,
  danger: CONTROL_DANGER,
};

export function getProjectChrome(
  variant: ProjectChromeVariant,
  darkMode: boolean,
): ProjectChrome {
  const controls = resolveControlChrome();
  switch (variant) {
    case "home":
      return {
        overlay: `${OVERLAY_TONE_BASE} bg-overlay-panel dark:bg-overlay-fill`,
        controls,
      };
    case "html-preview":
      return {
        overlay: OVERLAY_TONE,
        controls,
        shell: "bg-neutral-950 text-overlay-ink",
      };
    case "photo-graph":
      return {
        overlay: `${OVERLAY_TONE_BASE} bg-overlay-fill-soft dark:bg-overlay-fill`,
        controls,
        shell: darkMode
          ? "bg-neutral-950 text-neutral-100"
          : "bg-stone-100 text-neutral-950",
        modal: "bg-overlay-modal text-overlay-ink",
      };
    case "spotify":
      return {
        overlay: `${OVERLAY_TONE_BASE} bg-overlay-fill`,
        controls,
        shell: darkMode
          ? "bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.22),_transparent_40%),linear-gradient(160deg,#04120b_0%,#071a12_45%,#020617_100%)] text-neutral-100"
          : "bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.16),_transparent_45%),linear-gradient(160deg,#f6fff9_0%,#e7f8ef_48%,#f8fafc_100%)] text-neutral-950",
        surface: PANEL,
        button: BUTTON,
        item: ITEM,
        emptyState: BORDER_STRONG,
        avatar: BORDER,
      };
    case "grailed-plus":
      return {
        overlay: `${OVERLAY_TONE_BASE} bg-overlay-fill-strong dark:border-overlay-border-strong`,
        controls,
        shell: darkMode
          ? "bg-[radial-gradient(circle_at_top,_rgba(251,146,60,0.18),_transparent_45%),linear-gradient(168deg,#23160b_0%,#17130f_55%,#090909_100%)] text-neutral-100"
          : "bg-[radial-gradient(circle_at_top,_rgba(251,146,60,0.2),_transparent_45%),linear-gradient(168deg,#fff8f2_0%,#f8f2ee_55%,#f6f5f4_100%)] text-neutral-950",
        surface: `${BORDER} bg-overlay-panel-strong`,
        button: BUTTON_STRONG,
        item: ITEM_STRONG,
      };
  }
}
