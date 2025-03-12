"use client";

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { UserRole } from '@/lib/auth';
import { Spin } from 'antd';

interface RouteConfig {
  path: string;
  allowedRoles: UserRole[];
}

// Configuración de rutas protegidas
const protectedRoutes: RouteConfig[] = [
  { path: '/sales', allowedRoles: ['admin', 'vendedor'] },
  { path: '/customers', allowedRoles: ['admin', 'vendedor'] },
  { path: '/pedidos', allowedRoles: ['admin', 'vendedor'] },
  { path: '/products', allowedRoles: ['admin'] },
  { path: '/categories', allowedRoles: ['admin'] },
  { path: '/settings', allowedRoles: ['admin'] },
  { path: '/settings/users', allowedRoles: ['admin'] },
];

interface RouteGuardProps {
  children: React.ReactNode;
}

export function RouteGuard({ children }: RouteGuardProps) {
  const { isLoading, userRole, isAuthenticated } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Si está cargando, esperar
    if (isLoading) return;

    // Buscar la configuración de la ruta actual
    const matchedRoute = protectedRoutes.find(route => 
      pathname === route.path || pathname.startsWith(`${route.path}/`)
    );

    // Si la ruta no está protegida, permitir acceso
    if (!matchedRoute) return;

    // Si el usuario no está autenticado, redirigir al catálogo
    if (!isAuthenticated) {
      router.push('/');
      return;
    }

    // Verificar si el usuario tiene el rol necesario para acceder
    const hasAccess = matchedRoute.allowedRoles.includes(userRole);
    
    // Si no tiene acceso, redirigir al catálogo
    if (!hasAccess) {
      router.push('/');
    }
  }, [pathname, isAuthenticated, userRole, isLoading, router]);

  // Mostrar spinner durante la carga
  if (isLoading) {
    return (
      <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  return <>{children}</>;
} 