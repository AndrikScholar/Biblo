import { useEffect, useRef, useState } from 'react'
import BookModal from './BookModal'
import books from '../data/books'
import { createBalloonScene, T } from './balloonScene'
import { makeBalloonAudio } from './balloonAudio'
import './CthulhuRising.css'

// Escena de IT (~13 s): en una alcantarilla inundada, un globo rojo sale del
// agua y se acerca mientras una cajita de música se queda sin cuerda. Se
// queda mirándote; apagón, y al reventar el globo aparece Pennywise.
// El dibujo vive en balloonScene.js y el sonido en balloonAudio.js; aquí
// están la línea de tiempo y la interfaz. Al terminar (o al saltarla) se abre
// la ficha del libro.
const BOOK = books.find((b) => b.special === 'redBalloon')

export default function RedBalloon({ onExit, synopsisProps }) {
  const canvasRef = useRef(null)
  const veilRef = useRef(null)
  // con movimiento reducido se va directo a la ficha
  const [phase, setPhase] = useState(() =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'book' : 'scene'
  )
  const [ask, setAsk] = useState(false)

  useEffect(() => {
    if (phase !== 'scene') return
    let alive = true
    let scene = null
    let raf = null
    const timers = []
    const audio = makeBalloonAudio()

    function start() {
      audio?.start()
      let begin = null
      let prev = null

      function step(now) {
        if (begin === null) begin = now
        const t = (now - begin) / 1000
        // k = fotogramas de 60 Hz transcurridos: misma velocidad a 60 o 144 Hz
        const k = Math.max(0, Math.min(now - (prev ?? now), 50)) / 16.7
        prev = now

        const { lamp } = scene.frame(t, k)
        audio?.setHum(lamp)
        // entrada desde negro y corte seco a negro tras el susto
        veilRef.current.style.opacity = t < 0.4 ? 1 - t / 0.4 : t >= T.cut ? 1 : 0

        if (t >= T.end) {
          setPhase('book')
          return
        }
        raf = requestAnimationFrame(step)
      }

      raf = requestAnimationFrame(step)
      timers.push(setTimeout(() => setAsk(true), T.ask * 1000))
      timers.push(setTimeout(() => setAsk(false), T.blackout * 1000))
    }

    // arranca cuando están listos los modelos y la cajita de música; si el
    // navegador no tiene WebGL o algo falla, se pasa a la ficha
    Promise.all([createBalloonScene(canvasRef.current, { onDrip: (pan, near) => audio?.drip(pan, near) }), audio?.ready])
      .then(([s]) => {
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
    <div className="rising rising--sewer" role="dialog" aria-modal="true" aria-label="Un globo rojo en la alcantarilla">
      <canvas ref={canvasRef} className="rising__canvas" aria-hidden="true" />
      <div ref={veilRef} className="rising__veil" aria-hidden="true" />
      <p className={`rising__words balloon__ask${ask ? ' is-on' : ''}`}>¿Quieres un globo?</p>
      <button type="button" className="rising__skip" onClick={() => setPhase('book')} autoFocus>
        Saltar
      </button>
    </div>
  )
}
