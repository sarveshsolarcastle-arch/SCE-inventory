-- Inventory database dump — 2026-09-19T19:04:43.136Z
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
DROP TABLE IF EXISTS "User";
DROP TABLE IF EXISTS "_prisma_migrations";
DROP TABLE IF EXISTS "ApprovalRequest";
DROP TABLE IF EXISTS "Sequence";
DROP TABLE IF EXISTS "Dispatch";
DROP TABLE IF EXISTS "Transfer";
DROP TABLE IF EXISTS "Transaction";
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
    "userId" TEXT NOT NULL, "challanNo" INTEGER, "deliveredBy" TEXT, "receivedBy" TEXT,
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
CREATE UNIQUE INDEX "Delivery_challanNo_key" ON "Delivery"("challanNo");
CREATE UNIQUE INDEX "Transaction_reversesId_key" ON "Transaction"("reversesId");
CREATE INDEX "Transaction_reversedAt_idx" ON "Transaction"("reversedAt");
CREATE INDEX "Transaction_itemId_idx" ON "Transaction"("itemId");
CREATE INDEX "Transaction_siteId_idx" ON "Transaction"("siteId");
CREATE INDEX "Transaction_createdAt_idx" ON "Transaction"("createdAt");
CREATE INDEX "Transaction_dispatchId_idx" ON "Transaction"("dispatchId");
CREATE INDEX "Transaction_deliveryId_idx" ON "Transaction"("deliveryId");
CREATE INDEX "Transaction_transferId_idx" ON "Transaction"("transferId");
CREATE INDEX "Transaction_fromSiteId_idx" ON "Transaction"("fromSiteId");
CREATE UNIQUE INDEX "Transfer_challanNo_key" ON "Transfer"("challanNo");
CREATE INDEX "Transfer_transferredAt_idx" ON "Transfer"("transferredAt");
CREATE INDEX "Transfer_fromSiteId_idx" ON "Transfer"("fromSiteId");
CREATE INDEX "Transfer_toSiteId_idx" ON "Transfer"("toSiteId");
INSERT INTO "Site" ("id", "name", "location", "notes", "createdAt", "address", "customerName", "projectCode") VALUES ('cmttnk88l000004jrj4m6fabl', 'Yuvraj Tamboskar', 'Pernem', NULL, '2026-09-09T05:23:11.925+00:00', 'Near bus stand , Pernem', 'Yuvraj Tamboskar', 'SCE-26-001');
INSERT INTO "PackStock" ("id", "itemId", "packSize", "sealedCount") VALUES ('cmu88qp7a000lmsvno2qa7v46', 'cmu88qp6r000kmsvn7nxh9bqb', 100, 8);
INSERT INTO "PackStock" ("id", "itemId", "packSize", "sealedCount") VALUES ('cmu88qpbu000nmsvndv4vnbsg', 'cmu88qpba000mmsvnn3rag0yo', 100, 8);
INSERT INTO "PackStock" ("id", "itemId", "packSize", "sealedCount") VALUES ('cmu88qthl003xmsvnzfnyknhw', 'cmu88qth6003wmsvnxc14x1gm', 100, 1);
INSERT INTO "PackStock" ("id", "itemId", "packSize", "sealedCount") VALUES ('cmu88qu95004imsvny88ngr6x', 'cmu88qu8q004hmsvnykq0krqt', 50, 3);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qoev0001msvnoxnq6vbu', 'cmu88qoec0000msvnau6nl6t1', 36, NULL, 'OPEN', '2026-09-19T10:24:51.223+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qohy0003msvnclxw7v0h', 'cmu88qohj0002msvnoaqg9sk8', 36, NULL, 'OPEN', '2026-09-19T10:24:51.334+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qokr0005msvnw9gea2bo', 'cmu88qokc0004msvnpdr1wkop', 12, NULL, 'OPEN', '2026-09-19T10:24:51.435+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qonf0007msvnm1pnaabv', 'cmu88qomy0006msvnjygqew10', 1, NULL, 'OPEN', '2026-09-19T10:24:51.531+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qoq80009msvnq3hza9xd', 'cmu88qops0008msvnj033xhjw', 1, NULL, 'OPEN', '2026-09-19T10:24:51.632+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qotk000bmsvncqrvceez', 'cmu88qosw000amsvnkp4af6sg', 11, NULL, 'OPEN', '2026-09-19T10:24:51.752+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qow9000dmsvnjri24oed', 'cmu88qovt000cmsvng8iqbs3e', 55, NULL, 'OPEN', '2026-09-19T10:24:51.850+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qoz5000fmsvnbsrq5xb7', 'cmu88qoyl000emsvn7g7kr528', 7, NULL, 'OPEN', '2026-09-19T10:24:51.953+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qp1v000hmsvn2pdxypkl', 'cmu88qp1g000gmsvnlfn5t20e', 150, NULL, 'OPEN', '2026-09-19T10:24:52.051+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qp4i000jmsvnsljm9ixc', 'cmu88qp43000imsvnd0bjj1if', 40, NULL, 'OPEN', '2026-09-19T10:24:52.146+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qpeg000pmsvn1820wkg8', 'cmu88qpe1000omsvn0m4prs0d', 60, NULL, 'OPEN', '2026-09-19T10:24:52.504+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qph3000rmsvncs99yf3r', 'cmu88qpgo000qmsvniveaduvs', 110, NULL, 'OPEN', '2026-09-19T10:24:52.599+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qpjp000tmsvnjzqlefrn', 'cmu88qpj9000smsvn6sttwd6b', 40, NULL, 'OPEN', '2026-09-19T10:24:52.693+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qpmh000vmsvnklwqwqfu', 'cmu88qplv000umsvnqy7ji0nr', 21, NULL, 'OPEN', '2026-09-19T10:24:52.793+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qpq1000xmsvn5yn0h9mq', 'cmu88qpoq000wmsvnhmvcaqvb', 5, NULL, 'OPEN', '2026-09-19T10:24:52.921+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qpsp000zmsvnsjyp9csn', 'cmu88qps8000ymsvn1svnkrk1', 3, NULL, 'OPEN', '2026-09-19T10:24:53.017+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qpvg0011msvnc10ewbyi', 'cmu88qpv10010msvn4d8jlxl1', 130, NULL, 'OPEN', '2026-09-19T10:24:53.116+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qpy00013msvntofx84c3', 'cmu88qpxl0012msvnu2ape7h2', 400, NULL, 'OPEN', '2026-09-19T10:24:53.208+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qpyf0014msvnrn95c7xx', 'cmu88qpxl0012msvnu2ape7h2', 500, NULL, 'OPEN', '2026-09-19T10:24:53.223+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qq160016msvnth6gh7s4', 'cmu88qq0l0015msvn45xzo3s4', 199, NULL, 'OPEN', '2026-09-19T10:24:53.322+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qq1k0017msvn3zj5pncq', 'cmu88qq0l0015msvn45xzo3s4', 500, NULL, 'OPEN', '2026-09-19T10:24:53.336+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qq4b0019msvn68rnsffr', 'cmu88qq3w0018msvn1p5trb7c', 1, NULL, 'OPEN', '2026-09-19T10:24:53.435+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qq79001bmsvnh37kttkb', 'cmu88qq6o001amsvnebnzslzs', 1, NULL, 'OPEN', '2026-09-19T10:24:53.541+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qqcv001emsvncss4owh9', 'cmu88qqca001dmsvnkqj8q0eq', 1, NULL, 'OPEN', '2026-09-19T10:24:53.743+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qqfx001gmsvnvvfobhd2', 'cmu88qqfh001fmsvnnil7n7je', 180, NULL, 'OPEN', '2026-09-19T10:24:53.853+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qqiq001imsvnv2aq6pux', 'cmu88qqia001hmsvnohemsx24', 19, NULL, 'OPEN', '2026-09-19T10:24:53.954+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qqlg001kmsvnz0rnzoam', 'cmu88qql0001jmsvnbl5lxpml', 4, NULL, 'OPEN', '2026-09-19T10:24:54.052+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qqlw001lmsvnaon342lo', 'cmu88qql0001jmsvnbl5lxpml', 6, NULL, 'OPEN', '2026-09-19T10:24:54.068+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qqmi001mmsvnimqffzvf', 'cmu88qql0001jmsvnbl5lxpml', 9, NULL, 'OPEN', '2026-09-19T10:24:54.090+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qqn2001nmsvntdeyzxv9', 'cmu88qql0001jmsvnbl5lxpml', 7, NULL, 'OPEN', '2026-09-19T10:24:54.110+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qqni001omsvntrjfqk7g', 'cmu88qql0001jmsvnbl5lxpml', 6, NULL, 'OPEN', '2026-09-19T10:24:54.126+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qqnx001pmsvnv23h06tw', 'cmu88qql0001jmsvnbl5lxpml', 7, NULL, 'OPEN', '2026-09-19T10:24:54.141+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qqoe001qmsvntuy31m96', 'cmu88qql0001jmsvnbl5lxpml', 4, NULL, 'OPEN', '2026-09-19T10:24:54.158+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qqos001rmsvnhvlhljuk', 'cmu88qql0001jmsvnbl5lxpml', 19, NULL, 'OPEN', '2026-09-19T10:24:54.172+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qqp7001smsvneicsnbfk', 'cmu88qql0001jmsvnbl5lxpml', 3, NULL, 'OPEN', '2026-09-19T10:24:54.187+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qqpq001tmsvnnra20k7s', 'cmu88qql0001jmsvnbl5lxpml', 2, NULL, 'OPEN', '2026-09-19T10:24:54.206+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qqqa001umsvne6mzxecl', 'cmu88qql0001jmsvnbl5lxpml', 33, NULL, 'OPEN', '2026-09-19T10:24:54.226+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qqt7001wmsvn9k2ecgwp', 'cmu88qqso001vmsvn8tevfhgi', 4, NULL, 'OPEN', '2026-09-19T10:24:54.331+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qqtr001xmsvngbrndzzg', 'cmu88qqso001vmsvn8tevfhgi', 5, NULL, 'OPEN', '2026-09-19T10:24:54.351+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qqu7001ymsvn4yfgct8m', 'cmu88qqso001vmsvn8tevfhgi', 12, NULL, 'OPEN', '2026-09-19T10:24:54.367+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qquq001zmsvnsnd28t0o', 'cmu88qqso001vmsvn8tevfhgi', 100, NULL, 'OPEN', '2026-09-19T10:24:54.386+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qqxs0021msvnqr70trb7', 'cmu88qqx90020msvnkrp2gwl7', 100, NULL, 'OPEN', '2026-09-19T10:24:54.496+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qr110023msvn0dskfu2t', 'cmu88qr0j0022msvnc1ogtw40', 13, NULL, 'OPEN', '2026-09-19T10:24:54.613+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qr4z0025msvn5oe072uq', 'cmu88qr4j0024msvno7rmibto', 3, NULL, 'OPEN', '2026-09-19T10:24:54.755+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qrat0028msvnkstamw6x', 'cmu88qra90027msvnfx4pof5d', 40, NULL, 'OPEN', '2026-09-19T10:24:54.965+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qrei002amsvna1b82cfa', 'cmu88qrdz0029msvnrorelvos', 8, NULL, 'OPEN', '2026-09-19T10:24:55.098+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qrhv002cmsvnxb6kc4ob', 'cmu88qrh9002bmsvn0jgzw97m', 2, NULL, 'OPEN', '2026-09-19T10:24:55.219+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qrl6002emsvn5yc95y8e', 'cmu88qrkd002dmsvn1vi7v297', 21, NULL, 'OPEN', '2026-09-19T10:24:55.338+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qro8002gmsvnle4pvthu', 'cmu88qrno002fmsvn5ltg5b4o', 54, NULL, 'OPEN', '2026-09-19T10:24:55.448+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qrru002imsvnexhadxm6', 'cmu88qrr2002hmsvnhpjyaerc', 8, NULL, 'OPEN', '2026-09-19T10:24:55.578+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qrv1002kmsvnk1g67v40', 'cmu88qruh002jmsvn0quvie3d', 10, NULL, 'OPEN', '2026-09-19T10:24:55.693+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qry0002mmsvn83a4wup6', 'cmu88qrxi002lmsvn001gx8ot', 28, NULL, 'OPEN', '2026-09-19T10:24:55.800+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qs0y002omsvnvil1jzq5', 'cmu88qs0h002nmsvneppma7n4', 67, NULL, 'OPEN', '2026-09-19T10:24:55.906+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qs3h002qmsvnro7qonbo', 'cmu88qs31002pmsvn6dk3l3v6', 200, NULL, 'OPEN', '2026-09-19T10:24:55.997+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qs3w002rmsvn5no13u16', 'cmu88qs31002pmsvn6dk3l3v6', 250, NULL, 'OPEN', '2026-09-19T10:24:56.012+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qs4b002smsvn9lm1yaqr', 'cmu88qs31002pmsvn6dk3l3v6', 300, NULL, 'OPEN', '2026-09-19T10:24:56.027+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qs4s002tmsvnbjzxvogo', 'cmu88qs31002pmsvn6dk3l3v6', 26, NULL, 'OPEN', '2026-09-19T10:24:56.044+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qs7j002vmsvnei0ojw75', 'cmu88qs72002umsvn08lvhy3u', 59, NULL, 'OPEN', '2026-09-19T10:24:56.143+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qs7z002wmsvnoxjg3z8d', 'cmu88qs72002umsvn08lvhy3u', 30, NULL, 'OPEN', '2026-09-19T10:24:56.159+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qs8e002xmsvnx8qb1oso', 'cmu88qs72002umsvn08lvhy3u', 35, NULL, 'OPEN', '2026-09-19T10:24:56.174+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qs8w002ymsvn86pvahbw', 'cmu88qs72002umsvn08lvhy3u', 54, NULL, 'OPEN', '2026-09-19T10:24:56.192+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qs9e002zmsvnisuhij95', 'cmu88qs72002umsvn08lvhy3u', 13, NULL, 'OPEN', '2026-09-19T10:24:56.210+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qs9t0030msvn9xp5v5wc', 'cmu88qs72002umsvn08lvhy3u', 100, NULL, 'OPEN', '2026-09-19T10:24:56.225+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qsae0031msvnejl0gvn4', 'cmu88qs72002umsvn08lvhy3u', 200, NULL, 'OPEN', '2026-09-19T10:24:56.246+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qsdg0033msvncjrsygg8', 'cmu88qscv0032msvn82j43la4', 200, NULL, 'OPEN', '2026-09-19T10:24:56.356+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qsdu0034msvn60i5buey', 'cmu88qscv0032msvn82j43la4', 250, NULL, 'OPEN', '2026-09-19T10:24:56.370+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qsec0035msvnmlv2cc53', 'cmu88qscv0032msvn82j43la4', 300, NULL, 'OPEN', '2026-09-19T10:24:56.388+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qsh10037msvnp4yddgmv', 'cmu88qsgm0036msvntbr4wqgp', 66, NULL, 'OPEN', '2026-09-19T10:24:56.485+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qsjq0039msvn3hzghmiu', 'cmu88qsja0038msvn2bbqxg8v', 21, NULL, 'OPEN', '2026-09-19T10:24:56.582+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qsmb003bmsvnw6mjoxl8', 'cmu88qslv003amsvnxul6h0t2', 30, NULL, 'OPEN', '2026-09-19T10:24:56.675+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qspb003dmsvnrw4cq2hv', 'cmu88qsow003cmsvnievos799', 26, NULL, 'OPEN', '2026-09-19T10:24:56.783+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qss8003fmsvnu6s4q2kv', 'cmu88qsrs003emsvnydah272c', 6, NULL, 'OPEN', '2026-09-19T10:24:56.888+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qsv0003hmsvnek6osdqs', 'cmu88qsuc003gmsvnrtx6duje', 23, NULL, 'OPEN', '2026-09-19T10:24:56.988+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qsxo003jmsvntcssqzmy', 'cmu88qsx7003imsvngswtty0z', 42, NULL, 'OPEN', '2026-09-19T10:24:57.084+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qt12003lmsvn5u6kbwyn', 'cmu88qt0l003kmsvndoh9e0lz', 116, NULL, 'OPEN', '2026-09-19T10:24:57.206+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qt40003nmsvnpqzyesuq', 'cmu88qt3k003mmsvnvswgjzk4', 1, NULL, 'OPEN', '2026-09-19T10:24:57.312+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qt6s003pmsvnmnf0nrw8', 'cmu88qt69003omsvnn370afcb', 3, NULL, 'OPEN', '2026-09-19T10:24:57.412+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qt9c003rmsvnqpowxs48', 'cmu88qt8w003qmsvnryfsnc7z', 112, NULL, 'OPEN', '2026-09-19T10:24:57.504+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qtc8003tmsvnmer1iqju', 'cmu88qtbt003smsvnhm7xcvn7', 80, NULL, 'OPEN', '2026-09-19T10:24:57.608+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qtet003vmsvnka9rssfh', 'cmu88qtec003umsvnf5fblj6j', 27, NULL, 'OPEN', '2026-09-19T10:24:57.701+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qthz003ymsvnqe830abl', 'cmu88qth6003wmsvnxc14x1gm', 170, NULL, 'OPEN', '2026-09-19T10:24:57.815+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qtkr0040msvns4wdv808', 'cmu88qtk9003zmsvng9dmo0se', 280, NULL, 'OPEN', '2026-09-19T10:24:57.915+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qtng0042msvnkaddc7nw', 'cmu88qtn00041msvnyrdpuwvz', 28, NULL, 'OPEN', '2026-09-19T10:24:58.012+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qtq60044msvnpkt2stkw', 'cmu88qtpr0043msvn2s0sir4i', 5, NULL, 'OPEN', '2026-09-19T10:24:58.110+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qtt00046msvndbiyaqmz', 'cmu88qtsh0045msvnunx824w6', 7, NULL, 'OPEN', '2026-09-19T10:24:58.212+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qtvu0048msvn81ml4w7t', 'cmu88qtvg0047msvnw8oeipl5', 15, NULL, 'OPEN', '2026-09-19T10:24:58.314+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qtyj004amsvnk7t8h6ue', 'cmu88qty50049msvnov9dhbfq', 10, NULL, 'OPEN', '2026-09-19T10:24:58.411+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qu0y004cmsvnrjzcjxin', 'cmu88qu0k004bmsvna5a6u4yy', 116, NULL, 'OPEN', '2026-09-19T10:24:58.498+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qu3i004emsvntnhhwi9q', 'cmu88qu33004dmsvn2f049cfk', 9, NULL, 'OPEN', '2026-09-19T10:24:58.590+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qu6j004gmsvn7zj73mo2', 'cmu88qu61004fmsvncomw79c2', 29, NULL, 'OPEN', '2026-09-19T10:24:58.699+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qu9l004jmsvniy8op45n', 'cmu88qu8q004hmsvnykq0krqt', 31, NULL, 'OPEN', '2026-09-19T10:24:58.809+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qucd004lmsvnj1sy5jlv', 'cmu88qubu004kmsvnh62zsqql', 30, NULL, 'OPEN', '2026-09-19T10:24:58.909+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88quf0004nmsvn6nmq3dy5', 'cmu88quej004mmsvn9uf8019c', 75, NULL, 'OPEN', '2026-09-19T10:24:59.004+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qui9004pmsvn71g2pytw', 'cmu88quhn004omsvnj9wj2jcq', 17, NULL, 'OPEN', '2026-09-19T10:24:59.121+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qul1004rmsvn3ashmbxy', 'cmu88qukl004qmsvnvhfhygcf', 62, NULL, 'OPEN', '2026-09-19T10:24:59.221+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88quno004tmsvn27zgtupx', 'cmu88qun6004smsvn3f2jdzfh', 120, NULL, 'OPEN', '2026-09-19T10:24:59.316+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88quqc004vmsvnzldi5zjs', 'cmu88qupv004umsvnbz8o8e2v', 19, NULL, 'OPEN', '2026-09-19T10:24:59.412+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qut8004xmsvnu04umv23', 'cmu88qusq004wmsvnfp9if3qr', 8, NULL, 'OPEN', '2026-09-19T10:24:59.516+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88quvy004zmsvn3zqm7gzi', 'cmu88quvg004ymsvnng1oqgkt', 19, NULL, 'OPEN', '2026-09-19T10:24:59.614+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88quyq0051msvnebdld34j', 'cmu88quyb0050msvnhowems89', 19, NULL, 'OPEN', '2026-09-19T10:24:59.714+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88quz50052msvnuv1dh4n3', 'cmu88quyb0050msvnhowems89', 8, NULL, 'OPEN', '2026-09-19T10:24:59.729+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qv1z0054msvn8eosu2hq', 'cmu88qv1k0053msvnq49s7aju', 17, NULL, 'OPEN', '2026-09-19T10:24:59.831+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qv5p0056msvno4v52heq', 'cmu88qv500055msvnhqtlz59d', 42, NULL, 'OPEN', '2026-09-19T10:24:59.965+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qv8r0058msvnbtsxla9p', 'cmu88qv8c0057msvnpmm53pxc', 29, NULL, 'OPEN', '2026-09-19T10:25:00.075+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qvbc005amsvnoufmfhpb', 'cmu88qvaw0059msvn06c02n3e', 16, NULL, 'OPEN', '2026-09-19T10:25:00.168+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qvdt005cmsvng71442w4', 'cmu88qvde005bmsvno8wte8rc', 64, NULL, 'OPEN', '2026-09-19T10:25:00.257+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qvgm005emsvne4b833mi', 'cmu88qvg2005dmsvnek1nubre', 25, NULL, 'OPEN', '2026-09-19T10:25:00.358+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qvj6005gmsvnl0ff5e32', 'cmu88qvir005fmsvnkm7qyj3d', 14, NULL, 'OPEN', '2026-09-19T10:25:00.450+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qvlw005imsvna7m6v7id', 'cmu88qvlh005hmsvnmo3blw3w', 200, NULL, 'OPEN', '2026-09-19T10:25:00.548+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qvol005kmsvnue8ajn3h', 'cmu88qvo4005jmsvn8siek0u3', 2, NULL, 'OPEN', '2026-09-19T10:25:00.645+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qvrv005mmsvnmeg9s45n', 'cmu88qvr0005lmsvneevs0e5o', 9, NULL, 'OPEN', '2026-09-19T10:25:00.763+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qvuq005omsvn3qdoj199', 'cmu88qvu8005nmsvnscrgdpg6', 15, NULL, 'OPEN', '2026-09-19T10:25:00.866+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qvxc005qmsvn1j5dfujj', 'cmu88qvww005pmsvnpl2fnn2d', 35, NULL, 'OPEN', '2026-09-19T10:25:00.960+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qvzu005smsvne14wm2hm', 'cmu88qvze005rmsvnm4t8tpn0', 55, NULL, 'OPEN', '2026-09-19T10:25:01.050+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qw2s005umsvniabxe2o5', 'cmu88qw28005tmsvn5g8e4033', 80, NULL, 'OPEN', '2026-09-19T10:25:01.156+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qw72005wmsvn4sqe1lah', 'cmu88qw6m005vmsvn717ritm8', 40, NULL, 'OPEN', '2026-09-19T10:25:01.310+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qw9o005ymsvn59tuw8f9', 'cmu88qw96005xmsvnes0qghn4', 40, NULL, 'OPEN', '2026-09-19T10:25:01.404+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qwce0060msvny4ibeew4', 'cmu88qwbx005zmsvnefhiwjcd', 60, NULL, 'OPEN', '2026-09-19T10:25:01.502+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qwfa0062msvn4hmykxbv', 'cmu88qwet0061msvny7x7yb88', 670, NULL, 'OPEN', '2026-09-19T10:25:01.606+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qwi00064msvnn0busm7o', 'cmu88qwhh0063msvnt825cpk5', 20, NULL, 'OPEN', '2026-09-19T10:25:01.704+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qwkp0066msvnve7omv5v', 'cmu88qwk70065msvnpf8nt0c9', 19, NULL, 'OPEN', '2026-09-19T10:25:01.801+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qwnb0068msvnpnavpbkk', 'cmu88qwmu0067msvnmoxq4341', 25, NULL, 'OPEN', '2026-09-19T10:25:01.895+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qwqq006amsvnexsubwvl', 'cmu88qwq90069msvneg08va14', 216, NULL, 'OPEN', '2026-09-19T10:25:02.018+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qwta006cmsvnb433yasa', 'cmu88qwsv006bmsvn6gc6r6eq', 168, NULL, 'OPEN', '2026-09-19T10:25:02.110+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qwvs006emsvnvc7gbvgn', 'cmu88qwvd006dmsvn0x5g1uvt', 64, NULL, 'OPEN', '2026-09-19T10:25:02.200+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qwyj006gmsvnb7exrr5n', 'cmu88qwy3006fmsvnayd235ks', 56, NULL, 'OPEN', '2026-09-19T10:25:02.299+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu88qx1d006imsvngg2yult5', 'cmu88qx0s006hmsvnd9mawsri', 41, NULL, 'OPEN', '2026-09-19T10:25:02.401+00:00', NULL);
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qoec0000msvnau6nl6t1', 'AC Cable - 1 Core x 4 sqmm - Black', 'AC-CABLE-1-CORE-X-4-SQMM-BLACK', 'Material', 'm', 'roll', 'CONTINUOUS', NULL, 0, 36, 0, '2026-09-19T10:24:51.205+00:00', '2026-09-19T10:24:51.286+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qohj0002msvnoaqg9sk8', 'AC Cable - 1 Core x 4 sqmm - Red', 'AC-CABLE-1-CORE-X-4-SQMM-RED', 'Material', 'm', 'roll', 'CONTINUOUS', NULL, 0, 36, 0, '2026-09-19T10:24:51.319+00:00', '2026-09-19T10:24:51.382+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qokc0004msvnpdr1wkop', 'AC Cable - 4 Core x 4 sqmm - Black', 'AC-CABLE-4-CORE-X-4-SQMM-BLACK', 'Material', 'm', 'roll', 'CONTINUOUS', NULL, 0, 12, 0, '2026-09-19T10:24:51.420+00:00', '2026-09-19T10:24:51.481+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qomy0006msvnjygqew10', 'ACDB- 1PH- 1-6KW-1 in / 1 out', 'ACDB-1PH-1-6KW-1-IN-1-OUT', 'Equipment', 'box', NULL, 'DISCRETE', NULL, 0, 1, 0, '2026-09-19T10:24:51.514+00:00', '2026-09-19T10:24:51.580+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qops0008msvnj033xhjw', 'ACDB- 3PH- 5-15KW', 'ACDB-3PH-5-15KW', 'Equipment', 'box', NULL, 'DISCRETE', NULL, 0, 1, 0, '2026-09-19T10:24:51.616+00:00', '2026-09-19T10:24:51.681+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qosw000amsvnkp4af6sg', 'Allen Bolt - M5 x 45mm', 'ALLEN-BOLT-M5-X-45MM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 11, 0, '2026-09-19T10:24:51.728+00:00', '2026-09-19T10:24:51.800+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qovt000cmsvng8iqbs3e', 'Allen Bolt - M6 x 33mm', 'ALLEN-BOLT-M6-X-33MM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 55, 0, '2026-09-19T10:24:51.833+00:00', '2026-09-19T10:24:51.897+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qoyl000emsvn7g7kr528', 'Allen Bolt - M7 x 43mm', 'ALLEN-BOLT-M7-X-43MM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 7, 0, '2026-09-19T10:24:51.933+00:00', '2026-09-19T10:24:52.004+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qp1g000gmsvnlfn5t20e', 'Bend Pipe', 'BEND-PIPE', 'Material', 'pcs', 'packet', 'DISCRETE', NULL, 0, 150, 0, '2026-09-19T10:24:52.036+00:00', '2026-09-19T10:24:52.097+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qp43000imsvnd0bjj1if', 'Cable Gland - PG20', 'CABLE-GLAND-PG20', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 40, 0, '2026-09-19T10:24:52.131+00:00', '2026-09-19T10:24:52.197+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qp6r000kmsvn7nxh9bqb', 'Cable Tie - Metal- 300mm', 'CABLE-TIE-METAL-300MM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 800, 0, '2026-09-19T10:24:52.227+00:00', '2026-09-19T10:24:52.350+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qpba000mmsvnn3rag0yo', 'Cable Tie - Nylon 300mm', 'CABLE-TIE-NYLON-300MM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 800, 0, '2026-09-19T10:24:52.390+00:00', '2026-09-19T10:24:52.457+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qpe1000omsvn0m4prs0d', 'Channel Spring Nut', 'CHANN-SPRIN-NUT', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 60, 0, '2026-09-19T10:24:52.489+00:00', '2026-09-19T10:24:52.550+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qpgo000qmsvniveaduvs', 'Copper Ring Lug - 10-8 sqmm', 'COPPE-RING-LUG-10-8-SQMM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 110, 0, '2026-09-19T10:24:52.585+00:00', '2026-09-19T10:24:52.646+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qpj9000smsvn6sttwd6b', 'Copper Ring Lug - 10sqmm', 'COPPE-RING-LUG-10SQMM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 40, 0, '2026-09-19T10:24:52.677+00:00', '2026-09-19T10:24:52.739+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qplv000umsvnqy7ji0nr', 'Copper Ring Lug - 16-8 sqmm', 'COPPE-RING-LUG-16-8-SQMM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 21, 0, '2026-09-19T10:24:52.771+00:00', '2026-09-19T10:24:52.839+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qpoq000wmsvnhmvcaqvb', 'Copper Ring Lug - 25 sqmm', 'COPPE-RING-LUG-25-SQMM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 5, 0, '2026-09-19T10:24:52.874+00:00', '2026-09-19T10:24:52.969+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qps8000ymsvn1svnkrk1', 'Copper Ring Lug - 35-10 sqmm', 'COPPE-RING-LUG-35-10-SQMM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 3, 0, '2026-09-19T10:24:53.000+00:00', '2026-09-19T10:24:53.066+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qpv10010msvn4d8jlxl1', 'Copper Ring Lug - 4-6 sqmm', 'COPPE-RING-LUG-4-6-SQMM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 130, 0, '2026-09-19T10:24:53.101+00:00', '2026-09-19T10:24:53.160+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qpxl0012msvnu2ape7h2', 'DC Cable - 1 Core x 4 sqmm - Black', 'DC-CABLE-1-CORE-X-4-SQMM-BLACK', 'Material', 'm', 'roll', 'CONTINUOUS', NULL, 0, 900, 0, '2026-09-19T10:24:53.193+00:00', '2026-09-19T10:24:53.270+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qq0l0015msvn45xzo3s4', 'DC Cable - 1 Core x 4 sqmm - Red', 'DC-CABLE-1-CORE-X-4-SQMM-RED', 'Material', 'm', 'roll', 'CONTINUOUS', NULL, 0, 699, 0, '2026-09-19T10:24:53.301+00:00', '2026-09-19T10:24:53.382+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qq3w0018msvn1p5trb7c', 'DCDB 1 in 1 out', 'DCDB-1-IN-1-OUT', 'Equipment', 'box', NULL, 'DISCRETE', NULL, 0, 1, 0, '2026-09-19T10:24:53.420+00:00', '2026-09-19T10:24:53.487+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qq6o001amsvnebnzslzs', 'DCDB 2 in 2 out', 'DCDB-2-IN-2-OUT', 'Equipment', 'box', NULL, 'DISCRETE', NULL, 0, 1, 0, '2026-09-19T10:24:53.520+00:00', '2026-09-19T10:24:53.587+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qq9q001cmsvn3oo0i52a', 'Deye String Inverter 10 KW', 'DEYE-STRIN-INVER-10-KW', 'Equipment', 'box', NULL, 'DISCRETE', NULL, 0, 0, 0, '2026-09-19T10:24:53.630+00:00', '2026-09-19T10:24:53.681+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qqca001dmsvnkqj8q0eq', 'Deye String Inverter 5 KW', 'DEYE-STRIN-INVER-5-KW', 'Equipment', 'box', NULL, 'DISCRETE', NULL, 0, 1, 0, '2026-09-19T10:24:53.722+00:00', '2026-09-19T10:24:53.801+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qqfh001fmsvnnil7n7je', 'Double Nail clamp', 'DOUBL-NAIL-CLAMP', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 180, 0, '2026-09-19T10:24:53.837+00:00', '2026-09-19T10:24:53.904+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qqia001hmsvnohemsx24', 'Dummy Piece', 'DUMMY-PIECE', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 19, 0, '2026-09-19T10:24:53.938+00:00', '2026-09-19T10:24:54.000+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qql0001jmsvnbl5lxpml', 'Earthing Cable - 1 Core-10 sqmm - Cu-Green', 'EARTH-CABLE-1-CORE-10-SQMM-CU-GREEN', 'Material', 'm', 'roll', 'CONTINUOUS', NULL, 0, 100, 0, '2026-09-19T10:24:54.036+00:00', '2026-09-19T10:24:54.279+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qqso001vmsvn8tevfhgi', 'Earthing Cable - 1 Core-6 sqmm -Cu- Green', 'EARTH-CABLE-1-CORE-6-SQMM-CU-GREEN', 'Material', 'm', 'roll', 'CONTINUOUS', NULL, 0, 121, 0, '2026-09-19T10:24:54.312+00:00', '2026-09-19T10:24:54.442+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qqx90020msvnkrp2gwl7', 'earthing cable 10sqmm,Cu-multi  strand(new)', 'EARTH-CABLE-10SQMM-CU-MULTI-STRAN', 'Material', 'm', 'roll', 'CONTINUOUS', NULL, 0, 100, 0, '2026-09-19T10:24:54.477+00:00', '2026-09-19T10:24:54.553+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qr0j0022msvnc1ogtw40', 'Earthing Connector', 'EARTH-CONNE', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 13, 0, '2026-09-19T10:24:54.595+00:00', '2026-09-19T10:24:54.670+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qr4j0024msvno7rmibto', 'earthing rod -2m', 'EARTH-ROD-2M', 'Material', 'pcs', 'packet', 'DISCRETE', NULL, 0, 3, 0, '2026-09-19T10:24:54.739+00:00', '2026-09-19T10:24:54.807+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qr7h0026msvn48fbxuaa', 'earthing rod-1m', 'EARTH-ROD-1M', 'Material', 'pcs', 'packet', 'DISCRETE', NULL, 0, 0, 0, '2026-09-19T10:24:54.845+00:00', '2026-09-19T10:24:54.908+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qra90027msvnfx4pof5d', 'Elbow Pipe-Black', 'ELBOW-PIPE-BLACK', 'Material', 'pcs', 'packet', 'DISCRETE', NULL, 0, 40, 0, '2026-09-19T10:24:54.945+00:00', '2026-09-19T10:24:55.032+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qrdz0029msvnrorelvos', 'Elbow Pipe-white', 'ELBOW-PIPE-WHITE', 'Material', 'pcs', 'packet', 'DISCRETE', NULL, 0, 8, 0, '2026-09-19T10:24:55.079+00:00', '2026-09-19T10:24:55.162+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qrh9002bmsvn0jgzw97m', 'Empty boxes -ACDB-1-6KW,1PH', 'EMPTY-BOXES-ACDB-1-6KW-1PH', 'Material', 'pcs', 'packet', 'DISCRETE', NULL, 0, 2, 0, '2026-09-19T10:24:55.197+00:00', '2026-09-19T10:24:55.275+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qrkd002dmsvn1vi7v297', 'End Clamp (40mm) for Rails', 'END-CLAMP-40MM-FOR-RAILS', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 21, 0, '2026-09-19T10:24:55.309+00:00', '2026-09-19T10:24:55.392+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qrno002fmsvn5ltg5b4o', 'End Clamp (50mm) for Rails', 'END-CLAMP-50MM-FOR-RAILS', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 54, 0, '2026-09-19T10:24:55.428+00:00', '2026-09-19T10:24:55.512+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qrr2002hmsvnhpjyaerc', 'End Clamp U Bolt type', 'END-CLAMP-U-BOLT-TYPE', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 8, 0, '2026-09-19T10:24:55.550+00:00', '2026-09-19T10:24:55.633+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qruh002jmsvn0quvie3d', 'Fastner', 'FASTN', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 10, 0, '2026-09-19T10:24:55.673+00:00', '2026-09-19T10:24:55.752+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qrxi002lmsvn001gx8ot', 'Flange Nut - 5.5mm', 'FLANG-NUT-5-5MM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 28, 0, '2026-09-19T10:24:55.782+00:00', '2026-09-19T10:24:55.856+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qs0h002nmsvneppma7n4', 'Flange Nut - 7.5mm', 'FLANG-NUT-7-5MM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 67, 0, '2026-09-19T10:24:55.889+00:00', '2026-09-19T10:24:55.951+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qs31002pmsvn6dk3l3v6', 'Flexible Pipe - 10mm - Black', 'FLEXI-PIPE-10MM-BLACK', 'Material', 'cm', 'roll', 'CONTINUOUS', NULL, 0, 776, 0, '2026-09-19T10:24:55.981+00:00', '2026-09-19T10:24:56.094+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qs72002umsvn08lvhy3u', 'Flexible Pipe - 20mm - Black', 'FLEXI-PIPE-20MM-BLACK', 'Material', 'cm', 'roll', 'CONTINUOUS', NULL, 0, 491, 0, '2026-09-19T10:24:56.126+00:00', '2026-09-19T10:24:56.301+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qscv0032msvn82j43la4', 'Flexible Pipe - White', 'FLEXI-PIPE-WHITE', 'Material', 'cm', 'roll', 'CONTINUOUS', NULL, 0, 750, 0, '2026-09-19T10:24:56.335+00:00', '2026-09-19T10:24:56.434+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qsgm0036msvntbr4wqgp', 'Hex Bolt - 24x4mm', 'HEX-BOLT-24X4MM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 66, 0, '2026-09-19T10:24:56.470+00:00', '2026-09-19T10:24:56.534+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qsja0038msvn2bbqxg8v', 'Hex Bolt - 30x4mm', 'HEX-BOLT-30X4MM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 21, 0, '2026-09-19T10:24:56.566+00:00', '2026-09-19T10:24:56.629+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qslv003amsvnxul6h0t2', 'Hex Bolt - 30x5mm', 'HEX-BOLT-30X5MM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 30, 0, '2026-09-19T10:24:56.659+00:00', '2026-09-19T10:24:56.719+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qsow003cmsvnievos799', 'Hex Bolt - 43x4mm', 'HEX-BOLT-43X4MM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 26, 0, '2026-09-19T10:24:56.768+00:00', '2026-09-19T10:24:56.841+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qsrs003emsvnydah272c', 'Hex Bolt - 60x6mm', 'HEX-BOLT-60X6MM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 6, 0, '2026-09-19T10:24:56.872+00:00', '2026-09-19T10:24:56.933+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qsuc003gmsvnrtx6duje', 'Hex Bolt - 80x4mm', 'HEX-BOLT-80X4MM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 23, 0, '2026-09-19T10:24:56.964+00:00', '2026-09-19T10:24:57.033+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qsx7003imsvngswtty0z', 'Hex Serrated Flange Bolt - 30x5mm', 'HEX-SERRA-FLANG-BOLT-30X5MM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 42, 0, '2026-09-19T10:24:57.067+00:00', '2026-09-19T10:24:57.159+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qt0l003kmsvndoh9e0lz', 'Jointer - Walkway', 'JOINT-WALKW', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 116, 0, '2026-09-19T10:24:57.189+00:00', '2026-09-19T10:24:57.261+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qt3k003mmsvnvswgjzk4', 'LA rod-1m', 'LA-ROD-1M', 'Material', 'pcs', 'packet', 'DISCRETE', NULL, 0, 1, 0, '2026-09-19T10:24:57.296+00:00', '2026-09-19T10:24:57.363+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qt69003omsvnn370afcb', 'LA rod-2m', 'LA-ROD-2M', 'Material', 'pcs', 'packet', 'DISCRETE', NULL, 0, 3, 0, '2026-09-19T10:24:57.393+00:00', '2026-09-19T10:24:57.459+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qt8w003qmsvnryfsnc7z', 'L-Foot', 'L-FOOT', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 112, 0, '2026-09-19T10:24:57.488+00:00', '2026-09-19T10:24:57.554+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qtbt003smsvnhm7xcvn7', 'MC4 Connector', 'MC4-CONNE', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 80, 0, '2026-09-19T10:24:57.593+00:00', '2026-09-19T10:24:57.653+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qtec003umsvnf5fblj6j', 'M-Clamp - Walkway', 'M-CLAMP-WALKW', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 27, 0, '2026-09-19T10:24:57.684+00:00', '2026-09-19T10:24:57.755+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qth6003wmsvnxc14x1gm', 'Metal Flat Screw', 'METAL-FLAT-SCREW', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 270, 0, '2026-09-19T10:24:57.786+00:00', '2026-09-19T10:24:57.862+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qtk9003zmsvng9dmo0se', 'Metal Saddle', 'METAL-SADDL', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 280, 0, '2026-09-19T10:24:57.897+00:00', '2026-09-19T10:24:57.963+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qtn00041msvnyrdpuwvz', 'Mid Clamp (50mm) for Rails', 'MID-CLAMP-50MM-FOR-RAILS', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 28, 0, '2026-09-19T10:24:57.996+00:00', '2026-09-19T10:24:58.061+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qtpr0043msvn2s0sir4i', 'Mid Clamp U Bolt type', 'MID-CLAMP-U-BOLT-TYPE', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 5, 0, '2026-09-19T10:24:58.095+00:00', '2026-09-19T10:24:58.162+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qtsh0045msvnunx824w6', 'Mop - 3.5', 'MOP-3-5', 'Equipment', 'pcs', 'packet', 'DISCRETE', NULL, 0, 7, 0, '2026-09-19T10:24:58.193+00:00', '2026-09-19T10:24:58.267+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qtvg0047msvnw8oeipl5', 'Mop - 4.5', 'MOP-4-5', 'Equipment', 'pcs', 'packet', 'DISCRETE', NULL, 0, 15, 0, '2026-09-19T10:24:58.300+00:00', '2026-09-19T10:24:58.367+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qty50049msvnov9dhbfq', 'Mop Cloth', 'MOP-CLOTH', 'Equipment', 'pcs', 'packet', 'DISCRETE', NULL, 0, 10, 0, '2026-09-19T10:24:58.397+00:00', '2026-09-19T10:24:58.455+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qu0k004bmsvna5a6u4yy', 'Nut (5.5mm)', 'NUT-5-5MM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 116, 0, '2026-09-19T10:24:58.484+00:00', '2026-09-19T10:24:58.545+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qu33004dmsvn2f049cfk', 'Photovoltaic Fuse', 'PHOTO-FUSE', 'Equipment', 'pcs', 'packet', 'DISCRETE', NULL, 0, 9, 0, '2026-09-19T10:24:58.575+00:00', '2026-09-19T10:24:58.644+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qu61004fmsvncomw79c2', 'PVC Cable Marker Ferrule - 6 sqmm', 'PVC-CABLE-MARKE-FERRU-6-SQMM', 'Material', 'pcs', 'packet', 'DISCRETE', NULL, 0, 29, 0, '2026-09-19T10:24:58.681+00:00', '2026-09-19T10:24:58.745+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qu8q004hmsvnykq0krqt', 'Rawal Plug - Large(35mm)', 'RAWAL-PLUG-LARGE-35MM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 181, 0, '2026-09-19T10:24:58.778+00:00', '2026-09-19T10:24:58.857+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qubu004kmsvnh62zsqql', 'Rawal Plug - Small(25mm)', 'RAWAL-PLUG-SMALL-25MM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 30, 0, '2026-09-19T10:24:58.890+00:00', '2026-09-19T10:24:58.957+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88quej004mmsvn9uf8019c', 'Ring Lug - 4-6 sqmm', 'RING-LUG-4-6-SQMM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 75, 0, '2026-09-19T10:24:58.987+00:00', '2026-09-19T10:24:59.051+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88quhn004omsvnj9wj2jcq', 'Rubber buffer', 'RUBBE-BUFFE', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 17, 0, '2026-09-19T10:24:59.099+00:00', '2026-09-19T10:24:59.171+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qukl004qmsvnvhfhygcf', 'Screw - 40x3mm', 'SCREW-40X3MM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 62, 0, '2026-09-19T10:24:59.205+00:00', '2026-09-19T10:24:59.268+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qun6004smsvn3f2jdzfh', 'Self -tapping Screw - 60x5mm', 'SELF-TAPPI-SCREW-60X5MM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 120, 0, '2026-09-19T10:24:59.298+00:00', '2026-09-19T10:24:59.364+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qupv004umsvnbz8o8e2v', 'Self-tapping Screw - 105x5mm', 'SELF-TAPPI-SCREW-105X5MM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 19, 0, '2026-09-19T10:24:59.395+00:00', '2026-09-19T10:24:59.466+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qusq004wmsvnfp9if3qr', 'Self-tapping Screw - 20x4mm', 'SELF-TAPPI-SCREW-20X4MM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 8, 0, '2026-09-19T10:24:59.498+00:00', '2026-09-19T10:24:59.563+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88quvg004ymsvnng1oqgkt', 'Self-tapping Screw - 30x5mm', 'SELF-TAPPI-SCREW-30X5MM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 19, 0, '2026-09-19T10:24:59.596+00:00', '2026-09-19T10:24:59.665+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88quyb0050msvnhowems89', 'Self-tapping Screw - 40x5mm', 'SELF-TAPPI-SCREW-40X5MM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 27, 0, '2026-09-19T10:24:59.699+00:00', '2026-09-19T10:24:59.778+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qv1k0053msvnq49s7aju', 'Self-tapping Screw - 50x5mm', 'SELF-TAPPI-SCREW-50X5MM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 17, 0, '2026-09-19T10:24:59.816+00:00', '2026-09-19T10:24:59.898+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qv500055msvnhqtlz59d', 'Self-tapping Screw - 65x5.5mm', 'SELF-TAPPI-SCREW-65X5-5MM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 42, 0, '2026-09-19T10:24:59.940+00:00', '2026-09-19T10:25:00.022+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qv8c0057msvnpmm53pxc', 'Self-tapping Screw - 70x4mm', 'SELF-TAPPI-SCREW-70X4MM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 29, 0, '2026-09-19T10:25:00.060+00:00', '2026-09-19T10:25:00.120+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qvaw0059msvn06c02n3e', 'Self-tapping Screw - 80x4mm', 'SELF-TAPPI-SCREW-80X4MM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 16, 0, '2026-09-19T10:25:00.152+00:00', '2026-09-19T10:25:00.211+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qvde005bmsvno8wte8rc', 'Self-tapping Screw - 80x5mm', 'SELF-TAPPI-SCREW-80X5MM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 64, 0, '2026-09-19T10:25:00.242+00:00', '2026-09-19T10:25:00.309+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qvg2005dmsvnek1nubre', 'Solar Panel Mid-Clamp - 40mm', 'SOLAR-PANEL-MID-CLAMP-40MM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 25, 0, '2026-09-19T10:25:00.338+00:00', '2026-09-19T10:25:00.402+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qvir005fmsvnkm7qyj3d', 'Solar Rail T-Nut - M8', 'SOLAR-RAIL-T-NUT-M8', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 14, 0, '2026-09-19T10:25:00.435+00:00', '2026-09-19T10:25:00.499+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qvlh005hmsvnmo3blw3w', 'Solar Water Drain Clip', 'SOLAR-WATER-DRAIN-CLIP', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 200, 0, '2026-09-19T10:25:00.533+00:00', '2026-09-19T10:25:00.593+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qvo4005jmsvn8siek0u3', 'Solaredge Optimisers S-1000', 'SOLAR-OPTIM-S-1000', 'Equipment', 'pcs', 'packet', 'DISCRETE', NULL, 0, 2, 0, '2026-09-19T10:25:00.628+00:00', '2026-09-19T10:25:00.691+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qvr0005lmsvneevs0e5o', 'SPD', 'SPD', 'Equipment', 'pcs', 'packet', 'DISCRETE', NULL, 0, 9, 0, '2026-09-19T10:25:00.732+00:00', '2026-09-19T10:25:00.813+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qvu8005nmsvnscrgdpg6', 'Spring Washer', 'SPRIN-WASHE', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 15, 0, '2026-09-19T10:25:00.848+00:00', '2026-09-19T10:25:00.912+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qvww005pmsvnpl2fnn2d', 'Square Bolt - M6 x 35mm', 'SQUAR-BOLT-M6-X-35MM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 35, 0, '2026-09-19T10:25:00.944+00:00', '2026-09-19T10:25:01.004+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qvze005rmsvnm4t8tpn0', 'SS Allen Bolt - M6 x 28mm', 'SS-ALLEN-BOLT-M6-X-28MM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 55, 0, '2026-09-19T10:25:01.034+00:00', '2026-09-19T10:25:01.098+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qw28005tmsvn5g8e4033', 'SS Bolt M6X25mm (panel Earting)', 'SS-BOLT-M6X25MM-PANEL-EARTI', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 80, 0, '2026-09-19T10:25:01.136+00:00', '2026-09-19T10:25:01.263+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qw6m005vmsvn717ritm8', 'SS Nut M6 (panel Earting)', 'SS-NUT-M6-PANEL-EARTI', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 40, 0, '2026-09-19T10:25:01.294+00:00', '2026-09-19T10:25:01.354+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qw96005xmsvnes0qghn4', 'SS T Head Bolt for L Foot', 'SS-T-HEAD-BOLT-FOR-L-FOOT', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 40, 0, '2026-09-19T10:25:01.386+00:00', '2026-09-19T10:25:01.450+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qwbx005zmsvnefhiwjcd', 'SS Washer 6mm (panel Earthing)', 'SS-WASHE-6MM-PANEL-EARTH', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 60, 0, '2026-09-19T10:25:01.485+00:00', '2026-09-19T10:25:01.553+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qwet0061msvny7x7yb88', 'Stainless Steel Flat Washer - 12mm OD / 6mm ID', 'STAIN-STEEL-FLAT-WASHE-12MM-OD-6MM-ID', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 670, 0, '2026-09-19T10:25:01.589+00:00', '2026-09-19T10:25:01.654+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qwhh0063msvnt825cpk5', 'Stainless Steel Flat Washer - 20mm OD / 6mm ID', 'STAIN-STEEL-FLAT-WASHE-20MM-OD-6MM-ID', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 20, 0, '2026-09-19T10:25:01.685+00:00', '2026-09-19T10:25:01.752+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qwk70065msvnpf8nt0c9', 'Stainless Steel Flat Washer - 22mm OD / 11mm ID', 'STAIN-STEEL-FLAT-WASHE-22MM-OD-11MM-ID', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 19, 0, '2026-09-19T10:25:01.783+00:00', '2026-09-19T10:25:01.847+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qwmu0067msvnmoxq4341', 'Stainless Steel Flat Washer - 22mm OD / 6mm ID', 'STAIN-STEEL-FLAT-WASHE-22MM-OD-6MM-ID', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 25, 0, '2026-09-19T10:25:01.878+00:00', '2026-09-19T10:25:01.964+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qwq90069msvneg08va14', 'Tee Pipe', 'TEE-PIPE', 'Material', 'pcs', 'packet', 'DISCRETE', NULL, 0, 216, 0, '2026-09-19T10:25:02.001+00:00', '2026-09-19T10:25:02.063+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qwsv006bmsvn6gc6r6eq', 'Threaded Screw', 'THREA-SCREW', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 168, 0, '2026-09-19T10:25:02.095+00:00', '2026-09-19T10:25:02.155+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qwvd006dmsvn0x5g1uvt', 'T-Nut - 30mm', 'T-NUT-30MM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 64, 0, '2026-09-19T10:25:02.185+00:00', '2026-09-19T10:25:02.251+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qwy3006fmsvnayd235ks', 'T-Nut - 40mm for rails', 'T-NUT-40MM-FOR-RAILS', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 56, 0, '2026-09-19T10:25:02.283+00:00', '2026-09-19T10:25:02.349+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmu88qx0s006hmsvnd9mawsri', 'U Bolt', 'U-BOLT', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 41, 0, '2026-09-19T10:25:02.380+00:00', '2026-09-19T10:25:02.449+00:00');
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
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count") VALUES ('ae720753-e6b1-4bd3-a958-24dd39031993', '9f31c146bcfc1085a449036c07eeb3248df2ae0e5b65bed7b38354e6b73acd0b', '2026-09-11T09:50:14.811Z', '20260909120000_site_delivery_challan', NULL, NULL, '2026-09-11T09:50:14.472Z', 1);
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count") VALUES ('2bcd214a-a476-4429-9a1c-367285cf49c0', '8d0bd374cf3ed399296312bdf98accff073a90f21d3f3b26073c4cb300e58b99', '2026-09-11T09:50:15.835Z', '20260909164648_transfer_challan', NULL, NULL, '2026-09-11T09:50:15.088Z', 1);
INSERT INTO "Sequence" ("key", "value") VALUES ('challan', 0);
INSERT INTO "Sequence" ("key", "value") VALUES ('siteChallan', 0);
INSERT INTO "Sequence" ("key", "value") VALUES ('transferChallan', 0);
COMMIT;
PRAGMA foreign_keys=ON;
