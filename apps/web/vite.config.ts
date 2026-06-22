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
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
        rewrite: p => p.replace(/^\/api/, ""),
      },
      "/socket.io": {
        target: "http://localhost:3001",
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
  preview: {
    // CSP для `bun run preview` (прод-статика локально). В dev (vite server) CSP
    // не ставим — Vite HMR юзает inline eval и 'unsafe-inline' для скриптов,
    // что выхолащивает заголовок. В проде CSP ставит nginx (см. docs/deploy.md).
    // Шрифты — Google Fonts (css с gstatic.com, файлы с gstatic.com).
    // img: data: (fallback аватары) + https (object storage MinIO/S3 по PUBLIC_BASE).
    // connect: 'self' — socket.io ходит same-origin через nginx proxy.
    headers: {
      "Content-Security-Policy": [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: https:",
        "connect-src 'self'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        "object-src 'none'",
      ].join("; "),
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    },
  },
});
