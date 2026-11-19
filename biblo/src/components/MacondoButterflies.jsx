import { useEffect, useRef } from 'react'
import { butterfly, flapAt, rng, cl } from './macondoPaint'

// Mariposas amarillas (las de Mauricio Babilonia) que llegan volando a la
// ficha de "Cien años de soledad", se posan en el canto de la portada o en un
// margen libre, abren y cierran las alas despacio y al rato se van. Antes de
// cada vuelo miran dónde está el texto: ni se posan encima ni lo cruzan.

const FLY_IN = 2.8
const FLY_OUT = 2.4

const bez = (p0, p1, p2, p3, u) => {
  const v = 1 - u
  return [
    v * v * v * p0[0] + 3 * v * v * u * p1[0] + 3 * v * u * u * p2[0] + u * u * u * p3[0],
    v * v * v * p0[1] + 3 * v * v * u * p1[1] + 3 * v * u * u * p2[1] + u * u * u * p3[1],
  ]
}
const easeInOut = (x) => x * x * (3 - 2 * x)

export default function MacondoButterflies() {
  const canvasRef = useRef(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const r = rng(1928)
    let W = 0
    let H = 0
    let s = 1
    let raf = null
    let t = 0
    let last = null
    // dos mariposas, con turnos desfasados
    const flies = [
      { state: 'wait', until: 1.2, ph: r() * 6 },
      { state: 'wait', until: 6.5, ph: r() * 6 },
    ]

    function resize() {
      W = window.innerWidth
      H = window.innerHeight
      canvas.width = W * dpr
      canvas.height = H * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      s = cl(Math.min(W, H) / 640, 0.85, 1.35)
    }

    // zonas que no se pueden tapar (el texto, con margen) y sitios donde posarse
    function layout() {
      const scene = canvas.closest('.scene')
      const rect = (q) => scene?.querySelector(q)?.getBoundingClientRect()
      const text = rect('.scene__text')
      const cover = rect('.scene__cover')
      const ctrl = rect('.scene__controls')
      const keep = [text, ctrl].filter(Boolean).map((b) => ({ l: b.left - 26, t: b.top - 26, r: b.right + 26, b: b.bottom + 26 }))
      const spots = []
      if (cover) for (let i = 0; i < 3; i++) spots.push([cover.left + cover.width * (0.25 + i * 0.25), cover.top - 6 * s, 'book'])
      spots.push([30 * s + 10, H * 0.2], [30 * s + 10, H * 0.78], [W - 40 * s, H * 0.86], [W * 0.5, H - 30 * s])
      const free = spots.filter(([x, y]) => keep.every((k) => x < k.l || x > k.r || y < k.t || y > k.b) && x > 0 && x < W && y > 0 && y < H)
      return { keep, free }
    }

    function crosses(path, keep) {
      for (let u = 0; u <= 1; u += 0.05) {
        const [x, y] = bez(...path, u)
        if (keep.some((k) => x > k.l && x < k.r && y > k.t && y < k.b)) return true
      }
      return false
    }

    // un camino curvo desde fuera de la pantalla (o hacia fuera) que no cruce el texto
    function route(spot, inbound, keep) {
      const entries = [
        [-60, spot[1] + (r() - 0.5) * H * 0.5],
        [spot[0] + (r() - 0.5) * W * 0.3, -60],
        [-60, -40],
        [spot[0] + (r() - 0.5) * 200, H + 60],
        [W + 60, spot[1] + (r() - 0.5) * H * 0.3],
      ]
      for (const e of entries.sort(() => r() - 0.5)) {
        const a = inbound ? e : spot
        const b = inbound ? spot : e
        const c1 = [a[0] + (b[0] - a[0]) * 0.3 + (r() - 0.5) * 180, a[1] + (b[1] - a[1]) * 0.3 - 80]
        const c2 = [a[0] + (b[0] - a[0]) * 0.7 + (r() - 0.5) * 180, b[1] - 60 - r() * 60]
        const path = [a, c1, c2, b]
        if (!crosses(path, keep)) return path
      }
      return null
    }

    function step(f) {
      if (f.state === 'wait' && t >= f.until) {
        const { keep, free } = layout()
        const taken = flies.filter((o) => o !== f && o.spot).map((o) => o.spot)
        const options = free.filter((p) => !taken.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 80))
        const spot = options[Math.floor(r() * options.length)]
        const path = spot && route(spot, true, keep)
        if (!path) {
          f.until = t + 3
          return
        }
        Object.assign(f, { state: 'in', from: t, path, spot })
      } else if (f.state === 'in' && t - f.from > FLY_IN) {
        Object.assign(f, { state: 'rest', from: t, until: t + 5 + r() * 5 })
      } else if (f.state === 'rest' && t >= f.until) {
        const path = route(f.spot, false, layout().keep)
        if (path) Object.assign(f, { state: 'out', from: t, path })
        else f.until = t + 2
      } else if (f.state === 'out' && t - f.from > FLY_OUT) {
        Object.assign(f, { state: 'wait', until: t + 4 + r() * 6, spot: null })
      }
    }

    function draw(f) {
      if (f.state === 'wait') return
      if (f.state === 'rest') {
        // posada: con las alas medio abiertas, que abre y cierra despacio
        const breathe = 0.5 + 0.5 * Math.sin((t - f.from) * 1.6 + f.ph)
        butterfly(ctx, f.spot[0], f.spot[1] - 12 * s, s, 0, 0.45 + breathe * 0.55)
        return
      }
      const dur = f.state === 'in' ? FLY_IN : FLY_OUT
      const u = easeInOut(cl((t - f.from) / dur))
      const [x, y] = bez(...f.path, u)
      const [x2, y2] = bez(...f.path, Math.min(1, u + 0.02))
      const a = Math.atan2(y2 - y, x2 - x) + Math.PI / 2
      // al llegar frena y cierra las alas; al irse, aletea fuerte desde el principio
      const flap = f.state === 'in' && u > 0.85 ? 0.6 + (1 - u) * 2.6 : flapAt(t, 13, f.ph)
      const bob = Math.sin(t * 9 + f.ph) * 6 * (1 - u * 0.8)
      butterfly(ctx, x, y + bob, s, a, flap)
    }

    function frame(now) {
      const dt = last === null ? 0 : Math.min(0.05, (now - last) / 1000)
      last = now
      t += dt
      ctx.clearRect(0, 0, W, H)
      for (const f of flies) {
        step(f)
        draw(f)
      }
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

  return <canvas ref={canvasRef} className="scene__butterflies" aria-hidden="true" />
}
