import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { db, newId } from '../db/db'
import { formatDate } from '../lib/date'
import { WEEKDAYS } from '../lib/weekday'
import { MUSCLE_GROUPS } from '../db/types'
import type { ExerciseDef } from '../db/types'

export default function PlanPage() {
  const { planId } = useParams<{ planId: string }>()
  const navigate = useNavigate()
  const plan = useLiveQuery(() => db.plans.get(planId!), [planId])
  const days = useLiveQuery(
    () => db.days.where('planId').equals(planId!).sortBy('order'),
    [planId],
  )
  const lastTrainedByDay = useLiveQuery(async () => {
    if (!days) return {}
    const result: Record<string, number> = {}
    for (const day of days) {
      const sessions = await db.workoutSessions.where('dayId').equals(day.id).sortBy('startedAt')
      if (sessions.length > 0) result[day.id] = sessions[sessions.length - 1].startedAt
    }
    return result
  }, [days])
  // Sätze pro Muskelgruppe über alle Tage dieses Plans, plus an wie vielen der Tage sie vorkommt
  // (angenommen, jeder Trainingstag wird einmal pro Woche durchlaufen).
  const muscleGroupStats = useLiveQuery(async () => {
    if (!days || days.length === 0) return []
    const dayIds = days.map((d) => d.id)
    const allDayExercises = await db.dayExercises.where('dayId').anyOf(dayIds).toArray()
    if (allDayExercises.length === 0) return []

    const exerciseDefIds = [...new Set(allDayExercises.map((de) => de.exerciseDefId))]
    const exerciseDefs = await db.exerciseDefs.bulkGet(exerciseDefIds)
    const exerciseDefById = new Map(
      exerciseDefs.filter((e): e is ExerciseDef => e !== undefined).map((e) => [e.id, e]),
    )

    const setsByGroup = new Map<string, number>()
    const daysByGroup = new Map<string, Set<string>>()

    for (const de of allDayExercises) {
      const category = exerciseDefById.get(de.exerciseDefId)?.category
      if (!category) continue
      setsByGroup.set(category, (setsByGroup.get(category) ?? 0) + de.targetSets)
      if (!daysByGroup.has(category)) daysByGroup.set(category, new Set())
      daysByGroup.get(category)!.add(de.dayId)
    }

    return MUSCLE_GROUPS.filter((g) => setsByGroup.has(g)).map((g) => ({
      group: g,
      sets: setsByGroup.get(g) ?? 0,
      daysPerWeek: daysByGroup.get(g)?.size ?? 0,
    }))
  }, [days])

  const [newDayName, setNewDayName] = useState('')

  async function createDay() {
    const name = newDayName.trim()
    if (!name || !planId) return
    const id = newId()
    const order = days ? days.length : 0
    await db.days.add({ id, planId, name, order })
    setNewDayName('')
  }

  async function setDayWeekday(id: string, value: string) {
    await db.days.update(id, { weekday: value === '' ? undefined : Number(value) })
  }

  async function deleteDay(id: string) {
    if (!confirm('Diesen Trainingstag wirklich löschen?')) return
    const dayExercises = await db.dayExercises.where('dayId').equals(id).toArray()
    for (const de of dayExercises) {
      await db.dayExercises.delete(de.id)
    }
    await db.days.delete(id)
  }

  if (!plan) return null

  return (
    <div className="page">
      <Link to="/plaene" className="back-link">
        ← Pläne
      </Link>
      <h1>{plan.name}</h1>
      <p className="hint">Trainingstage (z.B. Push, Pull, Legs)</p>

      <div className="card-list">
        {days?.map((day) => (
          <div key={day.id} className="card" onClick={() => navigate(`/plans/${planId}/days/${day.id}`)}>
            <div className="exercise-card-info">
              <span className="card-title">{day.name}</span>
              <span className="card-subtitle">
                {lastTrainedByDay?.[day.id]
                  ? `Zuletzt: ${formatDate(lastTrainedByDay[day.id])}`
                  : 'Noch nicht trainiert'}
              </span>
            </div>
            <select
              className="weekday-select"
              value={day.weekday ?? ''}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setDayWeekday(day.id, e.target.value)}
            >
              <option value="">–</option>
              {WEEKDAYS.map((w) => (
                <option key={w.value} value={w.value}>
                  {w.short}
                </option>
              ))}
            </select>
            <button
              className="icon-button"
              onClick={(e) => {
                e.stopPropagation()
                deleteDay(day.id)
              }}
              aria-label="Löschen"
            >
              ✕
            </button>
          </div>
        ))}
        {days && days.length === 0 && <p className="hint">Noch keine Trainingstage angelegt.</p>}
      </div>

      {muscleGroupStats && muscleGroupStats.length > 0 && (
        <div className="progress-card">
          <p className="progress-card-title">Sätze pro Muskelgruppe</p>
          <div className="muscle-stat-list">
            {muscleGroupStats.map((m) => (
              <div key={m.group} className="muscle-stat-row">
                <span className="muscle-stat-name">{m.group}</span>
                <span className="muscle-stat-value">
                  {m.sets} Sätze · {m.daysPerWeek}×/Woche
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="add-row">
        <input
          type="text"
          placeholder="Neuer Tag, z.B. Push"
          value={newDayName}
          onChange={(e) => setNewDayName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && createDay()}
        />
        <button onClick={createDay}>Anlegen</button>
      </div>
    </div>
  )
}
