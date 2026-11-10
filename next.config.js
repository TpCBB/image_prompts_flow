/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: __dirname,
  images: {
    // Cards use original R2 URLs; do not expose an unused image-resizing endpoint.
    unoptimized: true,
    // 配置远程图片域名
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
      {
        protocol: 'https',
        hostname: '*.r2.dev',
      },
    ],
  },
}

module.exports = nextConfig
