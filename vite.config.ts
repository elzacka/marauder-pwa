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
        lang: 'no',
        theme_color: '#1A0A00',
        // Matches the map's rendered parchment tone (see html/body background in
        // main.css) so iOS 26's reserved bottom zone blends into the map.
        background_color: '#E3DCCD',
        display: 'standalone',
        start_url: '/marauder-pwa/',
        orientation: 'portrait-primary',
        // Relative paths: vite-plugin-pwa does not rewrite absolute icon paths
        // with the `base` prefix, so '/assets/...' 404s on GitHub Pages.
        // Separate entries per purpose: combined 'any maskable' renders zoomed
        // icons on some launchers.
        icons: [
          {
            src: 'assets/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'assets/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: 'assets/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'assets/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
})
