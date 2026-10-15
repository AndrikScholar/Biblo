import { useEffect, useRef, useState } from 'react'
import BookModal from './BookModal'
import BookCover from './BookCover'
import books, { ATMOSPHERES } from '../data/books'
import './CthulhuRising.css'
import './HogwartsLetter.css'

// Entrada de "Harry Potter y la piedra filosofal" (8 s): cae del cielo la
// carta de Hogwarts, se da la vuelta, se rompe el sello y del sobre salen el
// libro y la carta, que vuelan a su sitio en la ficha; allí la carta se
// deshace y deja la sinopsis. La ficha está montada debajo desde el principio
// (con el castillo de fondo), así el libro y la carta saben adónde volar.
const BOOK = books.find((b) => b.special === 'hogwartsLetter')

// línea de tiempo, en segundos
const T = {
  fall: [0.2, 2.3],
  flip: [2.9, 3.6],
  seal: [3.7, 4.2],
  flap: [4.15, 4.75],
  bookOut: [4.6, 5.2],
  bookFly: [5.2, 6.1],
  letterOut: [5.0, 5.6],
  letterFly: [5.6, 6.6],
  away: [5.8, 6.4],
  text: 6.6,
  end: 8,
}

const seg = (t, [a, b]) => Math.min(1, Math.max(0, (t - a) / (b - a)))
const out = (p) => 1 - (1 - p) ** 3
const ease = (p) => (p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2)

