<?php
// Lo que comparten todos los archivos de la API: permisos para que la
// página de Vite (localhost:5173) pueda llamar a Apache (localhost),
// la sesión del usuario, la conexión a MySQL y las respuestas en JSON.

$origen = $_SERVER['HTTP_ORIGIN'] ?? '';
if (preg_match('#^http://(localhost|127\.0\.0\.1):5173$#', $origen)) {
  header("Access-Control-Allow-Origin: $origen");
  header('Access-Control-Allow-Credentials: true');
  header('Access-Control-Allow-Headers: Content-Type');
  header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
  header('Vary: Origin');
}
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') exit;

header('Content-Type: application/json; charset=utf-8');

session_set_cookie_params(['httponly' => true, 'samesite' => 'Lax']);
session_start();

// XAMPP trae MySQL con el usuario root y sin contraseña
function db() {
  static $pdo = null;
  if (!$pdo) {
    $pdo = new PDO('mysql:host=localhost;dbname=biblo;charset=utf8mb4', 'root', '', [
      PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
      PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
  }
  return $pdo;
}

function responder($datos, $codigo = 200) {
  http_response_code($codigo);
  echo json_encode($datos, JSON_UNESCAPED_UNICODE);
  exit;
}

function fallar($mensaje, $codigo = 400) {
  responder(['error' => $mensaje], $codigo);
}

// cuerpo JSON de un POST
function entrada() {
  return json_decode(file_get_contents('php://input'), true) ?: [];
}

function usuario_id() {
  return $_SESSION['usuario_id'] ?? fallar('Inicia sesión para continuar.', 401);
}

// El rol se lee de la base de datos en cada petición: si se le quita el
// rol a alguien, deja de ser administrador al instante.
function requiere_admin() {
  $uid = usuario_id();
  $rol = db()->prepare('SELECT rol FROM usuarios WHERE id = ?');
  $rol->execute([$uid]);
  if ($rol->fetchColumn() !== 'admin') fallar('Solo la administración puede hacer esto.', 403);
  return $uid;
}

set_exception_handler(function ($e) {
  error_log($e);
  $mensaje = $e instanceof PDOException
    ? 'No se pudo conectar con la base de datos. ¿Está MySQL encendido en XAMPP?'
    : 'Algo salió mal en el servidor.';
  responder(['error' => $mensaje], 500);
});
