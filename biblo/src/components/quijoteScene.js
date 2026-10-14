// Entrada de "Don Quijote de la Mancha" (8 s): don Quijote en su caballo
// blanco y Sancho Panza en su burro cabalgan sin prisa por La Mancha a la
// hora dorada, y la cámara los acompaña de lado, como en un travelling.
//   0-2,4    cerca y a ras de suelo: los cascos pisan la tierra roja
//   2,4-3,9  la cámara se aleja y aparecen los dos enteros
//   3,9-6    pasa un tronco por delante; don Quijote apunta la lanza a los
//            molinos de la loma
//   6-8      la cámara sube y se aleja: el paisaje entero y el título
// Van a contraluz, hacia el sol: se les ve la silueta con un filo de luz, sin
// rasgos en la cara. Todo va a compás de la música (quijoteMusic.js): cada
// pisada del caballo cae en una corchea y las del burro en tresillos.
// Unidades virtuales: el alto de la pantalla mide 1000.

const BPM = 100
export const BEAT = 60 / BPM
export const BAR = BEAT * 4
export const T = {
  close: [0, BAR],
  pull: [BAR, BAR + 1.5],
  trunk: BAR * 2,
  lance: [BAR * 2 + BEAT, BAR * 2 + BEAT * 2.5],
  rise: [BAR * 2 + BEAT * 2, BAR * 3 + BEAT],
  titleIn: BAR * 2 + BEAT * 3,
  end: 8,
}

const TAU = Math.PI * 2

function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const mix = (a, b, f) => a + (b - a) * f
const cl = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x))
const smooth = (x) => {
  x = cl(x)
  return x * x * (3 - 2 * x)
}
const span = (t, [a, b]) => cl((t - a) / (b - a))
// arranca rápido y se posa despacio
const outCubic = (x) => 1 - (1 - cl(x)) ** 3
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
function tone(a, b, f, alpha = 1) {
  const p = rgb(a)
  const q = rgb(b)
  return `rgba(${p.map((v, i) => Math.round(mix(v, q[i], f))).join(', ')}, ${alpha})`
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.ceil(w))
  c.height = Math.max(1, Math.ceil(h))
  return c
}

const PATHS = new Map()
const path = (d) => {
  if (!PATHS.has(d)) PATHS.set(d, new Path2D(d))
  return PATHS.get(d)
}

// ---------- el paso ----------

// dónde va el casco respecto a su articulación a lo largo del paso: apoyado
// (se queda en el suelo mientras el cuerpo avanza) o en el aire (sube y se
// adelanta). p: fase 0..1; duty: la parte del ciclo que pasa apoyado
function hoofAt(p, duty, stride, lift) {
  p = ((p % 1) + 1) % 1
  if (p < duty) return [stride * (0.5 - p / duty), 0]
  const u = (p - duty) / (1 - duty)
  return [stride * (-0.5 + smooth(u)), -lift * Math.sin(Math.PI * u)]
}

// rodilla de una pata de dos huesos; bend 1 la dobla hacia delante, -1 atrás
function knee(ax, ay, hx, hy, l1, l2, bend) {
  const dx = hx - ax
  const dy = hy - ay
  const d = Math.min(Math.hypot(dx, dy), l1 + l2 - 1e-4)
  const a = Math.atan2(dy, dx)
  const c = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)
  const k = a - bend * Math.acos(cl(c, -1, 1))
  return [ax + Math.cos(k) * l1, ay + Math.sin(k) * l1]
}

// un hueso: trapecio de puntas redondas de (x1, y1) a (x2, y2)
function bone(p, x1, y1, x2, y2, w1, w2) {
  const a = Math.atan2(y2 - y1, x2 - x1)
  const nx = -Math.sin(a)
  const ny = Math.cos(a)
  p.moveTo(x1 + (nx * w1) / 2, y1 + (ny * w1) / 2)
  p.lineTo(x2 + (nx * w2) / 2, y2 + (ny * w2) / 2)
  p.arc(x2, y2, w2 / 2, a + Math.PI / 2, a - Math.PI / 2, true)
  p.lineTo(x1 - (nx * w1) / 2, y1 - (ny * w1) / 2)
  p.arc(x1, y1, w1 / 2, a - Math.PI / 2, a + Math.PI / 2, true)
  p.closePath()
}

// cinta que sigue una curva (crin, cola), de ancho w0 a w1
function ribbon(p, pts, w0, w1) {
  const left = []
  const right = []
  for (let i = 0; i < pts.length; i++) {
    const [x, y] = pts[i]
    const [px, py] = pts[Math.max(0, i - 1)]
    const [qx, qy] = pts[Math.min(pts.length - 1, i + 1)]
    const a = Math.atan2(qy - py, qx - px)
    const w = mix(w0, w1, i / (pts.length - 1)) / 2
    left.push([x - Math.sin(a) * w, y + Math.cos(a) * w])
    right.push([x + Math.sin(a) * w, y - Math.cos(a) * w])
  }
  p.moveTo(left[0][0], left[0][1])
  for (const [x, y] of left) p.lineTo(x, y)
  for (let i = right.length - 1; i >= 0; i--) p.lineTo(right[i][0], right[i][1])
  p.closePath()
}

// ---------- monturas de perfil, mirando a la derecha ----------
// Coordenadas en "alzadas": la cruz del animal mide 1, el suelo es y = 0 y x
// crece hacia delante. El paso va a compás: el caballo da una pisada por
// corchea y el burro, con pasos más cortos, una por tresillo.

const HORSE = {
  torso:
    'M0.58 -0.8 C0.5 -0.98 0.4 -1.02 0.3 -1.02 C0.1 -0.98 -0.14 -0.95 -0.32 -0.98 C-0.48 -1.0 -0.6 -0.98 -0.66 -0.9 C-0.72 -0.8 -0.72 -0.64 -0.62 -0.55 C-0.52 -0.49 -0.42 -0.52 -0.32 -0.52 C-0.1 -0.47 0.2 -0.49 0.4 -0.53 C0.52 -0.55 0.6 -0.66 0.58 -0.8 Z',
  // Rocinante es flaco: cuello largo y estrecho, cabeza larga
  neck:
    'M0.22 -0.98 C0.38 -1.14 0.52 -1.32 0.66 -1.42 C0.72 -1.47 0.79 -1.49 0.85 -1.47 L1.02 -1.33 C1.1 -1.26 1.15 -1.16 1.15 -1.1 C1.14 -1.05 1.09 -1.03 1.04 -1.06 C0.98 -1.1 0.92 -1.16 0.86 -1.2 C0.8 -1.17 0.72 -1.08 0.66 -0.98 C0.62 -0.9 0.56 -0.84 0.44 -0.86 Z',
  pivot: [0.36, -0.95],
  ears: [
    [0.8, -1.47, 0.76, -1.61, 0.045],
    [0.75, -1.46, 0.7, -1.59, 0.04],
  ],
  crest: [
    [0.82, -1.47],
    [0.7, -1.44],
    [0.58, -1.34],
    [0.46, -1.2],
    [0.34, -1.06],
  ],
  eye: [0.9, -1.36],
  bit: [1.07, -1.13],
  fore: { x: 0.47, y: -0.57, l1: 0.28, l2: 0.29, w: [0.13, 0.085, 0.07], bend: 1 },
  hind: { x: -0.46, y: -0.64, l1: 0.33, l2: 0.33, w: [0.2, 0.09, 0.07], bend: -1 },
  tail: [-0.66, -0.92],
  saddle: [0.02, -1.0],
  cycle: BEAT * 2,
  duty: 0.62,
  stride: 0.62,
  lift: 0.1,
}

