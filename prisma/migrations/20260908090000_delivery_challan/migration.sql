-- Delivery challan: project identity on Site, an official number and the two
-- names on Dispatch, and the counter that allocates the number.

-- AlterTable
ALTER TABLE "Site" ADD COLUMN "address" TEXT;
ALTER TABLE "Site" ADD COLUMN "customerName" TEXT;
ALTER TABLE "Site" ADD COLUMN "projectCode" TEXT;

-- CreateTable
CREATE TABLE "Sequence" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" INTEGER NOT NULL DEFAULT 0
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Dispatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "challanNo" INTEGER NOT NULL,
    "reference" TEXT,
    "deliveredBy" TEXT,
    "receivedBy" TEXT,
    "siteId" TEXT NOT NULL,
    "dispatchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "userId" TEXT NOT NULL,
    CONSTRAINT "Dispatch_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Dispatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
-- challanNo is NOT NULL with no default, so existing rows have to be numbered
-- here or the copy fails. Numbering by dispatch date (id as the tie-break, so
-- the result is deterministic on a re-run) means the historical series reads in
-- the order the material actually went out.
INSERT INTO "new_Dispatch" ("challanNo", "dispatchedAt", "id", "note", "reference", "siteId", "userId")
SELECT ROW_NUMBER() OVER (ORDER BY "dispatchedAt", "id"), "dispatchedAt", "id", "note", "reference", "siteId", "userId" FROM "Dispatch";
DROP TABLE "Dispatch";
ALTER TABLE "new_Dispatch" RENAME TO "Dispatch";
CREATE UNIQUE INDEX "Dispatch_challanNo_key" ON "Dispatch"("challanNo");
CREATE INDEX "Dispatch_dispatchedAt_idx" ON "Dispatch"("dispatchedAt");
CREATE INDEX "Dispatch_siteId_idx" ON "Dispatch"("siteId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- The counter starts above whatever the backfill just used, so the next
-- dispatch cannot collide with a number already on a printed challan.
INSERT INTO "Sequence" ("key", "value")
SELECT 'challan', COALESCE(MAX("challanNo"), 0) FROM "Dispatch";
