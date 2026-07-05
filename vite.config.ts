import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/marauder-pwa/',
  server: {
    port: 5173,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}', 'data/*.json'],
      },
      manifest: {
        name: 'Marauder',
        short_name: 'Marauder',
        description: 'Utforsk Harry Potter-universet i Storbritannia',
        theme_color: '#1A0A00',
        background_color: '#E8D5AA',
        display: 'standalone',
        start_url: '/marauder-pwa/',
        orientation: 'portrait-primary',
        icons: [
          {
            src: '/assets/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: '/assets/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
})
