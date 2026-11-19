// Pedro Páramo: el grabado a plumilla de su portada (tinta negra rayada sobre
// papel crema). Lo comparten la entrada (pedroScene.js), el ambiente de la
// ficha (comalaPaper.js) y el perro que cruza los bordes (ComalaDog.jsx).
//
// Un dibujo se reparte en dos capas, como en un grabado de verdad: los
// contornos (`E.lines`, un Path2D que se traza al vuelo) y el rayado, que se
// pinta una sola vez en un lienzo aparte (`E.g`). Así cada capa se puede ir
// descubriendo por separado, como si la plumilla la estuviera grabando.

export const INK = '#1e1a15'
export const PAPER = '#efe7d3'
export const TAU = Math.PI * 2

export function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const mix = (a, b, f) => a + (b - a) * f
export const cl = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x))
export const span = (t, [a, b]) => cl((t - a) / (b - a))
export const smooth = (x) => {
  x = cl(x)
  return x * x * (3 - 2 * x)
}

export function makeCanvas(w, h) {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.ceil(w))
  c.height = Math.max(1, Math.ceil(h))
  return c
}

// ---------- el papel ----------

// crema con grano, alguna fibra y los bordes un poco tostados
export function paintPaper(g, w, h, seed) {
  const r = rng(seed)
  g.fillStyle = PAPER
  g.fillRect(0, 0, w, h)
  const grain = Math.round((w * h) / 110)
  for (let i = 0; i < grain; i++) {
    g.fillStyle = `rgba(74, 54, 30, ${r() * 0.055})`
    g.fillRect(r() * w, r() * h, 1 + r() * 1.3, 1 + r() * 1.3)
  }
  g.lineCap = 'round'
  for (let i = 0; i < (w * h) / 14000; i++) {
    const x = r() * w
    const y = r() * h
    const a = r() * TAU
    const l = 6 + r() * 16
    g.strokeStyle = `rgba(90, 66, 38, ${0.04 + r() * 0.05})`
    g.lineWidth = 0.6
    g.beginPath()
    g.moveTo(x, y)
    g.quadraticCurveTo(x + Math.cos(a + 0.6) * l * 0.5, y + Math.sin(a + 0.6) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l)
    g.stroke()
  }
  const v = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) * 0.58)
  v.addColorStop(0, 'rgba(120, 86, 40, 0)')
  v.addColorStop(1, 'rgba(120, 86, 40, 0.16)')
  g.fillStyle = v
  g.fillRect(0, 0, w, h)
}

// ---------- el rayado ----------

// Líneas paralelas temblorosas dentro de `path`. Con más tono, más capas
// cruzadas y más juntas (así se oscurece un grabado). `bend` curva un poco
// las líneas para que sigan el volumen. `box` limita el trabajo al recuadro
// de la figura.
export function hatch(g, path, { tone = 0.5, angle = -0.6, seed = 1, box, weight = 1, bend = 0, alpha = 1 }) {
  const r = rng(seed)
  const [x0, y0, x1, y1] = box
  const cx = (x0 + x1) / 2
  const cy = (y0 + y1) / 2
  const L = Math.hypot(x1 - x0, y1 - y0) / 2 + 6
  const layers = tone < 0.28 ? 1 : tone < 0.56 ? 2 : tone < 0.8 ? 3 : 4
  const gap = 9.5 - tone * 6.8
  g.save()
  g.clip(path)
  g.strokeStyle = INK
  g.lineCap = 'round'
  for (let k = 0; k < layers; k++) {
    const a = angle + k * 1.05 + (r() - 0.5) * 0.08
    const dx = Math.cos(a)
    const dy = Math.sin(a)
    const nx = -dy
    const ny = dx
    for (let s = -L; s < L; s += gap * (0.8 + r() * 0.4)) {
      g.globalAlpha = alpha * (0.5 + r() * 0.45)
      g.lineWidth = (0.55 + r() * 0.6) * weight
      g.beginPath()
      const steps = Math.max(3, Math.round((2 * L) / 40))
      for (let i = 0; i <= steps; i++) {
        const t = -L + (2 * L * i) / steps
        const j = (r() - 0.5) * 1.4 + Math.sin(t * 0.018 + s * 0.01) * bend
        const px = cx + nx * (s + j) + dx * t
        const py = cy + ny * (s + j) + dy * t
        if (i) g.lineTo(px, py)
        else g.moveTo(px, py)
      }
      g.stroke()
    }
  }
  g.restore()
}

