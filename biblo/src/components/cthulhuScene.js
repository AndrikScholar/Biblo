import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'

// Escena 3D de "La Llamada de Cthulhu": océano con olas, lluvia, relámpagos
// y el modelo emergiendo. Expone una API mínima para que el componente de
// React lleve la línea de tiempo:
//   const scene = await createCthulhuScene(canvas)
//   scene.frame({ rise, flash, bolt, eyes, shake, t })   // cada fotograma
//   scene.resize(); scene.dispose()

const MODEL_URL = '/scenes/cthulhu.glb'
const MODEL_HEIGHT = 5.2 // altura del modelo en unidades de escena
const SUNK = -MODEL_HEIGHT * 1.02 // y de la base cuando está bajo el agua
const RISEN = -MODEL_HEIGHT * 0.2 // y de la base al final: el agua le llega a las caderas

const SEA_COLOR = new THREE.Color('#0b2c2a')
const FOG_COLOR = new THREE.Color('#0a2120')

// Olas: suma de senos. La misma función da la altura y su derivada (normal).
const WAVES_GLSL = /* glsl */ `
  uniform float uTime;
  vec3 waveH(vec2 p) {
    float h = 0.0; float dx = 0.0; float dz = 0.0;
    vec4 w[4];
    w[0] = vec4( 0.8,  0.6, 0.22, 0.55);  // dirx, dirz, amplitud, frecuencia
    w[1] = vec4(-0.5,  0.9, 0.14, 0.9);
    w[2] = vec4( 0.2, -1.0, 0.08, 1.6);
    w[3] = vec4( 1.0,  0.1, 0.05, 2.4);
    for (int i = 0; i < 4; i++) {
      vec2 d = normalize(w[i].xy);
      float f = w[i].w;
      float ph = dot(d, p) * f + uTime * (0.9 + f * 0.6);
      h += w[i].z * sin(ph);
      float c = w[i].z * f * cos(ph);
      dx += d.x * c; dz += d.y * c;
    }
    return vec3(h, dx, dz);
  }
`

function makeOcean() {
  const geo = new THREE.PlaneGeometry(120, 120, 220, 220)
  geo.rotateX(-Math.PI / 2)
  const mat = new THREE.MeshStandardMaterial({ color: SEA_COLOR, roughness: 0.38, metalness: 0.1 })
  const uniforms = { uTime: { value: 0 } }
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${WAVES_GLSL}`)
      .replace(
        '#include <beginnormal_vertex>',
        `vec3 wv = waveH(position.xz);\n vec3 objectNormal = normalize(vec3(-wv.y, 1.0, -wv.z));`
      )
      .replace('#include <begin_vertex>', `vec3 transformed = vec3(position.x, position.y + wv.x, position.z);`)
  }
  const mesh = new THREE.Mesh(geo, mat)
  return { mesh, uniforms }
}

// Lluvia en la GPU: cada gota es un segmento cuya caída se calcula en el
// shader con el tiempo, sin tocar buffers por fotograma.
function makeRain(count) {
  const pos = new Float32Array(count * 2 * 3)
  const tail = new Float32Array(count * 2)
  for (let i = 0; i < count; i++) {
    const x = (Math.random() - 0.5) * 34
    const y = Math.random() * 16
    const z = Math.random() * 34 - 12 // hasta la cámara, para que haya gotas cerca
    for (let j = 0; j < 2; j++) {
      pos.set([x, y, z], (i * 2 + j) * 3)
      tail[i * 2 + j] = j
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('aTail', new THREE.BufferAttribute(tail, 1))
  const uniforms = { uTime: { value: 0 }, uFlash: { value: 0 } }
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      uniform float uTime;
      attribute float aTail;
      varying float vA;
      void main() {
        vec3 p = position;
        float speed = 14.0 + fract(p.x * 7.13) * 6.0;
        p.y = mod(p.y - uTime * speed, 16.0) - 1.0;
        p.x += -0.35 * (p.y);           // caída inclinada por el viento
        p.y += aTail * 0.55;            // la cola de la gota
        p.x -= aTail * 0.19;
        vA = aTail;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uFlash;
      varying float vA;
      void main() {
        gl_FragColor = vec4(vec3(0.72, 0.86, 0.9) + uFlash * 0.4, (0.16 + uFlash * 0.25) * (1.0 - vA * 0.6));
      }
    `,
  })
  return { mesh: new THREE.LineSegments(geo, mat), uniforms }
}

