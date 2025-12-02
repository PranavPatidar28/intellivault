/*
  Warnings:

  - You are about to drop the column `content` on the `note` table. All the data in the column will be lost.
  - Added the required column `contentJSON` to the `note` table without a default value. This is not possible if the table is not empty.
  - Added the required column `contentText` to the `note` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "note" DROP COLUMN "content",
ADD COLUMN     "contentJSON" JSONB NOT NULL,
ADD COLUMN     "contentText" TEXT NOT NULL;
