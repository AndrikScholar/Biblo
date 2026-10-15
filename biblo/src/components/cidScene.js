// El Cantar del mío Cid: un campo de flores bajo un cielo nublado, con
// montañas en niebla al fondo. Lo pintan dos cámaras:
// - la entrada (8 s, createCidScene): el Cid descansa arrodillado entre las
//   flores, con la espada clavada y la cabeza gacha, y suspira.
//     0-2,8    a ras de flores, la cámara se desliza de lado hasta él
//     2,8-5,2  casi quieta: toma aire (los hombros suben) y lo suelta despacio;
//              el vaho sale del yelmo y una racha levanta pétalos
//     5,2-8    la cámara sube y se aleja: el campo entero, pájaros sobre la
//              niebla y el título
//   Se le ve de perfil y la cara nunca: el yelmo y la sombra la tapan.
// - la ficha (createCidField): el mismo campo sin él, mecido por el viento.
// Va a 60 pulsos (cidMusic.js): el suspiro cae en el segundo compás.
// El mundo se mide en metros: el suelo es y = 0 y z crece alejándose.

import { makeLight } from './quijoteScene'

export const BEAT = 1
export const BAR = 4
export const T = {
  travel: [0, 2.8],
  hold: [2.8, 5.2],
  inhale: [3.4, 4.2],
  exhale: [4.2, 5.6],
  pull: [5.2, 8],
  titleIn: 6,
  end: 8,
}

const TAU = Math.PI * 2
const CID = { x: 0, z: 5.5 }

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
const span = (t, [a, b]) => cl((t - a) / (b - a))
const smooth = (x) => x * x * (3 - 2 * x)

function makeCanvas(w, h) {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.ceil(w))
  c.height = Math.max(1, Math.ceil(h))
  return c
}

// ---------- las flores ----------

// tipo, peso, color de lejos, tamaño de la flor y alto del tallo (m)
const FLOWERS = [
  { kind: 'poppy', w: 30, col: '#c8322a', size: 0.075, stem: [0.32, 0.62] },
  { kind: 'daisy', w: 18, col: '#ece6d8', size: 0.055, stem: [0.22, 0.45] },
  { kind: 'corn', w: 12, col: '#4a6db3', size: 0.045, stem: [0.3, 0.55] },
  { kind: 'butter', w: 14, col: '#e8c23a', size: 0.035, stem: [0.2, 0.4] },
  { kind: 'pink', w: 9, col: '#de7d9e', size: 0.06, stem: [0.3, 0.5] },
  { kind: 'orange', w: 8, col: '#e4732c', size: 0.055, stem: [0.25, 0.45] },
  { kind: 'lav', w: 5, col: '#8a6dbb', size: 0.09, stem: [0.25, 0.45] },
]
const GRASS = ['#263a1b', '#3b5426', '#5d6e35']

function blob(g, x, y, rx, ry, rot, inner, outer) {
  g.save()
  g.translate(x, y)
  g.rotate(rot)
  const gr = g.createRadialGradient(-rx * 0.2, -ry * 0.3, 0, 0, 0, Math.max(rx, ry))
  gr.addColorStop(0, inner)
  gr.addColorStop(1, outer)
  g.fillStyle = gr
  g.beginPath()
  g.ellipse(0, 0, rx, ry, 0, 0, TAU)
  g.fill()
  g.restore()
}

// una flor vista casi de lado, pintada en un lienzo de 96 px (la flor ocupa
// la mitad); `blur` la desenfoca para las que pasan pegadas a la cámara
function paintFlower(kind, blur) {
  const c = makeCanvas(96, 96)
  const g = c.getContext('2d')
  g.filter = `blur(${blur}px)`
  g.translate(48, 48)
  const ring = (n, r, sy, rx, ry, inner, outer) => {
    g.save()
    g.scale(1, sy)
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU
      blob(g, Math.cos(a) * r, Math.sin(a) * r, rx, ry, a, inner, outer)
    }
    g.restore()
  }
  if (kind === 'poppy') {
    blob(g, -13, -4, 17, 14, -0.6, '#d8473a', '#86201a')
    blob(g, 13, -4, 17, 14, 0.6, '#d8473a', '#86201a')
    blob(g, 0, -9, 13, 6, 0, '#4a2a1c', '#1e120d')
    blob(g, -8, 4, 16, 15, -0.3, '#ef6a4c', '#a8281f')
    blob(g, 8, 4, 16, 15, 0.3, '#ef6a4c', '#a8281f')
  } else if (kind === 'daisy') {
    ring(18, 16, 0.5, 11, 3.6, '#fffdf5', '#d6cfbf')
    blob(g, 0, -2, 8, 6, 0, '#f6d35a', '#b8861e')
  } else if (kind === 'corn') {
    ring(11, 12, 0.75, 10, 4, '#86a3e4', '#2f4f9a')
    blob(g, 0, 0, 7, 7, 0, '#46457f', '#22234f')
  } else if (kind === 'butter') {
    blob(g, -7, 0, 10, 9, -0.4, '#ffe680', '#c89a16')
    blob(g, 7, 0, 10, 9, 0.4, '#ffe680', '#c89a16')
    blob(g, 0, 4, 10, 9, 0, '#fff0a0', '#d2a21c')
  } else if (kind === 'pink') {
    ring(8, 15, 0.55, 13, 7, '#f6b3c8', '#c4567a')
    blob(g, 0, -1, 6, 4, 0, '#f2cf55', '#a87a16')
  } else if (kind === 'orange') {
    ring(16, 14, 0.55, 11, 3.5, '#ffb066', '#c2501c')
    blob(g, 0, -1, 7, 5, 0, '#7a3a14', '#3e1a08')
  } else {
    // lavanda: una espiga de botones
    for (let i = 0; i < 12; i++) blob(g, (i % 2 ? -1 : 1) * 3, 26 - i * 4.6, 4.6 - i * 0.15, 3.6, 0, '#b39ae0', '#5d4494')
  }
  return c
}

