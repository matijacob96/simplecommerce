"use client"
import { useState, useEffect } from "react";
import { Typography, Flex, Layout, Menu, Button, Drawer, Image } from "antd";
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
    MenuOutlined
} from "@ant-design/icons";

const { Title, Text } = Typography;
const { Header } = Layout;

export function CustomHeader() {
    const pathname = usePathname();
    const [isMobile, setIsMobile] = useState(false);
    const [drawerVisible, setDrawerVisible] = useState(false);

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

    // Definir los elementos del menú
    const menuItems = [
        {
            key: "/",
            label: <Link href="/">Catálogo</Link>,
            icon: <ShoppingOutlined />,
        },
        {
            key: "/sales",
            label: <Link href="/sales">Ventas</Link>,
            icon: <ShoppingCartOutlined />,
        },
        {
            key: "/customers",
            label: <Link href="/customers">Clientes</Link>,
            icon: <UserOutlined />,
        },
        {
            key: "/pedidos",
            label: <Link href="/pedidos">Pedidos</Link>,
            icon: <OrderedListOutlined />,
        },
        {
            key: "/products",
            label: <Link href="/products">Productos</Link>,
            icon: <InboxOutlined />,
        },
        {
            key: "/categories",
            label: <Link href="/categories">Categorías</Link>,
            icon: <AppstoreOutlined />,
        },
        {
            key: "/settings",
            label: <Link href="/settings">Configuración</Link>,
            icon: <SettingOutlined />,
        },
    ];

    return (
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
                {!isMobile && (
                    <Menu 
                        theme="dark" 
                        mode="horizontal" 
                        selectedKeys={[pathname]} 
                        items={menuItems}
                        style={{ flex: 1, backgroundColor: "transparent", border: "none", justifyContent: 'flex-end' }}
                    />
                )}
                
                {/* Botón de menú en Mobile */}
                {isMobile && (
                    <Button 
                        type="text" 
                        icon={<MenuOutlined style={{ fontSize: '18px', color: 'white' }} />} 
                        onClick={toggleDrawer}
                    />
                )}
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
                    items={menuItems}
                    style={{ border: "none" }}
                    onClick={() => setDrawerVisible(false)}
                />
            </Drawer>
        </Header>
    );
}