const DONKEY = {
  torso:
    'M0.56 -0.78 C0.5 -0.96 0.38 -1.0 0.28 -1.0 C0.08 -0.98 -0.18 -0.97 -0.36 -0.99 C-0.52 -1.0 -0.62 -0.96 -0.66 -0.88 C-0.72 -0.78 -0.7 -0.62 -0.6 -0.52 C-0.5 -0.46 -0.38 -0.46 -0.28 -0.46 C-0.06 -0.4 0.22 -0.44 0.42 -0.5 C0.54 -0.54 0.6 -0.66 0.56 -0.78 Z',
  neck:
    'M0.18 -0.95 C0.34 -1.06 0.46 -1.2 0.58 -1.28 C0.64 -1.33 0.72 -1.34 0.78 -1.3 L1.03 -1.07 C1.11 -1.0 1.12 -0.93 1.08 -0.88 C1.04 -0.84 0.98 -0.84 0.92 -0.88 C0.84 -0.94 0.76 -1.0 0.66 -1.02 C0.6 -0.92 0.56 -0.84 0.5 -0.8 Z',
  pivot: [0.34, -0.93],
  ears: [
    [0.72, -1.32, 0.6, -1.7, 0.075],
    [0.66, -1.3, 0.52, -1.64, 0.07],
  ],
  crest: [
    [0.74, -1.33],
    [0.62, -1.3],
    [0.5, -1.2],
    [0.38, -1.08],
    [0.28, -1.0],
  ],
  eye: [0.82, -1.2],
  bit: [1.05, -0.92],
  fore: { x: 0.44, y: -0.52, l1: 0.25, l2: 0.255, w: [0.13, 0.09, 0.075], bend: 1 },
  hind: { x: -0.45, y: -0.56, l1: 0.29, l2: 0.29, w: [0.19, 0.09, 0.075], bend: -1 },
  tail: [-0.66, -0.88],
  saddle: [-0.02, -0.98],
  cycle: (BEAT * 4) / 3,
  duty: 0.62,
  stride: 0.55,
  lift: 0.12,
}

// el burro va desfasado dos tresillos: sus pisadas caen en la rejilla
const DONKEY_LAG = (BEAT * 2) / 3

// las cuatro patas en el orden del paso: trasera, mano, trasera, mano
const LEGS = [
  ['hind', 0],
  ['fore', 0.25],
  ['hind', 0.5],
  ['fore', 0.75],
]

// pinta la montura en alzadas; devuelve dónde van la silla y el bocado
function drawMount(g, M, t, col, kind) {
  const ph = t / M.cycle
  const by = 0.014 * Math.cos(ph * TAU * 2)
  const nod = 0.045 * Math.sin(ph * TAU * 2 + 0.6)
  const legs = []
  for (const [leg, off] of LEGS) {
    const L = M[leg]
    const far = off >= 0.5
    const [dx, dy] = hoofAt(ph + off, M.duty, M.stride, M.lift)
    const ax = L.x - (far ? 0.05 : 0)
    const ay = L.y + by
    const hx = ax + dx + (leg === 'hind' ? -0.02 : 0.02)
    const hy = Math.min(-0.035, dy - 0.035)
    const [kx, ky] = knee(ax, ay, hx, hy, L.l1, L.l2, L.bend)
    legs.push({ far, ax, ay, kx, ky, hx, hy, L })
  }

  // pata: antebrazo (o pierna) fuerte, rodilla (o corvejón), caña fina,
  // menudillo, cuartilla inclinada y casco
  const drawLeg = (l) => {
    const [w0, w1, w2] = l.L.w
    const hind = l.L.bend < 0
    const a = Math.atan2(l.hy - l.ky, l.hx - l.kx)
    // el menudillo, un poco por encima y por detrás del casco
    const fx = l.hx - Math.cos(a) * 0.065 - 0.018
    const fy = l.hy - Math.sin(a) * 0.065
    g.fillStyle = l.far ? col.far : col.skin
    for (const [x1, y1, x2, y2, a1, a2] of [
      [l.ax, l.ay, l.kx, l.ky, w0, w1],
      [l.kx, l.ky, fx, fy, w1 * 0.78, w2 * 0.8],
      [fx, fy, l.hx, l.hy, w2 * 0.85, w2 * 0.75],
    ]) {
      const p = new Path2D()
      bone(p, x1, y1, x2, y2, a1, a2)
      g.fill(p)
    }
    // rodilla y menudillo, abultados
    g.beginPath()
    g.arc(l.kx + (hind ? -0.015 : 0.01), l.ky, w1 * 0.62, 0, TAU)
    g.fill()
    g.beginPath()
    g.arc(fx, fy, w2 * 0.62, 0, TAU)
    g.fill()
    // casco
    g.save()
    g.translate(l.hx, l.hy)
    g.rotate(a - Math.PI / 2)
    g.fillStyle = col.hoof
    g.beginPath()
    g.moveTo(-w2 * 0.55, -0.01)
    g.lineTo(w2 * 0.55, -0.01)
    g.lineTo(w2 * 0.72, 0.045)
    g.lineTo(-w2 * 0.62, 0.045)
    g.closePath()
    g.fill()
    g.restore()
  }

  // las patas del otro lado, más oscuras, por detrás del cuerpo
  for (const l of legs) if (l.far) drawLeg(l)

  // cola: sale de la grupa en arco, cae y se mece despacio
  const [tx, ty] = M.tail
  const sw = Math.sin(t * 1.3) * 0.05 + Math.sin(t * 2.9 + 1) * 0.02
  const long = kind === 'horse' ? 0.58 : 0.45
  const tail = []
  for (let i = 0; i <= 10; i++) {
    const u = i / 10
    tail.push([tx - 0.04 - Math.sin(u * 1.6) * 0.1 + sw * u * u * 2, ty + by - 0.02 + u * long])
  }
  if (kind === 'horse') {
    // una sola mata de pelo, ancha en medio y en punta al final, con
    // mechones marcados
    const left = []
    const right = []
    for (let i = 0; i < tail.length; i++) {
      const [x, y] = tail[i]
      const u = i / (tail.length - 1)
      const w = 0.03 + 0.1 * Math.sin(Math.PI * Math.min(1, u * 1.25)) * (1 - u * 0.4)
      left.push([x - w * 0.55, y])
      right.push([x + w * 0.45, y])
    }
    const tp = new Path2D()
    tp.moveTo(left[0][0], left[0][1])
    for (const [x, y] of left) tp.lineTo(x, y)
    const [ex, ey] = tail[tail.length - 1]
    tp.quadraticCurveTo(ex - 0.01, ey + 0.05, right[right.length - 1][0], right[right.length - 1][1])
    for (let i = right.length - 1; i >= 0; i--) tp.lineTo(right[i][0], right[i][1])
    tp.closePath()
    g.fillStyle = col.tail
    g.fill(tp)
    g.strokeStyle = col.far
    g.lineWidth = 0.01
    for (const f of [-0.3, 0.05, 0.35]) {
      g.beginPath()
      tail.slice(2).forEach(([x, y], i) => {
        const w = 0.05 * Math.sin(Math.PI * Math.min(1, ((i + 2) / 10) * 1.25))
        if (i) g.lineTo(x + f * w + Math.sin(i * 0.9 + f * 5 + t * 2) * 0.004, y)
        else g.moveTo(x + f * w, y)
      })
      g.stroke()
    }
  } else {
    const tp = new Path2D()
    ribbon(tp, tail, 0.035, 0.025)
    g.fillStyle = col.tail
    g.fill(tp)
    // la borla del rabo
    const [ex, ey] = tail[tail.length - 1]
    g.fillStyle = col.mane
    g.beginPath()
    g.ellipse(ex, ey + 0.03, 0.035, 0.07, 0.2, 0, TAU)
    g.fill()
  }

  g.save()
  g.translate(0, by)
  g.fillStyle = col.skin
  g.fill(path(M.torso))
  // cuello y cabeza cabecean al paso
  g.save()
  g.translate(M.pivot[0], M.pivot[1])
  g.rotate(nod)
  g.translate(-M.pivot[0], -M.pivot[1])
  for (const [x0, y0, x1, y1, w] of M.ears) {
    const e = new Path2D()
    e.moveTo(x0 - w / 2, y0)
    e.quadraticCurveTo(x0 - w * 0.6, (y0 + y1) / 2, x1, y1)
    e.quadraticCurveTo(x0 + w * 0.7, (y0 + y1) / 2, x0 + w / 2, y0)
    e.closePath()
    g.fill(e)
  }
  g.fill(path(M.neck))
  // crin
  const mane = new Path2D()
  const wave = Math.sin(t * 2.4) * 0.01
  ribbon(
    mane,
    M.crest.map(([x, y], i) => [x - 0.01 + wave * i * 0.3, y + 0.02 + i * 0.004]),
    kind === 'horse' ? 0.07 : 0.05,
    kind === 'horse' ? 0.09 : 0.04
  )
  g.fillStyle = col.mane
  g.fill(mane)
  if (kind === 'donkey') {
    g.fillStyle = col.muzzle
    g.beginPath()
    g.ellipse(1.02, -0.92, 0.09, 0.07, 0.6, 0, TAU)
    g.fill()
  }
  g.fillStyle = col.hoof
  g.beginPath()
  g.ellipse(M.eye[0], M.eye[1], 0.018, 0.012, 0.4, 0, TAU)
  g.fill()
  // cabezada
  g.strokeStyle = col.tack
  g.lineWidth = 0.022
  g.lineCap = 'round'
  g.beginPath()
  g.moveTo(M.bit[0] - 0.02, M.bit[1] + 0.01)
  g.lineTo(M.eye[0] - 0.06, M.eye[1] - 0.08)
  g.moveTo(M.bit[0] - 0.12, M.bit[1] - 0.06)
  g.lineTo(M.bit[0] + 0.02, M.bit[1] - 0.12)
  g.stroke()
  g.restore()

  // manta y silla
  const [sx, sy] = M.saddle
  g.fillStyle = col.blanket
  g.beginPath()
  g.moveTo(sx - 0.2, sy + 0.01)
  g.lineTo(sx + 0.22, sy - 0.02)
  g.lineTo(sx + 0.2, sy + 0.24)
  g.quadraticCurveTo(sx, sy + 0.27, sx - 0.18, sy + 0.24)
  g.closePath()
  g.fill()
  g.strokeStyle = col.trim
  g.lineWidth = 0.025
  g.beginPath()
  g.moveTo(sx + 0.19, sy + 0.21)
  g.quadraticCurveTo(sx, sy + 0.24, sx - 0.17, sy + 0.21)
  g.stroke()
  g.fillStyle = col.saddle
  g.beginPath()
  g.moveTo(sx - 0.15, sy - 0.02)
  g.quadraticCurveTo(sx - 0.17, sy - 0.1, sx - 0.12, sy - 0.11)
  g.quadraticCurveTo(sx, sy - 0.03, sx + 0.12, sy - 0.08)
  g.quadraticCurveTo(sx + 0.17, sy - 0.07, sx + 0.16, sy - 0.01)
  g.closePath()
  g.fill()
  g.restore()

  for (const l of legs) if (!l.far) drawLeg(l)

  // el bocado sigue al cabeceo
  const c = Math.cos(nod)
  const s = Math.sin(nod)
  const [px, py] = M.pivot
  const bit = [
    px + (M.bit[0] - px) * c - (M.bit[1] - py) * s,
    py + (M.bit[0] - px) * s + (M.bit[1] - py) * c + by,
  ]
  return { saddle: [sx, sy + by], bit }
}

