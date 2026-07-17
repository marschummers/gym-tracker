import type { ReactNode } from 'react'
import type { MuscleGroup } from '../db/types'

const PATHS: Record<MuscleGroup, ReactNode> = {
  Rücken: (
    <path d="M12 3c-2.5 2-4 3-4 6 0 2 1 3 1 5l-2 7h3l1.5-6h1L14 21h3l-2-7c0-2 1-3 1-5 0-3-1.5-4-4-6Z" />
  ),
  Brust: (
    <path d="M12 6c-1-1.5-3-2-4.5-1S5 8 5.5 11c.5 3 3 6 6.5 8 3.5-2 6-5 6.5-8 .5-3-1-5-2-6s-3.5-.5-4.5 1Z" />
  ),
  Schulter: (
    <path d="M4 15c0-4 3-7 8-7s8 3 8 7v1c-1.5-1-3-1.5-3-1.5V17h-2v-3c-1-.3-2-.4-3-.4s-2 .1-3 .4v3H7v-2.5S5.5 15 4 16Z" />
  ),
  Arme: (
    <path d="M6 4v5c0 2 1 3 2.5 3.5-1 .5-1.5 1.5-1.5 3V20h3v-4c0-1.5.5-2 2-2h1c1.5 0 3-1 3-3V4h-2v6c0 1-.5 1.5-1.5 1.5S11 11 11 10V4H9v6c0 .8-.3 1.3-1 1.5C7.3 11.3 7 10.8 7 10V4Z" />
  ),
  Beine: (
    <path d="M8 3h8l.5 6c.3 3 1 4 1.5 6l1 6h-3l-1.5-7-1-4h-1.5l-.5 4v7H9v-7l-1-4-1.5 7H3l1-6c.5-2 1.2-3 1.5-6Z" />
  ),
  Bauch: (
    <>
      <path d="M7 4h10l1 6c.5 3-.5 5-1 7-.7 2.7-2.5 4-5 4s-4.3-1.3-5-4c-.5-2-1.5-4-1-7Z" />
      <path d="M9 8h6M9 12h6M9 16h6" fill="none" stroke="var(--bg-elevated)" strokeWidth="1.4" />
    </>
  ),
}

export default function MuscleGroupIcon({ category }: { category?: MuscleGroup }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      {category ? PATHS[category] : <circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" strokeWidth="1.6" />}
    </svg>
  )
}
