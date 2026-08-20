-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ShelfSlot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shelfId" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "row" INTEGER NOT NULL,
    "column" INTEGER NOT NULL,
    "tagCode" TEXT NOT NULL,
    "isFrontRow" BOOLEAN NOT NULL DEFAULT false,
    "boxType" TEXT NOT NULL DEFAULT 'FRESH',
    "quantity" INTEGER,
    "itemId" TEXT,
    CONSTRAINT "ShelfSlot_shelfId_fkey" FOREIGN KEY ("shelfId") REFERENCES "Shelf" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ShelfSlot_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ShelfSlot" ("column", "id", "isFrontRow", "itemId", "row", "shelfId", "side", "tagCode") SELECT "column", "id", "isFrontRow", "itemId", "row", "shelfId", "side", "tagCode" FROM "ShelfSlot";
DROP TABLE "ShelfSlot";
ALTER TABLE "new_ShelfSlot" RENAME TO "ShelfSlot";
CREATE UNIQUE INDEX "ShelfSlot_shelfId_side_row_column_key" ON "ShelfSlot"("shelfId", "side", "row", "column");
CREATE UNIQUE INDEX "ShelfSlot_shelfId_tagCode_key" ON "ShelfSlot"("shelfId", "tagCode");
CREATE UNIQUE INDEX "ShelfSlot_itemId_boxType_key" ON "ShelfSlot"("itemId", "boxType");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
