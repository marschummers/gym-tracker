const EQUIPMENT_SUFFIX_ABBREV: [string, string][] = [
  ['Barbell', 'LH'],
  ['Dumbbell', 'KH'],
  ['Machine', 'Maschine'],
  ['Cable', 'Kabel'],
]

const BODYWEIGHT_EXERCISES = new Set(['Pull-Up', 'Dips', 'Push-Up', 'Plank', 'Russian Twist', 'Sit-Up'])

export function getEquipmentTag(exerciseName: string): string | null {
  for (const [suffix, abbrev] of EQUIPMENT_SUFFIX_ABBREV) {
    if (exerciseName.endsWith(suffix)) return abbrev
  }
  if (BODYWEIGHT_EXERCISES.has(exerciseName)) return 'BW'
  return null
}

const ASSUMED_SECONDS_PER_SET = 45

export function estimateDaySeconds(exercises: { targetSets: number; restSeconds: number }[]): number {
  return exercises.reduce((sum, ex) => sum + ex.targetSets * (ex.restSeconds + ASSUMED_SECONDS_PER_SET), 0)
}

export function formatDurationEstimate(totalSeconds: number): string {
  const totalMinutes = Math.round(totalSeconds / 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${minutes} min`
  return `${hours}:${String(minutes).padStart(2, '0')} h`
}
