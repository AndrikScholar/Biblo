// La cara del Gato de Cheshire para la ficha de Alicia, pintada una sola vez
// como un óleo: un fondo de color difuminado, miles de trazos de pelo que
// salen de la nariz hacia fuera, luz desde arriba a la izquierda y sombra
// violeta en los bordes (la del fondo de la ficha). Pelo gris y blanco con
// rayas turquesa y negras, ojos verdes que brillan y una sonrisa enorme.
// Se pinta en tres lienzos que se apilan (cara, ojos y sonrisa) para que
// desaparezcan por orden, con la sonrisa siempre la última.

const S = 512 // los lienzos son de 512 × 512
const NX = 256 // la nariz
const NY = 290
const U = 180 // medio ancho de la cara, en px

const P = (u, v) => [NX + u * U, NY + v * U]
const clamp = (x) => Math.min(1, Math.max(0, x))
const sm = (x) => {
  const t = clamp(x)
  return t * t * (3 - 2 * t)
}
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]

// azar con semilla: el gato sale igual cada vez
function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const COL = {
  white: [242, 245, 246],
  light: [205, 213, 218],
  mid: [138, 148, 156],
  dark: [64, 70, 80],
  black: [18, 20, 26],
  teal: [30, 170, 186],
  tealLight: [96, 220, 228],
  ear: [242, 170, 128],
  earDeep: [190, 104, 82],
}

const EYE_U = 0.42
const EYE_V = -0.3

// interior de la oreja derecha (para la izquierda se refleja u)
function inEar(u, v) {
  const [ax, ay, bx, by, cx, cy] = [0.47, -0.84, 0.78, -1.3, 0.88, -0.6]
  const d = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay)
  const s = ((bx - u) * (cy - v) - (cx - u) * (by - v)) / d
  const t = ((cx - u) * (ay - v) - (ax - u) * (cy - v)) / d
  return s > 0 && t > 0 && s + t < 1
}

// color del pelo en cada punto de la cara (u, v: unidades de cara, v hacia abajo)
function furColor(u, v) {
  const au = Math.abs(u)
  if (inEar(au, v)) return mix(COL.ear, COL.earDeep, sm((v + 1.25) / 0.6))
  // gris y blanco: más claro en el centro de la cara, más oscuro hacia fuera
  let c = mix(COL.white, COL.light, sm((Math.hypot(u * 0.85, v + 0.1) - 0.2) / 0.5))
  c = mix(c, COL.mid, sm((Math.hypot(u * 0.85, v + 0.1) - 0.65) / 0.45))
  c = mix(c, COL.dark, sm((Math.hypot(u * 0.8, v + 0.1) - 1.0) / 0.4) * 0.8)
  // frente: rayas finas en abanico, turquesa y negras, sobre el gris
  if (v < -0.42) {
    const s = Math.sin(Math.atan2(u, -(v + 0.2)) * 9)
    const k = sm((-0.42 - v) / 0.16)
    if (s > 0.62) c = mix(c, s > 0.86 ? COL.tealLight : COL.teal, k * sm((s - 0.62) / 0.12))
    else if (s < -0.6) c = mix(c, COL.black, k * 0.85 * sm((-0.6 - s) / 0.12))
  }
  // cejas turquesa y antifaz oscuro alrededor de los ojos
  const ed = Math.hypot((au - EYE_U) / 0.36, (v - EYE_V) / 0.33)
  if (v < EYE_V - 0.06 && ed > 1.1 && ed < 1.42) c = mix(c, COL.teal, sm((0.13 - Math.abs(ed - 1.26)) / 0.07))
  if (ed < 1.12) c = mix(c, COL.black, sm((1.12 - ed) / 0.25) * 0.9)
  // mejillas: rayas que se abren hacia los lados
  if (au > 0.62 && v > -0.45 && v < 0.62) {
    const s = Math.sin((v - au * 0.4) * 14)
    const k = sm((au - 0.62) / 0.14)
    if (s > 0.64) c = mix(c, COL.teal, k * sm((s - 0.64) / 0.12))
    else if (s < -0.55) c = mix(c, COL.black, k * 0.8 * sm((-0.55 - s) / 0.12))
  }
  // hocico y barbilla blancos
  return mix(c, COL.white, sm((1 - Math.hypot(u / 0.55, (v - 0.24) / 0.42)) / 0.35))
}

