import { db } from '../db/db'
import type { WorkoutSession, ExerciseDef } from '../db/types'
import { getMonday, getSunday } from './date'

export interface WeeklyProgress {
  workoutCount: number
  totalVolume: number
  totalDurationMs: number
  dailyVolume: number[] // Index 0 = Montag ... 6 = Sonntag
}

export async function computeWeeklyProgress(): Promise<WeeklyProgress> {
  const now = new Date()
  const from = getMonday(now).getTime()
  const to = getSunday(now).getTime() + 24 * 60 * 60 * 1000 - 1

  const sessions = await db.workoutSessions.where('startedAt').between(from, to, true, true).toArray()
  const sessionIds = new Set(sessions.map((s) => s.id))
  const sessionById = new Map(sessions.map((s) => [s.id, s]))

  const entries = await db.setEntries
    .toCollection()
    .filter((e) => sessionIds.has(e.sessionId))
    .toArray()

  const dailyVolume = new Array(7).fill(0)
  let totalVolume = 0
  for (const e of entries) {
    const session = sessionById.get(e.sessionId)
    if (!session) continue
    const volume = e.weight * e.reps
    totalVolume += volume
    const jsDay = new Date(session.startedAt).getDay()
    const mondayFirstIndex = jsDay === 0 ? 6 : jsDay - 1
    dailyVolume[mondayFirstIndex] += volume
  }

  let totalDurationMs = 0
  for (const s of sessions) {
    if (s.endedAt) totalDurationMs += s.endedAt - s.startedAt
  }

  return { workoutCount: sessions.length, totalVolume, totalDurationMs, dailyVolume }
}

export interface PrEntry {
  exerciseDefId: string
  exerciseName: string
  weight: number
  achievedAt: number
  previousWeight: number | null
}

// Für jede Übung: das aktuell höchste je bewegte Gewicht + wie viel mehr als beim vorherigen Rekord.
export async function computeCurrentPrs(limit = 5): Promise<PrEntry[]> {
  const allEntries = await db.setEntries.toArray()
  if (allEntries.length === 0) return []

  const sessionIds = [...new Set(allEntries.map((e) => e.sessionId))]
  const sessions = await db.workoutSessions.bulkGet(sessionIds)
  const sessionById = new Map(sessions.filter((s): s is WorkoutSession => s !== undefined).map((s) => [s.id, s]))

  const exerciseDefIds = [...new Set(allEntries.map((e) => e.exerciseDefId))]
  const exerciseDefs = await db.exerciseDefs.bulkGet(exerciseDefIds)
  const exerciseDefById = new Map(
    exerciseDefs.filter((d): d is ExerciseDef => d !== undefined).map((d) => [d.id, d]),
  )

  const byExercise = new Map<string, Map<string, number>>()
  for (const e of allEntries) {
    const session = sessionById.get(e.sessionId)
    if (!session) continue
    let sessionMap = byExercise.get(e.exerciseDefId)
    if (!sessionMap) {
      sessionMap = new Map()
      byExercise.set(e.exerciseDefId, sessionMap)
    }
    const current = sessionMap.get(e.sessionId) ?? 0
    if (e.weight > current) sessionMap.set(e.sessionId, e.weight)
  }

  const prs: PrEntry[] = []
  for (const [exerciseDefId, sessionMap] of byExercise) {
    const points = [...sessionMap.entries()]
      .map(([sessionId, weight]) => ({ weight, at: sessionById.get(sessionId)!.startedAt }))
      .sort((a, b) => a.at - b.at)

    let runningMax = 0
    let previousWeight: number | null = null
    let currentPrWeight = 0
    let currentPrAt = 0
    for (const p of points) {
      if (p.weight > runningMax) {
        previousWeight = runningMax > 0 ? runningMax : null
        runningMax = p.weight
        currentPrWeight = p.weight
        currentPrAt = p.at
      }
    }

    if (currentPrWeight > 0) {
      prs.push({
        exerciseDefId,
        exerciseName: exerciseDefById.get(exerciseDefId)?.name ?? '…',
        weight: currentPrWeight,
        achievedAt: currentPrAt,
        previousWeight,
      })
    }
  }

  prs.sort((a, b) => b.achievedAt - a.achievedAt)
  return prs.slice(0, limit)
}
