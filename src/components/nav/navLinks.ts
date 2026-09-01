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
      { href: "/items", label: "Items", capability: "ledger:view", icon: "items" },
    ],
  },
  {
    label: "Stock In",
    links: [
      {
        href: "/deliveries/new",
        label: "Record Delivery",
        capability: "delivery:record",
        icon: "deliveryIn",
      },
      { href: "/deliveries", label: "Deliveries", capability: "ledger:view", icon: "deliveries" },
    ],
  },
  {
    label: "Stock Out",
    links: [
      {
        href: "/dispatches/new",
        label: "Dispatch to Site",
        capability: "stock:issue",
        icon: "dispatchOut",
      },
      { href: "/dispatches", label: "Dispatches", capability: "ledger:view", icon: "dispatches" },
      {
        href: "/transactions/new",
        label: "Issue / Return",
        capability: "stock:issue",
        icon: "issueReturn",
      },
    ],
  },
  {
    label: "Where It Is",
    links: [
      { href: "/sites", label: "Sites", capability: "ledger:view", icon: "sites" },
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
      // Everyone can reach their own account; only admins see Accounts.
      { href: "/account", label: "Your account", capability: null, icon: "account" },
      { href: "/users", label: "Accounts", capability: "user:manage", icon: "users" },
      { href: "/backups", label: "Backups", capability: "backup:manage", icon: "backups" },
    ],
  },
];
