/** Chapter.fetchedAt uses epoch seconds, unlike uploadDate's milliseconds. */
export function fetchedDateKey(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return 'unknown'
  const date = new Date(seconds * 1000)
  if (!Number.isFinite(date.getTime())) return 'unknown'
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}
export function fetchedDateLabel(seconds: number): string {
  if (fetchedDateKey(seconds) === 'unknown') return 'Date unknown'
  const date = new Date(seconds * 1000), today = new Date(), yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  if (date.toDateString() === today.toDateString()) return 'Today'
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return new Intl.DateTimeFormat(undefined, { month: 'long', day: 'numeric', year: 'numeric' }).format(date)
}
