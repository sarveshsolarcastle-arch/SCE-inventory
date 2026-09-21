import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/AppShell";
import ThemeScript from "@/components/ThemeScript";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Inventory Management",
  description: "Track stock, sites, and shelf placement",
};

/* Nothing in this app is prerenderable: AppShell calls auth() on every route,
 * and 24 of the 28 pages read live stock straight from the database. They were
 * already dynamic AT RUNTIME for exactly that reason — but a route being
 * dynamic does not stop `next build` from starting a render pass over it, and
 * a page's `await prisma...` gets fired off before the layout's session read
 * aborts that pass. Locally the query answers instantly and the discarded
 * result is never noticed. On Vercel it goes to Turso in Mumbai from a US
 * build machine, hangs, and the build fails: "Failed to build
 * /deliveries/new ... because it took more than 60 seconds".
 *
 * That landed on 2026-09-21 the moment a commit touched the delivery and
 * dispatch forms, because every OTHER page was restored from the build cache
 * and so never re-rendered. A commit touching anything shared — a ui/ button,
 * a tone table — would have invalidated all 24 at once.
 *
 * Set on the ROOT layout so it is inherited by every segment: a per-page fix
 * leaves the next page to be written carrying the same landmine. Declared here
 * rather than per-query with connection() for the same reason. */
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-theme="light"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-full bg-surface-sunken">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
