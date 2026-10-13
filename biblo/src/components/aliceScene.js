import { drawGrin } from './cheshire'

// Motor de la entrada de "Alicia en el país de las Maravillas" (~10 s).
// Ilustración 2D pintada, en la línea de las cinemáticas de Genshin: capas
// con paralaje, desenfoque de profundidad, cintas de viento, pétalos y motas
// de luz.
//   A) la orilla del río, una tarde dorada: el Conejo Blanco cruza el prado
//      mirando su reloj y se mete en la madriguera; Alicia va detrás y la
//      cámara entra por el agujero
//   B) la caída: Alicia baja flotando entre estantes, tarros y tazas que
//      flotan; al fondo crece una luz que lo inunda todo
//   C) aterriza en el País de las Maravillas y camina por el sendero de
//      baldosas hacia el castillo; el Gato de Cheshire aparece en un árbol y
//      se desvanece empezando por la cola, hasta que solo queda la sonrisa
// La música (aliceMusic.js) es un vals a 126 pulsos: los cambios de escena
// caen en sus compases.
// API: const scene = createAliceScene(canvas); scene.frame(t /* s */);
//      scene.resize(). Todo se dibuja en unidades virtuales: la pantalla mide
//      1000 de alto y VW de ancho.

const BPM = 126
export const BEAT = 60 / BPM
export const BAR = BEAT * 3

export const T = {
  rabbit: [0.15, 1.6], // el conejo cruza el prado y se mete en la madriguera
  watch: [0.58, 1.1], // saca el reloj del chaleco
  glint: 0.86,
  walkA: [0, 1.95], // Alicia va tras él
  hop: [1.92, 2.28], // y se mete detrás
  dive: [2.1, BAR * 2], // la cámara entra por el agujero
  fall: [BAR * 2, BAR * 4], // compases 3 y 4
  light: [BAR * 4 - 1.0, BAR * 4], // la luz del fondo lo inunda todo
  land: [BAR * 4, BAR * 4 + 0.55], // compás 5: el país de las maravillas
  walkC: [BAR * 4 + 0.42, 7.95], // camina y se para ante el gato
  cat: [7.25, 9.75],
  titleIn: 8.45,
  end: 10.0,
}

const HORIZON = 560
const FOCAL = 440 // proyección del suelo en C: y = HORIZON + FOCAL / z
const HEDGE = 1.2 // escala del seto de la madriguera
const CAT_SCALE = 0.75 // el gato, respecto a su árbol

const cl = (v) => Math.min(1, Math.max(0, v))
const lerp = (a, b, t) => a + (b - a) * t
const win = (t, a, b) => cl((t - a) / (b - a))
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const easeOut = (t) => 1 - Math.pow(1 - t, 3)
const easeIn = (t) => t * t * t
const smooth = (t) => t * t * (3 - 2 * t)
const mix2 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)]
const TAU = Math.PI * 2

// azar con semilla: el paisaje sale igual en cada visita y al redimensionar
function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function bez(p0, p1, p2, p3, u) {
  const v = 1 - u
  const a = v * v * v
  const b = 3 * v * v * u
  const c = 3 * v * u * u
  const d = u * u * u
  return [a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]]
}

function vgrad(g, y0, y1, stops) {
  const gr = g.createLinearGradient(0, y0, 0, y1)
  for (const [o, c] of stops) gr.addColorStop(o, c)
  return gr
}

function circles(list) {
  const p = new Path2D()
  for (const c of list) {
    p.moveTo(c.x + c.r, c.y)
    p.arc(c.x, c.y, c.r, 0, TAU)
  }
  return p
}

// Banda a lo largo de una línea: puntos [x, y] y medio ancho en cada uno.
// Sirve para mechones de pelo, lazos, cintas de viento y colas.
function band(pts, ws) {
  const left = []
  const right = []
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)]
    const b = pts[Math.min(pts.length - 1, i + 1)]
    let dx = b[0] - a[0]
    let dy = b[1] - a[1]
    const d = Math.hypot(dx, dy) || 1
    dx /= d
    dy /= d
    left.push([pts[i][0] - dy * ws[i], pts[i][1] + dx * ws[i]])
    right.push([pts[i][0] + dy * ws[i], pts[i][1] - dx * ws[i]])
  }
  const p = new Path2D()
  p.moveTo(left[0][0], left[0][1])
  for (let i = 1; i < left.length; i++) p.lineTo(left[i][0], left[i][1])
  for (let i = right.length - 1; i >= 0; i--) p.lineTo(right[i][0], right[i][1])
  p.closePath()
  return p
}

// lienzo auxiliar que se dibuja en unidades virtuales
function makeLayer(w, h, res) {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.ceil(w * res))
  c.height = Math.max(1, Math.ceil(h * res))
  const g = c.getContext('2d')
  g.scale(c.width / w, c.height / h)
  return { c, g, w, h }
}

// copia desenfocada (profundidad de campo): se hace una vez, no por fotograma
function blurLayer(L, px) {
  const c = document.createElement('canvas')
  c.width = L.c.width
  c.height = L.c.height
  const g = c.getContext('2d')
  g.filter = `blur(${px}px)`
  g.drawImage(L.c, 0, 0)
  return { c, w: L.w, h: L.h }
}

function glowSprite(hex, size = 64) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')
  const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  gr.addColorStop(0, hex)
  gr.addColorStop(0.22, hex + 'b0')
  gr.addColorStop(0.55, hex + '26')
  gr.addColorStop(1, hex + '00')
  g.fillStyle = gr
  g.fillRect(0, 0, size, size)
  return c
}

// pétalo de rosa (con muesca) u hoja de ginkgo, pre-renderizados
function petalSprite(light, dark, leaf = false) {
  const c = document.createElement('canvas')
  c.width = c.height = 56
  const g = c.getContext('2d')
  g.translate(28, 28)
  const p = new Path2D(
    leaf
      ? 'M0 20 L0 6 C-16 4 -21 -9 -14 -19 Q0 -12 14 -19 C21 -9 16 4 0 6 Z'
      : 'M0 20 C-17 12 -18 -11 -5 -19 Q0 -14 5 -19 C18 -11 17 12 0 20 Z'
  )
  const gr = g.createRadialGradient(-3, -6, 2, 0, 0, 24)
  gr.addColorStop(0, light)
  gr.addColorStop(1, dark)
  g.fillStyle = gr
  g.fill(p)
  if (leaf) {
    g.strokeStyle = dark
    g.lineWidth = 1
    for (const a of [-0.7, -0.35, 0, 0.35, 0.7]) {
      g.beginPath()
      g.moveTo(0, 6)
      g.lineTo(Math.sin(a) * 15, 6 - Math.cos(a) * 22)
      g.stroke()
    }
  }
  return c
}

// ---------- nubes y follaje (sombreado plano de anime) ----------

// Cúmulo: bolas blancas sobre una sombra lavanda, con luz del lado del sol.
// lx = 1 si el sol está a la izquierda, -1 si está a la derecha. rim: halo
// de contraluz alrededor del borde.
function cumulus(g, x, y, w, h, seed, pal) {
  const r = rng(seed)
  const puffs = []
  const n = Math.max(4, Math.round(w / 70))
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1)
    const edge = 1 - Math.abs(u - 0.5) * 1.15
    const pr = h * (0.19 + r() * 0.1) * (0.55 + edge * 0.55)
    puffs.push({ x: x - w / 2 + u * w, y: y - pr * 0.55, r: pr })
  }
  const tiers = 2 + Math.floor(r() * 2)
  for (let k = 1; k <= tiers; k++) {
    const m = Math.max(1, Math.round(n * 0.75 * (1 - k / (tiers + 1))))
    for (let i = 0; i < m; i++) {
      const u = 0.5 + (r() - 0.5) * (1.05 - k / (tiers + 1.4))
      const pr = h * (0.17 + r() * 0.14)
      puffs.push({ x: x - w / 2 + u * w, y: y - h * (k / (tiers + 0.7)) * 0.86 - pr * 0.15, r: pr })
    }
  }
  const path = circles(puffs)
  g.save()
  g.filter = 'blur(0.8px)' // bordes de pincel, no de compás
  g.beginPath()
  g.rect(x - w, y - h * 3, w * 2, h * 3) // base plana
  g.clip()
  if (pal.rim) {
    g.save()
    g.filter = 'blur(6px)'
    g.fillStyle = pal.rim
    g.fill(path)
    g.restore()
  }
  g.fillStyle = pal.shade
  g.fill(path)
  g.clip(path)
  g.fillStyle = pal.body
  for (const p of puffs) {
    g.beginPath()
    g.arc(p.x - p.r * 0.16 * pal.lx, p.y - p.r * 0.24, p.r * 0.9, 0, TAU)
    g.fill()
  }
  g.fillStyle = pal.light
  for (const p of puffs) {
    g.beginPath()
    g.arc(p.x - p.r * 0.36 * pal.lx, p.y - p.r * 0.44, p.r * 0.5, 0, TAU)
    g.fill()
  }
  g.fillStyle = vgrad(g, y - h * 0.42, y, [
    [0, pal.shade + '00'],
    [1, pal.deep],
  ])
  g.fillRect(x - w, y - h * 0.42, w * 2, h * 0.42)
  g.restore()
}

// Copa de árbol o arbusto: racimos en tres tonos y motas de hojas con luz.
function foliage(g, cx, cy, rx, ry, seed, pal, count = 16) {
  const r = rng(seed)
  const clumps = []
  for (let i = 0; i < count; i++) {
    const a = r() * TAU
    const d = Math.sqrt(r()) * 0.72
    clumps.push({ x: cx + Math.cos(a) * d * rx, y: cy + Math.sin(a) * d * ry, r: Math.min(rx, ry) * (0.3 + r() * 0.22) })
  }
  const path = circles(clumps)
  g.save()
  g.fillStyle = pal.dark
  g.fill(path)
  g.clip(path)
  g.fillStyle = pal.mid
  for (const c of clumps) {
    g.beginPath()
    g.arc(c.x - c.r * 0.14 * pal.lx, c.y - c.r * 0.2, c.r * 0.86, 0, TAU)
    g.fill()
  }
  g.fillStyle = pal.light
  for (const c of clumps) {
    g.beginPath()
    g.arc(c.x - c.r * 0.32 * pal.lx, c.y - c.r * 0.4, c.r * 0.48, 0, TAU)
    g.fill()
  }
  g.fillStyle = pal.spark
  for (let i = 0; i < count * 5; i++) {
    const c = clumps[i % count]
    const a = Math.PI * (1.05 + r() * 0.8) - (pal.lx < 0 ? Math.PI * 0.35 : 0)
    g.beginPath()
    g.ellipse(c.x + Math.cos(a) * c.r * 0.72, c.y + Math.sin(a) * c.r * 0.72, c.r * 0.09, c.r * 0.05, a, 0, TAU)
    g.fill()
  }
  g.restore()
}

function daisy(g, x, y, r, tint = '#ffffff') {
  g.fillStyle = tint
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU
    g.beginPath()
    g.ellipse(x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.36, r * 0.42, r * 0.17, a, 0, TAU)
    g.fill()
  }
  g.fillStyle = '#ffcf3a'
  g.beginPath()
  g.ellipse(x, y, r * 0.26, r * 0.17, 0, 0, TAU)
  g.fill()
}

function grassStrokes(g, x0, y0, x1, y1, seed, cols, n) {
  const r = rng(seed)
  g.lineCap = 'round'
  for (let i = 0; i < n; i++) {
    const d = Math.pow(r(), 0.8)
    const y = y0 + d * (y1 - y0)
    const x = x0 + r() * (x1 - x0)
    const len = 3 + d * 20
    g.strokeStyle = cols[Math.floor(r() * cols.length)]
    g.lineWidth = 0.5 + d * 1.5
    g.beginPath()
    g.moveTo(x, y)
    g.quadraticCurveTo(x + (r() - 0.5) * len * 0.5, y - len * 0.6, x + (r() - 0.4) * len * 0.7, y - len)
    g.stroke()
  }
}

// ---------- Alicia, de espaldas como en la portada ----------

const AL = {
  hair: '#f7cf6c',
  hairShade: '#dca548',
  hairDeep: '#b67d2e',
  hairLight: '#ffecb3',
  hairLine: '#a0692a',
  bow: '#1f2337',
  bowLight: '#55608a',
  dress: '#4ba4e8',
  dressShade: '#2f7cc4',
  dressDeep: '#215e9c',
  dressLight: '#9ad6fc',
  dressLine: '#1c4b80',
  white: '#ffffff',
  whiteShade: '#d3e0f1',
  whiteLine: '#8aa3c4',
  skin: '#ffe1cd',
  skinLine: '#c4876a',
  stocking: '#fbfbff',
  stripe: '#272b3d',
  shoe: '#1c1e2c',
  shoeLight: '#5a6584',
}

