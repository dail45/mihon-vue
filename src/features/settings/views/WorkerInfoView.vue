<script setup lang="ts">
/**
 * Worker info screen — pixel parity target:
 *   mihon/app/src/main/java/eu/kanade/presentation/more/settings/screen/debug/WorkerInfoScreen.kt
 *   mihon/app/src/main/java/eu/kanade/presentation/components/AppBar.kt
 *   mihon/presentation-core/src/main/java/tachiyomi/presentation/core/components/material/Scaffold.kt
 *
 * Structure (WorkerInfoScreen.kt):
 *   Scaffold(topBar = AppBar(title = "Worker info", navigateUp = pop,
 *                actions = AppBarActions(listOf(AppBar.Action(
 *                  title = stringResource(MR.strings.action_copy_to_clipboard),
 *                  icon = MaterialSymbols.Rounded.ContentCopy,
 *                  onClick = { context.copyToClipboard(TITLE, enqueued + finished + running) })))))
 *     LazyColumn(contentPadding = contentPadding + PaddingValues(horizontal = 16.dp),
 *                modifier = Modifier.horizontalScroll(rememberScrollState()))
 *       item { SectionTitle(title = "Enqueued") }  -> Text(titleMedium, padding(vertical = 8.dp))
 *       item { SectionText(text = enqueued) }     -> Text(softWrap = false, FontFamily.Monospace)
 *       item { SectionTitle(title = "Finished") }
 *       item { SectionText(text = finished) }
 *       item { SectionTitle(title = "Running") }
 *       item { SectionText(text = running) }
 *
 * The work data comes from Android's WorkManager, which does not exist in a browser and has no
 * Suwayomi-Server counterpart, so every section shows the reference's own empty marker ("-") and a
 * short note explains the limitation.
 */
import { computed, onBeforeUnmount, ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

/** WorkerInfoScreen.TITLE */
const TITLE = 'Worker info'

/** MR.strings.action_copy_to_clipboard */
const COPY_LABEL = 'Copy to clipboard'

/**
 * WorkerInfoViewModel.constructString(): an empty work list renders a single "-" line.
 * The three lists are always empty in the web build (no WorkManager), so each section shows "-".
 */
const EMPTY_SECTION = '-\n'

const enqueued = ref(EMPTY_SECTION)
const finished = ref(EMPTY_SECTION)
const running = ref(EMPTY_SECTION)

/** The clipboard payload is the three sections concatenated, exactly like the reference. */
const clipboardContent = computed(() => enqueued.value + finished.value + running.value)

/** ContextExtensions.copyToClipboard() toasts "Copied to clipboard: <content>" on Android 12 and older. */
const toast = ref('')
let toastTimer: ReturnType<typeof setTimeout> | undefined

function showToast(message: string) {
  toast.value = message
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value = '' }, 4000)
}

/** StringExtensions.truncateCenter(count): at most `count` characters, cut in the middle. */
function truncateCenter(value: string, count: number): string {
  if (value.length <= count) return value
  const replacement = '...'
  const pieceLength = Math.floor((count - replacement.length) / 2)
  return `${value.slice(0, pieceLength)}${replacement}${value.slice(value.length - pieceLength)}`
}

async function copyToClipboard() {
  const content = clipboardContent.value
  if (content.trim() === '') return
  try {
    await navigator.clipboard.writeText(content)
    showToast(`Copied to clipboard: ${truncateCenter(content, 50)}`)
  } catch {
    showToast('Failed to copy to clipboard')
  }
}

function goBack() {
  if (typeof window.history.state?.back === 'string') { router.back(); return }
  void router.push('/settings/advanced/debug')
}

onBeforeUnmount(() => {
  if (toastTimer) clearTimeout(toastTimer)
})
</script>

