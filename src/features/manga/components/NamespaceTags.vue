<script setup lang="ts">
import { computed, ref } from 'vue'

export interface NamespaceDisplayTag {
  namespace: string
  text: string
  fullTag: string
}

export interface NamespaceGroup {
  namespace: string
  tags: NamespaceDisplayTag[]
}

const props = withDefaults(
  defineProps<{
    tags: string[]
    expanded?: boolean
  }>(),
  {
    expanded: false,
  },
)

const emit = defineEmits<{
  (event: 'search', tag: string): void
  (event: 'copy', tag: string): void
}>()

const snackbar = ref(false)
const snackbarText = ref('')

const KNOWN_NAMESPACES = new Set(['artist', 'character', 'group', 'parody', 'female', 'male'])

function getNamespaceClass(namespace: string): string {
  const norm = namespace.toLowerCase().trim()
  if (KNOWN_NAMESPACES.has(norm)) {
    return `namespace-tag--${norm}`
  }
  return 'namespace-tag--default'
}

const parsedTags = computed<NamespaceDisplayTag[]>(() => {
  return props.tags
    .map(raw => {
      const trimmed = raw.trim()
      if (!trimmed) return null
      const idx = trimmed.indexOf(':')
      if (idx > 0) {
        return {
          namespace: trimmed.substring(0, idx).trim().toLowerCase(),
          text: trimmed.substring(idx + 1).trim(),
          fullTag: trimmed,
        }
      }
      return {
        namespace: '',
        text: trimmed,
        fullTag: trimmed,
      }
    })
    .filter((t): t is NamespaceDisplayTag => t !== null)
})

const hasNamespaces = computed(() => {
  return parsedTags.value.some(t => Boolean(t.namespace))
})

const groupedTags = computed<NamespaceGroup[]>(() => {
  const map = new Map<string, NamespaceDisplayTag[]>()
  for (const item of parsedTags.value) {
    const key = item.namespace
    const list = map.get(key)
    if (list) {
      list.push(item)
    } else {
      map.set(key, [item])
    }
  }
  return Array.from(map.entries()).map(([namespace, tags]) => ({
    namespace,
    tags,
  }))
})

async function copyToClipboard(value: string) {
  const text = value.trim()
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    snackbarText.value = `Copied to clipboard: ${text}`
    snackbar.value = true
    emit('copy', text)
  } catch {
    /* clipboard fallback */
    emit('copy', text)
  }
}

function handleTagClick(tag: NamespaceDisplayTag) {
  emit('search', tag.fullTag)
}

function createTagPressHandler(tag: NamespaceDisplayTag) {
  let timer: number | null = null
  let didLongPress = false
  let startX = 0
  let startY = 0

  function onPointerDown(e: PointerEvent) {
    if (e.button !== 0) return
    didLongPress = false
    startX = e.clientX
    startY = e.clientY
    timer = window.setTimeout(() => {
      didLongPress = true
      void copyToClipboard(tag.fullTag)
    }, 500)
  }

  function onPointerMove(e: PointerEvent) {
    if (!timer) return
    if (Math.hypot(e.clientX - startX, e.clientY - startY) > 8) {
      clearTimeout(timer)
      timer = null
    }
  }

  function onPointerUp() {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  function onPointerCancel() {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  function onContextMenu(e: MouseEvent) {
    e.preventDefault()
    void copyToClipboard(tag.fullTag)
  }

  function onClick(e: MouseEvent) {
    if (didLongPress) {
      didLongPress = false
      e.stopPropagation()
      return
    }
    handleTagClick(tag)
  }

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onContextMenu,
    onClick,
  }
}
</script>

<template>
  <div
    class="namespace-tags"
    :class="{
      'namespace-tags--expanded': expanded,
      'namespace-tags--grouped': expanded && hasNamespaces,
    }"
  >
    <!-- Grouped expanded view when namespaces exist -->
    <template v-if="expanded && hasNamespaces">
      <div
        v-for="group in groupedTags"
        :key="group.namespace || '__unnamespaced__'"
        class="namespace-group-row"
      >
        <span
          v-if="group.namespace"
          class="namespace-badge"
          :class="getNamespaceClass(group.namespace)"
        >
          {{ group.namespace }}
        </span>
        <div class="namespace-group-chips">
          <button
            v-for="tag in group.tags"
            :key="tag.fullTag"
            type="button"
            class="namespace-chip"
            :class="getNamespaceClass(tag.namespace)"
            :title="`Click to search, hold to copy: ${tag.fullTag}`"
            @pointerdown="createTagPressHandler(tag).onPointerDown"
            @pointermove="createTagPressHandler(tag).onPointerMove"
            @pointerup="createTagPressHandler(tag).onPointerUp"
            @pointercancel="createTagPressHandler(tag).onPointerCancel"
            @contextmenu="createTagPressHandler(tag).onContextMenu"
            @click="createTagPressHandler(tag).onClick"
          >
            {{ tag.text }}
          </button>
        </div>
      </div>
    </template>

    <!-- Flat flow (when expanded without namespaces) or scrollable lazy row (collapsed) -->
    <template v-else>
      <div class="namespace-flat-list" :class="{ 'namespace-flat-list--wrap': expanded }">
        <button
          v-for="tag in parsedTags"
          :key="tag.fullTag"
          type="button"
          class="namespace-chip"
          :class="getNamespaceClass(tag.namespace)"
          :title="`Click to search, hold to copy: ${tag.fullTag}`"
          @pointerdown="createTagPressHandler(tag).onPointerDown"
          @pointermove="createTagPressHandler(tag).onPointerMove"
          @pointerup="createTagPressHandler(tag).onPointerUp"
          @pointercancel="createTagPressHandler(tag).onPointerCancel"
          @contextmenu="createTagPressHandler(tag).onContextMenu"
          @click="createTagPressHandler(tag).onClick"
        >
          <span v-if="tag.namespace && !expanded" class="namespace-chip__ns-prefix">{{ tag.namespace }}:</span>
          <span>{{ tag.text }}</span>
        </button>
      </div>
    </template>

    <!-- Copy feedback snackbar -->
    <v-snackbar
      v-model="snackbar"
      :timeout="2000"
      location="bottom center"
      color="inverse-surface"
    >
      <span class="text-inverse-on-surface">{{ snackbarText }}</span>
    </v-snackbar>
  </div>
