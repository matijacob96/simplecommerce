import React, { Suspense } from 'react';
import { notFound } from 'next/navigation';

export default function CatchAllNotFound() {
  // Esta función le dice a Next.js que muestre la página not-found
  notFound();

  // Esto nunca se renderiza realmente pero se necesita para la compilación
  return (
    <Suspense fallback={<div>Cargando...</div>}>
      <div />
    </Suspense>
  );
}