// el pelo crece desde la nariz hacia fuera; en las mejillas, hacia los lados
function furDir(u, v) {
  let dx = u
  let dy = v + 0.05
  if (Math.abs(u) > 0.5 && v > -0.4) dy = dy * 0.5 + 0.18
  if (inEar(Math.abs(u), v)) {
    dx = 0
    dy = -1
  }
  const r = Math.hypot(dx, dy) || 1
  return [dx / r, dy / r]
}

function headPath() {
  const p = new Path2D()
  const m = (u, v) => P(u, v)
  p.moveTo(...m(0, -0.94))
  p.quadraticCurveTo(...m(0.22, -0.97), ...m(0.4, -0.86))
  p.quadraticCurveTo(...m(0.6, -1.16), ...m(0.8, -1.42))
  p.quadraticCurveTo(...m(0.98, -0.98), ...m(0.96, -0.5))
  p.bezierCurveTo(...m(1.12, -0.32), ...m(1.26, -0.02), ...m(1.2, 0.16))
  p.bezierCurveTo(...m(1.16, 0.34), ...m(1.0, 0.5), ...m(0.82, 0.6))
  p.bezierCurveTo(...m(0.6, 0.74), ...m(0.3, 0.82), ...m(0, 0.82))
  p.bezierCurveTo(...m(-0.3, 0.82), ...m(-0.6, 0.74), ...m(-0.82, 0.6))
  p.bezierCurveTo(...m(-1.0, 0.5), ...m(-1.16, 0.34), ...m(-1.2, 0.16))
  p.bezierCurveTo(...m(-1.26, -0.02), ...m(-1.12, -0.32), ...m(-0.96, -0.5))
  p.quadraticCurveTo(...m(-0.98, -0.98), ...m(-0.8, -1.42))
  p.quadraticCurveTo(...m(-0.6, -1.16), ...m(-0.4, -0.86))
  p.quadraticCurveTo(...m(-0.22, -0.97), ...m(0, -0.94))
  p.closePath()
  return p
}

const rgb = ([r, g, b], a = 1) => `rgba(${r | 0}, ${g | 0}, ${b | 0}, ${a})`