</template>

<style scoped>
@layer app-components {
.namespace-tags {
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}

.namespace-flat-list {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 12px 16px;
  overflow-x: auto;
  scrollbar-width: none;
  width: 100%;
  box-sizing: border-box;
}
.namespace-flat-list::-webkit-scrollbar {
  display: none;
}
.namespace-flat-list--wrap {
  flex-wrap: wrap;
  overflow-x: visible;
}

.namespace-group-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 4px 16px;
  width: 100%;
  box-sizing: border-box;
}

.namespace-badge {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  line-height: 16px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  padding: 4px 8px;
  border-radius: 6px;
  margin-top: 4px;
  border-width: 1px;
  border-style: solid;
}

.namespace-group-chips {
  flex: 1 1 auto;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}

.namespace-chip {
  flex: none;
  margin: 4px 0;
  height: 32px;
  padding: 0 12px;
  border-radius: 8px;
  font-family: inherit;
  font-size: 12px;
  line-height: 16px;
  font-weight: 500;
  letter-spacing: 0.0333333333em;
  cursor: pointer;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  border-width: 1px;
  border-style: solid;
  transition: background-color 0.2s ease-in-out, border-color 0.2s ease-in-out, transform 0.1s ease;
  user-select: none;
}
.namespace-chip:hover {
  filter: brightness(0.95);
}
.namespace-chip:active {
  transform: scale(0.97);
  filter: brightness(0.9);
}
.namespace-chip:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}

.namespace-chip__ns-prefix {
  opacity: 0.7;
  font-weight: 400;
}

/* ---------------- MD3 Tonal Container Colors ---------------- */

/* Default / Unnamespaced: Surface Variant / Outline */
.namespace-tag--default {
  background-color: color-mix(in srgb, rgb(var(--v-theme-surface-variant)) 35%, transparent);
  color: rgb(var(--v-theme-on-surface-variant));
  border-color: rgb(var(--v-theme-outline-variant));
}

/* Artist: Primary container */
.namespace-tag--artist {
  background-color: rgb(var(--v-theme-primary-container));
  color: rgb(var(--v-theme-on-primary-container));
  border-color: color-mix(in srgb, rgb(var(--v-theme-primary)) 35%, transparent);
}

/* Character: Secondary container */
.namespace-tag--character {
  background-color: rgb(var(--v-theme-secondary-container));
  color: rgb(var(--v-theme-on-secondary-container));
  border-color: color-mix(in srgb, rgb(var(--v-theme-secondary)) 35%, transparent);
}

/* Group: Tertiary container */
.namespace-tag--group {
  background-color: rgb(var(--v-theme-tertiary-container));
  color: rgb(var(--v-theme-on-tertiary-container));
  border-color: color-mix(in srgb, rgb(var(--v-theme-tertiary)) 35%, transparent);
}

/* Parody: Error container */
.namespace-tag--parody {
  background-color: rgb(var(--v-theme-error-container));
  color: rgb(var(--v-theme-on-error-container));
  border-color: color-mix(in srgb, rgb(var(--v-theme-error)) 35%, transparent);
}

/* Female: Pastel Pink container */
.namespace-tag--female {
  background-color: #ffd8e4;
  color: #3b0722;
  border-color: #f4b6cb;
}

/* Male: Teal container */
.namespace-tag--male {
  background-color: #cce8e8;
  color: #051f20;
  border-color: #99d2d0;
}

/* Dark and AMOLED Theme overrides for Female and Male */
:global([data-theme='dark']) .namespace-tag--female,
:global([data-amoled='true']) .namespace-tag--female,
:global(.v-theme--dark) .namespace-tag--female,
:global(.v-theme--black) .namespace-tag--female {
  background-color: #5c1138;
  color: #ffd8e4;
  border-color: #802350;
}

:global([data-theme='dark']) .namespace-tag--male,
:global([data-amoled='true']) .namespace-tag--male,
:global(.v-theme--dark) .namespace-tag--male,
:global(.v-theme--black) .namespace-tag--male {
  background-color: #004f4f;
  color: #a6eeea;
  border-color: #006b6b;
}

/* Contrast enhancement for AMOLED black mode */
:global([data-amoled='true']) .namespace-tag--default,
:global(.v-theme--black) .namespace-tag--default {
  background-color: #1a1a1a;
  color: #e0e0e0;
  border-color: #333333;
}
}
</style>
