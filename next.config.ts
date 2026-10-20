import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sistema local: toda página lê o banco na hora (sem cache de componentes).
  // Permite abrir o servidor de desenvolvimento pelo celular na rede local.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*", "*.local"],
  serverExternalPackages: ["better-sqlite3", "exceljs"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
