/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@safe-pay/shared', '@safe-pay/providers'],
  experimental: {
    serverComponentsExternalPackages: ['@anthropic-ai/sdk'],
  },
};

module.exports = nextConfig;
