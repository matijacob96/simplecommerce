'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Table,
  Input,
  Button,
  Space,
  Typography,
  Card,
  Form,
  Modal,
  Popconfirm,
  InputNumber,
} from 'antd';
import {
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { toaster } from '../components/ui/toaster';

const { Title, Text } = Typography;

type Category = {
  id: number;
  name: string;
  profit_margin?: number | null;
  created_at: string;
};

type ApiError = {
  error?: string;
  productCount?: number;
  message?: string;
};

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState<number | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [currentCategory, setCurrentCategory] = useState<Category | null>(null);
  const [editForm] = Form.useForm();

  const showSuccess = useCallback((message: string) => {
    toaster.success(message);
  }, []);

  const showError = useCallback((message: string) => {
    toaster.error(message);
  }, []);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/categories');
      if (response.ok) {
        const data = await response.json();
        setCategories(data);
      } else {
        showError('No se pudieron cargar las categorías');
      }
    } catch {
      showError('No se pudieron cargar las categorías');
    } finally {
      setLoading(false);
    }
  }, [showError, setCategories, setLoading]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      showError('El nombre de la categoría es requerido');
      return;
    }

    setIsAdding(true);

    try {
      const response = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCategoryName }),
      });

      if (response.ok) {
        const newCategory = await response.json();
        setCategories([...categories, newCategory]);
        setNewCategoryName('');
        showSuccess('Categoría creada correctamente');
      } else {
        const errorData = (await response.json()) as ApiError;
        throw new Error(errorData.error || 'Error desconocido');
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      showError(errorMessage);
    } finally {
      setIsAdding(false);
    }
  };

  const handleUpdateCategory = async () => {
    try {
      const values = await editForm.validateFields();
      const categoryId = currentCategory?.id;

      if (!categoryId) return;
      setLoading(true);

      const payload = {
        name: values.name,
        profit_margin:
          values.profit_margin === undefined ? null : Number(values.profit_margin) / 100,
      };

      const response = await fetch(`/api/categories/${categoryId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const updatedCategory = await response.json();
        setCategories(categories.map(cat => (cat.id === categoryId ? updatedCategory : cat)));
        setEditModalVisible(false);
        editForm.resetFields();
        showSuccess('Categoría actualizada correctamente');
      } else {
        const errorData = (await response.json()) as ApiError;
        throw new Error(errorData.error || 'Error desconocido');
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      showError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCategory = async (categoryId: number) => {
    setIsDeletingId(categoryId);
    try {
      const response = await fetch(`/api/categories/${categoryId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setCategories(categories.filter(cat => cat.id !== categoryId));
        showSuccess('Categoría eliminada correctamente');
      } else {
        const errorData = (await response.json()) as ApiError;
        if (errorData.productCount) {
          showError(`No se puede eliminar (${errorData.productCount} productos asociados)`);
        } else {
          throw new Error(errorData.error || 'Error al eliminar');
        }
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      showError(errorMessage);
    } finally {
      setIsDeletingId(null);
    }
  };

  const showEditModal = (category: Category) => {
    setCurrentCategory(category);
    const profitMarginValue =
      category.profit_margin !== null && category.profit_margin !== undefined
        ? Number(category.profit_margin) * 100
        : undefined;

    editForm.setFieldsValue({
      name: category.name,
      profit_margin: profitMarginValue,
    });
    setEditModalVisible(true);
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
    },
    {
      title: 'Nombre',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Margen de Ganancia',
      dataIndex: 'profit_margin',
      key: 'profit_margin',
      render: (profit_margin: number | null | undefined) => {
        if (profit_margin === null || profit_margin === undefined) {
          return <Text type="secondary">Valor predeterminado</Text>;
        }
        return `${(Number(profit_margin) * 100).toFixed(1)}%`;
      },
    },
    {
      title: 'Fecha de Creación',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (text: string) => {
        const date = new Date(text);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
      },
    },
    {
      title: 'Acciones',
      key: 'actions',
      render: (_: unknown, record: Category) => (
        <Space size="middle">
          <Button type="link" icon={<EditOutlined />} onClick={() => showEditModal(record)} />
          <Popconfirm
            title="¿Estás seguro de eliminar esta categoría?"
            description={`¿Realmente deseas eliminar "${record.name}"?`}
            okText="Sí"
            cancelText="No"
            icon={<ExclamationCircleOutlined style={{ color: 'red' }} />}
            onConfirm={() => handleDeleteCategory(record.id)}
          >
            <Button
              type="link"
              danger
              icon={<DeleteOutlined />}
              loading={isDeletingId === record.id}
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 16 }}>
      <Card
        title={
          <Title style={{ margin: 0 }} level={3}>
            Gestión de Categorías
          </Title>
        }
      >
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <Form onFinish={handleAddCategory} layout="inline">
            <Form.Item
              name="name"
              rules={[
                {
                  required: true,
                  message: 'Por favor ingresa un nombre para la categoría',
                },
              ]}
            >
              <Input
                placeholder="Nombre de la categoría"
                value={newCategoryName}
                onChange={e => setNewCategoryName(e.target.value)}
                style={{ width: 300 }}
              />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" loading={isAdding} icon={<PlusOutlined />}>
                Agregar Categoría
              </Button>
            </Form.Item>
          </Form>

          <Table
            dataSource={categories}
            columns={columns}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 10 }}
          />
        </Space>
      </Card>

      <Modal
        title="Editar Categoría"
        open={editModalVisible}
        onOk={handleUpdateCategory}
        onCancel={() => setEditModalVisible(false)}
        confirmLoading={loading}
      >
        <Form form={editForm} layout="vertical">
          <Form.Item
            name="name"
            label="Nombre de la categoría"
            rules={[
              {
                required: true,
                message: 'Por favor ingresa el nombre de la categoría',
              },
            ]}
          >
            <Input placeholder="Nombre de la categoría" />
          </Form.Item>
          <Form.Item
            name="profit_margin"
            label="Margen de ganancia"
            tooltip="Deja este campo vacío para usar el margen predeterminado global"
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              max={100}
              step={0.1}
              placeholder="Margen específico para esta categoría"
              suffix="%"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
