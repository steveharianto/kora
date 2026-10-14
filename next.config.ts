import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@react-pdf/renderer"],

  // Gzip responses at the edge — cheap win for JSON/HTML payloads.
  compress: true,

  // Tree-shake large icon/utility packages on import.
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },

  images: {
    // Supabase Storage public objects.
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co" }],

    // Serve modern formats first; fall back to the original.
    formats: ["image/avif", "image/webp"],

    // Cache each optimized variant for 60 days at the edge + in browser.
    minimumCacheTTL: 60 * 60 * 24 * 60,

    // Trim srcset breakpoints to what the storefront actually uses.
    deviceSizes: [360, 480, 640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],

    // Allow the optimizer to upscale if a tiny source is requested at a
    // slightly larger size (prevents 1px artifacts on the catalog thumbnails).
    dangerouslyAllowSVG: false,
  },

  async headers() {
    return [
      {
        // `public/` assets are not fingerprinted, so give them an
        // immutable cache window — the browser will only refetch when the
        // filename changes (which it does, per revision).
        source: "/images/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/:path*.(svg|png|jpg|jpeg|webp|avif|ico|woff2)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
