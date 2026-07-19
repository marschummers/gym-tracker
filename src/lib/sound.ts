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

// Ein 1 Sekunden langes, fast lautloses WAV (Amplitude 1 von 128 - technisch kein reines Digital-
// Stille, damit iOS es sicher als "spielt Audio ab" erkennt) zum Endlos-Loopen. Wird per <audio>-
// Element abgespielt statt über den AudioContext, weil NUR ein aktiv abspielendes <audio>/<video>-
// Element iOS dazu bringt, die Seite im Hintergrund (App-Wechsel, gesperrter Bildschirm) am Laufen
// zu halten. Ohne das pausiert iOS die komplette JavaScript-Ausführung inkl. des Sekundentakts, der
// den Pausen-Timer prüft - deshalb kam der Piepton nach App-Wechsel nie an, egal wie oft der
// (dann längst eingeschlafene) AudioContext "aufgeweckt" wurde.
function createKeepAliveAudioUrl(): string {
  const sampleRate = 8000
  const numSamples = sampleRate
  const buffer = new ArrayBuffer(44 + numSamples)
  const view = new DataView(buffer)
  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
  }
  writeString(0, 'RIFF')
  view.setUint32(4, 36 + numSamples, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate, true)
  view.setUint16(32, 1, true)
  view.setUint16(34, 8, true)
  writeString(36, 'data')
  view.setUint32(40, numSamples, true)
  for (let i = 0; i < numSamples; i++) view.setUint8(44 + i, i % 2 === 0 ? 127 : 129)
  const blob = new Blob([buffer], { type: 'audio/wav' })
  return URL.createObjectURL(blob)
}

let bgAudio: HTMLAudioElement | null = null

function getBgAudio(): HTMLAudioElement {
  if (!bgAudio) {
    bgAudio = new Audio(createKeepAliveAudioUrl())
    bgAudio.loop = true
    bgAudio.volume = 0.02
    bgAudio.preload = 'auto'
  }
  return bgAudio
}

// Muss aus einem echten Nutzer-Tap heraus (Klick auf ✓/Skip usw.) UND regelmäßig im
// Sekundentakt aufgerufen werden: der Tap startet die Hintergrund-Wiedergabe zuverlässig,
// der Sekundentakt versucht sie erneut zu starten, falls iOS sie doch mal pausiert hat.
export function unlockAudio() {
  const c = getContext()
  if (c.state !== 'running') c.resume()
  const audio = getBgAudio()
  if (audio.paused) audio.play().catch(() => {})
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
