<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . DIRECTORY_SEPARATOR . 'inscripciones-store.php';

function loadEnvFile(string $path): void
{
    if (!is_readable($path)) {
        return;
    }

    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if ($lines === false) {
        return;
    }

    foreach ($lines as $line) {
        $trimmed = trim($line);
        if ($trimmed === '' || strpos($trimmed, '#') === 0 || strpos($trimmed, '=') === false) {
            continue;
        }

        [$key, $value] = array_map('trim', explode('=', $trimmed, 2));
        if ($key === '' || getenv($key) !== false) {
            continue;
        }

        $value = trim($value, "\"'");
        putenv($key . '=' . $value);
        $_ENV[$key] = $value;
        $_SERVER[$key] = $value;
    }
}

function envValue(array $keys): string
{
    foreach ($keys as $key) {
        $value = getenv($key);
        if ($value !== false && trim($value) !== '') {
            return trim((string)$value);
        }
    }

    return '';
}

function requestToken(): string
{
    $queryToken = trim((string)($_GET['token'] ?? ''));
    if ($queryToken !== '') {
        return $queryToken;
    }

    $headerToken = trim((string)($_SERVER['HTTP_X_ADMIN_TOKEN'] ?? ''));
    return $headerToken;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Metodo no permitido.']);
    exit;
}

loadEnvFile(dirname(__DIR__) . DIRECTORY_SEPARATOR . '.env');

$adminToken = envValue(['INSCRIPTOS_ADMIN_TOKEN', 'REGISTRO_ADMIN_TOKEN']);
if ($adminToken === '') {
    http_response_code(500);
    echo json_encode(['error' => 'Falta configurar INSCRIPTOS_ADMIN_TOKEN.']);
    exit;
}

if (!hash_equals($adminToken, requestToken())) {
    http_response_code(401);
    echo json_encode(['error' => 'No autorizado.']);
    exit;
}

$totals = inscripcionesGetTotals();
echo json_encode([
    'ok' => true,
    'total_personas' => $totals['personas'],
    'total_pagos_aprobados' => $totals['pagos_aprobados'],
    'updated_at' => $totals['updated_at'],
]);
