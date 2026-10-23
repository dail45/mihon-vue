<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Source } from '../api/types'
import { isSourcePinned, toggleSourcePin } from '../utils/sourcePins'

/**
 * Pixel-parity port of `SourceOptionsDialog` in
 * mihon/app/src/main/java/eu/kanade/presentation/browse/SourcesScreen.kt:164-199
 *
 *   AlertDialog(
 *     title = { Text(text = source.visualName) },
 *     text = { Column {
 *       Text(if (Pin.Pinned in source.pin) action_unpin else action_pin,
 *            modifier = Modifier.clickable(onClick = onClickPin).fillMaxWidth().padding(vertical = 16.dp))
 *       if (!source.isLocal())
 *         Text(action_disable,
 *              modifier = Modifier.clickable(onClick = onClickDisable).fillMaxWidth().padding(vertical = 16.dp))
 *     } },
 *     onDismissRequest = onDismiss,
 *     confirmButton = {},
 *   )
 *
 * Material3 AlertDialog metrics used here (compose material3 AlertDialog.kt + DialogTokens.kt):
 * - shape = CornerExtraLarge (28dp), container = surface-container-high, tonalElevation 0dp.
 * - container padding 24dp on all sides, title bottom padding 16dp, text bottom padding 24dp.
 * - title = headlineSmall (24sp / 32sp, weight 400) coloured with on-surface.
 * - supporting text = bodyMedium (14sp / 20sp, letterSpacing 0.0178571429em) in on-surface-variant.
 * - BasicAlertDialog applies sizeIn(minWidth = 280dp, maxWidth = 560dp): the dialog is as wide
 *   as its content, never narrower than 280dp and never wider than 560dp.
 * - the action row is empty (confirmButton = {}), so the dialog has no buttons.
 *
 * `source.visualName` is "$name (${lang.uppercase()})", or just the name for an empty
 * language (tachiyomi/domain/.../source/model/Source.kt:13-17).
 */
const props = defineProps<{ source: Source | null }>()
const open = defineModel<boolean>({ required: true })
const emit = defineEmits<{ (event: 'disable', source: Source): void; (event: 'pin', source: Source, pinned: boolean): void }>()

/* LocalSource.ID = 0L (mihon/source-local/.../LocalSource.kt:406); Suwayomi reports the local
   source with the placeholder language "localsourcelang" instead of an empty one. */
const LOCAL_SOURCE_ID = '0'
const LOCAL_SOURCE_LANG = 'localsourcelang'

const notice = ref('')
/* Mihon swaps the label between action_pin and action_unpin depending on the pin state. The pin
   state is app-local in Mihon (SourcePreferences.pinnedSources), so the web client keeps it in
   browser storage in utils/sourcePins.ts and the label parity is preserved. */
const pinned = ref(false)

watch([open, () => props.source?.id], ([isOpen]) => {
  if (!isOpen) return
  notice.value = ''
  pinned.value = props.source ? isSourcePinned(props.source.id) : false
}, { immediate: true })

/* Mihon: `source.isLocal()` is `source.id == LocalSource.ID` (mihon/source-local/.../LocalSource.kt:406). */
const isLocal = computed(() => props.source?.id === LOCAL_SOURCE_ID)

/* Source.visualName. Mihon's local source uses the language "other". */
const title = computed(() => {
  const source = props.source
  if (!source) return ''
  const lang = source.lang === LOCAL_SOURCE_LANG ? 'other' : source.lang
  return lang ? `${source.name} (${lang.toUpperCase()})` : source.name
})

const pinLabel = computed(() => (pinned.value ? 'Unpin' : 'Pin'))

function onClickPin() {
  const source = props.source
  if (!source) return
  const next = toggleSourcePin(source.id)
  pinned.value = next
  emit('pin', source, next)
  /* Mihon closes the dialog right after the action (SourcesTab.kt:58-69). */
  open.value = false
}

function onClickDisable() {
  const source = props.source
  if (!source) return
  /* Suwayomi-Server keeps the enabled state of a source (an installed extension) on the server
     and exposes no REST contract to change it, so the action is an honest stub. */
  notice.value = 'Disabling a source is not supported in the web version. Manage enabled sources on your Suwayomi-Server.'
  emit('disable', source)
}
</script>

<template>
  <v-dialog v-if="source" v-model="open" content-class="source-options-overlay" :aria-label="title">
    <v-card rounded="28px" color="surface-container-high" class="source-options-card">
      <h2 class="source-options-title">{{ title }}</h2>
      <div class="source-options-text">
        <button type="button" class="source-options-row" @click="onClickPin">{{ pinLabel }}</button>
        <button v-if="!isLocal" type="button" class="source-options-row" @click="onClickDisable">Disable</button>
        <p v-if="notice" class="source-options-notice" role="status">{{ notice }}</p>
      </div>
    </v-card>
  </v-dialog>
</template>

<style>
/* Material3 BasicAlertDialog: sizeIn(minWidth = 280dp, maxWidth = 560dp) around a content sized
   dialog. The Vuetify overlay content is stretched by default and has to be constrained here; the
   card fills the overlay content, so the overlay drives the final width. */
.v-dialog > .source-options-overlay {
  width: fit-content;
  min-width: min(280px, calc(100% - 48px));
  max-width: min(560px, calc(100% - 48px));
}
/* Compose draws the dialog surface with tonalElevation = 0.dp and without a shadow elevation,
   so the alert dialog has no drop shadow. */
.v-dialog > .source-options-overlay > .v-card { box-shadow: none; }
</style>

<style scoped>
/* Material3 AlertDialog container: shape = CornerExtraLarge (28dp), container colour =
   surface-container-high, container padding 24dp. */
.source-options-card { padding: 24px; }

/* Title: headlineSmall (24sp / 32sp, weight 400) in on-surface, 16dp bottom padding. */
.source-options-title {
  margin: 0 0 16px;
  font-size: 24px;
  line-height: 32px;
  font-weight: 400;
  letter-spacing: normal;
  color: rgb(var(--v-theme-on-surface));
}

/* Supporting text block: bodyMedium in on-surface-variant, 24dp bottom padding. */
.source-options-text { padding-bottom: 24px; }

/* The dialog entries are plain Texts with a clickable modifier: bodyMedium, full width,
   16dp vertical padding. */
.source-options-row {
  display: block;
  width: 100%;
  padding: 16px 0;
  border: 0;
  background: none;
  font-family: inherit;
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  letter-spacing: 0.0178571429em;
  color: rgb(var(--v-theme-on-surface-variant));
  text-align: start;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
/* Compose shows a ripple in the content colour of the clickable Text (on-surface-variant);
   the web uses the same translucent state layer. */
.source-options-row:hover { background: color-mix(in srgb, rgb(var(--v-theme-on-surface-variant)) 8%, transparent); }
.source-options-row:active { background: color-mix(in srgb, rgb(var(--v-theme-on-surface-variant)) 10%, transparent); }
.source-options-row:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: 2px; }

/* Web-only notice for the action the Suwayomi REST API cannot perform. */
.source-options-notice {
  margin: 16px 0 0;
  font-size: 12px;
  line-height: 16px;
  color: rgb(var(--v-theme-on-surface-variant));
}
</style>
