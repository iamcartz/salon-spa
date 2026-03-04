<?php
// src/routes_appointments.php
declare(strict_types=1);

require_once __DIR__ . "/auth_mw.php";
require_once __DIR__ . "/branch_scope.php";
require_once __DIR__ . "/audit.php";
require_once __DIR__ . "/response.php";

/**
 * Helper: calculate & insert commissions for an appointment.
 * - Uses appointment_items.price_at_time sum as gross.
 * - Commission rate: per-item override (appointment_items.commission_rate_at_time) if set,
 *   else service.commission_rate if set,
 *   else staff.commission_rate.
 * - Creates one commission row for the appointment (gross + chosen rate).
 * - Idempotent: deletes existing commissions for appointment_id first.
 */
function calculate_commission(PDO $pdo, int $branchId, int $appointmentId): void
{
  // get appointment staff_id
  $a = $pdo->prepare("SELECT id, staff_id FROM appointments WHERE id=? AND branch_id=? LIMIT 1");
  $a->execute([$appointmentId, $branchId]);
  $appt = $a->fetch();
  if (!$appt)
    return;

  $staffId = (int) $appt["staff_id"];

  // staff base commission
  $st = $pdo->prepare("SELECT commission_rate FROM staff WHERE id=? AND branch_id=? LIMIT 1");
  $st->execute([$staffId, $branchId]);
  $staffRate = (float) ($st->fetchColumn() ?: 0);

  // load items with service commission
  $q = $pdo->prepare("
    SELECT ai.price_at_time, ai.commission_rate_at_time, s.commission_rate AS service_commission
    FROM appointment_items ai
    JOIN services s ON s.id = ai.service_id
    WHERE ai.appointment_id = ?
  ");
  $q->execute([$appointmentId]);
  $items = $q->fetchAll();

  if (!$items)
    return;

  $gross = 0.0;
  $effectiveRates = [];

  foreach ($items as $it) {
    $price = (float) $it["price_at_time"];
    $gross += $price;

    $rate = null;
    if ($it["commission_rate_at_time"] !== null && $it["commission_rate_at_time"] !== "") {
      $rate = (float) $it["commission_rate_at_time"];
    } elseif ($it["service_commission"] !== null && $it["service_commission"] !== "") {
      $rate = (float) $it["service_commission"];
    } else {
      $rate = $staffRate;
    }
    $effectiveRates[] = $rate;
  }

  // Choose a single rate for the appointment commission record:
  // Weighted average by price is best. (simple + fair)
  $weighted = 0.0;
  foreach ($items as $idx => $it) {
    $price = (float) $it["price_at_time"];
    $weighted += $price * ($effectiveRates[$idx] / 100.0);
  }
  $effectiveRate = $gross > 0 ? ($weighted / $gross) * 100.0 : 0.0;
  $commissionAmount = $gross * ($effectiveRate / 100.0);

  // reset then insert
  $pdo->prepare("DELETE FROM commissions WHERE appointment_id=? AND branch_id=?")->execute([$appointmentId, $branchId]);

  $ins = $pdo->prepare("
    INSERT INTO commissions (branch_id, staff_id, appointment_id, gross_amount, commission_rate, commission_amount)
    VALUES (?,?,?,?,?,?)
  ");
  $ins->execute([$branchId, $staffId, $appointmentId, $gross, $effectiveRate, $commissionAmount]);
}

if ($path === "/appointments" && $method === "GET") {
  $user = require_auth($pdo, $cfg);
  $branchId = require_branch($pdo, (int) $user["id"]);

  $q = $pdo->prepare("
    SELECT a.id, a.client_id, a.staff_id,
           CONCAT(c.first_name,' ',c.last_name) AS client_name,
           CONCAT(s.first_name,' ',s.last_name) AS staff_name,
           a.start_at, a.end_at, a.status, a.notes
    FROM appointments a
    JOIN clients c ON c.id=a.client_id
    JOIN staff s ON s.id=a.staff_id
    WHERE a.branch_id=?
    ORDER BY a.id DESC
  ");
  $q->execute([$branchId]);
  json_response(200, ["ok" => true, "rows" => $q->fetchAll()]);
}

if ($path === "/appointments" && $method === "POST") {
  $user = require_auth($pdo, $cfg);
  $branchId = require_branch($pdo, (int) $user["id"]);
  $d = json_decode(file_get_contents("php://input"), true) ?: [];

  $clientId = (int) ($d["client_id"] ?? 0);
  $staffId = (int) ($d["staff_id"] ?? 0);
  $startAt = (string) ($d["start_at"] ?? "");
  $endAt = (string) ($d["end_at"] ?? "");
  $status = (string) ($d["status"] ?? "booked");
  $notes = (string) ($d["notes"] ?? "");
  $serviceIds = $d["service_ids"] ?? [];

  if ($clientId <= 0 || $staffId <= 0)
    json_response(400, ["ok" => false, "error" => "client_id and staff_id required"]);
  if ($startAt === "" || $endAt === "")
    json_response(400, ["ok" => false, "error" => "start_at and end_at required"]);
  if (!is_array($serviceIds) || count($serviceIds) === 0)
    json_response(400, ["ok" => false, "error" => "service_ids required"]);

  $pdo->beginTransaction();
  try {
    // ensure client/staff belong to branch
    $chkC = $pdo->prepare("SELECT id FROM clients WHERE id=? AND branch_id=?");
    $chkC->execute([$clientId, $branchId]);
    if (!$chkC->fetch())
      json_response(400, ["ok" => false, "error" => "Client not in branch"]);

    $chkS = $pdo->prepare("SELECT id FROM staff WHERE id=? AND branch_id=?");
    $chkS->execute([$staffId, $branchId]);
    if (!$chkS->fetch())
      json_response(400, ["ok" => false, "error" => "Staff not in branch"]);

    $ins = $pdo->prepare("INSERT INTO appointments (branch_id, client_id, staff_id, start_at, end_at, status, notes)
                          VALUES (?,?,?,?,?,?,?)");
    $ins->execute([$branchId, $clientId, $staffId, $startAt, $endAt, $status, $notes]);
    $apptId = (int) $pdo->lastInsertId();

    // insert items (price snapshot + commission snapshot)
    $svcQ = $pdo->prepare("SELECT id, price, commission_rate FROM services WHERE id=? AND branch_id=? AND status='active' LIMIT 1");
    $insItem = $pdo->prepare("INSERT INTO appointment_items (appointment_id, service_id, price_at_time, commission_rate_at_time)
                              VALUES (?,?,?,?)");

    foreach ($serviceIds as $sidRaw) {
      $sid = (int) $sidRaw;
      $svcQ->execute([$sid, $branchId]);
      $svc = $svcQ->fetch();
      if (!$svc)
        json_response(400, ["ok" => false, "error" => "Invalid service_id: $sid"]);

      $price = (float) $svc["price"];
      $cr = $svc["commission_rate"];
      $cr = ($cr === null || $cr === "") ? null : (float) $cr; // snapshot service commission
      $insItem->execute([$apptId, $sid, $price, $cr]);
    }

    // auto commission if already completed
    if ($status === "completed") {
      calculate_commission($pdo, $branchId, $apptId);
    }

    audit($pdo, (int) $user["id"], $branchId, "create", "appointments", $apptId);
    $pdo->commit();
    json_response(201, ["ok" => true, "id" => $apptId]);
  } catch (Throwable $e) {
    if ($pdo->inTransaction())
      $pdo->rollBack();
    json_response(400, [
      "ok" => false,
      "error" => "Failed to create appointment",
      "detail" => $e->getMessage()
    ]);
  }
}

if (preg_match("#^/appointments/(\d+)$#", $path, $m) && $method === "PUT") {
  $user = require_auth($pdo, $cfg);
  $branchId = require_branch($pdo, (int) $user["id"]);
  $apptId = (int) $m[1];
  $d = json_decode(file_get_contents("php://input"), true) ?: [];

  $clientId = (int) ($d["client_id"] ?? 0);
  $staffId = (int) ($d["staff_id"] ?? 0);
  $startAt = (string) ($d["start_at"] ?? "");
  $endAt = (string) ($d["end_at"] ?? "");
  $status = (string) ($d["status"] ?? "booked");
  $notes = (string) ($d["notes"] ?? "");
  $serviceIds = $d["service_ids"] ?? [];

  if ($clientId <= 0 || $staffId <= 0)
    json_response(400, ["ok" => false, "error" => "client_id and staff_id required"]);
  if ($startAt === "" || $endAt === "")
    json_response(400, ["ok" => false, "error" => "start_at and end_at required"]);
  if (!is_array($serviceIds) || count($serviceIds) === 0)
    json_response(400, ["ok" => false, "error" => "service_ids required"]);

  $pdo->beginTransaction();
  try {
    $u = $pdo->prepare("UPDATE appointments
                        SET client_id=?, staff_id=?, start_at=?, end_at=?, status=?, notes=?
                        WHERE id=? AND branch_id=?");
    $u->execute([$clientId, $staffId, $startAt, $endAt, $status, $notes, $apptId, $branchId]);

    // replace items
    $pdo->prepare("DELETE FROM appointment_items WHERE appointment_id=?")->execute([$apptId]);

    $svcQ = $pdo->prepare("SELECT id, price, commission_rate FROM services WHERE id=? AND branch_id=? AND status='active' LIMIT 1");
    $insItem = $pdo->prepare("INSERT INTO appointment_items (appointment_id, service_id, price_at_time, commission_rate_at_time)
                              VALUES (?,?,?,?)");

    foreach ($serviceIds as $sidRaw) {
      $sid = (int) $sidRaw;
      $svcQ->execute([$sid, $branchId]);
      $svc = $svcQ->fetch();
      if (!$svc)
        json_response(400, ["ok" => false, "error" => "Invalid service_id: $sid"]);

      $price = (float) $svc["price"];
      $cr = $svc["commission_rate"];
      $cr = ($cr === null || $cr === "") ? null : (float) $cr;
      $insItem->execute([$apptId, $sid, $price, $cr]);
    }

    // commission logic: if completed -> compute; else delete any previous commission
    if ($status === "completed") {
      calculate_commission($pdo, $branchId, $apptId);
    } else {
      $pdo->prepare("DELETE FROM commissions WHERE appointment_id=? AND branch_id=?")->execute([$apptId, $branchId]);
    }

    audit($pdo, (int) $user["id"], $branchId, "update", "appointments", $apptId);
    $pdo->commit();
    json_response(200, ["ok" => true]);
  } catch (Throwable $e) {
    if ($pdo->inTransaction())
      $pdo->rollBack();
    json_response(400, [
      "ok" => false,
      "error" => "Failed to create appointment",
      "detail" => $e->getMessage()
    ]);
  }
}

if (preg_match("#^/appointments/(\d+)/status$#", $path, $m) && $method === "PUT") {
  $user = require_auth($pdo, $cfg);
  $branchId = require_branch($pdo, (int) $user["id"]);
  $apptId = (int) $m[1];
  $d = json_decode(file_get_contents("php://input"), true) ?: [];
  $status = (string) ($d["status"] ?? "");

  if (!in_array($status, ["booked", "checked_in", "completed", "cancelled", "no_show"], true)) {
    json_response(400, ["ok" => false, "error" => "Invalid status"]);
  }

  $pdo->beginTransaction();
  try {
    $u = $pdo->prepare("UPDATE appointments SET status=? WHERE id=? AND branch_id=?");
    $u->execute([$status, $apptId, $branchId]);

    if ($status === "completed") {
      calculate_commission($pdo, $branchId, $apptId);
    } else {
      $pdo->prepare("DELETE FROM commissions WHERE appointment_id=? AND branch_id=?")->execute([$apptId, $branchId]);
    }

    audit($pdo, (int) $user["id"], $branchId, "status_change", "appointments", $apptId);
    $pdo->commit();
    json_response(200, ["ok" => true]);
  } catch (Throwable $e) {
    if ($pdo->inTransaction())
      $pdo->rollBack();
    json_response(400, [
      "ok" => false,
      "error" => "Failed to create appointment",
      "detail" => $e->getMessage()
    ]);
  }
}

if (preg_match("#^/appointments/(\d+)/items$#", $path, $m) && $method === "GET") {
  $user = require_auth($pdo, $cfg);
  $branchId = require_branch($pdo, (int) $user["id"]);
  $apptId = (int) $m[1];

  // verify appointment is in branch
  $chk = $pdo->prepare("SELECT id FROM appointments WHERE id=? AND branch_id=?");
  $chk->execute([$apptId, $branchId]);
  if (!$chk->fetch())
    json_response(404, ["ok" => false, "error" => "Not found"]);

  $q = $pdo->prepare("SELECT id, appointment_id, service_id, price_at_time, commission_rate_at_time
                      FROM appointment_items WHERE appointment_id=? ORDER BY id");
  $q->execute([$apptId]);
  json_response(200, ["ok" => true, "items" => $q->fetchAll()]);
}

if (preg_match("#^/appointments/(\d+)$#", $path, $m) && $method === "DELETE") {
  $user = require_auth($pdo, $cfg);
  $branchId = require_branch($pdo, (int) $user["id"]);
  $apptId = (int) $m[1];

  $pdo->beginTransaction();
  try {
    $pdo->prepare("DELETE FROM commissions WHERE appointment_id=? AND branch_id=?")->execute([$apptId, $branchId]);
    $pdo->prepare("DELETE FROM payments WHERE appointment_id=? AND branch_id=?")->execute([$apptId, $branchId]);
    $pdo->prepare("DELETE FROM appointments WHERE id=? AND branch_id=?")->execute([$apptId, $branchId]);

    audit($pdo, (int) $user["id"], $branchId, "delete", "appointments", $apptId);
    $pdo->commit();
    json_response(200, ["ok" => true]);
  } catch (Throwable $e) {
    if ($pdo->inTransaction())
      $pdo->rollBack();
    json_response(400, [
      "ok" => false,
      "error" => "Failed to create appointment",
      "detail" => $e->getMessage()
    ]);
  }
}