-- Inventory database dump — 2026-09-04T19:04:48.778Z
PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
DROP TABLE IF EXISTS "Site";
DROP TABLE IF EXISTS "Shelf";
DROP TABLE IF EXISTS "PackStock";
DROP TABLE IF EXISTS "OpenPack";
DROP TABLE IF EXISTS "Item";
DROP TABLE IF EXISTS "ShelfSlot";
DROP TABLE IF EXISTS "Dispatch";
DROP TABLE IF EXISTS "Delivery";
DROP TABLE IF EXISTS "DefectiveItem";
DROP TABLE IF EXISTS "SitePickup";
DROP TABLE IF EXISTS "Transaction";
DROP TABLE IF EXISTS "User";
CREATE TABLE "Site" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
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
CREATE UNIQUE INDEX "Item_sku_key" ON "Item"("sku");
CREATE INDEX "ShelfSlot_itemId_idx" ON "ShelfSlot"("itemId");
CREATE UNIQUE INDEX "ShelfSlot_shelfId_side_row_column_key" ON "ShelfSlot"("shelfId", "side", "row", "column");
CREATE UNIQUE INDEX "ShelfSlot_shelfId_tagCode_key" ON "ShelfSlot"("shelfId", "tagCode");
CREATE UNIQUE INDEX "PackStock_itemId_packSize_key" ON "PackStock"("itemId", "packSize");
CREATE INDEX "OpenPack_itemId_state_idx" ON "OpenPack"("itemId", "state");
CREATE INDEX "OpenPack_shelfSlotId_idx" ON "OpenPack"("shelfSlotId");
CREATE INDEX "Dispatch_dispatchedAt_idx" ON "Dispatch"("dispatchedAt");
CREATE INDEX "Dispatch_siteId_idx" ON "Dispatch"("siteId");
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
INSERT INTO "Site" ("id", "name", "location", "notes", "createdAt") VALUES ('cmt8clrih00062svnb0ho0sqt', 'Kandivali Site', NULL, NULL, '2026-08-25T07:33:18.089+00:00');
INSERT INTO "Site" ("id", "name", "location", "notes", "createdAt") VALUES ('cmt8clrn200072svnomcwtjhz', 'Borivali Site', NULL, NULL, '2026-08-25T07:33:18.254+00:00');
INSERT INTO "Site" ("id", "name", "location", "notes", "createdAt") VALUES ('cmtbau7r9000104ju6nw9162l', 'Jayesh Nike', 'Borim', NULL, '2026-08-27T09:07:11.685+00:00');
INSERT INTO "Site" ("id", "name", "location", "notes", "createdAt") VALUES ('cmtbb92wi000904l9csmdsr1s', 'mapusa site', 'mapusa', NULL, '2026-08-27T09:18:45.234+00:00');
INSERT INTO "Site" ("id", "name", "location", "notes", "createdAt") VALUES ('cmte612uj000004jgelaltxe1', 'Deme''llo site', 'vasco', NULL, '2026-08-29T09:15:52.363+00:00');
INSERT INTO "Site" ("id", "name", "location", "notes", "createdAt") VALUES ('cmte62fmm000004jr7itbb97v', 'Rahul site', 'Margao', NULL, '2026-08-29T09:16:55.582+00:00');
INSERT INTO "Site" ("id", "name", "location", "notes", "createdAt") VALUES ('cmtijfloo000004jl37eqnaz4', 'mahesh site', 'porvorim', NULL, '2026-09-01T10:42:09.672+00:00');
INSERT INTO "Shelf" ("id", "name", "rows", "columns", "createdAt") VALUES ('cmtbfk9qq000004l4h6whnuou', 'M6 bolts', 4, 5, '2026-08-27T11:19:25.778+00:00');
INSERT INTO "Shelf" ("id", "name", "rows", "columns", "createdAt") VALUES ('cmtbfkc8j001504l4sy0gyccx', 'M6 bolts', 4, 5, '2026-08-27T11:19:29.012+00:00');
INSERT INTO "Shelf" ("id", "name", "rows", "columns", "createdAt") VALUES ('cmtbfke92002a04l4kh2p7dfw', 'M6 bolts', 4, 5, '2026-08-27T11:19:31.622+00:00');
INSERT INTO "Shelf" ("id", "name", "rows", "columns", "createdAt") VALUES ('cmtbfkg8t003f04l4vpwbjofr', 'M6 bolts', 4, 5, '2026-08-27T11:19:34.205+00:00');
INSERT INTO "Shelf" ("id", "name", "rows", "columns", "createdAt") VALUES ('cmtbfki8g004k04l4av89j5db', 'M6 bolts', 4, 5, '2026-08-27T11:19:36.784+00:00');
INSERT INTO "Shelf" ("id", "name", "rows", "columns", "createdAt") VALUES ('cmtbfkk8f005p04l4gm1qzzis', 'M6 bolts', 4, 5, '2026-08-27T11:19:39.375+00:00');
INSERT INTO "Shelf" ("id", "name", "rows", "columns", "createdAt") VALUES ('cmtbfkm85006u04l4xjamndl2', 'M6 bolts', 4, 5, '2026-08-27T11:19:41.957+00:00');
INSERT INTO "Shelf" ("id", "name", "rows", "columns", "createdAt") VALUES ('cmtbgxnl4000004ifwgrtauvm', 'M6 bolts', 1, 1, '2026-08-27T11:57:49.864+00:00');
INSERT INTO "Shelf" ("id", "name", "rows", "columns", "createdAt") VALUES ('cmtcgherb000004jlwcf5e2to', 'MC4 CONNECTOR', 4, 5, '2026-08-28T04:32:58.103+00:00');
INSERT INTO "Shelf" ("id", "name", "rows", "columns", "createdAt") VALUES ('cmtcghhu5001504jlth6aw31d', 'MC4 CONNECTOR', 4, 5, '2026-08-28T04:33:02.093+00:00');
INSERT INTO "Shelf" ("id", "name", "rows", "columns", "createdAt") VALUES ('cmtcgl62y000004le5sqgpw8m', 'SCREWS', 1, 5, '2026-08-28T04:35:53.482+00:00');
INSERT INTO "PackStock" ("id", "itemId", "packSize", "sealedCount") VALUES ('cmtbab62f000104l9uvs1oxc2', 'cmt8clr9x00052svn4x8czqka', 3, 1);
INSERT INTO "PackStock" ("id", "itemId", "packSize", "sealedCount") VALUES ('cmtbab7q9000604l9c6eqwhea', 'cmt8clr1500042svnq1kc91pk', 5, 4);
INSERT INTO "PackStock" ("id", "itemId", "packSize", "sealedCount") VALUES ('cmtbgaz5v000104l15a9sm7to', 'cmt8clqsc00032svncl2229e9', 1000, 4);
INSERT INTO "PackStock" ("id", "itemId", "packSize", "sealedCount") VALUES ('cmtbgazx8000304l1c349enp3', 'cmtbg5gj9000304l46o6btrbz', 200, 5);
INSERT INTO "PackStock" ("id", "itemId", "packSize", "sealedCount") VALUES ('cmtbgczzi000404l6pznsea5i', 'cmt8clr1500042svnq1kc91pk', 200, 5);
INSERT INTO "PackStock" ("id", "itemId", "packSize", "sealedCount") VALUES ('cmtck4yri000804jp3mlimlcb', 'cmtcjndbp000004jsw6k74ldb', 50, 7);
INSERT INTO "PackStock" ("id", "itemId", "packSize", "sealedCount") VALUES ('cmtck4zi9000a04jplnjvd686', 'cmtcjtfgj000004ky5h8z6nl1', 50, 15);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtbab67y000204l9pzarozbc', 'cmt8clr9x00052svn4x8czqka', 1, NULL, 'OPEN', '2026-08-27T08:52:23.230+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtbab6z6000404l9qviyyj1t', 'cmt8g0sst000004jx7ga0nyri', 5, NULL, 'OPEN', '2026-08-27T08:52:24.210+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtbgcz75000204l6cusjpyet', 'cmt8g0sst000004jx7ga0nyri', 95, NULL, 'OPEN', '2026-08-27T11:41:45.137+00:00', NULL);
INSERT INTO "OpenPack" ("id", "itemId", "remaining", "originalSize", "state", "openedAt", "shelfSlotId") VALUES ('cmtbhmm6d000704l48eu6bbsu', 'cmt8clr1500042svnq1kc91pk', 2, NULL, 'OPEN', '2026-08-27T12:17:14.437+00:00', NULL);
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmt8clqsc00032svncl2229e9', 'Wire 2.5mm²', 'WIRE-2.5', 'Cable', 'm', 'roll', 'CONTINUOUS', 15, 500, 4000, 0, '2026-08-25T07:33:17.148+00:00', '2026-08-27T11:40:12.364+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmt8clr1500042svnq1kc91pk', 'Screws M4', 'SCR-M4', 'Fixings', 'pcs', 'packet', 'DISCRETE', NULL, 200, 1022, 0, '2026-08-25T07:33:17.465+00:00', '2026-08-27T12:17:15.019+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmt8clr9x00052svn4x8czqka', 'Inverter 5kW', 'INV-5K', 'Equipment', 'pcs', 'box', 'DISCRETE', NULL, 2, 4, 0, '2026-08-25T07:33:17.781+00:00', '2026-08-29T09:51:31.802+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmt8g0sst000004jx7ga0nyri', 'MC4 CONNECTOR', 'CON-MC4-PAIR', 'Equipment', 'pcs', NULL, 'DISCRETE', NULL, 50, 100, 0, '2026-08-25T09:08:58.445+00:00', '2026-08-27T11:41:45.750+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtbg5gj9000304l46o6btrbz', 'M6 bolts', 'Xyz', 'Fixings', 'pcs', '200', 'DISCRETE', NULL, 50, 1000, 0, '2026-08-27T11:35:54.357+00:00', '2026-08-27T11:40:13.335+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtcjndbp000004jsw6k74ldb', '4mm² Solar DC Cable (Black)', 'CAB-DC-4MM-BLK', 'Cables & Wiring', 'm', 'roll', 'CONTINUOUS', NULL, 100, 350, 0, '2026-08-28T06:01:35.029+00:00', '2026-08-29T09:31:49.789+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtcjq6et000004jpuxg4qdag', 'Aluminium Mid Clamp 35mm', 'STR-MID-35MM', 'Mounting Structure', 'pcs', 'packet', 'DISCRETE', NULL, 100, 0, 0, '2026-08-28T06:03:46.037+00:00', '2026-08-28T06:03:46.037+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtcjtfgj000004ky5h8z6nl1', 'Aluminium End Clamp 35mm', 'STR-End-35MM', 'Mounting Structure', 'pcs', 'box', 'DISCRETE', NULL, 50, 750, 0, '2026-08-28T06:06:17.731+00:00', '2026-08-28T06:15:17.498+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtcjvhay000104kykfvtfq4b', '25x3mm GI Earthing Strip', 'EAR-STRIP-GI-25X3', 'Earthing', 'm', 'roll', 'CONTINUOUS', NULL, 50, 0, 0, '2026-08-28T06:07:53.434+00:00', '2026-08-28T06:07:53.434+00:00');
INSERT INTO "Item" ("id", "name", "sku", "category", "baseUnit", "packUnit", "measure", "scrapThreshold", "minStock", "currentStock", "scrapStock", "createdAt", "updatedAt") VALUES ('cmtcr06su000004l4ercwm7uc', '10 Kw inverter', '10- inv', 'Equipment', 'pcs', 'Box', 'DISCRETE', NULL, 2, 0, 0, '2026-08-28T09:27:30.414+00:00', '2026-08-28T09:27:30.414+00:00');
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfka8u000104l499lp0jur', 'cmtbfk9qq000004l4h6whnuou', 'FRONT', 1, 1, 'F1-1', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfka8u000204l44rew14wj', 'cmtbfk9qq000004l4h6whnuou', 'FRONT', 1, 2, 'F1-2', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfka8u000304l4vgvw74yk', 'cmtbfk9qq000004l4h6whnuou', 'FRONT', 1, 3, 'F1-3', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfka8u000404l4awfe9dko', 'cmtbfk9qq000004l4h6whnuou', 'FRONT', 1, 4, 'F1-4', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfka8v000504l4adz0gdcl', 'cmtbfk9qq000004l4h6whnuou', 'FRONT', 1, 5, 'F1-5', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfka8v000604l4323dm6eh', 'cmtbfk9qq000004l4h6whnuou', 'FRONT', 2, 1, 'F2-1', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfka8v000704l4w2kjmwtm', 'cmtbfk9qq000004l4h6whnuou', 'FRONT', 2, 2, 'F2-2', 0, 'OPENED', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfka8v000804l4f7m2sq35', 'cmtbfk9qq000004l4h6whnuou', 'FRONT', 2, 3, 'F2-3', 0, 'RECYCLABLE', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfka8v000904l49919nyjr', 'cmtbfk9qq000004l4h6whnuou', 'FRONT', 2, 4, 'F2-4', 0, 'RECYCLABLE', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfka8v000a04l4k2c4kbvt', 'cmtbfk9qq000004l4h6whnuou', 'FRONT', 2, 5, 'F2-5', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfka8v000b04l4y643pi08', 'cmtbfk9qq000004l4h6whnuou', 'FRONT', 3, 1, 'F3-1', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfka8v000c04l4oj17d2nc', 'cmtbfk9qq000004l4h6whnuou', 'FRONT', 3, 2, 'F3-2', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfka8v000d04l4n8e6w93n', 'cmtbfk9qq000004l4h6whnuou', 'FRONT', 3, 3, 'F3-3', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfka8v000e04l4lkz55qma', 'cmtbfk9qq000004l4h6whnuou', 'FRONT', 3, 4, 'F3-4', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfka8v000f04l43dzipewh', 'cmtbfk9qq000004l4h6whnuou', 'FRONT', 3, 5, 'F3-5', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfka8v000g04l4d8bfvyd7', 'cmtbfk9qq000004l4h6whnuou', 'FRONT', 4, 1, 'F4-1', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfka8v000h04l4eaa4ce99', 'cmtbfk9qq000004l4h6whnuou', 'FRONT', 4, 2, 'F4-2', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfka8v000i04l4p4dlaqmf', 'cmtbfk9qq000004l4h6whnuou', 'FRONT', 4, 3, 'F4-3', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfka8v000j04l404ohorrw', 'cmtbfk9qq000004l4h6whnuou', 'FRONT', 4, 4, 'F4-4', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfka8v000k04l4v28co66q', 'cmtbfk9qq000004l4h6whnuou', 'FRONT', 4, 5, 'F4-5', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfka8v000l04l4x66l1no9', 'cmtbfk9qq000004l4h6whnuou', 'BACK', 1, 1, 'B1-1', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfka8v000m04l4rson80hf', 'cmtbfk9qq000004l4h6whnuou', 'BACK', 1, 2, 'B1-2', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfka8v000n04l4jpx6v9ct', 'cmtbfk9qq000004l4h6whnuou', 'BACK', 1, 3, 'B1-3', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfka8v000o04l4sn832woq', 'cmtbfk9qq000004l4h6whnuou', 'BACK', 1, 4, 'B1-4', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfka8v000p04l4ryh8jxwo', 'cmtbfk9qq000004l4h6whnuou', 'BACK', 1, 5, 'B1-5', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfka8v000q04l46jq5qx5a', 'cmtbfk9qq000004l4h6whnuou', 'BACK', 2, 1, 'B2-1', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfka8v000r04l41ly7pe7j', 'cmtbfk9qq000004l4h6whnuou', 'BACK', 2, 2, 'B2-2', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfka8v000s04l447j1svnq', 'cmtbfk9qq000004l4h6whnuou', 'BACK', 2, 3, 'B2-3', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfka8v000t04l48aj4kvna', 'cmtbfk9qq000004l4h6whnuou', 'BACK', 2, 4, 'B2-4', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfka8v000u04l42ms4axn9', 'cmtbfk9qq000004l4h6whnuou', 'BACK', 2, 5, 'B2-5', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfka8v000v04l4gmiwd01g', 'cmtbfk9qq000004l4h6whnuou', 'BACK', 3, 1, 'B3-1', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfka8v000w04l4rb4gv49e', 'cmtbfk9qq000004l4h6whnuou', 'BACK', 3, 2, 'B3-2', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfka8v000x04l4ni7x1d3y', 'cmtbfk9qq000004l4h6whnuou', 'BACK', 3, 3, 'B3-3', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfka8v000y04l4lm1yu47x', 'cmtbfk9qq000004l4h6whnuou', 'BACK', 3, 4, 'B3-4', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfka8v000z04l46ziyi6mj', 'cmtbfk9qq000004l4h6whnuou', 'BACK', 3, 5, 'B3-5', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfka8v001004l42vn571qd', 'cmtbfk9qq000004l4h6whnuou', 'BACK', 4, 1, 'B4-1', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfka8v001104l4gm6u21lt', 'cmtbfk9qq000004l4h6whnuou', 'BACK', 4, 2, 'B4-2', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfka8v001204l45t3cl5ws', 'cmtbfk9qq000004l4h6whnuou', 'BACK', 4, 3, 'B4-3', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfka8v001304l4866chx0p', 'cmtbfk9qq000004l4h6whnuou', 'BACK', 4, 4, 'B4-4', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfka8v001404l4idgaqllk', 'cmtbfk9qq000004l4h6whnuou', 'BACK', 4, 5, 'B4-5', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkcvc001604l4x50yx1bj', 'cmtbfkc8j001504l4sy0gyccx', 'FRONT', 1, 1, 'F1-1', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkcvc001704l4f7b3xqu8', 'cmtbfkc8j001504l4sy0gyccx', 'FRONT', 1, 2, 'F1-2', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkcvc001804l4ud1sa7eu', 'cmtbfkc8j001504l4sy0gyccx', 'FRONT', 1, 3, 'F1-3', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkcvc001904l4b6d828ma', 'cmtbfkc8j001504l4sy0gyccx', 'FRONT', 1, 4, 'F1-4', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkcvc001a04l4k35qayrx', 'cmtbfkc8j001504l4sy0gyccx', 'FRONT', 1, 5, 'F1-5', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkcvc001b04l4bj1br3sc', 'cmtbfkc8j001504l4sy0gyccx', 'FRONT', 2, 1, 'F2-1', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkcvc001c04l41si8uedc', 'cmtbfkc8j001504l4sy0gyccx', 'FRONT', 2, 2, 'F2-2', 0, 'OPENED', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkcvc001d04l4n0azl688', 'cmtbfkc8j001504l4sy0gyccx', 'FRONT', 2, 3, 'F2-3', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkcvc001e04l42umtwd7u', 'cmtbfkc8j001504l4sy0gyccx', 'FRONT', 2, 4, 'F2-4', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkcvc001f04l45lpjh8f4', 'cmtbfkc8j001504l4sy0gyccx', 'FRONT', 2, 5, 'F2-5', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkcvc001g04l41fj7ucqh', 'cmtbfkc8j001504l4sy0gyccx', 'FRONT', 3, 1, 'F3-1', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkcvc001h04l4fgqgcag8', 'cmtbfkc8j001504l4sy0gyccx', 'FRONT', 3, 2, 'F3-2', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkcvc001i04l4pedttar5', 'cmtbfkc8j001504l4sy0gyccx', 'FRONT', 3, 3, 'F3-3', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkcvc001j04l4u9fl21vd', 'cmtbfkc8j001504l4sy0gyccx', 'FRONT', 3, 4, 'F3-4', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkcvc001k04l41kmi179e', 'cmtbfkc8j001504l4sy0gyccx', 'FRONT', 3, 5, 'F3-5', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkcvc001l04l4eyjpqvh0', 'cmtbfkc8j001504l4sy0gyccx', 'FRONT', 4, 1, 'F4-1', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkcvc001m04l47375c47f', 'cmtbfkc8j001504l4sy0gyccx', 'FRONT', 4, 2, 'F4-2', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkcvc001n04l42z7xtdje', 'cmtbfkc8j001504l4sy0gyccx', 'FRONT', 4, 3, 'F4-3', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkcvc001o04l4ycu47ewr', 'cmtbfkc8j001504l4sy0gyccx', 'FRONT', 4, 4, 'F4-4', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkcvc001p04l4kflct05f', 'cmtbfkc8j001504l4sy0gyccx', 'FRONT', 4, 5, 'F4-5', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkcvc001q04l4ozwgw0jw', 'cmtbfkc8j001504l4sy0gyccx', 'BACK', 1, 1, 'B1-1', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkcvc001r04l4kl5at98f', 'cmtbfkc8j001504l4sy0gyccx', 'BACK', 1, 2, 'B1-2', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkcvc001s04l4gtqj2nu6', 'cmtbfkc8j001504l4sy0gyccx', 'BACK', 1, 3, 'B1-3', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkcvc001t04l4o6xxfwr9', 'cmtbfkc8j001504l4sy0gyccx', 'BACK', 1, 4, 'B1-4', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkcvc001u04l4em2mj23f', 'cmtbfkc8j001504l4sy0gyccx', 'BACK', 1, 5, 'B1-5', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkcvc001v04l4192blmu6', 'cmtbfkc8j001504l4sy0gyccx', 'BACK', 2, 1, 'B2-1', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkcvc001w04l4j133u1vb', 'cmtbfkc8j001504l4sy0gyccx', 'BACK', 2, 2, 'B2-2', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkcvc001x04l45ridj92b', 'cmtbfkc8j001504l4sy0gyccx', 'BACK', 2, 3, 'B2-3', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkcvc001y04l430f0j0ve', 'cmtbfkc8j001504l4sy0gyccx', 'BACK', 2, 4, 'B2-4', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkcvc001z04l4jwxrdmes', 'cmtbfkc8j001504l4sy0gyccx', 'BACK', 2, 5, 'B2-5', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkcvc002004l4pv490uat', 'cmtbfkc8j001504l4sy0gyccx', 'BACK', 3, 1, 'B3-1', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkcvc002104l4c2ksm405', 'cmtbfkc8j001504l4sy0gyccx', 'BACK', 3, 2, 'B3-2', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkcvc002204l40mo29642', 'cmtbfkc8j001504l4sy0gyccx', 'BACK', 3, 3, 'B3-3', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkcvc002304l46uhk5rdb', 'cmtbfkc8j001504l4sy0gyccx', 'BACK', 3, 4, 'B3-4', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkcvc002404l43zjpyt95', 'cmtbfkc8j001504l4sy0gyccx', 'BACK', 3, 5, 'B3-5', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkcvc002504l4bpu4prlr', 'cmtbfkc8j001504l4sy0gyccx', 'BACK', 4, 1, 'B4-1', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkcvc002604l4l2ue8ult', 'cmtbfkc8j001504l4sy0gyccx', 'BACK', 4, 2, 'B4-2', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkcvc002704l47p2gny1n', 'cmtbfkc8j001504l4sy0gyccx', 'BACK', 4, 3, 'B4-3', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkcvc002804l4pqqfpo3m', 'cmtbfkc8j001504l4sy0gyccx', 'BACK', 4, 4, 'B4-4', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkcvc002904l4232fhzoa', 'cmtbfkc8j001504l4sy0gyccx', 'BACK', 4, 5, 'B4-5', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkevl002b04l4n35pupt3', 'cmtbfke92002a04l4kh2p7dfw', 'FRONT', 1, 1, 'F1-1', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkevl002c04l436j5g4c9', 'cmtbfke92002a04l4kh2p7dfw', 'FRONT', 1, 2, 'F1-2', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkevl002d04l4novt5ztg', 'cmtbfke92002a04l4kh2p7dfw', 'FRONT', 1, 3, 'F1-3', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkevl002e04l4enc4zn0m', 'cmtbfke92002a04l4kh2p7dfw', 'FRONT', 1, 4, 'F1-4', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkevl002f04l4ojwhfbaz', 'cmtbfke92002a04l4kh2p7dfw', 'FRONT', 1, 5, 'F1-5', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkevl002g04l4rvt4ossj', 'cmtbfke92002a04l4kh2p7dfw', 'FRONT', 2, 1, 'F2-1', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkevl002h04l4ji6b84zf', 'cmtbfke92002a04l4kh2p7dfw', 'FRONT', 2, 2, 'F2-2', 0, 'OPENED', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkevl002i04l44nh3v576', 'cmtbfke92002a04l4kh2p7dfw', 'FRONT', 2, 3, 'F2-3', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkevl002j04l4q01lbdiy', 'cmtbfke92002a04l4kh2p7dfw', 'FRONT', 2, 4, 'F2-4', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkevl002k04l4souq2m1z', 'cmtbfke92002a04l4kh2p7dfw', 'FRONT', 2, 5, 'F2-5', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkevl002l04l4uqxz4dsv', 'cmtbfke92002a04l4kh2p7dfw', 'FRONT', 3, 1, 'F3-1', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkevl002m04l4d1tkgyk1', 'cmtbfke92002a04l4kh2p7dfw', 'FRONT', 3, 2, 'F3-2', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkevl002n04l4a6jkreqz', 'cmtbfke92002a04l4kh2p7dfw', 'FRONT', 3, 3, 'F3-3', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkevl002o04l49nhup0hw', 'cmtbfke92002a04l4kh2p7dfw', 'FRONT', 3, 4, 'F3-4', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkevl002p04l4lnf2da0h', 'cmtbfke92002a04l4kh2p7dfw', 'FRONT', 3, 5, 'F3-5', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkevl002q04l4akfgl9ug', 'cmtbfke92002a04l4kh2p7dfw', 'FRONT', 4, 1, 'F4-1', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkevl002r04l462lgpvo6', 'cmtbfke92002a04l4kh2p7dfw', 'FRONT', 4, 2, 'F4-2', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkevl002s04l4q4gc6qol', 'cmtbfke92002a04l4kh2p7dfw', 'FRONT', 4, 3, 'F4-3', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkevl002t04l4dxp38z00', 'cmtbfke92002a04l4kh2p7dfw', 'FRONT', 4, 4, 'F4-4', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkevl002u04l42w4ky7x2', 'cmtbfke92002a04l4kh2p7dfw', 'FRONT', 4, 5, 'F4-5', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkevl002v04l45odf10bt', 'cmtbfke92002a04l4kh2p7dfw', 'BACK', 1, 1, 'B1-1', 1, 'FRESH', 'cmtbg5gj9000304l46o6btrbz');
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkevl002w04l4aomrrpns', 'cmtbfke92002a04l4kh2p7dfw', 'BACK', 1, 2, 'B1-2', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkevl002x04l46rx5yp0r', 'cmtbfke92002a04l4kh2p7dfw', 'BACK', 1, 3, 'B1-3', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkevl002y04l4r00wops2', 'cmtbfke92002a04l4kh2p7dfw', 'BACK', 1, 4, 'B1-4', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkevl002z04l489g68tlt', 'cmtbfke92002a04l4kh2p7dfw', 'BACK', 1, 5, 'B1-5', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkevl003004l49ku6gjqp', 'cmtbfke92002a04l4kh2p7dfw', 'BACK', 2, 1, 'B2-1', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkevl003104l4vhsjgf2c', 'cmtbfke92002a04l4kh2p7dfw', 'BACK', 2, 2, 'B2-2', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkevl003204l4nt5vdjjc', 'cmtbfke92002a04l4kh2p7dfw', 'BACK', 2, 3, 'B2-3', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkevl003304l432kslr1i', 'cmtbfke92002a04l4kh2p7dfw', 'BACK', 2, 4, 'B2-4', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkevl003404l4ppq8j3bz', 'cmtbfke92002a04l4kh2p7dfw', 'BACK', 2, 5, 'B2-5', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkevl003504l40z1uzqkh', 'cmtbfke92002a04l4kh2p7dfw', 'BACK', 3, 1, 'B3-1', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkevl003604l4podgvoal', 'cmtbfke92002a04l4kh2p7dfw', 'BACK', 3, 2, 'B3-2', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkevl003704l43v7frc8n', 'cmtbfke92002a04l4kh2p7dfw', 'BACK', 3, 3, 'B3-3', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkevl003804l47tbuy85f', 'cmtbfke92002a04l4kh2p7dfw', 'BACK', 3, 4, 'B3-4', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkevl003904l4artzf0q7', 'cmtbfke92002a04l4kh2p7dfw', 'BACK', 3, 5, 'B3-5', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkevl003a04l48t0bvoyk', 'cmtbfke92002a04l4kh2p7dfw', 'BACK', 4, 1, 'B4-1', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkevl003b04l4zc85iawy', 'cmtbfke92002a04l4kh2p7dfw', 'BACK', 4, 2, 'B4-2', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkevl003c04l4c09o5jbc', 'cmtbfke92002a04l4kh2p7dfw', 'BACK', 4, 3, 'B4-3', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkevl003d04l4n17y5ept', 'cmtbfke92002a04l4kh2p7dfw', 'BACK', 4, 4, 'B4-4', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkevl003e04l4gokztbev', 'cmtbfke92002a04l4kh2p7dfw', 'BACK', 4, 5, 'B4-5', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkgv6003g04l4bto2y5a4', 'cmtbfkg8t003f04l4vpwbjofr', 'FRONT', 1, 1, 'F1-1', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkgv6003h04l4qgjklpwe', 'cmtbfkg8t003f04l4vpwbjofr', 'FRONT', 1, 2, 'F1-2', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkgv6003i04l4re5ozfh1', 'cmtbfkg8t003f04l4vpwbjofr', 'FRONT', 1, 3, 'F1-3', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkgv6003j04l4s2cv6axj', 'cmtbfkg8t003f04l4vpwbjofr', 'FRONT', 1, 4, 'F1-4', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkgv6003k04l48mml0gxw', 'cmtbfkg8t003f04l4vpwbjofr', 'FRONT', 1, 5, 'F1-5', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkgv6003l04l4h644a77o', 'cmtbfkg8t003f04l4vpwbjofr', 'FRONT', 2, 1, 'F2-1', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkgv6003m04l4m6q1xz4h', 'cmtbfkg8t003f04l4vpwbjofr', 'FRONT', 2, 2, 'F2-2', 0, 'OPENED', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkgv6003n04l4cjqp9xut', 'cmtbfkg8t003f04l4vpwbjofr', 'FRONT', 2, 3, 'F2-3', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkgv6003o04l4jh4szrex', 'cmtbfkg8t003f04l4vpwbjofr', 'FRONT', 2, 4, 'F2-4', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkgv6003p04l4l1verljd', 'cmtbfkg8t003f04l4vpwbjofr', 'FRONT', 2, 5, 'F2-5', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkgv6003q04l47r39p586', 'cmtbfkg8t003f04l4vpwbjofr', 'FRONT', 3, 1, 'F3-1', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkgv6003r04l4gtl777b7', 'cmtbfkg8t003f04l4vpwbjofr', 'FRONT', 3, 2, 'F3-2', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkgv6003s04l477n48567', 'cmtbfkg8t003f04l4vpwbjofr', 'FRONT', 3, 3, 'F3-3', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkgv6003t04l4nqi5seua', 'cmtbfkg8t003f04l4vpwbjofr', 'FRONT', 3, 4, 'F3-4', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkgv6003u04l41u8hbrfi', 'cmtbfkg8t003f04l4vpwbjofr', 'FRONT', 3, 5, 'F3-5', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkgv6003v04l4irne2o33', 'cmtbfkg8t003f04l4vpwbjofr', 'FRONT', 4, 1, 'F4-1', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkgv6003w04l4r01de3ni', 'cmtbfkg8t003f04l4vpwbjofr', 'FRONT', 4, 2, 'F4-2', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkgv6003x04l4364n76un', 'cmtbfkg8t003f04l4vpwbjofr', 'FRONT', 4, 3, 'F4-3', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkgv6003y04l4xlgg3kpy', 'cmtbfkg8t003f04l4vpwbjofr', 'FRONT', 4, 4, 'F4-4', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkgv6003z04l4f3mf9heh', 'cmtbfkg8t003f04l4vpwbjofr', 'FRONT', 4, 5, 'F4-5', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkgv6004004l4cups8xgc', 'cmtbfkg8t003f04l4vpwbjofr', 'BACK', 1, 1, 'B1-1', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkgv6004104l41dvh43c1', 'cmtbfkg8t003f04l4vpwbjofr', 'BACK', 1, 2, 'B1-2', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkgv6004204l49s2sdpfu', 'cmtbfkg8t003f04l4vpwbjofr', 'BACK', 1, 3, 'B1-3', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkgv6004304l4o76dn0p4', 'cmtbfkg8t003f04l4vpwbjofr', 'BACK', 1, 4, 'B1-4', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkgv6004404l4wy180eti', 'cmtbfkg8t003f04l4vpwbjofr', 'BACK', 1, 5, 'B1-5', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkgv6004504l4ccfhw2kk', 'cmtbfkg8t003f04l4vpwbjofr', 'BACK', 2, 1, 'B2-1', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkgv6004604l4kiur9qv2', 'cmtbfkg8t003f04l4vpwbjofr', 'BACK', 2, 2, 'B2-2', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkgv6004704l4wcwun0v1', 'cmtbfkg8t003f04l4vpwbjofr', 'BACK', 2, 3, 'B2-3', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkgv6004804l4waik3tt0', 'cmtbfkg8t003f04l4vpwbjofr', 'BACK', 2, 4, 'B2-4', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkgv6004904l4rq7vz43y', 'cmtbfkg8t003f04l4vpwbjofr', 'BACK', 2, 5, 'B2-5', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkgv6004a04l4mk8pra3r', 'cmtbfkg8t003f04l4vpwbjofr', 'BACK', 3, 1, 'B3-1', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkgv6004b04l4fu6kk8oc', 'cmtbfkg8t003f04l4vpwbjofr', 'BACK', 3, 2, 'B3-2', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkgv6004c04l4maqnudaa', 'cmtbfkg8t003f04l4vpwbjofr', 'BACK', 3, 3, 'B3-3', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkgv6004d04l4cg7xqlyy', 'cmtbfkg8t003f04l4vpwbjofr', 'BACK', 3, 4, 'B3-4', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkgv6004e04l41j4nrnwi', 'cmtbfkg8t003f04l4vpwbjofr', 'BACK', 3, 5, 'B3-5', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkgv6004f04l49p6ofux7', 'cmtbfkg8t003f04l4vpwbjofr', 'BACK', 4, 1, 'B4-1', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkgv6004g04l4ezlpmrn1', 'cmtbfkg8t003f04l4vpwbjofr', 'BACK', 4, 2, 'B4-2', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkgv6004h04l4a5pf0gx1', 'cmtbfkg8t003f04l4vpwbjofr', 'BACK', 4, 3, 'B4-3', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkgv6004i04l4sdkz2fye', 'cmtbfkg8t003f04l4vpwbjofr', 'BACK', 4, 4, 'B4-4', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkgv6004j04l4ze66z3j3', 'cmtbfkg8t003f04l4vpwbjofr', 'BACK', 4, 5, 'B4-5', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkiv4004l04l4by0x9ua7', 'cmtbfki8g004k04l4av89j5db', 'FRONT', 1, 1, 'F1-1', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkiv4004m04l405palmay', 'cmtbfki8g004k04l4av89j5db', 'FRONT', 1, 2, 'F1-2', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkiv4004n04l49x2k8wm2', 'cmtbfki8g004k04l4av89j5db', 'FRONT', 1, 3, 'F1-3', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkiv4004o04l403tcmikk', 'cmtbfki8g004k04l4av89j5db', 'FRONT', 1, 4, 'F1-4', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkiv4004p04l4vx5uxcyg', 'cmtbfki8g004k04l4av89j5db', 'FRONT', 1, 5, 'F1-5', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkiv4004q04l4sleeh3fs', 'cmtbfki8g004k04l4av89j5db', 'FRONT', 2, 1, 'F2-1', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkiv4004r04l4dtnddr2m', 'cmtbfki8g004k04l4av89j5db', 'FRONT', 2, 2, 'F2-2', 0, 'OPENED', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkiv4004s04l4tn7wlglg', 'cmtbfki8g004k04l4av89j5db', 'FRONT', 2, 3, 'F2-3', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkiv4004t04l44w6vn8sa', 'cmtbfki8g004k04l4av89j5db', 'FRONT', 2, 4, 'F2-4', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkiv4004u04l44jm4f0bx', 'cmtbfki8g004k04l4av89j5db', 'FRONT', 2, 5, 'F2-5', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkiv4004v04l448t6tvbh', 'cmtbfki8g004k04l4av89j5db', 'FRONT', 3, 1, 'F3-1', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkiv4004w04l4rct48ijh', 'cmtbfki8g004k04l4av89j5db', 'FRONT', 3, 2, 'F3-2', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkiv4004x04l4s5e98z19', 'cmtbfki8g004k04l4av89j5db', 'FRONT', 3, 3, 'F3-3', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkiv4004y04l47puvj19v', 'cmtbfki8g004k04l4av89j5db', 'FRONT', 3, 4, 'F3-4', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkiv4004z04l4m2gfprh2', 'cmtbfki8g004k04l4av89j5db', 'FRONT', 3, 5, 'F3-5', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkiv5005004l43l3yxmdr', 'cmtbfki8g004k04l4av89j5db', 'FRONT', 4, 1, 'F4-1', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkiv5005104l4tkoquwn2', 'cmtbfki8g004k04l4av89j5db', 'FRONT', 4, 2, 'F4-2', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkiv5005204l4t8evgph5', 'cmtbfki8g004k04l4av89j5db', 'FRONT', 4, 3, 'F4-3', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkiv5005304l4lpt6muey', 'cmtbfki8g004k04l4av89j5db', 'FRONT', 4, 4, 'F4-4', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkiv5005404l4zd9tcxyn', 'cmtbfki8g004k04l4av89j5db', 'FRONT', 4, 5, 'F4-5', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkiv5005504l40u4aid54', 'cmtbfki8g004k04l4av89j5db', 'BACK', 1, 1, 'B1-1', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkiv5005604l4b0eemcuo', 'cmtbfki8g004k04l4av89j5db', 'BACK', 1, 2, 'B1-2', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkiv5005704l4r9zft7hr', 'cmtbfki8g004k04l4av89j5db', 'BACK', 1, 3, 'B1-3', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkiv5005804l4z14wkhy7', 'cmtbfki8g004k04l4av89j5db', 'BACK', 1, 4, 'B1-4', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkiv5005904l4870z1to9', 'cmtbfki8g004k04l4av89j5db', 'BACK', 1, 5, 'B1-5', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkiv5005a04l4pfmgwcm2', 'cmtbfki8g004k04l4av89j5db', 'BACK', 2, 1, 'B2-1', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkiv5005b04l40e47thxa', 'cmtbfki8g004k04l4av89j5db', 'BACK', 2, 2, 'B2-2', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkiv5005c04l406gen9r0', 'cmtbfki8g004k04l4av89j5db', 'BACK', 2, 3, 'B2-3', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkiv5005d04l4qe62ptsm', 'cmtbfki8g004k04l4av89j5db', 'BACK', 2, 4, 'B2-4', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkiv5005e04l4i02cib3m', 'cmtbfki8g004k04l4av89j5db', 'BACK', 2, 5, 'B2-5', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkiv5005f04l4vqrtvcry', 'cmtbfki8g004k04l4av89j5db', 'BACK', 3, 1, 'B3-1', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkiv5005g04l4vngz5rdy', 'cmtbfki8g004k04l4av89j5db', 'BACK', 3, 2, 'B3-2', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkiv5005h04l41qqecs3i', 'cmtbfki8g004k04l4av89j5db', 'BACK', 3, 3, 'B3-3', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkiv5005i04l4dbon2qc8', 'cmtbfki8g004k04l4av89j5db', 'BACK', 3, 4, 'B3-4', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkiv5005j04l4qtaiyi5c', 'cmtbfki8g004k04l4av89j5db', 'BACK', 3, 5, 'B3-5', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkiv5005k04l4h41x25un', 'cmtbfki8g004k04l4av89j5db', 'BACK', 4, 1, 'B4-1', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkiv5005l04l4f3fkb0kl', 'cmtbfki8g004k04l4av89j5db', 'BACK', 4, 2, 'B4-2', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkiv5005m04l4vin6cbre', 'cmtbfki8g004k04l4av89j5db', 'BACK', 4, 3, 'B4-3', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkiv5005n04l4m7wui2ab', 'cmtbfki8g004k04l4av89j5db', 'BACK', 4, 4, 'B4-4', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkiv5005o04l4d3fge350', 'cmtbfki8g004k04l4av89j5db', 'BACK', 4, 5, 'B4-5', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkkuy005q04l4p2zk7ut6', 'cmtbfkk8f005p04l4gm1qzzis', 'FRONT', 1, 1, 'F1-1', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkkuy005r04l4lizoqy7i', 'cmtbfkk8f005p04l4gm1qzzis', 'FRONT', 1, 2, 'F1-2', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkkuy005s04l46zbnkvff', 'cmtbfkk8f005p04l4gm1qzzis', 'FRONT', 1, 3, 'F1-3', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkkuy005t04l4e2vxczv7', 'cmtbfkk8f005p04l4gm1qzzis', 'FRONT', 1, 4, 'F1-4', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkkuy005u04l48ytlmczs', 'cmtbfkk8f005p04l4gm1qzzis', 'FRONT', 1, 5, 'F1-5', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkkuy005v04l46x83g7rd', 'cmtbfkk8f005p04l4gm1qzzis', 'FRONT', 2, 1, 'F2-1', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkkuy005w04l4lfla5xnv', 'cmtbfkk8f005p04l4gm1qzzis', 'FRONT', 2, 2, 'F2-2', 0, 'OPENED', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkkuy005x04l4h4ywefs2', 'cmtbfkk8f005p04l4gm1qzzis', 'FRONT', 2, 3, 'F2-3', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkkuy005y04l4kwmq1dyn', 'cmtbfkk8f005p04l4gm1qzzis', 'FRONT', 2, 4, 'F2-4', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkkuy005z04l48v5fsikr', 'cmtbfkk8f005p04l4gm1qzzis', 'FRONT', 2, 5, 'F2-5', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkkuy006004l48g0y2t9k', 'cmtbfkk8f005p04l4gm1qzzis', 'FRONT', 3, 1, 'F3-1', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkkuy006104l4xz0sixye', 'cmtbfkk8f005p04l4gm1qzzis', 'FRONT', 3, 2, 'F3-2', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkkuy006204l4haf87ggy', 'cmtbfkk8f005p04l4gm1qzzis', 'FRONT', 3, 3, 'F3-3', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkkuy006304l4pxd40pqp', 'cmtbfkk8f005p04l4gm1qzzis', 'FRONT', 3, 4, 'F3-4', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkkuy006404l4c09eaoco', 'cmtbfkk8f005p04l4gm1qzzis', 'FRONT', 3, 5, 'F3-5', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkkuy006504l4s5ild2zh', 'cmtbfkk8f005p04l4gm1qzzis', 'FRONT', 4, 1, 'F4-1', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkkuy006604l4v7o9vfyp', 'cmtbfkk8f005p04l4gm1qzzis', 'FRONT', 4, 2, 'F4-2', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkkuy006704l41xneo1mm', 'cmtbfkk8f005p04l4gm1qzzis', 'FRONT', 4, 3, 'F4-3', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkkuy006804l49isv5nnn', 'cmtbfkk8f005p04l4gm1qzzis', 'FRONT', 4, 4, 'F4-4', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkkuy006904l4wucqwj64', 'cmtbfkk8f005p04l4gm1qzzis', 'FRONT', 4, 5, 'F4-5', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkkuy006a04l4unxkeu75', 'cmtbfkk8f005p04l4gm1qzzis', 'BACK', 1, 1, 'B1-1', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkkuy006b04l4mlhap771', 'cmtbfkk8f005p04l4gm1qzzis', 'BACK', 1, 2, 'B1-2', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkkuy006c04l444b8v3nc', 'cmtbfkk8f005p04l4gm1qzzis', 'BACK', 1, 3, 'B1-3', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkkuy006d04l4amop3lgm', 'cmtbfkk8f005p04l4gm1qzzis', 'BACK', 1, 4, 'B1-4', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkkuy006e04l4si0vx261', 'cmtbfkk8f005p04l4gm1qzzis', 'BACK', 1, 5, 'B1-5', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkkuy006f04l4thouy2rc', 'cmtbfkk8f005p04l4gm1qzzis', 'BACK', 2, 1, 'B2-1', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkkuy006g04l4wal1uc87', 'cmtbfkk8f005p04l4gm1qzzis', 'BACK', 2, 2, 'B2-2', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkkuy006h04l42uye38vp', 'cmtbfkk8f005p04l4gm1qzzis', 'BACK', 2, 3, 'B2-3', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkkuy006i04l4mc7jhfkz', 'cmtbfkk8f005p04l4gm1qzzis', 'BACK', 2, 4, 'B2-4', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkkuy006j04l4spzo1urp', 'cmtbfkk8f005p04l4gm1qzzis', 'BACK', 2, 5, 'B2-5', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkkuy006k04l45wwjfuem', 'cmtbfkk8f005p04l4gm1qzzis', 'BACK', 3, 1, 'B3-1', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkkuy006l04l4ah7c468h', 'cmtbfkk8f005p04l4gm1qzzis', 'BACK', 3, 2, 'B3-2', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkkuy006m04l450iu5r66', 'cmtbfkk8f005p04l4gm1qzzis', 'BACK', 3, 3, 'B3-3', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkkuy006n04l4i0f917ke', 'cmtbfkk8f005p04l4gm1qzzis', 'BACK', 3, 4, 'B3-4', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkkuy006o04l4ti6td5io', 'cmtbfkk8f005p04l4gm1qzzis', 'BACK', 3, 5, 'B3-5', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkkuy006p04l4xun19stw', 'cmtbfkk8f005p04l4gm1qzzis', 'BACK', 4, 1, 'B4-1', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkkuy006q04l4a30yupi6', 'cmtbfkk8f005p04l4gm1qzzis', 'BACK', 4, 2, 'B4-2', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkkuy006r04l4dzhujur9', 'cmtbfkk8f005p04l4gm1qzzis', 'BACK', 4, 3, 'B4-3', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkkuy006s04l43xhxoi9t', 'cmtbfkk8f005p04l4gm1qzzis', 'BACK', 4, 4, 'B4-4', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkkuy006t04l4fs2kqo60', 'cmtbfkk8f005p04l4gm1qzzis', 'BACK', 4, 5, 'B4-5', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkmun006v04l4x44wo9dq', 'cmtbfkm85006u04l4xjamndl2', 'FRONT', 1, 1, 'F1-1', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkmun006w04l4js9zrsom', 'cmtbfkm85006u04l4xjamndl2', 'FRONT', 1, 2, 'F1-2', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkmun006x04l41pblduc5', 'cmtbfkm85006u04l4xjamndl2', 'FRONT', 1, 3, 'F1-3', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkmun006y04l44z8gyav3', 'cmtbfkm85006u04l4xjamndl2', 'FRONT', 1, 4, 'F1-4', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkmun006z04l4qrnq03bg', 'cmtbfkm85006u04l4xjamndl2', 'FRONT', 1, 5, 'F1-5', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkmun007004l49fv74fi0', 'cmtbfkm85006u04l4xjamndl2', 'FRONT', 2, 1, 'F2-1', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkmun007104l4occu6mp2', 'cmtbfkm85006u04l4xjamndl2', 'FRONT', 2, 2, 'F2-2', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkmun007204l41tx7l1hd', 'cmtbfkm85006u04l4xjamndl2', 'FRONT', 2, 3, 'F2-3', 1, 'FRESH', 'cmt8g0sst000004jx7ga0nyri');
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkmun007304l4y262puys', 'cmtbfkm85006u04l4xjamndl2', 'FRONT', 2, 4, 'F2-4', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkmun007404l4i8x98ajv', 'cmtbfkm85006u04l4xjamndl2', 'FRONT', 2, 5, 'F2-5', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkmun007504l497qqdswe', 'cmtbfkm85006u04l4xjamndl2', 'FRONT', 3, 1, 'F3-1', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkmun007604l40uqqgxns', 'cmtbfkm85006u04l4xjamndl2', 'FRONT', 3, 2, 'F3-2', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkmun007704l4zk6yznm5', 'cmtbfkm85006u04l4xjamndl2', 'FRONT', 3, 3, 'F3-3', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkmun007804l4h8og6hxa', 'cmtbfkm85006u04l4xjamndl2', 'FRONT', 3, 4, 'F3-4', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkmun007904l417kb6cvm', 'cmtbfkm85006u04l4xjamndl2', 'FRONT', 3, 5, 'F3-5', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkmun007a04l4zf559zta', 'cmtbfkm85006u04l4xjamndl2', 'FRONT', 4, 1, 'F4-1', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkmun007b04l4nlf1j05z', 'cmtbfkm85006u04l4xjamndl2', 'FRONT', 4, 2, 'F4-2', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkmun007c04l4e5quc5k4', 'cmtbfkm85006u04l4xjamndl2', 'FRONT', 4, 3, 'F4-3', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkmun007d04l42um0uplo', 'cmtbfkm85006u04l4xjamndl2', 'FRONT', 4, 4, 'F4-4', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkmun007e04l4o3nu0sb0', 'cmtbfkm85006u04l4xjamndl2', 'FRONT', 4, 5, 'F4-5', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkmuo007f04l4fm9i3k8h', 'cmtbfkm85006u04l4xjamndl2', 'BACK', 1, 1, 'B1-1', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkmuo007g04l4dboevr4t', 'cmtbfkm85006u04l4xjamndl2', 'BACK', 1, 2, 'B1-2', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkmuo007h04l48g2bsq9n', 'cmtbfkm85006u04l4xjamndl2', 'BACK', 1, 3, 'B1-3', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkmuo007i04l46dhqldm0', 'cmtbfkm85006u04l4xjamndl2', 'BACK', 1, 4, 'B1-4', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkmuo007j04l4hdwz4epm', 'cmtbfkm85006u04l4xjamndl2', 'BACK', 1, 5, 'B1-5', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkmuo007k04l4i7l3yqcm', 'cmtbfkm85006u04l4xjamndl2', 'BACK', 2, 1, 'B2-1', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkmuo007l04l4o1z4r1nf', 'cmtbfkm85006u04l4xjamndl2', 'BACK', 2, 2, 'B2-2', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkmuo007m04l4avhxgioq', 'cmtbfkm85006u04l4xjamndl2', 'BACK', 2, 3, 'B2-3', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkmuo007n04l4qod3zu91', 'cmtbfkm85006u04l4xjamndl2', 'BACK', 2, 4, 'B2-4', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkmuo007o04l484rfxtqq', 'cmtbfkm85006u04l4xjamndl2', 'BACK', 2, 5, 'B2-5', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkmuo007p04l43qlzhj88', 'cmtbfkm85006u04l4xjamndl2', 'BACK', 3, 1, 'B3-1', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkmuo007q04l4yzb4xv0c', 'cmtbfkm85006u04l4xjamndl2', 'BACK', 3, 2, 'B3-2', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkmuo007r04l4egjbsv15', 'cmtbfkm85006u04l4xjamndl2', 'BACK', 3, 3, 'B3-3', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkmuo007s04l45zet6mt9', 'cmtbfkm85006u04l4xjamndl2', 'BACK', 3, 4, 'B3-4', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkmuo007t04l4z3onu0gp', 'cmtbfkm85006u04l4xjamndl2', 'BACK', 3, 5, 'B3-5', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkmuo007u04l45snyjdu6', 'cmtbfkm85006u04l4xjamndl2', 'BACK', 4, 1, 'B4-1', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkmuo007v04l4aunntzz7', 'cmtbfkm85006u04l4xjamndl2', 'BACK', 4, 2, 'B4-2', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkmuo007w04l4l68ozpky', 'cmtbfkm85006u04l4xjamndl2', 'BACK', 4, 3, 'B4-3', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkmuo007x04l4ljtuftjo', 'cmtbfkm85006u04l4xjamndl2', 'BACK', 4, 4, 'B4-4', 0, 'FRESH', 'cmt8clr9x00052svn4x8czqka');
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbfkmuo007y04l488anf6mq', 'cmtbfkm85006u04l4xjamndl2', 'BACK', 4, 5, 'B4-5', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbgxo22000104ifi5o9fa18', 'cmtbgxnl4000004ifwgrtauvm', 'FRONT', 1, 1, 'F1-1', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtbgxo22000204ifp7td43xv', 'cmtbgxnl4000004ifwgrtauvm', 'BACK', 1, 1, 'B1-1', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtcghf8q000104jlox0d2he3', 'cmtcgherb000004jlwcf5e2to', 'FRONT', 1, 1, 'F1-1', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtcghf8q000204jlkbj3y4du', 'cmtcgherb000004jlwcf5e2to', 'FRONT', 1, 2, 'F1-2', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtcghf8q000304jlrpe4rl3y', 'cmtcgherb000004jlwcf5e2to', 'FRONT', 1, 3, 'F1-3', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtcghf8q000404jlvkwzia1j', 'cmtcgherb000004jlwcf5e2to', 'FRONT', 1, 4, 'F1-4', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtcghf8q000504jlvo6q6p4n', 'cmtcgherb000004jlwcf5e2to', 'FRONT', 1, 5, 'F1-5', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtcghf8q000604jl1qv3brsq', 'cmtcgherb000004jlwcf5e2to', 'FRONT', 2, 1, 'F2-1', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtcghf8q000704jl0q4w2h1a', 'cmtcgherb000004jlwcf5e2to', 'FRONT', 2, 2, 'F2-2', 0, 'OPENED', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtcghf8q000804jlmf4ty531', 'cmtcgherb000004jlwcf5e2to', 'FRONT', 2, 3, 'F2-3', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtcghf8q000904jl8fpl178y', 'cmtcgherb000004jlwcf5e2to', 'FRONT', 2, 4, 'F2-4', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtcghf8q000a04jlqbjyddxu', 'cmtcgherb000004jlwcf5e2to', 'FRONT', 2, 5, 'F2-5', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtcghf8q000b04jl72x5w1ew', 'cmtcgherb000004jlwcf5e2to', 'FRONT', 3, 1, 'F3-1', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtcghf8q000c04jlicjzd8lk', 'cmtcgherb000004jlwcf5e2to', 'FRONT', 3, 2, 'F3-2', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtcghf8q000d04jl7ixmwp68', 'cmtcgherb000004jlwcf5e2to', 'FRONT', 3, 3, 'F3-3', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtcghf8q000e04jl3jxhr8u9', 'cmtcgherb000004jlwcf5e2to', 'FRONT', 3, 4, 'F3-4', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtcghf8q000f04jlqk5usfjl', 'cmtcgherb000004jlwcf5e2to', 'FRONT', 3, 5, 'F3-5', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtcghf8q000g04jl715bd3vk', 'cmtcgherb000004jlwcf5e2to', 'FRONT', 4, 1, 'F4-1', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtcghf8q000h04jljer1j88l', 'cmtcgherb000004jlwcf5e2to', 'FRONT', 4, 2, 'F4-2', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtcghf8q000i04jloslt0boo', 'cmtcgherb000004jlwcf5e2to', 'FRONT', 4, 3, 'F4-3', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtcghf8q000j04jlk4pv9j0a', 'cmtcgherb000004jlwcf5e2to', 'FRONT', 4, 4, 'F4-4', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtcghf8q000k04jl2a79uvco', 'cmtcgherb000004jlwcf5e2to', 'FRONT', 4, 5, 'F4-5', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtcghf8q000l04jllc8wgt19', 'cmtcgherb000004jlwcf5e2to', 'BACK', 1, 1, 'B1-1', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtcghf8q000m04jl9ow5zx44', 'cmtcgherb000004jlwcf5e2to', 'BACK', 1, 2, 'B1-2', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtcghf8q000n04jlkab8hmir', 'cmtcgherb000004jlwcf5e2to', 'BACK', 1, 3, 'B1-3', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtcghf8q000o04jlfaghlvnh', 'cmtcgherb000004jlwcf5e2to', 'BACK', 1, 4, 'B1-4', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtcghf8q000p04jlxmtra2qh', 'cmtcgherb000004jlwcf5e2to', 'BACK', 1, 5, 'B1-5', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtcghf8q000q04jlwxz31og7', 'cmtcgherb000004jlwcf5e2to', 'BACK', 2, 1, 'B2-1', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtcghf8q000r04jlsjfrv395', 'cmtcgherb000004jlwcf5e2to', 'BACK', 2, 2, 'B2-2', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtcghf8r000s04jliyaqymp6', 'cmtcgherb000004jlwcf5e2to', 'BACK', 2, 3, 'B2-3', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtcghf8r000t04jly464bhm8', 'cmtcgherb000004jlwcf5e2to', 'BACK', 2, 4, 'B2-4', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtcghf8r000u04jlqd5kdc1v', 'cmtcgherb000004jlwcf5e2to', 'BACK', 2, 5, 'B2-5', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtcghf8r000v04jl6ygchf7b', 'cmtcgherb000004jlwcf5e2to', 'BACK', 3, 1, 'B3-1', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtcghf8r000w04jlbbg8pa76', 'cmtcgherb000004jlwcf5e2to', 'BACK', 3, 2, 'B3-2', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtcghf8r000x04jln9y3sldc', 'cmtcgherb000004jlwcf5e2to', 'BACK', 3, 3, 'B3-3', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtcghf8r000y04jlwvdmypa9', 'cmtcgherb000004jlwcf5e2to', 'BACK', 3, 4, 'B3-4', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtcghf8r000z04jlm25apzqs', 'cmtcgherb000004jlwcf5e2to', 'BACK', 3, 5, 'B3-5', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtcghf8r001004jla9g5mdrd', 'cmtcgherb000004jlwcf5e2to', 'BACK', 4, 1, 'B4-1', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtcghf8r001104jl43534mgb', 'cmtcgherb000004jlwcf5e2to', 'BACK', 4, 2, 'B4-2', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtcghf8r001204jleaq8h1ep', 'cmtcgherb000004jlwcf5e2to', 'BACK', 4, 3, 'B4-3', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtcghf8r001304jla3bxzmxq', 'cmtcgherb000004jlwcf5e2to', 'BACK', 4, 4, 'B4-4', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtcghf8r001404jlfociulq1', 'cmtcgherb000004jlwcf5e2to', 'BACK', 4, 5, 'B4-5', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtcghig2001604jlxpflmi1d', 'cmtcghhu5001504jlth6aw31d', 'FRONT', 1, 1, 'F1-1', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtcghig3001704jl0bv14y0d', 'cmtcghhu5001504jlth6aw31d', 'FRONT', 1, 2, 'F1-2', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtcghig3001804jlnqxsnunr', 'cmtcghhu5001504jlth6aw31d', 'FRONT', 1, 3, 'F1-3', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtcghig3001904jl23afd0cy', 'cmtcghhu5001504jlth6aw31d', 'FRONT', 1, 4, 'F1-4', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtcghig3001a04jlad9x4suu', 'cmtcghhu5001504jlth6aw31d', 'FRONT', 1, 5, 'F1-5', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtcghig3001b04jli7q2hxd6', 'cmtcghhu5001504jlth6aw31d', 'FRONT', 2, 1, 'F2-1', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtcghig3001c04jl39lg43b2', 'cmtcghhu5001504jlth6aw31d', 'FRONT', 2, 2, 'F2-2', 0, 'OPENED', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtcghig3001d04jlchqtkjms', 'cmtcghhu5001504jlth6aw31d', 'FRONT', 2, 3, 'F2-3', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtcghig3001e04jl7lmgvrsi', 'cmtcghhu5001504jlth6aw31d', 'FRONT', 2, 4, 'F2-4', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtcghig3001f04jlsmsmw8rq', 'cmtcghhu5001504jlth6aw31d', 'FRONT', 2, 5, 'F2-5', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtcghig3001g04jlfa7g2xnd', 'cmtcghhu5001504jlth6aw31d', 'FRONT', 3, 1, 'F3-1', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtcghig3001h04jls9w51y4x', 'cmtcghhu5001504jlth6aw31d', 'FRONT', 3, 2, 'F3-2', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtcghig3001i04jldbi9uj9v', 'cmtcghhu5001504jlth6aw31d', 'FRONT', 3, 3, 'F3-3', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtcghig3001j04jlhc0jgh5v', 'cmtcghhu5001504jlth6aw31d', 'FRONT', 3, 4, 'F3-4', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtcghig3001k04jl50klgnut', 'cmtcghhu5001504jlth6aw31d', 'FRONT', 3, 5, 'F3-5', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtcghig3001l04jlfv01e7yi', 'cmtcghhu5001504jlth6aw31d', 'FRONT', 4, 1, 'F4-1', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtcghig3001m04jlhb326h4h', 'cmtcghhu5001504jlth6aw31d', 'FRONT', 4, 2, 'F4-2', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtcghig3001n04jl0lcoako6', 'cmtcghhu5001504jlth6aw31d', 'FRONT', 4, 3, 'F4-3', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtcghig3001o04jlarl4cjzc', 'cmtcghhu5001504jlth6aw31d', 'FRONT', 4, 4, 'F4-4', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtcghig3001p04jl5e330tzr', 'cmtcghhu5001504jlth6aw31d', 'FRONT', 4, 5, 'F4-5', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtcghig3001q04jlqsvsrngk', 'cmtcghhu5001504jlth6aw31d', 'BACK', 1, 1, 'B1-1', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtcghig3001r04jl7pl7p4a9', 'cmtcghhu5001504jlth6aw31d', 'BACK', 1, 2, 'B1-2', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtcghig3001s04jls6k7q6m4', 'cmtcghhu5001504jlth6aw31d', 'BACK', 1, 3, 'B1-3', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtcghig3001t04jlij5e930q', 'cmtcghhu5001504jlth6aw31d', 'BACK', 1, 4, 'B1-4', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtcghig3001u04jly0ychwxa', 'cmtcghhu5001504jlth6aw31d', 'BACK', 1, 5, 'B1-5', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtcghig3001v04jldxs7ygfk', 'cmtcghhu5001504jlth6aw31d', 'BACK', 2, 1, 'B2-1', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtcghig3001w04jln4ux6otu', 'cmtcghhu5001504jlth6aw31d', 'BACK', 2, 2, 'B2-2', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtcghig3001x04jlbbytjtrq', 'cmtcghhu5001504jlth6aw31d', 'BACK', 2, 3, 'B2-3', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtcghig3001y04jl1abokcph', 'cmtcghhu5001504jlth6aw31d', 'BACK', 2, 4, 'B2-4', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtcghig3001z04jlwcnnmgbi', 'cmtcghhu5001504jlth6aw31d', 'BACK', 2, 5, 'B2-5', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtcghig3002004jlq26cgwpd', 'cmtcghhu5001504jlth6aw31d', 'BACK', 3, 1, 'B3-1', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtcghig3002104jlxkalkcvt', 'cmtcghhu5001504jlth6aw31d', 'BACK', 3, 2, 'B3-2', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtcghig3002204jluxuwel94', 'cmtcghhu5001504jlth6aw31d', 'BACK', 3, 3, 'B3-3', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtcghig3002304jl7i1oozmy', 'cmtcghhu5001504jlth6aw31d', 'BACK', 3, 4, 'B3-4', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtcghig3002404jlzv5p4ntp', 'cmtcghhu5001504jlth6aw31d', 'BACK', 3, 5, 'B3-5', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtcghig3002504jlxa7oin5v', 'cmtcghhu5001504jlth6aw31d', 'BACK', 4, 1, 'B4-1', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtcghig3002604jlmtf8qm0n', 'cmtcghhu5001504jlth6aw31d', 'BACK', 4, 2, 'B4-2', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtcghig3002704jlcvn4grtf', 'cmtcghhu5001504jlth6aw31d', 'BACK', 4, 3, 'B4-3', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtcghig3002804jlp4oayrlv', 'cmtcghhu5001504jlth6aw31d', 'BACK', 4, 4, 'B4-4', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtcghig3002904jl4qe35v4q', 'cmtcghhu5001504jlth6aw31d', 'BACK', 4, 5, 'B4-5', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtcgl6k0000104lexunx8brz', 'cmtcgl62y000004le5sqgpw8m', 'FRONT', 1, 1, 'F1-1', 0, 'OPENED', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtcgl6k0000204le7i1722f6', 'cmtcgl62y000004le5sqgpw8m', 'FRONT', 1, 2, 'F1-2', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtcgl6k0000304leyggfwggl', 'cmtcgl62y000004le5sqgpw8m', 'FRONT', 1, 3, 'F1-3', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtcgl6k0000404lea5tmbt59', 'cmtcgl62y000004le5sqgpw8m', 'FRONT', 1, 4, 'F1-4', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtcgl6k0000504lep8z5njfa', 'cmtcgl62y000004le5sqgpw8m', 'FRONT', 1, 5, 'F1-5', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtcgl6k0000604lex2lnns8f', 'cmtcgl62y000004le5sqgpw8m', 'BACK', 1, 1, 'B1-1', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtcgl6k0000704le4w5e8j8c', 'cmtcgl62y000004le5sqgpw8m', 'BACK', 1, 2, 'B1-2', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtcgl6k0000804le400uhx5s', 'cmtcgl62y000004le5sqgpw8m', 'BACK', 1, 3, 'B1-3', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtcgl6k0000904lexzl25rpv', 'cmtcgl62y000004le5sqgpw8m', 'BACK', 1, 4, 'B1-4', 0, 'FRESH', NULL);
INSERT INTO "ShelfSlot" ("id", "shelfId", "side", "row", "column", "tagCode", "isFrontRow", "boxType", "itemId") VALUES ('cmtcgl6k0000a04lez3ydipje', 'cmtcgl62y000004le5sqgpw8m', 'BACK', 1, 5, 'B1-5', 0, 'FRESH', NULL);
INSERT INTO "Delivery" ("id", "reference", "supplier", "receivedAt", "note", "siteId", "userId") VALUES ('cmtbab5wv000004l9hyihvqpb', NULL, NULL, '2026-08-27T08:52:22.831+00:00', NULL, NULL, 'cmt8f4cpf000004k01xjvpml5');
INSERT INTO "Delivery" ("id", "reference", "supplier", "receivedAt", "note", "siteId", "userId") VALUES ('cmtbg0q4d000004l4g1y7o3ic', NULL, NULL, '2026-08-27T11:32:13.501+00:00', NULL, 'cmtbau7r9000104ju6nw9162l', 'cmt8clq0300002svnyz2bbkg3');
INSERT INTO "Delivery" ("id", "reference", "supplier", "receivedAt", "note", "siteId", "userId") VALUES ('cmtbgaz0c000004l14125pnu4', NULL, NULL, '2026-08-27T11:40:11.580+00:00', NULL, NULL, 'cmt8clq0300002svnyz2bbkg3');
INSERT INTO "Delivery" ("id", "reference", "supplier", "receivedAt", "note", "siteId", "userId") VALUES ('cmtbgcyvt000004l6jifuba8n', NULL, NULL, '2026-08-27T11:41:44.729+00:00', NULL, NULL, 'cmt8clq0300002svnyz2bbkg3');
INSERT INTO "Delivery" ("id", "reference", "supplier", "receivedAt", "note", "siteId", "userId") VALUES ('cmtck1wm6000204jpmsczu746', NULL, NULL, '2026-08-28T06:12:53.214+00:00', NULL, 'cmtbau7r9000104ju6nw9162l', 'cmt8clq0300002svnyz2bbkg3');
INSERT INTO "Delivery" ("id", "reference", "supplier", "receivedAt", "note", "siteId", "userId") VALUES ('cmtck4ym4000704jpxcxf3bhy', NULL, NULL, '2026-08-28T06:15:15.772+00:00', NULL, NULL, 'cmt8clq0300002svnyz2bbkg3');
INSERT INTO "DefectiveItem" ("id", "itemId", "quantity", "packSize", "packCount", "source", "transactionId", "deliveryId", "siteId", "status", "replacedByDeliveryId", "note", "reportedAt", "userId") VALUES ('cmtbgcz1l000104l6gm4bfg1t', 'cmt8g0sst000004jx7ga0nyri', 5, NULL, NULL, 'DELIVERY', NULL, 'cmtbgcyvt000004l6jifuba8n', NULL, 'REPLACED', 'cmtbgcyvt000004l6jifuba8n', NULL, '2026-08-27T11:41:44.938+00:00', 'cmt8clq0300002svnyz2bbkg3');
INSERT INTO "SitePickup" ("id", "siteId", "itemId", "quantity", "note", "markedAt", "userId") VALUES ('cmtclpa97000004l4493e72k3', 'cmt8clrih00062svnb0ho0sqt', 'cmt8clr1500042svnq1kc91pk', 4, NULL, '2026-08-28T06:59:03.595+00:00', 'cmt8clq0300002svnyz2bbkg3');
INSERT INTO "Transaction" ("id", "type", "quantity", "note", "createdAt", "packSize", "packCount", "pieces", "defectiveQty", "appliedPlan", "reason", "reversesId", "reversedAt", "itemId", "siteId", "fromSiteId", "userId", "dispatchId", "deliveryId") VALUES ('cmtbab6ts000304l97ii0pjz1', 'STOCK_IN', 4, NULL, '2026-08-27T08:52:24.016+00:00', 3, 1, NULL, NULL, '{"sealedDelta":[{"packSize":3,"delta":1}],"created":[{"id":"cmtbab67y000204l9pzarozbc","remaining":1,"originalSize":null,"state":"OPEN","shelfSlotId":null}],"deleted":[],"changed":[],"defectiveIds":[]}', NULL, NULL, NULL, 'cmt8clr9x00052svn4x8czqka', NULL, NULL, 'cmt8f4cpf000004k01xjvpml5', NULL, 'cmtbab5wv000004l9hyihvqpb');
INSERT INTO "Transaction" ("id", "type", "quantity", "note", "createdAt", "packSize", "packCount", "pieces", "defectiveQty", "appliedPlan", "reason", "reversesId", "reversedAt", "itemId", "siteId", "fromSiteId", "userId", "dispatchId", "deliveryId") VALUES ('cmtbab7kv000504l9m0c95qxr', 'STOCK_IN', 5, NULL, '2026-08-27T08:52:24.991+00:00', NULL, NULL, NULL, NULL, '{"sealedDelta":[],"created":[{"id":"cmtbab6z6000404l9qviyyj1t","remaining":5,"originalSize":null,"state":"OPEN","shelfSlotId":null}],"deleted":[],"changed":[],"defectiveIds":[]}', NULL, NULL, NULL, 'cmt8g0sst000004jx7ga0nyri', NULL, NULL, 'cmt8f4cpf000004k01xjvpml5', NULL, 'cmtbab5wv000004l9hyihvqpb');
INSERT INTO "Transaction" ("id", "type", "quantity", "note", "createdAt", "packSize", "packCount", "pieces", "defectiveQty", "appliedPlan", "reason", "reversesId", "reversedAt", "itemId", "siteId", "fromSiteId", "userId", "dispatchId", "deliveryId") VALUES ('cmtbab8h9000804l9ppjnp8oj', 'STOCK_IN', 26, NULL, '2026-08-27T08:52:26.157+00:00', 5, 5, NULL, NULL, '{"sealedDelta":[{"packSize":5,"delta":5}],"created":[{"id":"cmtbab7vn000704l9vc8f6j77","remaining":1,"originalSize":null,"state":"OPEN","shelfSlotId":null}],"deleted":[],"changed":[],"defectiveIds":[]}', NULL, NULL, NULL, 'cmt8clr1500042svnq1kc91pk', NULL, NULL, 'cmt8f4cpf000004k01xjvpml5', NULL, 'cmtbab5wv000004l9hyihvqpb');
INSERT INTO "Transaction" ("id", "type", "quantity", "note", "createdAt", "packSize", "packCount", "pieces", "defectiveQty", "appliedPlan", "reason", "reversesId", "reversedAt", "itemId", "siteId", "fromSiteId", "userId", "dispatchId", "deliveryId") VALUES ('cmtbask19000004jubcmsgk7o', 'ISSUE', 11, NULL, '2026-08-27T09:05:54.285+00:00', 5, 2, NULL, NULL, '{"sealedDelta":[{"packSize":5,"delta":-2}],"created":[],"deleted":[{"id":"cmtbab7vn000704l9vc8f6j77","remaining":1,"originalSize":null,"state":"OPEN","shelfSlotId":null}],"changed":[],"defectiveIds":[]}', NULL, NULL, NULL, 'cmt8clr1500042svnq1kc91pk', 'cmt8clrih00062svnb0ho0sqt', NULL, 'cmt8f4cpf000004k01xjvpml5', NULL, NULL);
INSERT INTO "Transaction" ("id", "type", "quantity", "note", "createdAt", "packSize", "packCount", "pieces", "defectiveQty", "appliedPlan", "reason", "reversesId", "reversedAt", "itemId", "siteId", "fromSiteId", "userId", "dispatchId", "deliveryId") VALUES ('cmtbg0q9s000104l475t6t2pa', 'STOCK_IN', 1, NULL, '2026-08-27T11:32:13.697+00:00', NULL, NULL, NULL, NULL, '{"sealedDelta":[],"created":[],"deleted":[],"changed":[],"defectiveIds":[]}', NULL, NULL, NULL, 'cmt8clr9x00052svn4x8czqka', NULL, NULL, 'cmt8clq0300002svnyz2bbkg3', NULL, 'cmtbg0q4d000004l4g1y7o3ic');
INSERT INTO "Transaction" ("id", "type", "quantity", "note", "createdAt", "packSize", "packCount", "pieces", "defectiveQty", "appliedPlan", "reason", "reversesId", "reversedAt", "itemId", "siteId", "fromSiteId", "userId", "dispatchId", "deliveryId") VALUES ('cmtbg0qf8000204l4r97vmu19', 'ISSUE', 1, NULL, '2026-08-27T11:32:13.892+00:00', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'cmt8clr9x00052svn4x8czqka', 'cmtbau7r9000104ju6nw9162l', NULL, 'cmt8clq0300002svnyz2bbkg3', NULL, 'cmtbg0q4d000004l4g1y7o3ic');
INSERT INTO "Transaction" ("id", "type", "quantity", "note", "createdAt", "packSize", "packCount", "pieces", "defectiveQty", "appliedPlan", "reason", "reversesId", "reversedAt", "itemId", "siteId", "fromSiteId", "userId", "dispatchId", "deliveryId") VALUES ('cmtbgazrf000204l1lhq7b8nm', 'STOCK_IN', 4000, NULL, '2026-08-27T11:40:12.555+00:00', 1000, 4, NULL, NULL, '{"sealedDelta":[{"packSize":1000,"delta":4}],"created":[],"deleted":[],"changed":[],"defectiveIds":[]}', NULL, NULL, NULL, 'cmt8clqsc00032svncl2229e9', NULL, NULL, 'cmt8clq0300002svnyz2bbkg3', NULL, 'cmtbgaz0c000004l14125pnu4');
INSERT INTO "Transaction" ("id", "type", "quantity", "note", "createdAt", "packSize", "packCount", "pieces", "defectiveQty", "appliedPlan", "reason", "reversesId", "reversedAt", "itemId", "siteId", "fromSiteId", "userId", "dispatchId", "deliveryId") VALUES ('cmtbgb0ij000404l1wi8xff72', 'STOCK_IN', 1000, NULL, '2026-08-27T11:40:13.531+00:00', 200, 5, NULL, NULL, '{"sealedDelta":[{"packSize":200,"delta":5}],"created":[],"deleted":[],"changed":[],"defectiveIds":[]}', NULL, NULL, NULL, 'cmtbg5gj9000304l46o6btrbz', NULL, NULL, 'cmt8clq0300002svnyz2bbkg3', NULL, 'cmtbgaz0c000004l14125pnu4');
INSERT INTO "Transaction" ("id", "type", "quantity", "note", "createdAt", "packSize", "packCount", "pieces", "defectiveQty", "appliedPlan", "reason", "reversesId", "reversedAt", "itemId", "siteId", "fromSiteId", "userId", "dispatchId", "deliveryId") VALUES ('cmtbgcztp000304l6z0g6394x', 'STOCK_IN', 95, NULL, '2026-08-27T11:41:45.949+00:00', NULL, NULL, NULL, NULL, '{"sealedDelta":[],"created":[{"id":"cmtbgcz75000204l6cusjpyet","remaining":95,"originalSize":null,"state":"OPEN","shelfSlotId":null}],"deleted":[],"changed":[],"defectiveIds":["cmtbgcz1l000104l6gm4bfg1t"]}', NULL, NULL, NULL, 'cmt8g0sst000004jx7ga0nyri', NULL, NULL, 'cmt8clq0300002svnyz2bbkg3', NULL, 'cmtbgcyvt000004l6jifuba8n');
INSERT INTO "Transaction" ("id", "type", "quantity", "note", "createdAt", "packSize", "packCount", "pieces", "defectiveQty", "appliedPlan", "reason", "reversesId", "reversedAt", "itemId", "siteId", "fromSiteId", "userId", "dispatchId", "deliveryId") VALUES ('cmtbgd0lk000504l6eho3eeq4', 'STOCK_IN', 1000, NULL, '2026-08-27T11:41:46.952+00:00', 200, 5, NULL, NULL, '{"sealedDelta":[{"packSize":200,"delta":5}],"created":[],"deleted":[],"changed":[],"defectiveIds":[]}', NULL, NULL, NULL, 'cmt8clr1500042svnq1kc91pk', NULL, NULL, 'cmt8clq0300002svnyz2bbkg3', NULL, 'cmtbgcyvt000004l6jifuba8n');
INSERT INTO "Transaction" ("id", "type", "quantity", "note", "createdAt", "packSize", "packCount", "pieces", "defectiveQty", "appliedPlan", "reason", "reversesId", "reversedAt", "itemId", "siteId", "fromSiteId", "userId", "dispatchId", "deliveryId") VALUES ('cmtbhmlvh000504l46tb4z5pa', 'RETURN', 7, NULL, '2026-08-27T12:17:14.045+00:00', 5, 1, NULL, NULL, '{"sealedDelta":[{"packSize":5,"delta":1}],"created":[{"id":"cmtbhmm6d000704l48eu6bbsu","remaining":2,"originalSize":null,"state":"OPEN","shelfSlotId":null}],"deleted":[],"changed":[],"defectiveIds":[]}', NULL, NULL, NULL, 'cmt8clr1500042svnq1kc91pk', 'cmt8clrih00062svnb0ho0sqt', NULL, 'cmt8clq0300002svnyz2bbkg3', NULL, NULL);
INSERT INTO "Transaction" ("id", "type", "quantity", "note", "createdAt", "packSize", "packCount", "pieces", "defectiveQty", "appliedPlan", "reason", "reversesId", "reversedAt", "itemId", "siteId", "fromSiteId", "userId", "dispatchId", "deliveryId") VALUES ('cmtck1wrj000304jpntc1xy03', 'STOCK_IN', 500, NULL, '2026-08-28T06:12:53.407+00:00', 100, 5, NULL, NULL, '{"sealedDelta":[],"created":[],"deleted":[],"changed":[],"defectiveIds":[]}', NULL, NULL, NULL, 'cmtcjq6et000004jpuxg4qdag', NULL, NULL, 'cmt8clq0300002svnyz2bbkg3', NULL, 'cmtck1wm6000204jpmsczu746');
INSERT INTO "Transaction" ("id", "type", "quantity", "note", "createdAt", "packSize", "packCount", "pieces", "defectiveQty", "appliedPlan", "reason", "reversesId", "reversedAt", "itemId", "siteId", "fromSiteId", "userId", "dispatchId", "deliveryId") VALUES ('cmtck1wxb000404jpta78yjue', 'ISSUE', 500, NULL, '2026-08-28T06:12:53.615+00:00', 100, 5, NULL, NULL, NULL, NULL, NULL, NULL, 'cmtcjq6et000004jpuxg4qdag', 'cmtbau7r9000104ju6nw9162l', NULL, 'cmt8clq0300002svnyz2bbkg3', NULL, 'cmtck1wm6000204jpmsczu746');
INSERT INTO "Transaction" ("id", "type", "quantity", "note", "createdAt", "packSize", "packCount", "pieces", "defectiveQty", "appliedPlan", "reason", "reversesId", "reversedAt", "itemId", "siteId", "fromSiteId", "userId", "dispatchId", "deliveryId") VALUES ('cmtck1x8d000504jpzte9awd7', 'STOCK_IN', 500, NULL, '2026-08-28T06:12:54.013+00:00', 100, 5, NULL, NULL, '{"sealedDelta":[],"created":[],"deleted":[],"changed":[],"defectiveIds":[]}', NULL, NULL, NULL, 'cmtcjvhay000104kykfvtfq4b', NULL, NULL, 'cmt8clq0300002svnyz2bbkg3', NULL, 'cmtck1wm6000204jpmsczu746');
INSERT INTO "Transaction" ("id", "type", "quantity", "note", "createdAt", "packSize", "packCount", "pieces", "defectiveQty", "appliedPlan", "reason", "reversesId", "reversedAt", "itemId", "siteId", "fromSiteId", "userId", "dispatchId", "deliveryId") VALUES ('cmtck1xdn000604jpheewjynb', 'ISSUE', 500, NULL, '2026-08-28T06:12:54.203+00:00', 100, 5, NULL, NULL, NULL, NULL, NULL, NULL, 'cmtcjvhay000104kykfvtfq4b', 'cmtbau7r9000104ju6nw9162l', NULL, 'cmt8clq0300002svnyz2bbkg3', NULL, 'cmtck1wm6000204jpmsczu746');
INSERT INTO "Transaction" ("id", "type", "quantity", "note", "createdAt", "packSize", "packCount", "pieces", "defectiveQty", "appliedPlan", "reason", "reversesId", "reversedAt", "itemId", "siteId", "fromSiteId", "userId", "dispatchId", "deliveryId") VALUES ('cmtck4zcy000904jpxkvon4n2', 'STOCK_IN', 350, NULL, '2026-08-28T06:15:16.738+00:00', 50, 7, NULL, NULL, '{"sealedDelta":[{"packSize":50,"delta":7}],"created":[],"deleted":[],"changed":[],"defectiveIds":[]}', NULL, NULL, NULL, 'cmtcjndbp000004jsw6k74ldb', NULL, NULL, 'cmt8clq0300002svnyz2bbkg3', NULL, 'cmtck4ym4000704jpxcxf3bhy');
INSERT INTO "Transaction" ("id", "type", "quantity", "note", "createdAt", "packSize", "packCount", "pieces", "defectiveQty", "appliedPlan", "reason", "reversesId", "reversedAt", "itemId", "siteId", "fromSiteId", "userId", "dispatchId", "deliveryId") VALUES ('cmtck503c000b04jp5blm6rmn', 'STOCK_IN', 750, NULL, '2026-08-28T06:15:17.688+00:00', 50, 15, NULL, NULL, '{"sealedDelta":[{"packSize":50,"delta":15}],"created":[],"deleted":[],"changed":[],"defectiveIds":[]}', NULL, NULL, NULL, 'cmtcjtfgj000004ky5h8z6nl1', NULL, NULL, 'cmt8clq0300002svnyz2bbkg3', NULL, 'cmtck4ym4000704jpxcxf3bhy');
INSERT INTO "User" ("id", "name", "email", "passwordHash", "role", "isActive", "createdAt") VALUES ('cmt8clq0300002svnyz2bbkg3', 'Admin', 'admin@example.com', '$2b$10$1LyYZD6C2RFlWHg1DSDHKuBg2NT5KvuZtnKV1xTWTGu6mXEDhI6TK', 'ADMIN', 1, '2026-08-25T07:33:16.131+00:00');
INSERT INTO "User" ("id", "name", "email", "passwordHash", "role", "isActive", "createdAt") VALUES ('cmt8clqf000012svngbs04djq', 'Finance', 'finance@example.com', '$2b$10$vOTPi1t/jPUN.hX9HgHw3uxfk7W50D.yzq.R1MOjtb/G09RQg.RpG', 'FINANCE', 1, '2026-08-25T07:33:16.668+00:00');
INSERT INTO "User" ("id", "name", "email", "passwordHash", "role", "isActive", "createdAt") VALUES ('cmt8clqjj00022svngzgjibno', 'Employee', 'employee@example.com', '$2b$10$QNumupivp6J47aWhV03rKeWOYLiMd547ju1T3/AVBNWTkPfs8hPGK', 'EMPLOYEE', 1, '2026-08-25T07:33:16.831+00:00');
INSERT INTO "User" ("id", "name", "email", "passwordHash", "role", "isActive", "createdAt") VALUES ('cmt8ez458000004jps43rqy2q', 'SANCHITA PARAB', 'sanchita.p@solarcastle.in', '$2b$10$oRAKjS/5u57KLys6cxiYUeeLTjiA7cAOJOxj9bGdvNjlO4xo/Wrly', 'ADMIN', 1, '2026-08-25T08:39:40.220+00:00');
INSERT INTO "User" ("id", "name", "email", "passwordHash", "role", "isActive", "createdAt") VALUES ('cmt8f4cpf000004k01xjvpml5', 'Durgesh Nandkumar Pawar', 'durgesh.solarcastle@gmail.com', '$2b$10$aqWczu8wkcolLvMB1fdYI.xBhcw94h3d7qMFYkN7k3kKvJurOes8O', 'ADMIN', 1, '2026-08-25T08:43:44.595+00:00');
INSERT INTO "User" ("id", "name", "email", "passwordHash", "role", "isActive", "createdAt") VALUES ('cmt8fbe9h000104k0b0urezaf', 'Anshul', 'sales.solarcastle@gmail.com', '$2b$10$e9VOcGT/ev63ohWSDepVBO0hXsb26Zgv5r4awpxAi71kpqENw7Tc2', 'ADMIN', 1, '2026-08-25T08:49:13.205+00:00');
COMMIT;
PRAGMA foreign_keys=ON;
