import { useEffect, useRef } from 'react'
import { INK, TAU, rng, dogShape, drawDog, dogTexture } from './comalaInk'

// Un perro de la portada de "Pedro Páramo" que de vez en cuando entra al
// galope por el borde de abajo (o el de arriba), levantando polvo y dejando
// una raya de suelo que se borra detrás. Antes de cada carrera mira dónde
// están la portada y el texto: si la franja está libre de lado a lado la
// cruza entera; si no, corre solo hasta donde empieza el texto y allí se
// deshace en polvo, como las ánimas de Comala. Nunca pasa por encima de lo
// que se lee.

const CYCLE = 0.42
const STRIDE = 300

export default function ComalaDog() {
  const canvasRef = useRef(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const r = rng(1917)
    let W = 0
    let H = 0
    let s = 0.3
    let tex = null
    let raf = null
    let last = null
    let run = null // { dir, y, x, dist, line: [x0, x1] }
    let wait = 1.6
    let dust = []

    function resize() {
      W = window.innerWidth
      H = window.innerHeight
      canvas.width = W * dpr
      canvas.height = H * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      s = Math.max(0.2, Math.min(0.34, Math.min(W, H) / 2600))
      tex = dogTexture(s * dpr * 1.2, 1917)
    }

    // una franja de suelo junto al borde y hasta dónde está libre de texto
    // (entrando por la izquierda); end = null si está libre de lado a lado
    function freeLane() {
      const scene = canvas.closest('.scene')
      const blocks = ['.scene__text', '.scene__book', '.scene__controls']
        .map((q) => scene?.querySelector(q)?.getBoundingClientRect())
        .filter(Boolean)
      const tall = 125 * s + 20
      let best = null
      for (const y of [H - 16, tall + 70]) {
        const top = y - tall
        if (y > H || top < 0) continue
        const hit = blocks.filter((b) => b.bottom > top && b.top < y + 6)
        if (!hit.length) return { y, end: null }
        const end = Math.min(...hit.map((b) => b.left)) - 24
        if (end > 300 * s + 120 && (!best || end > best.end)) best = { y, end }
      }
      return best
    }

    function start() {
      const lane = freeLane()
      if (!lane) {
        wait = 4
        return
      }
      const dir = lane.end == null && r() < 0.5 ? -1 : 1
      const len = 470 * s
      run = { dir, y: lane.y, end: lane.end, x: dir > 0 ? -len : W + len, dist: 0, fade: 1 }
    }

    function frame(now) {
      const dt = last === null ? 0 : Math.min(0.05, (now - last) / 1000)
      last = now
      ctx.clearRect(0, 0, W, H)

      if (!run) {
        wait -= dt
        if (wait <= 0) start()
      } else {
        // antes de llegar al texto se deshace: frena y se vuelve polvo, y ya no
        // queda nada cuando el hocico alcanzaría la primera letra
        const full = (STRIDE * s) / CYCLE
        const nose = run.x + 185 * s
        if (run.end != null && nose > run.end - full * 0.45) run.fade -= dt / 0.7
        const v = full * (0.3 + 0.7 * Math.max(0, run.fade))
        run.dist += v * dt
        run.x += run.dir * v * dt
        const shape = dogShape((run.dist / (STRIDE * s)) % 1)
        // la raya de suelo que deja detrás, y que se va borrando
        const tail = run.x - run.dir * 260 * s
        ctx.save()
        ctx.strokeStyle = INK
        ctx.lineWidth = 1
        ctx.globalAlpha = Math.max(0, run.fade)
        const fadeLen = 520 * s
        for (let i = 0; i < 12; i++) {
          const a0 = tail - run.dir * (fadeLen * i) / 12
          const a1 = tail - run.dir * (fadeLen * (i + 1)) / 12
          ctx.globalAlpha = 0.5 * (1 - i / 12) * Math.max(0, run.fade)
          ctx.beginPath()
          ctx.moveTo(a0, run.y + 1)
          ctx.lineTo(a1, run.y + 1)
          ctx.stroke()
        }
        ctx.restore()
        // polvo al apoyar
        for (const [px, py] of shape.paws) {
          if (py < 84 || r() > 0.5) continue
          dust.push({ x: run.x + run.dir * px * s, y: run.y - 1, vx: -run.dir * (20 + r() * 50), vy: -(6 + r() * 16), age: 0, life: 0.6 + r() * 0.5 })
        }
        if (run.fade < 1) {
          for (let i = 0; i < 10; i++) {
            const bx = run.x + (r() * 300 - 150) * s
            const by = run.y - (20 + r() * 110) * s
            dust.push({ x: bx, y: by, vx: -10 + r() * 40, vy: -(10 + r() * 30), age: 0, life: 0.7 + r() * 0.8 })
          }
        }
        drawDog(ctx, shape, run.x, run.y, s, tex, { flip: run.dir, unit: 1, alpha: Math.max(0, run.fade) })
        const len = 470 * s
        if (run.fade <= 0 || (run.dir > 0 && run.x > W + len) || (run.dir < 0 && run.x < -len)) {
          run = null
          wait = 7 + r() * 7
        }
      }

      ctx.fillStyle = INK
      dust = dust.filter((p) => {
        p.age += dt
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.vy += 20 * dt
        const a = 1 - p.age / p.life
        if (a <= 0) return false
        ctx.globalAlpha = a * 0.5
        ctx.beginPath()
        ctx.arc(p.x, p.y, 0.9, 0, TAU)
        ctx.fill()
        return true
      })
      ctx.globalAlpha = 1
      raf = requestAnimationFrame(frame)
    }

    resize()
    raf = requestAnimationFrame(frame)
    window.addEventListener('resize', resize)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return <canvas ref={canvasRef} className="scene__dog" aria-hidden="true" />
}
