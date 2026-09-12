-- Inventory database dump — 2026-09-12T19:04:22.828Z
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
INSERT INTO "PackStock" ("id", "itemId", "packSize", "sealedCount") VALUES ('cmtwvyg8d000ny8vnlap6lumr', 'cmtwvyg7s000my8vn91g8zh2p', 100, 8);
INSERT INTO "PackStock" ("id", "itemId", "packSize", "sealedCount") VALUES ('cmtwvyg9k000py8vnswnwrc5r', 'cmtwvyg8z000oy8vn320pvea3', 100, 8);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtwvyfvm0001y8vnvy5agnja', 'cmtwvyfv20000y8vn4fvz3m4o', 42, NULL, 'OPEN', '2026-09-11T11:41:30.466+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtwvyfwm0003y8vn4zonlfnn', 'cmtwvyfw50002y8vnwr90kknh', 36, NULL, 'OPEN', '2026-09-11T11:41:30.502+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtwvyfxl0005y8vnrb81r6og', 'cmtwvyfx40004y8vnf8gwaj49', 36, NULL, 'OPEN', '2026-09-11T11:41:30.537+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtwvyfyu0007y8vnlalcdo5c', 'cmtwvyfy50006y8vndb2xwhri', 12, NULL, 'OPEN', '2026-09-11T11:41:30.582+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtwvyg070009y8vn6hakptwi', 'cmtwvyfzk0008y8vnu3bhsj1o', 1, NULL, 'OPEN', '2026-09-11T11:41:30.631+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtwvyg1l000by8vnekk8z4a2', 'cmtwvyg11000ay8vnttwpo6ur', 1, NULL, 'OPEN', '2026-09-11T11:41:30.681+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtwvyg2s000dy8vn2itlq0a4', 'cmtwvyg27000cy8vn3piuakfr', 11, NULL, 'OPEN', '2026-09-11T11:41:30.724+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtwvyg3v000fy8vnqaxherob', 'cmtwvyg3b000ey8vn80yi3ux7', 55, NULL, 'OPEN', '2026-09-11T11:41:30.763+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtwvyg4w000hy8vng6ttdpcd', 'cmtwvyg4d000gy8vnl2iglxzd', 7, NULL, 'OPEN', '2026-09-11T11:41:30.800+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtwvyg61000jy8vnkkd3dy4i', 'cmtwvyg5g000iy8vnyqiqg7zs', 150, NULL, 'OPEN', '2026-09-11T11:41:30.842+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtwvyg73000ly8vno8dsivom', 'cmtwvyg6l000ky8vn09zj6hr2', 40, NULL, 'OPEN', '2026-09-11T11:41:30.879+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtwvygak000ry8vny7kd73mf', 'cmtwvyga1000qy8vnookws0dr', 60, NULL, 'OPEN', '2026-09-11T11:41:31.004+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtwvygbl000ty8vnd8fu6rcu', 'cmtwvygb3000sy8vnxx5kpph4', 110, NULL, 'OPEN', '2026-09-11T11:41:31.041+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtwvygcr000vy8vnocz20bjy', 'cmtwvygc6000uy8vnau784qwx', 40, NULL, 'OPEN', '2026-09-11T11:41:31.083+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtwvyge0000xy8vno4v3gknq', 'cmtwvygdg000wy8vnu2rx7a8w', 21, NULL, 'OPEN', '2026-09-11T11:41:31.128+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtwvygf2000zy8vnh2n0uecy', 'cmtwvygej000yy8vnu5f3yrrh', 5, NULL, 'OPEN', '2026-09-11T11:41:31.166+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtwvyggc0011y8vnzxvpbwph', 'cmtwvygfr0010y8vny25saee3', 7, NULL, 'OPEN', '2026-09-11T11:41:31.212+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtwvyghd0013y8vnhz3e903l', 'cmtwvyggv0012y8vnv03xuc91', 400, NULL, 'OPEN', '2026-09-11T11:41:31.249+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtwvygih0015y8vn4h2ip8gp', 'cmtwvyghw0014y8vnk1bwdcqc', 500, NULL, 'OPEN', '2026-09-11T11:41:31.289+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtwvygjk0017y8vn02hn98qu', 'cmtwvygj00016y8vnfz6ak1t7', 199, NULL, 'OPEN', '2026-09-11T11:41:31.328+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtwvygkp0019y8vn0tgi6x1a', 'cmtwvygk30018y8vn374xrnde', 500, NULL, 'OPEN', '2026-09-11T11:41:31.369+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtwvygm1001by8vn6vtsvlba', 'cmtwvyglh001ay8vnl1me61eq', 1, NULL, 'OPEN', '2026-09-11T11:41:31.417+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtwvygn1001dy8vnscbabyi4', 'cmtwvygmk001cy8vnd33ihl3l', 1, NULL, 'OPEN', '2026-09-11T11:41:31.453+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtwvygoq001gy8vnx7mwu4o3', 'cmtwvygo6001fy8vnkzs3rxl8', 1, NULL, 'OPEN', '2026-09-11T11:41:31.514+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtwvygps001iy8vn3m2v6nrm', 'cmtwvygp8001hy8vn1xdtjo8q', 180, NULL, 'OPEN', '2026-09-11T11:41:31.552+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtwvygr1001ky8vnklokjm8x', 'cmtwvygqd001jy8vnoua7lv4s', 19, NULL, 'OPEN', '2026-09-11T11:41:31.597+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtwvygrx001my8vnlvif77ae', 'cmtwvygrg001ly8vnlehora7t', 100, NULL, 'OPEN', '2026-09-11T11:41:31.629+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtwvygsy001oy8vnefp0p150', 'cmtwvygsf001ny8vnmw5h847i', 121, NULL, 'OPEN', '2026-09-11T11:41:31.666+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtwvygu5001qy8vnbgog75hp', 'cmtwvygtm001py8vnmycxc2t4', 100, NULL, 'OPEN', '2026-09-11T11:41:31.709+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtwvygv4001sy8vnwimou96u', 'cmtwvygum001ry8vnxinnc5vb', 13, NULL, 'OPEN', '2026-09-11T11:41:31.744+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtwvygw2001uy8vnmt7rerzx', 'cmtwvygvj001ty8vnvekqp5u7', 28, NULL, 'OPEN', '2026-09-11T11:41:31.778+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtwvygx6001wy8vnf1nrvo1l', 'cmtwvygwp001vy8vnysfw7rub', 21, NULL, 'OPEN', '2026-09-11T11:41:31.819+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtwvygy5001yy8vnt2glo7k6', 'cmtwvygxo001xy8vn9i4olfr3', 54, NULL, 'OPEN', '2026-09-11T11:41:31.853+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtwvygz30020y8vnxpsbx85z', 'cmtwvygyl001zy8vnnii9cyl2', 8, NULL, 'OPEN', '2026-09-11T11:41:31.888+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtwvyh060022y8vnly0863j2', 'cmtwvygzl0021y8vnr4ze10vp', 10, NULL, 'OPEN', '2026-09-11T11:41:31.926+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtwvyh190024y8vn1mj3z80x', 'cmtwvyh0n0023y8vn6gelw32w', 28, NULL, 'OPEN', '2026-09-11T11:41:31.965+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtwvyh2f0026y8vn9mlrlef2', 'cmtwvyh1s0025y8vnlazodv8m', 67, NULL, 'OPEN', '2026-09-11T11:41:32.007+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtwvyh3m0028y8vnhsdgw65s', 'cmtwvyh340027y8vn7lrgpl5u', 8, NULL, 'OPEN', '2026-09-11T11:41:32.050+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtwvyh4v002ay8vn65fmivzm', 'cmtwvyh450029y8vndfp603z7', 5, NULL, 'OPEN', '2026-09-11T11:41:32.095+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtwvyh5v002cy8vnoq9i2huh', 'cmtwvyh5d002by8vnix6h9t72', 8, NULL, 'OPEN', '2026-09-11T11:41:32.131+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtwvyh6u002ey8vnhyu3f3cd', 'cmtwvyh6d002dy8vns9gu4jf1', 66, NULL, 'OPEN', '2026-09-11T11:41:32.166+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtwvyh7u002gy8vnvzbvbcp2', 'cmtwvyh7a002fy8vn5979wnoc', 21, NULL, 'OPEN', '2026-09-11T11:41:32.202+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtwvyh8s002iy8vnw5ioz8u8', 'cmtwvyh8a002hy8vns1hejp6o', 30, NULL, 'OPEN', '2026-09-11T11:41:32.236+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtwvyh9o002ky8vnclr564tq', 'cmtwvyh97002jy8vnfd3sb6iv', 26, NULL, 'OPEN', '2026-09-11T11:41:32.268+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtwvyhao002my8vnqrzowgli', 'cmtwvyha4002ly8vnyzt34ja6', 6, NULL, 'OPEN', '2026-09-11T11:41:32.304+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtwvyhf4002oy8vnpm5d2wwl', 'cmtwvyhem002ny8vnc8lnlt0j', 23, NULL, 'OPEN', '2026-09-11T11:41:32.464+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtwvyhg6002qy8vnuzbz5af9', 'cmtwvyhfn002py8vnepj8tpyq', 42, NULL, 'OPEN', '2026-09-11T11:41:32.502+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtwvyhh8002sy8vngcuua8s1', 'cmtwvyhgn002ry8vnsim9bi6z', 116, NULL, 'OPEN', '2026-09-11T11:41:32.540+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtwvyhi8002uy8vnxomcip6a', 'cmtwvyhhp002ty8vn318x00jp', 112, NULL, 'OPEN', '2026-09-11T11:41:32.576+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtwvyhjg002wy8vn9xz50pqv', 'cmtwvyhip002vy8vn35dfp68l', 80, NULL, 'OPEN', '2026-09-11T11:41:32.620+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtwvyhkg002yy8vnb6ccttvr', 'cmtwvyhjy002xy8vn5ra5un8e', 9, NULL, 'OPEN', '2026-09-11T11:41:32.656+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtwvyhlh0030y8vng4ut86sl', 'cmtwvyhkx002zy8vnfqwqm8k4', 170, NULL, 'OPEN', '2026-09-11T11:41:32.694+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtwvyhne0032y8vnp4l297da', 'cmtwvyhm10031y8vntv6j29cb', 280, NULL, 'OPEN', '2026-09-11T11:41:32.762+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtwvyhok0034y8vnch8umtom', 'cmtwvyho10033y8vnmgebvwcn', 28, NULL, 'OPEN', '2026-09-11T11:41:32.804+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtwvyhpm0036y8vnuswhfg34', 'cmtwvyhp30035y8vnthora33f', 5, NULL, 'OPEN', '2026-09-11T11:41:32.842+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtwvyhqm0038y8vn0yqxndz7', 'cmtwvyhq20037y8vnub20ra4x', 7, NULL, 'OPEN', '2026-09-11T11:41:32.878+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtwvyhrp003ay8vnvzdblic0', 'cmtwvyhr40039y8vnwlphenyr', 15, NULL, 'OPEN', '2026-09-11T11:41:32.917+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtwvyhsr003cy8vnu3j0u3ki', 'cmtwvyhs8003by8vn7hw4mpth', 10, NULL, 'OPEN', '2026-09-11T11:41:32.955+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtwvyhts003ey8vnegxqjzun', 'cmtwvyht8003dy8vnunt7z8jr', 116, NULL, 'OPEN', '2026-09-11T11:41:32.992+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtwvyhvc003gy8vnhlcas8sc', 'cmtwvyhur003fy8vnqipcbc6x', 9, NULL, 'OPEN', '2026-09-11T11:41:33.048+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtwvyhwe003iy8vnv2pbq1el', 'cmtwvyhvu003hy8vnyg9fefev', 29, NULL, 'OPEN', '2026-09-11T11:41:33.086+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtwvyhxe003ky8vn32kg52n6', 'cmtwvyhwv003jy8vnb1ntuo0o', 31, NULL, 'OPEN', '2026-09-11T11:41:33.122+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtwvyhyg003my8vnxbg9hkf1', 'cmtwvyhxz003ly8vn7r9ptqcg', 30, NULL, 'OPEN', '2026-09-11T11:41:33.160+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtwvyhzd003oy8vnv5otm18e', 'cmtwvyhyx003ny8vnmpkp4sx4', 75, NULL, 'OPEN', '2026-09-11T11:41:33.193+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtwvyi0c003qy8vnirxzc59c', 'cmtwvyhzw003py8vncyxw43qd', 17, NULL, 'OPEN', '2026-09-11T11:41:33.228+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtwvyi1l003sy8vnzpantakm', 'cmtwvyi13003ry8vn3ws0co1f', 62, NULL, 'OPEN', '2026-09-11T11:41:33.273+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtwvyi2l003uy8vnukfbvdn0', 'cmtwvyi21003ty8vnnrvk7brs', 120, NULL, 'OPEN', '2026-09-11T11:41:33.309+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtwvyi3o003wy8vnuowd384s', 'cmtwvyi34003vy8vnw3bkzt0p', 19, NULL, 'OPEN', '2026-09-11T11:41:33.348+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtwvyi4t003yy8vn8kzqj4kb', 'cmtwvyi47003xy8vnxukip4hd', 8, NULL, 'OPEN', '2026-09-11T11:41:33.389+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtwvyi5y0040y8vnae7smymt', 'cmtwvyi5c003zy8vn91nmg5h9', 19, NULL, 'OPEN', '2026-09-11T11:41:33.430+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtwvyi730042y8vn3rtkw0jc', 'cmtwvyi6j0041y8vn7cxytxiy', 27, NULL, 'OPEN', '2026-09-11T11:41:33.471+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtwvyi8g0044y8vn8k55q05f', 'cmtwvyi7v0043y8vngaeqnybg', 17, NULL, 'OPEN', '2026-09-11T11:41:33.520+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtwvyi9y0046y8vnapg51gbn', 'cmtwvyi930045y8vnpvtlialc', 29, NULL, 'OPEN', '2026-09-11T11:41:33.574+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtwvyiba0048y8vnuvwl7xob', 'cmtwvyiao0047y8vnprhrt7pl', 16, NULL, 'OPEN', '2026-09-11T11:41:33.622+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtwvyice004ay8vn4lo9k5yg', 'cmtwvyibv0049y8vndqq00y7q', 64, NULL, 'OPEN', '2026-09-11T11:41:33.662+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtwvyidd004cy8vnh3g408j2', 'cmtwvyicv004by8vnnwwxafjl', 25, NULL, 'OPEN', '2026-09-11T11:41:33.697+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtwvyiee004ey8vnvfk3lwn0', 'cmtwvyidu004dy8vn06bq4f8i', 14, NULL, 'OPEN', '2026-09-11T11:41:33.734+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtwvyifl004gy8vnqce1e9jo', 'cmtwvyiey004fy8vnbzqkq7dv', 200, NULL, 'OPEN', '2026-09-11T11:41:33.777+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtwvyih0004iy8vnyh0d0fod', 'cmtwvyige004hy8vnchxj5a59', 2, NULL, 'OPEN', '2026-09-11T11:41:33.828+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtwvyii2004ky8vnlw3z2lb1', 'cmtwvyihk004jy8vnhvy32f9m', 9, NULL, 'OPEN', '2026-09-11T11:41:33.866+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtwvyij5004my8vntdsu9ww2', 'cmtwvyiik004ly8vngo3bgi98', 15, 100, 'OPEN', '2026-09-11T11:41:33.905+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtwvyik6004oy8vnpb6nlxha', 'cmtwvyijm004ny8vntnoiif77', 35, NULL, 'OPEN', '2026-09-11T11:41:33.942+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtwvyil8004qy8vn1pjxymec', 'cmtwvyiko004py8vn47y42k8b', 55, NULL, 'OPEN', '2026-09-11T11:41:33.980+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtwvyim6004sy8vn8m2yhtpa', 'cmtwvyilo004ry8vn1nm1nip4', 80, NULL, 'OPEN', '2026-09-11T11:41:34.014+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtwvyin9004uy8vn7w8k5m81', 'cmtwvyimn004ty8vnf73zxri9', 40, NULL, 'OPEN', '2026-09-11T11:41:34.053+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtwvyio9004wy8vnyim3eh2p', 'cmtwvyinq004vy8vnkr0hk40h', 40, NULL, 'OPEN', '2026-09-11T11:41:34.089+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtwvyipc004yy8vn9ptdn8pw', 'cmtwvyios004xy8vn5d5xpp97', 60, NULL, 'OPEN', '2026-09-11T11:41:34.128+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtwvyiqe0050y8vn9dfoz7zs', 'cmtwvyipv004zy8vneo2vnan6', 20, NULL, 'OPEN', '2026-09-11T11:41:34.166+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtwvyirh0052y8vnf6qf9xnb', 'cmtwvyiqv0051y8vn9aqogsz2', 19, NULL, 'OPEN', '2026-09-11T11:41:34.205+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtwvyisk0054y8vn1qb8dcmj', 'cmtwvyiry0053y8vnq1j0zsa9', 25, NULL, 'OPEN', '2026-09-11T11:41:34.244+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtwvyitr0056y8vnrk0fuz9n', 'cmtwvyit30055y8vnby07n51u', 216, NULL, 'OPEN', '2026-09-11T11:41:34.287+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtwvyiuu0058y8vn5ug86c5j', 'cmtwvyiu90057y8vnqbr5z68q', 168, NULL, 'OPEN', '2026-09-11T11:41:34.326+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtwvyivz005ay8vn97c8pfi2', 'cmtwvyive0059y8vnkzuflegq', 64, NULL, 'OPEN', '2026-09-11T11:41:34.367+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtwvyix4005cy8vnme0ojp3h', 'cmtwvyiwl005by8vnx5ocw8d1', 56, NULL, 'OPEN', '2026-09-11T11:41:34.408+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtwvyiy8005ey8vna60nknuu', 'cmtwvyixn005dy8vnb2j832qu', 41, NULL, 'OPEN', '2026-09-11T11:41:34.448+00:00', NULL);
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvyfv20000y8vn4fvz3m4o', 'Self-tapping Screw - 65x5.5mm', 'STP-SCR-65X5.5MM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 42, 0, '2026-09-11T11:41:30.446+00:00', '2026-09-11T11:41:30.446+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvyfw50002y8vnwr90kknh', 'AC Cable - 1 Core x 4 sqmm - Black', 'AC-CBL-1-C-X-4-BLK', 'Material', 'm', 'roll', 'CONTINUOUS', NULL, 0, 36, 0, '2026-09-11T11:41:30.485+00:00', '2026-09-11T11:41:30.485+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvyfx40004y8vnf8gwaj49', 'AC Cable - 1 Core x 4 sqmm - Red', 'AC-CBL-1-C-X-4-RED', 'Material', 'm', 'roll', 'CONTINUOUS', NULL, 0, 36, 0, '2026-09-11T11:41:30.520+00:00', '2026-09-11T11:41:30.520+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvyfy50006y8vndb2xwhri', 'AC Cable - 4 Core x 4 sqmm - Black', 'AC-CBL-4-C-X-4-BLK', 'Material', 'm', 'roll', 'CONTINUOUS', NULL, 0, 12, 0, '2026-09-11T11:41:30.557+00:00', '2026-09-11T11:41:30.557+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvyfzk0008y8vnu3bhsj1o', 'ACDB- 1PH- 1-6KW-1 in / 1 out', 'ACDB-1PH-1-6KW-1-IN-1-OUT', 'Equipment', 'box', NULL, 'DISCRETE', NULL, 0, 1, 0, '2026-09-11T11:41:30.608+00:00', '2026-09-11T11:41:30.608+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvyg11000ay8vnttwpo6ur', 'ACDB- 3PH- 5-15KW', 'ACDB-3PH-5-15KW', 'Equipment', 'box', NULL, 'DISCRETE', NULL, 0, 1, 0, '2026-09-11T11:41:30.661+00:00', '2026-09-11T11:41:30.661+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvyg27000cy8vn3piuakfr', 'Allen Bolt - M5 x 45mm', 'ALN-BLT-M5-X-45MM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 11, 0, '2026-09-11T11:41:30.703+00:00', '2026-09-11T11:41:30.703+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvyg3b000ey8vn80yi3ux7', 'Allen Bolt - M6 x 33mm', 'ALN-BLT-M6-X-33MM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 55, 0, '2026-09-11T11:41:30.743+00:00', '2026-09-11T11:41:30.743+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvyg4d000gy8vnl2iglxzd', 'Allen Bolt - M7 x 43mm', 'ALN-BLT-M7-X-43MM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 7, 0, '2026-09-11T11:41:30.781+00:00', '2026-09-11T11:41:30.781+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvyg5g000iy8vnyqiqg7zs', 'Bend Pipe', 'BND-PIP', 'Material', 'pcs', 'packet', 'DISCRETE', NULL, 0, 150, 0, '2026-09-11T11:41:30.820+00:00', '2026-09-11T11:41:30.820+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvyg6l000ky8vn09zj6hr2', 'Cable Gland - PG20', 'CBL-GLD-PG2', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 40, 0, '2026-09-11T11:41:30.861+00:00', '2026-09-11T11:41:30.861+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvyg7s000my8vn91g8zh2p', 'Cable Tie - Nylon 200mm', 'CBL-TIE-NYL-200MM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 800, 0, '2026-09-11T11:41:30.904+00:00', '2026-09-11T11:41:30.904+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvyg8z000oy8vn320pvea3', 'Cable Tie - Stainless Steel 200mm', 'CBL-TIE-SS-200MM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 800, 0, '2026-09-11T11:41:30.947+00:00', '2026-09-11T11:41:30.947+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvyga1000qy8vnookws0dr', 'Channel Spring Nut', 'CHN-SPR-NUT', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 60, 0, '2026-09-11T11:41:30.985+00:00', '2026-09-11T11:41:30.985+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvygb3000sy8vnxx5kpph4', 'Copper Ring Lug - 10-8 sqmm', 'CU-RNG-LUG-10-8', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 110, 0, '2026-09-11T11:41:31.023+00:00', '2026-09-11T11:41:31.023+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvygc6000uy8vnau784qwx', 'Copper Ring Lug - 10sqmm', 'CU-RNG-LUG-10SQMM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 40, 0, '2026-09-11T11:41:31.062+00:00', '2026-09-11T11:41:31.062+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvygdg000wy8vnu2rx7a8w', 'Copper Ring Lug - 16-8 sqmm', 'CU-RNG-LUG-16-8', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 21, 0, '2026-09-11T11:41:31.108+00:00', '2026-09-11T11:41:31.108+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvygej000yy8vnu5f3yrrh', 'Copper Ring Lug - 25 sqmm', 'CU-RNG-LUG-25', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 5, 0, '2026-09-11T11:41:31.147+00:00', '2026-09-11T11:41:31.147+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvygfr0010y8vny25saee3', 'Copper Ring Lug - 35-10 sqmm', 'CU-RNG-LUG-35-10', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 7, 0, '2026-09-11T11:41:31.191+00:00', '2026-09-11T11:41:31.191+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvyggv0012y8vnv03xuc91', 'DC Cable - 1 Core x 4 sqmm - Black', 'DC-CBL-1-C-X-4-BLK', 'Material', 'm', 'roll', 'CONTINUOUS', NULL, 0, 400, 0, '2026-09-11T11:41:31.231+00:00', '2026-09-11T11:41:31.231+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvyghw0014y8vnk1bwdcqc', 'DC Cable - 1 Core x 4 sqmm - Black(new)', 'DC-CBL-1-C-X-4-BLK-2', 'Material', 'm', 'roll', 'CONTINUOUS', NULL, 0, 500, 0, '2026-09-11T11:41:31.268+00:00', '2026-09-11T11:41:31.268+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvygj00016y8vnfz6ak1t7', 'DC Cable - 1 Core x 4 sqmm - Red', 'DC-CBL-1-C-X-4-RED', 'Material', 'm', 'roll', 'CONTINUOUS', NULL, 0, 199, 0, '2026-09-11T11:41:31.308+00:00', '2026-09-11T11:41:31.308+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvygk30018y8vn374xrnde', 'DC Cable - 1 Core x 4 sqmm - Red(new)', 'DC-CBL-1-C-X-4-RED-2', 'Material', 'm', 'roll', 'CONTINUOUS', NULL, 0, 500, 0, '2026-09-11T11:41:31.347+00:00', '2026-09-11T11:41:31.347+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvyglh001ay8vnl1me61eq', 'DCDB 1 in 1 out', 'DCDB-1-IN-1-OUT', 'Equipment', 'box', NULL, 'DISCRETE', NULL, 0, 1, 0, '2026-09-11T11:41:31.397+00:00', '2026-09-11T11:41:31.397+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvygmk001cy8vnd33ihl3l', 'DCDB 2 in 2 out', 'DCDB-2-IN-2-OUT', 'Equipment', 'box', NULL, 'DISCRETE', NULL, 0, 1, 0, '2026-09-11T11:41:31.437+00:00', '2026-09-11T11:41:31.437+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvygnm001ey8vnvhn8akl4', 'Deye String Inverter 10 KW', 'DEYE-STR-INV-10-KW', 'Equipment', 'box', NULL, 'DISCRETE', NULL, 0, 0, 0, '2026-09-11T11:41:31.474+00:00', '2026-09-11T11:41:31.474+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvygo6001fy8vnkzs3rxl8', 'Deye String Inverter 5 KW', 'DEYE-STR-INV-5-KW', 'Equipment', 'box', NULL, 'DISCRETE', NULL, 0, 1, 0, '2026-09-11T11:41:31.494+00:00', '2026-09-11T11:41:31.494+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvygp8001hy8vn1xdtjo8q', 'Double Nail Saddle', 'DOU-NL-SDL', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 180, 0, '2026-09-11T11:41:31.532+00:00', '2026-09-11T11:41:31.532+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvygqd001jy8vnoua7lv4s', 'Dummy Piece', 'DUM-PC', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 19, 0, '2026-09-11T11:41:31.573+00:00', '2026-09-11T11:41:31.573+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvygrg001ly8vnlehora7t', 'Earthing Cable - 1 Core-10 sqmm - Cu-Green', 'EARTH-CBL-1-C-10-CU-GRN', 'Material', 'm', 'roll', 'CONTINUOUS', NULL, 0, 100, 0, '2026-09-11T11:41:31.612+00:00', '2026-09-11T11:41:31.612+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvygsf001ny8vnmw5h847i', 'Earthing Cable - 1 Core-6 sqmm -Cu- Green', 'EARTH-CBL-1-C-6-CU-GRN', 'Material', 'm', 'roll', 'CONTINUOUS', NULL, 0, 121, 0, '2026-09-11T11:41:31.647+00:00', '2026-09-11T11:41:31.647+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvygtm001py8vnmycxc2t4', 'earthing cable 10sqmm,Cu-multi strand(new)', 'EARTH-CBL-10SQMM-CU-MLT-STD', 'Material', 'm', 'roll', 'CONTINUOUS', NULL, 0, 100, 0, '2026-09-11T11:41:31.690+00:00', '2026-09-11T11:41:31.690+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvygum001ry8vnxinnc5vb', 'Earthing Connector', 'EARTH-CON', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 13, 0, '2026-09-11T11:41:31.726+00:00', '2026-09-11T11:41:31.726+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvygvj001ty8vnvekqp5u7', 'Elbow Pipe', 'ELB-PIP', 'Material', 'pcs', 'packet', 'DISCRETE', NULL, 0, 28, 0, '2026-09-11T11:41:31.759+00:00', '2026-09-11T11:41:31.759+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvygwp001vy8vnysfw7rub', 'End Clamp (40mm) for Rails', 'END-CLM-RAIL', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 21, 0, '2026-09-11T11:41:31.801+00:00', '2026-09-11T11:41:31.801+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvygxo001xy8vn9i4olfr3', 'End Clamp (50mm) for Rails', 'END-CLM-RAIL-2', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 54, 0, '2026-09-11T11:41:31.836+00:00', '2026-09-11T11:41:31.836+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvygyl001zy8vnnii9cyl2', 'End Clamp U Bolt type', 'END-CLM-U-BLT', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 8, 0, '2026-09-11T11:41:31.869+00:00', '2026-09-11T11:41:31.869+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvygzl0021y8vnr4ze10vp', 'Fastner', 'FSTN', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 10, 0, '2026-09-11T11:41:31.905+00:00', '2026-09-11T11:41:31.905+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvyh0n0023y8vn6gelw32w', 'Flange Nut - 5.5mm', 'FLG-NUT-5.5MM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 28, 0, '2026-09-11T11:41:31.943+00:00', '2026-09-11T11:41:31.943+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvyh1s0025y8vnlazodv8m', 'Flange Nut - 7.5mm', 'FLG-NUT-7.5MM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 67, 0, '2026-09-11T11:41:31.984+00:00', '2026-09-11T11:41:31.984+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvyh340027y8vn7lrgpl5u', 'Flexible Pipe - 10mm - Black', 'FLX-PIP-10MM-BLK', 'Material', 'm', 'roll', 'CONTINUOUS', NULL, 0, 8, 0, '2026-09-11T11:41:32.032+00:00', '2026-09-11T11:41:32.032+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvyh450029y8vndfp603z7', 'Flexible Pipe - 20mm - Black', 'FLX-PIP-20MM-BLK', 'Material', 'm', 'roll', 'CONTINUOUS', NULL, 0, 5, 0, '2026-09-11T11:41:32.069+00:00', '2026-09-11T11:41:32.069+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvyh5d002by8vnix6h9t72', 'Flexible Pipe - White', 'FLX-PIP-WHT', 'Material', 'm', 'roll', 'CONTINUOUS', NULL, 0, 8, 0, '2026-09-11T11:41:32.113+00:00', '2026-09-11T11:41:32.113+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvyh6d002dy8vns9gu4jf1', 'Hex Bolt - 24x4mm', 'HEX-BLT-24X4MM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 66, 0, '2026-09-11T11:41:32.149+00:00', '2026-09-11T11:41:32.149+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvyh7a002fy8vn5979wnoc', 'Hex Bolt - 30x4mm', 'HEX-BLT-30X4MM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 21, 0, '2026-09-11T11:41:32.182+00:00', '2026-09-11T11:41:32.182+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvyh8a002hy8vns1hejp6o', 'Hex Bolt - 30x5mm', 'HEX-BLT-30X5MM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 30, 0, '2026-09-11T11:41:32.218+00:00', '2026-09-11T11:41:32.218+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvyh97002jy8vnfd3sb6iv', 'Hex Bolt - 43x4mm', 'HEX-BLT-43X4MM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 26, 0, '2026-09-11T11:41:32.251+00:00', '2026-09-11T11:41:32.251+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvyha4002ly8vnyzt34ja6', 'Hex Bolt - 60x6mm', 'HEX-BLT-60X6MM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 6, 0, '2026-09-11T11:41:32.284+00:00', '2026-09-11T11:41:32.284+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvyhem002ny8vnc8lnlt0j', 'Hex Bolt - 80x4mm', 'HEX-BLT-80X4MM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 23, 0, '2026-09-11T11:41:32.446+00:00', '2026-09-11T11:41:32.446+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvyhfn002py8vnepj8tpyq', 'Hex Serrated Flange Bolt - 30x5mm', 'HEX-SRT-FLG-BLT-30X5MM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 42, 0, '2026-09-11T11:41:32.483+00:00', '2026-09-11T11:41:32.483+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvyhgn002ry8vnsim9bi6z', 'Jointer - Walkway', 'JNT-WKWY', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 116, 0, '2026-09-11T11:41:32.519+00:00', '2026-09-11T11:41:32.519+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvyhhp002ty8vn318x00jp', 'L-Foot', 'L-FT', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 112, 0, '2026-09-11T11:41:32.557+00:00', '2026-09-11T11:41:32.557+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvyhip002vy8vn35dfp68l', 'MC4 Connector', 'MC4-CON', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 80, 0, '2026-09-11T11:41:32.593+00:00', '2026-09-11T11:41:32.593+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvyhjy002xy8vn5ra5un8e', 'M-Clamp - Walkway', 'M-CLM-WKWY', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 9, 0, '2026-09-11T11:41:32.638+00:00', '2026-09-11T11:41:32.638+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvyhkx002zy8vnfqwqm8k4', 'Metal Flat Screw', 'MET-FLT-SCR', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 170, 0, '2026-09-11T11:41:32.673+00:00', '2026-09-11T11:41:32.673+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvyhm10031y8vntv6j29cb', 'Metal Saddle', 'MET-SDL', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 280, 0, '2026-09-11T11:41:32.713+00:00', '2026-09-11T11:41:32.713+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvyho10033y8vnmgebvwcn', 'Mid Clamp (50mm) for Rails', 'MID-CLM-RAIL', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 28, 0, '2026-09-11T11:41:32.785+00:00', '2026-09-11T11:41:32.785+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvyhp30035y8vnthora33f', 'Mid Clamp U Bolt type', 'MID-CLM-U-BLT', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 5, 0, '2026-09-11T11:41:32.823+00:00', '2026-09-11T11:41:32.823+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvyhq20037y8vnub20ra4x', 'Mop - 3.5', 'MOP-3.5', 'Equipment', 'pcs', 'packet', 'DISCRETE', NULL, 0, 7, 0, '2026-09-11T11:41:32.858+00:00', '2026-09-11T11:41:32.858+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvyhr40039y8vnwlphenyr', 'Mop - 4.5', 'MOP-4.5', 'Equipment', 'pcs', 'packet', 'DISCRETE', NULL, 0, 15, 0, '2026-09-11T11:41:32.896+00:00', '2026-09-11T11:41:32.896+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvyhs8003by8vn7hw4mpth', 'Mop Cloth', 'MOP-CLT', 'Equipment', 'pcs', 'packet', 'DISCRETE', NULL, 0, 10, 0, '2026-09-11T11:41:32.936+00:00', '2026-09-11T11:41:32.936+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvyht8003dy8vnunt7z8jr', 'Nut (5.5mm)', 'NUT', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 116, 0, '2026-09-11T11:41:32.972+00:00', '2026-09-11T11:41:32.972+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvyhur003fy8vnqipcbc6x', 'Photovoltaic Fuse', 'PV-FUS', 'Equipment', 'pcs', 'packet', 'DISCRETE', NULL, 0, 9, 0, '2026-09-11T11:41:33.027+00:00', '2026-09-11T11:41:33.027+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvyhvu003hy8vnyg9fefev', 'PVC Cable Marker Ferrule - 6 sqmm', 'PVC-CBL-MKR-FER-6', 'Material', 'pcs', 'packet', 'DISCRETE', NULL, 0, 29, 0, '2026-09-11T11:41:33.066+00:00', '2026-09-11T11:41:33.066+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvyhwv003jy8vnb1ntuo0o', 'Rawal Plug - Large', 'RAW-PLG-LAR', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 31, 0, '2026-09-11T11:41:33.103+00:00', '2026-09-11T11:41:33.103+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvyhxz003ly8vn7r9ptqcg', 'Rawal Plug - Small', 'RAW-PLG-SMA', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 30, 0, '2026-09-11T11:41:33.143+00:00', '2026-09-11T11:41:33.143+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvyhyx003ny8vnmpkp4sx4', 'Ring Lug - 4-6 sqmm', 'RNG-LUG-4-6', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 75, 0, '2026-09-11T11:41:33.177+00:00', '2026-09-11T11:41:33.177+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvyhzw003py8vncyxw43qd', 'Rubber buffer', 'RBR-BUF', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 17, 0, '2026-09-11T11:41:33.212+00:00', '2026-09-11T11:41:33.212+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvyi13003ry8vn3ws0co1f', 'Screw - 40x3mm', 'SCR-40X3MM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 62, 0, '2026-09-11T11:41:33.255+00:00', '2026-09-11T11:41:33.255+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvyi21003ty8vnnrvk7brs', 'Self -tapping Screw - 60x5mm', 'STP-SCR-60X5MM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 120, 0, '2026-09-11T11:41:33.289+00:00', '2026-09-11T11:41:33.289+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvyi34003vy8vnw3bkzt0p', 'Self-tapping Screw - 105x5mm', 'STP-SCR-105X5MM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 19, 0, '2026-09-11T11:41:33.328+00:00', '2026-09-11T11:41:33.328+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvyi47003xy8vnxukip4hd', 'Self-tapping Screw - 20x4mm', 'STP-SCR-20X4MM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 8, 0, '2026-09-11T11:41:33.367+00:00', '2026-09-11T11:41:33.367+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvyi5c003zy8vn91nmg5h9', 'Self-tapping Screw - 30x5mm', 'STP-SCR-30X5MM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 19, 0, '2026-09-11T11:41:33.408+00:00', '2026-09-11T11:41:33.408+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvyi6j0041y8vn7cxytxiy', 'Self-tapping Screw - 40x5mm', 'STP-SCR-40X5MM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 27, 0, '2026-09-11T11:41:33.451+00:00', '2026-09-11T11:41:33.451+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvyi7v0043y8vngaeqnybg', 'Self-tapping Screw - 50x5mm', 'STP-SCR-50X5MM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 17, 0, '2026-09-11T11:41:33.499+00:00', '2026-09-11T11:41:33.499+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvyi930045y8vnpvtlialc', 'Self-tapping Screw - 70x4mm', 'STP-SCR-70X4MM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 29, 0, '2026-09-11T11:41:33.543+00:00', '2026-09-11T11:41:33.543+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvyiao0047y8vnprhrt7pl', 'Self-tapping Screw - 80x4mm', 'STP-SCR-80X4MM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 16, 0, '2026-09-11T11:41:33.600+00:00', '2026-09-11T11:41:33.600+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvyibv0049y8vndqq00y7q', 'Self-tapping Screw - 80x5mm', 'STP-SCR-80X5MM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 64, 0, '2026-09-11T11:41:33.643+00:00', '2026-09-11T11:41:33.643+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvyicv004by8vnnwwxafjl', 'Solar Panel Mid-Clamp - 40mm', 'SLR-PNL-MID-CLM-40MM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 25, 0, '2026-09-11T11:41:33.679+00:00', '2026-09-11T11:41:33.679+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvyidu004dy8vn06bq4f8i', 'Solar Rail T-Nut - M8', 'SLR-RAIL-T-NUT-M8', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 14, 0, '2026-09-11T11:41:33.714+00:00', '2026-09-11T11:41:33.714+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvyiey004fy8vnbzqkq7dv', 'Solar Water Drain Clip', 'SLR-WTR-DRN-CLI', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 200, 0, '2026-09-11T11:41:33.754+00:00', '2026-09-11T11:41:33.754+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvyige004hy8vnchxj5a59', 'Solaredge Optimisers S-1000', 'SOL-OPT-S-1000', 'Equipment', 'pcs', 'packet', 'DISCRETE', NULL, 0, 2, 0, '2026-09-11T11:41:33.806+00:00', '2026-09-11T11:41:33.806+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvyihk004jy8vnhvy32f9m', 'SPD', 'SPD', 'Equipment', 'pcs', 'packet', 'DISCRETE', NULL, 0, 9, 0, '2026-09-11T11:41:33.848+00:00', '2026-09-11T11:41:33.848+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvyiik004ly8vngo3bgi98', 'Spring Washer', 'SPR-WSH', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 15, 0, '2026-09-11T11:41:33.885+00:00', '2026-09-11T11:41:33.885+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvyijm004ny8vntnoiif77', 'Square Bolt - M6 x 35mm', 'SQR-BLT-M6-X-35MM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 35, 0, '2026-09-11T11:41:33.922+00:00', '2026-09-11T11:41:33.922+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvyiko004py8vn47y42k8b', 'SS Allen Bolt - M6 x 28mm', 'SS-ALN-BLT-M6-X-28MM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 55, 0, '2026-09-11T11:41:33.960+00:00', '2026-09-11T11:41:33.960+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvyilo004ry8vn1nm1nip4', 'SS Bolt M6X25mm (panel Earting)', 'SS-BLT-M6X25MM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 80, 0, '2026-09-11T11:41:33.996+00:00', '2026-09-11T11:41:33.996+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvyimn004ty8vnf73zxri9', 'SS Nut M6 (panel Earting)', 'SS-NUT-M6', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 40, 0, '2026-09-11T11:41:34.031+00:00', '2026-09-11T11:41:34.031+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvyinq004vy8vnkr0hk40h', 'SS T Head Bolt for L Foot', 'SS-T-HEA-BLT-L-FT', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 40, 0, '2026-09-11T11:41:34.070+00:00', '2026-09-11T11:41:34.070+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvyios004xy8vn5d5xpp97', 'SS Washer 6mm (panel Earthing)', 'SS-WSH-6MM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 60, 0, '2026-09-11T11:41:34.108+00:00', '2026-09-11T11:41:34.108+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvyipv004zy8vneo2vnan6', 'Stainless Steel Flat Washer - 20mm OD / 6mm ID', 'SS-FLT-WSH-20MM-OD-6MM-ID', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 20, 0, '2026-09-11T11:41:34.147+00:00', '2026-09-11T11:41:34.147+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvyiqv0051y8vn9aqogsz2', 'Stainless Steel Flat Washer - 22mm OD / 11mm ID', 'SS-FLT-WSH-22MM-OD-11MM-ID', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 19, 0, '2026-09-11T11:41:34.183+00:00', '2026-09-11T11:41:34.183+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvyiry0053y8vnq1j0zsa9', 'Stainless Steel Flat Washer - 22mm OD / 6mm ID', 'SS-FLT-WSH-22MM-OD-6MM-ID', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 25, 0, '2026-09-11T11:41:34.222+00:00', '2026-09-11T11:41:34.222+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvyit30055y8vnby07n51u', 'Tee Pipe', 'TEE-PIP', 'Material', 'pcs', 'packet', 'DISCRETE', NULL, 0, 216, 0, '2026-09-11T11:41:34.263+00:00', '2026-09-11T11:41:34.263+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvyiu90057y8vnqbr5z68q', 'Threaded Screw', 'THR-SCR', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 168, 0, '2026-09-11T11:41:34.305+00:00', '2026-09-11T11:41:34.305+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvyive0059y8vnkzuflegq', 'T-Nut - 30mm', 'T-NUT-30MM', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 64, 0, '2026-09-11T11:41:34.346+00:00', '2026-09-11T11:41:34.346+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvyiwl005by8vnx5ocw8d1', 'T-Nut - 40mm for rails', 'T-NUT-40MM-RAIL', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 56, 0, '2026-09-11T11:41:34.389+00:00', '2026-09-11T11:41:34.389+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtwvyixn005dy8vnb2j832qu', 'U Bolt', 'U-BLT', 'Fixing', 'pcs', 'packet', 'DISCRETE', NULL, 0, 41, 0, '2026-09-11T11:41:34.427+00:00', '2026-09-11T11:41:34.427+00:00');
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
