/**
 * Server build (Vercel): pages are static and read public/data; /api/assistant runs as a serverless function.
 * The original fully offline demo is web/index.html.
 */
const nextConfig = {
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
};
export default nextConfig;
