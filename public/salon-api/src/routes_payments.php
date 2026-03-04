<?php
declare(strict_types=1);

require_once __DIR__ . "/response.php";
require_once __DIR__ . "/auth_mw.php";
require_once __DIR__ . "/branch_scope.php";
require_once __DIR__ . "/audit.php";

if ($path === "/payments" && $method === "GET") {
  $user = require_auth($pdo, $cfg);
  $branchId = require_branch($pdo, (int)$user["id"]);

  $q = $pdo->prepare("
    SELECT p.id, p.appointment_id, p.amount, p.method, p.status, p.paid_at, p.created_at,
           CONCAT(c.first_name,' ',c.last_name) AS client_name,
           CONCAT(s.first_name,' ',s.last_name) AS staff_name
    FROM payments p
    JOIN appointments a ON a.id=p.appointment_id
    JOIN clients c ON c.id=a.client_id
    JOIN staff s ON s.id=a.staff_id
    WHERE p.branch_id=?
    ORDER BY p.id DESC
  ");
  $q->execute([$branchId]);
  json_response(200, ["ok" => true, "rows" => $q->fetchAll(PDO::FETCH_ASSOC)]);
}

if ($path === "/payments" && $method === "POST") {
  $user = require_auth($pdo, $cfg);
  $branchId = require_branch($pdo, (int)$user["id"]);
  $d = json_decode(file_get_contents("php://input"), true) ?: [];

  $appointmentId = (int)($d["appointment_id"] ?? 0);
  $amount = (float)($d["amount"] ?? 0);
  $methodPay = (string)($d["method"] ?? "cash");
  $statusPay = (string)($d["status"] ?? "paid");
  $paidAt = (string)($d["paid_at"] ?? "");

  if ($appointmentId <= 0) json_response(400, ["ok" => false, "error" => "appointment_id required"]);
  if ($paidAt === "") json_response(400, ["ok" => false, "error" => "paid_at required"]);
  if (!in_array($methodPay, ["cash","card","bank"], true)) json_response(400, ["ok" => false, "error" => "Invalid method"]);
  if (!in_array($statusPay, ["paid","refunded","pending"], true)) json_response(400, ["ok" => false, "error" => "Invalid status"]);

  $chk = $pdo->prepare("SELECT id FROM appointments WHERE id=? AND branch_id=?");
  $chk->execute([$appointmentId, $branchId]);
  if (!$chk->fetch()) json_response(403, ["ok" => false, "error" => "Appointment not in branch"]);

  $s = $pdo->prepare("INSERT INTO payments (branch_id, appointment_id, amount, method, status, paid_at)
                      VALUES (?,?,?,?,?,?)");
  $s->execute([$branchId, $appointmentId, $amount, $methodPay, $statusPay, $paidAt]);
  $id = (int)$pdo->lastInsertId();

  audit($pdo, (int)$user["id"], $branchId, "create", "payments", $id);
  json_response(201, ["ok" => true, "id" => $id]);
}

if (preg_match("#^/payments/(\d+)$#", $path, $m) && $method === "DELETE") {
  $user = require_auth($pdo, $cfg);
  $branchId = require_branch($pdo, (int)$user["id"]);
  $id = (int)$m[1];

  $pdo->prepare("DELETE FROM payments WHERE id=? AND branch_id=?")->execute([$id, $branchId]);
  audit($pdo, (int)$user["id"], $branchId, "delete", "payments", $id);

  json_response(200, ["ok" => true]);
}