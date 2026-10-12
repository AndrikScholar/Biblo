import { useEffect, useRef } from 'react'

// Barquito de papel de periódico (el de Georgie) que navega sin rumbo por la
// ficha de IT y deja estela: espuma detrás y ondas en V que se abren a los
// lados. Se ve desde arriba con una proyección oblicua: lo más alto (la vela)
// se desplaza un poco hacia arriba en pantalla, así se lee en 3D al girar.
// Al salir por un borde reaparece por el opuesto.

const TILT = 0.85
const unit = (v) => v.map((c) => c / Math.hypot(...v))
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const LIGHT = unit([-0.5, -0.6, 0.8]) // hacia la luz: arriba a la izquierda
const VIEW = unit([0, TILT, 1]) // hacia quien mira

// modelo de largo 1: x hacia la proa, y hacia un costado, z hacia arriba
const RIM_Z = 0.12
const RIM = [
  [0.5, 0],
  [0.28, 0.2],
  [-0.28, 0.2],
  [-0.5, 0],
  [-0.28, -0.2],
  [0.28, -0.2],
]
const HULL = RIM.map(([x, y]) => [x * 0.82, y * 0.7]) // línea de flotación (z = 0)
const SAIL_BASE = 0.27
const SAIL_H = 0.5

const RIPPLE_LIFE = 3.2
const FOAM_LIFE = 4.5
const WAKE = Math.asin(0.33) // apertura de la V, como la estela de un barco real (~19°)

const lerp2 = (p, q, f) => [p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f]

