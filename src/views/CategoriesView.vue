<script setup lang="ts">
/**
 * Categories screen — "Edit categories".
 *
 * Implements the Container/Panel pattern:
 * Serves as the routed page scaffold with the top app bar and wraps `CategoryManagerPanel.vue`.
 */
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import CategoryManagerPanel from '../components/category/CategoryManagerPanel.vue'

const router = useRouter()

const props = withDefaults(defineProps<{
  embedded?: boolean
}>(), {
  embedded: false,
})

const isScrolled = ref(false)
const panelRef = ref<InstanceType<typeof CategoryManagerPanel> | null>(null)

function onWindowScroll() {
  isScrolled.value = window.scrollY > 0
}

onMounted(() => {
  window.addEventListener('scroll', onWindowScroll, { passive: true })
  onWindowScroll()
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', onWindowScroll)
})

function goBack() {
  if (typeof window.history.state?.back === 'string') router.back()
  else void router.push('/more')
}

defineExpose({
  loadCategories: () => panelRef.value?.loadCategories(),
})
</script>

<template>
  <div class="categories-screen">
    <header v-if="!embedded" class="categories-screen__toolbar" :class="{ 'is-scrolled': isScrolled }">
      <button
        type="button"
        class="categories-screen__nav"
        icon="arrow_back"
        aria-label="Back"
        title="Navigate up"
        @click="goBack"
      >
        <span class="material-symbols-rounded categories-screen__nav-icon" aria-hidden="true">arrow_back</span>
      </button>
      <h1 class="categories-screen__title">Edit categories</h1>
    </header>

    <CategoryManagerPanel ref="panelRef" />
  </div>
</template>

<style scoped>
@layer app-components {
.categories-screen {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  background: rgb(var(--v-theme-surface));
}

.categories-screen__toolbar {
  height: 64px;
  min-height: 64px;
  display: flex;
  align-items: center;
  padding: 0 4px;
  position: sticky;
  top: 0;
  z-index: 2;
  background: rgb(var(--v-theme-surface));
  transition: background-color 0.2s ease, box-shadow 0.2s ease;
}

.categories-screen__toolbar.is-scrolled {
  background: rgb(var(--v-theme-surface-container));
}

.categories-screen__nav {
  width: 48px;
  height: 48px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: rgb(var(--v-theme-on-surface));
  border-radius: 50%;
  cursor: pointer;
}

.categories-screen__nav:hover {
  background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 8%, transparent);
}

.categories-screen__nav-icon {
  font-size: 24px;
  line-height: 24px;
}

.categories-screen__title {
  margin: 0;
  padding: 0 4px;
  font-size: 22px;
  line-height: 28px;
  font-weight: 400;
  color: rgb(var(--v-theme-on-surface));
}
}
</style>
