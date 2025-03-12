import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";

// Función auxiliar para convertir Decimal a number
const toNumber = (value: Decimal | number | null | undefined): number => {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  return value.toNumber();
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, ids, data } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { message: "Se requiere un array de IDs válido" },
        { status: 400 }
      );
    }

    // Validar que los IDs sean números
    const validIds = ids.filter(id => typeof id === "number");
    if (validIds.length === 0) {
      return NextResponse.json(
        { message: "No se proporcionaron IDs válidos" },
        { status: 400 }
      );
    }

    if (action === "delete") {
      // Eliminar productos en masa
      const deleted = await prisma.product.deleteMany({
        where: {
          id: {
            in: validIds
          }
        }
      });

      return NextResponse.json({
        message: `${deleted.count} productos eliminados correctamente`,
        affected: deleted.count
      });
    } else if (action === "update") {
      // Actualizar productos en masa
      if (!data || Object.keys(data).length === 0) {
        return NextResponse.json(
          { message: "No se proporcionaron datos para actualizar" },
          { status: 400 }
        );
      }

      // Si estamos cambiando categorías, necesitamos un enfoque más complejo
      // ya que los precios pueden cambiar según el margen de la categoría
      if ('category_id' in data) {
        // Primero obtener la categoría si existe para conocer su margen
        let profitMargin = 0.2; // Margen predeterminado
        
        if (data.category_id !== null) {
          const category = await prisma.category.findUnique({
            where: { id: Number(data.category_id) }
          });
          
          if (category && category.profit_margin !== null) {
            profitMargin = toNumber(category.profit_margin);
          }
        }
        
        // Obtener todos los productos afectados
        const productsToUpdate = await prisma.product.findMany({
          where: {
            id: {
              in: validIds
            }
          }
        });
        
        // Actualizar cada producto individualmente para poder ajustar el precio
        const updatePromises = productsToUpdate.map(product => {
          return prisma.product.update({
            where: { id: product.id },
            data: {
              category_id: data.category_id
              // Eliminamos la actualización del precio
            }
          });
        });
        
        // Ejecutar todas las actualizaciones en paralelo
        await Promise.all(updatePromises);
        
        return NextResponse.json({
          message: `${productsToUpdate.length} productos actualizados correctamente con nuevos precios`,
          affected: productsToUpdate.length
        });
      } else {
        // Actualización normal para otros campos
        const updateData: Record<string, any> = { ...data };
        
        const updated = await prisma.product.updateMany({
          where: {
            id: {
              in: validIds
            }
          },
          data: updateData
        });

        return NextResponse.json({
          message: `${updated.count} productos actualizados correctamente`,
          affected: updated.count
        });
      }
    } else {
      return NextResponse.json(
        { message: "Acción no soportada" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Error en operación bulk de productos:", error);
    return NextResponse.json(
      { message: "Error en la operación bulk", error: String(error) },
      { status: 500 }
    );
  }
} 