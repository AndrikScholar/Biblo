<?php
// GET: los pedidos del usuario con sus libros y la dirección de envío.
// POST { direccion_id, libros: [{ id, cantidad }] }: crea el pedido y
// descuenta el stock, todo o nada.
require 'comun.php';
$uid = usuario_id();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
  // Envío simulado: a los 2 minutos el paquete sale y el día de la
  // entrega estimada llega. Desde phpMyAdmin también se puede cambiar
  // el estado a mano; esto solo lo hace avanzar, nunca retroceder.
  db()->prepare(
    "UPDATE pedidos SET estado = 'enviado'
     WHERE usuario_id = ? AND estado = 'preparando' AND creado_en <= NOW() - INTERVAL 2 MINUTE"
  )->execute([$uid]);
  db()->prepare(
    "UPDATE pedidos SET estado = 'entregado'
     WHERE usuario_id = ? AND estado = 'enviado' AND entrega_estimada <= CURDATE()"
  )->execute([$uid]);

  $consulta = db()->prepare(
    'SELECT p.id, p.total, p.estado, p.creado_en, p.entrega_estimada,
            d.destinatario, d.calle, d.num_exterior, d.num_interior, d.colonia,
            d.codigo_postal, d.ciudad, d.estado AS estado_dir
     FROM pedidos p JOIN direcciones d ON d.id = p.direccion_id
     WHERE p.usuario_id = ? ORDER BY p.id DESC'
  );
  $consulta->execute([$uid]);
  $pedidos = $consulta->fetchAll();

  $lineas = db()->prepare(
    'SELECT pl.libro_id, l.titulo, pl.cantidad, pl.precio_unitario
     FROM pedido_libros pl JOIN libros l ON l.id = pl.libro_id WHERE pl.pedido_id = ?'
  );
  foreach ($pedidos as &$pedido) {
    $lineas->execute([$pedido['id']]);
    $pedido['libros'] = $lineas->fetchAll();
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

$pdo = db();
$pdo->beginTransaction();
try {
  // FOR UPDATE bloquea esas filas hasta el commit: dos compras a la vez
  // no pueden llevarse el mismo último ejemplar
  $libro = $pdo->prepare('SELECT titulo, precio, stock FROM libros WHERE id = ? FOR UPDATE');
  $total = 0;
  $precios = [];
  foreach ($pedidas as $id => $cantidad) {
    $libro->execute([$id]);
    $fila = $libro->fetch();
    if (!$fila) throw new RuntimeException('Uno de los libros ya no está en el catálogo.');
    if ($fila['stock'] < $cantidad) {
      throw new RuntimeException($fila['stock'] == 0
        ? "«{$fila['titulo']}» está agotado."
        : "De «{$fila['titulo']}» solo " . ($fila['stock'] == 1 ? 'queda 1' : "quedan {$fila['stock']}") . '.');
    }
    $precios[$id] = $fila['precio'];
    $total += $fila['precio'] * $cantidad;
  }

  $pdo->prepare(
    'INSERT INTO pedidos (usuario_id, direccion_id, total, entrega_estimada)
     VALUES (?, ?, ?, CURDATE() + INTERVAL 3 DAY)'
  )->execute([$uid, $e['direccion_id'], round($total, 2)]);
  $pedido_id = $pdo->lastInsertId();

  $linea = $pdo->prepare(
    'INSERT INTO pedido_libros (pedido_id, libro_id, cantidad, precio_unitario) VALUES (?, ?, ?, ?)'
  );
  $descontar = $pdo->prepare('UPDATE libros SET stock = stock - ? WHERE id = ?');
  foreach ($pedidas as $id => $cantidad) {
    $linea->execute([$pedido_id, $id, $cantidad, $precios[$id]]);
    $descontar->execute([$cantidad, $id]);
  }
  $pdo->commit();
} catch (RuntimeException $error) {
  $pdo->rollBack();
  fallar($error->getMessage(), 409);
}

$entrega = db()->prepare('SELECT entrega_estimada FROM pedidos WHERE id = ?');
$entrega->execute([$pedido_id]);
responder(['id' => (int) $pedido_id, 'total' => round($total, 2), 'entrega_estimada' => $entrega->fetchColumn()], 201);
