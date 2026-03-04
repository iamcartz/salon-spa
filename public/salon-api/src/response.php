<?php
declare(strict_types=1);

function json_response(int $code, array $payload): void {
  http_response_code($code);
  header("Content-Type: application/json; charset=utf-8");
  echo json_encode($payload);
  exit;
}