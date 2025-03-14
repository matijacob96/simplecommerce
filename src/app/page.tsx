'use client';

import { useState, Suspense, useRef, useEffect, useCallback } from 'react';
import {
  Input,
  Select,
  Card,
  Spin,
  Empty,
  Space,
  Typography,
  Row,
  Col,
  Image,
  Divider,
  Switch,
  Button,
  Tooltip,
  Drawer,
  ConfigProvider,
  App
} from 'antd';
import {
  SearchOutlined,
  FilterOutlined,
  InboxOutlined,
  DollarOutlined
} from '@ant-design/icons';
import { Product, useAppState } from '@/lib/AppStateContext';

const { Option } = Select;
const { Text, Title } = Typography;

// Hook personalizado para manejar el montaje/desmontaje seguro
const useMountedState = () => {
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return mountedRef;
};

// Componente simplificado para la imagen que no usa CSS-in-JS de Ant Design
interface SafeImageProps {
  src?: string;
  alt: string;
  style?: React.CSSProperties;
  preview?: boolean;
  fallback?: string;
  [key: string]: unknown;
}

const SafeImage = ({ src, alt, style, ...props }: SafeImageProps) => {
  const [hasError, setHasError] = useState(false);
  const isMounted = useMountedState();

  const handleError = useCallback(() => {
    if (isMounted.current) {
      setHasError(true);
    }
  }, [isMounted]);

  if (!src || hasError) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f5f5f5',
          width: style?.width || '120px',
          height: style?.height || '120px',
          borderRadius: '4px',
          ...style
        }}
      >
        <InboxOutlined
          style={{
            fontSize: 48,
            color: '#d9d9d9'
          }}
        />
      </div>
    );
  }

  // Usar Image directamente con lazy loading y sin spinner adicional
  return (
    <Image
      src={src}
      alt={alt}
      style={style}
      placeholder={false}
      preview={false}
      loading="lazy"
      onError={handleError}
      {...props}
    />
  );
};

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

