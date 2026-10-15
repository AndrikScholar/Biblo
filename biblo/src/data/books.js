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
    shelf: 'a',
    title: 'Libro de Bill',
    signature: 'X-666 · CIP',
    author: null,
    year: null,
    provenance: 'procedencia incierta',
    atmosphere: 'maldito',
    special: 'billDeal',
    edges: 'cipherWheel',
    cover: '/covers/libro-de-bill.jpg',
    price: 6.66,
    spine: { height: 0.94, width: 96 },
    description:
      'Se vende como autoayuda. La faja dice bestseller, el sello de cera dice otra cosa. Cada lector jura haberlo comprado por accidente, y cada uno lo recomienda a alguien más antes de terminar el primer capítulo.',
    ambientLabel: 'EL SELLO SE ABRE SOLO, UNA Y OTRA VEZ, SIN IMPORTAR CUÁNTAS VECES LO CIERRES',
    quote:
      'Paso uno: pide un deseo pequeño. Paso dos: agradece en voz alta. Paso tres: no leas el paso cuatro.',
  },
  {
    // id heredado de "El canto de Ragnarök": así no se pierde el progreso guardado
    id: 'ragnarok',
    shelf: 'a',
    title: 'El Cantar del mío Cid',
    // 207: la copia de Per Abbat (1207), el único manuscrito que se conserva
    signature: 'C-207 · ABB',
    author: 'Anónimo',
    year: 'c. 1200',
    atmosphere: 'cid',
    special: 'cidRest',
    cover: '/covers/mio-cid.webp',
    // 12,07: el año de esa copia
    price: 12.07,
    spine: { height: 0.86, width: 84 },
    description:
      'Acusado ante el rey Alfonso VI por la envidia de algunos nobles, Rodrigo Díaz de Vivar, el Cid Campeador, es desterrado de Castilla. Con solo nueve días para abandonar el reino, deja a su mujer, doña Jimena, y a sus dos hijas en el monasterio de San Pedro de Cardeña, y parte con un puñado de fieles a ganarse el pan y la honra con su espada, sin dejar de buscar el perdón de su señor. Es el poema épico más antiguo que se conserva de la literatura española: un cantar de gesta anónimo, compuesto hacia 1200, que nos ha llegado en una única copia firmada por Per Abbat en 1207 y que no se imprimió hasta 1779.',
    ambientLabel: 'EL VIENTO PEINA EL CAMPO DE FLORES DONDE EL CAMPEADOR SE DETUVO A RECOBRAR EL ALIENTO',
    quote: '¡Dios, qué buen vassallo, si oviesse buen señore!',
  },
  {
    // id heredado de "Las dunas de hierro": así no se pierde el progreso guardado
    id: 'dunas-de-hierro',
    shelf: 'a',
    title: 'Don Quijote de la Mancha',
    // 30: los «treinta, o pocos más, desaforados gigantes» que ve en los molinos
    signature: 'G-030 · CER',
    author: 'Miguel de Cervantes',
    year: '1605',
    atmosphere: 'mancha',
    special: 'quijoteRide',
    cover: '/covers/don-quijote.jpg',
    // 16,05: el año en que salió la primera parte
    price: 16.05,
    spine: { height: 0.92, width: 100 },
    description:
      'Un hidalgo manchego lee tantos libros de caballerías que acaba creyéndose uno de sus héroes. Se pone una armadura vieja, llama Rocinante a su caballo flaco, convierte a una labradora del Toboso en la dama de sus pensamientos y sale a los caminos a deshacer agravios. Lo acompaña Sancho Panza, un labrador de su aldea al que ha prometido el gobierno de una ínsula. Donde don Quijote ve gigantes, castillos y ejércitos, Sancho ve molinos, ventas y rebaños de ovejas. Publicada en dos partes, en 1605 y 1615, está considerada la primera novela moderna.',
    ambientLabel: 'EL VIENTO PEINA EL TRIGO, Y EN LA LOMA LOS MOLINOS AGITAN LOS BRAZOS COMO GIGANTES',
    quote:
      'En un lugar de la Mancha, de cuyo nombre no quiero acordarme, no ha mucho tiempo que vivía un hidalgo de los de lanza en astillero, adarga antigua, rocín flaco y galgo corredor.',
  },
  {
    id: 'abisal',
    shelf: 'a',
    title: 'La Llamada de Cthulhu',
    signature: 'N-733 · LOV',
    author: 'H. P. Lovecraft',
    year: '1928',
    atmosphere: 'presion',
    special: 'cthulhuRising',
    edges: 'tentacles',
    cover: '/covers/la-llamada-de-cthulhu.jpg',
    price: 21,
    spine: { height: 0.9, width: 70 },
    description:
      'La obra fundamental de los Mitos de Cthulhu es un relato apasionante que introduce a los lectores a Cthulhu, una entidad extraterrestre de terror grotesco. La búsqueda del narrador para reconstruir las pistas dejadas por su difunto tío sobre la existencia de dicha criatura atrapará y helará la sangre de los lectores hasta el final.',
    ambientLabel: 'ALGO ANTIGUO SUEÑA BAJO LAS OLAS, Y LAS PÁGINAS SE HUMEDECEN CON CADA LÍNEA',
    quote:
      'Ph’nglui mglw’nafh Cthulhu R’lyeh wgah’nagl fhtagn. En su morada de R’lyeh, el difunto Cthulhu espera soñando.',
  },
  {
    // id heredado de "Ceniza y corona": así no se pierde el progreso guardado
    id: 'ceniza-y-corona',
    shelf: 'a',
    title: 'IT',
    signature: 'D-027 · KIN',
    author: 'Stephen King',
    year: '1986',
    atmosphere: 'globos',
    special: 'redBalloon',
    edges: 'paperBoat',
    cover: '/covers/it.webp',
    price: 24.5,
    spine: { height: 0.86, width: 98 },
    // letra del lomo en blanco, como en la portada: el rojo se perdía sobre ella
    spineInk: '#fbf4e6',
    description:
      'En 1958, en el pueblo de Derry, Maine, siete niños marginados que se hacen llamar el Club de los Perdedores descubren que algo vive bajo las calles. Despierta cada veintisiete años, se alimenta de los niños y adopta la forma de lo que más temen, casi siempre la de un payaso llamado Pennywise. Ya adultos y lejos de Derry, una llamada les recuerda una promesa que hicieron de niños y que creían haber olvidado.',
    ambientLabel: 'UN GLOBO ROJO SUBE DESDE LA ALCANTARILLA, Y NADIE MÁS PARECE VERLO',
    quote: 'Todos flotan aquí abajo. Cuando estés aquí abajo conmigo, tú también flotarás.',
  },
  {
    // id heredado del libro anterior: así no se pierde el progreso guardado
    id: 'orbita-muerta',
    shelf: 'b',
    title: 'El Principito',
    signature: 'B-612 · SAI',
    author: 'Antoine de Saint-Exupéry',
    year: '1943',
    atmosphere: 'asteroide',
    special: 'desertToAsteroid',
    edges: 'asteroid',
    cover: '/covers/el-principito.webp',
    price: 19.9,
    spine: { height: 0.88, width: 80 },
    description:
      'Un aviador cae con su avioneta en mitad del desierto del Sahara y, mientras intenta repararla, conoce a un niño de cabellos dorados que dice venir de un asteroide diminuto. El principito le cuenta su viaje por planetas habitados por adultos muy extraños, lo que aprendió de un zorro y por qué no puede olvidar la rosa que dejó en casa. Una fábula sobre la amistad, la pérdida y la mirada de la infancia.',
    ambientLabel: 'CUANDO MIRES EL CIELO DE NOCHE, TODAS LAS ESTRELLAS PARECERÁN REÍR',
    quote: 'Solo se ve bien con el corazón. Lo esencial es invisible a los ojos.',
  },
  {
    // id heredado de "El jardín de los hongos lentos": así no se pierde el progreso guardado
    id: 'jardin-hongos-lentos',
    shelf: 'b',
    title: 'Alicia en el país de las Maravillas',
    // 10/6: el precio escrito en el sombrero del Sombrerero
    signature: 'M-106 · CAR',
    author: 'Lewis Carroll',
    year: '1865',
    atmosphere: 'maravillas',
    special: 'wonderland',
    edges: 'cheshire',
    cover: '/covers/alicia.jpg',
    price: 10.6,
    spine: { height: 0.96, width: 88 },
    description:
      'Una tarde de verano, aburrida a la orilla del río, Alicia ve pasar corriendo a un Conejo Blanco con chaleco que saca un reloj del bolsillo y se lamenta de que llega tarde. Lo sigue hasta una madriguera, cae durante lo que parece una eternidad y llega a un país donde un pastelito puede volverte gigante, un gato desaparece dejando solo su sonrisa y la hora del té no termina nunca. Allí, entre la Oruga, el Sombrerero y la temible Reina de Corazones, nada es lo que parece, empezando por ella misma.',
    ambientLabel: 'UNA SONRISA SIN GATO FLOTA ENTRE LAS PÁGINAS, MUCHO DESPUÉS DE QUE EL GATO SE HAYA IDO',
    quote:
      '—Aquí todos estamos locos. Yo estoy loco, tú estás loca. —¿Cómo sabes que yo estoy loca? —preguntó Alicia. —Tienes que estarlo —dijo el Gato—, o no habrías venido.',
  },
  {
    // id heredado de "Lluvia sobre el nombre falso": así no se pierde el progreso guardado
    id: 'lluvia-nombre-falso',
    shelf: 'b',
    title: 'Harry Potter y la piedra filosofal',
    // 4: el número 4 de Privet Drive, la casa de los Dursley
    signature: 'P-004 · ROW',
    author: 'J. K. Rowling',
    year: '1997',
    atmosphere: 'hogwarts',
    special: 'hogwartsLetter',
    cover: '/covers/harry-potter.jpg',
    // 9,75: el andén nueve y tres cuartos
    price: 9.75,
    spine: { height: 0.9, width: 92 },
    description:
      'Harry Potter lleva diez años viviendo con sus tíos, los Dursley, que lo tratan como un estorbo y lo hacen dormir en la alacena de debajo de la escalera. Poco antes de cumplir once años empiezan a llegarle cartas que sus tíos se empeñan en que no lea, hasta que un hombre enorme llamado Hagrid aparece para contarle la verdad: Harry es un mago y tiene una plaza esperándolo en Hogwarts, el Colegio de Magia y Hechicería. Allí descubre el quidditch, hace amigos de verdad por primera vez y empieza a entender por qué todo el mundo mágico conoce su nombre, y que en algún lugar del castillo se guarda un secreto. Fue la primera novela de J. K. Rowling, publicada en Londres en 1997, y abrió una saga de siete libros.',
    ambientLabel: 'EN EL CASTILLO SIGUEN ENCENDIDAS LAS VENTANAS, Y DE VEZ EN CUANDO UNA LECHUZA CRUZA EL LAGO CON UNA CARTA',
    quote:
      'El señor y la señora Dursley, que vivían en el número 4 de Privet Drive, estaban orgullosos de decir que eran muy normales, afortunadamente.',
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

export function booksByShelf(shelfId) {
  return books.filter((b) => b.shelf === shelfId)
}

// Precios ficticios: forman parte de la ficción de la tienda.
export function formatPrice(value) {
  return `$${value.toFixed(2)}`
}

export default books
