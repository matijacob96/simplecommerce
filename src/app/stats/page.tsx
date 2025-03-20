'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Typography,
  Table,
  Divider,
  Empty,
  Spin,
  Alert,
  Segmented,
  Select,
  DatePicker,
  Grid,
  Tag,
} from 'antd';
import {
  UserOutlined,
  DollarOutlined,
  PercentageOutlined,
  ShoppingCartOutlined,
  CalendarOutlined,
  ShoppingOutlined,
} from '@ant-design/icons';
import { Sale } from '@/types';
import { toNumber } from '@/utils/priceUtils';

const { Title } = Typography;
const { RangePicker } = DatePicker;
const { useBreakpoint } = Grid;

// Interfaces para los tipos utilizados en los gráficos
interface G2ChartInstance {
  line: () => G2ChartGeometry;
  point: () => G2ChartGeometry;
  interval: () => G2ChartGeometry;
  axis: (field: string, config: Record<string, unknown>) => void;
  options: (config: Record<string, unknown>) => void;
  render: () => void;
  destroy: () => void;
}

interface G2ChartGeometry {
  data: (data: unknown[]) => G2ChartGeometry;
  encode: (field: string, value: string) => G2ChartGeometry;
  transform: (config: Record<string, unknown>) => G2ChartGeometry;
  coordinate: (config: Record<string, unknown>) => G2ChartGeometry;
  scale: (field: string, config: Record<string, unknown>) => G2ChartGeometry;
  style: (field: string, value: unknown) => G2ChartGeometry;
  label: (config: Record<string, unknown>) => G2ChartGeometry;
}

interface TooltipPoint {
  color?: string;
  data?: {
    date?: string;
    category?: string;
    value?: number;
    type?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface ChartDataPoint {
  date?: string;
  category?: string;
  value?: number;
  type?: string;
  [key: string]: unknown;
}

// Tipos para los datos del gráfico
type LineChartDataItem = {
  date: string;
  category: string;
  value: number;
};

type PieChartDataItem = {
  type: string;
  value: number;
};

// Componente para el gráfico de líneas
const LineChartComponent: React.FC<{
  data: LineChartDataItem[];
  height?: number;
}> = ({ data, height = 300 }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let chartInstance: G2ChartInstance | null = null;

    // Solo intentamos crear el gráfico si hay datos y un contenedor válido
    if (data?.length && chartContainerRef.current) {
      // Importar G2 dinámicamente para evitar problemas con SSR
      import('@antv/g2').then(({ Chart }) => {
        if (!chartContainerRef.current) return;

        // Limpiamos el contenedor si es necesario
        chartContainerRef.current.innerHTML = '';

        // Creamos la instancia del gráfico
        chartInstance = new Chart({
          container: chartContainerRef.current,
          autoFit: true,
          height,
        }) as unknown as G2ChartInstance;

        // Configurar las opciones del tooltip antes de agregar geometrías
        // Esto evita la visualización duplicada de campos
        chartInstance.options({
          tooltip: {
            title: (d: ChartDataPoint) => String(d.date || ''),
            items: [
              {
                channel: 'y',
                field: 'value',
                valueFormatter: (val: number | null | undefined) => {
                  if (val === null || val === undefined) return 'U$0.00';
                  return `U$${Number(val).toFixed(2)}`;
                },
              },
            ],
            customContent: (title: string, items: TooltipPoint[]) => {
              const formatter = (value: number) => `U$${value.toFixed(2)}`;

              // Crear HTML personalizado para el tooltip
              const tooltipItems = items
                .map(item => {
                  if (!item || !item.data) return '';
                  const dataPoint = item.data;
                  return `
                  <li style="margin-bottom: 4px; list-style-type: none;">
                    <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: ${item.color || '#666'}; margin-right: 8px;"></span>
                    <span style="color: #666;">${dataPoint.category || ''}:</span>
                    <span style="float: right; margin-left: 12px; font-weight: bold;">${formatter(Number(dataPoint.value || 0))}</span>
                  </li>
                `;
                })
                .join('');

              return `
                <div style="padding: 8px 12px;">
                  <div style="margin-bottom: 8px; font-weight: bold;">${title}</div>
                  <ul style="padding: 0; margin: 0;">
                    ${tooltipItems}
                  </ul>
                </div>
              `;
            },
          },
        });

        // Configuración básica del gráfico
        chartInstance
          .line()
          .data(data)
          .encode('x', 'date')
          .encode('y', 'value')
          .encode('color', 'category')
          .style('lineWidth', 3)
          .scale('color', {
            range: ['#1890ff', '#52c41a'],
          });

        // Añadir puntos para mejor visualización
        chartInstance
          .point()
          .data(data)
          .encode('x', 'date')
          .encode('y', 'value')
          .encode('color', 'category')
          .style('size', 5);

        // Configurar formato de valores
        chartInstance.axis('y', {
          labelFormatter: (val: string) => `U$${Number(val).toFixed(2)}`,
        });

        // Renderizar el gráfico
        chartInstance.render();
      });
    }

    // Limpieza al desmontar
    return () => {
      if (chartInstance) {
        try {
          chartInstance.destroy();
        } catch (error) {
          console.error('Error al destruir el gráfico:', error);
        }
      }
    };
  }, [data, height]);

