"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Input, Select, Card, Spin, Empty, Space, Typography, Row, Col, Image, Divider, Switch, Button, Tooltip, Skeleton } from "antd";
import { SearchOutlined, FilterOutlined, InboxOutlined, DollarOutlined } from "@ant-design/icons";
import { useRouter, useSearchParams } from "next/navigation";
import { calculateUsdPrice, calculateArsPrice, formatUsdPrice, formatArsPrice } from "@/utils/priceUtils";

const { Option } = Select;
const { Text, Title } = Typography;

type Category = {
  id: number;
  name: string;
  profit_margin?: number | null;
};

type Product = {
  id: number;
  name: string;
  price: number;
  stock: number;
  image?: string;
  category_id?: number;
  category?: Category;
  flavor?: string;
};

// Agregar interfaz para dólar blue
interface DolarBlue {
  compra: number;
  venta: number;
  fromCache?: boolean;
  timestamp: number;
}

// Función de debounce para retrasar la ejecución
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

// Estilos CSS para la scrollbar invisible
const scrollbarStyles = `
  .invisible-scrollbar::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  
  .invisible-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }
  
  .invisible-scrollbar::-webkit-scrollbar-thumb {
    background-color: rgba(0, 0, 0, 0.1);
    border-radius: 10px;
    border: 3px solid transparent;
  }
  
  .invisible-scrollbar::-webkit-scrollbar-thumb:hover {
    background-color: rgba(0, 0, 0, 0.2);
  }
  
  .invisible-scrollbar {
    scrollbar-width: thin;
    scrollbar-color: rgba(0, 0, 0, 0.1) transparent;
  }
`;

