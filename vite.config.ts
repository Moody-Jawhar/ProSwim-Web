import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Dev proxy: /api → local PSWM_API (run it with ASPNETCORE_URLS=http://localhost:5126).
// Production build should set VITE_API_BASE_URL instead (see .env.production).
//
// `base` only applies to builds: production is served from the V27_WEB IIS
// application, so assets must emit as /V27_WEB/assets/... while `npm run dev`
// keeps serving from the root. Override with VITE_BASE_PATH for another path.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? (process.env.VITE_BASE_PATH || '/V27_WEB/') : '/',
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5126',
        changeOrigin: true,
      },
    },
  },
}))
