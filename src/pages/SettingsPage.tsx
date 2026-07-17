import { useRef, useState } from 'react'
import { cleanupEmptySessions, db } from '../db/db'

const EXPORT_VERSION = 1

async function exportData() {
  const [exerciseDefs, plans, days, dayExercises, workoutSessions, setEntries, bodyWeightEntries, appSettings] =
    await Promise.all([
      db.exerciseDefs.toArray(),
      db.plans.toArray(),
      db.days.toArray(),
      db.dayExercises.toArray(),
      db.workoutSessions.toArray(),
      db.setEntries.toArray(),
      db.bodyWeightEntries.toArray(),
      db.appSettings.toArray(),
    ])

  const data = {
    version: EXPORT_VERSION,
    exportedAt: Date.now(),
    exerciseDefs,
    plans,
    days,
    dayExercises,
    workoutSessions,
    setEntries,
    bodyWeightEntries,
    appSettings,
  }

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const date = new Date().toISOString().slice(0, 10)
  a.href = url
  a.download = `gym-tracker-backup-${date}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export default function SettingsPage() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [cleanupStatus, setCleanupStatus] = useState<string | null>(null)

  async function handleCleanupNow() {
    const removed = await cleanupEmptySessions(0)
    setCleanupStatus(
      removed === 0
        ? 'Keine leeren Trainingseinheiten gefunden.'
        : `${removed} leere Trainingseinheit${removed === 1 ? '' : 'en'} entfernt.`,
    )
  }

  async function handleImportFile(file: File) {
    const text = await file.text()
    let data: any
    try {
      data = JSON.parse(text)
    } catch {
      setStatus('Fehler: Die Datei ist keine gültige Backup-Datei.')
      return
    }

    const requiredKeys = ['exerciseDefs', 'plans', 'days', 'dayExercises', 'workoutSessions', 'setEntries']
    if (!requiredKeys.every((k) => Array.isArray(data[k]))) {
      setStatus('Fehler: Die Datei hat nicht das erwartete Format.')
      return
    }
    // Ältere Backups kennen diese Tabellen noch nicht.
    const bodyWeightEntries = Array.isArray(data.bodyWeightEntries) ? data.bodyWeightEntries : []
    const appSettings = Array.isArray(data.appSettings) ? data.appSettings : []

    const replace = confirm(
      'Import: "OK" ersetzt ALLE aktuellen Daten durch den Inhalt dieser Datei.\n"Abbrechen" bricht den Import ab.',
    )
    if (!replace) return

    await db.transaction(
      'rw',
      [
        db.exerciseDefs,
        db.plans,
        db.days,
        db.dayExercises,
        db.workoutSessions,
        db.setEntries,
        db.bodyWeightEntries,
        db.appSettings,
      ],
      async () => {
        await Promise.all([
          db.exerciseDefs.clear(),
          db.plans.clear(),
          db.days.clear(),
          db.dayExercises.clear(),
          db.workoutSessions.clear(),
          db.setEntries.clear(),
          db.bodyWeightEntries.clear(),
          db.appSettings.clear(),
        ])
        await Promise.all([
          db.exerciseDefs.bulkAdd(data.exerciseDefs),
          db.plans.bulkAdd(data.plans),
          db.days.bulkAdd(data.days),
          db.dayExercises.bulkAdd(data.dayExercises),
          db.workoutSessions.bulkAdd(data.workoutSessions),
          db.setEntries.bulkAdd(data.setEntries),
          bodyWeightEntries.length > 0 ? db.bodyWeightEntries.bulkAdd(bodyWeightEntries) : Promise.resolve(),
          appSettings.length > 0 ? db.appSettings.bulkAdd(appSettings) : Promise.resolve(),
        ])
      },
    )

    setStatus('Import erfolgreich. Deine Daten wurden ersetzt.')
  }

  return (
    <div className="page">
      <h1>Einstellungen</h1>

      <div className="form-section">
        <h2>Daten sichern / übertragen</h2>
        <p className="hint">
          Exportiere alle deine Trainingspläne und Verläufe als Datei, um sie zu sichern oder auf ein
          neues Gerät zu übertragen.
        </p>
        <button className="primary-button" onClick={exportData}>
          Export (Backup-Datei herunterladen)
        </button>
      </div>

      <div className="form-section">
        <h2>Daten importieren</h2>
        <p className="hint">
          Achtung: Der Import ersetzt alle aktuell auf diesem Gerät gespeicherten Daten.
        </p>
        <button
          className="primary-button"
          onClick={() => fileInputRef.current?.click()}
        >
          Backup-Datei auswählen
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleImportFile(file)
            e.target.value = ''
          }}
        />
        {status && <p className="hint">{status}</p>}
      </div>

      <div className="form-section">
        <h2>Wartung</h2>
        <p className="hint">
          Trainingseinheiten, die gestartet, aber nie beendet oder mit Sätzen befüllt wurden (z.B. "Training
          starten" angetippt und direkt wieder verlassen), werden automatisch nach einer Stunde entfernt. Hier
          kannst du das sofort auslösen, statt zu warten.
        </p>
        <button className="secondary-button" onClick={handleCleanupNow}>
          Jetzt aufräumen
        </button>
        {cleanupStatus && <p className="hint">{cleanupStatus}</p>}
      </div>
    </div>
  )
}
