import { useEffect, useRef, useState } from 'react'
import BookModal from './BookModal'
import books from '../data/books'
import './CthulhuRising.css'

// Escena de "La Llamada de Cthulhu": Cthulhu emerge del océano entre lluvia
// y relámpagos (~5.5 s). Todo se dibuja en un único canvas; el trueno y la
// lluvia se sintetizan con Web Audio, así que no hacen falta archivos de sonido.
// Al terminar (o al saltarla) se abre la ficha del libro.
const BOOK = books.find((b) => b.id === 'abisal')
const TOTAL_MS = 5600
const RISE = [700, 3900]
const BOLTS = [
  { at: 600, power: 0.35, bolt: false },
  { at: 2500, power: 1, bolt: true },
  { at: 3650, power: 0.7, bolt: true },
  { at: 3820, power: 0.5, bolt: false },
]
// línea de cada capa de mar (fracción de la altura): fondo, media, frente
const SEA = [0.79, 0.86, 0.93]

const rand = (a, b) => a + Math.random() * (b - a)
const clamp01 = (v) => Math.min(1, Math.max(0, v))
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

function makeAudio() {
  const Ctx = window.AudioContext || window.webkitAudioContext
  if (!Ctx) return null
  const ctx = new Ctx()
  // ruido marrón: base tanto del trueno como de la lluvia
  const len = ctx.sampleRate * 4
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const data = buf.getChannelData(0)
  let last = 0
  for (let i = 0; i < len; i++) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02
    data[i] = last * 3.5
  }

  const master = ctx.createGain()
  master.gain.value = 0.9
  master.connect(ctx.destination)

  // lluvia: ruido blanco filtrado, en bucle
  const white = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
  const wd = white.getChannelData(0)
  for (let i = 0; i < wd.length; i++) wd[i] = Math.random() * 2 - 1
  const rain = ctx.createBufferSource()
  rain.buffer = white
  rain.loop = true
  const rainFilter = ctx.createBiquadFilter()
  rainFilter.type = 'bandpass'
  rainFilter.frequency.value = 1400
  rainFilter.Q.value = 0.6
  const rainGain = ctx.createGain()
  rainGain.gain.setValueAtTime(0, ctx.currentTime)
  rainGain.gain.linearRampToValueAtTime(0.07, ctx.currentTime + 0.6)
  rain.connect(rainFilter).connect(rainGain).connect(master)
  rain.start()

  function thunder(power, delay = 0) {
    const t = ctx.currentTime + delay
    const src = ctx.createBufferSource()
    src.buffer = buf
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.setValueAtTime(900 * power + 200, t)
    lp.frequency.exponentialRampToValueAtTime(90, t + 2.8)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(1.4 * power, t + 0.04)
    g.gain.exponentialRampToValueAtTime(0.5 * power, t + 0.5)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 3.2)
    src.connect(lp).connect(g).connect(master)
    src.start(t, rand(0, 0.5))
    src.stop(t + 3.4)
  }

  function fadeOut() {
    master.gain.setTargetAtTime(0, ctx.currentTime, 0.15)
  }

  return { ctx, thunder, fadeOut }
}

function boltPath(x, h) {
  const pts = [[x, -10]]
  let px = x
  let py = -10
  while (py < h) {
    px += rand(-46, 46)
    py += rand(24, 60)
    pts.push([px, py])
  }
  return pts
}

