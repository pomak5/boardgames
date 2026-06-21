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
    // Dev: web на :5173, сервер на :3001 — проксируем через Vite, чтобы запросы
    // шли same-origin (нужно для HttpOnly-кук с SameSite=Lax). /api срезается до
    // корня сервера (роуты /auth/*, /leaderboard без /api). /socket.io — engine.io
    // (polling + ws) для всех неймспейсов; неймспейс идёт query-параметром nsp.
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ''),
      },
      '/socket.io': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        ws: true,
      },
    },
    fs: {
      // apps/web is a standalone package; allow Vite to serve the shared
      // engine from packages/shared at the monorepo root.
      allow: [repoRoot],
    },
  },
});
