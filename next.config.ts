import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * The whole calculator runs in the browser — no API routes, no database, no
   * environment variables — so it is exported as plain static files at build time.
   * `pnpm build` writes `out/`, which can be dropped on any host (Vercel, Netlify,
   * Cloudflare Pages, GitHub Pages, S3, a plain nginx box) with no Node runtime.
   *
   * To go back to a server-rendered build, delete this line: `pnpm build` will then
   * emit `.next/` and `pnpm start` will serve it.
   */
  output: "export",
  /**
   * Next's image optimiser needs a server. Nothing here uses next/image, but
   * leaving this on would break the build the moment something did.
   */
  images: { unoptimized: true },
  /**
   * `cacheComponents` and `partialPrefetching` are switched on by the create-next-app
   * template for server-rendered apps. Neither has anything to do here — there is no
   * server cache to manage and only one page to prefetch — and Next refuses to build
   * at all with them alongside `output: "export"`. See the PPR/export invariant.
   */
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
