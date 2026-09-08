"use client";

import { Printer } from "lucide-react";
import Button from "@/components/ui/Button";

/** The only client-side code on the challan page. `window.print()` needs a
 * browser, and the sheet itself is a server component so it never ships the
 * ledger to the client twice. */
export default function PrintButton() {
  return (
    <Button type="button" onClick={() => window.print()}>
      <Printer size={14} className="mr-1.5 inline" aria-hidden />
      Print
    </Button>
  );
}
