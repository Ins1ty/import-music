import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compress: true,
  swcMinify: true,
  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion'],
  },
  images: {
    formats: ['image/avif', 'image/webp'],
  },
};

export default nextConfig;
