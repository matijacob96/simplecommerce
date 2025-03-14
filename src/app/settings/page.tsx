'use client';

import { useState, useEffect } from 'react';
import { Card, Button, InputNumber, Typography, Form, Spin, Space, Slider, Divider } from 'antd';
import { SaveOutlined, PercentageOutlined } from '@ant-design/icons';
import { toaster } from '../components/ui/toaster';

const { Title, Text } = Typography;

export default function SettingsPage() {
  const [defaultProfitMargin, setDefaultProfitMargin] = useState(0.2);
  const [loading, setLoading] = useState(true);
  const [form] = Form.useForm();

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/settings');
        if (response.ok) {
          const data = await response.json();
          const profitMargin = data.default_profit_margin || data.profit_margin;
          const numericMargin =
            typeof profitMargin === 'string' ? parseFloat(profitMargin) : Number(profitMargin);

          const marginValue = isNaN(numericMargin) ? 0.2 : numericMargin;
          setDefaultProfitMargin(marginValue);

          // Actualizamos el formulario solo si ya no estamos cargando
          form.setFieldsValue({
            default_profit_margin: marginValue,
          });
        }
      } catch (error) {
        console.error('Error fetching settings:', error);
        toaster.error('Error al cargar la configuración');
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [form]); // Añadimos form a las dependencias

  const handleSubmit = async (values: { default_profit_margin: number }) => {
    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ default_profit_margin: values.default_profit_margin }),
      });

      if (response.ok) {
        toaster.success('Configuración guardada correctamente');
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Error desconocido');
      }
    } catch (error) {
      toaster.error(
        'Error al guardar: ' + (error instanceof Error ? error.message : 'Error desconocido')
      );
    }
  };

  const formatPercentage = (value: number | undefined) => {
    if (value === undefined) return '';
    return `${(value * 100).toFixed(0)}%`;
  };

  return (
    <div style={{ padding: 16 }}>
      <Card
        title={
          <Title style={{ margin: 0 }} level={3}>
            Configuración
          </Title>
        }
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ default_profit_margin: defaultProfitMargin }}
          onFinish={handleSubmit}
        >
          {loading ? (
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                padding: 24,
                width: '100%',
              }}
            >
              <Spin size="large" />
            </div>
          ) : (
            <>
              <Form.Item
                name="default_profit_margin"
                label={<Text strong>Margen de beneficio predeterminado</Text>}
                tooltip="El margen de beneficio predeterminado se utilizará para categorías que no tengan un margen específico establecido."
                rules={[
                  {
                    required: true,
                    message: 'Por favor ingresa el margen de beneficio predeterminado',
                  },
                ]}
              >
                <Space style={{ width: '100%' }} direction="vertical">
                  <Slider
                    min={0}
                    max={1}
                    step={0.01}
                    value={typeof defaultProfitMargin === 'number' ? defaultProfitMargin : 0}
                    onChange={value => {
                      setDefaultProfitMargin(value);
                      form.setFieldsValue({ default_profit_margin: value });
                    }}
                    tooltip={{ formatter: formatPercentage }}
                  />
                  <InputNumber
                    style={{ width: 200 }}
                    min={0}
                    max={1}
                    step={0.01}
                    value={defaultProfitMargin}
                    formatter={value => `${(Number(value) * 100).toFixed(0)}`}
                    parser={value => (value ? parseFloat(value.replace('%', '')) / 100 : 0)}
                    onChange={value => {
                      setDefaultProfitMargin(value || 0);
                      form.setFieldsValue({ default_profit_margin: value });
                    }}
                    prefix={<PercentageOutlined />}
                  />
                </Space>
              </Form.Item>

              <Divider />

              <Form.Item>
                <Button type="primary" htmlType="submit" icon={<SaveOutlined />}>
                  Guardar Configuración
                </Button>
              </Form.Item>
            </>
          )}
        </Form>
      </Card>
    </div>
  );
}
