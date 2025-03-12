/**
 * Utilidades para cálculos y formato de precios en USD y ARS
 */
import { Prisma } from '@prisma/client';
import { Product } from '../types';

/**
 * Convierte un valor Prisma.Decimal, string o número a un valor numérico de JavaScript
 */
export function toNumber(value: Prisma.Decimal | string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  
  if (typeof value === 'number') return value;
  
  try {
    return parseFloat(value.toString());
  } catch (error) {
    console.error("Error converting value to number:", error);
    return 0;
  }
}

/**
 * Redondea un número al múltiplo de 0.5 más cercano
 * Ejemplo: 9.3 -> 9.5, 9.7 -> 9.5, 9.2 -> 9.0
 */
export function roundToNearestHalf(num: number): number {
  return Math.round(num * 2) / 2;
}

/**
 * Redondea hacia arriba al múltiplo de 500 más cercano
 * Ejemplo: 12300 -> 12500, 12700 -> 13000
 */
export function roundUpToNearest500(num: number): number {
  return Math.ceil(num / 500) * 500;
}

/**
 * Obtiene el margen de ganancia de un producto (desde su categoría o el valor por defecto)
 */
export function getProductMargin(product: Product, defaultMargin: number = 0.2): number {
  // Si el producto tiene una categoría con margen definido, usarlo
  if (product.category && product.category.profit_margin) {
    return toNumber(product.category.profit_margin);
  }
  
  // Si no, usar el margen por defecto
  return defaultMargin;
}

/**
 * Calcula el precio de venta en USD para un producto
 * Usa el margen de la categoría del producto o el margen por defecto
 */
export function calculateSellingPrice(product: Product, defaultMargin: number = 0.2): number {
  const basePrice = toNumber(product.price);
  const margin = getProductMargin(product, defaultMargin);
  
  // Calcular el precio con el margen correspondiente
  const priceWithMargin = basePrice * (1 + margin);
  
  // Redondear al múltiplo de 0.5 más cercano
  return roundToNearestHalf(priceWithMargin);
}

/**
 * Calcula el precio en USD redondeado al múltiplo de 0.5 más cercano
 * según la lógica de negocio.
 * 
 * @param basePrice Precio base del producto
 * @param categoryMargin Margen específico de la categoría (opcional)
 * @param defaultMargin Margen predeterminado a usar si no hay margen específico
 */
export function calculateUsdPrice(
  basePrice: Prisma.Decimal | number | string | undefined | null, 
  categoryMargin?: Prisma.Decimal | number | string | null, 
  defaultMargin: number = 0.2
): number {
  // Convertir valores a número
  const validBasePrice = toNumber(basePrice);
  const validDefaultMargin = defaultMargin;
  
  // Determinar qué margen usar (categoría o predeterminado)
  let marginToUse = validDefaultMargin;
  
  if (categoryMargin !== undefined && categoryMargin !== null) {
    marginToUse = toNumber(categoryMargin);
  }
  
  // Calcular el precio con el margen correspondiente
  const priceWithMargin = validBasePrice * (1 + marginToUse);
  
  // Redondear al múltiplo de 0.5 más cercano
  return roundToNearestHalf(priceWithMargin);
}

/**
 * Calcula el precio en ARS a partir del precio en USD y el tipo de cambio
 */
export function calculateArsPrice(
  usdPrice: Prisma.Decimal | number | string | undefined | null, 
  exchangeRate: Prisma.Decimal | number | string | undefined | null
): number {
  // Convertir valores a número
  const validUsdPrice = toNumber(usdPrice);
  const validRate = toNumber(exchangeRate);
  
  // Convertir de USD a ARS según el tipo de cambio
  const rawArsPrice = validUsdPrice * validRate;
  
  // Redondear hacia arriba al múltiplo de 500 más cercano
  return roundUpToNearest500(rawArsPrice);
}

/**
 * Formatea un precio en USD para mostrar
 */
export const formatUsdPrice = (price: Prisma.Decimal | number | string | null | undefined): string => {
  const validPrice = toNumber(price);
  if (isNaN(validPrice)) return "U$ 0,00";
  
  return `U$ ${validPrice.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

/**
 * Formatea un precio en ARS para mostrar
 */
export const formatArsPrice = (price: Prisma.Decimal | number | string | null | undefined): string => {
  const validPrice = toNumber(price);
  if (isNaN(validPrice)) return "AR$ 0,00";
  
  return `AR$ ${Math.round(validPrice).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

/**
 * Formatea el precio en ambas monedas para mostrar (USD y ARS)
 */
export function formatDualPrice(
  usdPrice: Prisma.Decimal | number | string | undefined | null, 
  arsPrice: Prisma.Decimal | number | string | undefined | null
): string {
  return `${formatUsdPrice(usdPrice)} | ${formatArsPrice(arsPrice)}`;
}

/**
 * Formatea un precio en USD y su equivalente en ARS usando el tipo de cambio
 */
export function formatPriceWithExchange(
  usdPrice: Prisma.Decimal | number | string | undefined | null,
  exchangeRate?: Prisma.Decimal | number | string | undefined | null
): string {
  const validUsdPrice = toNumber(usdPrice);
  
  // Si no hay tipo de cambio, mostrar solo en USD
  if (exchangeRate === undefined || exchangeRate === null) {
    return formatUsdPrice(validUsdPrice);
  }
  
  // Calcular y formatear el precio en ARS
  const arsPrice = calculateArsPrice(validUsdPrice, exchangeRate);
  return formatDualPrice(validUsdPrice, arsPrice);
}