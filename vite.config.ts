import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [
      vue(),
      VitePWA({
        registerType: 'prompt',
        devOptions: {
          enabled: env.VITE_PWA_DEV === 'true',
        },
        includeAssets: [
          'favicon.ico',
          'apple-touch-icon-180x180.png',
          'pwa-icon.svg',
          'layers.css',
        ],
        manifest: {
          name: 'Mihon Vue',
          short_name: 'Mihon',
          description: 'Material Design 3 Web & Desktop Client for Suwayomi-Server',
          display: 'standalone',
          orientation: 'any',
          background_color: '#121316',
          theme_color: '#121316',
          icons: [
            {
              src: 'pwa-64x64.png',
              sizes: '64x64',
              type: 'image/png',
            },
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: 'maskable-icon-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,json}'],
          navigateFallback: 'index.html',
          navigateFallbackDenylist: [/^\/api\//],
          runtimeCaching: [
            {
              urlPattern: /\/api\/v1\/(?:manga\/.*\/thumbnail|extension\/icon\/.*)/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'suwayomi-images-cache',
                expiration: {
                  maxEntries: 1500,
                  maxAgeSeconds: 60 * 60 * 24 * 14,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /\/api\/(?:graphql|v1\/(?:update|download|category|manga|source).*)/i,
              handler: 'NetworkOnly',
            },
          ],
        },
      }),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    optimizeDeps: {
      include: [
        'vuetify',
        'vuetify/components',
        'vuetify/components/VOverlay',
        'vuetify/components/VDialog',
        'vuetify/components/VBottomSheet',
        'vuetify/components/VMenu',
        'vuetify/components/VSelect',
      ],
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/vuetify')) return 'vuetify'
            if (id.includes('node_modules')) return 'vendor'
          },
        },
      },
    },
    server: {
      proxy: {
        '/api': {
          target: env.SUWAYOMI_PROXY_TARGET || 'http://localhost:4567',
          changeOrigin: true,
        },
      },
      watch: {
        ignored: ['**/.pw-tmp/**', '**/.tmp*/**', '**/playwright*/**', '**/test-results/**', '**/node-compile-cache/**'],
      },
    },
  }
})
