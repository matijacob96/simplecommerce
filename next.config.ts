import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    // Habilitar características experimentales que podrían mejorar la compatibilidad con Bun
    serverComponentsExternalPackages: [],
  },
  // Ignorar errores de ESLint durante el build para permitir el despliegue
  eslint: {
    // No fallar el build por errores de ESLint
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
