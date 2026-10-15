import { useEffect, useRef, useState } from 'react'
import BookModal from './BookModal'
import books, { ATMOSPHERES } from '../data/books'
import { createCidScene, T } from './cidScene'
import { makeCidMusic } from './cidMusic'
import './CthulhuRising.css'

// Entrada de "El Cantar del mío Cid" (8 s): el Cid, cansado, descansa de
// rodillas en un campo de flores con la espada clavada, y suspira. El dibujo
// vive en cidScene.js y la música en cidMusic.js; aquí, la línea de tiempo,
// el título y la interfaz. Al terminar (o al saltarla) se abre la ficha.
const BOOK = books.find((b) => b.special === 'cidRest')
const FADE = 0.45

export default function CidRest({ onExit, synopsisProps }) {
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
    const scene = createCidScene(canvasRef.current)
    // la música suele estar ya sintetizada (se prepara al cargar la página);
    // si aún no, la escena no la espera: entra a compás en cuanto esté lista
    const music = makeCidMusic()
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
    <div className="rising" role="dialog" aria-modal="true" aria-label="El Cid descansa en un campo de flores">
      <canvas ref={canvasRef} className="rising__canvas" aria-hidden="true" />
      <div ref={veilRef} className="rising__veil" style={{ background: ATMOSPHERES[BOOK.atmosphere].bg }} aria-hidden="true" />
      <div className={`quijote__title cid__title${title ? ' is-on' : ''}`}>
        <span className="quijote__name cid__name">El Cantar del mío Cid</span>
        <span className="quijote__author cid__author">Anónimo</span>
      </div>
      <button type="button" className="rising__skip" onClick={() => setPhase('book')} autoFocus>
        Saltar
      </button>
    </div>
  )
}
