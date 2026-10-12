import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { Reflector } from 'three/examples/jsm/objects/Reflector.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'

// Escena 3D de IT: una alcantarilla inundada bajo una rejilla de la calle.
// Un globo rojo sale del agua, se acerca y se queda mirándote; en su reflejo
// aparece lo que está detrás de ti. Apagón, respiración, y el globo revienta.
// API:
//   const scene = await createBalloonScene(canvas, { onDrip })
//   scene.frame(t, k) -> { lamp }   (t en segundos, k = fotogramas de 60 Hz)
//   scene.resize(); scene.dispose()

// Línea de tiempo en segundos. La comparten la escena, el sonido y la interfaz.
export const T = {
  lightOn: [0.6, 2.0], // la lámpara de la calle tarda en encender
  emerge: 2.3, // el globo rompe la superficie del agua
  rise: [2.3, 5.8],
  approach: [5.8, 8.8],
  turn: [7.0, 9.6], // gira despacio hacia ti
  slow: [7.4, 9.4], // la cajita de música se queda sin cuerda
  ask: 8.9,
  reflect: [9.0, 10.6], // el reflejo muestra lo que hay detrás de la cámara
  nudge: [10.0, 10.6], // se acerca un poco más, solo
  unstable: [9.9, 10.7],
  blackout: 10.7,
  breath: 10.95,
  scare: 11.45,
  cut: 12.35,
  end: 13.0,
}

const BALLOON_URL = '/scenes/globo.glb'
const HEAD_URL = '/scenes/sonrisa.glb'

const WATER_Y = -1.2
const AXIS_Y = 0.4 // eje del túnel
const RADIUS = 2.6
const LEN = 46
const TUNNEL_Z = -17 // centro del túnel: va de z = 6 a z = -40
const CEIL_Y = AXIS_Y + RADIUS
const SHAFT = new THREE.Vector3(0, 0, -4) // la rejilla y su haz de luz
const CAM = new THREE.Vector3(0, -0.45, 3.3)
const EMERGE = new THREE.Vector3(0.12, WATER_Y - 0.45, SHAFT.z)
const RISEN = new THREE.Vector3(0.05, -0.15, SHAFT.z)
const HOVER = new THREE.Vector3(0.04, -0.33, 1.9) // donde se queda, frente a ti
const BALLOON_D = 0.5 // diámetro del globo en metros
// shortcut: separa el hilo del cuerpo por altura; vale para este modelo de globo
const KNOT_Y = 0.08
const HEAD_H = 0.95 // alto del busto completo en metros
const EYE_FRAC = 0.71 // altura de los ojos dentro del busto (medida en el modelo)
const FOG = new THREE.Color('#010202')
const FOG_DENSITY = 0.11

const clamp01 = (v) => Math.min(1, Math.max(0, v))
const span = (t, [a, b]) => clamp01((t - a) / (b - a))
const ease = (v) => (v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2)
const rand = (a, b) => a + Math.random() * (b - a)
function hash(n) {
  const s = Math.sin(n * 127.1) * 43758.5453
  return s - Math.floor(s)
}
function hash2(a, b) {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453
  return s - Math.floor(s)
}

// La lámpara de la calle vista a través de la rejilla: parpadea al encender,
// tiembla antes del apagón y luego se apaga del todo.
function lampLevel(t) {
  if (t < T.lightOn[0] || t >= T.blackout) return 0
  let v = 0.94 + Math.sin(t * 2.1) * 0.03 + Math.sin(t * 13.7) * 0.015
  if (t < T.lightOn[1]) {
    const p = span(t, T.lightOn)
    const h = hash(Math.floor(t * 18))
    v *= h < 0.35 + p * 0.6 ? (h < 0.15 ? 0.35 : 1) : 0
  }
  if (t > T.unstable[0]) {
    const p = span(t, T.unstable)
    const h = hash(Math.floor(t * 22) + 7)
    if (h < 0.15 + p * 0.55) v *= 0.08 + h * 0.4
  }
  return v
}

// ---------- texturas procedurales ----------

// ruido de valor que se repite cada `period` unidades (la textura no tiene costuras)
function vnoise(x, y, period) {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const u = (x - xi) * (x - xi) * (3 - 2 * (x - xi))
  const v = (y - yi) * (y - yi) * (3 - 2 * (y - yi))
  const h = (a, b) => hash2(((a % period) + period) % period, ((b % period) + period) % period)
  const top = h(xi, yi) + (h(xi + 1, yi) - h(xi, yi)) * u
  const bottom = h(xi, yi + 1) + (h(xi + 1, yi + 1) - h(xi, yi + 1)) * u
  return top + (bottom - top) * v
}

