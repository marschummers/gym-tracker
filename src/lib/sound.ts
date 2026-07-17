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

// iOS schläfert den AudioContext wieder ein, sobald der Bildschirm gesperrt wird oder die App
// länger im Hintergrund war - auch nachdem er schonmal lief. Deswegen nicht nur einmalig beim
// ersten Klick aufrufen, sondern bei jeder Gelegenheit (Klick, Sekundentakt, Rückkehr in den
// Vordergrund) erneut versuchen, ihn wach zu halten.
export function unlockAudio() {
  const c = getContext()
  if (c.state !== 'running') c.resume()
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
