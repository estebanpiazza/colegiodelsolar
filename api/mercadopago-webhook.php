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

function congressEmailAddress(): string
{
    $email = filter_var(envValue(['CONGRESS_EMAIL', 'CEBSA_EMAIL']), FILTER_VALIDATE_EMAIL);
    return $email ?: 'cebsa@colegiodelsolar.edu.ar';
}

function congressNotificationRecipients(): array
{
    $candidates = [
        congressEmailAddress(),
    ];

    $extraRecipients = envValue(['CONGRESS_COPY_EMAILS', 'CONGRESS_BCC_EMAILS', 'PAYMENT_NOTIFICATION_EMAILS']);
    if ($extraRecipients !== '') {
        $candidates = array_merge($candidates, preg_split('/[,;]/', $extraRecipients) ?: []);
    }

    $recipients = [];
    foreach ($candidates as $candidate) {
        $email = filter_var(trim((string)$candidate), FILTER_VALIDATE_EMAIL);
        if ($email && !in_array($email, $recipients, true)) {
            $recipients[] = $email;
        }
    }

    return $recipients;
}

function privateStoragePath(string $filename): string
{
    $siteRoot = dirname(__DIR__);
    $serverRoot = dirname($siteRoot);
    $directories = [
        $serverRoot . DIRECTORY_SEPARATOR . 'private',
        $siteRoot . DIRECTORY_SEPARATOR . 'private',
        sys_get_temp_dir(),
    ];

    foreach ($directories as $directory) {
        if (!is_dir($directory)) {
            @mkdir($directory, 0755, true);
        }

        if (is_dir($directory) && is_writable($directory)) {
            return rtrim($directory, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . $filename;
        }
    }

    return rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . $filename;
}

function paymentEmailDetails(array $payment): array
{
    $metadata = is_array($payment['metadata'] ?? null) ? $payment['metadata'] : [];
    $payer = is_array($payment['payer'] ?? null) ? $payment['payer'] : [];
    $payerEmail = (string)($metadata['buyer_email'] ?? $payer['email'] ?? '');
    $payerName = trim((string)($metadata['buyer_name'] ?? trim(((string)($payer['first_name'] ?? '')) . ' ' . ((string)($payer['last_name'] ?? '')))));
    $amount = number_format((float)($payment['transaction_amount'] ?? 0), 2, ',', '.');
    $attendeesRaw = (string)($metadata['attendees_json'] ?? '[]');
    $attendees = json_decode($attendeesRaw, true);

    if (!is_array($attendees)) {
        $attendees = [];
    }

    $normalizedAttendees = [];
    foreach ($attendees as $attendee) {
        if (!is_array($attendee)) {
            continue;
        }

        $person = filter_var($attendee['person'] ?? null, FILTER_VALIDATE_INT);
        if (!$person || $person < 2 || $person > 20) {
            continue;
        }

        $normalizedAttendees[] = [
            'person' => $person,
            'name' => trim((string)($attendee['name'] ?? '')),
            'email' => trim((string)($attendee['email'] ?? '')),
            'dni' => trim((string)($attendee['dni'] ?? '')),
        ];
    }

    return [
        'payment_id' => (string)($payment['id'] ?? '-'),
        'external_reference' => (string)($payment['external_reference'] ?? '-'),
        'status' => (string)($payment['status'] ?? '-'),
        'amount' => $amount,
        'payment_method' => (string)($payment['payment_method_id'] ?? '-'),
        'payer_name' => $payerName !== '' ? $payerName : '-',
        'payer_email' => $payerEmail,
        'buyer_phone' => (string)($metadata['buyer_phone'] ?? '-'),
        'buyer_dni' => (string)($metadata['buyer_dni'] ?? '-'),
        'buyer_institution' => (string)($metadata['buyer_institution'] ?? '-'),
        'quantity' => (string)($metadata['quantity'] ?? '-'),
        'product_label' => (string)($metadata['product_label'] ?? $metadata['event'] ?? 'entrada para CEBSA 2026'),
        'source' => (string)($metadata['source'] ?? '-'),
        'is_test_purchase' => (string)($metadata['is_test_purchase'] ?? 'false'),
        'attendees_count' => (string)($metadata['attendees_count'] ?? count($normalizedAttendees)),
        'attendees' => $normalizedAttendees,
    ];
}

function paymentMailHeaders(string $fromEmail, string $replyTo = ''): array
{
    $headers = [
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        'From: CEBSA 2026 <' . $fromEmail . '>',
    ];

    if (filter_var($replyTo, FILTER_VALIDATE_EMAIL)) {
        $headers[] = 'Reply-To: ' . $replyTo;
    }

    return $headers;
}

function sendCongressPaymentEmail(array $payment): bool
{
    $recipients = congressNotificationRecipients();
    $details = paymentEmailDetails($payment);

    if ($recipients === []) {
        return false;
    }

    $subject = 'Pago aprobado por Mercado Pago - CEBSA 2026';
    $body = implode("\n", [
        'Se aprobó un pago por Mercado Pago para CEBSA 2026.',
        'Producto: ' . $details['product_label'],
        '',
        'Datos del pago:',
        'ID de pago: ' . $details['payment_id'],
        'Referencia externa: ' . $details['external_reference'],
        'Estado: ' . $details['status'],
        'Importe: ARS ' . $details['amount'],
        'Medio de pago: ' . $details['payment_method'],
        '',
        'Datos del comprador:',
        'Nombre: ' . $details['payer_name'],
        'Email: ' . ($details['payer_email'] !== '' ? $details['payer_email'] : '-'),
        'Teléfono: ' . $details['buyer_phone'],
        'DNI: ' . $details['buyer_dni'],
        'Institución / ciudad: ' . $details['buyer_institution'],
        'Entradas: ' . $details['quantity'],
        'Origen: ' . $details['source'],
        'Compra de prueba: ' . $details['is_test_purchase'],
    ]);

    if (is_array($details['attendees']) && count($details['attendees']) > 0) {
        $body .= "\n\nDatos de asistentes adicionales:";
        foreach ($details['attendees'] as $attendee) {
            $body .= "\n" . sprintf(
                'Persona %d: %s | %s | DNI %s',
                (int)($attendee['person'] ?? 0),
                (string)((string)($attendee['name'] ?? '') !== '' ? $attendee['name'] : '-'),
                (string)((string)($attendee['email'] ?? '') !== '' ? $attendee['email'] : '-'),
                (string)((string)($attendee['dni'] ?? '') !== '' ? $attendee['dni'] : '-')
            );
        }
    }

    $headers = paymentMailHeaders(congressEmailAddress(), $details['payer_email']);

    $sent = true;
    foreach ($recipients as $recipient) {
        $sent = mail($recipient, $subject, $body, implode("\r\n", $headers)) && $sent;
    }

    return $sent;
}

function sendBuyerPaymentEmail(array $payment): bool
{
    $congressEmail = congressEmailAddress();
    $details = paymentEmailDetails($payment);
    $recipient = filter_var($details['payer_email'], FILTER_VALIDATE_EMAIL);

    if (!$recipient) {
        return false;
    }

    $subject = 'Compra confirmada - CEBSA 2026';
    $body = implode("\n", [
        'Hola ' . $details['payer_name'] . ',',
        '',
        'Tu compra de ' . $details['product_label'] . ' fue confirmada por Mercado Pago.',
        '',
        'Datos de la compra:',
        'Referencia: ' . $details['external_reference'],
        'Entradas: ' . $details['quantity'],
        'Importe: ARS ' . $details['amount'],
        'Estado: ' . $details['status'],
        '',
        'Conservá este mail como confirmación de compra.',
        '',
        'Ante cualquier consulta, podés responder este correo o escribir a ' . $congressEmail . '.',
        '',
        'Equipo CEBSA 2026',
    ]);

    $headers = paymentMailHeaders($congressEmail, $congressEmail);

    return mail($recipient, $subject, $body, implode("\r\n", $headers));
}

function paymentNotificationMarkerPath(string $paymentId, string $emailType = 'all'): string
{
    $safePaymentId = preg_replace('/[^a-zA-Z0-9_-]/', '', $paymentId);
    $safeEmailType = preg_replace('/[^a-zA-Z0-9_-]/', '', $emailType);

    return privateStoragePath('cebsa-mp-payment-' . $safePaymentId . '-' . $safeEmailType . '.sent');
}

function registerApprovedPayment(array $payment, bool $congressEmailSent, bool $buyerEmailSent): bool
{
    $details = paymentEmailDetails($payment);
    $paymentId = (string)($payment['id'] ?? '');
    $registeredMarkerPath = paymentNotificationMarkerPath($paymentId, 'registered');

    if ($paymentId === '') {
        return false;
    }

    if (is_file($registeredMarkerPath)) {
        return true;
    }

    $logPath = privateStoragePath('mercadopago-payments.csv');
    $isNewFile = !is_file($logPath) || filesize($logPath) === 0;
    $handle = @fopen($logPath, 'ab');

    if ($handle === false) {
        return false;
    }

    if (flock($handle, LOCK_EX)) {
        if ($isNewFile) {
            fputcsv($handle, [
                'registered_at',
                'payment_id',
                'external_reference',
                'status',
                'amount_ars',
                'payment_method',
                'quantity',
                'buyer_name',
                'buyer_email',
                'buyer_phone',
                'buyer_dni',
                'buyer_institution',
                'product_label',
                'source',
                'is_test_purchase',
                'congress_email_sent',
                'buyer_email_sent',
            ]);
        }

        fputcsv($handle, [
            date(DATE_ATOM),
            $details['payment_id'],
            $details['external_reference'],
            $details['status'],
            $details['amount'],
            $details['payment_method'],
            $details['quantity'],
            $details['payer_name'],
            $details['payer_email'],
            $details['buyer_phone'],
            $details['buyer_dni'],
            $details['buyer_institution'],
            $details['product_label'],
            $details['source'],
            $details['is_test_purchase'],
            $congressEmailSent ? 'yes' : 'no',
            $buyerEmailSent ? 'yes' : 'no',
        ]);

        fflush($handle);
        flock($handle, LOCK_UN);
        fclose($handle);
        @file_put_contents($registeredMarkerPath, date(DATE_ATOM));

        return true;
    }

    fclose($handle);

    return false;
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

loadMercadoPagoEnv();

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
    echo json_encode([
        'error' => 'Falta configurar el Access Token de Mercado Pago.',
        'detail' => 'Defini MP_ACCESS_TOKEN o MP_ACCESS_TOKEN_PROD en las variables de entorno, /private/.env o .env del sitio.',
    ]);
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

$paymentMarkerId = (string)($payment['id'] ?? $paymentId);
$allMarkerPath = paymentNotificationMarkerPath($paymentMarkerId, 'all');
$temporaryLegacyMarkerPath = rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'cebsa-mp-payment-' . preg_replace('/[^a-zA-Z0-9_-]/', '', $paymentMarkerId) . '.sent';
if (is_file($allMarkerPath) || is_file($temporaryLegacyMarkerPath)) {
    $registered = registerApprovedPayment($payment, true, true);
    $registrationStored = inscripcionesUpsertFromApprovedPayment($payment);
    $totals = inscripcionesGetTotals();

    if (!$registered) {
        http_response_code(500);
        echo json_encode(['error' => 'No se pudo registrar el pago aprobado.']);
        exit;
    }

    echo json_encode([
        'ok' => true,
        'payment_status' => 'approved',
        'email_sent' => false,
        'duplicate' => true,
        'registered' => $registered,
        'registration_stored' => $registrationStored,
        'registrations_total' => $totals['personas'],
    ]);
    exit;
}

$congressMarkerPath = paymentNotificationMarkerPath($paymentMarkerId, 'congress');
$buyerMarkerPath = paymentNotificationMarkerPath($paymentMarkerId, 'buyer');

$congressEmailSent = is_file($congressMarkerPath);
if (!$congressEmailSent) {
    $congressEmailSent = sendCongressPaymentEmail($payment);
    if ($congressEmailSent) {
        @file_put_contents($congressMarkerPath, date(DATE_ATOM));
    }
}

$buyerEmailSent = is_file($buyerMarkerPath);
if (!$buyerEmailSent) {
    $buyerEmailSent = sendBuyerPaymentEmail($payment);
    if ($buyerEmailSent) {
        @file_put_contents($buyerMarkerPath, date(DATE_ATOM));
    }
}

$emailSent = $congressEmailSent && $buyerEmailSent;
$registered = registerApprovedPayment($payment, $congressEmailSent, $buyerEmailSent);
if (!$registered) {
    http_response_code(500);
    echo json_encode(['error' => 'No se pudo registrar el pago aprobado.']);
    exit;
}

if ($emailSent) {
    @file_put_contents($allMarkerPath, date(DATE_ATOM));
}

$registrationStored = inscripcionesUpsertFromApprovedPayment($payment);
$totals = inscripcionesGetTotals();

echo json_encode([
    'ok' => true,
    'payment_status' => 'approved',
    'email_sent' => $emailSent,
    'congress_email_sent' => $congressEmailSent,
    'buyer_email_sent' => $buyerEmailSent,
    'registered' => $registered,
    'registration_stored' => $registrationStored,
    'registrations_total' => $totals['personas'],
]);
