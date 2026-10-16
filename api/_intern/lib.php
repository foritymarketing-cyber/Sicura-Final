<?php
/**
 * Gemeinsame Hilfsfunktionen für Kontaktformular und Puzzle-Captcha.
 * Liegt in einem per .htaccess gesperrten Verzeichnis und wird nur per
 * require eingebunden. Bei direktem Aufruf passiert nichts.
 */
declare(strict_types=1);

if (!defined('SICURA_API')) {
    http_response_code(404);
    exit;
}

// Fehler nie an Besucher ausgeben, sondern intern protokollieren
ini_set('display_errors', '0');
ini_set('log_errors', '1');
ini_set('error_log', __DIR__ . '/data/php-error.log');
error_reporting(E_ALL);
date_default_timezone_set('Europe/Berlin');

// Optionale Konfiguration außerhalb des Webverzeichnisses (eine Ebene über
// dem Document Root), falls das Hosting das erlaubt. Sonst gelten die
// Standardwerte unten.
$externalConfig = dirname((string) ($_SERVER['DOCUMENT_ROOT'] ?? __DIR__)) . '/sicura-config.php';
if (is_file($externalConfig)) {
    require $externalConfig;
}

// ---- Konfiguration (Empfänger ist fest vorgegeben, nie aus Eingaben) ----
defined('MAIL_TO') || define('MAIL_TO', 'info@sicura-sicherheitstechnik.de');
// Absender muss eine Adresse der eigenen Domain sein, sonst landen Mails im Spam.
defined('MAIL_FROM') || define('MAIL_FROM', 'info@sicura-sicherheitstechnik.de');
defined('MAIL_FROM_NAME') || define('MAIL_FROM_NAME', 'Sicura Website');

const CAPTCHA_TTL = 1800;         // Sekunden, wie lange ein Puzzle gültig ist
const CAPTCHA_SOLVED_TTL = 900;   // Sekunden, wie lange ein gelöstes Puzzle zum Absenden reicht
const CAPTCHA_TOLERANCE = 14;     // Pixel (bei 720 px Bildbreite)
const SUBMIT_LIMIT = 5;           // max. Anfragen pro Sitzung und Stunde
const IP_SUBMIT_LIMIT = 10;       // max. Formularversuche pro IP und Stunde
const IP_CAPTCHA_LIMIT = 40;      // max. neue Puzzles pro IP und Stunde
const RATE_DIR = __DIR__ . '/data';

// Interne Fehler immer als JSON beantworten, ohne Details preiszugeben
ob_start();
set_exception_handler(function (Throwable $e): void {
    error_log('API-Fehler: ' . $e->getMessage() . ' in ' . basename($e->getFile()) . ':' . $e->getLine());
    send_json(500, ['ok' => false, 'error' => 'Es ist ein technischer Fehler aufgetreten. Bitte rufen Sie uns an: 06249 937 9999.']);
});
register_shutdown_function(function (): void {
    $error = error_get_last();
    if ($error && in_array($error['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true) && !headers_sent()) {
        while (ob_get_level() > 0) {
            ob_end_clean();
        }
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
        echo '{"ok":false,"error":"Es ist ein technischer Fehler aufgetreten. Bitte rufen Sie uns an: 06249 937 9999."}';
    }
});

function is_https(): bool
{
    return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https')
        || (($_SERVER['SERVER_PORT'] ?? '') === '443');
}

function start_form_session(): void
{
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    ini_set('session.use_trans_sid', '0');

    session_name('sicura_form');
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/api/',
        'secure' => is_https(),
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
    session_start();
}

function send_json(int $status, array $data): void
{
    while (ob_get_level() > 0) {
        ob_end_clean();
    }
    http_response_code($status);
    header_remove('X-Powered-By');
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    header('X-Robots-Tag: noindex');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

/** Anfragen von fremden Seiten abweisen (zusätzlich zu SameSite-Cookie). */
function require_same_origin(): void
{
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin === '') {
        return;
    }
    $port = parse_url($origin, PHP_URL_PORT);
    $originHost = strtolower((string) parse_url($origin, PHP_URL_HOST) . ($port ? ':' . $port : ''));
    if ($originHost !== strtolower((string) ($_SERVER['HTTP_HOST'] ?? ''))) {
        send_json(403, ['ok' => false, 'error' => 'Ungültige Anfrage.']);
    }
}

/**
 * Begrenzt Aktionen pro IP-Adresse und Stunde. Gespeichert wird nur ein
 * gesalzener Hash der IP (keine Klartext-IP), Einträge verfallen nach einer
 * Stunde. Gibt false zurück, wenn das Limit erreicht ist.
 */
function rate_limit(string $action, int $limit): bool
{
    if (!is_dir(RATE_DIR) || !is_writable(RATE_DIR)) {
        error_log('Rate-Limit: Verzeichnis nicht beschreibbar');
        return true;
    }

    $saltFile = RATE_DIR . '/salt.php';
    if (!is_file($saltFile)) {
        @file_put_contents($saltFile, '<?php return ' . var_export(bin2hex(random_bytes(32)), true) . ';', LOCK_EX);
    }
    $salt = (string) @include $saltFile;

    $ip = (string) ($_SERVER['REMOTE_ADDR'] ?? '');
    $file = RATE_DIR . '/rl-' . $action . '-' . hash('sha256', $salt . $ip) . '.json';
    $now = time();

    $handle = @fopen($file, 'c+');
    if (!$handle) {
        return true;
    }
    flock($handle, LOCK_EX);
    $entries = json_decode((string) stream_get_contents($handle), true);
    $entries = array_values(array_filter(is_array($entries) ? $entries : [], function ($t) use ($now) {
        return is_int($t) && $t > $now - 3600;
    }));
    $allowed = count($entries) < $limit;
    if ($allowed) {
        $entries[] = $now;
    }
    ftruncate($handle, 0);
    rewind($handle);
    fwrite($handle, json_encode($entries));
    flock($handle, LOCK_UN);
    fclose($handle);

    // Abgelaufene Prüfwerte anderer Besucher löschen (wie in der
    // Datenschutzerklärung beschrieben: nach einer Stunde)
    foreach (glob(RATE_DIR . '/rl-*.json') ?: [] as $old) {
        if ($old !== $file && @filemtime($old) < $now - 3600) {
            @unlink($old);
        }
    }
    return $allowed;
}
