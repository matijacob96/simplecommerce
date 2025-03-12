import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Esperar a que params esté disponible
    const paramsData = await params;
    const id = parseInt(paramsData.id);
    
    if (isNaN(id)) {
      return NextResponse.json(
        { error: "ID de categoría inválido" },
        { status: 400 }
      );
    }

    const category = await prisma.category.findUnique({
      where: { id },
    });

    if (!category) {
      return NextResponse.json(
        { error: "Categoría no encontrada" },
        { status: 404 }
      );
    }

    return NextResponse.json(category);
  } catch (error) {
    console.error("Error fetching category:", error);
    return NextResponse.json(
      { error: "Error al obtener la categoría" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Esperar a que params esté disponible
    const paramsData = await params;
    const id = parseInt(paramsData.id);
    
    if (isNaN(id)) {
      return NextResponse.json(
        { error: "ID de categoría inválido" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { name, profit_margin } = body;

    if (!name || typeof name !== "string" || name.trim() === "") {
      return NextResponse.json(
        { error: "El nombre de la categoría es requerido" },
        { status: 400 }
      );
    }

    // Validar el margen de ganancia si se proporciona
    if (profit_margin !== undefined) {
      // Si es null, permitirlo (significa usar el valor predeterminado)
      if (profit_margin === null) {
        // Es válido, no hacer nada
      } 
      // Si no es null, asegurarse de que sea un número válido entre 0 y 1
      else {
        const numValue = Number(profit_margin);
        if (isNaN(numValue) || numValue < 0 || numValue > 1) {
          return NextResponse.json(
            { error: "El margen de ganancia debe ser un número entre 0 y 1" },
            { status: 400 }
          );
        }
      }
    }

    // Verificar si existe la categoría
    const category = await prisma.category.findUnique({
      where: { id },
    });

    if (!category) {
      return NextResponse.json(
        { error: "Categoría no encontrada" },
        { status: 404 }
      );
    }

    // Verificar si ya existe otra categoría con ese nombre
    const existingCategory = await prisma.category.findUnique({
      where: { name: name.trim() },
    });

    if (existingCategory && existingCategory.id !== id) {
      return NextResponse.json(
        { error: "Ya existe otra categoría con ese nombre" },
        { status: 400 }
      );
    }

    // Preparar los datos para actualizar
    const updateData: any = {
      name: name.trim(),
    };

    // Solo incluir el margen de ganancia si se proporciona
    if (profit_margin !== undefined) {
      // Si es null o un número, lo asignamos directamente
      // Si es un string, lo convertimos a número primero
      updateData.profit_margin = profit_margin === null 
        ? null 
        : Number(profit_margin);
    }

    const updatedCategory = await prisma.category.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(updatedCategory);
  } catch (error) {
    console.error("Error updating category:", error);
    return NextResponse.json(
      { error: "Error al actualizar la categoría" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Esperar a que params esté disponible
    const paramsData = await params;
    const id = parseInt(paramsData.id);
    
    if (isNaN(id)) {
      return NextResponse.json(
        { error: "ID de categoría inválido" },
        { status: 400 }
      );
    }

    // Verificar si existe la categoría
    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        Product: true,
      },
    });

    if (!category) {
      return NextResponse.json(
        { error: "Categoría no encontrada" },
        { status: 404 }
      );
    }

    // Verificar si hay productos asociados a esta categoría
    if (category.Product.length > 0) {
      return NextResponse.json(
        { 
          error: "No se puede eliminar la categoría porque tiene productos asociados",
          productCount: category.Product.length
        },
        { status: 400 }
      );
    }

    await prisma.category.delete({
      where: { id },
    });

    return NextResponse.json(
      { message: "Categoría eliminada correctamente" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting category:", error);
    return NextResponse.json(
      { error: "Error al eliminar la categoría" },
      { status: 500 }
    );
  }
}