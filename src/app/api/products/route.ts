import prisma from '@/lib/prisma';
import { NextResponse } from 'next/server';

// Definir una interfaz para las condiciones del where
interface WhereCondition {
  name?: {
    contains: string;
    mode: 'insensitive';
  };
  category_id?: {
    in: number[];
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const filterParam = searchParams.get('filter') || 'all';

    const filters = filterParam.split(',');

    // Construir condiciones de filtro
    const whereCondition: WhereCondition = {};

    // Filtro de búsqueda
    if (search) {
      whereCondition.name = {
        contains: search,
        mode: 'insensitive', // Búsqueda insensible a mayúsculas/minúsculas
      };
    }

    // Filtro de categoría
    if (!filters.includes('all')) {
      const categoryIds = filters.filter(id => !isNaN(parseInt(id))).map(id => parseInt(id));

      if (categoryIds.length > 0) {
        whereCondition.category_id = {
          in: categoryIds,
        };
      }
    }

    const products = await prisma.product.findMany({
      where: whereCondition,
      include: {
        category: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    return NextResponse.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json({ error: 'Error al obtener los productos' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const productData = await request.json();
    const { imageUrl } = productData;

    // Eliminar campos no persistibles omitiendo imageUrl
    const { imageUrl: _imageUrlOmitted, ...validProductData } = productData;

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

    // Validaciones básicas
    if (
      !validProductData.name ||
      typeof validProductData.name !== 'string' ||
      validProductData.name.trim() === ''
    ) {
      return NextResponse.json({ error: 'El nombre del producto es requerido' }, { status: 400 });
    }

    if (
      validProductData.price === undefined ||
      isNaN(parseFloat(validProductData.price)) ||
      parseFloat(validProductData.price) < 0
    ) {
      return NextResponse.json({ error: 'El precio debe ser un número positivo' }, { status: 400 });
    }

    if (
      validProductData.stock === undefined ||
      isNaN(parseInt(validProductData.stock)) ||
      parseInt(validProductData.stock) < 0
    ) {
      return NextResponse.json(
        { error: 'El stock debe ser un número entero positivo' },
        { status: 400 }
      );
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

    // Crear el producto
    const newProduct = await prisma.product.create({
      data: validProductData,
      include: {
        category: true,
      },
    });

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
            productId: newProduct.id,
          }),
        });

        if (imageResponse.ok) {
          const imageData = await imageResponse.json();

          // Actualizar el producto con la URL de la imagen
          await prisma.product.update({
            where: { id: newProduct.id },
            data: {
              image: imageData.url,
            },
          });

          // Actualizar el objeto para la respuesta
          newProduct.image = imageData.url;
        }
      } catch (error) {
        console.error('Error al procesar la imagen:', error);
        // No fallamos la operación si falla la imagen
      }
    }

    return NextResponse.json(newProduct, { status: 201 });
  } catch (error) {
    console.error('Error creating product:', error);
    return NextResponse.json({ error: 'Error al crear el producto' }, { status: 500 });
  }
}
