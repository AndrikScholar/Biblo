// La Mancha al atardecer: el ambiente de la ficha de Don Quijote. El sol se
// acaba de poner por detrás de la portada; en las lomas giran los molinos y
// el viento peina el trigo a rachas: olas de luz cruzan los campos y las
// espigas de delante se doblan a su paso. `gust(ms)` es la fuerza del viento
// (manchaWind.js), la misma que mueve las aspas, la paja y el sonido.
//
// Lo que no se mueve (cielo, lomas, campos) se pinta una vez por tamaño de
// ventana; en cada fotograma solo se dibujan las nubes, las aspas, la luz de
// las olas y las espigas.

const TAU = Math.PI * 2
const M = 28 // margen alrededor para el paralaje

function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const mix = (a, b, f) => a + (b - a) * f
const cl = (x) => Math.max(0, Math.min(1, x))
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
// mezcla de dos colores '#rrggbb' como 'rgba(...)'
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

// cultivos de los campos al atardecer: m es cuánto se ve la ola de viento
const CROPS = [
  { w: 46, base: '#8c6a36', hi: '#c89c58', lo: '#5c4224', m: 1, poppies: true }, // trigo
  { w: 14, base: '#9a7c48', hi: '#d3b47c', lo: '#6a5233', m: 0.85 }, // cebada
  { w: 11, base: '#6e5638', hi: '#937552', lo: '#4a3826', m: 0.25 }, // rastrojo
  { w: 11, base: '#5e3d2a', hi: '#80563a', lo: '#3a271b', m: 0, furrows: true }, // tierra arada
  { w: 10, base: '#4b4a2d', hi: '#6c6a40', lo: '#2c2c1b', m: 0.1, vines: true }, // viña
  { w: 8, base: '#596034', hi: '#7c7f4c', lo: '#363c22', m: 0.6 }, // cereal aún verde
]
const CROP_SUM = CROPS.reduce((a, c) => a + c.w, 0)
// cerca casi todo es mies (estamos en medio del trigo); el mosaico de
// cultivos se ve a lo lejos
function pickCrop(r, s) {
  if (s > 0.7 || (s > 0.45 && r() < 0.85)) return CROPS[r() < 0.8 ? 0 : 1]
  let x = r() * CROP_SUM
  for (const c of CROPS) if ((x -= c.w) < 0) return c
  return CROPS[0]
}