// Alicia en unidades propias: los pies en (0, 0) y el lazo a 100 de alto.
// o: { t, step (zancadas), stride (0-1), arms: 'swing' | 'clasp', float (0-1),
//      wind (0-1), look (gira la cabeza: -1 izquierda), lw (grosor de línea) }
function drawAlice(g, o) {
  const t = o.t
  const fl = o.float || 0
  const st = (o.stride || 0) * (1 - fl)
  const ph = (o.step || 0) * TAU
  const wind = o.wind || 0
  const liftL = Math.max(0, Math.sin(ph)) * st
  const liftR = Math.max(0, -Math.sin(ph)) * st
  const bob = -(liftL + liftR) * 1.7
  const hip = Math.sin(ph) * st
  const lw = o.lw
  g.save()
  g.lineJoin = 'round'
  g.lineCap = 'round'
  g.translate(hip * 0.4, bob)
  if (o.tilt) g.rotate(o.tilt)

  // piernas con medias de rayas y zapatos de hebilla
  for (const side of [-1, 1]) {
    const lift = side < 0 ? liftL : liftR
    const ax = side * (4.5 + fl * 2.6) + Math.sin(t * 2.3 + side) * 1.4 * fl
    const ay = -4.2 - lift * 4.8 - fl * 1.5
    const tx = side * 4.3
    const leg = new Path2D()
    leg.moveTo(tx - 2.6, -38)
    leg.lineTo(ax - 1.75, ay)
    leg.quadraticCurveTo(ax, ay + 1, ax + 1.75, ay)
    leg.lineTo(tx + 2.6, -38)
    leg.closePath()
    g.fillStyle = AL.stocking
    g.fill(leg)
    g.save()
    g.clip(leg)
    g.fillStyle = AL.stripe
    for (let y = -38; y < ay + 1; y += 2.8) g.fillRect(-14, y, 28, 1.3)
    const sh = g.createLinearGradient(tx + side * 3, 0, tx - side * 3, 0)
    sh.addColorStop(0, 'rgba(40, 50, 90, 0)')
    sh.addColorStop(1, 'rgba(40, 50, 90, 0.35)')
    g.fillStyle = sh
    g.fillRect(-14, -40, 28, 42)
    g.restore()
    g.strokeStyle = AL.stripe
    g.lineWidth = lw * 0.8
    g.stroke(leg)
    g.fillStyle = AL.shoe
    g.beginPath()
    g.ellipse(ax, ay + 1.4, 2.35, 1.9 - lift * 0.5, 0, 0, TAU)
    g.fill()
    if (lift > 0.05) {
      // al levantar el talón asoma la suela
      g.fillStyle = '#4a5068'
      g.beginPath()
      g.ellipse(ax, ay + 2.6, 2, 1.1 * lift, 0, 0, TAU)
      g.fill()
    }
    g.strokeStyle = AL.shoeLight
    g.lineWidth = 0.5
    g.beginPath()
    g.arc(ax, ay + 1.2, 1.6, Math.PI * 1.15, Math.PI * 1.85)
    g.stroke()
    g.strokeStyle = AL.shoe
    g.lineWidth = 0.75
    g.beginPath()
    g.moveTo(ax - 1.9, ay - 0.5)
    g.lineTo(ax + 1.9, ay - 0.5)
    g.stroke()
  }

  // falda: campana con pliegues; al flotar se abre como un paraguas
  const hemY = -31 - fl * 7
  const hw = 19.5 + fl * 7.5
  const swing = Math.sin(ph - 0.7) * 1.2 * st + Math.sin(t * 1.7) * 0.5 * wind
  const flut = (i) => Math.sin(t * 8 + i * 1.9) * 1.6 * fl
  const pet = new Path2D()
  pet.moveTo(-hw * 0.96 + swing, hemY - 3)
  const NP = 11
  for (let i = 0; i < NP; i++) {
    const x0 = lerp(-hw * 0.96, hw * 0.96, i / NP) + swing
    const x1 = lerp(-hw * 0.96, hw * 0.96, (i + 1) / NP) + swing
    const yb = hemY + 2.6 + Math.sin(((i + 0.5) / NP) * Math.PI) * (1.6 - fl * 5) + flut(i) * 0.8
    pet.quadraticCurveTo((x0 + x1) / 2, yb + 1.8, x1, yb)
  }
  pet.lineTo(hw * 0.96 + swing, hemY - 3)
  pet.closePath()
  g.fillStyle = AL.white
  g.fill(pet)
  g.strokeStyle = AL.whiteLine
  g.lineWidth = lw * 0.7
  g.stroke(pet)

  const wy = -57
  const ww = 9.8
  const hem = []
  const NH = 8
  for (let i = 0; i <= NH; i++) {
    const u = i / NH
    hem.push([
      lerp(-hw, hw, u) + swing * (0.6 + Math.abs(u - 0.5) * 0.8),
      hemY + (i % 2 ? 1.4 : -0.4) + Math.sin(u * Math.PI) * (1.8 - fl * 5.5) + flut(i),
    ])
  }
  const sideL = [[-ww, wy], [-ww - 3 - fl * 4, wy + 10], [hem[0][0] - 1 - fl * 2, hemY - 12 + fl * 3], hem[0]]
  const sideR = [hem[NH], [hem[NH][0] + 1 + fl * 2, hemY - 12 + fl * 3], [ww + 3 + fl * 4, wy + 10], [ww, wy]]
  const skirt = new Path2D()
  skirt.moveTo(-ww, wy)
  skirt.bezierCurveTo(...sideL[1], ...sideL[2], ...sideL[3])
  for (let i = 1; i <= NH; i++) {
    const [x0, y0] = hem[i - 1]
    const [x1, y1] = hem[i]
    skirt.quadraticCurveTo((x0 + x1) / 2, Math.max(y0, y1) + 1.1, x1, y1)
  }
  skirt.bezierCurveTo(...sideR[1], ...sideR[2], ...sideR[3])
  skirt.closePath()
  g.fillStyle = vgrad(g, wy, hemY + 3, [
    [0, AL.dressDeep],
    [0.3, AL.dressShade],
    [1, AL.dress],
  ])
  g.fill(skirt)
  g.save()
  g.clip(skirt)
  for (const f of [-0.62, -0.2, 0.22, 0.64]) {
    const xb = f * hw + swing
    const xt = f * ww * 0.9
    const fold = g.createLinearGradient(0, wy, 0, hemY + 3)
    fold.addColorStop(0, 'rgba(23, 70, 130, 0)')
    fold.addColorStop(1, 'rgba(23, 70, 130, 0.45)')
    g.fillStyle = fold
    g.beginPath()
    g.moveTo(xt - 0.6, wy)
    g.lineTo(xb - 2.8, hemY + 4)
    g.lineTo(xb + 1.2, hemY + 4)
    g.lineTo(xt + 0.6, wy)
    g.fill()
    g.fillStyle = 'rgba(160, 215, 252, 0.3)'
    g.beginPath()
    g.moveTo(xt + 0.8, wy)
    g.lineTo(xb + 1.6, hemY + 4)
    g.lineTo(xb + 3.8, hemY + 4)
    g.lineTo(xt + 1.6, wy)
    g.fill()
  }
  // el delantal blanco asoma por los costados
  for (const sideCurve of [sideL, sideR]) {
    const pts = []
    const ws = []
    for (let k = 0; k <= 10; k++) {
      pts.push(bez(...sideCurve, k / 10))
      ws.push(0.6 + (sideCurve === sideL ? k / 10 : 1 - k / 10) * 2.2)
    }
    g.fillStyle = AL.white
    g.fill(band(pts, ws))
  }
  g.restore()
  g.strokeStyle = AL.dressLine
  g.lineWidth = lw
  g.stroke(skirt)

  // corpiño y lazo del delantal (los tapa el pelo, salvo al flotar)
  const bodice = new Path2D('M-9.8 -57 L-11.6 -68 Q0 -73 11.6 -68 L9.8 -57 Q0 -55 -9.8 -57 Z')
  g.fillStyle = AL.dressShade
  g.fill(bodice)
  g.strokeStyle = AL.dressLine
  g.lineWidth = lw
  g.stroke(bodice)
  g.strokeStyle = AL.white
  g.lineWidth = 2
  g.beginPath()
  g.moveTo(-5, -57)
  g.lineTo(-8, -69)
  g.moveTo(5, -57)
  g.lineTo(8, -69)
  g.stroke()
  for (const side of [-1, 1]) {
    // lazadas
    const loop = new Path2D()
    loop.moveTo(0, -56)
    loop.bezierCurveTo(side * 3, -62, side * 9.5, -61, side * 9, -56)
    loop.bezierCurveTo(side * 8.5, -52.5, side * 3, -53, 0, -56)
    g.fillStyle = AL.white
    g.fill(loop)
    g.strokeStyle = AL.whiteLine
    g.lineWidth = lw * 0.7
    g.stroke(loop)
    // cintas que cuelgan sobre la falda
    const wave = Math.sin(t * 3.1 + side) * (0.8 + wind) + swing * 0.6
    const pts = []
    const ws = []
    for (let k = 0; k <= 8; k++) {
      const u = k / 8
      pts.push([side * (1.6 + u * 4.2) + wave * u * u, -55 + u * (18 - fl * 8) + Math.sin(u * 4 + t * 4) * 0.4 * u])
      ws.push(1.7 - u * 0.3)
    }
    const tail = band(pts, ws)
    g.fillStyle = AL.white
    g.fill(tail)
    g.stroke(tail)
  }
  g.fillStyle = AL.whiteShade
  g.beginPath()
  g.ellipse(0, -56, 1.9, 1.6, 0, 0, TAU)
  g.fill()

  // brazos
  const arms = fl > 0.5 ? 'float' : o.arms || 'swing'
  const armPts = (side) => {
    const sh = [side * 12.2, -66.8]
    if (arms === 'float') {
      const w1 = Math.sin(t * 1.8 + side) * 1.6
      return [sh, [side * 19.5, -71 + w1], [side * 26, -76.5 + w1 * 1.4]]
    }
    if (arms === 'clasp') return [sh, [side * 14.6, -56.5], [side * 2.4, -50.6]]
    const sw = -side * Math.sin(ph) * st
    return [sh, [side * (14.4 + sw * 0.5), -57.4 + sw * 0.6], [side * (15.4 + sw * 1.2), -48.6 + sw * 1.8]]
  }
  const limb = (pts, from, to) => {
    g.beginPath()
    g.moveTo(pts[from][0], pts[from][1])
    for (let i = from + 1; i <= to; i++) g.lineTo(pts[i][0], pts[i][1])
    g.strokeStyle = AL.skinLine
    g.lineWidth = 3.5 + lw * 1.4
    g.stroke()
    g.strokeStyle = AL.skin
    g.lineWidth = 3.5
    g.stroke()
  }
  const hand = (p) => {
    g.fillStyle = AL.skin
    g.beginPath()
    g.arc(p[0], p[1], 2, 0, TAU)
    g.fill()
    g.strokeStyle = AL.skinLine
    g.lineWidth = lw * 0.8
    g.stroke()
  }
  const AP = { [-1]: armPts(-1), 1: armPts(1) }
  for (const side of [-1, 1]) {
    if (arms === 'clasp') limb(AP[side], 0, 1)
    else {
      limb(AP[side], 0, 2)
      hand(AP[side][2])
    }
  }
  // mangas abullonadas con puño blanco
  for (const side of [-1, 1]) {
    g.save()
    g.translate(side * 12.4, -68.3)
    g.rotate(side * 0.28)
    const sg = g.createRadialGradient(-side * 1.5, -2.5, 0.5, 0, 0, 6)
    sg.addColorStop(0, AL.dressLight)
    sg.addColorStop(0.55, AL.dress)
    sg.addColorStop(1, AL.dressShade)
    g.fillStyle = sg
    g.beginPath()
    g.ellipse(0, 0, 5.4, 4.7, 0, 0, TAU)
    g.fill()
    g.strokeStyle = AL.dressLine
    g.lineWidth = lw
    g.stroke()
    g.strokeStyle = AL.white
    g.lineWidth = 1.3
    g.beginPath()
    g.ellipse(0, 3.4, 4.2, 1.2, 0, 0.15, Math.PI - 0.15)
    g.stroke()
    g.restore()
  }

  // pelo: la nuca y nueve mechones que ondean (o suben al flotar)
  const hx = Math.sin(ph) * 0.3 * st + (o.look || 0) * 1.4
  const sway = Math.sin(ph - 1.3) * 1.5 * st
  const locks = []
  const N = 9
  for (let i = 0; i < N; i++) {
    const c = i / (N - 1) - 0.5
    const side = Math.abs(c) * 2
    const jag = (((i * 7) % 5) - 2) * 0.8
    const root = [hx + c * 15, -88.5 + side * side * 8]
    let c1 = [root[0] + c * 7, root[1] + 11]
    let tip = [hx + c * 26.5 + c * side * 2.5, -49 - side * 6 + jag]
    let c2 = [tip[0] - c * 3, tip[1] - 12]
    const flow = Math.sin(t * 2.4 + i * 0.8) * (0.5 + wind * 1.7) + sway + wind * 2.4
    tip = [tip[0] + flow, tip[1] + Math.abs(flow) * 0.2]
    c2 = [c2[0] + flow * 0.55, c2[1]]
    let rt = root
    if (fl > 0) {
      // flotando, el pelo nace en la nuca y sube por encima de la cabeza en
      // mechones ondulados (curva en S), como bajo el agua
      const a = c * 1.7 + Math.sin(t * 1.5 + i * 1.3) * 0.18
      const L = 30 + side * 5 + jag * 1.5
      const bend = (i % 2 ? 1 : -1) * 10
      rt = mix2(root, [hx + c * 13, -76 + side * 2], fl)
      c1 = mix2(c1, [hx + c * 16 - bend * 0.5, -93], fl)
      c2 = mix2(c2, [hx + Math.sin(a) * L * 0.6 + bend + Math.sin(t * 3 + i) * 2.5, -97 - Math.cos(a) * L * 0.45], fl)
      tip = mix2(tip, [hx + Math.sin(a) * L * 1.05 + Math.sin(t * 2.2 + i) * 4, -97 - Math.cos(a) * L * 0.8], fl)
    }
    locks.push({ i, root: rt, c1, c2, tip, w: 3.7 - side * 0.7 + fl * 0.9 })
  }
  g.fillStyle = vgrad(g, -95, -76, [
    [0, AL.hairShade],
    [1, AL.hair],
  ])
  g.beginPath()
  g.arc(hx, -84, 10, 0, TAU)
  g.fill()
  g.strokeStyle = AL.hairLine
  g.lineWidth = lw
  g.stroke()
  for (const back of [true, false]) {
    for (const L of locks) {
      if ((L.i % 2 === 1) !== back) continue
      const pts = []
      const ws = []
      for (let k = 0; k <= 14; k++) {
        const u = k / 14
        pts.push(bez(L.root, L.c1, L.c2, L.tip, u))
        ws.push(L.w * (u < 0.3 ? 0.72 + u * 1.2 : Math.pow((1 - u) / 0.7, 0.8 - fl * 0.4) * 1.08))
      }
      const path = band(pts, ws)
      const gr = g.createLinearGradient(L.root[0], L.root[1], L.tip[0], L.tip[1])
      if (back) {
        gr.addColorStop(0, AL.hairDeep)
        gr.addColorStop(1, AL.hairShade)
      } else {
        gr.addColorStop(0, AL.hairShade)
        gr.addColorStop(0.45, AL.hair)
        gr.addColorStop(1, AL.hairLight)
      }
      g.fillStyle = gr
      g.fill(path)
      g.globalAlpha = 0.55
      g.strokeStyle = AL.hairLine
      g.lineWidth = lw * 0.75
      g.stroke(path)
      g.globalAlpha = 1
      if (!back) {
        g.strokeStyle = 'rgba(160, 104, 40, 0.45)'
        g.lineWidth = 0.4
        g.beginPath()
        for (let k = 2; k <= 11; k++) {
          if (k === 2) g.moveTo(pts[k][0] + 0.6, pts[k][1])
          else g.lineTo(pts[k][0] + 0.6, pts[k][1])
        }
        g.stroke()
      }
    }
  }
  // brillo en anillo de pelo de anime (con el pelo flotando no hay anillo)
  g.strokeStyle = AL.hairLight
  g.lineWidth = 1.5
  g.globalAlpha = 0.9 * Math.max(0, 1 - fl * 2)
  for (const [a, b] of [[1.14, 1.34], [1.4, 1.6], [1.66, 1.86]]) {
    g.beginPath()
    g.arc(hx, -82.5, 7.4, Math.PI * a, Math.PI * b)
    g.stroke()
  }
  g.globalAlpha = 1

  // manos juntas a la espalda, por encima del pelo
  if (arms === 'clasp') {
    for (const side of [-1, 1]) limb(AP[side], 1, 2)
    hand(AP[-1][2])
    hand(AP[1][2])
  }

  // diadema con lazo
  g.save()
  g.translate(hx, -93.2)
  g.strokeStyle = AL.bow
  g.lineWidth = 1.7
  g.beginPath()
  g.arc(0, 9.2, 10.1, Math.PI * 1.12, Math.PI * 1.88)
  g.stroke()
  for (const side of [-1, 1]) {
    const loop = new Path2D()
    loop.moveTo(0, 0)
    loop.bezierCurveTo(side * 3, -6.5, side * 9.5, -6, side * 9, -1)
    loop.bezierCurveTo(side * 8.6, 2.6, side * 3.5, 2.4, 0, 0)
    g.fillStyle = AL.bow
    g.fill(loop)
    g.strokeStyle = AL.bowLight
    g.lineWidth = 0.6
    g.stroke(loop)
  }
  g.fillStyle = AL.bowLight
  g.beginPath()
  g.ellipse(0, -0.3, 1.8, 1.5, 0, 0, TAU)
  g.fill()
  g.restore()
  g.restore()
}

