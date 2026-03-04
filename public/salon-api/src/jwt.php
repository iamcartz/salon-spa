<?php
declare(strict_types=1);

/**
 * Minimal HS256 JWT for PHP 7.3+ (works in PHP 8+).
 */

function b64url_encode(string $data): string {
  return rtrim(strtr(base64_encode($data), "+/", "-_"), "=");
}

function b64url_decode(string $data): string {
  $remainder = strlen($data) % 4;
  if ($remainder) $data .= str_repeat("=", 4 - $remainder);
  return base64_decode(strtr($data, "-_", "+/"));
}

function jwt_encode(array $payload, string $secret): string {
  $header = ["alg" => "HS256", "typ" => "JWT"];
  $h = b64url_encode(json_encode($header));
  $p = b64url_encode(json_encode($payload));
  $sig = hash_hmac("sha256", $h . "." . $p, $secret, true);
  return $h . "." . $p . "." . b64url_encode($sig);
}

function jwt_decode(string $jwt, string $secret): array {
  $parts = explode(".", $jwt);
  if (count($parts) !== 3) throw new Exception("Invalid token");

  $h64 = (string)$parts[0];
  $p64 = (string)$parts[1];
  $s64 = (string)$parts[2];

  $header = json_decode((string)b64url_decode($h64), true);
  $payload = json_decode((string)b64url_decode($p64), true);
  $sig = b64url_decode($s64);

  if (!is_array($header) || !is_array($payload)) throw new Exception("Invalid token");
  if (($header["alg"] ?? "") !== "HS256") throw new Exception("Unsupported alg");

  $expected = hash_hmac("sha256", $h64 . "." . $p64, $secret, true);
  if (!hash_equals($expected, $sig)) throw new Exception("Bad signature");

  if (isset($payload["exp"]) && time() >= (int)$payload["exp"]) {
    throw new Exception("Token expired");
  }

  return $payload;
}