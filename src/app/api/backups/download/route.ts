import { NextResponse } from "next/server";
import { NotPermittedError, requireCapability } from "@/lib/permissions";
import { dumpDatabase } from "@/lib/backup/dump";

/** Streams a fresh, right-now dump of the live database as a file download —
 * the "Download a copy" button on /backups. Independent of the nightly
 * GitHub job: this is for taking a manual off-site copy on demand (e.g. into
 * your own Drive), and it re-checks the capability itself rather than
 * trusting that the button was hidden from the wrong role. */
export async function GET() {
  try {
    await requireCapability("backup:manage");
  } catch (error) {
    if (error instanceof NotPermittedError) {
      return NextResponse.json({ message: "Your account cannot download backups" }, { status: 403 });
    }
    return NextResponse.json({ message: "Not signed in" }, { status: 401 });
  }

  let sql: string;
  try {
    ({ sql } = await dumpDatabase());
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Could not build the backup" },
      { status: 500 },
    );
  }

  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(sql, {
    headers: {
      "Content-Type": "application/sql; charset=utf-8",
      "Content-Disposition": `attachment; filename="inventory-${date}.sql"`,
    },
  });
}