export function createMancha(gust) {
  const t0 = performance.now()
  let W = 0
  let H = 0
  let DPR = 1
  let U = 1 // unidad de tamaño: 1/1000 del lado útil
  let HZ = 0 // horizonte
  let E = 1 // suaviza la perspectiva junto al horizonte
  let VPX = 0 // punto de fuga
  let sunX = 0
  let portrait = false
  let sky = null
  let back = null
  let field = null
  let backTop = 0
  let lomas = []
  let clouds = []
  let mills = []
  let ears = []
  let stalks = []
  let bushes = []
  let earBack = null
  let earFront = null
  let poppySprite = null
  let mask = null // dónde hay mies (0..1), a baja resolución
  let maskW = 0
  let maskH = 0
  let wave = null
  let waveCtx = null
  let waveImg = null
  let last = null
  let pending = null
  let size = null // el tamaño nuevo, hasta que se repinta

  // perspectiva del llano: s = 1 abajo, casi 0 en el horizonte
  const scaleAt = (y) => Math.max(1e-3, (y - HZ + E) / (H - HZ + E))
  const yAt = (s) => HZ - E + s * (H - HZ + E)

  // la ola de viento sobre el campo en el punto (X, Z) del mundo: 0 calma,
  // 1 cresta. Avanza hacia la derecha, con frentes que se doblan.
  function swell(X, Z, ts) {
    const ph = X * 6.5 - ts * 1.7 + Math.sin(X * 1.9 + Z * 0.55 + ts * 0.35) * 1.1 + Z * 0.8
    const c = 0.5 + 0.5 * Math.sin(ph)
    return c * c * c * c * (0.725 + 0.275 * Math.sin(X * 1.1 - ts * 0.5 + Z * 0.3))
  }

  function maskAt(x, y) {
    if (!mask || y < HZ) return 0
    const i = Math.floor(((x + M) / (W + 2 * M)) * maskW)
    const j = Math.floor(((y - HZ) / (H - HZ)) * maskH)
    if (i < 0 || j < 0 || i >= maskW || j >= maskH) return 0
    return mask[j * maskW + i]
  }

  // ---------- disposición ----------
  function layout(r) {
    portrait = H > W * 1.1
    // en vertical la portada va arriba y el texto debajo: el horizonte sube y
    // los molinos flanquean la portada
    HZ = H * (portrait ? 0.44 : 0.63)
    U = (portrait ? Math.min(H * 0.6, W) : Math.min(H, W * 0.8)) / 1000
    E = 7 * U
    VPX = W * 0.5
    sunX = W * (portrait ? 0.32 : 0.2)
    lomas = portrait
      ? [
          { cx: W * 0.1, hw: W * 0.36, h: 46 * U },
          { cx: W * 0.92, hw: W * 0.3, h: 36 * U },
        ]
      : [
          { cx: W * 0.13, hw: W * 0.25, h: 64 * U },
          { cx: W * 0.88, hw: W * 0.2, h: 44 * U },
          { cx: W * 0.55, hw: W * 0.14, h: 14 * U },
        ]
    const spots = portrait
      ? [
          [0, -0.55, 1.15],
          [0, -0.12, 1],
          [0, 0.3, 0.86],
          [1, -0.4, 0.8],
          [1, 0.05, 0.72],
        ]
      : [
          [0, -0.5, 1.12],
          [0, -0.16, 1],
          [0, 0.2, 0.9],
          [0, 0.56, 0.8],
          [1, -0.42, 0.66],
          [1, 0.02, 0.6],
          [1, 0.42, 0.54],
          [2, -0.3, 0.3],
          [2, 0.25, 0.27],
        ]
    mills = spots.map(([li, f, s]) => {
      const l = lomas[li]
      const x = l.cx + f * l.hw
      return {
        x,
        y: lomaY(x) + 2 * U * s,
        th: 78 * U * s,
        s,
        lit: cl((x - sunX) / (W * 0.65)),
        side: r() < 0.5 ? -1 : 1, // hacia dónde cae el palo de gobierno
        fx: 0.8 + r() * 0.2, // las aspas, un poco de lado
        a: r() * TAU,
        k: 0.85 + r() * 0.3,
        // lona: tendida en dos aspas, recogida a medias en las cuatro, o sin lona
        cloth: [[1, 0, 1, 0], [0.55, 0.55, 0.55, 0.55], [0, 0, 0, 0]][Math.floor(r() * 2.6)],
      }
    })
    mills.sort((a, b) => a.s - b.s)
  }

  function lomaY(x) {
    let y = HZ + 4 * U
    for (const l of lomas) {
      const u = (x - l.cx) / l.hw
      if (Math.abs(u) >= 1) continue
      const bump = (0.5 + 0.5 * Math.cos(Math.PI * u)) ** 0.8
      y = Math.min(y, HZ + 4 * U - l.h * bump * (1 + 0.05 * Math.sin(x * 0.05 + l.cx)))
    }
    return y
  }

  // ---------- cielo ----------
  function paintSky(r) {
    const h = HZ + 30 * U
    const c = makeCanvas((W + 2 * M) * DPR, h * DPR)
    const g = c.getContext('2d')
    g.scale(DPR, DPR)
    g.translate(M, 0)
    const v = g.createLinearGradient(0, 0, 0, HZ)
    v.addColorStop(0, '#0f1730')
    v.addColorStop(0.36, '#1c2846')
    v.addColorStop(0.64, '#38425f')
    v.addColorStop(0.83, '#736a71')
    v.addColorStop(0.94, '#b48a69')
    v.addColorStop(1, '#d6a36d')
    g.fillStyle = v
    g.fillRect(-M, 0, W + 2 * M, h)

    // el resplandor del sol que se acaba de poner: ancho y bajo
    g.save()
    g.translate(sunX, HZ)
    g.scale(1, 0.4)
    const rr = W * 0.8
    const glow = g.createRadialGradient(0, 0, 0, 0, 0, rr)
    glow.addColorStop(0, 'rgba(255, 224, 160, 0.95)')
    glow.addColorStop(0.06, 'rgba(255, 196, 122, 0.72)')
    glow.addColorStop(0.2, 'rgba(236, 152, 96, 0.34)')
    glow.addColorStop(0.48, 'rgba(180, 120, 104, 0.12)')
    glow.addColorStop(1, 'rgba(180, 120, 104, 0)')
    g.fillStyle = glow
    g.fillRect(-rr, -rr, rr * 2, rr * 2)
    g.restore()

    // lejos del sol el cielo es más azul y oscuro
    const side = g.createLinearGradient(sunX, 0, W + M, 0)
    side.addColorStop(0, 'rgba(8, 12, 30, 0)')
    side.addColorStop(1, 'rgba(8, 12, 30, 0.3)')
    g.fillStyle = side
    g.fillRect(-M, 0, W + 2 * M, h)

    // las primeras estrellas, arriba y lejos del resplandor
    g.fillStyle = '#e9edff'
    for (let i = 0; i < 90; i++) {
      const x = -M + r() * (W + 2 * M)
      const y = r() * HZ * 0.55
      const fade = (1 - y / (HZ * 0.55)) * cl(Math.abs(x - sunX) / (W * 0.35))
      g.globalAlpha = fade * (0.25 + r() * 0.55)
      g.beginPath()
      g.arc(x, y, (0.4 + r() * 0.7) * Math.max(1, U * 1.2), 0, TAU)
      g.fill()
    }
    g.globalAlpha = 1

    // grano finísimo: un degradado tan oscuro y tan grande hace escalones
    const img = g.getImageData(0, 0, c.width, c.height)
    const d = img.data
    for (let i = 0; i < d.length; i += 4) {
      const n = (r() - 0.5) * 5
      d[i] += n
      d[i + 1] += n
      d[i + 2] += n
    }
    g.putImageData(img, 0, 0)
    return c
  }

  // nubes largas y deshilachadas: una mancha suave de muchas elipses, azul
  // oscuro arriba y encendida abajo por el sol ya puesto
  function paintCloud(r, len, thick, warm) {
    const pad = thick * 3
    const w = len + pad * 2
    const h = thick * 2 + pad * 2
    const c = makeCanvas(w * DPR, h * DPR)
    const g = c.getContext('2d')
    g.scale(DPR, DPR)
    g.filter = `blur(${thick * 0.45}px)`
    g.fillStyle = '#fff'
    const n = Math.round(len / (thick * 0.5))
    for (let i = 0; i < n; i++) {
      const f = r()
      const taper = Math.sin(Math.PI * f) ** 1.2
      g.globalAlpha = 0.25 + r() * 0.5
      g.beginPath()
      g.ellipse(
        pad + f * len,
        pad + thick + (r() - 0.5) * thick * 0.8 * taper,
        thick * (0.8 + r() * 1.8) * (0.4 + taper),
        thick * (0.2 + r() * 0.35) * (0.3 + taper),
        (r() - 0.5) * 0.08,
        0,
        TAU
      )
      g.fill()
    }
    g.filter = 'none'
    g.globalAlpha = 1
    g.globalCompositeOperation = 'source-in'
    const col = g.createLinearGradient(0, pad, 0, pad + thick * 2)
    col.addColorStop(0, tone('#28304a', '#5d5463', warm * 0.7))
    col.addColorStop(0.55, tone('#574958', '#c98a72', warm))
    col.addColorStop(1, tone('#9a6e6a', '#ffcf96', warm))
    g.fillStyle = col
    g.fillRect(0, 0, w, h)
    return c
  }

  function makeClouds(r) {
    clouds = []
    const n = portrait ? 3 : 5
    for (let i = 0; i < n; i++) {
      const y = HZ * (0.42 + 0.46 * (i / (n - 1)) + (r() - 0.5) * 0.06)
      const x = -M + r() * (W + 2 * M)
      const low = cl((y / HZ - 0.3) / 0.55)
      const len = W * (0.12 + r() * 0.22) * (portrait ? 1.4 : 1)
      const thick = (5 + r() * 9) * U * (0.6 + low * 0.6)
      const warm = cl(low * (1 - Math.abs(x - sunX) / (W * 0.9)))
      const sprite = paintCloud(r, len, thick, warm)
      clouds.push({ x, y, sprite, w: sprite.width / DPR, h: sprite.height / DPR, v: (2 + r() * 4) * (0.5 + low), alpha: 0.55 + low * 0.35 })
    }
  }

  // ---------- lomas y molinos ----------
  function paintBack(r) {
    backTop = HZ - 120 * U
    const h = HZ + 12 * U - backTop
    const c = makeCanvas((W + 2 * M) * DPR, h * DPR)
    const g = c.getContext('2d')
    g.scale(DPR, DPR)
    g.translate(M, -backTop)

    // sierras lejanas, muy bajas y perdidas en la bruma
    g.beginPath()
    g.moveTo(-M, HZ + 6 * U)
    for (let x = -M; x <= W + M; x += 4) {
      const hh = (5 + 6 * (0.5 + 0.5 * Math.sin(x * 0.0037 + 1.2)) + 3 * Math.sin(x * 0.011 + 0.5)) * U
      g.lineTo(x, HZ - hh)
    }
    g.lineTo(W + M, HZ + 6 * U)
    g.closePath()
    const far = g.createLinearGradient(sunX, 0, W, 0)
    far.addColorStop(0, '#8a6f6c')
    far.addColorStop(1, '#3f4258')
    g.fillStyle = far
    g.fill()

    // las lomas: oscuras contra el resplandor, con el filo encendido
    for (const l of lomas) {
      const p = new Path2D()
      const x0 = l.cx - l.hw
      const x1 = l.cx + l.hw
      p.moveTo(x0, HZ + 10 * U)
      for (let x = x0; x <= x1; x += 2) p.lineTo(x, lomaY(x))
      p.lineTo(x1, HZ + 10 * U)
      p.closePath()
      const near = cl(1 - Math.abs(l.cx - sunX) / (W * 0.8))
      const lg = g.createLinearGradient(0, HZ - l.h, 0, HZ + 8 * U)
      lg.addColorStop(0, tone('#2e2a35', '#3d2f30', near))
      lg.addColorStop(1, tone('#3f3640', '#5a4236', near))
      g.fillStyle = lg
      g.fill(p)
      // matas sueltas en la ladera
      g.save()
      g.clip(p)
      g.fillStyle = 'rgba(20, 16, 22, 0.45)'
      for (let i = 0; i < l.hw * 0.25; i++) {
        const x = x0 + r() * (x1 - x0)
        const y = lomaY(x) + r() * (HZ - lomaY(x) + 8 * U)
        g.beginPath()
        g.ellipse(x, y, (1 + r() * 2.2) * U * 1.4, (0.7 + r()) * U * 1.2, 0, 0, TAU)
        g.fill()
      }
      g.restore()
      // filo de luz del lado del sol
      const rim = g.createLinearGradient(x0, 0, x1, 0)
      const a = (x) => 0.75 * cl(1 - Math.abs(x - sunX) / (W * 0.55))
      rim.addColorStop(0, `rgba(255, 196, 128, ${a(x0)})`)
      rim.addColorStop(1, `rgba(255, 196, 128, ${a(x1)})`)
      g.strokeStyle = rim
      g.lineWidth = Math.max(1, 1.3 * U)
      g.beginPath()
      g.moveTo(x0 + l.hw * 0.08, lomaY(x0 + l.hw * 0.08))
      for (let x = x0 + l.hw * 0.08; x <= x1 - l.hw * 0.08; x += 2) g.lineTo(x, lomaY(x))
      g.stroke()
    }
    return c
  }

  // la torre encalada, el chapitel oscuro y el palo de gobierno, una vez por
  // molino; las aspas se dibujan aparte porque giran
  function paintMill(m) {
    const th = m.th
    const tb = th * 0.6
    const tt = th * 0.5
    const ch = th * 0.42
    const w = th * 1.8
    const h = th * 1.75
    const ax = w / 2
    const ay = th * 1.55
    const c = makeCanvas(w * DPR, h * DPR)
    const g = c.getContext('2d')
    g.scale(DPR, DPR)
    g.translate(ax, ay)
    const lit = m.lit
    const lw = Math.max(0.8, th * 0.03)

    // palo de gobierno, por detrás de la torre
    g.strokeStyle = '#1e1a22'
    g.lineWidth = lw * 1.3
    g.beginPath()
    g.moveTo(m.side * tt * 0.25, -th - ch * 0.15)
    g.lineTo(m.side * tb * 1.15, -th * 0.03)
    g.stroke()

    // torre: un cilindro que se estrecha; luz rasante desde la izquierda
    const body = new Path2D()
    body.moveTo(-tb / 2, 0)
    body.lineTo(-tt / 2, -th)
    body.lineTo(tt / 2, -th)
    body.lineTo(tb / 2, 0)
    body.quadraticCurveTo(0, th * 0.06, -tb / 2, 0)
    const shade = g.createLinearGradient(-tb / 2, 0, tb / 2, 0)
    shade.addColorStop(0, '#ffd9a8')
    shade.addColorStop(0.05, tone('#636a82', '#e6b98e', lit))
    shade.addColorStop(0.16 + 0.24 * lit, tone('#565d76', '#d7aa86', lit))
    shade.addColorStop(0.6, tone('#4c5269', '#5d5f74', lit))
    shade.addColorStop(1, '#363b50')
    g.fillStyle = shade
    g.fill(body)
    // zócalo de piedra
    g.save()
    g.clip(body)
    g.fillStyle = 'rgba(30, 26, 32, 0.4)'
    g.fillRect(-tb, -th * 0.07, tb * 2, th)
    // puerta y ventanucos
    g.fillStyle = '#1c1922'
    const dw = tb * 0.2
    g.beginPath()
    g.moveTo(-tb * 0.12, 0)
    g.lineTo(-tb * 0.12, -th * 0.2)
    g.arc(-tb * 0.12 + dw / 2, -th * 0.2, dw / 2, Math.PI, 0)
    g.lineTo(-tb * 0.12 + dw, 0)
    g.fill()
    g.fillRect(tt * 0.08, -th * 0.62, tt * 0.12, th * 0.09)
    g.fillRect(-tt * 0.26, -th * 0.84, tt * 0.1, th * 0.07)
    g.restore()
    // cornisa
    g.fillStyle = tone('#3b3f52', '#8d7466', lit * 0.6)
    g.fillRect(-tt * 0.56, -th - th * 0.03, tt * 1.12, th * 0.05)

    // chapitel: un cono oscuro con el filo encendido
    const cap = new Path2D()
    cap.moveTo(-tt * 0.6, -th)
    cap.quadraticCurveTo(-tt * 0.48, -th - ch * 0.8, tt * 0.04, -th - ch)
    cap.quadraticCurveTo(tt * 0.5, -th - ch * 0.78, tt * 0.6, -th)
    cap.closePath()
    const cs = g.createLinearGradient(-tt * 0.6, 0, tt * 0.6, 0)
    cs.addColorStop(0, tone('#5a4642', '#b07a5c', lit))
    cs.addColorStop(0.3, '#2e2a33')
    cs.addColorStop(1, '#1d1a21')
    g.fillStyle = cs
    g.fill(cap)

    m.sprite = c
    m.w = w
    m.h = h
    m.ax = ax
    m.ay = ay
    m.hub = -th - ch * 0.38
    m.R = th * 1.06
    m.lw = lw
  }

  // aspas: cuatro bastidores de listones; algunas con la lona tendida
  function drawSails(ctx, m, hx, hy) {
    const R = m.R
    const fx = m.fx
    const frame = new Path2D()
    const spar = new Path2D()
    const cloth = new Path2D()
    for (let k = 0; k < 4; k++) {
      const a = m.a + (k * TAU) / 4
      const ca = Math.cos(a)
      const sa = Math.sin(a)
      const px = (u, v) => hx + (u * ca - v * sa) * R * fx
      const py = (u, v) => hy + (u * sa + v * ca) * R
      spar.moveTo(px(-0.06, 0), py(-0.06, 0))
      spar.lineTo(px(1, 0), py(1, 0))
      const u0 = 0.2
      const wv = 0.19
      for (const v of [wv * 0.5, wv]) {
        frame.moveTo(px(u0, v), py(u0, v))
        frame.lineTo(px(1, v), py(1, v))
      }
      for (let i = 0; i <= 7; i++) {
        const u = u0 + ((1 - u0) * i) / 7
        frame.moveTo(px(u, 0), py(u, 0))
        frame.lineTo(px(u, wv), py(u, wv))
      }
      const lona = m.cloth[k]
      if (lona) {
        const u1 = u0 + 0.03 + (0.93 - u0) * lona
        cloth.moveTo(px(u0 + 0.03, 0.01), py(u0 + 0.03, 0.01))
        cloth.lineTo(px(u1, 0.01), py(u1, 0.01))
        cloth.lineTo(px(u1, wv * 0.97), py(u1, wv * 0.97))
        cloth.lineTo(px(u0 + 0.03, wv * 0.97), py(u0 + 0.03, wv * 0.97))
        cloth.closePath()
      }
    }
    ctx.fillStyle = tone('#a29690', '#f0dcc0', m.lit * 0.7 + 0.15, 0.7)
    ctx.fill(cloth)
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#231e26'
    ctx.lineWidth = m.lw * 0.5
    ctx.stroke(frame)
    ctx.lineWidth = m.lw * 1.5
    ctx.stroke(spar)
    ctx.fillStyle = '#17141b'
    ctx.beginPath()
    ctx.arc(hx, hy, m.lw * 2, 0, TAU)
    ctx.fill()
  }

  // ---------- campos ----------
  function paintField(r) {
    const top = HZ - 2
    const h = H + M - top
    const c = makeCanvas((W + 2 * M) * DPR, h * DPR)
    const g = c.getContext('2d')
    g.scale(DPR, DPR)
    g.translate(M, -top)
    // la máscara de la mies, a baja resolución: dónde se ve la ola de viento
    maskW = Math.ceil((W + 2 * M) / 8)
    maskH = Math.ceil((H - HZ) / 6)
    const mk = makeCanvas(maskW, maskH)
    const mg = mk.getContext('2d')
    mg.scale(maskW / (W + 2 * M), maskH / (H - HZ))
    mg.translate(M, -HZ)

    const base = g.createLinearGradient(0, HZ, 0, H)
    base.addColorStop(0, '#9a7444')
    base.addColorStop(0.2, '#6f5232')
    base.addColorStop(0.6, '#45321f')
    base.addColorStop(1, '#22180f')
    g.fillStyle = base
    g.fillRect(-M, top, W + 2 * M, h)

    // parcelas en hileras que encogen hacia el horizonte; sus lindes van al
    // punto de fuga
    const sMin = scaleAt(HZ + 0.5)
    let sBot = scaleAt(H + M)
    while (sBot > sMin) {
      const sTop = Math.max(sMin, sBot * (0.72 + r() * 0.1))
      const yTop = yAt(sTop)
      const yBot = yAt(sBot)
      const sMid = (sTop + sBot) / 2
      const xEdge = (x, s) => VPX + ((x - VPX) / sMid) * s
      // arriba la hilera es más estrecha: se cubre lo que haga falta allí
      const reach = sMid / sTop
      let x = VPX - (VPX + M) * reach - r() * W * 0.2 * sMid
      while (x < VPX + (W + M - VPX) * reach) {
        const wpx = W * (0.14 + r() * 0.32) * Math.max(0.35, sMid ** 0.5)
        const crop = pickCrop(r, sMid)
        const xa = x
        const xb = x + wpx
        const quad = new Path2D()
        quad.moveTo(xEdge(xa, sTop), yTop)
        quad.lineTo(xEdge(xb, sTop), yTop)
        quad.lineTo(xEdge(xb, sBot), yBot)
        quad.lineTo(xEdge(xa, sBot), yBot)
        quad.closePath()
        paintParcel(g, r, quad, crop, xa, xb, sTop, sBot, xEdge)
        const mv = Math.round(crop.m * 255)
        mg.fillStyle = `rgb(${mv}, ${mv}, ${mv})`
        mg.fill(quad)
        x = xb
      }
      sBot = sTop
    }

    paintRoad(g, mg)

    // la bruma del horizonte funde los campos con las sierras
    const haze = g.createLinearGradient(0, HZ - 2, 0, HZ + 26 * U)
    haze.addColorStop(0, 'rgba(206, 156, 116, 0.75)')
    haze.addColorStop(1, 'rgba(206, 156, 116, 0)')
    g.fillStyle = haze
    g.fillRect(-M, HZ - 2, W + 2 * M, 28 * U + 2)
    // el cielo encendido se refleja en la mies del lado del sol
    g.save()
    g.translate(sunX, HZ)
    g.scale(1, 0.3)
    const sheen = g.createRadialGradient(0, 0, 0, 0, 0, W * 0.7)
    sheen.addColorStop(0, 'rgba(255, 190, 116, 0.42)')
    sheen.addColorStop(1, 'rgba(255, 190, 116, 0)')
    g.fillStyle = sheen
    g.fillRect(-W, -W, W * 2, W * 2)
    g.restore()
    // y lo de delante, y lo que queda lejos del sol, ya está en penumbra
    const dusk = g.createLinearGradient(0, HZ + (H - HZ) * 0.12, 0, H)
    dusk.addColorStop(0, 'rgba(14, 10, 8, 0)')
    dusk.addColorStop(1, 'rgba(14, 10, 8, 0.6)')
    g.fillStyle = dusk
    g.fillRect(-M, HZ, W + 2 * M, h)
    const away = g.createLinearGradient(sunX, 0, W + M, 0)
    away.addColorStop(0, 'rgba(12, 10, 16, 0)')
    away.addColorStop(1, 'rgba(12, 10, 16, 0.3)')
    g.fillStyle = away
    g.fillRect(-M, HZ, W + 2 * M, h)

    const md = mg.getImageData(0, 0, maskW, maskH).data
    mask = new Float32Array(maskW * maskH)
    for (let i = 0; i < mask.length; i++) mask[i] = md[i * 4] / 255
    return c
  }

  function paintParcel(g, r, quad, crop, xa, xb, sTop, sBot, xEdge) {
    const yTop = yAt(sTop)
    const yBot = yAt(sBot)
    const sMid = (sTop + sBot) / 2
    // lo lejano se aclara y se calienta con la bruma
    const haze = (1 - sMid) ** 3 * 0.55
    const col = (hex) => tone(hex, '#b58f6a', haze)
    g.fillStyle = col(crop.base)
    g.fill(quad)
    g.save()
    g.clip(quad)
    const span = Math.abs(xEdge(xb, sBot) - xEdge(xa, sBot)) + 4
    const rows = yBot - yTop
    if (crop.furrows || crop.vines) {
      // surcos o hileras de cepas que se van al punto de fuga
      const step = (crop.vines ? 0.016 : 0.009) * Math.max(0.25, sMid)
      g.strokeStyle = col(crop.lo)
      g.fillStyle = col(crop.lo)
      g.lineWidth = Math.max(0.5, 1.4 * sBot * U * 1.3)
      for (let X = xa; X < xb; X += W * step) {
        if (crop.vines) {
          for (let s = sBot; s > sTop; s *= 0.93) {
            const y = yAt(s)
            g.beginPath()
            g.arc(xEdge(X, s), y, Math.max(0.4, 2.6 * s * U), 0, TAU)
            g.fill()
          }
        } else {
          g.globalAlpha = 0.55
          g.beginPath()
          g.moveTo(xEdge(X, sTop), yTop)
          g.lineTo(xEdge(X, sBot), yBot)
          g.stroke()
          g.globalAlpha = 1
        }
      }
    }
    // pinceladas cortas y tumbadas: la textura de la mies
    if (sBot > 0.05) {
      const n = Math.min(1200, (span * rows) / (10 + 60 * sMid * sMid))
      const shades = [crop.hi, crop.base, crop.lo]
      for (let i = 0; i < n; i++) {
        const y = yTop + r() * rows
        const s = scaleAt(y)
        const x = xEdge(mix(xa, xb, r()), s)
        const len = (3 + 9 * s) * U * (0.6 + r() * 0.8) * 1.4
        g.strokeStyle = col(shades[Math.floor(r() * 3)])
        g.globalAlpha = 0.35 + r() * 0.4
        g.lineWidth = Math.max(0.5, (0.6 + 2.2 * s) * U * 1.2)
        g.beginPath()
        g.moveTo(x - len / 2, y + (r() - 0.5) * len * 0.12)
        g.lineTo(x + len / 2, y + (r() - 0.5) * len * 0.12)
        g.stroke()
      }
      g.globalAlpha = 1
      // amapolas sueltas entre el trigo: toques de rojo apagado
      if (crop.poppies && sMid > 0.22) {
        g.fillStyle = col('#9a2a26')
        for (let i = 0; i < n * 0.05; i++) {
          const y = yTop + r() * rows
          const s = scaleAt(y)
          g.globalAlpha = 0.55 + r() * 0.4
          g.beginPath()
          g.ellipse(xEdge(mix(xa, xb, r()), s), y, (0.8 + 2.2 * s) * U, (0.6 + 1.5 * s) * U, 0, 0, TAU)
          g.fill()
        }
        g.globalAlpha = 1
      }
    }
    g.restore()
    // linde: una raya fina más oscura
    g.strokeStyle = col(crop.lo)
    g.globalAlpha = 0.5
    g.lineWidth = Math.max(0.5, sBot * 2 * U)
    g.beginPath()
    g.moveTo(xEdge(xa, sTop), yTop)
    g.lineTo(xEdge(xa, sBot), yBot)
    g.stroke()
    g.globalAlpha = 1
  }

  // el camino de tierra que sale de debajo de la portada hacia los molinos
  function paintRoad(g, mg) {
    const x0 = W * (portrait ? 0.62 : 0.34)
    const x1 = portrait ? lomas[0].cx + lomas[0].hw * 0.1 : lomas[0].cx + lomas[0].hw * 0.25
    const w0 = W * (portrait ? 0.16 : 0.085)
    const left = []
    const right = []
    for (let y = H + M; y >= HZ + 1; y -= 3) {
      const s = scaleAt(y)
      const f = 1 - (y - HZ) / (H - HZ)
      const xc = mix(x0, x1, f ** 0.6) + Math.sin(f * 5.2) * W * 0.03 * (1 - f)
      const hw = (w0 / 2) * s
      left.push([xc - hw, y])
      right.push([xc + hw, y])
    }
    const road = new Path2D()
    left.forEach(([x, y], i) => (i ? road.lineTo(x, y) : road.moveTo(x, y)))
    for (let i = right.length - 1; i >= 0; i--) road.lineTo(right[i][0], right[i][1])
    road.closePath()
    const rg = g.createLinearGradient(0, HZ, 0, H)
    rg.addColorStop(0, '#c49a6c')
    rg.addColorStop(0.35, '#8f7050')
    rg.addColorStop(1, '#4a3826')
    g.fillStyle = rg
    g.fill(road)
    // rodadas y la franja de hierba del centro
    g.strokeStyle = 'rgba(40, 28, 18, 0.45)'
    for (const f of [0.28, 0.72]) {
      g.beginPath()
      left.forEach(([x, y], i) => {
        const xx = mix(x, right[i][0], f)
        if (i) g.lineTo(xx, y)
        else g.moveTo(xx, y)
      })
      g.lineWidth = Math.max(0.5, 2 * U)
      g.stroke()
    }
    mg.fillStyle = '#000'
    mg.fill(road)
  }

  // ---------- espigas ----------
  function placeEars(r) {
    ears = []
    for (let y = HZ + (H - HZ) * 0.34; y < H + 6; ) {
      const s = scaleAt(y)
      const dy = Math.max(4, (3.5 + 9 * s) * U * 1.15)
      const dx = Math.max(5, (5 + 11 * s) * U * 1.15)
      for (let x = -M + r() * dx; x < W + M; x += dx * (0.7 + r() * 0.6)) {
        const yy = y + (r() - 0.5) * dy
        if (maskAt(x, yy) < 0.6) continue
        const ss = scaleAt(yy)
        ears.push({ x, y: yy, X: (x - VPX) / (ss * W), Z: 1 / ss, len: (3 + 13 * ss) * U * (0.8 + r() * 0.5), c: r() })
      }
      y += dy
    }
  }

  // la espiga se pinta una vez por fila (grano, barbas y el filo de luz del
  // atardecer); en cada fotograma solo se coloca girada en la punta del tallo
  const EAR = 44 // largo de referencia de la espiga pintada, en px
  function paintEar(ink, rim) {
    const w = EAR * 0.8
    const h = EAR * 1.75
    const c = makeCanvas(w * DPR, h * DPR)
    const g = c.getContext('2d')
    g.scale(DPR, DPR)
    g.translate(w / 2, h - 2)
    const n = 8
    const gl = EAR / n
    const grains = new Path2D()
    const awns = new Path2D()
    for (let i = 0; i < n; i++) {
      const side = i % 2 ? 1 : -1
      const f = 1 - (i / n) * 0.45
      const gx = side * gl * 0.3 * f
      const gy = -gl * (i + 0.5) * 0.95
      grains.moveTo(gx + gl * 0.36 * f, gy)
      grains.ellipse(gx, gy, gl * 0.36 * f, gl * 0.66 * f, side * 0.35, 0, TAU)
      const aa = -Math.PI / 2 + side * 0.2
      awns.moveTo(gx, gy - gl * 0.4)
      awns.lineTo(gx + Math.cos(aa) * EAR * 0.75, gy + Math.sin(aa) * EAR * 0.75)
    }
    g.lineCap = 'round'
    g.strokeStyle = ink
    g.globalAlpha = 0.8
    g.lineWidth = 0.8
    g.stroke(awns)
    g.globalAlpha = 1
    g.save()
    g.translate(-1.3, -0.7)
    g.fillStyle = rim
    g.fill(grains)
    g.restore()
    g.fillStyle = ink
    g.fill(grains)
    return c
  }

  // amapola vista de lado: una copa de cuatro pétalos, roja apagada
  function paintPoppy() {
    const s = 16
    const c = makeCanvas(s * 2 * DPR, s * 2 * DPR)
    const g = c.getContext('2d')
    g.scale(DPR, DPR)
    g.translate(s, s * 1.2)
    const petal = (x, y, rx, ry, a, col) => {
      g.fillStyle = col
      g.beginPath()
      g.ellipse(x, y, rx, ry, a, 0, TAU)
      g.fill()
    }
    petal(s * 0.32, -s * 0.38, s * 0.42, s * 0.34, 0.5, '#6e1519')
    petal(-s * 0.32, -s * 0.38, s * 0.42, s * 0.34, -0.5, '#7e181c')
    petal(0, -s * 0.28, s * 0.5, s * 0.36, 0, '#9e2526')
    petal(-s * 0.18, -s * 0.46, s * 0.26, s * 0.16, -0.4, 'rgba(232, 110, 76, 0.75)')
    g.fillStyle = '#160b0c'
    g.beginPath()
    g.ellipse(0, -s * 0.62, s * 0.18, s * 0.08, 0, 0, TAU)
    g.fill()
    return c
  }

  // mata de espliego como las de la portada: tallos finos gris azulado que
  // se abren desde el suelo, con las puntas más claras
  function paintBush(r, size) {
    const w = size * 2.2
    const h = size * 1.3
    const c = makeCanvas(w * DPR, h * DPR)
    const g = c.getContext('2d')
    g.scale(DPR, DPR)
    g.translate(w / 2, h - 1)
    g.lineCap = 'round'
    for (let i = 0; i < 70; i++) {
      const a = (r() - 0.5) * 2.1
      const len = size * (0.45 + r() * 0.6) * Math.cos(a * 0.45)
      const x0 = (r() - 0.5) * size * 0.3
      const tx = x0 + Math.sin(a) * len
      const ty = -Math.cos(a) * len
      g.strokeStyle = r() < 0.5 ? '#3a4651' : '#4c5b66'
      g.lineWidth = 0.6 + r() * 1.1
      g.beginPath()
      g.moveTo(x0, 0)
      g.quadraticCurveTo(x0 + Math.sin(a) * len * 0.3, -len * 0.55, tx, ty)
      g.stroke()
      // la punta, con florecillas azuladas y luz de poniente por la izquierda
      g.fillStyle = r() < 0.3 ? '#8a95c4' : '#7d929b'
      g.beginPath()
      g.ellipse(tx, ty, 1 + r() * 1.2, 2.2 + r() * 2.5, a, 0, TAU)
      g.fill()
      if (a < 0) {
        g.fillStyle = 'rgba(236, 176, 120, 0.55)'
        g.beginPath()
        g.ellipse(tx - 0.8, ty - 0.6, 0.8, 1.8, a, 0, TAU)
        g.fill()
      }
    }
    return c
  }

  // trigo alto en primer plano, en dos filas, con alguna amapola
  function placeStalks(r) {
    stalks = []
    earBack = paintEar('#3a2a1c', 'rgba(222, 160, 96, 0.6)')
    earFront = paintEar('#1b130d', 'rgba(246, 180, 106, 0.85)')
    poppySprite = paintPoppy()
    const rows = [
      { base: H - H * 0.02, hMin: 0.06, hMax: 0.11, gap: 8.5, front: false },
      { base: H + 6 * U, hMin: 0.09, hMax: 0.19, gap: 12, front: true },
    ]
    const hh = portrait ? Math.min(H, W * 1.5) : H
    for (const row of rows) {
      for (let x = -M + r() * row.gap; x < W + M; x += row.gap * U * 1.2 * (0.6 + r() * 0.8)) {
        const h = hh * mix(row.hMin, row.hMax, r() ** 1.4)
        stalks.push({
          x,
          base: row.base + r() * 6 * U,
          h,
          X: (x - VPX) / W,
          ear: Math.min(30 * U * 1.3, h * 0.24) * (0.8 + r() * 0.4),
          ph: r() * TAU,
          lean: (r() - 0.35) * 0.18,
          front: row.front,
          poppy: row.front && r() < 0.035,
        })
      }
    }
    bushes = []
    const nb = portrait ? 3 : 5
    for (let i = 0; i < nb; i++) {
      const right = i % 2 === 1
      const size = (34 + r() * 30) * U * 1.3
      const sprite = paintBush(r, size)
      bushes.push({
        x: right ? W * (0.84 + r() * 0.18) : W * (r() * 0.2),
        y: H + 2 * U - r() * 8 * U,
        sprite,
        w: sprite.width / DPR,
        h: sprite.height / DPR,
        ph: r() * TAU,
      })
    }
  }

  // las espigas del campo medio: al pasar la ola se doblan y se encienden
  const EAR_INKS = ['#4a3520', '#755632', '#977242', '#c09558']
  function drawEars(ctx, ts, g, ox, oy) {
    const paths = EAR_INKS.map(() => new Path2D())
    const bend = 0.15 + 0.4 * g
    for (const e of ears) {
      const sw = swell(e.X, e.Z, ts)
      const lean = 0.12 + bend * sw
      const x = e.x + ox
      const y = e.y + oy
      const p = paths[sw > 0.42 ? 3 : sw > 0.16 ? 2 : e.c < 0.5 ? 0 : 1]
      p.moveTo(x, y)
      p.lineTo(x + Math.sin(lean) * e.len, y - Math.cos(lean) * e.len)
    }
    ctx.lineCap = 'butt'
    ctx.lineWidth = Math.max(0.8, 1.6 * U)
    paths.forEach((p, i) => {
      ctx.strokeStyle = EAR_INKS[i]
      ctx.stroke(p)
    })
  }

  function drawStalks(ctx, ts, g, ox, oy) {
    const bend = 0.12 + 0.4 * g
    for (const front of [false, true]) {
      const stems = new Path2D()
      const tips = []
      for (const st of stalks) {
        if (st.front !== front) continue
        const sw = swell(st.X, 1, ts)
        const lean = st.lean + bend * sw + Math.sin(ts * 2.1 + st.ph) * 0.025 * (0.6 + g)
        const bx = st.x + ox
        const by = st.base + oy
        const tx = bx + Math.sin(lean) * st.h
        const ty = by - Math.cos(lean) * st.h
        const cx = bx + Math.sin(lean * 0.35) * st.h * 0.5
        const cy = by - st.h * 0.55
        stems.moveTo(bx, by)
        stems.quadraticCurveTo(cx, cy, tx, ty)
        // la espiga sigue la dirección del tallo en la punta
        tips.push(tx, ty, Math.atan2(ty - cy, tx - cx) + Math.PI / 2, st)
      }
      ctx.lineCap = 'round'
      ctx.strokeStyle = front ? '#1b130d' : '#33251a'
      ctx.lineWidth = Math.max(0.8, (front ? 1.9 : 1.3) * U)
      ctx.stroke(stems)
      const ear = front ? earFront : earBack
      for (let i = 0; i < tips.length; i += 4) {
        const st = tips[i + 3]
        const sprite = st.poppy ? poppySprite : ear
        const k = st.poppy ? (st.ear * 0.6) / 16 : st.ear / EAR
        const cos = Math.cos(tips[i + 2]) * k * DPR
        const sin = Math.sin(tips[i + 2]) * k * DPR
        ctx.setTransform(cos, sin, -sin, cos, tips[i] * DPR, tips[i + 1] * DPR)
        const w = sprite.width / DPR
        const h = sprite.height / DPR
        ctx.drawImage(sprite, -w / 2, st.poppy ? -h * 0.6 : 2 - h, w, h)
      }
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0)
      // las matas azuladas de la portada, entre las dos filas
      if (!front) drawBushes(ctx, ts, g, ox, oy)
    }
  }

  // las matas se mecen inclinándose desde el suelo
  function drawBushes(ctx, ts, g, ox, oy) {
    for (const b of bushes) {
      const shear = Math.sin(ts * 1.3 + b.ph) * 0.04 * (0.5 + g) + swell(b.x / W - 0.5, 1, ts) * 0.1 * g
      const x = b.x + ox
      const y = b.y + oy
      ctx.setTransform(DPR, 0, -shear * DPR, DPR, x * DPR, y * DPR)
      ctx.drawImage(b.sprite, -b.w / 2, 1 - b.h, b.w, b.h)
    }
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0)
  }

  // ---------- luz de las olas ----------
  function drawWaves(ctx, ts, g, ox, oy) {
    const d = waveImg.data
    const amp = (0.2 + 0.8 * g) * 170
    const cell = (W + 2 * M) / maskW
    for (let j = 0; j < maskH; j++) {
      const y = HZ + ((j + 0.5) * (H - HZ)) / maskH
      const s = scaleAt(y)
      const Z = 1 / s
      const inv = 1 / (s * W)
      // junto al horizonte las olas se confunden: ahí se apagan
      const a = cl((y - HZ) / (5 * U + 1)) * amp
      for (let i = 0, row = j * maskW; i < maskW; i++) {
        const m = mask[row + i]
        d[(row + i) * 4 + 3] = m && swell((-M + (i + 0.5) * cell - VPX) * inv, Z, ts) * a * m
      }
    }
    waveCtx.putImageData(waveImg, 0, 0)
    ctx.globalCompositeOperation = 'screen'
    ctx.drawImage(wave, -M + ox, HZ + oy, W + 2 * M, H - HZ)
    ctx.globalCompositeOperation = 'source-over'
  }

  function build() {
    ;[W, H, DPR] = size
    const r = rng(1605)
    layout(r)
    sky = paintSky(r)
    makeClouds(r)
    back = paintBack(r)
    for (const m of mills) paintMill(m)
    field = paintField(r)
    placeEars(r)
    placeStalks(r)
    wave = makeCanvas(maskW, maskH)
    waveCtx = wave.getContext('2d')
    waveImg = waveCtx.createImageData(maskW, maskH)
    for (let i = 0; i < waveImg.data.length; i += 4) {
      waveImg.data[i] = 255
      waveImg.data[i + 1] = 214
      waveImg.data[i + 2] = 150
    }
  }

  return {
    // mientras se redimensiona la ventana se sigue dibujando lo de antes, y
    // se repinta cuando se deja de redimensionar
    resize(w, h, dpr) {
      size = [w, h, dpr]
      clearTimeout(pending)
      if (!sky) build()
      else pending = setTimeout(build, 160)
    },

    // px, py: el cursor (-1..1) para el paralaje; intro: 0..1 al abrirse
    draw(ctx, now, px, py, intro) {
      if (!sky) return
      const ts = (now - t0) / 1000
      const dt = last === null ? 0 : Math.max(0, Math.min(now - last, 50)) / 1000
      last = now
      const g = gust ? gust(now) : 0.3
      const alpha = ctx.globalAlpha
      // cada capa se mueve con el cursor según su distancia, y al abrirse
      // la ficha lo cercano sube un poco hasta su sitio
      const off = (depth) => [-px * depth, -py * depth * 0.35 + (1 - intro) * depth * 2.2]

      let [ox, oy] = off(2)
      ctx.drawImage(sky, -M + ox, oy, sky.width / DPR, sky.height / DPR)
      ;[ox, oy] = off(4)
      for (const c of clouds) {
        c.x += c.v * (0.5 + g) * dt
        if (c.x > W + M) c.x = -M - c.w
        ctx.globalAlpha = alpha * c.alpha
        ctx.drawImage(c.sprite, c.x + ox, c.y - c.h / 2 + oy, c.w, c.h)
      }
      ctx.globalAlpha = alpha
      // el lucero de la tarde, sobre el resplandor
      const vx = sunX + W * 0.06 + ox
      const vy = HZ - H * (portrait ? 0.2 : 0.3) + oy
      const tw = 0.8 + 0.2 * Math.sin(ts * 2.3) * Math.sin(ts * 3.7 + 1)
      const halo = ctx.createRadialGradient(vx, vy, 0, vx, vy, 9 * U + 4)
      halo.addColorStop(0, `rgba(255, 250, 235, ${0.95 * tw})`)
      halo.addColorStop(0.25, `rgba(255, 236, 200, ${0.35 * tw})`)
      halo.addColorStop(1, 'rgba(255, 236, 200, 0)')
      ctx.fillStyle = halo
      ctx.fillRect(vx - 14 * U - 4, vy - 14 * U - 4, 28 * U + 8, 28 * U + 8)

      ;[ox, oy] = off(7)
      ctx.drawImage(back, -M + ox, backTop + oy, back.width / DPR, back.height / DPR)
      for (const m of mills) {
        m.a -= (0.24 + 0.62 * g) * m.k * dt
        ctx.drawImage(m.sprite, m.x - m.ax + ox, m.y - m.ay + oy, m.w, m.h)
        drawSails(ctx, m, m.x + ox, m.y + m.hub + oy)
      }

      ;[ox, oy] = off(11)
      ctx.drawImage(field, -M + ox, HZ - 2 + oy, field.width / DPR, field.height / DPR)
      drawWaves(ctx, ts, g, ox, oy)
      ;[ox, oy] = off(14)
      drawEars(ctx, ts, g, ox, oy)
      ;[ox, oy] = off(22)
      drawStalks(ctx, ts, g, ox, oy)
      ctx.globalAlpha = alpha
    },

    dispose() {
      clearTimeout(pending)
    },
  }
}
