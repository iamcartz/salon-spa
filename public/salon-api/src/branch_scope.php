<?php
declare(strict_types=1);

require_once __DIR__ . "/response.php";

function user_allowed_branches(PDO $pdo, $userId): array {
  $s = $pdo->prepare("SELECT branch_id FROM user_branches WHERE user_id=?");
  $s->execute([(int)$userId]);

  $rows = $s->fetchAll(PDO::FETCH_ASSOC);
  $out = [];
  foreach ($rows as $r) {
    $out[] = (int)$r["branch_id"];
  }
  return $out;
}

function require_branch(PDO $pdo, int $userId): int {
  $branchId = isset($_SERVER["HTTP_X_BRANCH_ID"]) ? (int)$_SERVER["HTTP_X_BRANCH_ID"] : 0;
  if ($branchId <= 0 && isset($_GET["branch_id"])) $branchId = (int)$_GET["branch_id"];

  // Fallback: pick first allowed branch
  if ($branchId <= 0) {
    $allowed = user_allowed_branches($pdo, $userId);
    if (count($allowed) === 0) json_response(403, ["ok" => false, "error" => "No branch access"]);
    $branchId = (int)$allowed[0];
  } else {
    $allowed = user_allowed_branches($pdo, $userId);
    if (!in_array($branchId, $allowed, true)) {
      json_response(403, ["ok" => false, "error" => "Branch access denied"]);
    }
  }

  return $branchId;
}