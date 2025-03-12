import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    // Habilitar características experimentales que podrían mejorar la compatibilidad con Bun
    serverComponentsExternalPackages: [],
  },
};

export default nextConfig;
