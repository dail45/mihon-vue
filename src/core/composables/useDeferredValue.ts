import { ref, watch, onScopeDispose, type Ref } from 'vue'

function isEquivalent<T>(a: T, b: T): boolean {
  if (Object.is(a, b)) return true
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) return false
  const keysA = Object.keys(a as object)
  const keysB = Object.keys(b as object)
  if (keysA.length !== keysB.length) return false
  for (const k of keysA) {
    const valA = (a as Record<string, unknown>)[k]
    const valB = (b as Record<string, unknown>)[k]
    if (typeof valA === 'object' && valA !== null && typeof valB === 'object' && valB !== null) {
      if (JSON.stringify(valA) !== JSON.stringify(valB)) return false
    } else if (!Object.is(valA, valB)) {
      return false
    }
  }
  return true
}

export function useDeferredValue<T>(source: Ref<T> | (() => T)): Readonly<Ref<T>> {
  const initial = typeof source === 'function' ? source() : source.value
  const deferred = ref<T>(initial) as Ref<T>
  let rafId: number | null = null

  watch(
    typeof source === 'function' ? source : () => source.value,
    (newVal) => {
      if (isEquivalent(newVal, deferred.value)) return
      if (rafId !== null) cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        if (!isEquivalent(newVal, deferred.value)) {
          deferred.value = newVal
        }
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
