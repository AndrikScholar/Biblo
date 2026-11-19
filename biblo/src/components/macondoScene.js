// Entrada de "Cien años de soledad" (9,6 s): la puerta de la portada se abre
// sola, salen mariposas amarillas y la cámara entra a Macondo, donde llueven
// florecitas amarillas.
//   0-1,8    la fachada de la portada (pared naranja, zócalo azul, puerta
//            roja entre dos faroles); la cámara se acerca despacio
//   1,75-3,1 las hojas se abren hacia dentro y sale la luz; en el compás 2
//            (2 s) estalla una nube de mariposas hacia la cámara
//   2,8-5    la cámara cruza la puerta: el hueco crece hasta llenar la
//            pantalla y detrás aparece la calle (con paralaje: está lejos)
//   3,6-7,2  avanza por la calle entre casas de colores y almendros, bajo la
//            lluvia de flores que va alfombrando el suelo; alguien barre
//   5,8-8,8  la cámara sube y mira el pueblo desde arriba; el título
// Todo va a compás de la música (macondoMusic.js), a 120 pulsos.
// Unidades virtuales: el alto de la pantalla mide 1000. La calle se mide en
// metros: x a los lados, y hacia arriba, z hacia el fondo.

import {
  PAL,
  TAU,
  rng,
  mix,
  cl,
  span,
  smooth,
  grainTexture,
  makeFacade,
  drawFacade,
  DOOR,
  butterfly,
  flapAt,
  flowerSprite,
  tint,
} from './macondoPaint'

export const BPM = 120
export const BEAT = 60 / BPM
export const BAR = BEAT * 4
export const T = {
  approach: [0, 1.8],
  open: [1.75, 3.1],
  burst: BAR, // el compás 2: la nube de mariposas
  push: [2.8, 5],
  dolly: [3.6, 7.2],
  rise: [5.8, 8.8],
  titleIn: 6.5,
  end: 9.6,
}

const easeIn = (x) => cl(x) ** 2.4
const W2 = 4.2 // media calle (m)
const F0 = 900 // focal de la calle, en unidades de pantalla

