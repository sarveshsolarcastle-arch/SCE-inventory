import type { ReactNode } from "react";
import { auth, signOut } from "@/lib/auth";
import { can } from "@/lib/permissions";
import type { Role } from "@/generated/prisma/enums";
import { NAV_GROUPS } from "@/components/nav/navLinks";
import SidebarNav from "@/components/nav/SidebarNav";
import MobileNav from "@/components/nav/MobileNav";

/**
 * The only place auth() and can() are called for navigation. Filters the nav
 * once here and hands the client components a plain, pre-filtered array —
 * capability filtering must not drift client-side. No session renders
 * children bare, preserving the old NavBar's behaviour of vanishing on the
 * login page.
 */
export default async function AppShell({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session?.user) {
    return <>{children}</>;
  }

  const role = (session.user as { role?: Role }).role;
  const groups = NAV_GROUPS.map((group) => ({
    label: group.label,
    links: group.links
      .filter((link) => link.capability === null || can(role, link.capability))
      .map(({ href, label, icon }) => ({ href, label, icon })),
  })).filter((group) => group.links.length > 0);

  const user = { name: session.user.name ?? "User", role: role ?? "EMPLOYEE" };

  return (
    <div className="flex min-h-screen">
      <SidebarNav groups={groups} user={user} className="hidden lg:flex" />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-line bg-surface px-4 lg:px-8">
          <MobileNav groups={groups} user={user} />
          <div className="flex-1" />
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button className="rounded-control border border-line-strong px-3 py-1.5 text-sm font-semibold text-ink hover:bg-surface-sunken">
              Sign out
            </button>
          </form>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
