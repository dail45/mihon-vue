<script setup lang="ts">
import MangaBadges from '@/features/manga/components/MangaBadges.vue'
import type { Manga } from '@/core/api/types'

/**
 * Pixel-parity implementation of Mihon's `InLibraryBadge`:
 * `mihon/app/src/main/java/eu/kanade/presentation/browse/components/BrowseBadges.kt`
 *
 * @Composable
 * internal fun InLibraryBadge(enabled: Boolean) {
 *     if (enabled) {
 *         Badge(
 *             imageVector = MaterialSymbols.Rounded.CollectionsBookmark,
 *         )
 *     }
 * }
 */
defineProps<{
  enabled?: boolean
  manga?: Manga
}>()
</script>

<template>
  <MangaBadges :enabled="enabled" :manga="manga" catalogue side="start" />
</template>