export default function Catalog() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Obtener parámetros de la URL
  const categoryParam = searchParams.get("category") || "all";
  const searchParam = searchParams.get("search") || "";
  const availableParam = searchParams.get("available");

  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  // Estado para controlar el tamaño de pantalla
  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 576);
    };
    
    // Verificar inicialmente
    checkIsMobile();
    
    // Agregar listener para cambios de tamaño
    window.addEventListener('resize', checkIsMobile);
    
    // Limpiar listener
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  // Estados locales que reflejan los parámetros de URL
  const [search, setSearch] = useState(searchParam);
  const [filter, setFilter] = useState<string>(categoryParam);
  const [onlyAvailable, setOnlyAvailable] = useState(
    availableParam === null ? true : availableParam === "true"
  );

  // Aplicar debounce a la búsqueda (600ms)
  const debouncedSearch = useDebounce(search, 600);

  // Actualizar la URL cuando cambie el valor de búsqueda debounceado
  useEffect(() => {
    if (debouncedSearch !== searchParam) {
      updateUrlWithFilters({ search: debouncedSearch });
    }
  }, [debouncedSearch]);

  const [dolarBlue, setDolarBlue] = useState<DolarBlue | null>(null);
  const [loadingDolar, setLoadingDolar] = useState(true);
  const [defaultProfitMargin, setDefaultProfitMargin] = useState(0.2);

  // Crear un objeto para almacenar los resultados de los cálculos en caché
  const priceCache = useRef<Record<number, {
    usdPrice: number;
    arsPrice: number;
    formattedUsd: string;
    formattedArs: string;
  }>>({});

  // Función para resetear el caché cuando cambian las dependencias
  useEffect(() => {
    // Reset del caché cuando cambian el tipo de cambio o las categorías
    priceCache.current = {};
  }, [dolarBlue, categories, defaultProfitMargin]);

  // Cargar categorías una sola vez
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch("/api/categories");
        if (response.ok) {
          const data = await response.json();
          setCategories(data);
        }
      } catch (error) {
        console.error("Error fetching categories:", error);
      }
    };

    fetchCategories();
  }, []);

  // Cargar el precio del dólar blue
  useEffect(() => {
    const fetchDolarBlue = async () => {
      try {
        const response = await fetch("/api/dolar-blue");
        if (response.ok) {
          const { data } = await response.json();
          setDolarBlue(data);
        } else {
          console.error("Error al obtener el precio del dólar blue");
        }
      } catch (error) {
        console.error("Error en la petición del dólar blue:", error);
      } finally {
        setLoadingDolar(false);
      }
    };

    fetchDolarBlue();
    // Actualizar el precio cada hora
    const interval = setInterval(fetchDolarBlue, 1000 * 60 * 60);
    
    return () => clearInterval(interval);
  }, []);

  // Cargar configuración global
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch("/api/settings");
        if (response.ok) {
          const data = await response.json();
          // Asegurarnos que el margen sea siempre un número
          const margin = data.default_profit_margin || data.profit_margin || 0.2;
          const numericMargin = typeof margin === 'string' 
            ? parseFloat(margin) 
            : Number(margin);
          
          setDefaultProfitMargin(isNaN(numericMargin) ? 0.2 : numericMargin);
        }
      } catch (error) {
        console.error("Error fetching settings:", error);
      }
    };

    fetchSettings();
  }, []);

  // Cargar productos cada vez que cambian los parámetros de URL
  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/products?${searchParam ? 'search=' + encodeURIComponent(searchParam) + '&' : ''}filter=${encodeURIComponent(categoryParam)}`
        );
        if (response.ok) {
          const data = await response.json();
          setProducts(data);
        }
      } catch (error) {
        console.error("Error fetching products:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [searchParam, categoryParam]);

  // Filtrar productos por disponibilidad localmente
  useEffect(() => {
    if (onlyAvailable) {
      setFilteredProducts(products.filter(product => product.stock > 0));
    } else {
      setFilteredProducts(products);
    }
  }, [products, onlyAvailable]);

  // Función para actualizar la URL con los filtros
  const updateUrlWithFilters = useCallback((params: {
    search?: string;
    category?: string;
    available?: boolean;
  }) => {
    const newParams = new URLSearchParams(searchParams.toString());

    // Actualizar o eliminar parámetros según sea necesario
    if (params.search !== undefined) {
      if (params.search) {
        newParams.set("search", params.search);
      } else {
        newParams.delete("search");
      }
    }

    if (params.category !== undefined) {
      if (params.category && params.category !== "all") {
        newParams.set("category", params.category);
      } else {
        newParams.delete("category");
      }
    }

    if (params.available !== undefined) {
      newParams.set("available", params.available.toString());
    }

    // Construir la nueva URL y navegar
    const newPathname = `/?${newParams.toString()}`;
    router.push(newPathname);
  }, [searchParams, router]);

  // Manejadores de eventos para los filtros
  const handleSearchChange = (value: string) => {
    setSearch(value);
    // No actualizamos la URL inmediatamente, sino a través del debounce
  };

  const handleSearchClear = () => {
    setSearch("");
    updateUrlWithFilters({ search: "" });
  };

  const handleSearchSubmit = () => {
    // Búsqueda inmediata si se presiona el botón
    updateUrlWithFilters({ search });
  };

  const handleCategoryChange = (value: string) => {
    setFilter(value);
    updateUrlWithFilters({ category: value });
  };

  const handleAvailabilityChange = (value: boolean) => {
    setOnlyAvailable(value);
    updateUrlWithFilters({ available: value });
  };

  // Lista de categorías para el selector
  const categoryItems = [
    { label: "Todos", value: "all" },
    ...categories.map(category => ({
      label: category.name,
      value: category.id.toString()
    }))
  ];

  // Función para calcular los precios del producto (optimizada con memoización)
  const getPrices = useCallback((product: Product) => {
    // Si tenemos el resultado en caché y el producto no ha cambiado, devolverlo
    if (priceCache.current[product.id]) {
      return priceCache.current[product.id];
    }

    // Obtener el margen de la categoría o usar el margen predeterminado
    let categoryMargin = defaultProfitMargin;
    if (product.category?.profit_margin !== undefined && product.category?.profit_margin !== null) {
      categoryMargin = Number(product.category.profit_margin);
      if (isNaN(categoryMargin)) categoryMargin = Number(defaultProfitMargin);
    }
    
    // Reducir logs a solo la primera vez que calculamos cada producto
    if (!priceCache.current[product.id]) {
      console.log("Calculando precio del producto:", {
        nombre: product.name,
        precioBase: product.price,
        categoryMargin,
        defaultProfitMargin
      });
    }
    
    // Convertir explícitamente a número el precio base y los márgenes
    const productPrice = Number(product.price) || 0;
    const catMargin = typeof categoryMargin === 'number' && !isNaN(categoryMargin) ? categoryMargin : Number(defaultProfitMargin);
    const defMargin = Number(defaultProfitMargin) || 0.2;
    
    // Calcular los precios
    const usdPrice = calculateUsdPrice(productPrice, catMargin, defMargin);
    const arsPrice = calculateArsPrice(usdPrice, dolarBlue ? dolarBlue.venta : 0);
    
    // Reducir logs a solo la primera vez que calculamos cada producto
    if (!priceCache.current[product.id]) {
      console.log("Resultado del cálculo:", {
        nombre: product.name,
        usdPrice,
        arsPrice
      });
    }
    
    // Crear el resultado
    const result = {
      usdPrice,
      arsPrice,
      formattedUsd: formatUsdPrice(usdPrice),
      formattedArs: formatArsPrice(arsPrice)
    };
    
    // Guardar en caché
    priceCache.current[product.id] = result;
    
    return result;
  }, [dolarBlue, categories, defaultProfitMargin]);

  return (
    <>
      {/* Estilos para scrollbar invisible */}
      <style>{scrollbarStyles}</style>

      {/* Contenedor principal - Sin scroll, full height */}
      <div style={{
        height: 'calc(100vh - 64px)',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxSizing: 'border-box'
      }}>
        {/* Cards superiores con altura fija */}
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          {/* Card de búsqueda */}
          <Col xs={24} md={16} style={{ height: 'auto' }}>
            <Card
              title={<><SearchOutlined /> Búsqueda</>}
              variant="outlined"
              className="search-and-filters"
              styles={{ body: { padding: '12px 24px' } }}
            >
              <div style={{ display: 'flex', width: '100%' }}>
                <Input
                  placeholder="Buscar producto por nombre..."
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  prefix={<SearchOutlined />}
                  size="large"
                  style={{ flex: 1 }}
                  onPressEnter={handleSearchSubmit}
                  allowClear
                  onClear={handleSearchClear}
                />
                <Button
                  type="primary"
                  onClick={handleSearchSubmit}
                  size="large"
                  style={{ marginLeft: 8 }}
                >
                  Buscar
                </Button>
              </div>
              {debouncedSearch !== searchParam && debouncedSearch !== "" && (
                <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
                  Buscando automáticamente...
                </Text>
              )}
            </Card>
          </Col>

          {/* Card de filtros */}
          <Col xs={24} md={8} style={{ height: 'auto' }}>
            <Card
              title={<><FilterOutlined /> Filtros</>}
              variant="outlined"
              className="filters-card"
              styles={{ body: { padding: '12px 24px' } }}
            >
              <Space direction="vertical" style={{ width: '100%' }} size={8}>
                <div>
                  <Text>Mostrar solo disponibles:</Text>
                  <div style={{ marginTop: 2 }}>
                    <Switch
                      checked={onlyAvailable}
                      onChange={handleAvailabilityChange}
                      checkedChildren="Sí"
                      unCheckedChildren="No"
                      size="small"
                    />
                    <Text style={{ marginLeft: 8 }}>
                      {onlyAvailable ? "Productos con stock" : "Todos los productos"}
                    </Text>
                  </div>
                </div>

                <div>
                  <Text>Categoría:</Text>
                  <Select
                    style={{ width: '100%', marginTop: 2 }}
                    placeholder="Seleccionar categoría"
                    value={filter}
                    onChange={handleCategoryChange}
                    size="middle"
                    popupMatchSelectWidth={false}
                  >
                    {categoryItems.map((cat) => (
                      <Option key={cat.value} value={cat.value}>
                        {cat.label}
                      </Option>
                    ))}
                  </Select>
                </div>

                {/* Mostrar tipo de cambio actual */}
                {loadingDolar ? (
                  <div style={{ marginTop: 8 }}>
                    <Text type="secondary">
                      <DollarOutlined /> Cargando tipo de cambio...
                    </Text>
                  </div>
                ) : dolarBlue && (
                  <div style={{ marginTop: 8 }}>
                    <Tooltip title="Tipo de cambio utilizado para calcular los precios">
                      <Text type="secondary">
                        <DollarOutlined /> Dólar Blue: {formatArsPrice(dolarBlue.venta)}
                      </Text>
                    </Tooltip>
                  </div>
                )}
              </Space>
            </Card>
          </Col>
        </Row>

        {/* Card inferior con scroll interno */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <Card
            title="Catálogo de productos"
            variant="outlined"
            style={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column'
            }}
            styles={{
              header: { 
                position: 'sticky', 
                top: 0, 
                zIndex: 1, 
                backgroundColor: '#fff' }, 
              body: {
                padding: 0,
                overflow: 'hidden',
                flex: 1
              }
            }}
          >
            <div
              className="invisible-scrollbar"
              style={{
                padding: loading ? 0 : 16,
                overflow: 'auto',
                height: '100%'
              }}
            >
              {loading ? (
                <div style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  padding: 64,
                  width: '100%',
                  height: '100%'
                }}>
                  <Spin size="large" />
                </div>
              ) : (
                <div>
                  {filteredProducts.length === 0 ? (
                    <Empty description="No se encontraron productos." />
                  ) : (
                    <Row gutter={[16, 16]}>
                      {filteredProducts.map((product) => {
                        const prices = getPrices(product);
                        
                        return (
                          <Col xs={24} md={12} key={product.id}>
                            <Card variant="outlined" style={{ width: '100%', height: '100%' }}>
                              {/* Mobile Layout */}
                              {isMobile && (
                                <>
                                  {/* Imagen centrada */}
                                  <div style={{ display: 'flex', justifyContent: 'center', width: '100%', marginBottom: '16px' }}>
                                    {product.image ? (
                                      <Image
                                        src={product.image}
                                        alt={product.name}
                                        style={{ 
                                          width: '200px',
                                          height: '200px',
                                          objectFit: 'cover',
                                          borderRadius: '4px'
                                        }}
                                        preview={false}
                                        placeholder={<Skeleton.Image active style={{ width: '200px', height: '200px' }} />}
                                        fallback="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiNmNWY1ZjUiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjZDlkOWQ5Ij5JbWFnZW4gbm8gZGlzcG9uaWJsZTwvdGV4dD48L3N2Zz4="
                                      />
                                    ) : (
                                      <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        background: '#f5f5f5',
                                        width: '200px',
                                        height: '200px',
                                        borderRadius: '4px'
                                      }}>
                                        <InboxOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
                                      </div>
                                    )}
                                  </div>
                                  
                                  {/* Título con elipsis y tooltip */}
                                  <Tooltip title={product.name}>
                                    <div style={{ width: '100%', marginBottom: '12px' }}>
                                      <Title
                                        level={4}
                                        ellipsis={{ tooltip: true }}
                                        style={{ 
                                          margin: 0,
                                          width: '100%',
                                          whiteSpace: 'nowrap',
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis'
                                        }}
                                      >
                                        {product.name}
                                      </Title>
                                    </div>
                                  </Tooltip>
                                  
                                  {/* Precios en una fila */}
                                  <Row align="middle" justify="space-between" style={{ marginBottom: '12px' }}>
                                    <Col>
                                      <Text style={{ fontSize: 14, color: '#8c8c8c' }}>
                                        {prices.formattedUsd}
                                      </Text>
                                    </Col>
                                    <Col>
                                      <Title level={3} style={{ margin: 0, color: '#52c41a' }}>
                                        {prices.formattedArs}
                                      </Title>
                                    </Col>
                                  </Row>
                                  
                                  <Divider style={{ margin: '0 0 12px 0' }} />
                                  
                                  {/* Stock debajo del precio */}
                                  <Text
                                    style={{
                                      color: product.stock <= 5 && product.stock > 0 ? '#ff4d4f' : undefined,
                                      display: 'block',
                                      textAlign: 'right'
                                    }}
                                  >
                                    Stock: {product.stock} {product.stock <= 5 && product.stock > 0 ? '(¡Últimas unidades!)' : ''}
                                  </Text>
                                </>
                              )}
                              
                              {/* Desktop Layout */}
                              {!isMobile && (
                                <Row wrap={false} align="middle">
                                  {/* Imagen sin margen a la izquierda */}
                                  <Col flex="120px">
                                    {product.image ? (
                                      <Image
                                        src={product.image}
                                        alt={product.name}
                                        style={{ 
                                          width: '120px',
                                          height: '120px',
                                          objectFit: 'cover',
                                          borderRadius: '4px',
                                          display: 'block'
                                        }}
                                        preview={false}
                                        placeholder={<Skeleton.Image active style={{ width: '120px', height: '120px' }} />}
                                        fallback="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiNmNWY1ZjUiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjZDlkOWQ5Ij5JbWFnZW4gbm8gZGlzcG9uaWJsZTwvdGV4dD48L3N2Zz4="
                                      />
                                    ) : (
                                      <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        background: '#f5f5f5',
                                        width: '120px',
                                        height: '120px',
                                        borderRadius: '4px'
                                      }}>
                                        <InboxOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
                                      </div>
                                    )}
                                  </Col>
                                  
                                  {/* Espacio de 24px entre imagen y contenido */}
                                  <Col flex="24px"></Col>
                                  
                                  {/* Contenido que crece */}
                                  <Col flex="auto">
                                    <Row>
                                      <Col flex="auto">
                                        <Tooltip title={product.name}>
                                          <Title
                                            level={4}
                                            ellipsis={{ tooltip: true }}
                                            style={{ 
                                              margin: 0,
                                              width: '100%'
                                            }}
                                          >
                                            {product.name}
                                          </Title>
                                        </Tooltip>
                                      </Col>
                                      <Col>
                                        {loadingDolar || !dolarBlue ? (
                                          <Spin size="small" />
                                        ) : (
                                          <div style={{ textAlign: 'right' }}>
                                            <Text style={{ fontSize: 14, color: '#8c8c8c', display: 'block' }}>
                                              {prices.formattedUsd}
                                            </Text>
                                            <Title level={3} style={{ margin: 0, color: '#52c41a' }}>
                                              {prices.formattedArs}
                                            </Title>
                                          </div>
                                        )}
                                      </Col>
                                    </Row>

                                    <Divider style={{ margin: '12px 0' }} />

                                    <Row>
                                      <Col span={24} style={{ textAlign: 'right' }}>
                                        <Text
                                          style={{
                                            color: product.stock <= 5 && product.stock > 0 ? '#ff4d4f' : undefined
                                          }}
                                        >
                                          Stock: {product.stock} {product.stock <= 5 && product.stock > 0 ? '(¡Últimas unidades!)' : ''}
                                        </Text>
                                      </Col>
                                    </Row>
                                  </Col>
                                </Row>
                              )}
                            </Card>
                          </Col>
                        );
                      })}
                    </Row>
                  )}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}