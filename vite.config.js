import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// import viteCompression from 'vite-plugin-compression'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    /*
    viteCompression({
      algorithm: 'gzip',
      ext: '.gz',
      threshold: 10240, // May-compressich les fichiers sghar mn 10KB
    }),
    viteCompression({
      algorithm: 'brotliCompress',
      ext: '.br',
      threshold: 10240,
    })
    */
  ],
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
  },
  build: {
    target: 'esnext',
    minify: 'esbuild',
    cssMinify: true,
    /*
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('firebase')) {
              return 'vendor-firebase';
            }
            if (id.includes('react') || id.includes('react-dom')) {
              return 'vendor-react';
            }
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }
            // Vite ghadi ytkelef b t9ssim l-ba9i oumatiqument bach l'Lazy loading ykhdem mzyan
          }
        }
      }
    }
    */
  }
})

