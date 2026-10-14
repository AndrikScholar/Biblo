import { isMuted } from '../sound'

// El viento de La Mancha para la ficha de Don Quijote. Una sola función de
// rachas mueve a la vez el trigo, las aspas de los molinos, la paja que vuela
// y el sonido, así todo sopla junto. `s`: segundos desde que se abre la ficha.
// La primera racha llega enseguida y luego otras cada 6-12 s, unas más
// fuertes que otras (siempre las mismas, con semilla).

const LOOP = 600
const GUSTS = []
{
  let seed = 1605
  const rand = () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  for (let at = 2.4; at < LOOP - 10; at += 5.5 + rand() * 7) {
    GUSTS.push({ at, dur: 2.6 + rand() * 1.8, amp: GUSTS.length ? 0.32 + rand() * 0.4 : 0.62 })
  }
}

// fuerza del viento: ~0.2 en calma, hasta ~1 en una racha fuerte
export function windAt(s) {
  s %= LOOP
  let w = 0.2 + 0.05 * Math.sin(s * 0.37) + 0.04 * Math.sin(s * 0.91 + 1)
  for (const g of GUSTS) {
    const u = (s - g.at) / g.dur
    if (u > 0 && u < 1) w += g.amp * Math.sin(Math.PI * u ** 0.75) ** 2
  }
  return Math.min(1, w)
}

// ruido rosa en bucle; el final se funde con el principio para que no se
// oiga el empalme
function pinkNoise(ac, sec) {
  const len = Math.round(ac.sampleRate * sec)
  const xf = Math.round(ac.sampleRate * 0.05)
  const buf = ac.createBuffer(2, len, ac.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const raw = new Float32Array(len + xf)
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0
    for (let i = 0; i < raw.length; i++) {
      const w = Math.random() * 2 - 1
      b0 = 0.99886 * b0 + w * 0.0555179
      b1 = 0.99332 * b1 + w * 0.0750759
      b2 = 0.969 * b2 + w * 0.153852
      b3 = 0.8665 * b3 + w * 0.3104856
      b4 = 0.55 * b4 + w * 0.5329522
      b5 = -0.7616 * b5 - w * 0.016898
      raw[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11
      b6 = w * 0.115926
    }
    const d = buf.getChannelData(ch)
    d.set(raw.subarray(0, len))
    for (let i = 0; i < xf; i++) d[i] = raw[len + i] * (1 - i / xf) + raw[i] * (i / xf)
  }
  return buf
}

// Arma el viento en `ac` hacia `out`. Tres capas del mismo ruido: un soplo
// grave, el aire (que sube de tono con las rachas) y, en las rachas fuertes,
// el susurro del trigo. Devuelve `set(g, lag, at)` para moverlas con el
// viento (`at`: cuándo, por defecto ya).
export function buildWind(ac, out) {
  const src = ac.createBufferSource()
  src.buffer = pinkNoise(ac, 4)
  src.loop = true

  const low = ac.createBiquadFilter()
  low.type = 'lowpass'
  low.frequency.value = 170
  const lowG = ac.createGain()

  const air = ac.createBiquadFilter()
  air.type = 'bandpass'
  const airG = ac.createGain()

  const hiss = ac.createBiquadFilter()
  hiss.type = 'bandpass'
  hiss.frequency.value = 3600
  hiss.Q.value = 0.9
  const hissG = ac.createGain()

  src.connect(low).connect(lowG).connect(out)
  src.connect(air).connect(airG).connect(out)
  src.connect(hiss).connect(hissG).connect(out)
  src.start()

  return function set(g, lag, t = ac.currentTime) {
    lowG.gain.setTargetAtTime(0.1 * (0.3 + 0.7 * g), t, lag)
    airG.gain.setTargetAtTime(0.32 * (0.08 + 0.92 * g ** 1.6), t, lag)
    air.frequency.setTargetAtTime(350 + 900 * g, t, lag)
    air.Q.setTargetAtTime(0.6 + 0.7 * g, t, lag)
    hissG.gain.setTargetAtTime(0.1 * g ** 3, t, lag)
  }
}

// El viento muy tenue de la ficha. `gust(ms)` da la fuerza del viento en un
// instante de performance.now(), la misma que mueve el paisaje.
export function startWind(gust) {
  const Ctx = window.AudioContext || window.webkitAudioContext
  if (!Ctx || !gust || isMuted()) return null
  const ac = new Ctx()
  ac.resume?.().catch(() => {})
  const master = ac.createGain()
  const now = ac.currentTime
  master.gain.setValueAtTime(0, now)
  master.gain.linearRampToValueAtTime(1, now + 2.5)
  master.connect(ac.destination)
  const set = buildWind(ac, master)
  // se adelanta un poco para que el sonido llegue a la vez que la racha
  const follow = (lag) => set(gust(performance.now() + 150), lag)
  follow(0.01)
  const timer = setInterval(() => follow(0.35), 120)

  return {
    stop() {
      clearInterval(timer)
      master.gain.cancelScheduledValues(ac.currentTime)
      master.gain.setTargetAtTime(0, ac.currentTime, 0.2)
      setTimeout(() => ac.close(), 900)
    },
  }
}
