'use client';

import React, { useState } from 'react';
import { Form, Input, Button, Card, message, Typography, Alert, Space } from 'antd';
import { useAuth } from '@/lib/AuthContext';
import { LockOutlined, UserOutlined, ReloadOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

interface LoginFormProps {
  onClose?: () => void;
}

export function LoginForm({ onClose }: LoginFormProps) {
  const { login, isLoading, refreshUser } = useAuth();
  const [form] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginAttempts, setLoginAttempts] = useState(0);

  const onFinish = async (values: { email: string; password: string }) => {
    try {
      setLoginError(null);
      await login(values.email, values.password);
      messageApi.success('¡Inicio de sesión exitoso!');
      if (onClose) onClose();
    } catch (error) {
      console.error('Error de autenticación:', error);
      setLoginAttempts(prev => prev + 1);

      // Personalizar el mensaje de error basado en el error específico
      let errorMessage = 'Error al iniciar sesión. Verifica tus credenciales e intenta nuevamente.';

      if (error instanceof Error) {
        if (error.message.includes('Invalid login credentials')) {
          errorMessage = 'Credenciales inválidas. Por favor verifica tu correo y contraseña.';
        } else if (error.message.includes('Email not confirmed')) {
          errorMessage =
            'Tu correo electrónico no ha sido confirmado. Por favor verifica tu bandeja de entrada.';
        } else if (error.message.includes('rate limit')) {
          errorMessage =
            'Demasiados intentos fallidos. Por favor espera unos minutos antes de intentar nuevamente.';
        } else if (error.message.includes('network') || error.message.includes('timeout')) {
          errorMessage =
            'Problema de conexión. Verifica tu conexión a internet e intenta nuevamente.';
        }
      }

      setLoginError(errorMessage);
    }
  };

  // Función para reintentar la autenticación
  const handleRetry = async () => {
    try {
      setLoginError(null);
      await refreshUser();
      messageApi.success('Sesión restaurada exitosamente');
      if (onClose) onClose();
    } catch (error) {
      console.error('Error al reautenticar:', error);
      setLoginError('No se pudo restaurar la sesión. Por favor intenta iniciar sesión nuevamente.');
    }
  };

  return (
    <>
      {contextHolder}
      <Card variant="borderless" style={{ width: '100%', maxWidth: 400, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Title level={3}>Iniciar Sesión</Title>
          {loginAttempts > 0 && (
            <Text type="secondary">
              Intento {loginAttempts} {loginAttempts === 1 ? 'realizado' : 'realizados'}
            </Text>
          )}
        </div>

        {loginError && (
          <Alert
            message="Error de inicio de sesión"
            description={
              <Space direction="vertical">
                <div>{loginError}</div>
                <Button
                  type="primary"
                  ghost
                  icon={<ReloadOutlined />}
                  onClick={handleRetry}
                  size="small"
                >
                  Reintentar verificación
                </Button>
              </Space>
            }
            type="error"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

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
