-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN "defectiveQty" INTEGER;
ALTER TABLE "Transaction" ADD COLUMN "packCount" INTEGER;
ALTER TABLE "Transaction" ADD COLUMN "packSize" INTEGER;
ALTER TABLE "Transaction" ADD COLUMN "pieces" TEXT;

-- CreateTable
CREATE TABLE "PackStock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemId" TEXT NOT NULL,
    "packSize" INTEGER NOT NULL,
    "sealedCount" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "PackStock_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OpenPack" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemId" TEXT NOT NULL,
    "remaining" INTEGER NOT NULL,
    "originalSize" INTEGER,
    "state" TEXT NOT NULL DEFAULT 'OPEN',
    "openedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "shelfSlotId" TEXT,
    CONSTRAINT "OpenPack_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OpenPack_shelfSlotId_fkey" FOREIGN KEY ("shelfSlotId") REFERENCES "ShelfSlot" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DefectiveItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "packSize" INTEGER,
    "packCount" INTEGER,
    "source" TEXT NOT NULL,
    "transactionId" TEXT,
    "siteId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'QUARANTINED',
    "note" TEXT,
    "reportedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    CONSTRAINT "DefectiveItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DefectiveItem_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "DefectiveItem_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "DefectiveItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Item" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "category" TEXT,
    "baseUnit" TEXT NOT NULL DEFAULT 'pcs',
    "packUnit" TEXT,
    "measure" TEXT NOT NULL DEFAULT 'DISCRETE',
    "scrapThreshold" INTEGER,
    "minStock" INTEGER NOT NULL DEFAULT 0,
    "currentStock" INTEGER NOT NULL DEFAULT 0,
    "scrapStock" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
-- HAND-EDITED: `unit` is renamed to `baseUnit`, not dropped. Prisma's generated
-- diff treats a rename as drop+add and would have discarded the values.
INSERT INTO "new_Item" ("category", "createdAt", "currentStock", "id", "minStock", "name", "sku", "updatedAt", "baseUnit")
SELECT "category", "createdAt", "currentStock", "id", "minStock", "name", "sku", "updatedAt", COALESCE("unit", 'pcs') FROM "Item";
DROP TABLE "Item";
ALTER TABLE "new_Item" RENAME TO "Item";
CREATE UNIQUE INDEX "Item_sku_key" ON "Item"("sku");
CREATE TABLE "new_ShelfSlot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shelfId" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "row" INTEGER NOT NULL,
    "column" INTEGER NOT NULL,
    "tagCode" TEXT NOT NULL,
    "isFrontRow" BOOLEAN NOT NULL DEFAULT false,
    "boxType" TEXT NOT NULL DEFAULT 'FRESH',
    "itemId" TEXT,
    CONSTRAINT "ShelfSlot_shelfId_fkey" FOREIGN KEY ("shelfId") REFERENCES "Shelf" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ShelfSlot_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ShelfSlot" ("boxType", "column", "id", "isFrontRow", "itemId", "row", "shelfId", "side", "tagCode") SELECT "boxType", "column", "id", "isFrontRow", "itemId", "row", "shelfId", "side", "tagCode" FROM "ShelfSlot";
DROP TABLE "ShelfSlot";
ALTER TABLE "new_ShelfSlot" RENAME TO "ShelfSlot";
CREATE INDEX "ShelfSlot_itemId_idx" ON "ShelfSlot"("itemId");
CREATE UNIQUE INDEX "ShelfSlot_shelfId_side_row_column_key" ON "ShelfSlot"("shelfId", "side", "row", "column");
CREATE UNIQUE INDEX "ShelfSlot_shelfId_tagCode_key" ON "ShelfSlot"("shelfId", "tagCode");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "PackStock_itemId_packSize_key" ON "PackStock"("itemId", "packSize");

-- CreateIndex
CREATE INDEX "OpenPack_itemId_state_idx" ON "OpenPack"("itemId", "state");

-- CreateIndex
CREATE INDEX "OpenPack_shelfSlotId_idx" ON "OpenPack"("shelfSlotId");

-- CreateIndex
CREATE INDEX "DefectiveItem_itemId_status_idx" ON "DefectiveItem"("itemId", "status");


-- ---------------------------------------------------------------------------
-- HAND-EDITED DATA MIGRATION
--
-- Existing stock has no pack history: nothing records whether those units
-- arrived sealed, or in what pack size. So all of it becomes a single OPEN pack
-- per item, which is the only honest reading — it is material on the shelf of
-- unknown packaging. Items land as DISCRETE with no packUnit and no
-- scrapThreshold (schema defaults); review each item afterwards and set
-- measure/packUnit/scrapThreshold by hand where it is really continuous.
--
-- This preserves the invariant currentStock = Σ sealed + Σ open, since there
-- are no PackStock rows yet and each item's single OpenPack holds its whole
-- currentStock.
-- ---------------------------------------------------------------------------
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "state", "openedAt")
SELECT
  lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-' ||
  lower(hex(randomblob(2))) || '-' || lower(hex(randomblob(2))) || '-' ||
  lower(hex(randomblob(6))),
  "id",
  "currentStock",
  'OPEN',
  CURRENT_TIMESTAMP
FROM "Item"
WHERE "currentStock" > 0;
