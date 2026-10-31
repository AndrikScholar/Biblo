<?php
// Gestión de pedidos (solo administración).
// GET: todos los pedidos con cliente, dirección, libros y último pago.
// POST { id, estado_envio }: mueve el envío de un pedido pagado.
require 'comun.php';
requiere_admin();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
  $pedidos = db()->query(
    'SELECT p.id, p.total, p.estado_pago, p.estado_envio, p.creado_en, p.entrega_estimada,
            u.nombre AS cliente, u.email,
            d.destinatario, d.calle, d.num_exterior, d.num_interior, d.colonia,
            d.codigo_postal, d.ciudad, d.estado, d.telefono
     FROM pedidos p
     JOIN usuarios u ON u.id = p.usuario_id
     JOIN direcciones d ON d.id = p.direccion_id
     ORDER BY p.id DESC'
  )->fetchAll();

  $lineas = db()->prepare(
    'SELECT pl.libro_id, l.titulo, pl.cantidad, pl.precio_unitario
     FROM pedido_libros pl JOIN libros l ON l.id = pl.libro_id WHERE pl.pedido_id = ?'
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
if (!in_array($e['estado_envio'] ?? '', ['en_preparacion', 'enviado', 'entregado'], true)) {
  fallar('Estado de envío desconocido.');
}
$cambio = db()->prepare("UPDATE pedidos SET estado_envio = ? WHERE id = ? AND estado_pago = 'pagado'");
$cambio->execute([$e['estado_envio'], $e['id'] ?? 0]);
$existe = db()->prepare("SELECT 1 FROM pedidos WHERE id = ? AND estado_pago = 'pagado'");
$existe->execute([$e['id'] ?? 0]);
if (!$existe->fetch()) fallar('Solo los pedidos pagados tienen envío.', 409);
responder(['id' => (int) $e['id'], 'estado_envio' => $e['estado_envio']]);