  // Si no hay datos, mostramos un mensaje
  if (!data || data.length === 0) {
    return (
      <Empty description="No hay datos para mostrar en el gráfico" style={{ marginTop: 20 }} />
    );
  }

  return <div ref={chartContainerRef} style={{ width: '100%', height: `${height}px` }} />;
};

// Componente para el gráfico de torta
const PieChartComponent: React.FC<{
  data: PieChartDataItem[];
  height?: number;
}> = ({ data, height = 300 }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let chartInstance: G2ChartInstance | null = null;

    // Solo intentamos crear el gráfico si hay datos y un contenedor válido
    if (data?.length && chartContainerRef.current) {
      // Importar G2 dinámicamente
      import('@antv/g2').then(({ Chart }) => {
        if (!chartContainerRef.current) return;

        // Limpiamos el contenedor si es necesario
        chartContainerRef.current.innerHTML = '';

        // Calculamos el total para porcentajes
        const total = data.reduce((sum, item) => sum + item.value, 0);

        // Creamos la instancia del gráfico
        chartInstance = new Chart({
          container: chartContainerRef.current,
          autoFit: true,
          height,
        }) as unknown as G2ChartInstance;

        // Configurar opciones del tooltip antes de agregar geometrías
        chartInstance.options({
          tooltip: {
            customContent: (title: string, items: TooltipPoint[]) => {
              // Crear HTML personalizado para el tooltip
              const tooltipItems = items
                .map(item => {
                  if (!item || !item.data) return '';
                  const dataPoint = item.data;
                  const value = Number(dataPoint.value || 0);
                  const percentage = ((value / total) * 100).toFixed(1);
                  return `
                  <li style="margin-bottom: 4px; list-style-type: none;">
                    <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: ${item.color || '#666'}; margin-right: 8px;"></span>
                    <span style="color: #666;">${dataPoint.type || ''}:</span>
                    <span style="float: right; margin-left: 12px; font-weight: bold;">${value} ventas (${percentage}%)</span>
                  </li>
                `;
                })
                .join('');

              return `
                <div style="padding: 8px 12px;">
                  <ul style="padding: 0; margin: 0;">
                    ${tooltipItems}
                  </ul>
                </div>
              `;
            },
          },
        });

        // Configuración básica del gráfico de torta
        chartInstance
          .interval()
          .data(data)
          .transform({ type: 'stackY' })
          .encode('y', 'value')
          .encode('color', 'type')
          .coordinate({ type: 'theta', innerRadius: 0.25 })
          .style('stroke', 'white')
          .style('lineWidth', 1)
          .label({
            text: (d: ChartDataPoint) => {
              if (d && typeof d.value === 'number') {
                const percentage = ((d.value / total) * 100).toFixed(1);
                return `${d.type}: ${d.value} (${percentage}%)`;
              }
              return '';
            },
            position: 'outside',
          });

        // Renderizar el gráfico
        chartInstance.render();
      });
    }

    // Limpieza al desmontar
    return () => {
      if (chartInstance) {
        try {
          chartInstance.destroy();
        } catch (error) {
          console.error('Error al destruir el gráfico:', error);
        }
      }
    };
  }, [data, height]);

  // Si no hay datos, mostramos un mensaje
  if (!data || data.length === 0) {
    return <Empty description="No hay datos de métodos de pago" style={{ marginTop: 20 }} />;
  }

  return <div ref={chartContainerRef} style={{ width: '100%', height: `${height}px` }} />;
};

