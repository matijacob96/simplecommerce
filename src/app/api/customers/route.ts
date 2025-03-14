import prisma from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getErrorMessage } from '@/types/error-types';

// GET para obtener todos los clientes
export async function GET() {
  try {
    const customers = await prisma.customer.findMany({
      orderBy: {
        name: 'asc',
      },
    });

    return NextResponse.json(customers);
  } catch (error: unknown) {
    console.error('Error al obtener los clientes:', error);
    return NextResponse.json(
      { error: getErrorMessage(error) || 'Error al obtener los clientes' },
      { status: 500 }
    );
  }
}

// POST para crear un cliente nuevo
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, whatsapp, instagram, facebook } = body;

    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'El nombre del cliente es obligatorio' }, { status: 400 });
    }

    // Crear el cliente
    const customer = await prisma.customer.create({
      data: {
        name,
        whatsapp: whatsapp || null,
        instagram: instagram || null,
        facebook: facebook || null,
        // first_purchase_date se establece automáticamente con @default(now())
      },
    });

    return NextResponse.json(customer);
  } catch (error: unknown) {
    console.error('Error al crear el cliente:', error);
    return NextResponse.json(
      { error: getErrorMessage(error) || 'Error al crear el cliente' },
      { status: 500 }
    );
  }
}