// ---------- el Conejo Blanco, de perfil y corriendo ----------

const RB = {
  fur: '#fdfcff',
  furShade: '#d8dcec',
  line: '#6c7291',
  inner: '#ffb4c8',
  eye: '#e33a62',
  coat: '#3f70d3',
  coatLine: '#1c3a77',
  vest: '#f0b73d',
  gold: '#f5c84f',
  goldShade: '#b9862a',
}

// En unidades propias: pies en (0, 0), unas 64 de alto con las orejas.
// o: { run (zancadas), watch (0-1), glint (0-1), dir (1 derecha), lw }
function drawRabbit(g, o) {
  const q = ((o.run % 1) + 1) % 1
  const calm = o.watch * 0.65
  const hop = Math.sin(q * Math.PI) * (1 - calm)
  const ext = Math.sin(q * TAU) * (1 - calm)
  const lw = o.lw
  g.save()
  g.scale(o.dir || 1, 1)
  g.lineJoin = 'round'
  g.lineCap = 'round'
  g.fillStyle = 'rgba(30, 70, 30, 0.22)'
  g.beginPath()
  g.ellipse(0, 0, 17, 3.2, 0, 0, TAU)
  g.fill()
  g.translate(0, -hop * 9)
  g.rotate(-ext * 0.1)
  const outline = (c = RB.line, w = 1) => {
    g.strokeStyle = c
    g.lineWidth = lw * w
    g.stroke()
  }
  // pata trasera: estirada al impulsarse, recogida al caer
  const e = cl(ext * 0.5 + 0.5)
  g.fillStyle = RB.furShade
  g.beginPath()
  g.ellipse(-8, -13, 7.5, 6.5, 0, 0, TAU)
  g.fill()
  outline()
  g.fillStyle = RB.fur
  g.beginPath()
  g.ellipse(lerp(-6, -17, e), lerp(-3, -6, e), 7.5, 2.6, -0.2 - ext * 0.25, 0, TAU)
  g.fill()
  outline()
  g.beginPath()
  g.arc(-15, -22, 4.3, 0, TAU)
  g.fill()
  outline()
  g.beginPath()
  g.ellipse(0, -20, 13.5, 10, -0.1, 0, TAU)
  g.fill()
  outline()
  // levita azul con faldones que ondean
  const flap = Math.sin(q * TAU * 2) * 2.5
  const coat = new Path2D(
    `M-11 -25 Q-2 -33 9 -29 Q14 -25 12 -17 L8 -12 Q0 -10 -7 -13 L-13 -10 Q-20 ${-9 + flap} -23 ${-4 + flap} Q-16 -8 -12 -14 Z`
  )
  g.fillStyle = RB.coat
  g.fill(coat)
  g.strokeStyle = RB.coatLine
  g.lineWidth = lw
  g.stroke(coat)
  g.fillStyle = RB.vest
  g.beginPath()
  g.moveTo(9, -27)
  g.quadraticCurveTo(13.2, -22, 10.6, -15)
  g.lineTo(8, -16)
  g.quadraticCurveTo(10, -21, 7.4, -26)
  g.closePath()
  g.fill()
  // patas delanteras (o una sujetando el reloj)
  const reach = Math.sin(q * TAU + 1.2) * (1 - calm)
  g.fillStyle = RB.fur
  for (const k of [0, 1]) {
    if (k === 1 && o.watch > 0.3) continue
    const fx = 14 + reach * (k ? -3 : 4)
    const fy = -5 - Math.max(0, reach) * 3
    g.beginPath()
    g.moveTo(9, -15)
    g.quadraticCurveTo(fx - 1, -11, fx, fy)
    g.lineTo(fx + 3, fy + 0.5)
    g.quadraticCurveTo(fx + 1, -11, 12, -15)
    g.closePath()
    g.fill()
    outline(RB.line, 0.8)
  }
  // cabeza
  g.fillStyle = RB.fur
  g.beginPath()
  g.arc(14, -33, 7.4, 0, TAU)
  g.fill()
  outline()
  g.beginPath()
  g.arc(20, -31.5, 3.4, 0, TAU)
  g.fill()
  outline(RB.line, 0.8)
  g.fillStyle = RB.inner
  g.beginPath()
  g.arc(22.9, -32.4, 1.1, 0, TAU)
  g.fill()
  g.fillStyle = RB.eye
  g.beginPath()
  g.arc(16.6, -35, 1.5, 0, TAU)
  g.fill()
  g.fillStyle = '#fff'
  g.beginPath()
  g.arc(16.2, -35.5, 0.5, 0, TAU)
  g.fill()
  // gorguera
  g.fillStyle = '#ffffff'
  g.beginPath()
  g.moveTo(7.5, -28)
  for (let k = 0; k <= 5; k++) g.lineTo(8 + k * 1.3, -26.2 + (k % 2) * 1.8)
  g.lineTo(14.5, -27.5)
  g.closePath()
  g.fill()
  // orejas largas echadas hacia atrás
  for (const [ex, ey, rot, sc] of [
    [6.5, -46, -0.62, 0.95],
    [10.5, -47.5, -0.38, 1],
  ]) {
    g.save()
    g.translate(ex, ey)
    g.rotate(rot + Math.sin(q * TAU) * 0.06)
    g.fillStyle = RB.fur
    g.beginPath()
    g.ellipse(0, 0, 2.9 * sc, 11 * sc, 0, 0, TAU)
    g.fill()
    outline()
    g.fillStyle = RB.inner
    g.beginPath()
    g.ellipse(0.4, 0.5, 1.4 * sc, 8 * sc, 0, 0, TAU)
    g.fill()
    g.restore()
  }
  // el reloj de bolsillo
  if (o.watch > 0) {
    const r = 3.9 * o.watch
    g.strokeStyle = RB.goldShade
    g.lineWidth = 0.7
    g.beginPath()
    g.moveTo(9.5, -21)
    g.quadraticCurveTo(15, -18, 20.5, -23)
    g.stroke()
    g.fillStyle = RB.fur
    g.beginPath()
    g.moveTo(10, -18)
    g.quadraticCurveTo(16, -20, 19.5, -24)
    g.lineTo(21, -22)
    g.quadraticCurveTo(16, -16, 11, -15)
    g.closePath()
    g.fill()
    const gold = g.createRadialGradient(21.5, -26, 0.5, 22, -25, r)
    gold.addColorStop(0, '#fff3c4')
    gold.addColorStop(0.5, RB.gold)
    gold.addColorStop(1, RB.goldShade)
    g.fillStyle = gold
    g.beginPath()
    g.arc(22, -25, r, 0, TAU)
    g.fill()
    g.fillStyle = '#fffaf0'
    g.beginPath()
    g.arc(22, -25, r * 0.72, 0, TAU)
    g.fill()
    g.strokeStyle = '#3a2a12'
    g.lineWidth = 0.45
    g.beginPath()
    g.moveTo(22, -25)
    g.lineTo(22, -25 - r * 0.55)
    g.moveTo(22, -25)
    g.lineTo(22 + r * 0.4, -25 + r * 0.15)
    g.stroke()
    if (o.glint > 0) {
      // destello de cuatro puntas
      const s = 7 * o.glint
      g.fillStyle = '#ffffff'
      g.beginPath()
      g.moveTo(24.5, -28.5 - s)
      g.quadraticCurveTo(24.5, -28.5, 24.5 + s, -28.5)
      g.quadraticCurveTo(24.5, -28.5, 24.5, -28.5 + s)
      g.quadraticCurveTo(24.5, -28.5, 24.5 - s, -28.5)
      g.quadraticCurveTo(24.5, -28.5, 24.5, -28.5 - s)
      g.fill()
    }
  }
  g.restore()
}

// ---------- el Gato de Cheshire ----------

const CAT = { fur: '#da6cc2', stripe: '#7b3ca8', light: '#f7b2e2', line: '#4a1c63', inner: '#ffc4e6' }

// En el marco de la sonrisa (boca en 0, 0). Cada parte tiene su opacidad para
// desvanecerse por orden: cola, cuerpo, cabeza, ojos y, al final, la sonrisa.
function drawCat(g, a) {
  g.save()
  g.lineJoin = 'round'
  g.lineCap = 'round'
  if (a.tail > 0) {
    g.globalAlpha = a.tail
    const sw = a.sway
    const tail = new Path2D(
      `M300 40 C350 70 ${330 + sw * 20} 150 ${292 + sw * 30} 178 C${262 + sw * 25} 202 ${282 + sw * 10} 242 ${322 + sw * 5} 236`
    )
    g.strokeStyle = CAT.line
    g.lineWidth = 34
    g.stroke(tail)
    g.strokeStyle = CAT.fur
    g.lineWidth = 27
    g.stroke(tail)
    g.setLineDash([16, 18])
    g.strokeStyle = CAT.stripe
    g.stroke(tail)
    g.setLineDash([])
  }
  if (a.body > 0) {
    g.globalAlpha = a.body
    const body = new Path2D('M40 62 C60 -10 232 -22 312 22 C352 44 342 98 292 102 L62 102 C30 102 24 82 40 62 Z')
    g.fillStyle = vgrad(g, -10, 102, [
      [0, CAT.light],
      [0.45, CAT.fur],
      [1, CAT.fur],
    ])
    g.fill(body)
    g.save()
    g.clip(body)
    g.strokeStyle = CAT.stripe
    g.lineWidth = 15
    for (let i = 0; i < 7; i++) {
      const x = 90 + i * 36
      g.beginPath()
      g.moveTo(x, -20)
      g.quadraticCurveTo(x + 18, 40, x - 4, 110)
      g.stroke()
    }
    g.restore()
    g.strokeStyle = CAT.line
    g.lineWidth = 4
    g.stroke(body)
    // patas que cuelgan por delante de la rama
    for (const px of [-34, 26]) {
      const paw = new Path2D(`M${px} 92 L${px} 128 Q${px + 13} 140 ${px + 26} 128 L${px + 26} 92 Z`)
      g.fillStyle = CAT.fur
      g.fill(paw)
      g.save()
      g.clip(paw)
      g.fillStyle = CAT.stripe
      g.fillRect(px - 2, 104, 30, 7)
      g.fillRect(px - 2, 118, 30, 6)
      g.restore()
      g.strokeStyle = CAT.line
      g.lineWidth = 4
      g.stroke(paw)
    }
  }
  if (a.head > 0) {
    g.globalAlpha = a.head
    for (const side of [-1, 1]) {
      const ear = new Path2D(`M${side * 112} -62 L${side * 100} -152 L${side * 42} -102 Z`)
      g.fillStyle = CAT.fur
      g.fill(ear)
      g.strokeStyle = CAT.line
      g.lineWidth = 4
      g.stroke(ear)
      g.fillStyle = CAT.inner
      g.beginPath()
      g.moveTo(side * 98, -80)
      g.lineTo(side * 96, -134)
      g.lineTo(side * 60, -104)
      g.closePath()
      g.fill()
    }
    const head = new Path2D(
      'M-125 -10 C-130 -92 -62 -122 0 -122 C62 -122 130 -92 125 -10 L142 10 L118 20 L134 42 L106 46 C80 82 40 94 0 94 C-40 94 -80 82 -106 46 L-134 42 L-118 20 L-142 10 Z'
    )
    g.fillStyle = vgrad(g, -122, 94, [
      [0, CAT.light],
      [0.35, CAT.fur],
      [1, CAT.fur],
    ])
    g.fill(head)
    g.save()
    g.clip(head)
    g.strokeStyle = CAT.stripe
    g.lineWidth = 13
    for (const dx of [-30, 0, 30]) {
      g.beginPath()
      g.moveTo(dx * 1.2, -130)
      g.quadraticCurveTo(dx, -100, dx * 0.7, -78)
      g.stroke()
    }
    for (const side of [-1, 1]) {
      for (const y of [-6, 18]) {
        g.beginPath()
        g.moveTo(side * 150, y - 8)
        g.quadraticCurveTo(side * 128, y, side * 104, y + 4)
        g.stroke()
      }
    }
    g.restore()
    g.strokeStyle = CAT.line
    g.lineWidth = 4
    g.stroke(head)
  }
  g.globalAlpha = 1
  drawGrin(g, { mouth: a.grin, eyes: a.eyes, blink: a.blink })
  g.restore()
}

// ---------- objetos que caen por la madriguera ----------

function drawTeacup(g) {
  g.fillStyle = '#fdfaf3'
  g.strokeStyle = '#b9a77a'
  g.lineWidth = 0.9
  g.beginPath()
  g.ellipse(0, 14, 25, 6.5, 0, 0, TAU)
  g.fill()
  g.stroke()
  g.strokeStyle = '#5b8fd8'
  g.lineWidth = 1.2
  g.beginPath()
  g.ellipse(0, 14, 20, 4.6, 0, 0, TAU)
  g.stroke()
  g.lineWidth = 3.4
  g.strokeStyle = '#efe8d6'
  g.beginPath()
  g.arc(16, 1, 5.4, -1.3, 1.6)
  g.stroke()
  const body = new Path2D('M-15 -8 C-15 6 -10 13 0 13 C10 13 15 6 15 -8 Z')
  const gr = g.createLinearGradient(-15, 0, 15, 0)
  gr.addColorStop(0, '#fffdf6')
  gr.addColorStop(1, '#ddd3bd')
  g.fillStyle = gr
  g.fill(body)
  g.strokeStyle = '#b9a77a'
  g.lineWidth = 0.9
  g.stroke(body)
  g.fillStyle = '#5b8fd8'
  for (const [x, y] of [[-8, 2], [0, 5], [8, 2]]) {
    g.beginPath()
    g.arc(x, y, 1.6, 0, TAU)
    g.fill()
  }
  g.fillStyle = '#8a5530'
  g.beginPath()
  g.ellipse(0, -8, 15, 4.2, 0, 0, TAU)
  g.fill()
  g.strokeStyle = '#e3bd5f'
  g.lineWidth = 1.4
  g.stroke()
}

const SUITS = {
  heart: { color: '#e0283c', d: 'M0 9 C-14 -1 -9 -12 0 -5 C9 -12 14 -1 0 9 Z' },
  diamond: { color: '#e0283c', d: 'M0 -11 L8 0 L0 11 L-8 0 Z' },
  spade: { color: '#1f2030', d: 'M0 -11 C10 -2 13 6 4 6 C2 6 1 5 0 4 L2 11 L-2 11 L0 4 C-1 5 -2 6 -4 6 C-13 6 -10 -2 0 -11 Z' },
}

