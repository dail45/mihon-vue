import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { readPreference, writePreference } from './preferences'
export type ReadingMode = 'ltr' | 'rtl' | 'webtoon'
export type ReaderBackground = 'black' | 'paper' | 'gray'
export const useReaderPreferences = defineStore('readerPreferences', () => {
  const savedMode = readPreference('mihon.reader.mode'), savedBackground = readPreference('mihon.reader.background')
  const mode = ref<ReadingMode>(savedMode === 'rtl' || savedMode === 'webtoon' ? savedMode : 'ltr')
  const background = ref<ReaderBackground>(savedBackground === 'paper' || savedBackground === 'gray' ? savedBackground : 'black')
  const fit = ref<'page' | 'width'>(readPreference('mihon.reader.fit') === 'width' ? 'width' : 'page')
  // Opt-in: some legacy REST versions return default lastPageRead values.
  const saveProgress = ref(readPreference('mihon.reader.saveProgress') === 'true')
  watch(mode, v => writePreference('mihon.reader.mode', v))
  watch(background, v => writePreference('mihon.reader.background', v))
  watch(fit, v => writePreference('mihon.reader.fit', v))
  watch(saveProgress, v => writePreference('mihon.reader.saveProgress', String(v)))
  return { mode, background, fit, saveProgress }
})
