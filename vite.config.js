import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'SISPROD BM',
        short_name: 'SISPROD',
        description: 'Sistema de Produtividade Operacional — Brigada Militar RS',
        theme_color: '#1e5631',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          {
            urlPattern: /^https:\/\/firestore\.googleapis\.com\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'firebase-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 5 },
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  build: {
    // Aumenta o limite do aviso para 1MB (evita o warning)
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // Divide o bundle em chunks menores por biblioteca
        manualChunks: {
          // React core
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          // UI components
          'ui-vendor': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-select',
            '@radix-ui/react-switch',
            '@radix-ui/react-label',
            '@radix-ui/react-badge',
            '@radix-ui/react-slot',
          ],
          // Firebase
          'firebase-vendor': ['firebase/app', 'firebase/firestore'],
          // Charts e visualização
          'charts-vendor': ['recharts'],
          // Utilitários de data
          'date-vendor': ['date-fns'],
          // Mapa (Leaflet é pesado)
          'map-vendor': ['leaflet', 'react-leaflet'],
          // Excel export
          'xlsx-vendor': ['xlsx'],
          // Animações
          'motion-vendor': ['framer-motion'],
          // Tanstack Query
          'query-vendor': ['@tanstack/react-query'],
        }
      }
    }
  }
})