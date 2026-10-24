import { defineStore } from 'pinia'
import {
  isSourcePinned,
  setSourcePinned,
  toggleSourcePin,
  pinnedSourceIds,
  PINNED_SOURCES_KEY,
} from '@/core/utils/sourcePins'

export { isSourcePinned, setSourcePinned, toggleSourcePin, pinnedSourceIds, PINNED_SOURCES_KEY }

export const useSourcePinsStore = defineStore('sourcePins', () => {
  return {
    isSourcePinned,
    setSourcePinned,
    toggleSourcePin,
    pinnedSourceIds,
  }
})
