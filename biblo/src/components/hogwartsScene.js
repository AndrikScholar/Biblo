// Hogwarts de noche: el ambiente de la ficha de Harry Potter, pintado como la
// portada de Salamandra: cielo azul verdoso con estrellas, luna creciente, el
// castillo de piedra con tejados rojos y ventanas encendidas sobre su roca, y
// el lago que lo refleja. De vez en cuando cruza una lechuza con una carta
// entre las patas.
//
// Lo quieto se pinta una vez por tamaño de ventana; en cada fotograma solo se
// dibujan las luces de las ventanas, sus reflejos y la lechuza.

const TAU = Math.PI * 2

function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.ceil(w))
  c.height = Math.max(1, Math.ceil(h))
  return c
}

const STONE = ['#202d27', '#435848', '#73876b']
const ROOF = ['#4f1e17', '#913a27', '#c25a37']

// el castillo, en centésimas de su altura (y hacia arriba):
// torres [x, ancho, alto, tejado cónico (0: almenas)] y naves [desde, hasta, alto, tejado]
const TOWERS = [
  [-47, 8, 36, 15],
  [-31, 11, 56, 22],
  [-13, 9, 71, 26],
  [3, 15, 48, 0],
  [19, 8, 86, 30],
  [33, 11, 45, 18],
  [47, 7, 30, 12],
]
const HALLS = [
  [-58, 58, 9, 0], // la muralla que lo une todo
  [-54, -27, 22, 8],
  [-25, 14, 33, 11],
  [10, 55, 24, 0],
]
const CLIFF = 30

