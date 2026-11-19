// Ambiente de la ficha de "Cien años de soledad": los cuatro años, once meses
// y dos días de lluvia sobre Macondo. Es la pared de la portada (naranja
// arriba, raya roja, zócalo azul) empapada: oscura de agua, con regueros que
// bajan despacio (una gota con una estela corta y brillante que se seca
// enseguida: nada se acumula aunque la ficha quede abierta horas) y charcos
// abajo donde cada gota abre un anillo. La lluvia que cae la pone Atmosphere.jsx.

import { PAL, rng, cl, makeCanvas, grainTexture, tint } from './macondoPaint'

const WET = 0.55 // cuánto oscurece el agua la pintura

export function createMacondoRain() {
  const t0 = performance.now()
  const r = rng(1967)
  let W = 1
  let H = 1
  let dpr = 1
  let wall = null
  let rills = []
  let rings = []
  let last = 0
  let stripe = 0
  let floor = 0

  function build() {
    stripe = H * 0.64
    floor = H * 0.9
    wall = makeCanvas(W * dpr, H * dpr)
    const g = wall.getContext('2d')
    g.scale(dpr, dpr)
    // la pared, más oscura por el agua (y más arriba aún más mojada)
    const up = g.createLinearGradient(0, 0, 0, stripe)
    up.addColorStop(0, tint(PAL.orange, '#2a1406', WET + 0.12))
    up.addColorStop(1, tint(PAL.orange, '#2a1406', WET))
    g.fillStyle = up
    g.fillRect(0, 0, W, stripe)
    g.fillStyle = tint(PAL.red, '#200805', WET)
    g.fillRect(0, stripe, W, H * 0.018)
    const low = g.createLinearGradient(0, stripe, 0, floor)
    low.addColorStop(0, tint(PAL.blue, '#04121c', WET - 0.05))
    low.addColorStop(1, tint(PAL.blue, '#04121c', WET + 0.1))
    g.fillStyle = low
    g.fillRect(0, stripe + H * 0.018, W, floor - stripe)
    // manchas de humedad: bandas blandas que bajan desde el alero, sin bordes
    g.save()
    g.filter = 'blur(14px)'
    for (let i = 0; i < 18; i++) {
      const x = r() * W
      const w = 40 + r() * 110
      const h = H * (0.18 + r() * 0.4)
      const s = g.createLinearGradient(0, 0, 0, h)
      s.addColorStop(0, 'rgba(20, 8, 2, 0.22)')
      s.addColorStop(1, 'rgba(20, 8, 2, 0)')
      g.fillStyle = s
      g.beginPath()
      g.ellipse(x, 0, w / 2, h, 0, 0, Math.PI)
      g.fill()
    }
    g.restore()
    // el charco: el suelo refleja la pared, oscuro y brillante
    const pool = g.createLinearGradient(0, floor, 0, H)
    pool.addColorStop(0, 'rgba(8, 22, 30, 0.95)')
    pool.addColorStop(1, 'rgba(4, 12, 18, 1)')
    g.fillStyle = pool
    g.fillRect(0, floor, W, H - floor)
    g.save()
    g.globalAlpha = 0.18
    g.translate(0, floor * 2)
    g.scale(1, -1)
    g.drawImage(wall, 0, 0, W * dpr, floor * dpr, 0, 0, W, floor)
    g.restore()
    g.save()
    g.setTransform(1, 0, 0, 1, 0, 0)
    g.globalAlpha = 0.5
    g.drawImage(grainTexture(Math.ceil(W * dpr), Math.ceil(H * dpr), 77), 0, 0)
    g.restore()
    // un velo oscuro para que la ficha se lea encima
    g.fillStyle = 'rgba(8, 10, 14, 0.38)'
    g.fillRect(0, 0, W, H)

    rills = Array.from({ length: Math.max(6, Math.round(W / 120)) }, () => newRill(true))
    rings = []
  }

  function newRill(scatter) {
    const y = scatter ? r() * floor * 0.8 : -10
    return {
      x: r() * W,
      y0: y,
      y,
      v: 22 + r() * 40,
      w: 1.4 + r() * 1.4,
      wob: r() * 6,
      len: 70 + r() * 110, // largo de la estela
      end: floor * (0.5 + r() * 0.45),
      fade: 1,
    }
  }

  const wander = (rl, y) => rl.x + Math.sin(y * 0.03 + rl.wob) * 3

  return {
    resize(w, h, d) {
      W = w
      H = h
      dpr = d
      build()
    },
    draw(ctx, now) {
      if (!wall) return
      const t = (now - t0) / 1000
      const dt = cl(t - last, 0, 0.1)
      last = t
      const A = ctx.globalAlpha
      ctx.save()
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.drawImage(wall, 0, 0)
      ctx.restore()

      // los regueros: una gota baja y deja una estela mojada que se seca
      // enseguida; al llegar abajo se apaga y empieza otra arriba
      ctx.lineCap = 'round'
      for (const rl of rills) {
        rl.y += rl.v * dt * (0.6 + 0.4 * Math.sin(t * 2 + rl.wob))
        if (rl.y > rl.end) rl.fade -= dt * 1.5
        if (rl.fade <= 0) {
          Object.assign(rl, newRill(false))
          continue
        }
        const top = Math.max(rl.y0, rl.y - rl.len)
        if (rl.y - top < 2) continue
        const steps = 10
        const path = new Path2D()
        for (let i = 0; i <= steps; i++) {
          const y = top + ((rl.y - top) * i) / steps
          if (i) path.lineTo(wander(rl, y), y)
          else path.moveTo(wander(rl, y), y)
        }
        // la pintura mojada, un poco más oscura, y encima el brillo del agua
        const dark = ctx.createLinearGradient(0, top, 0, rl.y)
        dark.addColorStop(0, 'rgba(20, 8, 2, 0)')
        dark.addColorStop(1, `rgba(20, 8, 2, ${0.22 * rl.fade})`)
        ctx.strokeStyle = dark
        ctx.lineWidth = rl.w * 2.4
        ctx.globalAlpha = A
        ctx.stroke(path)
        const shine = ctx.createLinearGradient(0, top, 0, rl.y)
        shine.addColorStop(0, 'rgba(210, 232, 245, 0)')
        shine.addColorStop(1, `rgba(210, 232, 245, ${0.32 * rl.fade})`)
        ctx.strokeStyle = shine
        ctx.lineWidth = Math.max(0.8, rl.w * 0.5)
        ctx.stroke(path)
        // la gota que va delante
        ctx.fillStyle = `rgba(225, 240, 255, ${0.6 * rl.fade})`
        ctx.beginPath()
        ctx.arc(wander(rl, rl.y), rl.y, rl.w * 0.9, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = A

      // anillos en el charco
      if (r() < dt * 14) rings.push({ x: r() * W, y: floor + 6 + r() * (H - floor - 8), t: t })
      ctx.strokeStyle = 'rgba(200, 225, 240, 1)'
      ctx.lineWidth = 1
      rings = rings.filter((g) => {
        const age = t - g.t
        if (age > 1.4) return false
        ctx.globalAlpha = A * 0.45 * (1 - age / 1.4)
        ctx.beginPath()
        ctx.ellipse(g.x, g.y, 4 + age * 26, (4 + age * 26) * 0.28, 0, 0, Math.PI * 2)
        ctx.stroke()
        return true
      })
      ctx.globalAlpha = A
    },
    dispose() {},
  }
}