export default function HogwartsLetter({ onExit, synopsisProps }) {
  // con movimiento reducido se va directo a la ficha
  const [phase, setPhase] = useState(() =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'book' : 'intro'
  )
  const rootRef = useRef(null)
  const skipRef = useRef(null)

  useEffect(() => {
    if (phase !== 'intro') return
    const root = rootRef.current
    const $ = (s) => root.querySelector(s)
    const env = $('.hp-env')
    const body = $('.hp-env__body')
    const flap = $('.hp-env__flap')
    const halves = root.querySelectorAll('.hp-seal__half')
    const book = $('.hp-book')
    const cover = $('.hp-book .scene__cover')
    const letter = $('.hp-letter')
    const dim = $('.hp-intro__dim')
    const scene = root.nextElementSibling // la ficha, debajo
    let raf = null
    let begin = null
    skipRef.current.focus({ preventScroll: true })

    // sale del sobre (escondido tras el bolsillo) y vuela a `to`, en
    // coordenadas del sobre; `k0` es su escala dentro del sobre
    function fly(el, w, h, k0, rise, go, to, E) {
      const inY = E.h * 0.1
      let x = E.w / 2 - (w * k0) / 2
      let y = inY + (-h * k0 - E.h * 0.08 - inY) * rise
      x += (to.x - x) * go
      y += (to.y - y) * go - Math.sin(Math.PI * go) * E.h * 0.3
      el.style.transform = `translate(${x}px, ${y}px) scale(${k0 + (1 - k0) * go})`
      // ya fuera del sobre, vuela por delante de él
      el.style.zIndex = rise > 0.98 ? 6 : 2
    }

    function step(now) {
      begin ??= now
      const t = (now - begin) / 1000
      const vw = root.clientWidth
      const vh = root.clientHeight

      // cae dando vueltas como una hoja, se queda boca arriba y se da la vuelta
      const f = out(seg(t, T.fall))
      const fl = ease(seg(t, T.flip))
      const k = 1 - f
      const bob = Math.sin(t * 2.2) * 4 * f * (1 - fl)
      env.style.transform =
        `translate3d(${Math.sin(f * 7) * vw * 0.1 * k}px, ${-vh * 0.8 * k + bob}px, 0) ` +
        `rotateZ(${Math.sin(f * 9) * 28 * k}deg) rotateX(${Math.sin(f * 11 + 1) * 50 * k}deg) ` +
        `rotateY(${540 * k + 180 * fl}deg) scale(${(0.5 + 0.5 * f) * (1 + 0.06 * Math.sin(Math.PI * fl))})`

      // el sello se hincha, se parte en dos y las mitades caen
      const sp = seg(t, T.seal)
      const q = Math.min(1, Math.max(0, (sp - 0.3) / 0.7))
      halves.forEach((h, i) => {
        const s = i ? 1 : -1
        h.style.transform = `translate(${s * q * 40}%, ${q * q * 140}%) rotate(${s * q * 30}deg) scale(${1 + 0.1 * Math.sin(Math.PI * Math.min(1, sp / 0.3))})`
        h.style.opacity = 1 - q
      })

      // la solapa se levanta y se dobla hacia atrás
      const th = 180 * ease(seg(t, T.flap))
      flap.style.transform = `perspective(800px) rotateX(${th}deg)`
      flap.style.zIndex = th > 90 ? 1 : 4
      const away = 1 - seg(t, T.away)
      body.style.opacity = away
      flap.style.opacity = away

      // el libro y la carta salen y vuelan a su sitio en la ficha
      const E = { w: env.offsetWidth, h: env.offsetHeight }
      const er = env.getBoundingClientRect()
      const bt = scene.querySelector('.scene__book').getBoundingClientRect()
      const tt = scene.querySelector('.scene__text').getBoundingClientRect()
      const bw = cover.offsetWidth
      const bh = cover.offsetHeight
      const go = ease(seg(t, T.bookFly))
      fly(book, bw, bh, (E.h * 0.84) / bh, out(seg(t, T.bookOut)), go, { x: bt.left - er.left, y: bt.top - er.top }, E)
      cover.style.transform = go < 1 ? `rotateY(${-16 * go}deg) rotateX(${4 * go}deg)` : ''
      letter.style.width = `${tt.width}px`
      letter.style.height = `${tt.height}px`
      const l0 = Math.min((E.w * 0.86) / tt.width, (E.h * 0.84) / tt.height)
      fly(letter, tt.width, tt.height, l0, out(seg(t, T.letterOut)), ease(seg(t, T.letterFly)), { x: tt.left - er.left, y: tt.top - er.top }, E)

      // el libro aterriza justo encima del de la ficha y se cambian; la carta
      // se deshace mientras aparece la sinopsis
      root.classList.toggle('is-landed', go >= 1)
      root.classList.toggle('is-text', t > T.text)
      dim.style.opacity = Math.min(seg(t, [0, 0.6]), 1 - seg(t, [T.text - 0.4, T.end]))

      if (t >= T.end) {
        setPhase('book')
        return
      }
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)

    // Esc salta la entrada (sin que la ficha, debajo, lo tome como cerrar)
    function onKey(e) {
      if (e.key !== 'Escape') return
      e.stopImmediatePropagation()
      setPhase('book')
    }
    window.addEventListener('keydown', onKey, true)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('keydown', onKey, true)
      document.querySelector('.scene__controls .scene__btn:last-child')?.focus({ preventScroll: true })
    }
  }, [phase])

  return (
    <>
      {phase === 'intro' && (
        <div ref={rootRef} className="hp-intro" style={{ '--glow': ATMOSPHERES[BOOK.atmosphere].glow }}>
          <div className="hp-intro__dim" />
          <div className="hp-env" aria-hidden="true">
            <div className="hp-env__face hp-env__front">
              <p className="hp-env__to">
                Sr. H. Potter
                <br />
                Alacena debajo de la escalera
                <br />
                Privet Drive, 4
                <br />
                Little Whinging
                <br />
                Surrey
              </p>
            </div>
            <div className="hp-env__face hp-env__back">
              <div className="hp-env__body" />
              <div className="hp-env__flap">
                <div className="hp-env__flap-out" />
                <div className="hp-env__flap-in" />
              </div>
              <div className="hp-seal">
                <span className="hp-seal__half">H</span>
                <span className="hp-seal__half">H</span>
              </div>
              <div className="hp-book">
                <BookCover book={BOOK} className="scene__cover" />
              </div>
              <div className="hp-letter">
                <p className="hp-letter__head">
                  Colegio Hogwarts
                  <br />
                  de Magia y Hechicería
                </p>
                <p className="hp-letter__body">{BOOK.description}</p>
              </div>
            </div>
          </div>
          <button type="button" ref={skipRef} className="rising__skip" onClick={() => setPhase('book')}>
            Saltar
          </button>
        </div>
      )}
      <BookModal book={BOOK} onClose={onExit} {...synopsisProps} />
    </>
  )
}
