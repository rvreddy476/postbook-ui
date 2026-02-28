import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/v1/:path*',
        destination: '/api/proxy/:path*',
      },
    ];
  },
};

export default nextConfig;
