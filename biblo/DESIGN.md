# Biblo: sistema visual

Mundo: **la sala de lectura**. Los libros se guardan de lomo en un mueble de madera tinta; al sacar uno, su atmósfera se escapa y se abre en una escena a pantalla completa.

## Color (fijado por el autor; no cambiar)

| Token | Valor | Uso |
|---|---|---|
| `--cream-1` | `#efe7d6` | fondo de la página |
| `--cream-0` / `--paper` | `#f6f0e3` / `#f8f2e6` | fichas, carrito, notas de papel |
| `--ink-0` | `#5b4630` | texto, botones primarios y madera (`--wood`) |
| `--ink-1` | `#8a7256` | solo para texto grande (la cursiva de "viva") |
| `--wood-deep` | `#3e2f20` | fondo interior de las baldas y hover de los botones |
| `--brass-hi` / `--brass-lo` / `--brass-ink` | `#f4d78c` / `#b8863a` / `#3a2a12` | placas de las estanterías, marcapáginas de "explorado", logro |
| `--night-text` | `#fbf4e6` | texto sobre las escenas oscuras |
| `ATMOSPHERES[*]` | en `src/data/books.js` | fondo (`bg`), partícula (`particle`) y brillo (`glow`) de cada mundo; también pintan el lomo |

El texto pequeño va siempre en `--ink-0`, porque `--ink-1` y `--ink-2` no llegan a 4.5:1 sobre el crema.

## Tipografía

- **IM Fell English** (display): títulos, lomos, nombres de las estanterías. Tamaño máximo 6rem, tracking -0.02em.
- **Alegreya** (texto): párrafos, descripciones, citas.
- **Courier Prime** (datos): signaturas, precios, contadores; siempre con `tabular-nums`.

Las fuentes se sirven desde el proyecto (`@fontsource/*`, importadas en `main.jsx`), así que la página funciona sin conexión.

## Forma e iconos

- Esquinas: todos los botones y las fichas usan 4px; los paneles grandes (mueble), 10px. El redondo completo se reserva para los botones que solo llevan icono (como cerrar o +/−).
- Iconos de interfaz de Phosphor (`@phosphor-icons/react`, peso regular), centralizados en `Icons.jsx`. El búho es el logotipo, no un icono.
- Como separador, como mucho un punto medio por línea; las signaturas de los libros ya lo incluyen.

## Componentes

- **Lomo** (`.spine`): ancho y alto por libro (`spine` en los datos), con el degradado de su atmósfera, el título en vertical y dos filetes en el color glow. En estado activo sube 18px y proyecta un halo de su color. Los libros explorados llevan un marcapáginas de latón.
- **Ficha de precio** (`.tag`): papel colgado de un hilo bajo el libro activo, con signatura, título, precio y los botones Abrir y Añadir. En pantallas estrechas pasa a ir debajo del mueble, sin hilo.
- **Escena** (`.scene`): se abre con un `clip-path` circular que crece desde el lomo. Lleva la portada inclinada en 3D, el texto entrando escalonado, el modo inmersión (oculta la ficha) y la compra.
- **Carrito** (`.drawer`): panel lateral de papel con las cantidades y el total. Es de demostración y no cobra nada.

## Movimiento

- Curva base `--ease-out: cubic-bezier(0.16, 1, 0.3, 1)`.
- El momento estrella es la apertura del libro. Lo demás es contenido: el lomo que sale, la ficha que se balancea y las chispas del lomo activo (`ShelfSparks`).
- Motor de atmósferas (`Atmosphere.jsx`): partículas en tres profundidades con paralaje y reacción al cursor (repulsión, o atracción en "maldito"). Halos pre-renderizados en lugar de `shadowBlur`, expansión inicial desde el centro y efectos propios de cada mundo (relámpagos, salpicaduras, estrellas fugaces, rayos de luz, calor, viñeta).
- Con `prefers-reduced-motion` se dibuja un solo fotograma estático y las transiciones se anulan.

## Intocable

`BillDeal.jsx` / `BillDeal.css`: la escena del trato de Bill Cipher.
