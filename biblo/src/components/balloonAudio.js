import { isMuted } from '../sound'
import { T } from './balloonScene'

// Sonido de la escena de IT. La cajita de música es un mp3; lo demás (agua,
// gotas, zumbido de la lámpara, respiración y el golpe del susto) se sintetiza
// con Web Audio. Todo se agenda contra el reloj del audio al empezar, así
// queda sincronizado con la línea de tiempo T de la escena.

function noiseBuffer(ctx, seconds, brown) {
  const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate)
  const d = buf.getChannelData(0)
  let last = 0
  for (let i = 0; i < d.length; i++) {
    const w = Math.random() * 2 - 1
    if (brown) {
      last = (last + 0.02 * w) / 1.02
      d[i] = last * 3.5
    } else {
      d[i] = w
    }
  }
  return buf
}

// eco de túnel: ruido estéreo que decae
function impulse(ctx, seconds, decay) {
  const len = ctx.sampleRate * seconds
  const buf = ctx.createBuffer(2, len, ctx.sampleRate)
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay)
  }
  return buf
}

export function makeBalloonAudio() {
  const Ctx = window.AudioContext || window.webkitAudioContext
  if (!Ctx || isMuted()) return null
  const ctx = new Ctx()

  const limiter = ctx.createDynamicsCompressor()
  limiter.threshold.value = -10
  limiter.knee.value = 0
  limiter.ratio.value = 12
  limiter.attack.value = 0.002
  limiter.release.value = 0.25
  limiter.connect(ctx.destination)
  const master = ctx.createGain()
  master.gain.value = 0.75
  master.connect(limiter)
  const verb = ctx.createConvolver()
  verb.buffer = impulse(ctx, 3.4, 2.6)
  const verbOut = ctx.createGain()
  verbOut.gain.value = 0.5
  verb.connect(verbOut).connect(master)

  const white = noiseBuffer(ctx, 2, false)
  const brown = noiseBuffer(ctx, 4, true)

  const gain = (v = 0) => {
    const g = ctx.createGain()
    g.gain.value = v
    return g
  }
  const filter = (type, freq, q = 1) => {
    const f = ctx.createBiquadFilter()
    f.type = type
    f.frequency.value = freq
    f.Q.value = q
    return f
  }
  const osc = (type, freq) => {
    const o = ctx.createOscillator()
    o.type = type
    o.frequency.value = freq
    return o
  }
  const noise = (buf, loop) => {
    const s = ctx.createBufferSource()
    s.buffer = buf
    s.loop = loop
    return s
  }
  // salida seca + envío al eco
  const send = (node, dry, wet) => {
    node.connect(gain(dry)).connect(master)
    node.connect(gain(wet)).connect(verb)
  }
  // envolvente rápida: sube en `attack` y se apaga en `release`
  const env = (param, when, peak, attack, release) => {
    param.setValueAtTime(0.0001, when)
    param.exponentialRampToValueAtTime(peak, when + attack)
    param.exponentialRampToValueAtTime(0.0001, when + attack + release)
  }

  let music = null
  const ready = fetch('/cajita-musical.mp3')
    .then((r) => r.arrayBuffer())
    .then((b) => ctx.decodeAudioData(b))
    .then((b) => {
      music = b
    })
    .catch(() => {
      // sin la cajita, la escena sigue con el resto del sonido
    })

  let started = false
  const hum = gain(0)
  let humLevel = 0

  function crackle(when) {
    const s = noise(white, false)
    const g = gain(0)
    env(g.gain, when, 0.18, 0.002, 0.05)
    s.connect(filter('highpass', 2500)).connect(g)
    send(g, 1, 0.3)
    s.start(when, Math.random())
    s.stop(when + 0.08)
  }

  function bloop(when, p) {
    const s = noise(brown, false)
    const g = gain(0)
    env(g.gain, when, 0.5 * p, 0.03, 0.47)
    s.connect(filter('lowpass', 420, 0.8)).connect(g)
    send(g, 1, 0.6)
    s.start(when, Math.random() * 2)
    s.stop(when + 0.6)
    const o = osc('sine', 260)
    o.frequency.setValueAtTime(260, when)
    o.frequency.exponentialRampToValueAtTime(70, when + 0.22)
    const og = gain(0)
    env(og.gain, when, 0.3 * p, 0.02, 0.28)
    o.connect(og)
    send(og, 1, 0.5)
    o.start(when)
    o.stop(when + 0.35)
  }

  function start() {
    started = true
    const t0 = ctx.currentTime + 0.05
    const at = (s) => t0 + s
    const stopAll = at(T.end + 1.2)

    // zumbido eléctrico de la lámpara: su volumen lo marca la luz (setHum)
    const hf = filter('bandpass', 240, 0.9)
    const h1 = osc('sawtooth', 100)
    const h2 = osc('sine', 50)
    h1.connect(hf)
    h2.connect(hf)
    hf.connect(hum)
    send(hum, 1, 0.15)
    for (const o of [h1, h2]) {
      o.start(t0)
      o.stop(stopAll)
    }

    // el fondo: grave que late, rumor del túnel y agua que corre.
    // Se corta en seco en el apagón: el silencio repentino asusta más.
    const bed = gain(0)
    bed.gain.setValueAtTime(0, t0)
    bed.gain.linearRampToValueAtTime(1, at(2.5))
    bed.gain.setValueAtTime(1, at(T.blackout))
    bed.gain.linearRampToValueAtTime(0, at(T.blackout + 0.03))
    send(bed, 1, 0.2)
    const drone = gain(0.07)
    const dlp = filter('lowpass', 150)
    dlp.connect(drone).connect(bed)
    const droneOsc = [osc('sine', 41.2), osc('sine', 43.65), osc('triangle', 61.7)]
    const rumble = noise(brown, true)
    rumble.connect(filter('lowpass', 220)).connect(gain(0.035)).connect(bed)
    const trickle = noise(white, true)
    trickle.connect(filter('bandpass', 700, 0.5)).connect(gain(0.012)).connect(bed)
    for (const o of droneOsc) o.connect(dlp)
    for (const n of [...droneOsc, rumble, trickle]) {
      n.start(t0)
      n.stop(at(T.blackout + 0.1))
    }

    // la cajita de música: lejana al principio, más clara al acercarse el
    // globo, y al final se queda sin cuerda (cada nota más lenta y grave)
    if (music) {
      const src = ctx.createBufferSource()
      src.buffer = music
      const lp = filter('lowpass', 650, 0.5)
      lp.frequency.setValueAtTime(650, at(T.emerge))
      lp.frequency.exponentialRampToValueAtTime(6500, at(7.6))
      const g = gain(0)
      g.gain.setValueAtTime(0, t0)
      g.gain.linearRampToValueAtTime(0.45, at(1.8))
      g.gain.linearRampToValueAtTime(0.75, at(7.6))
      g.gain.linearRampToValueAtTime(0, at(T.slow[1] + 0.15))
      src.playbackRate.setValueAtTime(1, at(T.slow[0]))
      src.playbackRate.exponentialRampToValueAtTime(0.3, at(T.slow[1]))
      // vibrato de cinta vieja
      const wob = osc('sine', 0.45)
      wob.connect(gain(16)).connect(src.detune)
      src.connect(lp).connect(g)
      send(g, 0.85, 0.7)
      src.start(at(0.3))
      src.stop(at(T.slow[1] + 0.3))
      wob.start(t0)
      wob.stop(at(T.slow[1] + 0.3))
    }

    // el globo sale del agua
    bloop(at(T.emerge), 1)
    bloop(at(T.emerge + 0.45), 0.5)

    // tensión mientras el globo te mira: aire que sube, cuerdas agudas
    // disonantes y un grave que crece; todo se corta en el apagón
    const rise = gain(0)
    rise.gain.setValueAtTime(0, at(T.tension[0]))
    rise.gain.linearRampToValueAtTime(1, at(T.blackout - 0.05))
    rise.gain.linearRampToValueAtTime(0, at(T.blackout))
    send(rise, 1, 0.35)
    const air = noise(white, true)
    const abp = filter('bandpass', 300, 5)
    abp.frequency.setValueAtTime(300, at(T.tension[0]))
    abp.frequency.exponentialRampToValueAtTime(2600, at(T.blackout))
    air.connect(abp).connect(gain(0.18)).connect(rise)
    const strings = filter('lowpass', 3200)
    strings.connect(gain(0.018)).connect(rise)
    const vib = osc('sine', 5.5)
    const vibAmt = gain(14)
    vib.connect(vibAmt)
    const high = [1318.5, 1396.9, 1480].map((f) => {
      const o = osc('sawtooth', f)
      vibAmt.connect(o.detune)
      o.connect(strings)
      return o
    })
    const sub = osc('sine', 34)
    sub.frequency.setValueAtTime(34, at(T.tension[0]))
    sub.frequency.linearRampToValueAtTime(50, at(T.blackout))
    sub.connect(gain(0.22)).connect(rise)
    for (const n of [air, vib, sub, ...high]) {
      n.start(at(T.tension[0]))
      n.stop(at(T.blackout + 0.1))
    }

    // en la oscuridad, alguien respira justo detrás de tu hombro derecho
    const breath = noise(white, false)
    const bbp = filter('bandpass', 800, 0.7)
    bbp.frequency.setValueAtTime(800, at(T.breath))
    bbp.frequency.linearRampToValueAtTime(1300, at(T.breath + 0.5))
    const bg = gain(0)
    bg.gain.setValueAtTime(0, at(T.breath))
    bg.gain.linearRampToValueAtTime(0.32, at(T.breath + 0.42))
    bg.gain.linearRampToValueAtTime(0, at(T.breath + 0.55))
    const pan = ctx.createStereoPanner()
    pan.pan.value = 0.55
    breath.connect(bbp).connect(filter('highpass', 350)).connect(bg).connect(pan)
    send(pan, 1, 0.1)
    breath.start(at(T.breath))
    breath.stop(at(T.breath + 0.6))

    // el susto: el globo revienta, golpe grave, grito de cuerdas y estruendo
    const s0 = at(T.scare)
    const pop = noise(white, false)
    const pg = gain(0)
    env(pg.gain, s0, 0.6, 0.002, 0.09)
    pop.connect(filter('highpass', 1200)).connect(pg)
    send(pg, 1, 0.5)
    pop.start(s0)
    pop.stop(s0 + 0.15)

    const boom = osc('sine', 150)
    boom.frequency.setValueAtTime(150, s0)
    boom.frequency.exponentialRampToValueAtTime(30, s0 + 0.6)
    const boomG = gain(0)
    env(boomG.gain, s0, 0.7, 0.01, 1.6)
    boom.connect(boomG)
    send(boomG, 1, 0.4)

    const sweep = filter('bandpass', 2600, 0.6)
    sweep.frequency.setValueAtTime(2600, s0)
    sweep.frequency.exponentialRampToValueAtTime(700, s0 + 1.4)
    const clusterG = gain(0)
    env(clusterG.gain, s0, 0.5, 0.015, 1.9)
    sweep.connect(clusterG)
    send(clusterG, 1, 0.55)
    const cluster = [207.65, 220, 233.08, 311.13, 329.63, 440, 466.16, 622.25, 659.26, 1244.5].map((f) => {
      const o = osc('sawtooth', f)
      o.detune.value = (Math.random() - 0.5) * 24
      o.connect(sweep)
      return o
    })

    const screechG = gain(0)
    env(screechG.gain, s0, 0.09, 0.01, 1.2)
    send(screechG, 1, 0.5)
    const trem = osc('sine', 7)
    const tremAmt = gain(45)
    trem.connect(tremAmt)
    const screech = [1760, 1864.7].map((f) => {
      const o = osc('sawtooth', f)
      tremAmt.connect(o.detune)
      o.connect(screechG)
      return o
    })

    const slam = noise(brown, false)
    const slamG = gain(0)
    env(slamG.gain, s0, 0.5, 0.01, 1)
    slam.connect(filter('lowpass', 900)).connect(slamG)
    send(slamG, 1, 0.55)
    for (const n of [boom, trem, slam, ...cluster, ...screech]) {
      n.start(s0)
      n.stop(s0 + 2.2)
    }

    // eco final: la cajita vuelve, lenta y lejana, mientras se abre la ficha
    if (music) {
      const echo = ctx.createBufferSource()
      echo.buffer = music
      echo.playbackRate.value = 0.62
      const g = gain(0)
      g.gain.setValueAtTime(0, at(T.cut + 0.2))
      g.gain.linearRampToValueAtTime(0.16, at(T.cut + 0.5))
      g.gain.linearRampToValueAtTime(0, at(T.end + 0.9))
      echo.connect(filter('lowpass', 1400)).connect(g)
      send(g, 0.5, 1)
      echo.start(at(T.cut + 0.2), 10.15)
      echo.stop(at(T.end + 1))
    }
  }

  // la lámpara zumba con su luz y chasquea al encenderse de golpe
  function setHum(level) {
    if (!started) return
    const now = ctx.currentTime
    hum.gain.setTargetAtTime(level * 0.045, now, 0.015)
    if (level > 0.5 && humLevel < 0.2) crackle(now)
    humLevel = level
  }

  // gota que cae al agua: un "plic" que sube de tono, con eco de túnel
  function drip(pan, near) {
    if (!started) return
    const t = ctx.currentTime
    const f0 = 900 + Math.random() * 900
    const o = osc('sine', f0)
    o.frequency.setValueAtTime(f0, t)
    o.frequency.exponentialRampToValueAtTime(f0 * 2.1, t + 0.06)
    const g = gain(0)
    env(g.gain, t, 0.1 * near, 0.005, 0.12)
    const p = ctx.createStereoPanner()
    p.pan.value = pan
    o.connect(g).connect(p)
    send(p, 1, 0.9)
    o.start(t)
    o.stop(t + 0.15)
  }

  function fadeOut() {
    master.gain.setTargetAtTime(0, ctx.currentTime, 0.12)
  }

  return { ctx, ready, start, setHum, drip, fadeOut }
}
