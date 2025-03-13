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
    throw new Error(
      'SEGURIDAD: Esta función solo debe llamarse desde el servidor'
    );
  }
}

// Función auxiliar para guardar tokens en localStorage
function saveAuthData(
  token: string,
  refreshToken: string,
  expiresIn: number,
  user: User
) {
  if (typeof window === 'undefined') return;

  try {
    const expiryTime = Date.now() + expiresIn * 1000;
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    localStorage.setItem(AUTH_REFRESH_TOKEN_KEY, refreshToken);
    localStorage.setItem(AUTH_EXPIRY_KEY, expiryTime.toString());
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
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
    if (!expiryTimeStr) {
      console.log('[Auth] No hay tiempo de expiración almacenado');
      return true;
    }

    const expiryTime = parseInt(expiryTimeStr);
    const currentTime = Date.now();
    const timeRemaining = expiryTime - currentTime;

    // Si expira en menos de 10 minutos, considerarlo como "expirando pronto"
    // Aumentamos de 5 a 10 minutos para ser más preventivos
    const isExpiringSoon = timeRemaining < 10 * 60 * 1000;

    if (isExpiringSoon) {
      console.log(
        `[Auth] Token expirará pronto. Tiempo restante: ${Math.floor(
          timeRemaining / 1000
        )} segundos`
      );
    }

    return isExpiringSoon;
  } catch (error) {
    console.error('[Auth] Error al verificar expiración:', error);
    return true;
  }
}

// Función para refrescar el token
export async function refreshToken(): Promise<boolean> {
  try {
    // Verificar si hay un token almacenado antes de intentar refrescar
    const storedToken = getStoredToken();
    if (!storedToken) {
      console.log('[Auth] No hay token almacenado, no se intentará refrescar');
      return false;
    }

    console.log('[Auth] Intentando refrescar token...');
    const { data, error } = await supabase.auth.refreshSession();

    if (error) {
      // Manejar específicamente el error de sesión faltante
      if (error.message.includes('Auth session missing')) {
        console.error('[Auth] Error: Sesión de autenticación faltante', error);
        clearAuthData();
        return false;
      }

      // Otros errores
      console.error('[Auth] Error al refrescar token:', error);
      clearAuthData();
      return false;
    }

    if (!data.session) {
      console.error('[Auth] Error: No se obtuvo una sesión nueva');
      clearAuthData();
      return false;
    }

    // Actualizar token en localStorage
    const user = await getUserFromSession(data.session);
    if (user) {
      console.log('[Auth] Token refrescado correctamente');
      saveAuthData(
        data.session.access_token,
        data.session.refresh_token,
        data.session.expires_in || 3600,
        user
      );
      return true;
    }

    console.error('[Auth] Error: No se pudo obtener información del usuario');
    return false;
  } catch (err) {
    console.error('[Auth] Error inesperado al refrescar token:', err);
    clearAuthData();
    return false;
  }
}

// Función auxiliar para obtener usuario a partir de sesión
async function getUserFromSession(session: {
  user?: { id: string; email?: string; app_metadata?: Record<string, unknown> };
}): Promise<User | null> {
  if (!session || !session.user) return null;

  const user = session.user;

  try {
    // Verificar si los metadatos de la app ya contienen el rol
    if (
      user.app_metadata &&
      typeof user.app_metadata === 'object' &&
      'provider' in user.app_metadata &&
      user.app_metadata.provider
    ) {
      // Type guard para garantizar que provider es de tipo string
      const providerRole =
        typeof user.app_metadata.provider === 'string'
          ? user.app_metadata.provider
          : null;

      // Verificar que sea un rol válido
      if (
        providerRole &&
        ['admin', 'vendedor', 'anonimo'].includes(providerRole)
      ) {
        return {
          id: user.id,
          email: user.email || '',
          role: providerRole as UserRole
        };
      }
    }

    // Si no tiene rol en los metadatos, obtenerlo del servidor
    const response = await fetch('/api/auth/get-user-role', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ userId: user.id })
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
    } else {
      console.error('Error al obtener rol:', await response.text());
    }

    // Verificar si el email es el administrador principal
    if (user.email === 'matijacob1996@gmail.com') {
      return {
        id: user.id,
        email: user.email,
        role: 'admin'
      };
    }

    // Si no se pudo determinar un rol específico, asumir anónimo
    return {
      id: user.id,
      email: user.email || '',
      role: 'anonimo'
    };
  } catch {
    // Si hay error al obtener la sesión, limpiar datos locales
    clearAuthData();
    return null;
  }
}

