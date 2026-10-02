"use client";

import type { ReactNode } from "react";
import { DraftScopeContext } from "@/lib/useFormDraft";

/** Tells useFormDraft whose drafts it is saving. Mounted once, by AppShell. */
export default function DraftScope({ userId, children }: { userId: string; children: ReactNode }) {
  return <DraftScopeContext.Provider value={userId}>{children}</DraftScopeContext.Provider>;
}
