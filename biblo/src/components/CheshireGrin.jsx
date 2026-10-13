import { useEffect, useRef, useState } from 'react'
import { paintCheshire } from './cheshireFace'

// El Gato de Cheshire en la ficha de Alicia: su cara pintada (pelo gris con
// rayas turquesa, ojos verdes y la sonrisa enorme) aparece en un hueco libre
// como en el libro: primero la sonrisa, luego los ojos y luego el resto. Al
// irse lo hace al revés y la sonrisa es lo último que desaparece. Después
// vuelve en otro sitio. Puede asomar por detrás de la portada, pero nunca tapa
// el texto ni los botones. Se activa con `edges: 'cheshire'`.

const SHOW_MS = 5200
const OUT_MS = 3400

// un hueco donde quepa la cara sin tocar el texto ni los botones (por detrás
// de la portada puede asomar, si se le ve casi toda), lejos del anterior
function pickSpot(root, w, last) {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const rect = (sel) => root?.querySelector(sel)?.getBoundingClientRect()
  const text = rect('.scene__text')
  const controls = rect('.scene__controls')
  const book = rect('.scene__book')
  const free = []
  for (let gx = 0; gx <= 12; gx++) {
    for (let gy = 0; gy <= 10; gy++) {
      const x = 8 + ((vw - w - 16) * gx) / 12
      const y = 8 + ((vh - w - 16) * gy) / 10
      const hits = (r, m) => r && x < r.right + m && x + w > r.left - m && y < r.bottom + m && y + w > r.top - m
      if (hits(text, 24) || hits(controls, 16)) continue
      if (book) {
        const ox = Math.max(0, Math.min(x + w, book.right) - Math.max(x, book.left))
        const oy = Math.max(0, Math.min(y + w, book.bottom) - Math.max(y, book.top))
        if (ox * oy > w * w * 0.22) continue
      }
      if (last && Math.hypot(x - last.x, y - last.y) < vw * 0.22) continue
      free.push({ x, y, w })
    }
  }
  return free.length ? free[Math.floor(Math.random() * free.length)] : null
}

export default function CheshireGrin() {
  const ref = useRef(null)
  const faceRef = useRef(null)
  const eyesRef = useRef(null)
  const mouthRef = useRef(null)
  const [spot, setSpot] = useState(null)
  const [state, setState] = useState('hidden')

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const root = ref.current?.closest('.scene')
    let painted = false
    let last = null
    let timer = null
    const later = (fn, ms) => {
      timer = setTimeout(fn, ms)
    }

    function appear() {
      // se pinta la primera vez que hace falta, cuando la ficha ya ha entrado
      if (!painted) {
        paintCheshire(faceRef.current, eyesRef.current, mouthRef.current)
        painted = true
      }
      const w = Math.round(Math.min(250, Math.max(150, window.innerWidth * 0.16)))
      const s = pickSpot(root, w, last)
      if (!s) return later(appear, 2500) // sin hueco libre: espera
      last = s
      setSpot(s) // se coloca invisible y aparece en el siguiente fotograma
      later(() => {
        setState('in')
        if (reduce) return
        later(() => {
          setState('out')
          later(() => {
            setState('hidden')
            later(appear, 2600 + Math.random() * 2200)
          }, OUT_MS)
        }, SHOW_MS)
      }, 40)
    }

    later(appear, reduce ? 0 : 1800)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div
      ref={ref}
      className={`grin is-${state}`}
      style={spot ? { left: spot.x, top: spot.y, width: spot.w } : undefined}
      aria-hidden="true"
    >
      <canvas ref={faceRef} className="grin__face" width="512" height="512" />
      <canvas ref={eyesRef} className="grin__eyes" width="512" height="512" />
      <canvas ref={mouthRef} className="grin__mouth" width="512" height="512" />
    </div>
  )
}