export default function CthulhuRising({ onExit, synopsisProps }) {
  const canvasRef = useRef(null)
  // con movimiento reducido se va directo a la ficha
  const [phase, setPhase] = useState(() =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'book' : 'scene'
  )
  const [showWords, setShowWords] = useState(false)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    if (phase !== 'scene') return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const img = new Image()
    img.src = '/scenes/cthulhu.webp'
    const audio = makeAudio()

    let W = 0
    let H = 0
    let raf = null
    let start = null
    let flash = 0
    let shake = 0
    let bolt = null
    let firedBolts = 0
    const rain = []
    const spray = []
    const splashes = []

    // Dos versiones pre-renderizadas de Cthulhu (oscura e iluminada) al
    // tamaño de pantalla: por fotograma solo se mezclan, sin filtros caros.
    let dark = null
    let lit = null
    let iw = 0
    let ih = 0

    function bake() {
      if (!img.naturalWidth || !W) return
      iw = Math.min(W * 0.96, H * 0.92 * (img.naturalWidth / img.naturalHeight))
      ih = iw * (img.naturalHeight / img.naturalWidth)
      const make = (filter) => {
        const c = document.createElement('canvas')
        c.width = Math.round(iw * dpr)
        c.height = Math.round(ih * dpr)
        const g = c.getContext('2d')
        g.filter = filter
        g.drawImage(img, 0, 0, c.width, c.height)
        return c
      }
      dark = make('brightness(0.45)')
      lit = make('brightness(1.6) saturate(1.3)')
    }

    function resize() {
      W = window.innerWidth
      H = window.innerHeight
      canvas.width = W * dpr
      canvas.height = H * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      bake()
    }

    img.onload = bake

    function seaY(x, t, layer) {
      const amp = 7 + layer * 6
      return (
        H * SEA[layer] +
        Math.sin(x * 0.006 + t * (0.0011 + layer * 0.0004) + layer) * amp +
        Math.sin(x * 0.017 - t * 0.0019 + layer * 2) * amp * 0.45
      )
    }

    function drawSea(t, layer, top, bottom) {
      const g = ctx.createLinearGradient(0, H * SEA[layer] - 20, 0, H)
      g.addColorStop(0, top)
      g.addColorStop(1, bottom)
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.moveTo(0, H)
      for (let x = 0; x <= W + 20; x += 16) ctx.lineTo(x, seaY(x, t, layer))
      ctx.lineTo(W, H)
      ctx.closePath()
      ctx.fill()

      // cresta y espuma: trazos cortos que corren con la ola
      ctx.strokeStyle = `rgba(143, 242, 226, ${0.16 + layer * 0.08 + flash * 0.45})`
      ctx.lineWidth = 1 + layer * 0.6
      ctx.beginPath()
      for (let x = 0; x <= W + 20; x += 16) {
        const y = seaY(x, t, layer)
        if (Math.sin(x * 0.045 + t * 0.0016 + layer * 3) > 0.15) {
          ctx.moveTo(x, y)
          ctx.lineTo(x + 16, seaY(x + 16, t, layer))
        }
      }
      ctx.stroke()

      // reflejos del relámpago en el agua
      if (flash > 0.05) {
        ctx.fillStyle = `rgba(160, 230, 230, ${flash * 0.12})`
        ctx.fillRect(0, H * SEA[layer], W, H)
      }
    }

    let prev = null
    function step(now) {
      if (start === null) start = now
      const t = now - start
      // k = fotogramas de 60 Hz transcurridos: misma velocidad a 60 o 144 Hz
      const k = Math.max(0, Math.min(now - (prev ?? now), 50)) / 16.7
      prev = now

      // guion de relámpagos
      while (firedBolts < BOLTS.length && t >= BOLTS[firedBolts].at) {
        const b = BOLTS[firedBolts++]
        flash = Math.max(flash, b.power)
        if (b.bolt) {
          bolt = { pts: boltPath(rand(W * 0.15, W * 0.85), H * 0.68), life: 1 }
          shake = 14 * b.power
        }
        audio?.thunder(b.power, b.bolt ? 0.05 : 0.4)
      }

      const rise = easeInOut(clamp01((t - RISE[0]) / (RISE[1] - RISE[0])))
      const intro = clamp01(t / 500)
      const outro = clamp01((t - (TOTAL_MS - 450)) / 450)

      ctx.save()
      if (shake > 0.3) ctx.translate(rand(-shake, shake), rand(-shake, shake))

      // cielo
      const sky = ctx.createLinearGradient(0, 0, 0, H * 0.75)
      sky.addColorStop(0, '#030d0d')
      sky.addColorStop(0.55, '#071c1c')
      sky.addColorStop(1, '#0e3532')
      ctx.fillStyle = sky
      ctx.fillRect(-20, -20, W + 40, H + 40)
      if (flash > 0) {
        // el destello ilumina sobre todo la parte alta del cielo
        const fg = ctx.createLinearGradient(0, 0, 0, H * 0.8)
        fg.addColorStop(0, `rgba(190, 230, 245, ${flash * 0.3})`)
        fg.addColorStop(1, `rgba(190, 230, 245, ${flash * 0.06})`)
        ctx.fillStyle = fg
        ctx.fillRect(-20, -20, W + 40, H + 40)
      }

      // nubes: manchas oscuras que se desplazan
      for (let i = 0; i < 5; i++) {
        const cx = ((i * 0.27 + t * 0.00002 * (i + 1)) % 1.3) * W - W * 0.15
        const cy = H * (0.08 + (i % 3) * 0.1)
        const r = W * (0.25 + (i % 2) * 0.12)
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
        g.addColorStop(0, `rgba(${2 + flash * 120}, ${8 + flash * 140}, ${10 + flash * 150}, 0.55)`)
        g.addColorStop(1, 'rgba(3, 13, 13, 0)')
        ctx.fillStyle = g
        ctx.fillRect(cx - r, cy - r, r * 2, r * 2)
      }

      // rayo (detrás de la criatura)
      if (bolt) {
        ctx.save()
        ctx.strokeStyle = `rgba(232, 246, 255, ${bolt.life})`
        ctx.shadowColor = '#8ff2e2'
        ctx.shadowBlur = 24
        ctx.lineWidth = 2.5
        ctx.beginPath()
        bolt.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
        ctx.stroke()
        ctx.restore()
        bolt.life -= 0.06 * k
        if (bolt.life <= 0) bolt = null
      }

      // mar del fondo
      drawSea(t, 0, '#0b2a28', '#030d0d')

      // Cthulhu
      if (dark) {
        const restY = H * 1.01 - ih
        const y = restY + (1 - rise) * ih * 0.95 + Math.sin(t / 700) * 4 * rise
        const x = (W - iw) / 2 + Math.sin(t / 1300) * 6 * rise
        ctx.drawImage(dark, x, y, iw, ih)
        const light = Math.min(1, rise * 0.22 + flash * 0.9)
        if (light > 0.01) {
          ctx.globalAlpha = light
          ctx.drawImage(lit, x, y, iw, ih)
          ctx.globalAlpha = 1
        }

        // ojos que se encienden tras el segundo relámpago
        const eyes = clamp01((t - 3650) / 600) * (0.85 + Math.sin(t / 140) * 0.15)
        if (eyes > 0) {
          ctx.save()
          ctx.globalCompositeOperation = 'lighter'
          // posición de cada ojo medida en cthulhu.webp (1600×1218): (582, 361) y (716, 339)
          for (const [ex, ey] of [[0.3641, 0.2964], [0.4475, 0.2783]]) {
            const gx = x + iw * ex
            const gy = y + ih * ey
            const gr = iw * 0.022
            const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr)
            g.addColorStop(0, `rgba(255, 170, 255, ${0.9 * eyes})`)
            g.addColorStop(0.3, `rgba(214, 90, 255, ${0.5 * eyes})`)
            g.addColorStop(1, 'rgba(120, 40, 200, 0)')
            ctx.fillStyle = g
            ctx.fillRect(gx - gr, gy - gr, gr * 2, gr * 2)
          }
          ctx.restore()
        }

        // agua que salta mientras sube
        if (rise > 0 && rise < 1) {
          for (let i = 0; i < Math.round(6 * k); i++) {
            spray.push({
              x: x + iw * rand(0.15, 0.85),
              y: H * SEA[1],
              vx: rand(-2.5, 2.5),
              vy: rand(-9, -4),
              life: 1,
            })
          }
        }
      }

      // mar delantero en dos capas: tapa la base de la imagen
      drawSea(t, 1, '#0c302d', '#041311')
      drawSea(t, 2, '#082624', '#020a0a')

      ctx.fillStyle = 'rgba(190, 240, 235, 0.7)'
      for (let i = spray.length - 1; i >= 0; i--) {
        const s = spray[i]
        s.x += s.vx * k
        s.y += s.vy * k
        s.vy += 0.35 * k
        s.life -= 0.025 * k
        if (s.life <= 0 || s.y > H) {
          spray.splice(i, 1)
          continue
        }
        ctx.globalAlpha = s.life * 0.8
        ctx.fillRect(s.x, s.y, 2, 2)
      }
      ctx.globalAlpha = 1

      // lluvia en dos profundidades
      while (rain.length < 420) {
        const z = Math.random()
        rain.push({ x: rand(-W * 0.2, W * 1.1), y: rand(-H, H), z, v: 14 + z * 14 })
      }
      // tres capas de profundidad, un solo trazo por capa
      ctx.lineCap = 'round'
      for (let layer = 0; layer < 3; layer++) {
        ctx.strokeStyle = `rgba(190, 225, 235, ${0.18 + layer * 0.15 + flash * 0.3})`
        ctx.lineWidth = 0.7 + layer * 0.55
        ctx.beginPath()
        for (const d of rain) {
          if (Math.min(2, Math.floor(d.z * 3)) !== layer) continue
          d.x -= d.v * 0.28 * k
          d.y += d.v * k
          if (d.y > H * 0.78 + d.z * H * 0.22) {
            if (d.z > 0.6 && splashes.length < 80) splashes.push({ x: d.x, y: d.y, r: 0, life: 1 })
            d.y = rand(-120, -10)
            d.x = rand(-W * 0.1, W * 1.25)
          }
          ctx.moveTo(d.x, d.y)
          ctx.lineTo(d.x + d.v * 0.5, d.y - d.v * 1.6)
        }
        ctx.stroke()
      }
      ctx.strokeStyle = 'rgba(190, 240, 235, 0.35)'
      ctx.lineWidth = 1
      for (let i = splashes.length - 1; i >= 0; i--) {
        const s = splashes[i]
        s.r += 0.8 * k
        s.life -= 0.08 * k
        if (s.life <= 0) {
          splashes.splice(i, 1)
          continue
        }
        ctx.globalAlpha = s.life
        ctx.beginPath()
        ctx.ellipse(s.x, s.y, s.r * 2, s.r * 0.5, 0, Math.PI, Math.PI * 2)
        ctx.stroke()
      }
      ctx.globalAlpha = 1

      // destello general del relámpago
      if (flash > 0) {
        ctx.fillStyle = `rgba(230, 248, 255, ${flash * 0.1})`
        ctx.fillRect(-20, -20, W + 40, H + 40)
      }
      ctx.restore()

      // entrada y salida a negro
      const black = Math.max(1 - intro, outro)
      if (black > 0) {
        ctx.fillStyle = `rgba(3, 13, 13, ${black})`
        ctx.fillRect(0, 0, W, H)
      }

      flash = Math.max(0, flash - 0.045 * k)
      shake *= Math.pow(0.88, k)

      if (t >= TOTAL_MS) {
        setPhase('book')
        return
      }
      raf = requestAnimationFrame(step)
    }

    resize()
    window.addEventListener('resize', resize)
    raf = requestAnimationFrame(step)
    const wordsTimer = setTimeout(() => setShowWords(true), 3900)
    const leaveTimer = setTimeout(() => setLeaving(true), TOTAL_MS - 450)

    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(wordsTimer)
      clearTimeout(leaveTimer)
      window.removeEventListener('resize', resize)
      audio?.fadeOut()
      setTimeout(() => audio?.ctx.close(), 400)
    }
  }, [phase])

  useEffect(() => {
    if (phase !== 'scene') return
    function onKey(e) {
      if (e.key === 'Escape') setPhase('book')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase])

  if (phase === 'book') return <BookModal book={BOOK} onClose={onExit} {...synopsisProps} />

  return (
    <div className="rising" role="dialog" aria-modal="true" aria-label="Cthulhu emerge del océano">
      <canvas ref={canvasRef} className="rising__canvas" aria-hidden="true" />
      <p className={`rising__words${showWords && !leaving ? ' is-on' : ''}`}>
        Ph’nglui mglw’nafh Cthulhu R’lyeh wgah’nagl fhtagn
      </p>
      <button type="button" className="rising__skip" onClick={() => setPhase('book')} autoFocus>
        Saltar
      </button>
    </div>
  )
}
