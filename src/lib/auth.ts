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

// Constantes para almacenamiento local
const AUTH_TOKEN_KEY = 'simplecommerce_auth_token';
const AUTH_USER_KEY = 'simplecommerce_auth_user';
const AUTH_REFRESH_TOKEN_KEY = 'simplecommerce_refresh_token';
const AUTH_EXPIRY_KEY = 'simplecommerce_auth_expiry';

// Función auxiliar para verificar entorno del servidor
function ensureServer() {
  if (typeof window !== 'undefined') {
    throw new Error('SEGURIDAD: Esta función solo debe llamarse desde el servidor');
  }
}

// Función auxiliar para guardar tokens en localStorage
function saveAuthData(token: string, refreshToken: string, expiresIn: number, user: User) {
  if (typeof window === 'undefined') return;
  
  try {
    const expiryTime = Date.now() + expiresIn * 1000;
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    localStorage.setItem(AUTH_REFRESH_TOKEN_KEY, refreshToken);
    localStorage.setItem(AUTH_EXPIRY_KEY, expiryTime.toString());
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    
    console.log('✅ Datos de autenticación guardados localmente');
  } catch (error) {
    console.error('Error al guardar datos de autenticación:', error);
  }
}

// Función auxiliar para limpiar tokens de localStorage
function clearAuthData() {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_REFRESH_TOKEN_KEY);
    localStorage.removeItem(AUTH_EXPIRY_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
    
    console.log('🧹 Datos de autenticación eliminados localmente');
  } catch (error) {
    console.error('Error al limpiar datos de autenticación:', error);
  }
}

// Función para obtener el token almacenado
export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  } catch (error) {
    console.error('Error al leer token:', error);
    return null;
  }
}

// Función para obtener el usuario almacenado
export function getStoredUser(): User | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const userData = localStorage.getItem(AUTH_USER_KEY);
    if (!userData) return null;
    return JSON.parse(userData) as User;
  } catch (error) {
    console.error('Error al leer usuario:', error);
    return null;
  }
}

// Función para verificar si el token está por expirar
export function isTokenExpiringSoon(): boolean {
  if (typeof window === 'undefined') return true;
  
  try {
    const expiryTimeStr = localStorage.getItem(AUTH_EXPIRY_KEY);
    if (!expiryTimeStr) return true;
    
    const expiryTime = parseInt(expiryTimeStr);
    // Si expira en menos de 5 minutos, considerarlo como "expirando pronto"
    return Date.now() > expiryTime - 5 * 60 * 1000;
  } catch (error) {
    console.error('Error al verificar expiración:', error);
    return true;
  }
}

// Función para refrescar el token
export async function refreshToken(): Promise<boolean> {
  try {
    console.log('🔄 Intentando refrescar token...');
    const { data, error } = await supabase.auth.refreshSession();
    
    if (error || !data.session) {
      console.error('Error al refrescar token:', error);
      clearAuthData();
      return false;
    }
    
    // Actualizar token en localStorage
    const user = await getUserFromSession(data.session);
    if (user) {
      saveAuthData(
        data.session.access_token, 
        data.session.refresh_token, 
        data.session.expires_in || 3600,
        user
      );
      return true;
    }
    
    return false;
  } catch (err) {
    console.error('Error inesperado al refrescar token:', err);
    clearAuthData();
    return false;
  }
}

// Función auxiliar para obtener usuario a partir de sesión
async function getUserFromSession(session: any): Promise<User | null> {
  if (!session || !session.user) return null;
  
  const user = session.user;
  
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
    console.error('Error al obtener rol del usuario:', err);
    // En caso de error, devolvemos el usuario con rol anónimo
    return {
      id: user.id,
      email: user.email || '',
      role: 'anonimo' as UserRole
    };
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

  // Guardar token en localStorage
  if (data.session) {
    const user = await getUserFromSession(data.session);
    if (user) {
      saveAuthData(
        data.session.access_token, 
        data.session.refresh_token, 
        data.session.expires_in || 3600,
        user
      );
    }
  }

  return data;
}

// Función para cerrar sesión
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  
  // Limpiar tokens de localStorage independientemente del resultado
  clearAuthData();
  
  if (error) {
    throw new Error(error.message);
  }
  
  return true;
}

// Función para obtener el usuario actual
export async function getCurrentUser(): Promise<User | null> {
  console.log('🔍 Obteniendo usuario actual...');
  
  // 1. Primero intentar obtener del almacenamiento local para respuesta inmediata
  const storedUser = getStoredUser();
  const storedToken = getStoredToken();
  
  // Si tenemos un usuario almacenado y el token no está por expirar, usarlo
  if (storedUser && storedToken && !isTokenExpiringSoon()) {
    console.log('✅ Usuario obtenido de almacenamiento local:', storedUser.email);
    return storedUser;
  }
  
  // 2. Si el token está por expirar, intentar refrescarlo
  if (storedToken && isTokenExpiringSoon()) {
    console.log('⚠️ Token por expirar, intentando refrescar...');
    const refreshed = await refreshToken();
    if (refreshed) {
      // Si se refrescó correctamente, devolver el usuario almacenado actualizado
      const updatedUser = getStoredUser();
      if (updatedUser) {
        console.log('✅ Usuario obtenido después de refrescar token:', updatedUser.email);
        return updatedUser;
      }
    }
  }
  
  // 3. Si no hay datos locales o el refresco falló, intentar obtener la sesión actual
  try {
    console.log('🔄 Obteniendo sesión del servidor...');
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      console.log('❌ No hay sesión activa');
      clearAuthData();
      return null;
    }
    
    // Obtener el usuario autenticado
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      console.log('❌ Error al obtener usuario:', error);
      clearAuthData();
      return null;
    }
    
    // Obtener información completa del usuario
    const userInfo = await getUserFromSession(session);
    
    // Guardar la información actualizada
    if (userInfo && session) {
      saveAuthData(
        session.access_token,
        session.refresh_token,
        session.expires_in || 3600,
        userInfo
      );
    }
    
    return userInfo;
  } catch (err) {
    console.error('Error inesperado al obtener usuario:', err);
    clearAuthData();
    return null;
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

// Implementar esta función para buscar el archivo 