"use client";

import { useSyncExternalStore } from "react";

type Theme = "light" | "dark";
const EVENT = "themechange";

/** The theme showing right now: the visitor's saved pick, or their device setting. */
function currentTheme(): Theme {
  const picked = document.documentElement.getAttribute("data-theme");
  if (picked === "light" || picked === "dark") return picked;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function subscribe(onChange: () => void) {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    media.removeEventListener("change", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

/** Sun/moon button that switches between light and dark, remembered on this device. */
export function ThemeToggle({ className = "" }: { className?: string }) {
  // On the server there's no device setting to read yet, so render an empty button of the same size.
  const theme = useSyncExternalStore<Theme | null>(subscribe, currentTheme, () => null);
  const next: Theme = theme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={() => {
        document.documentElement.setAttribute("data-theme", next);
        try {
          localStorage.setItem("theme", next);
        } catch {
          // Private browsing: the choice lasts until the page is closed.
        }
        window.dispatchEvent(new Event(EVENT));
      }}
      aria-label={theme ? `Switch to ${next} mode` : "Switch light or dark mode"}
      title={theme ? `Switch to ${next} mode` : undefined}
      className={`grid h-11 w-11 flex-none place-items-center rounded-[10px] border border-white/30 text-on-header hover:bg-white/10 ${className}`}
    >
      {theme === "dark" ? (
        // In dark mode: show a sun (tap for light).
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="4.5" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : theme === "light" ? (
        // In light mode: show a moon (tap for dark).
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      ) : null}
    </button>
  );
}