<template>
  <section class="worker-info">
    <!-- AppBar.kt: TopAppBar, 64dp tall, surface color, up arrow and a single action. -->
    <header class="worker-toolbar">
      <v-btn icon="arrow_back" variant="text" aria-label="Back" @click="goBack" />
      <h1 class="worker-toolbar-title">{{ TITLE }}</h1>
      <!-- AppBarActions wraps every action in a PlainTooltip placed above the icon button. -->
      <span class="worker-action-wrap">
        <v-btn icon="content_copy" variant="text" :aria-label="COPY_LABEL" @click="copyToClipboard" />
        <span class="worker-action-tooltip" role="tooltip">{{ COPY_LABEL }}</span>
      </span>
    </header>

    <!-- LazyColumn(modifier = Modifier.horizontalScroll(...)) with 16dp horizontal content padding. -->
    <div class="worker-scroll">
      <div class="worker-column">
        <!-- SectionTitle: Text(titleMedium, modifier = padding(vertical = 8.dp)) -->
        <h2 class="worker-section-title">Enqueued</h2>
        <pre class="worker-section-text">{{ enqueued }}</pre>

        <h2 class="worker-section-title">Finished</h2>
        <pre class="worker-section-text">{{ finished }}</pre>

        <h2 class="worker-section-title">Running</h2>
        <pre class="worker-section-text">{{ running }}</pre>

        <!-- The web build has no WorkManager queue, so the reference data is replaced by a note. -->
        <p class="worker-note">
          Worker information is not available in the web version: Android WorkManager jobs have no
          Suwayomi-Server counterpart.
        </p>
      </div>
    </div>

    <div v-if="toast" class="worker-toast" role="status" aria-live="polite">{{ toast }}</div>
  </section>
</template>

<style scoped>
.worker-info {
  display: flex;
  flex-direction: column;
  min-height: 100%;
}

/* AppBar.kt / TopAppBar: 64dp tall, container color surfaceColorAtElevation(0dp) = surface. */
.worker-toolbar {
  position: sticky;
  top: 0;
  z-index: 3;
  display: flex;
  align-items: center;
  height: 64px;
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
}

/* TopAppBar title slot uses titleLarge (22sp / 28sp, weight 400). */
.worker-toolbar-title {
  flex: 1 1 auto;
  min-width: 0;
  margin: 0;
  padding: 0 4px;
  font-size: 22px;
  line-height: 28px;
  font-weight: 400;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* LazyColumn: `Modifier.horizontalScroll(rememberScrollState())` — the whole column scrolls sideways. */
.worker-scroll {
  overflow-x: auto;
}

/* LazyColumn(contentPadding = contentPadding + PaddingValues(horizontal = 16.dp)). */
.worker-column {
  width: max-content;
  min-width: 100%;
  padding: 0 16px 24px;
}

/* SectionTitle: MaterialTheme.typography.titleMedium (16sp / 24sp, Medium, 0.15sp tracking) with 8dp vertical padding. */
.worker-section-title {
  margin: 0;
  padding: 8px 0;
  font-size: 16px;
  line-height: 24px;
  font-weight: 500;
  letter-spacing: .15px;
  color: rgb(var(--v-theme-on-background));
}

/* SectionText: Text(softWrap = false, fontFamily = FontFamily.Monospace) — bodyLarge (16sp / 24sp, 0.5sp tracking). */
.worker-section-text {
  margin: 0;
  padding: 0;
  font-family: 'Roboto Mono', ui-monospace, 'SFMono-Regular', 'Cascadia Mono', Consolas, monospace;
  font-size: 16px;
  line-height: 24px;
  font-weight: 400;
  letter-spacing: .5px;
  color: rgb(var(--v-theme-on-background));
  white-space: pre;
}

/* AppBarActions wraps the action in a TooltipBox with a PlainTooltip above the icon button. */
.worker-action-wrap { position: relative; display: inline-flex; align-items: center; }
.worker-action-tooltip {
  position: absolute;
  bottom: calc(100% + 4px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 4;
  padding: 4px 8px;
  border-radius: 4px;
  background: rgb(var(--v-theme-inverse-surface));
  color: rgb(var(--v-theme-inverse-on-surface));
  font-size: 14px;
  line-height: 20px;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity .15s ease;
}
.worker-action-wrap:hover .worker-action-tooltip,
.worker-action-wrap:focus-within .worker-action-tooltip { opacity: 1; }

/* The limitation note is not part of the reference screen. */
.worker-note {
  margin: 16px 0 0;
  font-size: 12px;
  line-height: 16px;
  color: rgb(var(--v-theme-on-surface-variant));
}

/* ContextExtensions.copyToClipboard() toast, rendered as an MD3 snackbar (inverseSurface, 4dp shape). */
.worker-toast {
  position: fixed;
  left: calc((100% + var(--v-layout-left, 0px) - var(--v-layout-right, 0px)) / 2);
  bottom: calc(var(--v-layout-bottom, 0px) + 24px + env(safe-area-inset-bottom, 0px));
  transform: translateX(-50%);
  z-index: 2400;
  max-width: min(560px, calc(100vw - 32px));
  padding: 14px 16px;
  border-radius: 4px;
  background: rgb(var(--v-theme-inverse-surface));
  color: rgb(var(--v-theme-inverse-on-surface));
  font-size: 14px;
  line-height: 20px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, .28);
}
</style>
