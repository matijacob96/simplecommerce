-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "total_ars" DECIMAL(65,30) DEFAULT 0,
ADD COLUMN     "user_id" TEXT;

-- AlterTable
ALTER TABLE "SaleItem" ADD COLUMN     "price_ars" DECIMAL(65,30);
