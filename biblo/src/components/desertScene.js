import { makeStarSprite } from './starSprite'
import { isMuted } from '../sound'

// Motor de la entrada de "El Principito": del desierto al asteroide.
//   1) desierto nocturno con la avioneta estrellada y el aviador
//   2) la cámara sube al cielo; una estrella late
//   3) salto hacia esa estrella: se convierte en el asteroide B-612 con el
//      principito y el zorro
//   4) el asteroide se desliza a la esquina, al mismo sitio que el de la ficha
// API: const scene = createDesertScene(canvas); scene.frame(t /* s */);
//      scene.resize(); scene.dispose(). startDesertAudio() aparte.

export const T = {
  captionIn: 0.4,
  captionOut: 2.6,
  tilt: [2.0, 4.2], // la cámara sube
  shooting: 3.1, // estrella fugaz
  pulse: 3.5, // la estrella elegida empieza a latir
  zoom: [4.4, 6.3], // salto hacia la estrella
  glide: [6.6, 7.8], // el asteroide va a la esquina
  titleIn: 7.0,
  end: 8.9, // fin: se abre la ficha
}

const rand = (a, b) => a + Math.random() * (b - a)
const cl = (v) => Math.min(1, Math.max(0, v))
const lerp = (a, b, t) => a + (b - a) * t
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const easeOut = (t) => 1 - Math.pow(1 - t, 3)
const easeIn = (t) => t * t * t
const win = (t, a, b) => cl((t - a) / (b - a))

const SKY_SHIFT = 0.62 // cuánto baja el cielo (en alturas de pantalla) al levantar la cámara
const TARGET = { x: 0.5, y: -0.33 } // la estrella del principito, en "espacio de cielo"
const MOON = { x: 0.2, y: 0.1 }
const DUNES = [
  { base: 0.6, amp: [0.05, 0.02], f: [1.3, 3.1], ph: 0.4, top: '#2c2a52', bot: '#141329', par: 0.85 },
  { base: 0.7, amp: [0.06, 0.018], f: [1.7, 4.3], ph: 2.1, top: '#363057', bot: '#17152d', par: 1.0 },
  { base: 0.84, amp: [0.05, 0.015], f: [1.1, 5.2], ph: 4.0, top: '#423960', bot: '#1a1730', par: 1.18 },
]

