import { useEffect, useRef } from 'react'

// Tentáculos que asoman por los bordes de la escena y se retuercen despacio.
// Cada uno es una cadena de segmentos cuyo ángulo ondula con el tiempo; se
// dibuja como un cuerpo que se afila, con un brillo húmedo y púas claras
// (estilo de la referencia: verde oliva oscuro con espinas).
//
// [x, y] = base (fracción de pantalla, fuera del borde), dir = hacia dónde
// apunta (radianes), len = largo (fracción de la diagonal), w = grosor base
const TENTACLES = [
  { x: -0.03, y: 0.92, dir: -0.55, len: 0.36, w: 46, curl: 1.2 },
  { x: 0.1, y: 1.04, dir: -1.35, len: 0.24, w: 34, curl: -1 },
  { x: -0.03, y: 0.18, dir: 0.35, len: 0.22, w: 30, curl: -1.1 },
  { x: 1.03, y: 0.86, dir: Math.PI + 0.5, len: 0.27, w: 44, curl: -1.2 },
  { x: 0.9, y: 1.04, dir: -1.85, len: 0.2, w: 30, curl: 1 },
  { x: 1.03, y: 0.12, dir: Math.PI - 0.4, len: 0.2, w: 28, curl: 1.1 },
]
const SEGMENTS = 34
const GROW_MS = 1600

export default function Tentacles() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const phases = TENTACLES.map(() => Math.random() * Math.PI * 2)
    let W = 0
    let H = 0
    let raf = null
    let start = null

    function resize() {
      W = window.innerWidth
      H = window.innerHeight
      canvas.width = W * dpr
      canvas.height = H * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    function drawTentacle(tc, phase, time, grow) {
      const diag = Math.hypot(W, H)
      // en pantallas pequeñas, más cortos y finos para no tapar el texto
      const scale = Math.min(1, W / 1100)
      const len = tc.len * diag * grow * (0.45 + scale * 0.55)
      const seg = len / SEGMENTS
      const pts = []
      let x = tc.x * W
      let y = tc.y * H
      let a = tc.dir
      for (let i = 0; i <= SEGMENTS; i++) {
        const t = i / SEGMENTS
        pts.push([x, y, a])
        // la punta se mueve más que la base: amplitud creciente con t
        a +=
          (tc.curl * 0.055 * t +
            Math.sin(time * 0.7 + phase + t * 4.2) * 0.07 * t +
            Math.sin(time * 1.3 + phase * 1.7 + t * 7) * 0.025) *
          (0.4 + t)
        x += Math.cos(a) * seg
        y += Math.sin(a) * seg
      }

      const width = (t) => (tc.w * (0.6 + scale * 0.4)) * Math.pow(1 - t, 0.85) + 1
      const left = []
      const right = []
      pts.forEach(([px, py, pa], i) => {
        const w = width(i / SEGMENTS) / 2
        left.push([px + Math.cos(pa - Math.PI / 2) * w, py + Math.sin(pa - Math.PI / 2) * w])
        right.push([px + Math.cos(pa + Math.PI / 2) * w, py + Math.sin(pa + Math.PI / 2) * w])
      })

      // púas en el lado exterior de la curva
      ctx.fillStyle = 'rgba(205, 198, 160, 0.85)'
      for (let i = 3; i < SEGMENTS - 2; i += 2) {
        const [bx, by] = right[i]
        const [, , pa] = pts[i]
        const w = width(i / SEGMENTS)
        const spike = w * (0.45 + ((i * 7) % 5) * 0.06)
        const out = pa + Math.PI / 2 - 0.5
        ctx.beginPath()
        ctx.moveTo(bx + Math.cos(pa) * w * 0.18, by + Math.sin(pa) * w * 0.18)
        ctx.lineTo(bx + Math.cos(out) * spike, by + Math.sin(out) * spike)
        ctx.lineTo(bx - Math.cos(pa) * w * 0.18, by - Math.sin(pa) * w * 0.18)
        ctx.fill()
      }

      // cuerpo
      ctx.save()
      ctx.shadowColor = 'rgba(0, 0, 0, 0.65)'
      ctx.shadowBlur = 22
      ctx.shadowOffsetY = 8
      const [sx, sy] = pts[0]
      const [ex, ey] = pts[pts.length - 1]
      const body = ctx.createLinearGradient(sx, sy, ex, ey)
      body.addColorStop(0, '#1d2016')
      body.addColorStop(0.6, '#2e3322')
      body.addColorStop(1, '#4a4d33')
      ctx.fillStyle = body
      ctx.beginPath()
      left.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)))
      for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1])
      ctx.closePath()
      ctx.fill()
      ctx.restore()

      // brillo húmedo a lo largo de un costado
      ctx.strokeStyle = 'rgba(214, 220, 170, 0.28)'
      ctx.lineWidth = Math.max(1, tc.w * 0.06)
      ctx.lineCap = 'round'
      ctx.beginPath()
      pts.forEach(([px, py, pa], i) => {
        const w = width(i / SEGMENTS) * 0.28
        const hx = px + Math.cos(pa - Math.PI / 2) * w
        const hy = py + Math.sin(pa - Math.PI / 2) * w
        if (i) ctx.lineTo(hx, hy)
        else ctx.moveTo(hx, hy)
      })
      ctx.stroke()

      // anillos (pliegues) cada pocos segmentos
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)'
      ctx.lineWidth = 1.2
      for (let i = 2; i < SEGMENTS - 3; i += 3) {
        ctx.beginPath()
        ctx.moveTo(left[i][0], left[i][1])
        ctx.lineTo(right[i][0], right[i][1])
        ctx.stroke()
      }
    }

    function step(now) {
      if (start === null) start = now
      const t = now - start
      const grow = reduceMotion ? 1 : 1 - Math.pow(1 - Math.min(1, t / GROW_MS), 3)
      ctx.clearRect(0, 0, W, H)
      TENTACLES.forEach((tc, i) => {
        // en móvil el texto ocupa todo el ancho: solo los de arriba, junto a la portada
        if (W < 700 && tc.y > 0.5) return
        drawTentacle(tc, phases[i], t / 1000, grow)
      })
      if (!reduceMotion) raf = requestAnimationFrame(step)
    }

    resize()
    window.addEventListener('resize', resize)
    raf = requestAnimationFrame(step)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return <canvas ref={canvasRef} className="scene__tentacles" aria-hidden="true" />
}
