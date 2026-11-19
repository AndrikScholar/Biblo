import { useEffect, useRef, useState } from 'react'
import BookModal from './BookModal'
import books, { ATMOSPHERES } from '../data/books'
import { createMacondoScene, T } from './macondoScene'
import { makeMacondoMusic } from './macondoMusic'
import './CthulhuRising.css'
import './MacondoDoor.css'

// Entrada de "Cien años de soledad" (9,6 s): la puerta de la portada se abre,
// salen mariposas amarillas y la cámara entra a Macondo bajo una lluvia de
// florecitas, con un paseo vallenato de fondo. El dibujo vive en
// macondoScene.js y la música en macondoMusic.js; aquí, la línea de tiempo, el
// título y la interfaz. Al terminar (o al saltarla) se abre la ficha.
const BOOK = books.find((b) => b.special === 'macondoDoor')
const FADE = 0.6

export default function MacondoDoor({ onExit, synopsisProps }) {
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
    const scene = createMacondoScene(canvasRef.current)
    // la música suele estar ya sintetizada (se prepara al cargar la página);
    // si aún no, la escena no la espera: entra a compás en cuanto esté lista
    const music = makeMacondoMusic()
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
      // entra desde negro y sale hacia la pared mojada de la ficha
      veilRef.current.style.opacity = Math.max(1 - t / 0.3, (t - (T.end - FADE)) / FADE, 0)
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
    <div className="rising macondo" role="dialog" aria-modal="true" aria-label="La puerta se abre y salen mariposas amarillas hacia Macondo">
      <canvas ref={canvasRef} className="rising__canvas" aria-hidden="true" />
      <div ref={veilRef} className="rising__veil" style={{ background: ATMOSPHERES[BOOK.atmosphere].bg }} aria-hidden="true" />
      <div className={`macondo__title${title ? ' is-on' : ''}`}>
        <span className="macondo__author">Gabriel García Márquez</span>
        <span className="macondo__rule" />
        <span className="macondo__name">Cien años de soledad</span>
      </div>
      <button type="button" className="rising__skip" onClick={() => setPhase('book')} autoFocus>
        Saltar
      </button>
    </div>
  )
}