// ---------- jinetes de perfil ----------
// En alzadas de su montura, con la cadera en la silla (0, 0). Los colores son
// los de la cara que vemos, que está en sombra: la luz les llega por detrás y
// solo les enciende el borde.

const Q = {
  skin: '#4f4446',
  hair: '#8f8784',
  armor: '#5f6776',
  armorDark: '#474d5a',
  boot: '#2e2420',
  beard: '#a8a09a',
  lance: '#4a3426',
  steel: '#9aa1aa',
  shield: '#6e6048',
}

// raise 0..1: de llevar la lanza en alto a apuntarla hacia los molinos
function drawQuijote(g, t, raise, rein) {
  const sway = Math.sin(((t * TAU) / HORSE.cycle) * 2 + 1.2) * 0.006
  const r = smooth(raise)
  const hand = [mix(0.14, 0.22, r), mix(-0.38, -0.4, r)]
  const ang = mix(-1.46, -0.8, r) + Math.sin(t * 1.7) * 0.012
  const dir = [Math.cos(ang), Math.sin(ang)]
  g.save()
  g.rotate(-0.05 + sway - r * 0.04)
  // adarga a la espalda
  g.fillStyle = Q.shield
  g.beginPath()
  g.arc(-0.1, -0.34, 0.13, 0, TAU)
  g.fill()
  g.strokeStyle = Q.armorDark
  g.lineWidth = 0.02
  g.stroke()
  // brazo del otro lado: sujeta la lanza
  g.fillStyle = Q.armorDark
  const far = new Path2D()
  bone(far, 0.0, -0.5, 0.08 + r * 0.05, -0.37 - r * 0.04, 0.06, 0.05)
  bone(far, 0.08 + r * 0.05, -0.37 - r * 0.04, hand[0], hand[1], 0.05, 0.045)
  g.fill(far)
  // la lanza: el regatón abajo, la moharra al cielo
  const butt = [hand[0] - dir[0] * 0.8, hand[1] - dir[1] * 0.8]
  const tip = [hand[0] + dir[0] * 1.5, hand[1] + dir[1] * 1.5]
  g.strokeStyle = Q.lance
  g.lineWidth = 0.032
  g.lineCap = 'round'
  g.beginPath()
  g.moveTo(butt[0], butt[1])
  g.lineTo(tip[0], tip[1])
  g.stroke()
  g.save()
  g.translate(tip[0], tip[1])
  g.rotate(ang + Math.PI / 2)
  g.fillStyle = Q.steel
  g.beginPath()
  g.moveTo(0, -0.17)
  g.lineTo(0.03, 0)
  g.lineTo(0, 0.04)
  g.lineTo(-0.03, 0)
  g.closePath()
  g.fill()
  g.restore()
  // torso largo y flaco con peto de láminas
  g.fillStyle = Q.armor
  g.fill(path('M-0.08 0.02 C-0.12 -0.2 -0.11 -0.42 -0.06 -0.56 L0.07 -0.57 C0.13 -0.46 0.15 -0.26 0.1 -0.02 Z'))
  g.strokeStyle = Q.armorDark
  g.lineWidth = 0.012
  for (const y of [-0.14, -0.22, -0.3]) {
    g.beginPath()
    g.moveTo(-0.1, y)
    g.quadraticCurveTo(0.02, y + 0.03, 0.13, y - 0.01)
    g.stroke()
  }
  g.fillStyle = Q.armor
  g.beginPath()
  g.ellipse(0.015, -0.5, 0.065, 0.048, -0.3, 0, TAU)
  g.fill()
  // cuello y cabeza de perfil sin rasgos: pelo cano, nariz larga, barba de
  // chivo y la bacía de barbero por yelmo
  g.fillStyle = Q.skin
  g.beginPath()
  g.moveTo(-0.005, -0.56)
  g.lineTo(0.045, -0.56)
  g.lineTo(0.055, -0.64)
  g.lineTo(0.005, -0.64)
  g.closePath()
  g.fill()
  g.fillStyle = Q.hair
  g.beginPath()
  g.ellipse(-0.012, -0.69, 0.04, 0.05, 0.3, 0, TAU)
  g.fill()
  g.fillStyle = Q.skin
  g.beginPath()
  g.ellipse(0.035, -0.695, 0.058, 0.072, 0.15, 0, TAU)
  g.fill()
  g.beginPath()
  g.moveTo(0.082, -0.725)
  g.lineTo(0.13, -0.68)
  g.lineTo(0.088, -0.665)
  g.closePath()
  g.fill()
  g.fillStyle = Q.beard
  g.fill(path('M0.03 -0.66 Q0.1 -0.665 0.112 -0.61 Q0.11 -0.56 0.138 -0.49 Q0.06 -0.55 0.03 -0.62 Z'))
  g.fillStyle = Q.steel
  g.beginPath()
  g.ellipse(0.035, -0.752, 0.14, 0.017, 0.05, 0, TAU)
  g.fill()
  g.beginPath()
  g.moveTo(-0.03, -0.757)
  g.quadraticCurveTo(-0.025, -0.83, 0.035, -0.835)
  g.quadraticCurveTo(0.095, -0.83, 0.1, -0.757)
  g.closePath()
  g.fill()
  // pierna larga: muslo, greba y bota en el estribo, por delante del cuerpo
  const leg = new Path2D()
  bone(leg, 0.0, -0.02, 0.22, 0.12, 0.1, 0.075)
  bone(leg, 0.22, 0.12, 0.15, 0.47, 0.07, 0.055)
  g.fillStyle = Q.armorDark
  g.fill(leg)
  g.fillStyle = Q.boot
  g.beginPath()
  g.moveTo(0.11, 0.45)
  g.lineTo(0.25, 0.47)
  g.lineTo(0.24, 0.51)
  g.lineTo(0.11, 0.51)
  g.closePath()
  g.fill()
  // brazo de este lado: lleva las riendas
  const arm = new Path2D()
  bone(arm, 0.02, -0.5, 0.08, -0.32, 0.065, 0.055)
  bone(arm, 0.08, -0.32, rein[0], rein[1], 0.055, 0.045)
  g.fillStyle = Q.armor
  g.fill(arm)
  g.restore()
}

