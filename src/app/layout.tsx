import { AntdRegistry } from '@ant-design/nextjs-registry';
import '@ant-design/v5-patch-for-react-19';
import { Toaster } from "./components/ui/toaster";
import React, { Suspense } from "react";
import './globals.css';
import 'antd/dist/reset.css';
import { CustomHeader } from './components/CustomHeader';
import { Layout, Spin } from 'antd';
import { Content } from 'antd/es/layout/layout';
import { AuthProvider } from '@/lib/AuthContext';
import { RouteGuard } from './components/RouteGuard';
import { AppStateProvider } from '@/lib/AppStateContext';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning={true}>
        <AntdRegistry>
          <AuthProvider>
            <AppStateProvider>
              <Toaster>
                <Layout>
                  <CustomHeader />
                  <Content>
                    <Suspense fallback={
                      <div style={{ 
                        padding: 20, 
                        height: 'calc(100vh - 64px)', 
                        display: 'flex', 
                        justifyContent: 'center', 
                        alignItems: 'center' 
                      }}>
                        <Spin size="large" tip="Cargando aplicación..." fullscreen/>
                      </div>
                    }>
                      <RouteGuard>
                        {children}
                      </RouteGuard>
                    </Suspense>
                  </Content>
                </Layout>
              </Toaster>
            </AppStateProvider>
          </AuthProvider>
        </AntdRegistry>
      </body>
    </html>
  )
}