// Componente interno que usa useSearchParams
function CatalogContent() {
  const isMounted = useMountedState();
  const {
    filteredProducts,
    categories,
    loading,
    isMobile,
    dolarBlue,
    loadingDolar,
    search,
    filter,
    onlyAvailable,
    sortBy,
    setSearch,
    handleSearchSubmit,
    handleSearchClear,
    handleCategoryChange,
    handleAvailabilityChange,
    handleSortChange,
    getPrices,
    refreshData
  } = useAppState();

  // Estado local solo para el drawer de filtros
  const [filterDrawerVisible, setFilterDrawerVisible] = useState(false);

  // Función para cerrar el drawer
  const handleCloseDrawer = useCallback(() => {
    if (isMounted.current) {
      setFilterDrawerVisible(false);
    }
  }, [isMounted]);

  // Funciones seguras para evitar actualizaciones en componentes desmontados
  const safeSetFilterDrawerVisible = useCallback(
    (value: boolean) => {
      if (isMounted.current) {
        setFilterDrawerVisible(value);
      }
    },
    [isMounted]
  );

  // Lista de categorías para el selector
  const categoryItems = [
    { label: 'Todos', value: 'all' },
    ...categories.map((category) => ({
      label: category.name,
      value: category.id.toString()
    }))
  ];

  // Lista de opciones de ordenamiento
  const sortOptions = [
    { label: 'Por defecto', value: 'default' },
    { label: 'Precio: menor a mayor', value: 'price_asc' },
    { label: 'Precio: mayor a menor', value: 'price_desc' },
    { label: 'Nombre: A-Z', value: 'name_asc' },
    { label: 'Nombre: Z-A', value: 'name_desc' }
  ];

  function handleRefreshData() {
    refreshData();
  }

  // Memoizar las funciones de obtención de precios para evitar recálculos innecesarios
  const getProductPrices = useCallback(
    (product: Product) => {
      try {
        return getPrices(product);
      } catch (error) {
        console.error('Error al obtener precios:', error);
        return {
          usdPrice: 0,
          arsPrice: 0,
          formattedUsd: '$ 0.00',
          formattedArs: '$ 0.00'
        };
      }
    },
    [getPrices]
  );

  return (
    <>
      {/* Estilos para scrollbar invisible */}
      <style>{scrollbarStyles}</style>

      {/* Contenedor principal - Sin scroll, full height */}
      <div
        style={{
          height: 'calc(100vh - 64px)',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxSizing: 'border-box'
        }}
      >
        {/* Cards superiores con altura fija */}
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          {/* Card de búsqueda */}
          <Col xs={24} md={16} style={{ height: 'auto' }}>
            <Card
              title={
                <>
                  <SearchOutlined /> Búsqueda
                </>
              }
              variant="outlined"
              className="search-and-filters"
              styles={{ body: { padding: '12px 24px' } }}
            >
              <div style={{ display: 'flex', width: '100%' }}>
                <Input
                  placeholder="Buscar producto por nombre..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  prefix={<SearchOutlined />}
                  size="large"
                  style={{ flex: 1 }}
                  onPressEnter={handleSearchSubmit}
                  allowClear
                  onClear={handleSearchClear}
                />
                {isMobile ? (
                  <>
                    <Button
                      icon={<FilterOutlined />}
                      onClick={() => safeSetFilterDrawerVisible(true)}
                      size="large"
                      style={{ marginLeft: 8 }}
                    />
                    <Button
                      type="primary"
                      onClick={handleSearchSubmit}
                      size="large"
                      style={{ marginLeft: 8 }}
                    >
                      Buscar
                    </Button>
                  </>
                ) : (
                  <Button
                    type="primary"
                    onClick={handleSearchSubmit}
                    size="large"
                    style={{ marginLeft: 8 }}
                  >
                    Buscar
                  </Button>
                )}
              </div>
            </Card>
          </Col>

          {/* Card de filtros - Solo visible en desktop */}
          {!isMobile && (
            <Col xs={24} md={8} style={{ height: 'auto' }}>
              <Card
                title={
                  <>
                    <FilterOutlined /> Filtros
                  </>
                }
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
                        {onlyAvailable
                          ? 'Productos con stock'
                          : 'Todos los productos'}
                      </Text>
                    </div>
                  </div>

                  {/* Filtros en la misma fila */}
                  <Row gutter={[16, 0]} style={{ width: '100%' }}>
                    <Col span={12}>
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
                    </Col>
                    <Col span={12}>
                      <div>
                        <Text>Ordenar por:</Text>
                        <Select
                          style={{ width: '100%', marginTop: 2 }}
                          placeholder="Seleccionar orden"
                          value={sortBy}
                          onChange={handleSortChange}
                          size="middle"
                          popupMatchSelectWidth={false}
                        >
                          {sortOptions.map((option) => (
                            <Option key={option.value} value={option.value}>
                              {option.label}
                            </Option>
                          ))}
                        </Select>
                      </div>
                    </Col>
                  </Row>

                  {/* Mostrar tipo de cambio actual */}
                  {loadingDolar ? (
                    <div style={{ marginTop: 8 }}>
                      <Text type="secondary">
                        <DollarOutlined /> Cargando tipo de cambio...
                      </Text>
                    </div>
                  ) : (
                    dolarBlue && (
                      <div style={{ marginTop: 8 }}>
                        <Tooltip title="Tipo de cambio utilizado para calcular los precios">
                          <Text type="secondary">
                            <DollarOutlined /> Dólar Blue:{' '}
                            {dolarBlue
                              ? `$${dolarBlue.venta.toLocaleString('es-AR')}`
                              : 'No disponible'}
                          </Text>
                        </Tooltip>
                      </div>
                    )
                  )}
                </Space>
              </Card>
            </Col>
          )}
        </Row>

        {/* Drawer para filtros en móvil */}
        <Drawer
          title="Filtros"
          placement="right"
          onClose={handleCloseDrawer}
          open={filterDrawerVisible}
          width={isMobile ? '80%' : 400}
          destroyOnClose={true}
        >
          <Space direction="vertical" style={{ width: '100%' }} size={16}>
            <div>
              <Text strong>Mostrar solo disponibles:</Text>
              <div style={{ marginTop: 8 }}>
                <Switch
                  checked={onlyAvailable}
                  onChange={handleAvailabilityChange}
                  checkedChildren="Sí"
                  unCheckedChildren="No"
                />
                <Text style={{ marginLeft: 12 }}>
                  {onlyAvailable
                    ? 'Productos con stock'
                    : 'Todos los productos'}
                </Text>
              </div>
            </div>

            {/* Filtros en la misma fila en el drawer también */}
            <Row gutter={[16, 0]}>
              <Col span={12}>
                <div>
                  <Text strong>Categoría:</Text>
                  <Select
                    style={{ width: '100%', marginTop: 8 }}
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
              </Col>
              <Col span={12}>
                <div>
                  <Text strong>Ordenar por:</Text>
                  <Select
                    style={{ width: '100%', marginTop: 8 }}
                    placeholder="Seleccionar orden"
                    value={sortBy}
                    onChange={handleSortChange}
                    size="middle"
                    popupMatchSelectWidth={false}
                  >
                    {sortOptions.map((option) => (
                      <Option key={option.value} value={option.value}>
                        {option.label}
                      </Option>
                    ))}
                  </Select>
                </div>
              </Col>
            </Row>

            {/* Mostrar tipo de cambio actual */}
            {loadingDolar ? (
              <div style={{ marginTop: 8 }}>
                <Text type="secondary">
                  <DollarOutlined /> Cargando tipo de cambio...
                </Text>
              </div>
            ) : (
              dolarBlue && (
                <div style={{ marginTop: 8 }}>
                  <Text type="secondary">
                    <DollarOutlined /> Dólar Blue:{' '}
                    {dolarBlue
                      ? `$${dolarBlue.venta.toLocaleString('es-AR')}`
                      : 'No disponible'}
                  </Text>
                </div>
              )
            )}
          </Space>
        </Drawer>

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
                backgroundColor: '#fff'
              },
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
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    padding: 64,
                    width: '100%',
                    height: '100%'
                  }}
                >
                  <Spin size="large" />
                </div>
              ) : (
                <div>
                  {!filteredProducts || filteredProducts.length === 0 ? (
                    <Empty
                      description="No se encontraron productos."
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                    >
                      <Button
                        type="primary"
                        onClick={() => {
                          handleRefreshData();
                        }}
                      >
                        Reintentar
                      </Button>
                    </Empty>
                  ) : (
                    <Row gutter={[16, 16]}>
                      {filteredProducts.map((product) => {
                        // Verificación básica de producto
                        if (!product || !product.id) return null;

                        try {
                          // Obtener precio del producto de forma segura
                          const prices = getProductPrices(product);

                          // Mostrar el resultado del producto
                          return (
                            <Col xs={24} md={12} key={product.id}>
                              <Card
                                variant="outlined"
                                style={{ width: '100%', height: '100%' }}
                              >
                                {/* Mobile Layout */}
                                {isMobile && (
                                  <>
                                    {/* Imagen centrada */}
                                    <div
                                      style={{
                                        display: 'flex',
                                        justifyContent: 'center',
                                        width: '100%',
                                        marginBottom: '16px'
                                      }}
                                    >
                                      <SafeImage
                                        src={product.image}
                                        alt={product.name}
                                        style={{
                                          width: '200px',
                                          height: '200px',
                                          objectFit: 'cover',
                                          borderRadius: '4px'
                                        }}
                                        preview={false}
                                        fallback="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiNmNWY1ZjUiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjZDlkOWQ5Ij5JbWFnZW4gbm8gZGlzcG9uaWJsZTwvdGV4dD48L3N2Zz4="
                                      />
                                    </div>

                                    {/* Título con elipsis y tooltip */}
                                    <Tooltip title={product.name}>
                                      <div
                                        style={{
                                          width: '100%',
                                          marginBottom: '12px'
                                        }}
                                      >
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
                                    <Row
                                      align="middle"
                                      justify="space-between"
                                      style={{ marginBottom: '12px' }}
                                    >
                                      <Col>
                                        <Text
                                          style={{
                                            fontSize: 14,
                                            color: '#8c8c8c'
                                          }}
                                        >
                                          {prices.formattedUsd}
                                        </Text>
                                      </Col>
                                      <Col>
                                        <Title
                                          level={3}
                                          style={{
                                            margin: 0,
                                            color: '#52c41a'
                                          }}
                                        >
                                          {prices.formattedArs}
                                        </Title>
                                      </Col>
                                    </Row>

                                    <Divider style={{ margin: '0 0 12px 0' }} />

                                    {/* Stock debajo del precio */}
                                    <Text
                                      style={{
                                        color:
                                          product.stock <= 5 &&
                                          product.stock > 0
                                            ? '#ff4d4f'
                                            : undefined,
                                        display: 'block',
                                        textAlign: 'right'
                                      }}
                                    >
                                      Stock: {product.stock}{' '}
                                      {product.stock <= 5 && product.stock > 0
                                        ? '(¡Últimas unidades!)'
                                        : ''}
                                    </Text>
                                  </>
                                )}

                                {/* Desktop Layout */}
                                {!isMobile && (
                                  <Row wrap={false} align="middle">
                                    {/* Imagen sin margen a la izquierda */}
                                    <Col flex="120px">
                                      <SafeImage
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
                                        fallback="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiNmNWY1ZjUiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjZDlkOWQ5Ij5JbWFnZW4gbm8gZGlzcG9uaWJsZTwvdGV4dD48L3N2Zz4="
                                      />
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
                                              <Text
                                                style={{
                                                  fontSize: 14,
                                                  color: '#8c8c8c',
                                                  display: 'block'
                                                }}
                                              >
                                                {prices.formattedUsd}
                                              </Text>
                                              <Title
                                                level={3}
                                                style={{
                                                  margin: 0,
                                                  color: '#52c41a'
                                                }}
                                              >
                                                {prices.formattedArs}
                                              </Title>
                                            </div>
                                          )}
                                        </Col>
                                      </Row>

                                      <Divider style={{ margin: '12px 0' }} />

                                      <Row>
                                        <Col
                                          span={24}
                                          style={{ textAlign: 'right' }}
                                        >
                                          <Text
                                            style={{
                                              color:
                                                product.stock <= 5 &&
                                                product.stock > 0
                                                  ? '#ff4d4f'
                                                  : undefined
                                            }}
                                          >
                                            Stock: {product.stock}{' '}
                                            {product.stock <= 5 &&
                                            product.stock > 0
                                              ? '(¡Últimas unidades!)'
                                              : ''}
                                          </Text>
                                        </Col>
                                      </Row>
                                    </Col>
                                  </Row>
                                )}
                              </Card>
                            </Col>
                          );
                        } catch (error) {
                          console.error('Error al renderizar producto:', error);
                          // Retornar un elemento vacío en caso de error
                          return null;
                        }
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

// Componente principal con Suspense boundary
export default function Catalog() {
  // Usar un ref para controlar el desmontaje
  const appMountedRef = useRef(true);

  // Cleanup effect para gestionar el desmontaje
  useEffect(() => {
    return () => {
      // Marcar como desmontado para evitar actualizaciones de estado
      appMountedRef.current = false;

      // Dar tiempo al evento loop para procesar cualquier operación pendiente
      // antes de la siguiente renderización
      setTimeout(() => {
        // Noop, solo para ayudar a limpiar el event loop
      }, 0);
    };
  }, []);

  return (
    <App>
      <ConfigProvider
        button={{ autoInsertSpace: false }}
        theme={{
          components: {
            Image: {
              colorTextPlaceholder: '#f0f0f0'
            },
            Spin: {
              colorPrimary: '#1890ff'
            }
          }
        }}
      >
        <Suspense
          fallback={
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                padding: 64,
                width: '100%',
                height: 'calc(100vh - 64px)'
              }}
            >
              <Spin size="large" />
            </div>
          }
        >
          <CatalogContent />
        </Suspense>
      </ConfigProvider>
    </App>
  );
}
