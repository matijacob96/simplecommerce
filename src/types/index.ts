import { Prisma } from '@prisma/client';

export type Customer = {
  id: number;
  name: string;
  whatsapp: string | null;
  instagram: string | null;
  facebook: string | null;
};

export type Category = {
  id: number;
  name: string;
  profit_margin: Prisma.Decimal | null;
};

export type Product = {
  id: number;
  name: string;
  price: Prisma.Decimal; // Precio base en USD (costo)
  stock: number;
  category_id: number | null;
  category?: Category;
};

export type SaleItem = {
  id: number;
  product_id: number;
  quantity: number;
  selling_price: Prisma.Decimal; // Precio de venta en USD
  price_ars?: Prisma.Decimal; // Precio de venta en ARS
  product: Product;
};

export type Sale = {
  id: number;
  created_at: string;
  updated_at: string;
  total: Prisma.Decimal;
  total_ars?: Prisma.Decimal; // Total en pesos argentinos
  items: SaleItem[];
  payment_method: string;
  customer_id: number | null;
  customer: Customer | null;
  exchange_rate: Prisma.Decimal | null;
  user_id?: string | null; // ID del usuario que creó la venta
};
