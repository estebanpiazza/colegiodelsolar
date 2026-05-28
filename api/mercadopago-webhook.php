<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

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

function mercadoPagoAccessToken(): string
{
    $explicitToken = envValue(['MP_ACCESS_TOKEN', 'MERCADOPAGO_ACCESS_TOKEN']);
    if ($explicitToken !== '') {
        return $explicitToken;
    }

    $mode = strtolower(envValue(['MP_ENV', 'MP_MODE', 'APP_ENV', 'ENVIRONMENT']));
    $productionToken = envValue(['MP_ACCESS_TOKEN_PROD', 'MERCADOPAGO_ACCESS_TOKEN_PROD', 'acces_token_produccion', 'access_token_produccion']);
    $testToken = envValue(['MP_ACCESS_TOKEN_TEST', 'MERCADOPAGO_ACCESS_TOKEN_TEST', 'mp_acces_token_prueba', 'mp_access_token_prueba']);

    if (in_array($mode, ['test', 'testing', 'sandbox', 'prueba', 'dev', 'development', 'local'], true)) {
        return $testToken;
    }

    if (in_array($mode, ['prod', 'production', 'produccion'], true)) {
        return $productionToken;
    }

    return $productionToken !== '' ? $productionToken : $testToken;
}

function requestMercadoPagoPayment(string $paymentId, string $accessToken): array
{
    $url = 'https://api.mercadopago.com/v1/payments/' . rawurlencode($paymentId);

    if (function_exists('curl_init')) {
        $curl = curl_init($url);
        curl_setopt_array($curl, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => [
                'Authorization: Bearer ' . $accessToken,
                'Accept: application/json',
            ],
            CURLOPT_TIMEOUT => 20,
        ]);

        $response = curl_exec($curl);
        $statusCode = curl_getinfo($curl, CURLINFO_HTTP_CODE);
        $curlError = curl_error($curl);
        curl_close($curl);

        if ($response === false) {
            return ['status' => 502, 'body' => null, 'error' => $curlError];
        }

        return ['status' => $statusCode ?: 500, 'body' => json_decode($response, true), 'error' => null];
    }

    if (filter_var(ini_get('allow_url_fopen'), FILTER_VALIDATE_BOOLEAN) && extension_loaded('openssl')) {
        $context = stream_context_create([
            'http' => [
                'method' => 'GET',
                'header' => implode("\r\n", [
                    'Authorization: Bearer ' . $accessToken,
                    'Accept: application/json',
                ]),
                'ignore_errors' => true,
                'timeout' => 20,
            ],
        ]);

        $response = @file_get_contents($url, false, $context);
        $statusCode = 500;

        foreach ($http_response_header ?? [] as $header) {
            if (preg_match('/^HTTP\/\S+\s+(\d{3})/', $header, $matches)) {
                $statusCode = (int)$matches[1];
                break;
            }
        }

        return ['status' => $statusCode, 'body' => $response ? json_decode($response, true) : null, 'error' => null];
    }

    return ['status' => 500, 'body' => null, 'error' => 'PHP no tiene cURL habilitado.'];
}

