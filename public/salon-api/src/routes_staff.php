<?php
declare(strict_types=1);

require_once __DIR__ . "/response.php";
require_once __DIR__ . "/auth_mw.php";
require_once __DIR__ . "/branch_scope.php";
require_once __DIR__ . "/audit.php";

function resolve_branch_for_write(PDO $pdo, int $userId, array $body): int {
  // 1) If branch_id provided in JSON, use it (but validate access)
  $branchId = isset($body["branch_id"]) ? (int)$body["branch_id"] : 0;

  // 2) Else try header/query via existing helper
  if ($branchId <= 0) {
    $branchId = isset($_SERVER["HTTP_X_BRANCH_ID"]) ? (int)$_SERVER["HTTP_X_BRANCH_ID"] : 0;
  }
  if ($branchId <= 0 && isset($_GET["branch_id"])) {
    $branchId = (int)$_GET["branch_id"];
  }

  $allowed = user_allowed_branches($pdo, $userId);
  if (count($allowed) === 0) json_response(403, ["ok" => false, "error" => "No branch access"]);

  // 3) If still missing, fallback to first allowed branch
  if ($branchId <= 0) return (int)$allowed[0];

  // 4) Validate branch access
  if (!in_array($branchId, $allowed, true)) {
    json_response(403, ["ok" => false, "error" => "Branch access denied"]);
  }

  return $branchId;
}

/**
 * GET /staff (branch scoped)
 */
if ($path === "/staff" && $method === "GET") {
  $user = require_auth($pdo, $cfg);
  $branchId = require_branch($pdo, (int)$user["id"]);

  $q = $pdo->prepare("SELECT * FROM staff WHERE branch_id=? ORDER BY id DESC");
  $q->execute([$branchId]);
  json_response(200, ["ok" => true, "rows" => $q->fetchAll(PDO::FETCH_ASSOC)]);
}

/**
 * POST /staff (branch_id can be in body)
 */
if ($path === "/staff" && $method === "POST") {
  $user = require_auth($pdo, $cfg);
  $d = json_decode(file_get_contents("php://input"), true) ?: [];

  $branchId = resolve_branch_for_write($pdo, (int)$user["id"], $d);

  $first = trim((string)($d["first_name"] ?? ""));
  $last  = trim((string)($d["last_name"] ?? ""));
  $phone = trim((string)($d["phone"] ?? ""));
  $email = trim((string)($d["email"] ?? ""));
  $specialty = trim((string)($d["specialty"] ?? ""));
  $commission = (float)($d["commission_rate"] ?? 0);
  $status = (string)($d["status"] ?? "active");

  if ($first === "" || $last === "") {
    json_response(400, ["ok" => false, "error" => "first_name and last_name required"]);
  }

  $ins = $pdo->prepare("
    INSERT INTO staff (branch_id, first_name, last_name, phone, email, specialty, commission_rate, status)
    VALUES (?,?,?,?,?,?,?,?)
  ");
  $ins->execute([$branchId, $first, $last, $phone, $email, $specialty, $commission, $status]);

  $id = (int)$pdo->lastInsertId();
  audit($pdo, (int)$user["id"], $branchId, "create", "staff", $id);

  json_response(201, ["ok" => true, "id" => $id, "branch_id" => $branchId]);
}

/**
 * PUT /staff/{id} (branch_id can be in body to move staff)
 */
if (preg_match("#^/staff/(\d+)$#", $path, $m) && $method === "PUT") {
  $user = require_auth($pdo, $cfg);
  $d = json_decode(file_get_contents("php://input"), true) ?: [];
  $id = (int)$m[1];

  $branchId = resolve_branch_for_write($pdo, (int)$user["id"], $d);

  $first = trim((string)($d["first_name"] ?? ""));
  $last  = trim((string)($d["last_name"] ?? ""));
  $phone = trim((string)($d["phone"] ?? ""));
  $email = trim((string)($d["email"] ?? ""));
  $specialty = trim((string)($d["specialty"] ?? ""));
  $commission = (float)($d["commission_rate"] ?? 0);
  $status = (string)($d["status"] ?? "active");

  // Only update rows that belong to branches the user can access.
  $allowed = user_allowed_branches($pdo, (int)$user["id"]);
  if (count($allowed) === 0) json_response(403, ["ok" => false, "error" => "No branch access"]);

  // Find staff record branch
  $chk = $pdo->prepare("SELECT branch_id FROM staff WHERE id=? LIMIT 1");
  $chk->execute([$id]);
  $row = $chk->fetch(PDO::FETCH_ASSOC);
  if (!$row) json_response(404, ["ok" => false, "error" => "Not found"]);

  $currentBranch = (int)$row["branch_id"];
  if (!in_array($currentBranch, $allowed, true)) {
    json_response(403, ["ok" => false, "error" => "Branch access denied"]);
  }

  $u = $pdo->prepare("
    UPDATE staff
    SET branch_id=?, first_name=?, last_name=?, phone=?, email=?, specialty=?, commission_rate=?, status=?
    WHERE id=?
  ");
  $u->execute([$branchId, $first, $last, $phone, $email, $specialty, $commission, $status, $id]);

  audit($pdo, (int)$user["id"], $branchId, "update", "staff", $id);

  json_response(200, ["ok" => true, "branch_id" => $branchId]);
}

/**
 * DELETE /staff/{id} (must be in an allowed branch)
 */
if (preg_match("#^/staff/(\d+)$#", $path, $m) && $method === "DELETE") {
  $user = require_auth($pdo, $cfg);
  $id = (int)$m[1];

  $allowed = user_allowed_branches($pdo, (int)$user["id"]);
  if (count($allowed) === 0) json_response(403, ["ok" => false, "error" => "No branch access"]);

  $chk = $pdo->prepare("SELECT branch_id FROM staff WHERE id=? LIMIT 1");
  $chk->execute([$id]);
  $row = $chk->fetch(PDO::FETCH_ASSOC);
  if (!$row) json_response(404, ["ok" => false, "error" => "Not found"]);

  $branchId = (int)$row["branch_id"];
  if (!in_array($branchId, $allowed, true)) {
    json_response(403, ["ok" => false, "error" => "Branch access denied"]);
  }

  $pdo->prepare("DELETE FROM staff WHERE id=?")->execute([$id]);
  audit($pdo, (int)$user["id"], $branchId, "delete", "staff", $id);

  json_response(200, ["ok" => true]);
}