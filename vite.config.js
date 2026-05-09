import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    // 1. Forcer l-port w l-host
    host: 'localhost',
    port: 5173,
    
    // 2. 9ad l-HMR (Hot Module Replacement)
    hmr: {
      protocol: 'ws',
      host: 'localhost',
    },
    
    // 3. Khdem b l-Polling ila kan WebSocket kayti7
    watch: {
      usePolling: true,
      interval: 1000 // y-verifier l-koud kolla 1 seconde
    }
  }
})