function paintFace(g) {
  const head = headPath()
  const r = rng(11)

  // 1) fondo de color: el mapa de pelo en celdas, difuminado
  const under = document.createElement('canvas')
  under.width = under.height = S
  const ug = under.getContext('2d')
  for (let y = 0; y < S; y += 4) {
    for (let x = 0; x < S; x += 4) {
      if (!ug.isPointInPath(head, x + 2, y + 2)) continue
      ug.fillStyle = rgb(furColor((x + 2 - NX) / U, (y + 2 - NY) / U))
      ug.fillRect(x, y, 4, 4)
    }
  }
  g.filter = 'blur(4px)'
  g.drawImage(under, 0, 0)
  g.filter = 'none'

  // 2) pelo: trazos cortos que siguen la dirección del pelaje; en el borde
  // salen hacia fuera y lo deshilachan
  g.lineCap = 'round'
  const fur = (n, lenK, w0, w1, alpha, light) => {
    for (let i = 0; i < n; i++) {
      const x = 16 + r() * (S - 32)
      const y = 16 + r() * (S - 32)
      if (!g.isPointInPath(head, x, y)) continue
      const u = (x - NX) / U
      const v = (y - NY) / U
      const [dx, dy] = furDir(u, v)
      const len = (5 + 17 * Math.min(1, Math.hypot(u, v + 0.05))) * lenK * (0.7 + r() * 0.6)
      const j = 1 + (r() - 0.5) * 0.24 + light
      const c = furColor(u + (r() - 0.5) * 0.05, v + (r() - 0.5) * 0.05).map((k) => Math.min(255, k * j))
      const bend = (r() - 0.5) * 0.5
      g.strokeStyle = rgb(c, alpha)
      g.lineWidth = w0 + r() * (w1 - w0)
      g.beginPath()
      g.moveTo(x, y)
      g.quadraticCurveTo(x + dx * len * 0.5 - dy * len * bend, y + dy * len * 0.5 + dx * len * bend, x + dx * len, y + dy * len)
      g.stroke()
    }
  }
  fur(7000, 1.25, 1.6, 2.8, 0.7, -0.1)
  fur(7000, 0.95, 1.1, 2, 0.8, 0.03)
  fur(3000, 0.6, 0.8, 1.4, 0.55, 0.24)

  // 3) volumen: luz arriba a la izquierda, sombra violeta en los bordes y
  // las cuencas de los ojos hundidas
  g.globalCompositeOperation = 'source-atop'
  const vol = g.createRadialGradient(...P(-0.35, -0.6), 8, ...P(-0.05, -0.15), U * 1.4)
  vol.addColorStop(0, 'rgba(255, 255, 255, 0.26)')
  vol.addColorStop(0.38, 'rgba(255, 255, 255, 0)')
  vol.addColorStop(0.72, 'rgba(18, 12, 46, 0.3)')
  vol.addColorStop(1, 'rgba(18, 12, 46, 0.78)')
  g.fillStyle = vol
  g.fillRect(0, 0, S, S)
  // la mandíbula y la parte baja de las mejillas quedan en sombra
  const jaw = g.createLinearGradient(0, P(0, 0.25)[1], 0, P(0, 0.85)[1])
  jaw.addColorStop(0, 'rgba(14, 10, 40, 0)')
  jaw.addColorStop(1, 'rgba(14, 10, 40, 0.5)')
  g.fillStyle = jaw
  g.fillRect(0, 0, S, S)
  // las mejillas abultadas recogen algo de luz
  for (const side of [-1, 1]) {
    const [cx, cy] = P(side * 0.78, -0.02)
    const cheek = g.createRadialGradient(cx, cy - U * 0.08, 4, cx, cy, U * 0.42)
    cheek.addColorStop(0, `rgba(255, 255, 255, ${side < 0 ? 0.2 : 0.1})`)
    cheek.addColorStop(1, 'rgba(255, 255, 255, 0)')
    g.fillStyle = cheek
    g.fillRect(0, 0, S, S)
  }
  for (const side of [-1, 1]) {
    const [ex, ey] = P(side * EYE_U, EYE_V)
    const sock = g.createRadialGradient(ex, ey, U * 0.2, ex, ey, U * 0.42)
    sock.addColorStop(0, 'rgba(0, 0, 0, 0.55)')
    sock.addColorStop(1, 'rgba(0, 0, 0, 0)')
    g.fillStyle = sock
    g.fillRect(0, 0, S, S)
  }
  g.globalCompositeOperation = 'source-over'

  // 4) nariz anaranjada y el surco que baja a la boca
  const nose = new Path2D()
  nose.moveTo(...P(-0.09, -0.07))
  nose.quadraticCurveTo(...P(0, -0.11), ...P(0.09, -0.07))
  nose.quadraticCurveTo(...P(0.07, 0.01), ...P(0, 0.05))
  nose.quadraticCurveTo(...P(-0.07, 0.01), ...P(-0.09, -0.07))
  const ng = g.createLinearGradient(0, P(0, -0.1)[1], 0, P(0, 0.05)[1])
  ng.addColorStop(0, '#f6bd9c')
  ng.addColorStop(1, '#c4705a')
  g.fillStyle = ng
  g.fill(nose)
  g.strokeStyle = 'rgba(70, 30, 30, 0.75)'
  g.lineWidth = 2
  g.stroke(nose)
  g.fillStyle = 'rgba(255, 245, 235, 0.75)'
  g.beginPath()
  g.ellipse(...P(-0.025, -0.06), 6, 3, -0.2, 0, Math.PI * 2)
  g.fill()
  g.strokeStyle = 'rgba(40, 24, 28, 0.8)'
  g.lineWidth = 2.4
  g.beginPath()
  g.moveTo(...P(0, 0.05))
  g.lineTo(...P(0, 0.17))
  g.stroke()

  // 5) puntos de los bigotes y bigotes largos, por encima del borde
  g.fillStyle = 'rgba(40, 40, 50, 0.55)'
  for (const side of [-1, 1]) {
    for (let k = 0; k < 9; k++) {
      const [x, y] = P(side * (0.13 + (k % 3) * 0.07), 0.07 + Math.floor(k / 3) * 0.045)
      g.beginPath()
      g.arc(x, y, 1.8, 0, Math.PI * 2)
      g.fill()
    }
  }
  g.lineCap = 'round'
  for (const side of [-1, 1]) {
    for (let k = 0; k < 6; k++) {
      const v0 = 0.08 + k * 0.035
      const [x0, y0] = P(side * 0.3, v0)
      const [cx, cy] = P(side * 0.85, v0 - 0.12 + k * 0.02)
      const [x1, y1] = P(side * (1.3 - k * 0.04), v0 - 0.18 + k * 0.1)
      g.strokeStyle = `rgba(250, 252, 255, ${0.85 - k * 0.07})`
      g.lineWidth = 1.6 - k * 0.12
      g.beginPath()
      g.moveTo(x0, y0)
      g.quadraticCurveTo(cx, cy, x1, y1)
      g.stroke()
    }
  }

  // 6) la barbilla se funde con el fondo y una penumbra la separa de él
  g.globalCompositeOperation = 'destination-in'
  const fade = g.createLinearGradient(0, P(0, 0.6)[1], 0, P(0, 0.95)[1])
  fade.addColorStop(0, 'rgba(0, 0, 0, 1)')
  fade.addColorStop(1, 'rgba(0, 0, 0, 0)')
  g.fillStyle = fade
  g.fillRect(0, 0, S, S)
  g.globalCompositeOperation = 'destination-over'
  const aura = g.createRadialGradient(...P(0, -0.2), U * 0.4, ...P(0, -0.2), U * 1.5)
  aura.addColorStop(0, 'rgba(10, 6, 30, 0.55)')
  aura.addColorStop(1, 'rgba(10, 6, 30, 0)')
  g.fillStyle = aura
  g.fillRect(0, 0, S, S)
  g.globalCompositeOperation = 'source-over'
}

