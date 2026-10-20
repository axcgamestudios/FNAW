import type { NextConfig } from "next";

/**
 * v14 — DUAL BUILD:
 *  - Sin env  → "standalone" (servidor del espacio de desarrollo/preview).
 *  - BUILD_MODE=pages → "export" estático para GitHub Pages:
 *      BUILD_MODE=pages NEXT_PUBLIC_BASE_PATH=/<repo> npm run build:pages
 *    (NEXT_PUBLIC_BASE_PATH también lo consumen las rutas de audio del juego)
 */
const isPages = process.env.BUILD_MODE === "pages";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || undefined;

const nextConfig: NextConfig = {
  output: isPages ? "export" : "standalone",
  basePath,
  assetPrefix: basePath,
  trailingSlash: isPages,
  images: { unoptimized: true },
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
