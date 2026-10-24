<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'

/**
 * Pixel-parity port of Mihon's `presentation/library/components/GlobalSearchItem.kt`.
 *
 * Reference (Mihon @ 446f6df82c390ab760802c2fce3b677bce3f31c1):
 *
 * ```kotlin
 * @Composable
 * internal fun GlobalSearchItem(
 *     searchQuery: String,
 *     onClick: () -> Unit,
 *     modifier: Modifier = Modifier,
 * ) {
 *     TextButton(
 *         modifier = modifier,
 *         onClick = onClick,
 *     ) {
 *         Text(
 *             text = stringResource(MR.strings.action_global_search_query, searchQuery),
 *             modifier = Modifier.zIndex(99f),
 *         )
 *     }
 * }
 * ```
 *
 * The reference is a single Material 3 `TextButton` with one `Text` inside — no icon, no
 * container colour and no explicit padding or typography, so every metric comes from the MD3
 * `TextButton` defaults (androidx Compose Material 3, `Button.kt`):
 *
 *  - container height `ButtonSmallTokens.ContainerHeight` = 40dp, min width
 *    `ButtonDefaults.MinWidth` = 58dp,
 *  - content padding `ButtonDefaults.TextButtonContentPadding` = 12dp horizontal / 8dp vertical,
 *  - shape `ButtonSmallTokens.ContainerShapeRound` = `ShapeKeyTokens.CornerFull` (a pill),
 *  - container colour `Color.Transparent`, content colour `ColorSchemeKeyTokens.Primary`,
 *  - typography `labelLarge` (14sp / 20sp / weight 500 / 0.1sp letter spacing) provided by
 *    `ProvideContentColorTextStyle`,
 *  - the text is drawn above the state layer (`Modifier.zIndex(99f)`).
 *
 * The button is used in three places in Mihon:
 *  - `LibraryList.kt` — `Modifier.fillMaxWidth()`, so the row spans the whole list width and the
 *    label stays centred inside it (`Row(horizontalArrangement = Arrangement.Center)`),
 *  - `LazyLibraryGrid.kt` — `span = { GridItemSpan(maxLineSpan) }` without `fillMaxWidth`, so the
 *    button keeps its content width at the start of the grid row,
 *  - `LibraryPager.kt` (`LibraryPagerEmptyScreen`) — `fillMaxWidth()` above the empty screen.
 */
const props = withDefaults(defineProps<{
  /** Mihon `searchQuery`; the label is `Search for "%1$s" globally`. */
  searchQuery: string
  /** `list` = `Modifier.fillMaxWidth()` (LibraryList.kt), `grid` = content width (LazyLibraryGrid.kt). */
  variant?: 'list' | 'grid'
  /** Mihon `onClick: () -> Unit`. Optional click callback. Defaults to navigating to GlobalSearch. */
  onClick?: () => void
}>(), { variant: 'list', onClick: undefined })

const emit = defineEmits<{
  (e: 'click', event: MouseEvent): void
}>()

const router = useRouter()

/** Mihon `action_global_search_query`: `Search for "%1$s" globally`. */
const label = computed(() => `Search for "${props.searchQuery}" globally`)

/** Mihon: `navigator.push(GlobalSearchScreen(viewModel.state.value.searchQuery ?: ""))`. */
function onClick(event: MouseEvent) {
  emit('click', event)
  if (props.onClick) {
    props.onClick()
    return
  }
  if (!event.defaultPrevented && router) {
    void router.push({ path: '/browse/global-search', query: { q: props.searchQuery } })
  }
}
</script>

<template>
  <span class="global-search-item-root" :class="`global-search-item-root-${props.variant}`">
    <!-- TextButton: transparent container, primary content colour, labelLarge typography. -->
    <v-btn
      class="global-search-item"
      :class="{ 'global-search-item-block': props.variant === 'list' }"
      variant="text"
      color="primary"
      @click="onClick"
    >
      <span class="global-search-item-label">{{ label }}</span>
    </v-btn>
  </span>
</template>

<style scoped>
.global-search-item-root {
  display: block;
}

/* LibraryList.kt: `Modifier.fillMaxWidth()` — the button spans the whole list row. */
.global-search-item-root-list {
  width: 100%;
}

/* LazyLibraryGrid.kt: `span = { GridItemSpan(maxLineSpan) }` without `fillMaxWidth`, so the
   button keeps its content width at the start of the grid row. */
.global-search-item-root-grid {
  grid-column: 1 / -1;
}

/*
 * Material 3 TextButton defaults:
 *   height 40dp (ButtonSmallTokens.ContainerHeight), min width 58dp (ButtonDefaults.MinWidth),
 *   content padding 12dp horizontal / 8dp vertical (ButtonDefaults.TextButtonContentPadding),
 *   fully rounded shape (ButtonSmallTokens.ContainerShapeRound = ShapeKeyTokens.CornerFull),
 *   labelLarge typography (14sp / 20sp / weight 500 / 0.1sp letter spacing).
 *
 * The reference passes a constant `shape`, so the pill shape does NOT morph on press — only the
 * expressive `Button(shapes = …)` overload animates the shape.
 */
.global-search-item.v-btn {
  --v-btn-height: 40px;
  height: 40px;
  min-width: 58px;
  padding: 0 12px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  letter-spacing: 0.1px;
  /* Vuetify offsets the first line by the letter spacing; MD3 has no such offset. */
  text-indent: 0;
  text-transform: none;
}

/* `Modifier.fillMaxWidth()` on the list variant; the label stays centred inside the row. */
.global-search-item-block {
  width: 100%;
  justify-content: center;
}

/* Mihon keeps the label above the state layer with `Modifier.zIndex(99f)`. */
.global-search-item-label {
  position: relative;
  z-index: 99;
}

/* Material 3 state layer: hover 8%, focus 10%, pressed 10% of the content colour. */
.global-search-item.v-btn:hover :deep(.v-btn__overlay) {
  opacity: 0.08;
}

.global-search-item.v-btn:focus-visible :deep(.v-btn__overlay) {
  opacity: 0.1;
}

.global-search-item.v-btn:active :deep(.v-btn__overlay) {
  opacity: 0.1;
}
</style>