function paintEyes(g) {
  const r = rng(23)
  for (const side of [-1, 1]) {
    const [ex, ey] = P(side * EYE_U, EYE_V)
    const rx = U * 0.23
    const ry = U * 0.205
    // brillo verde alrededor
    const glow = g.createRadialGradient(ex, ey, rx * 0.6, ex, ey, rx * 1.9)
    glow.addColorStop(0, 'rgba(120, 255, 200, 0.22)')
    glow.addColorStop(1, 'rgba(120, 255, 200, 0)')
    g.fillStyle = glow
    g.fillRect(ex - rx * 2, ey - rx * 2, rx * 4, rx * 4)
    g.save()
    g.translate(ex, ey)
    g.rotate(side * -0.14) // el rabillo exterior sube, como en los gatos
    // aro negro
    g.fillStyle = '#0b0e10'
    g.beginPath()
    g.ellipse(0, 0, rx * 1.14, ry * 1.17, 0, 0, Math.PI * 2)
    g.fill()
    // el ojo: verde menta, más claro y amarillento junto a la pupila
    const eye = new Path2D()
    eye.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2)
    const ig = g.createRadialGradient(-rx * 0.08, -ry * 0.15, 2, 0, 0, rx)
    ig.addColorStop(0, '#f7ffb4')
    ig.addColorStop(0.28, '#c9f7a8')
    ig.addColorStop(0.64, '#4ed2ab')
    ig.addColorStop(1, '#0f675d')
    g.fillStyle = ig
    g.fill(eye)
    g.save()
    g.clip(eye)
    // fibras del iris
    for (let k = 0; k < 70; k++) {
      const a = r() * Math.PI * 2
      const r0 = rx * (0.18 + r() * 0.15)
      const r1 = rx * (0.6 + r() * 0.4)
      g.strokeStyle = r() < 0.5 ? 'rgba(10, 90, 80, 0.28)' : 'rgba(230, 255, 210, 0.22)'
      g.lineWidth = 1 + r()
      g.beginPath()
      g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0 * (ry / rx))
      g.lineTo(Math.cos(a) * r1, Math.sin(a) * r1 * (ry / rx))
      g.stroke()
    }
    // sombra del párpado de arriba
    const lid = g.createLinearGradient(0, -ry, 0, ry * 0.2)
    lid.addColorStop(0, 'rgba(0, 30, 26, 0.65)')
    lid.addColorStop(1, 'rgba(0, 30, 26, 0)')
    g.fillStyle = lid
    g.fillRect(-rx, -ry, rx * 2, ry * 1.3)
    // pupila rasgada
    g.fillStyle = 'rgba(0, 0, 0, 0.35)'
    g.beginPath()
    g.ellipse(0, ry * 0.04, rx * 0.22, ry * 0.92, 0, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#050607'
    g.beginPath()
    g.ellipse(0, ry * 0.04, rx * 0.11, ry * 0.86, 0, 0, Math.PI * 2)
    g.fill()
    // reflejo de abajo
    g.strokeStyle = 'rgba(200, 255, 230, 0.35)'
    g.lineWidth = 3
    g.beginPath()
    g.ellipse(0, 0, rx * 0.82, ry * 0.8, 0, Math.PI * 0.2, Math.PI * 0.8)
    g.stroke()
    g.restore()
    // brillos
    g.fillStyle = 'rgba(255, 255, 255, 0.92)'
    g.beginPath()
    g.ellipse(-rx * 0.34, -ry * 0.4, rx * 0.2, ry * 0.12, -0.5, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = 'rgba(255, 255, 255, 0.6)'
    g.beginPath()
    g.arc(rx * 0.28, ry * 0.3, rx * 0.06, 0, Math.PI * 2)
    g.fill()
    g.restore()
  }
}

