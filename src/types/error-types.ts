/**
 * Tipos y utilidades para manejar errores de manera consistente en toda la aplicación.
 */

/**
 * Interfaz para errores con un mensaje
 */
export interface ErrorWithMessage {
  message: string;
}

/**
 * Type guard para verificar si un error tiene la propiedad mensaje
 */
export function hasErrorMessage(error: unknown): error is ErrorWithMessage {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as Record<string, unknown>).message === 'string'
  );
}

/**
 * Extrae un mensaje de error de cualquier tipo de error
 */
export function getErrorMessage(error: unknown): string {
  if (hasErrorMessage(error)) {
    return error.message;
  }

  // Si es una string, retornarla directamente
  if (typeof error === 'string') {
    return error;
  }

  // Si tiene un toString() útil (no el predeterminado de [object Object])
  const errorString = String(error);
  if (errorString !== '[object Object]') {
    return errorString;
  }

  // Fallback para cualquier otro tipo de error
  return 'Error desconocido';
}

/**
 * Interfaz para errores de API con campos adicionales comunes
 */
export interface ApiError extends ErrorWithMessage {
  code?: string | number;
  details?: unknown;
  path?: string;
}

/**
 * Type guard para verificar si un error es un ApiError
 */
export function isApiError(error: unknown): error is ApiError {
  return (
    hasErrorMessage(error) &&
    (('code' in error &&
      (typeof (error as ApiError).code === 'string' ||
        typeof (error as ApiError).code === 'number')) ||
      'details' in error ||
      'path' in error)
  );
}