let SPRITES = null
function sprites() {
  SPRITES ??= FLOWERS.map((f) => ({ sharp: paintFlower(f.kind, 0.5), soft: paintFlower(f.kind, 4) }))
  return SPRITES
}

// el campo: flores y matas de hierba repartidas por el suelo, ordenadas de la
// más lejana a la más cercana. Con `cid`, donde está arrodillado no crece nada
// y entre él y la cámara no hay flores pegadas al objetivo que lo tapen
function makeField(seed, cid) {
  const r = rng(seed)
  const total = FLOWERS.reduce((a, f) => a + f.w, 0)
  const pick = () => {
    let x = r() * total
    for (let i = 0; i < FLOWERS.length; i++) if ((x -= FLOWERS[i].w) < 0) return i
    return 0
  }
  const items = []
  for (let Z = -5.3; Z < 40; ) {
    const near = Z < 14
    const step = near ? 0.12 : 0.4
    const half = 0.67 * (Z + 5.6) + 0.5
    // flores: unas 6 por m² cerca y 3 lejos; hierba solo cerca
    for (let X = -half - 3.7 + r(); X < half; X += (Z < 6 ? 1 : near ? 1.4 : 0.8) * (0.3 + 1.4 * r())) {
      const k = pick()
      const f = FLOWERS[k]
      const h = mix(f.stem[0], f.stem[1], r())
      if (cid && Z > 5.05 && Z < 5.95 && X > -0.95 && X < 0.75) continue
      if (cid && Z > 0.2 && Z < 2.6 && Math.abs((X + 0.25) / (Z - 0.15) - 0.05) < 0.17 && r() < 0.85) continue
      items.push({ X: X + (r() - 0.5) * 0.3, Z: Z + r() * step, k, h, size: f.size * (0.8 + r() * 0.4), ph: r() * TAU })
    }
    if (Z < 6) {
      for (let X = -half - 3.7 + r(); X < half; X += 0.8 * (0.4 + 1.2 * r())) {
        const blades = []
        for (let i = 0; i < 5; i++) blades.push({ o: (r() - 0.5) * 0.08, h: 0.08 + r() * 0.16, lean: (r() - 0.5) * 0.5, c: Math.floor(r() * 3) })
        items.push({ X, Z: Z + r() * step, grass: blades, ph: r() * TAU })
      }
    }
    Z += step
  }
  return items.sort((a, b) => b.Z - a.Z)
}

// ---------- el cielo y las montañas (quietos: están muy lejos) ----------

