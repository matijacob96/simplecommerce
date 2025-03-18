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
import { useRouter } from 'next/navigation';

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
  const [authInProgress, setAuthInProgress] = useState(false);
  const router = useRouter();

  // Función para manejar error de autenticación y redirigir si es necesario
  const handleAuthError = (error: unknown, redirectToHome = true) => {
    console.error('Error de autenticación:', error);
    setAuthError(error instanceof Error ? error : new Error(String(error)));
    setUser(null);

    // Limpiar datos de sesión en localStorage para evitar intentos de refresco fallidos
    localStorage.removeItem('simplecommerce_auth_token');
    localStorage.removeItem('simplecommerce_refresh_token');
    localStorage.removeItem('simplecommerce_auth_expiry');
    localStorage.removeItem('simplecommerce_auth_user');

    // Redirigir a la página de inicio si se solicita
    if (redirectToHome) {
      // Pequeño retraso para asegurar que el estado se actualice antes de la redirección
      setTimeout(() => {
        router.push('/');
      }, 100);
    }
  };

  // Función para cargar el usuario actual con manejo mejorado de errores
  const loadUser = async (redirectOnError = false) => {
    try {
      if (authInProgress) return;
      setAuthInProgress(true);
      setIsLoading(true);
      setAuthError(null);

      const currentUser = await getCurrentUser();

      if (currentUser) {
        setUser(currentUser);
      } else {
        // Si no hay usuario pero teníamos uno antes, manejar como un error de autenticación
        if (user) {
          handleAuthError(new Error('La sesión ha expirado'), redirectOnError);
        } else {
          setUser(null);
        }
      }
    } catch (error: unknown) {
      handleAuthError(error, redirectOnError);
    } finally {
      setIsLoading(false);
      setAuthInProgress(false);
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

        if (existingUser && existingToken) {
          if (isTokenExpiringSoon()) {
            try {
              const success = await refreshToken();
              if (!success) {
                // Si falla el refresco, cargar usuario sin redirección
                await loadUser(false);
              } else {
                // Si el refresco es exitoso, cargar usuario desde localStorage actualizado
                const refreshedUser = getStoredUser();
                if (refreshedUser) {
                  setUser(refreshedUser);
                  setIsLoading(false);
                } else {
                  await loadUser(false);
                }
              }
            } catch (error) {
              console.error('Error en refresco inicial:', error);
              await loadUser(false);
            }
          } else {
            // Cargar el usuario desde el servidor (solo si tenemos token)
            await loadUser(false);
          }
        } else {
          setIsLoading(false); // No hay token, no necesitamos cargar nada
        }
      };

      init();
    }
  }, [initialized, router]);

  // Suscripciones y manejadores de eventos - solo después de la inicialización del cliente
  useEffect(() => {
    if (!initialized) return;

    // Suscribirse a cambios de autenticación
    const { data: authListener } = supabase.auth.onAuthStateChange(async event => {
      console.log('[AuthContext] Evento de autenticación:', event);
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        await loadUser(false);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        router.push('/');
      } else if (event === 'USER_UPDATED') {
        await loadUser(false);
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
            refreshToken()
              .then(success => {
                if (success) {
                  // Solo cargar usuario si el refresco fue exitoso
                  const refreshedUser = getStoredUser();
                  if (refreshedUser) {
                    setUser(refreshedUser);
                  }
                } else {
                  // Si falla el refresco, intentar cargar usuario con redirección
                  loadUser(true);
                }
              })
              .catch(() => {
                // En caso de error en refresco, cargar usuario con redirección
                loadUser(true);
              });
          } else {
            // Token válido, actualizar el estado con el usuario almacenado
            const currentStoredUser = getStoredUser();
            if (currentStoredUser) {
              setUser(currentStoredUser);
            }
          }
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
                // Actualizar usuario en el estado si el refresco fue exitoso
                const refreshedUser = getStoredUser();
                if (refreshedUser) {
                  setUser(refreshedUser);
                }
              } else {
                console.warn(
                  '[AuthContext] Falló el refresco proactivo, se intentará cargar el usuario'
                );
                // Intentar cargar el usuario con redirección si falla el refresco
                await loadUser(true);
              }
            } catch (error) {
              console.error('[AuthContext] Error en refresco programado:', error);
              // Si hay error en refresco, cargar usuario con redirección
              await loadUser(true);
            }
          }
        }
      },
      // Verificar cada minuto, más frecuente que antes para prevenir problemas
      60 * 1000
    );

    return () => {
      // Limpiar suscripciones
      if (authListener && authListener.subscription) {
        authListener.subscription.unsubscribe();
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(tokenRefreshInterval);
    };
  }, [initialized, router]);

  // Función para refrescar manualmente el usuario
  const refreshUser = async () => {
    await loadUser(true);
  };

  const login = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      setAuthError(null);

      await signIn(email, password);

      // Cargar usuario inmediatamente después de iniciar sesión
      await loadUser(false);
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
      // Redirigir a home después de cerrar sesión
      router.push('/');
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
