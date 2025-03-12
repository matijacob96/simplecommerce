import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { Prisma, SaleItem } from "@prisma/client";

// Importamos la función para obtener el tipo de cambio
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

// GET para obtener una venta específica por ID
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
        { error: "ID de venta inválido" },
        { status: 400 }
      );
    }

    const sale = await prisma.sale.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        customer: true,
      },
    });

    if (!sale) {
      return NextResponse.json(
        { error: "Venta no encontrada" },
        { status: 404 }
      );
    }

    return NextResponse.json(sale);
  } catch (error) {
    console.error("Error al obtener venta:", error);
    return NextResponse.json(
      { error: "Error al obtener la venta" },
      { status: 500 }
    );
  }
}

// PUT para actualizar una venta
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
        { error: "ID de venta inválido" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { items, payment_method, customer_id = null, customer_data = null } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "Se requieren items válidos para la venta" },
        { status: 400 }
      );
    }

    // Validar medio de pago si se proporciona
    if (payment_method && payment_method !== "efectivo" && payment_method !== "transferencia") {
      return NextResponse.json(
        { error: "Medio de pago inválido. Debe ser 'efectivo' o 'transferencia'" },
        { status: 400 }
      );
    }

    // Obtener la venta actual para restaurar stock si es necesario
    const currentSale = await prisma.sale.findUnique({
      where: { id },
      include: {
        items: true,
      },
    });

    if (!currentSale) {
      return NextResponse.json(
        { error: "Venta no encontrada" },
        { status: 404 }
      );
    }

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

    // Restaurar stock de los items actuales antes de actualizar
    for (const currentItem of currentSale.items) {
      await prisma.product.update({
        where: { id: currentItem.product_id },
        data: {
          stock: {
            increment: currentItem.quantity
          }
        }
      });
    }

    // Eliminar todos los items actuales para la venta
    await prisma.saleItem.deleteMany({
      where: {
        sale_id: id
      }
    });

    // Calcular total y crear nuevos items
    let total = 0;
    const newSaleItems = [];

    for (const item of items) {
      const { product_id, quantity, id: itemId } = item;
      
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
      
      // Obtener el tipo de cambio actual si no existe uno
      let exchange_rate_value = 0;
      
      // Verificar si hay un campo exchange_rate definido en la venta actual
      // @ts-ignore - Ignoramos error de tipo ya que sabemos que el campo existe en la DB aunque no en el tipo
      if (currentSale.exchange_rate) {
        // @ts-ignore
        exchange_rate_value = parseFloat(currentSale.exchange_rate.toString());
      }
      
      // Si no hay un tipo de cambio válido, obtener uno nuevo
      if (!exchange_rate_value || exchange_rate_value === 0) {
        exchange_rate_value = await getCurrentExchangeRate();
      }
      
      // Crear nuevo item
      const newItem = await prisma.saleItem.create({
        data: {
          sale_id: id,
          product_id,
          quantity,
          selling_price  // Guardar el precio de venta en USD
        }
      });
      
      newSaleItems.push(newItem);
      total += selling_price * quantity;
    }
    
    // Obtener el tipo de cambio actual si no existe uno
    let exchange_rate_value = 0;
    
    // Verificar si hay un campo exchange_rate definido en la venta actual
    // @ts-ignore - Ignoramos error de tipo ya que sabemos que el campo existe en la DB aunque no en el tipo
    if (currentSale.exchange_rate) {
      // @ts-ignore
      exchange_rate_value = parseFloat(currentSale.exchange_rate.toString());
    }
    
    // Si no hay un tipo de cambio válido, obtener uno nuevo
    if (!exchange_rate_value || exchange_rate_value === 0) {
      exchange_rate_value = await getCurrentExchangeRate();
    }

    // Actualizar la venta - usar Prisma.Decimal.cast para el exchange_rate
    const updatedSale = await prisma.sale.update({
      where: { id },
      data: {
        total,
        payment_method: payment_method || "efectivo",
        customer_id: finalCustomerId,
        updated_at: new Date(),
        // @ts-ignore - Ignoramos error de tipo ya que sabemos que el campo existe en la DB aunque no en el tipo
        exchange_rate: exchange_rate_value
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

    return NextResponse.json(updatedSale);
  } catch (error: any) {
    console.error("Error al actualizar la venta:", error);
    return NextResponse.json(
      { error: error.message || "Error al actualizar la venta" },
      { status: 500 }
    );
  }
}

// DELETE para eliminar una venta
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
        { error: "ID de venta inválido" },
        { status: 400 }
      );
    }

    // Comprobar si la venta existe
    const existingSale = await prisma.sale.findUnique({
      where: { id },
      include: {
        items: true,
      },
    });

    if (!existingSale) {
      return NextResponse.json(
        { error: "Venta no encontrada" },
        { status: 404 }
      );
    }

    // Iniciar una transacción para garantizar que todas las operaciones sean atómicas
    await prisma.$transaction(
      async (tx) => {
        // Primero, restaurar el stock de los productos de la venta
        for (const item of existingSale.items) {
          await tx.product.update({
            where: { id: item.product_id },
            data: { stock: { increment: item.quantity } },
          });
        }

        // Eliminar la venta (los items se eliminarán automáticamente gracias a onDelete: Cascade)
        await tx.sale.delete({
          where: { id },
        });
      },
      {
        // Configuración de la transacción: aumentar el tiempo de espera a 15 segundos
        timeout: 15000, // 15 segundos en lugar de los 5 segundos predeterminados
        maxWait: 15000, // Tiempo máximo de espera para adquirir una conexión
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted // Nivel de aislamiento
      }
    );

    return NextResponse.json({ success: true, message: "Venta eliminada correctamente" });
  } catch (error) {
    console.error("Error al eliminar la venta:", error);
    return NextResponse.json(
      { error: "Error al eliminar la venta" },
      { status: 500 }
    );
  }
} 