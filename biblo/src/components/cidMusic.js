import { isMuted } from '../sound'
import { T } from './cidScene'
import { buildWind } from './manchaWind'
import { impulse, noiseBuffer, pluck } from './quijoteMusic'

// Música de la entrada del Cid: un laúd a 60 pulsos sobre un bordón grave,
// en re dórico, con el viento entre las flores.
//   compás 1    el laúd sube y baja despacio mientras la cámara llega a él
//   (3,4-5,6)   el suspiro: toma aire y lo suelta; llega una racha de viento
//   compás 2    la melodía desciende y se posa en re con la quinta al aparecer
//               el título; el acorde se queda sonando sobre la ficha
// Se sintetiza entera de una vez (OfflineAudioContext), en segundo plano al
// cargar la página, como las demás entradas.

const SR = 44100
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12)

async function renderRest() {
  const c = new OfflineAudioContext(2, Math.ceil(SR * (T.end + 3)), SR)
  const comp = c.createDynamicsCompressor()
  comp.threshold.value = -18
  comp.ratio.value = 3
  comp.connect(c.destination)
  const master = c.createGain()
  master.gain.value = 0.9
  master.connect(comp)
  const verb = c.createConvolver()
  verb.buffer = impulse(c, 2.8, 2.2)
  const wet = c.createGain()
  wet.gain.value = 0.5
  verb.connect(wet).connect(master)
  const send = (node, rev) => {
    node.connect(master)
    const r = c.createGain()
    r.gain.value = rev
    node.connect(r).connect(verb)
  }
  const white = noiseBuffer(c, 2)

  // laúd: cuerda pulsada con una caja pequeña, más nasal que la guitarra
  const body = c.createBiquadFilter()
  body.type = 'peaking'
  body.frequency.value = 320
  body.Q.value = 1.4
  body.gain.value = 4
  const tone = c.createBiquadFilter()
  tone.type = 'lowpass'
  tone.frequency.value = 3600
  body.connect(tone)
  send(tone, 0.55)
  const plucks = new Map()
  function lute(m, t, vel) {
    if (!plucks.has(m)) plucks.set(m, pluck(c, hz(m), 3))
    const p = plucks.get(m)
    const s = c.createBufferSource()
    s.buffer = p.buf
    s.playbackRate.value = p.rate
    const g = c.createGain()
    g.gain.value = vel
    const pan = c.createStereoPanner()
    pan.pan.value = Math.max(-0.4, Math.min(0.4, (m - 58) / 30))
    s.connect(g).connect(pan).connect(body)
    s.start(t)
  }

  // bordón: re y la graves, sierras desafinadas bajo un filtro oscuro
  const drone = c.createGain()
  drone.gain.setValueAtTime(0, 0)
  drone.gain.linearRampToValueAtTime(0.05, 1.5)
  drone.gain.setValueAtTime(0.05, 5.8)
  drone.gain.linearRampToValueAtTime(0.065, 6.4)
  drone.gain.linearRampToValueAtTime(0, T.end + 2.5)
  const dlp = c.createBiquadFilter()
  dlp.type = 'lowpass'
  dlp.frequency.value = 380
  dlp.connect(drone)
  send(drone, 0.4)
  for (const m of [38, 45]) {
    for (const det of [-6, 5]) {
      const o = c.createOscillator()
      o.type = 'sawtooth'
      o.frequency.value = hz(m)
      o.detune.value = det
      o.connect(dlp)
      o.start(0)
      o.stop(T.end + 3)
    }
  }

  // el viento entre las flores, con la racha del suspiro
  const air = c.createGain()
  air.gain.setValueAtTime(0, 0)
  air.gain.linearRampToValueAtTime(0.6, 1.2)
  air.gain.setValueAtTime(0.6, T.end - 0.4)
  air.gain.linearRampToValueAtTime(0, T.end + 2)
  air.connect(master)
  const wind = buildWind(c, air)
  wind(0.25, 0.01, 0)
  wind(0.75, 0.4, T.exhale[0])
  wind(0.3, 0.9, 6)

  // el suspiro: aire que entra (ruido agudo y suave) y sale por la boca, con
  // las resonancias de una "a" que se apaga y un murmullo de voz cansada
  const breath = (t0, t1, peak, bands, voice) => {
    const out = c.createGain()
    out.gain.setValueAtTime(0, t0)
    out.gain.linearRampToValueAtTime(peak, t0 + (voice ? 0.12 : (t1 - t0) * 0.85))
    if (voice) out.gain.exponentialRampToValueAtTime(0.001, t1)
    else out.gain.linearRampToValueAtTime(0, t1)
    send(out, 0.35)
    const n = c.createBufferSource()
    n.buffer = white
    n.loop = true
    for (const [f0, f1, q, g] of bands) {
      const bp = c.createBiquadFilter()
      bp.type = 'bandpass'
      bp.Q.value = q
      bp.frequency.setValueAtTime(f0, t0)
      bp.frequency.linearRampToValueAtTime(f1, t1)
      const bg = c.createGain()
      bg.gain.value = g
      n.connect(bp).connect(bg).connect(out)
      if (voice) {
        const v = c.createOscillator()
        v.type = 'sawtooth'
        v.frequency.setValueAtTime(150, t0)
        v.frequency.linearRampToValueAtTime(118, t1)
        const vg = c.createGain()
        vg.gain.value = voice * g
        v.connect(vg).connect(bp)
        v.start(t0)
        v.stop(t1 + 0.1)
      }
    }
    n.start(t0)
    n.stop(t1 + 0.1)
  }
  breath(T.inhale[0], T.inhale[1] + 0.02, 0.09, [[1800, 2200, 0.8, 1]], 0)
  breath(T.exhale[0], T.exhale[1] + 0.1, 0.32, [[700, 560, 4, 1], [1150, 980, 5, 0.7]], 0.06)

  // la melodía del laúd
  const NOTES = [
    [50, 0, 0.2], [57, 0, 0.14], [62, 0.5, 0.16], [65, 1, 0.17], [64, 1.5, 0.15],
    [62, 2, 0.16], [60, 2.5, 0.14], [62, 3, 0.17], [45, 3, 0.12],
    [69, 4.8, 0.17], [67, 5.2, 0.15], [65, 5.6, 0.15], [64, 6, 0.15],
    [50, 6.4, 0.2], [57, 6.42, 0.16], [62, 6.44, 0.17], [74, 7.2, 0.09],
  ]
  for (const [m, t, v] of NOTES) lute(m, t, v)

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

let pending = null
export function prepareCidMusic() {
  if (isMuted() || !window.OfflineAudioContext) return null
  pending ??= renderRest().catch(() => {
    pending = null // sin música, la escena sigue igual
    return null
  })
  return pending
}

// null si el sonido está silenciado o el navegador no tiene Web Audio
export function makeCidMusic() {
  const Ctx = window.AudioContext || window.webkitAudioContext
  if (!Ctx || !window.OfflineAudioContext || isMuted()) return null
  const ctx = new Ctx()
  const out = ctx.createGain()
  out.connect(ctx.destination)
  let buffer = null
  prepareCidMusic().then((b) => {
    buffer = b
  })
  return {
    isReady: () => !!buffer,
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
    fadeOut(sec = 1.6) {
      out.gain.setTargetAtTime(0, ctx.currentTime, sec / 4)
      setTimeout(() => ctx.close(), sec * 1000 + 300)
    },
  }
}
