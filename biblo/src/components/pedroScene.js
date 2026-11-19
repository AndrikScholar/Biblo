// Entrada de "Pedro Páramo" (8,8 s, sin música): los dos perros de la
// portada cruzan la hoja en blanco y el paisaje se va grabando a plumilla
// detrás de ellos, hasta llegar a Comala.
//   0-0,9     papel en blanco; la plumilla traza la línea del suelo
//   0,35-5,4  entran los perros y la cámara los sigue de lado; detrás de
//             ellos aparecen, primero el contorno y luego el rayado, el
//             llano, los cerros, huizaches, órganos y cruces
//   5,4-6,5   el grabado se adelanta hasta Comala y los perros se frenan
//             hasta quedarse quietos en mitad del salto, ya hechos tinta
//   5,9-7,9   la cámara se aleja: queda una lámina con su marco, como la
//             portada, y el título arriba y abajo (lo pone PedroDogs.jsx)
// Todo es tinta sobre papel crema (comalaInk.js). Unidades virtuales: el
// alto de la pantalla mide 1000.

import {
  INK,
  TAU,
  rng,
  mix,
  cl,
  span,
  smooth,
  makeCanvas,
  paintPaper,
  groundStrokes,
  dogShape,
  drawDog,
  dogTexture,
  etching,
  hills,
  huizache,
  organo,
  cruz,
  piedra,
  comala,
  sol,
  calor,
} from './comalaInk'

export const T = {
  pen: [0.05, 0.9],
  enter: 0.35,
  slow: [5.4, 6.5],
  reveal: [5.3, 6.6],
  pull: [5.9, 7.9],
  frame: [6.2, 7.4],
  titleIn: 6.7,
  end: 8.8,
}

const CYCLE = 0.46 // un galope, en segundos
const STRIDE = 300 // lo que avanza el perro en un galope (a escala 1)
const G = 560 // línea del suelo (el horizonte del llano)
const LANE = 880 // donde pisan los perros: las cabezas quedan bajo el horizonte

const easeInOut = (x) => smooth(x)
const outCubic = (x) => 1 - (1 - cl(x)) ** 3

