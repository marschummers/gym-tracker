import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, setTargetWeight, upsertBodyWeightEntry } from '../db/db'
import {
  formatDate,
  getMonday,
  getSunday,
  toDateInputValue,
  type RangeKey,
  RANGE_OPTIONS,
  getRangeStartMs,
} from '../lib/date'
import LineChart from '../components/LineChart'
import BarSparkline from '../components/BarSparkline'
import WeekBarChart from '../components/WeekBarChart'
import { computeCurrentPrs, computeWeeklyProgress } from '../lib/progress'
import { computeCurrentWeekAverage, computeWeeklyWeightAverages } from '../lib/bodyWeight'
import { formatDurationEstimate } from '../lib/exercise'

interface ExerciseRow {
  exerciseDefId: string
  exerciseName: string
  order: number
  sets: { id: string; setNumber: number; weight: number; reps: number }[]
}

interface SessionGroup {
  sessionId: string
  dayName: string
  startedAt: number
  exercises: ExerciseRow[]
}

function formatSets(sets: { weight: number; reps: number }[]): string {
  return sets.map((s) => `${s.weight}kg×${s.reps}`).join(', ')
}

const FREQUENCY_BUCKETS = 8

export default function StatsPage() {
  const [tab, setTab] = useState<'uebersicht' | 'verlauf' | 'koerper'>('uebersicht')

  const today = new Date()
  const [dateFrom, setDateFrom] = useState(() => toDateInputValue(getMonday(today)))
  const [dateTo, setDateTo] = useState(() => toDateInputValue(getSunday(today)))
  const [isEditing, setIsEditing] = useState(false)

  const [selectedExerciseId, setSelectedExerciseId] = useState('')
  const [range, setRange] = useState<RangeKey>('12w')

  const weeklyProgress = useLiveQuery(() => computeWeeklyProgress(), [])
  const prs = useLiveQuery(() => computeCurrentPrs(5), [])

  const [weightDate, setWeightDate] = useState(() => toDateInputValue(new Date()))
  const [weightValue, setWeightValue] = useState('')
  const [targetWeightInput, setTargetWeightInput] = useState('')

  const weeklyWeightAverages = useLiveQuery(() => computeWeeklyWeightAverages(), [])
  const currentWeekWeightAvg = useLiveQuery(() => computeCurrentWeekAverage(), [])
  const appSettings = useLiveQuery(() => db.appSettings.get('singleton'), [])
  const bodyWeightEntries = useLiveQuery(
    () => db.bodyWeightEntries.orderBy('dateStr').reverse().toArray(),
    [],
  )

  useEffect(() => {
    if (appSettings?.targetWeight !== undefined) setTargetWeightInput(String(appSettings.targetWeight))
  }, [appSettings])

  async function saveWeightEntry() {
    const w = Number(weightValue)
    if (!weightDate || !weightValue || !Number.isFinite(w) || w <= 0) return
    await upsertBodyWeightEntry(weightDate, w)
    setWeightValue('')
  }

  async function saveTargetWeight() {
    const w = Number(targetWeightInput)
    await setTargetWeight(targetWeightInput === '' || !Number.isFinite(w) ? undefined : w)
  }

  const entries = useLiveQuery(async () => {
    const fromTs = new Date(`${dateFrom}T00:00:00`).getTime()
    const toTs = new Date(`${dateTo}T23:59:59.999`).getTime()
    if (Number.isNaN(fromTs) || Number.isNaN(toTs)) return []

    const sessions = await db.workoutSessions.where('startedAt').between(fromTs, toTs, true, true).toArray()
    if (sessions.length === 0) return []

    const sessionById = new Map(sessions.map((s) => [s.id, s]))
    const sessionIds = new Set(sessions.map((s) => s.id))

    const allSetEntries = await db.setEntries
      .toCollection()
      .filter((e) => sessionIds.has(e.sessionId))
      .toArray()

    const dayExerciseIds = [...new Set(allSetEntries.map((e) => e.dayExerciseId))]
    const dayExercises = await db.dayExercises.bulkGet(dayExerciseIds)
    const dayExerciseById = new Map(dayExercises.filter((d) => d !== undefined).map((d) => [d.id, d]))

    const exerciseDefIds = [...new Set(allSetEntries.map((e) => e.exerciseDefId))]
    const exerciseDefs = await db.exerciseDefs.bulkGet(exerciseDefIds)
    const exerciseDefById = new Map(exerciseDefs.filter((e) => e !== undefined).map((e) => [e.id, e]))

    const dayIds = [...new Set(sessions.map((s) => s.dayId))]
    const days = await db.days.bulkGet(dayIds)
    const dayById = new Map(days.filter((d) => d !== undefined).map((d) => [d.id, d]))

    const groups = new Map<string, SessionGroup>()
    for (const e of allSetEntries) {
      let sessionGroup = groups.get(e.sessionId)
      if (!sessionGroup) {
        const session = sessionById.get(e.sessionId)!
        sessionGroup = {
          sessionId: e.sessionId,
          dayName: dayById.get(session.dayId)?.name ?? '…',
          startedAt: session.startedAt,
          exercises: [],
        }
        groups.set(e.sessionId, sessionGroup)
      }

      let exerciseRow = sessionGroup.exercises.find((ex) => ex.exerciseDefId === e.exerciseDefId)
      if (!exerciseRow) {
        exerciseRow = {
          exerciseDefId: e.exerciseDefId,
          exerciseName: exerciseDefById.get(e.exerciseDefId)?.name ?? '…',
          order: dayExerciseById.get(e.dayExerciseId)?.order ?? 0,
          sets: [],
        }
        sessionGroup.exercises.push(exerciseRow)
      }
      exerciseRow.sets.push({ id: e.id, setNumber: e.setNumber, weight: e.weight, reps: e.reps })
    }

    const result = [...groups.values()]
    for (const g of result) {
      g.exercises.sort((a, b) => a.order - b.order)
      for (const ex of g.exercises) ex.sets.sort((a, b) => a.setNumber - b.setNumber)
    }
    result.sort((a, b) => a.startedAt - b.startedAt)
    return result
  }, [dateFrom, dateTo])

  // Übungen, die schon mindestens einmal ausgeführt wurden (für die Auswahl im Verlauf-Tab)
  const exerciseOptions = useLiveQuery(async () => {
    const allEntries = await db.setEntries.toArray()
    if (allEntries.length === 0) return []
    const defIds = [...new Set(allEntries.map((e) => e.exerciseDefId))]
    const defs = await db.exerciseDefs.bulkGet(defIds)
    return defs
      .filter((d) => d !== undefined)
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [])

  useEffect(() => {
    if (!selectedExerciseId && exerciseOptions && exerciseOptions.length > 0) {
      setSelectedExerciseId(exerciseOptions[0].id)
    }
  }, [exerciseOptions, selectedExerciseId])

  // Gewichtsverlauf (höchstes Gewicht je Trainingseinheit) für die gewählte Übung
  const weightHistory = useLiveQuery(async () => {
    if (!selectedExerciseId) return []
    const rangeStart = getRangeStartMs(range)

    const relatedEntries = await db.setEntries.where('exerciseDefId').equals(selectedExerciseId).toArray()
    if (relatedEntries.length === 0) return []

    const sessionIds = [...new Set(relatedEntries.map((e) => e.sessionId))]
    const sessions = await db.workoutSessions.bulkGet(sessionIds)
    const sessionById = new Map(sessions.filter((s) => s !== undefined).map((s) => [s.id, s]))

    const maxBySession = new Map<string, number>()
    for (const e of relatedEntries) {
      const session = sessionById.get(e.sessionId)
      if (!session) continue
      if (rangeStart !== null && session.startedAt < rangeStart) continue
      const current = maxBySession.get(e.sessionId) ?? 0
      if (e.weight > current) maxBySession.set(e.sessionId, e.weight)
    }

    return [...maxBySession.entries()]
      .map(([sessionId, weight]) => ({ x: sessionById.get(sessionId)!.startedAt, y: weight }))
      .sort((a, b) => a.x - b.x)
  }, [selectedExerciseId, range])

  // Gesamtvolumen + Trainingshäufigkeit über alle Übungen im gewählten Zeitraum
  const overview = useLiveQuery(async () => {
    const rangeStart = getRangeStartMs(range)
    const now = Date.now()

    const allSessions = await db.workoutSessions.toArray()
    const inRange = allSessions.filter((s) => rangeStart === null || s.startedAt >= rangeStart)
    const sessionIdsInRange = new Set(inRange.map((s) => s.id))

    const allEntries = await db.setEntries.toArray()
    const entriesInRange = allEntries.filter((e) => sessionIdsInRange.has(e.sessionId))
    const totalVolume = entriesInRange.reduce((sum, e) => sum + e.weight * e.reps, 0)

    let volumeChangePct: number | null = null
    if (rangeStart !== null) {
      const periodLength = now - rangeStart
      const prevStart = rangeStart - periodLength
      const prevSessions = allSessions.filter((s) => s.startedAt >= prevStart && s.startedAt < rangeStart)
      const prevSessionIds = new Set(prevSessions.map((s) => s.id))
      const prevVolume = allEntries
        .filter((e) => prevSessionIds.has(e.sessionId))
        .reduce((sum, e) => sum + e.weight * e.reps, 0)
      if (prevVolume > 0) volumeChangePct = ((totalVolume - prevVolume) / prevVolume) * 100
    }

    const bucketStart = rangeStart ?? Math.min(now, ...(inRange.length ? inRange.map((s) => s.startedAt) : [now]))
    const span = Math.max(now - bucketStart, 1)
    const bucketSize = span / FREQUENCY_BUCKETS
    const buckets = new Array(FREQUENCY_BUCKETS).fill(0)
    for (const s of inRange) {
      if (s.startedAt < bucketStart) continue
      const idx = Math.min(FREQUENCY_BUCKETS - 1, Math.floor((s.startedAt - bucketStart) / bucketSize))
      buckets[idx]++
    }

    const spanDays = Math.max(1, span / (24 * 60 * 60 * 1000))
    const perWeekAvg = inRange.length / (spanDays / 7)

    return {
      totalVolume,
      volumeChangePct,
      workoutCount: inRange.length,
      perWeekAvg,
      buckets,
    }
  }, [range])

  function resetToCurrentWeek() {
    const now = new Date()
    setDateFrom(toDateInputValue(getMonday(now)))
    setDateTo(toDateInputValue(getSunday(now)))
  }

  async function deleteEntry(sessionId: string, exerciseDefId: string) {
    if (!confirm('Diese Übung aus der Historie löschen?')) return
    const matching = await db.setEntries
      .where('sessionId')
      .equals(sessionId)
      .filter((e) => e.exerciseDefId === exerciseDefId)
      .toArray()
    await db.setEntries.bulkDelete(matching.map((e) => e.id))
  }

  function exportAsText() {
    if (!entries || entries.length === 0) return
    const lines: string[] = []
    lines.push(`Trainingsübersicht ${dateFrom} bis ${dateTo}`)
    lines.push('')
    for (const group of entries) {
      lines.push(`${group.dayName} · ${formatDate(group.startedAt)}`)
      for (const ex of group.exercises) {
        lines.push(`- ${ex.exerciseName}: ${formatSets(ex.sets)}`)
      }
      lines.push('')
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `training-${dateFrom}-bis-${dateTo}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="page">
      <div className="page-header-row">
        <h1>Fortschritt</h1>
        {tab === 'uebersicht' && (
          <button className="edit-toggle" onClick={() => setIsEditing((v) => !v)}>
            {isEditing ? 'Fertig' : '⋯'}
          </button>
        )}
      </div>

      <div className="sub-tabs">
        <button className={tab === 'uebersicht' ? 'active' : ''} onClick={() => setTab('uebersicht')}>
          Übersicht
        </button>
        <button className={tab === 'verlauf' ? 'active' : ''} onClick={() => setTab('verlauf')}>
          Verlauf
        </button>
        <button className={tab === 'koerper' ? 'active' : ''} onClick={() => setTab('koerper')}>
          Körper
        </button>
      </div>

      {tab === 'uebersicht' && (
        <>
          {weeklyProgress && weeklyProgress.workoutCount > 0 && (
            <div className="progress-card">
              <p className="progress-card-title">Diese Woche</p>
              <div className="week-stat-trio">
                <div className="week-stat">
                  <span className="week-stat-value">{weeklyProgress.workoutCount}</span>
                  <span className="week-stat-label">Workouts</span>
                </div>
                <div className="week-stat">
                  <span className="week-stat-value">
                    {Math.round(weeklyProgress.totalVolume).toLocaleString('de-DE')}
                  </span>
                  <span className="week-stat-label">Volumen (kg)</span>
                </div>
                <div className="week-stat">
                  <span className="week-stat-value">
                    {formatDurationEstimate(weeklyProgress.totalDurationMs / 1000)}
                  </span>
                  <span className="week-stat-label">Dauer</span>
                </div>
              </div>
              <WeekBarChart values={weeklyProgress.dailyVolume} color="var(--accent)" />
            </div>
          )}

          {prs && prs.length > 0 && (
            <div className="progress-card">
              <p className="progress-card-title">Aktuelle PRs</p>
              <div className="pr-list">
                {prs.map((pr) => (
                  <div key={pr.exerciseDefId} className="pr-row">
                    <span className="pr-name">{pr.exerciseName}</span>
                    <span className="pr-value">
                      {pr.weight} kg
                      {pr.previousWeight !== null && (
                        <span className="pr-delta">
                          {' '}
                          +{(pr.weight - pr.previousWeight).toFixed(1)}
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="form-section date-range-section">
            <div className="field-row">
              <label className="field date-field">
                <span>Von</span>
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              </label>
              <label className="field date-field">
                <span>Bis</span>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </label>
            </div>
            <div className="field-row">
              <button className="secondary-button" onClick={resetToCurrentWeek}>
                Aktuelle Woche
              </button>
              <button className="secondary-button" onClick={exportAsText} disabled={!entries || entries.length === 0}>
                Als Datei exportieren
              </button>
            </div>
          </div>

          <div className="stats-list">
            {entries?.map((group) => (
              <div key={group.sessionId} className="stats-day-group">
                <h3 className="stats-day-heading">
                  {group.dayName} · {formatDate(group.startedAt)}
                </h3>
                {group.exercises.map((ex) => (
                  <div key={ex.exerciseDefId} className="stats-exercise-row">
                    <span className="stats-exercise-name">{ex.exerciseName}</span>
                    <span className="stats-exercise-sets">{formatSets(ex.sets)}</span>
                    {isEditing && (
                      <button
                        className="icon-button stats-delete-button"
                        onClick={() => deleteEntry(group.sessionId, ex.exerciseDefId)}
                        aria-label="Löschen"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ))}
            {entries && entries.length === 0 && <p className="hint">Keine Trainings in diesem Zeitraum.</p>}
          </div>
        </>
      )}

      {tab === 'verlauf' && (
        <>
          <label className="field">
            <span>Übung</span>
            <select value={selectedExerciseId} onChange={(e) => setSelectedExerciseId(e.target.value)}>
              {exerciseOptions?.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.name}
                </option>
              ))}
            </select>
          </label>

          {exerciseOptions && exerciseOptions.length === 0 ? (
            <p className="hint">Noch keine Trainings protokolliert.</p>
          ) : (
            <>
              <div className="range-tabs">
                {RANGE_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    className={range === opt.key ? 'active' : ''}
                    onClick={() => setRange(opt.key)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <div className="progress-card">
                <p className="progress-card-title">Maximales Gewicht</p>
                <LineChart points={weightHistory ?? []} color="var(--accent)" unit=" kg" />
              </div>

              {overview && (
                <div className="progress-stat-row">
                  <div className="progress-card progress-stat">
                    <p className="progress-card-title">Volumen</p>
                    <p className="progress-stat-value">{Math.round(overview.totalVolume).toLocaleString('de-DE')} kg</p>
                    {overview.volumeChangePct !== null && (
                      <p className={`progress-trend ${overview.volumeChangePct >= 0 ? 'up' : 'down'}`}>
                        {overview.volumeChangePct >= 0 ? '▲' : '▼'} {Math.abs(overview.volumeChangePct).toFixed(1)}%
                      </p>
                    )}
                  </div>
                  <div className="progress-card progress-stat">
                    <p className="progress-card-title">Trainingshäufigkeit</p>
                    <p className="progress-stat-value">{overview.workoutCount} Workouts</p>
                    <p className="progress-stat-sub">Ø {overview.perWeekAvg.toFixed(1)} / Woche</p>
                    <BarSparkline values={overview.buckets} color="var(--accent-2)" />
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {tab === 'koerper' && (
        <>
          <div className="form-section">
            <h2>Gewicht eintragen</h2>
            <div className="field-row">
              <label className="field date-field">
                <span>Datum</span>
                <input type="date" value={weightDate} onChange={(e) => setWeightDate(e.target.value)} />
              </label>
              <label className="field">
                <span>Gewicht (kg)</span>
                <input
                  type="number"
                  step="0.1"
                  inputMode="decimal"
                  placeholder="83.4"
                  value={weightValue}
                  onChange={(e) => setWeightValue(e.target.value)}
                />
              </label>
            </div>
            <button className="primary-button" onClick={saveWeightEntry} disabled={!weightValue}>
              Speichern
            </button>
          </div>

          <div className="progress-stat-row">
            <div className="progress-card progress-stat">
              <p className="progress-card-title">Ø diese Woche</p>
              <p className="progress-stat-value">
                {currentWeekWeightAvg != null ? `${currentWeekWeightAvg.toFixed(1)} kg` : '–'}
              </p>
            </div>
            <div className="progress-card progress-stat">
              <p className="progress-card-title">Zielgewicht</p>
              <div className="target-weight-row">
                <input
                  type="number"
                  step="0.1"
                  inputMode="decimal"
                  placeholder="kg"
                  value={targetWeightInput}
                  onChange={(e) => setTargetWeightInput(e.target.value)}
                  onBlur={saveTargetWeight}
                />
              </div>
              {appSettings?.targetWeight !== undefined &&
                currentWeekWeightAvg != null &&
                (() => {
                  const diff = currentWeekWeightAvg - appSettings.targetWeight
                  if (Math.abs(diff) < 0.05) return <p className="progress-stat-sub">Ziel erreicht</p>
                  return (
                    <p className="progress-stat-sub">
                      {Math.abs(diff).toFixed(1)} kg {diff > 0 ? 'über' : 'unter'} dem Ziel
                    </p>
                  )
                })()}
            </div>
          </div>

          <div className="progress-card">
            <p className="progress-card-title">Wochendurchschnitt-Verlauf</p>
            <LineChart points={weeklyWeightAverages ?? []} color="var(--accent-2)" unit=" kg" />
          </div>

          {bodyWeightEntries && bodyWeightEntries.length > 0 && (
            <div className="progress-card">
              <p className="progress-card-title">Einträge</p>
              <div className="pr-list">
                {bodyWeightEntries.map((entry) => (
                  <div key={entry.id} className="pr-row">
                    <span className="pr-name">
                      {formatDate(new Date(`${entry.dateStr}T00:00:00`).getTime())}
                    </span>
                    <span className="pr-value">{entry.weight} kg</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
