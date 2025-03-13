'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Button,
  InputNumber,
  Table,
  Select,
  Typography,
  message,
  Space,
  Divider,
  Empty,
  Row,
  Col,
  Radio,
  Input,
  AutoComplete
} from 'antd';
import {
  ShoppingCartOutlined,
  DeleteOutlined,
  ArrowLeftOutlined,
  PlusOutlined,
  WhatsAppOutlined,
  InstagramOutlined,
  FacebookOutlined,
  EditOutlined,
  CheckOutlined,
  CloseOutlined
} from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { Customer, Product } from '../../../types';
import {
  formatUsdPrice,
  calculateSellingPrice,
  formatPriceWithExchange,
  calculateArsPrice
} from '../../../utils/priceUtils';
import { useAuth } from '@/lib/AuthContext';

const { Title, Text } = Typography;
const { Option } = Select;

// Tipo específico para SaleItem en la nueva venta (sin ID ya que aún no existe en la BD)
type NewSaleItem = {
  product_id: number;
  quantity: number;
  product: Product;
  selling_price: number;
  price_ars: number;
  custom_price?: boolean; // Indica si el precio ha sido personalizado manualmente
  editing?: boolean; // Para controlar edición en línea
};

// Tipo para el nuevo cliente
type NewCustomerData = {
  name: string;
  whatsapp: string | null;
  instagram: string | null;
  facebook: string | null;
};

