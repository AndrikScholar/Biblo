import { isMuted } from '../sound'
import { BAR, BEAT, T } from './aliceScene'

// Música de la entrada de Alicia: un vals en re mayor a 126 pulsos.
//   compases 1-2  la orilla: arpa, celesta y cuerdas suaves
//   compases 3-4  la caída: trémolo de cuerdas, la melodía sube, redoble de
//                 timbal y platillo que crece
//   compás 5      el País de las Maravillas: orquesta entera, coro, trompas,
//                 glissando de arpa y golpe de platillo
//   compases 6-7  la melodía llega arriba (la-si-do#-re) y el último acorde
//                 se queda sonando sobre la ficha
// Se sintetiza entera de una vez (OfflineAudioContext), en segundo plano al
// cargar la página, y luego suena como un solo audio: no da tirones aunque la
// animación vaya cargada.

const SR = 44100
const LEN = BAR * 7 + 3.4
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12)
const at = (bar, beat = 0) => (bar - 1) * BAR + beat * BEAT
const lerp = (a, b, t) => a + (b - a) * t

function noiseBuffer(c, sec) {
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * sec), c.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  return buf
}

// sala grande: ruido estéreo que decae y se oscurece
function impulse(c, sec, decay) {
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

// cuerda pulsada (Karplus-Strong): suena a arpa
function pluck(c, f, sec) {
  const sr = c.sampleRate
  const N = Math.max(2, Math.round(sr / f))
  const len = Math.floor(sr * sec)
  const buf = c.createBuffer(1, len, sr)
  const d = buf.getChannelData(0)
  const ring = new Float32Array(N)
  let prev = 0
  for (let i = 0; i < N; i++) {
    prev += (Math.random() * 2 - 1 - prev) * 0.55
    ring[i] = prev
  }
  const loss = f > 700 ? 0.9965 : 0.9982
  let idx = 0
  for (let i = 0; i < len; i++) {
    const next = (idx + 1) % N
    const v = ring[idx]
    d[i] = v
    ring[idx] = loss * 0.5 * (v + ring[next])
    idx = next
  }
  // la longitud entera del bucle desafina un poco: se corrige con la velocidad
  return { buf, rate: f / (sr / N) }
}

async function renderWaltz() {
  const c = new OfflineAudioContext(2, Math.ceil(SR * LEN), SR)
  const comp = c.createDynamicsCompressor()
  comp.threshold.value = -18
  comp.knee.value = 10
  comp.ratio.value = 3
  comp.attack.value = 0.012
  comp.release.value = 0.3
  comp.connect(c.destination)
  const master = c.createGain()
  master.gain.value = 0.9
  master.connect(comp)
  const verb = c.createConvolver()
  verb.buffer = impulse(c, 2.8, 2.6)
  const pre = c.createDelay(0.1)
  pre.delayTime.value = 0.022
  const wet = c.createGain()
  wet.gain.value = 0.5
  pre.connect(verb).connect(wet).connect(master)
  const send = (node, rev) => {
    node.connect(master)
    const r = c.createGain()
    r.gain.value = rev
    node.connect(r).connect(pre)
  }
  const white = noiseBuffer(c, 3)
  const osc = (type, f) => {
    const o = c.createOscillator()
    o.type = type
    o.frequency.value = f
    return o
  }

  // ---- instrumentos ----

  // sección de cuerdas: tres sierras desafinadas por nota, vibrato y,
  // si se pide, trémolo
  function strings(notes, t0, t1, o = {}) {
    const { vel = 0.045, att = 0.4, rel = 0.7, cut = 1600, cutTo = cut, trem = 0, rev = 0.6 } = o
    const f = c.createBiquadFilter()
    f.type = 'lowpass'
    f.Q.value = 0.6
    f.frequency.setValueAtTime(cut, t0)
    f.frequency.linearRampToValueAtTime(cutTo, t1)
    const g = c.createGain()
    g.gain.setValueAtTime(0, t0)
    g.gain.linearRampToValueAtTime(vel, t0 + att)
    g.gain.linearRampToValueAtTime(o.velTo ?? vel, t1)
    g.gain.linearRampToValueAtTime(0, t1 + rel)
    const lfo = osc('sine', 5.2)
    const depth = c.createGain()
    depth.gain.setValueAtTime(0, t0)
    depth.gain.linearRampToValueAtTime(8, t0 + 0.6)
    lfo.connect(depth)
    lfo.start(t0)
    lfo.stop(t1 + rel + 0.1)
    notes.forEach((m, i) => {
      const pan = c.createStereoPanner()
      pan.pan.value = (i % 2 ? 1 : -1) * 0.32
      for (const det of [-8, 7]) {
        const s = osc('sawtooth', hz(m))
        s.detune.value = det
        depth.connect(s.detune)
        s.connect(pan)
        s.start(t0)
        s.stop(t1 + rel + 0.1)
      }
      pan.connect(f)
    })
    let out = f
    if (trem) {
      const tg = c.createGain()
      tg.gain.value = 1 - trem / 2
      const tl = osc('sine', 11)
      const td = c.createGain()
      td.gain.value = trem / 2
      tl.connect(td).connect(tg.gain)
      tl.start(t0)
      tl.stop(t1 + rel + 0.1)
      f.connect(tg)
      out = tg
    }
    out.connect(g)
    send(g, rev)
  }

  const plucks = new Map()
  function harp(m, t, vel = 0.2, rev = 0.5) {
    let p = plucks.get(m)
    if (!p) {
      p = pluck(c, hz(m), 2.4)
      plucks.set(m, p)
    }
    const s = c.createBufferSource()
    s.buffer = p.buf
    s.playbackRate.value = p.rate
    const g = c.createGain()
    g.gain.value = vel
    const pan = c.createStereoPanner()
    pan.pan.value = Math.max(-0.7, Math.min(0.7, (m - 66) / 28))
    s.connect(g).connect(pan)
    send(pan, rev)
    s.start(t)
  }

  // celesta / campanitas (síntesis FM)
  function bell(m, t, vel = 0.08, dur = 1.6, rev = 0.75) {
    const f0 = hz(m)
    const car = osc('sine', f0)
    const mod = osc('sine', f0 * 3.5)
    const mg = c.createGain()
    mg.gain.setValueAtTime(f0 * 1.4, t)
    mg.gain.exponentialRampToValueAtTime(f0 * 0.04, t + 0.45)
    mod.connect(mg).connect(car.frequency)
    const g = c.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(vel, t + 0.004)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    const pan = c.createStereoPanner()
    pan.pan.value = Math.max(-0.6, Math.min(0.6, (m - 84) / 18))
    car.connect(g).connect(pan)
    send(pan, rev)
    car.start(t)
    mod.start(t)
    car.stop(t + dur + 0.05)
    mod.stop(t + dur + 0.05)
  }

  // melodía ligada (violines): las notas se encadenan sin cortar
  function lead(notes, o = {}) {
    const { oct = 0, cut = 3800, vel = 0.07, rev = 0.65, pan = 0 } = o
    const t0 = notes[0][1]
    const last = notes[notes.length - 1]
    const t1 = last[1] + last[2]
    const f = c.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.value = cut
    f.Q.value = 0.7
    const g = c.createGain()
    g.gain.setValueAtTime(0, t0)
    const lfo = osc('sine', 5.6)
    const vd = c.createGain()
    vd.gain.setValueAtTime(0, t0)
    vd.gain.linearRampToValueAtTime(12, t0 + 0.4)
    lfo.connect(vd)
    const voices = [-7, 0, 6].map((det) => {
      const s = osc('sawtooth', hz(notes[0][0] + oct))
      s.detune.value = det
      vd.connect(s.detune)
      s.connect(f)
      return s
    })
    for (const [m, s0, d, v] of notes) {
      for (const s of voices) {
        if (s0 === t0) s.frequency.setValueAtTime(hz(m + oct), s0)
        else s.frequency.setTargetAtTime(hz(m + oct), s0, 0.03)
      }
      g.gain.setTargetAtTime(v * vel * 0.8, s0, 0.04)
      g.gain.setTargetAtTime(v * vel, s0 + d * 0.3, d * 0.3)
    }
    g.gain.setTargetAtTime(0, t1, 0.3)
    const pn = c.createStereoPanner()
    pn.pan.value = pan
    f.connect(g).connect(pn)
    send(pn, rev)
    for (const s of [...voices, lfo]) {
      s.start(t0)
      s.stop(t1 + 1.6)
    }
  }

  function horns(notes, t0, t1, vel, o = {}) {
    notes.forEach((m, i) => {
      const f = c.createBiquadFilter()
      f.type = 'lowpass'
      f.Q.value = 1.1
      f.frequency.setValueAtTime(350, t0)
      f.frequency.linearRampToValueAtTime(o.bright ?? 1500, t0 + 0.2)
      const g = c.createGain()
      g.gain.setValueAtTime(0, t0)
      g.gain.linearRampToValueAtTime(vel, t0 + (o.att ?? 0.14))
      g.gain.linearRampToValueAtTime(o.velTo ?? vel, t1)
      g.gain.linearRampToValueAtTime(0, t1 + (o.rel ?? 0.4))
      for (const det of [-5, 5]) {
        const s = osc('sawtooth', hz(m))
        s.detune.setValueAtTime(det - 30, t0)
        s.detune.linearRampToValueAtTime(det, t0 + 0.08)
        s.connect(f)
        s.start(t0)
        s.stop(t1 + (o.rel ?? 0.4) + 0.1)
      }
      const pan = c.createStereoPanner()
      pan.pan.value = (i - (notes.length - 1) / 2) * 0.18
      f.connect(g).connect(pan)
      send(pan, 0.6)
    })
  }

  // coro "aah": sierras por tres filtros de formante
  function choir(notes, t0, t1, vel, rel = 0.8) {
    const out = c.createGain()
    out.gain.setValueAtTime(0, t0)
    out.gain.linearRampToValueAtTime(vel, t0 + 0.45)
    out.gain.setValueAtTime(vel, t1)
    out.gain.linearRampToValueAtTime(0, t1 + rel)
    const sum = c.createGain()
    for (const [fq, q, gg] of [
      [750, 6, 1],
      [1150, 8, 0.55],
      [2850, 10, 0.3],
    ]) {
      const bp = c.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.value = fq
      bp.Q.value = q
      const fg = c.createGain()
      fg.gain.value = gg * 3
      sum.connect(bp)
      bp.connect(fg)
      fg.connect(out)
    }
    const lfo = osc('sine', 4.7)
    const ld = c.createGain()
    ld.gain.value = 9
    lfo.connect(ld)
    lfo.start(t0)
    lfo.stop(t1 + rel + 0.1)
    for (const m of notes) {
      for (const det of [-8, 7]) {
        const s = osc('sawtooth', hz(m))
        s.detune.value = det
        ld.connect(s.detune)
        s.connect(sum)
        s.start(t0)
        s.stop(t1 + rel + 0.1)
      }
    }
    send(out, 0.9)
  }

  function timpani(m, t, vel) {
    const f0 = hz(m)
    const out = c.createGain()
    send(out, 0.5)
    const s = osc('sine', f0)
    s.frequency.setValueAtTime(f0 * 1.5, t)
    s.frequency.exponentialRampToValueAtTime(f0, t + 0.05)
    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(vel, t + 0.006)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.8)
    s.connect(g).connect(out)
    const s2 = osc('sine', f0 * 1.51)
    const g2 = c.createGain()
    g2.gain.setValueAtTime(vel * 0.3, t)
    g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.6)
    s2.connect(g2).connect(out)
    const n = c.createBufferSource()
    n.buffer = white
    const nf = c.createBiquadFilter()
    nf.type = 'lowpass'
    nf.frequency.value = 900
    const ng = c.createGain()
    ng.gain.setValueAtTime(vel * 0.5, t)
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.09)
    n.connect(nf).connect(ng).connect(out)
    s.start(t)
    s.stop(t + 1.9)
    s2.start(t)
    s2.stop(t + 0.7)
    n.start(t, Math.random() * 2)
    n.stop(t + 0.12)
  }

  function roll(m, t0, t1, v0, v1) {
    let i = 0
    for (let t = t0; t < t1; t += 0.058, i++) timpani(m, t, lerp(v0, v1, (t - t0) / (t1 - t0)) * (i % 2 ? 1 : 0.85))
  }

  // platillo: crece (swell) y estalla en t
  function cymbal(t, vel, swell = 0, dur = 2.8) {
    const n = c.createBufferSource()
    n.buffer = white
    n.loop = true
    const hp = c.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 5200
    const pk = c.createBiquadFilter()
    pk.type = 'peaking'
    pk.frequency.value = 8200
    pk.Q.value = 1.4
    pk.gain.value = 6
    const g = c.createGain()
    if (swell) {
      g.gain.setValueAtTime(0.0001, t - swell)
      g.gain.exponentialRampToValueAtTime(vel * 0.45, t - 0.02)
    } else g.gain.setValueAtTime(0.0001, t - 0.02)
    g.gain.linearRampToValueAtTime(vel, t + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    n.connect(hp).connect(pk).connect(g)
    send(g, 0.6)
    n.start(Math.max(0, t - swell - 0.02))
    n.stop(t + dur + 0.1)
  }

  function whoosh(t0, t1, f0, f1, vel, q = 1.2) {
    const n = c.createBufferSource()
    n.buffer = white
    n.loop = true
    const bp = c.createBiquadFilter()
    bp.type = 'bandpass'
    bp.Q.value = q
    bp.frequency.setValueAtTime(f0, t0)
    bp.frequency.exponentialRampToValueAtTime(f1, t1)
    const g = c.createGain()
    g.gain.setValueAtTime(0, t0)
    g.gain.linearRampToValueAtTime(vel, t0 + (t1 - t0) * 0.7)
    g.gain.linearRampToValueAtTime(0, t1)
    n.connect(bp).connect(g)
    send(g, 0.5)
    n.start(t0)
    n.stop(t1 + 0.05)
  }

  // tictac del reloj del conejo
  function tick(t, vel) {
    const n = c.createBufferSource()
    n.buffer = white
    const hp = c.createBiquadFilter()
    hp.type = 'bandpass'
    hp.frequency.value = 3800
    hp.Q.value = 6
    const g = c.createGain()
    g.gain.setValueAtTime(vel, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03)
    n.connect(hp).connect(g)
    send(g, 0.3)
    n.start(t, Math.random())
    n.stop(t + 0.04)
  }

  function boom(t, vel) {
    const s = osc('sine', 52)
    s.frequency.setValueAtTime(80, t)
    s.frequency.exponentialRampToValueAtTime(42, t + 0.5)
    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(vel, t + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4)
    s.connect(g)
    send(g, 0.3)
    s.start(t)
    s.stop(t + 1.5)
  }

  // ---- la partitura ----

  // 1-2: la orilla. Re maj9 y si menor 9, arpa en corcheas y un motivo de
  // celesta que baja
  strings([57, 62, 66, 73], at(1), at(2), { vel: 0.026, att: 0.7, cut: 1200 })
  strings([38], at(1), at(2), { vel: 0.05, cut: 420 })
  strings([54, 57, 62, 73], at(2), at(3), { vel: 0.028, att: 0.3, cut: 1300 })
  strings([35], at(2), at(3), { vel: 0.05, cut: 420 })
  ;[50, 57, 64, 66, 69, 73].forEach((m, i) => harp(m, at(1, i * 0.5), 0.2))
  ;[47, 54, 61, 62, 66, 69].forEach((m, i) => harp(m, at(2, i * 0.5), 0.2))
  bell(90, at(1, 0), 0.075, 2)
  bell(88, at(1, 2), 0.065, 1.6)
  bell(86, at(2, 0), 0.075, 2)
  bell(81, at(2, 2), 0.065, 1.8)
  // el reloj del conejo y su destello; se mete en la madriguera
  for (const k of [0, 1, 2, 3]) tick(T.watch[0] + 0.05 + k * 0.12, 0.05)
  bell(93, T.glint, 0.05, 1)
  whoosh(T.rabbit[1] - 0.12, T.rabbit[1] + 0.2, 900, 300, 0.08)
  // la cámara entra por el agujero
  whoosh(T.dive[0], at(3) + 0.35, 250, 2600, 0.22)

  // 3: la caída. Sol maj7 con trémolo; la melodía empieza a subir
  strings([59, 62, 66, 69], at(3), at(4), { vel: 0.034, velTo: 0.05, cut: 1500, cutTo: 2200, trem: 0.6 })
  strings([43, 31], at(3), at(4), { vel: 0.06, cut: 450 })
  ;[43, 50, 55, 59, 62, 66, 69, 71, 74].forEach((m, i) => harp(m, at(3, i / 3), 0.18))
  timpani(43, at(3), 0.22)
  whoosh(at(3), at(5), 700, 1700, 0.05, 0.8)
  const melody = [
    [71, at(3, 0), BEAT, 0.6],
    [73, at(3, 1), BEAT, 0.66],
    [74, at(3, 2), BEAT, 0.72],
    [76, at(4, 0), BEAT, 0.78],
    [78, at(4, 1), BEAT, 0.86],
    [79, at(4, 2), BEAT, 0.94],
    [81, at(5, 0), BEAT * 3, 1],
    [83, at(6, 0), BEAT * 2, 1],
    [85, at(6, 2), BEAT, 1],
    [86, at(7, 0), BAR + 1.3, 1],
  ]
  lead(melody, { vel: 0.07 })
  lead(melody, { oct: -12, vel: 0.042, pan: -0.25, cut: 2600 })

  // 4: la7sus4 → la7, todo crece hacia la luz
  strings([64, 67, 74], at(4), at(4, 2), { vel: 0.045, velTo: 0.06, cut: 2000, cutTo: 2800, trem: 0.7 })
  strings([61, 64, 67, 73], at(4, 2), at(5), { vel: 0.06, velTo: 0.075, att: 0.08, cut: 2800, cutTo: 3400, trem: 0.7 })
  strings([45, 33], at(4), at(5), { vel: 0.065, velTo: 0.09, cut: 500 })
  ;[45, 52, 57, 62, 64, 67, 69, 74, 76, 79, 81, 85].forEach((m, i) => harp(m, at(4, i * 0.25), 0.16))
  horns([57, 62, 64], at(4), at(4, 2), 0.02, { velTo: 0.045, att: 0.3 })
  horns([57, 61, 64], at(4, 2), at(5), 0.045, { velTo: 0.06, att: 0.05 })
  roll(33, at(4), at(5) - 0.05, 0.05, 0.3)
  cymbal(at(5), 0.3, BAR * 0.9, 3.2)
  whoosh(at(4, 1), at(5), 1500, 7000, 0.07, 0.7)

  // 5: re mayor, la orquesta entera
  timpani(38, at(5), 0.85)
  boom(at(5), 0.5)
  strings([62, 66, 69, 74], at(5), at(6), { vel: 0.08, att: 0.05, cut: 3600 })
  strings([50, 57], at(5), at(6), { vel: 0.06, att: 0.05, cut: 2400 })
  strings([38, 26], at(5), at(6), { vel: 0.1, att: 0.04, cut: 600 })
  horns([62, 66, 69], at(5), at(6), 0.055)
  choir([66, 69, 74], at(5), at(6), 0.045, 0.3)
  ;[62, 64, 66, 67, 69, 71, 73, 74, 76, 78, 79, 81, 83, 85, 86].forEach((m, i) => harp(m, at(5) + i * 0.028, 0.15))
  ;[74, 78, 81, 86, 90, 93].forEach((m, i) => bell(m, at(5) + 0.05 + i * 0.06, 0.05, 1.4))
  ;[50, 57, 62, 66, 69, 74].forEach((m, i) => harp(m, at(5, 0.5 + i * 0.42), 0.15))

  // 6: sol maj7 → la; el gato asoma la sonrisa
  strings([59, 62, 66, 71], at(6), at(6, 2), { vel: 0.08, att: 0.08, cut: 3600 })
  strings([61, 64, 69, 73], at(6, 2), at(7), { vel: 0.085, att: 0.06, cut: 3800 })
  strings([43, 31], at(6), at(6, 2), { vel: 0.09, att: 0.05, cut: 600 })
  strings([45, 33], at(6, 2), at(7), { vel: 0.09, att: 0.05, cut: 600 })
  horns([59, 62, 67], at(6), at(6, 2), 0.055)
  horns([61, 64, 69], at(6, 2), at(7), 0.06)
  choir([67, 71, 74], at(6), at(6, 2), 0.045, 0.2)
  choir([69, 73, 76], at(6, 2), at(7), 0.05, 0.2)
  ;[43, 50, 55, 59].forEach((m, i) => harp(m, at(6, i * 0.5), 0.15))
  ;[45, 52, 57].forEach((m, i) => harp(m, at(6, 2 + i * 0.33), 0.15))
  ;[93, 90, 86].forEach((m, i) => bell(m, T.cat[0] + i * 0.11, 0.045, 1.2))

  // 7: re mayor final, largo, sobre la ficha
  timpani(38, at(7), 0.7)
  cymbal(at(7), 0.14, 0.6, 3.5)
  strings([62, 66, 69, 74, 76], at(7), at(7) + 2.4, { vel: 0.085, att: 0.06, cut: 3800, rel: 1.6 })
  strings([50, 57], at(7), at(7) + 2.4, { vel: 0.06, att: 0.06, cut: 2400, rel: 1.6 })
  strings([38, 26], at(7), at(7) + 2.4, { vel: 0.1, att: 0.05, cut: 600, rel: 1.6 })
  horns([62, 66, 69], at(7), at(7) + 2.2, 0.055, { rel: 1.2 })
  choir([66, 69, 74, 78], at(7), at(7) + 2.4, 0.05, 1.4)
  ;[38, 45, 50, 54, 57, 62, 66, 69, 74, 78].forEach((m, i) => harp(m, at(7) + i * 0.045, 0.17))
  ;[86, 90, 93, 98].forEach((m, i) => bell(m, at(7) + 0.3 + i * 0.09, 0.05, 1.6))
  // el gato se deshace en un brillo que sube
  ;[86, 88, 90, 93, 95, 98, 100].forEach((m, i) => bell(m, 8.75 + i * 0.09, 0.028 * (1 - i / 9), 1.2))

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

// Sintetizar el vals tarda un par de segundos: la página lo prepara en
// segundo plano al cargar y la escena reutiliza el resultado.
let pending = null
export function prepareAliceMusic() {
  if (isMuted() || !window.OfflineAudioContext) return null
  pending ??= renderWaltz().catch(() => {
    pending = null // sin música, la escena sigue igual
    return null
  })
  return pending
}

// null si el sonido está silenciado o el navegador no tiene Web Audio
export function makeAliceMusic() {
  const Ctx = window.AudioContext || window.webkitAudioContext
  if (!Ctx || !window.OfflineAudioContext || isMuted()) return null
  const ctx = new Ctx()
  const out = ctx.createGain()
  out.connect(ctx.destination)
  let buffer = null
  const ready = prepareAliceMusic().then((b) => {
    buffer = b
  })
  return {
    ctx,
    ready,
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
