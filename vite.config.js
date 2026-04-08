import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const port = Number(process.env.PORT || 5500);
const host = process.env.HOST || "0.0.0.0";

export default defineConfig({
  plugins: [react()],
  server: {
    host,
    port,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8001',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api/, ''),
      },
    },
  },
  preview: {
    host,
    port,
    strictPort: true,
  },
});
