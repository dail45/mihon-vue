import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [vue()],
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