export function createMacondoScene(canvas) {
  const ctx = canvas.getContext('2d')
  let W = 1
  let H = 1
  let dpr = 1
  let V = 1
  let VW = 1000
  const S = {}

  function resize() {
    const r = canvas.getBoundingClientRect()
    W = Math.max(1, r.width)
    H = Math.max(1, r.height)
    dpr = Math.min(window.devicePixelRatio || 1, 1.5)
    canvas.width = Math.round(W * dpr)
    canvas.height = Math.round(H * dpr)
    V = H / 1000
    VW = W / V
    build()
  }

  function build() {
    const r = rng(1967)
    S.grain = grainTexture(Math.ceil(W * dpr), Math.ceil(H * dpr))
    S.facade = makeFacade(1967)
    S.flower = flowerSprite(32)
    S.groundFlower = flowerSprite(24, 9)
    S.tall = VW < 800
    // escala de la fachada: en móvil la puerta tiene que caber de ancho
    S.zw0 = S.tall ? Math.min(1, VW / 520) : 1

    // las casas de la calle, a los dos lados
    const colors = [PAL.orange, PAL.cream, '#f4d36a', '#7cc3d8', '#f2b3a0', PAL.cream, '#9fd17a', PAL.orange]
    S.houses = []
    for (const side of [-1, 1]) {
      let z = 2.5 + r() * 2
      let i = 0
      while (z < 70) {
        const len = 5 + r() * 4
        const h = 3.3 + r() * 1.6
        const wall = colors[Math.floor(r() * colors.length)]
        const doorZ = z + 0.8 + r() * (len - 2.6)
        const wins = []
        for (let k = 0; k < 2; k++) {
          const wz = z + 0.6 + r() * (len - 1.8)
          if (Math.abs(wz - doorZ) > 1.3) wins.push(wz)
        }
        S.houses.push({
          side,
          z0: z,
          z1: z + len,
          h,
          depth: 7,
          wall,
          zocalo: r() < 0.6 ? PAL.blue : PAL.red,
          door: [PAL.red, PAL.blue, '#2e7d5b', PAL.redDeep][Math.floor(r() * 4)],
          doorZ,
          wins,
          id: i++,
        })
        // entre algunas casas, un almendro
        if (r() < 0.55) S.houses.push({ tree: true, side, z: z + len + 0.6, s: 0.9 + r() * 0.4, id: i++ })
        z += len + (r() < 0.55 ? 1.2 : 0.1)
      }
    }
    // árboles en los patios de atrás: desde arriba, el pueblo entre manchas verdes
    for (const side of [-1, 1]) {
      for (let z = 2; z < 72; z += 4 + r() * 6) {
        S.houses.push({ tree: true, side, z, s: 1 + r() * 0.6, x: side * (W2 + 7.5 + r() * 9), id: -1 })
      }
    }
    S.houses.sort((a, b) => (b.z ?? b.z0) - (a.z ?? a.z0))

    // flores que caen (en la calle) y flores ya en el suelo
    S.falling = Array.from({ length: S.tall ? 420 : 640 }, () => ({
      x: (r() - 0.5) * 22,
      y: r() * 10,
      z: 1 + r() * 45,
      v: 0.55 + r() * 0.6,
      ph: r() * TAU,
      s: 0.06 + r() * 0.05,
    }))
    S.ground = Array.from({ length: 900 }, () => ({
      x: (r() - 0.5) * (W2 * 2 - 0.4),
      z: r() * 60,
      k: r(), // cuándo aparece (cuanto más alfombrado, más flores)
      s: 0.07 + r() * 0.06,
    }))

    // la nube de mariposas que sale por la puerta
    S.burst = Array.from({ length: S.tall ? 26 : 38 }, () => ({
      t0: T.burst - 0.15 + r() * 0.9,
      ox: (r() - 0.5) * 0.8,
      oy: r(),
      a: -Math.PI / 2 + (r() - 0.5) * 2.6,
      v: 160 + r() * 260,
      s0: 0.6 + r() * 0.5,
      grow: 1.3 + r() * 1.6,
      ph: r() * TAU,
      curl: (r() - 0.5) * 2.4,
      sp: 10 + r() * 6,
    }))
    // y las que vuelan por la calle y alrededor del título
    S.street = Array.from({ length: 10 }, () => ({
      x: (r() - 0.5) * 6,
      y: 1.4 + r() * 2.6,
      z: 6 + r() * 20,
      ph: r() * TAU,
      sp: 9 + r() * 5,
      w: 0.5 + r() * 0.7,
    }))
  }

  // ---------- la cámara ----------

  function cam(t) {
    const push = easeIn(span(t, T.push))
    const zw = S.zw0 * (1 + 0.06 * smooth(span(t, T.approach))) * Math.pow(18, push)
    const doorY = mix(560, 500, smooth(span(t, T.push)))
    const rise = smooth(span(t, T.rise))
    return {
      zw,
      doorY,
      camZ: 7.5 * smooth(span(t, T.dolly)) + 1.2 * push,
      camY: mix(1.6, 12.5, rise),
      hy: mix(doorY - 60, 470, smooth(span(t, [2.8, 4.6]))) - 205 * rise,
      rise,
    }
  }

  // ---------- la calle de Macondo ----------

  function drawStreet(g, t, C) {
    const vx = VW / 2
    const proj = (x, y, z) => {
      const d = z - C.camZ
      return [vx + (x * F0) / d, C.hy + ((C.camY - y) * F0) / d, d]
    }
    const quad = (pts, fill) => {
      const P = pts.map(([x, y, z]) => proj(x, y, Math.max(z, C.camZ + 0.25)))
      g.fillStyle = fill
      g.beginPath()
      P.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)))
      g.closePath()
      g.fill()
    }
    // cielo de tarde caliente, con el sol detrás del pueblo
    const sky = g.createLinearGradient(0, C.hy - 900, 0, C.hy)
    sky.addColorStop(0, '#f39a3a')
    sky.addColorStop(0.6, '#fbc46e')
    sky.addColorStop(1, '#ffe9b4')
    g.fillStyle = sky
    g.fillRect(-10, -10, VW + 20, 1020)
    const sun = proj(-3, 26, 90)
    const glow = g.createRadialGradient(sun[0], sun[1], 4, sun[0], sun[1], 260)
    glow.addColorStop(0, 'rgba(255, 250, 220, 0.95)')
    glow.addColorStop(0.15, 'rgba(255, 240, 190, 0.6)')
    glow.addColorStop(1, 'rgba(255, 230, 170, 0)')
    g.fillStyle = glow
    g.fillRect(sun[0] - 260, sun[1] - 260, 520, 520)
    // la sierra, lejos
    g.fillStyle = tint('#6f9e8e', '#ffe2a8', 0.35)
    g.beginPath()
    g.moveTo(-10, C.hy + 4)
    for (let x = -10; x <= VW + 20; x += 30) g.lineTo(x, C.hy - 46 - 30 * Math.sin(x * 0.006 + 1) - 14 * Math.sin(x * 0.021))
    g.lineTo(VW + 20, C.hy + 4)
    g.closePath()
    g.fill()
    // la iglesia al fondo de la calle
    const cz = 74
    quad([[-3.5, 0, cz], [3.5, 0, cz], [3.5, 7, cz], [-3.5, 7, cz]], PAL.cream)
    quad([[-3.8, 7, cz], [3.8, 7, cz], [0, 9.5, cz]], tint(PAL.cream, '#c4572b', 0.2))
    quad([[3.6, 0, cz], [6.2, 0, cz], [6.2, 13, cz], [3.6, 13, cz]], '#f1e3c4')
    quad([[3.4, 13, cz], [6.4, 13, cz], [4.9, 15.6, cz]], '#c4572b')
    quad([[-0.9, 0, cz], [0.9, 0, cz], [0.9, 3.2, cz], [-0.9, 3.2, cz]], PAL.redDeep)

    // el llano alrededor del pueblo (solo se ve al subir la cámara)
    const carpet = smooth(span(t, [2.4, 8.4]))
    quad([[-300, 0, C.camZ + 0.3], [300, 0, C.camZ + 0.3], [300, 0, 600], [-300, 0, 600]], tint('#b7a35a', PAL.yellow, carpet * 0.45))
    // la calle: tierra que se va cubriendo de flores
    quad([[-W2, 0, C.camZ + 0.3], [W2, 0, C.camZ + 0.3], [W2, 0, 80], [-W2, 0, 80]], tint('#d7b088', PAL.yellow, carpet * 0.85))
    for (const f of S.ground) {
      if (f.k > carpet * 1.2) continue
      const d = f.z - C.camZ
      if (d < 0.6) continue
      const [x, y] = proj(f.x, 0, f.z)
      const s = (f.s * F0) / d
      if (s < 0.6) continue
      g.globalAlpha = cl((carpet * 1.2 - f.k) * 4)
      g.drawImage(S.groundFlower, x - s, y - s * 0.45, s * 2, s * 0.9)
    }
    g.globalAlpha = 1

    // casas y almendros, de lejos a cerca
    for (const h of S.houses) {
      if (h.tree) {
        const d = h.z - C.camZ
        if (d < 0.6) continue
        const X = h.x ?? h.side * (W2 - 0.5)
        const [tx, ty] = proj(X, 0, h.z)
        const k = F0 / d
        g.fillStyle = '#4a2f1a'
        g.fillRect(tx - 0.12 * k, ty - 2.4 * h.s * k, 0.24 * k, 2.4 * h.s * k)
        g.fillStyle = '#4f7a2a'
        g.beginPath()
        g.ellipse(tx, ty - 3.1 * h.s * k, 1.5 * h.s * k, 1.0 * h.s * k, 0, 0, TAU)
        g.fill()
        g.fillStyle = 'rgba(255, 210, 58, 0.55)'
        g.beginPath()
        g.ellipse(tx - 0.3 * h.s * k, ty - 3.4 * h.s * k, 0.9 * h.s * k, 0.5 * h.s * k, 0, 0, TAU)
        g.fill()
        continue
      }
      if (h.z1 - C.camZ < 0.3) continue
      const X = h.side * W2
      const XB = h.side * (W2 + h.depth)
      const z0 = Math.max(h.z0, C.camZ + 0.3)
      // cara que da hacia la cámara (más oscura) y la fachada que da a la calle
      if (h.z0 > C.camZ + 0.3) quad([[X, 0, h.z0], [XB, 0, h.z0], [XB, h.h, h.z0], [X, h.h, h.z0]], tint(h.wall, '#5a2a10', 0.28))
      quad([[X, 0, z0], [X, 0, h.z1], [X, h.h, h.z1], [X, h.h, z0]], h.wall)
      quad([[X, 0, z0], [X, 0, h.z1], [X, 0.9, h.z1], [X, 0.9, z0]], h.zocalo)
      // puerta y ventanas con postigos
      if (h.doorZ > C.camZ + 0.4) {
        quad([[X, 0, h.doorZ], [X, 0, h.doorZ + 1], [X, 2.2, h.doorZ + 1], [X, 2.2, h.doorZ]], h.door)
        quad([[X, 2.2, h.doorZ - 0.12], [X, 2.2, h.doorZ + 1.12], [X, 2.45, h.doorZ + 1.12], [X, 2.45, h.doorZ - 0.12]], PAL.sky)
      }
      for (const wz of h.wins) {
        if (wz < C.camZ + 0.4) continue
        quad([[X, 1.1, wz], [X, 1.1, wz + 0.8], [X, 2.1, wz + 0.8], [X, 2.1, wz]], PAL.blueDeep)
        quad([[X, 1.15, wz + 0.05], [X, 1.15, wz + 0.38], [X, 2.05, wz + 0.38], [X, 2.05, wz + 0.05]], PAL.sky)
      }
      // alero de teja y, si se ve desde arriba, el tejado
      quad([[X, h.h, z0], [X, h.h, h.z1], [X - h.side * 0.45, h.h + 0.3, h.z1], [X - h.side * 0.45, h.h + 0.3, z0]], '#b9502a')
      if (C.camY > h.h) {
        const roof = tint('#c4572b', PAL.yellow, carpet * 0.55)
        quad([[X - h.side * 0.45, h.h + 0.3, z0], [X - h.side * 0.45, h.h + 0.3, h.z1], [XB, h.h + 0.6, h.z1], [XB, h.h + 0.6, z0]], roof)
        // hileras de teja
        g.strokeStyle = 'rgba(120, 40, 10, 0.35)'
        g.lineWidth = 1.2
        for (let k = 1; k < 5; k++) {
          const xx = mix(X - h.side * 0.45, XB, k / 5)
          const yy = mix(h.h + 0.3, h.h + 0.6, k / 5)
          const a = proj(xx, yy, z0)
          const b = proj(xx, yy, h.z1)
          g.beginPath()
          g.moveTo(a[0], a[1])
          g.lineTo(b[0], b[1])
          g.stroke()
        }
        // fachada trasera, que se ve un poco desde arriba
        quad([[XB, 0, z0], [XB, 0, h.z1], [XB, h.h + 0.6, h.z1], [XB, h.h + 0.6, z0]], tint(h.wall, '#5a2a10', 0.18))
      }
    }

    // alguien barre las flores, de espaldas
    const bz = 15.5
    const bd = bz - C.camZ
    if (bd > 0.8) {
      const [bx, by] = proj(-1.3, 0, bz)
      const k = F0 / bd
      const sweep = Math.sin(t * 5.2) * 0.25
      g.save()
      g.translate(bx, by)
      g.scale(k, k)
      g.strokeStyle = '#5a3a1e'
      g.lineWidth = 0.05
      g.beginPath()
      g.moveTo(0.2, -1.0)
      g.lineTo(0.55 + sweep, 0)
      g.stroke()
      g.fillStyle = '#c99a3a'
      g.fillRect(0.4 + sweep, -0.06, 0.32, 0.08)
      g.fillStyle = PAL.blueDeep
      g.beginPath()
      g.moveTo(-0.24, -1.25)
      g.lineTo(0.24, -1.25)
      g.lineTo(0.34, 0)
      g.lineTo(-0.34, 0)
      g.closePath()
      g.fill()
      g.fillStyle = '#3a2416'
      g.beginPath()
      g.ellipse(0, -1.42, 0.13, 0.15, 0, 0, TAU)
      g.fill()
      g.fillStyle = PAL.red
      g.fillRect(-0.15, -1.56, 0.3, 0.1)
      g.restore()
    }

    // flores cayendo
    for (const f of S.falling) {
      let z = f.z
      // la calle se mueve: las que quedan atrás reaparecen al fondo
      while (z - C.camZ < 0.8) z += 45
      const y = 10 - ((t * f.v + f.y) % 10)
      const x = f.x + Math.sin(t * 1.4 + f.ph) * 0.3
      const [px, py, d] = proj(x, y, z)
      const s = (f.s * F0) / d
      if (s < 0.5 || px < -40 || px > VW + 40) continue
      g.save()
      g.translate(px, py)
      g.rotate(t * 1.5 + f.ph)
      g.drawImage(S.flower, -s, -s, s * 2, s * 2)
      g.restore()
    }

    // mariposas sueltas por la calle
    for (const b of S.street) {
      const z = b.z + Math.sin(t * 0.4 + b.ph) * 1.5
      const d = z - C.camZ
      if (d < 3) continue // demasiado cerca: se deformaría
      const x = b.x + Math.sin(t * b.w + b.ph) * 1.2
      const y = b.y + Math.sin(t * 1.7 + b.ph) * 0.3
      const [px, py] = proj(x, y, z)
      butterfly(g, px, py, (0.09 * F0) / d / 10, Math.cos(t * b.w + b.ph) * 0.6 + Math.PI / 2, flapAt(t, b.sp, b.ph))
    }
  }

  // ---------- un fotograma ----------

  function frame(t) {
    const C = cam(t)
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    const sc = V * dpr
    ctx.setTransform(sc, 0, 0, sc, 0, 0)
    const open = smooth(span(t, T.open))
    const doorCX = VW / 2
    // la pared deja de pintarse cuando el hueco de la puerta ya tapa la pantalla
    const showWall = C.zw * (DOOR.w / 2) < VW / 2 + 20

    if (!showWall || open > 0.001) drawStreet(ctx, t, C)
    if (showWall) {
      ctx.save()
      ctx.translate(doorCX, C.doorY)
      ctx.scale(C.zw, C.zw)
      ctx.translate(0, -(DOOR.top + DOOR.h / 2))
      // recorta el hueco para que se vea la calle detrás
      ctx.save()
      const hole = new Path2D()
      hole.rect(-3000, -3000, 6000, 6000)
      if (open > 0.001) hole.rect(-DOOR.w / 2, DOOR.top, DOOR.w, DOOR.h)
      ctx.clip(hole, 'evenodd')
      drawFacade(ctx, S.facade, { open: 0, halfW: 3000, lit: 1 })
      ctx.restore()
      // las hojas abiertas (por dentro del hueco) y la luz que sale
      if (open > 0.001) {
        ctx.save()
        ctx.beginPath()
        ctx.rect(-DOOR.w / 2, DOOR.top, DOOR.w, DOOR.h)
        ctx.clip()
        drawLeaves(ctx, open)
        ctx.restore()
        const spill = ctx.createRadialGradient(0, DOOR.top + DOOR.h, 10, 0, DOOR.top + DOOR.h, 420)
        spill.addColorStop(0, `rgba(255, 236, 160, ${0.5 * open})`)
        spill.addColorStop(1, 'rgba(255, 236, 160, 0)')
        ctx.fillStyle = spill
        ctx.fillRect(-420, DOOR.top, 840, DOOR.h + 420)
      }
      ctx.restore()
    }

    // la nube de mariposas, hacia la cámara
    for (const b of S.burst) {
      const age = t - b.t0
      if (age < 0 || age > 3.4) continue
      const ox = doorCX + b.ox * DOOR.w * C.zw * 0.5
      const oy = C.doorY + (b.oy - 0.5) * DOOR.h * C.zw * 0.6
      const a = b.a + Math.sin(age * 2.2 + b.ph) * 0.5 + b.curl * age * 0.3
      const dist = b.v * age * (1 + age * 0.35)
      const x = ox + Math.cos(b.a) * dist + Math.sin(age * 3 + b.ph) * 30
      const y = oy + Math.sin(b.a) * dist + Math.cos(age * 2.4 + b.ph) * 22
      const s = b.s0 * (1 + age * b.grow)
      const fade = cl(age / 0.25) * cl((3.4 - age) / 0.6)
      butterfly(ctx, x, y, s, a + Math.PI / 2, flapAt(t, b.sp, b.ph), fade)
    }

    // grano de pintura sobre todo
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.globalAlpha = 0.5
    ctx.drawImage(S.grain, 0, 0)
    ctx.globalAlpha = 1
  }

  // las hojas de la puerta abriéndose hacia dentro, sin el resto de la fachada
  function drawLeaves(g, open) {
    const { w, h, top } = DOOR
    const bottom = top + h
    for (const k of [-1, 1]) {
      const hinge = k * (w / 2)
      const a = open * 1.45
      const vis = Math.cos(a)
      const lw = (w / 2) * vis
      const shrink = Math.sin(a) * 26
      const x1 = hinge - k * lw
      g.save()
      g.beginPath()
      g.moveTo(hinge, top)
      g.lineTo(x1, top + shrink)
      g.lineTo(x1, bottom - shrink * 0.6)
      g.lineTo(hinge, bottom)
      g.closePath()
      g.clip()
      g.fillStyle = PAL.red
      g.fillRect(Math.min(hinge, x1) - 2, top, Math.abs(lw) + 4, h)
      g.save()
      g.translate(hinge, top)
      g.scale(-k * vis, 1)
      g.fillStyle = PAL.sky
      for (let i = 0; i < 9; i++) g.fillRect(12, 22 + i * 15, w / 2 - 24, 9)
      g.fillStyle = PAL.redDeep
      g.fillRect(0, 160, w / 2, 10)
      for (let i = 0; i < 3; i++) {
        g.fillStyle = PAL.redDeep
        g.fillRect(14, 186 + i * 122, w / 2 - 28, 106)
        g.fillStyle = PAL.orange
        g.fillRect(22, 194 + i * 122, w / 2 - 44, 90)
      }
      g.restore()
      g.fillStyle = `rgba(60, 10, 0, ${open * 0.45})`
      g.fillRect(Math.min(hinge, x1) - 2, top, Math.abs(lw) + 4, h)
      g.restore()
    }
  }

  resize()
  return { frame, resize }
}