export default function PaperBoat() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const ph = Array.from({ length: 6 }, () => Math.random() * Math.PI * 2)
    const boat = { x: 0, y: 0, a: 0 }
    const foam = [] // { x, y, t, gap }
    const ripples = [] // { x, y, t, a, c }
    let W = 0
    let H = 0
    let L = 60
    let raf = null
    let last = null
    let time = 0
    let nextFoam = 0
    let nextRipple = 0
    let gap = true

    function resize() {
      W = window.innerWidth
      H = window.innerHeight
      canvas.width = W * dpr
      canvas.height = H * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      L = Math.max(48, Math.min(86, Math.min(W, H) * 0.085))
    }

    // entra por un borde al azar, apuntando hacia dentro
    function enter() {
      const r = 0.2 + Math.random() * 0.6
      const spots = [
        [-L, H * r, 0],
        [W + L, H * r, Math.PI],
        [W * r, -L, Math.PI / 2],
        [W * r, H + L, -Math.PI / 2],
      ]
      ;[boat.x, boat.y, boat.a] = spots[Math.floor(Math.random() * 4)]
      boat.a += (Math.random() - 0.5) * 0.8
    }

    function move(dt) {
      const t = time
      // rumbo errante: tres senos lentos con fases al azar
      boat.a +=
        (0.32 * Math.sin(t * 0.21 + ph[0]) + 0.22 * Math.sin(t * 0.53 + ph[1]) + 0.12 * Math.sin(t * 1.17 + ph[2])) * dt
      const v = L * 0.9 * (0.85 + 0.15 * Math.sin(t * 0.37 + ph[3]))
      boat.x += Math.cos(boat.a) * v * dt
      boat.y += Math.sin(boat.a) * v * dt
      // sale por un borde y vuelve por el opuesto; la estela no cruza la pantalla
      if (boat.x < -L || boat.x > W + L) {
        boat.x += boat.x < 0 ? W + 2 * L : -(W + 2 * L)
        gap = true
      }
      if (boat.y < -L || boat.y > H + L) {
        boat.y += boat.y < 0 ? H + 2 * L : -(H + 2 * L)
        gap = true
      }

      const ca = Math.cos(boat.a)
      const sa = Math.sin(boat.a)
      if (t >= nextFoam) {
        foam.push({ x: boat.x - ca * L * 0.45, y: boat.y - sa * L * 0.45, t, gap })
        gap = false
        nextFoam = t + 0.05
      }
      if (t >= nextRipple) {
        ripples.push({ x: boat.x + ca * L * 0.42, y: boat.y + sa * L * 0.42, t, a: boat.a, c: v * 0.33 })
        nextRipple = t + 0.16
      }
      while (foam.length && t - foam[0].t > FOAM_LIFE) foam.shift()
      while (ripples.length && t - ripples[0].t > RIPPLE_LIFE) ripples.shift()
    }

    function drawWake() {
      // ondas: cada una es un trozo de anillo que crece; juntas forman la V
      ctx.lineWidth = 1.2
      for (const r of ripples) {
        const age = time - r.t
        const k = 1 - age / RIPPLE_LIFE
        const rad = 2 + age * r.c
        const alpha = 0.22 * k * Math.sqrt(k)
        for (const side of [1, -1]) {
          const mid = r.a + side * (Math.PI / 2 - WAKE)
          ctx.strokeStyle = `rgba(0, 0, 0, ${alpha * 0.7})`
          ctx.beginPath()
          ctx.arc(r.x, r.y, rad + 1.4, mid - 0.4, mid + 0.4)
          ctx.stroke()
          ctx.strokeStyle = `rgba(226, 236, 240, ${alpha})`
          ctx.beginPath()
          ctx.arc(r.x, r.y, rad, mid - 0.4, mid + 0.4)
          ctx.stroke()
        }
      }
      // espuma: una línea que se ensancha y se desvanece detrás del barco
      ctx.lineCap = 'butt'
      for (let i = 1; i < foam.length; i++) {
        const p = foam[i]
        if (p.gap) continue
        const q = foam[i - 1]
        const age = time - p.t
        ctx.strokeStyle = `rgba(235, 240, 240, ${0.16 * (1 - age / FOAM_LIFE)})`
        ctx.lineWidth = 1.5 + age * 1.1
        ctx.beginPath()
        ctx.moveTo(q.x, q.y)
        ctx.lineTo(p.x, p.y)
        ctx.stroke()
      }
    }

    function drawBoat() {
      const t = time
      // se mece: balanceo, cabeceo y un leve subir y bajar
      const roll = Math.sin(t * 1.9 + ph[4]) * 0.07
      const pitch = Math.sin(t * 1.3 + ph[5]) * 0.04
      const heave = Math.sin(t * 2.2) * 0.012
      const ca = Math.cos(boat.a)
      const sa = Math.sin(boat.a)
      const cr = Math.cos(roll)
      const sr = Math.sin(roll)
      const cp = Math.cos(pitch)
      const sp = Math.sin(pitch)
      const rot = (x, y, z) => {
        const y1 = y * cr - z * sr
        const z1 = y * sr + z * cr
        const x2 = x * cp + z1 * sp
        return [x2 * ca - y1 * sa, x2 * sa + y1 * ca, -x * sp + z1 * cp]
      }
      const P = (x, y, z) => {
        const [wx, wy, wz] = rot(x, y, z)
        return [boat.x + wx * L, boat.y + (wy - (wz + heave) * TILT) * L]
      }
      const paper = (k) => `rgb(${Math.min(255, 233 * k)}, ${Math.min(255, 223 * k)}, ${Math.min(255, 201 * k)})`
      const poly = (pts, fill, stroke) => {
        ctx.beginPath()
        pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
        ctx.closePath()
        ctx.fillStyle = fill
        ctx.fill()
        if (stroke) {
          ctx.strokeStyle = stroke
          ctx.stroke()
        }
      }

      // sombra sobre el agua
      ctx.save()
      ctx.translate(boat.x + L * 0.07, boat.y + L * 0.06)
      ctx.rotate(boat.a)
      ctx.scale(1, 0.42)
      const shadow = ctx.createRadialGradient(0, 0, 0, 0, 0, L * 0.55)
      shadow.addColorStop(0, 'rgba(0, 0, 0, 0.45)')
      shadow.addColorStop(1, 'rgba(0, 0, 0, 0)')
      ctx.fillStyle = shadow
      ctx.beginPath()
      ctx.arc(0, 0, L * 0.55, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()

      // ola de proa
      const bow = P(0.41, 0, 0)
      ctx.strokeStyle = 'rgba(230, 238, 240, 0.3)'
      ctx.lineWidth = 1.2
      for (const side of [1, -1]) {
        const ang = boat.a + Math.PI - side * 0.45
        ctx.beginPath()
        ctx.moveTo(bow[0], bow[1])
        ctx.lineTo(bow[0] + Math.cos(ang) * L * 0.2, bow[1] + Math.sin(ang) * L * 0.2)
        ctx.stroke()
      }

      // casco: el costado que mira hacia ti queda bajo el borde, más oscuro
      ctx.lineWidth = 0.8
      ctx.lineJoin = 'round'
      const rim = RIM.map(([x, y]) => P(x, y, RIM_Z))
      poly(
        HULL.map(([x, y]) => P(x, y, 0)),
        paper(0.62)
      )
      poly(rim, paper(0.98), 'rgba(70, 52, 34, 0.45)')
      // los dos huecos a los lados de la vela
      const s0 = P(-SAIL_BASE, 0, RIM_Z)
      const s1 = P(SAIL_BASE, 0, RIM_Z)
      poly([s0, s1, rim[1], rim[2]], paper(0.6))
      poly([s0, s1, rim[5], rim[4]], paper(0.6))

      // vela: se ve la cara que mira hacia ti; su luz cambia con el rumbo
      const apex = P(0, 0, RIM_Z + SAIL_H)
      let n = rot(0, 1, 0)
      if (dot(n, VIEW) < 0) n = n.map((c) => -c)
      poly([s0, s1, apex], paper(0.62 + 0.42 * Math.max(0, dot(n, LIGHT))), 'rgba(70, 52, 34, 0.5)')
      // el doblez del centro de la vela
      const mid = lerp2(s0, s1, 0.5)
      ctx.strokeStyle = 'rgba(70, 52, 34, 0.25)'
      ctx.beginPath()
      ctx.moveTo(apex[0], apex[1])
      ctx.lineTo(mid[0], mid[1])
      ctx.stroke()

      // renglones de periódico sobre la vela
      ctx.save()
      ctx.beginPath()
      ctx.moveTo(s0[0], s0[1])
      ctx.lineTo(s1[0], s1[1])
      ctx.lineTo(apex[0], apex[1])
      ctx.closePath()
      ctx.clip()
      ctx.strokeStyle = 'rgba(40, 32, 26, 0.28)'
      ctx.lineWidth = Math.max(0.6, L * 0.012)
      ctx.setLineDash([L * 0.06, L * 0.025, L * 0.1, L * 0.03])
      for (let f = 0.18; f < 0.75; f += 0.13) {
        const a = lerp2(s0, apex, f)
        const b = lerp2(s1, apex, f)
        ctx.beginPath()
        ctx.moveTo(a[0], a[1])
        ctx.lineTo(b[0], b[1])
        ctx.stroke()
      }
      ctx.restore()
    }

    function step(now) {
      const dt = last === null ? 0 : Math.max(0, Math.min(now - last, 50)) / 1000
      last = now
      time += dt
      if (!reduceMotion) move(dt)
      ctx.clearRect(0, 0, W, H)
      drawWake()
      drawBoat()
      if (!reduceMotion) raf = requestAnimationFrame(step)
    }

    resize()
    if (reduceMotion) {
      // quieto, en una esquina, sin estela
      boat.x = W * 0.2
      boat.y = H * 0.78
      boat.a = -0.35
    } else {
      enter()
    }
    window.addEventListener('resize', resize)
    raf = requestAnimationFrame(step)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return <canvas ref={canvasRef} className="scene__boat" aria-hidden="true" />
}
