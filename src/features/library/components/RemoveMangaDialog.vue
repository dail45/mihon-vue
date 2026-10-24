<script setup lang="ts">
import { computed, ref } from 'vue'
import { apiErrorMessage, createSuwayomiApi } from '@/core/api/client'
import type { Manga } from '@/core/api/types'
import { useSuwayomiStore } from '../stores/suwayomi'

/**
 * Pixel-parity port of `RemoveMangaDialog` in
 * mihon/app/src/main/java/eu/kanade/presentation/browse/components/BrowseSourceDialogs.kt
 *
 *   AlertDialog(
 *     onDismissRequest = onDismissRequest,
 *     dismissButton = { TextButton(onClick = onDismissRequest) { Text(MR.strings.action_cancel) } },
 *     confirmButton = { TextButton(onClick = { onDismissRequest(); onConfirm() }) { Text(MR.strings.action_remove) } },
 *     title = { Text(MR.strings.are_you_sure) },
 *     text = { Text(MR.strings.remove_manga, mangaToRemove.title) },
 *   )
 *
 * Material3 metrics used here (compose material3 AlertDialog.kt + DialogTokens.kt):
 * - shape = CornerExtraLarge (28dp), container = surface-container-high, tonalElevation 0dp.
 * - container padding 24dp on all sides, title bottom padding 16dp, text bottom padding 24dp.
 * - title = headlineSmall (24sp / 32sp, weight 400) in on-surface.
 * - supporting text = bodyMedium (14sp / 20sp, letterSpacing 0.0178571429em) in on-surface-variant.
 * - action labels = labelLarge (14sp / 20sp, weight 500, letterSpacing 0.0071428571em) in primary
 *   (DialogTokens.ActionLabelTextColor); the reference uses plain TextButtons, so "Remove" is NOT
 *   tinted with the error colour.
 * - TextButton: height 40dp (ButtonSmallTokens.ContainerHeight), min width 58dp
 *   (ButtonDefaults.MinWidth), content padding 12dp horizontal (TextButtonHorizontalPadding),
 *   shape = CornerFull (20dp), disabled label = on-surface-variant at 38%.
 * - BasicAlertDialog applies sizeIn(minWidth = 280dp, maxWidth = 560dp): the dialog is as wide as
 *   its content, never narrower than 280dp and never wider than 560dp.
 * - AlertDialogFlowRow flips the layout direction, so the dismiss button ("Cancel") sits on the
 *   left and the confirm button ("Remove") on the right.
 */
const props = defineProps<{ manga: Manga | null }>()
const open = defineModel<boolean>({ required: true })
const emit = defineEmits<{ (event: 'removed', id: number): void; (event: 'failed', message: string): void }>()

const server = useSuwayomiStore()
const busy = ref(false)
const mangaTitle = computed(() => props.manga?.title ?? '')

/**
 * Mihon dismisses the dialog first and only then runs the action
 * (`TextButton(onClick = { onDismissRequest(); onConfirm() })`), and the action itself is
 * `BrowseSourceViewModel.changeMangaFavorite(manga)` which drops the favourite flag. Suwayomi
 * models the library membership with `DELETE /manga/{id}/library`.
 */
async function confirm() {
  const manga = props.manga
  if (!manga || busy.value) return
  busy.value = true
  open.value = false
  try {
    await createSuwayomiApi(server.apiUrl).removeFromLibrary(manga.id)
    emit('removed', manga.id)
  } catch (reason) {
    emit('failed', apiErrorMessage(reason))
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <v-dialog
    v-if="manga"
    v-model="open"
    content-class="remove-manga-overlay"
    :content-props="{ 'aria-labelledby': 'remove-manga-title', 'aria-describedby': 'remove-manga-text' }"
  >
    <v-card rounded="28px" color="surface-container-high" class="remove-manga-card">
      <h2 id="remove-manga-title" class="remove-manga-title">Are you sure?</h2>
      <p id="remove-manga-text" class="remove-manga-text">You are about to remove "{{ mangaTitle }}" from your library</p>
      <div class="remove-manga-actions">
        <button type="button" class="remove-manga-button" :disabled="busy" @click="open = false">Cancel</button>
        <button type="button" class="remove-manga-button" :disabled="busy" @click="confirm">Remove</button>
      </div>
    </v-card>
  </v-dialog>
</template>

<style>
/* Material3 BasicAlertDialog: sizeIn(minWidth = 280dp, maxWidth = 560dp) around a content sized
   dialog. The Vuetify overlay content is stretched by default and has to be constrained here; the
   card fills the overlay content, so the overlay drives the final width. */
.v-dialog > .remove-manga-overlay {
  width: fit-content;
  min-width: min(280px, calc(100% - 48px));
  max-width: min(560px, calc(100% - 48px));
}
/* Compose draws the dialog surface with tonalElevation = 0.dp and without a shadow elevation,
   so the alert dialog has no drop shadow. */
.v-dialog > .remove-manga-overlay > .v-card { box-shadow: none; }
</style>

<style scoped>
/* Material3 AlertDialog container: shape = CornerExtraLarge (28dp), container colour =
   surface-container-high, container padding 24dp. */
.remove-manga-card { padding: 24px; }

/* Title: headlineSmall (24sp / 32sp, weight 400) in on-surface, 16dp bottom padding. */
.remove-manga-title {
  margin: 0 0 16px;
  font-size: 24px;
  line-height: 32px;
  font-weight: 400;
  letter-spacing: normal;
  color: rgb(var(--v-theme-on-surface));
}

/* Supporting text: bodyMedium (14sp / 20sp) in on-surface-variant, 24dp bottom padding. */
.remove-manga-text {
  margin: 0 0 24px;
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  letter-spacing: 0.0178571429em;
  color: rgb(var(--v-theme-on-surface-variant));
}

/* The action row of AlertDialogContent is aligned to the end of the column and holds the buttons
   in a FlowRow with 8dp spacing; the flow row flips the layout direction, so the dismiss button
   comes first (left) and the confirm button second (right). */
.remove-manga-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

/* Material3 TextButton: height 40dp (ButtonSmallTokens.ContainerHeight), min width 58dp
   (ButtonDefaults.MinWidth), content padding 12dp horizontal, shape = CornerFull (20dp),
   label = labelLarge in the primary colour, state layer 8% on hover and 10% while pressed. */
.remove-manga-button {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 58px;
  height: 40px;
  padding: 0 12px;
  border: 0;
  border-radius: 20px;
  background: none;
  font-family: inherit;
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  letter-spacing: 0.0071428571em;
  text-transform: none;
  text-align: center;
  color: rgb(var(--v-theme-primary));
  cursor: pointer;
  overflow: hidden;
  -webkit-tap-highlight-color: transparent;
}
/* Compose draws the button state layer in the content colour of the label. */
.remove-manga-button::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background-color: currentColor;
  opacity: 0;
  transition: opacity 0.2s ease-in-out;
  pointer-events: none;
}
.remove-manga-button:hover::after { opacity: 0.08; }
.remove-manga-button:active::after { opacity: 0.1; }
.remove-manga-button:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: 2px; }
/* Material3 disabled state: the label keeps its colour but drops to 38% opacity
   (TextButtonTokens.DisabledLabelColor = on-surface-variant, DisabledLabelOpacity = 0.38). */
.remove-manga-button:disabled {
  cursor: default;
  color: rgb(var(--v-theme-on-surface-variant));
  opacity: 0.38;
}
</style>
