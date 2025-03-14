import { NextResponse } from 'next/server';
import { getErrorMessage } from '@/types/error-types';

// Cache de la respuesta para no hacer demasiadas peticiones al sitio externo
let cachedData: { compra: number; venta: number; timestamp: number } | null = null;
const CACHE_LIFETIME = 1000 * 60 * 15; // 15 minutos

// Valor por defecto en caso de no poder obtener el precio (1250 pesos)
const DEFAULT_BLUE_RATE = 1250;

// URL directa de la API
const API_URL = 'https://backend-ifa-production-a92c.up.railway.app/api/dolar/v2/general';

// Interfaces para tipar los datos de la API externa
interface DolarItem {
  titulo?: string;
  venta: string;
  compra: string;
}

interface APIResponse {
  panel?: DolarItem[];
  publicidades?: DolarItem[];
}

export async function GET() {
  try {
    // Verificar si tenemos datos en caché válidos
    const now = Date.now();
    if (cachedData && now - cachedData.timestamp < CACHE_LIFETIME) {
      return NextResponse.json({
        success: true,
        data: {
          compra: cachedData.compra,
          venta: cachedData.venta,
          fromCache: true,
          timestamp: cachedData.timestamp,
        },
      });
    }

    // Realizar solicitud directa a la API
    const response = await fetch(API_URL, {
      headers: {
        'sec-ch-ua-platform': '"macOS"',
        Referer: 'https://www.finanzasargy.com/',
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
        Accept: 'application/json, text/plain, */*',
        'sec-ch-ua': '"Not(A:Brand";v="99", "Google Chrome";v="133", "Chromium";v="133"',
        'api-client': 'finanzasargy',
        'sec-ch-ua-mobile': '?0',
      },
      next: { revalidate: 3600 }, // 1 hora
    });

    if (!response.ok) {
      throw new Error(`Error al obtener datos: ${response.status}`);
    }

    const data: APIResponse = await response.json();
    let venta = 0;
    let compra = 0;

    // La estructura tiene un array llamado "panel" donde cada item es un tipo de dólar
    if (data.panel && Array.isArray(data.panel)) {
      // Buscar el objeto con título "Dólar Blue"
      const blueData = data.panel.find((item: DolarItem) =>
        item.titulo?.toLowerCase().includes('blue')
      );

      if (blueData) {
        // Convertir a número y eliminar cualquier carácter no numérico
        venta = parseFloat(blueData.venta.replace(/[^\d.,]/g, '').replace(',', '.'));
        compra = parseFloat(blueData.compra.replace(/[^\d.,]/g, '').replace(',', '.'));
      }
    }

    // Si no encontramos en el panel, buscar en publicidades
    if ((!venta || !compra) && data.publicidades && Array.isArray(data.publicidades)) {
      const pubData = data.publicidades.find(
        (item: DolarItem) =>
          item.titulo?.toLowerCase().includes('dólar') ||
          item.titulo?.toLowerCase().includes('dolar')
      );

      if (pubData) {
        venta = parseFloat(pubData.venta.replace(/[^\d.,]/g, '').replace(',', '.'));
        compra = parseFloat(pubData.compra.replace(/[^\d.,]/g, '').replace(',', '.'));
      }
    }

    // Verificar si obtuvimos valores válidos, si no, usar valores predeterminados
    if (isNaN(venta) || venta <= 0) {
      console.warn('No se pudo obtener el valor de venta, usando valor por defecto');
      venta = DEFAULT_BLUE_RATE;
    }

    if (isNaN(compra) || compra <= 0) {
      console.warn('No se pudo obtener el valor de compra, usando valor por defecto');
      compra = DEFAULT_BLUE_RATE * 0.97; // Típicamente la compra es algo menor
    }

    // Actualizar caché
    cachedData = {
      compra,
      venta,
      timestamp: now,
    };

    return NextResponse.json({
      success: true,
      data: {
        compra,
        venta,
        fromCache: false,
        timestamp: now,
      },
    });
  } catch (error: unknown) {
    console.error('Error fetching dolar blue rate:', error);
    return NextResponse.json(
      {
        success: false,
        error: getErrorMessage(error) || 'Error al obtener la cotización del dólar',
        fallbackData: {
          compra: DEFAULT_BLUE_RATE,
          venta: DEFAULT_BLUE_RATE,
        },
      },
      { status: 500 }
    );
  }
}
