// Catálogo de Biblo.
// Los datos de cada libro (título, autor, precio, sinopsis, stock...)
// viven en la base de datos MySQL (database/biblo.sql) y llegan con
// loadCatalog(). Aquí queda solo lo visual: la "atmósfera" (el efecto y la
// paleta que se activan al abrirlo), la intro, los bordes y el lomo.
// Un libro nuevo en la base de datos aparece en el estante con un aspecto
// por defecto; para darle el suyo, añade aquí un objeto con su mismo id y,
// opcionalmente, un nuevo preset en ATMOSPHERES (ver src/components/Atmosphere.jsx).

import { api } from '../api'

export const ATMOSPHERES = {
  maldito: {
    label: 'Maldito',
    bg: 'radial-gradient(120% 100% at 50% 0%, #3a1210 0%, #170708 60%, #0a0404 100%)',
    particle: '#b23b30',
    glow: '#e3564a',
  },
  tormenta: {
    label: 'Tormenta',
    bg: 'radial-gradient(120% 100% at 50% 0%, #2b3440 0%, #141b24 55%, #070a0e 100%)',
    particle: '#aebdcc',
    glow: '#e8eefc',
  },
  // Don Quijote: La Mancha al atardecer, con los campos de trigo y los
  // molinos pintados por debajo (src/components/manchaScene.js)
  mancha: {
    label: 'La Mancha',
    bg: 'linear-gradient(180deg, #0f1730 0%, #2a3452 40%, #8a7270 60%, #6f5232 66%, #22180f 100%)',
    particle: '#f3dca4',
    glow: '#f2c46e',
  },
  presion: {
    label: 'Presión',
    bg: 'radial-gradient(120% 100% at 50% 0%, #0e3532 0%, #071c1c 55%, #030d0d 100%)',
    particle: '#4fd8c4',
    glow: '#8ff2e2',
  },
  // IT: oscuridad de alcantarilla y globos rojos que suben
  globos: {
    label: 'Globos',
    bg: 'radial-gradient(120% 100% at 50% 100%, #3d0d12 0%, #180508 55%, #070203 100%)',
    particle: '#d8282f',
    glow: '#ff5a5f',
  },
  cosmos: {
    label: 'Cosmos',
    bg: 'radial-gradient(120% 100% at 50% 0%, #241a3d 0%, #120c22 55%, #07050f 100%)',
    particle: '#cfd6ff',
    glow: '#ffffff',
  },
  // El Principito: noche azul y estrellas doradas, como su portada
  asteroide: {
    label: 'Estrellas',
    bg: 'radial-gradient(120% 100% at 50% 0%, #2c3f73 0%, #16204a 55%, #090d22 100%)',
    particle: '#f5d533',
    glow: '#fff3b0',
  },
  // Alicia: un atardecer violeta del País de las Maravillas, con pétalos al
  // viento (oscuro para que la ficha se lea, pero con color)
  maravillas: {
    label: 'Maravillas',
    bg: 'radial-gradient(120% 95% at 30% 0%, #563a8c 0%, #2a2466 46%, #14112f 100%)',
    particle: '#ff9ec9',
    glow: '#ffd98a',
  },
  // El Cid: el campo de flores de su entrada, bajo un cielo nublado
  // (src/components/cidScene.js)
  cid: {
    label: 'Campo de flores',
    bg: 'linear-gradient(180deg, #36413e 0%, #65706a 30%, #aeb2a3 42%, #435a2a 60%, #1e2a14 100%)',
    particle: '#c8322a',
    glow: '#e8c46a',
  },
  // Harry Potter: Hogwarts de noche, como en su portada (src/components/hogwartsScene.js)
  hogwarts: {
    label: 'Hogwarts',
    bg: 'linear-gradient(180deg, #08182a 0%, #15374b 40%, #2f6571 70%, #06171b 100%)',
    particle: '#fff1c2',
    glow: '#ffd65c',
  },
  lluvia: {
    label: 'Lluvia',
    bg: 'radial-gradient(80% 60% at 65% 30%, #3a2c17 0%, #1a2028 45%, #0a0d10 100%)',
    particle: '#9fb3c8',
    glow: '#ffc978',
  },
}

