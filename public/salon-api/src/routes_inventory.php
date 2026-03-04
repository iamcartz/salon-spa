<?php
// src/routes_inventory.php
declare(strict_types=1);

require_once __DIR__ . "/response.php";
require_once __DIR__ . "/auth_mw.php";
require_once __DIR__ . "/branch_scope.php";
require_once __DIR__ . "/audit.php";

function inv_num($v): float {
  if ($v === null) return 0.0;
  if (is_string($v)) {
    $v = trim($v);
    if ($v === "") return 0.0;
    $v = str_replace(",", "", $v);
  }
  return (float)$v;
}

function inv_str($v): string {
  return trim((string)($v ?? ""));
}

/**
 * GET /inventory
 */
if ($path === "/inventory" && $method === "GET") {
  $user = require_auth($pdo, $cfg);
  $branchId = require_branch($pdo, (int)$user["id"]);

  $q = $pdo->prepare("SELECT * FROM inventory_items WHERE branch_id=? ORDER BY id DESC");
  $q->execute([$branchId]);

  json_response(200, ["ok" => true, "rows" => $q->fetchAll(PDO::FETCH_ASSOC)]);
}

/**
 * POST /inventory
 */
if ($path === "/inventory" && $method === "POST") {
  $user = require_auth($pdo, $cfg);
  $branchId = require_branch($pdo, (int)$user["id"]);
  $d = json_decode(file_get_contents("php://input"), true) ?: [];

  $sku = inv_str($d["sku"] ?? "");
  $name = inv_str($d["name"] ?? "");
  $unit = inv_str($d["unit"] ?? "pcs");

  $qty_on_hand = inv_num($d["qty_on_hand"] ?? 0);
  $reorder_level = inv_num($d["reorder_level"] ?? 0);
  $cost = inv_num($d["cost"] ?? 0);
  $price = inv_num($d["price"] ?? 0);

  $status = inv_str($d["status"] ?? "active");

  if ($name === "") {
    json_response(400, ["ok" => false, "error" => "name required"]);
  }

  $ins = $pdo->prepare("
    INSERT INTO inventory_items
    (branch_id, sku, name, unit, qty_on_hand, reorder_level, cost, price, status)
    VALUES (?,?,?,?,?,?,?,?,?)
  ");

  $ins->execute([
    $branchId,
    $sku,
    $name,
    $unit,
    $qty_on_hand,
    $reorder_level,
    $cost,
    $price,
    $status
  ]);

  $id = (int)$pdo->lastInsertId();
  audit($pdo, (int)$user["id"], $branchId, "create", "inventory_items", $id);

  json_response(201, ["ok" => true, "id" => $id]);
}

/**
 * PUT /inventory/{id}
 */
if (preg_match("#^/inventory/(\d+)$#", $path, $m) && $method === "PUT") {

  $user = require_auth($pdo, $cfg);
  $branchId = require_branch($pdo, (int)$user["id"]);
  $id = (int)$m[1];

  $d = json_decode(file_get_contents("php://input"), true) ?: [];

  $sku = inv_str($d["sku"] ?? "");
  $name = inv_str($d["name"] ?? "");
  $unit = inv_str($d["unit"] ?? "pcs");

  $qty_on_hand = inv_num($d["qty_on_hand"] ?? 0);
  $reorder_level = inv_num($d["reorder_level"] ?? 0);
  $cost = inv_num($d["cost"] ?? 0);
  $price = inv_num($d["price"] ?? 0);

  $status = inv_str($d["status"] ?? "active");

  $u = $pdo->prepare("
    UPDATE inventory_items
    SET sku=?, name=?, unit=?, qty_on_hand=?, reorder_level=?, cost=?, price=?, status=?
    WHERE id=? AND branch_id=?
  ");

  $u->execute([
    $sku,
    $name,
    $unit,
    $qty_on_hand,
    $reorder_level,
    $cost,
    $price,
    $status,
    $id,
    $branchId
  ]);

  audit($pdo, (int)$user["id"], $branchId, "update", "inventory_items", $id);

  json_response(200, ["ok" => true]);
}

/**
 * DELETE /inventory/{id}
 */
if (preg_match("#^/inventory/(\d+)$#", $path, $m) && $method === "DELETE") {

  $user = require_auth($pdo, $cfg);
  $branchId = require_branch($pdo, (int)$user["id"]);
  $id = (int)$m[1];

  $pdo->prepare("DELETE FROM inventory_items WHERE id=? AND branch_id=?")
      ->execute([$id, $branchId]);

  audit($pdo, (int)$user["id"], $branchId, "delete", "inventory_items", $id);

  json_response(200, ["ok" => true]);
}