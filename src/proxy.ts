import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
// Imported from capabilities.ts, not permissions.ts: this file runs in the
// proxy, and permissions.ts pulls in Prisma and NextAuth at module scope.
import { can, canRequest, HOME_FOR_ROLE, type Capability } from "@/lib/capabilities";
import type { Role } from "@/generated/prisma/enums";

/** Route prefix → the capability needed to open it. First match wins, so list
 * the most specific paths first.
 *
 * This layer is convenience, not security: it stops people landing on pages
 * that are useless to them. The real enforcement is `requireCapability` inside
 * each server action, because actions are directly invocable regardless of
 * which page the caller came from.
 *
 * SINCE STAGE 6 IT ALSO ADMITS A ROLE THAT MAY ONLY *REQUEST* WHAT THE PAGE
 * DOES. Finance reaching /sites/new to raise a request is the point of the
 * approvals work, and the action behind the form decides which of the two it
 * gets — `runOrRequest` executes for a holder and enqueues for a requester.
 * This landed WITH /approvals and not before, deliberately: opening the form
 * while its submit had nowhere to land would have swapped a broken submit for
 * a 404, which is the same broken-form bug fixed on the site detail page in
 * Part 1, reintroduced through the front door.
 *
 * /users and /backups stay shut to everyone but admin regardless, and that is
 * a fact rather than a setting: `user:manage` and `backup:manage` appear in no
 * REQUESTABLE list, so `canRequest` is false for them for every role. */
const ROUTE_CAPABILITIES: [prefix: string, capability: Capability][] = [
  ["/items/new", "item:manage"],
  ["/approvals", "approval:view"],
  ["/sites/new", "site:manage"],
  ["/shelf/new", "shelf:manage"],
  ["/transactions/new", "stock:issue"],
  ["/deliveries/new", "delivery:record"],
  ["/dispatches/new", "stock:issue"],
  ["/users", "user:manage"],
  ["/backups", "backup:manage"],
];

function requiredCapability(pathname: string): Capability | null {
  for (const [prefix, capability] of ROUTE_CAPABILITIES) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return capability;
  }
  return null;
}

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { pathname, origin } = req.nextUrl;
  const isLoginPage = pathname === "/login";

  if (!isLoggedIn && !isLoginPage) {
    return NextResponse.redirect(new URL("/login", origin));
  }

  if (isLoggedIn && isLoginPage) {
    return NextResponse.redirect(new URL("/dashboard", origin));
  }

  if (isLoggedIn) {
    const role = (req.auth?.user as { role?: Role } | undefined)?.role;
    const needed = requiredCapability(pathname);
    if (needed && !can(role, needed) && !canRequest(role, needed)) {
      return NextResponse.redirect(
        new URL(role ? HOME_FOR_ROLE[role] : "/dashboard", origin)
      );
    }
  }
});

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
