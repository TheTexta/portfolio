import type { NextConfig } from "next";
import { CANVAS_IMAGE_DEVICE_SIZES, CANVAS_IMAGE_SIZES } from "./lib/image-optimization";

const nextConfig: NextConfig = {
  images: {
    deviceSizes: CANVAS_IMAGE_DEVICE_SIZES,
    imageSizes: CANVAS_IMAGE_SIZES,
    qualities: [72, 75],
    localPatterns: [
      {
        pathname: "/components/projects/nepobabiesruntheunderground/preview/assets/images/**",
      },
    ],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
        pathname: "/v0/b/portfolio-site-firebase-41fab.firebasestorage.app/o/**",
      },
      {
        protocol: "https",
        hostname: "storage.googleapis.com",
        pathname: "/portfolio-site-firebase-41fab.firebasestorage.app/**",
      },
      {
        protocol: "https",
        hostname: "i.scdn.co",
        pathname: "/image/**",
      },
    ],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 1 month (30 days)
  },
};

export default nextConfig;
