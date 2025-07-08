import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  root: '.', // Root is the client directory
  server: {
    host: '0.0.0.0', // Allow external connections (required for Docker)
    port: 3001, // Different port from server to avoid conflicts
    watch: {
      usePolling: true, // Enable polling for Docker file watching
    },
    proxy: {
      // Proxy API calls to the Express server
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:3000',
        changeOrigin: true
      },
      // Proxy WebSocket connections to the server
      '/ws': {
        target: process.env.VITE_WS_URL || 'ws://localhost:3000',
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
