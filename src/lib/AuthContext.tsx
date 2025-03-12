"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, UserRole, getCurrentUser, signIn, signOut, getStoredUser, isTokenExpiringSoon, refreshToken } from './auth';
import supabase from './supabase';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  userRole: UserRole;
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
    } catch (error: any) {
      console.error("Error al cargar usuario:", error);
      setAuthError(error);
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
        // Primero verificar si hay un token por expirar y refrescarlo si es necesario
        if (isTokenExpiringSoon()) {
          console.log("Token por expirar, refrescando...");
          await refreshToken();
        }
        
        // Cargar el usuario desde el servidor
        await loadUser();
      };
      
      init();
    }
  }, [initialized]);

  // Suscripciones y manejadores de eventos - solo después de la inicialización del cliente
  useEffect(() => {
    if (!initialized) return;

    // Suscribirse a cambios de autenticación
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("Evento de autenticación:", event);
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        await loadUser();
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
      }
    });

    // Manejar cambios de visibilidad para recargar el usuario cuando la pestaña vuelve a ser visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log("Pestaña activa nuevamente, verificando autenticación...");
        
        // Si el token está por expirar, refrescarlo primero
        if (isTokenExpiringSoon()) {
          refreshToken().then(success => {
            if (success) {
              console.log("Token refrescado correctamente");
            } else {
              console.log("Error al refrescar token, cargando usuario de todas formas");
            }
            loadUser();
          });
        } else {
          loadUser();
        }
      }
    };
    
    // Agregar listener para cambios de visibilidad
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Configurar un intervalo para refrescar el token automáticamente
    const tokenRefreshInterval = setInterval(() => {
      if (isTokenExpiringSoon()) {
        console.log("Refrescando token automáticamente...");
        refreshToken();
      }
    }, 5 * 60 * 1000); // Verificar cada 5 minutos

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
    } catch (error: any) {
      setAuthError(error);
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
    } catch (error: any) {
      setAuthError(error);
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
    login,
    logout,
    hasPermission,
    refreshUser
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
} 