function paintBackdrop(W, H, HY, dpr, r) {
  const c = makeCanvas(W * dpr, (HY + H * 0.1) * dpr)
  const g = c.getContext('2d')
  g.scale(dpr, dpr)
  const sky = g.createLinearGradient(0, 0, 0, HY)
  sky.addColorStop(0, '#36413e')
  sky.addColorStop(0.45, '#65706a')
  sky.addColorStop(0.85, '#aeb2a3')
  sky.addColorStop(1, '#d2d2c2')
  g.fillStyle = sky
  g.fillRect(0, 0, W, HY + H * 0.1)
  // nubes de pincel: oscuras arriba, un claro de luz hacia el centro
  for (let i = 0; i < 46; i++) {
    const x = r() * W
    const y = Math.pow(r(), 1.4) * HY * 0.95
    const rad = (0.06 + r() * 0.16) * Math.max(W, H)
    const light = y > HY * 0.35 && r() < 0.6
    const col = light ? '214, 214, 200' : '34, 42, 40'
    const blot = g.createRadialGradient(x, y, 0, x, y, rad)
    blot.addColorStop(0, `rgba(${col}, ${light ? 0.12 + r() * 0.12 : 0.1 + r() * 0.14})`)
    blot.addColorStop(1, `rgba(${col}, 0)`)
    g.fillStyle = blot
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2)
  }

  // cordilleras: cuanto más cerca, más oscuras; la niebla se mete entre ellas
  const ridge = (top, amp, f, col, x0 = 0, x1 = W, blur = 0) => {
    const ph = r() * TAU
    g.filter = blur ? `blur(${blur}px)` : 'none'
    g.fillStyle = col
    g.beginPath()
    g.moveTo(x0, HY + 2)
    for (let x = x0; x <= x1 + 8; x += 6) {
      const k = x / W
      const n = 0.55 * Math.sin(k * f * TAU + ph) + 0.3 * Math.sin(k * f * 2.7 * TAU + ph * 1.7) + 0.15 * Math.sin(k * f * 6.1 * TAU + ph * 3)
      g.lineTo(x, HY - H * (top + amp * n))
    }
    g.lineTo(x1, HY + 2)
    g.fill()
    g.filter = 'none'
  }
  const mist = (y0, y1, a) => {
    const m = g.createLinearGradient(0, y0, 0, y1)
    m.addColorStop(0, 'rgba(214, 216, 204, 0)')
    m.addColorStop(1, `rgba(214, 216, 204, ${a})`)
    g.fillStyle = m
    g.fillRect(0, y0, W, y1 - y0)
  }
  ridge(0.16, 0.05, 1.3, '#909c96', 0, W, 1.5)
  mist(HY - H * 0.14, HY, 0.55)
  ridge(0.09, 0.035, 2.1, '#71807a', 0, W, 0.8)
  mist(HY - H * 0.08, HY, 0.5)
  // la ladera grande de la derecha, como en la referencia
  g.fillStyle = '#48554f'
  g.beginPath()
  g.moveTo(W * 0.5, HY + 2)
  for (let i = 0; i <= 40; i++) {
    const k = i / 40
    const x = mix(W * 0.5, W + 4, k)
    g.lineTo(x, HY - H * (0.32 * Math.pow(k, 1.4) + 0.012 * Math.sin(k * 23) + 0.006 * Math.sin(k * 61)))
  }
  g.lineTo(W + 4, HY + 2)
  g.fill()
  for (let i = 0; i < 60; i++) {
    const k = 0.15 + r() * 0.85
    const x = mix(W * 0.5, W, k)
    const y = HY - H * 0.32 * Math.pow(k, 1.4) * r()
    const rad = H * (0.015 + r() * 0.04)
    const col = r() < 0.5 ? '120, 136, 126' : '24, 32, 30'
    const blot = g.createRadialGradient(x, y, 0, x, y, rad)
    blot.addColorStop(0, `rgba(${col}, 0.22)`)
    blot.addColorStop(1, `rgba(${col}, 0)`)
    g.fillStyle = blot
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2)
  }
  mist(HY - H * 0.05, HY, 0.45)
  ridge(0.025, 0.012, 3.3, '#56683f', 0, W, 0.6)

  // la pradera lejana: motas de flores sobre verde, perdiéndose en la bruma
  const band = g.createLinearGradient(0, HY, 0, HY + H * 0.1)
  band.addColorStop(0, '#8e9878')
  band.addColorStop(1, '#5f7140')
  g.fillStyle = band
  g.fillRect(0, HY, W, H * 0.1)
  for (let i = 0; i < W * 1.4; i++) {
    const f = FLOWERS[Math.floor(r() * FLOWERS.length)]
    const y = HY + Math.pow(r(), 1.5) * H * 0.1
    g.globalAlpha = 0.25 + 0.5 * ((y - HY) / (H * 0.1))
    g.fillStyle = f.col
    g.fillRect(r() * W, y, 1.2, 1)
  }
  g.globalAlpha = 1
  mist(HY - H * 0.012, HY + H * 0.012, 0.35)

  // grano de pintura sobre todo
  const grain = makeCanvas(160, 160)
  const gg = grain.getContext('2d')
  const img = gg.createImageData(160, 160)
  for (let i = 0; i < img.data.length; i += 4) {
    img.data[i] = img.data[i + 1] = img.data[i + 2] = 100 + r() * 60
    img.data[i + 3] = 255
  }
  gg.putImageData(img, 0, 0)
  g.globalCompositeOperation = 'overlay'
  g.globalAlpha = 0.1
  g.fillStyle = g.createPattern(grain, 'repeat')
  g.fillRect(0, 0, W, HY + H * 0.1)
  g.globalCompositeOperation = 'source-over'
  g.globalAlpha = 1
  return c
}

// ---------- el campo en perspectiva ----------

// cortes de profundidad: dentro de cada uno se pinta de golpe la hierba y los
// tallos, y luego las flores; así lo cercano tapa a lo lejano
const CUTS = [24, 14, 9, 6.5, 4.5, 3.2, 2.2, 1.5, 1, 0.7, 0.5, 0.35, 0.2]

