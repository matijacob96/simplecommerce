"use client"
import { useState, useEffect } from "react";
import { Typography, Flex, Layout, Menu, Button, Drawer, Image, Dropdown, Space, Avatar, Tooltip } from "antd";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
    UserAddOutlined
} from "@ant-design/icons";
import { useAuth } from "@/lib/AuthContext";
import { LoginModal } from "./LoginModal";

const { Title, Text } = Typography;
const { Header } = Layout;

export function CustomHeader() {
    const pathname = usePathname();
    const [isMobile, setIsMobile] = useState(false);
    const [drawerVisible, setDrawerVisible] = useState(false);
    const [loginModalVisible, setLoginModalVisible] = useState(false);
    const { user, isAuthenticated, userRole, logout } = useAuth();

    // Efecto para detectar si es mobile
    useEffect(() => {
        const checkIsMobile = () => {
            setIsMobile(window.innerWidth < 992);
        };
        
        checkIsMobile();
        window.addEventListener('resize', checkIsMobile);
        
        return () => window.removeEventListener('resize', checkIsMobile);
    }, []);

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
            console.error("Error al cerrar sesión:", error);
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

    // Filtrar elementos del menú según el rol del usuario
    const getFilteredMenuItems = () => {
        const allMenuItems = [
            {
                key: "/",
                label: <Link href="/">Catálogo</Link>,
                icon: <ShoppingOutlined />,
                allowedRoles: ['admin', 'vendedor', 'anonimo'], // Todos pueden ver el catálogo
            },
            {
                key: "/sales",
                label: <Link href="/sales">Ventas</Link>,
                icon: <ShoppingCartOutlined />,
                allowedRoles: ['admin', 'vendedor'], // Solo admin y vendedor
            },
            {
                key: "/customers",
                label: <Link href="/customers">Clientes</Link>,
                icon: <UserOutlined />,
                allowedRoles: ['admin', 'vendedor'], // Solo admin y vendedor
            },
            {
                key: "/pedidos",
                label: <Link href="/pedidos">Pedidos</Link>,
                icon: <OrderedListOutlined />,
                allowedRoles: ['admin', 'vendedor'], // Solo admin y vendedor
            },
            {
                key: "/products",
                label: <Link href="/products">Productos</Link>,
                icon: <InboxOutlined />,
                allowedRoles: ['admin'], // Solo admin
            },
            {
                key: "/categories",
                label: <Link href="/categories">Categorías</Link>,
                icon: <AppstoreOutlined />,
                allowedRoles: ['admin'], // Solo admin
            },
            {
                key: "/settings",
                label: <Link href="/settings">Configuración</Link>,
                icon: <SettingOutlined />,
                allowedRoles: ['admin'], // Solo admin
            },
            {
                key: "/settings/users",
                label: <Link href="/settings/users">Usuarios</Link>,
                icon: <UserAddOutlined />,
                allowedRoles: ['admin'], // Solo admin puede gestionar usuarios
            },
        ];

        // Si es administrador, devolver todos los elementos
        if (userRole === 'admin') {
            return allMenuItems.map(({ key, label, icon }) => ({ key, label, icon }));
        }

        // De lo contrario, filtrar según el rol del usuario
        return allMenuItems
            .filter(item => item.allowedRoles.includes(userRole))
            .map(({ key, label, icon }) => ({ key, label, icon }));
    };

    const filteredMenuItems = getFilteredMenuItems();

    return (
        <>
            <Header style={{ padding: "0 16px" }}>
                <Flex align="center" justify="space-between" style={{ height: "100%" }}>
                    {/* Logo y Título */}
                    <Flex align="center">
                        <Link href="/" style={{ display: 'flex', alignItems: 'center', color: 'white', textDecoration: 'none' }}>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                <img 
                                    src="https://xqbotozdwyikueurdhof.supabase.co/storage/v1/object/public/images-bucket/assets/logo-simple-commerce.png"
                                    alt="Simple Commerce Logo"
                                    style={{ maxHeight: '32px' }}
                                />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                <Title level={5} style={{ margin: 0, color: "white", lineHeight: '1.2' }}>
                                    Simple
                                </Title>
                                <Title level={5} style={{ margin: 0, color: "white", lineHeight: '1.2' }}>
                                    Commerce
                                </Title>
                            </div>
                        </Link>
                    </Flex>
                    
                    {/* Menú en Desktop */}
                    <Flex align="center">
                        {!isMobile && (
                            <Menu 
                                theme="dark" 
                                mode="horizontal" 
                                selectedKeys={[pathname]} 
                                items={filteredMenuItems}
                                style={{ backgroundColor: "transparent", border: "none" }}
                            />
                        )}
                        
                        {/* Botón de login/usuario */}
                        {isAuthenticated ? (
                            <Dropdown 
                                menu={{ items: userMenuItems }} 
                                placement="bottomRight"
                            >
                                <Button 
                                    type="text" 
                                    icon={<UserOutlined />} 
                                    style={{ color: 'white' }}
                                >
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
                                icon={<MenuOutlined style={{ fontSize: '18px', color: 'white' }} />} 
                                onClick={toggleDrawer}
                                style={{ marginLeft: 8 }}
                            />
                        )}
                    </Flex>
                </Flex>
                
                {/* Drawer para mobile */}
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
                        style={{ border: "none" }}
                        onClick={() => setDrawerVisible(false)}
                    />
                    
                    {isAuthenticated ? (
                        <Button 
                            icon={<LogoutOutlined />} 
                            onClick={handleLogout} 
                            block 
                            style={{ marginTop: 16 }}
                        >
                            Cerrar Sesión
                        </Button>
                    ) : (
                        <Button 
                            type="primary" 
                            icon={<LoginOutlined />} 
                            onClick={() => {
                                setDrawerVisible(false);
                                showLoginModal();
                            }} 
                            block 
                            style={{ marginTop: 16 }}
                        >
                            Iniciar Sesión
                        </Button>
                    )}
                </Drawer>
            </Header>
            
            {/* Modal de Login */}
            <LoginModal open={loginModalVisible} onClose={hideLoginModal} />
        </>
    );
}