import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { db, newId } from '../db/db'

export default function PlansPage() {
  const navigate = useNavigate()
  const plans = useLiveQuery(() => db.plans.orderBy('createdAt').reverse().toArray(), [])
  const [newPlanName, setNewPlanName] = useState('')

  async function createPlan() {
    const name = newPlanName.trim()
    if (!name) return
    const id = newId()
    await db.plans.add({ id, name, createdAt: Date.now() })
    setNewPlanName('')
    navigate(`/plans/${id}`)
  }

  async function deletePlan(id: string) {
    if (!confirm('Diesen Trainingsplan wirklich löschen? Alle Tage und Übungen darin werden ebenfalls gelöscht.')) return
    const days = await db.days.where('planId').equals(id).toArray()
    for (const day of days) {
      const dayExercises = await db.dayExercises.where('dayId').equals(day.id).toArray()
      for (const de of dayExercises) {
        await db.dayExercises.delete(de.id)
      }
      await db.days.delete(day.id)
    }
    await db.plans.delete(id)
  }

  return (
    <div className="page">
      <h1>Trainingspläne</h1>

      <div className="card-list">
        {plans?.map((plan) => (
          <div key={plan.id} className="card" onClick={() => navigate(`/plans/${plan.id}`)}>
            <span className="card-title">{plan.name}</span>
            <button
              className="icon-button"
              onClick={(e) => {
                e.stopPropagation()
                deletePlan(plan.id)
              }}
              aria-label="Löschen"
            >
              ✕
            </button>
          </div>
        ))}
        {plans && plans.length === 0 && <p className="hint">Noch keine Trainingspläne angelegt.</p>}
      </div>

      <div className="add-row">
        <input
          type="text"
          placeholder="Neuer Plan, z.B. Push Pull Legs"
          value={newPlanName}
          onChange={(e) => setNewPlanName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && createPlan()}
        />
        <button onClick={createPlan}>Anlegen</button>
      </div>
    </div>
  )
}
