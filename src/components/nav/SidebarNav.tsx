"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { activeHref } from "./activeHref";
import { ICONS, type IconName } from "./icons";
import ThemeToggle from "@/components/ThemeToggle";

/** Plain and pre-filtered — capability filtering happens once, server-side,
 * in AppShell. This component never sees a Capability. */
export type SidebarLink = { href: string; label: string; icon: IconName };
export type SidebarGroup = { label: string; links: SidebarLink[] };

export default function SidebarNav({
  groups,
  user,
  className,
  onNavigate,
}: {
  groups: SidebarGroup[];
  user: { name: string; role: string };
  /** Must include a display utility ("flex" or "hidden lg:flex") — deliberately
   * required rather than defaulted, so exactly one display class is ever in
   * play. Tailwind resolves competing declarations by compiled CSS source
   * order, not by position in the class string, so "flex" and "hidden" both
   * present at once is not safe to rely on. */
  className: string;
  onNavigate?: () => void;
}) {
  const initials =
    user.name
      .split(" ")
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";
  const pathname = usePathname();
  const allHrefs = groups.flatMap((g) => g.links.map((l) => l.href));
  const active = activeHref(pathname, allHrefs);

  return (
    <div className={`w-64 shrink-0 flex-col gap-6 bg-sidebar px-4 py-5 text-sidebar-ink ${className}`}>
      <Link href="/dashboard" onClick={onNavigate} className="flex items-center gap-2.5 px-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control bg-accent">
          <svg
            width="17"
            height="17"
            viewBox="0 0 20 20"
            fill="none"
            stroke="white"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 6.5 10 3l7 3.5-7 3.5-7-3.5Z" />
            <path d="M3 6.5v7L10 17l7-3.5v-7" />
            <path d="M10 10.5V17" />
          </svg>
        </div>
        <div>
          <div className="text-[15px] font-extrabold">Site Stores</div>
          <div className="text-[11px] font-semibold text-sidebar-ink-muted">Inventory</div>
        </div>
      </Link>

      <nav className="flex flex-1 flex-col gap-4 overflow-y-auto">
        {groups.map((group) => (
          <div key={group.label} className="flex flex-col gap-0.5">
            <div className="px-2.5 pb-1.5 text-[10.5px] font-bold tracking-widest text-sidebar-ink-muted uppercase">
              {group.label}
            </div>
            {group.links.map((link) => {
              const Icon = ICONS[link.icon];
              const isActive = active === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={onNavigate}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex items-center gap-2.5 rounded-control px-2.5 py-2 text-sm font-semibold ${
                    isActive
                      ? "bg-accent text-accent-ink"
                      : "text-sidebar-ink hover:bg-sidebar-hover"
                  }`}
                >
                  <Icon size={17} className="shrink-0 opacity-90" />
                  {link.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="flex items-center gap-2.5 border-t border-white/10 pt-3.5">
        <div className="flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[12px] font-extrabold text-accent-hover">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-bold text-sidebar-ink">{user.name}</div>
          <div className="truncate text-[11px] font-semibold text-sidebar-ink-muted">
            {user.role}
          </div>
        </div>
        <ThemeToggle className="text-sidebar-ink-muted hover:bg-sidebar-hover hover:text-sidebar-ink" />
      </div>
    </div>
  );
}
