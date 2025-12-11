-- CreateEnum
CREATE TYPE "NoteStatus" AS ENUM ('DRAFT', 'FINAL', 'ARCHIVED');

-- AlterTable
ALTER TABLE "note" ADD COLUMN     "actions" JSONB,
ADD COLUMN     "aiOptions" JSONB,
ADD COLUMN     "embeddingsMeta" JSONB,
ADD COLUMN     "originalFilename" TEXT,
ADD COLUMN     "provenance" JSONB,
ADD COLUMN     "rawText" TEXT,
ADD COLUMN     "source" TEXT,
ADD COLUMN     "status" "NoteStatus" NOT NULL DEFAULT 'FINAL',
ADD COLUMN     "titles" JSONB,
ADD COLUMN     "tldr" TEXT,
ADD COLUMN     "versions" JSONB NOT NULL DEFAULT '[]';

-- CreateIndex
CREATE INDEX "note_status_idx" ON "note"("status");
