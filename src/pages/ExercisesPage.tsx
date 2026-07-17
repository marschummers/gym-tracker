import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, newId, addAlternativeExercise, removeAlternativeExercise } from '../db/db'
import { MUSCLE_GROUPS } from '../db/types'
import type { MuscleGroup } from '../db/types'
import MuscleGroupIcon from '../components/MuscleGroupIcon'
import GroupedExerciseOptions from '../components/GroupedExerciseOptions'

export default function ExercisesPage() {
  const exerciseDefs = useLiveQuery(() => db.exerciseDefs.toArray(), [])
  const exerciseDefMap = new Map((exerciseDefs ?? []).map((e) => [e.id, e]))

  const [newName, setNewName] = useState('')
  const [newCategory, setNewCategory] = useState<MuscleGroup | ''>('')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editCategory, setEditCategory] = useState<MuscleGroup | ''>('')
  const [altPickerValue, setAltPickerValue] = useState('')

  async function createExercise() {
    const name = newName.trim()
    if (!name) return
    await db.exerciseDefs.add({ id: newId(), name, category: newCategory || undefined })
    setNewName('')
    setNewCategory('')
  }

  function startEditing(id: string) {
    const ex = exerciseDefMap.get(id)
    if (!ex) return
    setEditingId(id)
    setEditName(ex.name)
    setEditCategory(ex.category ?? '')
    setAltPickerValue('')
  }

  async function saveEditing(id: string) {
    const name = editName.trim()
    if (!name) return
    await db.exerciseDefs.update(id, { name, category: editCategory || undefined })
    setEditingId(null)
  }

  async function linkAlternative(id: string) {
    if (!altPickerValue) return
    await addAlternativeExercise(id, altPickerValue)
    setAltPickerValue('')
  }

  async function deleteExercise(id: string) {
    const usageCount = await db.dayExercises.where('exerciseDefId').equals(id).count()
    if (usageCount > 0) {
      alert('Diese Übung wird noch in mindestens einem Trainingstag verwendet. Entferne sie dort zuerst.')
      return
    }
    if (!confirm('Diese Übung endgültig aus der Bibliothek löschen?')) return

    const ex = exerciseDefMap.get(id)
    await db.transaction('rw', db.exerciseDefs, async () => {
      for (const altId of ex?.alternativeIds ?? []) {
        const alt = await db.exerciseDefs.get(altId)
        if (alt) {
          await db.exerciseDefs.update(altId, {
            alternativeIds: (alt.alternativeIds ?? []).filter((i) => i !== id),
          })
        }
      }
      await db.exerciseDefs.delete(id)
    })
    if (editingId === id) setEditingId(null)
  }

  const uncategorized = (exerciseDefs ?? []).filter((e) => !e.category)

  function renderExerciseRow(ex: { id: string; name: string; category?: MuscleGroup }) {
    return (
      <div key={ex.id} className="exercise-card-wrap">
        <div className="card exercise-card">
          <span className="training-icon">
            <MuscleGroupIcon category={ex.category} />
          </span>
          <div className="exercise-card-info">
            <span className="card-title">{ex.name}</span>
          </div>
          <button className="icon-button" onClick={() => startEditing(ex.id)} aria-label="Bearbeiten">
            ⋯
          </button>
        </div>

        {editingId === ex.id && (
          <div className="edit-panel">
            <label className="field">
              <span>Name</span>
              <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} />
            </label>
            <label className="field">
              <span>Muskelgruppe</span>
              <select value={editCategory} onChange={(e) => setEditCategory(e.target.value as MuscleGroup | '')}>
                <option value="">— Keine —</option>
                {MUSCLE_GROUPS.map((group) => (
                  <option key={group} value={group}>
                    {group}
                  </option>
                ))}
              </select>
            </label>

            <div className="edit-panel-actions">
              <button className="secondary-button" onClick={() => setEditingId(null)}>
                Abbrechen
              </button>
              <button className="primary-button" onClick={() => saveEditing(ex.id)}>
                Speichern
              </button>
            </div>

            <div className="alt-section">
              <span className="field-label">
                Alternativübungen <span className="field-hint">(z.B. andere Maschine, falls belegt)</span>
              </span>
              {exerciseDefMap.get(ex.id)?.alternativeIds?.length ? (
                <div className="alt-chip-list">
                  {exerciseDefMap.get(ex.id)!.alternativeIds!.map((altId) => (
                    <span key={altId} className="alt-chip">
                      {exerciseDefMap.get(altId)?.name ?? '…'}
                      <button onClick={() => removeAlternativeExercise(ex.id, altId)} aria-label="Alternative entfernen">
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}
              <div className="field-row alt-picker-row">
                <select value={altPickerValue} onChange={(e) => setAltPickerValue(e.target.value)}>
                  <option value="">Übung wählen…</option>
                  <GroupedExerciseOptions
                    exerciseDefs={exerciseDefs ?? []}
                    exclude={new Set([ex.id, ...(exerciseDefMap.get(ex.id)?.alternativeIds ?? [])])}
                  />
                </select>
                <button className="secondary-button" onClick={() => linkAlternative(ex.id)} disabled={!altPickerValue}>
                  Hinzufügen
                </button>
              </div>
            </div>

            <button className="delete-exercise-button" onClick={() => deleteExercise(ex.id)}>
              Übung löschen
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="page">
      <h1>Übungen</h1>
      <p className="hint">Deine Übungsbibliothek. Neue Übungen hier anlegen, überall sonst nur auswählen.</p>

      <div className="form-section">
        <h2>Neue Übung</h2>
        <label className="field">
          <span>Name</span>
          <input
            type="text"
            placeholder="z.B. Bankdrücken"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && createExercise()}
          />
        </label>
        <label className="field">
          <span>Muskelgruppe</span>
          <select value={newCategory} onChange={(e) => setNewCategory(e.target.value as MuscleGroup | '')}>
            <option value="">— Keine —</option>
            {MUSCLE_GROUPS.map((group) => (
              <option key={group} value={group}>
                {group}
              </option>
            ))}
          </select>
        </label>
        <button className="primary-button" onClick={createExercise}>
          Anlegen
        </button>
      </div>

      <div className="card-list">
        {MUSCLE_GROUPS.map((group) => {
          const inGroup = (exerciseDefs ?? []).filter((e) => e.category === group)
          if (inGroup.length === 0) return null
          return (
            <div key={group}>
              <p className="screen-eyebrow">{group}</p>
              {inGroup.map((ex) => renderExerciseRow(ex))}
            </div>
          )
        })}
        {uncategorized.length > 0 && (
          <div>
            <p className="screen-eyebrow">Eigene Übungen</p>
            {uncategorized.map((ex) => renderExerciseRow(ex))}
          </div>
        )}
      </div>
    </div>
  )
}
