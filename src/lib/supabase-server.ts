import { createClient } from '@supabase/supabase-js';

// Solo para uso del lado del servidor - nunca exponer esta clave al cliente
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '' // Clave de service_role
);

export default supabaseAdmin; 