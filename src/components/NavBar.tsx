import Link from "next/link";
import { auth, signOut } from "@/lib/auth";
import { can, type Capability } from "@/lib/permissions";
import type { Role } from "@/generated/prisma/enums";

/** `capability: null` means everyone signed in sees it. */
const links: { href: string; label: string; capability: Capability | null }[] = [
  { href: "/dashboard", label: "Dashboard", capability: null },
  { href: "/dispatches/new", label: "Dispatch to Site", capability: "stock:issue" },
  { href: "/dispatches", label: "Dispatches", capability: "ledger:view" },
  { href: "/transactions/new", label: "Issue / Return", capability: "stock:issue" },
  { href: "/items", label: "Items", capability: "ledger:view" },
  { href: "/sites", label: "Sites", capability: "ledger:view" },
  { href: "/shelf", label: "Shelf", capability: "ledger:view" },
  { href: "/shelf/suggestions", label: "Suggestions", capability: "ledger:view" },
  { href: "/recycle", label: "Recycle", capability: "ledger:view" },
  { href: "/defective", label: "Defective", capability: "ledger:view" },
];

export default async function NavBar() {
  const session = await auth();
  if (!session?.user) return null;

  const role = (session.user as { role?: Role }).role;
  const visible = links.filter((l) => l.capability === null || can(role, l.capability));

  return (
    <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex flex-wrap items-center gap-4">
          <span className="font-semibold text-zinc-900 dark:text-zinc-50">
            Inventory
          </span>
          <nav className="flex flex-wrap gap-3 text-sm">
            {visible.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm text-zinc-600 dark:text-zinc-400">
          <span>
            {session.user.name} ({role})
          </span>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button className="rounded border border-zinc-300 px-2 py-1 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
