import type { NextConfig } from "next";

const cspHeader = `
    default-src 'self';
    script-src 'self' 'unsafe-eval' 'unsafe-inline' https://connect.facebook.net;
    style-src 'self' 'unsafe-inline';
    img-src 'self' blob: data: https://*.fbcdn.net https://*.facebook.com;
    font-src 'self';
    connect-src 'self' ws: wss:;
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
`;

const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  // Proxy API calls through the frontend origin: avoids CORS and satisfies
  // the CSP connect-src 'self' policy. BACKEND_URL overrides in production.
  async rewrites() {
    return [
      {
        source: '/api/backend/:path*',
        destination: `${process.env.BACKEND_URL || 'http://backend:3001'}/:path*`,
      },
      {
        source: '/webhooks',
        destination: `${process.env.BACKEND_URL || 'http://backend:3001'}/webhooks`,
      },
      {
        source: '/webhooks/:path*',
        destination: `${process.env.BACKEND_URL || 'http://backend:3001'}/webhooks/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: cspHeader.replace(/\s{2,}/g, ' ').trim(),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
