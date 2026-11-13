import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // a second build next to the one being served: NEXT_DIST=.next-qa next build
  distDir: process.env.NEXT_DIST || ".next",
  // public/ has no hash in its file names, so a month rather than forever: the
  // default (max-age=0) made every return visit re-ask for each font and photo
  async headers() {
    const month = [{ key: "Cache-Control", value: "public, max-age=2592000, stale-while-revalidate=86400" }];
    return ["/fonts/:path*", "/home/:path*", "/cars/:path*", "/sfx/:path*"].map((source) => ({ source, headers: month }));
  },
};

export default nextConfig;