function makeBolt() {
  const mat = new THREE.LineBasicMaterial({ color: '#e9f8ff', transparent: true, opacity: 0 })
  const geo = new THREE.BufferGeometry()
  const line = new THREE.Line(geo, mat)
  function strike() {
    const pts = []
    let x = (Math.random() - 0.5) * 30
    const z = -18 - Math.random() * 10
    for (let y = 22; y > 0; y -= 1 + Math.random() * 1.6) {
      x += (Math.random() - 0.5) * 2.4
      pts.push(new THREE.Vector3(x, y, z))
    }
    geo.setFromPoints(pts)
    return x
  }
  return { line, mat, strike }
}

function makeSpray(count) {
  const pos = new Float32Array(count * 3).fill(-999)
  const vel = new Float32Array(count * 3)
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  const mat = new THREE.PointsMaterial({ color: '#cdeeee', size: 0.06, transparent: true, opacity: 0.8, depthWrite: false })
  let next = 0
  function emit(n, radius) {
    for (let i = 0; i < n; i++) {
      const k = next++ % count
      const a = Math.random() * Math.PI * 2
      const r = radius * (0.4 + Math.random() * 0.6)
      pos.set([Math.cos(a) * r, 0.1, Math.sin(a) * r * 0.6 + 0.3], k * 3)
      vel.set([Math.cos(a) * 0.04, 0.09 + Math.random() * 0.12, Math.sin(a) * 0.03], k * 3)
    }
  }
  function step(k) {
    for (let i = 0; i < count; i++) {
      if (pos[i * 3 + 1] < -1) continue
      pos[i * 3] += vel[i * 3] * k
      pos[i * 3 + 1] += vel[i * 3 + 1] * k
      pos[i * 3 + 2] += vel[i * 3 + 2] * k
      vel[i * 3 + 1] -= 0.006 * k
    }
    geo.attributes.position.needsUpdate = true
  }
  return { points: new THREE.Points(geo, mat), emit, step }
}

