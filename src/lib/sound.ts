// Beide Sounds laufen bewusst über echte <audio>-Elemente statt über die Web Audio API
// (AudioContext + Oszillatoren): AudioContext.resume() funktioniert auf iOS nur zuverlässig,
// wenn es direkt innerhalb eines Taps aufgerufen wird. Der Pausen-Piepton muss aber
// zeitgesteuert (aus dem Sekundentakt heraus) abgespielt werden, also NICHT innerhalb eines
// Taps - genau dann schlug resume() auf iOS lautlos fehl und es kam kein Ton, auch wenn die
// App die ganze Zeit im Vordergrund war. <audio>-Elemente lassen sich dagegen einmalig (per
// Tap) "entsperren" und danach beliebig oft zeitgesteuert abspielen.

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

// 8 Sekunden echte Stille zum Endlos-Loopen. Ein aktiv abspielendes <audio>-Element hält die
// Seite im Hintergrund (App-Wechsel, gesperrter Bildschirm) am Laufen - ohne das pausiert iOS
// die komplette JavaScript-Ausführung inkl. des Sekundentakts. Wichtig: konstante Werte (echte
// Stille), keine wechselnden Sample-Werte - eine frühere Version mit abwechselnden Werten
// ergab technisch eine hochfrequente, hörbare Wellenform statt Stille.
function createKeepAliveAudioUrl(): string {
  const sampleRate = 8000
  const numSamples = sampleRate * 8
  const buffer = new ArrayBuffer(44 + numSamples)
  const view = new DataView(buffer)
  writeWavHeader(view, numSamples, sampleRate, 8)
  for (let i = 0; i < numSamples; i++) view.setUint8(44 + i, 128)
  return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }))
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

let bgAudio: HTMLAudioElement | null = null
let beepAudio: HTMLAudioElement | null = null
let beepUnlocked = false

function getBgAudio(): HTMLAudioElement {
  if (!bgAudio) {
    bgAudio = new Audio(createKeepAliveAudioUrl())
    bgAudio.loop = true
    bgAudio.volume = 0.02
    bgAudio.preload = 'auto'
  }
  return bgAudio
}

function getBeepAudio(): HTMLAudioElement {
  if (!beepAudio) {
    beepAudio = new Audio(createBeepAudioUrl())
    beepAudio.preload = 'auto'
  }
  return beepAudio
}

// Muss aus einem echten Nutzer-Tap heraus (Klick auf ✓/Skip usw.) UND regelmäßig im
// Sekundentakt aufgerufen werden: der Tap entsperrt beide Audio-Elemente zuverlässig und
// startet den Hintergrund-Loop, der Sekundentakt versucht den Loop erneut zu starten, falls
// iOS ihn zwischendurch doch mal pausiert hat.
export function unlockAudio() {
  const audio = getBgAudio()
  if (audio.paused) audio.play().catch(() => {})

  if (!beepUnlocked) {
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
}

export function playRestEndBeep() {
  const beep = getBeepAudio()
  beep.currentTime = 0
  beep.play().catch(() => {})
}
