import Dexie, { type EntityTable } from 'dexie';
import type {
  ExerciseDef,
  Plan,
  Day,
  DayExercise,
  WorkoutSession,
  SetEntry,
  BodyWeightEntry,
  AppSettings,
} from './types';
import { SEED_EXERCISES } from '../data/exerciseSeed';

export const db = new Dexie('gym-tracker') as Dexie & {
  exerciseDefs: EntityTable<ExerciseDef, 'id'>;
  plans: EntityTable<Plan, 'id'>;
  days: EntityTable<Day, 'id'>;
  dayExercises: EntityTable<DayExercise, 'id'>;
  workoutSessions: EntityTable<WorkoutSession, 'id'>;
  setEntries: EntityTable<SetEntry, 'id'>;
  bodyWeightEntries: EntityTable<BodyWeightEntry, 'id'>;
  appSettings: EntityTable<AppSettings, 'id'>;
};

db.version(1).stores({
  exerciseDefs: 'id, name',
  plans: 'id, name, createdAt',
  days: 'id, planId, order',
  dayExercises: 'id, dayId, order',
  workoutSessions: 'id, planId, dayId, startedAt',
  setEntries: 'id, sessionId, dayExerciseId, setNumber',
});

// Fügt exerciseDefId zu setEntries hinzu (die tatsächlich ausgeführte Übung, kann von der
// Tages-Konfiguration abweichen, wenn eine Alternativübung gewählt wurde). Bestehende Sätze
// bekommen dabei die exerciseDefId ihrer damaligen Tages-Übung als Wert.
db.version(2)
  .stores({
    setEntries: 'id, sessionId, dayExerciseId, setNumber, exerciseDefId',
  })
  .upgrade(async (tx) => {
    const dayExercises = await tx.table('dayExercises').toArray();
    const dayExerciseById = new Map(dayExercises.map((d) => [d.id, d]));
    await tx
      .table('setEntries')
      .toCollection()
      .modify((entry) => {
        if (!entry.exerciseDefId) {
          const de = dayExerciseById.get(entry.dayExerciseId);
          if (de) entry.exerciseDefId = de.exerciseDefId;
        }
      });
  });

// Körpergewicht-Tracking + einzelne Einstellungen (z.B. Zielgewicht).
db.version(3).stores({
  bodyWeightEntries: 'id, dateStr',
  appSettings: 'id',
});

export function newId(): string {
  return crypto.randomUUID();
}

// Befüllt die Übungs-Bibliothek einmalig mit einer Standardauswahl, auch wenn schon
// eigene Übungen angelegt wurden. Das Flag wird SOFORT (synchron, vor jedem await) gesetzt,
// damit React StrictMode im Dev-Modus (das Effects doppelt ausführt) nicht zweimal parallel
// einspielt und Duplikate erzeugt.
const SEED_FLAG_KEY = 'gym-tracker-exercise-library-seeded-v1';

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

export async function seedExerciseLibraryIfNeeded() {
  if (localStorage.getItem(SEED_FLAG_KEY)) return;
  localStorage.setItem(SEED_FLAG_KEY, '1');

  const existingNames = new Set((await db.exerciseDefs.toArray()).map((e) => normalizeName(e.name)));
  const toAdd = SEED_EXERCISES.filter((e) => !existingNames.has(normalizeName(e.name))).map((e) => ({
    id: newId(),
    name: e.name,
    category: e.category,
  }));

  if (toAdd.length > 0) await db.exerciseDefs.bulkAdd(toAdd);
}

