/** Shared class names so every form and button looks the same. */
export const ui = {
  label: "text-[13px] font-semibold text-fg",
  input:
    "min-h-12 w-full rounded-[10px] border border-line bg-surface px-3 text-[16px] text-fg placeholder:text-muted focus:border-accent focus:outline-2 focus:outline-accent/30",
  primary:
    "flex min-h-12 w-full items-center justify-center rounded-[10px] bg-accent px-4 font-bold text-on-accent disabled:opacity-60",
  secondary:
    "flex min-h-11 items-center justify-center gap-2 rounded-[10px] border border-line bg-surface px-3 text-[14px] font-semibold text-fg no-underline disabled:opacity-60",
  alert: "rounded-[10px] bg-bad-bg px-3 py-2.5 text-[14px] text-bad",
  ok: "rounded-[10px] bg-ok-bg px-3 py-2.5 text-[14px] text-ok",
  card: "rounded-card border border-line bg-surface",
};
