import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(_request: NextRequest) {
  const products = await prisma.product.findMany();
  return NextResponse.json(products);
}
