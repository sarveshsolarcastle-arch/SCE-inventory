-- Inventory database dump — 2026-09-08T19:05:40.535Z
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
INSERT INTO "User" ("id", "name", "email", "passwordHash", "role", "isActive", "createdAt") VALUES ('cmt8clq0300002svnyz2bbkg3', 'Admin', 'admin@example.com', '$2b$10$1LyYZD6C2RFlWHg1DSDHKuBg2NT5KvuZtnKV1xTWTGu6mXEDhI6TK', 'ADMIN', 1, '2026-08-25T07:33:16.131+00:00');
INSERT INTO "User" ("id", "name", "email", "passwordHash", "role", "isActive", "createdAt") VALUES ('cmt8clqf000012svngbs04djq', 'Finance', 'finance@example.com', '$2b$10$vOTPi1t/jPUN.hX9HgHw3uxfk7W50D.yzq.R1MOjtb/G09RQg.RpG', 'FINANCE', 1, '2026-08-25T07:33:16.668+00:00');
INSERT INTO "User" ("id", "name", "email", "passwordHash", "role", "isActive", "createdAt") VALUES ('cmt8clqjj00022svngzgjibno', 'Employee', 'employee@example.com', '$2b$10$QNumupivp6J47aWhV03rKeWOYLiMd547ju1T3/AVBNWTkPfs8hPGK', 'EMPLOYEE', 1, '2026-08-25T07:33:16.831+00:00');
INSERT INTO "User" ("id", "name", "email", "passwordHash", "role", "isActive", "createdAt") VALUES ('cmt8ez458000004jps43rqy2q', 'SANCHITA PARAB', 'sanchita.p@solarcastle.in', '$2b$10$oRAKjS/5u57KLys6cxiYUeeLTjiA7cAOJOxj9bGdvNjlO4xo/Wrly', 'ADMIN', 1, '2026-08-25T08:39:40.220+00:00');
INSERT INTO "User" ("id", "name", "email", "passwordHash", "role", "isActive", "createdAt") VALUES ('cmt8f4cpf000004k01xjvpml5', 'Durgesh Nandkumar Pawar', 'durgesh.solarcastle@gmail.com', '$2b$10$aqWczu8wkcolLvMB1fdYI.xBhcw94h3d7qMFYkN7k3kKvJurOes8O', 'ADMIN', 1, '2026-08-25T08:43:44.595+00:00');
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
