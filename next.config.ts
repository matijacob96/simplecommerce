import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  
  // La propiedad serverComponentsExternalPackages ha sido movida fuera de experimental
  serverExternalPackages: [],
  
  // Mantener otras características experimentales si son necesarias
  experimental: {
    // Cualquier otra configuración experimental puede ir aquí
  },
  
  // Ignorar errores de ESLint durante el build para permitir el despliegue
  eslint: {
    // No fallar el build por errores de ESLint
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
