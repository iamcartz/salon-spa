<?php
declare(strict_types=1);

require_once __DIR__ . "/response.php";
require_once __DIR__ . "/jwt.php";
require_once __DIR__ . "/auth_mw.php";

/**
 * Helpers
 */
function read_json_body(): array {
  $raw = file_get_contents("php://input");
  $d = json_decode($raw ?: "", true);
  return is_array($d) ? $d : [];
}

/**
 * POST /auth/login
 * { email, password }
 */
if ($path === "/auth/login" && $method === "POST") {
  $d = read_json_body();
  $email = strtolower(trim((string)($d["email"] ?? "")));
  $password = (string)($d["password"] ?? "");

  if ($email === "" || $password === "") {
    json_response(400, ["ok" => false, "error" => "Email and password required"]);
  }

  // include profile fields + branch_id
  $s = $pdo->prepare("
    SELECT id, branch_id, first_name, last_name, email, password_hash, role, status
    FROM users
    WHERE email=?
    LIMIT 1
  ");
  $s->execute([$email]);
  $u = $s->fetch(PDO::FETCH_ASSOC);

  if (!$u || (string)($u["status"] ?? "") !== "active") {
    json_response(401, ["ok" => false, "error" => "Invalid credentials"]);
  }

  if (!password_verify($password, (string)$u["password_hash"])) {
    json_response(401, ["ok" => false, "error" => "Invalid credentials"]);
  }

  // Only admin/staff allowed
  $role = (string)$u["role"];
  if (!in_array($role, ["admin", "staff"], true)) {
    json_response(403, ["ok" => false, "error" => "Access denied"]);
  }

  $ttl = (int)$cfg["jwt"]["ttl_seconds"];

  // include branch_id in token (handy for logs/ops; still enforce branch access via user_branches)
  $token = jwt_encode([
    "sub" => (int)$u["id"],
    "role" => $role,
    "branch_id" => (int)($u["branch_id"] ?? 0),
    "exp" => time() + $ttl,
  ], (string)$cfg["jwt"]["secret"]);

  json_response(200, [
    "ok" => true,
    "token" => $token,
    "user" => [
      "id" => (int)$u["id"],
      "branch_id" => (int)($u["branch_id"] ?? 0),
      "first_name" => (string)($u["first_name"] ?? ""),
      "last_name" => (string)($u["last_name"] ?? ""),
      "email" => (string)$u["email"],
      "role" => $role,
    ],
  ]);
}

/**
 * GET /auth/me
 */
if ($path === "/auth/me" && $method === "GET") {
  $user = require_auth($pdo, $cfg);

  // user profile (from users table)
  $me = $pdo->prepare("
    SELECT id, branch_id, first_name, last_name, email, role, status, created_at
    FROM users
    WHERE id=?
    LIMIT 1
  ");
  $me->execute([(int)$user["id"]]);
  $u = $me->fetch(PDO::FETCH_ASSOC);
  if (!$u) json_response(401, ["ok" => false, "error" => "Unauthorized"]);

  // accessible branches
  $q = $pdo->prepare("
    SELECT b.id, b.name, b.status
    FROM user_branches ub
    JOIN branches b ON b.id = ub.branch_id
    WHERE ub.user_id = ?
    ORDER BY b.name
  ");
  $q->execute([(int)$user["id"]]);

  json_response(200, [
    "ok" => true,
    "user" => [
      "id" => (int)$u["id"],
      "branch_id" => (int)($u["branch_id"] ?? 0),
      "first_name" => (string)($u["first_name"] ?? ""),
      "last_name" => (string)($u["last_name"] ?? ""),
      "email" => (string)$u["email"],
      "role" => (string)$u["role"],
      "status" => (string)$u["status"],
      "created_at" => (string)($u["created_at"] ?? ""),
    ],
    "branches" => $q->fetchAll(PDO::FETCH_ASSOC),
  ]);
}

/**
 * PUT /auth/profile
 * Update own profile (first_name, last_name, email)
 * body: { first_name, last_name, email }
 */
if ($path === "/auth/profile" && $method === "PUT") {
  $user = require_auth($pdo, $cfg);
  $d = read_json_body();

  $first = trim((string)($d["first_name"] ?? ""));
  $last  = trim((string)($d["last_name"] ?? ""));
  $email = strtolower(trim((string)($d["email"] ?? "")));

  if ($first === "" || $last === "" || $email === "") {
    json_response(400, ["ok" => false, "error" => "first_name, last_name, email required"]);
  }
  if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    json_response(400, ["ok" => false, "error" => "Invalid email"]);
  }

  // get current branch_id to enforce unique(branch_id,email)
  $cur = $pdo->prepare("SELECT id, branch_id FROM users WHERE id=? LIMIT 1");
  $cur->execute([(int)$user["id"]]);
  $row = $cur->fetch(PDO::FETCH_ASSOC);
  if (!$row) json_response(401, ["ok" => false, "error" => "Unauthorized"]);
  $branchId = (int)$row["branch_id"];

  // ensure email unique within branch excluding self
  $chk = $pdo->prepare("SELECT id FROM users WHERE branch_id=? AND email=? AND id<>? LIMIT 1");
  $chk->execute([$branchId, $email, (int)$user["id"]]);
  if ($chk->fetch()) {
    json_response(400, ["ok" => false, "error" => "Email already exists in this branch"]);
  }

  $u = $pdo->prepare("UPDATE users SET first_name=?, last_name=?, email=? WHERE id=?");
  $u->execute([$first, $last, $email, (int)$user["id"]]);

  json_response(200, ["ok" => true]);
}

/**
 * PUT /auth/password
 * Change own password
 * body: { current_password, new_password }
 */
if ($path === "/auth/password" && $method === "PUT") {
  $user = require_auth($pdo, $cfg);
  $d = read_json_body();

  $current = (string)($d["current_password"] ?? "");
  $next = (string)($d["new_password"] ?? "");

  if ($current === "" || $next === "") {
    json_response(400, ["ok" => false, "error" => "current_password and new_password required"]);
  }
  if (strlen($next) < 8) {
    json_response(400, ["ok" => false, "error" => "Password must be at least 8 characters"]);
  }

  $s = $pdo->prepare("SELECT password_hash, status FROM users WHERE id=? LIMIT 1");
  $s->execute([(int)$user["id"]]);
  $u = $s->fetch(PDO::FETCH_ASSOC);

  if (!$u || (string)($u["status"] ?? "") !== "active") {
    json_response(401, ["ok" => false, "error" => "Unauthorized"]);
  }

  if (!password_verify($current, (string)$u["password_hash"])) {
    json_response(400, ["ok" => false, "error" => "Current password is incorrect"]);
  }

  $hash = password_hash($next, PASSWORD_DEFAULT);
  $upd = $pdo->prepare("UPDATE users SET password_hash=? WHERE id=?");
  $upd->execute([$hash, (int)$user["id"]]);

  json_response(200, ["ok" => true]);
}

/**
 * DEV ONLY: POST /auth/hash { password }
 */
if ($path === "/auth/hash" && $method === "POST") {
  if (!($cfg["app"]["allow_dev_hash"] ?? false)) {
    json_response(404, ["ok" => false, "error" => "Not found"]);
  }
  $d = read_json_body();
  $password = (string)($d["password"] ?? "");
  if ($password === "") json_response(400, ["ok" => false, "error" => "password required"]);

  json_response(200, ["ok" => true, "hash" => password_hash($password, PASSWORD_BCRYPT)]);
}