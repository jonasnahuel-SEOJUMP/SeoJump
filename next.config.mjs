/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  outputFileTracingIncludes: {
    '/blog/[slug]': ['./src/content/blog/**/*'],
    '/blog': ['./src/content/blog/**/*'],
  },
};

export default nextConfig;
