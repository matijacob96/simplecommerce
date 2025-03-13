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
  Breadcrumb,
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
  FacebookOutlined
} from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Customer, Product } from '../../../types';
import {
  formatUsdPrice,
  calculateSellingPrice
} from '../../../utils/priceUtils';

const { Title, Text } = Typography;
const { Option } = Select;

// Tipo específico para SaleItem en la nueva venta (sin ID ya que aún no existe en la BD)
type NewSaleItem = {
  product_id: number;
  quantity: number;
  product: Product;
  selling_price: number; // Precio de venta calculado
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
  const router = useRouter();

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

    // Calcular precio de venta usando la función de la utilidad
    const selling_price = calculateSellingPrice(product);

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
          selling_price
        }
      ]);
    }

    // Resetear selección
    setSelectedProduct(null);
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
        }[];
        payment_method: string;
        exchange_rate: number | null;
        customer_id?: number;
        customer_data?: {
          name: string;
          whatsapp: string | null;
          instagram: string | null;
          facebook: string | null;
        };
      }

      // Preparar datos de la venta
      const saleData: SaleData = {
        items: saleItems.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          selling_price: item.selling_price // Guardar el precio de venta calculado
        })),
        payment_method: paymentMethod,
        exchange_rate: currentExchangeRate // Guardar el tipo de cambio al momento de la venta
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

  // Formatear precio en doble moneda (USD y ARS)
  const formatPrice = (price: number | null, exchangeRate?: number) => {
    if (price === null) return 'U$ 0,00';

    // Si tenemos tipo de cambio, mostrar también el precio en ARS
    if (exchangeRate) {
      const priceARS = price * exchangeRate;
      return `U$ ${price.toLocaleString('es-AR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })} | AR$ ${priceARS.toLocaleString('es-AR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })}`;
    }

    // Si no tenemos tipo de cambio, mostrar solo USD
    return `U$ ${price.toLocaleString('es-AR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  // Calcular el total
  const calculateTotal = () => {
    return saleItems.reduce((total, item) => {
      // Usar la función de utilidad para obtener el precio
      const itemPrice =
        item.selling_price || calculateSellingPrice(item.product);
      return total + itemPrice * item.quantity;
    }, 0);
  };

  const renderSellingPrice = (item: NewSaleItem) => {
    const sellingPrice =
      item.selling_price || calculateSellingPrice(item.product);
    return formatPrice(sellingPrice, exchangeRate || 1200);
  };

  const renderSubtotal = (item: NewSaleItem) => {
    const sellingPrice =
      item.selling_price || calculateSellingPrice(item.product);
    return formatPrice(sellingPrice * item.quantity, exchangeRate || 1200);
  };

  // Columnas para la tabla
  const columns = [
    {
      title: 'Producto',
      dataIndex: ['product', 'name'],
      key: 'product'
    },
    {
      title: 'Cantidad',
      dataIndex: 'quantity',
      key: 'quantity'
    },
    {
      title: 'Precio Venta',
      key: 'price',
      render: (record: NewSaleItem) => {
        return renderSellingPrice(record);
      }
    },
    {
      title: 'Subtotal',
      key: 'subtotal',
      render: (record: NewSaleItem) => {
        return renderSubtotal(record);
      }
    },
    {
      title: 'Acciones',
      key: 'action',
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
    <div className="container mx-auto px-4 py-8">
      <Breadcrumb
        className="mb-4"
        items={[
          { title: <Link href="/sales">Ventas</Link> },
          { title: 'Nueva Venta' }
        ]}
      />

      <div className="flex justify-between items-center mb-6">
        <Title level={2}>Nueva Venta</Title>
        <Space>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => router.push('/sales')}
          >
            Volver
          </Button>
        </Space>
      </div>

      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card title="Cliente" style={{ marginBottom: 24 }}>
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

          <Card title="Agregar Productos" variant="outlined">
            <div className="flex flex-wrap gap-4 items-end">
              <div className="flex-grow min-w-[200px]">
                <Text>Producto</Text>
                <Select
                  placeholder="Seleccionar producto"
                  onChange={(value) => setSelectedProduct(value)}
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
                        {formatUsdPrice(calculateSellingPrice(product))} (Stock:{' '}
                        {product.stock})
                      </Option>
                    ))}
                </Select>
              </div>

              <div style={{ width: '120px' }}>
                <Text>Cantidad</Text>
                <InputNumber
                  min={1}
                  value={quantity}
                  onChange={(value) => setQuantity(value || 1)}
                  style={{ width: '100%' }}
                />
              </div>

              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleAddItem}
                disabled={!selectedProduct || quantity <= 0}
              >
                Agregar
              </Button>
            </div>
          </Card>
        </Col>

        <Col xs={24} md={16}>
          <Card title="Productos en la venta" variant="outlined">
            {saleItems.length === 0 ? (
              <Empty description="No hay productos agregados" />
            ) : (
              <Table
                dataSource={saleItems}
                columns={columns}
                pagination={false}
                rowKey={(record: NewSaleItem) => `${record.product_id}`}
              />
            )}
          </Card>
        </Col>

        <Col xs={24} md={8}>
          <Card title="Resumen de Venta" variant="outlined">
            <div className="mb-4">
              <div className="flex justify-between mb-2">
                <Text>Productos:</Text>
                <Text>{saleItems.length}</Text>
              </div>
              <div className="flex justify-between mb-2">
                <Text>Items totales:</Text>
                <Text>
                  {saleItems.reduce((acc, item) => acc + item.quantity, 0)}
                </Text>
              </div>

              <div className="mb-4 mt-4">
                <Text strong>Medio de Pago:</Text>
                <Radio.Group
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  style={{ display: 'flex', marginTop: '8px' }}
                >
                  <Radio value="efectivo">Efectivo</Radio>
                  <Radio value="transferencia">Transferencia</Radio>
                </Radio.Group>
              </div>

              <Divider />
              <div className="flex justify-between">
                <Text strong>Total:</Text>
                <Text strong>
                  {formatPrice(calculateTotal(), exchangeRate || 1200)}
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
