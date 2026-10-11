import { useEffect, useRef, useState } from 'react'
import BookModal from './BookModal'
import books from '../data/books'
import { createDesertScene, startDesertAudio, T } from './desertScene'
import './CthulhuRising.css'

// Entrada de "El Principito": del desierto del Sahara al asteroide B-612
// (~9 s). El dibujo vive en desertScene.js; aquí, la línea de tiempo, los
// textos y la interfaz. Al terminar (o al saltarla) se abre la ficha, con el
// asteroide en el mismo sitio en que acaba la escena.
const BOOK = books.find((b) => b.id === 'orbita-muerta')
const FADE_MS = 450

export default function DesertToAsteroid({ onExit, synopsisProps }) {
  const canvasRef = useRef(null)
  const veilRef = useRef(null)
  // con movimiento reducido se va directo a la ficha
  const [phase, setPhase] = useState(() =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'book' : 'scene'
  )
  const [caption, setCaption] = useState(false)
  const [title, setTitle] = useState(false)

  useEffect(() => {
    if (phase !== 'scene') return
    const scene = createDesertScene(canvasRef.current)
    const audio = startDesertAudio()
    const endMs = T.end * 1000
    let begin = null
    let raf = null

    function step(now) {
      if (begin === null) begin = now
      const ms = now - begin
      scene.frame(ms / 1000)
      setCaption(ms > T.captionIn * 1000 && ms < T.captionOut * 1000)
      setTitle(ms > T.titleIn * 1000 && ms < endMs - FADE_MS)
      // entrada desde negro y salida a negro
      veilRef.current.style.opacity = Math.max(1 - Math.min(1, ms / 400), Math.min(1, Math.max(0, (ms - (endMs - FADE_MS)) / FADE_MS)))
      if (ms >= endMs) {
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
      audio?.stop()
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
    <div className="rising rising--stars" role="dialog" aria-modal="true" aria-label="Del desierto al asteroide">
      <canvas ref={canvasRef} className="rising__canvas" aria-hidden="true" />
      <div ref={veilRef} className="rising__veil" aria-hidden="true" />
      <p className={`desert__caption${caption ? ' is-on' : ''}`}>
        Desierto del Sahara. A mil millas de cualquier lugar habitado.
      </p>
      <div className={`desert__title${title ? ' is-on' : ''}`}>
        <span className="desert__name">El Principito</span>
        <span className="desert__author">Antoine de Saint-Exupéry</span>
      </div>
      <button type="button" className="rising__skip" onClick={() => setPhase('book')} autoFocus>
        Saltar
      </button>
    </div>
  )
}
