/**
 * Where the site lives, for anything that needs an absolute URL: shared-link
 * cards, the sitemap. NEXT_PUBLIC_SITE_URL is the live domain once there is
 * one; on Vercel the production URL stands in, and on this machine it is the
 * dev server.
 */
export const SITE =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");
