import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return { plugins: [vue()], optimizeDeps: { include: ['vuetify', 'vuetify/components', 'vuetify/components/VOverlay', 'vuetify/components/VDialog', 'vuetify/components/VBottomSheet', 'vuetify/components/VMenu', 'vuetify/components/VSelect'] }, server: { proxy: { '/api': { target: env.SUWAYOMI_PROXY_TARGET || 'http://localhost:4567', changeOrigin: true } } } }
})