export function createPedroScene(canvas) {
  const ctx = canvas.getContext('2d')
  let W = 1
  let H = 1
  let dpr = 1
  let V = 1
  let VW = 1000
  let K = 1
  const S = {}

  function resize() {
    const r = canvas.getBoundingClientRect()
    W = Math.max(1, r.width)
    H = Math.max(1, r.height)
    dpr = Math.min(window.devicePixelRatio || 1, 1.25)
    canvas.width = Math.round(W * dpr)
    canvas.height = Math.round(H * dpr)
    V = H / 1000
    VW = W / V
    K = Math.min(V * dpr, 1.35)
    build()
  }

  // velocidad de los perros: plena hasta T.slow y luego se frena hasta 0
  const speedAt = (t) => (t < T.enter ? 0 : 1 - smooth(span(t, T.slow)))

  function build() {
    S.s = Math.min(1.3, VW / 640)
    S.v = (STRIDE * S.s) / CYCLE
    // recorrido acumulado, tabulado a 240 Hz
    const dt = 1 / 240
    S.dist = [0]
    for (let t = dt; t <= T.end + dt; t += dt) S.dist.push(S.dist[S.dist.length - 1] + S.v * speedAt(t) * dt)
    S.total = S.dist[S.dist.length - 1]
    // la fase se ajusta para que se queden quietos en pleno salto, estirados
    S.phase0 = 0.25 - ((S.total / (STRIDE * S.s)) % 1)
    S.x0 = -460 * S.s
    S.xEnd = S.x0 + S.total
    // la lámina final: los perros en el centro y Comala detrás, a la derecha
    // en pantallas altas (móvil) la lámina es más vertical, como la portada
    S.tall = VW < 760
    S.plate = { cx: S.xEnd + 60 * S.s, cy: 600, w: S.tall ? 820 : 1200, h: S.tall ? 760 : 700 }
    S.zEnd = Math.min(0.72, (VW * 0.9) / S.plate.w, 520 / S.plate.h)
    S.camEnd = S.xEnd - 0.45 * VW
    S.worldL = -VW * 0.2
    S.worldR = Math.max(S.camEnd + VW * 1.15, S.plate.cx + S.plate.w / 2) + 40

    // papel (pantalla)
    S.paper = makeCanvas(W * dpr, H * dpr)
    paintPaper(S.paper.getContext('2d'), S.paper.width, S.paper.height, 1955)

    // el grabado del mundo: rayado en un lienzo, contornos en un Path2D
    const ww = S.worldR - S.worldL
    S.hatch = makeCanvas(ww * K, 1000 * K)
    const g = S.hatch.getContext('2d')
    g.scale(K, K)
    g.translate(-S.worldL, 0)
    const E = etching(g)
    paintWorld(E)
    S.lines = E.lines
    S.dogTex = dogTexture(S.s * K * 1.1)
    S.dust = []
    S.lastT = 0
    S.jag = Array.from({ length: 60 }, (_, i) => rng(500 + i)())
  }

  function paintWorld(E) {
    const r = rng(1955)
    const L = S.worldL
    const R = S.worldR
    const town = S.plate.cx + (S.tall ? 40 : 170)
    // cerros lejanos y una segunda fila más cerca
    hills(E, L, R, G - 120, G, 70, 11, 0.3)
    hills(E, L, R, G - 50, G, 34, 12, 0.18)
    calor(E, L, R, G - 150, 3, 13)
    // el llano: tierra rayada, más oscura hacia abajo, con el camino más claro
    groundStrokes(E.g, L, R, G, 1000, 14, 1.45)
    // matas de zacate seco por el llano
    for (let i = 0; i < (R - L) / 45; i++) {
      const tx = L + r() * (R - L)
      const ty = G + 30 + Math.pow(r(), 0.6) * 400
      const k = 0.6 + ((ty - G) / 440) * 1.2
      for (let j = 0; j < 4; j++) {
        const a = -Math.PI / 2 + (j - 1.5) * 0.35 + (r() - 0.5) * 0.2
        E.lines.moveTo(tx + (j - 1.5) * 2 * k, ty)
        E.lines.lineTo(tx + Math.cos(a) * 12 * k, ty + Math.sin(a) * 12 * k)
      }
    }
    E.lines.moveTo(L, G)
    E.lines.lineTo(R, G)
    // a lo largo del camino: huizaches, órganos, piedras, postes y cruces
    let x = 120
    while (x < S.plate.cx - S.plate.w / 2 - 40) {
      const k = r()
      if (k < 0.34) huizache(E, x, G + 18 + r() * 40, 0.8 + r() * 0.45, Math.floor(r() * 1e6))
      else if (k < 0.58) organo(E, x, G + 24 + r() * 50, 0.7 + r() * 0.4, Math.floor(r() * 1e6))
      else if (k < 0.78) piedra(E, x, 900 + r() * 80, 1.2 + r() * 1.3, Math.floor(r() * 1e6))
      else {
        // un poste de cerca con su alambre caído
        const y = G + 40 + r() * 30
        for (let j = 0; j < 3; j++) {
          const px = x + j * 70
          E.lines.moveTo(px, y)
          E.lines.lineTo(px + 2, y - 46)
          if (j) {
            E.lines.moveTo(px - 70, y - 38)
            E.lines.quadraticCurveTo(px - 35, y - 28, px, y - 38)
          }
        }
      }
      x += 110 + r() * 200
    }
    // las cruces del camposanto, ya cerca del pueblo
    // las cruces del camposanto, a la entrada del pueblo (quedan detrás de los perros)
    for (let i = 0; i < 7; i++) cruz(E, S.plate.cx - 560 + i * 62 + r() * 20, G + 20 + r() * 26, 0.95 + r() * 0.35, 300 + i)
    huizache(E, S.plate.cx - 600, G + 30, 1.1, 401)
    organo(E, S.plate.cx + 540, G + 60, 0.9, 402)
    comala(E, town, G + 6, S.tall ? 330 : 360, 1, 77)
    sol(E, S.plate.cx + S.plate.w * 0.34, S.plate.cy - S.plate.h * 0.36, 34, 21)
  }

  // zopilotes: planean en círculos (en el mundo) con algún aleteo
  function zopilotes(t, unit) {
    const P = S.plate
    const birds = [
      [P.cx + 300, G - 230, 70, 0.55, 0],
      [P.cx + 380, G - 280, 95, -0.42, 2],
      [P.cx + 210, G - 300, 55, 0.7, 4],
      [P.cx - 1400, G - 260, 80, 0.5, 1],
      [P.cx - 2500, G - 300, 90, -0.45, 3],
    ]
    ctx.save()
    ctx.strokeStyle = INK
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = 1.7 * unit
    ctx.globalAlpha = 0.85
    for (const [bx, by, rad, w, ph] of birds) {
      const a = ph + t * w
      const x = bx + Math.cos(a) * rad
      const y = by + Math.sin(a) * rad * 0.35
      const flap = Math.max(0, Math.sin(t * 7 + ph * 3)) ** 3 * 5
      const span = 15
      ctx.beginPath()
      ctx.moveTo(x - span, y - 3 + flap)
      ctx.quadraticCurveTo(x - span * 0.45, y - 7 - flap, x, y)
      ctx.quadraticCurveTo(x + span * 0.45, y - 7 - flap, x + span, y - 3 + flap)
      ctx.stroke()
    }
    ctx.restore()
  }

  // ---------- tiempo → posición ----------

  function distAt(t) {
    const i = cl(t * 240, 0, S.dist.length - 1)
    const i0 = Math.floor(i)
    return mix(S.dist[i0], S.dist[Math.min(i0 + 1, S.dist.length - 1)], i - i0)
  }

  function camAt(t) {
    const dogX = S.x0 + distAt(t)
    // la cámara espera quieta hasta que los perros llegan al 45 % de la pantalla
    const follow = dogX - 0.45 * VW
    const soft = 140
    const left = follow > soft ? follow : soft * Math.exp((follow - soft) / soft) // arranque suave
    const pull = easeInOut(span(t, T.pull))
    const z = mix(1, S.zEnd, pull)
    const cx = mix(left + VW / 2, S.plate.cx, pull)
    const cy = mix(500, S.plate.cy, pull)
    return { cx, cy, z, dogX }
  }

  // hasta dónde llega el grabado (x del mundo)
  function fronts(t, dogX) {
    const reveal = outCubic(span(t, T.reveal))
    const lineF = mix(dogX - 20 * S.s, S.worldR, reveal)
    const hatchF = mix(dogX - 170 * S.s, S.worldR, outCubic(span(t, [T.reveal[0] + 0.25, T.reveal[1] + 0.3])))
    const pen = outCubic(span(t, T.pen))
    const ground = Math.max(mix(S.worldL, VW * 1.1, pen), dogX + VW * 0.75, lineF)
    return { lineF, hatchF, ground }
  }

  // recorte con el borde dentado de un trazo a medio grabar
  function frontClip(x) {
    const p = new Path2D()
    p.moveTo(S.worldL - 10, -50)
    for (let i = 0; i < S.jag.length; i++) {
      const y = -50 + (i / (S.jag.length - 1)) * 1100
      p.lineTo(x + (S.jag[i] - 0.5) * 80 + Math.sin(i * 1.3) * 18, y)
    }
    p.lineTo(S.worldL - 10, 1050)
    p.closePath()
    return p
  }

  // trazos sueltos recién hechos justo en el frente del grabado
  function freshStrokes(x, unit) {
    ctx.save()
    ctx.strokeStyle = INK
    ctx.lineCap = 'round'
    ctx.lineWidth = 0.9 * unit
    const b0 = Math.floor((x - 220) / 40)
    for (let b = b0; b <= b0 + 6; b++) {
      const r = rng(9000 + b)
      const bx = b * 40
      const fade = cl(1 - (x - bx) / 220)
      if (fade <= 0) continue
      for (let i = 0; i < 5; i++) {
        const sx = bx + r() * 40
        const sy = G + 10 + Math.pow(r(), 0.7) * 380
        const l = 14 + r() * 34
        ctx.globalAlpha = fade * 0.75
        ctx.beginPath()
        ctx.moveTo(sx, sy)
        ctx.lineTo(sx + l, sy + l * (0.2 + r() * 0.3))
        ctx.stroke()
      }
    }
    ctx.restore()
  }

  function frame(t) {
    const dt = cl(t - S.lastT, 0, 0.1)
    S.lastT = t
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.globalAlpha = 1
    ctx.drawImage(S.paper, 0, 0)

    const cam = camAt(t)
    const F = fronts(t, cam.dogX)
    const sc = V * dpr * cam.z
    ctx.setTransform(sc, 0, 0, sc, (W * dpr) / 2 - cam.cx * sc, (H * dpr) / 2 - cam.cy * sc)
    const unit = 1 / sc // un pixel de pantalla, en unidades del mundo
    const viewL = cam.cx - VW / 2 / cam.z
    const viewW = VW / cam.z
    const viewT = cam.cy - 500 / cam.z
    const viewH = 1000 / cam.z

    // al alejarse, el mundo se recorta a la lámina
    const P = S.plate
    const fr = smooth(span(t, T.pull))
    ctx.save()
    if (fr > 0) {
      const big = 2.4
      const w = mix(P.w * big * 2, P.w, fr)
      const h = mix(P.h * big * 2, P.h, fr)
      ctx.beginPath()
      ctx.rect(P.cx - w / 2, P.cy - h / 2, w, h)
      ctx.clip()
    }

    // rayado
    ctx.save()
    ctx.clip(frontClip(F.hatchF))
    const sx = Math.max(0, (viewL - S.worldL) * K)
    const sw = Math.min(S.hatch.width - sx, viewW * K)
    const sy = Math.max(0, viewT * K)
    const sh = Math.min(S.hatch.height - sy, viewH * K)
    if (sw > 0 && sh > 0) ctx.drawImage(S.hatch, sx, sy, sw, sh, S.worldL + sx / K, sy / K, sw / K, sh / K)
    ctx.restore()

    // contornos
    ctx.save()
    ctx.clip(frontClip(F.lineF))
    ctx.strokeStyle = INK
    ctx.lineWidth = 1.15 * unit
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.globalAlpha = 0.88
    ctx.stroke(S.lines)
    ctx.restore()

    // la línea del suelo que traza la plumilla al principio
    ctx.save()
    ctx.strokeStyle = INK
    ctx.lineWidth = 1.4 * unit
    ctx.globalAlpha = 0.9
    ctx.beginPath()
    ctx.moveTo(S.worldL, G)
    ctx.lineTo(F.ground, G)
    ctx.stroke()
    ctx.restore()
    if (t < T.reveal[1]) freshStrokes(F.hatchF, unit)
    zopilotes(t, unit)

    // polvo, sombras y los perros
    const run = speedAt(t)
    const dogs = [
      { x: cam.dogX, y: LANE - 40 * S.s, s: S.s, ph: 0, seed: 1 },
      { x: cam.dogX + 150 * S.s, y: LANE + 30 * S.s, s: S.s * 0.97, ph: 0.12, seed: 2 },
    ]
    const ph = S.phase0 + distAt(t) / (STRIDE * S.s)
    for (const d of dogs) {
      d.shape = dogShape(((ph + d.ph) % 1 + 1) % 1)
      // sombra rayada sobre la tierra
      const sh = 1 - Math.max(0, d.shape.bob) / 30
      ctx.save()
      ctx.globalAlpha = 0.22 * sh
      ctx.fillStyle = INK
      ctx.beginPath()
      ctx.ellipse(d.x - 20 * d.s, d.y + 6 * d.s, 150 * d.s * sh, 9 * d.s, 0, 0, TAU)
      ctx.fill()
      ctx.restore()
      // polvo que levantan las patas al apoyar
      if (run > 0.05 && t > T.enter) {
        const r = rng(Math.floor(t * 60) * 7 + d.seed)
        for (const [px, py] of d.shape.paws) {
          if (py < 84) continue
          for (let i = 0; i < 3; i++) {
            S.dust.push({
              x: d.x + px * d.s + (r() - 0.5) * 20,
              y: d.y + (r() - 0.5) * 8,
              vx: -(40 + r() * 120) * run,
              vy: -(10 + r() * 40),
              life: 0.7 + r() * 0.6,
              age: 0,
              r: 0.9 + r() * 1.4,
            })
          }
        }
      }
    }
    ctx.fillStyle = INK
    S.dust = S.dust.filter((p) => {
      p.age += dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vy += 30 * dt
      const a = 1 - p.age / p.life
      if (a <= 0) return false
      ctx.globalAlpha = a * 0.55
      ctx.fillRect(p.x, p.y, p.r * unit * 1.6, p.r * unit * 1.6)
      return true
    })
    ctx.globalAlpha = 1
    for (const d of dogs) drawDog(ctx, d.shape, d.x, d.y, d.s, S.dogTex, { unit })
    ctx.restore()

    // el marco de la lámina, trazado a mano alrededor
    const fm = span(t, T.frame)
    if (fm > 0) {
      ctx.save()
      ctx.strokeStyle = INK
      ctx.lineCap = 'square'
      for (const [pad, w, a] of [[0, 1.4, 0.9], [14, 0.8, 0.55]]) {
        const x0 = P.cx - P.w / 2 - pad
        const y0 = P.cy - P.h / 2 - pad
        const pw = P.w + pad * 2
        const phh = P.h + pad * 2
        const per = 2 * (pw + phh)
        ctx.lineWidth = w * unit
        ctx.globalAlpha = a
        ctx.setLineDash([per * outCubic(fm), per])
        ctx.beginPath()
        ctx.moveTo(x0, y0)
        ctx.lineTo(x0 + pw, y0)
        ctx.lineTo(x0 + pw, y0 + phh)
        ctx.lineTo(x0, y0 + phh)
        ctx.closePath()
        ctx.stroke()
      }
      ctx.restore()
    }
  }

  resize()
  return { frame, resize }
}
