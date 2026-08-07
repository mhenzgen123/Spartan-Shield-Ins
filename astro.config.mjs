// @ts-check
import { fileURLToPath } from "node:url";
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";

// https://astro.build/config
// Cloudflare Pages and the production domain serve from the root, so these
// default to "/" and an empty base. A GitHub Pages PROJECT page serves from
// /<repo-name>/, so the deploy workflow sets these two env vars and every
// internal link picks the prefix up via the url() helper in src/data/site.ts.
const SITE = process.env.PUBLIC_SITE_URL || "https://spartanshieldins.com";
const BASE = process.env.PUBLIC_BASE_PATH || undefined;

export default defineConfig({
  site: SITE,
  base: BASE,
  output: "static",
  trailingSlash: "never",
  build: {
    // Emit /contact.html rather than /contact/index.html so Cloudflare Pages
    // serves clean URLs without a trailing-slash redirect.
    format: "file",
  },
  integrations: [
    react(),
    sitemap({
      // Spec 10: exclude the admin dashboard and the post-submission page.
      filter: (page) =>
        !page.includes("/careers/admin") && !page.includes("/thank-you"),
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      // The `@/*` alias is declared here rather than left to tsconfig-paths
      // resolution. Rolldown's tsconfig lookup walks up past this directory,
      // and while this project is nested inside another repo it would find
      // that repo's tsconfig and fail on its unresolvable `extends`. Declaring
      // the alias explicitly keeps the build self-contained.
      tsconfigPaths: false,
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
  },
});
