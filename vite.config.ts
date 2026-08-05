import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Dev proxy: /api → local PSWM_API (run it with ASPNETCORE_URLS=http://localhost:5126).
// Production build should set VITE_API_BASE_URL instead.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5126',
        changeOrigin: true,
      },
    },
  },
})
