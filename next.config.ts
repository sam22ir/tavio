import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Workers has no image optimizer binding configured; screenshots are pre-sized PNGs.
  images: { unoptimized: true },
  // On-prem Docker build sets TAVIO_STANDALONE=1 to get a self-contained server.js. Off everywhere else.
  output: process.env.TAVIO_STANDALONE === '1' ? 'standalone' : undefined,
  // pg loads pg-cloudflare via the "workerd" export condition; Node tracing would only copy its empty stub.
  outputFileTracingIncludes: {
    '/*': ['./node_modules/.pnpm/pg-cloudflare@*/node_modules/pg-cloudflare/**/*'],
  },
  // Vendor-bill photos go through a server action as base64 (up to ~7 MB for a 5 MB photo); the default limit is 1 MB.
  experimental: { serverActions: { bodySizeLimit: '8mb' } },
  /* config options here */
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default withNextIntl(nextConfig);