// =========== FUNCIONES DE CLIENTE ===========

// Función para iniciar sesión
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
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
  console.log('[Auth] Iniciando obtención de usuario actual...');

  // 1. Primero intentar obtener del almacenamiento local para respuesta inmediata
  const storedUser = getStoredUser();
  const storedToken = getStoredToken();

  // Si no hay token, probablemente es usuario anónimo
  if (!storedToken) {
    console.log('[Auth] No hay token almacenado, retornando null');
    return null;
  }

  // Si tenemos un usuario almacenado y el token no está por expirar, usarlo
  if (storedUser && storedToken && !isTokenExpiringSoon()) {
    console.log('[Auth] Utilizando usuario almacenado (token válido)');
    return storedUser;
  }

  // 2. Si el token está por expirar, intentar refrescarlo
  if (storedToken && isTokenExpiringSoon()) {
    console.log('[Auth] Token por expirar, intentando refrescarlo');
    try {
      // Añadir timeout para evitar bloqueo indefinido
      const refreshPromise = refreshToken();
      const timeoutPromise = new Promise<boolean>((resolve) => {
        setTimeout(() => {
          console.error('[Auth] Timeout al refrescar token');
          resolve(false);
        }, 5000); // 5 segundos de timeout
      });

      // Esperar a que se complete la primera promesa (refresco o timeout)
      const refreshed = await Promise.race([refreshPromise, timeoutPromise]);

      if (refreshed) {
        // Si se refrescó correctamente, devolver el usuario almacenado actualizado
        console.log('[Auth] Token refrescado exitosamente');
        const updatedUser = getStoredUser();
        if (updatedUser) {
          return updatedUser;
        }
      } else {
        console.log('[Auth] Falló el refresco, intentando obtener sesión');
      }
    } catch (error) {
      console.error('[Auth] Error al refrescar token:', error);
      // Continuar al siguiente paso si falla el refresco
    }
  }

  // 3. Si no hay token o falló el refresco, intentar obtener la sesión actual
  console.log('[Auth] Intentando obtener sesión directamente de Supabase');
  try {
    // Añadir timeout para la obtención de sesión
    const sessionPromise = supabase.auth.getSession();
    const timeoutPromise = new Promise((resolve) => {
      setTimeout(() => {
        console.error('[Auth] Timeout al obtener sesión');
        resolve({ data: { session: null } });
      }, 5000); // 5 segundos de timeout
    });

    // Esperar la primera promesa que se complete
    const result = (await Promise.race([sessionPromise, timeoutPromise])) as {
      data: { session: unknown };
    };

    // Verificar que result tiene la estructura esperada
    if (
      !result ||
      typeof result !== 'object' ||
      !('data' in result) ||
      !result.data ||
      typeof result.data !== 'object' ||
      !('session' in result.data)
    ) {
      console.error('[Auth] Resultado inesperado al obtener sesión:', result);
      clearAuthData();
      return null;
    }

    const { session } = result.data;

    if (!session) {
      console.log('[Auth] No se encontró sesión activa');
      clearAuthData(); // Limpiar datos locales si no hay sesión en el servidor
      return null;
    }

    // Verificar que session tiene la estructura mínima necesaria para getUserFromSession
    if (typeof session !== 'object') {
      console.error('[Auth] Sesión no es un objeto:', session);
      clearAuthData();
      return null;
    }

    // Type guard para verificar que session tiene las propiedades necesarias
    const isValidSession = (
      sess: unknown
    ): sess is {
      access_token: string;
      refresh_token: string;
      expires_in?: number;
      user?: {
        id: string;
        email?: string;
        app_metadata?: Record<string, unknown>;
      };
    } => {
      return (
        typeof sess === 'object' &&
        sess !== null &&
        'access_token' in sess &&
        typeof sess.access_token === 'string' &&
        'refresh_token' in sess &&
        typeof sess.refresh_token === 'string' &&
        (!('user' in sess) ||
          (typeof sess.user === 'object' &&
            sess.user !== null &&
            'id' in sess.user &&
            typeof sess.user.id === 'string'))
      );
    };

    if (!isValidSession(session)) {
      console.error(
        '[Auth] Sesión inválida, faltan propiedades requeridas:',
        session
      );
      clearAuthData();
      return null;
    }

    console.log('[Auth] Sesión obtenida, recuperando información de usuario');
    // Obtener usuario desde la sesión
    const user = await getUserFromSession(session);
    if (user) {
      console.log('[Auth] Usuario recuperado correctamente');
      // Actualizar almacenamiento local con los datos nuevos
      saveAuthData(
        session.access_token,
        session.refresh_token,
        session.expires_in || 3600,
        user
      );
      return user;
    }

    console.log('[Auth] No se pudo recuperar información del usuario');
    return null;
  } catch (error: unknown) {
    // Si hay error al obtener la sesión, limpiar datos locales
    console.error('[Auth] Error al obtener la sesión:', error);
    clearAuthData();
    return null;
  }
}

