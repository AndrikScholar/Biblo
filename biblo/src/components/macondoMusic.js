import { isMuted } from '../sound'
import { BAR, BEAT, T } from './macondoScene'
import { impulse, noiseBuffer, pluck } from './quijoteMusic'

// Música de la entrada de "Cien años de soledad": un paseo vallenato corto en
// sol mayor, a 120 pulsos, con acordeón, guitarra, bajo, caja y guacharaca.
//   compás 1    el acordeón sube solo, suave, mientras la cámara se acerca
//               a la puerta (la guitarra marca los acordes)
//   compás 2    al abrirse la puerta (2 s) entra todo el conjunto de golpe,
//               justo con la nube de mariposas
//   compases 3-4 la melodía recorre la calle y sube con la cámara
//   compás 5    se posa en sol con el título y el acorde se queda sonando
// Se sintetiza entera de una vez (OfflineAudioContext), en segundo plano al
// cargar la página, como las demás entradas.

const SR = 44100
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12)
const at = (bar, beat = 0) => (bar - 1) * BAR + beat * BEAT

// acordes por medio compás: [compás, pulso, notas MIDI]
const CHORDS = [
  [1, 0, [55, 59, 62]], // sol
  [2, 0, [55, 59, 62]],
  [2, 2, [50, 54, 57, 60]], // re7
  [3, 0, [50, 54, 57, 60]],
  [3, 2, [55, 59, 62]],
  [4, 0, [48, 52, 55]], // do
  [4, 2, [50, 54, 57, 60]],
  [5, 0, [55, 59, 62]],
]

// melodía del acordeón: [compás, pulso, nota, duración en pulsos]
const MELODY = [
  [1, 2.5, 74, 0.5],
  [1, 3, 71, 0.25],
  [1, 3.25, 74, 0.25],
  [1, 3.5, 79, 0.5],
  [2, 0, 78, 0.5],
  [2, 0.5, 76, 0.25],
  [2, 0.75, 74, 0.25],
  [2, 1, 71, 0.5],
  [2, 1.5, 67, 0.5],
  [2, 2, 69, 0.5],
  [2, 2.5, 72, 0.25],
  [2, 2.75, 76, 0.25],
  [2, 3, 74, 0.5],
  [2, 3.5, 72, 0.5],
  [3, 0, 69, 0.5],
  [3, 0.5, 66, 0.25],
  [3, 0.75, 69, 0.25],
  [3, 1, 74, 0.75],
  [3, 1.75, 72, 0.25],
  [3, 2, 71, 0.5],
  [3, 2.5, 74, 0.5],
  [3, 3, 79, 0.5],
  [3, 3.5, 78, 0.25],
  [3, 3.75, 76, 0.25],
  [4, 0, 76, 0.5],
  [4, 0.5, 79, 0.25],
  [4, 0.75, 76, 0.25],
  [4, 1, 72, 0.5],
  [4, 1.5, 76, 0.5],
  [4, 2, 78, 0.5],
  [4, 2.5, 81, 0.25],
  [4, 2.75, 78, 0.25],
  [4, 3, 74, 0.5],
  [4, 3.5, 78, 0.25],
  [4, 3.75, 81, 0.25],
  [5, 0, 79, 3.2],
]

