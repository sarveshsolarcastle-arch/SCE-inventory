"use client";

import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import SidebarNav, { type SidebarGroup } from "./SidebarNav";

export default function MobileNav({
  groups,
  user,
}: {
  groups: SidebarGroup[];
  user: { name: string; role: string };
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open navigation menu"
        className="flex h-9 w-9 items-center justify-center rounded-control text-ink-muted hover:bg-surface-sunken hover:text-ink lg:hidden"
      >
        <Menu size={19} />
      </button>

      {open && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="relative flex">
            <SidebarNav
              groups={groups}
              user={user}
              className="flex"
              onNavigate={() => setOpen(false)}
            />
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close navigation menu"
              className="absolute top-4 -right-11 flex h-8 w-8 items-center justify-center rounded-control bg-sidebar text-sidebar-ink"
            >
              <X size={17} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