export default function NewSalePage() {
  const [isSaving, setIsSaving] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [saleItems, setSaleItems] = useState<NewSaleItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<number | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string>('efectivo');
  const [quantity, setQuantity] = useState<number>(1);
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [newCustomerData, setNewCustomerData] =
    useState<NewCustomerData | null>(null);
  const [selectedProductPrice, setSelectedProductPrice] = useState<
    number | null
  >(null);

  const router = useRouter();
  const { user } = useAuth();

  // Convertir las funciones fetch a useCallback
  const fetchProducts = useCallback(async () => {
    try {
      const response = await fetch('/api/products');
      if (!response.ok) {
        throw new Error('Error al obtener productos');
      }
      const data = await response.json();
      setProducts(data);
    } catch (error) {
      console.error('Error:', error);
      message.error('Error al cargar los productos');
    }
  }, []);

  const fetchCustomers = useCallback(async () => {
    try {
      const response = await fetch('/api/customers');
      if (!response.ok) {
        throw new Error('Error al obtener clientes');
      }
      const data = await response.json();
      setCustomers(data);
    } catch (error) {
      console.error('Error:', error);
      message.error('Error al cargar los clientes');
    }
  }, []);

  const fetchExchangeRate = useCallback(async () => {
    try {
      const response = await fetch('/api/dolar-blue');
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data && data.data.venta) {
          setExchangeRate(parseFloat(data.data.venta));
        }
      }
    } catch (error) {
      console.error('Error al obtener tipo de cambio:', error);
      // Usar valor por defecto si falla
      setExchangeRate(1200);
    }
  }, []);

  // Ahora añadimos las dependencias al useEffect
  useEffect(() => {
    fetchProducts();
    fetchCustomers();
    fetchExchangeRate();
  }, [fetchProducts, fetchCustomers, fetchExchangeRate]);

  // Manejar selección de producto
  const handleProductSelect = (productId: number) => {
    setSelectedProduct(productId);

    const product = products.find((p) => p.id === productId);
    if (product) {
      const price = calculateSellingPrice(product);
      setSelectedProductPrice(price);
    } else {
      setSelectedProductPrice(null);
    }
  };

  const handleAddItem = () => {
    if (!selectedProduct || quantity <= 0) {
      message.warning('Selecciona un producto y una cantidad válida');
      return;
    }

    const product = products.find((p) => p.id === selectedProduct);
    if (!product) {
      message.warning('Producto no encontrado');
      return;
    }

    if (product.stock < quantity) {
      message.warning(`No hay suficiente stock (disponible: ${product.stock})`);
      return;
    }

    // Usar el precio editado si existe, de lo contrario calcular el predeterminado
    const selling_price =
      selectedProductPrice || calculateSellingPrice(product);

    // Calcular precio en ARS usando la función de priceUtils
    const price_ars = exchangeRate
      ? calculateArsPrice(selling_price, exchangeRate)
      : 0;

    // Verificar si el producto ya está en la lista
    const existingItemIndex = saleItems.findIndex(
      (item) => item.product_id === selectedProduct
    );
    if (existingItemIndex >= 0) {
      const updatedItems = [...saleItems];
      const itemToUpdate = updatedItems[existingItemIndex];
      if (!itemToUpdate) {
        message.error('Error al actualizar: El ítem no se encontró');
        return;
      }
      const newQuantity = itemToUpdate.quantity + quantity;
      if (product.stock < newQuantity) {
        message.warning(
          `No hay suficiente stock para agregar más unidades (disponible: ${product.stock})`
        );
        return;
      }
      itemToUpdate.quantity = newQuantity;
      setSaleItems(updatedItems);
    } else {
      // Agregar nuevo item
      setSaleItems([
        ...saleItems,
        {
          product_id: selectedProduct,
          quantity,
          product,
          selling_price,
          price_ars,
          custom_price: selectedProductPrice !== null // Marcar como personalizado si se editó el precio
        }
      ]);
    }

    // Resetear selección
    setSelectedProduct(null);
    setSelectedProductPrice(null);
    setQuantity(1);
  };

  const handleRemoveItem = (index: number) => {
    const updatedItems = [...saleItems];
    updatedItems.splice(index, 1);
    setSaleItems(updatedItems);
  };

  const handleCustomerChange = (value: string) => {
    if (value === 'new') {
      // Crear nuevo cliente
      setShowNewCustomerForm(true);
      setSelectedCustomer(null);
      setNewCustomerData({
        name: '',
        whatsapp: null,
        instagram: null,
        facebook: null
      });
    } else if (value === null || value === '') {
      // Opción "Sin cliente"
      setSelectedCustomer(null);
      setShowNewCustomerForm(false);
      setNewCustomerData(null);
    } else {
      // Cliente existente seleccionado
      setSelectedCustomer(Number(value));
      setShowNewCustomerForm(false);
      setNewCustomerData(null);
    }
  };

  const handleNewCustomerInputChange = (field: string, value: string) => {
    if (newCustomerData) {
      setNewCustomerData({
        ...newCustomerData,
        [field]: value || null
      });
    }
  };

  // Iniciar edición del precio para un ítem
  const startEditing = (index: number) => {
    const updatedItems = [...saleItems];
    const item = updatedItems[index];
    if (item) {
      item.editing = true;
      setSaleItems(updatedItems);
    }
  };

  // Guardar precio editado
  const saveEditedPrice = (index: number, newPrice: number) => {
    if (newPrice <= 0) {
      message.warning('El precio debe ser mayor a 0');
      return;
    }

    const updatedItems = [...saleItems];
    const item = updatedItems[index];
    if (!item) {
      message.warning('Error: no se encontró el ítem seleccionado');
      return;
    }

    item.selling_price = newPrice;
    item.custom_price = true;
    item.editing = false;

    // Recalcular el precio en ARS utilizando priceUtils
    if (exchangeRate) {
      item.price_ars = calculateArsPrice(newPrice, exchangeRate);
    }

    setSaleItems(updatedItems);
  };

  // Cancelar la edición del precio
  const cancelEditing = (index: number) => {
    const updatedItems = [...saleItems];
    const item = updatedItems[index];
    if (item) {
      item.editing = false;
    }
    setSaleItems(updatedItems);
  };

  // Manejar cambio en la cantidad del producto
  const handleQuantityChange = (index: number, newQuantity: number) => {
    if (newQuantity <= 0) {
      message.warning('La cantidad debe ser mayor a 0');
      return;
    }

    const updatedItems = [...saleItems];
    const item = updatedItems[index];
    if (!item) return;

    // Verificar stock disponible
    if (item.product.stock < newQuantity) {
      message.warning(
        `No hay suficiente stock (disponible: ${item.product.stock})`
      );
      return;
    }

    item.quantity = newQuantity;
    setSaleItems(updatedItems);
  };

  const handleCreateSale = async () => {
    if (saleItems.length === 0) {
      message.warning('No hay productos en la venta');
      return;
    }

    setIsSaving(true);
    try {
      // Consultar el tipo de cambio actual del dólar blue
      let currentExchangeRate = exchangeRate;

      if (!currentExchangeRate) {
        try {
          const rateResponse = await fetch('/api/dolar-blue');
          if (rateResponse.ok) {
            const rateData = await rateResponse.json();
            if (rateData.success && rateData.data && rateData.data.venta) {
              currentExchangeRate = parseFloat(rateData.data.venta);
            }
          }
        } catch (error) {
          console.error('Error fetching exchange rate:', error);
          // Continuar sin tipo de cambio si falla
        }
      }

      // Definimos una interfaz para el tipo de datos de venta
      interface SaleData {
        items: {
          product_id: number;
          quantity: number;
          selling_price: number;
          price_ars: number;
        }[];
        payment_method: string;
        exchange_rate: number | null;
        customer_id?: number;
        user_id?: string | null;
        custom_prices?: Record<number, number>;
        customer_data?: {
          name: string;
          whatsapp: string | null;
          instagram: string | null;
          facebook: string | null;
        };
      }

      // Preparar precios personalizados
      const custom_prices: Record<number, number> = {};
      saleItems.forEach((item) => {
        if (item.custom_price) {
          custom_prices[item.product_id] = item.selling_price;
        }
      });

      // Preparar datos de la venta
      const saleData: SaleData = {
        items: saleItems.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          selling_price: item.selling_price,
          price_ars: item.price_ars
        })),
        payment_method: paymentMethod,
        exchange_rate: currentExchangeRate, // Guardar el tipo de cambio al momento de la venta
        user_id: user?.id || null, // Guardar el ID del usuario actual de Supabase
        custom_prices // Enviar los precios personalizados
      };

      // Añadir datos del cliente si corresponde
      if (selectedCustomer) {
        // Cliente existente
        saleData.customer_id = selectedCustomer;
      } else if (
        showNewCustomerForm &&
        newCustomerData &&
        newCustomerData.name.trim()
      ) {
        // Nuevo cliente
        saleData.customer_data = {
          name: newCustomerData.name,
          whatsapp: newCustomerData.whatsapp,
          instagram: newCustomerData.instagram,
          facebook: newCustomerData.facebook
        };
      }
      // Si no hay cliente seleccionado, se crea la venta sin cliente

      const response = await fetch('/api/sales', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(saleData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al crear la venta');
      }

      message.success('Venta creada correctamente');
      router.push('/sales');
    } catch (error) {
      console.error('Error:', error);
      message.error(
        error instanceof Error ? error.message : 'Error al crear la venta'
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Calcular el total
  const calculateTotal = () => {
    return saleItems.reduce((total, item) => {
      return total + item.selling_price * item.quantity;
    }, 0);
  };

  // Añadir esta función utilitaria después de calculateTotalArs
  // Extraer de forma segura el precio en ARS de un string formateado
  const extractArsPrice = (formattedPrice: string): string => {
    if (!formattedPrice) return 'AR$ 0.00';

    const parts = formattedPrice.split('|');
    if (!parts || parts.length <= 1) return 'AR$ 0.00';

    const arsPart = parts[1]?.trim();
    return arsPart || 'AR$ 0.00';
  };

  // Columnas para la tabla
  const columns = [
    {
      title: 'Cantidad',
      key: 'quantity',
      width: 100,
      render: (item: NewSaleItem, _: unknown, index: number) => (
        <InputNumber
          min={1}
          value={item.quantity}
          onChange={(value) => handleQuantityChange(index, value || 1)}
          style={{ width: 80 }}
        />
      )
    },
    {
      title: 'Producto',
      dataIndex: ['product', 'name'],
      key: 'product'
    },
    {
      title: 'Precio USD',
      key: 'price_usd',
      width: 160,
      render: (item: NewSaleItem, _: unknown, index: number) => {
        if (item.editing) {
          return (
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <InputNumber
                style={{ width: 80 }}
                min={0.01}
                step={0.01}
                precision={2}
                defaultValue={item.selling_price}
                onBlur={(e) =>
                  saveEditedPrice(index, parseFloat(e.target.value))
                }
                onPressEnter={(e) =>
                  saveEditedPrice(
                    index,
                    parseFloat((e.target as HTMLInputElement).value)
                  )
                }
                autoFocus
              />
              <Space size="small" style={{ marginLeft: 4 }}>
                <Button
                  size="small"
                  type="link"
                  icon={<CheckOutlined style={{ color: '#52c41a' }} />}
                  onClick={() => {
                    const input = document.activeElement as HTMLInputElement;
                    saveEditedPrice(index, parseFloat(input.value));
                  }}
                />
                <Button
                  size="small"
                  type="link"
                  icon={<CloseOutlined style={{ color: '#ff4d4f' }} />}
                  onClick={() => cancelEditing(index)}
                />
              </Space>
            </div>
          );
        }

        return (
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Text style={{ marginRight: 4 }}>
              {formatUsdPrice(item.selling_price)}
            </Text>
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => startEditing(index)}
              style={{ padding: 0 }}
            />
          </div>
        );
      }
    },
    {
      title: 'Precio ARS',
      key: 'price_ars',
      width: 140,
      render: (item: NewSaleItem) => {
        const formattedPrice = formatPriceWithExchange(
          item.selling_price,
          exchangeRate
        );
        return <Text>{extractArsPrice(formattedPrice)}</Text>;
      }
    },
    {
      title: 'Subtotal',
      key: 'subtotal',
      width: 140,
      render: (item: NewSaleItem) => (
        <Text strong>
          {formatPriceWithExchange(
            item.selling_price * item.quantity,
            exchangeRate
          )}
        </Text>
      )
    },
    {
      title: 'Acciones',
      key: 'action',
      width: 80,
      render: (_: unknown, _record: unknown, index: number) => (
        <Button
          icon={<DeleteOutlined />}
          danger
          onClick={() => handleRemoveItem(index)}
          size="small"
        />
      )
    }
  ];

  return (
    <div style={{ padding: 16, width: '100%', boxSizing: 'border-box' }}>
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card title="Cliente" style={{ marginBottom: 16 }}>
            <Row gutter={16} justify="space-between" align="middle">
              <Col flex="auto">
                <div className="mb-4">
                  <AutoComplete
                    style={{ width: '100%' }}
                    placeholder="Sin cliente / Buscar cliente / Crear nuevo"
                    onChange={handleCustomerChange}
                    value={
                      selectedCustomer
                        ? customers.find((c) => c.id === selectedCustomer)?.name
                        : undefined
                    }
                    options={[
                      { value: '', label: 'Sin cliente' },
                      { value: 'new', label: '+ Crear nuevo cliente' },
                      ...customers.map((customer) => ({
                        value: String(customer.id),
                        label: customer.name
                      }))
                    ]}
                    filterOption={(inputValue, option) =>
                      option!.label
                        .toString()
                        .toLowerCase()
                        .indexOf(inputValue.toLowerCase()) !== -1
                    }
                  />
                </div>
              </Col>
              <Col>
                <Button
                  icon={<ArrowLeftOutlined />}
                  onClick={() => router.push('/sales')}
                >
                  Volver
                </Button>
              </Col>
            </Row>

            {showNewCustomerForm && (
              <div
                style={{
                  padding: 16,
                  background: '#f5f5f5',
                  borderRadius: 4,
                  marginTop: 16
                }}
              >
                <Title level={5} style={{ marginBottom: 16 }}>
                  Nuevo Cliente
                </Title>
                <Row gutter={[16, 16]}>
                  <Col xs={24} md={12}>
                    <div style={{ marginBottom: 12 }}>
                      <Text>Nombre *</Text>
                      <Input
                        placeholder="Nombre del cliente"
                        value={newCustomerData?.name || ''}
                        onChange={(e) =>
                          handleNewCustomerInputChange('name', e.target.value)
                        }
                      />
                    </div>
                  </Col>
                  <Col xs={24} md={12}>
                    <div style={{ marginBottom: 12 }}>
                      <Text>WhatsApp</Text>
                      <Input
                        placeholder="Número de WhatsApp"
                        value={newCustomerData?.whatsapp || ''}
                        onChange={(e) =>
                          handleNewCustomerInputChange(
                            'whatsapp',
                            e.target.value
                          )
                        }
                        prefix={<WhatsAppOutlined />}
                      />
                    </div>
                  </Col>
                  <Col xs={24} md={12}>
                    <div style={{ marginBottom: 12 }}>
                      <Text>Instagram</Text>
                      <Input
                        placeholder="Usuario de Instagram"
                        value={newCustomerData?.instagram || ''}
                        onChange={(e) =>
                          handleNewCustomerInputChange(
                            'instagram',
                            e.target.value
                          )
                        }
                        prefix={<InstagramOutlined />}
                      />
                    </div>
                  </Col>
                  <Col xs={24} md={12}>
                    <div style={{ marginBottom: 12 }}>
                      <Text>Facebook</Text>
                      <Input
                        placeholder="Usuario o URL de Facebook"
                        value={newCustomerData?.facebook || ''}
                        onChange={(e) =>
                          handleNewCustomerInputChange(
                            'facebook',
                            e.target.value
                          )
                        }
                        prefix={<FacebookOutlined />}
                      />
                    </div>
                  </Col>
                </Row>
              </div>
            )}
          </Card>

          <Card title="Agregar Productos" style={{ marginBottom: 16 }}>
            <Row gutter={16} align="middle">
              <Col flex="100px">
                <Text>Cantidad</Text>
                <InputNumber
                  min={1}
                  value={quantity}
                  onChange={(value) => setQuantity(value || 1)}
                  style={{ width: '100%' }}
                />
              </Col>
              <Col flex="auto">
                <Text>Producto</Text>
                <Select
                  placeholder="Seleccionar producto"
                  onChange={handleProductSelect}
                  value={selectedProduct}
                  style={{ width: '100%' }}
                  showSearch
                  filterOption={(input, option) =>
                    (option?.children as unknown as string)
                      ?.toLowerCase()
                      .includes(input.toLowerCase())
                  }
                >
                  {products
                    .filter((product) => product.stock > 0)
                    .map((product) => (
                      <Option key={product.id} value={product.id}>
                        {product.name} -{' '}
                        {formatPriceWithExchange(
                          calculateSellingPrice(product),
                          exchangeRate
                        )}{' '}
                        (Stock: {product.stock})
                      </Option>
                    ))}
                </Select>
              </Col>
              <Col flex="160px">
                <Text>Precio USD</Text>
                <div>
                  <InputNumber
                    style={{ width: '100%' }}
                    min={0.01}
                    step={0.01}
                    precision={2}
                    value={selectedProductPrice}
                    onChange={(value) => setSelectedProductPrice(value || 0)}
                    prefix="U$"
                  />
                </div>
              </Col>
              <Col flex="140px">
                <Text>Precio ARS</Text>
                <div>
                  <Text>
                    {(() => {
                      if (!selectedProductPrice || !exchangeRate)
                        return 'AR$ 0.00';
                      const formattedPrice = formatPriceWithExchange(
                        selectedProductPrice,
                        exchangeRate
                      );
                      return extractArsPrice(formattedPrice);
                    })()}
                  </Text>
                </div>
              </Col>
              <Col flex="120px">
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={handleAddItem}
                  disabled={!selectedProduct || quantity <= 0}
                  style={{ width: '100%', marginTop: 24 }}
                >
                  Agregar
                </Button>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16} style={{ marginBottom: 16 }}>
          <Card title="Productos en la venta" style={{ height: '100%' }}>
            {saleItems.length === 0 ? (
              <Empty description="No hay productos agregados" />
            ) : (
              <Table
                dataSource={saleItems}
                columns={columns}
                pagination={false}
                rowKey={(record: NewSaleItem) => `${record.product_id}`}
                bordered
              />
            )}
          </Card>
        </Col>

        <Col xs={24} lg={8} style={{ marginBottom: 16 }}>
          <Card title="Resumen de Venta" style={{ height: '100%' }}>
            <div className="mb-4">
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: 8
                }}
              >
                <Text>Productos:</Text>
                <Text>{saleItems.length}</Text>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: 8
                }}
              >
                <Text>Items totales:</Text>
                <Text>
                  {saleItems.reduce((acc, item) => acc + item.quantity, 0)}
                </Text>
              </div>

              <div style={{ marginTop: 16, marginBottom: 16 }}>
                <Text strong>Medio de Pago:</Text>
                <Radio.Group
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  style={{ display: 'flex', marginTop: 8 }}
                >
                  <Radio value="efectivo">Efectivo</Radio>
                  <Radio value="transferencia">Transferencia</Radio>
                </Radio.Group>
              </div>

              <Divider style={{ margin: '16px 0' }} />

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: 8
                }}
              >
                <Text strong>Total USD:</Text>
                <Text strong>{formatUsdPrice(calculateTotal())}</Text>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text strong>Total ARS:</Text>
                <Text strong style={{ color: '#52c41a', fontSize: 18 }}>
                  {extractArsPrice(
                    formatPriceWithExchange(calculateTotal(), exchangeRate)
                  )}
                </Text>
              </div>
            </div>

            <Button
              type="primary"
              icon={<ShoppingCartOutlined />}
              block
              size="large"
              onClick={handleCreateSale}
              loading={isSaving}
              disabled={saleItems.length === 0}
            >
              Finalizar Venta
            </Button>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
