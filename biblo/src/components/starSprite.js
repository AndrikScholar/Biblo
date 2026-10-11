// Estrella de cinco puntas con halo, pre-renderizada (estilo de la portada
// de El Principito). La usan la atmósfera "asteroide" y la escena del desierto.
export function makeStarSprite(color, glow) {
  const size = 64
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const g = c.getContext('2d')
  const halo = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  halo.addColorStop(0, glow + '66')
  halo.addColorStop(1, glow + '00')
  g.fillStyle = halo
  g.fillRect(0, 0, size, size)
  g.fillStyle = color
  g.beginPath()
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 6 : 15
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    g.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r)
  }
  g.closePath()
  g.fill()
  return c
}
