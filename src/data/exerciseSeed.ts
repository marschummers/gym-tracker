import type { MuscleGroup } from '../db/types'

export const SEED_EXERCISES: { name: string; category: MuscleGroup }[] = [
  // Rücken
  { name: 'Lat Pulldown Machine', category: 'Rücken' },
  { name: 'Close Grip Lat Pulldown Cable', category: 'Rücken' },
  { name: 'Seated Row Cable', category: 'Rücken' },
  { name: 'One Arm Row Dumbbell', category: 'Rücken' },
  { name: 'Bent Over Row Barbell', category: 'Rücken' },
  { name: 'T-Bar Row Machine', category: 'Rücken' },
  { name: 'Reverse Flys Machine', category: 'Rücken' },
  { name: 'Pullover Machine', category: 'Rücken' },
  { name: 'Straight Arm Pulldown Cable', category: 'Rücken' },
  { name: 'Assisted Pull-Up Machine', category: 'Rücken' },
  { name: 'Pull-Up', category: 'Rücken' },
  { name: 'Deadlift Barbell', category: 'Rücken' },
  { name: 'Hyperextension', category: 'Rücken' },

  // Brust
  { name: 'Chest Press Machine', category: 'Brust' },
  { name: 'Bench Press Barbell', category: 'Brust' },
  { name: 'Bench Press Dumbbell', category: 'Brust' },
  { name: 'Incline Bench Press Barbell', category: 'Brust' },
  { name: 'Incline Bench Press Dumbbell', category: 'Brust' },
  { name: 'Butterfly Machine', category: 'Brust' },
  { name: 'Cable Crossover', category: 'Brust' },
  { name: 'Dips', category: 'Brust' },
  { name: 'Push-Up', category: 'Brust' },

  // Schulter
  { name: 'Shoulder Press Machine', category: 'Schulter' },
  { name: 'Shoulder Press Dumbbell', category: 'Schulter' },
  { name: 'Lateral Raise Dumbbell', category: 'Schulter' },
  { name: 'Lateral Raise Machine', category: 'Schulter' },
  { name: 'Lateral Raise Cable', category: 'Schulter' },
  { name: 'Front Raise Dumbbell', category: 'Schulter' },
  { name: 'Face Pulls Cable', category: 'Schulter' },
  { name: 'Rear Delt Flys Machine', category: 'Schulter' },
  { name: 'Arnold Press Dumbbell', category: 'Schulter' },
  { name: 'Shrugs Dumbbell', category: 'Schulter' },

  // Arme
  { name: 'Biceps Curl Barbell', category: 'Arme' },
  { name: 'Biceps Curl Dumbbell', category: 'Arme' },
  { name: 'Preacher Curls Dumbbell', category: 'Arme' },
  { name: 'Preacher Curl Machine', category: 'Arme' },
  { name: 'Hammer Curl Dumbbell', category: 'Arme' },
  { name: 'Biceps Curl Cable', category: 'Arme' },
  { name: 'Triceps Pushdown Cable', category: 'Arme' },
  { name: 'Triceps Extension Cable', category: 'Arme' },
  { name: 'French Press Barbell', category: 'Arme' },
  { name: 'Triceps Dip Machine', category: 'Arme' },
  { name: 'Skull Crusher Barbell', category: 'Arme' },

  // Beine
  { name: 'Squat Barbell', category: 'Beine' },
  { name: 'Leg Press Machine', category: 'Beine' },
  { name: 'Leg Extension Machine', category: 'Beine' },
  { name: 'Leg Curl Machine', category: 'Beine' },
  { name: 'Lunges Dumbbell', category: 'Beine' },
  { name: 'Goblet Squat Dumbbell', category: 'Beine' },
  { name: 'Romanian Deadlift Barbell', category: 'Beine' },
  { name: 'Calf Raise Machine', category: 'Beine' },
  { name: 'Hip Thrust Machine', category: 'Beine' },
  { name: 'Hip Abduction Machine', category: 'Beine' },
  { name: 'Hip Adduction Machine', category: 'Beine' },

  // Bauch
  { name: 'Crunch Machine', category: 'Bauch' },
  { name: 'Cable Crunch', category: 'Bauch' },
  { name: 'Hanging Leg Raise', category: 'Bauch' },
  { name: 'Plank', category: 'Bauch' },
  { name: 'Russian Twist', category: 'Bauch' },
  { name: 'Ab Wheel', category: 'Bauch' },
  { name: 'Sit-Up', category: 'Bauch' },
]
