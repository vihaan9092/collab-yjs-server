import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  root: '.', // Root is the client directory
  server: {
    port: 3001, // Different port from server to avoid conflicts
    proxy: {
      // Proxy API calls to the Express server
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      // Proxy WebSocket connections to the server
      '/ws': {
        target: 'ws://localhost:3000',
        ws: true,
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // Generate manifest for production
    manifest: true,
    rollupOptions: {
      input: {
        main: './index.html'
      }
    }
  }
})
