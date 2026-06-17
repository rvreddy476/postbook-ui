import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'http',  hostname: 'localhost' },
      { protocol: 'https', hostname: 'cleestudio.com' },
      { protocol: 'https', hostname: '*.cleestudio.com' },
    ],
  },
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
