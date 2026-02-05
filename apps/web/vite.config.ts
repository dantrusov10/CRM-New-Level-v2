import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Dev note:
// PocketBase doesn't expose CORS settings in the Admin UI.
// To avoid CORS issues in local dev we proxy API requests via Vite.
// Use VITE_PB_URL=/api (default) and Vite will forward to PocketBase.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8090',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
