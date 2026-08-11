// Der Piepton läuft bewusst über ein echtes <audio>-Element statt über die Web Audio API
// (AudioContext + Oszillatoren): AudioContext.resume() funktioniert auf iOS nur zuverlässig,
// wenn es direkt innerhalb eines Taps aufgerufen wird. Der Pausen-Piepton muss aber
// zeitgesteuert (aus dem Sekundentakt heraus) abgespielt werden, also NICHT innerhalb eines
// Taps - genau dann schlug resume() auf iOS lautlos fehl. Ein <audio>-Element lässt sich
// dagegen einmalig (per Tap) "entsperren" und danach beliebig oft zeitgesteuert abspielen -
// dieses einmalige Entsperren (unlockAudio, siehe unten) übernimmt bei iOS genau die Rolle,
// die vorher zusätzlich ein dauerhafter Silent-Loop hatte, aber ohne durchgehende
// Audiowiedergabe (die Spotify/andere Apps sonst die ganze Pause über unterbricht).

// navigator.audioSession ist eine WebKit-/Safari-spezifische, experimentelle API (seit
// iOS/Safari 16.4, noch nicht in der TypeScript-DOM-Lib enthalten) - hier minimal
// nachdeklariert. Laut WebKit wird bisher nur eine Teilmenge der vollen Spec unterstützt,
// daher wird sie hier als reines Progressive Enhancement behandelt (Feature-Check + try/catch,
// kein Verlass darauf, dass sie etwas bewirkt).
type AudioSessionType = 'auto' | 'playback' | 'transient' | 'transient-solo' | 'ambient' | 'play-and-record'

declare global {
  interface Navigator {
    audioSession?: { type: AudioSessionType }
  }
}

function writeWavHeader(
  view: DataView,
  dataSize: number,
  sampleRate: number,
  bitsPerSample: number,
) {
  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
  }
  const blockAlign = bitsPerSample / 8
  writeString(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * blockAlign, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitsPerSample, true)
  writeString(36, 'data')
  view.setUint32(40, dataSize, true)
}

// Doppelter kurzer Piepton (880 Hz, zwei Bursts mit Attack/Decay-Hüllkurve).
function createBeepAudioUrl(): string {
  const sampleRate = 22050
  const totalDuration = 0.42
  const numSamples = Math.floor(sampleRate * totalDuration)
  const samples = new Int16Array(numSamples)
  const burstStarts = [0, 0.22]
  const burstDuration = 0.19
  const attack = 0.01
  const decay = 0.17

  function envelope(t: number): number {
    if (t < attack) return t / attack
    if (t < decay) return 1 - (t - attack) / (decay - attack)
    return 0
  }

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate
    let sample = 0
    for (const start of burstStarts) {
      const rel = t - start
      if (rel >= 0 && rel < burstDuration) {
        sample += Math.sin(2 * Math.PI * 880 * rel) * envelope(rel) * 0.35
      }
    }
    samples[i] = Math.max(-1, Math.min(1, sample)) * 32767
  }

  const dataSize = samples.length * 2
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)
  writeWavHeader(view, dataSize, sampleRate, 16)
  for (let i = 0; i < samples.length; i++) view.setInt16(44 + i * 2, samples[i], true)
  return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }))
}

let beepAudio: HTMLAudioElement | null = null
let beepUnlocked = false

function getBeepAudio(): HTMLAudioElement {
  if (!beepAudio) {
    beepAudio = new Audio(createBeepAudioUrl())
    beepAudio.preload = 'auto'
  }
  return beepAudio
}

// Entsperrt das Audio-Element einmalig (stumm anspielen, sofort pausieren) für spätere
// zeitgesteuerte Wiedergabe außerhalb eines Taps. Muss aus einem echten Nutzer-Tap heraus
// aufgerufen werden (Klick auf ✓/Skip usw.) - genau das passiert bereits synchron, BEVOR
// logSet() den Pausen-Timer startet, das Entsperren ist also immer abgeschlossen, bevor ein
// Piepton überhaupt fällig werden kann. Einmal entsperrt bleibt das für die gesamte
// Seiten-Lebensdauer so (kein erneutes Entsperren nötig) - wiederholte Aufrufe danach sind
// ein günstiger No-op, hier als zusätzliches Sicherheitsnetz belassen.
export function unlockAudio() {
  if (beepUnlocked) return
  const beep = getBeepAudio()
  beep.muted = true
  beep
    .play()
    .then(() => {
      beep.pause()
      beep.currentTime = 0
      beep.muted = false
      beepUnlocked = true
    })
    .catch(() => {})
}

export function playRestEndBeep() {
  const audioSession = navigator.audioSession

  // Markiert die Wiedergabe als kurze, unwichtige Unterbrechung: andere Audioquellen wie
  // Spotify werden dadurch beim Piepton nur kurz geduckt statt komplett pausiert/beendet.
  // Reines Progressive Enhancement (siehe Typ-Kommentar oben) - danach wieder auf 'auto'
  // zurücksetzen, damit die Kategorisierung nicht über den Piepton hinaus bestehen bleibt.
  try {
    if (audioSession) audioSession.type = 'transient'
  } catch {
    // ignorieren, Piepton soll trotzdem abgespielt werden
  }

  function resetAudioSessionType() {
    try {
      if (audioSession) audioSession.type = 'auto'
    } catch {
      // ignorieren
    }
  }

  const beep = getBeepAudio()
  beep.currentTime = 0
  beep.addEventListener('ended', resetAudioSessionType, { once: true })
  beep.play().catch((err) => {
    // Kein UI-Fehler, aber sichtbar im (Remote-)Debugger, falls der Piepton z.B. wegen der
    // iOS-Autoplay-Regeln doch mal blockiert wird.
    console.warn('Pausen-Piepton konnte nicht abgespielt werden:', err)
    resetAudioSessionType()
  })
}
