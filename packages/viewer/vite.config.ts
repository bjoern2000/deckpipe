import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      '/v1': {
        target: 'http://localhost:3010',
        changeOrigin: true,
      },
      '/admin': {
        target: 'http://localhost:3010',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
  },
});
