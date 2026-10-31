<?php
// Gestión del catálogo (solo administración).
// GET: todos los libros con todos sus campos.
// POST { accion: 'guardar', libro: {...} }: crea (sin id) o edita (con id).
// POST { accion: 'eliminar', id }
require 'comun.php';
requiere_admin();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
  $libros = db()->query('SELECT * FROM libros ORDER BY orden')->fetchAll();
  foreach ($libros as &$l) {
    $l['precio'] = (float) $l['precio'];
    $l['stock'] = (int) $l['stock'];
  }
  responder($libros);
}

$e = entrada();

if (($e['accion'] ?? '') === 'eliminar') {
  $usado = db()->prepare('SELECT 1 FROM detalle_pedido WHERE libro_id = ? LIMIT 1');
  $usado->execute([$e['id'] ?? '']);
  if ($usado->fetch()) {
    fallar('Este libro ya aparece en pedidos y borrarlo rompería su historial. Para dejar de venderlo, pon su stock en 0.', 409);
  }
  db()->prepare('DELETE FROM libros WHERE id = ?')->execute([$e['id'] ?? '']);
  responder(null);
}

if (($e['accion'] ?? '') !== 'guardar') fallar('Acción desconocida.');

$l = array_map(fn ($v) => is_string($v) ? trim($v) : $v, $e['libro'] ?? []);
$opcional = fn ($campo) => ($l[$campo] ?? '') === '' ? null : $l[$campo];

if (($l['titulo'] ?? '') === '') fallar('El libro necesita un título.');
if (($l['signatura'] ?? '') === '') fallar('El libro necesita una signatura (p. ej. X-666 · CIP).');
if (($l['descripcion'] ?? '') === '') fallar('Escribe la sinopsis.');
if (!in_array($l['genero'] ?? '', ['terror', 'fantasía', 'aventura'], true)) fallar('Elige un género.');
if (!in_array($l['estante'] ?? '', ['a', 'b'], true)) fallar('Elige la estantería A o B.');
if (!is_numeric($l['precio'] ?? null) || $l['precio'] < 0) fallar('El precio debe ser un número positivo.');
if (filter_var($l['stock'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 0]]) === false) {
  fallar('El stock debe ser un número entero, 0 o más.');
}

$datos = [
  $l['estante'], $l['genero'], $l['titulo'], $opcional('autor'), $opcional('anio'), $opcional('procedencia'),
  $l['signatura'], $opcional('portada'), round($l['precio'], 2), $l['descripcion'], $opcional('cita'), (int) $l['stock'],
];

if (!empty($l['id'])) {
  $editar = db()->prepare(
    'UPDATE libros SET estante = ?, genero = ?, titulo = ?, autor = ?, anio = ?, procedencia = ?,
                       signatura = ?, portada = ?, precio = ?, descripcion = ?, cita = ?, stock = ?
     WHERE id = ?'
  );
  $editar->execute([...$datos, $l['id']]);
  responder(['id' => $l['id']]);
}

// libro nuevo: el id sale del título ("La Odisea" → "la-odisea") y va al final del estante
$base = trim(preg_replace('/[^a-z0-9]+/', '-', strtolower(strtr($l['titulo'], [
  'á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u', 'ü' => 'u', 'ñ' => 'n',
  'Á' => 'a', 'É' => 'e', 'Í' => 'i', 'Ó' => 'o', 'Ú' => 'u', 'Ü' => 'u', 'Ñ' => 'n',
]))), '-') ?: 'libro';
$base = substr($base, 0, 34);
$id = $base;
$existe = db()->prepare('SELECT 1 FROM libros WHERE id = ?');
for ($n = 2; $existe->execute([$id]) && $existe->fetch(); $n++) $id = "$base-$n";

db()->prepare(
  'INSERT INTO libros (estante, genero, titulo, autor, anio, procedencia, signatura, portada, precio,
                       descripcion, cita, stock, id, orden)
   SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(MAX(orden), 0) + 1 FROM libros'
)->execute([...$datos, $id]);
responder(['id' => $id], 201);