async function renderPaseo() {
  const c = new OfflineAudioContext(2, Math.ceil(SR * (T.end + 2.5)), SR)
  const comp = c.createDynamicsCompressor()
  comp.threshold.value = -16
  comp.ratio.value = 3
  comp.connect(c.destination)
  const master = c.createGain()
  master.gain.value = 0.85
  master.connect(comp)
  const verb = c.createConvolver()
  verb.buffer = impulse(c, 1.8, 2.6)
  const wet = c.createGain()
  wet.gain.value = 0.35
  verb.connect(wet).connect(master)
  const send = (node, rev, pan = 0) => {
    const p = c.createStereoPanner()
    p.pan.value = pan
    node.connect(p)
    p.connect(master)
    const r = c.createGain()
    r.gain.value = rev
    p.connect(r).connect(verb)
  }
  const white = noiseBuffer(c, 2)
  const band = at(2) // el conjunto entra con la puerta

  // acordeón: tres lengüetas un poco desafinadas entre sí (el "musette"),
  // con el fuelle que tiembla y un filtro que lo hace nasal
  function accordion(t0, dur, midi, vel = 1) {
    const out = c.createGain()
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 2600
    lp.Q.value = 0.8
    const body = c.createBiquadFilter()
    body.type = 'peaking'
    body.frequency.value = 1200
    body.gain.value = 5
    lp.connect(body).connect(out)
    for (const [det, type, g] of [[0, 'sawtooth', 0.45], [9, 'square', 0.22], [-8, 'sawtooth', 0.3]]) {
      const o = c.createOscillator()
      o.type = type
      o.frequency.value = hz(midi)
      o.detune.value = det
      const og = c.createGain()
      og.gain.value = g
      o.connect(og).connect(lp)
      o.start(t0)
      o.stop(t0 + dur + 0.2)
    }
    // temblor del fuelle
    const lfo = c.createOscillator()
    lfo.frequency.value = 5.6
    const depth = c.createGain()
    depth.gain.value = 0.06 * vel
    lfo.connect(depth).connect(out.gain)
    lfo.start(t0)
    lfo.stop(t0 + dur + 0.2)
    out.gain.setValueAtTime(0, t0)
    out.gain.linearRampToValueAtTime(0.16 * vel, t0 + 0.025)
    out.gain.setValueAtTime(0.14 * vel, t0 + Math.max(0.03, dur - 0.05))
    out.gain.linearRampToValueAtTime(0, t0 + dur + 0.09)
    send(out, 0.25, 0.12)
  }

  // guitarra: rasgueo con cuerdas pulsadas
  function strum(t0, notes, vel = 1, up = false) {
    const list = up ? [...notes].reverse() : notes
    list.forEach((m, i) => {
      const { buf, rate } = pluck(c, hz(m + 12), 1.6)
      const src = c.createBufferSource()
      src.buffer = buf
      src.playbackRate.value = rate
      const g = c.createGain()
      g.gain.value = 0.22 * vel
      src.connect(g)
      send(g, 0.2, -0.3)
      src.start(t0 + i * 0.012)
    })
  }

  // bajo: tónica en el 1 y quinta en el 3, con la nota que se adelanta
  function bass(t0, midi, dur = 0.42) {
    const o = c.createOscillator()
    o.type = 'triangle'
    o.frequency.value = hz(midi - 12)
    const g = c.createGain()
    g.gain.setValueAtTime(0, t0)
    g.gain.linearRampToValueAtTime(0.5, t0 + 0.012)
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur)
    o.connect(g)
    send(g, 0.05)
    o.start(t0)
    o.stop(t0 + dur + 0.05)
  }

  // caja vallenata: un parche tenso que cae de tono y un golpe seco de mano
  function caja(t0, open = true, vel = 1) {
    const o = c.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(open ? 240 : 320, t0)
    o.frequency.exponentialRampToValueAtTime(open ? 150 : 210, t0 + 0.12)
    const g = c.createGain()
    g.gain.setValueAtTime(0.5 * vel, t0)
    g.gain.exponentialRampToValueAtTime(0.001, t0 + (open ? 0.22 : 0.09))
    o.connect(g)
    send(g, 0.15, 0.2)
    o.start(t0)
    o.stop(t0 + 0.3)
    const n = c.createBufferSource()
    n.buffer = white
    const bp = c.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = open ? 900 : 1800
    bp.Q.value = 1.2
    const ng = c.createGain()
    ng.gain.setValueAtTime(0.35 * vel, t0)
    ng.gain.exponentialRampToValueAtTime(0.001, t0 + 0.05)
    n.connect(bp).connect(ng)
    send(ng, 0.1, 0.2)
    n.start(t0, Math.random())
    n.stop(t0 + 0.08)
  }

  // guacharaca: el raspado de la caña, largo-corto-corto
  function guacharaca(t0, len, vel = 1) {
    const n = c.createBufferSource()
    n.buffer = white
    const bp = c.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 5200
    bp.Q.value = 0.9
    const hp = c.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 2500
    const g = c.createGain()
    // el peine pasa por las muescas: un tren de golpecitos dentro del raspado
    const teeth = Math.max(3, Math.round(len / 0.012))
    g.gain.setValueAtTime(0, t0)
    for (let i = 0; i < teeth; i++) {
      const tt = t0 + (i / teeth) * len
      g.gain.setValueAtTime(0.16 * vel, tt)
      g.gain.linearRampToValueAtTime(0.03 * vel, tt + len / teeth)
    }
    g.gain.linearRampToValueAtTime(0, t0 + len + 0.01)
    n.connect(bp).connect(hp).connect(g)
    send(g, 0.08, -0.45)
    n.start(t0, Math.random())
    n.stop(t0 + len + 0.05)
  }

  // ---- la partitura ----
  for (const [bar, beat, midi, dur] of MELODY) {
    const t0 = at(bar, beat)
    accordion(t0, dur * BEAT * (dur > 1 ? 1 : 0.92), midi, t0 < band ? 0.7 : 1)
    // al final, el acordeón dobla la melodía una tercera abajo
    if (bar >= 4) accordion(t0, dur * BEAT * 0.92, midi - (bar === 5 ? 4 : 3), 0.55)
  }
  for (let i = 0; i < CHORDS.length; i++) {
    const [bar, beat, notes] = CHORDS[i]
    const t0 = at(bar, beat)
    const last = bar === 5
    if (last) {
      strum(t0, notes, 1.1)
      bass(t0, notes[0], 1.8)
      // acorde largo de acordeón que se queda sonando sobre la ficha
      for (const m of notes) accordion(t0, 2.6, m + 12, 0.45)
      caja(t0, true, 1.2)
      continue
    }
    // rasgueo: abajo en el pulso, arriba en el contratiempo
    for (const k of [0, 0.5, 1, 1.5]) strum(t0 + k * BEAT, notes, t0 < band ? 0.6 : 0.8, k % 1 !== 0)
    if (t0 >= band) {
      bass(t0, notes[0])
      bass(t0 + BEAT * 1.5, notes[2] - 12) // la quinta, abajo y adelantada
    }
  }
  // percusión desde el compás 2
  for (let bar = 2; bar <= 4; bar++) {
    for (let beat = 0; beat < 4; beat++) {
      const t0 = at(bar, beat)
      caja(t0 + BEAT * 0.5, true, beat % 2 ? 1 : 0.8)
      if (beat % 2) caja(t0 + BEAT * 0.75, false, 0.6)
      guacharaca(t0, BEAT * 0.42, 1)
      guacharaca(t0 + BEAT * 0.5, BEAT * 0.18, 0.7)
      guacharaca(t0 + BEAT * 0.75, BEAT * 0.18, 0.7)
    }
  }
  // un redoble de caja justo antes de que se abra la puerta
  for (let i = 0; i < 4; i++) caja(at(1, 3) + i * BEAT * 0.25, i % 2 === 0, 0.5 + i * 0.12)

  const buf = await c.startRendering()
  // normaliza: el pico queda en 0.8 pase lo que pase con el azar del ruido
  let peak = 0
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const d = buf.getChannelData(ch)
    for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]))
  }
  const k = peak > 0 ? 0.8 / peak : 1
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const d = buf.getChannelData(ch)
    for (let i = 0; i < d.length; i++) d[i] *= k
  }
  return buf
}