const S = {
  skin: '#4e3f3a',
  beard: '#2e2421',
  shirt: '#a99a89',
  vest: '#394b33',
  pants: '#622d23',
  hat: '#9c7640',
  band: '#5a3b22',
  shoe: '#2c211b',
  bag: '#5a3c27',
  stripe: '#94683a',
}

function drawSancho(g, t, rein) {
  const sway = Math.sin(((t * TAU) / DONKEY.cycle) * 2 + 2) * 0.01
  const dangle = Math.sin((t * TAU) / DONKEY.cycle + 0.5) * 0.05
  g.save()
  g.rotate(-0.04 + sway)
  // tronco redondo: camisa y chaleco
  g.fillStyle = S.shirt
  g.fill(path('M-0.12 0.02 C-0.17 -0.16 -0.13 -0.34 -0.04 -0.43 L0.07 -0.43 C0.18 -0.36 0.24 -0.18 0.17 -0.02 Z'))
  g.fillStyle = S.vest
  g.fill(path('M-0.12 0.0 C-0.16 -0.16 -0.13 -0.32 -0.05 -0.42 L0.02 -0.42 C0.0 -0.3 0.02 -0.14 0.05 0.0 Z'))
  // pierna colgando, sin estribo
  const leg = new Path2D()
  bone(leg, 0.02, 0.0, 0.17, 0.08, 0.13, 0.1)
  bone(leg, 0.17, 0.08, 0.13 + dangle, 0.32, 0.09, 0.075)
  g.fillStyle = S.pants
  g.fill(leg)
  g.fillStyle = S.shoe
  g.beginPath()
  g.ellipse(0.16 + dangle, 0.34, 0.07, 0.035, 0.1, 0, TAU)
  g.fill()
  // cabeza redonda de perfil, barba corta y sombrero de paja de ala ancha
  g.fillStyle = S.skin
  g.beginPath()
  g.ellipse(0.03, -0.51, 0.075, 0.08, 0, 0, TAU)
  g.fill()
  g.beginPath()
  g.moveTo(0.09, -0.52)
  g.lineTo(0.125, -0.49)
  g.lineTo(0.095, -0.47)
  g.closePath()
  g.fill()
  g.fillStyle = S.beard
  g.beginPath()
  g.ellipse(0.06, -0.45, 0.06, 0.035, 0.3, 0, TAU)
  g.fill()
  g.fillStyle = S.hat
  g.beginPath()
  g.ellipse(0.03, -0.575, 0.17, 0.028, -0.04, 0, TAU)
  g.fill()
  g.beginPath()
  g.moveTo(-0.045, -0.58)
  g.quadraticCurveTo(-0.04, -0.68, 0.03, -0.685)
  g.quadraticCurveTo(0.1, -0.68, 0.105, -0.58)
  g.closePath()
  g.fill()
  g.fillStyle = S.band
  g.fillRect(-0.045, -0.605, 0.15, 0.02)
  // brazo con las riendas
  const arm = new Path2D()
  bone(arm, 0.03, -0.37, 0.09, -0.22, 0.075, 0.065)
  bone(arm, 0.09, -0.22, rein[0], rein[1], 0.065, 0.05)
  g.fillStyle = S.shirt
  g.fill(arm)
  g.restore()
}

// alforjas a rayas colgando del burro, detrás de la pierna de Sancho
function drawBags(g, x, y) {
  g.fillStyle = S.bag
  g.beginPath()
  g.moveTo(x - 0.26, y + 0.02)
  g.lineTo(x - 0.04, y + 0.02)
  g.lineTo(x - 0.06, y + 0.3)
  g.quadraticCurveTo(x - 0.15, y + 0.34, x - 0.25, y + 0.3)
  g.closePath()
  g.fill()
  g.strokeStyle = S.stripe
  g.lineWidth = 0.02
  for (const k of [0.1, 0.18, 0.26]) {
    g.beginPath()
    g.moveTo(x - 0.255, y + k)
    g.lineTo(x - 0.05, y + k)
    g.stroke()
  }
}

