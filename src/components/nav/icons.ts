import {
  LayoutDashboard,
  Package,
  PackagePlus,
  ArrowDownToLine,
  ArrowUpFromLine,
  Truck,
  ArrowLeftRight,
  MapPin,
  Boxes,
  LayoutGrid,
  TrendingUp,
  Recycle,
  AlertTriangle,
  Users,
  UserCog,
  type LucideIcon,
} from "lucide-react";

export type IconName =
  | "dashboard"
  | "items"
  | "deliveryIn"
  | "deliveries"
  | "dispatchOut"
  | "dispatches"
  | "issueReturn"
  | "sites"
  | "materialAtSites"
  | "shelf"
  | "suggestions"
  | "recycle"
  | "defective"
  | "users"
  | "account";

/** Icons cross the server/client boundary as strings (IconName), resolved
 * here — passing a LucideIcon function from a server component throws. */
export const ICONS: Record<IconName, LucideIcon> = {
  dashboard: LayoutDashboard,
  items: Package,
  deliveryIn: PackagePlus,
  deliveries: ArrowDownToLine,
  dispatchOut: ArrowUpFromLine,
  dispatches: Truck,
  issueReturn: ArrowLeftRight,
  sites: MapPin,
  materialAtSites: Boxes,
  shelf: LayoutGrid,
  suggestions: TrendingUp,
  recycle: Recycle,
  defective: AlertTriangle,
  users: Users,
  account: UserCog,
};
