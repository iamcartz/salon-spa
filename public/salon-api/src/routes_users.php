<?php
// src/routes_users.php
declare(strict_types=1);

require_once __DIR__ . "/response.php";
require_once __DIR__ . "/auth_mw.php";
require_once __DIR__ . "/branch_scope.php";
require_once __DIR__ . "/audit.php";

/** Ensure admin */
function require_admin(array $user): void {
  $role = (string)($user["role"] ?? "");
  if ($role !== "admin") {
    json_response(403, ["ok" => false, "error" => "Admin only"]);
  }
}

/** Read JSON body */
function read_json_body(): array {
  $raw = file_get_contents("php://input");
  $d = json_decode($raw ?: "", true);
  return is_array($d) ? $d : [];
}

/**
 * GET /users  (admin only, scoped to active branch)
 */
if ($path === "/users" && $method === "GET") {
  $user = require_auth($pdo, $cfg);
  require_admin($user);

  $branchId = require_branch($pdo, (int)$user["id"]);

  $q = $pdo->prepare("
    SELECT id, branch_id, first_name, last_name, email, role, status, created_at
    FROM users
    WHERE branch_id=?
    ORDER BY id DESC
  ");
  $q->execute([$branchId]);

  json_response(200, ["ok" => true, "rows" => $q->fetchAll(PDO::FETCH_ASSOC)]);
}

/**
 * POST /users  (admin only)
 * { first_name,last_name,email,password,role,status,branch_id? }
 */
if ($path === "/users" && $method === "POST") {
  $user = require_auth($pdo, $cfg);
  require_admin($user);

  $activeBranchId = require_branch($pdo, (int)$user["id"]);
  $d = read_json_body();

  $branchId = isset($d["branch_id"]) && (int)$d["branch_id"] > 0 ? (int)$d["branch_id"] : $activeBranchId;

  $first = trim((string)($d["first_name"] ?? ""));
  $last  = trim((string)($d["last_name"] ?? ""));
  $email = strtolower(trim((string)($d["email"] ?? "")));
  $password = (string)($d["password"] ?? "");
  $role = (string)($d["role"] ?? "staff");
  $status = (string)($d["status"] ?? "active");

  if ($first === "" || $last === "") json_response(400, ["ok" => false, "error" => "first_name and last_name required"]);
  if ($email === "" || strpos($email, "@") === false) json_response(400, ["ok" => false, "error" => "Valid email required"]);
  if ($password === "" || strlen($password) < 6) json_response(400, ["ok" => false, "error" => "Password min 6 characters"]);

  if (!in_array($role, ["admin","staff"], true)) json_response(400, ["ok" => false, "error" => "Invalid role"]);
  if (!in_array($status, ["active","disabled"], true)) json_response(400, ["ok" => false, "error" => "Invalid status"]);

  $hash = password_hash($password, PASSWORD_BCRYPT);

  try {
    $ins = $pdo->prepare("
      INSERT INTO users (branch_id, first_name, last_name, email, pass_hash, role, status)
      VALUES (?,?,?,?,?,?,?)
    ");
    $ins->execute([$branchId, $first, $last, $email, $hash, $role, $status]);

    $id = (int)$pdo->lastInsertId();
    audit($pdo, (int)$user["id"], $activeBranchId, "create", "users", $id);

    json_response(201, ["ok" => true, "id" => $id]);
  } catch (Throwable $e) {
    json_response(400, ["ok" => false, "error" => "Email already exists in this branch"]);
  }
}

/**
 * PUT /users/{id} (admin only)
 * { first_name,last_name,email,role,status }
 */
if (preg_match("#^/users/(\d+)$#", $path, $m) && $method === "PUT") {
  $user = require_auth($pdo, $cfg);
  require_admin($user);

  $activeBranchId = require_branch($pdo, (int)$user["id"]);
  $id = (int)$m[1];
  $d = read_json_body();

  $first = trim((string)($d["first_name"] ?? ""));
  $last  = trim((string)($d["last_name"] ?? ""));
  $email = strtolower(trim((string)($d["email"] ?? "")));
  $role = (string)($d["role"] ?? "staff");
  $status = (string)($d["status"] ?? "active");

  if ($first === "" || $last === "") json_response(400, ["ok" => false, "error" => "first_name and last_name required"]);
  if ($email === "" || strpos($email, "@") === false) json_response(400, ["ok" => false, "error" => "Valid email required"]);
  if (!in_array($role, ["admin","staff"], true)) json_response(400, ["ok" => false, "error" => "Invalid role"]);
  if (!in_array($status, ["active","disabled"], true)) json_response(400, ["ok" => false, "error" => "Invalid status"]);

  // must be same branch as active
  $chk = $pdo->prepare("SELECT id FROM users WHERE id=? AND branch_id=? LIMIT 1");
  $chk->execute([$id, $activeBranchId]);
  if (!$chk->fetch()) json_response(404, ["ok" => false, "error" => "Not found"]);

  try {
    $u = $pdo->prepare("
      UPDATE users SET first_name=?, last_name=?, email=?, role=?, status=?
      WHERE id=? AND branch_id=?
    ");
    $u->execute([$first, $last, $email, $role, $status, $id, $activeBranchId]);

    audit($pdo, (int)$user["id"], $activeBranchId, "update", "users", $id);
    json_response(200, ["ok" => true]);
  } catch (Throwable $e) {
    json_response(400, ["ok" => false, "error" => "Email already exists in this branch"]);
  }
}

/**
 * PUT /users/{id}/password (admin only reset)
 * { password }
 */
if (preg_match("#^/users/(\d+)/password$#", $path, $m) && $method === "PUT") {
  $user = require_auth($pdo, $cfg);
  require_admin($user);

  $activeBranchId = require_branch($pdo, (int)$user["id"]);
  $id = (int)$m[1];
  $d = read_json_body();

  $password = (string)($d["password"] ?? "");
  if ($password === "" || strlen($password) < 6) json_response(400, ["ok" => false, "error" => "Password min 6 characters"]);

  $chk = $pdo->prepare("SELECT id FROM users WHERE id=? AND branch_id=? LIMIT 1");
  $chk->execute([$id, $activeBranchId]);
  if (!$chk->fetch()) json_response(404, ["ok" => false, "error" => "Not found"]);

  $hash = password_hash($password, PASSWORD_BCRYPT);

  $u = $pdo->prepare("UPDATE users SET pass_hash=? WHERE id=? AND branch_id=?");
  $u->execute([$hash, $id, $activeBranchId]);

  audit($pdo, (int)$user["id"], $activeBranchId, "reset_password", "users", $id);
  json_response(200, ["ok" => true]);
}

/**
 * DELETE /users/{id} (admin only) -> soft disable
 */
if (preg_match("#^/users/(\d+)$#", $path, $m) && $method === "DELETE") {
  $user = require_auth($pdo, $cfg);
  require_admin($user);

  $activeBranchId = require_branch($pdo, (int)$user["id"]);
  $id = (int)$m[1];

  // Prevent deleting yourself
  if ((int)$user["id"] === $id) {
    json_response(400, ["ok" => false, "error" => "You cannot disable your own account"]);
  }

  $u = $pdo->prepare("UPDATE users SET status='disabled' WHERE id=? AND branch_id=?");
  $u->execute([$id, $activeBranchId]);

  audit($pdo, (int)$user["id"], $activeBranchId, "disable", "users", $id);
  json_response(200, ["ok" => true]);
}