/*
  Warnings:

  - A unique constraint covering the columns `[userId,name]` on the table `tag` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId,slug]` on the table `tag` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `userId` to the `tag` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "tag_name_key";

-- DropIndex
DROP INDEX "tag_slug_key";

-- AlterTable
ALTER TABLE "tag" ADD COLUMN     "userId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "tag_userId_name_key" ON "tag"("userId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "tag_userId_slug_key" ON "tag"("userId", "slug");

-- AddForeignKey
ALTER TABLE "tag" ADD CONSTRAINT "tag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
