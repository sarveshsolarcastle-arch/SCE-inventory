-- Inventory database dump — 2026-09-09T19:04:41.114Z
PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
DROP TABLE IF EXISTS "Site";
DROP TABLE IF EXISTS "Shelf";
DROP TABLE IF EXISTS "PackStock";
DROP TABLE IF EXISTS "OpenPack";
DROP TABLE IF EXISTS "Item";
DROP TABLE IF EXISTS "ShelfSlot";
DROP TABLE IF EXISTS "Delivery";
DROP TABLE IF EXISTS "DefectiveItem";
DROP TABLE IF EXISTS "SitePickup";
DROP TABLE IF EXISTS "Transaction";
DROP TABLE IF EXISTS "User";
DROP TABLE IF EXISTS "_prisma_migrations";
DROP TABLE IF EXISTS "ApprovalRequest";
DROP TABLE IF EXISTS "Sequence";
DROP TABLE IF EXISTS "Dispatch";
CREATE TABLE "Site" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
, "address" TEXT, "customerName" TEXT, "projectCode" TEXT);
CREATE TABLE "Shelf" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "rows" INTEGER NOT NULL,
    "columns" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "PackStock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemId" TEXT NOT NULL,
    "packSize" INTEGER NOT NULL,
    "sealedCount" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "PackStock_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
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
CREATE TABLE "Item" (
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
CREATE TABLE "ShelfSlot" (
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
CREATE TABLE "DefectiveItem" (
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
CREATE TABLE "SitePickup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "siteId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "note" TEXT,
    "markedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    CONSTRAINT "SitePickup_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SitePickup_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SitePickup_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE TABLE "Transaction" (
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
    CONSTRAINT "Transaction_reversesId_fkey" FOREIGN KEY ("reversesId") REFERENCES "Transaction" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Transaction_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Transaction_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Transaction_fromSiteId_fkey" FOREIGN KEY ("fromSiteId") REFERENCES "Site" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Transaction_dispatchId_fkey" FOREIGN KEY ("dispatchId") REFERENCES "Dispatch" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Transaction_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "Delivery" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'EMPLOYEE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "_prisma_migrations" (
    "id"                    TEXT PRIMARY KEY NOT NULL,
    "checksum"              TEXT NOT NULL,
    "finished_at"           DATETIME,
    "migration_name"        TEXT NOT NULL,
    "logs"                  TEXT,
    "rolled_back_at"        DATETIME,
    "started_at"            DATETIME NOT NULL DEFAULT current_timestamp,
    "applied_steps_count"   INTEGER UNSIGNED NOT NULL DEFAULT 0
);
CREATE TABLE "ApprovalRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "args" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "reason" TEXT,
    "targetKey" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestedById" TEXT NOT NULL,
    "decidedById" TEXT,
    "decidedAt" DATETIME,
    "decisionNote" TEXT,
    CONSTRAINT "ApprovalRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ApprovalRequest_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE TABLE "Sequence" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE "Dispatch" (
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
CREATE UNIQUE INDEX "Item_sku_key" ON "Item"("sku");
CREATE INDEX "ShelfSlot_itemId_idx" ON "ShelfSlot"("itemId");
CREATE UNIQUE INDEX "ShelfSlot_shelfId_side_row_column_key" ON "ShelfSlot"("shelfId", "side", "row", "column");
CREATE UNIQUE INDEX "ShelfSlot_shelfId_tagCode_key" ON "ShelfSlot"("shelfId", "tagCode");
CREATE UNIQUE INDEX "PackStock_itemId_packSize_key" ON "PackStock"("itemId", "packSize");
CREATE INDEX "OpenPack_itemId_state_idx" ON "OpenPack"("itemId", "state");
CREATE INDEX "OpenPack_shelfSlotId_idx" ON "OpenPack"("shelfSlotId");
CREATE INDEX "DefectiveItem_itemId_status_idx" ON "DefectiveItem"("itemId", "status");
CREATE INDEX "DefectiveItem_deliveryId_idx" ON "DefectiveItem"("deliveryId");
CREATE INDEX "Delivery_receivedAt_idx" ON "Delivery"("receivedAt");
CREATE INDEX "Delivery_siteId_idx" ON "Delivery"("siteId");
CREATE UNIQUE INDEX "Transaction_reversesId_key" ON "Transaction"("reversesId");
CREATE INDEX "Transaction_reversedAt_idx" ON "Transaction"("reversedAt");
CREATE INDEX "Transaction_itemId_idx" ON "Transaction"("itemId");
CREATE INDEX "Transaction_siteId_idx" ON "Transaction"("siteId");
CREATE INDEX "Transaction_createdAt_idx" ON "Transaction"("createdAt");
CREATE INDEX "Transaction_dispatchId_idx" ON "Transaction"("dispatchId");
CREATE INDEX "Transaction_deliveryId_idx" ON "Transaction"("deliveryId");
CREATE INDEX "Transaction_fromSiteId_idx" ON "Transaction"("fromSiteId");
CREATE INDEX "SitePickup_itemId_idx" ON "SitePickup"("itemId");
CREATE UNIQUE INDEX "SitePickup_siteId_itemId_key" ON "SitePickup"("siteId", "itemId");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "ApprovalRequest_status_createdAt_idx" ON "ApprovalRequest"("status", "createdAt");
CREATE INDEX "ApprovalRequest_requestedById_idx" ON "ApprovalRequest"("requestedById");
CREATE INDEX "ApprovalRequest_decidedById_idx" ON "ApprovalRequest"("decidedById");
CREATE INDEX "ApprovalRequest_kind_targetKey_idx" ON "ApprovalRequest"("kind", "targetKey");
CREATE UNIQUE INDEX "Dispatch_challanNo_key" ON "Dispatch"("challanNo");
CREATE INDEX "Dispatch_dispatchedAt_idx" ON "Dispatch"("dispatchedAt");
CREATE INDEX "Dispatch_siteId_idx" ON "Dispatch"("siteId");
INSERT INTO "Site" ("id", "name", "location", "notes", "createdAt", "address", "customerName", "projectCode") VALUES ('cmttnk88l000004jrj4m6fabl', 'Yuvraj Tamboskar', 'Pernem', NULL, '2026-09-09T05:23:11.925+00:00', 'Near bus stand , Pernem', 'Yuvraj Tamboskar', 'SCE-26-001');
INSERT INTO "PackStock" ("id", "itemId", "packSize", "sealedCount") VALUES ('cmttfl4h5000fb8vn04z09rrn', 'cmttfl4gh000eb8vn504cmvpd', 100, 1);
INSERT INTO "PackStock" ("id", "itemId", "packSize", "sealedCount") VALUES ('cmttfl7hf0030b8vn93e4gc66', 'cmttfl7gw002zb8vnv8y7c3er', 1, 4);
INSERT INTO "PackStock" ("id", "itemId", "packSize", "sealedCount") VALUES ('cmttfl7r90037b8vnx97ss3hv', 'cmttfl7qs0036b8vnn1uyst6r', 100, 2);
INSERT INTO "PackStock" ("id", "itemId", "packSize", "sealedCount") VALUES ('cmttfl7y3003cb8vnu1yd4vat', 'cmttfl7xk003bb8vnvudmxx1w', 50, 4);
INSERT INTO "PackStock" ("id", "itemId", "packSize", "sealedCount") VALUES ('cmttfl81y003fb8vnrlomlqvv', 'cmttfl81e003eb8vnkc2sfugf', 100, 8);
INSERT INTO "PackStock" ("id", "itemId", "packSize", "sealedCount") VALUES ('cmttfl85e003hb8vnuadshyxf', 'cmttfl84n003gb8vn03046tp4', 100, 8);
INSERT INTO "PackStock" ("id", "itemId", "packSize", "sealedCount") VALUES ('cmttfla9g004vb8vnizi46kgq', 'cmttfla90004ub8vnlgg1gcfg', 100, 1);
INSERT INTO "PackStock" ("id", "itemId", "packSize", "sealedCount") VALUES ('cmttflcbe006bb8vnfg1h4cj3', 'cmttflcay006ab8vn1o188hr5', 1, 2);
INSERT INTO "PackStock" ("id", "itemId", "packSize", "sealedCount") VALUES ('cmttflcei006eb8vnl0mup78n', 'cmttflce2006db8vne57etcm0', 1, 6);
INSERT INTO "PackStock" ("id", "itemId", "packSize", "sealedCount") VALUES ('cmttflchl006hb8vn26jj8dav', 'cmttflch4006gb8vnh1yml6mj', 1, 2);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfl3v80001b8vnxrzlgfl7', 'cmttfl3tm0000b8vnp3z6f7q0', 116, NULL, 'OPEN', '2026-09-09T01:39:55.988+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfl3y80003b8vnwqnvh8j9', 'cmttfl3xs0002b8vn0lisw3a8', 112, NULL, 'OPEN', '2026-09-09T01:39:56.096+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfl41p0005b8vngmtr5tl9', 'cmttfl4150004b8vnbdxjjixp', 280, NULL, 'OPEN', '2026-09-09T01:39:56.221+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfl44l0007b8vnq07n6q7z', 'cmttfl4440006b8vnj30edruy', 216, NULL, 'OPEN', '2026-09-09T01:39:56.325+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfl47s0009b8vn7bn68t3t', 'cmttfl4790008b8vn9tpbbuq6', 54, NULL, 'OPEN', '2026-09-09T01:39:56.440+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfl4b3000bb8vnx8imhv7r', 'cmttfl4ai000ab8vn92ihq1zt', 40, NULL, 'OPEN', '2026-09-09T01:39:56.559+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfl4e3000db8vnpvjpm53t', 'cmttfl4dj000cb8vnn8404b58', 75, NULL, 'OPEN', '2026-09-09T01:39:56.667+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfl4hl000gb8vnutrecvvn', 'cmttfl4gh000eb8vn504cmvpd', 30, NULL, 'OPEN', '2026-09-09T01:39:56.793+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfl4kb000ib8vnya62pak8', 'cmttfl4ju000hb8vnawwaqp2s', 41, NULL, 'OPEN', '2026-09-09T01:39:56.891+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfl4n0000kb8vnq9wx9odd', 'cmttfl4mj000jb8vn3252tedl', 5, NULL, 'OPEN', '2026-09-09T01:39:56.988+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfl4ps000mb8vngo0vh4jv', 'cmttfl4pc000lb8vnm4bherza', 55, NULL, 'OPEN', '2026-09-09T01:39:57.088+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfl4t3000ob8vnuhwr0nuo', 'cmttfl4sn000nb8vnw0wzvpcg', 200, NULL, 'OPEN', '2026-09-09T01:39:57.207+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfl4w2000qb8vnumuptfm9', 'cmttfl4vm000pb8vnltvnvskm', 400, NULL, 'OPEN', '2026-09-09T01:39:57.314+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfl4wi000rb8vnvk4ol0dd', 'cmttfl4vm000pb8vnltvnvskm', 500, NULL, 'OPEN', '2026-09-09T01:39:57.330+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfl4z8000tb8vncuc2yalp', 'cmttfl4ys000sb8vn24lvgovv', 12, NULL, 'OPEN', '2026-09-09T01:39:57.428+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfl51y000vb8vnv9ll9n05', 'cmttfl51i000ub8vn5xrzobgf', 199, NULL, 'OPEN', '2026-09-09T01:39:57.526+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfl52e000wb8vn0zy4y1uh', 'cmttfl51i000ub8vn5xrzobgf', 500, NULL, 'OPEN', '2026-09-09T01:39:57.542+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfl558000yb8vn5owexrel', 'cmttfl54q000xb8vnm7fwmwaw', 4, NULL, 'OPEN', '2026-09-09T01:39:57.644+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfl55r000zb8vnqgjqc0m7', 'cmttfl54q000xb8vnm7fwmwaw', 5, NULL, 'OPEN', '2026-09-09T01:39:57.663+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfl5660010b8vnqco9v9tz', 'cmttfl54q000xb8vnm7fwmwaw', 12, NULL, 'OPEN', '2026-09-09T01:39:57.679+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfl56p0011b8vnpelzjli0', 'cmttfl54q000xb8vnm7fwmwaw', 100, NULL, 'OPEN', '2026-09-09T01:39:57.697+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfl59p0013b8vncenapxn5', 'cmttfl5950012b8vn0gjxspzp', 4, NULL, 'OPEN', '2026-09-09T01:39:57.805+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfl5a80014b8vnse60qsmh', 'cmttfl5950012b8vn0gjxspzp', 6, NULL, 'OPEN', '2026-09-09T01:39:57.824+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfl5aq0015b8vnvy4a54kz', 'cmttfl5950012b8vn0gjxspzp', 9, NULL, 'OPEN', '2026-09-09T01:39:57.842+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfl5b90016b8vnozpagc4p', 'cmttfl5950012b8vn0gjxspzp', 7, NULL, 'OPEN', '2026-09-09T01:39:57.861+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfl5bq0017b8vnevvd46wl', 'cmttfl5950012b8vn0gjxspzp', 6, NULL, 'OPEN', '2026-09-09T01:39:57.878+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfl5c50018b8vnkksr455c', 'cmttfl5950012b8vn0gjxspzp', 7, NULL, 'OPEN', '2026-09-09T01:39:57.893+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfl5ck0019b8vnvous17ad', 'cmttfl5950012b8vn0gjxspzp', 4, NULL, 'OPEN', '2026-09-09T01:39:57.908+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfl5d0001ab8vnwlg7fwte', 'cmttfl5950012b8vn0gjxspzp', 19, NULL, 'OPEN', '2026-09-09T01:39:57.924+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfl5df001bb8vnbusykd96', 'cmttfl5950012b8vn0gjxspzp', 3, NULL, 'OPEN', '2026-09-09T01:39:57.939+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfl5dv001cb8vngviwjrbh', 'cmttfl5950012b8vn0gjxspzp', 2, NULL, 'OPEN', '2026-09-09T01:39:57.955+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfl5ee001db8vn9b824mql', 'cmttfl5950012b8vn0gjxspzp', 33, NULL, 'OPEN', '2026-09-09T01:39:57.974+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfl5ex001eb8vn774jjyu5', 'cmttfl5950012b8vn0gjxspzp', 100, NULL, 'OPEN', '2026-09-09T01:39:57.993+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfl5i0001gb8vno06p0v9h', 'cmttfl5hh001fb8vnwbnirin8', 36, NULL, 'OPEN', '2026-09-09T01:39:58.104+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfl5l3001ib8vnasuagp9t', 'cmttfl5kj001hb8vndjrh4f2c', 36, NULL, 'OPEN', '2026-09-09T01:39:58.215+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfl5o8001kb8vnbbdffjsf', 'cmttfl5nq001jb8vn1u102pvw', 200, NULL, 'OPEN', '2026-09-09T01:39:58.328+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfl5or001lb8vnhct61kij', 'cmttfl5nq001jb8vn1u102pvw', 250, NULL, 'OPEN', '2026-09-09T01:39:58.347+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfl5p9001mb8vney4wpzxp', 'cmttfl5nq001jb8vn1u102pvw', 300, NULL, 'OPEN', '2026-09-09T01:39:58.365+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfl5pu001nb8vnk5q2jkqs', 'cmttfl5nq001jb8vn1u102pvw', 26, NULL, 'OPEN', '2026-09-09T01:39:58.386+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfl5t0001pb8vnzf1s7dvt', 'cmttfl5sg001ob8vns72at0z9', 59, NULL, 'OPEN', '2026-09-09T01:39:58.500+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfl5tj001qb8vnwepcw59v', 'cmttfl5sg001ob8vns72at0z9', 30, NULL, 'OPEN', '2026-09-09T01:39:58.520+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfl5u3001rb8vn4qcvvg58', 'cmttfl5sg001ob8vns72at0z9', 35, NULL, 'OPEN', '2026-09-09T01:39:58.539+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfl5um001sb8vn0kr2j4hc', 'cmttfl5sg001ob8vns72at0z9', 54, NULL, 'OPEN', '2026-09-09T01:39:58.558+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfl5v4001tb8vniqadsawd', 'cmttfl5sg001ob8vns72at0z9', 13, NULL, 'OPEN', '2026-09-09T01:39:58.576+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfl5vn001ub8vnpg2vky6e', 'cmttfl5sg001ob8vns72at0z9', 100, NULL, 'OPEN', '2026-09-09T01:39:58.595+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfl5w6001vb8vnwoqgm50c', 'cmttfl5sg001ob8vns72at0z9', 200, NULL, 'OPEN', '2026-09-09T01:39:58.614+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfl5za001xb8vnf624fh0e', 'cmttfl5ys001wb8vnjtr9hji1', 200, NULL, 'OPEN', '2026-09-09T01:39:58.726+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfl5zs001yb8vnja86ajle', 'cmttfl5ys001wb8vnjtr9hji1', 250, NULL, 'OPEN', '2026-09-09T01:39:58.744+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfl60b001zb8vnnohqsire', 'cmttfl5ys001wb8vnjtr9hji1', 300, NULL, 'OPEN', '2026-09-09T01:39:58.763+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfl63e0021b8vngub8gnkc', 'cmttfl62x0020b8vn6jluiayv', 15, NULL, 'OPEN', '2026-09-09T01:39:58.874+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfl66o0023b8vnbdx9fqxb', 'cmttfl6640022b8vnu9plfyw9', 10, NULL, 'OPEN', '2026-09-09T01:39:58.993+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfl69v0025b8vnx8c0au29', 'cmttfl69b0024b8vnsy24hytr', 1, NULL, 'OPEN', '2026-09-09T01:39:59.107+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfl6cz0027b8vnho7vjayc', 'cmttfl6cg0026b8vn632ttt59', 1, NULL, 'OPEN', '2026-09-09T01:39:59.219+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfl6fu0029b8vn8yor4vox', 'cmttfl6fc0028b8vn2g3ms3iq', 2, NULL, 'OPEN', '2026-09-09T01:39:59.322+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfl6gc002ab8vnd5c75odj', 'cmttfl6fc0028b8vn2g3ms3iq', 1, NULL, 'OPEN', '2026-09-09T01:39:59.340+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfl6jh002cb8vny1zojqvf', 'cmttfl6ix002bb8vnaqcdobno', 7, NULL, 'OPEN', '2026-09-09T01:39:59.453+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfl6mg002eb8vngvm0q0wt', 'cmttfl6lv002db8vnqhy622gs', 2, NULL, 'OPEN', '2026-09-09T01:39:59.560+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfl6p5002gb8vnt4vw44d7', 'cmttfl6oo002fb8vn57819alp', 2, NULL, 'OPEN', '2026-09-09T01:39:59.657+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfl6rt002ib8vn09w4ru2r', 'cmttfl6rc002hb8vnw5w87wlw', 19, NULL, 'OPEN', '2026-09-09T01:39:59.753+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfl6uu002kb8vn37w2lakc', 'cmttfl6ud002jb8vno4k5ox3g', 28, NULL, 'OPEN', '2026-09-09T01:39:59.862+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfl6xl002mb8vnu718boog', 'cmttfl6x5002lb8vn4oaoo10s', 150, NULL, 'OPEN', '2026-09-09T01:39:59.961+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfl70a002ob8vn5paty59j', 'cmttfl6zs002nb8vnupgdjh79', 80, NULL, 'OPEN', '2026-09-09T01:40:00.058+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfl735002qb8vnkzvqcyfo', 'cmttfl72n002pb8vn98231k0w', 40, NULL, 'OPEN', '2026-09-09T01:40:00.161+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfl75u002sb8vnr17h2lle', 'cmttfl75d002rb8vntz5qz2v6', 60, NULL, 'OPEN', '2026-09-09T01:40:00.258+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfl78n002ub8vn3pntqcr5', 'cmttfl786002tb8vnnmv26mfo', 56, NULL, 'OPEN', '2026-09-09T01:40:00.359+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfl7bn002wb8vndwgghauh', 'cmttfl7b2002vb8vn91fx4y2h', 13, NULL, 'OPEN', '2026-09-09T01:40:00.468+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfl7el002yb8vnrp2n9l5d', 'cmttfl7e5002xb8vnor006m5j', 9, NULL, 'OPEN', '2026-09-09T01:40:00.573+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfl7kl0032b8vnggrbic71', 'cmttfl7k10031b8vn7azzj7q8', 9, NULL, 'OPEN', '2026-09-09T01:40:00.789+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfl7nu0034b8vnm4fa715i', 'cmttfl7nc0033b8vns7jyxvmy', 20, NULL, 'OPEN', '2026-09-09T01:40:00.906+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfl7oe0035b8vnc012jaer', 'cmttfl7nc0033b8vns7jyxvmy', 8, NULL, 'OPEN', '2026-09-09T01:40:00.926+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfl7rs0038b8vn2d3uvhpo', 'cmttfl7qs0036b8vnn1uyst6r', 31, NULL, 'OPEN', '2026-09-09T01:40:01.048+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfl7uz003ab8vnrmm6vi37', 'cmttfl7ui0039b8vnf95ozr13', 80, NULL, 'OPEN', '2026-09-09T01:40:01.163+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfl7yl003db8vn6n4f39on', 'cmttfl7xk003bb8vnvudmxx1w', 180, NULL, 'OPEN', '2026-09-09T01:40:01.293+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfl88b003jb8vn2rerypmw', 'cmttfl87v003ib8vnosuovfwu', 40, NULL, 'OPEN', '2026-09-09T01:40:01.643+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfl8bh003lb8vnvqp7zyu9', 'cmttfl8ax003kb8vns7xekn0k', 64, NULL, 'OPEN', '2026-09-09T01:40:01.757+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfl8ep003nb8vnhpvmgdhm', 'cmttfl8e7003mb8vnzgm0t8l5', 19, NULL, 'OPEN', '2026-09-09T01:40:01.873+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfl8hq003pb8vn2nhd0a1j', 'cmttfl8h6003ob8vn6ut8xwl1', 16, NULL, 'OPEN', '2026-09-09T01:40:01.982+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfl8l8003rb8vnhfoxxutw', 'cmttfl8km003qb8vn1utl4g2l', 10, NULL, 'OPEN', '2026-09-09T01:40:02.108+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfl8oo003tb8vnni2cxx8c', 'cmttfl8nx003sb8vn7bx24z35', 168, NULL, 'OPEN', '2026-09-09T01:40:02.232+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfl8sm003vb8vnyslpap77', 'cmttfl8ry003ub8vnce4h7lo2', 23, NULL, 'OPEN', '2026-09-09T01:40:02.374+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfl8vq003xb8vn4t1dlpwd', 'cmttfl8va003wb8vng1v9sc3a', 6, NULL, 'OPEN', '2026-09-09T01:40:02.486+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfl8yq003zb8vnlgxu4a1m', 'cmttfl8ya003yb8vnodtits2z', 26, NULL, 'OPEN', '2026-09-09T01:40:02.594+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfl91y0041b8vn8vvxe12q', 'cmttfl91g0040b8vnxybwh9k9', 66, NULL, 'OPEN', '2026-09-09T01:40:02.710+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfl94v0043b8vnvbhqvm8f', 'cmttfl94e0042b8vn2q2bqrsk', 21, NULL, 'OPEN', '2026-09-09T01:40:02.815+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfl97w0045b8vngdaepfny', 'cmttfl97e0044b8vn1ejixytv', 30, NULL, 'OPEN', '2026-09-09T01:40:02.924+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfl9bc0047b8vn1qbllq25', 'cmttfl9at0046b8vnmbsx5yl9', 116, NULL, 'OPEN', '2026-09-09T01:40:03.048+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfl9e50049b8vnx32ozxy5', 'cmttfl9dm0048b8vn1zdbv52n', 42, NULL, 'OPEN', '2026-09-09T01:40:03.149+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfl9h8004bb8vnjq45rtz2', 'cmttfl9gq004ab8vnt3eobacn', 28, NULL, 'OPEN', '2026-09-09T01:40:03.260+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfl9kb004db8vnlq7pv5jt', 'cmttfl9jr004cb8vns09s8dxo', 110, NULL, 'OPEN', '2026-09-09T01:40:03.371+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfl9n4004fb8vn6nag9lrp', 'cmttfl9mo004eb8vnj5u7f8ae', 21, NULL, 'OPEN', '2026-09-09T01:40:03.472+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfl9py004hb8vn6adn9hej', 'cmttfl9pg004gb8vnit61ty26', 67, NULL, 'OPEN', '2026-09-09T01:40:03.574+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfl9sr004jb8vnds5nspc0', 'cmttfl9sb004ib8vnm79i1d4g', 19, NULL, 'OPEN', '2026-09-09T01:40:03.675+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfl9vh004lb8vn2e4xytl5', 'cmttfl9v0004kb8vnazsfczsk', 8, NULL, 'OPEN', '2026-09-09T01:40:03.773+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfl9yc004nb8vn32vo4eef', 'cmttfl9xu004mb8vn34p1a8a4', 56, NULL, 'OPEN', '2026-09-09T01:40:03.876+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfla0y004pb8vnmky5wncl', 'cmttfla0i004ob8vniki0qpvp', 17, NULL, 'OPEN', '2026-09-09T01:40:03.970+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfla3q004rb8vnro1vbxw5', 'cmttfla38004qb8vn4pz7noyw', 62, NULL, 'OPEN', '2026-09-09T01:40:04.070+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfla6n004tb8vn5u32ewe2', 'cmttfla65004sb8vnde9ku5a6', 42, NULL, 'OPEN', '2026-09-09T01:40:04.175+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttfla9w004wb8vn67y1i952', 'cmttfla90004ub8vnlgg1gcfg', 15, NULL, 'OPEN', '2026-09-09T01:40:04.292+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttflaco004yb8vnaa75ls57', 'cmttflac7004xb8vnjgpal3bm', 29, NULL, 'OPEN', '2026-09-09T01:40:04.392+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttflafj0050b8vnkaw5trd9', 'cmttflaf1004zb8vnz226nejr', 7, NULL, 'OPEN', '2026-09-09T01:40:04.495+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttflaik0052b8vnngo921p6', 'cmttflai30051b8vnfofvee0x', 55, NULL, 'OPEN', '2026-09-09T01:40:04.604+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttflale0054b8vn2jdt5xgg', 'cmttflakx0053b8vn95dd9wdv', 40, NULL, 'OPEN', '2026-09-09T01:40:04.706+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttflao60056b8vnnxx0w6pa', 'cmttflanp0055b8vnn47no7m1', 24, NULL, 'OPEN', '2026-09-09T01:40:04.806+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttflar00058b8vngezoxoz1', 'cmttflaqk0057b8vn2m1qsif1', 29, NULL, 'OPEN', '2026-09-09T01:40:04.908+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttflato005ab8vno5igvbhq', 'cmttflat60059b8vnue234mmk', 120, NULL, 'OPEN', '2026-09-09T01:40:05.004+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttflawj005cb8vndch0id1o', 'cmttflaw2005bb8vno19ka3yo', 19, NULL, 'OPEN', '2026-09-09T01:40:05.107+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttflazg005eb8vnbih8xvua', 'cmttflayw005db8vn3lrj3e1l', 7, NULL, 'OPEN', '2026-09-09T01:40:05.212+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttflb29005gb8vnzffxpt6y', 'cmttflb1s005fb8vn6j4idkfw', 11, NULL, 'OPEN', '2026-09-09T01:40:05.313+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttflb57005ib8vnbdydf1q8', 'cmttflb4m005hb8vnlpezft5s', 19, NULL, 'OPEN', '2026-09-09T01:40:05.419+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttflb82005kb8vn9b0vyqdm', 'cmttflb7j005jb8vn5kof3olp', 20, NULL, 'OPEN', '2026-09-09T01:40:05.522+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttflbb2005mb8vn243sy6xr', 'cmttflbaj005lb8vndsjqqtv5', 25, NULL, 'OPEN', '2026-09-09T01:40:05.630+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttflbge005pb8vn5csorguy', 'cmttflbfy005ob8vnfbcre27o', 5, NULL, 'OPEN', '2026-09-09T01:40:05.822+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttflbjh005rb8vndvhva21n', 'cmttflbiz005qb8vnpuwz5fuq', 66, NULL, 'OPEN', '2026-09-09T01:40:05.933+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttflbma005tb8vnuic15zhr', 'cmttflbls005sb8vnx4wkf58x', 8, NULL, 'OPEN', '2026-09-09T01:40:06.034+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttflboy005vb8vn2283gfh8', 'cmttflboi005ub8vndvktqema', 2, NULL, 'OPEN', '2026-09-09T01:40:06.130+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttflbro005xb8vnp7l9p4ux', 'cmttflbr7005wb8vntrhse1st', 170, NULL, 'OPEN', '2026-09-09T01:40:06.228+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttflbub005zb8vn59xmonxm', 'cmttflbtw005yb8vnm1ubx850', 17, NULL, 'OPEN', '2026-09-09T01:40:06.323+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttflbxb0061b8vnxc6nqck3', 'cmttflbwv0060b8vnqan32otu', 14, NULL, 'OPEN', '2026-09-09T01:40:06.431+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttflc030063b8vnhxf5jevr', 'cmttflbzm0062b8vnzs3clxuk', 35, NULL, 'OPEN', '2026-09-09T01:40:06.531+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttflc2z0065b8vnqvejad6q', 'cmttflc2g0064b8vn8qxq3thw', 60, NULL, 'OPEN', '2026-09-09T01:40:06.635+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttflc5w0067b8vn8ijdg2zh', 'cmttflc5d0066b8vndjlxsebe', 25, NULL, 'OPEN', '2026-09-09T01:40:06.740+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttflc8r0069b8vnsbqfhmpk', 'cmttflc8a0068b8vnkpifc25e', 6, NULL, 'OPEN', '2026-09-09T01:40:06.843+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttflcbt006cb8vnerx8jn2u', 'cmttflcay006ab8vn1o188hr5', 13, NULL, 'OPEN', '2026-09-09T01:40:06.953+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttflcey006fb8vnv24oejlc', 'cmttflce2006db8vne57etcm0', 3, NULL, 'OPEN', '2026-09-09T01:40:07.066+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttflci3006ib8vn2weqhwxb', 'cmttflch4006gb8vnh1yml6mj', 7, NULL, 'OPEN', '2026-09-09T01:40:07.179+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttflckv006kb8vnt68bh4bc', 'cmttflckd006jb8vnnj8n6901', 5, NULL, 'OPEN', '2026-09-09T01:40:07.279+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttflcnq006mb8vn0gvhetpx', 'cmttflcn7006lb8vn2ye3jjoe', 2, NULL, 'OPEN', '2026-09-09T01:40:07.382+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmttflcqk006ob8vn77quqms3', 'cmttflcq0006nb8vnlp1mkhp8', 1, NULL, 'OPEN', '2026-09-09T01:40:07.484+00:00', NULL);
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttfl3tm0000b8vnp3z6f7q0', 'Jointer for walkway', 'WKWY-JNT', 'Fixing', 'pcs', NULL, 'DISCRETE', NULL, 0, 116, 0, '2026-09-09T01:39:55.930+00:00', '2026-09-09T01:39:56.046+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttfl3xs0002b8vn0lisw3a8', 'L Foot', 'L FOOT', 'Fixing', 'pcs', NULL, 'DISCRETE', NULL, 0, 112, 0, '2026-09-09T01:39:56.080+00:00', '2026-09-09T01:39:56.156+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttfl4150004b8vnbdxjjixp', 'Metal Saddle', 'SDL-MTL', 'Fixing', 'pcs', NULL, 'DISCRETE', NULL, 0, 280, 0, '2026-09-09T01:39:56.201+00:00', '2026-09-09T01:39:56.274+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttfl4440006b8vnj30edruy', 'TEE- Pipes', 'TEE-PIP', 'Material', 'pcs', NULL, 'DISCRETE', NULL, 0, 216, 0, '2026-09-09T01:39:56.308+00:00', '2026-09-09T01:39:56.383+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttfl4790008b8vn9tpbbuq6', 'End Clamp', 'END-CLM', 'Fixing', 'pcs', NULL, 'DISCRETE', NULL, 0, 54, 0, '2026-09-09T01:39:56.421+00:00', '2026-09-09T01:39:56.503+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttfl4ai000ab8vn92ihq1zt', 'PG20 Glands', 'GLD-PG20', 'Fixing', 'pcs', NULL, 'DISCRETE', NULL, 0, 40, 0, '2026-09-09T01:39:56.538+00:00', '2026-09-09T01:39:56.615+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttfl4dj000cb8vnn8404b58', 'Ring type lugs  (4-6sqmm)', 'LUG-RNG-04-06', 'Fixing', 'pcs', NULL, 'DISCRETE', NULL, 0, 75, 0, '2026-09-09T01:39:56.647+00:00', '2026-09-09T01:39:56.717+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttfl4gh000eb8vn504cmvpd', 'Rawal Plug (Small)', 'PLG-RAW-SML', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 130, 0, '2026-09-09T01:39:56.753+00:00', '2026-09-09T01:39:56.841+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttfl4ju000hb8vnawwaqp2s', 'square bend u bolt', 'BLT-UB-SQB', 'Fixing', 'pcs', NULL, 'DISCRETE', NULL, 0, 41, 0, '2026-09-09T01:39:56.874+00:00', '2026-09-09T01:39:56.940+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttfl4mj000jb8vn3252tedl', 'solar panel mid clamp(75mm)', 'CLM-MID-75', 'Fixing', 'pcs', NULL, 'DISCRETE', NULL, 0, 5, 0, '2026-09-09T01:39:56.971+00:00', '2026-09-09T01:39:57.040+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttfl4pc000lb8vnm4bherza', 'M6 alen bolt (28mm)', 'BLT-ALN-M6-28', 'Fixing', 'pcs', NULL, 'DISCRETE', NULL, 0, 55, 0, '2026-09-09T01:39:57.072+00:00', '2026-09-09T01:39:57.146+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttfl4sn000nb8vnw0wzvpcg', 'solar water drain clip', 'CLP-DRN-SLR', 'Fixing', 'pcs', NULL, 'DISCRETE', NULL, 0, 200, 0, '2026-09-09T01:39:57.191+00:00', '2026-09-09T01:39:57.259+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttfl4vm000pb8vnltvnvskm', 'DC Cable 1C ,cu,4.0sqmm(Black)', 'CBL-DC1C-BLK', 'Material', 'm', NULL, 'CONTINUOUS', NULL, 0, 900, 0, '2026-09-09T01:39:57.298+00:00', '2026-09-09T09:53:40.728+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttfl4ys000sb8vn24lvgovv', 'AC cable,black,4core x 4sqmm,', 'CBL-AC-4C-04', 'Material', 'm', NULL, 'CONTINUOUS', NULL, 0, 12, 0, '2026-09-09T01:39:57.412+00:00', '2026-09-09T01:39:57.478+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttfl51i000ub8vn5xrzobgf', 'DC CABLE,single CORE,4sqmm ,red', 'CBL-DC-RED', 'Material', 'm', NULL, 'CONTINUOUS', NULL, 0, 699, 0, '2026-09-09T01:39:57.510+00:00', '2026-09-09T01:39:57.592+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttfl54q000xb8vnm7fwmwaw', 'earthing cable, green (6 sqmm)=cu', 'CBL-EARTH-ACDC', 'Material', 'm', NULL, 'CONTINUOUS', NULL, 0, 121, 0, '2026-09-09T01:39:57.626+00:00', '2026-09-09T01:39:57.746+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttfl5950012b8vn0gjxspzp', 'earthing cable,green ,(10 sqmm)-cu', 'CBL-EARTH-LA', 'Material', 'm', NULL, 'CONTINUOUS', NULL, 0, 200, 0, '2026-09-09T01:39:57.786+00:00', '2026-09-09T01:39:58.051+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttfl5hh001fb8vnwbnirin8', 'ac cable,single core,red  , cu ,1 core,4.0sqmm', 'CBL-AC-RED-04', 'Material', 'm', NULL, 'CONTINUOUS', NULL, 0, 36, 0, '2026-09-09T01:39:58.085+00:00', '2026-09-09T01:39:58.158+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttfl5kj001hb8vndjrh4f2c', 'ac cable,single core,black ,cu,1 core,4.0sqmm', 'CBL-AC-BLK-04', 'Material', 'm', NULL, 'CONTINUOUS', NULL, 0, 36, 0, '2026-09-09T01:39:58.195+00:00', '2026-09-09T01:39:58.273+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttfl5nq001jb8vn1u102pvw', 'black flexible pipe(10mm)', 'FLP-10MM', 'Material', 'cm', NULL, 'CONTINUOUS', NULL, 0, 776, 0, '2026-09-09T01:39:58.310+00:00', '2026-09-09T01:39:58.443+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttfl5sg001ob8vns72at0z9', 'black flexible pipe(20mm)', 'FLP-20MM', 'Material', 'cm', NULL, 'CONTINUOUS', NULL, 0, 491, 0, '2026-09-09T01:39:58.480+00:00', '2026-09-09T01:39:58.673+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttfl5ys001wb8vnjtr9hji1', 'flexible pie ,white', 'FLP-WHT', 'Material', 'cm', NULL, 'CONTINUOUS', NULL, 0, 750, 0, '2026-09-09T01:39:58.708+00:00', '2026-09-09T01:39:58.819+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttfl62x0020b8vn6jluiayv', 'mop -4.5', 'MOP-4.5', 'Equipment', 'pcs', NULL, 'DISCRETE', NULL, 0, 15, 0, '2026-09-09T01:39:58.857+00:00', '2026-09-09T01:39:58.930+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttfl6640022b8vnu9plfyw9', 'mop cloth', 'MOP-CLTH', 'Equipment', 'pcs', NULL, 'DISCRETE', NULL, 0, 10, 0, '2026-09-09T01:39:58.972+00:00', '2026-09-09T01:39:59.047+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttfl69b0024b8vnsy24hytr', 'ACDB 1IN1', 'BOX-ACDB-1IN1', 'Equipment', 'box', NULL, 'DISCRETE', NULL, 0, 1, 0, '2026-09-09T01:39:59.087+00:00', '2026-09-09T01:39:59.164+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttfl6cg0026b8vn632ttt59', 'DCDB 1IN1 OUT', 'BOX-DCDB-1IN1', 'Equipment', 'box', NULL, 'DISCRETE', NULL, 0, 1, 0, '2026-09-09T01:39:59.200+00:00', '2026-09-09T01:39:59.271+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttfl6fc0028b8vn2g3ms3iq', 'Inverter', 'INV-SOLAR-5KW', 'Equipment', 'box', NULL, 'DISCRETE', NULL, 0, 3, 0, '2026-09-09T01:39:59.304+00:00', '2026-09-09T01:39:59.396+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttfl6ix002bb8vnaqcdobno', 'Mop - 3.5', 'MOP', 'Equipment', 'pcs', NULL, 'DISCRETE', NULL, 0, 7, 0, '2026-09-09T01:39:59.433+00:00', '2026-09-09T01:39:59.504+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttfl6lv002db8vnqhy622gs', 'DCDB 2IN2 OUT', 'BOX-DCDB-2IN2', 'Equipment', 'box', NULL, 'DISCRETE', NULL, 0, 2, 0, '2026-09-09T01:39:59.539+00:00', '2026-09-09T01:39:59.608+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttfl6oo002fb8vn57819alp', 'ACDB 2IN2', 'BOX-ACDB-2IN2', 'Equipment', 'box', NULL, 'DISCRETE', NULL, 0, 2, 0, '2026-09-09T01:39:59.640+00:00', '2026-09-09T01:39:59.704+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttfl6rc002hb8vnw5w87wlw', 'Dummy Pieces', 'DUM-PCS', 'Fixing', 'pcs', NULL, 'DISCRETE', NULL, 0, 19, 0, '2026-09-09T01:39:59.736+00:00', '2026-09-09T01:39:59.809+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttfl6ud002jb8vno4k5ox3g', 'Elbow-pipes', 'CND-ELB', 'Material', 'pcs', NULL, 'DISCRETE', NULL, 0, 28, 0, '2026-09-09T01:39:59.845+00:00', '2026-09-09T01:39:59.910+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttfl6x5002lb8vn4oaoo10s', 'Bend-Pipes', 'BND-PIP', 'Material', 'pcs', NULL, 'DISCRETE', NULL, 0, 150, 0, '2026-09-09T01:39:59.945+00:00', '2026-09-09T01:40:00.008+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttfl6zs002nb8vnupgdjh79', 'Bolts for Panel earthing', 'BLT-EARTH', 'Fixing', 'pcs', NULL, 'DISCRETE', NULL, 0, 80, 0, '2026-09-09T01:40:00.040+00:00', '2026-09-09T01:40:00.108+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttfl72n002pb8vn98231k0w', 'Nut for Panel earthing', 'NUT-EARTH', 'Fixing', 'pcs', NULL, 'DISCRETE', NULL, 0, 40, 0, '2026-09-09T01:40:00.143+00:00', '2026-09-09T01:40:00.208+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttfl75d002rb8vntz5qz2v6', 'washers for Panel earthing', 'WSH-EARTH', 'Fixing', 'pcs', NULL, 'DISCRETE', NULL, 0, 60, 0, '2026-09-09T01:40:00.241+00:00', '2026-09-09T01:40:00.309+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttfl786002tb8vnnmv26mfo', 'Self tapping screw', 'SCR-ST', 'Fixing', 'pcs', NULL, 'DISCRETE', NULL, 0, 56, 0, '2026-09-09T01:40:00.342+00:00', '2026-09-09T01:40:00.410+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttfl7b2002vb8vn91fx4y2h', 'Earthing connector', 'EARTH-CONN', 'Fixing', 'pcs', NULL, 'DISCRETE', NULL, 0, 13, 0, '2026-09-09T01:40:00.446+00:00', '2026-09-09T01:40:00.524+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttfl7e5002xb8vnor006m5j', 'SPD', 'SPD', 'Equipment', 'pcs', NULL, 'DISCRETE', NULL, 0, 9, 0, '2026-09-09T01:40:00.557+00:00', '2026-09-09T01:40:00.623+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttfl7gw002zb8vnv8y7c3er', 'Anchor Bolt(Brass Pin)', 'ANR-BOLT', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 4, 0, '2026-09-09T01:40:00.656+00:00', '2026-09-09T01:40:00.731+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttfl7k10031b8vn7azzj7q8', 'Photovoltic Fuse', 'PHTVOL-FUSE', 'Equipment', 'pcs', NULL, 'DISCRETE', NULL, 0, 9, 0, '2026-09-09T01:40:00.769+00:00', '2026-09-09T01:40:00.854+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttfl7nc0033b8vns7jyxvmy', 'M clamps for Walkway', 'CLM-M-WKWY', 'Fixing', 'pcs', NULL, 'DISCRETE', NULL, 0, 28, 0, '2026-09-09T01:40:00.888+00:00', '2026-09-09T01:40:00.979+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttfl7qs0036b8vnn1uyst6r', 'Rawal Plug- 1.5''', 'PLG-RAW-1.5', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 231, 0, '2026-09-09T01:40:01.012+00:00', '2026-09-09T06:26:12.011+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttfl7ui0039b8vnf95ozr13', 'MC4 Connectors', 'MC4-CON', 'Fixing', 'pcs', NULL, 'DISCRETE', NULL, 0, 80, 0, '2026-09-09T01:40:01.146+00:00', '2026-09-09T01:40:01.216+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttfl7xk003bb8vnvudmxx1w', 'Clamps for Pipes', 'CLM-PIP', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 380, 0, '2026-09-09T01:40:01.256+00:00', '2026-09-09T01:40:01.355+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttfl81e003eb8vnkc2sfugf', 'Cable ties', 'TIE-CBL-NYL', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 800, 0, '2026-09-09T01:40:01.394+00:00', '2026-09-09T01:40:01.472+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttfl84n003gb8vn03046tp4', 'metal cable tie', 'TIE-CBL-SS', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 800, 0, '2026-09-09T01:40:01.512+00:00', '2026-09-09T01:40:01.592+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttfl87v003ib8vnosuovfwu', 'T head bolt', 'BLT-T-HEAD', 'Fixing', 'pcs', NULL, 'DISCRETE', NULL, 0, 40, 0, '2026-09-09T01:40:01.627+00:00', '2026-09-09T01:40:01.701+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttfl8ax003kb8vns7xekn0k', 'hex head screw(80mm)-thick', 'SCR-HEX-80-THK', 'Fixing', 'pcs', NULL, 'DISCRETE', NULL, 0, 64, 0, '2026-09-09T01:40:01.737+00:00', '2026-09-09T01:40:01.816+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttfl8e7003mb8vnzgm0t8l5', 'hex head screw(40mm)', 'SCR-HEX-40', 'Fixing', 'pcs', NULL, 'DISCRETE', NULL, 0, 19, 0, '2026-09-09T01:40:01.855+00:00', '2026-09-09T01:40:01.927+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttfl8h6003ob8vn6ut8xwl1', 'hex head screw (80mm) - thin', 'SCR-HEX-80-THN', 'Fixing', 'pcs', NULL, 'DISCRETE', NULL, 0, 16, 0, '2026-09-09T01:40:01.962+00:00', '2026-09-09T01:40:02.042+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttfl8km003qb8vn1utl4g2l', 'thread rod/stud', 'ROD-THR', 'Fixing', 'pcs', NULL, 'DISCRETE', NULL, 0, 10, 0, '2026-09-09T01:40:02.086+00:00', '2026-09-09T01:40:02.167+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttfl8nx003sb8vn7bx24z35', 'threaded screw', 'SCR-THR', 'Fixing', 'pcs', NULL, 'DISCRETE', NULL, 0, 168, 0, '2026-09-09T01:40:02.205+00:00', '2026-09-09T01:40:02.292+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttfl8ry003ub8vnce4h7lo2', 'hex bolt(80*4mm)', 'BLT-HEX-80X4', 'Fixing', 'pcs', NULL, 'DISCRETE', NULL, 0, 23, 0, '2026-09-09T01:40:02.350+00:00', '2026-09-09T01:40:02.435+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttfl8va003wb8vng1v9sc3a', 'hex bolt(60*6mm)', 'BLT-HEX-60X6', 'Fixing', 'pcs', NULL, 'DISCRETE', NULL, 0, 6, 0, '2026-09-09T01:40:02.470+00:00', '2026-09-09T01:40:02.540+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttfl8ya003yb8vnodtits2z', 'hex bolt(43*4mm)', 'BLT-HEX-43X4', 'Fixing', 'pcs', NULL, 'DISCRETE', NULL, 0, 26, 0, '2026-09-09T01:40:02.578+00:00', '2026-09-09T01:40:02.651+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttfl91g0040b8vnxybwh9k9', 'hex bolt(24*4mm)', 'BLT-HEX-24X4', 'Fixing', 'pcs', NULL, 'DISCRETE', NULL, 0, 66, 0, '2026-09-09T01:40:02.692+00:00', '2026-09-09T01:40:02.764+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttfl94e0042b8vn2q2bqrsk', 'hex bolt(30*4mm)', 'BLT-HEX-30X4', 'Fixing', 'pcs', NULL, 'DISCRETE', NULL, 0, 21, 0, '2026-09-09T01:40:02.798+00:00', '2026-09-09T01:40:02.869+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttfl97e0044b8vn1ejixytv', 'hex bolt(30*5mm)', 'BLT-HEX-30X5', 'Fixing', 'pcs', NULL, 'DISCRETE', NULL, 0, 30, 0, '2026-09-09T01:40:02.906+00:00', '2026-09-09T01:40:02.983+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttfl9at0046b8vnmbsx5yl9', 'hex metal nuts(5.5mm)', 'NUT-HEX-5.5', 'Fixing', 'pcs', NULL, 'DISCRETE', NULL, 0, 116, 0, '2026-09-09T01:40:03.029+00:00', '2026-09-09T01:40:03.097+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttfl9dm0048b8vn1zdbv52n', 'hex self drilling-(5.5*65mm)', 'SCR-SD-HEX-5.5X65', 'Fixing', 'pcs', NULL, 'DISCRETE', NULL, 0, 42, 0, '2026-09-09T01:40:03.130+00:00', '2026-09-09T01:40:03.205+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttfl9gq004ab8vnt3eobacn', 'hex flange nuts(5.5mm)', 'NUT-FLG-5.5', 'Fixing', 'pcs', NULL, 'DISCRETE', NULL, 0, 28, 0, '2026-09-09T01:40:03.242+00:00', '2026-09-09T01:40:03.314+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttfl9jr004cb8vns09s8dxo', 'cu ring lug(10-8sqmm)', 'LUG-RNG-CU-10-08', 'Fixing', 'pcs', NULL, 'DISCRETE', NULL, 0, 110, 0, '2026-09-09T01:40:03.351+00:00', '2026-09-09T01:40:03.423+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttfl9mo004eb8vnj5u7f8ae', 'cu ring lug(16-8sqmm)', 'LUG-RNG-CU-16-08', 'Fixing', 'pcs', NULL, 'DISCRETE', NULL, 0, 21, 0, '2026-09-09T01:40:03.456+00:00', '2026-09-09T01:40:03.520+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttfl9pg004gb8vnit61ty26', 'hex flange nuts(7.5mm)', 'NUT-FLG-7.5', 'Fixing', 'pcs', NULL, 'DISCRETE', NULL, 0, 67, 0, '2026-09-09T01:40:03.556+00:00', '2026-09-09T01:40:03.626+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttfl9sb004ib8vnm79i1d4g', 'hex screw(30mm*5mm)', 'SCR-HEX-30X5', 'Fixing', 'pcs', NULL, 'DISCRETE', NULL, 0, 19, 0, '2026-09-09T01:40:03.659+00:00', '2026-09-09T01:40:03.724+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttfl9v0004kb8vnazsfczsk', 'hex screw((20*4mm)', 'SCR-HEX-20X4', 'Fixing', 'pcs', NULL, 'DISCRETE', NULL, 0, 8, 0, '2026-09-09T01:40:03.756+00:00', '2026-09-09T01:40:03.822+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttfl9xu004mb8vn34p1a8a4', 'T nut(40mm)', 'NUT-T-40', 'Fixing', 'pcs', NULL, 'DISCRETE', NULL, 0, 56, 0, '2026-09-09T01:40:03.858+00:00', '2026-09-09T01:40:03.923+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttfla0i004ob8vniki0qpvp', 'umbrella washer', 'WSH-UMB', 'Fixing', 'pcs', NULL, 'DISCRETE', NULL, 0, 17, 0, '2026-09-09T01:40:03.954+00:00', '2026-09-09T01:40:04.019+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttfla38004qb8vn4pz7noyw', 'hillman self drillin screw(40*3mm)', 'SCR-SD-40X3', 'Fixing', 'pcs', NULL, 'DISCRETE', NULL, 0, 62, 0, '2026-09-09T01:40:04.052+00:00', '2026-09-09T01:40:04.123+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttfla65004sb8vnde9ku5a6', 'hex serrated flange bolt(30*5mm)', 'BLT-FLG-SER-30X5', 'Fixing', 'pcs', NULL, 'DISCRETE', NULL, 0, 42, 0, '2026-09-09T01:40:04.157+00:00', '2026-09-09T01:40:04.227+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttfla90004ub8vnlgg1gcfg', 'spring washer', 'WSH-SPR', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 115, 0, '2026-09-09T01:40:04.260+00:00', '2026-09-09T01:40:04.340+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttflac7004xb8vnjgpal3bm', 'hex head screw(70*4mm)', 'SCR-HEX-70X4', 'Fixing', 'pcs', NULL, 'DISCRETE', NULL, 0, 29, 0, '2026-09-09T01:40:04.375+00:00', '2026-09-09T01:40:04.446+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttflaf1004zb8vnz226nejr', 'cu ring lug(35-10sqmm)', 'LUG-RNG-CU-35-10', 'Fixing', 'pcs', NULL, 'DISCRETE', NULL, 0, 7, 0, '2026-09-09T01:40:04.477+00:00', '2026-09-09T01:40:04.555+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttflai30051b8vnfofvee0x', 'M6 alen bolt(33mm)', 'BLT-ALN-M6-33', 'Fixing', 'pcs', NULL, 'DISCRETE', NULL, 0, 55, 0, '2026-09-09T01:40:04.587+00:00', '2026-09-09T01:40:04.655+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttflakx0053b8vn95dd9wdv', 'cu ring lug(10)', 'LUG-RNG-CU-10', 'Fixing', 'pcs', NULL, 'DISCRETE', NULL, 0, 40, 0, '2026-09-09T01:40:04.689+00:00', '2026-09-09T01:40:04.755+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttflanp0055b8vnn47no7m1', 'mounting z clamp', 'CLM-Z-MNT', 'Fixing', 'pcs', NULL, 'DISCRETE', NULL, 0, 24, 0, '2026-09-09T01:40:04.789+00:00', '2026-09-09T01:40:04.859+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttflaqk0057b8vn2m1qsif1', 'pvc cable marker ferrules(6 sq mm)', 'FER-MKR-06', 'Material', 'pcs', NULL, 'DISCRETE', NULL, 0, 29, 0, '2026-09-09T01:40:04.892+00:00', '2026-09-09T01:40:04.954+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttflat60059b8vnue234mmk', 'hex head screw(60*5mm)', 'SCR-HEX-60X5', 'Fixing', 'pcs', NULL, 'DISCRETE', NULL, 0, 120, 0, '2026-09-09T01:40:04.986+00:00', '2026-09-09T01:40:05.054+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttflaw2005bb8vno19ka3yo', 'hex head screw(105*5mm)', 'SCR-HEX-105X5', 'Fixing', 'pcs', NULL, 'DISCRETE', NULL, 0, 19, 0, '2026-09-09T01:40:05.090+00:00', '2026-09-09T01:40:05.159+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttflayw005db8vn3lrj3e1l', 'M7 alen bolt(43mm)', 'BLT-ALN-M7-43', 'Fixing', 'pcs', NULL, 'DISCRETE', NULL, 0, 7, 0, '2026-09-09T01:40:05.192+00:00', '2026-09-09T01:40:05.262+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttflb1s005fb8vn6j4idkfw', 'M5 alen bolt(45mm)', 'BLT-ALN-M5-45', 'Fixing', 'pcs', NULL, 'DISCRETE', NULL, 0, 11, 0, '2026-09-09T01:40:05.296+00:00', '2026-09-09T01:40:05.363+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttflb4m005hb8vnlpezft5s', 'SS flat washer(11mm,22mm)', 'WSH-FLT-SS-11-22', 'Fixing', 'pcs', NULL, 'DISCRETE', NULL, 0, 19, 0, '2026-09-09T01:40:05.398+00:00', '2026-09-09T01:40:05.468+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttflb7j005jb8vn5kof3olp', 'SS flat washer(20mm,6mm)', 'WSH-FLT-SS-20-06', 'Fixing', 'pcs', NULL, 'DISCRETE', NULL, 0, 20, 0, '2026-09-09T01:40:05.503+00:00', '2026-09-09T01:40:05.575+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttflbaj005lb8vndsjqqtv5', 'SS flat washer (22mm,6mm)', 'WSH-FLT-SS-22-06', 'Fixing', 'pcs', NULL, 'DISCRETE', NULL, 0, 25, 0, '2026-09-09T01:40:05.611+00:00', '2026-09-09T01:40:05.683+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttflbdi005nb8vnmfeiscfe', 'SS flat washer (12mm,6mm)', 'WSH-FLT-SS-12-06', 'Fixing', 'pcs', NULL, 'DISCRETE', NULL, 0, 0, 0, '2026-09-09T01:40:05.718+00:00', '2026-09-09T01:40:05.774+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttflbfy005ob8vnfbcre27o', 'ring type lugs(25sqmm) cu', 'LUG-RNG-CU-25', 'Fixing', 'pcs', NULL, 'DISCRETE', NULL, 0, 5, 0, '2026-09-09T01:40:05.806+00:00', '2026-09-09T01:40:05.876+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttflbiz005qb8vnpuwz5fuq', 'T nut - 30mm', 'NUT-T-30', 'Fixing', 'pcs', NULL, 'DISCRETE', NULL, 0, 66, 0, '2026-09-09T01:40:05.915+00:00', '2026-09-09T01:40:05.981+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttflbls005sb8vnx4wkf58x', 'ss hex screw (40*5mm)', 'SCR-HEX-SS-40X5', 'Fixing', 'pcs', NULL, 'DISCRETE', NULL, 0, 8, 0, '2026-09-09T01:40:06.016+00:00', '2026-09-09T01:40:06.082+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttflboi005ub8vndvktqema', 'micro inventors', 'INV-MICRO', 'Equipment', 'pcs', NULL, 'DISCRETE', NULL, 0, 2, 0, '2026-09-09T01:40:06.114+00:00', '2026-09-09T01:40:06.180+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttflbr7005wb8vntrhse1st', 'metal flat screw', 'SCR-FLT-MTL', 'Fixing', 'pcs', NULL, 'DISCRETE', NULL, 0, 170, 0, '2026-09-09T01:40:06.211+00:00', '2026-09-09T01:40:06.275+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttflbtw005yb8vnm1ubx850', 'hex head screw (50mm)', 'SCR-HEX-50', 'Fixing', 'pcs', NULL, 'DISCRETE', NULL, 0, 17, 0, '2026-09-09T01:40:06.308+00:00', '2026-09-09T01:40:06.380+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttflbwv0060b8vnqan32otu', 'M8 solar rail T nut', 'NUT-T-M8-RAIL', 'Fixing', 'pcs', NULL, 'DISCRETE', NULL, 0, 14, 0, '2026-09-09T01:40:06.415+00:00', '2026-09-09T01:40:06.480+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttflbzm0062b8vnzs3clxuk', 'M6 square head bolt(35mm)', 'BLT-SQH-M6-35', 'Fixing', 'pcs', NULL, 'DISCRETE', NULL, 0, 35, 0, '2026-09-09T01:40:06.514+00:00', '2026-09-09T01:40:06.581+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttflc2g0064b8vn8qxq3thw', 'spring nut', 'NUT-SPR', 'Fixing', 'pcs', NULL, 'DISCRETE', NULL, 0, 60, 0, '2026-09-09T01:40:06.616+00:00', '2026-09-09T01:40:06.687+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttflc5d0066b8vndjlxsebe', 'solar panel mid clamp(40mm)', 'CLM-MID-40', 'Fixing', 'pcs', NULL, 'DISCRETE', NULL, 0, 25, 0, '2026-09-09T01:40:06.721+00:00', '2026-09-09T01:40:06.789+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttflc8a0068b8vnkpifc25e', 'Insulation Tape - Red', 'TAP-INS-RED', 'Material', 'pcs', NULL, 'DISCRETE', NULL, 0, 6, 0, '2026-09-09T01:40:06.826+00:00', '2026-09-09T01:40:06.890+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttflcay006ab8vn1o188hr5', 'Insulation Tape - Yellow', 'TAP-INS-YEL', 'Material', 'pcs', 'roll', 'DISCRETE', NULL, 0, 15, 0, '2026-09-09T01:40:06.922+00:00', '2026-09-09T01:40:07.003+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttflce2006db8vne57etcm0', 'Insulation Tape - Blue', 'TAP-INS-BLU', 'Material', 'pcs', 'roll', 'DISCRETE', NULL, 0, 9, 0, '2026-09-09T01:40:07.034+00:00', '2026-09-09T01:40:07.112+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttflch4006gb8vnh1yml6mj', 'Insulation Tape - Black', 'TAP-INS-BLK', 'Material', 'pcs', 'roll', 'DISCRETE', NULL, 0, 9, 0, '2026-09-09T01:40:07.144+00:00', '2026-09-09T01:40:07.227+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttflckd006jb8vnnj8n6901', 'Insulation Tape - Green', 'TAP-INS-GRN', 'Material', 'pcs', NULL, 'DISCRETE', NULL, 0, 5, 0, '2026-09-09T01:40:07.261+00:00', '2026-09-09T01:40:07.328+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttflcn7006lb8vn2ye3jjoe', 'Brown Tape', 'TAP-BRN', 'Material', 'pcs', NULL, 'DISCRETE', NULL, 0, 2, 0, '2026-09-09T01:40:07.363+00:00', '2026-09-09T01:40:07.430+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttflcq0006nb8vnlp1mkhp8', 'Transparent Tape', 'TAP-TRP', 'Material', 'pcs', NULL, 'DISCRETE', NULL, 0, 1, 0, '2026-09-09T01:40:07.464+00:00', '2026-09-09T01:40:07.533+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttofm1v000004l4g2mngp21', 'Solar Panel Premiere (550Wp DCR)', 'SLR-PNL-550', 'Material', 'pcs', NULL, 'DISCRETE', NULL, 0, 0, 0, '2026-09-09T05:47:36.163+00:00', '2026-09-09T05:47:54.405+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttox7om000004jr20wtaq2x', 'FRP Walk-Way(3.66m)', 'FRP-WW-3.66m', 'Material', 'pcs', NULL, 'DISCRETE', NULL, 0, 0, 0, '2026-09-09T06:01:17.350+00:00', '2026-09-09T06:01:17.350+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttp0ygi000004juyp7a4kj7', '3 Earthing Kit (1m&1LA-kit)', 'KIT-EARTH', 'Material', 'pcs', NULL, 'DISCRETE', NULL, 0, 0, 0, '2026-09-09T06:04:12.018+00:00', '2026-09-09T06:04:12.018+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttp533y000004lbdxavxf84', 'Ring Type Lug 10sqmm  (ed:10mm , id:6mm)', 'RIN-LUG-10', 'Fixing', 'pcs', 'Packet', 'DISCRETE', NULL, 0, 0, 0, '2026-09-09T06:07:24.671+00:00', '2026-09-09T06:07:24.671+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttp7fty000104jr26lr6f89', 'Pad Lock Rotary-Isolator', 'ISO-PDRT', 'Equipment', 'pcs', NULL, 'DISCRETE', NULL, 0, 0, 0, '2026-09-09T06:09:14.470+00:00', '2026-09-09T06:09:14.470+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttpbq3e000004l54ncawbzm', 'Conduit Pipes-White(1''-3m)', 'CON-PIP_WHT', 'Fixing', 'pcs', 'Packet', 'DISCRETE', NULL, 0, 0, 0, '2026-09-09T06:12:34.394+00:00', '2026-09-09T06:12:34.394+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttpkall000104l5bw28rrjo', 'Meter-Box-3Phase', 'BOX-MTR-#3', 'Equipment', 'pcs', NULL, 'DISCRETE', NULL, 0, 0, 0, '2026-09-09T06:19:14.217+00:00', '2026-09-09T06:19:14.217+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttpmf9k000004ifpnj7qag3', 'GI Screw 1.5''', 'SCRW-GI-1.5''', 'Fixing', 'pcs', 'Packet', 'DISCRETE', NULL, 0, 0, 0, '2026-09-09T06:20:53.576+00:00', '2026-09-09T06:20:53.576+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttpx91j000104ifn24k1del', 'PVC Cable Tray', 'PVC-CBLTR-45x45', 'Fixing', 'pcs', NULL, 'DISCRETE', NULL, 0, 0, 0, '2026-09-09T06:29:18.727+00:00', '2026-09-09T06:29:18.727+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttq051a000004jy1p85uo3x', 'Flexible Pipe 25mm (BLK)', 'PIP-FLX-25', 'Fixing', 'm', 'roll', 'CONTINUOUS', 0, 0, 0, 0, '2026-09-09T06:31:33.502+00:00', '2026-09-09T06:31:33.502+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmttx4kqc000004l7a0s1wfic', 'Inverter Deye (10kW)', 'INV-SLRD-10', 'Equipment', 'pcs', NULL, 'DISCRETE', NULL, 0, 0, 0, '2026-09-09T09:50:57.780+00:00', '2026-09-09T09:50:57.780+00:00');
INSERT INTO "User" ("id", "name", "email", "passwordHash", "role", "isActive", "createdAt") VALUES ('cmt8clq0300002svnyz2bbkg3', 'Admin', 'admin@example.com', '$2b$10$1LyYZD6C2RFlWHg1DSDHKuBg2NT5KvuZtnKV1xTWTGu6mXEDhI6TK', 'ADMIN', 1, '2026-08-25T07:33:16.131+00:00');
INSERT INTO "User" ("id", "name", "email", "passwordHash", "role", "isActive", "createdAt") VALUES ('cmt8clqf000012svngbs04djq', 'Finance', 'finance@example.com', '$2b$10$vOTPi1t/jPUN.hX9HgHw3uxfk7W50D.yzq.R1MOjtb/G09RQg.RpG', 'EMPLOYEE', 1, '2026-08-25T07:33:16.668+00:00');
INSERT INTO "User" ("id", "name", "email", "passwordHash", "role", "isActive", "createdAt") VALUES ('cmt8clqjj00022svngzgjibno', 'Employee', 'employee@example.com', '$2b$10$QNumupivp6J47aWhV03rKeWOYLiMd547ju1T3/AVBNWTkPfs8hPGK', 'EMPLOYEE', 1, '2026-08-25T07:33:16.831+00:00');
INSERT INTO "User" ("id", "name", "email", "passwordHash", "role", "isActive", "createdAt") VALUES ('cmt8ez458000004jps43rqy2q', 'SANCHITA PARAB', 'sanchita.p@solarcastle.in', '$2b$10$q7jPNw1ee7xE8suF39zJ2OfAhf6j7aX1e0PbPsmR.lJJxGr11p5UO', 'FINANCE', 1, '2026-08-25T08:39:40.220+00:00');
INSERT INTO "User" ("id", "name", "email", "passwordHash", "role", "isActive", "createdAt") VALUES ('cmt8f4cpf000004k01xjvpml5', 'Durgesh Nandkumar Pawar', 'durgesh.solarcastle@gmail.com', '$2b$10$b/B4KT92bboH4EvQViSQUe9Hcu5p7Eh9S9IfksZSJUmlzreVJD1Eq', 'FINANCE', 1, '2026-08-25T08:43:44.595+00:00');
INSERT INTO "User" ("id", "name", "email", "passwordHash", "role", "isActive", "createdAt") VALUES ('cmt8fbe9h000104k0b0urezaf', 'Anshul', 'sales.solarcastle@gmail.com', '$2b$10$e9VOcGT/ev63ohWSDepVBO0hXsb26Zgv5r4awpxAi71kpqENw7Tc2', 'ADMIN', 1, '2026-08-25T08:49:13.205+00:00');
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count") VALUES ('bf140c64-6553-4447-a112-8b473dd40bed', '1535b8eda0e8f56d438cf8991b694b923b9a6ee0d92b3805856335d37d435483', '2026-09-05T02:54:58.447Z', '20260818115849_init', NULL, NULL, '2026-09-05T02:54:58.446Z', 1);
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count") VALUES ('377518ba-d581-4c89-9f16-c169ee0e7214', '5afd801d603376e8c8d95acb0c4c4d218768ca0345bf08746898b31eb5562faa', '2026-09-05T02:54:58.485Z', '20260819080332_condition_based_shelving', NULL, NULL, '2026-09-05T02:54:58.485Z', 1);
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count") VALUES ('d81bcbf6-514c-4c83-a777-a16465d078f9', 'f3bcb2893ebef35b48a4028d1763449e1382bcb3e3b38bf916f97f5a696ce598', '2026-09-05T02:54:58.519Z', '20260820140000_packs_units_scrap_defects', NULL, NULL, '2026-09-05T02:54:58.519Z', 1);
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count") VALUES ('14ee642e-5fc8-4955-b4f6-d066ab504c32', 'f669c3b1dd0cd90736e1268d9ed9978b2a1f5894c5c043048e7f2592ed082333', '2026-09-05T02:54:58.559Z', '20260820150000_roles_finance_employee', NULL, NULL, '2026-09-05T02:54:58.558Z', 1);
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count") VALUES ('53e6b253-f161-4f06-a51f-76426d9f7d70', 'da27379cc021205a6cb1215e82104280e1c5c70bf846e64cd3865b01390d138a', '2026-09-05T02:54:58.595Z', '20260820160000_corrections', NULL, NULL, '2026-09-05T02:54:58.595Z', 1);
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count") VALUES ('e6801784-3397-4179-b641-f4b6dbe33877', '3888409a7c5384dfaeccd9f155936b0ea30e374b7294574239c3b90b322b3a55', '2026-09-05T02:54:58.632Z', '20260820161000_reversed_at', NULL, NULL, '2026-09-05T02:54:58.632Z', 1);
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count") VALUES ('06e2832d-76e6-402c-b472-8b963bd39c96', '14f9e5bc4ea58e60721814baa4d0885668b82aac01ad5129ecf805205081ad78', '2026-09-05T02:54:58.667Z', '20260820170000_dispatch_batch', NULL, NULL, '2026-09-05T02:54:58.667Z', 1);
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count") VALUES ('65720f15-c36f-47bf-8b12-e52519ac7fa8', '6885d2868eeb08d565d380da60a0f87e8a0e73e5991befb91c5cd686fe6bf8b2', '2026-09-05T02:54:58.705Z', '20260820180000_delivery_entry', NULL, NULL, '2026-09-05T02:54:58.705Z', 1);
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count") VALUES ('70de0aab-9cf4-4801-9a3a-5b9675eb8fa8', 'b21a58744b58a0354be2006577d4ae5e233bc6b1bc9a15d66b94a5fb26747b12', '2026-09-05T02:54:58.745Z', '20260820190000_site_lifecycle', NULL, NULL, '2026-09-05T02:54:58.744Z', 1);
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count") VALUES ('29940830-9882-4ab7-a004-d9e415df6a90', '3f4802aad147b8160869afba48ebf9c74b1dba77ed38bb6e85c73bbd4f79e6ea', '2026-09-05T02:54:58.782Z', '20260822141140_user_is_active', NULL, NULL, '2026-09-05T02:54:58.782Z', 1);
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count") VALUES ('4dacad99-c01b-4bdf-9e10-4803f08bb66a', '137c10ff4010916fcc920647a159ee95f22dc028cee9eb6f3213e7db21ccf638', '2026-09-07T11:50:42.351Z', '20260905032238_approval_requests', NULL, NULL, '2026-09-07T11:50:42.218Z', 1);
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count") VALUES ('a1a8c8cd-c285-48ce-b9fd-9f7240b0cc02', '0f59f2cf90f542041560192daa8775198e92b995baeea947d3a0143bae5bfc54', '2026-09-08T11:17:38.348Z', '20260908090000_delivery_challan', NULL, NULL, '2026-09-08T11:17:38.109Z', 1);
INSERT INTO "Sequence" ("key", "value") VALUES ('challan', 0);
COMMIT;
PRAGMA foreign_keys=ON;
