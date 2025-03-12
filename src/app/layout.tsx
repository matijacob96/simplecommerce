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
            <Toaster>
              <Layout>
                <CustomHeader />
                <Content>
                  <Suspense fallback={<div style={{ padding: 20, display: 'flex', justifyContent: 'center' }}><Spin size="large" /></div>}>
                    <RouteGuard>
                      {children}
                    </RouteGuard>
                  </Suspense>
                </Content>
              </Layout>
            </Toaster>
          </AuthProvider>
        </AntdRegistry>
      </body>
    </html>
  )
}

