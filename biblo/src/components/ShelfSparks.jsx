import { useEffect, useRef } from 'react'

// Chispas que se escapan del lomo activo: un adelanto de su atmósfera.
// `sourceRef` apunta al lomo; el lienzo cubre todo el mueble.
export default function ShelfSparks({ sourceRef, color, glow }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !color) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const ctx = canvas.getContext('2d')
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let width = 0
    let height = 0
    let rafId = null
    let last = performance.now()
    let carry = 0
    const sparks = []

    function resize() {
      const rect = canvas.parentElement.getBoundingClientRect()
      width = rect.width
      height = rect.height
      canvas.width = width * dpr
      canvas.height = height * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    function step(t) {
      const dt = Math.max(0, Math.min(t - last, 50))
      const k = dt / 16
      last = t
      ctx.clearRect(0, 0, width, height)

      const el = sourceRef.current
      if (el) {
        const box = canvas.getBoundingClientRect()
        const r = el.getBoundingClientRect()
        carry += dt * 0.045
        while (carry > 1) {
          carry -= 1
          sparks.push({
            x: r.left - box.left + Math.random() * r.width,
            y: r.top - box.top + 6 + Math.random() * 20,
            vx: (Math.random() - 0.5) * 0.5,
            vy: -(0.4 + Math.random() * 0.9),
            size: 0.8 + Math.random() * 1.8,
            life: 1,
            decay: 0.008 + Math.random() * 0.01,
          })
        }
      }

      ctx.globalCompositeOperation = 'lighter'
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i]
        s.x += (s.vx + Math.sin(t / 400 + i) * 0.15) * k
        s.y += s.vy * k
        s.life -= s.decay * k
        if (s.life <= 0) {
          sparks.splice(i, 1)
          continue
        }
        ctx.globalAlpha = s.life * 0.9
        ctx.fillStyle = s.life > 0.6 ? glow : color
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.size * (0.6 + s.life * 0.4), 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'source-over'
      rafId = requestAnimationFrame(step)
    }

    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas.parentElement)
    rafId = requestAnimationFrame(step)

    return () => {
      ro.disconnect()
      cancelAnimationFrame(rafId)
    }
  }, [sourceRef, color, glow])

  return <canvas ref={canvasRef} className="case__sparks" aria-hidden="true" />
}
