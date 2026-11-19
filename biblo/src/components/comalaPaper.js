// Ambiente de la ficha de "Pedro Páramo": el papel crema de la portada, donde
// una plumilla invisible va grabando motivos de Comala (el pueblo en su loma,
// un huizache, las cruces, un perro, el sol, unos órganos). Cada dibujo
// aparece trazo a trazo (primero el contorno, luego el rayado), se queda un
// rato y se desvanece, como si la tinta se secara y el papel la absorbiera.
// Van muy tenues para que la ficha se lea encima.

import {
  INK,
  rng,
  cl,
  span,
  makeCanvas,
  paintPaper,
  groundStrokes,
  dogShape,
  drawDog,
  dogTexture,
  etching,
  huizache,
  organo,
  cruz,
  comala,
  sol,
  calor,
} from './comalaInk'

const LIFE = 15 // segundos que vive cada dibujo
const EVERY = 4.6 // cada cuánto empieza uno nuevo
const ALPHA = 0.24

const outCubic = (x) => 1 - (1 - cl(x)) ** 3

// cada motivo: tamaño (en su escala) y cómo se dibuja; la base queda abajo
const MOTIFS = [
  {
    w: 640,
    h: 230,
    paint: (E) => {
      calor(E, 30, 610, 70, 2, 3)
      comala(E, 80, 200, 470, 0.95, 31)
      groundStrokes(E.g, 0, 640, 202, 230, 32, 0.8)
    },
  },
  {
    w: 260,
    h: 220,
    paint: (E) => {
      huizache(E, 130, 200, 1.5, 41)
      groundStrokes(E.g, 10, 250, 198, 220, 42, 1)
    },
  },
  {
    w: 320,
    h: 150,
    paint: (E) => {
      for (let i = 0; i < 3; i++) cruz(E, 70 + i * 90, 130 + (i % 2) * 8, 1.35, 51 + i)
      groundStrokes(E.g, 10, 310, 126, 150, 54, 0.9)
    },
  },
  {
    w: 480,
    h: 290,
    dog: true,
  },
  {
    w: 280,
    h: 280,
    paint: (E) => {
      sol(E, 140, 120, 52, 61)
      calor(E, 10, 270, 250, 3, 62)
    },
  },
  {
    w: 230,
    h: 230,
    paint: (E) => {
      organo(E, 80, 212, 1.3, 71)
      organo(E, 160, 214, 1, 72)
      groundStrokes(E.g, 10, 220, 208, 230, 73, 1)
    },
  },
]

// dónde pueden aparecer (centro, en fracciones de la pantalla): por los
// márgenes de la ficha (encima y debajo de la portada, las esquinas), lejos
// del título
const SLOTS = [
  [0.15, 0.17],
  [0.13, 0.87],
  [0.38, 0.95],
  [0.85, 0.92],
  [0.9, 0.24],
  [0.32, 0.52],
]

export function createComalaPaper() {
  const t0 = performance.now()
  const r = rng(1955)
  let W = 1
  let H = 1
  let dpr = 1
  let paper = null
  let art = []
  let unit = 1
  const live = [] // { m, slot, born, flip }
  let next = 0.3

  function build() {
    paper = makeCanvas(W * dpr, H * dpr)
    paintPaper(paper.getContext('2d'), paper.width, paper.height, 1955)
    unit = Math.min(1.2, Math.max(0.55, Math.min(W, H) / 820))
    const k = unit * dpr
    art = MOTIFS.map((m, i) => {
      const hatchC = makeCanvas(m.w * k, m.h * k)
      const g = hatchC.getContext('2d')
      g.scale(k, k)
      let linesC = null
      if (m.dog) {
        drawDog(g, dogShape(0.27), 250, m.h - 12, 0.95, dogTexture(k * 0.95, 70 + i), { unit: 1 / k })
      } else {
        const E = etching(g)
        m.paint(E)
        linesC = makeCanvas(m.w * k, m.h * k)
        const lg = linesC.getContext('2d')
        lg.scale(k, k)
        lg.strokeStyle = INK
        lg.lineWidth = 1.1
        lg.lineCap = 'round'
        lg.lineJoin = 'round'
        lg.stroke(E.lines)
      }
      return { m, hatchC, linesC }
    })
  }

  function spawn(t) {
    const used = new Set(live.map((d) => d.slot))
    const free = SLOTS.map((_, i) => i).filter((i) => !used.has(i))
    if (!free.length) return
    const slot = free[Math.floor(r() * free.length)]
    const busy = new Set(live.map((d) => d.m))
    let m = Math.floor(r() * art.length)
    for (let k = 0; k < art.length && busy.has(m); k++) m = (m + 1) % art.length
    live.push({ m, slot, born: t, flip: r() < 0.5 ? -1 : 1 })
  }

  return {
    resize(w, h, d) {
      W = w
      H = h
      dpr = d
      build()
    },
    draw(ctx, now, px, py) {
      if (!paper) return
      const t = (now - t0) / 1000
      const A = ctx.globalAlpha
      ctx.save()
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.drawImage(paper, 0, 0)
      ctx.restore()

      // si la pestaña estuvo en segundo plano, no se acumulan dibujos atrasados
      if (t - next > EVERY) next = t
      while (t >= next) {
        spawn(next)
        next += EVERY
      }
      for (let i = live.length - 1; i >= 0; i--) if (t - live[i].born > LIFE) live.splice(i, 1)

      for (const d of live) {
        const { m, hatchC, linesC } = art[d.m]
        const age = t - d.born
        const fade = cl(age / 0.4) * (1 - span(age, [LIFE - 4, LIFE]))
        if (fade <= 0) continue
        const w = m.w * unit
        const h = m.h * unit
        // un poco de paralaje con el cursor
        const x = SLOTS[d.slot][0] * W - w / 2 + px * 8
        const y = SLOTS[d.slot][1] * H - h / 2 + py * 5
        const flip = m.dog ? d.flip : 1
        const reveal = [
          [linesC, outCubic(span(age, [0, 2.6])), 1],
          [hatchC, outCubic(span(age, m.dog ? [0.2, 3.2] : [1.1, 4.4])), 0.9],
        ]
        for (const [img, p, a] of reveal) {
          if (!img || p <= 0) continue
          ctx.save()
          // la plumilla avanza de izquierda a derecha (o al revés si el perro mira al otro lado)
          ctx.beginPath()
          const edge = w * p
          const slant = h * 0.25
          if (flip > 0) {
            ctx.moveTo(x - slant, y)
            ctx.lineTo(x + edge, y)
            ctx.lineTo(x + edge - slant, y + h)
            ctx.lineTo(x - slant, y + h)
          } else {
            ctx.moveTo(x + w + slant, y)
            ctx.lineTo(x + w - edge, y)
            ctx.lineTo(x + w - edge + slant, y + h)
            ctx.lineTo(x + w + slant, y + h)
          }
          ctx.closePath()
          ctx.clip()
          ctx.globalAlpha = A * ALPHA * a * fade
          if (flip < 0) {
            ctx.translate(x + w, y)
            ctx.scale(-1, 1)
            ctx.drawImage(img, 0, 0, w, h)
          } else ctx.drawImage(img, x, y, w, h)
          ctx.restore()
        }
      }
      ctx.globalAlpha = A
    },
    dispose() {},
  }
}