// una textura rayada entera (para recortarla luego con la silueta del perro)
export function hatchTexture(w, h, scale, opts) {
  const c = makeCanvas(w * scale, h * scale)
  const g = c.getContext('2d')
  g.scale(scale, scale)
  const p = new Path2D()
  p.rect(0, 0, w, h)
  hatch(g, p, { ...opts, box: [0, 0, w, h] })
  return c
}

// trazos cortos de tierra: más tupidos (y más oscuros) hacia abajo
export function groundStrokes(g, x0, x1, y0, y1, seed, density = 1) {
  const r = rng(seed)
  const n = Math.round(((x1 - x0) * (y1 - y0) * density) / 320)
  g.save()
  g.strokeStyle = INK
  g.lineCap = 'round'
  for (let i = 0; i < n; i++) {
    const f = Math.pow(r(), 0.75)
    const y = y0 + f * (y1 - y0)
    if (r() > 0.25 + f * 0.75) continue
    const x = x0 + r() * (x1 - x0)
    const l = 8 + r() * 26 * (0.6 + f)
    const a = (r() - 0.5) * 0.25
    g.globalAlpha = 0.35 + f * 0.5
    g.lineWidth = 0.5 + r() * 0.6
    g.beginPath()
    g.moveTo(x, y)
    g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l)
    g.stroke()
  }
  g.restore()
}

// ---------- formas ----------

// Todas las piezas giran en el mismo sentido (horario en pantalla, como
// arc/ellipse por defecto): si no, al rellenar con la regla "nonzero" las
// piezas que se solapan en sentido contrario se restan y dejan huecos.
function clockwise(points) {
  let area = 0
  for (let i = 0; i < points.length; i++) {
    const [x0, y0] = points[i]
    const [x1, y1] = points[(i + 1) % points.length]
    area += x0 * y1 - x1 * y0
  }
  return area >= 0 ? points : [...points].reverse()
}

export function smoothPath(points, path = new Path2D()) {
  points = clockwise(points)
  const n = points.length
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
  const start = mid(points[n - 1], points[0])
  path.moveTo(start[0], start[1])
  for (let i = 0; i < n; i++) {
    const a = points[i]
    const m = mid(a, points[(i + 1) % n])
    path.quadraticCurveTo(a[0], a[1], m[0], m[1])
  }
  path.closePath()
  return path
}

export function polyPath(points, path = new Path2D()) {
  points = clockwise(points)
  points.forEach(([x, y], i) => (i ? path.lineTo(x, y) : path.moveTo(x, y)))
  path.closePath()
  return path
}

// elipse como pieza suelta: sin moveTo, el lienzo la uniría con una recta
// al último punto del trazado
export function oval(p, x, y, rx, ry, rot) {
  p.moveTo(x + rx * Math.cos(rot), y + rx * Math.sin(rot))
  p.ellipse(x, y, rx, ry, rot, 0, TAU)
}

// un hueso (pata, rama): cuadrilátero que adelgaza de w0 a w1, con la
// articulación redondeada
export function limb(p, [ax, ay], [bx, by], w0, w1) {
  const a = Math.atan2(by - ay, bx - ax)
  const nx = -Math.sin(a)
  const ny = Math.cos(a)
  polyPath(
    [
      [ax + nx * w0, ay + ny * w0],
      [bx + nx * w1, by + ny * w1],
      [bx - nx * w1, by - ny * w1],
      [ax - nx * w0, ay - ny * w0],
    ],
    p
  )
  p.moveTo(bx + w1, by)
  p.arc(bx, by, w1, 0, TAU)
}