function paintMouth(g) {
  const r = rng(37)
  const L = P(-0.96, -0.1)
  const R = P(0.96, -0.1)
  const C0 = P(0, 0.18)
  const C1 = P(0, 0.62)
  // puntos de cada labio (para colocar los dientes a lo largo)
  const quad = (a, c, b, t) => [
    (1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0],
    (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1],
  ]
  const cubic = (a, c1, c2, b, t) => {
    const s = 1 - t
    return [
      s * s * s * a[0] + 3 * s * s * t * c1[0] + 3 * s * t * t * c2[0] + t * t * t * b[0],
      s * s * s * a[1] + 3 * s * s * t * c1[1] + 3 * s * t * t * c2[1] + t * t * t * b[1],
    ]
  }
  const upper = []
  const lower = []
  for (let i = 0; i <= 60; i++) {
    const t = i / 60
    upper.push(quad(L, P(-0.55, 0.26), C0, t))
    lower.push(cubic(L, P(-0.78, 0.52), P(-0.3, 0.62), C1, t))
  }
  for (let i = 1; i <= 60; i++) {
    const t = i / 60
    upper.push(quad(C0, P(0.55, 0.26), R, t))
    lower.push(cubic(C1, P(0.3, 0.62), P(0.78, 0.52), R, t))
  }
  const yAt = (pts, x) => {
    let best = pts[0]
    for (const p of pts) if (Math.abs(p[0] - x) < Math.abs(best[0] - x)) best = p
    return best[1]
  }
  const mouth = new Path2D()
  mouth.moveTo(...L)
  for (const p of upper) mouth.lineTo(...p)
  for (let i = lower.length - 1; i >= 0; i--) mouth.lineTo(...lower[i])
  mouth.closePath()

  // el fondo de la boca: más rojizo en el centro, casi negro en las comisuras
  const deep = g.createRadialGradient(...P(0, 0.4), 4, ...P(0, 0.35), U * 0.9)
  deep.addColorStop(0, '#3a1118')
  deep.addColorStop(1, '#0b0507')
  g.fillStyle = deep
  g.fill(mouth)
  g.save()
  g.clip(mouth)
  // dientes: marfil, cada uno de su tono, algo torcidos y redondeados con
  // sombra a los lados; los de abajo, más en sombra
  const IVORY = ['#f3ead2', '#efe1bc', '#f8f1de', '#e8d8af', '#f1e6c6']
  const tooth = (x, y0, w, len, down) => {
    const y1 = y0 + (down ? len : -len)
    g.save()
    g.translate(x, y0)
    g.rotate((r() - 0.5) * 0.12)
    g.translate(-x, -y0)
    const p = new Path2D()
    p.moveTo(x - w / 2, y0)
    p.lineTo(x - w * 0.42, y0 + (y1 - y0) * 0.7)
    p.quadraticCurveTo(x, y1 + (down ? 2 : -2), x + w * 0.42, y0 + (y1 - y0) * 0.7)
    p.lineTo(x + w / 2, y0)
    p.closePath()
    const tg = g.createLinearGradient(0, y0, 0, y1)
    tg.addColorStop(0, down ? '#8f805f' : '#7d6d52')
    tg.addColorStop(0.3, IVORY[Math.floor(r() * IVORY.length)])
    tg.addColorStop(1, down ? '#e9dfc4' : '#fffaee')
    g.fillStyle = tg
    g.fill(p)
    const side = g.createLinearGradient(x - w / 2, 0, x + w / 2, 0)
    side.addColorStop(0, 'rgba(70, 45, 25, 0.38)')
    side.addColorStop(0.35, 'rgba(70, 45, 25, 0)')
    side.addColorStop(0.7, 'rgba(70, 45, 25, 0)')
    side.addColorStop(1, 'rgba(70, 45, 25, 0.45)')
    g.fillStyle = side
    g.fill(p)
    g.strokeStyle = 'rgba(30, 16, 14, 0.6)'
    g.lineWidth = 1.2
    g.stroke(p)
    g.restore()
  }
  // el largo de cada diente depende de lo abierta que esté la boca en ese
  // punto: arriba y abajo casi se tocan, como una sonrisa apretada
  const span = R[0] - L[0]
  const n = 16
  for (let i = 0; i < n; i++) {
    const s = (i + 0.5) / n
    const x = L[0] + span * s
    const h = yAt(lower, x) - yAt(upper, x)
    const canine = Math.abs(Math.abs(2 * s - 1) - 0.42) < 0.07
    tooth(x + (r() - 0.5) * 3, yAt(upper, x) - 3, (span / n) * (0.72 + r() * 0.24), h * (canine ? 0.66 : 0.44 + r() * 0.14) + 3, true)
  }
  for (let i = 0; i < n - 2; i++) {
    const s = (i + 1.5) / n
    const x = L[0] + span * s
    const h = yAt(lower, x) - yAt(upper, x)
    tooth(x + (r() - 0.5) * 3, yAt(lower, x) + 3, (span / n) * (0.7 + r() * 0.22), h * (0.32 + r() * 0.14) + 3, false)
  }
  // sombra bajo el labio de arriba
  g.strokeStyle = 'rgba(0, 0, 0, 0.4)'
  g.lineWidth = 12
  g.beginPath()
  g.moveTo(...L)
  for (const p of upper) g.lineTo(...p)
  g.stroke()
  g.restore()

  // labios negros y comisuras que suben hacia las mejillas
  g.strokeStyle = '#0a0708'
  g.lineJoin = 'round'
  g.lineCap = 'round'
  g.lineWidth = U * 0.032
  g.stroke(mouth)
  g.lineWidth = U * 0.026
  for (const side of [-1, 1]) {
    const [x0, y0] = P(side * 0.96, -0.1)
    const [cx, cy] = P(side * 1.06, -0.16)
    const [x1, y1] = P(side * 1.02, -0.3)
    g.beginPath()
    g.moveTo(x0, y0)
    g.quadraticCurveTo(cx, cy, x1, y1)
    g.stroke()
  }
}

// Pinta la cara, los ojos y la sonrisa en tres lienzos de 512 × 512.
export function paintCheshire(faceCanvas, eyesCanvas, mouthCanvas) {
  paintFace(faceCanvas.getContext('2d'))
  paintEyes(eyesCanvas.getContext('2d'))
  paintMouth(mouthCanvas.getContext('2d'))
}
