export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function getMonday(d: Date): Date {
  const date = new Date(d)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  date.setHours(0, 0, 0, 0)
  return date
}

export function getSunday(d: Date): Date {
  const monday = getMonday(d)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return sunday
}

export function toDateInputValue(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export type RangeKey = '7d' | '4w' | '12w' | '1y' | 'all'

export const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: '7d', label: '7T' },
  { key: '4w', label: '4W' },
  { key: '12w', label: '12W' },
  { key: '1y', label: '1J' },
  { key: 'all', label: 'Alle' },
]

export function getRangeStartMs(range: RangeKey, now: Date = new Date()): number | null {
  const d = new Date(now)
  if (range === '7d') d.setDate(d.getDate() - 7)
  else if (range === '4w') d.setDate(d.getDate() - 28)
  else if (range === '12w') d.setDate(d.getDate() - 84)
  else if (range === '1y') d.setFullYear(d.getFullYear() - 1)
  else return null
  return d.getTime()
}

export function formatShortDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
}
