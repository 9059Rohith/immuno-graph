import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '127.0.0.1',
    proxy: {
      '/api': process.env.VITE_DEV_API_TARGET ?? 'http://127.0.0.1:3000',
    },
  },
  preview: {
    proxy: {
      '/api': process.env.VITE_DEV_API_TARGET ?? 'http://127.0.0.1:3000',
    },
  },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'charts', test: /node_modules[\\/]recharts/ },
            { name: 'graphs', test: /node_modules[\\/]@xyflow/ },
            {
              name: 'react',
              test: /node_modules[\\/](@tanstack[\\/]react-query|react|react-dom|react-router)/,
            },
          ],
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