function canvasTexture(data, size, srgb, repeat) {
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  c.getContext('2d').putImageData(new ImageData(data, size, size), 0, 0)
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(...repeat)
  tex.anisotropy = 8
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

// Ladrillo viejo y húmedo: color, relieve (normales) y rugosidad.
// En el lienzo, x da la vuelta al túnel y y corre a lo largo de él, así que
// las hiladas van a lo largo y las manchas de humedad bajan por la pared.
function makeWallTextures() {
  const S = 512
  const cw = S / 24 // ancho de cada hilada
  const bl = S / 8 // largo de cada ladrillo
  const stain = new Float32Array(S * S)
  for (let i = 0; i < 90; i++) {
    const y0 = Math.random() * S
    const w = 2 + Math.random() * 6
    const x0 = Math.random() * S
    const len = 40 + Math.random() * 260
    const a = 0.15 + Math.random() * 0.35
    for (let dx = 0; dx < len; dx++) {
      const x = Math.floor(x0 + dx) % S
      for (let dy = -Math.ceil(w); dy <= w; dy++) {
        const y = (Math.floor(y0 + dy) + S) % S
        const f = (1 - Math.abs(dy) / (w + 1)) * (1 - dx / len) * a
        if (f > stain[y * S + x]) stain[y * S + x] = f
      }
    }
  }

  const height = new Float32Array(S * S)
  const color = new Uint8ClampedArray(S * S * 4)
  const rough = new Uint8ClampedArray(S * S * 4)
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const course = Math.floor(x / cw)
      const xin = x - course * cw
      const yy = (y + (course % 2) * bl * 0.5) % S
      const b = Math.floor(yy / bl)
      const yin = yy - b * bl
      const edge = Math.min(xin, cw - xin, yin, bl - yin)
      const brick = clamp01((edge - 0.8) / 1.6) // 0 en la junta, 1 en el ladrillo
      const n = vnoise(x / 16, y / 16, S / 16) * 0.6 + vnoise(x / 4, y / 4, S / 4) * 0.4
      const i = y * S + x
      height[i] = brick * (0.85 + n * 0.15)

      const tone = 0.62 + hash2(course, b) * 0.5
      const moss = hash2(course + 7, b + 3) > 0.78
      const br = 92 * tone * (moss ? 0.7 : 1)
      const bg = 64 * tone
      const bb = 52 * tone * (moss ? 0.75 : 1)
      const grime = (0.6 + n * 0.4) * (1 - stain[i] * 0.6)
      color[i * 4] = (40 + (br - 40) * brick) * grime
      color[i * 4 + 1] = (38 + (bg - 38) * brick) * grime
      color[i * 4 + 2] = (33 + (bb - 33) * brick) * grime
      color[i * 4 + 3] = 255

      const r = clamp01(0.9 + (0.55 - n * 0.15 - 0.9) * brick - stain[i] * 0.35) * 255
      rough[i * 4] = rough[i * 4 + 1] = rough[i * 4 + 2] = r
      rough[i * 4 + 3] = 255
    }
  }

  const normal = new Uint8ClampedArray(S * S * 4)
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const l = height[y * S + ((x - 1 + S) % S)]
      const r = height[y * S + ((x + 1) % S)]
      const u = height[((y - 1 + S) % S) * S + x]
      const d = height[((y + 1) % S) * S + x]
      let nx = (l - r) * 2.5
      let ny = (d - u) * 2.5
      const len = Math.hypot(nx, ny, 1)
      nx /= len
      ny /= len
      const i = (y * S + x) * 4
      normal[i] = (nx * 0.5 + 0.5) * 255
      normal[i + 1] = (ny * 0.5 + 0.5) * 255
      normal[i + 2] = (0.5 / len + 0.5) * 255
      normal[i + 3] = 255
    }
  }

  // la circunferencia mide ~16 m y el túnel 46 m: mosaicos de ~2 m
  const repeat = [8, 23]
  return {
    map: canvasTexture(color, S, true, repeat),
    normal: canvasTexture(normal, S, false, repeat),
    rough: canvasTexture(rough, S, false, repeat),
  }
}

// La pared se oscurece, verdea y brilla cerca del agua (la línea de lodo).
function wetLine(mat) {
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vWorldY;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWorldY = (modelMatrix * vec4(transformed, 1.0)).y;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vWorldY;')
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        float wet = 1.0 - smoothstep(${(WATER_Y + 0.02).toFixed(2)}, ${(WATER_Y + 0.75).toFixed(2)}, vWorldY);
        diffuseColor.rgb *= mix(vec3(1.0), vec3(0.32, 0.42, 0.3), wet);`
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.14, wet);`
      )
  }
}

function makeGrateTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const g = c.getContext('2d')
  const light = g.createRadialGradient(128, 128, 10, 128, 128, 180)
  light.addColorStop(0, '#fff6e0')
  light.addColorStop(1, '#9aa69c')
  g.fillStyle = light
  g.fillRect(0, 0, 256, 256)
  g.fillStyle = '#0b0b0a'
  for (let x = 4; x < 256; x += 36) g.fillRect(x, 0, 12, 256)
  for (let y = 0; y < 256; y += 85) g.fillRect(0, y, 256, 10)
  g.fillRect(0, 0, 256, 14)
  g.fillRect(0, 242, 256, 14)
  g.fillRect(0, 0, 14, 256)
  g.fillRect(242, 0, 14, 256)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

// ---------- piezas de la escena ----------

