import path from "node:path";
import type { NextConfig } from "next";
import createMDX from "@next/mdx";
import {
  LEGACY_WRITE_UP_REDIRECTS,
  PROJECT_ROUTES,
} from "./app/components/projects/project-routes";
import {
  CANVAS_IMAGE_DEVICE_SIZES,
  CANVAS_IMAGE_SIZES,
} from "./lib/image-optimization";

function supabaseImageRemotePattern() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!supabaseUrl) {
    return [];
  }

  const hostname = new URL(supabaseUrl).hostname;

  return [
    {
      protocol: "https" as const,
      hostname,
      pathname: "/storage/v1/object/public/**",
    },
    {
      protocol: "https" as const,
      hostname,
      pathname: "/storage/v1/render/image/public/**",
    },
  ];
}

const supabasePatterns = supabaseImageRemotePattern();

const nextConfig: NextConfig = {
  pageExtensions: ["js", "jsx", "ts", "tsx", "mdx"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value:
              "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
          },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
    ];
  },
  async redirects() {
    return [
      ...LEGACY_WRITE_UP_REDIRECTS.map(([source, destination]) => ({
        source,
        destination,
        permanent: true,
      })),
      {
        source: PROJECT_ROUTES.writeUps,
        destination: PROJECT_ROUTES.portfolioWriteUps,
        permanent: true,
      },
      {
        source: "/projects/spotify-nodify/:path*",
        destination: "/portfolio#projects",
        permanent: true,
      },
      {
        source: "/components/projects/spotify-nodify/:path*",
        destination: "/portfolio#projects",
        permanent: true,
      },
      {
        source: "/admin/photo-graph",
        destination: "/admin",
        permanent: true,
      },
      {
        source: "/admin/photo-graph/login",
        destination: "/admin",
        permanent: true,
      },
      {
        source: "/admin/photo-graph/upload",
        destination: "/admin",
        permanent: true,
      },
      {
        source: "/go/grailed-plus",
        destination: "/grailed-plus",
        permanent: true,
      },
      {
        source: "/projects/grailed-plus/experience",
        destination: "/grailed-plus/experience",
        permanent: true,
      },
    ];
  },
  images: {
    deviceSizes: CANVAS_IMAGE_DEVICE_SIZES,
    imageSizes: CANVAS_IMAGE_SIZES,
    formats: ["image/avif", "image/webp"],
    qualities: [72, 75],
    remotePatterns: [
      ...supabasePatterns,
      {
        protocol: "https",
        hostname: "i.scdn.co",
        pathname: "/image/**",
      },
    ],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 1 month (30 days)
  },
};

const withMDX = createMDX({
  options: {
    remarkPlugins: [
      "remark-math",
      path.resolve("lib/mdx/remark-write-up-contents.mjs"),
      path.resolve("lib/mdx/remark-write-up-body.mjs"),
    ],
    rehypePlugins: ["rehype-katex"],
  },
});

export default withMDX(nextConfig);