// Sintetizarla tarda un poco: la página la prepara en segundo plano al
// cargar y la escena reutiliza el resultado.
let pending = null
export function prepareMacondoMusic() {
  if (isMuted() || !window.OfflineAudioContext) return null
  pending ??= renderPaseo().catch(() => {
    pending = null // sin música, la escena sigue igual
    return null
  })
  return pending
}

// null si el sonido está silenciado o el navegador no tiene Web Audio
export function makeMacondoMusic() {
  const Ctx = window.AudioContext || window.webkitAudioContext
  if (!Ctx || !window.OfflineAudioContext || isMuted()) return null
  const ctx = new Ctx()
  const out = ctx.createGain()
  out.connect(ctx.destination)
  let buffer = null
  prepareMacondoMusic().then((b) => {
    buffer = b
  })
  return {
    isReady: () => !!buffer,
    // offset: segundos de escena ya transcurridos, para entrar a compás si la
    // música llega tarde (con un fundido corto para que no chasquee)
    start(offset = 0) {
      if (!buffer) return
      ctx.resume?.()
      const src = ctx.createBufferSource()
      src.buffer = buffer
      src.connect(out)
      if (offset > 0) {
        out.gain.setValueAtTime(0, ctx.currentTime)
        out.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.25)
      }
      src.start(ctx.currentTime, offset)
    },
    // el último acorde se apaga despacio sobre la ficha
    fadeOut(sec = 1.8) {
      out.gain.setTargetAtTime(0, ctx.currentTime, sec / 4)
      setTimeout(() => ctx.close(), sec * 1000 + 300)
    },
  }
}