const books = [
  {
    id: 'the-book-of-bill',
    atmosphere: 'maldito',
    special: 'billDeal',
    edges: 'cipherWheel',
    spine: { height: 0.94, width: 96 },
    ambientLabel: 'EL SELLO SE ABRE SOLO, UNA Y OTRA VEZ, SIN IMPORTAR CUÁNTAS VECES LO CIERRES',
  },
  {
    // id heredado de "El canto de Ragnarök": así no se pierde el progreso guardado
    id: 'ragnarok',
    atmosphere: 'cid',
    special: 'cidRest',
    spine: { height: 0.86, width: 84 },
    ambientLabel: 'EL VIENTO PEINA EL CAMPO DE FLORES DONDE EL CAMPEADOR SE DETUVO A RECOBRAR EL ALIENTO',
  },
  {
    // id heredado de "Las dunas de hierro": así no se pierde el progreso guardado
    id: 'dunas-de-hierro',
    atmosphere: 'mancha',
    special: 'quijoteRide',
    spine: { height: 0.92, width: 100 },
    ambientLabel: 'EL VIENTO PEINA EL TRIGO, Y EN LA LOMA LOS MOLINOS AGITAN LOS BRAZOS COMO GIGANTES',
  },
  {
    id: 'abisal',
    atmosphere: 'presion',
    special: 'cthulhuRising',
    edges: 'tentacles',
    spine: { height: 0.9, width: 70 },
    ambientLabel: 'ALGO ANTIGUO SUEÑA BAJO LAS OLAS, Y LAS PÁGINAS SE HUMEDECEN CON CADA LÍNEA',
  },
  {
    // id heredado de "Ceniza y corona": así no se pierde el progreso guardado
    id: 'ceniza-y-corona',
    atmosphere: 'globos',
    special: 'redBalloon',
    edges: 'paperBoat',
    spine: { height: 0.86, width: 98 },
    // letra del lomo en blanco, como en la portada: el rojo se perdía sobre ella
    spineInk: '#fbf4e6',
    ambientLabel: 'UN GLOBO ROJO SUBE DESDE LA ALCANTARILLA, Y NADIE MÁS PARECE VERLO',
  },
  {
    // id heredado del libro anterior: así no se pierde el progreso guardado
    id: 'orbita-muerta',
    atmosphere: 'asteroide',
    special: 'desertToAsteroid',
    edges: 'asteroid',
    spine: { height: 0.88, width: 80 },
    ambientLabel: 'CUANDO MIRES EL CIELO DE NOCHE, TODAS LAS ESTRELLAS PARECERÁN REÍR',
  },
  {
    // id heredado de "El jardín de los hongos lentos": así no se pierde el progreso guardado
    id: 'jardin-hongos-lentos',
    atmosphere: 'maravillas',
    special: 'wonderland',
    edges: 'cheshire',
    spine: { height: 0.96, width: 88 },
    ambientLabel: 'UNA SONRISA SIN GATO FLOTA ENTRE LAS PÁGINAS, MUCHO DESPUÉS DE QUE EL GATO SE HAYA IDO',
  },
  {
    // id heredado de "Lluvia sobre el nombre falso": así no se pierde el progreso guardado
    id: 'lluvia-nombre-falso',
    atmosphere: 'hogwarts',
    special: 'hogwartsLetter',
    spine: { height: 0.9, width: 92 },
    ambientLabel: 'EN EL CASTILLO SIGUEN ENCENDIDAS LAS VENTANAS, Y DE VEZ EN CUANDO UNA LECHUZA CRUZA EL LAGO CON UNA CARTA',
  },
]



export const SHELVES = [
  {
    id: 'a',
    name: 'Estantería A',
    subtitle: 'Mundos que se desatan',
  },
  {
    id: 'b',
    name: 'Estantería B',
    subtitle: 'Mundos que esperan',
    note: 'No consultar dos volúmenes a la vez. Los mundos pueden mezclarse de formas inesperadas.',
  },
]

// Aspecto de un libro que solo existe en la base de datos
const DEFAULT_LOOK = {
  atmosphere: 'cosmos',
  spine: { height: 0.9, width: 80 },
  ambientLabel: 'UN VOLUMEN RECIÉN LLEGADO ESPERA SU TURNO EN EL ESTANTE',
}

// Trae el catálogo de la base de datos y lo vuelca en `books`. Los objetos
// se rellenan en su sitio (no se sustituyen) porque varias escenas guardan
// una referencia a su libro desde que se carga la página. Se vuelve a
// llamar tras una compra para refrescar el stock.
export async function loadCatalog() {
  const rows = await api('libros.php')
  const byId = new Map(books.map((b) => [b.id, b]))
  const merged = rows.map((row) =>
    Object.assign(byId.get(row.id) ?? { ...DEFAULT_LOOK, spine: { ...DEFAULT_LOOK.spine } }, row)
  )
  books.splice(0, books.length, ...merged)
}

export function booksByShelf(shelfId) {
  return books.filter((b) => b.shelf === shelfId)
}

// Precios ficticios: forman parte de la ficción de la tienda.
export function formatPrice(value) {
  return `$${value.toFixed(2)}`
}

export default books
