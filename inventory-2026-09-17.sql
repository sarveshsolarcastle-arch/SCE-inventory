-- Inventory database dump — 2026-09-17T19:04:54.579Z
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
INSERT INTO "PackStock" ("id", "itemId", "packSize", "sealedCount") VALUES ('cmu3nay4f000078vnjczh6owh', 'aba1225e-f022-4f99-81dc-f81e3b39c23c', 100, 8);
INSERT INTO "PackStock" ("id", "itemId", "packSize", "sealedCount") VALUES ('cmu3nay4f000178vn20g292ba', '5de5cf3d-adb9-4908-823d-9758b599da60', 100, 8);
INSERT INTO "PackStock" ("id", "itemId", "packSize", "sealedCount") VALUES ('cmu3nay4f000278vn3lqtzgmt', 'b9516f07-b7f5-467c-bb6e-0d531591db1c', 100, 1);
INSERT INTO "PackStock" ("id", "itemId", "packSize", "sealedCount") VALUES ('cmu3nay4f000378vn3dnz5zxy', '496d9009-c174-497d-b1ad-75cda1a153aa', 50, 3);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q000478vnc8ci14lz', 'a2d8a8cb-f56b-47b5-9a7e-c980dc83fda2', 36, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q000578vn6621fu4z', '7d00cda2-9f0b-4c18-8af4-027dd0894b09', 36, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q000678vnnotnrurz', 'b793a2d6-485c-49fb-acd9-d6a753d08b7a', 12, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q000778vnaefqw3n0', '560843fe-1436-4e59-a50e-4cc667fae25c', 1, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q000878vn2kphy4st', '1b1b0374-c6eb-471c-8e56-a273bc57fd98', 1, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q000978vnl9p2ldfr', '45291a42-0491-4a80-853d-cb5a44e658e3', 11, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q000a78vn4is8klop', 'f79c60cb-fdec-4f0a-badd-bd9f05aa0065', 55, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q000b78vnc4i7t33l', '1af1659b-fc32-4db5-b9c4-6061839d40ee', 7, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q000c78vnndz3vx1p', '37c263d7-156a-4542-b184-bd2b45497576', 150, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q000d78vnf5w1u365', '184292a0-9675-43fd-a8bf-95c3affcfa43', 40, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q000e78vn37ydwh7r', '1198319b-8dee-46c7-84e1-e5edb7eb5c5f', 60, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q000f78vnw8rcokz5', '1c2a0911-eb8c-44e8-9e97-08c4b12d0389', 110, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q000g78vnc2njzd9f', 'bac6b7e5-ccba-4a59-8a42-c39c97169a42', 40, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q000h78vnbjacz8vy', '327cc99a-4e35-4f6d-9169-7f721155738c', 21, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q000i78vnu771ycwx', 'aa9bdff3-86d8-4135-a377-5b21333fb808', 5, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q000j78vnbqdt90qw', '46bb7790-38af-4c1f-ab3f-504c959286d1', 3, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q000k78vn6unoh5rt', '34a2427f-7203-4356-87cd-de0c2b29c015', 130, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q000l78vnbnbomiff', '19ef0686-6dc4-49bb-98fb-94ada57bd7f6', 400, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q000m78vnfwc2lwz2', '1f25f349-0e74-4e77-ba8d-5de36eb6021c', 500, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q000n78vnyw7v1gl7', 'cb22d9ab-3937-4c64-a8a0-a6561d584663', 199, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q000o78vna0ry3f8u', 'b0ae0a09-93c9-49d0-a5f2-c142f71dd040', 500, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q000p78vnwlxj1mqe', '2f103910-7e9b-4e64-b8bb-87c6007e766c', 1, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q000q78vnayxgzn8w', '66c64629-7190-4554-8f60-7361c08746a0', 1, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q000r78vnv9fq4p20', '20dcc611-988a-4fa2-a2a8-b63b67563ef4', 1, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q000s78vnqs07w6ph', '20b87197-24d2-4126-b164-f5b137d5a3f2', 180, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q000t78vn484jns20', '5324a337-1629-45d4-aa94-06a6514b93f6', 19, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q000u78vnux031ld4', '51f24acb-bb52-4666-85be-6726f0d96bb5', 100, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q000v78vnx6oc89br', '84b134ef-7711-48f2-b9ba-b195ad939894', 121, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q000w78vnrhdeg89e', '2ec4f6ae-3666-4da4-8581-76e9b8b65931', 100, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q000x78vnod2e3rc2', '01a3d48d-cbce-4ca6-92f2-6eb6a9126111', 13, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q000y78vns2gr97iw', '81e957c7-9afe-42ab-90ba-65367510041a', 3, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q000z78vn8mov60oh', '3f287036-8ef3-4db0-8c0a-c8d06c398dc7', 40, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q001078vnc2pl6nb6', 'b6855ced-8521-4e0e-bbaa-76df9d226395', 8, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q001178vno47nfuqz', '12680fc1-a606-4151-9f1b-2116c3b0e3b0', 2, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q001278vnae53p1l6', '81b2bcd2-e87b-4bb9-a1d5-a23506cf2195', 21, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q001378vni5xbs8gi', '32732a90-249a-4a35-a3b6-9f14549bc0f4', 54, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q001478vnhpf7zg7q', '14c6baaa-d3fc-444d-82ec-ceabf8f21157', 8, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q001578vnrberer1i', 'd80290b8-e51f-41b5-9ef8-32ca3c78781b', 10, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q001678vnx63oetpg', '37b62159-5136-41c6-926b-bd7f1570ef7a', 28, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q001778vnuyhs2b35', '5f944082-b0ef-4bc4-86fe-5ce58f7c8ba8', 67, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q001878vnl2wuoxon', '619c0e34-8a66-4d96-a392-717a17f742fa', 8, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q001978vni7ewips0', '9ea6f57c-3f64-46cd-b671-a8617c98341a', 5, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q001a78vn9wpjk5go', '86236b91-f4e8-467f-852f-473ea137e3cb', 8, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q001b78vnjt9fls0m', '346b5c53-8ca1-4f22-a683-c8aa6e85f4cb', 66, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q001c78vnfr4h6oxf', 'a0a7bd50-72f0-4419-a681-32f13888b807', 21, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q001d78vn11sz6d7e', 'c3583f73-374f-4be0-8ee9-7997b89b2d6d', 30, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q001e78vndylm5cfi', 'ce50feb2-5cca-43eb-bf78-a68a53fe47fd', 26, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q001f78vnqjnk26ef', '1f86ea05-c902-4b26-a96a-21f574f13f83', 6, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q001g78vnmxgatoba', '12bf0f8c-d6f0-4106-8543-e246bb1f3355', 23, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q001h78vny2n82ptp', '54d8c452-10c6-4168-b89f-994a02878416', 42, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q001i78vnt5pilk7r', 'b8939000-d8ab-47db-9204-b024b6d2cd00', 116, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q001j78vntrew5sg2', '84c658de-dc29-42a6-b335-6d156b83fb47', 1, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q001k78vn12zax7ec', '6b81c161-45a7-4245-9dd3-c7ba25373773', 3, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q001l78vn1mypo0qb', '8839ea15-34f5-4d32-b158-6753e8796432', 112, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q001m78vn6owg7jjt', 'd4f5c76a-03bc-4150-ad1f-b6b762c78c33', 80, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q001n78vn8wo8ex7u', '0d3cc813-2fcf-4ae9-95ab-86a3fabb4e02', 27, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q001o78vnomalbxca', 'b9516f07-b7f5-467c-bb6e-0d531591db1c', 170, 100, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q001p78vnskbhvvur', 'a040fa18-5849-4077-b50d-933fecd38864', 280, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q001q78vn94elwnos', '9653d3aa-61dc-4a80-9d08-c8c6355fa88c', 28, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q001r78vnlurayjdt', 'e0bb1ad3-6a63-4e05-9f4f-7eabfc62acce', 5, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q001s78vne3uozyq8', '5783fdd1-7dc1-4523-9bbe-14e02c8b97ed', 7, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q001t78vnkdx87r50', '07a80988-7717-433d-8636-a832c75789dd', 15, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q001u78vnoc746osb', '5d175aa2-99ac-42a6-8d5d-716ca7addb30', 10, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q001v78vnsuql6fhj', '4e9fa578-05cd-40a2-bf31-c245e5f8fd08', 116, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q001w78vnqxvb5tde', '6f2b2f50-4c3c-4cf8-8106-d82c5d99c9c4', 9, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q001x78vnbvwenwat', 'fc4a6e6a-352b-4f17-8481-6004d296911c', 29, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q001y78vnxhqebxh7', '496d9009-c174-497d-b1ad-75cda1a153aa', 31, 50, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q001z78vnicjohz4p', '16d456b8-2c8e-4884-91a5-9aa67026a1cf', 30, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q002078vn5nz6nhwx', '44f764a6-dd9f-4976-980b-3d4b059bd468', 75, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q002178vngnvpgfoc', '5f4886dc-e51c-4e9e-9975-b90b7ac5ed57', 17, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q002278vnqskgbo9e', 'f22c12d4-8a94-48d6-9584-5fd94ce922b5', 62, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q002378vnt8ietxfh', 'e7c45d02-d151-4321-9b59-04aca3f6c3d1', 120, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q002478vnidadcvjh', '71d61e24-0877-4f44-ae47-7b19d1338816', 19, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q002578vn0e4q0on6', '739282e6-1341-4ec6-887b-53072ea24b1a', 8, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q002678vn15cqo8hq', '2f41bf2d-1c06-40f8-8380-45e32123f379', 19, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q002778vn4r8iyy3l', '63a62e16-8879-4825-8516-b4ae711955e5', 27, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q002878vnmrd6bazj', '47c125d3-59c5-45d7-a6d2-c87c0277c41f', 17, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q002978vntjg78gn2', '983e8bdc-699a-493f-8ff8-fbe1e9fc1292', 42, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q002a78vne6ynd9pm', '2992f848-db96-4d0f-9139-900635a63395', 29, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q002b78vn5xfuihil', 'd2b3105b-3d42-4a04-b9b5-4ac3564bcda1', 16, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q002c78vnrd741t50', 'f9f3068e-c4c0-424c-8eed-fe912e8b8726', 64, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q002d78vn8hjdfrdg', 'aace13b5-9447-4acb-85eb-b26d5dc9c843', 25, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q002e78vnmeospw47', '1e470ed9-6e28-44a5-bdc5-424cf6c189ef', 14, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q002f78vnd09d1hey', '4a0a4253-ade4-4156-8892-9dfff9e7d965', 200, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q002g78vnc7r9lnbb', '4e31d2b9-e3de-4e69-9f54-6b89f0b48412', 2, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q002h78vn94h9dhpl', '310c31b6-73f7-4b9a-be17-3e94ba0b6521', 9, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q002i78vn2fdocoft', '495521cc-a9a7-4ea5-b4be-53e8af6a1de8', 15, 100, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q002j78vn9esxee9o', '4026cac0-74f6-4be3-bdff-17349c833363', 35, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q002k78vne9025st6', '29236bad-0ba7-4f4e-a897-e348e4e1fd79', 55, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q002l78vnx3diofeu', 'e0c6aae7-6891-4472-8bb0-ced58c106ec7', 80, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q002m78vn892nwa1h', '02db85d5-84be-4eb8-80f0-02f0da852fb8', 40, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q002n78vnep5s3j0f', 'e6c2f7a4-0b9b-4cb5-98cb-6e25466e8a62', 40, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q002o78vnya8k2sl4', '1d5c15aa-3454-46e9-beae-407bf4d7752f', 60, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q002p78vn0vw0it7s', '3b60ac84-3797-406a-8bed-2b540e346c72', 670, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q002q78vnkqq98pko', '18b8c6de-8800-42d4-97de-00dca28bf1dd', 20, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q002r78vn37tk10md', '22142f66-55e5-4cfe-8406-8034c5e99131', 19, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q002s78vntcudepb7', 'a067087c-1048-4418-8882-6e50d3010e8f', 25, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q002t78vnizqyhlrq', '4119ae80-1b3d-4d83-8ef2-009aaa59f69b', 216, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q002u78vn6x91aoxb', 'be06b4e9-7a91-4397-8ee8-863bcc5373e4', 168, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q002v78vn9vvw4rn6', '7fd84075-3b42-4851-9181-5fe846cf4d3e', 64, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q002w78vnwluhr0g4', '0df15dda-24e5-47fc-9ac7-df6b0eb7eac7', 56, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmu3nay7q002x78vncgjfrkpo', '73484fee-2528-4b0f-b7b5-8efb2f5f9b4f', 41, NULL, 'OPEN', '2026-09-16T05:13:40.790+00:00', NULL);
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('a2d8a8cb-f56b-47b5-9a7e-c980dc83fda2', 'AC Cable - 1 Core x 4 sqmm - Black', 'AC-CBL-1-C-X-4-BLK', 'Material', 'm', 'roll', 'CONTINUOUS', NULL, 0, 36, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('7d00cda2-9f0b-4c18-8af4-027dd0894b09', 'AC Cable - 1 Core x 4 sqmm - Red', 'AC-CBL-1-C-X-4-RED', 'Material', 'm', 'roll', 'CONTINUOUS', NULL, 0, 36, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('b793a2d6-485c-49fb-acd9-d6a753d08b7a', 'AC Cable - 4 Core x 4 sqmm - Black', 'AC-CBL-4-C-X-4-BLK', 'Material', 'm', 'roll', 'CONTINUOUS', NULL, 0, 12, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('560843fe-1436-4e59-a50e-4cc667fae25c', 'ACDB- 1PH- 1-6KW-1 in / 1 out', 'ACDB-1PH-1-6KW-1-IN-1-OUT', 'Equipment', 'box', NULL, 'DISCRETE', NULL, 0, 1, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('1b1b0374-c6eb-471c-8e56-a273bc57fd98', 'ACDB- 3PH- 5-15KW', 'ACDB-3PH-5-15KW', 'Equipment', 'box', NULL, 'DISCRETE', NULL, 0, 1, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('45291a42-0491-4a80-853d-cb5a44e658e3', 'Allen Bolt - M5 x 45mm', 'ALN-BLT-M5-X-45MM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 11, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('f79c60cb-fdec-4f0a-badd-bd9f05aa0065', 'Allen Bolt - M6 x 33mm', 'ALN-BLT-M6-X-33MM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 55, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('1af1659b-fc32-4db5-b9c4-6061839d40ee', 'Allen Bolt - M7 x 43mm', 'ALN-BLT-M7-X-43MM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 7, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('37c263d7-156a-4542-b184-bd2b45497576', 'Bend Pipe', 'BND-PIP', 'Material', 'pcs', 'packet', 'DISCRETE', NULL, 0, 150, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('184292a0-9675-43fd-a8bf-95c3affcfa43', 'Cable Gland - PG20', 'CBL-GLD-PG2', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 40, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('aba1225e-f022-4f99-81dc-f81e3b39c23c', 'Cable Tie - Metal- 300mm', 'CBL-TIE-MET-300MM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 800, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('5de5cf3d-adb9-4908-823d-9758b599da60', 'Cable Tie - Nylon 300mm', 'CBL-TIE-NYL-300MM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 800, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('1198319b-8dee-46c7-84e1-e5edb7eb5c5f', 'Channel Spring Nut', 'CHN-SPR-NUT', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 60, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('1c2a0911-eb8c-44e8-9e97-08c4b12d0389', 'Copper Ring Lug - 10-8 sqmm', 'CU-RNG-LUG-10-8', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 110, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('bac6b7e5-ccba-4a59-8a42-c39c97169a42', 'Copper Ring Lug - 10sqmm', 'CU-RNG-LUG-10SQMM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 40, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('327cc99a-4e35-4f6d-9169-7f721155738c', 'Copper Ring Lug - 16-8 sqmm', 'CU-RNG-LUG-16-8', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 21, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('aa9bdff3-86d8-4135-a377-5b21333fb808', 'Copper Ring Lug - 25 sqmm', 'CU-RNG-LUG-25', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 5, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('46bb7790-38af-4c1f-ab3f-504c959286d1', 'Copper Ring Lug - 35-10 sqmm', 'CU-RNG-LUG-35-10', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 3, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('34a2427f-7203-4356-87cd-de0c2b29c015', 'Copper Ring Lug - 4-6 sqmm', 'CU-RNG-LUG-4-6', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 130, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('19ef0686-6dc4-49bb-98fb-94ada57bd7f6', 'DC Cable - 1 Core x 4 sqmm - Black', 'DC-CBL-1-C-X-4-BLK', 'Material', 'm', 'roll', 'CONTINUOUS', NULL, 0, 400, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('1f25f349-0e74-4e77-ba8d-5de36eb6021c', 'DC Cable - 1 Core x 4 sqmm - Black(new)', 'DC-CBL-1-C-X-4-BLK-2', 'Material', 'm', 'roll', 'CONTINUOUS', NULL, 0, 500, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cb22d9ab-3937-4c64-a8a0-a6561d584663', 'DC Cable - 1 Core x 4 sqmm - Red', 'DC-CBL-1-C-X-4-RED', 'Material', 'm', 'roll', 'CONTINUOUS', NULL, 0, 199, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('b0ae0a09-93c9-49d0-a5f2-c142f71dd040', 'DC Cable - 1 Core x 4 sqmm - Red(new)', 'DC-CBL-1-C-X-4-RED-2', 'Material', 'm', 'roll', 'CONTINUOUS', NULL, 0, 500, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('2f103910-7e9b-4e64-b8bb-87c6007e766c', 'DCDB 1 in 1 out', 'DCDB-1-IN-1-OUT', 'Equipment', 'box', NULL, 'DISCRETE', NULL, 0, 1, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('66c64629-7190-4554-8f60-7361c08746a0', 'DCDB 2 in 2 out', 'DCDB-2-IN-2-OUT', 'Equipment', 'box', NULL, 'DISCRETE', NULL, 0, 1, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('5e7f761d-4912-4186-bb4b-6b0dcf989655', 'Deye String Inverter 10 KW', 'DEYE-STR-INV-10-KW', 'Equipment', 'box', NULL, 'DISCRETE', NULL, 0, 0, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('20dcc611-988a-4fa2-a2a8-b63b67563ef4', 'Deye String Inverter 5 KW', 'DEYE-STR-INV-5-KW', 'Equipment', 'box', NULL, 'DISCRETE', NULL, 0, 1, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('20b87197-24d2-4126-b164-f5b137d5a3f2', 'Double Nail clamp', 'DOU-NL-CLM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 180, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('5324a337-1629-45d4-aa94-06a6514b93f6', 'Dummy Piece', 'DUM-PC', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 19, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('51f24acb-bb52-4666-85be-6726f0d96bb5', 'Earthing Cable - 1 Core-10 sqmm - Cu-Green', 'EARTH-CBL-1-C-10-CU-GRN', 'Material', 'm', 'roll', 'CONTINUOUS', NULL, 0, 100, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('84b134ef-7711-48f2-b9ba-b195ad939894', 'Earthing Cable - 1 Core-6 sqmm -Cu- Green', 'EARTH-CBL-1-C-6-CU-GRN', 'Material', 'm', 'roll', 'CONTINUOUS', NULL, 0, 121, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('2ec4f6ae-3666-4da4-8581-76e9b8b65931', 'earthing cable 10sqmm,Cu-multi strand(new)', 'EARTH-CBL-10SQMM-CU-MLT-STD', 'Material', 'm', 'roll', 'CONTINUOUS', NULL, 0, 100, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('01a3d48d-cbce-4ca6-92f2-6eb6a9126111', 'Earthing Connector', 'EARTH-CON', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 13, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('81e957c7-9afe-42ab-90ba-65367510041a', 'earthing rod -2m', 'EARTH-ROD-2M', 'Material', 'pcs', 'packet', 'DISCRETE', NULL, 0, 3, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('fed8dcab-128f-4259-aecf-8df9fbc88270', 'earthing rod-1m', 'EARTH-ROD-1M', 'Material', 'pcs', 'packet', 'DISCRETE', NULL, 0, 0, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('3f287036-8ef3-4db0-8c0a-c8d06c398dc7', 'Elbow Pipe-Black', 'ELB-PIP-BLK', 'Material', 'pcs', 'packet', 'DISCRETE', NULL, 0, 40, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('b6855ced-8521-4e0e-bbaa-76df9d226395', 'Elbow Pipe-white', 'ELB-PIP-WHT', 'Material', 'pcs', 'packet', 'DISCRETE', NULL, 0, 8, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('12680fc1-a606-4151-9f1b-2116c3b0e3b0', 'Empty boxes -ACDB-1-6KW,1PH', 'EMP-BOX-ACDB-1-6KW-1PH', 'Material', 'pcs', 'packet', 'DISCRETE', NULL, 0, 2, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('81b2bcd2-e87b-4bb9-a1d5-a23506cf2195', 'End Clamp (40mm) for Rails', 'END-CLM-RAIL', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 21, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('32732a90-249a-4a35-a3b6-9f14549bc0f4', 'End Clamp (50mm) for Rails', 'END-CLM-RAIL-2', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 54, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('14c6baaa-d3fc-444d-82ec-ceabf8f21157', 'End Clamp U Bolt type', 'END-CLM-U-BLT', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 8, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('d80290b8-e51f-41b5-9ef8-32ca3c78781b', 'Fastner', 'FSTN', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 10, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('37b62159-5136-41c6-926b-bd7f1570ef7a', 'Flange Nut - 5.5mm', 'FLG-NUT-5.5MM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 28, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('5f944082-b0ef-4bc4-86fe-5ce58f7c8ba8', 'Flange Nut - 7.5mm', 'FLG-NUT-7.5MM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 67, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('619c0e34-8a66-4d96-a392-717a17f742fa', 'Flexible Pipe - 10mm - Black', 'FLX-PIP-10MM-BLK', 'Material', 'm', 'roll', 'CONTINUOUS', NULL, 0, 8, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('9ea6f57c-3f64-46cd-b671-a8617c98341a', 'Flexible Pipe - 20mm - Black', 'FLX-PIP-20MM-BLK', 'Material', 'm', 'roll', 'CONTINUOUS', NULL, 0, 5, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('86236b91-f4e8-467f-852f-473ea137e3cb', 'Flexible Pipe - White', 'FLX-PIP-WHT', 'Material', 'm', 'roll', 'CONTINUOUS', NULL, 0, 8, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('346b5c53-8ca1-4f22-a683-c8aa6e85f4cb', 'Hex Bolt - 24x4mm', 'HEX-BLT-24X4MM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 66, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('a0a7bd50-72f0-4419-a681-32f13888b807', 'Hex Bolt - 30x4mm', 'HEX-BLT-30X4MM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 21, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('c3583f73-374f-4be0-8ee9-7997b89b2d6d', 'Hex Bolt - 30x5mm', 'HEX-BLT-30X5MM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 30, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('ce50feb2-5cca-43eb-bf78-a68a53fe47fd', 'Hex Bolt - 43x4mm', 'HEX-BLT-43X4MM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 26, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('1f86ea05-c902-4b26-a96a-21f574f13f83', 'Hex Bolt - 60x6mm', 'HEX-BLT-60X6MM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 6, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('12bf0f8c-d6f0-4106-8543-e246bb1f3355', 'Hex Bolt - 80x4mm', 'HEX-BLT-80X4MM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 23, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('54d8c452-10c6-4168-b89f-994a02878416', 'Hex Serrated Flange Bolt - 30x5mm', 'HEX-SRT-FLG-BLT-30X5MM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 42, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('b8939000-d8ab-47db-9204-b024b6d2cd00', 'Jointer - Walkway', 'JNT-WKWY', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 116, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('84c658de-dc29-42a6-b335-6d156b83fb47', 'LA rod-1m', 'LA-ROD-1M', 'Material', 'pcs', 'packet', 'DISCRETE', NULL, 0, 1, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('6b81c161-45a7-4245-9dd3-c7ba25373773', 'LA rod-2m', 'LA-ROD-2M', 'Material', 'pcs', 'packet', 'DISCRETE', NULL, 0, 3, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('8839ea15-34f5-4d32-b158-6753e8796432', 'L-Foot', 'L-FT', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 112, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('d4f5c76a-03bc-4150-ad1f-b6b762c78c33', 'MC4 Connector', 'MC4-CON', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 80, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('0d3cc813-2fcf-4ae9-95ab-86a3fabb4e02', 'M-Clamp - Walkway', 'M-CLM-WKWY', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 27, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('b9516f07-b7f5-467c-bb6e-0d531591db1c', 'Metal Flat Screw', 'MET-FLT-SCR', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 270, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('a040fa18-5849-4077-b50d-933fecd38864', 'Metal Saddle', 'MET-SDL', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 280, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('9653d3aa-61dc-4a80-9d08-c8c6355fa88c', 'Mid Clamp (50mm) for Rails', 'MID-CLM-RAIL', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 28, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('e0bb1ad3-6a63-4e05-9f4f-7eabfc62acce', 'Mid Clamp U Bolt type', 'MID-CLM-U-BLT', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 5, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('5783fdd1-7dc1-4523-9bbe-14e02c8b97ed', 'Mop - 3.5', 'MOP-3.5', 'Equipment', 'pcs', 'packet', 'DISCRETE', NULL, 0, 7, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('07a80988-7717-433d-8636-a832c75789dd', 'Mop - 4.5', 'MOP-4.5', 'Equipment', 'pcs', 'packet', 'DISCRETE', NULL, 0, 15, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('5d175aa2-99ac-42a6-8d5d-716ca7addb30', 'Mop Cloth', 'MOP-CLT', 'Equipment', 'pcs', 'packet', 'DISCRETE', NULL, 0, 10, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('4e9fa578-05cd-40a2-bf31-c245e5f8fd08', 'Nut (5.5mm)', 'NUT', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 116, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('6f2b2f50-4c3c-4cf8-8106-d82c5d99c9c4', 'Photovoltaic Fuse', 'PV-FUS', 'Equipment', 'pcs', 'packet', 'DISCRETE', NULL, 0, 9, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('fc4a6e6a-352b-4f17-8481-6004d296911c', 'PVC Cable Marker Ferrule - 6 sqmm', 'PVC-CBL-MKR-FER-6', 'Material', 'pcs', 'packet', 'DISCRETE', NULL, 0, 29, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('496d9009-c174-497d-b1ad-75cda1a153aa', 'Rawal Plug - Large(35mm)', 'RAW-PLG-LAR', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 181, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('16d456b8-2c8e-4884-91a5-9aa67026a1cf', 'Rawal Plug - Small(25mm)', 'RAW-PLG-SMA', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 30, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('44f764a6-dd9f-4976-980b-3d4b059bd468', 'Ring Lug - 4-6 sqmm', 'RNG-LUG-4-6', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 75, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('5f4886dc-e51c-4e9e-9975-b90b7ac5ed57', 'Rubber buffer', 'RBR-BUF', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 17, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('f22c12d4-8a94-48d6-9584-5fd94ce922b5', 'Screw - 40x3mm', 'SCR-40X3MM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 62, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('e7c45d02-d151-4321-9b59-04aca3f6c3d1', 'Self -tapping Screw - 60x5mm', 'STP-SCR-60X5MM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 120, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('71d61e24-0877-4f44-ae47-7b19d1338816', 'Self-tapping Screw - 105x5mm', 'STP-SCR-105X5MM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 19, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('739282e6-1341-4ec6-887b-53072ea24b1a', 'Self-tapping Screw - 20x4mm', 'STP-SCR-20X4MM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 8, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('2f41bf2d-1c06-40f8-8380-45e32123f379', 'Self-tapping Screw - 30x5mm', 'STP-SCR-30X5MM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 19, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('63a62e16-8879-4825-8516-b4ae711955e5', 'Self-tapping Screw - 40x5mm', 'STP-SCR-40X5MM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 27, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('47c125d3-59c5-45d7-a6d2-c87c0277c41f', 'Self-tapping Screw - 50x5mm', 'STP-SCR-50X5MM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 17, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('983e8bdc-699a-493f-8ff8-fbe1e9fc1292', 'Self-tapping Screw - 65x5.5mm', 'STP-SCR-65X5.5MM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 42, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('2992f848-db96-4d0f-9139-900635a63395', 'Self-tapping Screw - 70x4mm', 'STP-SCR-70X4MM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 29, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('d2b3105b-3d42-4a04-b9b5-4ac3564bcda1', 'Self-tapping Screw - 80x4mm', 'STP-SCR-80X4MM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 16, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('f9f3068e-c4c0-424c-8eed-fe912e8b8726', 'Self-tapping Screw - 80x5mm', 'STP-SCR-80X5MM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 64, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('aace13b5-9447-4acb-85eb-b26d5dc9c843', 'Solar Panel Mid-Clamp - 40mm', 'SLR-PNL-MID-CLM-40MM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 25, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('1e470ed9-6e28-44a5-bdc5-424cf6c189ef', 'Solar Rail T-Nut - M8', 'SLR-RAIL-T-NUT-M8', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 14, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('4a0a4253-ade4-4156-8892-9dfff9e7d965', 'Solar Water Drain Clip', 'SLR-WTR-DRN-CLI', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 200, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('4e31d2b9-e3de-4e69-9f54-6b89f0b48412', 'Solaredge Optimisers S-1000', 'SOL-OPT-S-1000', 'Equipment', 'pcs', 'packet', 'DISCRETE', NULL, 0, 2, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('310c31b6-73f7-4b9a-be17-3e94ba0b6521', 'SPD', 'SPD', 'Equipment', 'pcs', 'packet', 'DISCRETE', NULL, 0, 9, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('495521cc-a9a7-4ea5-b4be-53e8af6a1de8', 'Spring Washer', 'SPR-WSH', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 15, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('4026cac0-74f6-4be3-bdff-17349c833363', 'Square Bolt - M6 x 35mm', 'SQR-BLT-M6-X-35MM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 35, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('29236bad-0ba7-4f4e-a897-e348e4e1fd79', 'SS Allen Bolt - M6 x 28mm', 'SS-ALN-BLT-M6-X-28MM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 55, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('e0c6aae7-6891-4472-8bb0-ced58c106ec7', 'SS Bolt M6X25mm (panel Earting)', 'SS-BLT-M6X25MM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 80, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('02db85d5-84be-4eb8-80f0-02f0da852fb8', 'SS Nut M6 (panel Earting)', 'SS-NUT-M6', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 40, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('e6c2f7a4-0b9b-4cb5-98cb-6e25466e8a62', 'SS T Head Bolt for L Foot', 'SS-T-HEA-BLT-L-FT', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 40, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('1d5c15aa-3454-46e9-beae-407bf4d7752f', 'SS Washer 6mm (panel Earthing)', 'SS-WSH-6MM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 60, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('3b60ac84-3797-406a-8bed-2b540e346c72', 'Stainless Steel Flat Washer - 12mm OD / 6mm ID', 'SS-FLT-WSH-12MM-OD-6MM-ID', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 670, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('18b8c6de-8800-42d4-97de-00dca28bf1dd', 'Stainless Steel Flat Washer - 20mm OD / 6mm ID', 'SS-FLT-WSH-20MM-OD-6MM-ID', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 20, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('22142f66-55e5-4cfe-8406-8034c5e99131', 'Stainless Steel Flat Washer - 22mm OD / 11mm ID', 'SS-FLT-WSH-22MM-OD-11MM-ID', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 19, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('a067087c-1048-4418-8882-6e50d3010e8f', 'Stainless Steel Flat Washer - 22mm OD / 6mm ID', 'SS-FLT-WSH-22MM-OD-6MM-ID', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 25, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('4119ae80-1b3d-4d83-8ef2-009aaa59f69b', 'Tee Pipe', 'TEE-PIP', 'Material', 'pcs', 'packet', 'DISCRETE', NULL, 0, 216, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('be06b4e9-7a91-4397-8ee8-863bcc5373e4', 'Threaded Screw', 'THR-SCR', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 168, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('7fd84075-3b42-4851-9181-5fe846cf4d3e', 'T-Nut - 30mm', 'T-NUT-30MM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 64, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('0df15dda-24e5-47fc-9ac7-df6b0eb7eac7', 'T-Nut - 40mm for rails', 'T-NUT-40MM-RAIL', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 56, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('73484fee-2528-4b0f-b7b5-8efb2f5f9b4f', 'U Bolt', 'U-BLT', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 41, 0, '2026-09-16T05:13:40.426+00:00', '2026-09-16T05:13:40.426+00:00');
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
