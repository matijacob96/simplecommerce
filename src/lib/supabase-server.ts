import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/database.types';

// Crear un objeto de error personalizado para cliente
class SupabaseAdminClientError extends Error {
  constructor() {
    super('ERROR DE SEGURIDAD: No se puede usar supabaseAdmin en el cliente');
    this.name = 'SupabaseAdminClientError';
  }
}

// Función segura para obtener una instancia de Supabase Admin solo en el servidor
export default function getSupabaseAdmin(): SupabaseClient<Database> {
  // Verificar que estamos en el servidor
  if (typeof window !== 'undefined') {
    // En desarrollo, mostrar un error claro
    if (process.env.NODE_ENV === 'development') {
      console.error('===== ERROR DE SEGURIDAD CRÍTICO =====');
      console.error('Intentando usar supabaseAdmin en el cliente. Esto es un riesgo de seguridad grave.');
      console.error('El cliente supabaseAdmin debe usarse ÚNICAMENTE en el servidor.');
      console.error('Revise su código para eliminar todas las importaciones de supabase-server en componentes cliente.');
      console.error('=====================================');
    }
    
    // Lanzar un error para detener la ejecución
    throw new SupabaseAdminClientError();
  }
  
  // Crear el cliente solo cuando estamos en el servidor
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Faltan las variables de entorno necesarias para crear el cliente Supabase Admin');
  }
  
  // Crear una nueva instancia cada vez (evita problemas de estado compartido)
  return createClient<Database>(supabaseUrl, supabaseServiceKey);
} 