import { isMuted } from '../sound'
import { BAR, BEAT, T } from './quijoteScene'
import { buildWind } from './manchaWind'

// Música de la entrada de Don Quijote: una guitarra española a 100 pulsos,
// sin prisa, con los cascos de fondo.
//   compás 1    los cascos: guitarra en re menor (re menor, do), solo los
//               pasos y el viento
//   compás 2    aparecen los dos: entra la flauta (si bemol, la)
//   compás 3    la flauta sube mientras don Quijote apunta a los molinos (re
//               menor, sol menor, la7), cuerdas y platillo que crece
//   compás 4    re mayor: rasgueo, la flauta llega al fa sostenido y el
//               acorde se queda sonando sobre la ficha
// Cada pisada del caballo (y del burro, más suave) suena cuando se ve: el
// caballo en corcheas, el burro en tresillos. Se sintetiza entera de una vez
// (OfflineAudioContext), en segundo plano al cargar la página.

const SR = 44100
const LEN = T.end + 3
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12)
const at = (bar, beat = 0) => (bar - 1) * BAR + beat * BEAT

export function noiseBuffer(c, sec) {
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * sec), c.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  return buf
}

// sala: ruido estéreo que decae y se oscurece
export function impulse(c, sec, decay) {
  const len = Math.floor(c.sampleRate * sec)
  const buf = c.createBuffer(2, len, c.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch)
    let lp = 0
    for (let i = 0; i < len; i++) {
      const x = i / len
      lp += (Math.random() * 2 - 1 - lp) * (0.8 - 0.72 * x)
      d[i] = lp * Math.pow(1 - x, decay)
    }
  }
  return buf
}

// cuerda pulsada (Karplus-Strong) con la pérdida de una cuerda de nailon
export function pluck(c, f, sec) {
  const sr = c.sampleRate
  const N = Math.max(2, Math.round(sr / f))
  const buf = c.createBuffer(1, Math.floor(sr * sec), sr)
  const d = buf.getChannelData(0)
  const ring = new Float32Array(N)
  let prev = 0
  for (let i = 0; i < N; i++) {
    prev += (Math.random() * 2 - 1 - prev) * 0.45
    ring[i] = prev
  }
  const loss = f > 400 ? 0.9955 : 0.9975
  let idx = 0
  for (let i = 0; i < d.length; i++) {
    const next = (idx + 1) % N
    const v = ring[idx]
    d[i] = v
    ring[idx] = loss * 0.5 * (v + ring[next])
    idx = next
  }
  return { buf, rate: f / (sr / N) }
}

