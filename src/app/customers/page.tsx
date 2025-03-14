'use client';

import React, { useState, useEffect, useRef as _useRef } from 'react';
import {
  Button,
  Table,
  Card,
  Typography,
  Space,
  message,
  Modal,
  Form,
  Input,
  DatePicker,
  Tooltip,
  Row,
  Col,
  Popconfirm as _Popconfirm,
  Divider as _Divider,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  WhatsAppOutlined,
  InstagramOutlined,
  FacebookOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { getErrorMessage } from '@/types/error-types';

const { Title } = Typography;
const { confirm } = Modal;

type Customer = {
  id: number;
  name: string;
  whatsapp: string | null;
  instagram: string | null;
  facebook: string | null;
  first_purchase_date: string;
  created_at: string;
  updated_at: string;
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentCustomer, setCurrentCustomer] = useState<Customer | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/customers');
      if (!response.ok) {
        throw new Error('Error al obtener los clientes');
      }
      const data = await response.json();
      setCustomers(data);
    } catch (error) {
      console.error('Error:', error);
      message.error('Error al cargar los clientes');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const response = await fetch(`/api/customers/${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 400 && data.salesCount) {
          message.error(
            `No se puede eliminar el cliente porque tiene ${data.salesCount} ventas asociadas`
          );
        } else {
          message.error(data.error || 'Error al eliminar el cliente');
        }
        return;
      }

      message.success('Cliente eliminado correctamente');
      fetchCustomers();
    } catch (error: unknown) {
      console.error('Error:', error);
      message.error(getErrorMessage(error) || 'Error al eliminar el cliente');
    }
  };

  const showDeleteConfirm = (id: number) => {
    confirm({
      title: '¿Estás seguro de eliminar este cliente?',
      icon: <ExclamationCircleOutlined />,
      content: 'Esta acción no se puede deshacer.',
      okText: 'Sí, eliminar',
      okType: 'danger',
      cancelText: 'Cancelar',
      onOk() {
        handleDelete(id);
      },
    });
  };

  const showModal = (edit = false, customer: Customer | null = null) => {
    setIsModalOpen(true);
    setIsEditing(edit);
    setCurrentCustomer(customer);
    form.resetFields();

    if (edit && customer) {
      form.setFieldsValue({
        name: customer.name,
        whatsapp: customer.whatsapp,
        instagram: customer.instagram,
        facebook: customer.facebook,
        first_purchase_date: customer.first_purchase_date
          ? dayjs(customer.first_purchase_date)
          : null,
      });
    }
  };

  const handleCancel = () => {
    setIsModalOpen(false);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const { name, whatsapp, instagram, facebook, first_purchase_date } = values;

      const customerData = {
        name,
        whatsapp: whatsapp || null,
        instagram: instagram || null,
        facebook: facebook || null,
        first_purchase_date: first_purchase_date
          ? first_purchase_date.toISOString()
          : new Date().toISOString(),
      };

      let response;

      if (isEditing && currentCustomer) {
        response = await fetch(`/api/customers/${currentCustomer.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(customerData),
        });
      } else {
        response = await fetch('/api/customers', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(customerData),
        });
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al guardar el cliente');
      }

      message.success(`Cliente ${isEditing ? 'actualizado' : 'creado'} correctamente`);
      setIsModalOpen(false);
      fetchCustomers();
    } catch (error: unknown) {
      console.error('Error:', error);
      message.error(getErrorMessage(error) || 'Error al guardar el cliente');
    }
  };

  // Formatear fecha
  const formatDate = (dateString: string) => {
    try {
      if (!dateString || isNaN(Date.parse(dateString))) {
        return 'Fecha no disponible';
      }

      const date = new Date(dateString);
      return new Intl.DateTimeFormat('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).format(date);
    } catch (error) {
      console.error('Error al formatear fecha:', error);
      return 'Fecha no disponible';
    }
  };

  // Renderizar enlaces de redes sociales
  const renderSocialMediaLinks = (customer: Customer) => {
    return (
      <Space>
        {customer.whatsapp && (
          <Tooltip title={`WhatsApp: ${customer.whatsapp}`}>
            <a
              href={`https://wa.me/${customer.whatsapp.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <WhatsAppOutlined style={{ fontSize: '18px', color: '#25D366' }} />
            </a>
          </Tooltip>
        )}
        {customer.instagram && (
          <Tooltip title={`Instagram: ${customer.instagram}`}>
            <a
              href={`https://instagram.com/${customer.instagram.replace('@', '')}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <InstagramOutlined style={{ fontSize: '18px', color: '#E1306C' }} />
            </a>
          </Tooltip>
        )}
        {customer.facebook && (
          <Tooltip title={`Facebook: ${customer.facebook}`}>
            <a
              href={`https://facebook.com/${customer.facebook}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <FacebookOutlined style={{ fontSize: '18px', color: '#1877F2' }} />
            </a>
          </Tooltip>
        )}
        {!customer.whatsapp && !customer.instagram && !customer.facebook && (
          <span style={{ color: '#999' }}>Sin redes sociales</span>
        )}
      </Space>
    );
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: 'Nombre',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Redes Sociales',
      key: 'social',
      render: (customer: Customer) => renderSocialMediaLinks(customer),
    },
    {
      title: 'Primera Compra',
      dataIndex: 'first_purchase_date',
      key: 'first_purchase_date',
      render: (date: string) => formatDate(date),
    },
    {
      title: 'Acciones',
      key: 'actions',
      render: (customer: Customer) => (
        <Space size="small">
          <Button
            icon={<EditOutlined />}
            type="primary"
            onClick={() => showModal(true, customer)}
            size="small"
          />
          <Button
            icon={<DeleteOutlined />}
            danger
            onClick={() => showDeleteConfirm(customer.id)}
            size="small"
          />
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 16 }}>
      <Card
        title={
          <Row justify="space-between" align="middle">
            <Col>
              <Title style={{ margin: 0 }} level={3}>
                Clientes
              </Title>
            </Col>
            <Col>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => showModal(false, null)}>
                Nuevo Cliente
              </Button>
            </Col>
          </Row>
        }
      >
        <Table
          columns={columns}
          dataSource={customers}
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      {/* Modal para crear/editar cliente */}
      <Modal
        title={isEditing ? 'Editar Cliente' : 'Nuevo Cliente'}
        open={isModalOpen}
        onCancel={handleCancel}
        onOk={handleSubmit}
        okText={isEditing ? 'Actualizar' : 'Crear'}
        cancelText="Cancelar"
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ name: '', whatsapp: '', instagram: '', facebook: '' }}
        >
          <Form.Item
            name="name"
            label="Nombre"
            rules={[{ required: true, message: 'Por favor ingresa el nombre del cliente' }]}
          >
            <Input placeholder="Nombre del cliente" />
          </Form.Item>

          <Form.Item name="whatsapp" label="WhatsApp">
            <Input placeholder="Número de WhatsApp" prefix={<WhatsAppOutlined />} />
          </Form.Item>

          <Form.Item name="instagram" label="Instagram">
            <Input placeholder="Usuario de Instagram" prefix={<InstagramOutlined />} />
          </Form.Item>

          <Form.Item name="facebook" label="Facebook">
            <Input placeholder="Usuario o URL de Facebook" prefix={<FacebookOutlined />} />
          </Form.Item>

          <Form.Item name="first_purchase_date" label="Fecha de Primera Compra">
            <DatePicker
              style={{ width: '100%' }}
              format="DD/MM/YYYY"
              placeholder="Selecciona una fecha"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
