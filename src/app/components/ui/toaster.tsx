"use client"

import React, { useEffect, createContext, useContext, useState } from 'react';
import { message, notification, App } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';
import type { NotificationPlacement } from 'antd/es/notification/interface';

// Importar el parche de compatibilidad para React 19
import '@ant-design/v5-patch-for-react-19';

// Definición de tipos para el toaster
interface ToastOptions {
  title?: string;
  description?: string;
  status?: 'info' | 'success' | 'warning' | 'error' | 'loading';
  duration?: number;
}

// Tipo para notification type
type NotificationType = 'success' | 'info' | 'warning' | 'error';

// Configuración del sistema de notificaciones
const DEFAULT_PLACEMENT: NotificationPlacement = 'bottomRight';
const DEFAULT_DURATION = 4.5; // segundos

// Crear contexto para los APIs de notificación y mensaje
interface ToasterContextType {
  messageApi: ReturnType<typeof message.useMessage>[0];
  notificationApi: ReturnType<typeof notification.useNotification>[0];
}

const ToasterContext = createContext<ToasterContextType | null>(null);

// Hook para usar el toaster
const useToasterContext = () => {
  const context = useContext(ToasterContext);
  if (!context) {
    throw new Error('useToasterContext debe ser usado dentro de un ToasterProvider');
  }
  return context;
};

// Exportamos una interfaz compatible con el toaster anterior
export const toaster = {
  // Método para mostrar un toast normal
  toast: ({ title, description, status = 'info', duration = DEFAULT_DURATION }: ToastOptions) => {
    try {
      const { notificationApi } = useToasterContext();
      notificationApi.open({
        message: title,
        description: description,
        placement: DEFAULT_PLACEMENT,
        duration: duration,
        type: (status === 'error' ? 'error' : 
              status === 'warning' ? 'warning' :
              status === 'success' ? 'success' : 'info') as NotificationType,
        className: `ant-notification-${status}`
      });
    } catch (error) {
      // Fallback al método estático para usar fuera de contexto
      notification.open({
        message: title,
        description: description,
        placement: DEFAULT_PLACEMENT,
        duration: duration,
        type: (status === 'error' ? 'error' : 
              status === 'warning' ? 'warning' :
              status === 'success' ? 'success' : 'info') as NotificationType,
        className: `ant-notification-${status}`
      });
    }
  },
  // Método para mostrar un toast de carga
  loading: ({ title, description, duration = 0 }: ToastOptions) => {
    const key = `loading-${Date.now()}`;
    try {
      const { notificationApi } = useToasterContext();
      notificationApi.open({
        message: title,
        description: description,
        placement: DEFAULT_PLACEMENT,
        duration: duration,
        key,
        icon: <LoadingOutlined style={{ color: '#1677ff' }} />,
        className: 'ant-notification-loading'
      });
    } catch (error) {
      // Fallback al método estático
      notification.open({
        message: title,
        description: description,
        placement: DEFAULT_PLACEMENT,
        duration: duration,
        key,
        icon: <LoadingOutlined style={{ color: '#1677ff' }} />,
        className: 'ant-notification-loading'
      });
    }
    return key;
  },
  // Método para actualizar o cerrar un toast de carga
  update: (key: string, { title, description, status = 'info', duration = DEFAULT_DURATION }: ToastOptions) => {
    try {
      const { notificationApi } = useToasterContext();
      notificationApi.open({
        message: title,
        description: description,
        placement: DEFAULT_PLACEMENT,
        duration: duration,
        key,
        type: (status === 'error' ? 'error' : 
              status === 'warning' ? 'warning' :
              status === 'success' ? 'success' : 'info') as NotificationType,
        className: `ant-notification-${status}`
      });
    } catch (error) {
      // Fallback al método estático
      notification.open({
        message: title,
        description: description,
        placement: DEFAULT_PLACEMENT,
        duration: duration,
        key,
        type: (status === 'error' ? 'error' : 
              status === 'warning' ? 'warning' :
              status === 'success' ? 'success' : 'info') as NotificationType,
        className: `ant-notification-${status}`
      });
    }
  },
  // Método para cerrar un toast específico
  close: (key: string) => {
    try {
      const { notificationApi } = useToasterContext();
      notificationApi.destroy(key);
    } catch (error) {
      // Fallback al método estático
      notification.destroy(key);
    }
  },
  // Método para cerrar todos los toasts
  closeAll: () => {
    try {
      const { notificationApi } = useToasterContext();
      notificationApi.destroy();
    } catch (error) {
      // Fallback al método estático
      notification.destroy();
    }
  },
  // Método para mensaje de éxito rápido
  success: (title: string) => {
    try {
      const { messageApi } = useToasterContext();
      messageApi.success(title);
    } catch (error) {
      // Fallback al método estático
      message.success(title);
    }
  },
  // Método para mensaje de error rápido
  error: (title: string) => {
    try {
      const { messageApi } = useToasterContext();
      messageApi.error(title);
    } catch (error) {
      // Fallback al método estático
      message.error(title);
    }
  },
  // Método para mensaje de advertencia rápido
  warning: (title: string) => {
    try {
      const { messageApi } = useToasterContext();
      messageApi.warning(title);
    } catch (error) {
      // Fallback al método estático
      message.warning(title);
    }
  },
  // Método para mensaje informativo rápido
  info: (title: string) => {
    try {
      const { messageApi } = useToasterContext();
      messageApi.info(title);
    } catch (error) {
      // Fallback al método estático
      message.info(title);
    }
  }
};

// Proveedor de contexto para el toaster
export const ToasterProvider = ({ children }: { children: React.ReactNode }) => {
  const [messageApi, messageContextHolder] = message.useMessage();
  const [notificationApi, notificationContextHolder] = notification.useNotification();
  
  const [initialized, setInitialized] = useState(false);
  
  // Asegurarnos de que los APIs se inicialicen solo del lado del cliente
  useEffect(() => {
    setInitialized(true);
  }, []);

  return (
    <ToasterContext.Provider value={{ messageApi, notificationApi }}>
      {initialized && (
        <>
          {messageContextHolder}
          {notificationContextHolder}
        </>
      )}
      {children}
    </ToasterContext.Provider>
  );
};

// Este componente provee el contexto de notificaciones de AntDesign
export const Toaster: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  return (
    <ToasterProvider>
      <App>
        {children}
      </App>
    </ToasterProvider>
  );
};
