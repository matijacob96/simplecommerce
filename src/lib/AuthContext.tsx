'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  UserRole,
  getCurrentUser,
  signIn,
  signOut,
  getStoredUser,
  isTokenExpiringSoon,
  refreshToken,
  getStoredToken,
} from './auth';
import supabase from './supabase';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  userRole: UserRole;
  authError: Error | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (requiredRoles: UserRole[]) => boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Inicializar con null para evitar problemas de hidratación
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<Error | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Función para cargar el usuario actual
  const loadUser = async () => {
    try {
      setIsLoading(true);
      setAuthError(null);
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    } catch (error: unknown) {
      console.error('Error al cargar usuario:', error);
      setAuthError(error instanceof Error ? error : new Error(String(error)));
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Efecto para inicializar con datos del navegador solo en el cliente
  // después de la hidratación inicial
  useEffect(() => {
    if (!initialized) {
      // Carga inicial - intenta obtener del localStorage
      const storedUser = getStoredUser();
      if (storedUser) {
        setUser(storedUser);
      }
      setInitialized(true);

      // Inicializar el proceso de carga/refresco
      const init = async () => {
        // Solo intentar refrescar el token si hay un usuario almacenado
        // para evitar errores innecesarios para usuarios anónimos
        const existingUser = getStoredUser();
        const existingToken = getStoredToken();

        if (existingUser && existingToken && isTokenExpiringSoon()) {
          await refreshToken();
        }

        // Cargar el usuario desde el servidor (solo si tenemos token)
        if (existingToken) {
          await loadUser();
        } else {
          setIsLoading(false); // No hay token, no necesitamos cargar nada
        }
      };

      init();
    }
  }, [initialized]);

  // Suscripciones y manejadores de eventos - solo después de la inicialización del cliente
  useEffect(() => {
    if (!initialized) return;

    // Suscribirse a cambios de autenticación
    const { data: authListener } = supabase.auth.onAuthStateChange(async event => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        await loadUser();
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
      }
    });

    // Manejar cambios de visibilidad para recargar el usuario cuando la pestaña vuelve a ser visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Verificar si tenemos usuario y token antes de intentar refrescar
        const storedUser = getStoredUser();
        const storedToken = getStoredToken();

        // Solo intentar refrescar si hay un usuario autenticado
        if (storedUser && storedToken) {
          // Si el token está por expirar, refrescarlo primero
          if (isTokenExpiringSoon()) {
            refreshToken().then(success => {
              if (success) {
                loadUser();
              } else {
                // Si falla el refresco pero aún tenemos token, intentar cargar usuario
                if (getStoredToken()) {
                  loadUser();
                } else {
                  setUser(null);
                  setIsLoading(false);
                }
              }
            });
          } else {
            loadUser();
          }
        } else {
          // Si no hay usuario almacenado, solo establecer isLoading en false
          setIsLoading(false);
        }
      }
    };

    // Agregar listener para cambios de visibilidad
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Configurar un intervalo para refrescar el token automáticamente (solo si hay usuario)
    const tokenRefreshInterval = setInterval(
      async () => {
        console.log('[AuthContext] Verificando estado del token...');
        const storedUser = getStoredUser();
        const storedToken = getStoredToken();

        // Solo intentar refrescar si hay un usuario autenticado
        if (storedUser && storedToken) {
          if (isTokenExpiringSoon()) {
            console.log('[AuthContext] Token por expirar, intentando refrescar proactivamente');
            try {
              const success = await refreshToken();
              if (success) {
                console.log('[AuthContext] Refresco proactivo exitoso');
              } else {
                console.warn(
                  '[AuthContext] Falló el refresco proactivo, se intentará cargar el usuario'
                );
                // Intentar cargar el usuario como medida de respaldo
                await loadUser();
              }
            } catch (error) {
              console.error('[AuthContext] Error en refresco programado:', error);

              // Si hay error de refresco, intentar notificar al usuario y/o recargar
              setAuthError(
                error instanceof Error ? error : new Error('Error al mantener tu sesión activa')
              );
            }
          } else {
            console.log('[AuthContext] Token aún válido, no requiere refresco');
          }
        }
      },
      2 * 60 * 1000
    ); // Verificar cada 2 minutos, más frecuente que antes

    return () => {
      // Limpiar suscripciones
      if (authListener && authListener.subscription) {
        authListener.subscription.unsubscribe();
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(tokenRefreshInterval);
    };
  }, [initialized]);

  // Función para refrescar manualmente el usuario
  const refreshUser = async () => {
    await loadUser();
  };

  const login = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      setAuthError(null);

      await signIn(email, password);

      // Cargar usuario inmediatamente después de iniciar sesión
      await loadUser();
    } catch (error: unknown) {
      setAuthError(error instanceof Error ? error : new Error(String(error)));
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      setIsLoading(true);
      await signOut();
      setUser(null);
    } catch (error: unknown) {
      setAuthError(error instanceof Error ? error : new Error(String(error)));
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Función para verificar si el usuario tiene los permisos requeridos
  const hasPermission = (requiredRoles: UserRole[]) => {
    if (!user) return false;

    // Administrador tiene acceso a todo
    if (user.role === 'admin') return true;

    // Si no es admin, verificar si su rol está en la lista de roles permitidos
    return requiredRoles.includes(user.role);
  };

  const value = {
    user,
    isLoading: isLoading || !initialized, // Considerar "loading" hasta que se inicialice
    isAuthenticated: !!user,
    userRole: user?.role || 'anonimo',
    authError,
    login,
    logout,
    hasPermission,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
}
