/** @type {import('next').NextConfig} */
const nextConfig = {
  // Chromium + puppeteer-core no deben empaquetarse con el bundler de Next.
  serverExternalPackages: ['@sparticuz/chromium', 'puppeteer-core'],
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  outputFileTracingIncludes: {
    '/blog/[slug]': ['./src/content/blog/**/*'],
    '/blog': ['./src/content/blog/**/*'],
    // Incluir binarios Brotli de Chromium en el trace de funciones server.
    '/**': ['./node_modules/@sparticuz/chromium/**'],
  },
};

export default nextConfig;
