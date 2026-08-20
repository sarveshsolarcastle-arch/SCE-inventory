-- CreateTable
CREATE TABLE "Dispatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reference" TEXT,
    "siteId" TEXT NOT NULL,
    "dispatchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "userId" TEXT NOT NULL,
    CONSTRAINT "Dispatch_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Dispatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

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
    "userId" TEXT NOT NULL,
    "dispatchId" TEXT,
    CONSTRAINT "Transaction_reversesId_fkey" FOREIGN KEY ("reversesId") REFERENCES "Transaction" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Transaction_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Transaction_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Transaction_dispatchId_fkey" FOREIGN KEY ("dispatchId") REFERENCES "Dispatch" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Transaction" ("appliedPlan", "createdAt", "defectiveQty", "id", "itemId", "note", "packCount", "packSize", "pieces", "quantity", "reason", "reversedAt", "reversesId", "siteId", "type", "userId") SELECT "appliedPlan", "createdAt", "defectiveQty", "id", "itemId", "note", "packCount", "packSize", "pieces", "quantity", "reason", "reversedAt", "reversesId", "siteId", "type", "userId" FROM "Transaction";
DROP TABLE "Transaction";
ALTER TABLE "new_Transaction" RENAME TO "Transaction";
CREATE UNIQUE INDEX "Transaction_reversesId_key" ON "Transaction"("reversesId");
CREATE INDEX "Transaction_reversedAt_idx" ON "Transaction"("reversedAt");
CREATE INDEX "Transaction_itemId_idx" ON "Transaction"("itemId");
CREATE INDEX "Transaction_siteId_idx" ON "Transaction"("siteId");
CREATE INDEX "Transaction_createdAt_idx" ON "Transaction"("createdAt");
CREATE INDEX "Transaction_dispatchId_idx" ON "Transaction"("dispatchId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Dispatch_dispatchedAt_idx" ON "Dispatch"("dispatchedAt");

-- CreateIndex
CREATE INDEX "Dispatch_siteId_idx" ON "Dispatch"("siteId");
