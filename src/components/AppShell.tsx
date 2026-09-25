import type { ReactNode } from "react";
import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { auth, signOut } from "@/lib/auth";
import { can } from "@/lib/permissions";
import type { Role } from "@/generated/prisma/enums";
import { pendingApprovalCount } from "@/lib/approvals/queue";
import { NAV_GROUPS } from "@/components/nav/navLinks";
import SidebarNav from "@/components/nav/SidebarNav";
import MobileNav from "@/components/nav/MobileNav";

/** What the count means depends on who is reading it — see queue.ts. An admin
 * is being asked to act; a finance user is watching their own requests, and a
 * pill that said "awaiting your approval" to someone who cannot approve
 * anything would be a lie. Plurals are spelled out rather than derived, the
 * same rule as siteBlockers.ts. */
function pillLabel(count: number, canDecide: boolean): string {
  const noun = count === 1 ? "request" : "requests";
  return canDecide
    ? `${count} ${noun} awaiting your approval`
    : `${count} ${noun} of yours awaiting approval`;
}

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

  // Read off the session rather than a currentUser() round trip: the pill is
  // display-only, and /approvals re-checks for itself against the live row. A
  // stale session role can therefore only show or hide a link, never grant
  // anything — a deliberate trade-off, not an oversight.
  const { id, role } = session.user as { id?: string; role?: Role };

  // The shell's ONE query. pendingApprovalCount is role-gated before it
  // queries, so every role without `approval:view` pays nothing at all — which
  // matters because this component renders on every navigation.
  //
  // LIVENESS: there is no polling and no subscription. An admin sitting still
  // on one page sees nothing until they navigate. AppShell already calls
  // auth(), so the tree is dynamic and the count is fresh on every navigation —
  // which for this app is the whole requirement. Anything more is a websocket
  // nobody asked for.
  const pending = id ? await pendingApprovalCount({ id, role }) : 0;

  const groups = NAV_GROUPS.map((group) => ({
    label: group.label,
    links: group.links
      .filter((link) => link.capability === null || can(role, link.capability))
      .map(({ href, label, icon }) => ({ href, label, icon })),
  })).filter((group) => group.links.length > 0);

  const user = { name: session.user.name ?? "User", role: role ?? "EMPLOYEE" };
  const pillText = pillLabel(pending, can(role, "approval:decide"));

  return (
    <div className="flex min-h-screen">
      {/* data-print="hide" is the app's one print convention: the @media print
          block in globals.css drops everything carrying it, so a printed page
          is the page's own content and nothing else. Added for the delivery
          challan, which has to come off the printer as a document rather than
          as a screenshot of the app. */}
      <SidebarNav groups={groups} user={user} className="hidden lg:flex" />

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          data-print="hide"
          className="relative flex h-16 shrink-0 items-center gap-3 border-b border-line bg-surface px-4 lg:px-8"
        >
          <MobileNav groups={groups} user={user} />
          {/* The castle mark on the left, on its own — no wordmark. It is
              nearly square, so unlike the old wide logo it is narrow enough
              to show at every phone width. Only the dark theme needs the
              white chip: the mark is navy and vanishes on a dark header. */}
          {/* eslint-disable-next-line @next/next/no-img-element -- a fixed
              local file; next/image's optimizer buys nothing here. */}
          <img
            src="/logo-mark.png"
            alt="Solar Castle"
            className="h-8 w-auto shrink-0 rounded-control object-contain md:h-10 lg:-ml-5 xl:h-[52px] dark:bg-white dark:p-1"
          />
          {/* The approvals banner, centred on the header BAR from xl up, where
              the logo on the left and Sign out on the right leave it clear of
              both. Below that it stays in the flow and takes the space between
              them, so it can never overlap either on a phone. The wrapper lets
              clicks through (pointer-events-none) so only the pill itself is
              clickable — otherwise it would blanket the whole header at xl. */}
          <div className="flex min-w-0 flex-1 justify-center xl:pointer-events-none xl:absolute xl:inset-0 xl:items-center">
            {pending > 0 && (
              <Link
                href="/approvals"
                // The sentence needs room the mobile header does not have. At
                // 375px it wrapped to two lines and burst this h-16 shrink-0
                // header, taking Sign out onto two lines with it. Below `sm` the
                // icon and the count carry it — the pill links to Approvals and
                // the full sentence stays available to screen readers and on
                // hover — and `shrink-0` stops it being squeezed either way.
                aria-label={pillText}
                title={pillText}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-control border border-warn-line bg-warn-soft px-3 py-1.5 text-sm font-semibold whitespace-nowrap text-warn-ink hover:border-warn-ink xl:pointer-events-auto"
              >
                <ClipboardCheck className="h-4 w-4 shrink-0" aria-hidden />
                <span className="sm:hidden">{pending}</span>
                <span className="hidden sm:inline">{pillText}</span>
              </Link>
            )}
          </div>
          <div className="hidden flex-1 xl:block" />
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
