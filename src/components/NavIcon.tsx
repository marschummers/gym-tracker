type NavIconName = 'home' | 'plans' | 'exercises' | 'progress' | 'settings'

const commonProps = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

const GEAR_TEETH_ANGLES = [0, 60, 120, 180, 240, 300]

export default function NavIcon({ name }: { name: NavIconName }) {
  switch (name) {
    case 'home':
      return (
        <svg {...commonProps} aria-hidden="true">
          <path d="M4 11 L12 4 L20 11 V20 H4 Z" />
        </svg>
      )
    case 'plans':
      return (
        <svg {...commonProps} aria-hidden="true">
          <path d="M6 3 H14 L18 7 V21 H6 Z" />
          <path d="M14 3 V7 H18" />
          <line x1="9" y1="12" x2="15" y2="12" strokeWidth={1.6} />
          <line x1="9" y1="16" x2="15" y2="16" strokeWidth={1.6} />
        </svg>
      )
    case 'exercises':
      return (
        <svg {...commonProps} aria-hidden="true">
          <line x1="4" y1="12" x2="20" y2="12" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="12" r="3" />
        </svg>
      )
    case 'progress':
      return (
        <svg {...commonProps} aria-hidden="true">
          <rect x="4" y="14" width="4" height="7" rx="1" />
          <rect x="10" y="9" width="4" height="12" rx="1" />
          <rect x="16" y="4" width="4" height="17" rx="1" />
        </svg>
      )
    case 'settings':
      return (
        <svg width={22} height={22} viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="6.5" fill="none" stroke="currentColor" strokeWidth={2} />
          <circle cx="12" cy="12" r="2" fill="none" stroke="currentColor" strokeWidth={2} />
          {GEAR_TEETH_ANGLES.map((deg) => (
            <rect
              key={deg}
              x="10.5"
              y="1.5"
              width="3"
              height="3.5"
              rx="0.5"
              fill="currentColor"
              transform={`rotate(${deg} 12 12)`}
            />
          ))}
        </svg>
      )
  }
}
