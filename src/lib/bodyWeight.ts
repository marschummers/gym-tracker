import { db } from '../db/db'
import { getMonday, getSunday } from './date'

export interface WeeklyWeightPoint {
  x: number // Wochenbeginn (Montag), als Timestamp
  y: number // Durchschnittsgewicht dieser Woche
}

export async function computeWeeklyWeightAverages(): Promise<WeeklyWeightPoint[]> {
  const entries = await db.bodyWeightEntries.toArray()
  if (entries.length === 0) return []

  const buckets = new Map<number, number[]>()
  for (const e of entries) {
    const weekStart = getMonday(new Date(`${e.dateStr}T00:00:00`)).getTime()
    if (!buckets.has(weekStart)) buckets.set(weekStart, [])
    buckets.get(weekStart)!.push(e.weight)
  }

  return [...buckets.entries()]
    .map(([weekStart, weights]) => ({
      x: weekStart,
      y: weights.reduce((sum, w) => sum + w, 0) / weights.length,
    }))
    .sort((a, b) => a.x - b.x)
}

export async function computeCurrentWeekAverage(): Promise<number | null> {
  const from = getMonday(new Date()).getTime()
  const to = getSunday(new Date()).getTime() + 24 * 60 * 60 * 1000 - 1
  const entries = await db.bodyWeightEntries
    .filter((e) => {
      const t = new Date(`${e.dateStr}T00:00:00`).getTime()
      return t >= from && t <= to
    })
    .toArray()
  if (entries.length === 0) return null
  return entries.reduce((sum, e) => sum + e.weight, 0) / entries.length
}