// ---------- el perro ----------

// Perro flaco al galope, de perfil y mirando a la derecha, como los de la
// portada: pecho hondo, cintura recogida, orejas atrás, fauces abiertas y un
// rabo largo y fino que sube hacia atrás.
// p: fase del galope (0..1). En p = 0,25 va estirado (manos delante, patas
// atrás); en p = 0,75 recogido, con el lomo arqueado y las cuatro bajo el
// vientre. Coordenadas locales: el lomo en y ≈ -40 y las patas apoyadas en
// y ≈ DOG_FEET; mide unos 400 de la punta del hocico al anca.
export const DOG_BOX = [-250, -190, 205, 140] // x0, y0, x1, y1 de la textura
export const DOG_FEET = 112

export function dogShape(p) {
  const a = p * TAU
  const sa = Math.sin(a)
  const ca = Math.cos(a)
  const arch = -10 * sa // el lomo se arquea al recoger
  const P = new Path2D()
  // tronco: cruz alta, lomo, grupa, muslo, ijada recogida y pecho hondo
  smoothPath(
    [
      [72, -50],
      [40, -44],
      [-8, -40 - arch],
      [-60, -38 - arch * 0.8],
      [-100, -32 - arch * 0.3],
      [-122, -20],
      [-128, -2],
      [-116, 16],
      [-88, 10],
      [-56, 4 - arch * 0.4],
      [-14, 12],
      [26, 28],
      [58, 14],
      [74, -4],
      [94, -14],
    ],
    P
  )
  // cabeza con las fauces abiertas (se abren y cierran con la carrera)
  const jaw = 0.72 + 0.28 * Math.sin(a * 2)
  polyPath(
    [
      [66, -46],
      [96, -62],
      [120, -60],
      [160, -50],
      [178, -44],
      [175, -37],
      [132, -32],
      [164, -24 + 13 * jaw],
      [160, -17 + 12 * jaw],
      [124, -16],
      [96, -8],
      [74, -10],
    ],
    P
  )
  polyPath([[86, -58], [80, -96], [102, -62]], P)

  const paws = []
  // manos: van atrás apoyadas y, al volver hacia delante por el aire, el carpo
  // se dobla del todo; llegan estiradas al frente
  for (const [sx, sy, ph] of [[42, 4, 0], [30, 8, 0.42]]) {
    const th = 0.25 + 1.0 * Math.sin(a + ph)
    const fold = Math.max(0, Math.cos(a + ph))
    oval(P, sx - 4, sy - 6, 24, 17, -0.5 + th * 0.5) // espalda
    const k = [sx + 52 * Math.sin(th), sy + 52 * Math.cos(th)]
    const f2 = th - 1.9 * fold
    const f = [k[0] + 54 * Math.sin(f2), k[1] + 54 * Math.cos(f2)]
    limb(P, [sx, sy], k, 11, 6.5)
    limb(P, k, f, 6, 4.4)
    oval(P, f[0] + 4, f[1] + 1, 8, 4.5, 0.2)
    paws.push(f)
  }
  // patas: muslo ancho hacia delante, corvejón atrás, metatarso hacia delante;
  // al volver por el aire el corvejón se dobla
  for (const [hx, hy, ph] of [[-98, -4, 0], [-86, 4, 0.38]]) {
    const th = -0.2 - 1.0 * Math.sin(a + ph)
    const fold = Math.max(0, -Math.cos(a + ph))
    oval(P, hx + 4, hy + 4, 32, 21, 1.1 + th * 0.6) // anca
    const k1 = [hx + 50 * Math.sin(th + 0.35), hy + 50 * Math.cos(th + 0.35)]
    const g2 = th - 0.75 - 0.6 * fold
    const k2 = [k1[0] + 50 * Math.sin(g2), k1[1] + 50 * Math.cos(g2)]
    const g3 = th + 0.25 + 0.7 * fold
    const f = [k2[0] + 34 * Math.sin(g3), k2[1] + 34 * Math.cos(g3)]
    limb(P, [hx, hy], k1, 17, 9.5)
    limb(P, k1, k2, 9, 5.5)
    limb(P, k2, f, 5, 4.2)
    oval(P, f[0] + 4, f[1] + 1, 8, 4.5, 0.1)
    paws.push(f)
  }
  const tail = [
    [-118, -24],
    [-150 - 6 * ca, -46 + 8 * sa],
    [-186 + 8 * ca, -118 + 8 * sa],
  ]
  return {
    path: P,
    tail,
    eye: [116, -51],
    jaw,
    paws,
    bob: 10 * sa,
    pitch: 0.05 * ca,
  }
}

