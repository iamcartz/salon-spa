<?php
declare(strict_types=1);

require_once __DIR__ . "/response.php";

/**
 * Writes an audit row.
 * Compatible with multiple table schemas.
 * If audit insert fails, it will NOT break the main request.
 */
function audit(PDO $pdo, int $userId, int $branchId, string $action, string $table, int $recordId): void {
  $ip = $_SERVER["REMOTE_ADDR"] ?? "";
  $ua = $_SERVER["HTTP_USER_AGENT"] ?? "";

  // Try multiple column mappings depending on your audit_log table schema
  $candidates = [
    // Schema 1: has table_name + record_id
    [
      "sql" => "INSERT INTO audit_log (branch_id, user_id, action, table_name, record_id, ip, user_agent, created_at)
               VALUES (?,?,?,?,?,?,?,NOW())",
      "params" => [$branchId, $userId, $action, $table, $recordId, $ip, $ua],
    ],
    // Schema 2: uses entity + entity_id
    [
      "sql" => "INSERT INTO audit_log (branch_id, user_id, action, entity, entity_id, ip, user_agent, created_at)
               VALUES (?,?,?,?,?,?,?,NOW())",
      "params" => [$branchId, $userId, $action, $table, $recordId, $ip, $ua],
    ],
    // Schema 3: uses entity_name + entity_pk
    [
      "sql" => "INSERT INTO audit_log (branch_id, user_id, action, entity_name, entity_pk, ip, user_agent, created_at)
               VALUES (?,?,?,?,?,?,?,NOW())",
      "params" => [$branchId, $userId, $action, $table, $recordId, $ip, $ua],
    ],
  ];

  foreach ($candidates as $c) {
    try {
      $st = $pdo->prepare($c["sql"]);
      $st->execute($c["params"]);
      return; // success
    } catch (Throwable $e) {
      // try next schema
    }
  }

  // If none worked, ignore audit failure (do not break core API)
}