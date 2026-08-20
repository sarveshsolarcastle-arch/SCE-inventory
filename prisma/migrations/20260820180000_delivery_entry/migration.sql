-- CreateTable
CREATE TABLE "Delivery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reference" TEXT,
    "supplier" TEXT,
    "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "siteId" TEXT,
    "userId" TEXT NOT NULL,
    CONSTRAINT "Delivery_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Delivery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_DefectiveItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "packSize" INTEGER,
    "packCount" INTEGER,
    "source" TEXT NOT NULL,
    "transactionId" TEXT,
    "deliveryId" TEXT,
    "siteId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'QUARANTINED',
    "replacedByDeliveryId" TEXT,
    "note" TEXT,
    "reportedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    CONSTRAINT "DefectiveItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DefectiveItem_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "DefectiveItem_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "Delivery" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "DefectiveItem_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "DefectiveItem_replacedByDeliveryId_fkey" FOREIGN KEY ("replacedByDeliveryId") REFERENCES "Delivery" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "DefectiveItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_DefectiveItem" ("id", "itemId", "note", "packCount", "packSize", "quantity", "reportedAt", "siteId", "source", "status", "transactionId", "userId") SELECT "id", "itemId", "note", "packCount", "packSize", "quantity", "reportedAt", "siteId", "source", "status", "transactionId", "userId" FROM "DefectiveItem";
DROP TABLE "DefectiveItem";
ALTER TABLE "new_DefectiveItem" RENAME TO "DefectiveItem";
CREATE INDEX "DefectiveItem_itemId_status_idx" ON "DefectiveItem"("itemId", "status");
CREATE INDEX "DefectiveItem_deliveryId_idx" ON "DefectiveItem"("deliveryId");
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
    "userId" TEXT NOT NULL,
    "dispatchId" TEXT,
    "deliveryId" TEXT,
    CONSTRAINT "Transaction_reversesId_fkey" FOREIGN KEY ("reversesId") REFERENCES "Transaction" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Transaction_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Transaction_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Transaction_dispatchId_fkey" FOREIGN KEY ("dispatchId") REFERENCES "Dispatch" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Transaction_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "Delivery" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Transaction" ("appliedPlan", "createdAt", "defectiveQty", "dispatchId", "id", "itemId", "note", "packCount", "packSize", "pieces", "quantity", "reason", "reversedAt", "reversesId", "siteId", "type", "userId") SELECT "appliedPlan", "createdAt", "defectiveQty", "dispatchId", "id", "itemId", "note", "packCount", "packSize", "pieces", "quantity", "reason", "reversedAt", "reversesId", "siteId", "type", "userId" FROM "Transaction";
DROP TABLE "Transaction";
ALTER TABLE "new_Transaction" RENAME TO "Transaction";
CREATE UNIQUE INDEX "Transaction_reversesId_key" ON "Transaction"("reversesId");
CREATE INDEX "Transaction_reversedAt_idx" ON "Transaction"("reversedAt");
CREATE INDEX "Transaction_itemId_idx" ON "Transaction"("itemId");
CREATE INDEX "Transaction_siteId_idx" ON "Transaction"("siteId");
CREATE INDEX "Transaction_createdAt_idx" ON "Transaction"("createdAt");
CREATE INDEX "Transaction_dispatchId_idx" ON "Transaction"("dispatchId");
CREATE INDEX "Transaction_deliveryId_idx" ON "Transaction"("deliveryId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Delivery_receivedAt_idx" ON "Delivery"("receivedAt");

-- CreateIndex
CREATE INDEX "Delivery_siteId_idx" ON "Delivery"("siteId");
