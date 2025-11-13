import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Disable automatic trailing slash redirects to prevent issues with API routes
  // This ensures POST requests work correctly without requiring trailing slashes
  trailingSlash: false,
  
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'tr.rbxcdn.com',
      },
      {
        protocol: 'https',
        hostname: '**.rbxcdn.com',
      },
    ],
    localPatterns: [
      {
        pathname: '/api/**',
      },
    ],
  },
}

export default nextConfig