export type ProjectChromeVariant =
  | "home"
  | "html-preview"
  | "photo-graph"
  | "spotify"
  | "grailed-plus";

type ProjectChrome = {
  overlay: string;
  shell?: string;
  surface?: string;
  button?: string;
  item?: string;
  emptyState?: string;
  modal?: string;
  avatar?: string;
};

export function getProjectChrome(
  variant: ProjectChromeVariant,
  darkMode: boolean,
): ProjectChrome {
  switch (variant) {
    case "home":
      return {
        overlay: darkMode
          ? "border-white/10 bg-black/35 text-neutral-100"
          : "border-black/10 bg-white/70 text-neutral-950",
      };
    case "html-preview":
      return {
        overlay: "border-white/10 bg-black/35 text-neutral-100",
        shell: "bg-neutral-950 text-white",
      };
    case "photo-graph":
      return {
        overlay: darkMode
          ? "border-white/10 bg-black/35 text-neutral-100"
          : "border-black/10 bg-white/35 text-neutral-950",
        shell: darkMode
          ? "bg-neutral-950 text-neutral-100"
          : "bg-stone-100 text-neutral-950",
        modal: darkMode
          ? "bg-black/75 text-neutral-100"
          : "bg-white/75 text-neutral-950",
      };
    case "spotify":
      return {
        overlay: darkMode
          ? "border-white/10 bg-black/35 text-neutral-100"
          : "border-black/10 bg-white/50 text-neutral-950",
        shell: darkMode
          ? "bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.22),_transparent_40%),linear-gradient(160deg,#04120b_0%,#071a12_45%,#020617_100%)] text-neutral-100"
          : "bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.16),_transparent_45%),linear-gradient(160deg,#f6fff9_0%,#e7f8ef_48%,#f8fafc_100%)] text-neutral-950",
        surface: darkMode
          ? "border-white/10 bg-black/30"
          : "border-black/10 bg-white/70",
        button: darkMode
          ? "border-white/15 bg-white/8 text-neutral-100 hover:bg-white/12"
          : "border-black/10 bg-white/85 text-neutral-950 hover:bg-white",
        item: darkMode
          ? "border-white/10 bg-white/5"
          : "border-black/10 bg-black/[0.03]",
        emptyState: darkMode ? "border-white/15" : "border-black/15",
        avatar: darkMode ? "border-white/10" : "border-black/10",
      };
    case "grailed-plus":
      return {
        overlay: darkMode
          ? "border-white/15 bg-black/40 text-neutral-100"
          : "border-black/10 bg-white/60 text-neutral-950",
        shell: darkMode
          ? "bg-[radial-gradient(circle_at_top,_rgba(251,146,60,0.18),_transparent_45%),linear-gradient(168deg,#23160b_0%,#17130f_55%,#090909_100%)] text-neutral-100"
          : "bg-[radial-gradient(circle_at_top,_rgba(251,146,60,0.2),_transparent_45%),linear-gradient(168deg,#fff8f2_0%,#f8f2ee_55%,#f6f5f4_100%)] text-neutral-950",
        surface: darkMode
          ? "border-white/10 bg-black/30"
          : "border-black/10 bg-white/78",
        button: darkMode
          ? "border-white/15 bg-white/8 text-neutral-100 hover:bg-white/12"
          : "border-black/10 bg-white/90 text-neutral-950 hover:bg-white",
        item: darkMode
          ? "border-white/10 bg-white/7"
          : "border-black/10 bg-black/[0.03]",
      };
  }
}
