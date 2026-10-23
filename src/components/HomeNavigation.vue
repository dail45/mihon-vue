<script setup lang="ts">
/**
 * Mihon navigation suite (HomeScreen.kt).
 *
 * Reference: mihon/app/src/main/java/eu/kanade/tachiyomi/ui/home/HomeScreen.kt
 *   - `NavigationSuiteScaffold` with `NavigationSuiteType.NavigationBar` (phone) or
 *     `NavigationSuiteType.NavigationRail` (tablet).
 *   - `NavigationSuiteDefaults.colors(navigationRailContainerColor = surfaceColorAtElevation(3.dp))`
 *     -> the rail container is `surface-container-high`.
 *   - `navigationItemVerticalArrangement = Arrangement.Center` -> the rail items are centred.
 *   - Item order: LibraryTab, UpdatesTab, HistoryTab, BrowseTab, MoreTab (index 0u..4u).
 *   - Label style is overridden to `MaterialTheme.typography.labelLarge` (14sp/20sp, Medium)
 *     with `maxLines = 1` and `TextOverflow.Ellipsis`.
 *   - Icons are the animated vector drawables of every tab; the web build uses the matching
 *     Material Symbols glyphs, filled while the tab is selected.
 *   - `onClick`: selecting a different tab switches it, clicking the current tab calls
 *     `tab.onReselect(navigator)`:
 *       Library -> open the library settings sheet
 *       Updates -> DownloadQueueScreen
 *       History -> resume the last chapter read
 *       Browse  -> GlobalSearchScreen
 *       More    -> SettingsScreen
 *   - Badge: Updates shows the new chapter count, Browse shows the extension update count.
 *     Suwayomi exposes no extension update counter, so only the Updates badge is rendered;
 *     it uses the unread chapter count of the library as the closest available number.
 */
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSuwayomiStore } from '../stores/suwayomi'

const props = defineProps<{ variant: 'bar' | 'rail' }>()

const route = useRoute()
const router = useRouter()
const server = useSuwayomiStore()

const items = [
  { title: 'Library', icon: 'collections_bookmark', path: '/library', reselect: 'library' },
  { title: 'Updates', icon: 'update', path: '/updates', reselect: 'updates' },
  { title: 'History', icon: 'history', path: '/history', reselect: 'history' },
  { title: 'Browse', icon: 'explore', path: '/browse', reselect: 'browse' },
  { title: 'More', icon: 'more_horiz', path: '/more', reselect: 'more' },
] as const

function isActive(path: string) {
  if (path === '/library') return route.path.startsWith('/library') || route.path.startsWith('/manga/')
  return route.path === path || route.path.startsWith(`${path}/`)
}

/** `Badge` in HomeScreen.kt: MD3 error container, labelSmall text, 16dp round shape. */
const updatesBadge = computed(() => {
  const seen = new Set<number>()
  let total = 0
  for (const manga of Object.values(server.libraryByCategory).flat()) {
    if (seen.has(manga.id)) continue
    seen.add(manga.id)
    total += manga.unreadCount ?? 0
  }
  return total
})

function badgeFor(path: string) {
  if (path === '/updates') return updatesBadge.value
  // The extension update counter of the Browse tab has no Suwayomi counterpart.
  return 0
}

const snackbar = ref<string | null>(null)
let snackbarTimer: ReturnType<typeof setTimeout> | undefined
function notify(message: string) {
  snackbar.value = message
  if (snackbarTimer) clearTimeout(snackbarTimer)
  snackbarTimer = setTimeout(() => { snackbar.value = null }, 4000)
}

/** True when the router really knows the path (the catch-all route does not count). */
function routeExists(path: string) {
  const resolved = router.resolve(path)
  return resolved.matched.some(record => record.path === path)
}

async function onReselect(kind: string) {
  switch (kind) {
    case 'library':
      // LibraryTab.onReselect -> requestOpenSettingsSheetEvent -> library settings sheet.
      window.dispatchEvent(new CustomEvent('mihon:open-library-settings'))
      if (!isActive('/library')) await router.push('/library')
      break
    case 'updates':
      // UpdatesTab.onReselect -> DownloadQueueScreen.
      if (routeExists('/downloads')) await router.push('/downloads')
      else notify('The download queue is not available in the web version yet.')
      break
    case 'history':
      // HistoryTab.onReselect -> resumeLastChapterReadEvent -> resume the last chapter.
      window.dispatchEvent(new CustomEvent('mihon:resume-last-chapter'))
      if (!isActive('/history')) await router.push('/history')
      break
    case 'browse':
      // BrowseTab.onReselect -> GlobalSearchScreen.
      if (routeExists('/search')) await router.push('/search')
      else notify('Global search is not available in the web version yet.')
      break
    case 'more':
      // MoreTab.onReselect -> SettingsScreen.
      if (routeExists('/settings')) await router.push('/settings')
      else notify('Settings are not available in the web version yet.')
      break
  }
}

