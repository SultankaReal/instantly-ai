import type { NextConfig } from 'next'

const config: NextConfig = {
  output: 'standalone',
  experimental: { typedRoutes: true },
  images: { remotePatterns: [] },
}

export default config
