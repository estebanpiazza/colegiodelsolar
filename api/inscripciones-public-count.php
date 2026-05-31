<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . DIRECTORY_SEPARATOR . 'inscripciones-store.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Metodo no permitido.']);
    exit;
}

$totals = inscripcionesGetTotals();
echo json_encode([
    'ok' => true,
    'total_personas' => $totals['personas'],
]);
