import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: process.env.GITHUB_PAGES === 'true' ? '/carlink-p2p-marketplace/' : '/',
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8787',
    },
  },
})