export async function createCthulhuScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.1

  const scene = new THREE.Scene()
  scene.background = FOG_COLOR.clone()
  scene.fog = new THREE.FogExp2(FOG_COLOR, 0.045)

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200)

  // luz: cielo tormentoso tenue, luna de contraluz, relámpago y brillo violeta
  const hemi = new THREE.HemisphereLight('#4f7f86', '#020707', 0.9)
  const moon = new THREE.DirectionalLight('#7fd6cf', 2.8)
  moon.position.set(-4, 9, -10)
  const lightning = new THREE.DirectionalLight('#dff4ff', 0)
  lightning.position.set(6, 14, 4)
  // relleno frontal frío: sin él la criatura es solo una silueta
  const fill = new THREE.DirectionalLight('#8fc8d8', 1.1)
  fill.position.set(2, 3, 12)
  const eyeLight = new THREE.PointLight('#c060ff', 0, 3.2, 1.6)
  scene.add(hemi, moon, lightning, fill, eyeLight)

  const ocean = makeOcean()
  const rain = makeRain(3600)
  const bolt = makeBolt()
  const spray = makeSpray(600)
  scene.add(ocean.mesh, rain.mesh, bolt.line, spray.points)

  // modelo: se escala a MODEL_HEIGHT y se apoya en y = 0 de su propio grupo
  const loader = new GLTFLoader()
  loader.setMeshoptDecoder(MeshoptDecoder)
  const gltf = await loader.loadAsync(MODEL_URL)
  const model = gltf.scene
  const box = new THREE.Box3().setFromObject(model)
  const size = box.getSize(new THREE.Vector3())
  const s = MODEL_HEIGHT / size.y
  model.scale.setScalar(s)
  model.position.set(-((box.min.x + box.max.x) / 2) * s, -box.min.y * s, -((box.min.z + box.max.z) / 2) * s)
  model.traverse((o) => {
    if (o.isMesh) {
      // sin mapa de entorno, un material metálico se ve negro: piel mojada
      o.material.metalness = 0.15
      o.material.roughness = 0.55
    }
  })
  // la cara está en el frente del modelo (+z): ahí van la luz de los ojos
  // y el punto al que mira la cámara
  const front = box.max.z * s + model.position.z
  const creature = new THREE.Group()
  creature.add(model)
  creature.position.set(0, SUNK, 0)
  scene.add(creature)

  // posprocesado: resplandor en relámpagos y luces intensas
  const composer = new EffectComposer(renderer)
  composer.addPass(new RenderPass(scene, camera))
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.45, 0.6, 0.9)
  composer.addPass(bloom)
  composer.addPass(new OutputPass())

  function resize() {
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    renderer.setSize(w, h, false)
    composer.setSize(w, h)
    camera.aspect = w / h
    // en pantallas verticales se aleja la cámara para que quepan las alas
    camera.fov = w / h < 1 ? 58 : 42
    camera.updateProjectionMatrix()
  }
  resize()

  const lookAt = new THREE.Vector3()
  let boltLife = 0
  let lastRise = 0

  function frame({ t, k, rise, flash, strike, eyes, shake }) {
    const sec = t / 1000
    ocean.uniforms.uTime.value = sec
    rain.uniforms.uTime.value = sec
    rain.uniforms.uFlash.value = flash

    // criatura: sube con un balanceo pesado
    creature.position.y = THREE.MathUtils.lerp(SUNK, RISEN, rise) + Math.sin(sec * 1.3) * 0.05 * rise
    creature.rotation.z = Math.sin(sec * 0.8) * 0.02 * rise
    if (rise > 0.02 && rise < 0.98) spray.emit(Math.round(10 * k), 2.2)
    if (rise > 0.98 && lastRise <= 0.98) spray.emit(200, 2.6)
    lastRise = rise
    spray.step(k)

    // cámara: arranca lejos y a ras del agua; se acerca y sube mientras emerge
    const head = creature.position.y + MODEL_HEIGHT * 0.8
    camera.position.set(
      Math.sin(sec * 0.35) * 0.4 + (Math.random() - 0.5) * shake,
      THREE.MathUtils.lerp(0.6, 1.5, rise) + (Math.random() - 0.5) * shake,
      front + THREE.MathUtils.lerp(15, 7, rise)
    )
    lookAt.set(0, THREE.MathUtils.lerp(0.9, Math.max(1.2, head * 0.72), rise), front * 0.4)
    camera.lookAt(lookAt)

    // relámpagos
    if (strike) {
      bolt.strike()
      boltLife = 1
    }
    bolt.mat.opacity = boltLife
    boltLife = Math.max(0, boltLife - 0.09 * k)
    lightning.intensity = flash * 5
    hemi.intensity = 0.9 + flash * 1.5
    scene.background.copy(FOG_COLOR).lerp(new THREE.Color('#5d8590'), flash * 0.55)
    scene.fog.color.copy(scene.background)
    bloom.strength = 0.55 + flash * 0.9

    // brillo violeta frente a la cara
    eyeLight.intensity = eyes * 22
    eyeLight.position.set(0, head, front + 0.9)

    composer.render()
  }

  function dispose() {
    composer.dispose()
    renderer.dispose()
    scene.traverse((o) => {
      o.geometry?.dispose()
      const m = o.material
      if (m) for (const mm of [].concat(m)) {
        for (const v of Object.values(mm)) if (v?.isTexture) v.dispose()
        mm.dispose()
      }
    })
  }

  return { frame, resize, dispose }
}
