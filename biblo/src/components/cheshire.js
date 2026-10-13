// La sonrisa del Gato de Cheshire de la entrada de Alicia (en la ficha se usa
// su cara pintada, en cheshireFace.js). Coordenadas en un marco centrado en
// la boca: va de x = -100 a 100.

// la boca es una media luna entre dos curvas que unen las comisuras
const L = -92
const R = 92
const UPPER = 30 // control de la curva del labio de arriba
const LOWER = 92 // control de la del labio de abajo
const lipY = (s, cy) => -2 + 2 * s * (1 - s) * (cy + 2)

const MOUTH = `M${L} -2 Q0 ${UPPER} ${R} -2 Q0 ${LOWER} ${L} -2 Z`
// la línea donde se juntan los dientes de arriba y los de abajo
const BITE = `M${L} -2 Q0 62 ${R} -2`
// separaciones entre dientes, un poco abiertas en abanico
const TEETH = Array.from({ length: 11 }, (_, i) => {
  const s = (i + 1) / 12
  const x = L + (R - L) * s
  return `M${x.toFixed(1)} ${lipY(s, UPPER).toFixed(1)} L${(x * 1.05).toFixed(1)} ${lipY(s, LOWER).toFixed(1)}`
}).join(' ')
// comisuras que se curvan hacia arriba
const CORNERS = `M${L} -2 q-7 -3 -12 -13 M${R} -2 q7 -3 12 -13`

const EYES = [
  { x: -50, y: -46, rot: 0.22 },
  { x: 50, y: -46, rot: -0.22 },
]

const C = {
  teeth: '#fffdf6',
  teethShade: '#e6dcf0',
  gap: '#b5a1c8',
  bite: '#5a1748',
  lip: '#7a1f5e',
  irisIn: '#f8ffb8',
  iris: '#c6ef3a',
  irisOut: '#78ae17',
  pupil: '#170f20',
  eyeLine: '#3b2747',
}

let paths = null

// Dibuja la sonrisa en un lienzo ya escalado al marco de arriba.
// mouth/eyes: opacidad de cada parte; blink: 0 abiertos, 1 cerrados.
export function drawGrin(ctx, { mouth = 1, eyes = 1, blink = 0 } = {}) {
  paths ??= {
    mouth: new Path2D(MOUTH),
    bite: new Path2D(BITE),
    teeth: new Path2D(TEETH),
    corners: new Path2D(CORNERS),
  }
  ctx.save()
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  if (mouth > 0) {
    ctx.globalAlpha = mouth
    const halo = ctx.createRadialGradient(0, 22, 10, 0, 22, 120)
    halo.addColorStop(0, 'rgba(255, 124, 201, 0.32)')
    halo.addColorStop(1, 'rgba(255, 124, 201, 0)')
    ctx.fillStyle = halo
    ctx.fillRect(-130, -100, 260, 230)
    const teeth = ctx.createLinearGradient(0, 0, 0, 46)
    teeth.addColorStop(0, C.teeth)
    teeth.addColorStop(1, C.teethShade)
    ctx.fillStyle = teeth
    ctx.fill(paths.mouth)
    ctx.save()
    ctx.clip(paths.mouth)
    ctx.strokeStyle = C.gap
    ctx.lineWidth = 2.4
    ctx.stroke(paths.teeth)
    ctx.strokeStyle = C.bite
    ctx.lineWidth = 3.6
    ctx.stroke(paths.bite)
    ctx.restore()
    ctx.strokeStyle = C.lip
    ctx.lineWidth = 4.6
    ctx.stroke(paths.mouth)
    ctx.stroke(paths.corners)
  }
  if (eyes > 0) {
    ctx.globalAlpha = eyes
    for (const e of EYES) {
      ctx.save()
      ctx.translate(e.x, e.y)
      ctx.rotate(e.rot)
      ctx.scale(1, Math.max(0.08, 1 - blink))
      const iris = ctx.createRadialGradient(-4, -5, 2, 0, 0, 22)
      iris.addColorStop(0, C.irisIn)
      iris.addColorStop(0.5, C.iris)
      iris.addColorStop(1, C.irisOut)
      ctx.fillStyle = iris
      ctx.beginPath()
      ctx.ellipse(0, 0, 22, 15, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = C.eyeLine
      ctx.lineWidth = 3
      ctx.stroke()
      ctx.fillStyle = C.pupil
      ctx.beginPath()
      ctx.ellipse(0, 0, 4.4, 13, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#fff'
      ctx.beginPath()
      ctx.arc(-7, -6, 3.6, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }
  }
  ctx.restore()
}
