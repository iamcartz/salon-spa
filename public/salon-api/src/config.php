<?php
declare(strict_types=1);

return [
  "app" => [
    "env" => "local",
    // Set true only on localhost; disables in production
    "allow_dev_hash" => true,
  ],

  "db" => [
    "host" => "localhost",
    "name" => "salon_app",
    "user" => "root",
    "pass" => "",
    "charset" => "utf8mb4",
  ],

  "jwt" => [
    // IMPORTANT: change this to a long random string (64+ chars)
    "secret" => "7f2c1b9e0b0c4fthequickbrownfoxjumpsoverthelazydog1234567890abcdef",
    "ttl_seconds" => 1800, // 30 minutes
  ],

  "cors" => [
    "allowed_origins" => [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
    ],
  ],
];