import prisma from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

// GET para obtener un producto específico
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const paramsData = await params;
    const id = parseInt(paramsData.id);

    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID de producto inválido' }, { status: 400 });
    }

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
      },
    });

    if (!product) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
    }

    return NextResponse.json(product);
  } catch (error) {
    console.error('Error fetching product:', error);
    return NextResponse.json({ error: 'Error al obtener el producto' }, { status: 500 });
  }
}

// PUT para actualizar un producto existente
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const paramsData = await params;
    const id = parseInt(paramsData.id);

    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID de producto inválido' }, { status: 400 });
    }

    const productData = await request.json();
    const { imageUrl, clearImage } = productData;

    // Eliminar campos no persistibles
    const { id: _, imageUrl: __, clearImage: ___, ...validProductData } = productData;

    // Verificar que el producto existe
    const existingProduct = await prisma.product.findUnique({
      where: { id },
    });

    if (!existingProduct) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
    }

    // Asegurarse de que los campos numéricos sean números
    if (validProductData.price !== undefined) {
      validProductData.price = Number(validProductData.price);
    }

    if (validProductData.stock !== undefined) {
      validProductData.stock = Number(validProductData.stock);
    }

    if (validProductData.category_id !== undefined) {
      validProductData.category_id =
        validProductData.category_id === null ? null : Number(validProductData.category_id);
    }

    // Verificar que la categoría existe si se proporciona
    if (validProductData.category_id !== undefined && validProductData.category_id !== null) {
      const categoryExists = await prisma.category.findUnique({
        where: { id: validProductData.category_id },
      });

      if (!categoryExists) {
        return NextResponse.json({ error: 'La categoría especificada no existe' }, { status: 400 });
      }
    }

    // Si se solicita eliminar la imagen
    if (clearImage === true) {
      try {
        // Obtener la URL base
        const origin = new URL(request.url).origin;

        // Eliminar la imagen usando la API de imágenes
        await fetch(`${origin}/api/images?productId=${id}`, {
          method: 'DELETE',
        });

        // Actualizar el producto para quitar la referencia a la imagen
        validProductData.image = null;
      } catch (error) {
        console.error('Error al eliminar la imagen:', error);
        // No fallamos la operación si falla la eliminación de la imagen
      }
    }

    // Si se proporcionó una URL de imagen, procesar con la API de imágenes
    if (imageUrl && typeof imageUrl === 'string') {
      try {
        // Obtener la URL base
        const origin = new URL(request.url).origin;

        const imageResponse = await fetch(`${origin}/api/images`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: imageUrl,
            productId: id,
          }),
        });

        if (imageResponse.ok) {
          const imageData = await imageResponse.json();
          validProductData.image = imageData.url;
        }
      } catch (error) {
        console.error('Error al procesar la imagen:', error);
        // No fallamos la operación si falla la imagen
      }
    }

    // Actualizar el producto
    const updatedProduct = await prisma.product.update({
      where: { id },
      data: validProductData,
      include: {
        category: true,
      },
    });

    return NextResponse.json(updatedProduct);
  } catch (error) {
    console.error('Error updating product:', error);
    return NextResponse.json({ error: 'Error al actualizar el producto' }, { status: 500 });
  }
}

// DELETE para eliminar un producto
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Asegurar que params.id sea válido
    const paramsData = await params;

    if (!paramsData?.id) {
      return NextResponse.json({ error: 'ID de producto no proporcionado' }, { status: 400 });
    }

    const id = parseInt(paramsData.id);

    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID de producto inválido' }, { status: 400 });
    }

    // Verificar que el producto existe
    const existingProduct = await prisma.product.findUnique({
      where: { id },
    });

    if (!existingProduct) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
    }

    // Intentar eliminar la imagen asociada
    try {
      // Obtener la URL base
      const origin = new URL(request.url).origin;

      await fetch(`${origin}/api/images?productId=${id}`, {
        method: 'DELETE',
      });
    } catch (error) {
      console.error('Error al eliminar la imagen del producto:', error);
      // No fallamos la operación si falla la eliminación de la imagen
    }

    // Eliminar el producto
    await prisma.product.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Producto eliminado correctamente' });
  } catch (error) {
    console.error('Error deleting product:', error);
    return NextResponse.json({ error: 'Error al eliminar el producto' }, { status: 500 });
  }
}
