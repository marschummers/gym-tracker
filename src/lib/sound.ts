let ctx: AudioContext | null = null

function getContext(): AudioContext {
  if (!ctx) {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    ctx = new Ctor()
  }
  return ctx
}

// Muss aus einem User-Klick heraus aufgerufen werden (z.B. beim Satz abhaken), damit
// iOS Safari die spätere automatische Wiedergabe (aus dem Timer heraus) erlaubt.
export function unlockAudio() {
  const c = getContext()
  if (c.state === 'suspended') c.resume()
}

export function playRestEndBeep() {
  const c = getContext()
  const now = c.currentTime
  for (const offset of [0, 0.22]) {
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.type = 'sine'
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.0001, now + offset)
    gain.gain.exponentialRampToValueAtTime(0.35, now + offset + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.18)
    osc.connect(gain)
    gain.connect(c.destination)
    osc.start(now + offset)
    osc.stop(now + offset + 0.2)
  }
}
