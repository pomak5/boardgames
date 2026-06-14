import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

const repoRoot = path.resolve(import.meta.dirname, "../..");

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@shared": path.resolve(repoRoot, "packages/shared/src"),
    },
  },
  server: {
    fs: {
      // apps/web is a standalone package; allow Vite to serve the shared
      // engine from packages/shared at the monorepo root.
      allow: [repoRoot],
    },
  },
});
