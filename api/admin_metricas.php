<?php
// Métricas del panel (solo administración). Solo cuentan los pedidos pagados.
require 'comun.php';
requiere_admin();

$ventas = db()->query(
  "SELECT COUNT(*) AS pedidos, COALESCE(SUM(total), 0) AS ventas, COALESCE(AVG(total), 0) AS ticket
   FROM pedidos WHERE estado_pago = 'pagado'"
)->fetch();

$unidades = db()->query(
  "SELECT COALESCE(SUM(pl.cantidad), 0)
   FROM pedido_libros pl JOIN pedidos p ON p.id = pl.pedido_id WHERE p.estado_pago = 'pagado'"
)->fetchColumn();

$por_estado = db()->query('SELECT estado_pago, COUNT(*) AS n FROM pedidos GROUP BY estado_pago')
  ->fetchAll(PDO::FETCH_KEY_PAIR);

$mas_vendidos = db()->query(
  "SELECT l.titulo, SUM(pl.cantidad) AS unidades
   FROM pedido_libros pl
   JOIN pedidos p ON p.id = pl.pedido_id
   JOIN libros l ON l.id = pl.libro_id
   WHERE p.estado_pago = 'pagado'
   GROUP BY pl.libro_id, l.titulo ORDER BY unidades DESC, l.titulo LIMIT 5"
)->fetchAll();

responder([
  'ventas_totales' => round((float) $ventas['ventas'], 2),
  'ticket_promedio' => round((float) $ventas['ticket'], 2),
  'pedidos_pagados' => (int) $ventas['pedidos'],
  'libros_vendidos' => (int) $unidades,
  'pedidos_pendientes' => (int) ($por_estado['pendiente'] ?? 0),
  'pedidos_rechazados' => (int) ($por_estado['rechazado'] ?? 0),
  'clientes' => (int) db()->query("SELECT COUNT(*) FROM usuarios WHERE rol = 'cliente'")->fetchColumn(),
  'agotados' => (int) db()->query('SELECT COUNT(*) FROM libros WHERE stock = 0')->fetchColumn(),
  'mas_vendidos' => array_map(fn ($f) => ['titulo' => $f['titulo'], 'unidades' => (int) $f['unidades']], $mas_vendidos),
]);
