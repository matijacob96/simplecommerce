import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { products } = body;

  if (!products || !Array.isArray(products) || products.length === 0) {
    return NextResponse.json({ error: 'Debe haber al menos un producto.' }, { status: 400 });
  }

  try {
    const totalProductCost = products.reduce(
      (acc, product) => acc + product.quantity * product.cost,
      0
    );
    if (totalProductCost === 0) {
      return NextResponse.json(
        { error: 'El costo total de los productos no puede ser cero.' },
        { status: 400 }
      );
    }

    for (const product of products) {
      if (!product.name || isNaN(parseInt(product.quantity)) || isNaN(parseFloat(product.cost))) {
        return NextResponse.json({ error: 'Datos de producto inválidos.' }, { status: 400 });
      }

      // Usamos el costo unitario final que incluye el envío prorrateado
      const finalUnitCost = product.finalUnitCost || product.cost;

      // Gestión de categoría: si existe ID usamos ese, si no pero existe nombre creamos una nueva
      let categoryId = null;
      if (product.categoryId) {
        // Verificar que la categoría existe
        const categoryExists = await prisma.category.findUnique({
          where: { id: parseInt(product.categoryId) },
        });
        if (categoryExists) {
          categoryId = parseInt(product.categoryId);
        }
      } else if (product.categoryName && product.categoryName.trim() !== '') {
        // Buscar si ya existe una categoría con ese nombre
        let category = await prisma.category.findFirst({
          where: { name: product.categoryName.trim() },
        });

        if (!category) {
          // Crear la categoría si no existe
          category = await prisma.category.create({
            data: { name: product.categoryName.trim() },
          });
        }

        categoryId = category.id;
      }

      const existingProduct = await prisma.product.findFirst({
        where: { name: product.name },
        select: { id: true, stock: true },
      });

      let productId;
      if (!existingProduct) {
        // Crear producto nuevo con la categoría
        const newProduct = await prisma.product.create({
          data: {
            name: product.name,
            stock: 0,
            price: finalUnitCost,
            image: product.imageUrl || null,
            category_id: categoryId,
          },
          select: { id: true, stock: true },
        });
        productId = newProduct.id;
      } else {
        productId = existingProduct.id;
      }

      await prisma.order.create({
        data: {
          product_name: product.name,
          quantity: parseInt(product.quantity),
          supplier: product.supplier || null,
          shipping_cost: (finalUnitCost - product.cost) * product.quantity,
        },
      });

      const newStock = (existingProduct ? existingProduct.stock : 0) + parseInt(product.quantity);

      // Actualizar el producto con el precio final (incluyendo el envío prorrateado) y categoría
      await prisma.product.update({
        where: { id: productId },
        data: {
          stock: newStock,
          price: finalUnitCost,
          category_id: categoryId,
        },
      });
    }

    return NextResponse.json({ message: 'Pedidos cargados exitosamente!' });
  } catch (error) {
    console.error('Error al procesar los pedidos:', error);
    return NextResponse.json({ error: 'Fallo al procesar los pedidos.' }, { status: 500 });
  }
}
