<?php
declare(strict_types=1);

require_once __DIR__ . "/response.php";
require_once __DIR__ . "/jwt.php";

function get_bearer_token(): string {
  $auth = "";

  if (isset($_SERVER["HTTP_AUTHORIZATION"])) {
    $auth = (string)$_SERVER["HTTP_AUTHORIZATION"];
  }

  if ($auth === "" && isset($_SERVER["REDIRECT_HTTP_AUTHORIZATION"])) {
    $auth = (string)$_SERVER["REDIRECT_HTTP_AUTHORIZATION"];
  }

  if ($auth === "" && function_exists("getallheaders")) {
    $headers = getallheaders();
    if (isset($headers["Authorization"])) $auth = (string)$headers["Authorization"];
    elseif (isset($headers["authorization"])) $auth = (string)$headers["authorization"];
  }

  $auth = trim((string)$auth);
  if ($auth === "") return "";

  if (stripos($auth, "Bearer ") === 0) {
    return trim(substr($auth, 7));
  }

  return "";
}

function require_auth(PDO $pdo, array $cfg): array {
  $token = get_bearer_token();
  if ($token === "") json_response(401, ["ok" => false, "error" => "Missing token"]);

  try {
    $payload = jwt_decode($token, (string)$cfg["jwt"]["secret"]);
    $userId = isset($payload["sub"]) ? (int)$payload["sub"] : 0;
    if ($userId <= 0) json_response(401, ["ok" => false, "error" => "Invalid token"]);

    $s = $pdo->prepare("SELECT id, email, role, status FROM users WHERE id=? LIMIT 1");
    $s->execute([$userId]);
    $user = $s->fetch(PDO::FETCH_ASSOC);

    if (!$user) json_response(401, ["ok" => false, "error" => "User not found"]);
    if (($user["status"] ?? "") !== "active") json_response(403, ["ok" => false, "error" => "User disabled"]);

    return $user;
  } catch (Exception $e) {
    json_response(401, ["ok" => false, "error" => "Invalid token"]);
  }
}