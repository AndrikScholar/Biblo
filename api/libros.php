<?php
// GET: el catálogo, en el orden del estante y con los nombres de campo
// que usa la página.
require 'comun.php';

$libros = db()->query(
  'SELECT id, estante AS shelf, titulo AS title, autor AS author, anio AS year, genero AS genre,
          procedencia AS provenance, signatura AS signature, portada AS cover,
          precio AS price, descripcion AS description, cita AS quote, stock
   FROM libros ORDER BY orden'
)->fetchAll();

foreach ($libros as &$libro) {
  $libro['price'] = (float) $libro['price'];
  $libro['stock'] = (int) $libro['stock'];
}

responder($libros);
