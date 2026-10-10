import { useEffect, useRef } from 'react'
import { ATMOSPHERES } from '../data/books'

// Motor de atmósferas.
// Cada libro tiene un preset. Las partículas viven en tres profundidades
// (z): las cercanas son más grandes, rápidas y brillantes, y se desplazan
// más con el cursor (paralaje). Al abrirse, el mundo "sale" del centro del
// libro y se expande hasta llenar la escena.
//
// Para añadir un tipo nuevo: una entrada aquí y otra en ATMOSPHERES.
const CONFIGS = {
  maldito: { count: 80, size: [1, 3.2], speed: [0.05, 0.18], motion: 'drift', glow: true, pulse: true, attract: true, vignette: true },
  tormenta: { count: 170, size: [0.8, 1.7], speed: [9, 14], motion: 'diagonal', streak: true, flash: true },
  arena: { count: 240, size: [0.6, 2], speed: [0.9, 2.6], motion: 'wind' },
  presion: { count: 60, size: [1.5, 4.5], speed: [0.25, 0.7], motion: 'bubble', glow: true, rays: true },
  fuego: { count: 120, size: [1, 3.2], speed: [0.9, 2.3], motion: 'up', glow: true, flicker: true, heat: true },
  cosmos: { count: 230, size: [0.4, 1.8], speed: [0.02, 0.06], motion: 'drift', twinkle: true, constellation: true, shooting: true },
  esporas: { count: 70, size: [2, 6], speed: [0.08, 0.25], motion: 'float', glow: true },
  lluvia: { count: 190, size: [0.8, 1.4], speed: [11, 16], motion: 'down', streak: true, splash: true, glowSpot: true },
}

const INTRO_MS = 1400
const POINTER_RADIUS = 160

function rand(min, max) {
  return min + Math.random() * (max - min)
}

function easeOutExpo(t) {
  return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)
}

// Un halo pre-renderizado por color: dibujar una imagen es mucho más barato
// que usar shadowBlur en cada partícula.
function makeGlowSprite(color) {
  const size = 64
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const g = c.getContext('2d')
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  grad.addColorStop(0, color)
  grad.addColorStop(0.18, color + 'cc')
  grad.addColorStop(0.45, color + '33')
  grad.addColorStop(1, color + '00')
  g.fillStyle = grad
  g.fillRect(0, 0, size, size)
  return c
}

function spawn(cfg, w, h, scatter) {
  const z = rand(0.3, 1)
  const p = {
    x: Math.random() * w,
    y: Math.random() * h,
    z,
    size: rand(cfg.size[0], cfg.size[1]) * (0.55 + z * 0.65),
    speed: rand(cfg.speed[0], cfg.speed[1]) * (0.45 + z * 0.75),
    phase: Math.random() * Math.PI * 2,
    alpha: rand(0.45, 1) * (0.35 + z * 0.65),
    vx: 0,
    vy: 0,
  }
  if (!scatter) {
    if (cfg.motion === 'up' || cfg.motion === 'bubble') p.y = h + rand(5, 40)
    else if (cfg.motion === 'down' || cfg.motion === 'diagonal') p.y = -rand(5, 60)
    else if (cfg.motion === 'wind') p.x = -rand(5, 60)
  }
  return p
}

function drawBolt(ctx, w, h, alpha) {
  let x = rand(w * 0.15, w * 0.85)
  let y = 0
  ctx.save()
  ctx.strokeStyle = `rgba(232,238,252,${alpha})`
  ctx.lineWidth = 2
  ctx.shadowColor = '#e8eefc'
  ctx.shadowBlur = 18
  ctx.beginPath()
  ctx.moveTo(x, y)
  while (y < h * rand(0.45, 0.8)) {
    x += rand(-38, 38)
    y += rand(18, 46)
    ctx.lineTo(x, y)
  }
  ctx.stroke()
  ctx.restore()
}