export function createHogwarts() {
  const t0 = performance.now()
  let W = 0
  let H = 0
  let DPR = 1
  let still = null
  let windows = []
  let stars = []
  let starSprite = null
  let winSprite = null
  let glow = null
  let WL = 0 // la orilla del lago
  let owl = null
  let nextOwl = 9 // la primera, cuando ya se lee la ficha
  let size = null
  let pending = null

  function build() {
    ;[W, H, DPR] = size
    const r = rng(1997)
    const portrait = W < H * 0.9
    WL = H * (portrait ? 0.62 : 0.7)
    const S = portrait ? Math.min(W * 0.62, H * 0.32) : Math.min(H * 0.4, W * 0.31)
    const u = S / 100
    const CX = W * (portrait ? 0.62 : 0.26)
    const base = WL - CLIFF * u
    const [mx, my] = portrait ? [W * 0.2, H * 0.1] : [W * 0.82, H * 0.16]
    const R = Math.max(14, S * 0.075)
    const L = mx > CX ? 1 : -1 // de qué lado da la luna

    still = makeCanvas(W * DPR, H * DPR)
    const g = still.getContext('2d')
    g.scale(DPR, DPR)

    // cielo: azul de noche que se aclara hacia el horizonte, con manchas de
    // pincel como el gouache de la portada
    const sky = g.createLinearGradient(0, 0, 0, WL)
    sky.addColorStop(0, '#08182a')
    sky.addColorStop(0.45, '#15374b')
    sky.addColorStop(1, '#2f6571')
    g.fillStyle = sky
    g.fillRect(0, 0, W, WL)
    for (let i = 0; i < 26; i++) {
      const x = r() * W
      const y = r() * WL
      const rad = (0.08 + r() * 0.16) * Math.max(W, H)
      const blot = g.createRadialGradient(x, y, 0, x, y, rad)
      const c = r() < 0.5 ? '120, 180, 190' : '4, 14, 26'
      blot.addColorStop(0, `rgba(${c}, ${0.05 + r() * 0.06})`)
      blot.addColorStop(1, `rgba(${c}, 0)`)
      g.fillStyle = blot
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2)
    }

    // estrellas: puntos de pintura blanca, alguno más gordo con halo; las del
    // cielo despejado (no las que tapan el castillo o los montes) se dibujan en
    // cada fotograma para que parpadeen
    stars = []
    const count = (W * WL) / 1700
    for (let i = 0; i < count; i++) {
      const x = r() * W
      const y = Math.pow(r(), 1.3) * WL
      if (Math.hypot(x - mx, y - my) < R * 3) continue
      const s = 0.4 + Math.pow(r(), 3) * 1.8
      const a = 0.45 + r() * 0.55
      if (y < WL - H * 0.28 && !(Math.abs(x - CX) < 85 * u && y > base - 118 * u)) {
        stars.push({ x, y, d: s * 7, a, sp: 0.8 + r() * 1.8, ph: r() * TAU })
        continue
      }
      g.globalAlpha = a
      if (s > 1.3) {
        const halo = g.createRadialGradient(x, y, 0, x, y, s * 4)
        halo.addColorStop(0, 'rgba(255, 250, 230, 0.5)')
        halo.addColorStop(1, 'rgba(255, 250, 230, 0)')
        g.fillStyle = halo
        g.fillRect(x - s * 4, y - s * 4, s * 8, s * 8)
      }
      g.fillStyle = '#fffbe8'
      g.beginPath()
      g.arc(x, y, s, 0, TAU)
      g.fill()
    }
    g.globalAlpha = 1

    // la luna creciente con su disco de luz
    let halo = g.createRadialGradient(mx, my, R * 0.8, mx, my, R * 6)
    halo.addColorStop(0, 'rgba(240, 246, 220, 0.3)')
    halo.addColorStop(1, 'rgba(240, 246, 220, 0)')
    g.fillStyle = halo
    g.fillRect(mx - R * 6, my - R * 6, R * 12, R * 12)
    g.fillStyle = 'rgba(225, 238, 225, 0.12)'
    g.beginPath()
    g.arc(mx, my, R * 2, 0, TAU)
    g.fill()
    const moon = makeCanvas(R * 2.4 * DPR, R * 2.4 * DPR)
    const mg = moon.getContext('2d')
    mg.scale(DPR, DPR)
    mg.fillStyle = '#fff8dc'
    mg.beginPath()
    mg.arc(R * 1.2, R * 1.2, R, 0, TAU)
    mg.fill()
    mg.globalCompositeOperation = 'destination-out'
    mg.beginPath()
    mg.arc(R * 1.2 + R * 0.5 * L, R * 1.05, R * 0.9, 0, TAU)
    mg.fill()
    g.drawImage(moon, mx - R * 1.2, my - R * 1.2, R * 2.4, R * 2.4)

    // montañas lejanas, azuladas
    for (const [top, col, f] of [
      [0.13, '#1d4653', 1.7],
      [0.07, '#143440', 3.1],
    ]) {
      const ph = r() * TAU
      g.fillStyle = col
      g.beginPath()
      g.moveTo(0, WL)
      for (let x = 0; x <= W + 8; x += 8) {
        const k = x / W
        const y = WL - H * top * (0.45 + 0.3 * Math.sin(k * f * TAU + ph) + 0.18 * Math.sin(k * f * 2.9 * TAU + ph * 2))
        g.lineTo(x, y)
      }
      g.lineTo(W, WL)
      g.fill()
    }

    // la ladera de pinos, al otro lado del lago
    const hx0 = W * (L > 0 ? 0.58 : 0.42)
    const hx1 = L > 0 ? W + 10 : -10
    const ridge = (x) => {
      const k = Math.min(1, Math.max(0, (x - hx0) / (hx1 - hx0)))
      return WL - H * 0.22 * k * k * (3 - 2 * k) - H * 0.012 * Math.sin(k * 9 + 1)
    }
    const hill = g.createLinearGradient(0, WL - H * 0.24, 0, WL)
    hill.addColorStop(0, '#173a2c')
    hill.addColorStop(1, '#0b1c16')
    g.fillStyle = hill
    g.beginPath()
    g.moveTo(hx0, WL)
    for (let i = 0; i <= 60; i++) {
      const x = hx0 + ((hx1 - hx0) * i) / 60
      g.lineTo(x, ridge(x))
    }
    g.lineTo(hx1, WL)
    g.fill()
    const pines = Math.abs(hx1 - hx0) / 3
    for (let i = 0; i < pines; i++) {
      const x = hx0 + (hx1 - hx0) * r()
      const top = ridge(x)
      const y = top + Math.pow(r(), 2) * (WL - top)
      const h = (0.012 + r() * 0.02) * H * (1 - (0.6 * (y - top)) / Math.max(1, WL - top))
      const w = h * 0.36
      const lit = r() < 0.5
      g.fillStyle = lit ? '#2a5644' : '#102a20'
      g.beginPath()
      g.moveTo(x - w, y + h * 0.15)
      g.lineTo(x, y - h)
      g.lineTo(x + w, y + h * 0.15)
      g.fill()
    }

    // ---------- el castillo, en unidades de su altura ----------
    g.save()
    g.translate(CX, base)
    g.scale(u, u)
    const side = (x0, x1, [dark, mid, lit]) => {
      const gr = g.createLinearGradient(L > 0 ? x0 : x1, 0, L > 0 ? x1 : x0, 0)
      gr.addColorStop(0, dark)
      gr.addColorStop(0.55, mid)
      gr.addColorStop(0.85, lit)
      gr.addColorStop(1, mid)
      return gr
    }
    const merlons = (x0, x1, y) => {
      for (let x = x0; x < x1 - 1; x += 3.2) g.fillRect(x, y - 2, 1.8, 2.2)
    }

    // la roca: un peñasco irregular, con facetas claras del lado de la luna
    const rock = new Path2D()
    rock.moveTo(-60, 1)
    for (const [x, y] of [[-65, 7], [-62, 13], [-71, 19], [-69, 25], [-82, CLIFF + 0.5], [78, CLIFF + 0.5], [71, 24], [66, 17], [68, 10], [61, 4], [58, 1]]) {
      rock.lineTo(x + (r() - 0.5) * 3, y)
    }
    rock.closePath()
    const rk = g.createLinearGradient(0, 0, 0, CLIFF)
    rk.addColorStop(0, '#36413b')
    rk.addColorStop(1, '#121a17')
    g.fillStyle = rk
    g.fill(rock)
    g.save()
    g.clip(rock)
    for (let i = 0; i < 30; i++) {
      const x = -78 + r() * 152
      const y = r() * CLIFF
      const s = 6 + r() * 12
      const [c, a] = x * L > 0 ? ['130, 150, 128', 0.1 + r() * 0.12] : ['4, 10, 8', 0.2 + r() * 0.2]
      const blot = g.createRadialGradient(x, y, 0, x, y, s)
      blot.addColorStop(0, `rgba(${c}, ${a})`)
      blot.addColorStop(1, `rgba(${c}, 0)`)
      g.fillStyle = blot
      g.fillRect(x - s, y - s, s * 2, s * 2)
    }
    g.restore()

    // las naves, detrás de las torres
    const unit = (x, y) => [CX + x * u, base + y * u]
    windows = []
    const hidden = (x) => TOWERS.some(([tx, tw]) => Math.abs(x - tx) < tw / 2 + 1.2)
    for (const [x0, x1, h, roof] of HALLS) {
      g.fillStyle = side(x0, x1, STONE)
      g.fillRect(x0, -h, x1 - x0, h + 1)
      if (roof) {
        const rf = g.createLinearGradient(0, -h - roof, 0, -h)
        rf.addColorStop(0, ROOF[2])
        rf.addColorStop(1, ROOF[0])
        g.fillStyle = rf
        g.beginPath()
        g.moveTo(x0 - 1, -h + 0.3)
        g.lineTo(x0 + roof * 0.7, -h - roof)
        g.lineTo(x1 - roof * 0.7, -h - roof)
        g.lineTo(x1 + 1, -h + 0.3)
        g.fill()
      } else {
        g.fillStyle = STONE[1]
        merlons(x0, x1, -h)
      }
      // (la muralla, sin ventanas: queda casi toda tapada por las naves)
      for (let y = -h + 5; h > 10 && y < -3; y += 8) {
        for (let x = x0 + 2.5; x < x1 - 2; x += 4.2) {
          if (hidden(x)) continue
          if (r() < 0.5) windows.push(unit(x - 0.8, y))
          else {
            g.fillStyle = '#1b2721'
            g.fillRect(x - 0.8, y, 1.6, 2.6)
          }
        }
      }
    }

    // las torres: cilindros de piedra con tejados cónicos
    for (const [x, w, h, roof] of TOWERS) {
      g.fillStyle = side(x - w / 2, x + w / 2, STONE)
      g.fillRect(x - w / 2, -h, w, h + 1)
      if (roof) {
        const o = w * 0.16
        g.fillStyle = side(x - w / 2 - o, x + w / 2 + o, ROOF)
        g.beginPath()
        g.moveTo(x - w / 2 - o, -h + 0.6)
        g.lineTo(x, -h - roof)
        g.lineTo(x + w / 2 + o, -h + 0.6)
        g.fill()
        g.fillStyle = 'rgba(20, 10, 8, 0.35)'
        g.fillRect(x - w / 2, -h + 0.6, w, 1)
      } else {
        g.fillStyle = side(x - w / 2, x + w / 2, STONE)
        merlons(x - w / 2, x + w / 2, -h)
      }
      const cols = w > 10 ? [-w / 4, w / 4] : [0]
      for (let y = -h + 4; y < -4; y += 7) {
        for (const c of cols) {
          if (r() < 0.62) windows.push(unit(x + c - 0.8, y))
          else {
            g.fillStyle = '#1b2721'
            g.fillRect(x + c - 0.8, y, 1.6, 2.6)
          }
        }
      }
    }
    g.restore()

    // textura de pincel sobre lo que hay encima del agua
    const grain = makeCanvas(160, 160)
    const gg = grain.getContext('2d')
    const img = gg.createImageData(160, 160)
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 100 + r() * 60
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v
      img.data[i + 3] = 255
    }
    gg.putImageData(img, 0, 0)
    g.globalCompositeOperation = 'overlay'
    g.globalAlpha = 0.1
    g.fillStyle = g.createPattern(grain, 'repeat')
    g.fillRect(0, 0, W, H)
    g.globalCompositeOperation = 'source-over'
    g.globalAlpha = 1

    // ---------- el lago ----------
    const lake = g.createLinearGradient(0, WL, 0, H)
    lake.addColorStop(0, '#1d4a52')
    lake.addColorStop(1, '#06171b')
    g.fillStyle = lake
    g.fillRect(0, WL, W, H - WL)
    // el reflejo: lo de arriba, al revés, en franjas que el agua desplaza
    g.save()
    g.setTransform(DPR, 0, 0, -DPR, 0, 2 * WL * DPR)
    g.globalAlpha = 0.5
    const band = 3
    for (let sy = WL - band; sy > 2 * WL - H - band; sy -= band) {
      const depth = (WL - sy) / (H - WL)
      const dx = (r() - 0.5) * (1 + depth * 9)
      g.drawImage(still, 0, sy * DPR, W * DPR, band * DPR, dx, sy, W, band)
    }
    g.restore()
    const deep = g.createLinearGradient(0, WL, 0, H)
    deep.addColorStop(0, 'rgba(8, 26, 32, 0.1)')
    deep.addColorStop(1, 'rgba(4, 14, 18, 0.8)')
    g.fillStyle = deep
    g.fillRect(0, WL, W, H - WL)
    // brillos del agua: más bajo la luna
    for (let i = 0; i < 70; i++) {
      const nearMoon = r() < 0.4
      const x = nearMoon ? mx + (r() - 0.5) * R * 4 : r() * W
      const y = WL + 2 + Math.pow(r(), 1.6) * (H - WL) * 0.8
      const len = (4 + r() * 22) * (nearMoon ? 1.4 : 1)
      g.strokeStyle = `rgba(214, 236, 226, ${nearMoon ? 0.4 : 0.14 + r() * 0.12})`
      g.lineWidth = 1
      g.beginPath()
      g.moveTo(x - len / 2, y)
      g.lineTo(x + len / 2, y)
      g.stroke()
    }

    // ventanas: un arco amarillo y su halo, pre-renderizados
    const ww = Math.max(1.6, 1.6 * u)
    const wh = Math.max(2.6, 2.6 * u)
    winSprite = makeCanvas(ww * DPR, wh * DPR)
    const wg = winSprite.getContext('2d')
    wg.scale(DPR, DPR)
    const wf = wg.createLinearGradient(0, 0, 0, wh)
    wf.addColorStop(0, '#fff3b4')
    wf.addColorStop(1, '#ffbf3a')
    wg.fillStyle = wf
    wg.beginPath()
    wg.moveTo(0, wh)
    wg.lineTo(0, ww / 2)
    wg.arc(ww / 2, ww / 2, ww / 2, Math.PI, 0)
    wg.lineTo(ww, wh)
    wg.fill()
    glow = makeCanvas(64, 64)
    const gl = glow.getContext('2d')
    const gr = gl.createRadialGradient(32, 32, 0, 32, 32, 32)
    gr.addColorStop(0, 'rgba(255, 210, 90, 0.8)')
    gr.addColorStop(1, 'rgba(255, 210, 90, 0)')
    gl.fillStyle = gr
    gl.fillRect(0, 0, 64, 64)
    starSprite = makeCanvas(32, 32)
    const sg = starSprite.getContext('2d')
    const sr = sg.createRadialGradient(16, 16, 0, 16, 16, 16)
    sr.addColorStop(0, 'rgba(255, 251, 232, 1)')
    sr.addColorStop(0.2, 'rgba(255, 251, 232, 0.95)')
    sr.addColorStop(0.32, 'rgba(255, 250, 230, 0.3)')
    sr.addColorStop(1, 'rgba(255, 250, 230, 0)')
    sg.fillStyle = sr
    sg.fillRect(0, 0, 32, 32)
    windows = windows.map(([x, y]) => ({ x, y, w: ww, h: wh, sp: 0.6 + r() * 1.8, ph: r() * TAU }))
  }

  function drawOwl(ctx, ts, a) {
    const p = (ts - a.start) / a.dur
    if (p >= 1) {
      owl = null
      return
    }
    const s = a.s
    const x = a.dir > 0 ? -3 * s + p * (W + 6 * s) : W + 3 * s - p * (W + 6 * s)
    const y = a.y + Math.sin(p * TAU * 0.7) * H * 0.025
    // aletea un rato y planea otro
    const cyc = (ts - a.start) % 2.6
    const th = cyc < 1.6 ? 0.2 + 0.95 * Math.sin((cyc / 0.5) * TAU) : 0.2
    const lift = Math.sin(th)
    ctx.save()
    ctx.translate(x, y - lift * s * 0.06)
    ctx.scale(a.dir, 1)

    // un ala de lechuza: ancha y redonda, con las plumas del borde
    const wing = (tipY, back, col) => {
      const ax = 0.2 * s
      const ay = -0.1 * s
      const bx = -0.22 * s
      const by = -0.06 * s
      const tx = -back * s
      ctx.fillStyle = col
      ctx.beginPath()
      ctx.moveTo(ax, ay)
      ctx.quadraticCurveTo(ax + 0.12 * s, (ay + tipY) / 2, tx, tipY)
      for (let i = 1; i <= 4; i++) {
        const f = i / 4
        const px = tx + (bx - tx) * f
        const py = tipY + (by - tipY) * f
        ctx.quadraticCurveTo(px - 0.1 * s, py - (by - tipY) * 0.06, px, py)
      }
      ctx.closePath()
      ctx.fill()
    }
    wing(-0.1 * s - lift * 0.85 * s - Math.cos(th) * 0.3 * s, 0.12, '#a39d8a')

    // la carta, colgando de las patas
    ctx.save()
    ctx.translate(0.04 * s, 0.2 * s)
    ctx.rotate(Math.sin(ts * 3.1) * 0.12)
    ctx.strokeStyle = '#4a4236'
    ctx.lineWidth = Math.max(1, s * 0.03)
    ctx.beginPath()
    ctx.moveTo(-0.04 * s, -0.04 * s)
    ctx.lineTo(-0.04 * s, 0.09 * s)
    ctx.moveTo(0.05 * s, -0.04 * s)
    ctx.lineTo(0.05 * s, 0.09 * s)
    ctx.stroke()
    ctx.fillStyle = '#efe0b4'
    ctx.fillRect(-0.18 * s, 0.08 * s, 0.36 * s, 0.24 * s)
    ctx.fillStyle = '#6b2f78'
    ctx.beginPath()
    ctx.arc(0, 0.2 * s, 0.035 * s + 0.4, 0, TAU)
    ctx.fill()
    ctx.restore()

    // cola, cuerpo y cabeza, claros con la luz de la luna
    ctx.fillStyle = '#b9b29d'
    ctx.beginPath()
    ctx.moveTo(-0.3 * s, -0.05 * s)
    ctx.lineTo(-0.6 * s, -0.04 * s)
    ctx.lineTo(-0.56 * s, 0.09 * s)
    ctx.lineTo(-0.28 * s, 0.07 * s)
    ctx.fill()
    const body = ctx.createLinearGradient(0, -0.2 * s, 0, 0.2 * s)
    body.addColorStop(0, '#f1ecdc')
    body.addColorStop(1, '#a8a18d')
    ctx.fillStyle = body
    ctx.beginPath()
    ctx.ellipse(0, 0, 0.38 * s, 0.19 * s, -0.08, 0, TAU)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(0.34 * s, -0.1 * s, 0.16 * s, 0, TAU)
    ctx.fill()
    ctx.fillStyle = 'rgba(255, 252, 240, 0.7)'
    ctx.beginPath()
    ctx.arc(0.38 * s, -0.09 * s, 0.1 * s, 0, TAU)
    ctx.fill()
    ctx.fillStyle = '#2a2116'
    ctx.beginPath()
    ctx.arc(0.42 * s, -0.12 * s, 0.03 * s + 0.3, 0, TAU)
    ctx.fill()
    ctx.fillStyle = 'rgba(90, 84, 70, 0.55)'
    for (const [bx, by] of [
      [-0.12, -0.02],
      [0.02, 0.06],
      [-0.2, 0.08],
      [0.12, -0.04],
    ]) {
      ctx.fillRect(bx * s, by * s, 0.05 * s, 0.025 * s)
    }

    wing(-0.1 * s - lift * s + Math.cos(th) * 0.45 * s, 0.3, '#e6e0cc')
    ctx.restore()
  }

  return {
    // mientras se redimensiona se sigue dibujando lo de antes, y se repinta
    // cuando se deja de redimensionar
    resize(w, h, dpr) {
      size = [w, h, dpr]
      clearTimeout(pending)
      if (!still) build()
      else pending = setTimeout(build, 160)
    },

    draw(ctx, now) {
      if (!still) return
      const ts = (now - t0) / 1000
      const alpha = ctx.globalAlpha
      ctx.drawImage(still, 0, 0, W, H)

      // cada estrella parpadea a su ritmo, nunca del todo apagada
      for (const st of stars) {
        ctx.globalAlpha = alpha * st.a * (0.6 + 0.4 * Math.sin(ts * st.sp + st.ph) * Math.sin(ts * st.sp * 0.63 + st.ph * 2))
        ctx.drawImage(starSprite, st.x - st.d / 2, st.y - st.d / 2, st.d, st.d)
      }

      // las ventanas parpadean un poco, como velas, y tiemblan en el agua
      const gs = winSprite.width / DPR
      ctx.globalCompositeOperation = 'lighter'
      for (const w of windows) {
        w.f = 0.78 + 0.22 * Math.sin(ts * w.sp + w.ph) * Math.sin(ts * w.sp * 1.7 + w.ph * 2)
        const k = gs * 7
        ctx.globalAlpha = alpha * 0.32 * w.f
        ctx.drawImage(glow, w.x + w.w / 2 - k / 2, w.y + w.h / 2 - k / 2, k, k)
        ctx.globalAlpha = alpha * 0.2 * w.f
        const ry = 2 * WL - w.y - w.h
        ctx.drawImage(glow, w.x + w.w / 2 - k / 2 + Math.sin(ts * 1.3 + w.ph) * w.w * 0.6, ry - k / 4, k, k * 1.5)
      }
      ctx.globalCompositeOperation = 'source-over'
      for (const w of windows) {
        ctx.globalAlpha = alpha * w.f
        ctx.drawImage(winSprite, w.x, w.y, w.w, w.h)
      }
      ctx.globalAlpha = alpha

      if (!owl && ts > nextOwl) {
        const r = Math.random
        owl = {
          start: ts,
          dur: 8 + r() * 3,
          dir: r() < 0.5 ? 1 : -1,
          y: H * (0.12 + r() * 0.24),
          s: Math.max(16, Math.min(38, Math.min(W, H) * 0.04)),
        }
        nextOwl = ts + owl.dur + 6 + r() * 10
      }
      if (owl) drawOwl(ctx, ts, owl)
    },

    dispose() {
      clearTimeout(pending)
    },
  }
}
