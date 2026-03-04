<?php
declare(strict_types=1);

require_once __DIR__ . "/response.php";
require_once __DIR__ . "/auth_mw.php";
require_once __DIR__ . "/branch_scope.php";
require_once __DIR__ . "/audit.php";

if ($path === "/services" && $method === "GET") {
  $user = require_auth($pdo, $cfg);
  $branchId = require_branch($pdo, (int)$user["id"]);

  $q = $pdo->prepare("SELECT * FROM services WHERE branch_id=? ORDER BY id DESC");
  $q->execute([$branchId]);
  json_response(200, ["ok" => true, "rows" => $q->fetchAll()]);
}

if ($path === "/services" && $method === "POST") {
  $user = require_auth($pdo, $cfg);
  $branchId = require_branch($pdo, (int)$user["id"]);
  $d = json_decode(file_get_contents("php://input"), true) ?: [];

  $name = trim((string)($d["name"] ?? ""));
  $price = (float)($d["price"] ?? 0);
  $duration = (int)($d["duration_mins"] ?? 60);
  $commission = $d["commission_rate"] ?? null;
  $status = (string)($d["status"] ?? "active");

  if ($name === "") json_response(400, ["ok" => false, "error" => "name required"]);

  $ins = $pdo->prepare("
    INSERT INTO services (branch_id, name, price, duration_mins, commission_rate, status)
    VALUES (?,?,?,?,?,?)
  ");
  $ins->execute([$branchId, $name, $price, $duration, $commission, $status]);
  $id = (int)$pdo->lastInsertId();

  audit($pdo, (int)$user["id"], $branchId, "create", "services", $id);
  json_response(201, ["ok" => true, "id" => $id]);
}

if (preg_match("#^/services/(\d+)$#", $path, $m) && $method === "PUT") {
  $user = require_auth($pdo, $cfg);
  $branchId = require_branch($pdo, (int)$user["id"]);
  $id = (int)$m[1];
  $d = json_decode(file_get_contents("php://input"), true) ?: [];

  $name = trim((string)($d["name"] ?? ""));
  $price = (float)($d["price"] ?? 0);
  $duration = (int)($d["duration_mins"] ?? 60);
  $commission = $d["commission_rate"] ?? null;
  $status = (string)($d["status"] ?? "active");

  $u = $pdo->prepare("
    UPDATE services SET name=?, price=?, duration_mins=?, commission_rate=?, status=?
    WHERE id=? AND branch_id=?
  ");
  $u->execute([$name, $price, $duration, $commission, $status, $id, $branchId]);

  audit($pdo, (int)$user["id"], $branchId, "update", "services", $id);
  json_response(200, ["ok" => true]);
}

if (preg_match("#^/services/(\d+)$#", $path, $m) && $method === "DELETE") {
  $user = require_auth($pdo, $cfg);
  $branchId = require_branch($pdo, (int)$user["id"]);
  $id = (int)$m[1];

  $dlt = $pdo->prepare("DELETE FROM services WHERE id=? AND branch_id=?");
  $dlt->execute([$id, $branchId]);

  audit($pdo, (int)$user["id"], $branchId, "delete", "services", $id);
  json_response(200, ["ok" => true]);
}