// Agua: espejo (Reflector) con rizos, corriente lenta, anillos de las gotas
// y el charco de luz bajo la rejilla con la sombra de los barrotes.
const WaterShader = {
  name: 'SewerWater',
  uniforms: {
    color: { value: null },
    tDiffuse: { value: null },
    textureMatrix: { value: null },
    uTime: { value: 0 },
    uLamp: { value: 0 },
    uRings: { value: Array.from({ length: 8 }, () => new THREE.Vector3(0, 0, -99)) },
    uShaft: { value: new THREE.Vector2(SHAFT.x, SHAFT.z) },
    uFog: { value: FOG_DENSITY },
  },
  vertexShader: /* glsl */ `
    uniform mat4 textureMatrix;
    varying vec4 vUvR;
    varying vec3 vWorld;
    void main() {
      vUvR = textureMatrix * vec4(position, 1.0);
      vec4 w = modelMatrix * vec4(position, 1.0);
      vWorld = w.xyz;
      gl_Position = projectionMatrix * viewMatrix * w;
    }
  `,
  fragmentShader: /* glsl */ `
    uniform vec3 color;
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uLamp;
    uniform float uFog;
    uniform vec3 uRings[8];
    uniform vec2 uShaft;
    varying vec4 vUvR;
    varying vec3 vWorld;
    void main() {
      vec2 p = vWorld.xz;
      vec2 q = p - vec2(0.0, uTime * 0.18); // la corriente baja hacia la cámara
      vec2 n = vec2(
        sin(q.x * 3.1 + q.y * 1.7 + uTime * 0.9) + sin(q.x * 7.3 - q.y * 4.1 + uTime * 1.7) * 0.5,
        sin(q.y * 2.6 - q.x * 1.3 + uTime * 1.1) + sin(q.y * 6.7 + q.x * 3.9 - uTime * 1.5) * 0.5
      ) * 0.012;
      for (int i = 0; i < 8; i++) {
        vec3 r = uRings[i];
        float age = uTime - r.z;
        if (age < 0.0 || age > 2.5) continue;
        vec2 d = p - r.xy;
        float dist = length(d);
        float front = age * 0.55;
        float wave = sin((dist - front) * 38.0) * exp(-age * 1.6) * (1.0 - smoothstep(0.0, 0.25, abs(dist - front)));
        n += d / max(dist, 0.001) * wave * 0.03;
      }
      vec4 uv = vUvR;
      uv.xy += n * uv.w;
      vec3 refl = texture2DProj(tDiffuse, uv).rgb;
      vec3 V = normalize(cameraPosition - vWorld);
      float fres = 0.18 + 0.82 * pow(1.0 - max(V.y, 0.0), 4.0);
      vec3 col = vec3(0.006, 0.012, 0.01) + refl * fres * 0.85;
      vec2 s = p - uShaft;
      float pool = exp(-dot(s, s) * 1.6) * uLamp;
      float bars = smoothstep(0.2, 0.45, abs(fract(s.x * 3.6 + n.x * 20.0) - 0.5));
      col += vec3(0.55, 0.65, 0.6) * pool * (0.08 + 0.18 * bars);
      col += vec3(0.8, 0.9, 0.85) * pool * pow(max(0.0, n.x * 40.0 + n.y * 25.0), 3.0) * 0.4;
      float depth = length(cameraPosition - vWorld);
      float fog = 1.0 - exp(-uFog * uFog * depth * depth);
      gl_FragColor = vec4(mix(col, color, fog), 1.0);
    }
  `,
}

// Haz de luz que cae de la rejilla: un cono aditivo, más denso en el centro.
function makeBeam() {
  const h = CEIL_Y - 0.07 - WATER_Y
  const geo = new THREE.CylinderGeometry(0.42, 1.05, h, 40, 1, true)
  const uniforms = { uLamp: { value: 0 } }
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      varying vec3 vN;
      varying vec3 vView;
      varying float vH;
      varying float vX;
      void main() {
        vH = position.y / ${h.toFixed(3)} + 0.5;
        vX = (modelMatrix * vec4(position, 1.0)).x;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vView = -mv.xyz;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uLamp;
      varying vec3 vN;
      varying vec3 vView;
      varying float vH;
      varying float vX;
      void main() {
        float facing = abs(dot(normalize(vN), normalize(vView)));
        float a = pow(facing, 2.2) * (0.25 + 0.75 * vH) * smoothstep(0.0, 0.2, vH);
        float stripes = 0.72 + 0.28 * sin(vX * 26.0);
        gl_FragColor = vec4(vec3(0.55, 0.63, 0.58) * a * stripes * uLamp * 0.32, 1.0);
      }
    `,
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.position.set(SHAFT.x, WATER_Y + h / 2, SHAFT.z)
  return { mesh, uniforms }
}

// Motas de polvo que flotan en el haz; fuera de él casi no se ven.
function makeDust(n) {
  const pos = new Float32Array(n * 3)
  const seed = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2
    const r = Math.sqrt(Math.random()) * 1.15
    pos.set([SHAFT.x + Math.cos(a) * r, rand(WATER_Y + 0.1, CEIL_Y - 0.15), SHAFT.z + Math.sin(a) * r], i * 3)
    seed[i] = Math.random()
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
  const uniforms = { uTime: { value: 0 }, uLamp: { value: 0 }, uSize: { value: 18 } }
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uSize;
      attribute float aSeed;
      varying float vIn;
      varying float vTw;
      void main() {
        vec3 p = position;
        p.x += sin(uTime * 0.21 + aSeed * 40.0) * 0.06;
        p.y += sin(uTime * 0.13 + aSeed * 17.0) * 0.08;
        p.z += cos(uTime * 0.17 + aSeed * 23.0) * 0.06;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float h = clamp((p.y - ${WATER_Y.toFixed(2)}) / ${(CEIL_Y - WATER_Y).toFixed(2)}, 0.0, 1.0);
        float r = mix(1.05, 0.42, h);
        vIn = 1.0 - smoothstep(r * 0.55, r, length(p.xz - vec2(${SHAFT.x.toFixed(2)}, ${SHAFT.z.toFixed(2)})));
        vTw = 0.6 + 0.4 * sin(uTime * 2.0 + aSeed * 60.0);
        gl_PointSize = uSize * (0.5 + aSeed) / -mv.z;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uLamp;
      varying float vIn;
      varying float vTw;
      void main() {
        float a = 1.0 - smoothstep(0.0, 0.5, length(gl_PointCoord - 0.5));
        gl_FragColor = vec4(vec3(0.85, 0.92, 0.88) * a * (0.08 + vIn) * vTw * uLamp * 0.7, 1.0);
      }
    `,
  })
  return { points: new THREE.Points(geo, mat), uniforms }
}

