import { UserRole } from './auth';

export interface RouteConfig {
  path: string;           // Ruta exacta (por ejemplo, '/products')
  label: string;          // Etiqueta para mostrar en el menú
  icon?: string;          // Nombre del icono (sin importar, lo importaremos en el componente)
  allowedRoles: UserRole[]; // Roles que pueden acceder a esta ruta
  showInMenu: boolean;    // Si debe mostrarse en el menú de navegación
  children?: RouteConfig[]; // Posibles rutas hijas para menús anidados
}

// Configuración completa de rutas de la aplicación
export const appRoutes: RouteConfig[] = [
  { 
    path: '/', 
    label: 'Catálogo',
    icon: 'ShoppingOutlined',
    allowedRoles: ['admin', 'vendedor', 'anonimo'], 
    showInMenu: true 
  },
  { 
    path: '/sales', 
    label: 'Ventas',
    icon: 'ShoppingCartOutlined',
    allowedRoles: ['admin', 'vendedor'], 
    showInMenu: true 
  },
  { 
    path: '/customers', 
    label: 'Clientes',
    icon: 'UserOutlined',
    allowedRoles: ['admin', 'vendedor'], 
    showInMenu: true 
  },
  { 
    path: '/pedidos', 
    label: 'Pedidos',
    icon: 'OrderedListOutlined',
    allowedRoles: ['admin'], 
    showInMenu: true 
  },
  { 
    path: '/products', 
    label: 'Productos',
    icon: 'InboxOutlined',
    allowedRoles: ['admin'], 
    showInMenu: true 
  },
  { 
    path: '/categories', 
    label: 'Categorías',
    icon: 'AppstoreOutlined',
    allowedRoles: ['admin'], 
    showInMenu: true 
  },
  { 
    path: '/settings', 
    label: 'Configuración',
    icon: 'SettingOutlined',
    allowedRoles: ['admin'], 
    showInMenu: true 
  },
  { 
    path: '/settings/users', 
    label: 'Usuarios',
    icon: 'UserAddOutlined',
    allowedRoles: ['admin'], 
    showInMenu: true 
  },
];

// Función auxiliar para obtener las rutas protegidas (para RouteGuard)
export function getProtectedRoutes(): RouteConfig[] {
  return appRoutes.filter(route => 
    !route.allowedRoles.includes('anonimo') || 
    // Para rutas con acceso anónimo pero que tienen subrutas protegidas
    (route.children?.some(child => !child.allowedRoles.includes('anonimo')))
  );
}

// Función auxiliar para obtener los elementos del menú según el rol (para CustomHeader)
export function getMenuItemsByRole(userRole: UserRole): RouteConfig[] {
  if (userRole === 'admin') {
    // Los administradores pueden ver todas las rutas configuradas para mostrarse en el menú
    return appRoutes.filter(route => route.showInMenu);
  }
  
  // Para otros roles, filtrar según los permisos
  return appRoutes.filter(route => 
    route.showInMenu && route.allowedRoles.includes(userRole)
  );
}

// Función para comprobar si un usuario con cierto rol puede acceder a una ruta
export function canAccessRoute(path: string, userRole: UserRole): boolean {
  // Buscar la ruta exacta o que comience con el path (para rutas anidadas)
  const route = appRoutes.find(r => 
    r.path === path || path.startsWith(`${r.path}/`)
  );
  
  if (!route) return true; // Si la ruta no está en la configuración, permitir acceso por defecto
  
  return route.allowedRoles.includes(userRole) || userRole === 'admin';
} 