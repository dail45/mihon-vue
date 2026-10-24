<script setup lang="ts">
/**
 * Track info — status / chapter / score / date selectors.
 *
 * Coordinator component delegating to domain-specific tracker selectors:
 *  - TrackStatusSelector: Status radio list
 *  - TrackNumberWheelPicker: Chapters wheel picker with manual input
 *  - TrackScoreWheelPicker: Score wheel picker
 *  - TrackDatePicker: MD3 DatePicker with calendar and year picker
 */
import TrackStatusSelector, { type TrackStatusOption } from './tracker/TrackStatusSelector.vue'
import TrackNumberWheelPicker from './tracker/TrackNumberWheelPicker.vue'
import TrackScoreWheelPicker from './tracker/TrackScoreWheelPicker.vue'
import TrackDatePicker from './tracker/TrackDatePicker.vue'

export type TrackSelectorMode = 'status' | 'chapter' | 'score' | 'date'
export type { TrackStatusOption }

const props = withDefaults(
  defineProps<{
    mode: TrackSelectorMode
    statusOptions?: TrackStatusOption[]
    statusSelection?: number | null
    chapterOptions?: number[]
    chapterSelection?: number
    scoreOptions?: string[]
    scoreSelection?: string
    dateSelection?: number | null
    dateTitle?: string
    dateKind?: 'start' | 'finish'
    dateServiceName?: string
    dateRemovable?: boolean
    dateMin?: number | null
    dateMax?: number | null
    dateCounterpart?: number | null
  }>(),
  {
    statusOptions: () => [],
    statusSelection: null,
    chapterOptions: () => [],
    chapterSelection: 0,
    scoreOptions: () => [],
    scoreSelection: '',
    dateSelection: null,
    dateTitle: '',
    dateKind: 'start',
    dateServiceName: '',
    dateRemovable: false,
    dateMin: null,
    dateMax: null,
    dateCounterpart: null,
  },
)

const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{
  (event: 'confirm', value: number | string): void
  (event: 'remove'): void
}>()
</script>

<template>
  <TrackStatusSelector
    v-if="mode === 'status'"
    :open="open"
    :options="statusOptions"
    :selection="statusSelection"
    @update:open="open = $event"
    @confirm="emit('confirm', $event)"
  />

  <TrackNumberWheelPicker
    v-else-if="mode === 'chapter'"
    :open="open"
    :options="chapterOptions"
    :selection="chapterSelection"
    @update:open="open = $event"
    @confirm="emit('confirm', $event)"
  />

  <TrackScoreWheelPicker
    v-else-if="mode === 'score'"
    :open="open"
    :options="scoreOptions"
    :selection="scoreSelection"
    @update:open="open = $event"
    @confirm="emit('confirm', $event)"
  />

  <TrackDatePicker
    v-else-if="mode === 'date'"
    :open="open"
    :selection="dateSelection"
    :title="dateTitle"
    :kind="dateKind"
    :service-name="dateServiceName"
    :removable="dateRemovable"
    :min="dateMin"
    :max="dateMax"
    :counterpart="dateCounterpart"
    @update:open="open = $event"
    @confirm="emit('confirm', $event)"
    @remove="emit('remove')"
  />
</template>