// Dibuja un perro en (x, y) = el sitio de sus patas apoyadas. `tex` es una
// textura rayada (dogTexture); `unit` es lo que mide un pixel en las
// coordenadas actuales, para que los trazos no engorden.
// El contorno sale de trazar la silueta gruesa y taparla por dentro con
// papel: así queda solo el borde de fuera, sin las uniones de los huesos.
export function drawDog(g, shape, x, y, s, tex, { flip = 1, unit = 1, alpha = 1 } = {}) {
  const [bx0, by0, bx1, by1] = DOG_BOX
  g.save()
  g.globalAlpha *= alpha
  g.translate(x, y - (DOG_FEET - shape.bob) * s)
  g.scale(s * flip, s)
  g.rotate(shape.pitch)
  const w = unit / s
  // rabo: un trazo largo que adelgaza hacia la punta
  const [p0, p1, p2] = shape.tail
  g.strokeStyle = INK
  g.lineCap = 'round'
  for (let i = 0; i < 4; i++) {
    g.lineWidth = Math.max(1.2 * w, 5 - i * 1.25)
    g.beginPath()
    g.moveTo(p0[0], p0[1])
    const f = 1 - i * 0.14
    g.quadraticCurveTo(p1[0], p1[1], mix(p1[0], p2[0], f), mix(p1[1], p2[1], f))
    g.stroke()
  }
  g.lineJoin = 'round'
  g.lineWidth = 2.6 * w
  g.stroke(shape.path)
  g.fillStyle = PAPER
  g.fill(shape.path)
  g.save()
  g.clip(shape.path)
  g.drawImage(tex, bx0, by0, bx1 - bx0, by1 - by0)
  g.restore()
  // dientes claros en la boca abierta y el ojo, como en la portada
  g.fillStyle = PAPER
  for (let i = 0; i < 4; i++) {
    const tx = 138 + i * 8
    const ty = -33.5 - i * 1.4
    g.beginPath()
    g.moveTo(tx, ty)
    g.lineTo(tx + 3.2, ty + 6)
    g.lineTo(tx + 6, ty - 0.5)
    g.closePath()
    g.fill()
  }
  const ly = -25 + 13 * shape.jaw
  for (let i = 0; i < 3; i++) {
    const tx = 136 + i * 8
    const ty = ly - 2 + i * 1.3
    g.beginPath()
    g.moveTo(tx, ty)
    g.lineTo(tx + 3, ty - 5.5)
    g.lineTo(tx + 6, ty)
    g.closePath()
    g.fill()
  }
  g.beginPath()
  g.arc(shape.eye[0], shape.eye[1], 4, 0, TAU)
  g.fill()
  g.restore()
}

