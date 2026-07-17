import { MUSCLE_GROUPS } from '../db/types'
import type { ExerciseDef } from '../db/types'

export default function GroupedExerciseOptions({
  exerciseDefs,
  exclude,
}: {
  exerciseDefs: ExerciseDef[]
  exclude?: Set<string>
}) {
  const excludeIds = exclude ?? new Set<string>()

  return (
    <>
      {MUSCLE_GROUPS.map((group) => {
        const inGroup = exerciseDefs.filter((e) => e.category === group && !excludeIds.has(e.id))
        if (inGroup.length === 0) return null
        return (
          <optgroup key={group} label={group}>
            {inGroup.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.name}
              </option>
            ))}
          </optgroup>
        )
      })}
      {exerciseDefs.filter((e) => !e.category && !excludeIds.has(e.id)).length > 0 && (
        <optgroup label="Eigene Übungen">
          {exerciseDefs
            .filter((e) => !e.category && !excludeIds.has(e.id))
            .map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.name}
              </option>
            ))}
        </optgroup>
      )}
    </>
  )
}
