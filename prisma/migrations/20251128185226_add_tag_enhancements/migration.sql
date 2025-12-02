-- AlterTable
ALTER TABLE "tag" ADD COLUMN     "description" TEXT,
ADD COLUMN     "isArchived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isFavorite" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "parentId" TEXT;

-- CreateTable
CREATE TABLE "tag_view" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "filters" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tag_view_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tag_relation" (
    "id" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "strength" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tag_relation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_TagToTagView" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_TagToTagView_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "tag_relation_fromId_toId_key" ON "tag_relation"("fromId", "toId");

-- CreateIndex
CREATE INDEX "_TagToTagView_B_index" ON "_TagToTagView"("B");

-- AddForeignKey
ALTER TABLE "tag" ADD CONSTRAINT "tag_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "tag"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tag_relation" ADD CONSTRAINT "tag_relation_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tag_relation" ADD CONSTRAINT "tag_relation_toId_fkey" FOREIGN KEY ("toId") REFERENCES "tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TagToTagView" ADD CONSTRAINT "_TagToTagView_A_fkey" FOREIGN KEY ("A") REFERENCES "tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TagToTagView" ADD CONSTRAINT "_TagToTagView_B_fkey" FOREIGN KEY ("B") REFERENCES "tag_view"("id") ON DELETE CASCADE ON UPDATE CASCADE;
