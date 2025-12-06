-- CreateEnum
CREATE TYPE "EmbeddingStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'ERROR', 'DELETED');

-- AlterTable
ALTER TABLE "note" ADD COLUMN     "chunkCount" INTEGER,
ADD COLUMN     "embeddingStatus" "EmbeddingStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "generatedTitle" TEXT,
ADD COLUMN     "lastEmbeddedAt" TIMESTAMPTZ(6),
ADD COLUMN     "summary" TEXT;

-- CreateIndex
CREATE INDEX "note_userId_idx" ON "note"("userId");

-- CreateIndex
CREATE INDEX "note_embeddingStatus_idx" ON "note"("embeddingStatus");

-- CreateIndex
CREATE INDEX "note_updatedAt_idx" ON "note"("updatedAt");