// riendas: de la mano del jinete (en sus coordenadas, escala k sobre la
// silla) al bocado, colgando un poco
function reins(g, saddle, k, hand, bit, color) {
  const hx = saddle[0] + hand[0] * k
  const hy = saddle[1] + hand[1] * k
  g.strokeStyle = color
  g.lineWidth = 0.014
  g.beginPath()
  g.moveTo(hx, hy)
  g.quadraticCurveTo((hx + bit[0]) / 2, Math.max(hy, bit[1]) + 0.08, bit[0], bit[1])
  g.stroke()
}

const QUIJOTE_REIN = [0.27, -0.27]
const QUIJOTE_SIZE = 1.12
const SANCHO_REIN = [0.24, -0.2]
const SANCHO_SIZE = 1.3

// colores de las monturas a contraluz
const ROCINANTE = {
  skin: '#a59c9c',
  far: '#7f7676',
  mane: '#cbc2b9',
  tail: '#c4bbb1',
  hoof: '#352d2a',
  tack: '#7e271e',
  blanket: '#862b22',
  trim: '#c29434',
  saddle: '#432c1f',
}
const RUCIO = {
  skin: '#6e6661',
  far: '#524b47',
  mane: '#3a3330',
  tail: '#5a534e',
  hoof: '#29231f',
  muzzle: '#a2978b',
  tack: '#5e3322',
  blanket: '#4f5c3e',
  trim: '#b08744',
  saddle: '#412d1e',
}

// ---------- molinos y espigas ----------

// molino manchego: torre encalada que se estrecha, chapitel oscuro, palo de
// gobierno y cuatro aspas de listones con la lona tendida. La luz le llega
// por la derecha. k: 1 de cerca; menos, más lejos y perdido en la bruma
function paintMill(g, x, y, s, a, k = 1) {
  const c = (hex) => tone(hex, '#f0c48a', (1 - k) * 0.85)
  g.save()
  g.translate(x, y)
  g.scale(s, s)
  g.lineCap = 'round'
  g.strokeStyle = c('#4a3528')
  g.lineWidth = 2.2
  g.beginPath()
  g.moveTo(-6, -74)
  g.lineTo(-30, -2)
  g.stroke()
  const wall = g.createLinearGradient(-18, 0, 18, 0)
  wall.addColorStop(0, c('#b3a69e'))
  wall.addColorStop(0.45, c('#e3d4bf'))
  wall.addColorStop(0.75, c('#fff2d8'))
  wall.addColorStop(1, c('#f2dab4'))
  g.fillStyle = wall
  g.beginPath()
  g.moveTo(-18, 0)
  g.lineTo(-13.5, -72)
  g.lineTo(13.5, -72)
  g.lineTo(18, 0)
  g.quadraticCurveTo(0, 3, -18, 0)
  g.fill()
  g.fillStyle = c('#3d2c24')
  g.beginPath()
  g.moveTo(-5, 0)
  g.lineTo(-5, -14)
  g.arc(-1, -14, 4, Math.PI, 0)
  g.lineTo(3, 0)
  g.fill()
  g.fillRect(4, -48, 4, 6)
  g.fillStyle = c('#4b3a30')
  g.beginPath()
  g.moveTo(-15.5, -71)
  g.quadraticCurveTo(-12, -92, 1, -96)
  g.quadraticCurveTo(12, -92, 15.5, -71)
  g.closePath()
  g.fill()
  g.fillStyle = c('#a8805c')
  g.beginPath()
  g.moveTo(15.5, -71)
  g.quadraticCurveTo(12, -92, 1, -96)
  g.quadraticCurveTo(9, -88, 12, -71)
  g.closePath()
  g.fill()
  const hy = -80
  const R = 70
  const cloth = new Path2D()
  const slats = new Path2D()
  const spars = new Path2D()
  for (let i = 0; i < 4; i++) {
    const b = a + (i * TAU) / 4
    const cb = Math.cos(b)
    const sb = Math.sin(b)
    const px = (u, v) => (u * cb - v * sb) * R
    const py = (u, v) => hy + (u * sb + v * cb) * R
    cloth.moveTo(px(0.22, 0.01), py(0.22, 0.01))
    cloth.lineTo(px(0.95, 0.01), py(0.95, 0.01))
    cloth.lineTo(px(0.95, 0.18), py(0.95, 0.18))
    cloth.lineTo(px(0.22, 0.18), py(0.22, 0.18))
    cloth.closePath()
    for (const v of [0.095, 0.19]) {
      slats.moveTo(px(0.2, v), py(0.2, v))
      slats.lineTo(px(1, v), py(1, v))
    }
    for (let j = 0; j <= 6; j++) {
      const u = 0.2 + (0.8 * j) / 6
      slats.moveTo(px(u, 0), py(u, 0))
      slats.lineTo(px(u, 0.19), py(u, 0.19))
    }
    spars.moveTo(0, hy)
    spars.lineTo(px(1, 0), py(1, 0))
  }
  g.fillStyle = c('#f4e6cf')
  g.globalAlpha = 0.85
  g.fill(cloth)
  g.globalAlpha = 1
  g.strokeStyle = c('#4a3528')
  g.lineWidth = 0.9
  g.stroke(slats)
  g.lineWidth = 2.2
  g.stroke(spars)
  g.fillStyle = c('#2e2420')
  g.beginPath()
  g.arc(0, hy, 3, 0, TAU)
  g.fill()
  g.restore()
}

// una fila de espigas a contraluz en primer plano: tallo oscuro y espiga con
// el filo encendido por el sol (a la derecha). scroll: cuánto ha corrido;
// x0..x1: el tramo que se ve
function wheatRow(ctx, t, scroll, base, x0, x1, k) {
  const stems = new Path2D()
  const rims = new Path2D()
  const ears = new Path2D()
  const poppies = []
  // cada espiga tiene su sitio fijo en el campo; se pintan las que se ven
  const step = 16.3
  for (let i = Math.floor((x0 - 40 + scroll) / step); i <= (x1 + 40 + scroll) / step; i++) {
    const n = ((i % 9973) + 9973) % 9973
    const x = i * step + ((n * 7919) % 13) - scroll
    const h = (70 + ((n * 37) % 90)) * k
    const lean = 0.1 + 0.07 * Math.sin(t * 1.8 + i * 0.7)
    const tx = x + lean * h
    const ty = base - h
    stems.moveTo(x, base)
    stems.quadraticCurveTo(x + lean * h * 0.3, base - h * 0.5, tx, ty)
    if (n % 13 === 5) {
      poppies.push([tx, ty])
      continue
    }
    for (let j = 0; j < 6; j++) {
      const u = j / 6
      const gx = tx + Math.sin(lean) * u * 26 * k + (j % 2 ? 2.4 : -2.4) * k
      const gy = ty - u * 26 * k
      const rot = lean + (j % 2 ? 0.4 : -0.4)
      rims.moveTo(gx + 1.6 + 2.6 * k, gy)
      rims.ellipse(gx + 1.6, gy, 2.6 * k, 4.6 * k, rot, 0, TAU)
      ears.moveTo(gx + 2.6 * k, gy)
      ears.ellipse(gx, gy, 2.6 * k, 4.6 * k, rot, 0, TAU)
    }
  }
  ctx.lineCap = 'round'
  ctx.strokeStyle = '#3e2716'
  ctx.lineWidth = 2 * k
  ctx.stroke(stems)
  ctx.fillStyle = 'rgba(255, 214, 130, 0.9)'
  ctx.fill(rims)
  ctx.fillStyle = '#4a2f1a'
  ctx.fill(ears)
  for (const [x, y] of poppies) {
    ctx.fillStyle = '#8e1e1c'
    ctx.beginPath()
    ctx.ellipse(x, y - 4 * k, 8 * k, 6 * k, 0, 0, TAU)
    ctx.fill()
    ctx.fillStyle = 'rgba(255, 150, 100, 0.8)'
    ctx.beginPath()
    ctx.ellipse(x + 3 * k, y - 7 * k, 4 * k, 2.6 * k, 0.4, 0, TAU)
    ctx.fill()
  }
}

