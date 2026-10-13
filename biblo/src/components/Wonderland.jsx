import { useEffect, useRef, useState } from 'react'
import BookModal from './BookModal'
import books from '../data/books'
import { createAliceScene, T } from './aliceScene'
import { makeAliceMusic } from './aliceMusic'
import './CthulhuRising.css'

// Entrada de "Alicia en el país de las Maravillas" (~10 s): la orilla del
// río, la caída por la madriguera y el País de las Maravillas, con un vals
// de fondo. El dibujo vive en aliceScene.js y la música en aliceMusic.js;
// aquí, la línea de tiempo, el título y la interfaz. Al terminar (o al
// saltarla) se abre la ficha.
const BOOK = books.find((b) => b.special === 'wonderland')
const FADE = 0.45

export default function Wonderland({ onExit, synopsisProps }) {
  const canvasRef = useRef(null)
  const veilRef = useRef(null)
  // con movimiento reducido se va directo a la ficha
  const [phase, setPhase] = useState(() =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'book' : 'scene'
  )
  const [title, setTitle] = useState(false)

  useEffect(() => {
    if (phase !== 'scene') return
    let raf = null
    const scene = createAliceScene(canvasRef.current)
    // el vals suele estar ya sintetizado (se prepara al cargar la página); si
    // aún no, la escena no lo espera: entra a compás en cuanto esté listo
    const music = makeAliceMusic()
    let playing = false
    let begin = null

    function step(now) {
      if (begin === null) begin = now
      const t = (now - begin) / 1000
      if (!playing && music?.isReady() && t < T.end - 1.5) {
        playing = true
        music.start(t)
      }
      scene.frame(t)
      setTitle(t > T.titleIn && t < T.end - FADE)
      // entrada desde el color de la ficha y salida hacia él
      veilRef.current.style.opacity = Math.max(1 - t / 0.35, (t - (T.end - FADE)) / FADE, 0)
      if (t >= T.end) {
        setPhase('book')
        return
      }
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)

    function onResize() {
      scene.resize()
    }
    window.addEventListener('resize', onResize)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      music?.fadeOut()
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
    <div className="rising rising--wonder" role="dialog" aria-modal="true" aria-label="Alicia cae por la madriguera del conejo">
      <canvas ref={canvasRef} className="rising__canvas" aria-hidden="true" />
      <div ref={veilRef} className="rising__veil" aria-hidden="true" />
      <div className={`wonder__title${title ? ' is-on' : ''}`}>
        <span className="wonder__name">Alicia en el país de las Maravillas</span>
        <span className="wonder__author">Lewis Carroll</span>
      </div>
      <button type="button" className="rising__skip" onClick={() => setPhase('book')} autoFocus>
        Saltar
      </button>
    </div>
  )
}
