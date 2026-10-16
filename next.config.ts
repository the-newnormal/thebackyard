import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Pass links and the dashboard must never end up in search results. Crawlers
  // only see this if robots.txt lets them fetch the page, so /pass isn't disallowed.
  async headers() {
    return ["/pass/:path*", "/admin/:path*", "/admin"].map((source) => ({
      source,
      headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
    }));
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
