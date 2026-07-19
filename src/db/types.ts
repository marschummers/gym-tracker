export const MUSCLE_GROUPS = ['Rücken', 'Brust', 'Schulter', 'Arme', 'Beine', 'Bauch'] as const;
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

// Übung aus der wiederverwendbaren Übungs-Bibliothek (z.B. "Bankdrücken")
export interface ExerciseDef {
  id: string;
  name: string;
  // Fehlt bei selbst angelegten Übungen ohne Zuordnung
  category?: MuscleGroup;
  // IDs anderer Übungen, die als Ausweichübung dienen (z.B. andere Maschine, falls belegt).
  // Wird beim Verknüpfen auf beiden Seiten gepflegt.
  alternativeIds?: string[];
}

// Ein Trainingsplan (z.B. "Push Pull Legs")
export interface Plan {
  id: string;
  name: string;
  createdAt: number;
}

// Ein Tag innerhalb eines Plans (z.B. "Push", "Pull", "Legs")
export interface Day {
  id: string;
  planId: string;
  name: string;
  order: number;
  // Optionaler fester Wochentag für die "Heute"-Vorauswahl auf der Übersicht.
  // JS-Konvention: 0 = Sonntag ... 6 = Samstag. Fehlt = kein fester Tag.
  weekday?: number;
}

// Eine Übung, die einem Tag zugeordnet ist, mit Satz- und Pausen-Konfiguration
export interface DayExercise {
  id: string;
  dayId: string;
  exerciseDefId: string;
  order: number;
  targetSets: number;
  restSeconds: number;
}

// Eine konkrete Trainingseinheit (Ausführung eines Tages)
export interface WorkoutSession {
  id: string;
  planId: string;
  dayId: string;
  startedAt: number;
  endedAt: number | null;
}

// Ein protokollierter Satz während einer Trainingseinheit
export interface SetEntry {
  id: string;
  sessionId: string;
  dayExerciseId: string;
  // Die tatsächlich ausgeführte Übung (Standardübung des Tages ODER eine ausgewählte
  // Alternative). Getrennt von dayExercise.exerciseDefId, damit z.B. Smith-Machine- und
  // Machine-Variante mit unterschiedlichem Gewicht eigene Verläufe/PRs behalten.
  exerciseDefId: string;
  setNumber: number;
  weight: number;
  reps: number;
  completedAt: number;
  // Satz wurde übersprungen statt ausgeführt (z.B. Gerät belegt, keine Zeit mehr). Zählt für
  // den Fortschritt der Übung ("3/3 erledigt"), fließt aber nicht in Gewichts-/Volumen-/
  // PR-Auswertungen ein.
  skipped?: boolean;
}

// Ein Körpergewicht-Eintrag (z.B. morgens nach dem Aufstehen). Ein Eintrag pro Kalendertag,
// erneutes Speichern am selben Tag überschreibt den vorherigen Wert (dateStr = 'YYYY-MM-DD').
export interface BodyWeightEntry {
  id: string;
  dateStr: string;
  weight: number;
}

// Einzige Zeile mit persönlichen Einstellungen, die nicht in eine eigene Tabelle passen.
export interface AppSettings {
  id: 'singleton';
  targetWeight?: number;
}
