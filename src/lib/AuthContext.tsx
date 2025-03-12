"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, UserRole, getCurrentUser, signIn, signOut } from './auth';
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
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<Error | null>(null);

  // Función para cargar el usuario actual
  const loadUser = async () => {
    try {
      setIsLoading(true);
      setAuthError(null);
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    } catch (error: any) {
      setAuthError(error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Cargar usuario inicial
  useEffect(() => {
    loadUser();

    // Suscribirse a cambios de autenticación
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        await loadUser();
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
      }
    });

    return () => {
      // Limpiar suscripción
      if (authListener && authListener.subscription) {
        authListener.subscription.unsubscribe();
      }
    };
  }, []);

  // Función para refrescar manualmente el usuario
  const refreshUser = async () => {
    await loadUser();
  };

  const login = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      setAuthError(null);
      
      await signIn(email, password);
      
      // Esperar un momento para que la sesión se actualice
      setTimeout(async () => {
        await loadUser();
      }, 500);
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
    isLoading,
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