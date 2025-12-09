-- CreateEnum
CREATE TYPE "FileType" AS ENUM ('IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT');

-- CreateTable
CREATE TABLE "media_attachment" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "pathname" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileType" "FileType" NOT NULL,
    "size" INTEGER NOT NULL,
    "metadata" JSONB,
    "userId" TEXT NOT NULL,
    "noteId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_attachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "media_attachment_url_key" ON "media_attachment"("url");

-- CreateIndex
CREATE INDEX "media_attachment_userId_idx" ON "media_attachment"("userId");

-- CreateIndex
CREATE INDEX "media_attachment_noteId_idx" ON "media_attachment"("noteId");

-- AddForeignKey
ALTER TABLE "media_attachment" ADD CONSTRAINT "media_attachment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_attachment" ADD CONSTRAINT "media_attachment_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "note"("id") ON DELETE SET NULL ON UPDATE CASCADE;
