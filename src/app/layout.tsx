import { AntdRegistry } from '@ant-design/nextjs-registry';
import '@ant-design/v5-patch-for-react-19';
import { Toaster } from "./components/ui/toaster";
import React, { Suspense } from "react";
import './globals.css';
import 'antd/dist/reset.css';
import { CustomHeader } from './components/CustomHeader';
import { Layout, Spin } from 'antd';
import { Content } from 'antd/es/layout/layout';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning={true}>
        <AntdRegistry>
          <Toaster>
            <Layout>
              <CustomHeader />
              <Content>
                <Suspense fallback={<div style={{ padding: 20, display: 'flex', justifyContent: 'center' }}><Spin size="large" /></div>}>
                  {children}
                </Suspense>
              </Content>
            </Layout>
          </Toaster>
        </AntdRegistry>
      </body>
    </html>
  )
}

