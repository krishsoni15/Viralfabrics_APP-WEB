import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  // Experimental features for better performance
  experimental: {
    optimizePackageImports: ['lucide-react', '@heroicons/react'],
    serverActions: {
      allowedOrigins: process.env.NODE_ENV === 'production'
        ? [process.env.NEXT_PUBLIC_APP_URL || ''].filter(Boolean)
        : ['localhost:3000'],
      bodySizeLimit: '10mb', // Increased to 10MB for image uploads
    },
    optimizeCss: true,
  },

  // External packages that should not be bundled
  serverExternalPackages: ['mongoose', '@aws-sdk/client-s3'],

  // Reduce logging output
  logging: {
    fetches: {
      fullUrl: false,
    },
  },

  // Memory management
  onDemandEntries: {
    maxInactiveAge: process.env.NODE_ENV === 'development' ? 5 * 1000 : 25 * 1000,
    pagesBufferLength: 2,
  },

  // Build validation
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Image optimization
  images: {
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
  },

  // Compiler optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' 
      ? { exclude: ['error', 'warn'] }
      : false,
  },

  // Security headers
  async headers() {
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { 
            key: 'Permissions-Policy', 
            value: 'camera=(self), microphone=(self), geolocation=(), interest-cohort=()' 
          },
          ...(process.env.NODE_ENV === 'production' ? [{
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload'
          }] : []),
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https: blob:",
              "font-src 'self' data:",
              "connect-src 'self' https://*.mongodb.com https://*.amazonaws.com https://*.upstash.io",
              "frame-src 'self' data: blob:",
              "object-src 'self' data: blob:",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; ')
          },
        ],
      },
      {
        source: '/:path*.html',
        headers: [{
          key: 'Cache-Control',
          value: 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
        }],
      },
      {
        source: '/',
        headers: [{
          key: 'Cache-Control',
          value: 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
        }],
      },
      {
        source: '/_next/static/:path*',
        headers: [{
          key: 'Cache-Control',
          value: isDevelopment
            ? 'no-store, no-cache, must-revalidate'
            : 'public, max-age=31536000, immutable',
        }],
      },
      {
        source: '/:path*\\.(jpg|jpeg|png|gif|webp|svg|ico|avif)',
        headers: [{
          key: 'Cache-Control',
          value: isDevelopment
            ? 'no-store, no-cache, must-revalidate'
            : 'public, max-age=86400, must-revalidate',
        }],
      },
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
          },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
    ];
  },

  // Webpack optimizations
  webpack: (config, { dev, isServer }) => {
    if (!dev && !isServer) {
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
          },
        },
      };
    }
    return config;
  },

  // Production optimizations
  ...(process.env.NODE_ENV === 'production' && {
    output: 'standalone',
    poweredByHeader: false,
    compress: true,
  }),

  // Environment variables
  env: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || '',
  },
};

export default nextConfig;
