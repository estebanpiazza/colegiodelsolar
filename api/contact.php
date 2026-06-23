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

function loadContactEnv(): void
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

function respondJson(int $status, array $payload): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function requestLang(): string
{
    $postedLang = strtolower(trim((string)($_POST['_language'] ?? '')));
    if (in_array($postedLang, ['en', 'es'], true)) {
        return $postedLang;
    }

    $acceptLanguage = strtolower((string)($_SERVER['HTTP_ACCEPT_LANGUAGE'] ?? ''));
    return strpos($acceptLanguage, 'en') === 0 ? 'en' : 'es';
}

function messageFor(string $lang, string $key): string
{
    $messages = [
        'es' => [
            'method' => 'Metodo no permitido.',
            'captcha_missing' => 'Completa el captcha para enviar el mensaje.',
            'captcha_config' => 'El captcha no esta configurado.',
            'captcha_invalid' => 'No pudimos validar el captcha. Intentalo nuevamente.',
            'name_invalid' => 'Ingresa tu nombre completo.',
            'email_invalid' => 'Ingresa un email valido.',
            'phone_invalid' => 'Ingresa un telefono de contacto.',
            'message_invalid' => 'Ingresa un mensaje.',
            'recipient_invalid' => 'No hay destinatario configurado para el formulario.',
            'send_failed' => 'No pudimos enviar el mensaje. Intenta nuevamente en unos minutos.',
            'sent' => 'Mensaje enviado. Te responderemos a la brevedad.',
        ],
        'en' => [
            'method' => 'Method not allowed.',
            'captcha_missing' => 'Please complete the captcha before sending.',
            'captcha_config' => 'Captcha is not configured.',
            'captcha_invalid' => 'We could not validate the captcha. Please try again.',
            'name_invalid' => 'Enter your full name.',
            'email_invalid' => 'Enter a valid email.',
            'phone_invalid' => 'Enter a contact phone.',
            'message_invalid' => 'Enter a message.',
            'recipient_invalid' => 'No recipient is configured for the form.',
            'send_failed' => 'We could not send your message. Please try again in a few minutes.',
            'sent' => 'Message sent. We will get back to you shortly.',
        ],
    ];

    return $messages[$lang][$key] ?? $messages['es'][$key] ?? 'Error.';
}

function limitText(string $value, int $limit): string
{
    if (function_exists('mb_substr')) {
        return mb_substr($value, 0, $limit, 'UTF-8');
    }

    return substr($value, 0, $limit);
}

function sanitizeSingleLine(string $value, int $limit): string
{
    $value = trim(strip_tags($value));
    $value = preg_replace('/[\r\n\t]+/', ' ', $value) ?? '';
    $value = preg_replace('/\s{2,}/', ' ', $value) ?? '';

    return limitText(trim($value), $limit);
}

function sanitizeMultiline(string $value, int $limit): string
{
    $value = trim(strip_tags($value));
    $value = str_replace(["\r\n", "\r"], "\n", $value);
    $value = preg_replace("/[ \t]+\n/", "\n", $value) ?? '';
    $value = preg_replace("/\n{3,}/", "\n\n", $value) ?? '';

    return limitText(trim($value), $limit);
}

function clientIp(): string
{
    $candidates = [
        (string)($_SERVER['HTTP_CF_CONNECTING_IP'] ?? ''),
        (string)($_SERVER['HTTP_X_FORWARDED_FOR'] ?? ''),
        (string)($_SERVER['REMOTE_ADDR'] ?? ''),
    ];

    foreach ($candidates as $candidate) {
        $ip = trim(explode(',', $candidate)[0]);
        if (filter_var($ip, FILTER_VALIDATE_IP)) {
            return $ip;
        }
    }

    return '';
}