// ---------- luz de contraluz ----------
// Un grupo (montura + jinete) se pinta en un lienzo aparte, a la resolución
// de la cámara (k px por unidad), y se le pone luz: un filo cálido en los
// bordes que miran al sol con un resplandor que se sale, la luz rojiza que
// rebota en la tierra por debajo, la del cielo por arriba y su sombra larga.
function makeLight() {
  const a = document.createElement('canvas')
  const b = document.createElement('canvas')
  const ga = a.getContext('2d')
  const gb = b.getContext('2d')
  return function lit(ctx, k, box, draw, o) {
    const [x0, y0, w, h] = box
    const pw = Math.ceil(w * k)
    const ph = Math.ceil(h * k)
    if (a.width < pw || a.height < ph) {
      a.width = b.width = Math.max(a.width, pw)
      a.height = b.height = Math.max(a.height, ph)
    }
    ga.setTransform(1, 0, 0, 1, 0, 0)
    ga.clearRect(0, 0, a.width, a.height)
    ga.setTransform(k, 0, 0, k, -x0 * k, -y0 * k)
    draw(ga)
    ga.setTransform(1, 0, 0, 1, 0, 0)

    const sil = (color) => {
      gb.setTransform(1, 0, 0, 1, 0, 0)
      gb.globalCompositeOperation = 'source-over'
      gb.clearRect(0, 0, b.width, b.height)
      gb.drawImage(a, 0, 0)
      gb.globalCompositeOperation = 'source-in'
      gb.fillStyle = color
      gb.fillRect(0, 0, pw, ph)
    }
    const put = (canvas) => ctx.drawImage(canvas, 0, 0, pw, ph, x0, y0, pw / k, ph / k)

    // la sombra larga: la silueta tumbada sobre el suelo, hacia atrás
    const sh = o.shadow
    sil(sh.color)
    ctx.save()
    ctx.globalAlpha *= sh.alpha
    ctx.transform(1, 0, sh.lean, -sh.len, -sh.lean * sh.ground, (1 + sh.len) * sh.ground)
    put(b)
    ctx.restore()

    // un borde de la silueta: ella menos ella misma corrida (dx, dy)
    const edge = (color, dx, dy, alpha, blur) => {
      sil(color)
      gb.globalCompositeOperation = 'destination-out'
      gb.drawImage(a, dx * k, dy * k)
      ga.globalCompositeOperation = 'source-atop'
      ga.globalAlpha = alpha
      ga.filter = `blur(${blur * k}px)`
      ga.drawImage(b, 0, 0)
      ga.filter = 'none'
      ga.globalAlpha = 1
      ga.globalCompositeOperation = 'source-over'
    }
    edge(o.bounce, 0, -o.d * 4, 0.35, o.d * 2)
    edge(o.sky, 0, o.d * 3, 0.22, o.d * 2)
    edge(o.glow, -o.lx * o.d * 4, -o.ly * o.d * 4, 0.5, o.d * 1.6)
    edge(o.rim, -o.lx * o.d * 1.6, -o.ly * o.d * 1.6, 1, o.d * 0.3)
    put(a)
    // el resplandor que se derrama fuera del borde
    sil(o.glow)
    gb.globalCompositeOperation = 'destination-out'
    gb.drawImage(a, -o.lx * o.d * 2 * k, -o.ly * o.d * 2 * k)
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.globalAlpha *= 0.35
    ctx.filter = `blur(${o.d * 2.2 * k}px)`
    put(b)
    ctx.restore()
  }
}

const LIGHT = {
  lx: 0.85,
  ly: -0.52,
  d: 3,
  rim: '#fff3cc',
  glow: '#ffcf78',
  bounce: '#c8643c',
  sky: '#ffd99c',
}

// polvo dorado que levanta cada pisada y se queda atrás
function dustSprite() {
  const c = makeCanvas(64, 64)
  const g = c.getContext('2d')
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  r.addColorStop(0, 'rgba(255, 226, 176, 0.95)')
  r.addColorStop(0.45, 'rgba(240, 196, 140, 0.5)')
  r.addColorStop(1, 'rgba(232, 180, 124, 0)')
  g.fillStyle = r
  g.fillRect(0, 0, 64, 64)
  return c
}

// ---------- la escena ----------

