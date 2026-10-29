<?php
// GET: las direcciones del usuario, la predeterminada primero.
// POST: guarda una nueva (la primera queda como predeterminada).
require 'comun.php';
$uid = usuario_id();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
  $consulta = db()->prepare(
    'SELECT * FROM direcciones WHERE usuario_id = ? ORDER BY predeterminada DESC, id DESC'
  );
  $consulta->execute([$uid]);
  responder($consulta->fetchAll());
}

$e = array_map(fn ($v) => is_string($v) ? trim($v) : $v, entrada());
foreach (['destinatario', 'calle', 'num_exterior', 'colonia', 'ciudad', 'estado'] as $campo) {
  if (($e[$campo] ?? '') === '') fallar('Completa todos los campos obligatorios.');
}
if (!preg_match('/^\d{5}$/', $e['codigo_postal'] ?? '')) fallar('El código postal tiene 5 dígitos.');
$telefono = preg_replace('/\D/', '', $e['telefono'] ?? '');
if (strlen($telefono) !== 10) fallar('El teléfono tiene 10 dígitos.');

$cuantas = db()->prepare('SELECT COUNT(*) FROM direcciones WHERE usuario_id = ?');
$cuantas->execute([$uid]);

db()->prepare(
  'INSERT INTO direcciones (usuario_id, destinatario, calle, num_exterior, num_interior, colonia,
                            codigo_postal, ciudad, estado, telefono, referencias, predeterminada)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
)->execute([
  $uid, $e['destinatario'], $e['calle'], $e['num_exterior'], ($e['num_interior'] ?? '') ?: null,
  $e['colonia'], $e['codigo_postal'], $e['ciudad'], $e['estado'], $telefono,
  ($e['referencias'] ?? '') ?: null, $cuantas->fetchColumn() == 0 ? 1 : 0,
]);

$nueva = db()->prepare('SELECT * FROM direcciones WHERE id = ?');
$nueva->execute([db()->lastInsertId()]);
responder($nueva->fetch(), 201);
