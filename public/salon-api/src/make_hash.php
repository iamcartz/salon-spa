<?php
header("Content-Type: text/plain; charset=UTF-8");
$pw = "Admin@12345"; // change if you want
echo password_hash($pw, PASSWORD_BCRYPT), PHP_EOL;