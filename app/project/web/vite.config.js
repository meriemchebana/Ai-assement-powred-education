import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5180,
    strictPort: true,
    allowedHosts: ['.trycloudflare.com'],
    headers: {
      // Allow Google OAuth popups to post messages back to the opener window.
      // 'same-origin' (the default) blocks this and causes COOP console errors.
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/exam-forge': {
        target: 'http://127.0.0.1:28000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/exam-forge/, ''),
      },
    },
  },
})
