import type { Capability } from "@/lib/permissions";
import type { IconName } from "./icons";

export type NavLink = {
  href: string;
  label: string;
  /** null means everyone signed in sees it. */
  capability: Capability | null;
  icon: IconName;
};

export type NavGroup = {
  label: string;
  links: NavLink[];
};

/** Data only. Grouping mirrors how the roles already split — see
 * CAPABILITIES in src/lib/permissions.ts. */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    links: [
      { href: "/dashboard", label: "Dashboard", capability: null, icon: "dashboard" },
      { href: "/ledger", label: "Ledger", capability: "ledger:view", icon: "ledger" },
      { href: "/items", label: "Items", capability: "ledger:view", icon: "items" },
    ],
  },
  {
    label: "Stock In",
    links: [
      {
        href: "/deliveries/new",
        label: "Record Stock_In",
        capability: "delivery:record",
        icon: "deliveryIn",
      },
      { href: "/deliveries", label: "Stock_In Ledger", capability: "ledger:view", icon: "deliveries" },
    ],
  },
  {
    label: "Direct to Site",
    links: [
      {
        href: "/site-deliveries/new",
        label: "Site Stock_In",
        capability: "delivery:record",
        icon: "deliveryIn",
      },
      { href: "/site-deliveries", label: "Site Ledger", capability: "ledger:view", icon: "deliveries" },
    ],
  },
  {
    label: "Material Delivery",
    links: [
      {
        href: "/dispatches/new",
        label: "Stock_Out",
        capability: "stock:issue",
        icon: "dispatchOut",
      },
      { href: "/dispatches", label: "Delivery Ledger", capability: "ledger:view", icon: "dispatches" },
    ],
  },
  {
    // Returns are their own movement, not a footnote to sending material out:
    // they run the other way, they are the only thing that clears a pickup
    // flag, and they are the one path that can quarantine goods on arrival.
    label: "Returns",
    links: [
      {
        href: "/transactions/new",
        label: "Site Returns",
        // stock:return, not stock:issue — this screen only brings material
        // home. Every role holding one holds the other today, so nothing
        // changes on screen; it stops the gate lying about what the page does.
        capability: "stock:return",
        icon: "issueReturn",
      },
      {
        // The Ledger, pre-filtered — not a second page. `activeHref` compares
        // query params so this and plain "Ledger" cannot both light up.
        href: "/ledger?type=RETURN",
        label: "Returns Ledger",
        capability: "ledger:view",
        icon: "ledger",
      },
    ],
  },
  {
    label: "Where It Is",
    links: [
      { href: "/sites", label: "Sites", capability: "ledger:view", icon: "sites" },
      { href: "/transfers", label: "Transfers", capability: "ledger:view", icon: "transfers" },
      {
        href: "/at-sites",
        label: "Material at Sites",
        capability: "ledger:view",
        icon: "materialAtSites",
      },
      { href: "/shelf", label: "Shelf", capability: "ledger:view", icon: "shelf" },
      {
        href: "/shelf/suggestions",
        label: "Suggestions",
        capability: "ledger:view",
        icon: "suggestions",
      },
    ],
  },
  {
    label: "Exceptions",
    links: [
      { href: "/recycle", label: "Recycle", capability: "ledger:view", icon: "recycle" },
      { href: "/defective", label: "Defective", capability: "ledger:view", icon: "defective" },
    ],
  },
  {
    label: "Settings",
    links: [
      // `approval:view`, not `canRequest`: ADMIN and FINANCE hold it, EMPLOYEE
      // does not, so the filter AppShell already applies is the whole gate.
      // Softening it to "anyone who may request something" would show the queue
      // to a role that cannot read it — /approvals redirects on the same
      // capability.
      { href: "/approvals", label: "Approvals", capability: "approval:view", icon: "approvals" },
      // Everyone can reach their own account; only admins see Accounts.
      { href: "/account", label: "Your account", capability: null, icon: "account" },
      { href: "/users", label: "Accounts", capability: "user:manage", icon: "users" },
      { href: "/backups", label: "Backups", capability: "backup:manage", icon: "backups" },
    ],
  },
];
