import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";


const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  base: process.env.GITHUB_PAGES ? '/factory-planner/' : '/',
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@canvas": path.resolve(__dirname, "./src/canvas"),
      "@factory": path.resolve(__dirname, "./src/factory"),
      "@solver": path.resolve(__dirname, "./src/solver"),
      "@gamedata": path.resolve(__dirname, "./src/gamedata"),
    },
  },
  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
        protocol: "ws",
        host,
        port: 1421,
      }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/tests/setup.ts',
    css: true,
    exclude: ['old_src/**', 'node_modules/**', 'dist/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.d.ts', 'src/tests/**', '**/__tests__/**'],
      thresholds: {
        lines: 55,
        functions: 55,
        statements: 55,
        branches: 50,
      },
    },
  },
}));
