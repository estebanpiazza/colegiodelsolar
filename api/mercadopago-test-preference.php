<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

function allowLocalDevelopmentCors(): void
{
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    $allowedOrigins = [
        'http://127.0.0.1:5500',
        'http://127.0.0.1:5501',
        'http://127.0.0.1:8000',
        'http://localhost:5500',
        'http://localhost:5501',
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
        $key = ltrim($key, "\xEF\xBB\xBF");
        if ($key === '' || getenv($key) !== false) {
            continue;
        }

        $value = trim($value, "\"'");
        putenv($key . '=' . $value);
        $_ENV[$key] = $value;
        $_SERVER[$key] = $value;
    }
}

function loadMercadoPagoEnv(): void
{
    $siteRoot = dirname(__DIR__);
    $serverRoot = dirname($siteRoot);
    $paths = [
        $serverRoot . DIRECTORY_SEPARATOR . 'private' . DIRECTORY_SEPARATOR . '.env',
        $siteRoot . DIRECTORY_SEPARATOR . 'private' . DIRECTORY_SEPARATOR . '.env',
        $siteRoot . DIRECTORY_SEPARATOR . '.env',
        __DIR__ . DIRECTORY_SEPARATOR . '.env',
    ];

    foreach (array_unique($paths) as $path) {
        loadEnvFile($path);
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
        'body' => json_encode(['error' => 'El servidor PHP no tiene habilitado cURL para conectar con Mercado Pago.']),
    ];
}

allowLocalDevelopmentCors();

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Metodo no permitido.']);
    exit;
}

loadMercadoPagoEnv();
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
    echo json_encode(['error' => 'JSON invalido.']);
    exit;
}

$buyer = is_array($order['buyer'] ?? null) ? $order['buyer'] : [];
$email = filter_var($buyer['email'] ?? '', FILTER_VALIDATE_EMAIL);

if (!$email) {
    http_response_code(422);
    echo json_encode(['error' => 'Ingresa un email valido para recibir la confirmacion.']);
    exit;
}

$baseUrl = publicBaseUrl();
$externalReference = 'CEBSA-TEST-' . date('YmdHis') . '-' . random_int(1000, 9999);

$preference = [
    'items' => [
        [
            'id' => 'producto-prueba-mercadopago-cebsa',
            'title' => 'Producto de prueba Mercado Pago CEBSA',
            'description' => 'Producto de prueba de integracion. No corresponde a una entrada.',
            'quantity' => 1,
            'currency_id' => 'ARS',
            'unit_price' => 100,
        ],
    ],
    'payer' => [
        'name' => trim((string)($buyer['name'] ?? '')),
        'email' => $email,
    ],
    'external_reference' => $externalReference,
    'metadata' => [
        'event' => 'Prueba Mercado Pago CEBSA',
        'product_label' => 'producto de prueba Mercado Pago CEBSA',
        'buyer_name' => trim((string)($buyer['name'] ?? '')),
        'buyer_email' => $email,
        'buyer_phone' => trim((string)($buyer['phone'] ?? '')),
        'buyer_dni' => '',
        'buyer_institution' => 'Prueba Mercado Pago',
        'quantity' => 1,
        'source' => 'mp-test-page',
        'is_test_purchase' => 'true',
        'mp_mode' => $mpMode,
    ],
    'statement_descriptor' => 'CEBSA TEST',
];

if ($baseUrl !== '') {
    $preference['back_urls'] = [
        'success' => $baseUrl . '/mp-test.html?payment=success',
        'failure' => $baseUrl . '/mp-test.html?payment=failure',
        'pending' => $baseUrl . '/mp-test.html?payment=pending',
    ];
    $preference['auto_return'] = 'approved';

    $webhookUrl = getenv('MP_WEBHOOK_URL') ?: $baseUrl . '/api/mercadopago-webhook.php';
    $preference['notification_url'] = $webhookUrl;
}

$preferenceResponse = createMercadoPagoPreference($preference, $accessToken);

http_response_code($preferenceResponse['status'] ?: 500);
echo $preferenceResponse['body'];
