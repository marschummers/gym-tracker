import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { db, newId } from '../db/db'
import { playRestEndBeep, unlockAudio } from '../lib/sound'
import GroupedExerciseOptions from '../components/GroupedExerciseOptions'

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

export default function WorkoutPage() {
  const { planId, dayId } = useParams<{ planId: string; dayId: string }>()
  const navigate = useNavigate()

  const day = useLiveQuery(() => db.days.get(dayId!), [dayId])
  const dayExercises = useLiveQuery(
    () => db.dayExercises.where('dayId').equals(dayId!).sortBy('order'),
    [dayId],
  )
  const exerciseDefs = useLiveQuery(() => db.exerciseDefs.toArray(), [])
  const exerciseDefMap = new Map((exerciseDefs ?? []).map((e) => [e.id, e]))

  const [sessionId, setSessionId] = useState<string | null>(null)
  const session = useLiveQuery(() => (sessionId ? db.workoutSessions.get(sessionId) : undefined), [sessionId])
  const setEntries = useLiveQuery(
    () => (sessionId ? db.setEntries.where('sessionId').equals(sessionId).toArray() : []),
    [sessionId],
  )

  const [now, setNow] = useState(Date.now())
  const [restRemaining, setRestRemaining] = useState<number | null>(null)
  const restEndRef = useRef<number | null>(null)

  const [inputs, setInputs] = useState<Record<string, { weight: string; reps: string }>>({})

  // Falls für eine Übung eine Alternative gewählt wurde (z.B. Maschine belegt), gilt sie nur
  // für diese Trainingseinheit. dayExerciseId (Sätze/Pause) bleibt gleich, nur die tatsächlich
  // ausgeführte Übung ändert sich.
  const [activeExerciseId, setActiveExerciseId] = useState<Record<string, string>>({})

  // Spontane Übung, die nicht im Tag geplant war, aber gerade zusätzlich trainiert wird
  const [showAddForm, setShowAddForm] = useState(false)
  const [addSelectedId, setAddSelectedId] = useState('')
  const [addSets, setAddSets] = useState(3)
  const [addRest, setAddRest] = useState(120)

  // Werte aus der letzten Ausführung derselben Übung (egal in welchem Tag/Plan),
  // damit man beim Training sieht, was man beim letzten Mal gemacht hat.
  const lastSets = useLiveQuery(async () => {
    if (!dayExercises || dayExercises.length === 0) return {}
    const result: Record<string, { setNumber: number; weight: number; reps: number }[]> = {}
    for (const de of dayExercises) {
      const activeId = activeExerciseId[de.id] ?? de.exerciseDefId
      const entries = await db.setEntries
        .where('exerciseDefId')
        .equals(activeId)
        .filter((e) => e.sessionId !== sessionId)
        .toArray()
      if (entries.length === 0) continue
      const latestCompletedAt = Math.max(...entries.map((e) => e.completedAt))
      const latestSessionId = entries.find((e) => e.completedAt === latestCompletedAt)!.sessionId
      result[de.id] = entries
        .filter((e) => e.sessionId === latestSessionId)
        .sort((a, b) => a.setNumber - b.setNumber)
    }
    return result
  }, [dayExercises, sessionId, activeExerciseId])

  // Laufende Session für diesen Tag finden oder neue starten
  useEffect(() => {
    if (!planId || !dayId) return
    let cancelled = false
    ;(async () => {
      const existing = await db.workoutSessions
        .where('dayId')
        .equals(dayId)
        .filter((s) => s.endedAt === null)
        .first()
      if (cancelled) return
      if (existing) {
        setSessionId(existing.id)
      } else {
        const id = newId()
        await db.workoutSessions.add({ id, planId, dayId, startedAt: Date.now(), endedAt: null })
        if (!cancelled) setSessionId(id)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [planId, dayId])

  // Sekundentakt für Gesamtzeit & Pausen-Countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now())
      if (restEndRef.current !== null) {
        const remaining = restEndRef.current - Date.now()
        if (remaining <= 0) {
          setRestRemaining(null)
          restEndRef.current = null
          playRestEndBeep()
        } else {
          setRestRemaining(remaining)
        }
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  function getInput(deId: string, setNumber: number) {
    if (inputs[deId]) return inputs[deId]
    const last = lastSets?.[deId]?.find((s) => s.setNumber === setNumber)
    if (last) return { weight: String(last.weight), reps: String(last.reps) }
    return { weight: '', reps: '' }
  }

  function updateInput(deId: string, setNumber: number, field: 'weight' | 'reps', value: string) {
    setInputs((prev) => ({ ...prev, [deId]: { ...getInput(deId, setNumber), [field]: value } }))
  }

  async function logSet(deId: string, exerciseDefId: string, setNumber: number, restSeconds: number) {
    if (!sessionId) return
    unlockAudio()
    const { weight, reps } = getInput(deId, setNumber)
    await db.setEntries.add({
      id: newId(),
      sessionId,
      dayExerciseId: deId,
      exerciseDefId,
      setNumber,
      weight: Number(weight) || 0,
      reps: Number(reps) || 0,
      completedAt: Date.now(),
    })
    if (restSeconds > 0) {
      restEndRef.current = Date.now() + restSeconds * 1000
      setRestRemaining(restSeconds * 1000)
    }
  }

  async function finishWorkout() {
    if (!sessionId) return
    if (!confirm('Training beenden?')) return
    await db.workoutSessions.update(sessionId, { endedAt: Date.now() })
    navigate(`/plans/${planId}/days/${dayId}`)
  }

  async function addExerciseToWorkout() {
    if (!dayId || !addSelectedId) return

    await db.dayExercises.add({
      id: newId(),
      dayId,
      exerciseDefId: addSelectedId,
      order: dayExercises ? dayExercises.length : 0,
      targetSets: addSets,
      restSeconds: addRest,
    })

    setAddSelectedId('')
    setAddSets(3)
    setAddRest(120)
    setShowAddForm(false)
  }

  async function cancelWorkout() {
    if (!sessionId) return
    if (!confirm('Training abbrechen? Alle bisher eingetragenen Sätze dieser Einheit werden verworfen.')) return
    await db.setEntries.where('sessionId').equals(sessionId).delete()
    await db.workoutSessions.delete(sessionId)
    navigate(`/plans/${planId}/days/${dayId}`)
  }

  if (!day || !dayExercises) return null

  const elapsed = session ? now - session.startedAt : 0

  return (
    <div className="page">
      <h1>{day.name}</h1>

      <div className="timer-bar">
        <span className="timer-label">Trainingszeit</span>
        <span className="timer-value">{formatDuration(elapsed)}</span>
      </div>

      {restRemaining !== null && (
        <div className="rest-banner">Pause: {formatDuration(restRemaining)}</div>
      )}

      <div className="exercise-list">
        {dayExercises.map((de) => {
          const exerciseDef = exerciseDefMap.get(de.exerciseDefId)
          const altIds = exerciseDef?.alternativeIds ?? []
          const activeId = activeExerciseId[de.id] ?? de.exerciseDefId

          const loggedSets = (setEntries ?? []).filter((s) => s.dayExerciseId === de.id)
          const nextSetNumber = loggedSets.length + 1
          const done = nextSetNumber > de.targetSets
          const input = getInput(de.id, nextSetNumber)
          const lastForNextSet = lastSets?.[de.id]?.find((s) => s.setNumber === nextSetNumber)

          return (
            <div key={de.id} className="workout-exercise">
              <h3>{exerciseDefMap.get(activeId)?.name ?? '…'}</h3>

              {altIds.length > 0 && (
                <label className="variant-picker">
                  <span>Variante</span>
                  <select
                    value={activeId}
                    onChange={(e) =>
                      setActiveExerciseId((prev) => ({ ...prev, [de.id]: e.target.value }))
                    }
                  >
                    <option value={de.exerciseDefId}>{exerciseDef?.name}</option>
                    {altIds.map((altId) => (
                      <option key={altId} value={altId}>
                        {exerciseDefMap.get(altId)?.name ?? '…'}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {loggedSets.length > 0 && (
                <ul className="set-log">
                  {loggedSets
                    .sort((a, b) => a.setNumber - b.setNumber)
                    .map((s) => (
                      <li key={s.id}>
                        Satz {s.setNumber}: {s.weight} kg × {s.reps} Wdh.
                      </li>
                    ))}
                </ul>
              )}

              {!done ? (
                <>
                  {lastForNextSet && (
                    <p className="last-time-hint">
                      Letztes Mal: {lastForNextSet.weight} kg × {lastForNextSet.reps} Wdh.
                    </p>
                  )}
                  <div className="set-input-row">
                    <span className="set-number">Satz {nextSetNumber}/{de.targetSets}</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      placeholder="kg"
                      value={input.weight}
                      onChange={(e) => updateInput(de.id, nextSetNumber, 'weight', e.target.value)}
                    />
                    <input
                      type="number"
                      inputMode="numeric"
                      placeholder="Wdh."
                      value={input.reps}
                      onChange={(e) => updateInput(de.id, nextSetNumber, 'reps', e.target.value)}
                    />
                    <button onClick={() => logSet(de.id, activeId, nextSetNumber, de.restSeconds)}>✓</button>
                  </div>
                </>
              ) : (
                <p className="hint">Alle Sätze erledigt ✓</p>
              )}
            </div>
          )
        })}
      </div>

      {showAddForm ? (
        <div className="form-section">
          <h2>Übung hinzufügen</h2>

          <label className="field">
            <span>Übung auswählen</span>
            <select value={addSelectedId} onChange={(e) => setAddSelectedId(e.target.value)}>
              <option value="">Bitte wählen…</option>
              <GroupedExerciseOptions exerciseDefs={exerciseDefs ?? []} />
            </select>
          </label>
          <p className="hint">
            Übung fehlt? <Link to="/uebungen">Zu den Übungen →</Link>
          </p>

          <div className="field-row">
            <label className="field">
              <span>Sätze</span>
              <input
                type="number"
                min={1}
                value={addSets}
                onChange={(e) => setAddSets(Number(e.target.value))}
              />
            </label>
            <label className="field">
              <span>Pause (Sekunden)</span>
              <input
                type="number"
                min={0}
                step={5}
                value={addRest}
                onChange={(e) => setAddRest(Number(e.target.value))}
              />
            </label>
          </div>

          <div className="edit-panel-actions">
            <button className="secondary-button" onClick={() => setShowAddForm(false)}>
              Abbrechen
            </button>
            <button className="primary-button" onClick={addExerciseToWorkout} disabled={!addSelectedId}>
              Hinzufügen
            </button>
          </div>
        </div>
      ) : (
        <button className="secondary-button add-exercise-button" onClick={() => setShowAddForm(true)}>
          + Übung hinzufügen
        </button>
      )}

      <div className="workout-end-actions">
        <button className="secondary-button" onClick={cancelWorkout}>
          Abbrechen
        </button>
        <button className="primary-button finish-button" onClick={finishWorkout}>
          Training beenden
        </button>
      </div>
    </div>
  )
}
