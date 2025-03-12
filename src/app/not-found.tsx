"use client";

import React, { Suspense } from 'react';
import { Button, Result } from 'antd';
import Link from 'next/link';

// Componente de contenido separado para usar Suspense
function NotFoundContent() {
  return (
    <div style={{ 
      height: 'calc(100vh - 64px)',
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center'
    }}>
      <Result
        status="404"
        title="404"
        subTitle="Lo sentimos, la página que buscas no existe."
        extra={
          <Link href="/">
            <Button type="primary">Volver al inicio</Button>
          </Link>
        }
      />
    </div>
  );
}

// Página principal con suspense boundary
export default function NotFound() {
  return (
    <Suspense fallback={
      <div style={{ 
        height: 'calc(100vh - 64px)',
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center'
      }}>
        <Result
          status="404"
          title="404"
          subTitle="Lo sentimos, la página que buscas no existe."
        />
      </div>
    }>
      <NotFoundContent />
    </Suspense>
  );
} 