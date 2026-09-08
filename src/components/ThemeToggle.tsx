"use client";

import { useLayoutEffect, useSyncExternalStore } from "react";
import { Sun, Moon } from "lucide-react";

type Theme = "light" | "dark";

/* -------------------------------------------------------------------------
 * The theme is NOT React state. It lives in localStorage, is applied to
 * <html data-theme> by ThemeScript before React runs (see
 * node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md),
 * and can change in another tab. That is the definition of an external store,
 * so this component subscribes to it rather than mirroring it.
 *
 * This used to be `useState` plus an effect that called `setTheme` on mount to
 * catch up with what the inline script had already decided. That is the
 * cascading render `react-hooks/set-state-in-effect` warns about — every mount
 * rendered twice — and it silently ignored a change made in another tab.
 * ---------------------------------------------------------------------- */

const STORAGE_KEY = "theme";
/** Fired on the local tab, because `storage` only reaches OTHER tabs. */
const CHANGE_EVENT = "themechange";

function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

/** Must return a stable primitive: useSyncExternalStore compares snapshots by
 * Object.is on every render, and a fresh object each call would loop forever. */
function getSnapshot(): Theme {
  return localStorage.getItem(STORAGE_KEY) === "dark" ? "dark" : "light";
}

/** There is no localStorage on the server. React uses this for the server
 * render AND for hydration, then re-renders with the real snapshot — which is
 * why reading storage here cannot cause a hydration mismatch. */
function getServerSnapshot(): Theme {
  return "light";
}

export default function ThemeToggle({ className = "" }: { className?: string }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Updating the DOM from React state is what effects ARE for, so this one
  // stays. It also re-applies the attribute after Strict Mode's dev remount
  // clears what ThemeScript set. No setState, so no cascading render.
  useLayoutEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    localStorage.setItem(STORAGE_KEY, next);
    // Applied here as well as in the effect: the attribute must change in the
    // same tick as the click, or the page repaints once in the old theme.
    document.documentElement.setAttribute("data-theme", next);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-muted hover:bg-surface-sunken hover:text-ink ${className}`}
    >
      {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
