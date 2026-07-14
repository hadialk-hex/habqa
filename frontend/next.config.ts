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
  // Socket.io polling requests the exact path "/socket.io/?…"; without this,
  // Next.js issues a 308 that strips the trailing slash and breaks the
  // handshake. Skipping the redirect lets the rewrite forward it untouched.
  skipTrailingSlashRedirect: true,
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  // Proxy API calls through the frontend origin: avoids CORS and satisfies
  // the CSP connect-src 'self' policy. BACKEND_URL overrides in production.
  async rewrites() {
    return [
      // Socket.io real-time transport, proxied on its own top-level path.
      // Client and server both use addTrailingSlash:false, so the client hits
      // exactly "/socket.io?…" — matched here and forwarded untouched.
      {
        source: '/socket.io',
        destination: `${process.env.BACKEND_URL || 'http://backend:3001'}/socket.io`,
      },
      {
        source: '/socket.io/:path*',
        destination: `${process.env.BACKEND_URL || 'http://backend:3001'}/socket.io/:path*`,
      },
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
      {
        source: '/channels/:path*',
        destination: `${process.env.BACKEND_URL || 'http://backend:3001'}/channels/:path*`,
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
