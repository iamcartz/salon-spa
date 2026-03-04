<?php
// src/routes_dashboard.php
declare(strict_types=1);

require_once __DIR__ . "/response.php";
require_once __DIR__ . "/auth_mw.php";
require_once __DIR__ . "/branch_scope.php";

/**
 * Helpers to make this work even if your DB uses slightly different column names
 * (e.g. payments.paid_at vs payments.created_at, payments.amount vs payments.total).
 */
function column_exists(PDO $pdo, string $table, string $col): bool {
  $sql = "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?";
  $st = $pdo->prepare($sql);
  $st->execute([$table, $col]);
  return (int)$st->fetchColumn() > 0;
}

function pick_existing_col(PDO $pdo, string $table, array $candidates, string $fallback): string {
  foreach ($candidates as $c) {
    if (column_exists($pdo, $table, $c)) return $c;
  }
  return $fallback;
}

function date_or_default(string $v, string $fallback): string {
  $v = trim($v);
  if ($v === "") return $fallback;
  // accept YYYY-MM-DD only
  if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $v)) return $fallback;
  return $v;
}

function build_date_range(string $from, string $to): array {
  $out = [];
  $start = new DateTime($from);
  $end = new DateTime($to);
  if ($start > $end) {
    $tmp = $start; $start = $end; $end = $tmp;
  }
  while ($start <= $end) {
    $out[] = $start->format("Y-m-d");
    $start->modify("+1 day");
  }
  return $out;
}

/**
 * GET /dashboard?from=YYYY-MM-DD&to=YYYY-MM-DD
 */
if ($path === "/dashboard" && $method === "GET") {
  $user = require_auth($pdo, $cfg);
  $branchId = require_branch($pdo, (int)$user["id"]);

  // default last 7 days
  $today = (new DateTime("today"))->format("Y-m-d");
  $weekAgo = (new DateTime("today"))->modify("-6 days")->format("Y-m-d");

  $from = date_or_default((string)($_GET["from"] ?? ""), $weekAgo);
  $to   = date_or_default((string)($_GET["to"] ?? ""), $today);

  // pick date columns safely
  $paymentsDateCol = pick_existing_col($pdo, "payments", ["paid_at", "payment_date", "created_at"], "created_at");
  $paymentsAmountCol = pick_existing_col($pdo, "payments", ["amount", "total_amount", "paid_amount"], "amount");

  $clientsDateCol = pick_existing_col($pdo, "clients", ["created_at", "date_created"], "created_at");
  $commDateCol = pick_existing_col($pdo, "commissions", ["created_at", "date_created"], "created_at");

  // appointments: use start_at for charts/filters
  $apptDateCol = pick_existing_col($pdo, "appointments", ["start_at", "created_at"], "start_at");

  // KPIs
  // 1) Sales total
  $sales = 0.0;
  if (column_exists($pdo, "payments", $paymentsAmountCol)) {
    $q = $pdo->prepare("
      SELECT COALESCE(SUM($paymentsAmountCol),0) AS total
      FROM payments
      WHERE branch_id=?
        AND DATE($paymentsDateCol) BETWEEN ? AND ?
    ");
    $q->execute([$branchId, $from, $to]);
    $sales = (float)$q->fetchColumn();
  }

  // 2) Appointments count
  $q = $pdo->prepare("
    SELECT COUNT(*) FROM appointments
    WHERE branch_id=? AND DATE($apptDateCol) BETWEEN ? AND ?
  ");
  $q->execute([$branchId, $from, $to]);
  $appointmentsCount = (int)$q->fetchColumn();

  // 3) New clients count
  $q = $pdo->prepare("
    SELECT COUNT(*) FROM clients
    WHERE branch_id=? AND DATE($clientsDateCol) BETWEEN ? AND ?
  ");
  $q->execute([$branchId, $from, $to]);
  $newClients = (int)$q->fetchColumn();

  // 4) Commissions total
  $commissions = 0.0;
  if (column_exists($pdo, "commissions", "commission_amount")) {
    $q = $pdo->prepare("
      SELECT COALESCE(SUM(commission_amount),0)
      FROM commissions
      WHERE branch_id=? AND DATE($commDateCol) BETWEEN ? AND ?
    ");
    $q->execute([$branchId, $from, $to]);
    $commissions = (float)$q->fetchColumn();
  }

  // Chart series (daily)
  $days = build_date_range($from, $to);

  // Daily revenue
  $revMap = [];
  if (column_exists($pdo, "payments", $paymentsAmountCol)) {
    $q = $pdo->prepare("
      SELECT DATE($paymentsDateCol) AS d, COALESCE(SUM($paymentsAmountCol),0) AS v
      FROM payments
      WHERE branch_id=? AND DATE($paymentsDateCol) BETWEEN ? AND ?
      GROUP BY DATE($paymentsDateCol)
      ORDER BY d
    ");
    $q->execute([$branchId, $from, $to]);
    foreach ($q->fetchAll(PDO::FETCH_ASSOC) as $r) {
      $revMap[(string)$r["d"]] = (float)$r["v"];
    }
  }

  // Daily appointments
  $apptMap = [];
  $q = $pdo->prepare("
    SELECT DATE($apptDateCol) AS d, COUNT(*) AS v
    FROM appointments
    WHERE branch_id=? AND DATE($apptDateCol) BETWEEN ? AND ?
    GROUP BY DATE($apptDateCol)
    ORDER BY d
  ");
  $q->execute([$branchId, $from, $to]);
  foreach ($q->fetchAll(PDO::FETCH_ASSOC) as $r) {
    $apptMap[(string)$r["d"]] = (int)$r["v"];
  }

  $series = [];
  foreach ($days as $d) {
    $series[] = [
      "date" => $d,
      "revenue" => (float)($revMap[$d] ?? 0),
      "appointments" => (int)($apptMap[$d] ?? 0),
    ];
  }

  json_response(200, [
    "ok" => true,
    "range" => ["from" => $from, "to" => $to],
    "kpis" => [
      "sales" => $sales,
      "appointments" => $appointmentsCount,
      "new_clients" => $newClients,
      "commissions" => $commissions,
    ],
    "series" => $series,
  ]);
}