function onSelect(path: string, kind: string) {
  if (isActive(path)) {
    void onReselect(kind)
    return
  }
  void router.push(path)
}
</script>

<template>
  <nav :class="props.variant === 'rail' ? 'home-rail' : 'home-bar'" aria-label="Main navigation">
    <ul class="home-nav-list">
      <li v-for="item in items" :key="item.path" class="home-nav-item">
        <a
          :href="item.path"
          class="home-nav-link"
          :class="{ 'is-active': isActive(item.path) }"
          :aria-current="isActive(item.path) ? 'page' : undefined"
          :aria-label="item.title"
          @click.prevent="onSelect(item.path, item.reselect)"
        >
          <span class="home-nav-indicator">
            <v-icon :icon="item.icon" size="24" />
            <span
              v-if="badgeFor(item.path) > 0"
              class="home-nav-badge"
              role="status"
              :aria-label="`${badgeFor(item.path)} new chapters`"
            >{{ badgeFor(item.path) }}</span>
          </span>
          <span class="home-nav-label">{{ item.title }}</span>
        </a>
      </li>
    </ul>
  </nav>
  <v-snackbar :model-value="snackbar !== null" timeout="-1" location="bottom" @update:model-value="value => { if (!value) snackbar = null }">{{ snackbar }}</v-snackbar>
</template>

<style scoped>
/* NavigationSuiteScaffold -> NavigationBar: 80dp tall, `surface-container` background. */
.home-bar {
  width: 100%;
  background: rgb(var(--v-theme-surface-container));
  box-shadow: none;
  padding-bottom: env(safe-area-inset-bottom);
}
.home-bar .home-nav-list {
  display: flex;
  align-items: center;
  margin: 0;
  padding: 0;
  list-style: none;
  height: 80px;
}
.home-bar .home-nav-item { flex: 1 1 0; min-width: 0; }

/* NavigationSuiteScaffold -> NavigationRail: 80dp wide, surfaceColorAtElevation(3.dp). */
.home-rail {
  width: 80px;
  background: rgb(var(--v-theme-surface-container-high));
  box-shadow: none;
}
.home-rail .home-nav-list {
  display: flex;
  flex-direction: column;
  align-items: center;
  /* `navigationItemVerticalArrangement = Arrangement.Center` */
  justify-content: center;
  height: 100%;
  margin: 0;
  padding: 0;
  list-style: none;
}

.home-nav-link {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: 4px;
  padding: 8px 0 12px;
  color: rgb(var(--v-theme-on-surface-variant));
  text-decoration: none;
}
.home-rail .home-nav-link { padding: 6px 0; }
.home-nav-link:hover { color: rgb(var(--v-theme-on-surface)); }

/* MD3 active indicator: 64x32dp pill in the navigation bar, 56x32dp in the rail. */
.home-nav-indicator {
  position: relative;
  display: grid;
  place-items: center;
  width: 64px;
  height: 32px;
  border-radius: 16px;
  color: inherit;
}
.home-rail .home-nav-indicator { width: 56px; }
.home-nav-link.is-active { color: rgb(var(--v-theme-on-secondary-container)); }
.home-nav-link.is-active .home-nav-indicator { background: rgb(var(--v-theme-secondary-container)); }

/* `MaterialTheme.typography.labelLarge` (14sp/20sp, Medium), maxLines = 1, ellipsis. */
.home-nav-label {
  max-width: 100%;
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  letter-spacing: 0.1px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: center;
}

/* MD3 `Badge`: 16dp, error container, onError text. */
.home-nav-badge {
  position: absolute;
  top: -4px;
  right: 8px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 8px;
  background: rgb(var(--v-theme-error));
  color: rgb(var(--v-theme-on-error));
  font-size: 11px;
  line-height: 16px;
  font-weight: 500;
  letter-spacing: 0.5px;
  text-align: center;
}
</style>
