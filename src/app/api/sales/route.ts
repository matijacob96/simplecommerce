import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

// Función para obtener el tipo de cambio actual
async function getCurrentExchangeRate() {
  try {
    // Obtener el valor del dólar blue desde la API
    const response = await fetch('http://localhost:3000/api/dolar-blue');
    if (response.ok) {
      const data = await response.json();
      if (data.success && data.data && data.data.venta) {
        return parseFloat(data.data.venta);
      }
    }
    // Si hay algún problema, devolver un valor por defecto
    return 1250.00;
  } catch (error) {
    console.error("Error al obtener tipo de cambio:", error);
    return 1250.00; // Valor por defecto en caso de error
  }
}

// GET para obtener todas las ventas
export async function GET() {
  try {
    const sales = await prisma.sale.findMany({
      include: {
        items: {
          include: {
            product: true,
          },
        },
        customer: true
      },
      orderBy: {
        created_at: 'desc',
      },
    });
    
    return NextResponse.json(sales);
  } catch (error) {
    console.error("Error al obtener ventas:", error);
    return NextResponse.json(
      { error: "Error al obtener las ventas" },
      { status: 500 }
    );
  }
}

// Función para calcular el precio de venta
async function calculateSellingPrice(productId: number) {
  // Obtener el producto con su categoría
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { category: true },
  });
  
  if (!product) {
    throw new Error(`Producto con ID ${productId} no encontrado`);
  }
  
  let profitMargin = 0.2; // Margen predeterminado 20%
  
  // Obtener configuración global si existe
  const globalSetting = await prisma.setting.findFirst();
  if (globalSetting && globalSetting.profit_margin) {
    profitMargin = parseFloat(globalSetting.profit_margin.toString());
  }
  
  // Usar el margen de la categoría si está disponible
  if (product.category && product.category.profit_margin) {
    profitMargin = parseFloat(product.category.profit_margin.toString());
  }
  
  const costPrice = parseFloat(product.price.toString());
  return costPrice * (1 + profitMargin);
}

// Función para calcular el total de una venta
async function calculateTotal(saleItems: any[]) {
  let total = 0;
  
  for (const item of saleItems) {
    // Obtener el producto para cada item
    const product = await prisma.product.findUnique({
      where: { id: item.product_id },
      include: { category: true },
    });
    
    if (!product) {
      throw new Error(`Producto con ID ${item.product_id} no encontrado`);
    }
    
    // Calcular precio de venta con margen
    const sellingPrice = await calculateSellingPrice(item.product_id);
    
    // Acumular al total
    total += sellingPrice * item.quantity;
  }
  
  return total;
}

// POST para crear una nueva venta
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { items, payment_method, customer_id = null, customer_data = null } = body;

    // Validar items y medio de pago
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "Se requieren items válidos para la venta" },
        { status: 400 }
      );
    }

    if (
      payment_method !== "efectivo" &&
      payment_method !== "transferencia"
    ) {
      return NextResponse.json(
        { error: "Medio de pago inválido. Debe ser 'efectivo' o 'transferencia'" },
        { status: 400 }
      );
    }

    // Obtener el tipo de cambio actual
    const exchange_rate = await getCurrentExchangeRate();

    // Procesar cliente
    let finalCustomerId = null;
    
    // Si se proporciona un cliente nuevo, crearlo primero
    if (customer_data && customer_data.name) {
      const newCustomer = await prisma.customer.create({
        data: {
          name: customer_data.name,
          whatsapp: customer_data.whatsapp || null,
          instagram: customer_data.instagram || null,
          facebook: customer_data.facebook || null,
          first_purchase_date: new Date(),
        },
      });
      finalCustomerId = newCustomer.id;
    } else if (customer_id) {
      // Verificar que el cliente existe
      const customer = await prisma.customer.findUnique({
        where: { id: customer_id },
      });
      
      if (!customer) {
        return NextResponse.json(
          { error: "Cliente no encontrado" },
          { status: 404 }
        );
      }
      
      finalCustomerId = customer_id;
      
      // Si este cliente nunca ha comprado antes, actualizar la fecha de primera compra
      if (!customer.first_purchase_date) {
        await prisma.customer.update({
          where: { id: customer_id },
          data: { first_purchase_date: new Date() },
        });
      }
    }

    // Calcular total y preparar items
    let total = 0;
    const saleItemsData = [];

    for (const item of items) {
      const { product_id, quantity } = item;
      
      // Obtener el producto
      const product = await prisma.product.findUnique({
        where: { id: product_id }
      });
      
      if (!product) {
        return NextResponse.json(
          { error: `Producto con ID ${product_id} no encontrado` },
          { status: 400 }
        );
      }
      
      // Verificar stock
      if (product.stock < quantity) {
        return NextResponse.json(
          { error: `Stock insuficiente para el producto ${product.name}` },
          { status: 400 }
        );
      }
      
      // Calcular precio de venta para este producto
      const selling_price = await calculateSellingPrice(product_id);
      
      // Actualizar stock
      await prisma.product.update({
        where: { id: product_id },
        data: {
          stock: {
            decrement: quantity
          }
        }
      });
      
      saleItemsData.push({
        product_id,
        quantity,
        selling_price, // Usamos el campo selling_price
        usd_price: selling_price, // Guardar precio en USD original
        exchange_rate // Guardar tipo de cambio aplicado
      });
      
      total += selling_price * quantity;
    }

    // Crear la venta con sus items
    const sale = await prisma.sale.create({
      data: {
        total,
        payment_method,
        customer: finalCustomerId ? {
          connect: { id: finalCustomerId }
        } : undefined,
        created_at: new Date(),
        updated_at: new Date(),
        exchange_rate,
        items: {
          create: saleItemsData
        }
      },
      include: {
        items: {
          include: {
            product: true
          }
        },
        customer: true
      }
    });

    return NextResponse.json(sale);
  } catch (error: any) {
    console.error("Error al crear la venta:", error);
    return NextResponse.json(
      { error: error.message || "Error al crear la venta" },
      { status: 500 }
    );
  }
} 