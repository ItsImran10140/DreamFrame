/*
  Warnings:

  - Added the required column `userId` to the `ManimProject` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ManimProject" ADD COLUMN     "userId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "ManimProject" ADD CONSTRAINT "ManimProject_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