function verifyRecaptcha(string $secret, string $token, string $remoteIp): array
{
    $payload = [
        'secret' => $secret,
        'response' => $token,
    ];

    if ($remoteIp !== '') {
        $payload['remoteip'] = $remoteIp;
    }

    $body = http_build_query($payload, '', '&');
    $url = 'https://www.google.com/recaptcha/api/siteverify';

    if (function_exists('curl_init')) {
        $curl = curl_init($url);
        curl_setopt_array($curl, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $body,
            CURLOPT_HTTPHEADER => ['Content-Type: application/x-www-form-urlencoded'],
            CURLOPT_TIMEOUT => 8,
        ]);
        $raw = curl_exec($curl);
        curl_close($curl);
    } else {
        $context = stream_context_create([
            'http' => [
                'method' => 'POST',
                'header' => "Content-Type: application/x-www-form-urlencoded\r\n",
                'content' => $body,
                'timeout' => 8,
                'ignore_errors' => true,
            ],
        ]);
        $raw = file_get_contents($url, false, $context);
    }

    if (!is_string($raw) || $raw === '') {
        return ['success' => false, 'error-codes' => ['request-failed']];
    }

    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        return ['success' => false, 'error-codes' => ['invalid-response']];
    }

    return $decoded;
}

function recaptchaHostnameAllowed(array $verification): bool
{
    $allowedHosts = envValue(['RECAPTCHA_ALLOWED_HOSTS']);
    if ($allowedHosts === '') {
        return true;
    }

    $hostname = strtolower(trim((string)($verification['hostname'] ?? '')));
    if ($hostname === '') {
        return false;
    }

    $allowed = array_filter(array_map(
        static fn (string $host): string => strtolower(trim($host)),
        explode(',', $allowedHosts)
    ));

    return in_array($hostname, $allowed, true);
}

function contactRecipients(string $lang): array
{
    $configured = $lang === 'en'
        ? envValue(['CONTACT_EMAIL_EN', 'CONTACT_RECIPIENT_EN', 'CONTACT_RECIPIENTS_EN'])
        : envValue(['CONTACT_EMAIL_ES', 'CONTACT_RECIPIENT_ES', 'CONTACT_RECIPIENTS_ES']);

    if ($configured === '') {
        $configured = envValue(['CONTACT_EMAIL', 'CONTACT_RECIPIENT', 'CONTACT_RECIPIENTS', 'ADMISSIONS_EMAIL']);
    }

    if ($configured === '') {
        $configured = $lang === 'en'
            ? 'info@colegiodelsolar.edu.ar'
            : 'admisiones@colegiodelsolar.edu.ar';
    }

    $recipients = [];
    foreach (preg_split('/[,;]/', $configured) ?: [] as $candidate) {
        $email = filter_var(trim($candidate), FILTER_VALIDATE_EMAIL);
        if ($email && !in_array($email, $recipients, true)) {
            $recipients[] = $email;
        }
    }

    return $recipients;
}

function contactFromEmail(array $recipients): string
{
    $configured = filter_var(envValue(['CONTACT_FROM_EMAIL', 'MAIL_FROM', 'FROM_EMAIL']), FILTER_VALIDATE_EMAIL);
    if ($configured) {
        return $configured;
    }

    return $recipients[0] ?? 'admisiones@colegiodelsolar.edu.ar';
}

function safeHeaderText(string $value): string
{
    $value = sanitizeSingleLine($value, 160);
    return str_replace(['"', '<', '>'], '', $value);
}

function mailAddressHeader(string $name, string $email): string
{
    $safeName = safeHeaderText($name);
    if ($safeName === '') {
        return $email;
    }

    return $safeName . ' <' . $email . '>';
}

function mailSubject(string $subject): string
{
    if (function_exists('mb_encode_mimeheader')) {
        return mb_encode_mimeheader($subject, 'UTF-8', 'B', "\r\n");
    }

    return '=?UTF-8?B?' . base64_encode($subject) . '?=';
}