export function dogTexture(scale, seed = 1955) {
  const [x0, y0, x1, y1] = DOG_BOX
  return hatchTexture(x1 - x0, y1 - y0, scale, { tone: 0.96, angle: -0.62, seed, bend: 2.2, weight: 1.3 })
}

// ---------- el paisaje de Comala ----------
// Cada elemento suma su contorno a E.lines y raya su relleno en E.g.

export function etching(g) {
  return { g, lines: new Path2D() }
}

function boxOf(points, pad = 4) {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const [x, y] of points) {
    x0 = Math.min(x0, x)
    y0 = Math.min(y0, y)
    x1 = Math.max(x1, x)
    y1 = Math.max(y1, y)
  }
  return [x0 - pad, y0 - pad, x1 + pad, y1 + pad]
}

// cerros: una cresta irregular rayada hacia abajo hasta `base`
export function hills(E, x0, x1, top, base, amp, seed, tone = 0.3) {
  const r = rng(seed)
  const ph = [r() * 9, r() * 9, r() * 9]
  const pts = []
  for (let x = x0; x <= x1 + 24; x += 24) {
    const y = top - amp * (0.55 * Math.sin(x * 0.0021 + ph[0]) + 0.3 * Math.sin(x * 0.0057 + ph[1]) + 0.15 * Math.sin(x * 0.017 + ph[2]))
    pts.push([x, y])
  }
  const fill = polyPath([...pts, [x1 + 24, base], [x0, base]])
  hatch(E.g, fill, { tone, angle: -0.32, seed, box: boxOf([...pts, [x0, base]]) })
  pts.forEach(([x, y], i) => (i ? E.lines.lineTo(x, y) : E.lines.moveTo(x, y)))
}

// huizache: tronco torcido y copa plana
export function huizache(E, x, y, s, seed) {
  const r = rng(seed)
  const P = new Path2D()
  const lean = (r() - 0.5) * 18
  limb(P, [x, y], [x + lean * s, y - 62 * s], 6 * s, 3 * s)
  limb(P, [x + lean * 0.6 * s, y - 38 * s], [x - 34 * s, y - 70 * s], 3 * s, 1.5 * s)
  limb(P, [x + lean * 0.8 * s, y - 50 * s], [x + 30 * s, y - 74 * s], 2.6 * s, 1.4 * s)
  const crown = []
  const cw = (52 + r() * 22) * s
  const ch = (15 + r() * 6) * s
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU
    const k = 0.85 + r() * 0.3
    crown.push([x + lean * s + Math.cos(a) * cw * k, y - 80 * s + Math.sin(a) * ch * k - (Math.sin(a) < 0 ? 4 * s : 0)])
  }
  smoothPath(crown, P)
  hatch(E.g, P, { tone: 0.78, angle: -0.7, seed, box: [x - 90 * s, y - 110 * s, x + 90 * s, y + 4] })
  E.lines.addPath(P)
}

// órgano: columnas de cactus con costillas
export function organo(E, x, y, s, seed) {
  const r = rng(seed)
  const P = new Path2D()
  const n = 3 + Math.floor(r() * 3)
  const ribs = new Path2D()
  for (let i = 0; i < n; i++) {
    const cx = x + (i - (n - 1) / 2) * 13 * s + (r() - 0.5) * 4 * s
    const h = (60 + r() * 55) * s
    const w = 5.5 * s
    P.moveTo(cx - w, y)
    P.lineTo(cx - w, y - h)
    P.arc(cx, y - h, w, Math.PI, 0)
    P.lineTo(cx + w, y)
    P.closePath()
    ribs.moveTo(cx, y)
    ribs.lineTo(cx, y - h - w * 0.6)
  }
  hatch(E.g, P, { tone: 0.55, angle: 1.45, seed, box: [x - 60 * s, y - 130 * s, x + 60 * s, y + 2] })
  E.lines.addPath(P)
  E.lines.addPath(ribs)
}

