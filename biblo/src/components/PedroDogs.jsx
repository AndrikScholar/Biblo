import { useEffect, useRef, useState } from 'react'
import BookModal from './BookModal'
import books, { ATMOSPHERES } from '../data/books'
import { createPedroScene, T } from './pedroScene'
import './CthulhuRising.css'
import './PedroDogs.css'

// Entrada de "Pedro Páramo" (8,8 s, sin música): los dos perros de la
// portada corren por la hoja en blanco y el llano de Comala se graba a
// plumilla detrás de ellos. El dibujo vive en pedroScene.js; aquí, la línea de
// tiempo, el título y la interfaz. Al terminar (o al saltarla) se abre la ficha.
const BOOK = books.find((b) => b.special === 'pedroDogs')
const FADE = 0.5

export default function PedroDogs({ onExit, synopsisProps }) {
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
    const scene = createPedroScene(canvasRef.current)
    let begin = null

    function step(now) {
      if (begin === null) begin = now
      const t = (now - begin) / 1000
      scene.frame(t)
      setTitle(t > T.titleIn && t < T.end - FADE)
      // sale hacia el papel de la ficha
      veilRef.current.style.opacity = Math.max((t - (T.end - FADE)) / FADE, 0)
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
    <div className="rising pedro" role="dialog" aria-modal="true" aria-label="Dos perros corren por el llano hacia Comala">
      <canvas ref={canvasRef} className="rising__canvas" aria-hidden="true" />
      <div ref={veilRef} className="rising__veil" style={{ background: ATMOSPHERES[BOOK.atmosphere].bg }} aria-hidden="true" />
      <div className={`pedro__title${title ? ' is-on' : ''}`} aria-hidden={!title}>
        <span className="pedro__name pedro__name--top">Pedro</span>
        <span className="pedro__name pedro__name--bottom">Páramo</span>
        <span className="pedro__author">Juan Rulfo</span>
      </div>
      <button type="button" className="rising__skip" onClick={() => setPhase('book')} autoFocus>
        Saltar
      </button>
    </div>
  )
}