// cam: { x, z, h }; F: distancia focal en px; wind(X) da el viento en esa x;
// `figure(s, gx, gy)` pinta lo que esté en CID.z (el Cid), en su sitio
function drawField(ctx, V, cam, t, items, wind, figure) {
  const { W, H, HY, F } = V
  const A = ctx.globalAlpha
  const spr = sprites()
  const yAt = (dz) => HY + (cam.h * F) / dz

  // el suelo: de verde oscuro a los pies a oliva brumoso al fondo
  ctx.drawImage(V.back, 0, 0, W, V.back.height / V.dpr)
  const g0 = yAt(40)
  const ground = ctx.createLinearGradient(0, g0, 0, H)
  for (const [dz, col] of [[40, '#62744a'], [16, '#55693a'], [7, '#435a2a'], [3, '#344a20'], [1.2, '#263619']]) {
    const y = yAt(dz)
    if (y <= H) ground.addColorStop(cl((y - g0) / Math.max(1, H - g0)), col)
  }
  ctx.fillStyle = ground
  ctx.fillRect(0, g0, W, H - g0)
  // bruma donde la pradera se pierde, sin borde
  const haze = ctx.createLinearGradient(0, HY, 0, g0 + H * 0.04)
  haze.addColorStop(0, 'rgba(196, 200, 186, 0.45)')
  haze.addColorStop(1, 'rgba(196, 200, 186, 0)')
  ctx.fillStyle = haze
  ctx.fillRect(0, HY, W, g0 + H * 0.04 - HY)

  let cut = 0
  let blades = GRASS.map(() => new Path2D())
  let stems = new Path2D()
  let dots = FLOWERS.map(() => new Path2D())
  let heads = []
  let grassA = 1
  let done = !figure
  const flush = () => {
    ctx.globalAlpha = A * grassA
    GRASS.forEach((col, i) => {
      ctx.fillStyle = col
      ctx.fill(blades[i])
    })
    ctx.globalAlpha = A
    ctx.fillStyle = '#3c5326'
    ctx.fill(stems)
    ctx.globalAlpha = A * 0.8
    FLOWERS.forEach((f, i) => {
      ctx.fillStyle = f.col
      ctx.fill(dots[i])
    })
    ctx.globalAlpha = A
    for (const [img, x, y, d] of heads) ctx.drawImage(img, x - d / 2, y - d / 2, d, d)
    blades = GRASS.map(() => new Path2D())
    stems = new Path2D()
    dots = FLOWERS.map(() => new Path2D())
    heads = []
  }

  for (const it of items) {
    const dz = it.Z - cam.z
    if (dz < 0.15) break
    while (cut < CUTS.length && dz < CUTS[cut]) {
      flush()
      cut++
      grassA = cl((5.5 - (CUTS[cut - 1] ?? 9)) / 2)
    }
    if (!done && it.Z < CID.z) {
      flush()
      const s = F / (CID.z - cam.z)
      figure(s, W / 2 + (CID.x - cam.x) * s, HY + cam.h * s)
      done = true
    }
    const s = F / dz
    const gx = W / 2 + (it.X - cam.x) * s
    const gy = HY + cam.h * s
    const w = wind(it.X)

    if (it.grass) {
      if (dz > 5.5 || gx < -60 || gx > W + 60) continue
      for (const b of it.grass) {
        const sw = (b.lean + Math.sin(t * 1.9 + it.ph + b.o * 20) * (0.08 + 0.12 * w) + w * 0.3) * b.h
        const x0 = gx + b.o * s
        const tx = x0 + sw * s
        const ty = gy - (b.h - cam.h) * s - cam.h * s
        const half = 0.005 * s
        const p = blades[b.c]
        p.moveTo(x0 - half, gy)
        p.quadraticCurveTo(x0 + sw * s * 0.2, (gy + ty) / 2, tx, ty)
        p.quadraticCurveTo(x0 + sw * s * 0.2 + half, (gy + ty) / 2, x0 + half, gy)
      }
      continue
    }

    const f = FLOWERS[it.k]
    // pegadas a la cámara serían manchas enormes (y la lavanda, un fantasma)
    if (dz < 0.45 || (dz < 1 && f.kind === 'lav')) continue
    // de lejos, una mota pequeña de su color
    if (it.size * s < 4) {
      if (gx > -2 && gx < W + 2) {
        const d = Math.max(1, it.size * s * 1.2)
        dots[it.k].rect(gx - d / 2, HY - (it.h - cam.h) * s - d / 2, d, d * 0.8)
      }
      continue
    }
    // el viento inclina la flor; cada una oscila a su ritmo
    const sw = (Math.sin(t * 1.6 + it.ph) * 0.6 + Math.sin(t * 2.9 + it.ph * 2) * 0.3) * (0.04 + 0.1 * w) + w * 0.14
    const hx = gx + sw * it.h * s
    const hy = HY - (it.h * (1 - sw * sw * 0.5) - cam.h) * s
    const d = 2 * it.size * s
    if (hx < -d || hx > W + d || hy - d > H) continue
    const half = Math.max(0.4, 0.0035 * s)
    const cx = gx + sw * it.h * s * 0.3
    const cy = (gy + hy) / 2
    stems.moveTo(gx - half, gy)
    stems.quadraticCurveTo(cx - half, cy, hx, hy)
    stems.quadraticCurveTo(cx + half, cy, gx + half, gy)
    heads.push([dz < 0.9 ? spr[it.k].soft : spr[it.k].sharp, hx, hy, d])
    if (f.kind === 'lav') heads[heads.length - 1][2] -= d * 0.2
  }
  flush()
  if (!done) {
    const s = F / (CID.z - cam.z)
    figure(s, W / 2 + (CID.x - cam.x) * s, HY + cam.h * s)
  }
  ctx.globalAlpha = A
}

// ---------- el Cid ----------

// cota de malla: anillas pequeñas; óxido: manchas pardas. Se pintan una vez y
// se usan como relleno sobre el hierro
let MAIL = null
let RUST = null
function textures(g) {
  if (!MAIL) {
    const m = makeCanvas(24, 24)
    const mg = m.getContext('2d')
    for (let y = 0; y <= 24; y += 6) {
      for (let x = (y / 6) % 2 ? 3 : 0; x <= 24; x += 6) {
        mg.strokeStyle = 'rgba(16, 15, 13, 0.6)'
        mg.lineWidth = 1.2
        mg.beginPath()
        mg.arc(x, y, 3.2, 0.1 * Math.PI, 0.9 * Math.PI)
        mg.stroke()
        mg.strokeStyle = 'rgba(210, 205, 190, 0.22)'
        mg.beginPath()
        mg.arc(x, y - 1, 3, 1.15 * Math.PI, 1.85 * Math.PI)
        mg.stroke()
      }
    }
    MAIL = m
    const rs = makeCanvas(128, 128)
    const rg = rs.getContext('2d')
    const r = rng(1094)
    for (let i = 0; i < 70; i++) {
      const x = r() * 128
      const y = r() * 128
      const rad = 3 + r() * 12
      const col = ['138, 67, 32', '163, 90, 40', '107, 52, 24', '74, 58, 40'][Math.floor(r() * 4)]
      const b = rg.createRadialGradient(x, y, 0, x, y, rad)
      b.addColorStop(0, `rgba(${col}, ${0.18 + r() * 0.25})`)
      b.addColorStop(1, `rgba(${col}, 0)`)
      rg.fillStyle = b
      rg.fillRect(x - rad, y - rad, rad * 2, rad * 2)
    }
    RUST = rs
  }
  const mail = g.createPattern(MAIL, 'repeat')
  mail.setTransform(new DOMMatrix([0.045 / 24, 0, 0, 0.045 / 24, 0, 0]))
  const rust = g.createPattern(RUST, 'repeat')
  rust.setTransform(new DOMMatrix([0.28 / 128, 0, 0, 0.28 / 128, 0, 0]))
  return { mail, rust }
}

