import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

// GET para obtener un cliente específico
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
        { error: "ID de cliente inválido" },
        { status: 400 }
      );
    }

    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        sales: true, // Incluir ventas asociadas al cliente
      },
    });

    if (!customer) {
      return NextResponse.json(
        { error: "Cliente no encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json(customer);
  } catch (error) {
    console.error("Error al obtener el cliente:", error);
    return NextResponse.json(
      { error: "Error al obtener el cliente" },
      { status: 500 }
    );
  }
}

// PUT para actualizar un cliente
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
        { error: "ID de cliente inválido" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { name, whatsapp, instagram, facebook, first_purchase_date } = body;

    if (!name || name.trim() === '') {
      return NextResponse.json(
        { error: "El nombre del cliente es obligatorio" },
        { status: 400 }
      );
    }

    // Comprobar si el cliente existe
    const existingCustomer = await prisma.customer.findUnique({
      where: { id },
    });

    if (!existingCustomer) {
      return NextResponse.json(
        { error: "Cliente no encontrado" },
        { status: 404 }
      );
    }

    // Actualizar el cliente
    const updatedCustomer = await prisma.customer.update({
      where: { id },
      data: {
        name,
        whatsapp: whatsapp || null,
        instagram: instagram || null,
        facebook: facebook || null,
        first_purchase_date: first_purchase_date ? new Date(first_purchase_date) : existingCustomer.first_purchase_date,
        updated_at: new Date(),
      },
    });

    return NextResponse.json(updatedCustomer);
  } catch (error: any) {
    console.error("Error al actualizar el cliente:", error);
    return NextResponse.json(
      { error: error.message || "Error al actualizar el cliente" },
      { status: 500 }
    );
  }
}

// DELETE para eliminar un cliente
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
        { error: "ID de cliente inválido" },
        { status: 400 }
      );
    }

    // Comprobar si el cliente existe
    const existingCustomer = await prisma.customer.findUnique({
      where: { id },
      include: {
        sales: true,
      },
    });

    if (!existingCustomer) {
      return NextResponse.json(
        { error: "Cliente no encontrado" },
        { status: 404 }
      );
    }

    // Si el cliente tiene ventas asociadas, no permitir eliminación directa
    if (existingCustomer.sales.length > 0) {
      return NextResponse.json(
        { 
          error: "No se puede eliminar el cliente porque tiene ventas asociadas", 
          salesCount: existingCustomer.sales.length 
        },
        { status: 400 }
      );
    }

    // Eliminar el cliente
    await prisma.customer.delete({
      where: { id },
    });

    return NextResponse.json(
      { message: "Cliente eliminado correctamente" },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error al eliminar el cliente:", error);
    return NextResponse.json(
      { error: error.message || "Error al eliminar el cliente" },
      { status: 500 }
    );
  }
} 