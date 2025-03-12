import supabase from './supabase';
import getSupabaseAdmin from './supabase-server';
import { User as AuthUser } from '@supabase/supabase-js';

export type UserRole = 'admin' | 'vendedor' | 'anonimo';

export interface User {
  id: string;
  email: string;
  role: UserRole;
}

// Interfaz para los resultados de las operaciones
interface UserData {
  user: AuthUser;
}

// Función auxiliar para verificar entorno del servidor
function ensureServer() {
  if (typeof window !== 'undefined') {
    throw new Error('SEGURIDAD: Esta función solo debe llamarse desde el servidor');
  }
}

// =========== FUNCIONES DE CLIENTE ===========

// Función para iniciar sesión
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

// Función para cerrar sesión
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  
  if (error) {
    throw new Error(error.message);
  }
  
  return true;
}

// Función para obtener el usuario actual
export async function getCurrentUser(): Promise<User | null> {
  // Obtener la sesión actual
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    return null;
  }
  
  // Obtener el usuario autenticado
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    return null;
  }
  
  try {
    // Obtener el rol usando el endpoint personalizado
    const response = await fetch('/api/auth/get-user-role', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId: user.id }),
    });
    
    if (response.ok) {
      const data = await response.json();
      
      if (data.role) {
        return {
          id: user.id,
          email: user.email || '',
          role: data.role as UserRole
        };
      }
    }
    
    // Si no se puede obtener el rol, devolver el usuario con rol anónimo
    return {
      id: user.id,
      email: user.email || '',
      role: 'anonimo' as UserRole
    };
  } catch (err) {
    // En caso de error, devolvemos el usuario con rol anónimo
    return {
      id: user.id,
      email: user.email || '',
      role: 'anonimo' as UserRole
    };
  }
}

// =========== FUNCIONES DE SERVIDOR ===========
// Estas funciones solo deberían llamarse desde rutas API del servidor

// Función para crear un nuevo usuario (solo para admin)
export async function createUser(email: string, password: string, role: UserRole): Promise<UserData> {
  ensureServer();

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) {
    throw new Error(error.message);
  }

  // Crear el perfil del usuario con su rol
  try {
    // Usar método directo con fetch para evitar problemas de permisos
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Faltan configuraciones de Supabase');
    }
    
    const response = await fetch(
      `${supabaseUrl}/rest/v1/user_profiles`,
      {
        method: 'POST',
        headers: {
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({ user_id: data.user.id, role })
      }
    );
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Error al crear perfil de usuario: ${JSON.stringify(errorData)}`);
    }
  } catch (err: any) {
    throw new Error(`Error al crear perfil: ${err.message}`);
  }

  return data;
}

// Función para actualizar el rol de un usuario (solo para admin)
export async function updateUserRole(userId: string, role: UserRole): Promise<boolean> {
  ensureServer();

  try {
    // Usar método directo con fetch para evitar problemas de permisos
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Faltan configuraciones de Supabase');
    }
    
    // Verificar si el usuario ya tiene un perfil
    const checkProfileResponse = await fetch(
      `${supabaseUrl}/rest/v1/user_profiles?user_id=eq.${userId}&select=id`,
      {
        headers: {
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const existingProfiles = await checkProfileResponse.json();
    
    let operationResponse;
    
    if (existingProfiles && existingProfiles.length > 0) {
      // Si existe, actualizar
      operationResponse = await fetch(
        `${supabaseUrl}/rest/v1/user_profiles?user_id=eq.${userId}`,
        {
          method: 'PATCH',
          headers: {
            'apikey': serviceRoleKey,
            'Authorization': `Bearer ${serviceRoleKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify({ role })
        }
      );
    } else {
      // Si no existe, crear
      operationResponse = await fetch(
        `${supabaseUrl}/rest/v1/user_profiles`,
        {
          method: 'POST',
          headers: {
            'apikey': serviceRoleKey,
            'Authorization': `Bearer ${serviceRoleKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify({ user_id: userId, role })
        }
      );
    }
    
    if (!operationResponse.ok) {
      const errorData = await operationResponse.json();
      throw new Error(`Error en la operación: ${JSON.stringify(errorData)}`);
    }
    
    return true;
  } catch (err: any) {
    throw new Error(`Error al actualizar rol: ${err.message}`);
  }
}

// Función para eliminar un usuario (solo para admin)
export async function deleteUser(userId: string): Promise<boolean> {
  ensureServer();

  const supabaseAdmin = getSupabaseAdmin();
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);

  if (error) {
    throw new Error(error.message);
  }

  return true;
}

// Función para obtener todos los usuarios (solo para admin)
export async function getAllUsers(): Promise<User[]> {
  ensureServer();

  try {
    // Obtener lista de usuarios
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin.auth.admin.listUsers();

    if (error) {
      throw new Error(error.message);
    }

    // Obtener los perfiles con roles usando fetch directo
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Faltan configuraciones de Supabase');
    }
    
    const profilesResponse = await fetch(
      `${supabaseUrl}/rest/v1/user_profiles?select=user_id,role`,
      {
        headers: {
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (!profilesResponse.ok) {
      throw new Error('Error al obtener perfiles de usuario');
    }
    
    const profiles = await profilesResponse.json();

    // Combinar la información
    const usersWithRoles = data.users.map((user: AuthUser) => {
      const profile = profiles.find((p: { user_id: string }) => p.user_id === user.id);
      return {
        id: user.id,
        email: user.email || '',
        role: (profile?.role as UserRole) || 'anonimo'
      };
    });

    return usersWithRoles;
  } catch (err: any) {
    throw new Error(`Error al obtener usuarios: ${err.message}`);
  }
} 