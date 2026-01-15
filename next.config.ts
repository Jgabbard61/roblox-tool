import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Disable automatic trailing slash redirects to prevent issues with API routes
  // This ensures POST requests work correctly without requiring trailing slashes
  trailingSlash: false,

  // Generate new build ID on each build to bust browser cache
  // This prevents users from getting old JavaScript bundles with outdated code
  generateBuildId: async () => {
    return `build-${Date.now()}`
  },

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