// =========== FUNCIONES DE SERVIDOR ===========
// Estas funciones solo deberían llamarse desde rutas API del servidor

// Función para crear un nuevo usuario (solo para admin)
export async function createUser(
  email: string,
  password: string,
  role: UserRole
): Promise<UserData> {
  ensureServer();

  // Usar Supabase Admin para crear el usuario con el rol en los metadatos
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { provider: role }
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

// Función para actualizar el rol de un usuario (solo para admin)
export async function updateUserRole(
  userId: string,
  role: UserRole
): Promise<boolean> {
  ensureServer();

  try {
    // Usar Supabase Admin para actualizar los metadatos del usuario
    const supabaseAdmin = getSupabaseAdmin();

    // Actualizar el rol en app_metadata
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      app_metadata: { provider: role }
    });

    if (error) {
      console.error('Error al actualizar rol del usuario:', error);
      throw new Error(`Error al actualizar rol: ${error.message}`);
    }

    return true;
  } catch (err: Error | unknown) {
    const errorMessage =
      err instanceof Error ? err.message : 'Error desconocido';
    throw new Error(`Error al actualizar rol: ${errorMessage}`);
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

    // Transformar los datos para obtener los roles desde los metadatos
    const usersWithRoles = data.users.map((user: AuthUser) => {
      // Intentar obtener el rol desde los metadatos
      let role: UserRole = 'anonimo';

      // Verificar app_metadata
      if (user.app_metadata && typeof user.app_metadata === 'object') {
        if (
          'provider' in user.app_metadata &&
          typeof user.app_metadata.provider === 'string'
        ) {
          const providerRole = user.app_metadata.provider;
          if (['admin', 'vendedor', 'anonimo'].includes(providerRole)) {
            role = providerRole as UserRole;
          }
        }
      }

      // Verificar también raw_app_meta_data por si acaso
      type UserWithRawMetadata = AuthUser & {
        raw_app_meta_data?: { provider?: string };
      };
      const userWithRawMetadata = user as UserWithRawMetadata;

      if (userWithRawMetadata.raw_app_meta_data) {
        const rawAppMetadata = userWithRawMetadata.raw_app_meta_data;
        if (
          'provider' in rawAppMetadata &&
          typeof rawAppMetadata.provider === 'string'
        ) {
          const providerRole = rawAppMetadata.provider;
          if (['admin', 'vendedor', 'anonimo'].includes(providerRole)) {
            role = providerRole as UserRole;
          }
        }
      }

      return {
        id: user.id,
        email: user.email || '',
        role: role
      };
    });

    return usersWithRoles;
  } catch (err: Error | unknown) {
    const errorMessage =
      err instanceof Error ? err.message : 'Error desconocido';
    throw new Error(`Error al obtener usuarios: ${errorMessage}`);
  }
}

// Implementar esta función para buscar el archivo
