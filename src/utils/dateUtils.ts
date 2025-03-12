/**
 * Utilidades para el manejo y formateo de fechas
 */

/**
 * Formatea una fecha en formato legible en español
 */
export function formatDate(dateString: string): string {
  try {
    // Verificar si la fecha es válida
    if (!dateString || isNaN(Date.parse(dateString))) {
      return 'Fecha no disponible';
    }
    
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  } catch (error) {
    console.error('Error al formatear fecha:', error);
    return 'Fecha no disponible';
  }
}

/**
 * Obtiene la fecha actual en formato ISO
 */
export function getCurrentDateISO(): string {
  return new Date().toISOString();
}

/**
 * Formatea una fecha en formato corto (DD/MM/YYYY)
 */
export function formatShortDate(dateString: string): string {
  try {
    if (!dateString || isNaN(Date.parse(dateString))) {
      return 'N/A';
    }
    
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(date);
  } catch (error) {
    console.error('Error al formatear fecha corta:', error);
    return 'N/A';
  }
} 