export default function Atmosphere({ kind, className = 'atmosphere' }) {
  const canvasRef = useRef(null)
  const atmosphere = ATMOSPHERES[kind] || ATMOSPHERES.cosmos
  const cfg = CONFIGS[kind] || CONFIGS.cosmos

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const sprite = makeGlowSprite(atmosphere.glow)

    let width = 0
    let height = 0
    let particles = []
    let splashes = []
    let rafId = null
    let start = performance.now()
    let last = start
    let flash = 0
    let bolt = 0
    let nextFlash = rand(1800, 4200)
    let shooting = null
    let nextShooting = rand(2500, 6000)
    // cursor suavizado, en coordenadas del lienzo
    const pointer = { x: -9999, y: -9999, tx: -9999, ty: -9999, px: 0, py: 0, active: false }

    function resize() {
      const rect = canvas.parentElement.getBoundingClientRect()
      const nextW = Math.max(1, rect.width)
      const nextH = Math.max(1, rect.height)
      if (particles.length && width && height) {
        // reescalar en lugar de regenerar: el mundo no "salta" al redimensionar
        const sx = nextW / width
        const sy = nextH / height
        for (const p of particles) {
          p.x *= sx
          p.y *= sy
        }
      } else {
        particles = Array.from({ length: cfg.count }, () => spawn(cfg, nextW, nextH, true))
      }
      width = nextW
      height = nextH
      canvas.width = width * dpr
      canvas.height = height * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    function onPointerMove(e) {
      const rect = canvas.getBoundingClientRect()
      pointer.tx = e.clientX - rect.left
      pointer.ty = e.clientY - rect.top
      pointer.active = true
    }

    function onPointerLeave() {
      pointer.active = false
    }

    function recycle(p) {
      const fresh = spawn(cfg, width, height, false)
      Object.assign(p, fresh)
      if (cfg.motion === 'drift' || cfg.motion === 'float') {
        p.x = Math.random() * width
        p.y = Math.random() * height
      }
    }

    function drawBackdrop(t) {
      if (cfg.glowSpot) {
        const g = ctx.createRadialGradient(width * 0.72, height * 0.26, 0, width * 0.72, height * 0.26, Math.max(width, height) * 0.4)
        g.addColorStop(0, atmosphere.glow + '30')
        g.addColorStop(1, atmosphere.glow + '00')
        ctx.fillStyle = g
        ctx.fillRect(0, 0, width, height)
      }

      if (cfg.heat) {
        const flick = 0.75 + Math.sin(t / 180) * 0.08 + Math.sin(t / 67) * 0.05
        const g = ctx.createLinearGradient(0, height, 0, height * 0.45)
        g.addColorStop(0, atmosphere.glow + Math.round(flick * 60).toString(16).padStart(2, '0'))
        g.addColorStop(1, atmosphere.glow + '00')
        ctx.fillStyle = g
        ctx.fillRect(0, height * 0.45, width, height * 0.55)
      }

      if (cfg.rays) {
        ctx.save()
        ctx.globalCompositeOperation = 'lighter'
        for (let i = 0; i < 4; i++) {
          const sway = Math.sin(t / 2600 + i * 1.7) * width * 0.04
          const x = width * (0.18 + i * 0.22) + sway
          const g = ctx.createLinearGradient(x, 0, x + width * 0.08, height)
          g.addColorStop(0, atmosphere.glow + '1c')
          g.addColorStop(1, atmosphere.glow + '00')
          ctx.fillStyle = g
          ctx.beginPath()
          ctx.moveTo(x - 24, 0)
          ctx.lineTo(x + 30, 0)
          ctx.lineTo(x + width * 0.14, height)
          ctx.lineTo(x + width * 0.02, height)
          ctx.closePath()
          ctx.fill()
        }
        ctx.restore()
      }

      if (cfg.vignette) {
        const beat = 0.5 + Math.sin(t / 1300) * 0.5
        const g = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.25, width / 2, height / 2, Math.max(width, height) * 0.75)
        g.addColorStop(0, atmosphere.glow + '00')
        g.addColorStop(1, atmosphere.glow + Math.round(20 + beat * 28).toString(16).padStart(2, '0'))
        ctx.fillStyle = g
        ctx.fillRect(0, 0, width, height)
      }
    }

    function step(t) {
      // el primer timestamp de rAF puede ser anterior a `last`: nunca negativo
      const dt = Math.max(0, Math.min(t - last, 50))
      const k = dt / 16
      last = t
      const intro = reduceMotion ? 1 : easeOutExpo(Math.min((t - start) / INTRO_MS, 1))
      const cx = width / 2
      const cy = height / 2

      // suavizado del cursor y paralaje
      if (pointer.active) {
        if (pointer.x < -999) {
          pointer.x = pointer.tx
          pointer.y = pointer.ty
        }
        pointer.x += (pointer.tx - pointer.x) * 0.18
        pointer.y += (pointer.ty - pointer.y) * 0.18
      }
      const targetPx = pointer.active ? (pointer.x / width - 0.5) * 2 : 0
      const targetPy = pointer.active ? (pointer.y / height - 0.5) * 2 : 0
      pointer.px += (targetPx - pointer.px) * 0.05
      pointer.py += (targetPy - pointer.py) * 0.05

      ctx.clearRect(0, 0, width, height)
      ctx.globalAlpha = intro
      drawBackdrop(t)

      const wind = cfg.motion === 'wind' ? 1 + Math.max(0, Math.sin(t / 2100)) * 1.6 : 1
      const nearPointer = []

      for (const p of particles) {
        // movimiento propio de cada atmósfera
        switch (cfg.motion) {
          case 'diagonal':
            p.x -= p.speed * 0.45 * k
            p.y += p.speed * k
            break
          case 'down':
            p.y += p.speed * k
            break
          case 'up':
            p.y -= p.speed * k
            p.x += Math.sin(p.phase + t / 700) * 0.35 * k
            break
          case 'bubble':
            p.y -= p.speed * k
            p.x += Math.sin(p.phase + t / 500) * 0.5 * k
            break
          case 'wind':
            p.x += p.speed * wind * k
            p.y += Math.sin(p.phase + t / 900) * 0.25 * k
            break
          case 'float':
            p.x += Math.sin(p.phase + t / 4000) * p.speed * k
            p.y -= p.speed * 0.6 * k
            break
          default:
            p.x += Math.sin(p.phase + t / 3000) * p.speed * 2 * k
            p.y += Math.cos(p.phase + t / 3400) * p.speed * 2 * k
        }

        // el cursor aparta las partículas (o, en "maldito", las atrae)
        if (pointer.active) {
          const dx = p.x - pointer.x
          const dy = p.y - pointer.y
          const d2 = dx * dx + dy * dy
          if (d2 < POINTER_RADIUS * POINTER_RADIUS && d2 > 1) {
            const d = Math.sqrt(d2)
            const force = (1 - d / POINTER_RADIUS) * p.z * (cfg.attract ? -0.18 : 0.55)
            p.vx += (dx / d) * force
            p.vy += (dy / d) * force
            if (cfg.constellation && p.z > 0.55) nearPointer.push(p)
          }
        }
        p.x += p.vx * k
        p.y += p.vy * k
        p.vx *= 0.92
        p.vy *= 0.92

        // reciclar lo que sale de la escena
        if (cfg.splash && p.y > height * rand(0.82, 1.02)) {
          if (splashes.length < 60) splashes.push({ x: p.x, y: p.y, r: 0, life: 1 })
          recycle(p)
        } else if (p.y < -60 || p.y > height + 60 || p.x < -60 || p.x > width + 60) {
          if (cfg.motion === 'drift' || cfg.motion === 'float') {
            if (p.y < -60) p.y = height + 50
            else if (p.y > height + 60) p.y = -50
            if (p.x < -60) p.x = width + 50
            else if (p.x > width + 60) p.x = -50
          } else {
            recycle(p)
          }
        }

        let alpha = p.alpha
        if (cfg.twinkle) alpha *= 0.35 + Math.abs(Math.sin(p.phase + t / 900)) * 0.65
        if (cfg.flicker) alpha *= 0.55 + Math.abs(Math.sin(p.phase + t / 160)) * 0.45
        if (cfg.pulse) alpha *= 0.35 + Math.abs(Math.sin(p.phase + t / 1700)) * 0.65
        if (cfg.motion === 'up') alpha *= Math.min(1, Math.max(0, p.y / height) * 1.6)

        // posición dibujada: expansión inicial desde el centro + paralaje
        const dxp = cx + (p.x - cx) * intro - pointer.px * p.z * 26
        const dyp = cy + (p.y - cy) * intro - pointer.py * p.z * 18
        p.dx = dxp
        p.dy = dyp

        ctx.globalAlpha = alpha * intro
        if (cfg.streak) {
          const len = p.size * (cfg.motion === 'diagonal' ? 9 : 12) * p.z
          ctx.strokeStyle = atmosphere.particle
          ctx.lineWidth = p.size * 0.7
          ctx.beginPath()
          ctx.moveTo(dxp, dyp)
          if (cfg.motion === 'diagonal') ctx.lineTo(dxp + len * 0.45, dyp - len)
          else ctx.lineTo(dxp, dyp - len)
          ctx.stroke()
        } else if (cfg.glow) {
          const s = p.size * 7
          ctx.drawImage(sprite, dxp - s / 2, dyp - s / 2, s, s)
        } else {
          ctx.fillStyle = atmosphere.particle
          ctx.beginPath()
          ctx.arc(dxp, dyp, p.size, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      // constelaciones que se dibujan alrededor del cursor
      if (nearPointer.length > 1) {
        ctx.strokeStyle = atmosphere.particle
        ctx.lineWidth = 0.7
        for (let i = 0; i < nearPointer.length; i++) {
          for (let j = i + 1; j < nearPointer.length; j++) {
            const a = nearPointer[i]
            const b = nearPointer[j]
            const dx = a.dx - b.dx
            const dy = a.dy - b.dy
            const d2 = dx * dx + dy * dy
            if (d2 < 95 * 95) {
              ctx.globalAlpha = (1 - Math.sqrt(d2) / 95) * 0.45 * intro
              ctx.beginPath()
              ctx.moveTo(a.dx, a.dy)
              ctx.lineTo(b.dx, b.dy)
              ctx.stroke()
            }
          }
        }
      }

      // salpicaduras de lluvia
      if (splashes.length) {
        ctx.strokeStyle = atmosphere.particle
        ctx.lineWidth = 1
        splashes = splashes.filter((s) => {
          s.r += 0.6 * k
          s.life -= 0.045 * k
          if (s.life <= 0) return false
          ctx.globalAlpha = s.life * 0.5 * intro
          ctx.beginPath()
          ctx.ellipse(s.x, s.y, s.r * 2.2, s.r * 0.6, 0, Math.PI, Math.PI * 2)
          ctx.stroke()
          return true
        })
      }

      // estrellas fugaces
      if (cfg.shooting) {
        nextShooting -= dt
        if (!shooting && nextShooting <= 0) {
          shooting = { x: rand(width * 0.2, width), y: rand(0, height * 0.4), life: 1 }
          nextShooting = rand(3500, 8000)
        }
        if (shooting) {
          shooting.x -= 14 * k
          shooting.y += 5 * k
          shooting.life -= 0.022 * k
          const g = ctx.createLinearGradient(shooting.x, shooting.y, shooting.x + 140, shooting.y - 50)
          g.addColorStop(0, atmosphere.glow)
          g.addColorStop(1, atmosphere.glow + '00')
          ctx.globalAlpha = Math.max(shooting.life, 0) * intro
          ctx.strokeStyle = g
          ctx.lineWidth = 1.6
          ctx.beginPath()
          ctx.moveTo(shooting.x, shooting.y)
          ctx.lineTo(shooting.x + 140, shooting.y - 50)
          ctx.stroke()
          if (shooting.life <= 0) shooting = null
        }
      }

      // relámpagos
      if (cfg.flash) {
        nextFlash -= dt
        if (nextFlash <= 0 && flash <= 0) {
          flash = rand(0.18, 0.34)
          bolt = 1
          nextFlash = rand(2600, 6500)
        }
        if (bolt > 0) {
          ctx.globalAlpha = 1
          drawBolt(ctx, width, height, bolt * 0.9)
          bolt -= 0.25 * k
        }
        if (flash > 0) {
          ctx.globalAlpha = 1
          ctx.fillStyle = `rgba(232,238,252,${flash})`
          ctx.fillRect(0, 0, width, height)
          flash -= 0.03 * k
        }
      }

      ctx.globalAlpha = 1
      if (!reduceMotion) rafId = requestAnimationFrame(step)
    }

    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas.parentElement)
    window.addEventListener('pointermove', onPointerMove)
    document.addEventListener('pointerleave', onPointerLeave)

    if (reduceMotion) {
      step(performance.now())
    } else {
      start = performance.now()
      last = start
      rafId = requestAnimationFrame(step)
    }

    return () => {
      ro.disconnect()
      window.removeEventListener('pointermove', onPointerMove)
      document.removeEventListener('pointerleave', onPointerLeave)
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [cfg, atmosphere])

  return (
    <div className={className} style={{ background: atmosphere.bg }} aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  )
}
