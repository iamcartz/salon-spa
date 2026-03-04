<?php
declare(strict_types=1);

require_once __DIR__ . "/../src/compat.php";

$cfg = require __DIR__ . "/../src/config.php";
require_once __DIR__ . "/../src/db.php";
require_once __DIR__ . "/../src/response.php";
require_once __DIR__ . "/../src/rate_limit.php";

$pdo = db($cfg["db"]);

// CORS
$origin = $_SERVER["HTTP_ORIGIN"] ?? "";
$allowed = $cfg["cors"]["allowed_origins"] ?? [];
if ($origin && in_array($origin, $allowed, true)) {
  header("Access-Control-Allow-Origin: {$origin}");
  header("Vary: Origin");
}
header("Access-Control-Allow-Headers: Authorization, Content-Type, X-Branch-Id");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Credentials: false");
header("Access-Control-Max-Age: 86400");

if (($_SERVER["REQUEST_METHOD"] ?? "") === "OPTIONS") {
  http_response_code(204);
  exit;
}

// Security headers
header("X-Content-Type-Options: nosniff");
header("X-Frame-Options: DENY");
header("Referrer-Policy: no-referrer");
header("Permissions-Policy: geolocation=(), microphone=(), camera=()");

$path = parse_url($_SERVER["REQUEST_URI"] ?? "/", PHP_URL_PATH) ?: "/";
$base = "/salon-api/public";

// PHP 7.3 safe "starts with"
if (strncmp($path, $base, strlen($base)) === 0) {
  $path = substr($path, strlen($base));
  if ($path === "") $path = "/";
}

$method = $_SERVER["REQUEST_METHOD"] ?? "GET";

// Basic rate limit
$ip = $_SERVER["REMOTE_ADDR"] ?? "unknown";
$k = $ip . "|" . $path;
$limit = ($path === "/auth/login") ? 10 : 120;
if (!rate_limit($pdo, $k, $limit)) {
  json_response(429, ["ok" => false, "error" => "Too many requests"]);
}

// Routes
require_once __DIR__ . "/../src/routes_auth.php";
require_once __DIR__ . "/../src/routes_branches.php";
require_once __DIR__ . "/../src/routes_clients.php";
require_once __DIR__ . "/../src/routes_services.php";
require_once __DIR__ . "/../src/routes_inventory.php";
require_once __DIR__ . "/../src/routes_staff.php";
require_once __DIR__ . "/../src/routes_commissions.php";
require_once __DIR__ . "/../src/routes_appointments.php";
require_once __DIR__ . "/../src/routes_payments.php";
require_once __DIR__ . "/../src/routes_dashboard.php";
require_once __DIR__ . "/../src/routes_users.php";

json_response(404, ["ok" => false, "error" => "Not found", "path" => $path, "method" => $method]);