// Gotas: unas caen del techo cada pocos segundos; otras escurren del globo
// al salir del agua. Al tocar el agua dejan un anillo y suenan.
function makeDrops(slots) {
  const pos = new Float32Array(slots * 6)
  const col = new Float32Array(slots * 6)
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
  const mat = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  const lines = new THREE.LineSegments(geo, mat)
  lines.frustumCulled = false
  const drops = []
  for (let i = 0; i < 9; i++) {
    const nearShaft = i < 6
    drops.push({
      x: nearShaft ? SHAFT.x + rand(-0.9, 0.9) : rand(-1.6, 1.6),
      z: nearShaft ? SHAFT.z + rand(-1.2, 1.2) : rand(-1.5, 2.2),
      y0: CEIL_Y - 0.12,
      t0: rand(0.4, 3),
      period: rand(1.6, 3.8),
      hit: false,
    })
  }
  let next = 9
  function spawn(x, y, z, t) {
    if (drops.length < slots) drops.push({})
    const d = drops[next]
    next = next + 1 >= slots ? 9 : next + 1
    Object.assign(d, { x, z, y0: y, t0: t, period: 0, hit: false })
  }
  function update(t, lamp, onHit) {
    for (let i = 0; i < slots; i++) {
      const d = drops[i]
      let vis = 0
      let y = -99
      let v = 0
      if (d) {
        let tau = t - d.t0
        if (d.period && tau > 1.2) {
          d.t0 += d.period * Math.ceil((tau - 1.2) / d.period)
          d.hit = false
          tau = t - d.t0
        }
        y = d.y0 - 4.9 * tau * tau
        v = 9.8 * tau
        if (tau >= 0 && !d.hit) {
          if (y <= WATER_Y) {
            d.hit = true
            onHit(d.x, d.z)
          } else {
            const inBeam = Math.exp(-((d.x - SHAFT.x) ** 2 + (d.z - SHAFT.z) ** 2) * 2)
            vis = (0.06 + inBeam * 0.9) * lamp
          }
        }
      }
      const len = 0.05 + v * 0.012
      pos.set([d?.x ?? 0, y, d?.z ?? 0, d?.x ?? 0, y + len, d?.z ?? 0], i * 6)
      col.set([vis * 0.9, vis, vis * 0.95, vis * 0.2, vis * 0.25, vis * 0.22], i * 6)
    }
    geo.attributes.position.needsUpdate = true
    geo.attributes.color.needsUpdate = true
  }
  return { lines, spawn, update }
}

// Barquito de papel (el de la portada) que baja con la corriente.
function makeBoat() {
  const B0 = [-0.15, 0, 0]
  const B1 = [0.15, 0, 0]
  const L0 = [-0.22, 0.07, 0.06]
  const L1 = [0.22, 0.07, 0.06]
  const R0 = [-0.22, 0.07, -0.06]
  const R1 = [0.22, 0.07, -0.06]
  const S0 = [-0.12, 0.07, 0]
  const S1 = [0.12, 0.07, 0]
  const A = [0, 0.21, 0]
  const tris = [B0, B1, L1, B0, L1, L0, B0, R1, B1, B0, R0, R1, S0, S1, A, B0, L0, R0, B1, R1, L1]
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(tris.flat(), 3))
  geo.computeVertexNormals()
  return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#d9d4c5', roughness: 0.9, side: THREE.DoubleSide }))
}

