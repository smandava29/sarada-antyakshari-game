import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { cloudflare } from '@cloudflare/vite-plugin';
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    ...(mode === "test"
      ? []
      : [cloudflare()]),
  ],
  build: {
    sourcemap: false,
  },
  server: {
    port: 5173,
  },
}));
