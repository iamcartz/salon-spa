<?php
declare(strict_types=1);

require_once __DIR__ . "/response.php";
require_once __DIR__ . "/auth_mw.php";

/**
 * GET /branches  (branches available to the logged-in user)
 */
if ($path === "/branches" && $method === "GET") {
  $user = require_auth($pdo, $cfg);

  $q = $pdo->prepare("
    SELECT b.id, b.name, b.status
    FROM user_branches ub
    JOIN branches b ON b.id = ub.branch_id
    WHERE ub.user_id = ?
    ORDER BY b.name
  ");
  $q->execute([(int)$user["id"]]);
  json_response(200, ["ok" => true, "rows" => $q->fetchAll(PDO::FETCH_ASSOC)]);
}