// cruz de palo clavada en un montículo
export function cruz(E, x, y, s, seed) {
  const r = rng(seed)
  const tilt = (r() - 0.5) * 0.18
  const P = new Path2D()
  const c = Math.cos(tilt)
  const sn = Math.sin(tilt)
  const R = ([px, py]) => [x + px * c - py * sn, y + px * sn + py * c]
  polyPath([[-2.5, 0], [2.5, 0], [2.5, -40], [-2.5, -40]].map(([a, b]) => R([a * s, b * s])), P)
  polyPath([[-13, -30], [13, -30], [13, -25], [-13, -25]].map(([a, b]) => R([a * s, b * s])), P)
  const mound = new Path2D()
  mound.ellipse(x, y + 1, 20 * s, 5 * s, 0, Math.PI, TAU)
  mound.closePath()
  hatch(E.g, P, { tone: 0.82, angle: 0.9, seed, box: [x - 16 * s, y - 44 * s, x + 16 * s, y + 2] })
  hatch(E.g, mound, { tone: 0.45, angle: -0.3, seed: seed + 1, box: [x - 22 * s, y - 6 * s, x + 22 * s, y + 2] })
  E.lines.addPath(P)
  E.lines.addPath(mound)
}

export function piedra(E, x, y, s, seed) {
  const r = rng(seed)
  const pts = []
  for (let i = 0; i < 9; i++) {
    const a = Math.PI + (i / 8) * Math.PI
    const k = 0.75 + r() * 0.4
    pts.push([x + Math.cos(a) * 26 * s * k, y + Math.sin(a) * 14 * s * k])
  }
  const P = smoothPath(pts)
  hatch(E.g, P, { tone: 0.72, angle: -0.5, seed, box: boxOf(pts) })
  E.lines.addPath(P)
}

// casa de adobe: muro claro, tejado rayado oscuro, puerta negra
export function casa(E, x, y, w, h, seed) {
  const r = rng(seed)
  const wall = polyPath([[x, y], [x + w, y], [x + w, y - h], [x, y - h]])
  const roof = polyPath([[x - 3, y - h], [x + w + 3, y - h], [x + w - w * 0.1, y - h - h * 0.45], [x + w * 0.1, y - h - h * 0.45]])
  const dw = Math.max(3, w * 0.18)
  const dx = x + w * (0.2 + r() * 0.5)
  const door = polyPath([[dx, y], [dx + dw, y], [dx + dw, y - h * 0.62], [dx, y - h * 0.62]])
  hatch(E.g, wall, { tone: 0.12, angle: 1.5, seed, box: [x, y - h, x + w, y] })
  hatch(E.g, roof, { tone: 0.72, angle: 0.35, seed: seed + 1, box: [x - 4, y - h * 1.5, x + w + 4, y - h] })
  hatch(E.g, door, { tone: 0.95, angle: 0.9, seed: seed + 2, box: [dx, y - h, dx + dw, y] })
  E.lines.addPath(wall)
  E.lines.addPath(roof)
  E.lines.addPath(door)
}