// tramo de brazo o pierna: un trapecio con las puntas redondas
function limb(x1, y1, x2, y2, w1, w2) {
  const p = new Path2D()
  const a = Math.atan2(y2 - y1, x2 - x1)
  const nx = -Math.sin(a)
  const ny = Math.cos(a)
  p.moveTo(x1 + nx * w1, y1 + ny * w1)
  p.lineTo(x2 + nx * w2, y2 + ny * w2)
  p.arc(x2, y2, w2, a + Math.PI / 2, a - Math.PI / 2, true)
  p.lineTo(x1 - nx * w1, y1 - ny * w1)
  p.arc(x1, y1, w1, a - Math.PI / 2, a - (3 * Math.PI) / 2, true)
  p.closePath()
  p.axis = [x1, y1, x2, y2, Math.max(w1, w2)]
  return p
}

function poly(pts) {
  const p = new Path2D()
  pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)))
  p.closePath()
  return p
}

// de perfil, mirando a la izquierda, con el suelo en y = 0 (arriba es
// negativo). L: cuánto ha tomado aire (los hombros suben); D: cuánto se le
// ha caído la cabeza al soltarlo; sway: el viento en la capa.
// Devuelve dónde le sale el aliento.
function drawCid(g, L, D, sway) {
  const tex = textures(g)
  const sh = -0.035 * L
  const light = g.createLinearGradient(-0.5, -1.3, 0.5, 0.1)
  light.addColorStop(0, '#6a6a62')
  light.addColorStop(0.5, '#3a3a35')
  light.addColorStop(1, '#1c1c19')
  const iron = (p, mail = true, dark = 0) => {
    g.fillStyle = light
    g.fill(p)
    if (mail) {
      g.fillStyle = tex.mail
      g.fill(p)
    }
    g.fillStyle = tex.rust
    g.fill(p)
    // volumen: claro por arriba y oscuro por abajo, de lado a lado del miembro
    if (p.axis) {
      const [x1, y1, x2, y2, w] = p.axis
      const a = Math.atan2(y2 - y1, x2 - x1)
      let nx = -Math.sin(a)
      let ny = Math.cos(a)
      if (ny > 0) [nx, ny] = [-nx, -ny]
      const mx = (x1 + x2) / 2
      const my = (y1 + y2) / 2
      const v = g.createLinearGradient(mx + nx * w, my + ny * w, mx - nx * w, my - ny * w)
      v.addColorStop(0, 'rgba(235, 235, 220, 0.22)')
      v.addColorStop(0.45, 'rgba(0, 0, 0, 0)')
      v.addColorStop(1, 'rgba(0, 0, 0, 0.42)')
      g.fillStyle = v
      g.fill(p)
    }
    if (dark) {
      g.fillStyle = `rgba(14, 14, 12, ${dark})`
      g.fill(p)
    }
    g.strokeStyle = 'rgba(12, 12, 10, 0.45)'
    g.lineWidth = 0.006
    g.stroke(p)
  }
  // un brazo: una sola manga de malla que se dobla en el codo (la curva pasa
  // justo por él), del hombro a la muñeca
  const sleeve = (a, e, b, w, dark = 0) => {
    const p = new Path2D()
    p.moveTo(a[0], a[1])
    p.quadraticCurveTo(2 * e[0] - (a[0] + b[0]) / 2, 2 * e[1] - (a[1] + b[1]) / 2, b[0], b[1])
    g.lineCap = 'round'
    g.lineWidth = w + 0.012
    g.strokeStyle = 'rgba(12, 12, 10, 0.45)'
    g.stroke(p)
    g.lineWidth = w
    for (const style of [light, tex.mail, tex.rust]) {
      g.strokeStyle = style
      g.stroke(p)
    }
    const v = g.createLinearGradient(e[0], e[1] - w, e[0], e[1] + w)
    v.addColorStop(0, 'rgba(235, 235, 220, 0.18)')
    v.addColorStop(1, 'rgba(0, 0, 0, 0.35)')
    g.strokeStyle = v
    g.stroke(p)
    if (dark) {
      g.strokeStyle = `rgba(14, 14, 12, ${dark})`
      g.stroke(p)
    }
  }
  // barro en lo que toca el suelo
  const dirt = (p, y0) => {
    const d = g.createLinearGradient(0, y0, 0, 0)
    d.addColorStop(0, 'rgba(74, 58, 40, 0)')
    d.addColorStop(1, 'rgba(74, 58, 40, 0.7)')
    g.fillStyle = d
    g.fill(p)
  }

  // la capa roja, raída, cae por la espalda hasta el suelo
  const cape = new Path2D()
  cape.moveTo(-0.02, -1.05 + sh)
  cape.quadraticCurveTo(0.2, -1.09 + sh, 0.29, -0.95 + sh)
  cape.quadraticCurveTo(0.45 + sway * 0.06, -0.55, 0.62 + sway * 0.18, -0.02)
  for (const [x, y, k] of [[0.55, -0.07, 0.14], [0.5, 0.01, 0.12], [0.43, -0.08, 0.09], [0.37, 0.005, 0.06], [0.3, -0.09, 0.03], [0.24, -0.02, 0]]) {
    cape.lineTo(x + sway * k, y)
  }
  cape.quadraticCurveTo(0.2, -0.5, 0.08, -0.92 + sh)
  cape.closePath()
  const red = g.createLinearGradient(0, -1.1, 0.5, 0)
  red.addColorStop(0, '#7e2c22')
  red.addColorStop(0.6, '#5a1f18')
  red.addColorStop(1, '#33120e')
  g.fillStyle = red
  g.fill(cape)
  dirt(cape, -0.35)
  g.strokeStyle = 'rgba(30, 8, 6, 0.4)'
  g.lineWidth = 0.008
  g.beginPath()
  g.moveTo(0.18, -0.95 + sh)
  g.quadraticCurveTo(0.3, -0.5, 0.42 + sway * 0.08, -0.06)
  g.moveTo(0.1, -0.9 + sh)
  g.quadraticCurveTo(0.2, -0.45, 0.3, -0.08)
  g.stroke()

  // pierna de atrás, con la rodilla en el suelo
  const farThigh = limb(0.14, -0.47, 0.12, -0.06, 0.07, 0.055)
  const farShin = limb(0.12, -0.06, 0.5, -0.045, 0.05, 0.04)
  iron(farThigh, true, 0.3)
  iron(farShin, true, 0.3)
  dirt(farShin, -0.12)

  // brazo de atrás, estirado hasta la empuñadura
  sleeve([-0.02, -0.98 + sh], [-0.32, -0.7 + sh * 0.5], [-0.59, -0.84], 0.085, 0.35)

  // la espada, clavada delante de él, roída de óxido
  const blade = poly([[-0.712, 0.03], [-0.672, -0.745], [-0.638, -0.745], [-0.688, 0.03]])
  iron(blade, false)
  g.strokeStyle = 'rgba(20, 20, 18, 0.5)'
  g.lineWidth = 0.005
  g.beginPath()
  g.moveTo(-0.7, 0)
  g.lineTo(-0.655, -0.7)
  g.stroke()
  g.strokeStyle = 'rgba(220, 220, 205, 0.35)'
  g.lineWidth = 0.003
  g.beginPath()
  g.moveTo(-0.68, -0.05)
  g.lineTo(-0.642, -0.72)
  g.stroke()
  iron(limb(-0.775, -0.752, -0.535, -0.768, 0.013, 0.013), false)
  g.fillStyle = '#3a2a1c'
  g.fill(limb(-0.655, -0.77, -0.648, -0.9, 0.016, 0.015))
  const pommel = new Path2D()
  pommel.ellipse(-0.646, -0.925, 0.03, 0.026, 0, 0, TAU)
  iron(pommel, false)
  // la mano de atrás, cerrada sobre el puño
  const farHand = new Path2D()
  farHand.ellipse(-0.625, -0.84, 0.05, 0.038, -0.2, 0, TAU)
  iron(farHand, true, 0.25)

  // el cuerpo: cota de malla
  const torso = poly([
    [-0.04, -1.05 + sh],
    [0.18, -1.01 + sh],
    [0.27, -0.88 + sh * 0.8],
    [0.3, -0.7],
    [0.28, -0.47],
    [0.05, -0.43],
    [-0.1, -0.58],
    [-0.15, -0.82 + sh * 0.6],
    [-0.1, -0.98 + sh],
  ])
  iron(torso)
  const rim = (pts) => {
    g.strokeStyle = 'rgba(215, 222, 205, 0.4)'
    g.lineWidth = 0.012
    g.beginPath()
    pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)))
    g.stroke()
  }
  rim([[0.16, -1.01 + sh], [0.26, -0.89 + sh * 0.8], [0.29, -0.72]])

  // pierna de delante: la rodilla levantada, el pie en el suelo
  const thigh = limb(0.12, -0.47, -0.3, -0.53, 0.075, 0.06)
  const shin = limb(-0.3, -0.53, -0.35, -0.07, 0.056, 0.04)
  iron(thigh)
  iron(shin)
  dirt(shin, -0.3)
  const boot = limb(-0.33, -0.06, -0.5, -0.025, 0.045, 0.03)
  g.fillStyle = '#33251a'
  g.fill(boot)
  dirt(boot, -0.1)

  // la sobreveste verde, sucia y rota por abajo, con el cinto
  const coat = poly([
    [-0.09, -0.99 + sh],
    [0.2, -0.98 + sh],
    [0.28, -0.75 + sh * 0.5],
    [0.31, -0.45],
    [0.33, -0.26],
    [0.27, -0.31],
    [0.22, -0.24],
    [0.15, -0.33],
    [0.08, -0.27],
    [0.0, -0.38],
    [-0.07, -0.33],
    [-0.12, -0.42],
    [-0.18, -0.4],
    [-0.15, -0.5],
    [-0.11, -0.6],
    [-0.15, -0.82 + sh * 0.6],
  ])
  const green = g.createLinearGradient(-0.2, -1, 0.35, -0.3)
  green.addColorStop(0, '#56603b')
  green.addColorStop(0.5, '#3a4428')
  green.addColorStop(1, '#20271a')
  g.fillStyle = green
  g.fill(coat)
  g.globalAlpha *= 0.35
  g.fillStyle = tex.rust
  g.fill(coat)
  g.globalAlpha /= 0.35
  dirt(coat, -0.6)
  g.strokeStyle = 'rgba(20, 26, 12, 0.45)'
  g.lineWidth = 0.007
  g.beginPath()
  g.moveTo(0.05, -0.56)
  g.lineTo(0.0, -0.38)
  g.moveTo(0.2, -0.55)
  g.lineTo(0.22, -0.26)
  g.stroke()
  g.fillStyle = '#3a2618'
  g.fill(limb(-0.12, -0.6, 0.3, -0.63, 0.02, 0.02))
  g.fillStyle = '#8a7a52'
  g.fillRect(-0.1, -0.625, 0.03, 0.045)

  // hombros: la malla del almófar cae sobre ellos
  iron(poly([[-0.13, -1.0 + sh], [0.05, -1.08 + sh], [0.23, -1.03 + sh], [0.27, -0.9 + sh], [0.1, -0.92 + sh], [-0.1, -0.88 + sh]]))

  // la cabeza, inclinada hacia el suelo: almófar, yelmo cónico con nasal y la
  // cara en sombra
  g.save()
  g.translate(-0.05, -1.06 + sh)
  const a = -(0.6 + 0.14 * D - 0.16 * L)
  g.rotate(a)
  iron(poly([[-0.1, 0.03], [-0.13, -0.08], [-0.13, -0.17], [-0.08, -0.25], [0.02, -0.27], [0.1, -0.21], [0.12, -0.1], [0.1, 0.03], [-0.02, 0.06]]))
  g.fillStyle = '#121210'
  g.fill(poly([[-0.132, -0.075], [-0.137, -0.18], [-0.09, -0.19], [-0.082, -0.085]]))
  const helm = poly([[-0.118, -0.165], [-0.05, -0.29], [-0.015, -0.32], [0.02, -0.29], [0.1, -0.185], [0.096, -0.152], [-0.113, -0.138]])
  iron(helm, false)
  g.fillStyle = 'rgba(0, 0, 0, 0.25)'
  g.fillRect(-0.118, -0.172, 0.222, 0.026)
  iron(poly([[-0.126, -0.16], [-0.146, -0.07], [-0.13, -0.068], [-0.11, -0.16]]), false)
  g.strokeStyle = 'rgba(225, 222, 205, 0.35)'
  g.lineWidth = 0.005
  g.beginPath()
  g.moveTo(-0.1, -0.18)
  g.lineTo(-0.04, -0.29)
  g.stroke()
  rim([[0.02, -0.29], [0.09, -0.19], [0.11, -0.1]])
  g.restore()
  const mx = -0.14
  const my = -0.075
  const mouth = [-0.05 + mx * Math.cos(a) - my * Math.sin(a), -1.06 + sh + mx * Math.sin(a) + my * Math.cos(a)]

  // brazo de delante: el codo apoyado en la rodilla y la mano colgando
  sleeve([0.05, -0.97 + sh], [-0.22, -0.62 + sh * 0.3], [-0.42, -0.4], 0.095)
  const hand = new Path2D()
  hand.ellipse(-0.455, -0.335, 0.045, 0.032, 1.1, 0, TAU)
  iron(hand, true, 0.1)
  return mouth
}

