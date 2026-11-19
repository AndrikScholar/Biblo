// Cien años de soledad: la pintura de su portada (pared naranja de textura
// rugosa, zócalo azul, raya roja, la puerta azul y roja con sus dos faroles).
// Lo comparten la entrada (macondoScene.js), el ambiente de lluvia de la
// ficha (macondoRain.js) y las mariposas de los bordes (MacondoButterflies.jsx).

export const TAU = Math.PI * 2

export const PAL = {
  orange: '#f39a2a',
  orangeDeep: '#e2801d',
  red: '#e2441f',
  redDeep: '#b8301a',
  blue: '#1d8ccc',
  blueDeep: '#13649c',
  sky: '#43b4e4',
  yellow: '#ffd23a',
  yellowDeep: '#e7a915',
  cream: '#f6ecd6',
  ink: '#1d1714',
  iron: '#1f3d5c',
}

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

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
export function tint(a, b, f, alpha = 1) {
  const p = rgb(a)
  const q = rgb(b)
  return `rgba(${p.map((v, i) => Math.round(mix(v, q[i], f))).join(', ')}, ${alpha})`
}

// ---------- la textura de la pared ----------

// Grano de pintura sobre revoque: motas claras y oscuras y pequeñas grietas
// rojizas, como en la portada. Se pinta una vez y se pone encima de todo con
// poca opacidad: así cualquier forma plana parece pintada sobre la pared.
export function grainTexture(w, h, seed = 1967) {
  const c = makeCanvas(w, h)
  const g = c.getContext('2d')
  const r = rng(seed)
  for (let i = 0; i < (w * h) / 26; i++) {
    const light = r() < 0.5
    g.fillStyle = light ? `rgba(255, 245, 220, ${0.08 + r() * 0.12})` : `rgba(70, 20, 0, ${0.07 + r() * 0.12})`
    g.fillRect(r() * w, r() * h, 1 + r() * 2.2, 1 + r() * 2.2)
  }
  g.lineCap = 'round'
  for (let i = 0; i < (w * h) / 5200; i++) {
    const x = r() * w
    const y = r() * h
    const a = r() * TAU
    const l = 3 + r() * 9
    g.strokeStyle = `rgba(150, 30, 10, ${0.12 + r() * 0.16})`
    g.lineWidth = 1 + r()
    g.beginPath()
    g.moveTo(x, y)
    g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l)
    g.stroke()
  }
  return c
}

// pinceladas largas de dos tonos sobre la madera del marco (deterministas)
export function brushStrokes(seed, n, w, h, colors) {
  const r = rng(seed)
  return Array.from({ length: n }, () => ({
    x: r() * w,
    y: r() * h,
    l: 12 + r() * h * 0.25,
    w: 1 + r() * 3,
    dx: (r() - 0.5) * 4,
    c: colors[Math.floor(r() * colors.length)],
  }))
}

export function drawStrokes(g, strokes, ox, oy, alpha = 1) {
  g.save()
  g.lineCap = 'round'
  for (const s of strokes) {
    g.strokeStyle = s.c
    g.globalAlpha = alpha
    g.lineWidth = s.w
    g.beginPath()
    g.moveTo(ox + s.x, oy + s.y)
    g.lineTo(ox + s.x + s.dx, oy + s.y + s.l)
    g.stroke()
  }
  g.restore()
}

// ---------- la fachada de la portada ----------
// Medidas en unidades de la pared, con el centro de la puerta en x = 0.
// La puerta mide 220 de ancho por 560 de alto (de y = 430 a 990).
export const DOOR = { w: 220, h: 560, top: 430, frame: 42, stripe: 760 }

export function makeFacade(seed = 100) {
  return {
    frameStrokes: brushStrokes(seed, 160, DOOR.w + DOOR.frame * 2, DOOR.h + 70, [
      'rgba(255, 210, 60, 0.55)',
      'rgba(10, 60, 120, 0.45)',
      'rgba(150, 230, 255, 0.4)',
    ]),
    leafStrokes: brushStrokes(seed + 1, 70, DOOR.w / 2, DOOR.h, [
      'rgba(255, 200, 40, 0.45)',
      'rgba(140, 20, 0, 0.35)',
    ]),
  }
}

