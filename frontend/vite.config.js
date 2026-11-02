import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// React talks to FastAPI through Vite during local development.
// This avoids a browser CORS mismatch between ports 5173 and 8000.
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
});
