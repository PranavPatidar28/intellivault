-- AlterTable
ALTER TABLE "note" ADD COLUMN     "aiProcessedAt" TIMESTAMPTZ(6),
ADD COLUMN     "contentHash" TEXT;
