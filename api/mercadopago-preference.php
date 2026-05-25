<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Método no permitido.']);
    exit;
}

$accessToken = getenv('MP_ACCESS_TOKEN') ?: '';

if ($accessToken === '') {
    http_response_code(500);
    echo json_encode(['error' => 'Falta configurar MP_ACCESS_TOKEN en el servidor.']);
    exit;
}

$rawBody = file_get_contents('php://input') ?: '';
$order = json_decode($rawBody, true);

if (!is_array($order)) {
    http_response_code(400);
    echo json_encode(['error' => 'JSON inválido.']);
    exit;
}

$quantity = filter_var($order['quantity'] ?? 0, FILTER_VALIDATE_INT);
$buyer = is_array($order['buyer'] ?? null) ? $order['buyer'] : [];
$email = filter_var($buyer['email'] ?? '', FILTER_VALIDATE_EMAIL);

if (!$quantity || $quantity < 1 || $quantity > 20 || !$email) {
    http_response_code(422);
    echo json_encode(['error' => 'Datos de compra inválidos.']);
    exit;
}

$ticketPrice = 45000;
$scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
$host = $_SERVER['HTTP_HOST'] ?? '';
$baseUrl = $host ? "{$scheme}://{$host}" : '';
$externalReference = 'CEBSA-' . date('YmdHis') . '-' . random_int(1000, 9999);

$preference = [
    'items' => [
        [
            'id' => 'entrada-general-cebsa-2026',
            'title' => 'Entrada general CEBSA 2026',
            'description' => 'Congreso de Educación y Bienestar Sur Argentino - 18 y 19 de septiembre de 2026',
            'quantity' => $quantity,
            'currency_id' => 'ARS',
            'unit_price' => $ticketPrice,
        ],
    ],
    'payer' => [
        'name' => trim((string)($buyer['name'] ?? '')),
        'email' => $email,
        'phone' => [
            'number' => trim((string)($buyer['phone'] ?? '')),
        ],
        'identification' => [
            'type' => 'DNI',
            'number' => trim((string)($buyer['dni'] ?? '')),
        ],
    ],
    'external_reference' => $externalReference,
    'metadata' => [
        'event' => 'CEBSA 2026',
        'buyer_institution' => trim((string)($buyer['institution'] ?? '')),
        'quantity' => $quantity,
    ],
];

if ($baseUrl !== '') {
    $preference['back_urls'] = [
        'success' => $baseUrl . '/congreso.html?payment=success',
        'failure' => $baseUrl . '/congreso.html?payment=failure',
        'pending' => $baseUrl . '/congreso.html?payment=pending',
    ];
    $preference['auto_return'] = 'approved';
}

$webhookUrl = getenv('MP_WEBHOOK_URL') ?: '';
if ($webhookUrl !== '') {
    $preference['notification_url'] = $webhookUrl;
}

$curl = curl_init('https://api.mercadopago.com/checkout/preferences');
curl_setopt_array($curl, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => [
        'Authorization: Bearer ' . $accessToken,
        'Content-Type: application/json',
    ],
    CURLOPT_POSTFIELDS => json_encode($preference),
    CURLOPT_TIMEOUT => 20,
]);

$response = curl_exec($curl);
$statusCode = curl_getinfo($curl, CURLINFO_HTTP_CODE);
$curlError = curl_error($curl);
curl_close($curl);

if ($response === false) {
    http_response_code(502);
    echo json_encode(['error' => 'No se pudo conectar con Mercado Pago.', 'detail' => $curlError]);
    exit;
}

http_response_code($statusCode ?: 500);
echo $response;
