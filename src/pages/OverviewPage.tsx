import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, Link } from 'react-router-dom'
import { db } from '../db/db'
import { findMostRecentScheduledDay, getTodayWeekday } from '../lib/weekday'
import { estimateDaySeconds, formatDurationEstimate } from '../lib/exercise'
import { toDateInputValue } from '../lib/date'
import { computeCurrentPrs, computeWeeklyProgress } from '../lib/progress'
import WeekBarChart from '../components/WeekBarChart'

const SELECTION_KEY = 'gym-tracker-home-selection'

function loadStoredSelection(): { dayId: string; dateStr: string } | null {
  try {
    const raw = localStorage.getItem(SELECTION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function storeSelection(dayId: string) {
  localStorage.setItem(SELECTION_KEY, JSON.stringify({ dayId, dateStr: toDateInputValue(new Date()) }))
}

export default function OverviewPage() {
  const navigate = useNavigate()
  const plans = useLiveQuery(() => db.plans.toArray(), [])
  const days = useLiveQuery(() => db.days.orderBy('order').toArray(), [])
  const planById = new Map((plans ?? []).map((p) => [p.id, p]))

  const [selectedDayId, setSelectedDayId] = useState<string | null>(null)

  useEffect(() => {
    if (!days || days.length === 0 || selectedDayId) return

    const today = toDateInputValue(new Date())
    const stored = loadStoredSelection()
    if (stored && stored.dateStr === today && days.some((d) => d.id === stored.dayId)) {
      setSelectedDayId(stored.dayId)
      return
    }

    const todayWeekday = getTodayWeekday()
    const weekdayMatch = findMostRecentScheduledDay(days, todayWeekday)
    const fallback = weekdayMatch ?? days[0]
    setSelectedDayId(fallback.id)
    storeSelection(fallback.id)
  }, [days, selectedDayId])

  const dayExercises = useLiveQuery(
    () => (selectedDayId ? db.dayExercises.where('dayId').equals(selectedDayId).toArray() : []),
    [selectedDayId],
  )

  const lastTrained = useLiveQuery(async () => {
    if (!selectedDayId) return null
    const sessions = await db.workoutSessions.where('dayId').equals(selectedDayId).sortBy('startedAt')
    return sessions.length > 0 ? sessions[sessions.length - 1].startedAt : null
  }, [selectedDayId])

  function selectDay(dayId: string) {
    setSelectedDayId(dayId)
    storeSelection(dayId)
  }

  const weeklyProgress = useLiveQuery(() => computeWeeklyProgress(), [])
  const prs = useLiveQuery(() => computeCurrentPrs(3), [])

  if (!plans || !days) return null

  if (days.length === 0) {
    return (
      <div className="page">
        <p className="screen-eyebrow">Heute</p>
        <h1>Kein Trainingsplan</h1>
        <p className="hint">
          Lege zuerst einen Trainingsplan mit Trainingstagen an, dann taucht dein heutiges Training hier auf.
        </p>
        <Link to="/plaene" className="start-button" style={{ display: 'block', textAlign: 'center' }}>
          Zu den Plänen
        </Link>
      </div>
    )
  }

  const selectedDay = days.find((d) => d.id === selectedDayId)
  const plan = selectedDay ? planById.get(selectedDay.planId) : undefined

  return (
    <div className="page">
      <p className="screen-eyebrow">Heute</p>

      <select
        className="home-day-select"
        value={selectedDayId ?? ''}
        onChange={(e) => selectDay(e.target.value)}
      >
        {days.map((day) => {
          const dayPlan = planById.get(day.planId)
          const label = plans.length > 1 && dayPlan ? `${dayPlan.name} – ${day.name}` : day.name
          return (
            <option key={day.id} value={day.id}>
              {label}
            </option>
          )
        })}
      </select>

      {selectedDay && plan && (
        <>
          {dayExercises && dayExercises.length > 0 && (
            <p className="day-meta">
              {dayExercises.length} Übungen · ~{formatDurationEstimate(estimateDaySeconds(dayExercises))}
            </p>
          )}
          <p className="hint home-last-trained">
            {lastTrained ? `Zuletzt trainiert: ${new Date(lastTrained).toLocaleDateString('de-DE')}` : 'Noch nicht trainiert'}
          </p>

          <button className="start-button" onClick={() => navigate(`/plans/${plan.id}/days/${selectedDay.id}/workout`)}>
            ▶ Training starten
          </button>
          <Link to={`/plans/${plan.id}/days/${selectedDay.id}`} className="back-link">
            Übungen ansehen / bearbeiten →
          </Link>
        </>
      )}

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
                    <span className="pr-delta"> +{(pr.weight - pr.previousWeight).toFixed(1)}</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {(weeklyProgress?.workoutCount ?? 0) > 0 && (
        <Link to="/statistik" className="back-link">
          Vollständigen Fortschritt ansehen →
        </Link>
      )}
    </div>
  )
}