export function createDesertScene(canvas) {
  const ctx = canvas.getContext('2d')
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const GOLD_STAR = makeStarSprite('#f5d533', '#fff3b0')
  let W = 0
  let H = 0

  // estrellas en "espacio de cielo": y < 0 queda por encima de la pantalla inicial
  const stars = Array.from({ length: 420 }, () => ({
    x: Math.random(),
    y: rand(-0.75, 0.75),
    r: rand(0.3, 1.5),
    ph: rand(0, 6.28),
    gold: Math.random() < 0.09,
  }))
  const sand = Array.from({ length: 160 }, () => ({ x: Math.random(), y: rand(0.6, 1), v: rand(0.0006, 0.0018), l: rand(4, 14) }))
  let smoke = []
  let lastOff = 0
  let lastT = 0

  function resize() {
    W = canvas.clientWidth
    H = canvas.clientHeight
    canvas.width = W * dpr
    canvas.height = H * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  const duneY = (d, x, off) =>
    H * (d.base + d.amp[0] * Math.sin((x / W) * Math.PI * d.f[0] + d.ph) + d.amp[1] * Math.sin((x / W) * Math.PI * d.f[1] + d.ph * 1.7)) + off * d.par

  // ---------- cielo ----------
  function drawSky(t, skyOff, zoom, T2) {
    const g = ctx.createLinearGradient(0, 0, 0, H)
    g.addColorStop(0, '#060818')
    g.addColorStop(0.6, '#10163a')
    g.addColorStop(1, '#1b1d44')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)

    // luna con halo (en el salto sale disparada como el resto del cielo)
    const kz = 1 + easeIn(zoom) * 14
    const mx = T2.x + (MOON.x * W - T2.x) * kz
    const my = T2.y + (MOON.y * H + skyOff - T2.y) * kz
    const mr = Math.min(W, H) * 0.055 * (1 + zoom * 2)
    ctx.globalAlpha = 1 - cl(zoom * 2.5)
    const halo = ctx.createRadialGradient(mx, my, mr * 0.5, mx, my, mr * 6)
    halo.addColorStop(0, 'rgba(250, 236, 200, 0.25)')
    halo.addColorStop(1, 'rgba(250, 236, 200, 0)')
    ctx.fillStyle = halo
    ctx.fillRect(mx - mr * 6, my - mr * 6, mr * 12, mr * 12)
    ctx.fillStyle = '#f3ead2'
    ctx.beginPath()
    ctx.arc(mx, my, mr, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = 'rgba(200, 190, 160, 0.35)'
    ctx.beginPath()
    ctx.arc(mx - mr * 0.3, my - mr * 0.2, mr * 0.22, 0, 7)
    ctx.arc(mx + mr * 0.35, my + mr * 0.3, mr * 0.15, 0, 7)
    ctx.fill()
    ctx.globalAlpha = 1

    // estrellas: estela de "salto" durante el zoom; al llegar, cielo nuevo
    const goldIn = cl((skyOff / (SKY_SHIFT * H)) * 1.3)
    const arrived = cl((t - T.zoom[1]) / 0.8)
    const kPrev = 1 + easeIn(Math.max(0, zoom - 0.06)) * 14
    for (const s of stars) {
      let x = s.x * W
      let y = s.y * H + skyOff
      if (arrived > 0) {
        y = ((s.y + 0.75) / 1.5) * H
      } else if (zoom > 0) {
        const px = T2.x + (x - T2.x) * kz
        const py = T2.y + (y - T2.y) * kz
        if (px < -50 || px > W + 50 || py < -50 || py > H + 50) continue
        ctx.globalAlpha = 0.6 * (1 - zoom * 0.5)
        ctx.strokeStyle = s.gold ? '#fff3b0' : '#cfd6ff'
        ctx.lineWidth = s.r
        ctx.beginPath()
        ctx.moveTo(T2.x + (x - T2.x) * kPrev, T2.y + (y - T2.y) * kPrev)
        ctx.lineTo(px, py)
        ctx.stroke()
        continue
      }
      if (y < -10 || y > H + 10) continue
      const tw = (0.4 + Math.abs(Math.sin(s.ph + t * 1.3)) * 0.6) * (arrived > 0 ? arrived : 1)
      if (s.gold) {
        ctx.globalAlpha = tw * (arrived > 0 ? 1 : goldIn)
        const sz = 10 + s.r * 7
        ctx.drawImage(GOLD_STAR, x - sz / 2, y - sz / 2, sz, sz)
      } else {
        ctx.globalAlpha = tw * 0.8
        ctx.fillStyle = '#d8ddff'
        ctx.beginPath()
        ctx.arc(x, y, s.r, 0, 7)
        ctx.fill()
      }
    }
    ctx.globalAlpha = 1
  }

  function drawShootingStar(t, skyOff) {
    const p = win(t, T.shooting, T.shooting + 0.9)
    if (p <= 0 || p >= 1) return
    const x0 = W * 0.85
    const y0 = H * 0.08 + skyOff * 0.3
    const x = lerp(x0, x0 - W * 0.45, easeOut(p))
    const y = lerp(y0, y0 + H * 0.22, easeOut(p))
    const g = ctx.createLinearGradient(x, y, x + W * 0.12, y - H * 0.06)
    g.addColorStop(0, `rgba(255, 243, 176, ${1 - p})`)
    g.addColorStop(1, 'rgba(255, 243, 176, 0)')
    ctx.strokeStyle = g
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + W * 0.12, y - H * 0.06)
    ctx.stroke()
  }

  // ---------- desierto ----------
  function drawPlane(x, y, s, t) {
    // biplano con el morro clavado en la arena (silueta + borde de luz de luna)
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(-0.32)
    ctx.scale(s, s)
    ctx.fillStyle = '#0e0d1f'
    for (const d of [
      'M-58 -4 L-40 -6 L30 -9 Q44 -6 46 0 Q44 6 30 8 L-40 5 L-58 2 Z', // fuselaje
      'M-58 -3 L-50 -22 L-42 -5 Z', // timón
      'M-60 1 L-44 1 L-42 4 L-60 4 Z', // estabilizador
      'M-22 -26 L28 -26 Q31 -24 28 -22 L-22 -22 Z', // ala superior
      'M-18 7 L24 7 Q27 9 24 11 L-18 11 Z', // ala inferior
    ])
      ctx.fill(new Path2D(d))
    ctx.strokeStyle = '#0e0d1f'
    ctx.lineWidth = 2.2
    ctx.beginPath()
    ctx.moveTo(-14, -22)
    ctx.lineTo(-12, 7)
    ctx.moveTo(20, -22)
    ctx.lineTo(18, 7)
    ctx.moveTo(-3, -22)
    ctx.lineTo(5, -9)
    ctx.stroke()
    ctx.beginPath()
    ctx.ellipse(48, -2, 2.5, 16, 0.5, 0, 7) // hélice torcida
    ctx.fill()
    ctx.beginPath()
    ctx.arc(8, 15, 5.5, 0, 7) // rueda medio enterrada
    ctx.fill()
    ctx.strokeStyle = 'rgba(232, 218, 176, 0.55)'
    ctx.lineWidth = 1.1
    ctx.beginPath()
    ctx.moveTo(-58, -4)
    ctx.lineTo(-40, -6)
    ctx.lineTo(30, -9)
    ctx.moveTo(-22, -26)
    ctx.lineTo(28, -26)
    ctx.moveTo(-50, -22)
    ctx.lineTo(-42, -5)
    ctx.stroke()
    // brasa en el motor
    const fl = 0.6 + Math.sin(t * 17) * 0.2 + Math.sin(t * 7.3) * 0.15
    const ember = ctx.createRadialGradient(40, -1, 0, 40, -1, 22)
    ember.addColorStop(0, `rgba(255, 160, 70, ${0.85 * fl})`)
    ember.addColorStop(1, 'rgba(255, 120, 40, 0)')
    ctx.fillStyle = ember
    ctx.fillRect(18, -23, 44, 44)
    ctx.restore()
    const a = -0.32
    return [x + (44 * Math.cos(a) + 2 * Math.sin(a)) * s, y + (44 * Math.sin(a) - 2 * Math.cos(a)) * s]
  }

  function drawAviator(x, y, s) {
    // el aviador sentado en la arena, mirando el avión
    ctx.save()
    ctx.translate(x, y)
    ctx.scale(s, s)
    ctx.fillStyle = '#0e0d1f'
    ctx.beginPath()
    ctx.arc(0, -26, 5, 0, 7)
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(-6, -20)
    ctx.lineTo(6, -20)
    ctx.lineTo(7, -6)
    ctx.lineTo(-7, -6)
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(-6, -7)
    ctx.lineTo(10, -8)
    ctx.lineTo(16, 0)
    ctx.lineTo(11, 0)
    ctx.lineTo(7, -3)
    ctx.lineTo(-6, -1)
    ctx.fill()
    ctx.strokeStyle = 'rgba(232, 218, 176, 0.5)'
    ctx.lineWidth = 0.9
    ctx.beginPath()
    ctx.arc(0, -26, 5, Math.PI * 1.1, Math.PI * 1.9)
    ctx.stroke()
    ctx.restore()
  }

  function drawDesert(t, off, dt) {
    if (off > H * 1.3) return null
    let nose = null
    DUNES.forEach((d, i) => {
      const g = ctx.createLinearGradient(0, H * (d.base - 0.08) + off * d.par, 0, H + off * d.par)
      g.addColorStop(0, d.top)
      g.addColorStop(1, d.bot)
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.moveTo(0, H * 2 + off)
      for (let x = 0; x <= W + 16; x += 16) ctx.lineTo(x, duneY(d, x, off))
      ctx.lineTo(W, H * 2 + off)
      ctx.closePath()
      ctx.fill()
      // filo iluminado por la luna (más intenso del lado de la luna)
      const rim = ctx.createLinearGradient(0, 0, W, 0)
      rim.addColorStop(0, 'rgba(240, 225, 185, 0.5)')
      rim.addColorStop(1, 'rgba(240, 225, 185, 0.08)')
      ctx.strokeStyle = rim
      ctx.lineWidth = 1.4
      ctx.beginPath()
      for (let x = 0; x <= W + 16; x += 16) {
        if (x) ctx.lineTo(x, duneY(d, x, off))
        else ctx.moveTo(x, duneY(d, x, off))
      }
      ctx.stroke()
      if (i === 1) {
        const s = Math.min(W, H) * 0.0017
        drawAviator(W * 0.585, duneY(d, W * 0.585, off) + 3, s)
        nose = drawPlane(W * 0.66, duneY(d, W * 0.66, off) - 4 * s, s * 1.15, t)
      }
    })
    // arena que vuela con el viento, rozando las dunas
    ctx.fillStyle = 'rgba(226, 208, 168, 0.35)'
    for (const g of sand) {
      g.x += g.v * dt * 60
      if (g.x > 1.05) g.x = -0.05
      ctx.fillRect(g.x * W, g.y * H + off * 1.05 + Math.sin(t * 3 + g.l) * 2, g.l * 0.5, 1)
    }
    return nose
  }

  function drawSmoke(nose, t, off, dt) {
    const k = dt * 60
    const dOff = off - lastOff // el humo baja con el desierto cuando la cámara sube
    lastOff = off
    if (nose && smoke.length < 140 && off < H) {
      for (let i = 0; i < 2; i++) smoke.push({ x: nose[0], y: nose[1], vx: rand(0.3, 0.8), vy: rand(-0.8, -0.45), r: rand(4, 7), a: 0.22 })
    }
    for (const p of smoke) {
      p.x += (p.vx + Math.sin(t * 2 + p.y * 0.05) * 0.2) * k
      p.y += p.vy * k + dOff
      p.r += 0.32 * k
      p.a -= 0.0022 * k
    }
    smoke = smoke.filter((p) => p.a > 0)
    for (const p of smoke) {
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r)
      g.addColorStop(0, `rgba(170, 172, 196, ${p.a})`)
      g.addColorStop(1, 'rgba(170, 172, 196, 0)')
      ctx.fillStyle = g
      ctx.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2)
    }
  }

  // ---------- asteroide B-612 (mismo estilo que el de la ficha) ----------
  function drawRose(k) {
    ctx.save()
    ctx.scale(k, k)
    ctx.strokeStyle = '#3f8f4a'
    ctx.lineWidth = 1.4
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(0, -15)
    ctx.stroke()
    ctx.fillStyle = '#4fa35a'
    ctx.beginPath()
    ctx.ellipse(-3, -7, 3, 1.4, 0.5, 0, 7)
    ctx.ellipse(3, -10, 3, 1.4, -0.5, 0, 7)
    ctx.fill()
    ctx.fillStyle = '#d8323a'
    ctx.beginPath()
    ctx.arc(0, -18, 4.2, 0, 7)
    ctx.fill()
    ctx.strokeStyle = '#8e1b22'
    ctx.lineWidth = 0.8
    ctx.beginPath()
    ctx.arc(0, -18, 2, 0.3, 4.5)
    ctx.stroke()
    ctx.fillStyle = 'rgba(220, 235, 255, 0.12)'
    ctx.strokeStyle = 'rgba(235, 245, 255, 0.8)'
    ctx.lineWidth = 0.9
    ctx.beginPath()
    ctx.moveTo(-9, 0)
    ctx.lineTo(-9, -17)
    ctx.arc(0, -17, 9, Math.PI, 0)
    ctx.lineTo(9, 0)
    ctx.fill()
    ctx.stroke()
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
    ctx.beginPath()
    ctx.arc(0, -17, 6, Math.PI * 1.1, Math.PI * 1.45)
    ctx.stroke()
    ctx.restore()
  }

  function drawVolcano(k, smoking, t) {
    ctx.save()
    ctx.scale(k, k)
    ctx.fillStyle = '#7d8193'
    ctx.strokeStyle = '#1d2140'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(-9, 0)
    ctx.lineTo(-5, -9)
    ctx.lineTo(5, -9)
    ctx.lineTo(9, 0)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#3a3e52'
    ctx.beginPath()
    ctx.ellipse(0, -9, 5, 1.6, 0, 0, 7)
    ctx.fill()
    if (smoking) {
      for (let i = 0; i < 3; i++) {
        const ph = (t * 0.6 + i / 3) % 1
        ctx.fillStyle = `rgba(217, 219, 228, ${0.7 * (1 - ph)})`
        ctx.beginPath()
        ctx.arc(Math.sin(ph * 4) * 2, -12 - ph * 18, 2.5 + ph * 3, 0, 7)
        ctx.fill()
      }
    }
    ctx.restore()
  }

  function drawSprout(k) {
    ctx.save()
    ctx.scale(k, k)
    ctx.strokeStyle = '#3f8f4a'
    ctx.lineWidth = 1.3
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(0, -6)
    ctx.moveTo(0, -4)
    ctx.quadraticCurveTo(-4, -7, -5, -4)
    ctx.moveTo(0, -5)
    ctx.quadraticCurveTo(4, -9, 5, -5)
    ctx.stroke()
    ctx.restore()
  }

  function drawPrince(k, t) {
    // de pie, mirando a la derecha (al zorro), con la bufanda al viento
    ctx.save()
    ctx.scale(k, k)
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#1d2140'
    ctx.lineWidth = 1
    ctx.fillStyle = '#6b5ca8' // botas
    ctx.fillRect(-4.5, -13, 3.5, 13)
    ctx.fillRect(1, -13, 3.5, 13)
    ctx.beginPath() // abrigo
    ctx.moveTo(-12, -9)
    ctx.lineTo(9, -9)
    ctx.lineTo(5, -38)
    ctx.lineTo(-5, -38)
    ctx.closePath()
    ctx.fillStyle = '#2f8a63'
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#f5d533' // estrellitas del abrigo
    for (const [sx, sy] of [[-6, -14], [2, -18], [-3, -25], [4, -29], [-7, -21], [0, -33]]) {
      ctx.beginPath()
      ctx.arc(sx, sy, 0.9, 0, 7)
      ctx.fill()
    }
    const w1 = Math.sin(t * 6) * 3 // bufanda ondeando hacia atrás
    const w2 = Math.sin(t * 6 + 1.4) * 4
    ctx.strokeStyle = '#f2c94c'
    ctx.lineWidth = 3.4
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(-1, -39)
    ctx.bezierCurveTo(-10, -44 + w1, -18, -36 + w2, -28, -41 + w1)
    ctx.stroke()
    ctx.fillStyle = '#f6c9a0' // cabeza
    ctx.strokeStyle = '#1d2140'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(0, -46, 7, 0, 7)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#1d2140'
    ctx.beginPath()
    ctx.arc(3.2, -46.5, 0.9, 0, 7)
    ctx.fill()
    ctx.fillStyle = '#f5d533' // pelo en punta
    ctx.beginPath()
    ;[[-8, -47], [-11, -53], [-5, -52], [-6, -60], [-1, -53], [2, -61], [3, -53], [9, -57], [6, -50], [10, -48], [5, -50]].forEach(
      ([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))
    )
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    ctx.restore()
  }

  function drawFox(k, t) {
    // sentado, mirando a la izquierda (al principito), moviendo la cola
    ctx.save()
    ctx.scale(k, k)
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#1d2140'
    ctx.lineWidth = 1
    // cola enroscada detrás del cuerpo
    ctx.save()
    ctx.translate(6, -3)
    ctx.rotate(Math.sin(t * 3.2) * 0.12)
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.bezierCurveTo(12, 1, 17, -12, 10, -19)
    ctx.bezierCurveTo(7, -15, 10, -7, -1, -6)
    ctx.closePath()
    ctx.fillStyle = '#e8711a'
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#f4efe6'
    ctx.beginPath()
    ctx.ellipse(10, -17.5, 3, 2.4, 0.6, 0, 7)
    ctx.fill()
    ctx.stroke()
    ctx.restore()
    // cuerpo
    ctx.beginPath()
    ctx.moveTo(-6, 0)
    ctx.lineTo(8, 0)
    ctx.quadraticCurveTo(10, -10, 4, -17)
    ctx.lineTo(-3, -17)
    ctx.quadraticCurveTo(-8, -9, -6, 0)
    ctx.closePath()
    ctx.fillStyle = '#e8711a'
    ctx.fill()
    ctx.stroke()
    // pecho blanco
    ctx.beginPath()
    ctx.moveTo(-5, -2)
    ctx.quadraticCurveTo(-7, -9, -3, -15)
    ctx.lineTo(0, -15)
    ctx.quadraticCurveTo(-2, -8, -1, -2)
    ctx.closePath()
    ctx.fillStyle = '#f4efe6'
    ctx.fill()
    // patas delanteras
    ctx.strokeStyle = '#1d2140'
    ctx.lineWidth = 1.6
    ctx.beginPath()
    ctx.moveTo(-4, -1)
    ctx.lineTo(-4, 0)
    ctx.moveTo(-1, -1)
    ctx.lineTo(-1, 0)
    ctx.stroke()
    ctx.lineWidth = 1
    // cabeza con orejas en punta y hocico hacia la izquierda
    ctx.beginPath()
    ctx.moveTo(-2, -15)
    ctx.lineTo(-11, -21)
    ctx.lineTo(-5, -25)
    ctx.lineTo(-4, -31)
    ctx.lineTo(-1, -26)
    ctx.lineTo(2, -32)
    ctx.lineTo(3, -24)
    ctx.lineTo(4, -17)
    ctx.closePath()
    ctx.fillStyle = '#e8711a'
    ctx.fill()
    ctx.stroke()
    ctx.beginPath() // mejilla blanca
    ctx.moveTo(-10.5, -20.8)
    ctx.lineTo(-3, -19)
    ctx.lineTo(-2.3, -15.4)
    ctx.closePath()
    ctx.fillStyle = '#f4efe6'
    ctx.fill()
    ctx.fillStyle = '#1d2140'
    ctx.beginPath()
    ctx.arc(-11, -21, 1, 0, 7) // nariz
    ctx.arc(-4.5, -23, 0.8, 0, 7) // ojo
    ctx.fill()
    ctx.restore()
  }

  function drawAsteroid(x, y, R, rot, t, alpha) {
    if (alpha <= 0) return
    const k = R / 60
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.translate(x, y)
    const halo = ctx.createRadialGradient(0, 0, R * 0.9, 0, 0, R * 1.8)
    halo.addColorStop(0, 'rgba(255, 243, 176, 0.18)')
    halo.addColorStop(1, 'rgba(255, 243, 176, 0)')
    ctx.fillStyle = halo
    ctx.fillRect(-R * 2, -R * 2, R * 4, R * 4)
    ctx.save()
    ctx.rotate(rot)
    ctx.fillStyle = '#c9cbd3'
    ctx.strokeStyle = '#1d2140'
    ctx.lineWidth = Math.max(1, 1.6 * k)
    ctx.beginPath()
    ctx.arc(0, 0, R, 0, 7)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#b3b6c2'
    ctx.strokeStyle = '#8e92a3'
    ctx.lineWidth = 0.8 * k
    for (const [cx, cy, rx, ry] of [[-22, -14, 8, 5], [18, 20, 10, 6], [-14, 30, 5, 3], [26, -24, 4, 2.6]]) {
      ctx.beginPath()
      ctx.ellipse(cx * k, cy * k, rx * k, ry * k, 0, 0, 7)
      ctx.fill()
      ctx.stroke()
    }
    const on = (deg, fn) => {
      ctx.save()
      ctx.rotate((deg * Math.PI) / 180)
      ctx.translate(0, -R + 1)
      fn()
      ctx.restore()
    }
    on(-48, () => drawRose(k))
    on(28, () => drawVolcano(k, true, t))
    on(58, () => drawVolcano(k, false, t))
    on(160, () => drawVolcano(k, false, t))
    on(-100, () => drawSprout(k))
    on(112, () => drawSprout(k))
    ctx.restore()
    // sombra del lado de la noche (no gira: la luz viene siempre del mismo lado)
    const sh = ctx.createLinearGradient(-R, 0, R, 0)
    sh.addColorStop(0, 'rgba(15, 18, 45, 0)')
    sh.addColorStop(0.55, 'rgba(15, 18, 45, 0)')
    sh.addColorStop(1, 'rgba(15, 18, 45, 0.45)')
    ctx.fillStyle = sh
    ctx.beginPath()
    ctx.arc(0, 0, R, 0, 7)
    ctx.fill()
    // el principito y el zorro, siempre arriba: el planeta gira bajo sus pies
    ctx.save()
    ctx.rotate(-0.14)
    ctx.translate(0, -R + 1)
    drawPrince(k, t)
    ctx.restore()
    ctx.save()
    ctx.rotate(0.3)
    ctx.translate(0, -R + 1)
    drawFox(k, t)
    ctx.restore()
    ctx.restore()
  }

  // ---------- fotograma ----------
  function frame(t) {
    const dt = Math.max(0, Math.min(t - lastT, 0.05))
    lastT = t
    const tilt = ease(win(t, ...T.tilt))
    const skyOff = tilt * SKY_SHIFT * H
    const zoom = win(t, ...T.zoom)
    const glide = ease(win(t, ...T.glide))
    const T2 = { x: TARGET.x * W, y: TARGET.y * H + skyOff }

    drawSky(t, skyOff, zoom, T2)
    drawShootingStar(t, skyOff)
    const nose = drawDesert(t, skyOff * 1.25, dt)
    drawSmoke(nose, t, skyOff * 1.25, dt)

    // la estrella elegida: late, crece y se convierte en el asteroide
    const vmin = Math.min(W, H) / 100
    const pulse = win(t, T.pulse, T.pulse + 0.4)
    const Rmax = vmin * 23
    const R = lerp(vmin * 1.2, Rmax, easeIn(zoom) * 0.85 + easeOut(zoom) * 0.15)
    // destino: el mismo sitio y tamaño que el asteroide de la ficha (.asteroid en App.css)
    const small = W <= 700
    const corner = small ? { x: W - 10 * vmin, y: H - 2 * vmin, r: 13.2 * vmin } : { x: W - 16 * vmin, y: H - 4 * vmin, r: 18.6 * vmin }
    const ax = lerp(T2.x, corner.x, glide)
    const ay = lerp(T2.y, corner.y, glide)
    const Rg = lerp(R, corner.r, glide)
    if (pulse > 0 && zoom < 0.45) {
      const beat = 1 + Math.max(0, Math.sin((t - T.pulse) * 11.4)) * 0.6
      const sz = (26 + pulse * 18) * beat * (1 + zoom * 6)
      ctx.globalAlpha = 1 - cl((zoom - 0.25) / 0.2)
      ctx.drawImage(GOLD_STAR, T2.x - sz / 2, T2.y - sz / 2, sz, sz)
      const fl = ctx.createRadialGradient(T2.x, T2.y, 0, T2.x, T2.y, sz * 1.6)
      fl.addColorStop(0, 'rgba(255, 243, 176, 0.35)')
      fl.addColorStop(1, 'rgba(255, 243, 176, 0)')
      ctx.fillStyle = fl
      ctx.fillRect(T2.x - sz * 2, T2.y - sz * 2, sz * 4, sz * 4)
      ctx.globalAlpha = 1
    }
    drawAsteroid(ax, ay, Rg, t * 0.12, t, cl((zoom - 0.2) / 0.25))

    // destello al llegar
    const arrive = win(t, T.zoom[1] - 0.15, T.zoom[1] + 0.5)
    if (arrive > 0 && arrive < 1) {
      ctx.fillStyle = `rgba(255, 243, 200, ${0.35 * Math.sin(arrive * Math.PI)})`
      ctx.fillRect(0, 0, W, H)
    }
  }

  resize()
  return { frame, resize, dispose() {} }
}