function drawCard(g, suit, flip) {
  const w = 30 * Math.max(0.06, Math.abs(flip))
  g.save()
  g.beginPath()
  g.roundRect(-w / 2, -21, w, 42, 3)
  if (flip >= 0) {
    g.fillStyle = '#fdfcf8'
    g.fill()
    g.strokeStyle = '#cfc6b3'
    g.lineWidth = 0.8
    g.stroke()
    g.scale(Math.max(0.06, flip), 1)
    const s = SUITS[suit]
    g.fillStyle = s.color
    g.fill(new Path2D(s.d))
    g.font = 'bold 7px Georgia, serif'
    g.fillText('A', -12, -12)
  } else {
    g.fillStyle = '#c0392b'
    g.fill()
    g.clip()
    g.strokeStyle = 'rgba(255, 220, 200, 0.55)'
    g.lineWidth = 1
    for (let k = -40; k < 40; k += 6) {
      g.beginPath()
      g.moveTo(k, -22)
      g.lineTo(k + 44, 22)
      g.moveTo(k + 44, -22)
      g.lineTo(k, 22)
      g.stroke()
    }
  }
  g.restore()
}

function drawWatch(g, t) {
  g.strokeStyle = '#c9952e'
  g.lineWidth = 2.4
  g.beginPath()
  g.arc(0, -19, 4, 0, TAU)
  g.stroke()
  const gold = g.createRadialGradient(-5, -5, 2, 0, 0, 17)
  gold.addColorStop(0, '#fff2c0')
  gold.addColorStop(0.5, '#f2c14e')
  gold.addColorStop(1, '#a8761f')
  g.fillStyle = gold
  g.beginPath()
  g.arc(0, 0, 16, 0, TAU)
  g.fill()
  g.fillStyle = '#fffaf0'
  g.beginPath()
  g.arc(0, 0, 12.5, 0, TAU)
  g.fill()
  g.strokeStyle = '#3a2a12'
  g.lineWidth = 1
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * TAU
    g.beginPath()
    g.moveTo(Math.cos(a) * 10, Math.sin(a) * 10)
    g.lineTo(Math.cos(a) * 11.8, Math.sin(a) * 11.8)
    g.stroke()
  }
  g.lineWidth = 1.3
  g.beginPath()
  g.moveTo(0, 0)
  g.lineTo(Math.cos(t * 5) * 9, Math.sin(t * 5) * 9)
  g.moveTo(0, 0)
  g.lineTo(Math.cos(t * 0.6) * 6, Math.sin(t * 0.6) * 6)
  g.stroke()
  g.strokeStyle = 'rgba(255, 255, 255, 0.7)'
  g.lineWidth = 1.6
  g.beginPath()
  g.arc(0, 0, 9, Math.PI * 1.1, Math.PI * 1.45)
  g.stroke()
}

function drawKey(g) {
  g.strokeStyle = '#e8b93f'
  g.lineCap = 'round'
  g.lineWidth = 3.2
  g.beginPath()
  g.arc(-15, 0, 6, 0, TAU)
  g.moveTo(-9, 0)
  g.lineTo(16, 0)
  g.moveTo(11, 0)
  g.lineTo(11, 5)
  g.moveTo(16, 0)
  g.lineTo(16, 6)
  g.stroke()
  g.strokeStyle = 'rgba(255, 245, 200, 0.8)'
  g.lineWidth = 1
  g.beginPath()
  g.arc(-15, 0, 6, Math.PI * 1.1, Math.PI * 1.6)
  g.stroke()
}

function drawBottle(g) {
  const glass = new Path2D('M-4 -22 L4 -22 L4 -12 C14 -8 14 6 12 16 Q0 22 -12 16 C-14 6 -14 -8 -4 -12 Z')
  g.save()
  g.clip(glass)
  g.fillStyle = 'rgba(190, 232, 248, 0.55)'
  g.fillRect(-16, -24, 32, 48)
  g.fillStyle = 'rgba(199, 125, 255, 0.85)'
  g.fillRect(-16, 0, 32, 24)
  g.restore()
  g.strokeStyle = 'rgba(80, 130, 160, 0.9)'
  g.lineWidth = 1
  g.stroke(glass)
  g.fillStyle = '#c8955c'
  g.fillRect(-4.5, -27, 9, 6)
  g.fillStyle = '#fff3d6'
  g.fillRect(-10, -4, 20, 9)
  g.fillStyle = '#5a2a1a'
  g.font = 'italic 5.2px Georgia, serif'
  g.textAlign = 'center'
  g.fillText('BÉBEME', 0, 2.4)
  g.strokeStyle = 'rgba(255, 255, 255, 0.8)'
  g.lineWidth = 1.4
  g.beginPath()
  g.moveTo(-8, -6)
  g.quadraticCurveTo(-10, 4, -8, 12)
  g.stroke()
}

function drawHat(g) {
  g.fillStyle = '#2c2238'
  g.beginPath()
  g.ellipse(0, 14, 24, 6, 0, 0, TAU)
  g.fill()
  const crown = new Path2D('M-15 13 L-18 -20 Q0 -25 18 -20 L15 13 Z')
  const gr = g.createLinearGradient(-18, 0, 18, 0)
  gr.addColorStop(0, '#3d3150')
  gr.addColorStop(0.5, '#56486e')
  gr.addColorStop(1, '#2c2238')
  g.fillStyle = gr
  g.fill(crown)
  g.fillStyle = '#d9485f'
  g.fillRect(-16.5, 2, 33, 7)
  g.save()
  g.translate(10, -2)
  g.rotate(0.25)
  g.fillStyle = '#fffaf0'
  g.fillRect(-1, -6, 14, 9)
  g.fillStyle = '#2c2238'
  g.font = 'bold 5.5px Georgia, serif'
  g.fillText('10/6', 0.2, 0.6)
  g.restore()
}

function drawJar(g) {
  const jar = new Path2D('M-12 -14 L12 -14 L13 14 Q0 19 -13 14 Z')
  g.fillStyle = 'rgba(205, 236, 248, 0.5)'
  g.fill(jar)
  g.strokeStyle = 'rgba(80, 130, 160, 0.9)'
  g.lineWidth = 1
  g.stroke(jar)
  g.fillStyle = '#e8d3a8'
  g.fillRect(-13, -19, 26, 6)
  g.fillStyle = '#fff4dc'
  g.fillRect(-11, -4, 22, 11)
  g.fillStyle = '#e8741e'
  g.font = 'italic 4.4px Georgia, serif'
  g.textAlign = 'center'
  g.fillText('MERMELADA', 0, 0.6)
  g.fillText('DE NARANJA', 0, 5)
}

// libro que vuela batiendo las tapas como alas
function drawFlyingBook(g, t, color) {
  const f = Math.sin(t * 9)
  for (const side of [-1, 1]) {
    g.save()
    g.scale(side, 1)
    g.transform(1, -0.35 * f, 0, 1, 0, 0)
    g.fillStyle = '#fbf6ea'
    g.fillRect(0, -13, 20, 25)
    g.fillStyle = color
    g.fillRect(0, -14, 22, 2.5)
    g.fillRect(0, 11.5, 22, 2.5)
    g.fillRect(20, -14, 2.5, 28)
    g.strokeStyle = 'rgba(120, 100, 70, 0.6)'
    g.lineWidth = 0.6
    for (let k = 0; k < 5; k++) {
      g.beginPath()
      g.moveTo(3, -8 + k * 4)
      g.lineTo(17, -8 + k * 4)
      g.stroke()
    }
    g.restore()
  }
  g.fillStyle = color
  g.fillRect(-1.5, -14, 3, 28)
}

// ---------- escena ----------

