# Biblo — la biblioteca viva

Proyecto React + Vite. Reconstrucción del sitio desde cero: sin dependencias
sueltas, con un catálogo de libros centralizado y un sistema de "atmósferas"
reutilizable para los efectos de cada volumen.

## Poner en marcha

```bash
npm install
npm run dev
```

Abre la URL que muestre la terminal (normalmente `http://localhost:5173`).

Para generar la versión de producción:

```bash
npm run build
npm run preview
```

## Estructura

```
src/
  data/books.js          catálogo: libros, estanterías y paletas de atmósfera
  components/
    Hero.jsx              cabecera con el logotipo y la bajada
    Shelf.jsx              una estantería (título, etiquetas o nota, libros)
    BookCard.jsx            portada + título + signatura en la estantería
    BookModal.jsx          vista de un volumen abierto (ficha + inmersión)
    Atmosphere.jsx          el lienzo de partículas detrás de cada modal
  App.jsx                  arma estanterías + abre/cierra el modal
  App.css / index.css      estilos
```

## Añadir un libro nuevo

Edita `src/data/books.js` y agrega un objeto al array `books`:

```js
{
  id: 'mi-libro',
  shelf: 'a',                 // 'a' o 'b' — o crea una nueva en SHELVES
  title: 'Mi libro',
  signature: 'N-123 · ABC',
  author: 'Nombre Autor',
  year: '2024',
  atmosphere: 'fuego',        // ver ATMOSPHERES en el mismo archivo
  description: 'Texto de la ficha (índice de catálogo).',
  ambientLabel: 'FRASE CORTA QUE DESCRIBE EL EFECTO',
  quote: 'Fragmento inmersivo que aparece al abrir el libro.',
}
```

Si quieres una atmósfera nueva (no solo un color distinto, sino un
comportamiento de partículas distinto), agrega un preset en `CONFIGS` dentro
de `src/components/Atmosphere.jsx` y su paleta correspondiente en
`ATMOSPHERES` en `books.js`.

## Notas

- Las portadas son tipografía + gradiente (CSS), no ilustraciones — así el
  proyecto no depende de ninguna imagen externa. Si luego quieres portadas
  ilustradas, puedes sustituir `.book-cover` por una imagen de fondo por
  libro sin tocar el resto del sistema.
- El logotipo del búho en `Hero.jsx` es un trazo simple de relleno, pensado
  como marcador de posición — cámbialo por tu logo real cuando lo tengas.
- El modal respeta `prefers-reduced-motion`: si el sistema del visitante lo
  pide, las partículas no se animan.