// Trozos de goma que salen volando cuando el globo revienta.
function makeShards(n) {
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute([-0.04, -0.025, 0, 0.045, -0.02, 0, 0, 0.035, 0], 3))
  geo.computeVertexNormals()
  const mat = new THREE.MeshStandardMaterial({ color: '#b5101a', roughness: 0.35, side: THREE.DoubleSide })
  const mesh = new THREE.InstancedMesh(geo, mat, n)
  mesh.visible = false
  mesh.frustumCulled = false
  const parts = Array.from({ length: n }, () => ({
    p: new THREE.Vector3(),
    v: new THREE.Vector3(),
    r: new THREE.Euler(),
    w: new THREE.Vector3(),
    s: 1,
  }))
  const dummy = new THREE.Object3D()
  const dir = new THREE.Vector3()
  function burst(center, radius) {
    mesh.visible = true
    for (const q of parts) {
      dir.randomDirection()
      q.p.copy(center).addScaledVector(dir, radius)
      q.v.copy(dir).multiplyScalar(rand(0.03, 0.09))
      q.v.y += 0.01
      q.r.set(rand(0, 6), rand(0, 6), rand(0, 6))
      q.w.set(rand(-0.3, 0.3), rand(-0.3, 0.3), rand(-0.3, 0.3))
      q.s = rand(0.6, 1.7)
    }
  }
  function step(k) {
    if (!mesh.visible) return
    parts.forEach((q, i) => {
      q.p.addScaledVector(q.v, k)
      q.v.multiplyScalar(Math.pow(0.93, k))
      q.v.y -= 0.0012 * k
      q.r.set(q.r.x + q.w.x * k, q.r.y + q.w.y * k, q.r.z + q.w.z * k)
      dummy.position.copy(q.p)
      dummy.rotation.copy(q.r)
      dummy.scale.setScalar(q.s)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
  }
  return { mesh, burst, step }
}

// Grano de película, viñeta, aberración cromática y desgarro de imagen.
const FilmShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uGrain: { value: 0.06 },
    uChroma: { value: 0.004 },
    uGlitch: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uGrain;
    uniform float uChroma;
    uniform float uGlitch;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 uv = vUv;
      float band = floor(uv.y * 36.0);
      float tear = step(0.72, hash(vec2(band, floor(uTime * 24.0)))) * (hash(vec2(band + 3.1, uTime)) - 0.5);
      uv.x += tear * uGlitch * 0.08;
      vec2 c = uv - 0.5;
      float d = length(c);
      vec2 off = c * d * uChroma;
      vec3 col = vec3(texture2D(tDiffuse, uv + off).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - off).b);
      col *= 1.0 - smoothstep(0.32, 0.95, d * 1.15);
      col += (hash(uv * 913.7 + fract(uTime * 7.31) * 37.0) - 0.5) * uGrain;
      gl_FragColor = vec4(col, 1.0);
    }
  `,
}

// ---------- modelos ----------

// El globo trae el hilo en la misma malla: se separa para que el hilo se
// mezca solo y, al reventar, caiga al agua.
function buildBalloon(gltf, reflect) {
  let src = null
  gltf.scene.updateMatrixWorld(true)
  gltf.scene.traverse((o) => {
    if (o.isMesh && !src) src = o
  })
  const geo = src.geometry.clone().applyMatrix4(src.matrixWorld)
  const pos = geo.attributes.position
  const tri = geo.index.array
  const bodyIdx = []
  const stringIdx = []
  for (let i = 0; i < tri.length; i += 3) {
    const top = Math.max(pos.getY(tri[i]), pos.getY(tri[i + 1]), pos.getY(tri[i + 2]))
    ;(top < KNOT_Y ? stringIdx : bodyIdx).push(tri[i], tri[i + 1], tri[i + 2])
  }
  const part = (idx) => {
    const g = new THREE.BufferGeometry()
    for (const [name, attr] of Object.entries(geo.attributes)) g.setAttribute(name, attr)
    g.setIndex(idx)
    return g
  }
  const bodyGeo = part(bodyIdx)
  const stringGeo = part(stringIdx)
  // medir solo los vértices del cuerpo (computeBoundingBox incluiría el hilo,
  // porque las dos partes comparten el mismo buffer de posiciones)
  const box = new THREE.Box3()
  const v = new THREE.Vector3()
  for (const i of bodyIdx) box.expandByPoint(v.fromBufferAttribute(pos, i))
  const center = box.getCenter(new THREE.Vector3())
  const scale = BALLOON_D / (box.max.x - box.min.x)

  const old = src.material
  const bodyMat = new THREE.MeshPhysicalMaterial({
    map: old.map,
    normalMap: old.normalMap,
    roughness: 0.3,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.07,
    emissive: '#5a0006',
    emissiveIntensity: 0,
  })
  // reflejo: lo que "ve" el globo hacia la cámara, pintado como en una esfera
  // de espejo (según la normal en espacio de vista)
  bodyMat.onBeforeCompile = (shader) => {
    shader.uniforms.uReflectMap = reflect.map
    shader.uniforms.uReflectAmt = reflect.amt
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D uReflectMap;\nuniform float uReflectAmt;')
      .replace(
        '#include <opaque_fragment>',
        `vec3 nR = normalize(normal);
        vec2 ruv = vec2(-nR.x, nR.y) * 0.5 + 0.5;
        float rim = pow(1.0 - max(nR.z, 0.0), 2.0);
        outgoingLight += texture2D(uReflectMap, ruv).rgb * uReflectAmt * (0.45 + 0.55 * rim);
        #include <opaque_fragment>`
      )
  }
  const stringMat = new THREE.MeshStandardMaterial({ map: old.map, roughness: 0.85, metalness: 0 })

  const balloon = new THREE.Group()
  const inner = new THREE.Group()
  inner.scale.setScalar(scale)
  balloon.add(inner)
  const body = new THREE.Mesh(bodyGeo, bodyMat)
  body.position.copy(center).negate()
  inner.add(body)
  const stringPivot = new THREE.Group()
  stringPivot.position.set(0, KNOT_Y - center.y, 0)
  inner.add(stringPivot)
  const string = new THREE.Mesh(stringGeo, stringMat)
  string.position.set(-center.x, -KNOT_Y, -center.z)
  stringPivot.add(string)
  return { balloon, bodyMat, stringPivot }
}

function buildHead(gltf) {
  const model = gltf.scene
  model.traverse((o) => {
    if (o.isMesh) {
      // sin mapa de entorno, lo metálico se ve negro: piel de maquillaje mate
      o.material.metalness = 0
      o.material.metalnessMap = null
      o.material.needsUpdate = true
    }
  })
  const box = new THREE.Box3().setFromObject(model)
  const size = box.getSize(new THREE.Vector3())
  const s = HEAD_H / size.y
  model.scale.setScalar(s)
  // el pivote queda a la altura de los ojos, en medio de la cabeza
  model.position.set(
    -((box.min.x + box.max.x) / 2) * s,
    -(box.min.y + EYE_FRAC * size.y) * s,
    -((box.min.z + box.max.z) / 2) * s
  )
  const head = new THREE.Group()
  head.add(model)
  head.visible = false
  // la punta de la nariz respecto al pivote: ahí apunta la luz de la cara
  const faceFwd = (box.max.z - (box.min.z + box.max.z) / 2) * s
  return { head, faceFwd }
}