function buildContactBody(array $data): string
{
    return implode("\n", [
        'Nueva consulta desde la landing del Colegio Del Solar',
        '',
        'Nombre: ' . $data['name'],
        'Email: ' . $data['email'],
        'Telefono: ' . $data['phone'],
        'Idioma: ' . strtoupper($data['lang']),
        'Pagina: ' . ($data['url'] !== '' ? $data['url'] : '-'),
        '',
        'Mensaje:',
        $data['message'],
    ]);
}

loadContactEnv();

$lang = requestLang();

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    respondJson(405, ['success' => false, 'message' => messageFor($lang, 'method')]);
}

$honeypot = trim((string)($_POST['_honey'] ?? ''));
if ($honeypot !== '') {
    respondJson(200, ['success' => true, 'message' => messageFor($lang, 'sent')]);
}

$captchaToken = trim((string)($_POST['g-recaptcha-response'] ?? ''));
if ($captchaToken === '') {
    respondJson(422, ['success' => false, 'message' => messageFor($lang, 'captcha_missing')]);
}

$captchaSecret = envValue(['RECAPTCHA_SECRET_KEY', 'RECAPTCHA_SECRET', 'GOOGLE_RECAPTCHA_SECRET']);
if ($captchaSecret === '') {
    respondJson(500, ['success' => false, 'message' => messageFor($lang, 'captcha_config')]);
}

$verification = verifyRecaptcha($captchaSecret, $captchaToken, clientIp());
if (($verification['success'] ?? false) !== true || !recaptchaHostnameAllowed($verification)) {
    respondJson(422, ['success' => false, 'message' => messageFor($lang, 'captcha_invalid')]);
}

$name = sanitizeSingleLine((string)($_POST['nombre'] ?? ''), 120);
$email = filter_var(trim((string)($_POST['email'] ?? '')), FILTER_VALIDATE_EMAIL);
$phone = sanitizeSingleLine((string)($_POST['telefono'] ?? ''), 80);
$message = sanitizeMultiline((string)($_POST['mensaje'] ?? ''), 4000);
$url = filter_var(trim((string)($_POST['_url'] ?? '')), FILTER_VALIDATE_URL) ?: '';

if ($name === '') {
    respondJson(422, ['success' => false, 'message' => messageFor($lang, 'name_invalid')]);
}

if (!$email) {
    respondJson(422, ['success' => false, 'message' => messageFor($lang, 'email_invalid')]);
}

if ($phone === '') {
    respondJson(422, ['success' => false, 'message' => messageFor($lang, 'phone_invalid')]);
}

if ($message === '') {
    respondJson(422, ['success' => false, 'message' => messageFor($lang, 'message_invalid')]);
}

$recipients = contactRecipients($lang);
if ($recipients === []) {
    respondJson(500, ['success' => false, 'message' => messageFor($lang, 'recipient_invalid')]);
}

$subject = sanitizeSingleLine((string)($_POST['_subject'] ?? ''), 160);
if ($subject === '') {
    $subject = $lang === 'en'
        ? 'New inquiry from Colegio Del Solar landing page'
        : 'Nueva consulta desde la landing del Colegio Del Solar';
}

$fromEmail = contactFromEmail($recipients);
$body = buildContactBody([
    'name' => $name,
    'email' => $email,
    'phone' => $phone,
    'message' => $message,
    'url' => $url,
    'lang' => $lang,
]);

$headers = [
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'From: Colegio Del Solar <' . $fromEmail . '>',
    'Reply-To: ' . mailAddressHeader($name, $email),
];

$sent = true;
foreach ($recipients as $recipient) {
    $sent = mail($recipient, mailSubject($subject), $body, implode("\r\n", $headers)) && $sent;
}

if (!$sent) {
    respondJson(500, ['success' => false, 'message' => messageFor($lang, 'send_failed')]);
}

respondJson(200, ['success' => true, 'message' => messageFor($lang, 'sent')]);
