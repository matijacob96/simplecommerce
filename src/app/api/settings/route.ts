import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET() {
  try {
    // Obtener la primera configuración o crear una por defecto si no existe
    let settings = await prisma.setting.findFirst();
    
    if (!settings) {
      const defaultSettings = await prisma.setting.create({
        data: {
          profit_margin: 0.2, // Mantenemos el nombre antiguo por retrocompatibilidad
        },
      });
      // Añadimos el campo nuevo para la respuesta
      return NextResponse.json({
        ...defaultSettings,
        default_profit_margin: defaultSettings.profit_margin
      });
    }
    
    // Añadimos el campo nuevo para la respuesta
    return NextResponse.json({
      ...settings,
      default_profit_margin: settings.profit_margin
    });
  } catch (error) {
    console.error("Error fetching settings:", error);
    return NextResponse.json(
      { error: "Error al obtener la configuración" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { default_profit_margin, profit_margin } = body;

    // Usamos el nuevo campo si está disponible, o el antiguo por compatibilidad
    const marginValue = default_profit_margin !== undefined ? default_profit_margin : profit_margin;

    // Validar los datos
    if (marginValue === undefined || isNaN(marginValue) || marginValue < 0 || marginValue > 1) {
      return NextResponse.json(
        { error: "El margen de beneficio debe ser un número entre 0 y 1" },
        { status: 400 }
      );
    }

    // Actualizar o crear la configuración
    const settings = await prisma.setting.findFirst();
    
    if (settings) {
      const updatedSettings = await prisma.setting.update({
        where: { id: settings.id },
        data: { profit_margin: marginValue }, // Usamos el campo profit_margin en la DB
      });
      // Añadimos el campo nuevo para la respuesta
      return NextResponse.json({
        ...updatedSettings,
        default_profit_margin: updatedSettings.profit_margin
      });
    } else {
      const newSettings = await prisma.setting.create({
        data: { profit_margin: marginValue }, // Usamos el campo profit_margin en la DB
      });
      // Añadimos el campo nuevo para la respuesta
      return NextResponse.json({
        ...newSettings,
        default_profit_margin: newSettings.profit_margin
      });
    }
  } catch (error) {
    console.error("Error updating settings:", error);
    return NextResponse.json(
      { error: "Error al actualizar la configuración" },
      { status: 500 }
    );
  }
}