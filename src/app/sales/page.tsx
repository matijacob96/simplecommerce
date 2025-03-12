'use client';

import React, { useState, useEffect } from 'react';
import {
  Button,
  Table,
  Card,
  Typography,
  Tag,
  Space,
  message,
  Modal,
  Descriptions,
  Row,
  Col,
  Tooltip,
} from 'antd';
import { StyleProvider } from '@ant-design/cssinjs';
import type { TableProps, ColumnsType } from 'antd/es/table';
import type { TablePaginationConfig } from 'antd/es/table';
import type { FilterValue, SorterResult } from 'antd/es/table/interface';
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  ExclamationCircleOutlined,
  WhatsAppOutlined,
  InstagramOutlined,
  FacebookOutlined
} from '@ant-design/icons';
import Link from 'next/link';
import { Prisma } from '@prisma/client';
import { SaleItem, Sale } from '../../types';
import { formatDate } from '../../utils/dateUtils';
import {
  formatPriceWithExchange,
  calculateSellingPrice,
  toNumber
} from '../../utils/priceUtils';

const { Title, Text } = Typography;
const { confirm } = Modal;

export default function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [detailsSale, setDetailsSale] = useState<Sale | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Estado para el ordenamiento
  const [tableParams, setTableParams] = useState<{
    pagination: {
      current: number;
      pageSize: number;
    };
    sortField: string | null;
    sortOrder: string | null;
  }>({
    pagination: {
      current: 1,
      pageSize: 10,
    },
    sortField: null,
    sortOrder: null,
  });

  useEffect(() => {
    fetchSales();
  }, []);

  const fetchSales = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/sales');
      if (!response.ok) {
        throw new Error('Error al obtener las ventas');
      }
      const data = await response.json();
      setSales(data);
    } catch (error: any) {
      console.error('Error:', error);
      message.error('Error al cargar las ventas');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const response = await fetch(`/api/sales/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al eliminar la venta');
      }

      message.success('Venta eliminada correctamente');
      fetchSales(); // Recargar la lista de ventas
    } catch (error: any) {
      console.error('Error:', error);
      message.error(error.message || 'Error al eliminar la venta');
    }
  };

  const showDeleteConfirm = (id: number) => {
    confirm({
      title: '¿Estás seguro de eliminar esta venta?',
      icon: <ExclamationCircleOutlined />,
      content: 'Esta acción restaurará el stock de los productos. No se puede deshacer.',
      okText: 'Sí, eliminar',
      okType: 'danger',
      cancelText: 'Cancelar',
      onOk() {
        handleDelete(id);
      },
    });
  };

  // Mostrar el modal con los detalles de la venta
  const showDetails = (sale: Sale) => {
    setDetailsSale(sale);
    setIsModalOpen(true);
  };

  // Cerrar el modal de detalles
  const closeModal = () => {
    setIsModalOpen(false);
    // Retrasar la limpieza de los datos de detalle hasta después de que el modal se cierre
    setTimeout(() => {
      setDetailsSale(null);
    }, 300); // Dar tiempo suficiente para la animación de cierre
  };

  const renderPaymentMethod = (method: string) => {
    const methods: Record<string, { color: string; text: string }> = {
      efectivo: { color: 'green', text: 'Efectivo' },
      transferencia: { color: 'blue', text: 'Transferencia' },
      tarjeta: { color: 'purple', text: 'Tarjeta' },
      credito: { color: 'orange', text: 'Crédito' },
      default: { color: 'default', text: method }
    };

    const { color, text } = methods[method] || methods.default;
    return <Tag color={color}>{text}</Tag>;
  };

  const renderCustomerName = (sale: Sale) => {
    if (!sale.customer) return <Text type="secondary">Cliente no registrado</Text>;

    return (
      <div>
        <Text strong style={{ margin: 0 }}>{sale.customer.name}</Text>
      </div>
    );
  };

  // Función para manejar cambios en la tabla (ordenamiento, paginación)
  const handleTableChange = (
    pagination: TablePaginationConfig,
    filters: Record<string, FilterValue | null>,
    sorter: SorterResult<Sale> | SorterResult<Sale>[]
  ) => {
    setTableParams({
      pagination: {
        current: pagination.current || 1,
        pageSize: pagination.pageSize || 10,
      },
      sortField: Array.isArray(sorter) ? sorter[0]?.field?.toString() || null : sorter.field?.toString() || null,
      sortOrder: Array.isArray(sorter) ? sorter[0]?.order?.toString() || null : sorter.order?.toString() || null,
    });
  };

  // Ordenar las ventas según el criterio seleccionado
  const getSortedSales = () => {
    if (!tableParams.sortField || !tableParams.sortOrder) {
      return sales;
    }

    return [...sales].sort((a, b) => {
      const sortOrder = tableParams.sortOrder === 'ascend' ? 1 : -1;

      switch (tableParams.sortField) {
        case 'created_at':
          return sortOrder * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

        case 'customer':
          const aName = a.customer?.name || '';
          const bName = b.customer?.name || '';
          return sortOrder * aName.localeCompare(bName);

        case 'total':
          const aTotal = parseFloat(a.total.toString());
          const bTotal = parseFloat(b.total.toString());
          return sortOrder * (aTotal - bTotal);

        case 'items':
          return sortOrder * (a.items.length - b.items.length);

        case 'payment_method':
          return sortOrder * a.payment_method.localeCompare(b.payment_method);

        default:
          return 0;
      }
    });
  };

  const columns: ColumnsType<Sale> = [
    {
      title: 'Fecha',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => formatDate(date),
      sorter: true,
      defaultSortOrder: 'descend',
    },
    {
      title: 'Cliente',
      key: 'customer',
      dataIndex: 'customer',
      render: (_: unknown, sale: Sale) => renderCustomerName(sale),
      sorter: true,
    },
    {
      title: 'Medio de Pago',
      dataIndex: 'payment_method',
      key: 'payment_method',
      render: (method: string) => renderPaymentMethod(method),
      sorter: true,
      filters: [
        { text: 'Efectivo', value: 'efectivo' },
        { text: 'Transferencia', value: 'transferencia' },
      ],
      onFilter: (value, record) => record.payment_method === value,
    },
    {
      title: 'Total',
      dataIndex: 'total',
      key: 'total',
      render: (total: Prisma.Decimal, record: Sale) => formatPriceWithExchange(total, record.exchange_rate),
      sorter: true,
    },
    {
      title: 'Productos',
      key: 'items',
      dataIndex: 'items',
      render: (_: unknown, sale: Sale) => `${sale.items.length} productos`,
      sorter: true,
    },
    {
      title: 'Acciones',
      key: 'actions',
      render: (sale: Sale) => (
        <Space size="small">
          <Button
            icon={<EyeOutlined />}
            onClick={() => showDetails(sale)}
            size="small"
          />
          <Link href={`/sales/edit/${sale.id}`}>
            <Button
              icon={<EditOutlined />}
              type="primary"
              size="small"
            />
          </Link>
          <Button
            icon={<DeleteOutlined />}
            danger
            onClick={() => showDeleteConfirm(sale.id)}
            size="small"
          />
        </Space>
      ),
    },
  ];

  return (
    <StyleProvider hashPriority="high">
      <div style={{ padding: 16 }}>
        <Card title={<Row justify="space-between" align="middle">
          <Col>
            <Title style={{ margin: 0 }} level={3}>Ventas</Title>
          </Col>
          <Col>
            <Link href="/sales/new">
              <Button type="primary" icon={<PlusOutlined />}>
                Nueva Venta
              </Button>
            </Link>
          </Col>
        </Row>}>


          <div style={{ position: 'relative', minHeight: '200px' }}>
            <Table
              columns={columns}
              dataSource={getSortedSales()}
              rowKey="id"
              onChange={handleTableChange}
              loading={isLoading}
              pagination={{
                ...tableParams.pagination,
                showSizeChanger: true,
                pageSizeOptions: ['10', '20', '50', '100'],
                showTotal: (total) => `Total ${total} ventas`,
              }}
            />
          </div>
        </Card>

        {/* Modal para ver detalles de la venta */}
        <Modal
          title={`Detalles de Venta #${detailsSale?.id}`}
          open={isModalOpen}
          onCancel={closeModal}
          footer={[
            <Button key="back" onClick={closeModal}>
              Cerrar
            </Button>
          ]}
          width={900}
        >
          {detailsSale && (
            <div>
              <Descriptions bordered column={2} size="middle" layout="horizontal" style={{ marginBottom: 20 }}>
                <Descriptions.Item label="Fecha" labelStyle={{ fontWeight: 'bold', width: '140px' }}>
                  <Text>{formatDate(detailsSale.created_at)}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Total" labelStyle={{ fontWeight: 'bold', width: '140px' }}>
                  <Text strong>
                    {formatPriceWithExchange(detailsSale.total, detailsSale.exchange_rate)}
                  </Text>
                </Descriptions.Item>
                <Descriptions.Item label="Método de Pago" labelStyle={{ fontWeight: 'bold', width: '140px' }}>
                  {renderPaymentMethod(detailsSale.payment_method)}
                </Descriptions.Item>
                <Descriptions.Item label="Cantidad de Productos" labelStyle={{ fontWeight: 'bold', width: '140px' }}>
                  <Text>{detailsSale.items.length}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Cliente" labelStyle={{ fontWeight: 'bold', width: '140px' }} span={2}>
                  {detailsSale.customer ? (
                    <div>
                      <Text strong style={{ margin: 0 }}>
                        {detailsSale.customer.name}
                      </Text>
                      <Space style={{ marginTop: 8 }}>
                        {detailsSale.customer.whatsapp && (
                          <Tooltip title={`WhatsApp: ${detailsSale.customer.whatsapp}`}>
                            <a href={`https://wa.me/${detailsSale.customer.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">
                              <WhatsAppOutlined style={{ fontSize: '18px', color: '#25D366' }} />
                            </a>
                          </Tooltip>
                        )}
                        {detailsSale.customer.instagram && (
                          <Tooltip title={`Instagram: ${detailsSale.customer.instagram}`}>
                            <a href={`https://instagram.com/${detailsSale.customer.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer">
                              <InstagramOutlined style={{ fontSize: '18px', color: '#E1306C' }} />
                            </a>
                          </Tooltip>
                        )}
                        {detailsSale.customer.facebook && (
                          <Tooltip title={`Facebook: ${detailsSale.customer.facebook}`}>
                            <a href={`https://facebook.com/${detailsSale.customer.facebook}`} target="_blank" rel="noopener noreferrer">
                              <FacebookOutlined style={{ fontSize: '18px', color: '#1877F2' }} />
                            </a>
                          </Tooltip>
                        )}
                      </Space>
                    </div>
                  ) : (
                    <Text type="secondary">Cliente no registrado</Text>
                  )}
                </Descriptions.Item>
              </Descriptions>

              <Title level={4} style={{ marginTop: 20, marginBottom: 16 }}>
                Productos
              </Title>

              <Table
                dataSource={detailsSale.items}
                rowKey="id"
                pagination={false}
                bordered
                size="middle"
                columns={[
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
                    title: 'Precio Unitario',
                    key: 'price',
                    render: (item: SaleItem) => {
                      // Si el precio de venta no existe, calcular usando la lógica de margen
                      if (!item.selling_price) {
                        const sellingPrice = calculateSellingPrice(item.product);
                        return formatPriceWithExchange(sellingPrice, detailsSale.exchange_rate);
                      }
                      return formatPriceWithExchange(item.selling_price, detailsSale.exchange_rate);
                    },
                  },
                  {
                    title: 'Subtotal',
                    key: 'subtotal',
                    render: (item: SaleItem) => {
                      // Calcular el precio de venta si no está disponible
                      let price = 0;
                      if (item.selling_price) {
                        price = toNumber(item.selling_price);
                      } else {
                        price = calculateSellingPrice(item.product);
                      }

                      return formatPriceWithExchange(price * item.quantity, detailsSale.exchange_rate);
                    },
                  },
                ]}
                summary={(pageData) => {
                  let totalPrice = 0;
                  pageData.forEach((item) => {
                    // Calcular el precio de venta si no está disponible
                    let price = 0;
                    if (item.selling_price) {
                      price = toNumber(item.selling_price);
                    } else {
                      price = calculateSellingPrice(item.product);
                    }

                    totalPrice += price * item.quantity;
                  });

                  return (
                    <Table.Summary.Row>
                      <Table.Summary.Cell index={0} colSpan={3} align="right">
                        <strong>Total:</strong>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={1} align="right">
                        <strong style={{ fontSize: '1.1em' }}>
                          {formatPriceWithExchange(totalPrice, detailsSale.exchange_rate)}
                        </strong>
                      </Table.Summary.Cell>
                    </Table.Summary.Row>
                  );
                }}
              />
            </div>
          )}
        </Modal>
      </div>
    </StyleProvider>
  );
} 