export function createAliceScene(canvas) {
  const ctx = canvas.getContext('2d')
  const dpr = Math.min(window.devicePixelRatio || 1, 1.25)
  let W = 0
  let H = 0
  let V = 1 // px por unidad virtual
  let VW = 1600 // ancho de la pantalla en unidades virtuales
  let K = 1 // px de dispositivo por unidad virtual
  let CS = 1 // nubes y copas más pequeñas en pantallas estrechas
  let A = null
  let B = null
  let C = null

  const aliceCv = document.createElement('canvas')
  const aliceG = aliceCv.getContext('2d')
  const glowCv = document.createElement('canvas')
  const glowG = glowCv.getContext('2d')
  const MOTE = glowSprite('#fff1b8')
  const MOTE_WARM = glowSprite('#ffc979')
  const PETALS = {
    pink: petalSprite('#ffe2ee', '#ff8fb8'),
    white: petalSprite('#ffffff', '#e8e2f4'),
    red: petalSprite('#ff8d9b', '#d81e3e'),
    gold: petalSprite('#fff1a8', '#f2b52e', true),
    green: petalSprite('#d6f59a', '#62b33f', true),
  }

  function particles(n, seed, kinds) {
    const r = rng(seed)
    return Array.from({ length: n }, () => ({
      x: r(),
      y: r(),
      z: 0.45 + r() * 0.95,
      vx: 0.6 + r() * 0.8,
      vy: 0.3 + r() * 0.6,
      f: 0.6 + r() * 1.4,
      ph: r() * TAU,
      rot: r() * TAU,
      vr: (r() - 0.5) * 3,
      flip: 1.5 + r() * 4,
      s: 0.6 + r() * 0.8,
      kind: kinds[Math.floor(r() * kinds.length)],
    }))
  }
  const petalsA = particles(34, 5, [PETALS.white, PETALS.white, PETALS.gold, PETALS.green, PETALS.pink])
  const petalsC = particles(46, 9, [PETALS.pink, PETALS.pink, PETALS.white, PETALS.red, PETALS.gold])
  const motes = particles(60, 13, [null])

  // pétalos que el viento arrastra (sin estado: dependen solo de t)
  function drawPetals(list, t, o) {
    const sx = VW + 240
    const sy = 1240
    for (const p of list) {
      const x = ((((p.x * sx + o.wind * p.vx * p.z * t + Math.sin(t * p.f + p.ph) * 40) % sx) + sx) % sx) - 120
      const y = ((((p.y * sy + o.fall * p.vy * p.z * t + Math.cos(t * p.f * 0.7 + p.ph) * 26) % sy) + sy) % sy) - 120
      const s = o.size * p.z * p.s
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(p.rot + p.vr * t)
      ctx.scale(Math.cos(p.flip * t + p.ph), 1)
      ctx.globalAlpha = o.alpha * Math.min(1, p.z + 0.2)
      ctx.drawImage(p.kind, -s / 2, -s / 2, s, s)
      ctx.restore()
    }
  }

  function drawMotes(t, sprite, o) {
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    for (const m of motes) {
      const x = m.x * VW + Math.sin(t * m.f + m.ph) * 26
      const y = ((((m.y * 1100 - t * m.vy * o.rise) % 1100) + 1100) % 1100) - 50
      const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * m.f * 1.7 + m.ph))
      const s = m.s * o.size * m.z
      ctx.globalAlpha = tw * o.alpha
      ctx.drawImage(sprite, x - s / 2, y - s / 2, s, s)
    }
    ctx.restore()
  }

  // Cinta de viento: una banda de seda que avanza a lo largo de su recorrido
  // (de x0,y0 a x1,y1) ondulando y retorciéndose.
  function drawRibbon(o) {
    const dx = o.x1 - o.x0
    const dy = o.y1 - o.y0
    const len = Math.hypot(dx, dy) || 1
    const nx = -dy / len
    const ny = dx / len
    const pts = []
    const ws = []
    const N = 48
    for (let i = 0; i <= N; i++) {
      const u = i / N
      const p = o.head - o.span + u * o.span
      const s = Math.sin(p * o.wave + o.ph) * o.amp + Math.sin(p * o.wave * 2.2 + o.ph * 1.6) * o.amp * 0.28
      pts.push([o.x0 + dx * p + nx * s, o.y0 + dy * p + ny * s])
      ws.push(o.w * Math.pow(Math.sin(Math.PI * u), 0.7) * (0.22 + 0.78 * Math.abs(Math.sin(p * 7 + o.ph))))
    }
    const [r, g, b] = o.color
    const gr = ctx.createLinearGradient(pts[0][0], pts[0][1], pts[N][0], pts[N][1])
    gr.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0)`)
    gr.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${o.alpha})`)
    gr.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`)
    ctx.fillStyle = gr
    ctx.fill(band(pts, ws))
  }

  function drawBird(x, y, s, flap) {
    const f = Math.sin(flap)
    ctx.save()
    ctx.translate(x, y)
    ctx.scale(s, s)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)'
    ctx.beginPath()
    ctx.moveTo(-10, -f * 6)
    ctx.quadraticCurveTo(-4, -2 - f * 3, 0, 0)
    ctx.quadraticCurveTo(4, -2 - f * 3, 10, -f * 6)
    ctx.quadraticCurveTo(4, 1 - f * 1.5, 0, 2.4)
    ctx.quadraticCurveTo(-4, 1 - f * 1.5, -10, -f * 6)
    ctx.fill()
    ctx.restore()
  }

  // Alicia se pinta en un lienzo aparte: así la luz de cada escena (contraluz,
  // luz desde abajo) solo cae sobre ella, y su halo es una copia desenfocada.
  function paintAlice(o, light = {}) {
    const w = o.h * 0.8
    const hh = o.h * 1.34
    const cw = Math.ceil(w * K)
    const ch = Math.ceil(hh * K)
    if (aliceCv.width < cw || aliceCv.height < ch) {
      aliceCv.width = Math.max(cw, aliceCv.width)
      aliceCv.height = Math.max(ch, aliceCv.height)
    }
    const g = aliceG
    g.setTransform(1, 0, 0, 1, 0, 0)
    g.globalCompositeOperation = 'source-over'
    g.clearRect(0, 0, aliceCv.width, aliceCv.height)
    const sc = (o.h / 100) * K
    g.setTransform(sc, 0, 0, sc, cw / 2, ch - o.h * 0.05 * K)
    drawAlice(g, { ...o, lw: Math.max(0.42, 1.1 / sc) })
    g.setTransform(1, 0, 0, 1, 0, 0)
    g.globalCompositeOperation = 'source-atop'
    if (light.back) {
      // contraluz: los bordes de arriba se encienden en cálido
      const gr = g.createLinearGradient(0, 0, 0, ch)
      gr.addColorStop(0, `rgba(255, 236, 190, ${0.4 * light.back})`)
      gr.addColorStop(0.45, 'rgba(255, 236, 190, 0)')
      g.fillStyle = gr
      g.fillRect(0, 0, cw, ch)
    }
    if (light.side) {
      const gr = g.createLinearGradient(light.side > 0 ? cw : 0, 0, light.side > 0 ? 0 : cw, 0)
      gr.addColorStop(0, `rgba(255, 228, 160, ${0.28 * Math.abs(light.side)})`)
      gr.addColorStop(0.6, 'rgba(255, 228, 160, 0)')
      g.fillStyle = gr
      g.fillRect(0, 0, cw, ch)
    }
    if (light.under) {
      const gr = g.createLinearGradient(0, ch, 0, 0)
      gr.addColorStop(0, `rgba(255, 246, 214, ${0.85 * light.under})`)
      gr.addColorStop(0.7, 'rgba(255, 246, 214, 0)')
      g.fillStyle = gr
      g.fillRect(0, 0, cw, ch)
    }
    g.globalCompositeOperation = 'source-over'
    const x0 = o.x - w / 2
    const y0 = o.y - (hh - o.h * 0.05)
    ctx.save()
    if (o.alpha !== undefined) ctx.globalAlpha = o.alpha
    if (light.glow) {
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      ctx.globalAlpha *= light.glow
      ctx.filter = `blur(${Math.max(2, o.h * 0.02 * K)}px)`
      ctx.drawImage(aliceCv, 0, 0, cw, ch, x0, y0, w, hh)
      ctx.restore()
    }
    ctx.drawImage(aliceCv, 0, 0, cw, ch, x0, y0, w, hh)
    ctx.restore()
  }

  function setBase() {
    ctx.setTransform(K, 0, 0, K, 0, 0)
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
    ctx.filter = 'none'
  }

  // cámara: el punto F del mundo queda en el punto S de la pantalla, con zoom z
  function setCam(S, F, z) {
    ctx.setTransform(K, 0, 0, K, 0, 0)
    ctx.translate(S[0], S[1])
    ctx.scale(z, z)
    ctx.translate(-F[0], -F[1])
  }

  // ================= A: la orilla del río =================

  function buildA() {
    const res = K
    const a = { hole: { x: VW * 0.62, y: 782, rx: 46, ry: 13 } }
    const sunPal = { shade: '#cdd7f2', deep: '#adbbe6', body: '#ffffff', light: '#fffaf0', lx: -1 }

    a.sky = makeLayer(VW, 660, res * 0.6)
    let g = a.sky.g
    g.fillStyle = vgrad(g, 0, 660, [
      [0, '#2a7fd8'],
      [0.45, '#5aaeee'],
      [0.8, '#a5d8f6'],
      [1, '#e2f4ff'],
    ])
    g.fillRect(0, 0, VW, 660)
    let sun = g.createRadialGradient(VW * 0.84, 80, 10, VW * 0.84, 80, 560)
    sun.addColorStop(0, 'rgba(255, 248, 220, 0.95)')
    sun.addColorStop(0.25, 'rgba(255, 232, 170, 0.45)')
    sun.addColorStop(1, 'rgba(255, 232, 170, 0)')
    g.fillStyle = sun
    g.fillRect(0, 0, VW, 660)
    cumulus(g, VW * 0.12, 545, 600 * CS, 320 * CS, 3, sunPal)
    cumulus(g, VW * 0.58, 500, 760 * CS, 400 * CS, 7, sunPal)
    cumulus(g, VW * 1.02, 560, 500 * CS, 250 * CS, 11, sunPal)
    cumulus(g, VW * 0.34, 175, 380 * CS, 80 * CS, 17, { ...sunPal, shade: '#dde5f7' })
    cumulus(g, VW * 0.8, 250, 300 * CS, 64 * CS, 19, { ...sunPal, shade: '#dde5f7' })

    // colinas lejanas y el río
    a.hills = makeLayer(VW, 280, res * 0.7)
    g = a.hills.g
    const ridge = (base, amp, f, ph, top, bot) => {
      g.fillStyle = vgrad(g, base - amp * 2, 280, [
        [0, top],
        [1, bot],
      ])
      g.beginPath()
      g.moveTo(0, 280)
      for (let x = 0; x <= VW + 20; x += 20) g.lineTo(x, base + Math.sin((x / VW) * f + ph) * amp + Math.sin((x / VW) * f * 2.7 + ph * 2) * amp * 0.35)
      g.lineTo(VW, 280)
      g.fill()
    }
    ridge(70, 26, 5, 0.4, '#a9d6dd', '#9fd0c4')
    ridge(118, 22, 7, 2.1, '#8fcf9f', '#7cc48d')
    g.fillStyle = vgrad(g, 120, 200, [
      [0, '#7fd0f4'],
      [1, '#3d9fe3'],
    ])
    g.beginPath()
    g.moveTo(0, 150)
    g.bezierCurveTo(VW * 0.3, 138, VW * 0.6, 150, VW, 136)
    g.lineTo(VW, 168)
    g.bezierCurveTo(VW * 0.6, 186, VW * 0.3, 172, 0, 190)
    g.fill()
    g.fillStyle = 'rgba(226, 244, 255, 0.45)'
    g.fillRect(0, 0, VW, 90)
    a.riverY = 420 + 160

    // prado, con la orilla ondulada
    a.meadow = makeLayer(VW, 460, res)
    g = a.meadow.g
    g.fillStyle = vgrad(g, 0, 460, [
      [0, '#a3e264'],
      [0.35, '#7fd255'],
      [1, '#3f9c3d'],
    ])
    g.beginPath()
    g.moveTo(0, 460)
    g.lineTo(0, 22)
    g.bezierCurveTo(VW * 0.3, 4, VW * 0.55, 30, VW, 8)
    g.lineTo(VW, 460)
    g.fill()
    g.save()
    g.clip()
    sun = g.createRadialGradient(VW * 0.8, 40, 20, VW * 0.8, 40, VW * 0.5)
    sun.addColorStop(0, 'rgba(255, 246, 190, 0.45)')
    sun.addColorStop(1, 'rgba(255, 246, 190, 0)')
    g.fillStyle = sun
    g.fillRect(0, 0, VW, 460)
    g.fillStyle = 'rgba(30, 90, 40, 0.28)'
    g.beginPath()
    g.ellipse(VW * 0.12, 190, VW * 0.18, 40, 0, 0, TAU)
    g.fill()
    grassStrokes(g, 0, 10, VW, 460, 23, ['#5fb648', '#8fd85a', '#3f973a', '#b4ea7a'], Math.round(VW * 2.2))
    let r = rng(29)
    for (let i = 0; i < VW * 0.09; i++) {
      const d = r()
      const y = 20 + d * d * 420
      daisy(g, r() * VW, y, 2 + d * 7, r() < 0.8 ? '#ffffff' : '#ffe57a')
    }
    g.restore()
    a.meadowY = 586

    // seto con la madriguera (alta resolución: la cámara se acerca mucho)
    a.hedge = makeLayer(420, 230, res * 2.4)
    g = a.hedge.g
    const leaf = { dark: '#2b7440', mid: '#3d9350', light: '#69bd5c', spark: '#b5e67f', lx: -1 }
    foliage(g, 120, 120, 110, 80, 31, leaf, 14)
    foliage(g, 290, 105, 130, 95, 37, leaf, 16)
    foliage(g, 210, 150, 160, 70, 41, leaf, 14)
    g.fillStyle = '#6b4a2c'
    g.beginPath()
    g.ellipse(210, 190, 62, 20, 0, Math.PI, TAU)
    g.fill()
    a.hedgeX = a.hole.x - 210 * HEDGE
    a.hedgeY = a.hole.y - 190 * HEDGE

    // el árbol de la orilla, a la izquierda
    a.tree = makeLayer(VW * 0.42, 840, res * 0.8)
    g = a.tree.g
    const tx = VW * 0.13
    g.fillStyle = vgrad(g, 300, 840, [
      [0, '#6b4429'],
      [1, '#4a2e1b'],
    ])
    g.beginPath()
    g.moveTo(tx - 34, 820)
    g.bezierCurveTo(tx - 20, 640, tx - 30, 460, tx - 10, 300)
    g.lineTo(tx + 26, 300)
    g.bezierCurveTo(tx + 20, 470, tx + 40, 650, tx + 58, 820)
    g.closePath()
    g.fill()
    g.strokeStyle = '#4a2e1b'
    g.lineWidth = 14
    g.beginPath()
    g.moveTo(tx + 6, 420)
    g.quadraticCurveTo(tx + 120 * CS, 330, tx + 230 * CS, 300)
    g.stroke()
    const treePal = { dark: '#2a6e3e', mid: '#3b8f4c', light: '#73c25f', spark: '#c2ec8a', lx: -1 }
    foliage(g, tx + 40 * CS, 170, 300 * CS, 190, 43, treePal, 22)
    foliage(g, tx + 250 * CS, 260, 150 * CS, 100, 47, treePal, 12)
    a.treeY = -60

    // primer plano desenfocado: hierba alta y flores en las esquinas
    const fg = makeLayer(VW, 300, res * 0.5)
    g = fg.g
    r = rng(53)
    for (const [cx, n] of [[VW * 0.04, 26], [VW * 0.95, 22]]) {
      for (let i = 0; i < n; i++) {
        const x = cx + (r() - 0.5) * 260
        const h = 110 + r() * 170
        g.strokeStyle = ['#2f8a3a', '#4fae45', '#277533'][i % 3]
        g.lineWidth = 7 + r() * 6
        g.lineCap = 'round'
        g.beginPath()
        g.moveTo(x, 310)
        g.quadraticCurveTo(x + (r() - 0.5) * 70, 310 - h * 0.6, x + (r() - 0.5) * 120, 310 - h)
        g.stroke()
      }
      for (let i = 0; i < 5; i++) daisy(g, cx + (r() - 0.5) * 220, 120 + r() * 120, 22 + r() * 12)
    }
    a.fg = blurLayer(fg, Math.max(3, 9 * K * 0.5))
    return a
  }

  function drawA(t) {
    const a = A
    // cámara: se acerca a la madriguera y luego se mete por ella
    const pre = ease(win(t, 0, T.dive[0]))
    const Z0 = 1 + 0.55 * pre
    const Fp = [VW * 0.58, 760]
    const d = win(t, T.dive[0], T.dive[1])
    let F = Fp
    let S = Fp
    let Z = Z0
    if (d > 0) {
      const hs = [Fp[0] + (a.hole.x - Fp[0]) * Z0, Fp[1] + (a.hole.y - Fp[1]) * Z0]
      F = [a.hole.x, a.hole.y]
      S = [lerp(hs[0], VW / 2, ease(d)), lerp(hs[1], 520, ease(d))]
      Z = Z0 * Math.exp(Math.log(28) * easeIn(d))
    }
    const layer = (par) => setCam(S, F, 1 + (Z - 1) * par)

    layer(0.2)
    ctx.drawImage(a.sky.c, 0, -60, VW, 660)
    layer(0.45)
    ctx.drawImage(a.hills.c, 0, 420, VW, 280)
    // destellos del río
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    for (let i = 0; i < 26; i++) {
      const x = ((i * 137.7) % VW) + Math.sin(t * 0.7 + i) * 8
      const y = a.riverY - 12 + ((i * 53) % 26)
      const tw = Math.max(0, Math.sin(t * 3.1 + i * 1.7))
      ctx.globalAlpha = tw * 0.8
      ctx.drawImage(MOTE, x - 7, y - 7, 14, 14)
    }
    ctx.restore()

    layer(1)
    ctx.drawImage(a.meadow.c, 0, a.meadowY, VW, 460)
    ctx.drawImage(a.hedge.c, a.hedgeX, a.hedgeY, 420 * HEDGE, 230 * HEDGE)
    // la madriguera
    const ho = a.hole
    const hole = ctx.createRadialGradient(ho.x, ho.y + 2, 2, ho.x, ho.y, ho.rx)
    hole.addColorStop(0, '#000000')
    hole.addColorStop(0.7, '#120a05')
    hole.addColorStop(1, '#3a2614')
    ctx.fillStyle = hole
    ctx.beginPath()
    ctx.ellipse(ho.x, ho.y, ho.rx, ho.ry, 0, 0, TAU)
    ctx.fill()
    ctx.drawImage(a.tree.c, 0, a.treeY, VW * 0.42, 840)

    // el Conejo Blanco: entra por la derecha (lejos de Alicia), mira el
    // reloj sin dejar de andar y se mete en la madriguera
    const rp = win(t, T.rabbit[0], T.rabbit[1])
    if (rp > 0 && rp < 1) {
      let x
      let y = 812
      if (t < T.watch[0]) x = lerp(VW + 90, VW * 0.86, ease(win(t, T.rabbit[0], T.watch[0])))
      else if (t < T.watch[1]) x = lerp(VW * 0.86, VW * 0.79, win(t, T.watch[0], T.watch[1]))
      else {
        const k = ease(win(t, T.watch[1], T.rabbit[1]))
        x = lerp(VW * 0.79, ho.x, k)
        y = lerp(812, ho.y + 2, k)
      }
      const watch = smooth(win(t, T.watch[0], T.watch[0] + 0.12)) * (1 - smooth(win(t, T.watch[1] - 0.08, T.watch[1] + 0.05)))
      const dive = win(t, T.rabbit[1] - 0.14, T.rabbit[1])
      const h = (y - HORIZON) * 0.62
      ctx.save()
      if (dive > 0) {
        ctx.beginPath()
        ctx.rect(x - 200, 0, 400, ho.y + 1)
        ctx.clip()
      }
      ctx.translate(x, y + dive * 40)
      ctx.scale(h / 64, h / 64)
      drawRabbit(ctx, {
        run: t * 3.2,
        watch,
        glint: Math.max(0, 1 - Math.abs(t - T.glint) / 0.16),
        dir: -1,
        lw: Math.max(0.5, 64 / h / K),
      })
      ctx.restore()
    }

    // Alicia va tras él (corre un poco: tiene prisa)
    const ap = ease(win(t, T.walkA[0], T.walkA[1]))
    const hop = win(t, T.hop[0], T.hop[1])
    if (hop < 1) {
      const fx = lerp(VW * 0.33, ho.x - 4, ap)
      const ground = lerp(985, ho.y + 6, ap)
      const fy = ground + Math.sin(hop * Math.PI) * -14 + easeIn(hop) * 60
      const depthH = Math.max(60, (ground - HORIZON) * 0.72)
      ctx.save()
      ctx.fillStyle = 'rgba(20, 70, 25, 0.25)'
      ctx.beginPath()
      ctx.ellipse(fx, ground, depthH * 0.17, depthH * 0.035, 0, 0, TAU)
      ctx.fill()
      if (hop > 0) {
        ctx.beginPath()
        ctx.rect(fx - 300, -400, 600, ho.y + 400 + 2)
        ctx.clip()
      }
      paintAlice(
        { x: fx, y: fy, h: depthH, t, step: t * 2.3, stride: 1 - hop, arms: 'swing', wind: 0.6, alpha: 1 - easeIn(hop) },
        { side: 1, glow: 0.12 }
      )
      ctx.restore()
    }

    // hierba del primer plano, desenfocada
    layer(1.5)
    ctx.drawImage(a.fg.c, 0, 720, VW, 300)

    // viento: pétalos, motas de sol y una cinta que cruza el prado
    setBase()
    drawPetals(petalsA, t, { wind: 140, fall: 60, size: 22, alpha: 0.9 })
    drawMotes(t, MOTE, { rise: 40, size: 22, alpha: 0.55 })
    drawRibbon({
      x0: -VW * 0.1,
      y0: 640,
      x1: VW * 1.1,
      y1: 520,
      amp: 60,
      wave: 9,
      ph: t * 1.6,
      w: 14,
      head: lerp(0.2, 1.4, win(t, 0, 2.4)),
      span: 0.55,
      alpha: 0.5,
      color: [255, 252, 240],
    })

    // dentro del agujero ya se ve la caída
    if (d > 0) {
      setCam(S, F, Z)
      const ry = lerp(ho.ry, ho.rx, ease(d))
      const iris = new Path2D()
      iris.ellipse(ho.x, ho.y, ho.rx, ry, 0, 0, TAU)
      ctx.fillStyle = '#000'
      ctx.fill(iris)
      ctx.save()
      ctx.clip(iris)
      setBase()
      ctx.globalAlpha = smooth(win(d, 0.25, 0.85))
      drawB(t)
      setCam(S, F, Z)
      const rim = ctx.createRadialGradient(ho.x, ho.y, ho.rx * 0.55, ho.x, ho.y, ho.rx)
      rim.addColorStop(0, 'rgba(0, 0, 0, 0)')
      rim.addColorStop(1, 'rgba(10, 5, 2, 0.95)')
      ctx.globalAlpha = 1
      ctx.fillStyle = rim
      ctx.save()
      ctx.translate(ho.x, ho.y)
      ctx.scale(1, ry / ho.rx)
      ctx.translate(-ho.x, -ho.y)
      ctx.fillRect(ho.x - ho.rx, ho.y - ho.rx, ho.rx * 2, ho.rx * 2)
      ctx.restore()
      ctx.restore()
    }
  }

  // ================= B: la caída por la madriguera =================

  const SHELF = 250
  const shelfCache = new Map()
  const BOOK_COLORS = ['#d94f4f', '#3f7fd8', '#4fb06a', '#e0b03a', '#8d5ad8', '#e07a3a', '#2fa8a8', '#c44d8f']

  function shelfItems(k) {
    let items = shelfCache.get(k)
    if (items) return items
    const r = rng(k * 7919 + 101)
    items = { books: [], wall: [] }
    let x = -20
    while (x < VW + 20) {
      if (r() < 0.08) {
        items.books.push({ type: 'jar', x, w: 34 })
        x += 40
      } else if (r() < 0.05) {
        x += 30 + r() * 50 // hueco
      } else {
        const w = 13 + r() * 13
        items.books.push({ type: 'book', x, w, h: 58 + r() * 40, c: BOOK_COLORS[Math.floor(r() * BOOK_COLORS.length)], lean: r() < 0.12 ? (r() - 0.5) * 0.3 : 0 })
        x += w + 1.5
      }
    }
    const n = 2 + Math.floor(r() * 3)
    for (let i = 0; i < n; i++) {
      const kind = r() < 0.4 ? 'lamp' : r() < 0.6 ? 'map' : 'frame'
      items.wall.push({ kind, x: (i + 0.2 + r() * 0.6) * (VW / n), w: 70 + r() * 60, h: 52 + r() * 40, hue: Math.floor(r() * 360) })
    }
    shelfCache.set(k, items)
    return items
  }

  const shelfY = (x, yc) => {
    const xn = (x - VW / 2) / (VW / 2)
    return yc + (yc - 520) * 0.22 * xn * xn
  }

  function drawShelf(k, yc, lamps) {
    const items = shelfItems(k)
    // lo que cuelga en la pared, entre este estante y el de arriba
    for (const it of items.wall) {
      const y = shelfY(it.x, yc) - SHELF * 0.7
      if (it.kind === 'lamp') {
        ctx.fillStyle = '#7a5a2e'
        ctx.fillRect(it.x - 3, y, 6, 22)
        ctx.fillStyle = '#ffd77a'
        ctx.beginPath()
        ctx.ellipse(it.x, y - 6, 7, 11, 0, 0, TAU)
        ctx.fill()
        lamps.push([it.x, y - 6])
      } else {
        ctx.save()
        ctx.translate(it.x, y)
        ctx.rotate(Math.sin(k * 3.1 + it.x) * 0.05)
        ctx.strokeStyle = 'rgba(60, 40, 20, 0.8)'
        ctx.lineWidth = 1.2
        ctx.beginPath()
        ctx.moveTo(-it.w * 0.3, -it.h / 2)
        ctx.lineTo(0, -it.h / 2 - 16)
        ctx.lineTo(it.w * 0.3, -it.h / 2)
        ctx.stroke()
        if (it.kind === 'map') {
          ctx.fillStyle = '#ecd9a8'
          ctx.fillRect(-it.w / 2, -it.h / 2, it.w, it.h)
          ctx.fillStyle = 'rgba(76, 150, 190, 0.55)'
          ctx.beginPath()
          ctx.ellipse(-it.w * 0.15, 0, it.w * 0.25, it.h * 0.2, 0.5, 0, TAU)
          ctx.fill()
          ctx.fillStyle = 'rgba(96, 160, 80, 0.6)'
          ctx.beginPath()
          ctx.ellipse(it.w * 0.18, -it.h * 0.1, it.w * 0.16, it.h * 0.24, -0.4, 0, TAU)
          ctx.fill()
        } else {
          ctx.fillStyle = '#d9b25a'
          ctx.fillRect(-it.w / 2 - 5, -it.h / 2 - 5, it.w + 10, it.h + 10)
          ctx.fillStyle = `hsl(${it.hue}, 45%, 58%)`
          ctx.fillRect(-it.w / 2, -it.h / 2, it.w, it.h)
          ctx.fillStyle = 'rgba(255, 255, 255, 0.35)'
          ctx.beginPath()
          ctx.arc(0, -it.h * 0.05, it.h * 0.22, 0, TAU)
          ctx.fill()
        }
        ctx.restore()
      }
    }
    // libros y tarros sobre la balda
    for (const it of items.books) {
      const xn = (it.x - VW / 2) / (VW / 2)
      const sc = 1 + 0.16 * xn * xn
      const base = shelfY(it.x + it.w / 2, yc)
      if (it.type === 'jar') {
        ctx.save()
        ctx.translate(it.x + 17, base - 19 * sc)
        ctx.scale(sc, sc)
        drawJar(ctx)
        ctx.restore()
        continue
      }
      ctx.save()
      ctx.translate(it.x, base)
      ctx.rotate(it.lean)
      ctx.scale(sc, sc)
      ctx.fillStyle = it.c
      ctx.fillRect(0, -it.h, it.w, it.h)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.18)'
      ctx.fillRect(1, -it.h, it.w * 0.22, it.h)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.18)'
      ctx.fillRect(it.w * 0.78, -it.h, it.w * 0.22, it.h)
      ctx.fillStyle = '#f0cf72'
      ctx.fillRect(1, -it.h * 0.86, it.w - 2, 2)
      ctx.fillRect(1, -it.h * 0.16, it.w - 2, 2)
      ctx.restore()
    }
    // la balda, curvada como la pared del pozo
    ctx.beginPath()
    for (let x = -20; x <= VW + 20; x += 40) ctx.lineTo(x, shelfY(x, yc))
    for (let x = VW + 20; x >= -20; x -= 40) {
      const xn = (x - VW / 2) / (VW / 2)
      ctx.lineTo(x, shelfY(x, yc) + 13 * (1 + 0.16 * xn * xn))
    }
    ctx.closePath()
    ctx.fillStyle = '#9a6537'
    ctx.fill()
    ctx.strokeStyle = '#d8a066'
    ctx.lineWidth = 2
    ctx.beginPath()
    for (let x = -20; x <= VW + 20; x += 40) ctx.lineTo(x, shelfY(x, yc))
    ctx.stroke()
  }

  // cuánto ha caído (en unidades): rápido al entrar, muy despacio en medio
  // ("o el pozo era muy hondo, o ella caía muy despacio") y deprisa al final
  function fallP(t) {
    const D = T.fall[1] - T.fall[0]
    const u = (t - T.fall[0]) / D
    if (u < 0) return u * D * 1500
    const v = Math.min(u, 1)
    return D * (375 * (1 - Math.pow(1 - v, 4)) + 320 * v + 640 * Math.pow(v, 5))
  }

  const FLOATERS = [
    { type: 'teacup', x: 0.2, y: 1150, k: 0.55, rot: 0.6, size: 1.3 },
    { type: 'watch', x: 0.8, y: 1300, k: 0.5, rot: -0.4, size: 1.4 },
    { type: 'card', x: 0.32, y: 1420, k: 0.62, rot: 1.6, size: 1.5, suit: 'heart', front: true },
    { type: 'key', x: 0.68, y: 1560, k: 0.58, rot: 1.1, size: 1.5 },
    { type: 'bottle', x: 0.86, y: 1700, k: 0.52, rot: 0.3, size: 1.6, front: true },
    { type: 'hat', x: 0.14, y: 1840, k: 0.6, rot: -0.5, size: 1.6 },
    { type: 'book', x: 0.72, y: 1980, k: 0.66, rot: 0.2, size: 1.6, c: '#3f7fd8', front: true },
    { type: 'card', x: 0.58, y: 2100, k: 0.55, rot: -1.9, size: 1.3, suit: 'spade' },
    { type: 'teacup', x: 0.9, y: 2240, k: 0.6, rot: -0.8, size: 1.1 },
    { type: 'jar', x: 0.26, y: 2340, k: 0.5, rot: 0.5, size: 1.3 },
    { type: 'book', x: 0.4, y: 2480, k: 0.62, rot: -0.3, size: 1.2, c: '#d94f4f' },
    { type: 'card', x: 0.78, y: 2600, k: 0.6, rot: 2.2, size: 1.3, suit: 'diamond', front: true },
  ]

  function drawFloater(f, t, p) {
    const y = f.y - p * f.k
    if (y < -150 || y > 1150) return
    const x = f.x * VW + Math.sin(t * 0.9 + f.rot * 3) * 20
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(f.rot + t * f.rot * 0.8)
    const s = f.size * 1.5 * (f.front ? 1.35 : 1)
    ctx.scale(s, s)
    if (f.type === 'teacup') drawTeacup(ctx)
    else if (f.type === 'watch') drawWatch(ctx, t)
    else if (f.type === 'card') drawCard(ctx, f.suit, Math.cos(t * 2.4 + f.rot * 2))
    else if (f.type === 'key') drawKey(ctx)
    else if (f.type === 'bottle') drawBottle(ctx)
    else if (f.type === 'hat') drawHat(ctx)
    else if (f.type === 'jar') drawJar(ctx)
    else if (f.type === 'book') drawFlyingBook(ctx, t + f.rot, f.c)
    ctx.restore()
  }

  function buildB() {
    const b = {}
    // pared del pozo: más oscura a los lados, como el interior de un cilindro
    b.wall = ctx.createLinearGradient(0, 0, VW, 0)
    b.wall.addColorStop(0, '#1d1009')
    b.wall.addColorStop(0.22, '#4a2b18')
    b.wall.addColorStop(0.5, '#714728')
    b.wall.addColorStop(0.78, '#4a2b18')
    b.wall.addColorStop(1, '#1d1009')
    b.sides = ctx.createLinearGradient(0, 0, VW, 0)
    b.sides.addColorStop(0, 'rgba(12, 6, 3, 0.85)')
    b.sides.addColorStop(0.18, 'rgba(12, 6, 3, 0)')
    b.sides.addColorStop(0.82, 'rgba(12, 6, 3, 0)')
    b.sides.addColorStop(1, 'rgba(12, 6, 3, 0.85)')
    // objetos grandes y desenfocados que pasan junto a la cámara
    const cup = makeLayer(90, 70, K * 2.2)
    cup.g.translate(45, 35)
    cup.g.scale(1.6, 1.6)
    drawTeacup(cup.g)
    b.cup = blurLayer(cup, 7 * K)
    const book = makeLayer(90, 70, K * 2.2)
    book.g.translate(45, 35)
    book.g.scale(1.6, 1.6)
    drawFlyingBook(book.g, 0.3, '#8d5ad8')
    b.book = blurLayer(book, 7 * K)
    return b
  }

  function drawB(t) {
    const p = fallP(t)
    ctx.fillStyle = B.wall
    ctx.fillRect(0, 0, VW, 1000)
    const lamps = []
    const k0 = Math.floor((p - 600) / SHELF)
    const k1 = Math.ceil((p + 1100) / SHELF)
    for (let k = k0; k <= k1; k++) {
      const yc = k * SHELF - p + 520
      if (yc < -200 || yc > 1300) continue
      drawShelf(k, yc, lamps)
    }
    ctx.fillStyle = B.sides
    ctx.fillRect(0, 0, VW, 1000)
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    for (const [x, y] of lamps) {
      const gl = ctx.createRadialGradient(x, y, 4, x, y, 170)
      gl.addColorStop(0, 'rgba(255, 200, 110, 0.55)')
      gl.addColorStop(1, 'rgba(255, 160, 70, 0)')
      ctx.fillStyle = gl
      ctx.fillRect(x - 170, y - 170, 340, 340)
    }
    ctx.restore()
    drawMotes(t, MOTE_WARM, { rise: -120, size: 16, alpha: 0.5 })

    // cintas que suben en espiral alrededor de Alicia
    for (const [i, side] of [[0, -1], [1, 1]]) {
      drawRibbon({
        x0: VW / 2 + side * 170,
        y0: 1150,
        x1: VW / 2 - side * 140,
        y1: -150,
        amp: 150,
        wave: 6,
        ph: t * 2.2 + i * 2,
        w: 24,
        head: ((t * 0.55 + i * 0.5) % 1.6) - 0.1,
        span: 0.6,
        alpha: 0.3,
        color: [255, 240, 210],
      })
    }

    for (const f of FLOATERS) if (!f.front) drawFloater(f, t, p)

    // Alicia flota con el pelo hacia arriba y la falda abierta
    const enter = easeOut(win(t, T.fall[0] - 0.4, T.fall[0] + 0.6))
    const light = win(t, T.light[0], T.light[1])
    paintAlice(
      {
        x: VW / 2 + Math.sin(t * 0.9) * 18,
        y: lerp(-80, 740, enter) + Math.sin(t * 1.4) * 10,
        h: 340,
        t,
        float: 1,
        wind: 0.4,
        tilt: Math.sin(t * 1.3) * 0.06,
      },
      { under: 0.25 + light * 0.75, glow: 0.18 + light * 0.3 }
    )

    for (const f of FLOATERS) if (f.front) drawFloater(f, t, p)

    // primer plano: una taza y un libro enormes pasan desenfocados
    for (const [img, x, t0] of [
      [B.cup, VW * 0.1, T.fall[0] + 0.5],
      [B.book, VW * 0.88, T.fall[0] + 1.6],
    ]) {
      const y = 1250 - (t - t0) * 2600
      if (y > -400 && y < 1300) ctx.drawImage(img.c, x - 160, y - 125, 320, 250)
    }

    // la luz del fondo sube y lo inunda todo
    if (light > 0) {
      const gl = ctx.createLinearGradient(0, 1000, 0, 1000 - 1100 * light)
      gl.addColorStop(0, `rgba(255, 246, 220, ${0.95 * light})`)
      gl.addColorStop(1, 'rgba(255, 246, 220, 0)')
      ctx.fillStyle = gl
      ctx.fillRect(0, 0, VW, 1000)
      const flood = win(t, T.light[1] - 0.3, T.light[1])
      if (flood > 0) {
        ctx.fillStyle = `rgba(255, 250, 236, ${easeIn(flood)})`
        ctx.fillRect(0, 0, VW, 1000)
      }
    }
  }

  // ================= C: el País de las Maravillas =================

  const PATH_W = 0.34 // medio ancho del sendero, en unidades del mundo
  let meander = 1
  // el sendero serpentea: desplazamiento lateral según la distancia recorrida
  const pathX = (w) => meander * (1.15 * Math.sin(0.42 * (w - 1.4)) * smooth(cl((w - 1.2) / 2.5)) + 0.5 * Math.sin(0.19 * w + 1))

  function buildC() {
    const res = K
    const c = {}
    meander = Math.min(1, VW / 1600)
    const back = { shade: '#c9cdf0', deep: '#aab3e6', body: '#ffffff', light: '#fff4fa', lx: 1, rim: 'rgba(255, 250, 225, 0.95)' }

    c.sky = makeLayer(VW, 640, res * 0.6)
    let g = c.sky.g
    g.fillStyle = vgrad(g, 0, 640, [
      [0, '#2a7de0'],
      [0.42, '#56aff2'],
      [0.75, '#a6dcfa'],
      [1, '#eef9ff'],
    ])
    g.fillRect(0, 0, VW, 640)
    const sun = g.createRadialGradient(VW / 2, 470, 10, VW / 2, 470, 620)
    sun.addColorStop(0, 'rgba(255, 252, 232, 1)')
    sun.addColorStop(0.18, 'rgba(255, 240, 200, 0.6)')
    sun.addColorStop(1, 'rgba(255, 240, 200, 0)')
    g.fillStyle = sun
    g.fillRect(0, 0, VW, 640)
    cumulus(g, VW * 0.16, 560, 720 * CS, 470 * CS, 61, { ...back, lx: -1 })
    cumulus(g, VW * 0.86, 560, 640 * CS, 420 * CS, 67, back)
    cumulus(g, VW * 0.4, 180, 420 * CS, 74 * CS, 71, { ...back, shade: '#dfe4f7', rim: null })
    cumulus(g, VW * 0.72, 110, 330 * CS, 58 * CS, 73, { ...back, shade: '#dfe4f7', rim: null })

    // montañas lila y el castillo de la Reina, a contraluz (la capa tiene 60
    // de margen arriba para las torres)
    c.far = makeLayer(VW, 300, res * 0.8)
    g = c.far.g
    g.translate(0, 60)
    const ridge = (base, amp, f, ph, top, bot) => {
      g.fillStyle = vgrad(g, base - amp * 2, 240, [
        [0, top],
        [1, bot],
      ])
      g.beginPath()
      g.moveTo(0, 240)
      for (let x = 0; x <= VW + 20; x += 20) g.lineTo(x, base + Math.sin((x / VW) * f + ph) * amp + Math.sin((x / VW) * f * 3.1 + ph) * amp * 0.3)
      g.lineTo(VW, 240)
      g.fill()
    }
    ridge(80, 40, 6, 1, '#c3c8f0', '#b9c2ee')
    ridge(130, 28, 9, 3, '#a9bceb', '#9fc7d9')
    // colina del castillo
    g.fillStyle = vgrad(g, 110, 240, [
      [0, '#9fdc93'],
      [1, '#7cc67a'],
    ])
    g.beginPath()
    g.moveTo(VW / 2 - 260, 240)
    g.bezierCurveTo(VW / 2 - 160, 120, VW / 2 + 160, 120, VW / 2 + 260, 240)
    g.fill()
    const cx = VW / 2
    const wallC = '#f1d7e6'
    const shadeC = '#d9b4cf'
    const roofC = '#e2465f'
    const tower = (x, top, w, roof) => {
      g.fillStyle = vgrad(g, top, 160, [
        [0, wallC],
        [1, shadeC],
      ])
      g.fillRect(x - w / 2, top, w, 170 - top)
      g.fillStyle = roof
      g.beginPath()
      g.moveTo(x - w / 2 - 4, top)
      g.lineTo(x, top - w * 1.4)
      g.lineTo(x + w / 2 + 4, top)
      g.fill()
      g.strokeStyle = 'rgba(255, 250, 230, 0.9)'
      g.lineWidth = 1.5
      g.beginPath()
      g.moveTo(x + w / 2, top)
      g.lineTo(x + w / 2, 170)
      g.moveTo(x, top - w * 1.4)
      g.lineTo(x + w / 2 + 4, top)
      g.stroke()
      g.fillStyle = '#6b4f93'
      g.beginPath()
      g.roundRect(x - 3, top + 14, 6, 12, [3, 3, 0, 0])
      g.fill()
      g.strokeStyle = '#c23a52'
      g.lineWidth = 1.2
      g.beginPath()
      g.moveTo(x, top - w * 1.4)
      g.lineTo(x, top - w * 1.4 - 14)
      g.stroke()
      g.fillStyle = '#e2465f'
      g.beginPath()
      g.moveTo(x, top - w * 1.4 - 14)
      g.lineTo(x + 12, top - w * 1.4 - 10)
      g.lineTo(x, top - w * 1.4 - 6)
      g.fill()
    }
    g.fillStyle = vgrad(g, 110, 170, [
      [0, wallC],
      [1, shadeC],
    ])
    g.fillRect(cx - 70, 112, 140, 60)
    for (let i = 0; i < 9; i++) g.fillRect(cx - 70 + i * 16, 104, 9, 9)
    tower(cx - 78, 90, 26, roofC)
    tower(cx + 78, 92, 26, roofC)
    tower(cx - 34, 66, 22, '#ff86a8')
    tower(cx + 36, 62, 22, '#ff86a8')
    tower(cx, 34, 30, roofC)
    g.fillStyle = '#6b4f93'
    g.beginPath()
    g.roundRect(cx - 10, 142, 20, 30, [10, 10, 0, 0])
    g.fill()
    g.fillStyle = 'rgba(236, 246, 255, 0.4)'
    g.fillRect(0, 0, VW, 240)

    // objetos junto al sendero (cada uno con su copia desenfocada para
    // cuando pasan cerca de la cámara)
    const sprite = (w, h, draw) => {
      const L = makeLayer(w, h, res * 1.6)
      draw(L.g, w, h)
      return { L, blur: blurLayer(L, 6 * K), w, h }
    }
    const roseBush = (rose) =>
      sprite(240, 180, (g, w, h) => {
        foliage(g, w / 2, h * 0.58, w * 0.42, h * 0.36, rose.length * 7, { dark: '#22713f', mid: '#2f8b4c', light: '#5cb65c', spark: '#a8e07a', lx: 1 }, 14)
        const r = rng(rose.length * 13)
        for (let i = 0; i < 9; i++) {
          const x = w * (0.2 + r() * 0.6)
          const y = h * (0.3 + r() * 0.45)
          const rr = 9 + r() * 6
          g.fillStyle = rose[0]
          g.beginPath()
          g.arc(x, y, rr, 0, TAU)
          g.fill()
          g.strokeStyle = rose[1]
          g.lineWidth = 2
          g.beginPath()
          g.arc(x, y, rr * 0.55, 0.3, 4.6)
          g.stroke()
          g.beginPath()
          g.arc(x + 1, y - 1, rr * 0.25, 1, 5)
          g.stroke()
        }
      })
    const mushroom = (cap, dot) =>
      sprite(200, 230, (g, w, h) => {
        g.fillStyle = vgrad(g, h * 0.45, h, [
          [0, '#fff6e6'],
          [1, '#e9d6bb'],
        ])
        g.beginPath()
        g.moveTo(w * 0.42, h)
        g.quadraticCurveTo(w * 0.38, h * 0.65, w * 0.44, h * 0.42)
        g.lineTo(w * 0.58, h * 0.42)
        g.quadraticCurveTo(w * 0.64, h * 0.65, w * 0.6, h)
        g.fill()
        g.fillStyle = '#e8d2b0'
        g.beginPath()
        g.ellipse(w / 2, h * 0.43, w * 0.36, h * 0.05, 0, 0, TAU)
        g.fill()
        const capPath = new Path2D()
        capPath.moveTo(w * 0.08, h * 0.44)
        capPath.bezierCurveTo(w * 0.1, h * 0.02, w * 0.9, h * 0.02, w * 0.92, h * 0.44)
        capPath.quadraticCurveTo(w / 2, h * 0.5, w * 0.08, h * 0.44)
        g.fillStyle = cap
        g.fill(capPath)
        g.fillStyle = vgrad(g, h * 0.05, h * 0.48, [
          [0, 'rgba(255, 255, 255, 0.25)'],
          [0.5, 'rgba(255, 255, 255, 0)'],
          [1, 'rgba(60, 20, 40, 0.22)'],
        ])
        g.fill(capPath)
        g.fillStyle = dot
        for (const [x, y, rr] of [[0.3, 0.22, 0.07], [0.55, 0.14, 0.06], [0.72, 0.28, 0.065], [0.45, 0.33, 0.05], [0.2, 0.36, 0.04]]) {
          g.beginPath()
          g.ellipse(w * x, h * y, w * rr, h * rr * 0.7, 0, 0, TAU)
          g.fill()
        }
        g.fillStyle = 'rgba(255, 255, 255, 0.35)'
        g.beginPath()
        g.ellipse(w * 0.36, h * 0.12, w * 0.12, h * 0.04, -0.4, 0, TAU)
        g.fill()
      })
    const tulips = () =>
      sprite(150, 210, (g, w, h) => {
        const r = rng(83)
        for (let i = 0; i < 5; i++) {
          const x = w * (0.2 + i * 0.15)
          const top = h * (0.12 + r() * 0.3)
          g.strokeStyle = '#3f9a45'
          g.lineWidth = 4
          g.beginPath()
          g.moveTo(x, h)
          g.quadraticCurveTo(x + (r() - 0.5) * 20, (h + top) / 2, x, top)
          g.stroke()
          g.fillStyle = '#4fae4a'
          g.beginPath()
          g.ellipse(x - 8, h * 0.78, 6, 22, -0.4, 0, TAU)
          g.fill()
          g.fillStyle = ['#ff5c8a', '#ffb23f', '#ff7a6b', '#c77dff', '#ff5c8a'][i]
          g.beginPath()
          g.moveTo(x - 11, top)
          g.quadraticCurveTo(x - 12, top - 22, x - 6, top - 26)
          g.lineTo(x, top - 18)
          g.lineTo(x + 6, top - 26)
          g.quadraticCurveTo(x + 12, top - 22, x + 11, top)
          g.quadraticCurveTo(x, top + 8, x - 11, top)
          g.fill()
        }
      })
    const topiary = () =>
      sprite(220, 330, (g, w, h) => {
        g.fillStyle = '#7a5232'
        g.fillRect(w * 0.46, h * 0.6, w * 0.08, h * 0.4)
        foliage(g, w / 2, h * 0.36, w * 0.42, h * 0.3, 89, { dark: '#2c8a52', mid: '#3fae63', light: '#7ed67c', spark: '#c8f29a', lx: 1 }, 16)
      })
    c.sprites = {
      roseR: roseBush(['#e2304a', '#9e1430']),
      roseW: roseBush(['#fff4f4', '#e2c4cc', 'w']),
      mushR: mushroom('#ff5d5d', '#ffffff'),
      mushT: mushroom('#3fc6cf', '#e8fbff'),
      mushO: mushroom('#ffb03b', '#fff3d6'),
      tulips: tulips(),
      topiary: topiary(),
    }
    // el árbol del gato: tronco retorcido y una rama larga hacia el sendero
    const tree = makeLayer(640, 760, res * 1.4)
    g = tree.g
    g.fillStyle = vgrad(g, 300, 760, [
      [0, '#5d3a5a'],
      [1, '#3d2340'],
    ])
    g.beginPath()
    g.moveTo(250, 760)
    g.bezierCurveTo(270, 620, 220, 520, 262, 380)
    g.bezierCurveTo(280, 320, 330, 300, 350, 250)
    g.lineTo(372, 262)
    g.bezierCurveTo(350, 330, 312, 360, 318, 430)
    g.bezierCurveTo(325, 560, 350, 650, 360, 760)
    g.closePath()
    g.fill()
    g.strokeStyle = '#4a2a4c'
    g.lineCap = 'round'
    g.lineWidth = 26
    g.beginPath()
    g.moveTo(300, 430)
    g.bezierCurveTo(390, 420, 470, 405, 630, 398)
    g.stroke()
    g.strokeStyle = 'rgba(255, 220, 255, 0.25)'
    g.lineWidth = 4
    g.beginPath()
    g.moveTo(305, 420)
    g.bezierCurveTo(390, 410, 470, 395, 630, 388)
    g.stroke()
    const catPal = { dark: '#1f7a74', mid: '#2fa39a', light: '#6fd6c2', spark: '#b8f5e4', lx: 1 }
    foliage(g, 215, 200, 205, 170, 97, catPal, 20)
    foliage(g, 600, 380, 70, 45, 101, catPal, 7)
    c.catTree = { L: tree, w: 640, h: 760, branch: [440, 398] }

    // los objetos, a ambos lados del sendero (w: distancia por el sendero;
    // xs: separación lateral)
    const r = rng(107)
    const kinds = ['roseR', 'roseW', 'roseR', 'tulips', 'mushR', 'mushT', 'mushO', 'topiary']
    const HEIGHT = { roseR: 0.5, roseW: 0.5, tulips: 0.42, mushR: 0.95, mushT: 1.15, mushO: 0.8, topiary: 1.9 }
    c.objects = []
    for (let w = 1.0; w < 34; w += 0.55 + r() * 0.7) {
      for (const side of [-1, 1]) {
        if (r() < 0.35) continue
        const kind = kinds[Math.floor(r() * kinds.length)]
        const off = kind === 'topiary' || kind.startsWith('mush') ? 1.2 + r() * 2.4 : 0.15 + r() * 0.9
        c.objects.push({ kind, w: w + r() * 0.3, side, off, hw: HEIGHT[kind] * (0.8 + r() * 0.5) })
      }
    }
    // el árbol del gato queda a la izquierda, en el tercio de la pantalla
    c.objects = c.objects.filter((o) => !(o.side < 0 && Math.abs(o.w - 3.2) < 1.2))
    c.objects.push({ kind: 'cat', w: 3.2, side: -1, off: 2.2, hw: 3.4 })

    // primer plano desenfocado: flores enormes en las esquinas de abajo
    const fg = makeLayer(VW, 360, res * 0.5)
    g = fg.g
    const rr = rng(113)
    for (const [cx2, n] of [[VW * 0.03, 7], [VW * 0.97, 6]]) {
      for (let i = 0; i < n; i++) {
        const x = cx2 + (rr() - 0.5) * 300
        const y = 140 + rr() * 200
        g.strokeStyle = '#2f8a3a'
        g.lineWidth = 9
        g.beginPath()
        g.moveTo(x, 380)
        g.lineTo(x + (rr() - 0.5) * 40, y)
        g.stroke()
        const col = ['#ff86b0', '#ffd15c', '#ffffff', '#c58cff'][i % 4]
        g.fillStyle = col
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * TAU
          g.beginPath()
          g.ellipse(x + Math.cos(a) * 30, y + Math.sin(a) * 30, 30, 16, a, 0, TAU)
          g.fill()
        }
        g.fillStyle = '#ffb52e'
        g.beginPath()
        g.arc(x, y, 16, 0, TAU)
        g.fill()
      }
    }
    c.fg = blurLayer(fg, Math.max(3, 10 * K * 0.5))
    return c
  }

  // camino recorrido en C: arranca tras aterrizar, frena delante del gato
  function walkS(t) {
    const [a, b] = T.walkC
    if (t <= a) return 0
    const speed = (x) => smooth(win(x, a, a + 0.45)) * (1 - smooth(win(x, b - 0.6, b)))
    const end = Math.min(t, b)
    const n = 24
    let s = 0
    for (let i = 0; i < n; i++) s += speed(a + ((i + 0.5) / n) * (end - a))
    return 0.85 * s * ((end - a) / n)
  }

  const proj = (X, z) => [VW / 2 + (FOCAL * X) / z, HORIZON + FOCAL / z]

  // base: dónde queda el sendero bajo los pies de Alicia (la cámara la sigue)
  function drawPath(s, base) {
    const row = 0.5
    const zNear = 0.82
    const zFar = 30
    const k0 = Math.floor((zNear + s) / row)
    const k1 = Math.ceil((zFar + s) / row)
    for (let k = k1; k >= k0; k--) {
      const wa = Math.max(k * row, zNear + s)
      const wb = (k + 1) * row
      if (wb <= wa) continue
      const za = wa - s
      const zb = wb - s
      const xa = pathX(wa) - base
      const xb = pathX(wb) - base
      for (let col = 0; col < 4; col++) {
        const u0 = -PATH_W + (col / 4) * PATH_W * 2
        const u1 = u0 + (PATH_W * 2) / 4
        const p0 = proj(xa + u0, za)
        const p1 = proj(xa + u1, za)
        const p2 = proj(xb + u1, zb)
        const p3 = proj(xb + u0, zb)
        ctx.fillStyle = (k + col) % 2 ? '#2b2b44' : '#faf6ec'
        ctx.beginPath()
        ctx.moveTo(p0[0], p0[1])
        ctx.lineTo(p1[0], p1[1])
        ctx.lineTo(p2[0], p2[1])
        ctx.lineTo(p3[0], p3[1])
        ctx.closePath()
        ctx.fill()
      }
      // bordillo de piedra clara
      for (const side of [-1, 1]) {
        const e0 = side * PATH_W
        const e1 = side * (PATH_W + 0.05)
        const q0 = proj(xa + e0, za)
        const q1 = proj(xa + e1, za)
        const q2 = proj(xb + e1, zb)
        const q3 = proj(xb + e0, zb)
        ctx.fillStyle = '#efe4cc'
        ctx.beginPath()
        ctx.moveTo(q0[0], q0[1])
        ctx.lineTo(q1[0], q1[1])
        ctx.lineTo(q2[0], q2[1])
        ctx.lineTo(q3[0], q3[1])
        ctx.closePath()
        ctx.fill()
      }
    }
  }

  // el gato aparece por partes y se desvanece al revés, empezando por la cola
  function catParts(t) {
    const u = win(t, T.cat[0], T.cat[1])
    const inn = (a, b) => smooth(cl((u - a) / (b - a)))
    const out = (a, b) => 1 - smooth(cl((u - a) / (b - a)))
    return {
      grin: inn(0, 0.12),
      eyes: inn(0.1, 0.22) * out(0.76, 0.86),
      head: inn(0.2, 0.34) * out(0.68, 0.78),
      body: inn(0.26, 0.4) * out(0.62, 0.72),
      tail: inn(0.3, 0.44) * out(0.56, 0.66),
      blink: Math.max(0, 1 - Math.abs(u - 0.5) / 0.025),
      sway: Math.sin(t * 2.4),
    }
  }

  function drawC(t) {
    const c = C
    const t0 = T.land[0]
    const push = ease(win(t, t0, T.end))
    const Z = 1 + 0.05 * push
    const F = [VW / 2, HORIZON]
    const layer = (par) => setCam(F, F, 1 + (Z - 1) * par)
    const s = walkS(t)

    layer(0.15)
    ctx.drawImage(c.sky.c, 0, -20, VW, 640)
    // rayos de sol detrás del castillo
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI / 2 + (i - 3) * 0.32 + Math.sin(t * 0.3 + i) * 0.04
      const gr = ctx.createRadialGradient(VW / 2, 470, 20, VW / 2, 470, 900)
      gr.addColorStop(0, 'rgba(255, 250, 225, 0.16)')
      gr.addColorStop(1, 'rgba(255, 250, 225, 0)')
      ctx.fillStyle = gr
      ctx.beginPath()
      ctx.moveTo(VW / 2, 470)
      ctx.arc(VW / 2, 470, 900, a - 0.05, a + 0.05)
      ctx.closePath()
      ctx.fill()
    }
    ctx.restore()
    // golondrinas
    for (let i = 0; i < 5; i++) {
      const p = (t - t0 - 0.3) * 0.16 + i * 0.035
      if (p < 0 || p > 1) continue
      drawBird(lerp(-60, VW + 60, p) + i * 30, 300 - p * 140 + Math.sin(t * 2 + i) * 10 + (i % 2) * 26, 1.5 + (i % 3) * 0.3, t * 11 + i)
    }

    layer(0.3)
    ctx.drawImage(c.far.c, 0, HORIZON - 290, VW, 300)

    layer(1)
    ctx.fillStyle = vgrad(ctx, HORIZON, 1000, [
      [0, '#bfe9b5'],
      [0.12, '#8fd77a'],
      [0.5, '#62c157'],
      [1, '#3fa04a'],
    ])
    ctx.fillRect(-200, HORIZON - 2, VW + 400, 1100 - HORIZON)
    // franjas de luz en la hierba: se mueven al caminar
    ctx.fillStyle = 'rgba(255, 255, 230, 0.07)'
    for (let k = Math.floor(s / 2); k < s / 2 + 12; k++) {
      const za = k * 2 - s
      const zb = za + 1
      if (zb < 0.5) continue
      const ya = HORIZON + FOCAL / Math.max(0.5, za)
      const yb = HORIZON + FOCAL / zb
      ctx.fillRect(-200, yb, VW + 400, Math.max(0, ya - yb))
    }
    const ALICE_Z = 1.1
    const base = pathX(s + ALICE_Z)
    drawPath(s, base)
    const haze = ctx.createLinearGradient(0, HORIZON, 0, HORIZON + 70)
    haze.addColorStop(0, 'rgba(232, 246, 255, 0.85)')
    haze.addColorStop(1, 'rgba(232, 246, 255, 0)')
    ctx.fillStyle = haze
    ctx.fillRect(-200, HORIZON - 4, VW + 400, 74)

    // objetos junto al sendero, del más lejano al más cercano
    const items = []
    for (const o of c.objects) {
      const z = o.w - s
      if (z < 0.55 || z > 28) continue
      items.push({ o, z })
    }
    const rw = 4.4 + Math.max(0, t - t0 - 0.4) * 2.3
    if (rw - s < 26) items.push({ o: { kind: 'rabbit' }, z: rw - s })
    items.sort((a, b) => b.z - a.z)
    let aliceDrawn = false
    for (const { o, z } of items) {
      if (!aliceDrawn && z < ALICE_Z) {
        drawLandingAlice(t)
        aliceDrawn = true
      }
      if (o.kind === 'rabbit') {
        const p = proj(pathX(rw) - base, z)
        const h = (FOCAL * 0.42) / z
        ctx.save()
        ctx.globalAlpha = 1 - win(z, 16, 24)
        ctx.translate(p[0], p[1])
        ctx.scale(h / 64, h / 64)
        drawRabbit(ctx, { run: t * 3, watch: 0, glint: 0, dir: pathX(rw + 0.3) > pathX(rw) ? 1 : -1, lw: Math.max(0.5, 64 / h / K) })
        ctx.restore()
        continue
      }
      const X = pathX(o.w) - base + o.side * (PATH_W + o.off * meander)
      const [px, py] = proj(X, z)
      const h = (FOCAL * o.hw) / z
      if (o.kind === 'cat') {
        drawCatTree(px, py, h, t)
        continue
      }
      const sp = c.sprites[o.kind]
      const img = z < 1.5 ? sp.blur : sp.L
      const w = h * (sp.w / sp.h)
      ctx.globalAlpha = 1 - win(z, 18, 28)
      ctx.drawImage(img.c, px - w / 2, py - h * 0.97, w, h)
      ctx.globalAlpha = 1
    }
    if (!aliceDrawn) drawLandingAlice(t)

    layer(1.3)
    ctx.drawImage(c.fg.c, 0, 680, VW, 360)

    setBase()
    drawPetals(petalsC, t, { wind: 120, fall: 50, size: 24, alpha: 0.95 })
    drawMotes(t, MOTE, { rise: 30, size: 26, alpha: 0.6 })
    drawRibbon({
      x0: -VW * 0.15,
      y0: 360,
      x1: VW * 1.15,
      y1: 250,
      amp: 70,
      wave: 8,
      ph: t * 1.4,
      w: 16,
      head: lerp(-0.1, 1.5, win(t, t0, t0 + 3.2)),
      span: 0.6,
      alpha: 0.55,
      color: [255, 255, 255],
    })
    drawRibbon({
      x0: VW * 1.1,
      y0: 760,
      x1: -VW * 0.1,
      y1: 640,
      amp: 50,
      wave: 10,
      ph: t * 1.9 + 1,
      w: 11,
      head: lerp(-0.1, 1.5, win(t, t0 + 1.3, t0 + 4)),
      span: 0.5,
      alpha: 0.45,
      color: [255, 246, 214],
    })

    // fogonazo al llegar: la luz del fondo del pozo se abre en el cielo
    const flash = 1 - easeOut(win(t, t0, t0 + 0.55))
    if (flash > 0) {
      ctx.fillStyle = `rgba(255, 250, 236, ${flash})`
      ctx.fillRect(0, 0, VW, 1000)
    }
  }

  function drawCatTree(px, py, h, t) {
    const tr = C.catTree
    const k = h / tr.h
    const x0 = px - (tr.w / 2) * k
    const y0 = py - h
    ctx.drawImage(tr.L.c, x0, y0, tr.w * k, h)
    const a = catParts(t)
    if (a.grin <= 0) return
    ctx.save()
    ctx.translate(x0 + tr.branch[0] * k, y0 + tr.branch[1] * k - 102 * CAT_SCALE * k + Math.sin(t * 1.6) * 2)
    ctx.scale(CAT_SCALE * k, CAT_SCALE * k)
    // chispas mientras se materializa y se deshace
    const sparkle = Math.max(win(t, T.cat[0], T.cat[0] + 0.9) * (1 - win(t, T.cat[0] + 0.9, T.cat[0] + 1.2)), win(t, 8.6, 8.9) * (1 - win(t, 9.3, 9.6)))
    if (sparkle > 0) {
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      for (let i = 0; i < 14; i++) {
        const ang = i * 2.4 + t * 1.3
        const rad = 120 + ((i * 47) % 150) + Math.sin(t * 3 + i) * 20
        ctx.globalAlpha = sparkle * (0.4 + 0.6 * Math.abs(Math.sin(t * 6 + i)))
        ctx.drawImage(MOTE, Math.cos(ang) * rad + 120 - 22, Math.sin(ang) * rad * 0.6 - 22, 44, 44)
      }
      ctx.restore()
    }
    drawCat(ctx, a)
    ctx.restore()
  }

  // Alicia en C: baja de la luz como al final de la caída, aterriza y camina
  // con las manos a la espalda (como en la portada)
  function drawLandingAlice(t) {
    const land = win(t, T.land[0], T.land[1])
    const e = easeOut(land)
    const [a, b] = T.walkC
    const moving = smooth(win(t, a, a + 0.45)) * (1 - smooth(win(t, b - 0.6, b)))
    const y = lerp(740, 958, e)
    const h = lerp(340, 380, e)
    ctx.save()
    ctx.fillStyle = 'rgba(20, 70, 25, 0.28)'
    ctx.globalAlpha = e
    ctx.beginPath()
    ctx.ellipse(VW / 2, 960, h * 0.19, h * 0.035, 0, 0, TAU)
    ctx.fill()
    ctx.restore()
    paintAlice(
      {
        x: VW / 2,
        y,
        h,
        t,
        float: Math.pow(1 - e, 1.3),
        step: walkS(t) * 1.9,
        stride: moving,
        arms: 'clasp',
        wind: 0.45,
        look: -smooth(win(t, T.cat[0] + 0.4, T.cat[0] + 1)),
      },
      { back: 1, glow: 0.22 }
    )
  }

  // ================= fotograma =================

  function frame(t) {
    setBase()
    ctx.clearRect(0, 0, VW, 1000)
    if (t < T.fall[0]) drawA(t)
    else if (t < T.fall[1]) {
      setBase()
      drawB(t)
    } else drawC(t)

    // resplandor suave (como el de las cinemáticas): una copia pequeña y
    // desenfocada de la imagen, sumada encima
    setBase()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    glowG.globalCompositeOperation = 'copy'
    glowG.filter = `blur(${Math.max(2, glowCv.width / 160)}px)`
    glowG.drawImage(canvas, 0, 0, glowCv.width, glowCv.height)
    glowG.filter = 'none'
    ctx.globalCompositeOperation = 'screen'
    ctx.globalAlpha = t >= T.fall[0] && t < T.fall[1] ? 0.42 : 0.22
    ctx.drawImage(glowCv, 0, 0, canvas.width, canvas.height)
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
    setBase()
    const vg = ctx.createRadialGradient(VW / 2, 520, 300, VW / 2, 520, Math.max(VW, 1000) * 0.75)
    vg.addColorStop(0, 'rgba(20, 20, 50, 0)')
    vg.addColorStop(1, 'rgba(20, 20, 50, 0.32)')
    ctx.fillStyle = vg
    ctx.fillRect(0, 0, VW, 1000)
  }

  function resize() {
    W = canvas.clientWidth || window.innerWidth
    H = canvas.clientHeight || window.innerHeight
    canvas.width = Math.round(W * dpr)
    canvas.height = Math.round(H * dpr)
    V = H / 1000
    VW = W / V
    K = V * dpr
    CS = Math.max(0.55, Math.min(1, VW / 1600))
    glowCv.width = Math.max(1, Math.round(canvas.width / 6))
    glowCv.height = Math.max(1, Math.round(canvas.height / 6))
    shelfCache.clear()
    A = buildA()
    B = buildB()
    C = buildC()
  }

  resize()
  return { frame, resize, dispose() {} }
}
