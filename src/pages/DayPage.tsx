import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams, Link } from 'react-router-dom'
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { db, newId } from '../db/db'
import type { DayExercise } from '../db/types'
import MuscleGroupIcon from '../components/MuscleGroupIcon'
import GroupedExerciseOptions from '../components/GroupedExerciseOptions'
import { estimateDaySeconds, formatDurationEstimate, getEquipmentTag } from '../lib/exercise'

function SortableExerciseCard({
  de,
  name,
  onEdit,
  onRemove,
}: {
  de: DayExercise
  name: string
  onEdit: () => void
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: de.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="card exercise-card">
      <button className="drag-handle" {...attributes} {...listeners} aria-label="Verschieben">
        ☰
      </button>
      <div className="exercise-card-info">
        <span className="card-title">{name}</span>
        <span className="card-subtitle">
          {de.targetSets} Sätze · {de.restSeconds}s Pause
        </span>
      </div>
      <div className="card-actions">
        <button className="icon-button" onClick={onEdit} aria-label="Bearbeiten">
          ⋯
        </button>
        <button className="icon-button" onClick={onRemove} aria-label="Entfernen">
          ✕
        </button>
      </div>
    </div>
  )
}

export default function DayPage() {
  const { planId, dayId } = useParams<{ planId: string; dayId: string }>()
  const navigate = useNavigate()
  const day = useLiveQuery(() => db.days.get(dayId!), [dayId])
  const dayExercises = useLiveQuery(
    () => db.dayExercises.where('dayId').equals(dayId!).sortBy('order'),
    [dayId],
  )
  const exerciseDefs = useLiveQuery(() => db.exerciseDefs.toArray(), [])
  const exerciseDefMap = new Map((exerciseDefs ?? []).map((e) => [e.id, e]))

  const [isEditingDay, setIsEditingDay] = useState(false)

  const [selectedExerciseId, setSelectedExerciseId] = useState('')
  const [targetSets, setTargetSets] = useState(3)
  const [restSeconds, setRestSeconds] = useState(120)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editSets, setEditSets] = useState(3)
  const [editRest, setEditRest] = useState(90)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  function toggleEditingDay() {
    setIsEditingDay((v) => !v)
    setEditingId(null)
  }

  async function addExerciseToDay() {
    if (!dayId || !selectedExerciseId) return

    const order = dayExercises ? dayExercises.length : 0
    await db.dayExercises.add({
      id: newId(),
      dayId,
      exerciseDefId: selectedExerciseId,
      order,
      targetSets,
      restSeconds,
    })

    setSelectedExerciseId('')
    setTargetSets(3)
    setRestSeconds(120)
  }

  async function removeExercise(id: string) {
    if (!confirm('Diese Übung aus dem Tag entfernen?')) return
    if (editingId === id) setEditingId(null)
    await db.dayExercises.delete(id)
  }

  function startEditing(id: string, currentSets: number, currentRest: number) {
    setEditingId(id)
    setEditSets(currentSets)
    setEditRest(currentRest)
  }

  async function saveEditing(id: string) {
    await db.dayExercises.update(id, { targetSets: editSets, restSeconds: editRest })
    setEditingId(null)
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id || !dayExercises) return
    const oldIndex = dayExercises.findIndex((d) => d.id === active.id)
    const newIndex = dayExercises.findIndex((d) => d.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const reordered = arrayMove(dayExercises, oldIndex, newIndex)
    await db.transaction('rw', db.dayExercises, async () => {
      for (let i = 0; i < reordered.length; i++) {
        await db.dayExercises.update(reordered[i].id, { order: i })
      }
    })
  }

  if (!day) return null

  return (
    <div className="page">
      <Link to={`/plans/${planId}`} className="back-link">
        ← Zurück
      </Link>
      <p className="screen-eyebrow">Trainingstag</p>
      <div className="page-header-row">
        <h1>{day.name}</h1>
        <button className="edit-toggle" onClick={toggleEditingDay}>
          {isEditingDay ? 'Fertig' : '✏️ Bearbeiten'}
        </button>
      </div>
      {dayExercises && dayExercises.length > 0 && (
        <p className="day-meta">
          {dayExercises.length} Übungen · ~{formatDurationEstimate(estimateDaySeconds(dayExercises))}
        </p>
      )}

      <div className="card-list">
        {isEditingDay ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext
              items={(dayExercises ?? []).map((d) => d.id)}
              strategy={verticalListSortingStrategy}
            >
              {dayExercises?.map((de) => (
                <div key={de.id} className="exercise-card-wrap">
                  <SortableExerciseCard
                    de={de}
                    name={exerciseDefMap.get(de.exerciseDefId)?.name ?? '…'}
                    onEdit={() => startEditing(de.id, de.targetSets, de.restSeconds)}
                    onRemove={() => removeExercise(de.id)}
                  />

                  {editingId === de.id && (
                    <div className="edit-panel">
                      <div className="field-row">
                        <label className="field">
                          <span>Sätze</span>
                          <input
                            type="number"
                            min={1}
                            value={editSets}
                            onChange={(e) => setEditSets(Number(e.target.value))}
                          />
                        </label>
                        <label className="field">
                          <span>Pause (Sekunden)</span>
                          <input
                            type="number"
                            min={0}
                            step={5}
                            value={editRest}
                            onChange={(e) => setEditRest(Number(e.target.value))}
                          />
                        </label>
                      </div>
                      <div className="edit-panel-actions">
                        <button className="secondary-button" onClick={() => setEditingId(null)}>
                          Abbrechen
                        </button>
                        <button className="primary-button" onClick={() => saveEditing(de.id)}>
                          Speichern
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </SortableContext>
          </DndContext>
        ) : (
          dayExercises?.map((de) => {
            const exerciseDef = exerciseDefMap.get(de.exerciseDefId)
            const name = exerciseDef?.name ?? '…'
            const equipmentTag = exerciseDef ? getEquipmentTag(exerciseDef.name) : null
            return (
              <div key={de.id} className="training-row">
                <span className="training-icon">
                  <MuscleGroupIcon category={exerciseDef?.category} />
                </span>
                <div className="training-row-info">
                  <span className="card-title">
                    {name}
                    {equipmentTag && <span className="training-equipment"> ({equipmentTag})</span>}
                  </span>
                  <span className="card-subtitle">{de.targetSets} Arbeitssätze</span>
                </div>
                <span className="training-row-check">✓</span>
              </div>
            )
          })
        )}
        {dayExercises && dayExercises.length === 0 && <p className="hint">Noch keine Übungen hinzugefügt.</p>}
      </div>

      {!isEditingDay && dayExercises && dayExercises.length > 0 && (
        <button className="start-button" onClick={() => navigate(`/plans/${planId}/days/${dayId}/workout`)}>
          ▶ Training starten
        </button>
      )}

      {isEditingDay && (
        <div className="form-section">
          <h2>Übung hinzufügen</h2>

          <label className="field">
            <span>Übung auswählen</span>
            <select value={selectedExerciseId} onChange={(e) => setSelectedExerciseId(e.target.value)}>
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
                value={targetSets}
                onChange={(e) => setTargetSets(Number(e.target.value))}
              />
            </label>
            <label className="field">
              <span>Pause (Sekunden)</span>
              <input
                type="number"
                min={0}
                step={5}
                value={restSeconds}
                onChange={(e) => setRestSeconds(Number(e.target.value))}
              />
            </label>
          </div>

          <button className="primary-button" onClick={addExerciseToDay} disabled={!selectedExerciseId}>
            Hinzufügen
          </button>
        </div>
      )}
    </div>
  )
}