// ---------- escena ----------

export async function createBalloonScene(canvas, { onDrip } = {}) {
  const small = Math.min(window.innerWidth, window.innerHeight) < 700
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.15

  const scene = new THREE.Scene()
  scene.background = FOG.clone()
  scene.fog = new THREE.FogExp2(FOG, FOG_DENSITY)
  const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 60)

  // túnel de ladrillo, costillas de piedra y una tubería oxidada
  const wall = makeWallTextures()
  const wallMat = new THREE.MeshStandardMaterial({
    map: wall.map,
    normalMap: wall.normal,
    roughnessMap: wall.rough,
    roughness: 1,
    metalness: 0,
    side: THREE.BackSide,
  })
  wetLine(wallMat)
  const tunnelGeo = new THREE.CylinderGeometry(RADIUS, RADIUS, LEN, 64, 1, true)
  tunnelGeo.rotateX(Math.PI / 2) // la costura queda abajo, bajo el agua
  const tunnel = new THREE.Mesh(tunnelGeo, wallMat)
  tunnel.position.set(0, AXIS_Y, TUNNEL_Z)
  scene.add(tunnel)

  const ribMat = new THREE.MeshStandardMaterial({ color: '#2b2520', roughness: 0.6, metalness: 0 })
  wetLine(ribMat)
  const ribGeo = new THREE.TorusGeometry(RADIUS - 0.05, 0.1, 10, 64)
  for (const z of [4.5, -1.5, -7, -12.5, -18, -23.5, -29]) {
    const rib = new THREE.Mesh(ribGeo, ribMat)
    rib.position.set(0, AXIS_Y, z)
    scene.add(rib)
  }
  const pipeGeo = new THREE.CylinderGeometry(0.11, 0.11, LEN, 16, 1, true)
  pipeGeo.rotateX(Math.PI / 2)
  const pipe = new THREE.Mesh(pipeGeo, new THREE.MeshStandardMaterial({ color: '#3b2a1e', roughness: 0.7, metalness: 0.4 }))
  pipe.position.set(-1.95, 1.75, TUNNEL_Z)
  scene.add(pipe)

  // la rejilla del techo: la luz de la calle se cuela entre los barrotes
  const grate = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: makeGrateTexture(), color: 0x000000, fog: false })
  )
  grate.rotation.x = Math.PI / 2
  grate.position.set(SHAFT.x, CEIL_Y - 0.07, SHAFT.z)
  scene.add(grate)

  const beam = makeBeam()
  const dust = makeDust(small ? 260 : 480)
  const drops = makeDrops(24)
  scene.add(beam.mesh, dust.points, drops.lines)

  // agua: espejo distorsionado
  const waterGeo = new THREE.PlaneGeometry(6, LEN)
  const water = new Reflector(waterGeo, {
    color: FOG,
    textureWidth: Math.round(window.innerWidth * (small ? 0.4 : 0.5)),
    textureHeight: Math.round(window.innerHeight * (small ? 0.4 : 0.5)),
    clipBias: 0.003,
    shader: WaterShader,
  })
  water.rotation.x = -Math.PI / 2
  water.position.set(0, WATER_Y, TUNNEL_Z)
  scene.add(water)
  const waterU = water.material.uniforms
  waterU.uRings.value = Array.from({ length: 8 }, () => new THREE.Vector3(0, 0, -99))
  let ringIdx = 0
  function addRing(x, z, t) {
    waterU.uRings.value[ringIdx].set(x, z, t)
    ringIdx = (ringIdx + 1) % 8
  }

  const boat = makeBoat()
  scene.add(boat)

  // lo que el globo refleja: se renderiza desde el globo hacia la cámara
  const reflectRT = new THREE.WebGLRenderTarget(small ? 256 : 512, small ? 256 : 512, { type: THREE.HalfFloatType })
  const reflectCam = new THREE.PerspectiveCamera(100, 1, 0.05, 30)
  const reflect = { map: { value: reflectRT.texture }, amt: { value: 0 } }

  const loader = new GLTFLoader()
  loader.setMeshoptDecoder(MeshoptDecoder)
  const [balloonGltf, headGltf] = await Promise.all([loader.loadAsync(BALLOON_URL), loader.loadAsync(HEAD_URL)])
  const { balloon, bodyMat, stringPivot } = buildBalloon(balloonGltf, reflect)
  const { head, faceFwd } = buildHead(headGltf)
  const shards = makeShards(70)
  scene.add(balloon, head, shards.mesh)

  // luces: todas existen desde el principio (encender una nueva obligaría a
  // recompilar los shaders justo en el susto); se animan con la intensidad
  const hemi = new THREE.HemisphereLight('#2c403a', '#000000', 0)
  const spot = new THREE.SpotLight('#d8e8de', 0, 10, 0.55, 0.75, 1.4)
  spot.position.set(SHAFT.x, CEIL_Y - 0.05, SHAFT.z)
  spot.target.position.set(SHAFT.x, WATER_Y, SHAFT.z)
  const bounce = new THREE.PointLight('#8fb0a6', 0, 5, 1.5)
  // la luz que rebota bajo la rejilla: deja ver el ladrillo alrededor del haz
  const spill = new THREE.PointLight('#cfe0d6', 0, 7, 1.2)
  spill.position.set(SHAFT.x, CEIL_Y - 0.6, SHAFT.z)
  const headLight = new THREE.PointLight('#ffb27a', 0, 2.6, 1.6)
  const scareKey = new THREE.PointLight('#f4f0ff', 0, 2.4, 1.6)
  const scareRim = new THREE.PointLight('#ff2a1e', 0, 3, 1.4)
  scene.add(hemi, spot, spot.target, bounce, spill, headLight, scareKey, scareRim)

  // posprocesado
  const composer = new EffectComposer(renderer)
  composer.addPass(new RenderPass(scene, camera))
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.55, 0.8)
  composer.addPass(bloom)
  composer.addPass(new OutputPass())
  const film = new ShaderPass(FilmShader)
  composer.addPass(film)

  let portrait = false
  function resize() {
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    renderer.setSize(w, h, false)
    composer.setSize(w, h)
    camera.aspect = w / h
    portrait = w / h < 1
    camera.updateProjectionMatrix()
  }
  resize()

  // compilar todo antes de empezar: si no, el busto y los trozos se
  // compilarían la primera vez que aparecen y el susto daría un tirón
  head.visible = shards.mesh.visible = true
  await renderer.compileAsync(scene, camera)
  head.visible = shards.mesh.visible = false

  const look = new THREE.Vector3(SHAFT.x, 0.25, SHAFT.z)
  const want = new THREE.Vector3()
  const bPos = new THREE.Vector3()
  const face = new THREE.Vector3()
  const toBalloon = new THREE.Vector3()
  const tmp = new THREE.Vector3()
  const scareFrom = new THREE.Vector3()
  const scareTo = new THREE.Vector3()
  let emerged = false
  let popped = false
  let stringVy = 0
  let stringSplash = false
  let frameNo = 0

  const splash = new THREE.Vector3()
  function hitWater(x, z, t) {
    addRing(x, z, t)
    const dist = splash.set(x, WATER_Y, z).distanceTo(camera.position)
    onDrip?.(Math.max(-1, Math.min(1, (x - camera.position.x) / 2.2)), 1 / (1 + dist * 0.4))
  }

  function frame(t, k) {
    frameNo++
    const dt = k / 60
    const lamp = lampLevel(t)
    const rise = ease(span(t, T.rise))
    const app = ease(span(t, T.approach))
    const dark = t >= T.blackout
    const s = t - T.scare // tiempo desde el susto

    // luz de la calle
    spot.intensity = lamp * 70
    hemi.intensity = lamp * 1.6
    bounce.intensity = lamp * 1.1
    spill.intensity = lamp * 5
    bounce.position.set(CAM.x, CAM.y + 0.7, CAM.z - 0.6)
    grate.material.color.setScalar(lamp * 2.6)
    beam.uniforms.uLamp.value = lamp
    dust.uniforms.uTime.value = t
    dust.uniforms.uLamp.value = lamp
    waterU.uTime.value = t
    waterU.uLamp.value = lamp
    bodyMat.emissiveIntensity = lamp * 0.12

    // barquito de papel
    boat.position.set(-0.55 + Math.sin(t * 0.3) * 0.08, WATER_Y + Math.sin(t * 1.7) * 0.006, -5 + t * 0.4)
    boat.rotation.set(0, 0.35 + t * 0.05, Math.sin(t * 1.3) * 0.06)

    // el globo: sale del agua, sube por el haz y viene hacia ti
    bPos.lerpVectors(EMERGE, RISEN, rise)
    if (app > 0) {
      bPos.lerpVectors(RISEN, HOVER, app)
      bPos.y += Math.sin(app * Math.PI) * 0.12
    }
    bPos.z += ease(span(t, T.nudge)) * 0.1
    const calm = 1 - app * 0.8 // al llegar se queda casi quieto, mirándote
    if (!popped) {
      balloon.visible = t > T.emerge - 0.3
      balloon.position.set(bPos.x + Math.sin(t * 0.9) * 0.05 * calm, bPos.y + Math.sin(t * 1.3) * 0.025 * calm, bPos.z)
      balloon.rotation.set(
        Math.sin(t * 0.7) * 0.06 * calm,
        0.7 - ease(span(t, T.turn)) * 2.3,
        Math.sin(t * 1.1 + 0.5) * 0.09 * calm
      )
      stringPivot.rotation.set(Math.sin(t * 1.3 + 1) * 0.1 * calm, 0, (Math.sin(t * 1.7) * 0.12 - Math.cos(t * 0.9) * 0.05) * calm)
    }
    if (!emerged && t >= T.emerge) {
      emerged = true
      addRing(bPos.x, bPos.z, t)
      addRing(bPos.x + 0.05, bPos.z - 0.04, t + 0.35)
    }
    // agua que escurre del globo recién salido
    if (t > T.emerge && t < T.emerge + 1.6 && Math.random() < 0.12 * k) {
      drops.spawn(balloon.position.x + rand(-0.06, 0.06), balloon.position.y - rand(0.25, 0.7), balloon.position.z + rand(-0.06, 0.06), t)
    }
    drops.update(t, lamp, (x, z) => hitWater(x, z, t))

    // cámara en mano: mira el haz y luego sigue al globo
    const follow = ease(span(t, [T.emerge, T.emerge + 1.4]))
    want.set(SHAFT.x, 0.25, SHAFT.z).lerp(balloon.position, follow)
    look.lerp(want, 1 - Math.pow(0.02, dt))
    camera.position.set(
      CAM.x + Math.sin(t * 0.71) * 0.012 + Math.sin(t * 1.93 + 1) * 0.005,
      CAM.y + Math.sin(t * 0.26) * 0.012 + Math.sin(t * 1.7 + 2) * 0.004,
      CAM.z - app * 0.25
    )
    const hit = s >= 0 ? Math.exp(-s * 4.5) : 0
    if (s >= 0) {
      const shake = 0.035 * Math.exp(-s * 4)
      camera.position.x += (Math.random() - 0.5) * shake
      camera.position.y += (Math.random() - 0.5) * shake
      camera.position.z += 0.08 * (1 - Math.exp(-s * 12)) // retrocedes
    }
    camera.lookAt(look)
    camera.rotateZ(Math.sin(t * 0.37) * 0.008)
    camera.fov = THREE.MathUtils.lerp(50, 38, app) + (portrait ? 16 : 0)
    camera.updateProjectionMatrix()

    // el busto: primero detrás de ti, después delante
    head.visible = t >= T.reflect[0] && t < T.cut
    if (s < 0) {
      head.position.set(camera.position.x + 0.3, camera.position.y + 0.1, camera.position.z + 0.85)
      head.lookAt(balloon.position)
      head.rotateZ(-0.22)
    } else {
      if (!popped) {
        popped = true
        balloon.updateMatrixWorld(true)
        shards.burst(balloon.position, BALLOON_D * 0.5)
        scene.attach(stringPivot) // el hilo se suelta y cae
        balloon.visible = false
        scareFrom.copy(balloon.position).add(tmp.set(0, 0.04, -0.3))
        camera.getWorldDirection(tmp)
        scareTo.copy(camera.position).addScaledVector(tmp, 0.78)
        scareTo.y -= 0.03
      }
      const lunge = 1 - Math.pow(1 - clamp01(s / 0.24), 3)
      head.position.lerpVectors(scareFrom, scareTo, lunge)
      head.position.x += (Math.random() - 0.5) * 0.008
      head.position.y += (Math.random() - 0.5) * 0.006
      head.lookAt(camera.position)
      head.rotateZ(0.16 + Math.sin(s * 40) * 0.015)
    }
    head.updateMatrixWorld(true)
    face.set(0, 0, faceFwd).applyMatrix4(head.matrixWorld)

    // la cara detrás de ti se ilumina poco a poco, con una luz que titila
    const reveal = ease(span(t, T.reflect))
    toBalloon.copy(balloon.position).sub(face).normalize()
    headLight.position.copy(face).addScaledVector(toBalloon, 0.35)
    headLight.position.y -= 0.12
    headLight.intensity = dark ? 0 : reveal * 3.2 * (0.75 + 0.25 * hash(Math.floor(t * 15)))

    // el susto: luz desde abajo y contraluz rojo
    if (s >= 0) {
      tmp.copy(camera.position).sub(head.position).normalize()
      scareKey.position.copy(head.position).addScaledVector(tmp, 0.55)
      scareKey.position.y -= 0.42
      scareKey.intensity = s < 0.03 ? 0.5 : 1.6
      scareRim.position.copy(head.position).add(tmp.set(0.2, 0.3, -0.5))
      scareRim.intensity = 4
    }
    shards.step(k)
    if (popped && stringPivot.visible) {
      stringVy += 0.0025 * k
      stringPivot.position.y -= stringVy * k
      stringPivot.rotation.x += 0.02 * k
      stringPivot.getWorldPosition(tmp)
      if (!stringSplash && tmp.y < WATER_Y) {
        stringSplash = true
        hitWater(tmp.x, tmp.z, t)
      }
      if (tmp.y < WATER_Y - 0.6) stringPivot.visible = false
    }

    // reflejo del globo: de un reflejo amplio del túnel pasa a enfocar la cara
    const focus = ease(span(t, [T.reflect[0] + 0.2, T.reflect[1]]))
    reflect.amt.value = 0.3 + focus * 0.9
    if (balloon.visible && (focus > 0 || frameNo % 2 === 0)) {
      reflectCam.position.copy(balloon.position)
      reflectCam.lookAt(tmp.copy(camera.position).lerp(face, focus))
      reflectCam.fov = THREE.MathUtils.lerp(100, 26, focus)
      reflectCam.updateProjectionMatrix()
      balloon.visible = false
      water.visible = false
      renderer.setRenderTarget(reflectRT)
      renderer.render(scene, reflectCam)
      renderer.setRenderTarget(null)
      balloon.visible = true
      water.visible = true
    }

    // película
    film.uniforms.uTime.value = t
    film.uniforms.uChroma.value = 0.004 + hit * 0.03 + (t > T.unstable[0] && !dark ? 0.004 : 0)
    film.uniforms.uGrain.value = 0.06 + hit * 0.08
    film.uniforms.uGlitch.value = s >= 0 ? Math.exp(-s * 12) : 0
    bloom.strength = 0.55 + hit * 0.25

    composer.render()
    return { lamp }
  }

  function dispose() {
    composer.dispose()
    reflectRT.dispose()
    water.dispose()
    renderer.dispose()
    scene.traverse((o) => {
      o.geometry?.dispose()
      const m = o.material
      if (m) {
        for (const mm of [].concat(m)) {
          for (const v of Object.values(mm)) if (v?.isTexture) v.dispose()
          mm.dispose()
        }
      }
    })
  }

  return { frame, resize, dispose }
}
