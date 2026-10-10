// Sonido de Biblo: interruptor de silencio (recordado entre visitas) y el
// "toc" al pasar de un lomo a otro.
const MUTE_KEY = 'biblo:muted'

let muted = false
try {
  muted = localStorage.getItem(MUTE_KEY) === 'true'
} catch {
  // sin localStorage el silencio no se recuerda, pero funciona en la visita
}

export function isMuted() {
  return muted
}

export function setMuted(value) {
  muted = value
  try {
    localStorage.setItem(MUTE_KEY, String(value))
  } catch {
    // ver arriba
  }
}

// El "toc": un pellizco de seno con caída rápida más un clic de papel. Cada
// libro suena en una nota de una escala pentatónica, así que recorrer la
// estantería suena a melodía.
const NOTES = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51]

let ctx = null

function getCtx() {
  if (!ctx) {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return null
    ctx = new Ctx()
  }
  return ctx
}

// Los navegadores no dejan sonar audio hasta el primer clic o tecla de la
// visita: lo desbloqueamos en ese primer gesto.
window.addEventListener('pointerdown', () => getCtx()?.resume(), { once: true })
window.addEventListener('keydown', () => getCtx()?.resume(), { once: true })

export function playHover(index) {
  if (muted || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const ac = getCtx()
  if (!ac || ac.state !== 'running') return
  const t = ac.currentTime

  const osc = ac.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(NOTES[index % NOTES.length], t)
  const tone = ac.createGain()
  tone.gain.setValueAtTime(0.0001, t)
  tone.gain.exponentialRampToValueAtTime(0.07, t + 0.008)
  tone.gain.exponentialRampToValueAtTime(0.0001, t + 0.22)
  osc.connect(tone).connect(ac.destination)
  osc.start(t)
  osc.stop(t + 0.24)

  // clic de papel: ráfaga de ruido muy corta y filtrada
  const len = Math.round(ac.sampleRate * 0.025)
  const buf = ac.createBuffer(1, len, ac.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len)
  const noise = ac.createBufferSource()
  noise.buffer = buf
  const hp = ac.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 2500
  const click = ac.createGain()
  click.gain.value = 0.05
  noise.connect(hp).connect(click).connect(ac.destination)
  noise.start(t)
}