export function createQuijoteScene(canvas) {
  const ctx = canvas.getContext('2d')
  const lit = makeLight()
  const dust = dustSprite()
  let W = 1
  let H = 1
  let dpr = 1
  let V = 1
  let VW = 1000
  let K = 1
  const L = {}
  // disposición: horizonte, suelos, tamaño y sitio de los dos
  const P = {}

  function resize() {
    const r = canvas.getBoundingClientRect()
    W = Math.max(1, r.width)
    H = Math.max(1, r.height)
    dpr = Math.min(window.devicePixelRatio || 1, 1.25)
    canvas.width = Math.round(W * dpr)
    canvas.height = Math.round(H * dpr)
    V = H / 1000
    VW = W / V
    K = V * dpr
    build()
  }

  function layer(w, h) {
    const c = makeCanvas(w * K, h * K)
    const g = c.getContext('2d')
    g.scale(K, K)
    return { c, g, w, h }
  }

  function build() {
    const r = rng(1605)
    const tall = VW < 800
    P.HZ = tall ? 470 : 540
    P.road = tall ? 650 : 760
    P.s = tall ? Math.min(230, VW * 0.36) : 230
    P.qx = VW * (tall ? 0.56 : 0.58)
    P.qy = tall ? 790 : 895
    P.sx = tall ? P.qx - P.s * 1.15 : VW * 0.33
    P.sy = P.qy - (tall ? 40 : 45)
    P.ss = P.s * 0.69
    P.sunX = VW * 0.84
    // el suelo corre a la velocidad de los cascos del caballo
    P.speed = (HORSE.stride / (HORSE.duty * HORSE.cycle)) * P.s
    const travel = P.speed * 10

    // el cielo lleva margen alrededor: la cámara se aleja al final
    const sky = layer(VW * 1.5, P.HZ + 460)
    sky.g.translate(VW * 0.25, 400)
    const v = sky.g.createLinearGradient(0, -400, 0, P.HZ)
    v.addColorStop(0, '#c9703f')
    v.addColorStop(0.35, '#d9824a')
    v.addColorStop(0.65, '#eda75a')
    v.addColorStop(0.9, '#f6cf7c')
    v.addColorStop(1, '#fbe2a0')
    sky.g.fillStyle = v
    sky.g.fillRect(-VW * 0.25, -400, VW * 1.5, P.HZ + 460)
    sky.g.save()
    sky.g.translate(P.sunX, P.HZ - 60)
    sky.g.scale(1, 0.75)
    const glow = sky.g.createRadialGradient(0, 0, 0, 0, 0, Math.max(VW, 900) * 0.5)
    glow.addColorStop(0, 'rgba(255, 252, 228, 1)')
    glow.addColorStop(0.08, 'rgba(255, 238, 180, 0.9)')
    glow.addColorStop(0.3, 'rgba(255, 210, 130, 0.35)')
    glow.addColorStop(1, 'rgba(255, 200, 120, 0)')
    sky.g.fillStyle = glow
    sky.g.fillRect(-VW * 2, -VW * 2, VW * 4, VW * 4)
    sky.g.restore()
    // nubes largas, doradas
    sky.g.filter = 'blur(6px)'
    for (let i = 0; i < 5; i++) {
      const cy = P.HZ * 0.28 + i * P.HZ * 0.13 + r() * 30
      const cx = r() * VW
      const len = 200 + r() * 320
      for (let k = 0; k < 14; k++) {
        sky.g.fillStyle = `rgba(255, 236, 196, ${0.22 + r() * 0.2})`
        sky.g.beginPath()
        sky.g.ellipse(cx + (r() - 0.5) * len, cy + (r() - 0.5) * 10, 30 + r() * 60, 5 + r() * 7, 0, 0, TAU)
        sky.g.fill()
      }
    }
    sky.g.filter = 'none'
    L.sky = sky

    // sierras lejanas con cipreses diminutos y molinos muy pequeños
    const far = layer(VW + travel * 0.06 + 60, 160)
    const ridgeFar = (x) => 110 - 22 * Math.sin(x * 0.004 + 1) - 14 * Math.sin(x * 0.011)
    far.g.fillStyle = '#e2a868'
    far.g.beginPath()
    far.g.moveTo(0, 160)
    for (let x = 0; x <= far.w; x += 8) far.g.lineTo(x, ridgeFar(x))
    far.g.lineTo(far.w, 160)
    far.g.fill()
    far.g.fillStyle = '#c58a55'
    for (let i = 0; i < 26; i++) {
      const x = r() * far.w
      far.g.beginPath()
      far.g.ellipse(x, ridgeFar(x) - 4, 2.5, 8, 0, 0, TAU)
      far.g.fill()
    }
    L.far = far

    const hills = layer(VW + travel * 0.18 + 60, 220)
    const ridge = (x) => 150 - 70 * Math.max(0, Math.sin((x / hills.w) * Math.PI * 2.6 + 0.4)) ** 1.5
    hills.g.fillStyle = '#c98b55'
    hills.g.beginPath()
    hills.g.moveTo(0, 220)
    for (let x = 0; x <= hills.w; x += 6) hills.g.lineTo(x, ridge(x))
    hills.g.lineTo(hills.w, 220)
    hills.g.fill()
    L.tiny = []
    for (let x = 120; x < hills.w; x += 140 + r() * 160) {
      if (ridge(x) < 120) L.tiny.push({ x, y: ridge(x) + 2, s: 0.28 + r() * 0.08, a: r() * TAU })
    }
    L.hills = hills

    // la loma de los molinos grandes, más cerca. Los molinos quedan delante
    // de los dos, hacia el sol: cabalgan hacia ellos (y don Quijote acaba
    // apuntándoles con la lanza)
    const loma = layer(VW + travel * 0.32 + 80, 140)
    const ahead = P.qx + 0.32 * P.speed * T.lance[1]
    const bump = (x, c, w) => (Math.abs(x - c) < w ? Math.cos(((x - c) / w) * (Math.PI / 2)) ** 2 : 0)
    const lomaY = (x) =>
      70 - 48 * bump(x, ahead + VW * 0.22, VW * 0.42) - 36 * bump(x, VW * 0.12, VW * 0.3) - 6 * Math.sin(x * 0.01)
    const lg = loma.g.createLinearGradient(0, 20, 0, 140)
    lg.addColorStop(0, '#b97c4a')
    lg.addColorStop(1, '#a8703f')
    loma.g.fillStyle = lg
    loma.g.beginPath()
    loma.g.moveTo(0, 140)
    for (let x = 0; x <= loma.w; x += 5) loma.g.lineTo(x, lomaY(x))
    loma.g.lineTo(loma.w, 140)
    loma.g.fill()
    loma.g.strokeStyle = 'rgba(255, 226, 160, 0.6)'
    loma.g.lineWidth = 2
    loma.g.beginPath()
    for (let x = 0; x <= loma.w; x += 5) loma.g.lineTo(x, lomaY(x))
    loma.g.stroke()
    L.mills = [-0.2, -0.05, 0.1, 0.24, 0.38]
      .map((f) => ahead + VW * f)
      .concat([VW * 0.04, VW * 0.16])
      .map((x) => ({ x, y: lomaY(x) + 3, s: 0.85 + r() * 0.25, a: r() * TAU, k: 0.9 + r() * 0.2 }))
    L.loma = loma

    // campos: bandas de cultivos con surcos
    const fields = layer(VW + travel * 0.45 + 80, 260)
    const bands = ['#a6a86a', '#d8b25e', '#8d9157', '#cf9a52', '#9fa465', '#b8703f']
    for (let y = 0, i = 0; y < 260; i++) {
      const h = 18 + y * 0.35
      fields.g.fillStyle = bands[i % bands.length]
      fields.g.fillRect(0, y, fields.w, h + 1)
      fields.g.globalAlpha = 0.18
      fields.g.strokeStyle = '#5a4a2c'
      fields.g.lineWidth = 1
      for (let x = r() * 30; x < fields.w; x += 14 + r() * 20) {
        fields.g.beginPath()
        fields.g.moveTo(x, y + 2)
        fields.g.lineTo(x + 18, y + h - 2)
        fields.g.stroke()
      }
      fields.g.globalAlpha = 1
      y += h
    }
    L.fields = fields

    // el camino de tierra roja por donde van
    const road = layer(VW + travel + 200, 1000 - P.road + 40)
    const rg = road.g.createLinearGradient(0, 0, 0, road.h)
    rg.addColorStop(0, '#b4683c')
    rg.addColorStop(0.75, '#8a4a2c')
    rg.addColorStop(1, '#6a3822')
    road.g.fillStyle = rg
    road.g.fillRect(0, 0, road.w, road.h)
    for (let i = 0; i < road.w * 0.6; i++) {
      road.g.fillStyle = r() < 0.5 ? 'rgba(214, 150, 96, 0.35)' : 'rgba(96, 52, 32, 0.25)'
      road.g.beginPath()
      road.g.ellipse(r() * road.w, r() * road.h, 3 + r() * 10, 1 + r() * 2, 0, 0, TAU)
      road.g.fill()
    }
    L.road = road
  }

  // la cámara: zoom alrededor de los cascos del caballo al empezar, luego se
  // aleja, y al final sube y se aleja más. Cada capa la sigue según su
  // distancia (d): lo lejano apenas se mueve, lo cercano mucho
  function camera(t) {
    const pull = outCubic(span(t, T.pull))
    const rise = smooth(span(t, T.rise))
    return {
      z: mix(mix(2.45, 2.3, span(t, T.close)), 1, pull) - 0.03 * span(t, [T.pull[1], T.rise[0]]) - 0.25 * rise,
      fy: mix(P.qy + 105, 500, pull),
      up: 140 * rise,
      pull,
    }
  }
  function view(cam, d) {
    const z = 1 + (cam.z - 1) * d
    const fx = P.qx
    const ox = fx - fx * z
    const oy = cam.fy - cam.fy * z + cam.up * d
    ctx.setTransform(K * z, 0, 0, K * z, K * ox, K * oy)
    // lo que se ve de esta capa, en sus coordenadas
    return { z, x0: -ox / z, y0: -oy / z, x1: (VW - ox) / z, y1: (1000 - oy) / z }
  }

  // la caja de un grupo recortada a lo que se ve (con margen, para que el
  // borde del recorte no se tome por silueta)
  function visible(box, v) {
    const m = 30
    const x0 = Math.max(box[0], v.x0 - m)
    const y0 = Math.max(box[1], v.y0 - m)
    const x1 = Math.min(box[0] + box[2], v.x1 + m)
    const y1 = Math.min(box[1] + box[3], v.y1 + m)
    return x1 > x0 && y1 > y0 ? [x0, y0, x1 - x0, y1 - y0] : null
  }

  // nube de polvo de las pisadas: cada casco, al apoyarse, deja una que se
  // queda atrás con el suelo y se deshace en un segundo
  function drawDust(t, M, x, y, s, lag) {
    for (const [leg, off] of LEGS) {
      const hx = M[leg].x - (off >= 0.5 ? 0.05 : 0) + M.stride / 2 + (leg === 'hind' ? -0.02 : 0.02)
      const last = Math.floor((t + lag) / M.cycle + off)
      for (let n = last; n > last - 3; n--) {
        const t0 = (n - off) * M.cycle - lag
        const age = t - t0
        if (age < 0 || age > 1.1) continue
        const px = x + hx * s - P.speed * age
        for (let i = 0; i < 3; i++) {
          const rr = s * (0.06 + age * 0.26) * (1 - i * 0.2)
          ctx.globalAlpha = 0.6 * (1 - age / 1.1) ** 2
          ctx.drawImage(dust, px - rr - i * s * 0.06 * age, y - rr * 0.9 - i * s * 0.04 * age, rr * 2, rr * 1.4)
        }
      }
    }
    ctx.globalAlpha = 1
  }

  function frame(t) {
    const cam = camera(t)
    const cx = P.speed * t
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'

    view(cam, 0.1)
    ctx.drawImage(L.sky.c, -VW * 0.25, -400, L.sky.w, L.sky.h)
    view(cam, 0.25)
    ctx.drawImage(L.far.c, -cx * 0.06, P.HZ - 140, L.far.w, L.far.h)
    view(cam, 0.35)
    const hx = -cx * 0.18
    ctx.drawImage(L.hills.c, hx, P.HZ - 160, L.hills.w, L.hills.h)
    for (const m of L.tiny) {
      const x = m.x + hx
      if (x > -30 && x < VW + 30) paintMill(ctx, x, P.HZ - 160 + m.y, m.s, m.a - t * 0.5, 0.35)
    }
    view(cam, 0.5)
    const lx = -cx * 0.32
    ctx.drawImage(L.loma.c, lx, P.HZ - 70, L.loma.w, L.loma.h)
    for (const m of L.mills) {
      const x = m.x + lx
      if (x > -120 && x < VW + 120) paintMill(ctx, x, P.HZ - 70 + m.y, m.s, m.a - t * 0.55 * m.k, 1)
    }
    view(cam, 0.7)
    ctx.drawImage(L.fields.c, -cx * 0.45, P.HZ + 40, L.fields.w, L.fields.h)
    const v = view(cam, 1)
    ctx.drawImage(L.road.c, -cx, P.road, L.road.w, L.road.h)

    // los dos, con el polvo de sus pisadas y la luz de contraluz
    const k = Math.min(K * v.z, 1.5 * dpr)
    const raise = span(t, T.lance)
    drawDust(t, DONKEY, P.sx, P.sy, P.ss, DONKEY_LAG)
    const boxS = visible([P.sx - P.ss * 1.1, P.sy - P.ss * 2.1, P.ss * 2.4, P.ss * 2.2], v)
    if (boxS) lit(ctx, k, boxS, (g) => {
      g.translate(P.sx, P.sy)
      g.scale(P.ss, P.ss)
      const m = drawMount(g, DONKEY, t + DONKEY_LAG, RUCIO, 'donkey')
      g.save()
      g.translate(m.saddle[0], m.saddle[1])
      drawBags(g, 0.1, 0.02)
      g.scale(SANCHO_SIZE, SANCHO_SIZE)
      drawSancho(g, t, SANCHO_REIN)
      g.restore()
      reins(g, m.saddle, SANCHO_SIZE, SANCHO_REIN, m.bit, RUCIO.tack)
    }, { ...LIGHT, shadow: { color: '#5a2c1a', ground: P.sy, lean: 0.9, len: 0.22, alpha: 0.4 } })
    drawDust(t, HORSE, P.qx, P.qy, P.s, 0)
    const boxQ = visible([P.qx - P.s * 1.05, P.qy - P.s * 3.4, P.s * 2.4, P.s * 3.45], v)
    if (boxQ) lit(ctx, k, boxQ, (g) => {
      g.translate(P.qx, P.qy)
      g.scale(P.s, P.s)
      const m = drawMount(g, HORSE, t, ROCINANTE, 'horse')
      g.save()
      g.translate(m.saddle[0], m.saddle[1])
      g.scale(QUIJOTE_SIZE, QUIJOTE_SIZE)
      drawQuijote(g, t, raise, QUIJOTE_REIN)
      g.restore()
      reins(g, m.saddle, QUIJOTE_SIZE, QUIJOTE_REIN, m.bit, ROCINANTE.tack)
    }, { ...LIGHT, shadow: { color: '#5a2c1a', ground: P.qy, lean: 0.9, len: 0.22, alpha: 0.4 } })

    // primer plano: espigas a contraluz que pasan deprisa. En el plano de los
    // cascos quedan por debajo y suben cuando la cámara se aleja
    const near = view(cam, 1.35)
    wheatRow(ctx, t, cx * 1.5, mix(1120, 1000, cam.pull), near.x0, near.x1, 1)
    // un tronco oscuro, muy cerca, cruza por delante a la mitad, como en la
    // referencia
    view(cam, 1.7)
    const tx = VW * 0.5 + P.speed * 4.2 * (T.trunk - t)
    if (tx > -300 && tx < VW + 300) {
      ctx.fillStyle = '#2f2019'
      ctx.beginPath()
      ctx.moveTo(tx - 62, 1100)
      ctx.quadraticCurveTo(tx - 30, 500, tx - 52, -300)
      ctx.lineTo(tx + 58, -300)
      ctx.quadraticCurveTo(tx + 40, 520, tx + 70, 1100)
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = '#4a5530'
      for (let i = 0; i < 9; i++) {
        ctx.beginPath()
        ctx.ellipse(tx - 220 + i * 62, -50 + (i % 3) * 30, 120, 80, 0, 0, TAU)
        ctx.fill()
      }
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0)
  }

  resize()
  return { frame, resize, dispose() {} }
}
