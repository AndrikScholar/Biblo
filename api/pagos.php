<?php
// Simulador de pasarela de pagos (modo sandbox).
// POST { pedido_id, titular, numero, vencimiento: 'MM/AA', cvv }
//
// Tarjetas de prueba (las mismas que usa Stripe en su sandbox):
//   4242 4242 4242 4242 → aprobada
//   4000 0000 0000 0002 → rechazada por fondos insuficientes
// Cualquier otro número válido (pasa la prueba de Luhn) se aprueba.
//
// El número completo y el CVV solo viven durante esta petición: a la base
// de datos llegan únicamente la marca y los 4 últimos dígitos.
require 'comun.php';
$uid = usuario_id();
$e = entrada();

$numero = preg_replace('/\D/', '', $e['numero'] ?? '');
$titular = trim($e['titular'] ?? '');
$cvv = $e['cvv'] ?? '';

// errores del formulario: no cuentan como intento de pago
if ($titular === '') fallar('Escribe el nombre que aparece en la tarjeta.');
if (!luhn($numero)) fallar('El número de tarjeta no es válido.');
if (!preg_match('/^(\d{2})\s*\/\s*(\d{2})$/', $e['vencimiento'] ?? '', $v) || $v[1] < 1 || $v[1] > 12) {
  fallar('La fecha de vencimiento va como MM/AA.');
}
if (!preg_match('/^\d{3,4}$/', $cvv)) fallar('El código de seguridad tiene 3 o 4 dígitos.');
$vencida = (2000 + (int) $v[2]) * 12 + (int) $v[1] < (int) date('Y') * 12 + (int) date('n');

$pdo = db();
$pdo->beginTransaction();

$pedido = $pdo->prepare('SELECT estado_pago FROM pedidos WHERE id = ? AND usuario_id = ? FOR UPDATE');
$pedido->execute([$e['pedido_id'] ?? 0, $uid]);
$estado = $pedido->fetchColumn();
if ($estado === false) {
  $pdo->rollBack();
  fallar('Ese pedido no existe.', 404);
}
if ($estado !== 'pendiente') {
  $pdo->rollBack();
  fallar('Este pedido ya no está pendiente de pago.', 409);
}

// "respuesta del banco"
$motivo = null;
if ($vencida) $motivo = 'La tarjeta está vencida.';
elseif (str_ends_with($numero, '0002')) $motivo = 'Fondos insuficientes.';

// FOR UPDATE bloquea esas filas hasta el commit: dos pagos a la vez no
// pueden llevarse el mismo último ejemplar
$lineas = $pdo->prepare(
  'SELECT dp.libro_id, dp.cantidad, l.titulo, l.stock
   FROM detalle_pedido dp JOIN libros l ON l.id = dp.libro_id
   WHERE dp.pedido_id = ? FOR UPDATE'
);
$lineas->execute([$e['pedido_id']]);
$lineas = $lineas->fetchAll();
if (!$motivo) {
  foreach ($lineas as $l) {
    if ($l['stock'] < $l['cantidad']) {
      $motivo = "Ya no quedan ejemplares suficientes de «{$l['titulo']}». No se ha hecho ningún cargo.";
      break;
    }
  }
}

$pdo->prepare('INSERT INTO pagos (pedido_id, resultado, marca, ultimos4, motivo) VALUES (?, ?, ?, ?, ?)')
  ->execute([$e['pedido_id'], $motivo ? 'rechazado' : 'aprobado', marca($numero), substr($numero, -4), $motivo]);

if ($motivo) {
  $pdo->prepare("UPDATE pedidos SET estado_pago = 'rechazado' WHERE id = ?")->execute([$e['pedido_id']]);
  $pdo->commit();
  responder(['resultado' => 'rechazado', 'motivo' => $motivo]);
}

// pagado: ahora sí se descuenta el stock y empieza el envío
$descontar = $pdo->prepare('UPDATE libros SET stock = stock - ? WHERE id = ?');
foreach ($lineas as $l) $descontar->execute([$l['cantidad'], $l['libro_id']]);
$pdo->prepare(
  "UPDATE pedidos SET estado_pago = 'pagado', estado_envio = 'en_preparacion',
                      entrega_estimada = CURDATE() + INTERVAL 3 DAY
   WHERE id = ?"
)->execute([$e['pedido_id']]);
$pdo->commit();

$entrega = db()->prepare('SELECT entrega_estimada FROM pedidos WHERE id = ?');
$entrega->execute([$e['pedido_id']]);
responder(['resultado' => 'aprobado', 'entrega_estimada' => $entrega->fetchColumn()]);

// Algoritmo de Luhn: el dígito de control que llevan todas las tarjetas
function luhn($n) {
  if (!preg_match('/^\d{13,19}$/', $n)) return false;
  $suma = 0;
  foreach (array_reverse(str_split($n)) as $i => $d) {
    $d = (int) $d;
    if ($i % 2) $d = $d * 2 > 9 ? $d * 2 - 9 : $d * 2;
    $suma += $d;
  }
  return $suma % 10 === 0;
}

function marca($n) {
  if (preg_match('/^4/', $n)) return 'Visa';
  if (preg_match('/^(5[1-5]|2[2-7])/', $n)) return 'Mastercard';
  if (preg_match('/^3[47]/', $n)) return 'American Express';
  return 'Tarjeta';
}
