import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      orderBy: {
        name: "asc",
      },
    });
    
    return NextResponse.json(categories);
  } catch (error) {
    console.error("Error fetching categories:", error);
    return NextResponse.json(
      { error: "Error al obtener las categorías" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
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

    // Verificar si ya existe una categoría con ese nombre
    const existingCategory = await prisma.category.findUnique({
      where: { name: name.trim() },
    });

    if (existingCategory) {
      return NextResponse.json(
        { error: "Ya existe una categoría con ese nombre" },
        { status: 400 }
      );
    }

    // Preparar los datos para crear
    const createData: any = {
      name: name.trim(),
    };

    // Solo incluir el margen de ganancia si se proporciona
    if (profit_margin !== undefined) {
      // Si es null o un número, lo asignamos directamente
      // Si es un string, lo convertimos a número primero
      createData.profit_margin = profit_margin === null 
        ? null 
        : Number(profit_margin);
    }

    const newCategory = await prisma.category.create({
      data: createData,
    });

    return NextResponse.json(newCategory, { status: 201 });
  } catch (error) {
    console.error("Error creating category:", error);
    return NextResponse.json(
      { error: "Error al crear la categoría" },
      { status: 500 }
    );
  }
}