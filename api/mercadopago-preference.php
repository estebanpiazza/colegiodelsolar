<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

function allowLocalDevelopmentCors(): void
{
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    $allowedOrigins = [
        'http://127.0.0.1:5500',
        'http://127.0.0.1:5501',
        'http://127.0.0.1:5502',
        'http://127.0.0.1:8000',
        'http://localhost:5500',
        'http://localhost:5501',
        'http://localhost:5502',
        'http://localhost:8000',
    ];

    if (in_array($origin, $allowedOrigins, true)) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Vary: Origin');
        header('Access-Control-Allow-Headers: Content-Type');
        header('Access-Control-Allow-Methods: POST, OPTIONS');
    }
}

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

function publicBaseUrl(): string
{
    $configuredBaseUrl = rtrim(envValue(['SITE_URL', 'APP_URL', 'URL']), '/');
    $scheme = strtolower((string)parse_url($configuredBaseUrl, PHP_URL_SCHEME));

    if (in_array($scheme, ['http', 'https'], true)) {
        return $configuredBaseUrl;
    }

    $requestScheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? '';

    return $host ? "{$requestScheme}://{$host}" : '';
}

function mercadoPagoAccessToken(): array
{
    $explicitToken = envValue(['MP_ACCESS_TOKEN', 'MERCADOPAGO_ACCESS_TOKEN']);
    if ($explicitToken !== '') {
        return [$explicitToken, 'explicit'];
    }

    $mode = strtolower(envValue(['MP_ENV', 'MP_MODE', 'APP_ENV', 'ENVIRONMENT']));
    $productionToken = envValue(['MP_ACCESS_TOKEN_PROD', 'MERCADOPAGO_ACCESS_TOKEN_PROD', 'acces_token_produccion', 'access_token_produccion']);
    $testToken = envValue(['MP_ACCESS_TOKEN_TEST', 'MERCADOPAGO_ACCESS_TOKEN_TEST', 'mp_acces_token_prueba', 'mp_access_token_prueba']);

    if (in_array($mode, ['test', 'testing', 'sandbox', 'prueba', 'dev', 'development', 'local'], true)) {
        return [$testToken, 'test'];
    }

    if (in_array($mode, ['prod', 'production', 'produccion'], true)) {
        return [$productionToken, 'production'];
    }

    if ($productionToken !== '') {
        return [$productionToken, 'production'];
    }

    return [$testToken, 'test'];
}

function createMercadoPagoPreference(array $preference, string $accessToken): array
{
    $payload = json_encode($preference);
    if ($payload === false) {
        return [
            'status' => 500,
            'body' => json_encode(['error' => 'No se pudo preparar la preferencia de Mercado Pago.']),
        ];
    }

    if (function_exists('curl_init')) {
        $curl = curl_init('https://api.mercadopago.com/checkout/preferences');
        curl_setopt_array($curl, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => [
                'Authorization: Bearer ' . $accessToken,
                'Content-Type: application/json',
            ],
            CURLOPT_POSTFIELDS => $payload,
            CURLOPT_TIMEOUT => 20,
        ]);

        $response = curl_exec($curl);
        $statusCode = curl_getinfo($curl, CURLINFO_HTTP_CODE);
        $curlError = curl_error($curl);
        curl_close($curl);

        if ($response === false) {
            return [
                'status' => 502,
                'body' => json_encode(['error' => 'No se pudo conectar con Mercado Pago.', 'detail' => $curlError]),
            ];
        }

        return [
            'status' => $statusCode ?: 500,
            'body' => $response,
        ];
    }

    if (filter_var(ini_get('allow_url_fopen'), FILTER_VALIDATE_BOOLEAN) && extension_loaded('openssl')) {
        $context = stream_context_create([
            'http' => [
                'method' => 'POST',
                'header' => implode("\r\n", [
                    'Authorization: Bearer ' . $accessToken,
                    'Content-Type: application/json',
                    'Accept: application/json',
                ]),
                'content' => $payload,
                'ignore_errors' => true,
                'timeout' => 20,
            ],
        ]);

        $response = @file_get_contents('https://api.mercadopago.com/checkout/preferences', false, $context);
        $statusCode = 500;

        foreach ($http_response_header ?? [] as $header) {
            if (preg_match('/^HTTP\/\S+\s+(\d{3})/', $header, $matches)) {
                $statusCode = (int)$matches[1];
                break;
            }
        }

        if ($response !== false) {
            return [
                'status' => $statusCode,
                'body' => $response,
            ];
        }
    }

    return [
        'status' => 500,
        'body' => json_encode([
            'error' => 'El servidor PHP no tiene habilitado cURL para conectar con Mercado Pago.',
            'detail' => 'Habilitá la extensión curl en php.ini o probá en el hosting si ya está activa.',
        ]),
    ];
}

allowLocalDevelopmentCors();

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Método no permitido.']);
    exit;
}

loadEnvFile(dirname(__DIR__) . DIRECTORY_SEPARATOR . '.env');
[$accessToken, $mpMode] = mercadoPagoAccessToken();

if ($accessToken === '') {
    http_response_code(500);
    echo json_encode(['error' => 'Falta configurar el Access Token de Mercado Pago en el servidor.']);
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

$ticketPrice = 55000;
$baseUrl = publicBaseUrl();
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
        'buyer_name' => trim((string)($buyer['name'] ?? '')),
        'buyer_email' => $email,
        'buyer_phone' => trim((string)($buyer['phone'] ?? '')),
        'buyer_dni' => trim((string)($buyer['dni'] ?? '')),
        'buyer_institution' => trim((string)($buyer['institution'] ?? '')),
        'quantity' => $quantity,
        'source' => 'congreso-web',
        'mp_mode' => $mpMode,
    ],
    'statement_descriptor' => 'CEBSA 2026',
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
if ($webhookUrl === '' && $baseUrl !== '') {
    $webhookUrl = $baseUrl . '/api/mercadopago-webhook.php';
}

if ($webhookUrl !== '') {
    $preference['notification_url'] = $webhookUrl;
}

$preferenceResponse = createMercadoPagoPreference($preference, $accessToken);

http_response_code($preferenceResponse['status'] ?: 500);
echo $preferenceResponse['body'];
