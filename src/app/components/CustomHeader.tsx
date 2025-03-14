'use client';
import { useState, useEffect } from 'react';
import { Typography, Flex, Layout, Menu, Button, Drawer, Dropdown, Tooltip } from 'antd';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import {
  ShoppingOutlined,
  SettingOutlined,
  AppstoreOutlined,
  OrderedListOutlined,
  InboxOutlined,
  ShoppingCartOutlined,
  UserOutlined,
  MenuOutlined,
  LogoutOutlined,
  LoginOutlined,
  UserAddOutlined,
} from '@ant-design/icons';
import { useAuth } from '@/lib/AuthContext';
import { LoginModal } from './LoginModal';
import { getMenuItemsByRole } from '@/lib/routes-config';

const { Title } = Typography;
const { Header } = Layout;

// Constante para la URL del logo con parámetro de versión
const LOGO_URL =
  'https://hglajudlstlnvfukamvh.supabase.co/storage/v1/object/public/images-bucket/assets/logo-simple-commerce.png?v=1.1';

// Mapa de iconos para facilitar la referencia dinámica
const iconMap: Record<string, React.ReactNode> = {
  ShoppingOutlined: <ShoppingOutlined />,
  SettingOutlined: <SettingOutlined />,
  AppstoreOutlined: <AppstoreOutlined />,
  OrderedListOutlined: <OrderedListOutlined />,
  InboxOutlined: <InboxOutlined />,
  ShoppingCartOutlined: <ShoppingCartOutlined />,
  UserOutlined: <UserOutlined />,
  MenuOutlined: <MenuOutlined />,
  LogoutOutlined: <LogoutOutlined />,
  LoginOutlined: <LoginOutlined />,
  UserAddOutlined: <UserAddOutlined />,
};

