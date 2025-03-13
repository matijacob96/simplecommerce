'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Prisma } from '@prisma/client';
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
  Spin,
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
import { useRouter, useParams } from 'next/navigation';
import {
  formatUsdPrice,
  calculateSellingPrice as calculateProductSellingPrice,
  formatPriceWithExchange,
  calculateArsPrice
} from '@/utils/priceUtils';
import { Product, Customer, SaleItem as ApiSaleItem } from '@/types';
import { useAuth } from '@/lib/AuthContext';

const { Title, Text } = Typography;
const { Option } = Select;

// Interfaces específicas para la página de edición
interface SaleItemWithSellingPrice {
  id?: number;
  product_id: number;
  quantity: number;
  product: Product;
  selling_price: number;
  price_ars: number;
  custom_price?: boolean; // Indica si el precio ha sido personalizado manualmente
  editing?: boolean; // Para controlar edición en línea
}

interface SaleWithItems {
  id: number;
  total: Prisma.Decimal;
  total_ars?: Prisma.Decimal;
  payment_method: string;
  customer_id: number | null;
  customer: Customer | null;
  created_at: string;
  updated_at: string;
  user_id?: string | null;
  items: ApiSaleItem[];
  exchange_rate?: Prisma.Decimal;
}

export default function EditSalePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [saleItems, setSaleItems] = useState<SaleItemWithSellingPrice[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<number | null>(null);
  const [selectedProductPrice, setSelectedProductPrice] = useState<
    number | null
  >(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<string>('efectivo');
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(
    null
  );
  const [newCustomerData, setNewCustomerData] = useState<{
    name: string;
    whatsapp: string;
    instagram: string;
    facebook: string;
  } | null>(null);
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [sale, setSale] = useState<SaleWithItems | null>(null);

  const router = useRouter();
  const params = useParams();
  const saleId = params?.id ? parseInt(params.id as string) : 0;
  const { user } = useAuth();

  // Definir todas las funciones de carga de datos antes del useEffect
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

  // Función auxiliar para obtener el tipo de cambio
  const getExchangeRate = useCallback(async () => {
    try {
      const response = await fetch('/api/dolar-blue');
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data && data.data.venta) {
          return data.data.venta;
        }
      }
      return null;
    } catch (error) {
      console.error('Error al obtener tipo de cambio:', error);
      message.error('Error al obtener tipo de cambio');
      return null;
    }
  }, []);

  // Ahora definimos fetchSaleData usando useCallback
  const fetchSaleData = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/sales/${saleId}`);
      if (!response.ok) {
        throw new Error('No se pudo cargar los datos de la venta');
      }
      const saleData: SaleWithItems = await response.json();
      setSale(saleData);

      // Formatear los items para el estado
      const formattedItems: SaleItemWithSellingPrice[] = saleData.items.map(
        (item) => ({
          id: item.id,
          product_id: item.product_id,
          quantity: item.quantity,
          product: item.product,
          selling_price: Number(item.selling_price),
          price_ars: Number(item.price_ars || 0),
          custom_price: false,
          editing: false
        })
      );

      setSaleItems(formattedItems);

      // Establecer el cliente seleccionado
      if (saleData.customer_id) {
        setSelectedCustomerId(saleData.customer_id);
      }

      // Establecer el método de pago
      setPaymentMethod(saleData.payment_method);

      // Si no hay tipo de cambio en la venta, obtenerlo
      if (!saleData.exchange_rate) {
        // Obtener tipo de cambio
        const exchangeRateValue = await getExchangeRate();
        if (exchangeRateValue) {
          setSale((prevSale) => {
            if (!prevSale) return prevSale;

            // Creamos un objeto que tenga al menos el toString necesario para Prisma.Decimal
            const exchangeRateWithToString = {
              toString: () => exchangeRateValue
            } as Prisma.Decimal;

            return {
              ...prevSale,
              exchange_rate: exchangeRateWithToString
            };
          });
        }
      }
    } catch (error) {
      console.error('Error al cargar la venta:', error);
      message.error('Error al cargar los datos de la venta');
    } finally {
      setIsLoading(false);
    }
  }, [saleId, getExchangeRate]);

  useEffect(() => {
    if (saleId) {
      fetchSaleData();
      fetchProducts();
      fetchCustomers();
    }
  }, [saleId, fetchSaleData, fetchProducts, fetchCustomers]);

  // Manejar cambio de cliente seleccionado
  const handleCustomerChange = (value: number | string) => {
    if (value === 'new') {
      setShowNewCustomerForm(true);
      setSelectedCustomerId(null);
      setNewCustomerData({
        name: '',
        whatsapp: '',
        instagram: '',
        facebook: ''
      });
    } else if (value === null || value === '') {
      // Opción "Sin cliente"
      setSelectedCustomerId(null);
      setShowNewCustomerForm(false);
      setNewCustomerData(null);
    } else {
      // Cliente existente seleccionado
      setSelectedCustomerId(Number(value));
      setShowNewCustomerForm(false);
      setNewCustomerData(null);
    }
  };

  // Manejar cambios en el formulario de nuevo cliente
  const handleNewCustomerInputChange = (field: string, value: string) => {
    if (newCustomerData) {
      setNewCustomerData({
        ...newCustomerData,
        [field]: value
      });
    }
  };

  // Calcular el precio de venta de un producto usando priceUtils
  const calculateSellingPrice = (product: Product): number => {
    return calculateProductSellingPrice(product);
  };

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

    // Recalcular el precio en ARS si tenemos tipo de cambio
    if (sale?.exchange_rate) {
      const exchangeRate = parseFloat(sale.exchange_rate.toString());
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
      setSaleItems(updatedItems);
    }
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

  const handleAddItem = () => {
    if (!selectedProduct || quantity <= 0) {
      message.warning('Selecciona un producto y una cantidad válida');
      return;
    }

    // Encontrar el producto seleccionado
    const product = products.find((p) => p.id === selectedProduct);
    if (!product) {
      message.error('Producto no encontrado');
      return;
    }

    // Verificar si hay suficiente stock
    if (product.stock < quantity) {
      message.warning(
        `Stock insuficiente. Solo hay ${product.stock} unidades disponibles.`
      );
      return;
    }

    // Usar el precio editado si existe, de lo contrario calcular el predeterminado
    const selling_price =
      selectedProductPrice || calculateSellingPrice(product);

    // Calcular precio en ARS si tenemos tipo de cambio
    let price_ars = 0;
    if (sale?.exchange_rate) {
      const exchangeRate = parseFloat(sale.exchange_rate.toString());
      price_ars = calculateArsPrice(selling_price, exchangeRate);
    }

    // Verificar si el producto ya está en la lista
    const existingItemIndex = saleItems.findIndex(
      (item) => item.product_id === product.id
    );

    if (existingItemIndex >= 0) {
      // El producto ya está en la lista, aumentar la cantidad
      const updatedItems = [...saleItems];
      const existingItem = updatedItems[existingItemIndex];
      if (!existingItem) {
        message.error('Error al actualizar: El ítem no se encontró');
        return;
      }

      const newQuantity = existingItem.quantity + quantity;

      // Verificar stock suficiente
      if (product.stock < newQuantity) {
        message.warning(
          `Stock insuficiente para agregar más unidades. Disponible: ${product.stock}`
        );
        return;
      }

      existingItem.quantity = newQuantity;
      setSaleItems(updatedItems);
    } else {
      // Añadir el item a la lista
      const newItem: SaleItemWithSellingPrice = {
        product_id: product.id,
        quantity,
        product,
        selling_price,
        price_ars,
        custom_price: selectedProductPrice !== null // Marcar como personalizado si se editó el precio
      };

      setSaleItems([...saleItems, newItem]);
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

  const handleUpdateSale = async () => {
    if (saleItems.length === 0) {
      message.warning('No hay productos en la venta');
      return;
    }

    setIsSaving(true);
    try {
      // Preparar datos de la venta
      interface SaleUpdateData {
        items: {
          id?: number;
          product_id: number;
          quantity: number;
          selling_price: number;
          price_ars: number;
        }[];
        payment_method: string;
        customer_id?: number | null;
        user_id?: string | null;
        customer_data?: {
          name: string;
          whatsapp?: string | null;
          instagram?: string | null;
          facebook?: string | null;
        } | null;
      }

      const saleData: SaleUpdateData = {
        items: saleItems.map((item) => ({
          id: item.id, // Include the item ID if it exists
          product_id: item.product_id,
          quantity: item.quantity,
          selling_price: item.selling_price,
          price_ars: item.price_ars
        })),
        payment_method: paymentMethod,
        user_id: user?.id || sale?.user_id // Mantener el usuario original si no hay sesión
      };

      // Añadir datos del cliente si corresponde
      if (selectedCustomerId) {
        // Cliente existente
        saleData.customer_id = selectedCustomerId;
      } else if (
        newCustomerData &&
        showNewCustomerForm &&
        newCustomerData.name.trim() !== ''
      ) {
        // Nuevo cliente
        saleData.customer_data = {
          name: newCustomerData.name,
          whatsapp: newCustomerData.whatsapp || null,
          instagram: newCustomerData.instagram || null,
          facebook: newCustomerData.facebook || null
        };
      } else {
        // Sin cliente
        saleData.customer_id = null;
      }

      const response = await fetch(`/api/sales/${saleId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(saleData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al actualizar la venta');
      }

      message.success('Venta actualizada correctamente');
      router.push('/sales');
    } catch (error: unknown) {
      console.error('Error al actualizar la venta:', error);

      const errorMessage =
        error instanceof Error ? error.message : 'Error al actualizar la venta';

      message.error(errorMessage);
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
      render: (item: SaleItemWithSellingPrice, _: unknown, index: number) => (
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
      render: (item: SaleItemWithSellingPrice, _: unknown, index: number) => {
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
      render: (item: SaleItemWithSellingPrice) => {
        const formattedPrice = formatPriceWithExchange(
          item.selling_price,
          sale?.exchange_rate
        );
        return <Text>{extractArsPrice(formattedPrice)}</Text>;
      }
    },
    {
      title: 'Subtotal',
      key: 'subtotal',
      width: 140,
      render: (item: SaleItemWithSellingPrice) => {
        return (
          <Text strong>
            {formatPriceWithExchange(
              item.selling_price * item.quantity,
              sale?.exchange_rate
            )}
          </Text>
        );
      }
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

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ padding: 16, width: '100%', boxSizing: 'border-box' }}>
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card title="Cliente" style={{ marginBottom: 16 }}>
            <Row gutter={16} justify="space-between" align="middle">
              <Col flex="auto">
                <div style={{ width: '100%' }}>
                  <AutoComplete
                    placeholder="Sin cliente / Seleccionar cliente"
                    onChange={handleCustomerChange}
                    value={
                      selectedCustomerId
                        ? customers.find((c) => c.id === selectedCustomerId)
                            ?.name
                        : undefined
                    }
                    style={{ width: '100%' }}
                    options={[
                      { value: '', label: 'Sin cliente' },
                      { value: 'new', label: '+ Crear nuevo cliente' },
                      ...customers.map((customer) => ({
                        value: String(customer.id),
                        label: customer.name
                      }))
                    ]}
                    filterOption={(inputValue, option) =>
                      option?.label
                        ? option.label
                            .toString()
                            .toLowerCase()
                            .indexOf(inputValue.toLowerCase()) !== -1
                        : false
                    }
                    backfill
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
                    option?.children
                      ? String(option.children)
                          .toLowerCase()
                          .includes(input.toLowerCase())
                      : false
                  }
                >
                  {products
                    .filter((product) => product.stock > 0)
                    .map((product) => (
                      <Option key={product.id} value={product.id}>
                        {product.name} -{' '}
                        {formatPriceWithExchange(
                          calculateSellingPrice(product),
                          sale?.exchange_rate
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
                  <Input
                    style={{ width: '100%' }}
                    value={(() => {
                      if (!selectedProductPrice || !sale?.exchange_rate)
                        return 'AR$ 0.00';
                      return extractArsPrice(
                        formatPriceWithExchange(
                          selectedProductPrice,
                          sale.exchange_rate
                        )
                      );
                    })()}
                    disabled
                    prefix="AR$"
                  />
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
                rowKey={(record: SaleItemWithSellingPrice) =>
                  `${record.product_id}`
                }
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
                    formatPriceWithExchange(
                      calculateTotal(),
                      sale?.exchange_rate
                    )
                  )}
                </Text>
              </div>
            </div>

            <Button
              type="primary"
              icon={<ShoppingCartOutlined />}
              block
              size="large"
              onClick={handleUpdateSale}
              loading={isSaving}
              disabled={saleItems.length === 0}
            >
              Actualizar Venta
            </Button>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
