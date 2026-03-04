<?php
declare(strict_types=1);

function rate_limit(PDO $pdo, string $key, int $limitPerMin): bool {
  $window = (new DateTimeImmutable("now"))->format("Y-m-d H:i:00");
  $stmt = $pdo->prepare("INSERT INTO api_rate_limits (k, window_start, hits)
                         VALUES (?, ?, 1)
                         ON DUPLICATE KEY UPDATE hits = hits + 1");
  $stmt->execute([$key, $window]);

  $q = $pdo->prepare("SELECT hits FROM api_rate_limits WHERE k=? AND window_start=?");
  $q->execute([$key, $window]);
  $hits = (int)($q->fetchColumn() ?: 0);

  return $hits <= $limitPerMin;
}