// Pinta la pared con su puerta. `open` (0..1) abre las hojas hacia dentro;
// `inside(g)` pinta lo que se ve por el hueco (recortado al hueco).
// `lit` (0..1) enciende los faroles.
export function drawFacade(g, F, { open = 0, inside = null, lit = 1, halfW = 1400 }) {
  const { w, h, top, frame, stripe } = DOOR
  const bottom = top + h
  // pared y zócalo
  g.fillStyle = PAL.orange
  g.fillRect(-halfW, -400, halfW * 2, stripe + 400)
  g.fillStyle = PAL.red
  g.fillRect(-halfW, stripe, halfW * 2, 18)
  g.fillStyle = PAL.blue
  g.fillRect(-halfW, stripe + 18, halfW * 2, 900)
  // sombra que arroja la cornisa sobre la pared
  g.fillStyle = 'rgba(160, 60, 0, 0.25)'
  g.beginPath()
  g.moveTo(w / 2 + frame + 30, top - 40)
  g.lineTo(w / 2 + frame + 90, top + 30)
  g.lineTo(w / 2 + frame + 90, bottom)
  g.lineTo(w / 2 + frame, bottom)
  g.lineTo(w / 2 + frame, top - 40)
  g.closePath()
  g.fill()

  // lo que se ve por el hueco
  g.save()
  g.beginPath()
  g.rect(-w / 2, top, w, h)
  g.clip()
  if (inside && open > 0.001) inside(g)
  else {
    g.fillStyle = '#2a1408'
    g.fillRect(-w / 2, top, w, h)
  }
  // las dos hojas, que giran hacia dentro sobre sus goznes
  for (const k of [-1, 1]) {
    const hinge = k * (w / 2)
    const a = open * 1.45 // ángulo de apertura
    const vis = Math.cos(a) // ancho visible (escorzo)
    const lw = (w / 2) * vis
    const shrink = Math.sin(a) * 26 // el canto libre se aleja: se ve más bajo
    const x0 = hinge
    const x1 = hinge - k * lw
    g.save()
    g.beginPath()
    g.moveTo(x0, top)
    g.lineTo(x1, top + shrink)
    g.lineTo(x1, bottom - shrink * 0.6)
    g.lineTo(x0, bottom)
    g.closePath()
    g.clip()
    g.fillStyle = PAL.red
    g.fillRect(Math.min(x0, x1) - 2, top, Math.abs(lw) + 4, h)
    // tableros: arriba celosía azul, abajo cuarterones naranjas
    g.save()
    g.translate(x0, top)
    g.scale(-k * vis, 1)
    g.fillStyle = PAL.sky
    for (let i = 0; i < 9; i++) g.fillRect(12, 22 + i * 15, w / 2 - 24, 9)
    g.fillStyle = PAL.blueDeep
    for (let i = 0; i < 9; i++) g.fillRect(12, 31 + i * 15, w / 2 - 24, 3)
    g.fillStyle = PAL.redDeep
    g.fillRect(0, 160, w / 2, 10)
    for (let i = 0; i < 3; i++) {
      g.fillStyle = PAL.redDeep
      g.fillRect(14, 186 + i * 122, w / 2 - 28, 106)
      g.fillStyle = PAL.orange
      g.fillRect(22, 194 + i * 122, w / 2 - 44, 90)
    }
    drawStrokes(g, F.leafStrokes, 0, 0, 0.8)
    g.restore()
    // al abrirse, la hoja se oscurece: le da menos luz
    g.fillStyle = `rgba(60, 10, 0, ${open * 0.45})`
    g.fillRect(Math.min(x0, x1) - 2, top, Math.abs(lw) + 4, h)
    g.restore()
    g.strokeStyle = 'rgba(90, 15, 0, 0.6)'
    g.lineWidth = 2
    g.beginPath()
    g.moveTo(x1, top + shrink)
    g.lineTo(x1, bottom - shrink * 0.6)
    g.stroke()
  }
  g.restore()

  // marco azul y cornisa
  g.fillStyle = PAL.sky
  g.fillRect(-w / 2 - frame, top - 10, frame, h + 10)
  g.fillRect(w / 2, top - 10, frame, h + 10)
  g.fillStyle = PAL.blue
  g.fillRect(-w / 2 - frame - 20, top - 52, w + frame * 2 + 40, 24)
  g.fillStyle = PAL.sky
  g.fillRect(-w / 2 - frame - 34, top - 70, w + frame * 2 + 68, 20)
  g.fillRect(-w / 2 - frame - 8, top - 28, w + frame * 2 + 16, 18)
  // pinceladas solo sobre la madera del marco
  g.save()
  g.beginPath()
  g.rect(-w / 2 - frame, top - 10, frame, h + 10)
  g.rect(w / 2, top - 10, frame, h + 10)
  g.rect(-w / 2 - frame - 34, top - 70, w + frame * 2 + 68, 60)
  g.clip()
  drawStrokes(g, F.frameStrokes, -w / 2 - frame, top - 80, 0.9)
  g.restore()
  g.fillStyle = PAL.blueDeep
  g.fillRect(-w / 2 - 6, top, 6, h)
  g.fillRect(w / 2, top, 6, h)
  // escalón rojo
  g.fillStyle = PAL.red
  g.fillRect(-w / 2 - frame - 30, bottom, w + frame * 2 + 60, 26)

  // faroles
  for (const k of [-1, 1]) lantern(g, k * 250, 560, 1.5, lit)
}

