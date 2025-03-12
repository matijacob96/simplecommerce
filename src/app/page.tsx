'use client';

import { useState, Suspense } from 'react';
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
  Skeleton,
  Drawer
} from 'antd';
import {
  SearchOutlined,
  FilterOutlined,
  InboxOutlined,
  DollarOutlined
} from '@ant-design/icons';
import { useAppState } from '@/lib/AppStateContext';

const { Option } = Select;
const { Text, Title } = Typography;

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
    setSearch,
    handleSearchSubmit,
    handleSearchClear,
    handleCategoryChange,
    handleAvailabilityChange,
    getPrices,
    refreshData
  } = useAppState();

  // Estado local solo para el drawer de filtros
  const [filterDrawerVisible, setFilterDrawerVisible] = useState(false);

  // Lista de categorías para el selector
  const categoryItems = [
    { label: 'Todos', value: 'all' },
    ...categories.map((category) => ({
      label: category.name,
      value: category.id.toString()
    }))
  ];

  function handleRefreshData() {
    refreshData();
  }

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
                      onClick={() => setFilterDrawerVisible(true)}
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
          onClose={() => setFilterDrawerVisible(false)}
          open={filterDrawerVisible}
          width={isMobile ? '80%' : 400}
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
                  {filteredProducts.length === 0 ? (
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
                        const prices = getPrices(product);

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
                                        placeholder={
                                          <Skeleton.Image
                                            active
                                            style={{
                                              width: '200px',
                                              height: '200px'
                                            }}
                                          />
                                        }
                                        fallback="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiNmNWY1ZjUiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjZDlkOWQ5Ij5JbWFnZW4gbm8gZGlzcG9uaWJsZTwvdGV4dD48L3N2Zz4="
                                        onError={(error) => {
                                          console.error(
                                            'Error al cargar imagen de: ',
                                            product.id,
                                            '. Error: ',
                                            error
                                          );
                                        }}
                                      />
                                    ) : (
                                      <div
                                        style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          background: '#f5f5f5',
                                          width: '200px',
                                          height: '200px',
                                          borderRadius: '4px'
                                        }}
                                      >
                                        <InboxOutlined
                                          style={{
                                            fontSize: 48,
                                            color: '#d9d9d9'
                                          }}
                                        />
                                      </div>
                                    )}
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
                                        style={{ margin: 0, color: '#52c41a' }}
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
                                        product.stock <= 5 && product.stock > 0
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
                                        placeholder={
                                          <Skeleton.Image
                                            active
                                            style={{
                                              width: '120px',
                                              height: '120px'
                                            }}
                                          />
                                        }
                                        fallback="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiNmNWY1ZjUiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjZDlkOWQ5Ij5JbWFnZW4gbm8gZGlzcG9uaWJsZTwvdGV4dD48L3N2Zz4="
                                        onError={(error) => {
                                          console.error(
                                            'Error al cargar imagen de: ',
                                            product.id,
                                            '. Error: ',
                                            error
                                          );
                                        }}
                                      />
                                    ) : (
                                      <div
                                        style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          background: '#f5f5f5',
                                          width: '120px',
                                          height: '120px',
                                          borderRadius: '4px'
                                        }}
                                      >
                                        <InboxOutlined
                                          style={{
                                            fontSize: 48,
                                            color: '#d9d9d9'
                                          }}
                                        />
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
  return (
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
  );
}
