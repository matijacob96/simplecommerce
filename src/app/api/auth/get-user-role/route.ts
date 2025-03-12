import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    // Obtener el ID del usuario desde la solicitud
    const { userId } = await request.json();
    
    if (!userId) {
      return NextResponse.json({ error: 'Se requiere ID de usuario' }, { status: 400 });
    }
    
    // Usar la API de Supabase directamente para evitar problemas de permisos
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Faltan configuraciones de Supabase');
    }
    
    // Obtener el perfil del usuario
    const response = await fetch(
      `${supabaseUrl}/rest/v1/user_profiles?user_id=eq.${userId}&select=role`,
      {
        headers: {
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (!response.ok) {
      // Si no se encuentra, enviar role anónimo
      return NextResponse.json({ role: 'anonimo' });
    }
    
    const profiles = await response.json();
    
    // Si no hay perfil o está vacío, devolver anónimo
    if (!profiles || profiles.length === 0) {
      // Intentar crear un perfil para este usuario
      try {
        const createResponse = await fetch(
          `${supabaseUrl}/rest/v1/user_profiles`,
          {
            method: 'POST',
            headers: {
              'apikey': serviceRoleKey,
              'Authorization': `Bearer ${serviceRoleKey}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=representation'
            },
            body: JSON.stringify({ user_id: userId, role: 'anonimo' })
          }
        );
        
        if (createResponse.ok) {
          return NextResponse.json({ role: 'anonimo' });
        }
      } catch (err) {
        // Silenciar error y continuar
      }
      
      return NextResponse.json({ role: 'anonimo' });
    }
    
    // Devolver el rol del usuario
    return NextResponse.json({ role: profiles[0].role });
    
  } catch (error: any) {
    return NextResponse.json(
      { 
        error: error.message || 'Error al obtener rol',
        details: error.details || error.stack || 'Sin detalles adicionales'
      }, 
      { status: 500 }
    );
  }
} 