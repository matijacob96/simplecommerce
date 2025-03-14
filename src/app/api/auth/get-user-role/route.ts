import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Definimos una interfaz para los errores que podemos recibir
interface ErrorWithDetails extends Error {
  details?: string;
  stack?: string;
}

export async function POST(request: Request) {
  try {
    // Obtener el ID del usuario desde la solicitud
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'Se requiere ID de usuario' }, { status: 400 });
    }

    // Usar la API de Supabase directamente para obtener el usuario completo
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Faltan configuraciones de Supabase');
    }

    // Crear un cliente de Supabase con el service role key
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Obtener información del usuario usando la API de admin
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);

    if (userError || !userData || !userData.user) {
      console.error('Error al obtener usuario:', userError);
      return NextResponse.json({ role: 'anonimo' });
    }

    // Obtener el rol desde app_metadata.provider
    let role = 'anonimo';
    let roleSource = 'default';

    const appMetadata = userData.user.app_metadata;

    // Verificar si el correo es el administrador principal
    if (userData.user.email === 'matijacob1996@gmail.com') {
      role = 'admin';
      roleSource = 'email_match';
    }
    // Si hay app_metadata.provider, usarlo como rol
    else if (appMetadata && typeof appMetadata === 'object' && 'provider' in appMetadata) {
      const providerValue = appMetadata.provider;
      if (typeof providerValue === 'string') {
        role = providerValue;
        roleSource = 'app_metadata.provider';
      }
    }

    // Validar que el rol sea uno de los permitidos
    const validRoles = ['admin', 'vendedor', 'anonimo'];
    if (!validRoles.includes(role)) {
      role = 'anonimo';
    }

    return NextResponse.json({ role, roleSource });
  } catch (error: Error | ErrorWithDetails | unknown) {
    console.error('Error al obtener rol:', error);

    // Manejamos los diferentes tipos de error de forma segura
    let errorMessage = 'Error al obtener rol';
    let errorDetails = 'Sin detalles adicionales';

    if (error instanceof Error) {
      errorMessage = error.message;

      // Si es nuestro tipo personalizado con detalles
      if ('details' in error) {
        const typedError = error as ErrorWithDetails;
        errorDetails = typedError.details || typedError.stack || 'Sin detalles adicionales';
      } else {
        errorDetails = error.stack || 'Sin detalles adicionales';
      }
    }

    return NextResponse.json(
      {
        error: errorMessage,
        details: errorDetails,
      },
      { status: 500 }
    );
  }
}
