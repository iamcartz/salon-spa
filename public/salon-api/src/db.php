<?php
declare(strict_types=1);

function db(array $cfg): PDO {
  $host = (string)($cfg["host"] ?? "localhost");
  $name = (string)($cfg["name"] ?? "");
  $user = (string)($cfg["user"] ?? "");
  $pass = (string)($cfg["pass"] ?? "");
  $charset = (string)($cfg["charset"] ?? "utf8mb4");

  $dsn = "mysql:host={$host};dbname={$name};charset={$charset}";
  $pdo = new PDO($dsn, $user, $pass, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES => false,
  ]);

  return $pdo;
}