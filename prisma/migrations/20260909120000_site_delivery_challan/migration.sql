-- Site delivery challan: a printable number for a direct-to-site delivery,
-- separate from Dispatch.challanNo so the two document series never collide.

-- AlterTable
ALTER TABLE "Delivery" ADD COLUMN "challanNo" INTEGER;
ALTER TABLE "Delivery" ADD COLUMN "deliveredBy" TEXT;
ALTER TABLE "Delivery" ADD COLUMN "receivedBy" TEXT;

-- All three columns are nullable, so this is a plain ADD COLUMN rather than
-- the table-rebuild the Dispatch migration needed for its NOT NULL column.
CREATE UNIQUE INDEX "Delivery_challanNo_key" ON "Delivery"("challanNo");

-- Backfill existing direct-to-site deliveries, ordered by receivedAt then id
-- (deterministic on re-run), so the historical series reads in the order
-- material actually went out. Store deliveries (siteId NULL) stay NULL and
-- coexist fine under a unique index — SQLite treats NULLs as distinct.
UPDATE "Delivery" SET "challanNo" = (
  SELECT ROW_NUMBER() OVER (ORDER BY "receivedAt", "id")
  FROM "Delivery" d2 WHERE d2."siteId" IS NOT NULL AND d2."id" = "Delivery"."id"
) WHERE "siteId" IS NOT NULL;

-- The counter starts above whatever the backfill just used, so the next
-- direct-to-site delivery cannot collide with a number already on a printed
-- challan.
INSERT INTO "Sequence" ("key", "value")
SELECT 'siteChallan', COALESCE(MAX("challanNo"), 0) FROM "Delivery";