export function lantern(g, x, y, s, lit = 1) {
  g.save()
  g.translate(x, y)
  g.scale(s, s)
  if (lit > 0) {
    const glow = g.createRadialGradient(0, 14, 2, 0, 14, 70)
    glow.addColorStop(0, `rgba(255, 230, 150, ${0.55 * lit})`)
    glow.addColorStop(1, 'rgba(255, 230, 150, 0)')
    g.fillStyle = glow
    g.fillRect(-70, -56, 140, 140)
  }
  g.fillStyle = PAL.iron
  g.strokeStyle = '#0d2236'
  g.lineWidth = 1.6
  // brazo que lo sujeta a la pared
  g.beginPath()
  g.moveTo(0, 40)
  g.quadraticCurveTo(0, 56, 10, 58)
  g.stroke()
  // sombrerete
  g.beginPath()
  g.moveTo(-20, -2)
  g.lineTo(20, -2)
  g.lineTo(10, -18)
  g.lineTo(0, -24)
  g.lineTo(-10, -18)
  g.closePath()
  g.fill()
  g.fillRect(-2, -32, 4, 10)
  // cristal
  g.fillStyle = tint('#d9e4e8', '#fff1b8', lit)
  g.fillRect(-13, 0, 26, 30)
  g.strokeRect(-13, 0, 26, 30)
  g.beginPath()
  g.moveTo(0, 0)
  g.lineTo(0, 30)
  g.stroke()
  g.fillStyle = PAL.iron
  g.fillRect(-16, 30, 32, 6)
  g.restore()
}

// ---------- mariposas amarillas ----------

// Mariposa vista desde arriba, con las alas abiertas a medias según `flap`
// (1 abiertas, 0 cerradas de canto). `a`: hacia dónde vuela.
export function butterfly(g, x, y, s, a, flap, alpha = 1) {
  g.save()
  g.translate(x, y)
  g.rotate(a)
  g.scale(s, s)
  g.globalAlpha *= alpha
  const open = 0.18 + 0.82 * cl(flap)
  for (const k of [-1, 1]) {
    g.save()
    g.scale(k * open, 1)
    // ala delantera y trasera
    g.fillStyle = PAL.yellow
    g.beginPath()
    g.moveTo(0, -2)
    g.bezierCurveTo(6, -16, 22, -18, 21, -6)
    g.bezierCurveTo(20, 1, 9, 2, 0, 0)
    g.fill()
    g.fillStyle = '#ffdc55'
    g.beginPath()
    g.moveTo(0, 1)
    g.bezierCurveTo(9, 3, 17, 10, 11, 16)
    g.bezierCurveTo(6, 19, 1, 11, 0, 2)
    g.fill()
    // borde oscuro y una vena
    g.strokeStyle = 'rgba(120, 70, 0, 0.75)'
    g.lineWidth = 1 / s
    g.beginPath()
    g.moveTo(21, -6)
    g.bezierCurveTo(20, 1, 9, 2, 0, 0)
    g.moveTo(2, -3)
    g.lineTo(15, -11)
    g.stroke()
    g.fillStyle = 'rgba(110, 60, 0, 0.8)'
    g.beginPath()
    g.arc(17, -11, 1.6, 0, TAU)
    g.fill()
    g.restore()
  }
  g.fillStyle = '#3a2508'
  g.beginPath()
  g.ellipse(0, 1, 1.4, 7, 0, 0, TAU)
  g.fill()
  g.strokeStyle = '#3a2508'
  g.lineWidth = 0.8 / s
  g.beginPath()
  g.moveTo(-0.5, -5)
  g.quadraticCurveTo(-3, -10, -5, -11)
  g.moveTo(0.5, -5)
  g.quadraticCurveTo(3, -10, 5, -11)
  g.stroke()
  g.restore()
}

// el aleteo de una mariposa: rápido y a golpes, no una onda suave
export function flapAt(t, speed = 11, phase = 0) {
  const x = Math.sin(t * speed + phase)
  return 0.5 + 0.5 * Math.sign(x) * Math.pow(Math.abs(x), 0.6)
}

// ---------- florecitas amarillas ----------

// una florecita de cuatro pétalos, ya pintada (se reutiliza como sprite)
export function flowerSprite(size, seed = 3) {
  const r = rng(seed)
  const c = makeCanvas(size, size)
  const g = c.getContext('2d')
  const m = size / 2
  const p = size * 0.2
  for (let k = 0; k < 4; k++) {
    const a = (k * TAU) / 4 + r() * 0.3
    g.fillStyle = k % 2 ? PAL.yellow : '#ffe36b'
    g.beginPath()
    g.ellipse(m + Math.cos(a) * p, m + Math.sin(a) * p, p * 1.15, p * 0.72, a, 0, TAU)
    g.fill()
  }
  g.fillStyle = PAL.yellowDeep
  g.beginPath()
  g.arc(m, m, p * 0.45, 0, TAU)
  g.fill()
  return c
}
