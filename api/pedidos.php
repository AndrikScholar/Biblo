<?php
// GET: los pedidos del usuario con sus libros, la dirección y el último
// intento de pago.
// POST { direccion_id, libros: [{ id, cantidad }] }: crea el pedido como
// 'pendiente'. El stock no se toca hasta que se paga (ver pagos.php).
require 'comun.php';
$uid = usuario_id();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
  $consulta = db()->prepare(
    'SELECT p.id, p.total, p.estado_pago, p.estado_envio, p.creado_en, p.entrega_estimada,
            d.destinatario, d.calle, d.num_exterior, d.num_interior, d.colonia,
            d.codigo_postal, d.ciudad, d.estado
     FROM pedidos p JOIN direcciones d ON d.id = p.direccion_id
     WHERE p.usuario_id = ? ORDER BY p.id DESC'
  );
  $consulta->execute([$uid]);
  $pedidos = $consulta->fetchAll();

  $lineas = db()->prepare(
    'SELECT dp.libro_id, l.titulo, dp.cantidad, dp.precio_unitario
     FROM detalle_pedido dp JOIN libros l ON l.id = dp.libro_id WHERE dp.pedido_id = ?'
  );
  $pago = db()->prepare(
    'SELECT marca, ultimos4, motivo FROM pagos WHERE pedido_id = ? ORDER BY id DESC LIMIT 1'
  );
  foreach ($pedidos as &$pedido) {
    $lineas->execute([$pedido['id']]);
    $pedido['libros'] = $lineas->fetchAll();
    $pago->execute([$pedido['id']]);
    $pedido['pago'] = $pago->fetch() ?: null;
    $pedido['total'] = (float) $pedido['total'];
  }
  responder($pedidos);
}

$e = entrada();
$direccion = db()->prepare('SELECT id FROM direcciones WHERE id = ? AND usuario_id = ?');
$direccion->execute([$e['direccion_id'] ?? 0, $uid]);
if (!$direccion->fetch()) fallar('Elige una dirección de envío.');

// mismo libro dos veces en la lista = una sola línea con la suma
$pedidas = [];
foreach ($e['libros'] ?? [] as $l) {
  $cantidad = (int) ($l['cantidad'] ?? 0);
  if ($cantidad > 0) $pedidas[$l['id']] = ($pedidas[$l['id']] ?? 0) + $cantidad;
}
if (!$pedidas) fallar('El carrito está vacío.');

// se avisa ya si no hay stock, aunque la comprobación que cuenta es la del pago
$libro = db()->prepare('SELECT titulo, precio, stock FROM libros WHERE id = ?');
$total = 0;
$precios = [];
foreach ($pedidas as $id => $cantidad) {
  $libro->execute([$id]);
  $fila = $libro->fetch();
  if (!$fila) fallar('Uno de los libros ya no está en el catálogo.', 409);
  if ($fila['stock'] < $cantidad) {
    fallar($fila['stock'] == 0
      ? "«{$fila['titulo']}» está agotado."
      : "De «{$fila['titulo']}» solo " . ($fila['stock'] == 1 ? 'queda 1' : "quedan {$fila['stock']}") . '.', 409);
  }
  $precios[$id] = $fila['precio'];
  $total += $fila['precio'] * $cantidad;
}

$pdo = db();
$pdo->beginTransaction();
$pdo->prepare('INSERT INTO pedidos (usuario_id, direccion_id, total) VALUES (?, ?, ?)')
  ->execute([$uid, $e['direccion_id'], round($total, 2)]);
$pedido_id = $pdo->lastInsertId();
// el precio se copia: si luego cambia en el catálogo, el pedido no cambia
$linea = $pdo->prepare(
  'INSERT INTO detalle_pedido (pedido_id, libro_id, cantidad, precio_unitario) VALUES (?, ?, ?, ?)'
);
foreach ($pedidas as $id => $cantidad) $linea->execute([$pedido_id, $id, $cantidad, $precios[$id]]);
$pdo->commit();

responder(['id' => (int) $pedido_id, 'total' => round($total, 2)], 201);
