-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN "reversedAt" DATETIME;

-- CreateIndex
CREATE INDEX "Transaction_reversedAt_idx" ON "Transaction"("reversedAt");

