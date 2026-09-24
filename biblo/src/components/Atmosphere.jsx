import { useEffect, useRef } from 'react'
import { ATMOSPHERES } from '../data/books'

// Un preset por tipo de atmósfera. Añadir un libro con un tipo nuevo
// solo requiere una entrada aquí (y en ATMOSPHERES, para el color).
const CONFIGS = {
  maldito: { count: 36, size: [1, 3], speed: [0.08, 0.2], motion: 'drift', pulse: true },
  tormenta: { count: 110, size: [1, 2], speed: [7, 11], motion: 'diagonal', streak: true, flash: true },
  arena: { count: 80, size: [1, 2.5], speed: [0.3, 0.9], motion: 'driftX' },
  presion: { count: 34, size: [1.5, 3.5], speed: [0.1, 0.3], motion: 'bob', glowDot: true },
  fuego: { count: 60, size: [1, 3], speed: [0.6, 1.5], motion: 'up', flicker: true },
  cosmos: { count: 130, size: [0.6, 2.2], speed: [0.02, 0.07], motion: 'drift', twinkle: true, constellation: true },
  esporas: { count: 42, size: [2, 5], speed: [0.1, 0.3], motion: 'up', glowDot: true, soft: true },
  lluvia: { count: 80, size: [1, 1.6], speed: [3.5, 5.5], motion: 'down', streak: true, glowSpot: true },
}

function rand(min, max) {
  return min + Math.random() * (max - min)
}

function makeParticle(cfg, w, h, born) {
  const [sMin, sMax] = cfg.size
  const [vMin, vMax] = cfg.speed
  const speed = rand(vMin, vMax)
  const p = {
    x: Math.random() * w,
    y: born ? Math.random() * h : cfg.motion === 'up' ? h + 10 : cfg.motion === 'down' || cfg.motion === 'diagonal' ? -10 : Math.random() * h,
    size: rand(sMin, sMax),
    speed,
    phase: Math.random() * Math.PI * 2,
    alpha: rand(0.35, 1),
  }
  return p
}

export default function Atmosphere({ kind }) {
  const canvasRef = useRef(null)
  const atmosphere = ATMOSPHERES[kind] || ATMOSPHERES.cosmos
  const cfg = CONFIGS[kind] || CONFIGS.cosmos

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let width = 0
    let height = 0
    let dpr = Math.min(window.devicePixelRatio || 1, 2)
    let particles = []
    let rafId = null
    let flashAlpha = 0
    let nextFlash = rand(2000, 5000)
    let last = performance.now()

    function resize() {
      const rect = canvas.parentElement.getBoundingClientRect()
      width = rect.width
      height = rect.height
      canvas.width = width * dpr
      canvas.height = height * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      particles = Array.from({ length: cfg.count }, () => makeParticle(cfg, width, height, true))
    }

    function step(t) {
      const dt = Math.min(t - last, 50)
      last = t
      ctx.clearRect(0, 0, width, height)

      if (cfg.glowSpot) {
        const g = ctx.createRadialGradient(
          width * 0.72,
          height * 0.28,
          0,
          width * 0.72,
          height * 0.28,
          Math.max(width, height) * 0.35
        )
        g.addColorStop(0, atmosphere.glow + '33')
        g.addColorStop(1, atmosphere.glow + '00')
        ctx.fillStyle = g
        ctx.fillRect(0, 0, width, height)
      }

      if (cfg.constellation) {
        ctx.strokeStyle = atmosphere.particle + '22'
        ctx.lineWidth = 1
        for (let i = 0; i < particles.length; i++) {
          for (let j = i + 1; j < particles.length; j++) {
            const a = particles[i]
            const b = particles[j]
            const dx = a.x - b.x
            const dy = a.y - b.y
            const dist2 = dx * dx + dy * dy
            if (dist2 < 120 * 120) {
              ctx.beginPath()
              ctx.moveTo(a.x, a.y)
              ctx.lineTo(b.x, b.y)
              ctx.stroke()
            }
          }
        }
      }

      for (const p of particles) {
        // actualizar posición según el tipo de movimiento
        if (cfg.motion === 'diagonal') {
          p.x -= p.speed * (dt / 16)
          p.y += p.speed * (dt / 16)
        } else if (cfg.motion === 'down') {
          p.y += p.speed * (dt / 16)
        } else if (cfg.motion === 'up') {
          p.y -= p.speed * (dt / 16)
          p.x += Math.sin(p.phase + t / 1400) * 0.15
        } else if (cfg.motion === 'driftX') {
          p.x += p.speed * (dt / 16)
          p.y += Math.sin(p.phase + t / 2200) * 0.08
        } else if (cfg.motion === 'bob') {
          p.y += Math.sin(p.phase + t / 1600) * 0.15
          p.x += Math.cos(p.phase + t / 2600) * 0.08
        } else {
          p.x += Math.sin(p.phase + t / 3000) * 0.06
          p.y += Math.cos(p.phase + t / 3400) * 0.05
        }

        // reciclar partículas que salen del lienzo
        if (p.y < -20) p.y = height + 20
        if (p.y > height + 20) p.y = -20
        if (p.x < -20) p.x = width + 20
        if (p.x > width + 20) p.x = -20

        let alpha = p.alpha
        if (cfg.twinkle) alpha = 0.3 + Math.abs(Math.sin(p.phase + t / 900)) * 0.7
        if (cfg.flicker) alpha = 0.5 + Math.abs(Math.sin(p.phase + t / 220)) * 0.5
        if (cfg.pulse) alpha = 0.25 + Math.abs(Math.sin(p.phase + t / 1800)) * 0.55

        ctx.globalAlpha = alpha
        ctx.fillStyle = atmosphere.particle

        if (cfg.glowDot || cfg.soft) {
          ctx.shadowColor = atmosphere.glow
          ctx.shadowBlur = p.size * 4
        } else {
          ctx.shadowBlur = 0
        }

        if (cfg.streak) {
          const len = p.size * (cfg.motion === 'diagonal' ? 7 : 5)
          ctx.strokeStyle = atmosphere.particle
          ctx.lineWidth = p.size * 0.7
          ctx.beginPath()
          ctx.moveTo(p.x, p.y)
          if (cfg.motion === 'diagonal') ctx.lineTo(p.x + len * 0.5, p.y - len)
          else ctx.lineTo(p.x, p.y - len)
          ctx.stroke()
        } else {
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
          ctx.fill()
        }
      }
      ctx.globalAlpha = 1
      ctx.shadowBlur = 0

      if (cfg.flash) {
        nextFlash -= dt
        if (nextFlash <= 0 && flashAlpha <= 0) {
          flashAlpha = rand(0.15, 0.35)
          nextFlash = rand(2500, 6000)
        }
        if (flashAlpha > 0) {
          ctx.fillStyle = `rgba(255,255,255,${flashAlpha})`
          ctx.fillRect(0, 0, width, height)
          flashAlpha -= 0.04
        }
      }

      if (!reduceMotion) rafId = requestAnimationFrame(step)
    }

    resize()
    window.addEventListener('resize', resize)
    if (reduceMotion) {
      step(performance.now())
    } else {
      rafId = requestAnimationFrame(step)
    }

    return () => {
      window.removeEventListener('resize', resize)
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [kind, cfg, atmosphere])

  return (
    <div className="atmosphere" style={{ background: atmosphere.bg }} aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  )
}
