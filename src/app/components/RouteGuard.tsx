'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { getStoredUser } from '@/lib/auth';
import { Spin, Button, Result } from 'antd';
import { getProtectedRoutes, canAccessRoute } from '@/lib/routes-config';

// Tiempo máximo de espera en ms (10 segundos)
const MAX_LOADING_TIME = 10000;

interface RouteGuardProps {
  children: React.ReactNode;
}

export function RouteGuard({ children }: RouteGuardProps) {
  const { isLoading, userRole, isAuthenticated, refreshUser } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);
  const [locallyAuthenticated, setLocallyAuthenticated] = useState(false);
  const [clientInitialized, setClientInitialized] = useState(false);

  // Asegurar que la inicialización de localStorage solo ocurra en el cliente
  // después de que el componente esté montado (fase de hidratación finalizada)
  useEffect(() => {
    setClientInitialized(true);

    // Verificar si hay usuario almacenado localmente
    const storedUser = getStoredUser();
    if (storedUser) {
      setLocallyAuthenticated(true);
    }
  }, []);

  // Establecer un timeout para evitar que la carga se quede indefinidamente
  useEffect(() => {
    if (!clientInitialized) return; // Solo ejecutar después de la hidratación

    let timeoutId: NodeJS.Timeout | undefined;

    if (isLoading) {
      timeoutId = setTimeout(() => {
        setLoadingTimedOut(true);
      }, MAX_LOADING_TIME);
    }

    // Función de limpieza que se ejecuta siempre
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isLoading, clientInitialized]);

  useEffect(() => {
    if (!clientInitialized) return; // Solo ejecutar después de la hidratación

    // No hacer nada hasta que se complete la carga (o se agote el tiempo de espera)
    if (isLoading && !loadingTimedOut) return;

    // Obtener la lista de rutas protegidas
    const protectedRoutes = getProtectedRoutes();

    // Buscar la configuración de la ruta actual
    const matchedRoute = protectedRoutes.find(
      route => pathname === route.path || pathname.startsWith(`${route.path}/`)
    );

    // Si la ruta no está protegida, permitir acceso
    if (!matchedRoute) return;

    // Función para redireccionar preservando parámetros de URL
    const redirectToHome = () => {
      // Preservar los parámetros de búsqueda actuales
      const currentParams = new URLSearchParams(searchParams.toString());
      const redirectPath = currentParams.toString() ? `/?${currentParams.toString()}` : '/';
      router.push(redirectPath);
    };

    // Si el usuario no está autenticado, redirigir al catálogo preservando parámetros
    if (!isAuthenticated && !locallyAuthenticated) {
      redirectToHome();
      return;
    }

    // Verificar si el usuario tiene el rol necesario para acceder
    const hasAccess = canAccessRoute(pathname, userRole);

    // Si no tiene acceso, redirigir al catálogo preservando parámetros
    if (!hasAccess) {
      redirectToHome();
    }
  }, [
    pathname,
    isAuthenticated,
    userRole,
    isLoading,
    router,
    loadingTimedOut,
    locallyAuthenticated,
    clientInitialized,
    searchParams,
  ]);

  // Mostrar spinner durante la carga (si no ha pasado demasiado tiempo)
  if (!clientInitialized || (isLoading && !loadingTimedOut)) {
    return (
      <div
        style={{
          height: 'calc(100vh - 64px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          flexDirection: 'column',
        }}
      >
        <Spin size="large" />
        <div style={{ marginTop: 16, fontSize: 16, color: '#888' }}>
          Verificando credenciales...
        </div>
      </div>
    );
  }

  // Si la carga ha tardado demasiado, mostrar un mensaje de error con opción de reintentar
  if (loadingTimedOut) {
    return (
      <div
        style={{
          height: 'calc(100vh - 64px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Result
          status="warning"
          title="La verificación está tardando demasiado"
          subTitle="Puede continuar esperando o intentar recargar la página"
          extra={[
            <Button
              key="retry"
              type="primary"
              onClick={() => {
                setLoadingTimedOut(false);
                refreshUser();
              }}
            >
              Reintentar
            </Button>,
            <Button key="continue" onClick={() => setLoadingTimedOut(false)}>
              Continuar
            </Button>,
          ]}
        />
      </div>
    );
  }

  return <>{children}</>;
}
