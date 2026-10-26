import { ref, watch, onScopeDispose, type Ref } from 'vue'

export function useDeferredValue<T>(source: Ref<T> | (() => T)): Readonly<Ref<T>> {
  const initial = typeof source === 'function' ? source() : source.value
  const deferred = ref<T>(initial) as Ref<T>
  let rafId: number | null = null

  watch(
    typeof source === 'function' ? source : () => source.value,
    (newVal) => {
      if (rafId !== null) cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        deferred.value = newVal
        rafId = null
      })
    },
    { deep: true }
  )

  onScopeDispose(() => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
  })

  return deferred
}
