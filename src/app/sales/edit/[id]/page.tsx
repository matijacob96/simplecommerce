'use client';

import React, { useState, useEffect } from 'react';
import { Prisma } from '@prisma/client';
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
  Spin,
  Row,
  Col,
  Radio,
  Input,
  AutoComplete
} from 'antd';
import { ShoppingCartOutlined, DeleteOutlined, ArrowLeftOutlined, PlusOutlined, WhatsAppOutlined, InstagramOutlined, FacebookOutlined } from '@ant-design/icons';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { 
  formatUsdPrice, 
  calculateSellingPrice as calculateProductSellingPrice,
  toNumber,
  formatPriceWithExchange
} from '@/utils/priceUtils';
import { Product, Customer, SaleItem as ApiSaleItem, Sale } from '@/types';

const { Title, Text } = Typography;
const { Option } = Select;

// Interfaces específicas para la página de edición
interface SaleItemWithSellingPrice {
  id?: number;
  product_id: number;
  quantity: number;
  product: Product;
  selling_price: number;
}

interface SaleWithItems {
  id: number;
  total: Prisma.Decimal;
  payment_method: string;
  customer_id: number | null;
  customer: Customer | null;
  created_at: string;
  updated_at: string;
  items: ApiSaleItem[];
  exchange_rate?: Prisma.Decimal;
}

