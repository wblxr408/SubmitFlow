const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // standalone 模式用于 Docker 生产部署，本地开发不需要
  output: process.env.DOCKER_BUILD === '1' ? 'standalone' : undefined,
  experimental: {
    typedRoutes: true,
  },
  env: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3208',
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
};

export default nextConfig;
