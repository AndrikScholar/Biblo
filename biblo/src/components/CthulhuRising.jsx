import { useEffect, useRef, useState } from 'react'
import BookModal from './BookModal'
import books from '../data/books'
import { isMuted } from '../sound'
import { createCthulhuScene } from './cthulhuScene'
import './CthulhuRising.css'

// Escena de "La Llamada de Cthulhu": Cthulhu (modelo 3D) emerge del océano
// entre lluvia y relámpagos (~5.6 s). El dibujo vive en cthulhuScene.js; aquí
// están la línea de tiempo, el sonido (trueno y lluvia sintetizados con Web
// Audio) y la interfaz. Al terminar (o al saltarla) se abre la ficha del libro.
const BOOK = books.find((b) => b.id === 'abisal')
const TOTAL_MS = 5600
const RISE = [700, 3900]
const BOLTS = [
  { at: 600, power: 0.35, bolt: false },
  { at: 2500, power: 1, bolt: true },
  { at: 3650, power: 0.7, bolt: true },
  { at: 3820, power: 0.5, bolt: false },
]

const rand = (a, b) => a + Math.random() * (b - a)
const clamp01 = (v) => Math.min(1, Math.max(0, v))
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

function makeAudio() {
  const Ctx = window.AudioContext || window.webkitAudioContext
  if (!Ctx || isMuted()) return null
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

export default function CthulhuRising({ onExit, synopsisProps }) {
  const canvasRef = useRef(null)
  const veilRef = useRef(null)
  // con movimiento reducido se va directo a la ficha
  const [phase, setPhase] = useState(() =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'book' : 'scene'
  )
  const [showWords, setShowWords] = useState(false)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    if (phase !== 'scene') return
    let alive = true
    let scene = null
    let raf = null
    let audio = null
    const timers = []

    function start() {
      audio = makeAudio()
      let begin = null
      let prev = null
      let flash = 0
      let shake = 0
      let fired = 0

      function step(now) {
        if (begin === null) begin = now
        const t = now - begin
        // k = fotogramas de 60 Hz transcurridos: misma velocidad a 60 o 144 Hz
        const k = Math.max(0, Math.min(now - (prev ?? now), 50)) / 16.7
        prev = now

        let strike = false
        while (fired < BOLTS.length && t >= BOLTS[fired].at) {
          const b = BOLTS[fired++]
          flash = Math.max(flash, b.power)
          if (b.bolt) {
            strike = true
            shake = 0.12 * b.power
          }
          audio?.thunder(b.power, b.bolt ? 0.05 : 0.4)
        }

        scene.frame({
          t,
          k,
          rise: easeInOut(clamp01((t - RISE[0]) / (RISE[1] - RISE[0]))),
          flash,
          strike,
          eyes: clamp01((t - 3650) / 600) * (0.85 + Math.sin(t / 140) * 0.15),
          shake,
        })

        // entrada desde negro y salida a negro
        const black = Math.max(1 - clamp01(t / 500), clamp01((t - (TOTAL_MS - 450)) / 450))
        veilRef.current.style.opacity = black

        flash = Math.max(0, flash - 0.045 * k)
        shake *= Math.pow(0.88, k)

        if (t >= TOTAL_MS) {
          setPhase('book')
          return
        }
        raf = requestAnimationFrame(step)
      }

      raf = requestAnimationFrame(step)
      timers.push(setTimeout(() => setShowWords(true), 3900))
      timers.push(setTimeout(() => setLeaving(true), TOTAL_MS - 450))
    }

    // la línea de tiempo arranca cuando el modelo está listo; si el
    // navegador no tiene WebGL o el modelo falla, se pasa a la ficha
    createCthulhuScene(canvasRef.current)
      .then((s) => {
        scene = s
        if (!alive) return s.dispose()
        start()
      })
      .catch(() => alive && setPhase('book'))

    function onResize() {
      scene?.resize()
    }
    window.addEventListener('resize', onResize)

    return () => {
      alive = false
      cancelAnimationFrame(raf)
      timers.forEach(clearTimeout)
      window.removeEventListener('resize', onResize)
      scene?.dispose()
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
      <div ref={veilRef} className="rising__veil" aria-hidden="true" />
      <p className={`rising__words${showWords && !leaving ? ' is-on' : ''}`}>
        Ph’nglui mglw’nafh Cthulhu R’lyeh wgah’nagl fhtagn
      </p>
      <button type="button" className="rising__skip" onClick={() => setPhase('book')} autoFocus>
        Saltar
      </button>
    </div>
  )
}
