<?php
// GET: quién tiene la sesión abierta (o null).
// POST { accion: 'registro', nombre, email, contrasena }
//      { accion: 'entrar', email, contrasena }
//      { accion: 'salir' }
require 'comun.php';

function datos_usuario($id) {
  $consulta = db()->prepare('SELECT id, nombre, email FROM usuarios WHERE id = ?');
  $consulta->execute([$id]);
  return $consulta->fetch() ?: null;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
  $usuario = isset($_SESSION['usuario_id']) ? datos_usuario($_SESSION['usuario_id']) : null;
  // la cuenta ya no existe (p. ej. tras volver a importar biblo.sql)
  if (!$usuario) $_SESSION = [];
  responder($usuario);
}

$e = entrada();
$email = strtolower(trim($e['email'] ?? ''));
$contrasena = $e['contrasena'] ?? '';

switch ($e['accion'] ?? '') {
  case 'registro':
    $nombre = trim($e['nombre'] ?? '');
    if ($nombre === '') fallar('Escribe tu nombre.');
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) fallar('Ese correo no parece válido.');
    if (strlen($contrasena) < 8) fallar('La contraseña debe tener al menos 8 caracteres.');

    $existe = db()->prepare('SELECT 1 FROM usuarios WHERE email = ?');
    $existe->execute([$email]);
    if ($existe->fetch()) fallar('Ya hay una cuenta con ese correo.', 409);

    db()->prepare('INSERT INTO usuarios (nombre, email, contrasena_hash) VALUES (?, ?, ?)')
      ->execute([$nombre, $email, password_hash($contrasena, PASSWORD_DEFAULT)]);
    session_regenerate_id(true);
    $_SESSION['usuario_id'] = (int) db()->lastInsertId();
    responder(datos_usuario($_SESSION['usuario_id']), 201);

  case 'entrar':
    $consulta = db()->prepare('SELECT id, contrasena_hash FROM usuarios WHERE email = ?');
    $consulta->execute([$email]);
    $fila = $consulta->fetch();
    if (!$fila || !password_verify($contrasena, $fila['contrasena_hash'])) {
      fallar('Correo o contraseña incorrectos.', 401);
    }
    session_regenerate_id(true);
    $_SESSION['usuario_id'] = (int) $fila['id'];
    responder(datos_usuario($fila['id']));

  case 'salir':
    $_SESSION = [];
    session_destroy();
    responder(null);
}

fallar('Acción desconocida.');
