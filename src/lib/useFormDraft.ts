"use client";

/* -------------------------------------------------------------------------
 * Keeps a half-filled form across navigation and reloads.
 *
 * WHY. The batch forms (Stock_Out, Stock_In, site challan) hold every row in
 * React state, so leaving the page — to register an item you just found, say —
 * threw away eleven typed rows. This writes the form's state to sessionStorage
 * on every change and hands it back when the form mounts again.
 *
 * sessionStorage, NOT localStorage, on purpose: it belongs to one browser tab
 * and dies with it, so a draft cannot sit around for weeks looking like fresh
 * work. It survives navigating away and back, and a reload. Keys carry the
 * signed-in user's id (DraftScope, mounted by AppShell), so a different person
 * signing in on the same tab never sees the previous person's rows — while the
 * same person signing back in after a session timeout still finds theirs.
 *
 * ORDER MATTERS. The form renders its blank defaults first (it is server-
 * rendered, and reading storage during render would be a hydration mismatch);
 * the draft is applied in an effect afterwards. Nothing may be SAVED until that
 * has happened, or the blank first render would overwrite the draft it is about
 * to restore — hence `hydrated`.
 * ---------------------------------------------------------------------- */

import { createContext, useContext, useEffect, useRef, useState } from "react";

/** Whose drafts these are. Provided by <DraftScope> in AppShell; the fallback
 * only applies outside the shell, where no form that saves drafts lives. */
export const DraftScopeContext = createContext<string>("anon");

const PREFIX = "draft:";

/** Saved drafts are unvalidated JSON, so restore code reads fields through
 * these rather than trusting their types. */
export function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** Storage can throw (private windows, blocked site data, quota) or hold
 * something that is not JSON. A draft is a convenience: any failure means
 * "no draft", never an error on the form. */
function read(key: string): unknown {
  try {
    const raw = window.sessionStorage.getItem(PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    window.sessionStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* quota or blocked — losing the draft is acceptable, breaking typing is not */
  }
}

function remove(key: string) {
  try {
    window.sessionStorage.removeItem(PREFIX + key);
  } catch {
    /* nothing to do */
  }
}

/**
 * @param storageKey  One per form (and per mode of it) — drafts must not mix.
 * @param snapshot    Everything worth keeping, as plain JSON-able data.
 * @param isEmpty     True when the form holds nothing worth restoring; the draft
 *                    is then deleted instead of saved, so an untouched form
 *                    never reports a "restored draft".
 * @param restore     Applies a saved snapshot to the form's state. Receives
 *                    unvalidated data: the caller must tolerate missing fields
 *                    and stale ids (an item deleted since).
 */
export function useFormDraft<T>(
  storageKey: string,
  snapshot: T,
  isEmpty: boolean,
  restore: (saved: Partial<T>) => void
) {
  const scope = useContext(DraftScopeContext);
  const key = `${scope}:${storageKey}`;
  const [hydrated, setHydrated] = useState(false);
  const [restored, setRestored] = useState(false);
  // Held in a ref so the mount effect can stay dependency-free: it must run
  // once, and `restore` is a new closure on every render.
  const restoreRef = useRef(restore);
  // Updated in an effect, not during render. It is declared before the mount
  // effect below, so by the time that runs the ref holds this render's closure.
  useEffect(() => {
    restoreRef.current = restore;
  });
  // Set by clear(): a successful submit has navigated, or is about to, and the
  // state that is still on screen must not be written back as a new draft.
  const cleared = useRef(false);

  /* eslint-disable react-hooks/set-state-in-effect --
     This IS the "synchronise with an external system" case the rule describes:
     sessionStorage cannot be read during render (the form is server-rendered,
     so that would be a hydration mismatch), so the draft is pulled into state
     once, after mount. It runs once per key, not on every render. */
  useEffect(() => {
    const saved = read(key);
    if (saved && typeof saved === "object" && !Array.isArray(saved)) {
      restoreRef.current(saved as Partial<T>);
      setRestored(true);
    }
    setHydrated(true);
  }, [key]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const json = JSON.stringify(snapshot);
  useEffect(() => {
    if (!hydrated || cleared.current) return;
    if (isEmpty) remove(key);
    else write(key, JSON.parse(json));
  }, [hydrated, json, isEmpty, key]);

  return {
    /** A draft was applied when the form opened. */
    restored,
    /** After a successful save: the work is recorded, so the draft is not. */
    clear() {
      cleared.current = true;
      remove(key);
    },
    /** "Start over": forget the draft and hide the notice. The caller resets
     * its own state, which then saves as empty (and so removes the key). */
    discard() {
      cleared.current = false;
      remove(key);
      setRestored(false);
    },
  };
}