// ---------- sonido (sintetizado, sin archivos) ----------
export function startDesertAudio() {
  const Ctx = window.AudioContext || window.webkitAudioContext
  if (!Ctx || isMuted()) return null
  const ac = new Ctx()
  const master = ac.createGain()
  master.gain.value = 0.9
  master.connect(ac.destination)
  const now = ac.currentTime
  const noiseBuf = ac.createBuffer(1, ac.sampleRate * 3, ac.sampleRate)
  const nd = noiseBuf.getChannelData(0)
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1

  // viento del desierto
  const wind = ac.createBufferSource()
  wind.buffer = noiseBuf
  wind.loop = true
  const wf = ac.createBiquadFilter()
  wf.type = 'bandpass'
  wf.frequency.value = 420
  wf.Q.value = 0.8
  const lfo = ac.createOscillator()
  lfo.frequency.value = 0.25
  const lfoG = ac.createGain()
  lfoG.gain.value = 180
  lfo.connect(lfoG).connect(wf.frequency)
  lfo.start()
  const wg = ac.createGain()
  wg.gain.setValueAtTime(0, now)
  wg.gain.linearRampToValueAtTime(0.16, now + 0.8)
  wg.gain.linearRampToValueAtTime(0.16, now + T.tilt[0])
  wg.gain.linearRampToValueAtTime(0, now + T.tilt[1] + 0.4)
  wind.connect(wf).connect(wg).connect(master)
  wind.start()

  // fondo grave y cálido que entra al mirar el cielo
  for (const [f, v] of [[110, 0.035], [164.8, 0.025], [220, 0.015]]) {
    const o = ac.createOscillator()
    o.frequency.value = f
    const g = ac.createGain()
    g.gain.setValueAtTime(0, now)
    g.gain.linearRampToValueAtTime(0, now + T.tilt[0])
    g.gain.linearRampToValueAtTime(v, now + T.tilt[1])
    g.gain.linearRampToValueAtTime(v, now + T.end - 0.6)
    g.gain.linearRampToValueAtTime(0, now + T.end + 0.4)
    o.connect(g).connect(master)
    o.start()
    o.stop(now + T.end + 1)
  }

  function chime(freq, at, vol) {
    const tt = now + at
    for (const [m, v] of [[1, 1], [2.76, 0.28]]) {
      const o = ac.createOscillator()
      o.frequency.value = freq * m
      const g = ac.createGain()
      g.gain.setValueAtTime(0.0001, tt)
      g.gain.exponentialRampToValueAtTime(vol * v, tt + 0.01)
      g.gain.exponentialRampToValueAtTime(0.0001, tt + 1.6 / m)
      o.connect(g).connect(master)
      o.start(tt)
      o.stop(tt + 1.8)
    }
  }
  chime(1568, T.shooting, 0.03) // estrella fugaz
  chime(2093, T.shooting + 0.12, 0.02)
  ;[0, 0.55, 1.1].forEach((d) => chime(1046.5, T.pulse + d, 0.05)) // latido
  ;[523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => chime(f, T.zoom[1] - 0.2 + i * 0.09, 0.05)) // llegada

  // "salto": ruido que sube de tono durante el viaje
  const sw = ac.createBufferSource()
  sw.buffer = noiseBuf
  const sf = ac.createBiquadFilter()
  sf.type = 'bandpass'
  sf.Q.value = 2
  sf.frequency.setValueAtTime(300, now + T.zoom[0])
  sf.frequency.exponentialRampToValueAtTime(3200, now + T.zoom[1])
  const sg = ac.createGain()
  sg.gain.setValueAtTime(0, now + T.zoom[0])
  sg.gain.linearRampToValueAtTime(0.12, now + T.zoom[1] - 0.25)
  sg.gain.linearRampToValueAtTime(0, now + T.zoom[1] + 0.2)
  sw.connect(sf).connect(sg).connect(master)
  sw.start(now + T.zoom[0])
  sw.stop(now + T.zoom[1] + 0.4)

  return {
    stop() {
      master.gain.setTargetAtTime(0, ac.currentTime, 0.2)
      setTimeout(() => ac.close(), 600)
    },
  }
}
