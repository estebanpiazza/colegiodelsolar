<?php
declare(strict_types=1);

function inscripcionesStoragePath(): string
{
    return __DIR__ . DIRECTORY_SEPARATOR . '._inscripciones_aprobadas.json';
}

function inscripcionesDefaultData(): array
{
    return [
        'version' => 1,
        'updated_at' => null,
        'totals' => [
            'personas' => 0,
            'pagos_aprobados' => 0,
        ],
        'payments' => [],
    ];
}

function inscripcionesReadData(): array
{
    $path = inscripcionesStoragePath();
    if (!is_file($path)) {
        return inscripcionesDefaultData();
    }

    $raw = @file_get_contents($path);
    if ($raw === false || trim($raw) === '') {
        return inscripcionesDefaultData();
    }

    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        return inscripcionesDefaultData();
    }

    $payments = is_array($decoded['payments'] ?? null) ? $decoded['payments'] : [];
    $totals = is_array($decoded['totals'] ?? null) ? $decoded['totals'] : [];

    return [
        'version' => 1,
        'updated_at' => $decoded['updated_at'] ?? null,
        'totals' => [
            'personas' => max(0, (int)($totals['personas'] ?? 0)),
            'pagos_aprobados' => max(0, (int)($totals['pagos_aprobados'] ?? 0)),
        ],
        'payments' => $payments,
    ];
}

function inscripcionesRecalculateTotals(array &$data): void
{
    $payments = is_array($data['payments'] ?? null) ? $data['payments'] : [];

    $personas = 0;
    foreach ($payments as $payment) {
        $personas += max(1, (int)($payment['quantity'] ?? 1));
    }

    $data['totals'] = [
        'personas' => $personas,
        'pagos_aprobados' => count($payments),
    ];
}

function inscripcionesWriteData(array $data): bool
{
    $path = inscripcionesStoragePath();
    $data['updated_at'] = gmdate('c');
    inscripcionesRecalculateTotals($data);

    $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    if ($json === false) {
        return false;
    }

    $tempPath = $path . '.tmp';
    if (@file_put_contents($tempPath, $json, LOCK_EX) === false) {
        return false;
    }

    return @rename($tempPath, $path);
}

function inscripcionesPaymentId(array $payment): string
{
    $id = trim((string)($payment['id'] ?? ''));
    return $id;
}

function inscripcionesBuildRecord(array $payment): array
{
    $metadata = is_array($payment['metadata'] ?? null) ? $payment['metadata'] : [];
    $payer = is_array($payment['payer'] ?? null) ? $payment['payer'] : [];

    $quantity = max(1, (int)($metadata['quantity'] ?? 1));
    $buyerEmail = trim((string)($metadata['buyer_email'] ?? $payer['email'] ?? ''));
    $buyerName = trim((string)($metadata['buyer_name'] ?? ''));

    if ($buyerName === '') {
        $firstName = trim((string)($payer['first_name'] ?? ''));
        $lastName = trim((string)($payer['last_name'] ?? ''));
        $buyerName = trim($firstName . ' ' . $lastName);
    }

    return [
        'payment_id' => inscripcionesPaymentId($payment),
        'external_reference' => trim((string)($payment['external_reference'] ?? '')),
        'quantity' => $quantity,
        'amount' => (float)($payment['transaction_amount'] ?? 0),
        'status' => trim((string)($payment['status'] ?? '')),
        'buyer_name' => $buyerName,
        'buyer_email' => $buyerEmail,
        'approved_at' => trim((string)($payment['date_approved'] ?? $payment['date_created'] ?? '')),
        'recorded_at' => gmdate('c'),
    ];
}

function inscripcionesUpsertFromApprovedPayment(array $payment): bool
{
    if (($payment['status'] ?? '') !== 'approved') {
        return false;
    }

    $paymentId = inscripcionesPaymentId($payment);
    if ($paymentId === '') {
        return false;
    }

    $data = inscripcionesReadData();
    $payments = is_array($data['payments'] ?? null) ? $data['payments'] : [];

    foreach ($payments as $index => $existing) {
        if ((string)($existing['payment_id'] ?? '') === $paymentId) {
            $payments[$index] = inscripcionesBuildRecord($payment);
            $data['payments'] = array_values($payments);
            return inscripcionesWriteData($data);
        }
    }

    $payments[] = inscripcionesBuildRecord($payment);
    $data['payments'] = array_values($payments);
    return inscripcionesWriteData($data);
}

function inscripcionesGetTotals(): array
{
    $data = inscripcionesReadData();
    inscripcionesRecalculateTotals($data);

    return [
        'personas' => (int)($data['totals']['personas'] ?? 0),
        'pagos_aprobados' => (int)($data['totals']['pagos_aprobados'] ?? 0),
        'updated_at' => $data['updated_at'] ?? null,
    ];
}
