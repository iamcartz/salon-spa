<?php
declare(strict_types=1);

/**
 * PHP 7.3 polyfills for PHP 8 string helper functions.
 * Safe to include on PHP 8+.
 */

if (!function_exists("str_starts_with")) {
  function str_starts_with(string $haystack, string $needle): bool {
    if ($needle === "") return true;
    return strncmp($haystack, $needle, strlen($needle)) === 0;
  }
}

if (!function_exists("str_ends_with")) {
  function str_ends_with(string $haystack, string $needle): bool {
    if ($needle === "") return true;
    $len = strlen($needle);
    if ($len === 0) return true;
    return substr($haystack, -$len) === $needle;
  }
}

if (!function_exists("str_contains")) {
  function str_contains(string $haystack, string $needle): bool {
    if ($needle === "") return true;
    return strpos($haystack, $needle) !== false;
  }
}