import { db } from '../db/db'
import { formatDate } from './date'
import { computeCurrentPrs } from './progress'
import { computeWeeklyWeightAverages } from './bodyWeight'
import { supabase } from './supabaseClient'

const SNAPSHOT_ROW_ID = 'latest'
const TRAINING_HISTORY_DAYS = 90

async function buildSnapshotText(): Promise<string> {
  const lines: string[] = []
  const now = Date.now()

  lines.push(`Trainings- und Körperdaten – Stand ${formatDate(now)}`)
  lines.push('')

  const appSettings = await db.appSettings.get('singleton')
  if (appSettings?.targetWeight !== undefined) {
    lines.push(`Zielgewicht: ${appSettings.targetWeight} kg`)
    lines.push('')
  }

  const bodyEntries = await db.bodyWeightEntries.orderBy('dateStr').toArray()
  if (bodyEntries.length > 0) {
    lines.push('Körpergewicht – einzelne Einträge:')
    for (const e of bodyEntries) lines.push(`- ${e.dateStr}: ${e.weight} kg`)
    lines.push('')

    const weeklyAvg = await computeWeeklyWeightAverages()
    lines.push('Körpergewicht – Wochendurchschnitt:')
    for (const w of weeklyAvg) lines.push(`- Woche ab ${formatDate(w.x)}: ${w.y.toFixed(2)} kg`)
    lines.push('')
  }

  const prs = await computeCurrentPrs(50)
  if (prs.length > 0) {
    lines.push('Aktuelle persönliche Bestleistungen (höchstes Gewicht je Übung):')
    for (const pr of prs) {
      const delta = pr.previousWeight !== null ? `, +${(pr.weight - pr.previousWeight).toFixed(1)} kg ggü. vorherigem Rekord` : ''
      lines.push(`- ${pr.exerciseName}: ${pr.weight} kg (${formatDate(pr.achievedAt)}${delta})`)
    }
    lines.push('')
  }

  const rangeStart = now - TRAINING_HISTORY_DAYS * 24 * 60 * 60 * 1000
  const sessions = await db.workoutSessions.where('startedAt').aboveOrEqual(rangeStart).sortBy('startedAt')
  const sessionIds = new Set(sessions.map((s) => s.id))

  const allSetEntries = await db.setEntries
    .toCollection()
    .filter((e) => sessionIds.has(e.sessionId))
    .toArray()

  const dayIds = [...new Set(sessions.map((s) => s.dayId))]
  const days = await db.days.bulkGet(dayIds)
  const dayById = new Map(days.filter((d) => d !== undefined).map((d) => [d.id, d]))

  const exerciseDefIds = [...new Set(allSetEntries.map((e) => e.exerciseDefId))]
  const exerciseDefs = await db.exerciseDefs.bulkGet(exerciseDefIds)
  const exerciseDefById = new Map(exerciseDefs.filter((e) => e !== undefined).map((e) => [e.id, e]))

  const dayExerciseIds = [...new Set(allSetEntries.map((e) => e.dayExerciseId))]
  const dayExercises = await db.dayExercises.bulkGet(dayExerciseIds)
  const dayExerciseById = new Map(dayExercises.filter((d) => d !== undefined).map((d) => [d.id, d]))

  lines.push(`Trainingsverlauf (letzte ${TRAINING_HISTORY_DAYS} Tage, ${sessions.length} Einheiten):`)
  if (sessions.length === 0) {
    lines.push('- Keine Trainings in diesem Zeitraum.')
  }
  for (const session of sessions) {
    const dayName = dayById.get(session.dayId)?.name ?? '…'
    lines.push(`${dayName} · ${formatDate(session.startedAt)}`)

    const bySetExercise = new Map<string, { name: string; order: number; sets: string[] }>()
    for (const e of allSetEntries.filter((e) => e.sessionId === session.id)) {
      let group = bySetExercise.get(e.exerciseDefId)
      if (!group) {
        group = {
          name: exerciseDefById.get(e.exerciseDefId)?.name ?? '…',
          order: dayExerciseById.get(e.dayExerciseId)?.order ?? 0,
          sets: [],
        }
        bySetExercise.set(e.exerciseDefId, group)
      }
      group.sets.push(e.skipped ? 'Skipped' : `${e.weight}kg×${e.reps}`)
    }

    const groups = [...bySetExercise.values()].sort((a, b) => a.order - b.order)
    for (const g of groups) lines.push(`- ${g.name}: ${g.sets.join(', ')}`)
  }

  return lines.join('\n')
}

// Baut den aktuellen Trainings-/Körperdaten-Stand zusammen und überschreibt damit die eine
// Snapshot-Zeile in Supabase. Der GPT-Coach ruft diese Zeile über eine eigene, separate
// Action mit einem anderen (nie im App-Code sichtbaren) Key ab.
export async function uploadCoachSnapshot(): Promise<void> {
  const content = await buildSnapshotText()
  const { error } = await supabase
    .from('coach_snapshot')
    .upsert({ id: SNAPSHOT_ROW_ID, content, updated_at: new Date().toISOString() }, { onConflict: 'id' })
  if (error) throw error
}