// la iglesia: nave, torre con cúpula y una cruz arriba
export function iglesia(E, x, y, s, seed) {
  const nave = polyPath([[x, y], [x + 70 * s, y], [x + 70 * s, y - 34 * s], [x, y - 34 * s]])
  const front = polyPath([[x - 2 * s, y - 34 * s], [x + 72 * s, y - 34 * s], [x + 35 * s, y - 52 * s]])
  const tower = new Path2D()
  tower.rect(x + 74 * s, y - 92 * s, 22 * s, 92 * s)
  tower.moveTo(x + 74 * s, y - 92 * s)
  tower.arc(x + 85 * s, y - 92 * s, 11 * s, Math.PI, 0)
  const bell = polyPath([[x + 80 * s, y - 78 * s], [x + 90 * s, y - 78 * s], [x + 90 * s, y - 64 * s], [x + 80 * s, y - 64 * s]])
  const door = new Path2D()
  door.rect(x + 29 * s, y - 20 * s, 12 * s, 20 * s)
  door.moveTo(x + 29 * s, y - 20 * s)
  door.arc(x + 35 * s, y - 20 * s, 6 * s, Math.PI, 0)
  hatch(E.g, nave, { tone: 0.18, angle: 1.5, seed, box: [x, y - 36 * s, x + 72 * s, y] })
  hatch(E.g, front, { tone: 0.55, angle: 0.4, seed: seed + 1, box: [x - 4 * s, y - 54 * s, x + 74 * s, y - 32 * s] })
  hatch(E.g, tower, { tone: 0.3, angle: 1.3, seed: seed + 2, box: [x + 72 * s, y - 106 * s, x + 98 * s, y] })
  hatch(E.g, bell, { tone: 0.95, angle: 0.8, seed: seed + 3, box: [x + 78 * s, y - 80 * s, x + 92 * s, y - 62 * s] })
  hatch(E.g, door, { tone: 0.95, angle: 0.8, seed: seed + 4, box: [x + 27 * s, y - 28 * s, x + 43 * s, y] })
  E.lines.addPath(nave)
  E.lines.addPath(front)
  E.lines.addPath(tower)
  E.lines.addPath(bell)
  E.lines.addPath(door)
  E.lines.moveTo(x + 85 * s, y - 103 * s)
  E.lines.lineTo(x + 85 * s, y - 121 * s)
  E.lines.moveTo(x + 79 * s, y - 115 * s)
  E.lines.lineTo(x + 91 * s, y - 115 * s)
}

// el sol de mediodía: un círculo en blanco y rayos cortos alrededor
export function sol(E, x, y, rad, seed) {
  const r = rng(seed)
  E.lines.moveTo(x + rad, y)
  E.lines.arc(x, y, rad, 0, TAU)
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * TAU + (r() - 0.5) * 0.05
    const r0 = rad * 1.18
    const r1 = rad * (1.45 + (i % 3) * 0.22 + r() * 0.12)
    E.lines.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0)
    E.lines.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1)
  }
}

// líneas sueltas de calor sobre el horizonte
export function calor(E, x0, x1, y, rows, seed) {
  const r = rng(seed)
  for (let k = 0; k < rows; k++) {
    let x = x0 + r() * 80
    while (x < x1) {
      const l = 40 + r() * 160
      const yy = y - k * 9 + (r() - 0.5) * 3
      E.lines.moveTo(x, yy)
      for (let i = 1; i <= 4; i++) E.lines.lineTo(x + (l * i) / 4, yy + Math.sin(i * 1.7 + k) * 1.4)
      x += l + 30 + r() * 140
    }
  }
}

// Comala: casas en una loma suave, la iglesia en medio y algún árbol
export function comala(E, x, y, width, s, seed) {
  const r = rng(seed)
  const rise = (px) => y - Math.sin(((px - x) / width) * Math.PI) * 26 * s
  hills(E, x - 120 * s, x + width + 120 * s, y - 20 * s, y + 6 * s, 14 * s, seed + 9, 0.22)
  const church = x + width * 0.42
  let px = x
  let i = 0
  while (px < x + width) {
    const w = (22 + r() * 22) * s
    if (Math.abs(px + w / 2 - (church + 48 * s)) > 62 * s) {
      const h = (16 + r() * 10) * s
      casa(E, px, rise(px + w / 2) + (r() - 0.5) * 4 * s, w, h, seed + i * 7)
    }
    px += w + (4 + r() * 10) * s
    i++
  }
  iglesia(E, church, rise(church + 35 * s), s, seed + 100)
  huizache(E, x - 30 * s, rise(x) + 6 * s, 0.75 * s, seed + 200)
  huizache(E, x + width + 26 * s, rise(x + width) + 6 * s, 0.6 * s, seed + 201)
}
