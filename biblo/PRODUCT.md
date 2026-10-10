# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Visitantes de una tienda/biblioteca virtual de libros ficticios. En la práctica: compañeros y profesores que evalúan un proyecto escolar, navegando en local desde un navegador de escritorio (y ocasionalmente móvil).

## Product Purpose

Biblo es una biblioteca virtual que también es tienda. Su diferencia: cada libro, al abrirse, despliega una pequeña escena o animación que hace referencia a ese libro (una "atmósfera" de partículas propia). El éxito es que el visitante quiera abrir todos los libros, y que la página se sienta viva y profesional.

## Positioning

Una tienda de libros donde abrir un volumen es entrar a su mundo: cada libro tiene su propia atmósfera animada, y el Libro de Bill tiene una escena interactiva propia (un "trato" con video y elección SÍ/NO).

## Operating Context

- Proyecto escolar; se ejecuta en local (Vite + React) y probablemente nunca se publique.
- Se presenta/evalúa abriendo libros uno a uno.

## Capabilities and Constraints

- 8 libros en dos estanterías (A y B), definidos en `src/data/books.js`.
- Al abrir un libro: modal con atmósfera de partículas propia (8 tipos: maldito, tormenta, arena, presión, fuego, cosmos, esporas, lluvia).
- Libro de Bill: abre la escena "trato" (`BillDeal`: video `trato.mp4`, botones SÍ/NO, texto final, glitch). Después muestra la ficha del propio Libro de Bill.
- Easter egg: abrir todos los libros desbloquea el logro "Trotamundos" (toast estilo Steam), persistido en localStorage.
- Tienda: precios y carrito simple, solo visual; no hay pagos reales.
- `terror.mp3` falta en `/public` (el código lo tolera).

## Brand Commitments

- Nombre: Biblo, "La biblioteca viva". Logo: búho de línea.
- **Colores fijados por el usuario:** paleta crema/tinta marrón (`--cream-*`, `--ink-*`, `--paper`) y la paleta de cada atmósfera en `ATMOSPHERES`. No se cambian.
- **No tocar:** la animación de Bill Cipher (`BillDeal.jsx` / `BillDeal.css`).
- Las funciones principales (atmósfera de partículas por libro, escena de Bill, logro) se conservan; el motor de partículas puede reescribirse manteniendo su función.
- Voz: textos en español, tono literario, misterioso y con humor seco (ver descripciones y citas de los libros).

## Evidence on Hand

- Portada real solo para el Libro de Bill: `public/covers/libro-de-bill.jpg`.
- Video de la escena de Bill: `public/trato.mp4`.
- Los textos de los libros (descripciones, citas, signaturas) son contenido autoral existente.
- No existen precios reales: los precios de la tienda son ficticios y forman parte de la ficción del proyecto.

## Product Principles

1. Abrir un libro es el momento estrella; todo en la página invita a hacerlo.
2. Cada libro es un mundo propio: su atmósfera debe sentirse distinta e inconfundible.
3. Vivo pero no ruidoso: el movimiento sirve a la inmersión, no la distrae.
4. Lo que ya funciona (Bill, logro, atmósferas) se respeta y se eleva, no se reemplaza.