// ---------- la entrada ----------

// contraluz de la niebla (la luz de quijoteScene.js): un filo pálido en los
// bordes que miran al claro del cielo, el verde del campo que rebota por
// debajo y un halo suave; sin sombra larga
const LIGHT = {
  lx: 0.55,
  ly: -0.83,
  d: 0.007,
  rim: '#aab2a4',
  glow: '#6f786c',
  bounce: '#3e5a2a',
  sky: '#8e978a',
  shadow: { color: '#000', ground: 0, lean: 0, len: 0, alpha: 0 },
}

// un pájaro lejano: una uve que aletea
function bird(ctx, x, y, s, flap) {
  const up = Math.sin(flap) * s * 0.6
  ctx.beginPath()
  ctx.moveTo(x - s, y - up)
  ctx.quadraticCurveTo(x - s * 0.4, y - s * 0.1, x, y + s * 0.15)
  ctx.quadraticCurveTo(x + s * 0.4, y - s * 0.1, x + s, y - up)
  ctx.stroke()
}

export function createCidScene(canvas) {
  const ctx = canvas.getContext('2d')
  const field = makeField(1207, true)
  const lit = makeLight()
  const V = {}
  // pétalos que levanta la racha y bocanadas de vaho: todo sale de la semilla
  const r = rng(1099)
  const PETALS = Array.from({ length: 30 }, (_, i) => ({
    b: 4.3 + r() * 1.2,
    x: -2.6 + r() * 4,
    z: 2 + r() * 5,
    y: 0.35 + r() * 0.2,
    vx: 1 + r() * 1.2,
    vy: 0.15 + r() * 0.35,
    vz: (r() - 0.5) * 0.4,
    col: ['#d8392c', '#e98aa6', '#f1ece0', '#ea7c33', '#c8322a'][i % 5],
  }))

  function resize() {
    const rect = canvas.getBoundingClientRect()
    V.W = Math.max(1, rect.width)
    V.H = Math.max(1, rect.height)
    V.dpr = Math.min(window.devicePixelRatio || 1, 1.25)
    canvas.width = Math.round(V.W * V.dpr)
    canvas.height = Math.round(V.H * V.dpr)
    V.HY = V.H * 0.4
    V.F = V.H * 1.8
    V.back = paintBackdrop(V.W, V.H, V.HY, V.dpr, rng(1140))
  }

  function camera(t) {
    const tr = smooth(span(t, T.travel))
    const hold = span(t, T.hold)
    const pl = 1 - (1 - span(t, T.pull)) ** 3
    // en vertical, un poco más lejos y centrado, para que quepa entero
    const tall = V.W < V.H
    return {
      x: mix(-3.2, tall ? 0 : -0.35, tr) + 0.1 * hold + 0.15 * pl,
      z: 0.15 * hold - 5.5 * pl - (tall ? 1.5 : 0),
      h: mix(0.42, 0.85, tr) + 0.75 * pl,
    }
  }

  // el viento sopla flojo y, al suspirar, llega una racha de izquierda a derecha
  const gust = (t) => 0.22 + 0.63 * smooth(span(t, [4.2, 4.9])) * (1 - 0.7 * smooth(span(t, [5.6, 7.2])))

  function frame(t) {
    const { W, H, HY, F, dpr } = V
    const cam = camera(t)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.globalAlpha = 1

    // el suspiro: toma aire, lo suelta y la cabeza se le cae un poco más
    const L = smooth(span(t, T.inhale)) * (1 - smooth(span(t, T.exhale))) + 0.12 * Math.sin((t * TAU) / 3.2) * (1 - span(t, T.inhale))
    const D = smooth(span(t, T.exhale))
    let mouth = null
    let ks = 1
    let org = [0, 0]
    drawField(ctx, V, cam, t, field, (X) => gust(t - (X + 4) * 0.08), (s, gx, gy) => {
      if (gx + 0.9 * s < 0 || gx - 0.9 * s > W) return
      ctx.save()
      ctx.translate(gx, gy)
      ctx.scale(s, s)
      // sombra suave en la hierba: con el cielo nublado no hay sombra larga
      ctx.fillStyle = 'rgba(18, 24, 14, 0.25)'
      ctx.beginPath()
      ctx.ellipse(0.02, 0, 0.7, 0.06, 0, 0, TAU)
      ctx.fill()
      const sway = 0.3 * Math.sin(t * 1.3) + gust(t - 4 * 0.08) * 1.4
      lit(ctx, s * dpr, [-0.85, -1.5, 1.65, 1.56], (g) => (mouth = drawCid(g, L, D, sway)), LIGHT)
      ctx.restore()
      ks = s
      org = [gx, gy]
    })

    // el vaho del suspiro: bocanadas que salen hacia delante y se deshacen
    if (mouth) {
      const mx = org[0] + mouth[0] * ks
      const my = org[1] + mouth[1] * ks
      for (let j = 0; j < 10; j++) {
        const age = t - (T.exhale[0] + 0.05 + j * 0.1)
        if (age < 0 || age > 1.6) continue
        const x = mx + (-0.2 * age + 0.06 * age * age) * ks
        const y = my + (0.05 * age - 0.07 * age * age) * ks
        const rad = (0.04 + 0.12 * age) * ks
        const puff = ctx.createRadialGradient(x, y, 0, x, y, rad)
        puff.addColorStop(0, `rgba(236, 238, 230, ${0.34 * (1 - age / 1.6)})`)
        puff.addColorStop(1, 'rgba(236, 238, 230, 0)')
        ctx.fillStyle = puff
        ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2)
      }
    }

    // pétalos en la racha
    for (const p of PETALS) {
      const age = t - p.b
      if (age < 0 || age > 2.8) continue
      const dz = p.z + p.vz * age - cam.z
      if (dz < 0.3) continue
      const s = F / dz
      const x = W / 2 + (p.x + p.vx * age + Math.sin(age * 3 + p.b * 9) * 0.08 - cam.x) * s
      const y = HY - (p.y + p.vy * age + Math.sin(age * 5 + p.b * 7) * 0.05 - cam.h) * s
      ctx.globalAlpha = Math.min(1, (2.8 - age) * 1.5)
      ctx.fillStyle = p.col
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(age * 6 + p.b * 10)
      ctx.scale(Math.cos(age * 8 + p.b * 5), 1)
      ctx.beginPath()
      ctx.ellipse(0, 0, 0.022 * s, 0.014 * s, 0, 0, TAU)
      ctx.fill()
      ctx.restore()
    }
    ctx.globalAlpha = 1

    // pájaros que cruzan delante de la niebla
    ctx.strokeStyle = 'rgba(38, 44, 40, 0.75)'
    ctx.lineWidth = Math.max(1, H * 0.0022)
    for (let i = 0; i < 5; i++) {
      const p = t - 4.4 - i * 0.18
      if (p < 0) continue
      const x = W * (-0.06 + p * 0.085 + (i % 3) * 0.035)
      const y = HY - H * (0.13 + (i % 2) * 0.03 + i * 0.008) + Math.sin(p * 2 + i) * H * 0.006
      bird(ctx, x, y, H * (0.009 + (i % 2) * 0.002), p * 9 + i * 1.7)
    }

    // viñeta suave, como en la pintura
    const vg = ctx.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.35, W / 2, H * 0.45, Math.max(W, H) * 0.8)
    vg.addColorStop(0, 'rgba(12, 14, 12, 0)')
    vg.addColorStop(1, 'rgba(12, 14, 12, 0.45)')
    ctx.fillStyle = vg
    ctx.fillRect(0, 0, W, H)
  }

  resize()
  return { frame, resize, dispose() {} }
}

