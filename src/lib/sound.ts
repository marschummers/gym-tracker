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
// nachdeklariert. Nur Safari implementiert sie bisher (Editor's-Draft-Status), daher reines
// Progressive Enhancement (Feature-Check + try/catch, kein Verlass darauf, dass sie etwas
// bewirkt).
//
// 'transient' (laut Spec: andere Audio nur kurz ducken, nicht pausieren) hat sich auf einem
// echten iPhone NICHT wie in der Spec beschrieben verhalten: Spotify wurde komplett gestoppt
// und lief danach nicht mehr weiter, zusätzlich blieb der eigene Piepton stumm. Deshalb jetzt
// 'ambient' (laut Spec: nur Mischen, nie Pausieren/Ducken) - die vorsichtigere Kategorie, die
// am wenigsten Angriffsfläche für dieses Fehlverhalten bietet. Nachteil: Spotify wird beim
// Piepton nicht automatisch leiser, das ist hier explizit in Ordnung.
type AudioSessionType = 'auto' | 'playback' | 'transient' | 'transient-solo' | 'ambient' | 'play-and-record'

declare global {
  interface Navigator {
    audioSession?: { type: AudioSessionType }
  }
}

function setAudioSessionType(type: AudioSessionType, context: string) {
  const audioSession = navigator.audioSession
  if (!audioSession) {
    console.log(`[sound] audioSession nicht verfügbar (${context})`)
    return
  }
  try {
    audioSession.type = type
    console.log(`[sound] audioSession.type = '${type}' gesetzt (${context})`)
  } catch (err) {
    console.warn(`[sound] audioSession.type = '${type}' fehlgeschlagen (${context}):`, err)
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

// Doppelter kurzer Piepton (880 Hz, zwei Bursts mit Attack/Decay-Hüllkurve). Amplitude direkt
// hier hochgesetzt statt über die .volume-Eigenschaft des <audio>-Elements - die wird von iOS
// Safari ignoriert (nur .muted funktioniert dort zuverlässig, Lautstärke ist an die
// Hardware-Tasten gebunden).
function createBeepAudioUrl(): string {
  const sampleRate = 22050
  const totalDuration = 0.42
  const numSamples = Math.floor(sampleRate * totalDuration)
  const samples = new Int16Array(numSamples)
  const burstStarts = [0, 0.22]
  const burstDuration = 0.19
  const attack = 0.01
  const decay = 0.17
  const gain = 0.6

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
        sample += Math.sin(2 * Math.PI * 880 * rel) * envelope(rel) * gain
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
// Piepton überhaupt fällig werden kann. Die Audio-Session wird schon hier (noch innerhalb des
// Taps) auf 'ambient' gesetzt, nicht erst kurz vor dem eigentlichen Piepton: falls
// audioSession.type ähnlich wie AudioContext.resume() nur innerhalb einer echten
// Nutzerinteraktion zuverlässig greift, hat er hier die beste Chance dazu.
export function unlockAudio() {
  if (beepUnlocked) return
  setAudioSessionType('ambient', 'unlockAudio')

  const beep = getBeepAudio()
  beep.muted = true
  beep
    .play()
    .then(() => {
      beep.pause()
      beep.currentTime = 0
      beep.muted = false
      beepUnlocked = true
      console.log('[sound] Audio-Element erfolgreich entsperrt')
    })
    .catch((err) => {
      console.warn('[sound] Entsperren des Audio-Elements fehlgeschlagen:', err)
    })
}

export function playRestEndBeep() {
  setAudioSessionType('ambient', 'playRestEndBeep')

  function resetAudioSessionType() {
    setAudioSessionType('auto', 'playRestEndBeep: reset')
  }

  const beep = getBeepAudio()
  beep.currentTime = 0
  beep.addEventListener('ended', resetAudioSessionType, { once: true })
  beep
    .play()
    .then(() => console.log('[sound] Piepton gestartet'))
    .catch((err) => {
      // Kein UI-Fehler, aber sichtbar im (Remote-)Debugger, falls der Piepton z.B. wegen der
      // iOS-Autoplay-Regeln doch mal blockiert wird.
      console.warn('[sound] Pausen-Piepton konnte nicht abgespielt werden:', err)
      resetAudioSessionType()
    })
}
