// Hält den Bildschirm während eines aktiven Workouts wach. Löst NICHT das Hintergrund-Problem
// (der Wake Lock wird vom System automatisch freigegeben, sobald die Seite in den Hintergrund
// geht oder der Bildschirm gesperrt wird - das ist feste Spec-Vorgabe), deckt aber genau den
// Fall ab, der hier wichtig ist: App offen, Bildschirm an, Sekundentakt läuft zuverlässig.
let sentinel: WakeLockSentinel | null = null

export async function requestWakeLock(): Promise<void> {
  if (!('wakeLock' in navigator)) return
  if (sentinel && !sentinel.released) return
  try {
    sentinel = await navigator.wakeLock.request('screen')
  } catch {
    // z.B. abgelehnt oder Seite gerade nicht sichtbar - bewusst ohne sichtbaren Fehler
  }
}

export async function releaseWakeLock(): Promise<void> {
  const current = sentinel
  sentinel = null
  if (!current) return
  try {
    await current.release()
  } catch {
    // ignorieren
  }
}

export function hasActiveWakeLock(): boolean {
  return sentinel !== null && !sentinel.released
}