async function renderRide() {
  const c = new OfflineAudioContext(2, Math.ceil(SR * LEN), SR)
  const comp = c.createDynamicsCompressor()
  comp.threshold.value = -18
  comp.ratio.value = 3
  comp.connect(c.destination)
  const master = c.createGain()
  master.gain.value = 0.9
  master.connect(comp)
  const verb = c.createConvolver()
  verb.buffer = impulse(c, 2.2, 2.4)
  const wet = c.createGain()
  wet.gain.value = 0.45
  verb.connect(wet).connect(master)
  const send = (node, rev) => {
    node.connect(master)
    const r = c.createGain()
    r.gain.value = rev
    node.connect(r).connect(verb)
  }
  const white = noiseBuffer(c, 2)
  const osc = (type, f) => {
    const o = c.createOscillator()
    o.type = type
    o.frequency.value = f
    return o
  }

  // ---- instrumentos ----

  // guitarra: cuerda pulsada por una caja que realza los graves cálidos y
  // apaga el brillo
  const body = c.createBiquadFilter()
  body.type = 'peaking'
  body.frequency.value = 210
  body.Q.value = 1.1
  body.gain.value = 5
  const tone = c.createBiquadFilter()
  tone.type = 'lowpass'
  tone.frequency.value = 3200
  body.connect(tone)
  send(tone, 0.4)
  const plucks = new Map()
  function guitar(m, t, vel = 0.22) {
    let p = plucks.get(m)
    if (!p) {
      p = pluck(c, hz(m), 2.6)
      plucks.set(m, p)
    }
    const s = c.createBufferSource()
    s.buffer = p.buf
    s.playbackRate.value = p.rate
    const g = c.createGain()
    g.gain.value = vel
    const pan = c.createStereoPanner()
    pan.pan.value = Math.max(-0.5, Math.min(0.5, (m - 50) / 30))
    s.connect(g).connect(pan).connect(body)
    s.start(t)
  }
  // arpegio de cuatro notas en corcheas: el bajo más fuerte
  function arp(notes, t, eighths = 4, vel = 0.2) {
    for (let i = 0; i < eighths; i++) guitar(notes[i % notes.length], t + (i * BEAT) / 2, i ? vel * 0.75 : vel)
  }
  // rasgueo: las cuerdas de abajo arriba, casi a la vez
  function strum(notes, t, vel = 0.2, gap = 0.028) {
    notes.forEach((m, i) => guitar(m, t + i * gap, vel * (1 - i * 0.05)))
  }

  // flauta: seno con un poco de segundo armónico, soplo y vibrato que crece;
  // las notas se encadenan
  function flute(notes, vel = 0.07) {
    const t0 = notes[0][1]
    const last = notes[notes.length - 1]
    const t1 = last[1] + last[2]
    const g = c.createGain()
    g.gain.setValueAtTime(0, t0)
    const lfo = osc('sine', 5.2)
    const vd = c.createGain()
    vd.gain.setValueAtTime(0, t0)
    vd.gain.linearRampToValueAtTime(14, t0 + 0.8)
    lfo.connect(vd)
    const main = osc('sine', hz(notes[0][0]))
    const second = osc('triangle', hz(notes[0][0]) * 2)
    const sg = c.createGain()
    sg.gain.value = 0.18
    vd.connect(main.detune)
    vd.connect(second.detune)
    main.connect(g)
    second.connect(sg).connect(g)
    // el soplo: ruido estrecho alrededor de la nota
    const breath = c.createBufferSource()
    breath.buffer = white
    breath.loop = true
    const bp = c.createBiquadFilter()
    bp.type = 'bandpass'
    bp.Q.value = 9
    const bg = c.createGain()
    bg.gain.value = 0.35
    breath.connect(bp).connect(bg).connect(g)
    for (const [m, s0, d, v] of notes) {
      for (const o of [main, second]) {
        const f = hz(m) * (o === second ? 2 : 1)
        if (s0 === t0) o.frequency.setValueAtTime(f, s0)
        else o.frequency.setTargetAtTime(f, s0, 0.025)
      }
      bp.frequency.setTargetAtTime(hz(m) * 2, s0, 0.02)
      g.gain.setTargetAtTime(v * vel, s0, 0.06)
      g.gain.setTargetAtTime(v * vel * 0.85, s0 + d * 0.5, d * 0.4)
    }
    g.gain.setTargetAtTime(0, t1, 0.35)
    const pan = c.createStereoPanner()
    pan.pan.value = 0.15
    g.connect(pan)
    send(pan, 0.6)
    for (const o of [main, second, lfo, breath]) {
      o.start(t0)
      o.stop(t1 + 2)
    }
  }

  // cuerdas: sierras desafinadas por un filtro, entran y salen suaves
  function strings(notes, t0, t1, vel, o = {}) {
    const { att = 0.5, rel = 0.8, cut = 1400 } = o
    const f = c.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.value = cut
    f.Q.value = 0.6
    const g = c.createGain()
    g.gain.setValueAtTime(0, t0)
    g.gain.linearRampToValueAtTime(vel, t0 + att)
    g.gain.linearRampToValueAtTime(o.velTo ?? vel, t1)
    g.gain.linearRampToValueAtTime(0, t1 + rel)
    for (const m of notes) {
      for (const det of [-8, 7]) {
        const s = osc('sawtooth', hz(m))
        s.detune.value = det
        s.connect(f)
        s.start(t0)
        s.stop(t1 + rel + 0.1)
      }
    }
    f.connect(g)
    send(g, 0.7)
  }

  // un casco sobre la tierra: golpe seco de madera y un poco de polvo
  function clop(t, vel, pitch) {
    const out = c.createGain()
    out.gain.value = vel
    send(out, 0.15)
    const s = osc('sine', pitch * 1.6)
    s.frequency.setValueAtTime(pitch * 1.6, t)
    s.frequency.exponentialRampToValueAtTime(pitch, t + 0.03)
    const sg = c.createGain()
    sg.gain.setValueAtTime(0.0001, t)
    sg.gain.exponentialRampToValueAtTime(0.9, t + 0.003)
    sg.gain.exponentialRampToValueAtTime(0.0001, t + 0.07)
    s.connect(sg).connect(out)
    const n = c.createBufferSource()
    n.buffer = white
    const bp = c.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = pitch * 4.5
    bp.Q.value = 1.6
    const ng = c.createGain()
    ng.gain.setValueAtTime(0.7, t)
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.05)
    n.connect(bp).connect(ng).connect(out)
    s.start(t)
    s.stop(t + 0.08)
    n.start(t, Math.random())
    n.stop(t + 0.06)
  }

  function cymbal(t, vel, swell, dur = 2.6) {
    const n = c.createBufferSource()
    n.buffer = white
    n.loop = true
    const hp = c.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 5600
    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, t - swell)
    g.gain.exponentialRampToValueAtTime(vel * 0.5, t - 0.02)
    g.gain.linearRampToValueAtTime(vel, t + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    n.connect(hp).connect(g)
    send(g, 0.6)
    n.start(t - swell)
    n.stop(t + dur + 0.1)
  }

  function bass(m, t, dur, vel) {
    const s = osc('sine', hz(m))
    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(vel, t + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    s.connect(g)
    send(g, 0.3)
    s.start(t)
    s.stop(t + dur + 0.05)
  }

  // ---- la partitura ----

  // el viento de La Mancha, muy bajo; sopla una racha cuando don Quijote
  // apunta a los molinos
  const air = c.createGain()
  air.gain.setValueAtTime(0, 0)
  air.gain.linearRampToValueAtTime(0.7, 1.2)
  air.gain.setValueAtTime(0.7, T.end - 0.4)
  air.gain.linearRampToValueAtTime(0, T.end + 1.5)
  air.connect(master)
  const wind = buildWind(c, air)
  wind(0.3, 0.01, 0)
  wind(0.75, 0.5, T.lance[0])
  wind(0.35, 0.8, T.lance[1] + 0.4)

  // los cascos: el caballo en corcheas, el burro en tresillos, más suave y
  // agudo; suenan más cuando la cámara está pegada al suelo
  const near = (t) => (t < T.pull[0] ? 1 : t < T.pull[1] ? 1 - 0.5 * ((t - T.pull[0]) / (T.pull[1] - T.pull[0])) : 0.5)
  for (let t = 0, i = 0; t < T.end - 0.2; t += BEAT / 2, i++) {
    clop(t, 0.32 * near(t) * (i % 2 ? 0.8 : 1), i % 2 ? 230 : 205)
  }
  for (let t = BEAT / 3, i = 0; t < T.end - 0.2; t += BEAT / 3, i++) {
    clop(t, 0.12 * near(t), i % 2 ? 330 : 300)
  }

  const DM = [38, 45, 50, 53]
  const C = [36, 43, 48, 52]
  const BB = [34, 41, 46, 50]
  const A = [33, 40, 45, 49]
  const GM = [31, 38, 43, 46]
  const A7 = [33, 40, 43, 49]

  // 1: re menor, do
  arp(DM, at(1))
  arp(C, at(1, 2))
  // 2: si bemol, la; entra la flauta con los dos
  arp(BB, at(2))
  arp(A, at(2, 2))
  strings([46, 50, 53], at(2), at(2, 2), 0.018, { att: 0.8 })
  strings([45, 49, 52], at(2, 2), at(3), 0.02, { att: 0.3 })
  // 3: re menor, sol menor, la7; todo crece hacia el final
  arp(DM, at(3))
  arp(GM, at(3, 2), 2)
  arp(A7, at(3, 3), 2)
  strings([50, 53, 57], at(3), at(3, 2), 0.022, { att: 0.3, velTo: 0.028 })
  strings([46, 50, 55], at(3, 2), at(3, 3), 0.03, { att: 0.15 })
  strings([49, 52, 55, 57], at(3, 3), at(4), 0.034, { att: 0.12, velTo: 0.042 })
  strings([26], at(3), at(4), 0.03, { cut: 300 })
  cymbal(at(4), 0.07, BAR * 0.5)
  flute([
    [74, at(2), BEAT * 2, 0.9],
    [73, at(2, 2), BEAT, 0.8],
    [76, at(2, 3), BEAT, 0.85],
    [77, at(3), BEAT * 2, 1],
    [79, at(3, 2), BEAT, 1],
    [76, at(3, 3), BEAT, 0.9],
    [78, at(4), BAR + 0.6, 1],
  ])

  // 4: re mayor, rasgueado; se queda sonando sobre la ficha
  strum([38, 45, 50, 54, 57, 62], at(4), 0.22)
  strum([50, 54, 57, 62], at(4, 2), 0.1, 0.02)
  strings([50, 54, 57, 62], at(4), at(4) + 2.2, 0.04, { att: 0.08, rel: 1.4, cut: 1800 })
  strings([38], at(4), at(4) + 2.2, 0.04, { att: 0.08, rel: 1.4, cut: 300 })
  bass(26, at(4), 2.4, 0.22)

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
export function prepareQuijoteMusic() {
  if (isMuted() || !window.OfflineAudioContext) return null
  pending ??= renderRide().catch(() => {
    pending = null // sin música, la escena sigue igual
    return null
  })
  return pending
}

// null si el sonido está silenciado o el navegador no tiene Web Audio
export function makeQuijoteMusic() {
  const Ctx = window.AudioContext || window.webkitAudioContext
  if (!Ctx || !window.OfflineAudioContext || isMuted()) return null
  const ctx = new Ctx()
  const out = ctx.createGain()
  out.connect(ctx.destination)
  let buffer = null
  prepareQuijoteMusic().then((b) => {
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
    fadeOut(sec = 1.6) {
      out.gain.setTargetAtTime(0, ctx.currentTime, sec / 4)
      setTimeout(() => ctx.close(), sec * 1000 + 300)
    },
  }
}