// Räumt Duplikate auf, die vor der obigen Absicherung durch die Race Condition entstanden sein
// können (gleicher Übungsname mehrfach in der Bibliothek). Tage, die eine der Dubletten
// verwenden, werden auf den verbleibenden Eintrag umgehängt, bevor die Dubletten gelöscht werden.
export async function dedupeExerciseDefs() {
  const all = await db.exerciseDefs.toArray();
  const keeperByName = new Map<string, string>();
  const remap = new Map<string, string>();

  for (const e of all) {
    const key = normalizeName(e.name);
    const keeperId = keeperByName.get(key);
    if (keeperId === undefined) {
      keeperByName.set(key, e.id);
    } else {
      remap.set(e.id, keeperId);
    }
  }

  if (remap.size === 0) return;

  await db.transaction('rw', db.exerciseDefs, db.dayExercises, async () => {
    const affected = await db.dayExercises
      .toCollection()
      .filter((de) => remap.has(de.exerciseDefId))
      .toArray();
    for (const de of affected) {
      await db.dayExercises.update(de.id, { exerciseDefId: remap.get(de.exerciseDefId)! });
    }
    await db.exerciseDefs.bulkDelete([...remap.keys()]);
  });
}

// Löscht Trainingseinheiten, die gestartet, aber nie beendet oder mit Sätzen befüllt wurden
// (z.B. wenn man "Training starten" antippt und direkt wieder rausgeht, ohne abzubrechen).
// minAgeMs: wie alt eine offene Einheit mindestens sein muss, damit sie angefasst wird.
// Beim automatischen Aufruf (App-Start) hoch genug, damit ein gerade aktives Training nie
// betroffen ist; beim manuellen "Jetzt aufräumen"-Button in den Einstellungen auf 0.
const AUTO_STALE_SESSION_AGE_MS = 60 * 60 * 1000;

export async function cleanupEmptySessions(minAgeMs = AUTO_STALE_SESSION_AGE_MS): Promise<number> {
  const openSessions = await db.workoutSessions
    .filter((s) => s.endedAt === null && Date.now() - s.startedAt >= minAgeMs)
    .toArray();
  if (openSessions.length === 0) return 0;

  const staleIds: string[] = [];
  for (const session of openSessions) {
    const hasEntries = await db.setEntries.where('sessionId').equals(session.id).count();
    if (hasEntries === 0) staleIds.push(session.id);
  }
  if (staleIds.length > 0) await db.workoutSessions.bulkDelete(staleIds);
  return staleIds.length;
}

// Verknüpft zwei Übungen als gegenseitige Alternativen (z.B. gleiche Übung an anderer Maschine).
export async function addAlternativeExercise(exerciseDefId: string, alternativeId: string) {
  if (exerciseDefId === alternativeId) return;
  await db.transaction('rw', db.exerciseDefs, async () => {
    const a = await db.exerciseDefs.get(exerciseDefId);
    const b = await db.exerciseDefs.get(alternativeId);
    if (!a || !b) return;
    await db.exerciseDefs.update(exerciseDefId, {
      alternativeIds: [...new Set([...(a.alternativeIds ?? []), alternativeId])],
    });
    await db.exerciseDefs.update(alternativeId, {
      alternativeIds: [...new Set([...(b.alternativeIds ?? []), exerciseDefId])],
    });
  });
}

// Legt einen Körpergewicht-Eintrag für einen Tag an oder überschreibt den bestehenden
// (ein Eintrag pro Kalendertag).
export async function upsertBodyWeightEntry(dateStr: string, weight: number) {
  const existing = await db.bodyWeightEntries.where('dateStr').equals(dateStr).first();
  if (existing) {
    await db.bodyWeightEntries.update(existing.id, { weight });
  } else {
    await db.bodyWeightEntries.add({ id: newId(), dateStr, weight });
  }
}

export async function setTargetWeight(weight: number | undefined) {
  await db.appSettings.put({ id: 'singleton', targetWeight: weight });
}

export async function removeAlternativeExercise(exerciseDefId: string, alternativeId: string) {
  await db.transaction('rw', db.exerciseDefs, async () => {
    const a = await db.exerciseDefs.get(exerciseDefId);
    const b = await db.exerciseDefs.get(alternativeId);
    if (a) {
      await db.exerciseDefs.update(exerciseDefId, {
        alternativeIds: (a.alternativeIds ?? []).filter((id) => id !== alternativeId),
      });
    }
    if (b) {
      await db.exerciseDefs.update(alternativeId, {
        alternativeIds: (b.alternativeIds ?? []).filter((id) => id !== exerciseDefId),
      });
    }
  });
}
