import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  base: '/gym-tracker/',
  plugins: [
    react(),
    VitePWA({
      // 'prompt' statt 'autoUpdate': iOS erkennt eine neue Version manchmal nicht
      // zuverlässig von selbst. Die App registriert den Service Worker deshalb selbst
      // (injectRegister: false) und zeigt einen Button zum manuellen Aktualisieren an,
      // der auch jederzeit einen frischen Check erzwingen kann.
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Gym Tracker',
        short_name: 'Gym Tracker',
        description: 'Trainingspläne und Fortschritt tracken – komplett offline',
        theme_color: '#1c1b19',
        background_color: '#1c1b19',
        display: 'standalone',
        start_url: '/gym-tracker/',
        scope: '/gym-tracker/',
        icons: [
          {
            src: 'icon-192-v2.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icon-512-v2.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        // Fester Cache-Namens-Präfix, damit der "App aktualisieren"-Button (siehe
        // src/lib/pwaUpdate.tsx) beim Aufräumen zuverlässig NUR die eigenen Caches trifft
        // und nicht die einer anderen App auf derselben Domain (marschummers.github.io).
        cacheId: 'gym-tracker',
      },
    }),
  ],
})