function sendCongressPaymentEmail(array $payment): bool
{
    $recipient = filter_var(envValue(['CONGRESS_EMAIL', 'CEBSA_EMAIL']), FILTER_VALIDATE_EMAIL);
    if (!$recipient) {
        $recipient = 'cebsa@colegiodelsolar.edu.ar';
    }

    $metadata = is_array($payment['metadata'] ?? null) ? $payment['metadata'] : [];
    $payer = is_array($payment['payer'] ?? null) ? $payment['payer'] : [];
    $payerEmail = (string)($metadata['buyer_email'] ?? $payer['email'] ?? '');
    $payerName = trim((string)($metadata['buyer_name'] ?? trim(((string)($payer['first_name'] ?? '')) . ' ' . ((string)($payer['last_name'] ?? '')))));
    $amount = number_format((float)($payment['transaction_amount'] ?? 0), 2, ',', '.');

    $subject = 'Pago aprobado por Mercado Pago - CEBSA 2026';
    $body = implode("\n", [
        'Se aprobó un pago por Mercado Pago para CEBSA 2026.',
        '',
        'Datos del pago:',
        'ID de pago: ' . (string)($payment['id'] ?? '-'),
        'Referencia externa: ' . (string)($payment['external_reference'] ?? '-'),
        'Estado: ' . (string)($payment['status'] ?? '-'),
        'Importe: ARS ' . $amount,
        'Medio de pago: ' . (string)($payment['payment_method_id'] ?? '-'),
        '',
        'Datos del comprador:',
        'Nombre: ' . ($payerName !== '' ? $payerName : '-'),
        'Email: ' . ($payerEmail !== '' ? $payerEmail : '-'),
        'Teléfono: ' . (string)($metadata['buyer_phone'] ?? '-'),
        'DNI: ' . (string)($metadata['buyer_dni'] ?? '-'),
        'Institución / ciudad: ' . (string)($metadata['buyer_institution'] ?? '-'),
        'Entradas: ' . (string)($metadata['quantity'] ?? '-'),
    ]);

    $headers = [
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        'From: CEBSA 2026 <no-reply@colegiodelsolar.edu.ar>',
    ];

    if (filter_var($payerEmail, FILTER_VALIDATE_EMAIL)) {
        $headers[] = 'Reply-To: ' . $payerEmail;
    }

    return mail($recipient, $subject, $body, implode("\r\n", $headers));
}

function paymentNotificationMarkerPath(string $paymentId): string
{
    return rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'cebsa-mp-payment-' . preg_replace('/[^a-zA-Z0-9_-]/', '', $paymentId) . '.sent';
}

function paymentIdFromNotification(array $payload): string
{
    $candidates = [
        $payload['data']['id'] ?? null,
        $payload['id'] ?? null,
        $_GET['data_id'] ?? null,
        $_GET['id'] ?? null,
    ];

    foreach ($candidates as $candidate) {
        $value = trim((string)$candidate);
        if ($value !== '') {
            return $value;
        }
    }

    return '';
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Método no permitido.']);
    exit;
}

loadEnvFile(dirname(__DIR__) . DIRECTORY_SEPARATOR . '.env');

$rawBody = file_get_contents('php://input') ?: '';
$payload = json_decode($rawBody, true);
if (!is_array($payload)) {
    $payload = [];
}

$topic = (string)($payload['type'] ?? $payload['topic'] ?? $_GET['topic'] ?? '');
if ($topic !== '' && $topic !== 'payment') {
    echo json_encode(['ok' => true, 'ignored' => $topic]);
    exit;
}

$paymentId = paymentIdFromNotification($payload);
if ($paymentId === '') {
    http_response_code(400);
    echo json_encode(['error' => 'No se recibió el ID de pago.']);
    exit;
}

$accessToken = mercadoPagoAccessToken();
if ($accessToken === '') {
    http_response_code(500);
    echo json_encode(['error' => 'Falta configurar el Access Token de Mercado Pago.']);
    exit;
}

$paymentResponse = requestMercadoPagoPayment($paymentId, $accessToken);
if ($paymentResponse['status'] < 200 || $paymentResponse['status'] >= 300 || !is_array($paymentResponse['body'])) {
    http_response_code(502);
    echo json_encode(['error' => 'No se pudo consultar el pago en Mercado Pago.', 'detail' => $paymentResponse['error']]);
    exit;
}

$payment = $paymentResponse['body'];
if (($payment['status'] ?? '') !== 'approved') {
    echo json_encode(['ok' => true, 'payment_status' => $payment['status'] ?? 'unknown']);
    exit;
}

$markerPath = paymentNotificationMarkerPath((string)($payment['id'] ?? $paymentId));
if (is_file($markerPath)) {
    echo json_encode(['ok' => true, 'payment_status' => 'approved', 'email_sent' => false, 'duplicate' => true]);
    exit;
}

$emailSent = sendCongressPaymentEmail($payment);
if ($emailSent) {
    @file_put_contents($markerPath, date(DATE_ATOM));
}

echo json_encode(['ok' => true, 'payment_status' => 'approved', 'email_sent' => $emailSent]);
