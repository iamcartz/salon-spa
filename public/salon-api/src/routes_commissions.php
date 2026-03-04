<?php
declare(strict_types=1);

require_once __DIR__ . "/response.php";
require_once __DIR__ . "/auth_mw.php";
require_once __DIR__ . "/branch_scope.php";

if ($path === "/commissions" && $method === "GET") {
  $user = require_auth($pdo, $cfg);
  $branchId = require_branch($pdo, (int)$user["id"]);

  $q = $pdo->prepare("
    SELECT c.*, CONCAT(s.first_name,' ',s.last_name) AS staff_name
    FROM commissions c
    JOIN staff s ON s.id = c.staff_id
    WHERE c.branch_id=?
    ORDER BY c.id DESC
  ");
  $q->execute([$branchId]);

  json_response(200, ["ok" => true, "rows" => $q->fetchAll(PDO::FETCH_ASSOC)]);
}