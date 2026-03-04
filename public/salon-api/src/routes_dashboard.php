<?php
// src/routes_dashboard.php
declare(strict_types=1);

require_once __DIR__ . "/auth_mw.php";
require_once __DIR__ . "/branch_scope.php";
require_once __DIR__ . "/response.php";

function dash_date(string $v): string {
  $v = trim($v);
  if ($v === "") return "";
  if (!preg_match("/^\d{4}-\d{2}-\d{2}$/", $v)) return "";
  return $v;
}

if ($path === "/dashboard" && $method === "GET") {
  $user = require_auth($pdo, $cfg);
  $branchId = require_branch($pdo, (int)$user["id"]);

  $from = dash_date((string)($_GET["from"] ?? ""));
  $to   = dash_date((string)($_GET["to"] ?? ""));

  // Default range: last 7 days
  if ($to === "") $to = date("Y-m-d");
  if ($from === "") $from = date("Y-m-d", strtotime($to . " -6 days"));

  $fromDt = $from . " 00:00:00";
  $toDt   = $to . " 23:59:59";

  // --- KPIs ---
  $qAppt = $pdo->prepare("SELECT COUNT(*) FROM appointments WHERE branch_id=? AND start_at BETWEEN ? AND ?");
  $qAppt->execute([$branchId, $fromDt, $toDt]);
  $appointments = (int)$qAppt->fetchColumn();

  $qComp = $pdo->prepare("SELECT COUNT(*) FROM appointments WHERE branch_id=? AND status='completed' AND start_at BETWEEN ? AND ?");
  $qComp->execute([$branchId, $fromDt, $toDt]);
  $completed = (int)$qComp->fetchColumn();

  // Sales (adjust payments.amount if your schema differs)
  $qSales = $pdo->prepare("
    SELECT COALESCE(SUM(p.amount),0)
    FROM payments p
    JOIN appointments a ON a.id=p.appointment_id AND a.branch_id=p.branch_id
    WHERE p.branch_id=? AND a.status='completed' AND a.start_at BETWEEN ? AND ?
  ");
  $qSales->execute([$branchId, $fromDt, $toDt]);
  $sales = (float)$qSales->fetchColumn();

  $qComm = $pdo->prepare("
    SELECT COALESCE(SUM(commission_amount),0)
    FROM commissions
    WHERE branch_id=? AND appointment_id IN (
      SELECT id FROM appointments
      WHERE branch_id=? AND status='completed' AND start_at BETWEEN ? AND ?
    )
  ");
  $qComm->execute([$branchId, $branchId, $fromDt, $toDt]);
  $commissions = (float)$qComm->fetchColumn();

  // New clients (adjust clients.created_at if needed)
  $qClients = $pdo->prepare("SELECT COUNT(*) FROM clients WHERE branch_id=? AND created_at BETWEEN ? AND ?");
  $qClients->execute([$branchId, $fromDt, $toDt]);
  $newClients = (int)$qClients->fetchColumn();

  // --- Charts ---
  // A) Appointments per day
  $qDaily = $pdo->prepare("
    SELECT DATE(start_at) AS day,
           COUNT(*) AS total,
           SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) AS completed
    FROM appointments
    WHERE branch_id=? AND start_at BETWEEN ? AND ?
    GROUP BY DATE(start_at)
    ORDER BY DATE(start_at) ASC
  ");
  $qDaily->execute([$branchId, $fromDt, $toDt]);
  $daily = $qDaily->fetchAll(PDO::FETCH_ASSOC);

  // B) Status breakdown (donut)
  $qStatus = $pdo->prepare("
    SELECT status, COUNT(*) AS cnt
    FROM appointments
    WHERE branch_id=? AND start_at BETWEEN ? AND ?
    GROUP BY status
    ORDER BY cnt DESC
  ");
  $qStatus->execute([$branchId, $fromDt, $toDt]);
  $status = $qStatus->fetchAll(PDO::FETCH_ASSOC);

  json_response(200, [
    "ok" => true,
    "range" => ["from" => $from, "to" => $to],
    "stats" => [
      "sales" => $sales,
      "appointments" => $appointments,
      "completed" => $completed,
      "commissions" => $commissions,
      "new_clients" => $newClients
    ],
    "charts" => [
      "daily_appointments" => $daily,
      "status_breakdown" => $status
    ]
  ]);
}