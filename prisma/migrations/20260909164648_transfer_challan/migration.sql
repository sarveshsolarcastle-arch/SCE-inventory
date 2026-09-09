-- Batch site-to-site transfers: a Transfer document (mirrors Dispatch) that
-- groups the TRANSFER Transaction lines it covers under one challan number.

-- CreateTable
CREATE TABLE "Transfer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "challanNo" INTEGER NOT NULL,
    "fromSiteId" TEXT NOT NULL,
    "toSiteId" TEXT NOT NULL,
    "transferredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "deliveredBy" TEXT,
    "receivedBy" TEXT,
    "userId" TEXT NOT NULL,
    CONSTRAINT "Transfer_fromSiteId_fkey" FOREIGN KEY ("fromSiteId") REFERENCES "Site" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Transfer_toSiteId_fkey" FOREIGN KEY ("toSiteId") REFERENCES "Site" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Transfer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Backfill: every existing TRANSFER Transaction becomes its own single-line
-- Transfer, numbered by ROW_NUMBER() OVER the WHOLE filtered set in one pass.
--
-- This repo has already shipped the alternative bug once — see
-- 20260909120000_site_delivery_challan's fix commit (78a5454): narrowing the
-- ROW_NUMBER() subquery down to one row (a correlated "WHERE id = outer.id"
-- inside the same filter as the window) leaves the window function exactly
-- one row to number, so every row backfills to 1 and the unique index on
-- challanNo rejects the second. Here the window runs over every TRANSFER row
-- in a single INSERT ... SELECT, with nothing narrowing it row-by-row.
--
-- Transfer.id is derived deterministically from the source Transaction.id
-- ('xfer_' || id) rather than a random blob, so the UPDATE below can find its
-- way back to the right Transfer without an ambiguous join on fromSiteId /
-- toSiteId / createdAt, any of which two distinct transfers could share.
--
-- The NOT NULL guards below matter even though the app always sets both
-- columns on a TRANSFER row: Transaction.fromSiteId/siteId are schema-level
-- OPTIONAL, and Transfer.fromSiteId/toSiteId are NOT NULL, so one malformed
-- legacy row (hand-inserted, or written by code this migration cannot see)
-- would abort the entire migration on a NOT NULL violation. A row this
-- backfill cannot build a real document for is left with transferId NULL —
-- exactly its current, already-valid state — rather than blocking every
-- other row's backfill.
INSERT INTO "Transfer" ("id", "challanNo", "fromSiteId", "toSiteId", "transferredAt", "userId")
SELECT
  'xfer_' || "id",
  ROW_NUMBER() OVER (ORDER BY "createdAt", "id"),
  "fromSiteId",
  "siteId",
  "createdAt",
  "userId"
FROM "Transaction"
WHERE "type" = 'TRANSFER' AND "fromSiteId" IS NOT NULL AND "siteId" IS NOT NULL;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Transaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "packSize" INTEGER,
    "packCount" INTEGER,
    "pieces" TEXT,
    "defectiveQty" INTEGER,
    "appliedPlan" TEXT,
    "reason" TEXT,
    "reversesId" TEXT,
    "reversedAt" DATETIME,
    "itemId" TEXT NOT NULL,
    "siteId" TEXT,
    "fromSiteId" TEXT,
    "userId" TEXT NOT NULL,
    "dispatchId" TEXT,
    "deliveryId" TEXT,
    "transferId" TEXT,
    CONSTRAINT "Transaction_reversesId_fkey" FOREIGN KEY ("reversesId") REFERENCES "Transaction" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Transaction_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Transaction_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Transaction_fromSiteId_fkey" FOREIGN KEY ("fromSiteId") REFERENCES "Site" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Transaction_dispatchId_fkey" FOREIGN KEY ("dispatchId") REFERENCES "Dispatch" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Transaction_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "Delivery" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Transaction_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "Transfer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Transaction" ("appliedPlan", "createdAt", "defectiveQty", "deliveryId", "dispatchId", "fromSiteId", "id", "itemId", "note", "packCount", "packSize", "pieces", "quantity", "reason", "reversedAt", "reversesId", "siteId", "type", "userId") SELECT "appliedPlan", "createdAt", "defectiveQty", "deliveryId", "dispatchId", "fromSiteId", "id", "itemId", "note", "packCount", "packSize", "pieces", "quantity", "reason", "reversedAt", "reversesId", "siteId", "type", "userId" FROM "Transaction";
DROP TABLE "Transaction";
ALTER TABLE "new_Transaction" RENAME TO "Transaction";
CREATE UNIQUE INDEX "Transaction_reversesId_key" ON "Transaction"("reversesId");
CREATE INDEX "Transaction_reversedAt_idx" ON "Transaction"("reversedAt");
CREATE INDEX "Transaction_itemId_idx" ON "Transaction"("itemId");
CREATE INDEX "Transaction_siteId_idx" ON "Transaction"("siteId");
CREATE INDEX "Transaction_createdAt_idx" ON "Transaction"("createdAt");
CREATE INDEX "Transaction_dispatchId_idx" ON "Transaction"("dispatchId");
CREATE INDEX "Transaction_deliveryId_idx" ON "Transaction"("deliveryId");
CREATE INDEX "Transaction_transferId_idx" ON "Transaction"("transferId");
CREATE INDEX "Transaction_fromSiteId_idx" ON "Transaction"("fromSiteId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- Link each backfilled TRANSFER row to the Transfer just created for it —
-- same deterministic id, so this is an unambiguous point lookup rather than a
-- join on fields that are not guaranteed unique. Same NOT NULL guards as the
-- INSERT above: a row that got no Transfer row must not be pointed at a
-- 'xfer_<id>' that was never created, which would fail the transferId FK.
UPDATE "Transaction" SET "transferId" = 'xfer_' || "id"
WHERE "type" = 'TRANSFER' AND "fromSiteId" IS NOT NULL AND "siteId" IS NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Transfer_challanNo_key" ON "Transfer"("challanNo");

-- CreateIndex
CREATE INDEX "Transfer_transferredAt_idx" ON "Transfer"("transferredAt");

-- CreateIndex
CREATE INDEX "Transfer_fromSiteId_idx" ON "Transfer"("fromSiteId");

-- CreateIndex
CREATE INDEX "Transfer_toSiteId_idx" ON "Transfer"("toSiteId");

-- The counter starts above whatever the backfill just used, so the next
-- transfer cannot collide with a number already on a printed challan.
INSERT INTO "Sequence" ("key", "value")
SELECT 'transferChallan', COALESCE(MAX("challanNo"), 0) FROM "Transfer";
