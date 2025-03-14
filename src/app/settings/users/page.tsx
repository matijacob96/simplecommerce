'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Button,
  Card,
  Table,
  Typography,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  Select,
  message,
  Row,
  Col,
} from 'antd';
import { UserAddOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import type { User, UserRole } from '@/lib/auth';
import { useAuth } from '@/lib/AuthContext';

const { Title } = Typography;
const { Option } = Select;

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();
  const { user: currentUser } = useAuth(); // Usuario actual

  // Función para cargar los usuarios memorizada con useCallback
  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/users');

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al cargar usuarios');
      }

      const data = await response.json();
      setUsers(data);
    } catch (error: unknown) {
      console.error('Error al cargar usuarios:', error);
      messageApi.error(
        'Error al cargar usuarios: ' +
          (error instanceof Error ? error.message : 'Error desconocido')
      );
    } finally {
      setLoading(false);
    }
  }, [messageApi, setLoading, setUsers]);

  // Cargar usuarios al inicio
  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Función para crear un nuevo usuario
  const handleCreateUser = async (values: { email: string; password: string; role: UserRole }) => {
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al crear usuario');
      }

      messageApi.success('Usuario creado correctamente');
      createForm.resetFields();
      setCreateModalVisible(false);
      fetchUsers();
    } catch (error: unknown) {
      console.error('Error al crear usuario:', error);
      messageApi.error(
        `Error al crear usuario: ${error instanceof Error ? error.message : 'Error desconocido'}`
      );
    }
  };

  // Función para actualizar el rol de un usuario
  const handleUpdateUser = async (values: { role: UserRole }) => {
    if (!selectedUser) return;

    try {
      const response = await fetch(`/api/users/${selectedUser.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: values.role }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al actualizar rol');
      }

      messageApi.success('Rol actualizado correctamente');
      setEditModalVisible(false);
      fetchUsers();
    } catch (error: unknown) {
      console.error('Error al actualizar rol:', error);
      messageApi.error(
        `Error al actualizar rol: ${error instanceof Error ? error.message : 'Error desconocido'}`
      );
    }
  };

  // Función para eliminar un usuario
  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    try {
      const response = await fetch(`/api/users/${selectedUser.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al eliminar usuario');
      }

      messageApi.success('Usuario eliminado correctamente');
      setConfirmModalVisible(false);
      fetchUsers();
    } catch (error: unknown) {
      console.error('Error al eliminar usuario:', error);
      messageApi.error(
        `Error al eliminar usuario: ${error instanceof Error ? error.message : 'Error desconocido'}`
      );
    }
  };

  // Abrir modal para editar un usuario
  const showEditModal = (user: User) => {
    setSelectedUser(user);
    editForm.setFieldsValue({ role: user.role });
    setEditModalVisible(true);
  };

  // Abrir modal para eliminar un usuario
  const showDeleteModal = (user: User) => {
    setSelectedUser(user);
    setConfirmModalVisible(true);
  };

  // Definición de las columnas de la tabla
  const columns = [
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: 'Rol',
      dataIndex: 'role',
      key: 'role',
      render: (role: UserRole) => {
        let color = 'blue';
        if (role === 'admin') color = 'red';
        if (role === 'vendedor') color = 'green';

        return <Tag color={color}>{role.toUpperCase()}</Tag>;
      },
    },
    {
      title: 'Acciones',
      key: 'actions',
      render: (_: unknown, record: User) => {
        // No permitir editar o eliminar al usuario actual
        const isCurrentUser = currentUser?.id === record.id;

        return (
          <Space>
            <Button
              icon={<EditOutlined />}
              onClick={() => showEditModal(record)}
              disabled={isCurrentUser}
              title={isCurrentUser ? 'No puedes editar tu propio usuario' : 'Editar usuario'}
            />
            <Button
              danger
              icon={<DeleteOutlined />}
              onClick={() => showDeleteModal(record)}
              disabled={isCurrentUser}
              title={isCurrentUser ? 'No puedes eliminar tu propio usuario' : 'Eliminar usuario'}
            />
          </Space>
        );
      },
    },
  ];

  return (
    <div style={{ padding: 16 }}>
      {contextHolder}
      <Card
        title={
          <Row justify="space-between" align="middle">
            <Col>
              <Title style={{ margin: 0 }} level={3}>
                Gestión de Usuarios
              </Title>
            </Col>
            <Col>
              <Button
                type="primary"
                icon={<UserAddOutlined />}
                onClick={() => setCreateModalVisible(true)}
              >
                Nuevo Usuario
              </Button>
            </Col>
          </Row>
        }
      >
        <Table columns={columns} dataSource={users} rowKey="id" loading={loading} />
      </Card>

      {/* Modal para crear usuario */}
      <Modal
        title="Crear Nuevo Usuario"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        footer={null}
      >
        <Form form={createForm} layout="vertical" onFinish={handleCreateUser}>
          <Form.Item
            name="email"
            label="Correo Electrónico"
            rules={[
              { required: true, message: 'Por favor ingresa un correo' },
              { type: 'email', message: 'Ingresa un correo electrónico válido' },
            ]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            name="password"
            label="Contraseña"
            rules={[
              { required: true, message: 'Por favor ingresa una contraseña' },
              {
                min: 6,
                message: 'La contraseña debe tener al menos 6 caracteres',
              },
            ]}
          >
            <Input.Password />
          </Form.Item>

          <Form.Item
            name="role"
            label="Rol"
            rules={[{ required: true, message: 'Por favor selecciona un rol' }]}
            initialValue="vendedor"
          >
            <Select>
              <Option value="admin">Administrador</Option>
              <Option value="vendedor">Vendedor</Option>
              <Option value="anonimo">Anónimo</Option>
            </Select>
          </Form.Item>

          <Form.Item>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Button onClick={() => setCreateModalVisible(false)}>Cancelar</Button>
              <Button type="primary" htmlType="submit">
                Crear
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal para editar rol de usuario */}
      <Modal
        title="Editar Rol de Usuario"
        open={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        footer={null}
      >
        <Form form={editForm} layout="vertical" onFinish={handleUpdateUser}>
          <Form.Item label="Email">
            <Input value={selectedUser?.email} disabled />
          </Form.Item>

          <Form.Item
            name="role"
            label="Rol"
            rules={[{ required: true, message: 'Por favor selecciona un rol' }]}
          >
            <Select>
              <Option value="admin">Administrador</Option>
              <Option value="vendedor">Vendedor</Option>
              <Option value="anonimo">Anónimo</Option>
            </Select>
          </Form.Item>

          <Form.Item>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Button onClick={() => setEditModalVisible(false)}>Cancelar</Button>
              <Button type="primary" htmlType="submit">
                Actualizar
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal de confirmación para eliminar usuario */}
      <Modal
        title="Confirmar Eliminación"
        open={confirmModalVisible}
        onCancel={() => setConfirmModalVisible(false)}
        onOk={handleDeleteUser}
        okText="Eliminar"
        cancelText="Cancelar"
        okButtonProps={{ danger: true }}
      >
        <p>¿Estás seguro que deseas eliminar al usuario {selectedUser?.email}?</p>
        <p>Esta acción no se puede deshacer.</p>
      </Modal>
    </div>
  );
}