export function CustomHeader() {
  const pathname = usePathname();
  const [isMounted, setIsMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [loginModalVisible, setLoginModalVisible] = useState(false);
  const { user, isAuthenticated, userRole, logout } = useAuth();

  // Asegurarse que la detección de mobile solo ocurra en el cliente
  useEffect(() => {
    setIsMounted(true);

    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 992);
    };

    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);

    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  // Asegurarse que el menú se actualice cuando cambia el estado de autenticación
  useEffect(() => {
    // Sólo cerrar el drawer cuando el usuario se autentica, no cuando ya está autenticado
    // y simplemente está abriendo el drawer
    if (isAuthenticated && drawerVisible && !user) {
      // Cerrar el drawer únicamente durante el proceso de autenticación inicial
      setDrawerVisible(false);
    }

    // Forzar rechecking del tamaño para asegurar layout correcto después del login
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 992);
    };
    checkIsMobile();
  }, [isAuthenticated, user]);

  // Función para mostrar/ocultar el drawer
  const toggleDrawer = () => {
    setDrawerVisible(!drawerVisible);
  };

  // Mostrar modal de login
  const showLoginModal = () => {
    setLoginModalVisible(true);
  };

  // Cerrar modal de login
  const hideLoginModal = () => {
    setLoginModalVisible(false);
  };

  // Cerrar sesión
  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  // Configuración del menú para usuario autenticado
  const userMenuItems = [
    {
      key: 'profile',
      label: 'Perfil',
      icon: <UserOutlined />,
    },
    {
      key: 'logout',
      label: 'Cerrar Sesión',
      icon: <LogoutOutlined />,
      onClick: handleLogout,
    },
  ];

  // Obtener los elementos del menú según el rol del usuario
  // usando la configuración centralizada
  const getFilteredMenuItems = () => {
    // Obtener las rutas permitidas para el rol del usuario
    const allowedRoutes = getMenuItemsByRole(userRole);

    // Transformar rutas a formato de elementos del menú de Ant Design
    return allowedRoutes.map(route => ({
      key: route.path,
      label: <Link href={route.path}>{route.label}</Link>,
      icon: route.icon && iconMap[route.icon] ? iconMap[route.icon] : null,
    }));
  };

  const filteredMenuItems = getFilteredMenuItems();

  // Esto evita problemas de hidratación renderizando
  // un diseño simplificado en el servidor
  if (!isMounted) {
    return (
      <Header style={{ padding: '0 16px' }}>
        <Flex align="center" justify="space-between" style={{ height: '100%' }}>
          {/* Logo y Título (versión simplificada sin estado del cliente) */}
          <Flex align="center">
            <Link
              href="/"
              style={{
                display: 'flex',
                alignItems: 'center',
                color: 'white',
                textDecoration: 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <Image
                  src={LOGO_URL}
                  alt="Simple Commerce Logo"
                  width={32}
                  height={32}
                  style={{ maxHeight: '32px' }}
                />
              </div>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                }}
              >
                <Title level={5} style={{ margin: 0, color: 'white', lineHeight: '1.2' }}>
                  Simple
                </Title>
                <Title level={5} style={{ margin: 0, color: 'white', lineHeight: '1.2' }}>
                  Commerce
                </Title>
              </div>
            </Link>
          </Flex>
        </Flex>
      </Header>
    );
  }

  return (
    <>
      <Header style={{ padding: '0 16px' }}>
        <Flex align="center" justify="space-between" style={{ height: '100%' }}>
          {/* Logo y Título */}
          <Flex align="center">
            <Link
              href="/"
              style={{
                display: 'flex',
                alignItems: 'center',
                color: 'white',
                textDecoration: 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <Image
                  src={LOGO_URL}
                  alt="Simple Commerce Logo"
                  width={32}
                  height={32}
                  style={{ maxHeight: '32px' }}
                />
              </div>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                }}
              >
                <Title level={5} style={{ margin: 0, color: 'white', lineHeight: '1.2' }}>
                  Simple
                </Title>
                <Title level={5} style={{ margin: 0, color: 'white', lineHeight: '1.2' }}>
                  Commerce
                </Title>
              </div>
            </Link>
          </Flex>

          {/* Menú en Desktop */}
          <Flex align="center" style={{ flex: 1, justifyContent: 'flex-end' }}>
            {!isMobile && (
              <Menu
                theme="dark"
                mode="horizontal"
                selectedKeys={[pathname]}
                items={filteredMenuItems}
                style={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  width: 'auto',
                  flex: 1,
                  display: 'flex',
                  justifyContent: 'flex-end',
                }}
              />
            )}

            {/* Botón de login/usuario */}
            {isAuthenticated ? (
              <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
                <Button type="text" icon={<UserOutlined />} style={{ color: 'white' }}>
                  {!isMobile && <span style={{ marginLeft: 8 }}>{user?.email}</span>}
                </Button>
              </Dropdown>
            ) : (
              <Tooltip title="Iniciar Sesión">
                <Button
                  type="text"
                  icon={<LoginOutlined />}
                  onClick={showLoginModal}
                  style={{ color: 'white' }}
                >
                  {!isMobile && <span style={{ marginLeft: 8 }}>Iniciar Sesión</span>}
                </Button>
              </Tooltip>
            )}

            {/* Botón de menú en Mobile */}
            {isMobile && (
              <Button
                type="text"
                icon={<MenuOutlined />}
                onClick={toggleDrawer}
                style={{ color: 'white' }}
              />
            )}
          </Flex>
        </Flex>
      </Header>

      {/* Drawer para menú en Mobile */}
      <Drawer
        title="Menú"
        placement="right"
        onClose={toggleDrawer}
        open={drawerVisible}
        width={280}
      >
        <Menu
          mode="vertical"
          selectedKeys={[pathname]}
          items={filteredMenuItems}
          style={{ border: 'none' }}
          onClick={toggleDrawer}
        />

        {/* Opciones de login/logout en el drawer */}
        <div
          style={{
            marginTop: 24,
            borderTop: '1px solid #f0f0f0',
            paddingTop: 24,
          }}
        >
          {isAuthenticated ? (
            <>
              <div style={{ padding: '8px 0', color: '#888' }}>{user?.email}</div>
              <Button
                icon={<LogoutOutlined />}
                onClick={handleLogout}
                style={{ width: '100%', marginTop: 8 }}
              >
                Cerrar Sesión
              </Button>
            </>
          ) : (
            <Button
              icon={<LoginOutlined />}
              onClick={() => {
                setDrawerVisible(false);
                showLoginModal();
              }}
              style={{ width: '100%' }}
            >
              Iniciar Sesión
            </Button>
          )}
        </div>
      </Drawer>

      {/* Modal de login */}
      <LoginModal open={loginModalVisible} onClose={hideLoginModal} />
    </>
  );
}
