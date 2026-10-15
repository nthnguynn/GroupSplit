import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "pg"],
  // Portainer đặt app sau reverse proxy; để proxy nén response thay vì đốt CPU
  // trong từng Next.js worker. Reverse proxy phải bật gzip hoặc Brotli.
  compress: false,
};

export default nextConfig;
