// Catálogo de Biblo.
// Cada libro define su propia "atmósfera": el efecto y la paleta que
// se activan al abrirlo. Para añadir un libro nuevo solo hace falta
// un objeto más aquí y, opcionalmente, un nuevo preset en ATMOSPHERES
// (ver src/components/Atmosphere.jsx).

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
  arena: {
    label: 'Arena',
    bg: 'radial-gradient(120% 100% at 50% 10%, #4a3520 0%, #241a10 55%, #100b07 100%)',
    particle: '#c9a267',
    glow: '#e8c88f',
  },
  presion: {
    label: 'Presión',
    bg: 'radial-gradient(120% 100% at 50% 0%, #0e3532 0%, #071c1c 55%, #030d0d 100%)',
    particle: '#4fd8c4',
    glow: '#8ff2e2',
  },
  fuego: {
    label: 'Fuego',
    bg: 'radial-gradient(120% 100% at 50% 100%, #4a1f08 0%, #200d04 55%, #0d0502 100%)',
    particle: '#f2984a',
    glow: '#ffd27a',
  },
  cosmos: {
    label: 'Cosmos',
    bg: 'radial-gradient(120% 100% at 50% 0%, #241a3d 0%, #120c22 55%, #07050f 100%)',
    particle: '#cfd6ff',
    glow: '#ffffff',
  },
  esporas: {
    label: 'Esporas',
    bg: 'radial-gradient(120% 100% at 50% 100%, #17321c 0%, #0b190e 55%, #050c06 100%)',
    particle: '#7fd88a',
    glow: '#b6f2bd',
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
    shelf: 'a',
    title: 'The Book of Bill',
    signature: 'X-666 · CIP',
    author: null,
    year: null,
    provenance: 'procedencia incierta',
    atmosphere: 'maldito',
    description:
      'Se vende como autoayuda. La faja dice bestseller, el sello de cera dice otra cosa. Cada lector jura haberlo comprado por accidente, y cada uno lo recomienda a alguien más antes de terminar el primer capítulo.',
    ambientLabel: 'EL SELLO SE ABRE SOLO, UNA Y OTRA VEZ, SIN IMPORTAR CUÁNTAS VECES LO CIERRES',
    quote:
      'Paso uno: pide un deseo pequeño. Paso dos: agradece en voz alta. Paso tres: no leas el paso cuatro.',
  },
  {
    id: 'ragnarok',
    shelf: 'a',
    title: 'El canto de Ragnarök',
    signature: 'N-411 · HAL',
    author: 'Sigrid Halvorsen',
    year: '1998',
    atmosphere: 'tormenta',
    description:
      'Un cuaderno de bitácora que ningún tripulante reclamó jamás. Narra la misma travesía siete veces, con siete finales distintos, y en las siete el barco llega a puerto sin nadie a bordo.',
    ambientLabel: 'LA TORMENTA CRUZA LA PÁGINA Y MOJA LOS DEDOS QUE LA SOSTIENEN',
    quote:
      'Día 1: buen viento. Día 40: buen viento. Día 94: buen viento, capitán, buen viento, seguimos con buen viento.',
  },
  {
    id: 'dunas-de-hierro',
    shelf: 'a',
    title: 'Las dunas de hierro',
    signature: 'N-208 · ALQ',
    author: 'D. Alquézar',
    year: '1972',
    atmosphere: 'arena',
    description:
      'La caravana lleva cuarenta años cruzando la misma duna. El motor no se ha apagado nunca. Los pasajeros que se bajaron a caminar un momento nunca lograron alcanzarla de nuevo.',
    ambientLabel: 'LA ARENA SALE DEL LOMO Y SE ACUMULA EN LOS PLIEGUES DEL PAPEL',
    quote:
      'Kilómetro 1140: nada. Kilómetro 1141: nada. Kilómetro 1142: alguien golpea el casco desde fuera, pidiendo que lo dejen subir de nuevo.',
  },
  {
    id: 'abisal',
    shelf: 'a',
    title: 'Abisal',
    signature: 'N-733 · MON',
    author: 'Elena Montoya',
    year: '2003',
    atmosphere: 'presion',
    description:
      'Transcripción de grabaciones hechas a nueve mil metros de profundidad. En la página 12 alguien enciende una vela. En la página 200 siguen ardiendo, aunque ahí abajo eso no debería ser posible.',
    ambientLabel: 'LA PRESIÓN AUMENTA CON CADA PÁGINA; RESPIRA HONDO ANTES DE SEGUIR',
    quote:
      'Profundidad 9.014 metros. Temperatura: 2°C. La vela sigue encendida. No hay oxígeno suficiente para eso. Volver a revisar.',
  },
  {
    id: 'ceniza-y-corona',
    shelf: 'a',
    title: 'Ceniza y corona',
    signature: 'N-102 · BAI',
    author: 'Rhys Baird',
    year: '1889',
    atmosphere: 'fuego',
    description:
      'Cada monarca de este reino fue coronado con fuego real. El dragón que presta las llamas recuerda el nombre de todos, incluso los que el reino mismo ha olvidado.',
    ambientLabel: 'EL CALOR SUBE DESDE LA ENCUADERNACIÓN COMO SI ALGO AÚN ARDIERA DENTRO',
    quote:
      'Coronación 1: Aldric, fuego blanco. Coronación 40: Aldric, fuego blanco otra vez. El dragón no ha olvidado a ninguno; el reino sí.',
  },
  {
    id: 'orbita-muerta',
    shelf: 'b',
    title: 'Órbita muerta',
    signature: 'N-909 · ROM',
    author: 'Anders Røm',
    year: '2016',
    atmosphere: 'cosmos',
    description:
      'La estación Vøring lleva doce años emitiendo el mismo informe de mantenimiento cada 94 minutos. Røm transcribe los 61.000 informes completos. Los capítulos impares son la transcripción; los pares, lo que se fue rompiendo mientras tanto.',
    ambientLabel: 'EL CAMPO DE ESTRELLAS SE ABRE DESDE EL CENTRO DEL VOLUMEN',
    quote:
      'Informe 40.112: todo correcto. Informe 40.113: todo correcto. Informe 40.114: todo correcto, pero ya no somos cuatro.',
  },
  {
    id: 'jardin-hongos-lentos',
    shelf: 'b',
    title: 'El jardín de los hongos lentos',
    signature: 'N-580 · CHE',
    author: 'Mei Cheng',
    year: '2011',
    atmosphere: 'esporas',
    description:
      'Un jardín que crece un milímetro cada siglo. Las esporas conservan el sonido de la última conversación que alguien tuvo cerca de ellas; algunas datan de antes de que existiera el lenguaje.',
    ambientLabel: 'LAS ESPORAS TARDAN AÑOS EN CRUZAR LA HABITACIÓN; QUÉDATE QUIETO',
    quote:
      'Se escucha una risa, muy despacio, estirada a lo largo de trescientos años. Todavía no termina de reírse.',
  },
  {
    id: 'lluvia-nombre-falso',
    shelf: 'b',
    title: 'Lluvia sobre el nombre falso',
    signature: 'N-345 · SER',
    author: 'Vera Serrano',
    year: '1956',
    atmosphere: 'lluvia',
    description:
      'Cuatro testigos describen al mismo hombre bajo la misma farola, y ninguno da el mismo nombre. El expediente lleva doce años abierto. Sigue lloviendo en cada página, incluso en las fotocopias.',
    ambientLabel: 'LA LLUVIA EMPIEZA EN LA PÁGINA CINCO Y NO SE DETIENE HASTA QUE CIERRAS EL LIBRO',
    quote:
      'Testigo 1: se llamaba Marco. Testigo 2: nunca dio su nombre. Testigo 3: se llamaba Marco, pero no el mismo Marco. Testigo 4: llovía demasiado para ver bien.',
  },
]

export const SHELVES = [
  {
    id: 'a',
    name: 'Estantería A',
    tags: ['Tormenta', 'Arena', 'Presión', 'Fuego', 'Maldito'],
  },
  {
    id: 'b',
    name: 'Estantería B',
    tags: [],
    note: 'No consultar dos volúmenes a la vez. Los mundos pueden mezclarse de formas inesperadas.',
  },
]

export function booksByShelf(shelfId) {
  return books.filter((b) => b.shelf === shelfId)
}

export default books