// ---------- la ficha ----------

// el campo quieto, sin él, mecido por el viento a rachas (manchaWind.js); el
// cursor mueve un poco la cámara y lo cercano se desplaza más que lo lejano
export function createCidField(gust) {
  const field = makeField(1207, false)
  const t0 = performance.now()
  const V = {}
  let pending = null
  let size = null
  function build() {
    ;[V.W, V.H, V.dpr] = size
    V.HY = V.H * 0.42
    V.F = V.H * 1.8
    V.back = paintBackdrop(V.W, V.H, V.HY, V.dpr, rng(1140))
  }
  return {
    resize(w, h, dpr) {
      size = [w, h, dpr]
      clearTimeout(pending)
      if (!V.back) build()
      else pending = setTimeout(build, 160)
    },
    draw(ctx, now, px, py) {
      if (!V.back) return
      const t = (now - t0) / 1000
      const cam = { x: 0.6 + px * 0.3, z: -3 - py * 0.2, h: 1.1 }
      drawField(ctx, V, cam, t, field, (X) => (gust ? gust(now - (X + 10) * 60) : 0.3))
      // un velo oscuro para que se lea la ficha
      const A = ctx.globalAlpha
      ctx.fillStyle = 'rgba(12, 16, 14, 0.4)'
      ctx.fillRect(0, 0, V.W, V.H)
      ctx.globalAlpha = A
    },
    dispose() {
      clearTimeout(pending)
    },
  }
}