export default function StatsPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<[Date, Date] | null>(null);
  const [viewMode, setViewMode] = useState<string | number>('general');
  const [timeFrame, setTimeFrame] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<number | 'all'>('all');
  const [selectedVendor, setSelectedVendor] = useState<string | 'all'>('all');
  const [users, setUsers] = useState<{ id: string; name: string; email: string }[]>([]);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);

  const screens = useBreakpoint();
  const isMobile = !screens.md;

  // Obtener datos de ventas, usuarios y categorías
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Obtener ventas
        const salesResponse = await fetch('/api/sales');
        if (!salesResponse.ok) throw new Error('Error al cargar las ventas');
        const salesData = await salesResponse.json();
        setSales(salesData);

        // Obtener usuarios
        const usersResponse = await fetch('/api/users');
        if (usersResponse.ok) {
          const usersData = await usersResponse.json();
          setUsers(usersData);
        }

        // Obtener categorías
        const categoriesResponse = await fetch('/api/categories');
        if (categoriesResponse.ok) {
          const categoriesData = await categoriesResponse.json();
          setCategories(categoriesData);
        }
      } catch (err) {
        setError('Error al cargar los datos de estadísticas');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // Filtrar ventas según el rango de fechas, categoría y vendedor seleccionado
  const getFilteredSales = () => {
    let filtered = sales;

    // Filtrar por fechas si hay un rango seleccionado
    if (dateRange) {
      const [startDate, endDate] = dateRange;
      filtered = filtered.filter(sale => {
        const saleDate = new Date(sale.created_at);
        return saleDate >= startDate && saleDate <= endDate;
      });
    }

    // Filtrar por categoría si hay una seleccionada
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(sale =>
        sale.items.some(item => item.product.category_id === selectedCategory)
      );
    }

    // Filtrar por vendedor si hay uno seleccionado
    if (selectedVendor !== 'all') {
      filtered = filtered.filter(sale => sale.user_id === selectedVendor);
    }

    return filtered;
  };

  // Aplicar filtro de periodo
  const applyTimeFrameFilter = (data: Sale[]) => {
    if (timeFrame === 'all') return data;

    const now = new Date();
    let startDate: Date;

    switch (timeFrame) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        return data;
    }

    return data.filter(sale => new Date(sale.created_at) >= startDate);
  };

  const filteredSales = applyTimeFrameFilter(getFilteredSales());

  // Calcular estadísticas generales
  const calculateGeneralStats = () => {
    if (!filteredSales.length)
      return {
        totalSales: 0,
        totalRevenue: 0,
        totalRevenueArs: 0,
        averageTicket: 0,
        productsSold: 0,
      };

    let totalRevenue = 0;
    let totalRevenueArs = 0;
    let productsSold = 0;

    filteredSales.forEach(sale => {
      totalRevenue += toNumber(sale.total);
      totalRevenueArs += sale.total_ars ? toNumber(sale.total_ars) : 0;

      sale.items.forEach(item => {
        productsSold += item.quantity;
      });
    });

    return {
      totalSales: filteredSales.length,
      totalRevenue,
      totalRevenueArs,
      averageTicket: totalRevenue / filteredSales.length,
      productsSold,
    };
  };

  // Calcular ventas por usuario (vendedor)
  const calculateSalesByUser = () => {
    // Objeto para almacenar ventas por usuario
    const userSales: Record<
      string,
      {
        userName: string;
        count: number;
        total: number;
        totalArs: number;
      }
    > = {};

    filteredSales.forEach(sale => {
      const userId = sale.user_id || 'no-user';
      // Buscamos el nombre del usuario o usamos el email si no hay nombre
      const user = users.find(u => u.id === userId);
      let userName = 'Usuario no registrado';

      if (user) {
        userName = user.name || user.email || 'Usuario sin nombre';
      }

      if (!userSales[userId]) {
        userSales[userId] = {
          userName,
          count: 0,
          total: 0,
          totalArs: 0,
        };
      }

      userSales[userId].count += 1;
      userSales[userId].total += toNumber(sale.total);
      userSales[userId].totalArs += sale.total_ars ? toNumber(sale.total_ars) : 0;
    });

    return Object.entries(userSales).map(([userId, stats]) => ({
      id: userId,
      user: stats.userName,
      count: stats.count,
      total: stats.total,
      totalArs: stats.totalArs,
      percentage: (stats.count / filteredSales.length) * 100,
    }));
  };

  // Calcular ganancias por venta (aproximado)
  const calculateProfitsBySale = () => {
    return filteredSales.map(sale => {
      let totalCost = 0;
      const totalSelling = toNumber(sale.total);

      sale.items.forEach(item => {
        const productCost = toNumber(item.product.price || 0) * item.quantity;
        totalCost += productCost;
      });

      const profit = totalSelling - totalCost;
      const profitPercentage = totalCost > 0 ? (profit / totalCost) * 100 : 0;

      return {
        id: sale.id,
        date: new Date(sale.created_at).toLocaleDateString(),
        customer: sale.customer?.name || 'Cliente no registrado',
        totalCost,
        totalSelling,
        profit,
        profitPercentage,
      };
    });
  };

  // Calcular totales y promedio de ganancias, considerando la categoría seleccionada
  const calculateTotalProfits = () => {
    // Determinamos qué ventas usar según la categoría seleccionada
    const ventasAConsiderar =
      selectedCategory === 'all'
        ? filteredSales // Usar las ventas ya filtradas por periodo
        : filteredSales.filter(
            (
              sale // Usar las ventas ya filtradas por periodo
            ) => sale.items.some(item => item.product.category_id === selectedCategory)
          );

    // Calculamos las ganancias de las ventas
    const allProfits = ventasAConsiderar.map(sale => {
      let totalCost = 0;
      const totalSelling = toNumber(sale.total);

      sale.items.forEach(item => {
        const productCost = toNumber(item.product.price || 0) * item.quantity;
        totalCost += productCost;
      });

      return {
        profit: totalSelling - totalCost,
        totalCost,
      };
    });

    const totalProfit = allProfits.reduce((sum, item) => sum + item.profit, 0);
    const totalCost = allProfits.reduce((sum, item) => sum + item.totalCost, 0);
    const avgPercentage = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;

    return {
      totalProfit,
      totalCost,
      avgPercentage,
    };
  };

  // Datos para gráfico de torta (ventas por método de pago)
  const getSalesByPaymentMethodData = () => {
    const paymentMethods: Record<string, number> = {};

    filteredSales.forEach(sale => {
      const method = sale.payment_method || 'desconocido';
      paymentMethods[method] = (paymentMethods[method] || 0) + 1;
    });

    return Object.entries(paymentMethods).map(([method, count]) => ({
      type:
        method === 'efectivo' ? 'Efectivo' : method === 'transferencia' ? 'Transferencia' : method,
      value: count,
    }));
  };

  const generalStats = calculateGeneralStats();
  const userSalesData = calculateSalesByUser();
  const profitsData = calculateProfitsBySale();
  const totalProfits = calculateTotalProfits();
  const paymentMethodData = getSalesByPaymentMethodData();

  // Calculamos las ganancias netas para las estadísticas generales
  const netRevenue = profitsData.reduce((sum, item) => sum + item.profit, 0);

  // Configuración de gráficos extremadamente simplificada
  const generateLineChartData = (): LineChartDataItem[] => {
    // Objeto para almacenar datos por día
    const salesByDay: Record<string, { total: number; profit: number }> = {};

    // Agrupar por día
    for (const sale of filteredSales) {
      if (!sale.created_at) continue;

      try {
        const date = new Date(sale.created_at);
        if (isNaN(date.getTime())) continue;

        // Convertir a formato YYYY-MM-DD
        const dateStr = date.toISOString().split('T')[0];
        if (!dateStr) continue;

        // Calcular profit
        let totalCost = 0;
        const totalSelling = toNumber(sale.total);

        for (const item of sale.items) {
          totalCost += toNumber(item.product.price || 0) * item.quantity;
        }

        const profit = totalSelling - totalCost;

        // Inicializamos el registro para esta fecha si no existe
        if (!salesByDay[dateStr]) {
          salesByDay[dateStr] = { total: 0, profit: 0 };
        }

        // Actualizamos los datos para esta fecha - Uso seguro con verificación
        const dayData = salesByDay[dateStr];
        if (dayData) {
          dayData.total += totalSelling;
          dayData.profit += profit;
        }
      } catch (error) {
        console.error('Error procesando venta:', error);
      }
    }

    // Convertir a formato para gráfico
    const result: LineChartDataItem[] = [];
    const dates = Object.keys(salesByDay).sort();

    for (const date of dates) {
      // Acceso seguro con verificación
      const data = salesByDay[date];
      if (!data) continue;

      // Datos para ingresos brutos
      result.push({
        date,
        category: 'Ingresos Brutos (U$)',
        value: parseFloat((data.total || 0).toFixed(2)),
      });

      // Datos para ganancias netas
      result.push({
        date,
        category: 'Ganancias Netas (U$)',
        value: parseFloat((data.profit || 0).toFixed(2)),
      });
    }

    return result;
  };

  if (isLoading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Spin size="large" />
        <p>Cargando estadísticas...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <Alert message={error} type="error" showIcon />
      </div>
    );
  }

  // Preparar opciones para el select de vendedores
  const vendorOptions = [
    { value: 'all', label: 'Todos los vendedores' },
    ...users.map(user => ({
      value: user.id,
      label: user.name || user.email || 'Usuario sin nombre',
    })),
  ];

  return (
    <div
      style={{
        padding: isMobile ? 12 : 24,
        height: isMobile ? '100vh' : 'auto',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Card
        style={{
          flex: 1,
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: isMobile ? 'calc(100vh - 24px)' : 'none',
        }}
        styles={{
          body: {
            flex: 1,
            overflow: 'auto',
            paddingBottom: isMobile ? 120 : 24, // Añadir padding extra al final para móvil
          },
        }}
      >
        <Title level={2}>Estadísticas</Title>

        {/* Filtros - Reorganizados para móvil */}
        <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
          <Col xs={24} sm={12} md={8} lg={6}>
            <Select
              style={{ width: '100%' }}
              value={timeFrame}
              onChange={setTimeFrame}
              options={[
                { value: 'all', label: 'Todo el periodo' },
                { value: 'today', label: 'Hoy' },
                { value: 'week', label: 'Última semana' },
                { value: 'month', label: 'Este mes' },
                { value: 'year', label: 'Este año' },
              ]}
            />
          </Col>
          <Col xs={24} sm={12} md={8} lg={6}>
            <Select
              style={{ width: '100%' }}
              value={selectedCategory}
              onChange={setSelectedCategory}
              placeholder="Filtrar por categoría"
              options={[
                { value: 'all', label: 'Todas las categorías' },
                ...categories.map(cat => ({ value: cat.id, label: cat.name })),
              ]}
            />
          </Col>
          <Col xs={24} sm={12} md={8} lg={6}>
            <Select
              style={{ width: '100%' }}
              value={selectedVendor}
              onChange={setSelectedVendor}
              placeholder="Filtrar por vendedor"
              options={vendorOptions}
            />
          </Col>
          <Col xs={24} sm={12} md={24} lg={6}>
            <RangePicker
              style={{ width: '100%' }}
              onChange={(_, dateStrings) => {
                if (dateStrings[0] && dateStrings[1]) {
                  setDateRange([new Date(dateStrings[0]), new Date(dateStrings[1])]);
                } else {
                  setDateRange(null);
                }
              }}
            />
          </Col>
        </Row>

        {/* Segmentador de vistas */}
        <Segmented
          options={[
            { label: isMobile ? 'General' : 'General', value: 'general', icon: <DollarOutlined /> },
            {
              label: isMobile ? 'Usuarios' : 'Por Usuario',
              value: 'by-user',
              icon: <UserOutlined />,
            },
            {
              label: isMobile ? 'Ganancias' : 'Ganancias',
              value: 'profits',
              icon: <PercentageOutlined />,
            },
            {
              label: isMobile ? 'Gráficos' : 'Gráficos',
              value: 'charts',
              icon: <CalendarOutlined />,
            },
          ]}
          value={viewMode}
          onChange={setViewMode}
          block
          style={{ marginBottom: 24 }}
        />

        {/* Indicadores generales - Optimizados para móvil con scroll horizontal en dispositivos pequeños */}
        <div
          style={{
            marginBottom: 24,
            overflowX: isMobile ? 'auto' : 'visible',
            paddingBottom: isMobile ? 8 : 0,
          }}
        >
          <Row
            gutter={[16, 16]}
            style={{
              minWidth: isMobile ? 600 : 'auto', // Para asegurar que el scroll funcione en móvil
            }}
          >
            <Col xs={8} sm={6} md={4}>
              <Card size={isMobile ? 'small' : 'default'}>
                <Statistic
                  title="Ventas Totales"
                  value={generalStats.totalSales}
                  prefix={<ShoppingCartOutlined />}
                />
              </Card>
            </Col>
            <Col xs={8} sm={6} md={4}>
              <Card size={isMobile ? 'small' : 'default'}>
                <Statistic
                  title="Productos Vendidos"
                  value={generalStats.productsSold}
                  prefix={<ShoppingOutlined />}
                />
              </Card>
            </Col>
            <Col xs={8} sm={6} md={4}>
              <Card size={isMobile ? 'small' : 'default'}>
                <Statistic
                  title="Ingresos Brutos U$"
                  value={parseFloat(generalStats.totalRevenue.toFixed(2))}
                  precision={2}
                  prefix={<DollarOutlined />}
                  formatter={value => `$${value}`}
                />
              </Card>
            </Col>
            {/* Solo mostrar estas cards en dispositivos más grandes o con scroll */}
            <Col xs={8} sm={6} md={4}>
              <Card size={isMobile ? 'small' : 'default'}>
                <Statistic
                  title="Ingresos Netos U$"
                  value={parseFloat(netRevenue.toFixed(2))}
                  precision={2}
                  prefix={<DollarOutlined />}
                  formatter={value => `$${value}`}
                  valueStyle={{ color: netRevenue >= 0 ? '#3f8600' : '#cf1322' }}
                />
              </Card>
            </Col>
            <Col xs={8} sm={6} md={4}>
              <Card size={isMobile ? 'small' : 'default'}>
                <Statistic
                  title="Ingresos AR$"
                  value={parseFloat(generalStats.totalRevenueArs.toFixed(0))}
                  precision={0}
                  prefix={<DollarOutlined />}
                  formatter={value => `$${value}`}
                />
              </Card>
            </Col>
            <Col xs={8} sm={6} md={4}>
              <Card size={isMobile ? 'small' : 'default'}>
                <Statistic
                  title="% Ganancia"
                  value={parseFloat(totalProfits.avgPercentage.toFixed(1))}
                  precision={1}
                  prefix={<PercentageOutlined />}
                  suffix="%"
                  valueStyle={{ color: totalProfits.avgPercentage >= 0 ? '#3f8600' : '#cf1322' }}
                />
              </Card>
            </Col>
          </Row>
        </div>

        {/* Contenido adicional - según la vista seleccionada */}
        {viewMode === 'general' && (
          <div className="stats-content-section">
            <Title level={4}>Resumen General</Title>
            <p>Ticket promedio: ${generalStats.averageTicket.toFixed(2)} U$</p>
            <Divider />
            <Row gutter={[16, 16]}>
              <Col span={24}>
                <div
                  style={{
                    padding: '8px',
                    background: '#fafafa',
                    borderRadius: '4px',
                    marginBottom: '8px',
                  }}
                >
                  <p>
                    <strong>Categoría seleccionada:</strong>{' '}
                    {selectedCategory === 'all'
                      ? 'Todas'
                      : categories.find(c => c.id === selectedCategory)?.name || 'Desconocida'}
                  </p>
                  {selectedVendor !== 'all' && (
                    <p>
                      <strong>Vendedor seleccionado:</strong>{' '}
                      {users.find(u => u.id === selectedVendor)?.name || 'Usuario desconocido'}
                    </p>
                  )}
                  <p>
                    <strong>Ganancia promedio:</strong> {totalProfits.avgPercentage.toFixed(1)}% (
                    {selectedCategory === 'all' ? 'todas las ventas' : 'ventas de esta categoría'})
                  </p>
                </div>
                <LineChartComponent data={generateLineChartData()} height={isMobile ? 240 : 300} />
              </Col>
            </Row>
          </div>
        )}

        {viewMode === 'by-user' && (
          <div>
            <Title level={4}>Ventas por Usuario</Title>
            {userSalesData.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <Table
                  dataSource={userSalesData}
                  rowKey="id"
                  pagination={false}
                  scroll={{ x: isMobile ? 800 : undefined }}
                  size={isMobile ? 'small' : 'middle'}
                  columns={[
                    {
                      title: 'Usuario',
                      dataIndex: 'user',
                      key: 'user',
                    },
                    {
                      title: 'Ventas',
                      dataIndex: 'count',
                      key: 'count',
                      sorter: (a, b) => a.count - b.count,
                    },
                    {
                      title: 'Total U$',
                      dataIndex: 'total',
                      key: 'total',
                      render: total => `$${total.toFixed(2)}`,
                      sorter: (a, b) => a.total - b.total,
                    },
                    {
                      title: 'Total AR$',
                      dataIndex: 'totalArs',
                      key: 'totalArs',
                      render: totalArs => `$${totalArs.toFixed(0)}`,
                      sorter: (a, b) => a.totalArs - b.totalArs,
                    },
                    {
                      title: '% del Total',
                      dataIndex: 'percentage',
                      key: 'percentage',
                      render: percentage => `${percentage.toFixed(1)}%`,
                      sorter: (a, b) => a.percentage - b.percentage,
                    },
                  ]}
                />
              </div>
            ) : (
              <Empty description="No hay datos de ventas por usuario" />
            )}
          </div>
        )}

        {viewMode === 'profits' && (
          <div>
            <Title level={4}>Ganancias por Venta</Title>
            <div
              style={{
                padding: '8px',
                background: '#fafafa',
                borderRadius: '4px',
                marginBottom: '8px',
              }}
            >
              <p>
                <strong>Categoría seleccionada:</strong>{' '}
                {selectedCategory === 'all'
                  ? 'Todas'
                  : categories.find(c => c.id === selectedCategory)?.name || 'Desconocida'}
              </p>
              {selectedVendor !== 'all' && (
                <p>
                  <strong>Vendedor seleccionado:</strong>{' '}
                  {users.find(u => u.id === selectedVendor)?.name || 'Usuario desconocido'}
                </p>
              )}
              <p>
                <strong>Ganancia promedio:</strong> {totalProfits.avgPercentage.toFixed(1)}% (
                {selectedCategory === 'all' ? 'todas las ventas' : 'ventas de esta categoría'})
              </p>
            </div>
            {profitsData.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <Table
                  dataSource={profitsData}
                  rowKey="id"
                  pagination={{ pageSize: isMobile ? 5 : 10 }}
                  scroll={{ x: isMobile ? 800 : undefined }}
                  size={isMobile ? 'small' : 'middle'}
                  columns={[
                    {
                      title: 'ID',
                      dataIndex: 'id',
                      key: 'id',
                      width: 60,
                    },
                    {
                      title: 'Fecha',
                      dataIndex: 'date',
                      key: 'date',
                    },
                    {
                      title: 'Cliente',
                      dataIndex: 'customer',
                      key: 'customer',
                    },
                    {
                      title: 'Costo U$',
                      dataIndex: 'totalCost',
                      key: 'totalCost',
                      render: cost => `$${cost.toFixed(2)}`,
                    },
                    {
                      title: 'Venta U$',
                      dataIndex: 'totalSelling',
                      key: 'totalSelling',
                      render: selling => `$${selling.toFixed(2)}`,
                    },
                    {
                      title: 'Ganancia U$',
                      dataIndex: 'profit',
                      key: 'profit',
                      render: profit => `$${profit.toFixed(2)}`,
                    },
                    {
                      title: 'Ganancia %',
                      dataIndex: 'profitPercentage',
                      key: 'profitPercentage',
                      render: percentage => `${percentage.toFixed(1)}%`,
                      sorter: (a, b) => a.profitPercentage - b.profitPercentage,
                    },
                  ]}
                  summary={() => (
                    <Table.Summary.Row>
                      <Table.Summary.Cell index={0} colSpan={isMobile ? 4 : 5}>
                        <strong>
                          Totales / Promedio (
                          {selectedVendor !== 'all'
                            ? 'vendedor seleccionado'
                            : selectedCategory === 'all'
                              ? 'todas las ventas'
                              : 'categoría seleccionada'}
                          ):
                        </strong>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={1}>
                        <strong>${totalProfits.totalProfit.toFixed(2)}</strong>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={2}>
                        <strong>{totalProfits.avgPercentage.toFixed(1)}%</strong>
                      </Table.Summary.Cell>
                    </Table.Summary.Row>
                  )}
                />
              </div>
            ) : (
              <Empty description="No hay datos de ganancias" />
            )}
          </div>
        )}

        {viewMode === 'charts' && (
          <div>
            <Title level={4}>Gráficos</Title>
            <Row gutter={[16, 24]}>
              <Col xs={24} lg={12}>
                <Card title="Ventas y Ganancias por Día">
                  <div style={{ marginBottom: '12px' }}>
                    <Tag color="#1890ff" style={{ fontSize: '14px', padding: '4px 8px' }}>
                      Ingresos Brutos (U$)
                    </Tag>
                    <Tag color="#52c41a" style={{ fontSize: '14px', padding: '4px 8px' }}>
                      Ganancias Netas (U$)
                    </Tag>
                  </div>
                  <LineChartComponent
                    data={generateLineChartData()}
                    height={isMobile ? 240 : 300}
                  />
                </Card>
              </Col>
              <Col xs={24} lg={12}>
                <Card title="Métodos de Pago">
                  <PieChartComponent data={paymentMethodData} height={isMobile ? 240 : 300} />
                </Card>
              </Col>
            </Row>
          </div>
        )}
      </Card>
    </div>
  );
}
