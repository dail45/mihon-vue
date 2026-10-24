/**
 * Lightweight concurrency limiter utility.
 *
 * Enforces client-side concurrency control for batches of asynchronous tasks.
 */
export function pLimit(concurrency: number) {
  if (!((Number.isInteger(concurrency) || concurrency === Number.POSITIVE_INFINITY) && concurrency > 0)) {
    throw new TypeError('Expected `concurrency` to be a number from 1 and up')
  }

  const queue: (() => void)[] = []
  let activeCount = 0

  const next = () => {
    activeCount--
    if (queue.length > 0) {
      queue.shift()!()
    }
  }

  return async <T>(fn: () => Promise<T>): Promise<T> => {
    await new Promise<void>(resolve => {
      if (activeCount < concurrency) {
        activeCount++
        resolve()
      } else {
        queue.push(() => {
          activeCount++
          resolve()
        })
      }
    })
    try {
      return await fn()
    } finally {
      next()
    }
  }
}
