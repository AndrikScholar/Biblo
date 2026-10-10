---
version: 1
slug: "src-app-jsx"
primary_target: "src/App.jsx"
related_targets: ["src/components/BookModal.jsx"]
---

Scope: página principal de Biblo (App.jsx y componentes) más la escena del libro abierto (BookModal + Atmosphere). Modo: Experience, con tienda (carrito visual).

Audiencia: compañeros y profesores que evalúan el proyecto escolar en local. Acción: abrir libros (y añadirlos al carrito). Restricciones: paleta crema/tinta y ATMOSPHERES fijas; BillDeal intacto; logro Trotamundos conservado.

## Direction contract

THESIS: Biblo es una estantería de verdad. Rechaza la cuadrícula de tarjetas sobre fondo plano: los libros viven de lomo en baldas de madera tinta, y sacar uno es el gesto que abre su mundo.

OWN-WORLD: suelo crema (#efe7d6 / #f6f0e3), mueble de madera tinta (#5b4630 y su sombra #3e2f20), lomos pintados con el degradado de su atmósfera, letras de lomo en el color glow de cada mundo. Tipos: IM Fell English (display, imprenta antigua), Alegreya (texto), Courier Prime solo para signaturas y precios (dato de catálogo). Ficha de papel #f8f2e6 colgada del libro activo.

STORY: el visitante entiende en un vistazo que cada lomo es un mundo con precio, pasa el ratón y ve el libro salir y su atmósfera escaparse, lo abre (escena a pantalla completa con partículas vivas) o lo añade al carrito, y el contador de logros le invita a abrirlos todos.

FIRST VIEWPORT: barra superior fina (búho + Biblo a la izquierda; progreso de logro y carrito a la derecha). Debajo, a la izquierda, "La biblioteca viva" a ~8rem en dos líneas; a la derecha un párrafo corto. Ocupando la mitad inferior, la estantería: mueble de madera a ancho completo con dos tramos (A y B) separados por un montante, 8 lomos de alturas distintas sobre la balda; el lomo activo sobresale hacia el visitante con su halo de atmósfera, y su ficha (signatura, título, precio, Abrir / Añadir) flota encima. Acción primaria: clic en el lomo / "Abrir".

FORM: La sala de lectura, posición 1 de la lista ordenada; clave de la tirada 6d6e4dc6.

Signature interaction: al pasar el ratón un lomo se desliza hacia fuera y suelta partículas de su atmósfera sobre la balda; al hacer clic, el lomo crece hasta convertirse en la escena del libro (transición con clip-path), donde un motor de partículas por capas reacciona al cursor.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
