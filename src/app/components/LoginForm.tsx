'use client';

import React from 'react';
import { Form, Input, Button, Card, message, Typography } from 'antd';
import { useAuth } from '@/lib/AuthContext';
import { LockOutlined, UserOutlined } from '@ant-design/icons';

const { Title } = Typography;

interface LoginFormProps {
  onClose?: () => void;
}

export function LoginForm({ onClose }: LoginFormProps) {
  const { login, isLoading } = useAuth();
  const [form] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();

  const onFinish = async (values: { email: string; password: string }) => {
    try {
      await login(values.email, values.password);
      messageApi.success('¡Inicio de sesión exitoso!');
      if (onClose) onClose();
    } catch (error) {
      console.error('Error de autenticación:', error);
      messageApi.error('Error al iniciar sesión. Verifica tus credenciales e intenta nuevamente.');
    }
  };

  return (
    <>
      {contextHolder}
      <Card variant="borderless" style={{ width: '100%', maxWidth: 400, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Title level={3}>Iniciar Sesión</Title>
        </div>

        <Form form={form} name="login" layout="vertical" onFinish={onFinish} autoComplete="off">
          <Form.Item
            name="email"
            rules={[
              { required: true, message: 'Por favor ingresa tu correo electrónico' },
              { type: 'email', message: 'Por favor ingresa un correo válido' },
            ]}
          >
            <Input prefix={<UserOutlined />} placeholder="Correo electrónico" size="large" />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: 'Por favor ingresa tu contraseña' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="Contraseña" size="large" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={isLoading} block size="large">
              Iniciar Sesión
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </>
  );
}