export default function EditSalePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [saleItems, setSaleItems] = useState<SaleItemWithSellingPrice[]>([]);
  const [originalItems, setOriginalItems] = useState<SaleItemWithSellingPrice[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<number | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<string>("efectivo");
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [newCustomerData, setNewCustomerData] = useState<{ name: string, whatsapp: string, instagram: string, facebook: string } | null>(null);
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [sale, setSale] = useState<SaleWithItems | null>(null);
  
  const router = useRouter();
  const params = useParams();
  const saleId = params?.id ? parseInt(params.id as string) : 0;

  useEffect(() => {
    if (saleId) {
      fetchSaleData();
      fetchProducts();
      fetchCustomers();
    }
  }, [saleId]);

  const fetchSaleData = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/sales/${saleId}`);
      if (!response.ok) {
        throw new Error('Error al obtener la venta');
      }
      
      const saleData: SaleWithItems = await response.json();
      setSale(saleData);
      
      // Convertir los items de la venta al formato que necesitamos
      const formattedItems: SaleItemWithSellingPrice[] = saleData.items.map(item => ({
        id: item.id,
        product_id: item.product_id,
        quantity: item.quantity,
        product: item.product,
        selling_price: parseFloat(item.selling_price?.toString() || "0")
      }));
      
      setSaleItems(formattedItems);
      setOriginalItems([...formattedItems]);
      
      // Establecer el cliente seleccionado
      setSelectedCustomerId(saleData.customer_id);
      
      // Establecer el método de pago
      setPaymentMethod(saleData.payment_method);

      // Obtener el tipo de cambio si no está disponible
      if (!saleData.exchange_rate) {
        fetchExchangeRate();
      }
    } catch (error) {
      console.error('Error:', error);
      message.error('Error al cargar los datos de la venta');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchProducts = async () => {
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
  };

  const fetchCustomers = async () => {
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
  };

  const fetchExchangeRate = async () => {
    try {
      const response = await fetch('/api/dolar-blue');
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data && data.data.venta) {
          // Solo actualizar si no hay tipo de cambio en la venta
          if (!sale?.exchange_rate) {
            setSale(prevSale => {
              if (!prevSale) return prevSale;
              return {
                ...prevSale,
                exchange_rate: { toString: () => data.data.venta } as Prisma.Decimal
              };
            });
          }
        }
      }
    } catch (error) {
      console.error('Error al obtener tipo de cambio:', error);
    }
  };

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

  // Calcular el precio de venta de un producto
  const calculateSellingPrice = (product: Product): number => {
    return calculateProductSellingPrice(product);
  };

  const handleAddItem = () => {
    if (!selectedProduct || quantity <= 0) {
      message.warning('Selecciona un producto y una cantidad válida');
      return;
    }
    
    // Encontrar el producto seleccionado
    const product = products.find(p => p.id === selectedProduct);
    if (!product) {
      message.error('Producto no encontrado');
      return;
    }
    
    // Verificar si hay suficiente stock
    if (product.stock < quantity) {
      message.warning(`Stock insuficiente. Solo hay ${product.stock} unidades disponibles.`);
      return;
    }
    
    // Calcular el precio de venta usando la función de priceUtils
    const selling_price = calculateProductSellingPrice(product);
    
    // Añadir el item a la lista
    const newItem: SaleItemWithSellingPrice = {
      product_id: product.id,
      quantity,
      product,
      selling_price
    };
    
    setSaleItems([...saleItems, newItem]);
    
    // Resetear selección
    setSelectedProduct(null);
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
      const saleData: any = {
        items: saleItems.map(item => ({
          id: item.id, // Include the item ID if it exists
          product_id: item.product_id,
          quantity: item.quantity,
          selling_price: item.selling_price // Incluir el precio de venta en USD
        })),
        payment_method: paymentMethod
      };

      // Añadir datos del cliente si corresponde
      if (selectedCustomerId) {
        // Cliente existente
        saleData.customer_id = selectedCustomerId;
      } else if (newCustomerData && showNewCustomerForm && newCustomerData.name.trim() !== '') {
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
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(saleData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al actualizar la venta');
      }

      message.success('Venta actualizada correctamente');
      router.push('/sales');
    } catch (error: any) {
      console.error('Error:', error);
      message.error(error.message || 'Error al actualizar la venta');
    } finally {
      setIsSaving(false);
    }
  };

  // Formatear precio en doble moneda (USD y ARS)
  const formatPrice = (price: Prisma.Decimal | string | number | null, exchangeRate?: Prisma.Decimal) => {
    if (price === null) return 'U$ 0,00';
    
    const priceUSD = parseFloat(price.toString());
    
    // Si tenemos tipo de cambio, mostrar también el precio en ARS
    if (exchangeRate) {
      const priceARS = priceUSD * parseFloat(exchangeRate.toString());
      return `U$ ${priceUSD.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} | AR$ ${priceARS.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    
    // Si no tenemos tipo de cambio, mostrar solo USD
    return `U$ ${priceUSD.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Calcular el total
  const calculateTotal = () => {
    return saleItems.reduce((total, item) => {
      return total + item.selling_price * item.quantity;
    }, 0);
  };

  const renderSellingPrice = (item: SaleItemWithSellingPrice) => {
    // Asegurar que tenemos un tipo de cambio válido
    const exchangeRate = sale?.exchange_rate 
      ? parseFloat(sale.exchange_rate.toString()) 
      : 1200; // Valor predeterminado si no hay tipo de cambio

    return formatPrice(item.selling_price, sale?.exchange_rate);
  };

  const renderSubtotal = (item: SaleItemWithSellingPrice) => {
    // Usar el tipo de cambio de la venta
    return formatPrice(item.selling_price * item.quantity, sale?.exchange_rate);
  };

  // Columnas para la tabla
  const columns = [
    {
      title: 'Producto',
      dataIndex: ['product', 'name'],
      key: 'product',
    },
    {
      title: 'Cantidad',
      dataIndex: 'quantity',
      key: 'quantity',
    },
    {
      title: 'Precio Venta',
      key: 'price',
      render: (record: SaleItemWithSellingPrice) => {
        return renderSellingPrice(record);
      },
    },
    {
      title: 'Subtotal',
      key: 'subtotal',
      render: (record: SaleItemWithSellingPrice) => {
        return renderSubtotal(record);
      },
    },
    {
      title: 'Acciones',
      key: 'action',
      render: (_: any, _record: any, index: number) => (
        <Button 
          icon={<DeleteOutlined />} 
          danger 
          onClick={() => handleRemoveItem(index)}
          size="small"
        />
      ),
    },
  ];

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Breadcrumb className="mb-4" items={[
        { title: <Link href="/sales">Ventas</Link> },
        { title: 'Editar Venta' },
      ]} />
      
      <div className="flex justify-between items-center mb-6">
        <Title level={2}>Editar Venta #{saleId}</Title>
        <Space>
          <Button 
            icon={<ArrowLeftOutlined />}
            onClick={() => router.push('/sales')}
          >
            Volver
          </Button>
        </Space>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <Spin size="large" />
        </div>
      ) : (
        <Row gutter={[16, 16]}>
          <Col span={24}>
            <Card title="Cliente" variant="outlined" className="mb-4">
              <div className="flex flex-wrap gap-4 mb-4">
                <div className="flex-grow min-w-[300px]">
                  <Text>Seleccionar Cliente</Text>
                  <AutoComplete
                    placeholder="Sin cliente / Seleccionar cliente"
                    onChange={handleCustomerChange}
                    value={selectedCustomerId ? 
                      customers.find(c => c.id === selectedCustomerId)?.name : undefined}
                    style={{ width: '100%' }}
                    options={[
                      { value: '', label: 'Sin cliente' },
                      { value: 'new', label: '+ Crear nuevo cliente' },
                      ...customers.map(customer => ({
                        value: String(customer.id),
                        label: customer.name
                      }))
                    ]}
                    filterOption={(inputValue, option) =>
                      option!.label.toString().toLowerCase().indexOf(inputValue.toLowerCase()) !== -1
                    }
                    backfill
                  />
                </div>
              </div>

              {showNewCustomerForm && (
                <div className="border p-4 rounded-md bg-gray-50">
                  <Title level={5} className="mb-3">Nuevo Cliente</Title>
                  <Row gutter={[16, 16]}>
                    <Col xs={24} md={12}>
                      <div className="mb-3">
                        <Text>Nombre *</Text>
                        <Input 
                          placeholder="Nombre del cliente" 
                          value={newCustomerData?.name || ''}
                          onChange={e => handleNewCustomerInputChange('name', e.target.value)}
                        />
                      </div>
                    </Col>
                    <Col xs={24} md={12}>
                      <div className="mb-3">
                        <Text>WhatsApp</Text>
                        <Input 
                          placeholder="Número de WhatsApp" 
                          value={newCustomerData?.whatsapp || ''}
                          onChange={e => handleNewCustomerInputChange('whatsapp', e.target.value)}
                          prefix={<WhatsAppOutlined />}
                        />
                      </div>
                    </Col>
                    <Col xs={24} md={12}>
                      <div className="mb-3">
                        <Text>Instagram</Text>
                        <Input 
                          placeholder="Usuario de Instagram" 
                          value={newCustomerData?.instagram || ''}
                          onChange={e => handleNewCustomerInputChange('instagram', e.target.value)}
                          prefix={<InstagramOutlined />}
                        />
                      </div>
                    </Col>
                    <Col xs={24} md={12}>
                      <div className="mb-3">
                        <Text>Facebook</Text>
                        <Input 
                          placeholder="Usuario o URL de Facebook" 
                          value={newCustomerData?.facebook || ''}
                          onChange={e => handleNewCustomerInputChange('facebook', e.target.value)}
                          prefix={<FacebookOutlined />}
                        />
                      </div>
                    </Col>
                  </Row>
                </div>
              )}
            </Card>

            <Card title="Agregar Productos" variant="outlined" className="mb-4">
              <div className="flex flex-wrap gap-4 items-end">
                <div className="flex-grow min-w-[200px]">
                  <Text>Producto</Text>
                  <Select
                    placeholder="Seleccionar producto"
                    onChange={value => setSelectedProduct(value)}
                    value={selectedProduct}
                    style={{ width: '100%' }}
                    showSearch
                    filterOption={(input, option) =>
                      (option?.children as unknown as string)?.toLowerCase().includes(input.toLowerCase())
                    }
                  >
                    {products
                      .filter(product => product.stock > 0)
                      .map(product => (
                        <Option key={product.id} value={product.id}>
                          {product.name} - {formatPrice(calculateSellingPrice(product))} (Stock: {product.stock})
                        </Option>
                      ))}
                  </Select>
                </div>
                
                <div style={{ width: '120px' }}>
                  <Text>Cantidad</Text>
                  <InputNumber
                    min={1}
                    value={quantity}
                    onChange={value => setQuantity(value || 1)}
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
                  rowKey={record => `${record.product_id}`}
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
                  <Text>{saleItems.reduce((acc, item) => acc + item.quantity, 0)}</Text>
                </div>

                <div className="mb-4 mt-4">
                  <Text strong>Medio de Pago:</Text>
                  <Radio.Group 
                    value={paymentMethod} 
                    onChange={e => setPaymentMethod(e.target.value)}
                    style={{ display: 'flex', marginTop: '8px' }}
                  >
                    <Radio value="efectivo">Efectivo</Radio>
                    <Radio value="transferencia">Transferencia</Radio>
                  </Radio.Group>
                </div>
                
                <Divider />
                <div className="flex justify-between">
                  <Text strong>Total:</Text>
                  <Text strong>{formatPrice(calculateTotal(), sale?.exchange_rate)}</Text>
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
      )}
    </div>
  );
} 