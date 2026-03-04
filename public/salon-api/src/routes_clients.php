<?php
declare(strict_types=1);

require_once __DIR__ . "/response.php";
require_once __DIR__ . "/auth_mw.php";
require_once __DIR__ . "/branch_scope.php";
require_once __DIR__ . "/audit.php";

if ($path === "/clients" && $method === "GET") {
  $user = require_auth($pdo, $cfg);
  $branchId = require_branch($pdo, (int)$user["id"]);

  $q = $pdo->prepare("SELECT * FROM clients WHERE branch_id=? ORDER BY id DESC");
  $q->execute([$branchId]);
  json_response(200, ["ok" => true, "rows" => $q->fetchAll()]);
}

if ($path === "/clients" && $method === "POST") {
  $user = require_auth($pdo, $cfg);
  $branchId = require_branch($pdo, (int)$user["id"]);
  $d = json_decode(file_get_contents("php://input"), true) ?: [];

  $first = trim((string)($d["first_name"] ?? ""));
  $last  = trim((string)($d["last_name"] ?? ""));
  $phone = trim((string)($d["phone"] ?? ""));
  $email = trim((string)($d["email"] ?? ""));
  $notes = trim((string)($d["notes"] ?? ""));

  if ($first === "" || $last === "") json_response(400, ["ok" => false, "error" => "First and last name required"]);

  $ins = $pdo->prepare("
    INSERT INTO clients (branch_id, first_name, last_name, phone, email, notes)
    VALUES (?,?,?,?,?,?)
  ");
  $ins->execute([$branchId, $first, $last, $phone, $email, $notes]);
  $id = (int)$pdo->lastInsertId();

  audit($pdo, (int)$user["id"], $branchId, "create", "clients", $id);
  json_response(201, ["ok" => true, "id" => $id]);
}

if (preg_match("#^/clients/(\d+)$#", $path, $m) && $method === "PUT") {
  $user = require_auth($pdo, $cfg);
  $branchId = require_branch($pdo, (int)$user["id"]);
  $id = (int)$m[1];
  $d = json_decode(file_get_contents("php://input"), true) ?: [];

  $first = trim((string)($d["first_name"] ?? ""));
  $last  = trim((string)($d["last_name"] ?? ""));
  $phone = trim((string)($d["phone"] ?? ""));
  $email = trim((string)($d["email"] ?? ""));
  $notes = trim((string)($d["notes"] ?? ""));

  $u = $pdo->prepare("
    UPDATE clients SET first_name=?, last_name=?, phone=?, email=?, notes=?
    WHERE id=? AND branch_id=?
  ");
  $u->execute([$first, $last, $phone, $email, $notes, $id, $branchId]);

  audit($pdo, (int)$user["id"], $branchId, "update", "clients", $id);
  json_response(200, ["ok" => true]);
}

if (preg_match("#^/clients/(\d+)$#", $path, $m) && $method === "DELETE") {
  $user = require_auth($pdo, $cfg);
  $branchId = require_branch($pdo, (int)$user["id"]);
  $id = (int)$m[1];

  $dlt = $pdo->prepare("DELETE FROM clients WHERE id=? AND branch_id=?");
  $dlt->execute([$id, $branchId]);

  audit($pdo, (int)$user["id"], $branchId, "delete", "clients", $id);
  json_response(200, ["ok" => true]);
}