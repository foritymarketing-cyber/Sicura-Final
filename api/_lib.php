<?php
/**
 * Gemeinsame Hilfsfunktionen für Kontaktformular und Puzzle-Captcha.
 * Wird nur per require eingebunden, gibt bei direktem Aufruf nichts aus.
 */
declare(strict_types=1);

ini_set('display_errors', '0');
error_reporting(E_ALL);
date_default_timezone_set('Europe/Berlin');

// ---- Konfiguration ----
const MAIL_TO = 'info@sicura-sicherheitstechnik.de';
// Absender muss eine Adresse der eigenen Domain sein, sonst landen Mails im Spam.
const MAIL_FROM = 'info@sicura-sicherheitstechnik.de';
const MAIL_FROM_NAME = 'Sicura Website';

const CAPTCHA_TTL = 1800;        // Sekunden, wie lange ein Puzzle gültig ist
const CAPTCHA_TOLERANCE = 14;    // Pixel (bei 720 px Bildbreite)
const SUBMIT_LIMIT = 5;          // max. Anfragen pro Sitzung und Stunde

function start_form_session(): void
{
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');

    session_name('sicura_form');
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'secure' => $https,
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
    session_start();
}

function send_json(int $status, array $data): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

/** Anfragen von fremden Seiten abweisen (zusätzlich zu SameSite-Cookie). */
function require_same_origin(): void
{
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin === '') {
        return;
    }
    $host = $_SERVER['HTTP_HOST'] ?? '';
    if (strtolower((string) parse_url($origin, PHP_URL_HOST) . (parse_url($origin, PHP_URL_PORT) ? ':' . parse_url($origin, PHP_URL_PORT) : '')) !== strtolower($host)) {
        send_json(403, ['ok' => false, 'error' => 'Ungültige Anfrage.']);
    }
}
