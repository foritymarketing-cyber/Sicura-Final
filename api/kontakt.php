<?php
/**
 * Kontaktformular: prüft Captcha und Eingaben und verschickt die Anfrage per
 * E-Mail an MAIL_TO. Antwortet immer mit JSON.
 */
declare(strict_types=1);
const SICURA_API = true;
require __DIR__ . '/_intern/lib.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    send_json(405, ['ok' => false, 'error' => 'Methode nicht erlaubt.']);
}

start_form_session();
require_same_origin();

const TOPICS = [
    'videoueberwachung' => 'Videoüberwachung',
    'verdeckte-videoueberwachung' => 'Verdeckte Videoüberwachung',
    'einbruchmeldeanlage' => 'Einbruchmeldeanlage / Alarmtechnik',
    'kurzeinsatz' => 'Kurzeinsatz / Technik mieten',
    'service-wartung' => 'Service und Wartung',
    'beratung' => 'Allgemeine Beratung',
    'sonstiges' => 'Sonstiges',
];

/**
 * Liest ein Formularfeld. Ungültiges UTF-8, zu lange Eingaben und – bei
 * einzeiligen Feldern – Zeilenumbrüche werden als Fehler gemeldet statt
 * stillschweigend gekürzt (Schutz vor Header-Injection).
 */
function field(string $name, int $maxLength, bool $multiline, array &$errors, string $message): string
{
    $value = $_POST[$name] ?? '';
    if (!is_string($value)) {
        $errors[$name] = $message;
        return '';
    }
    $value = trim(str_replace("\0", '', $value));
    if (!mb_check_encoding($value, 'UTF-8')) {
        $errors[$name] = $message;
        return '';
    }
    if (!$multiline && preg_match('/[\r\n]/', $value)) {
        $errors[$name] = $message;
        return '';
    }
    if (mb_strlen($value) > $maxLength) {
        $errors[$name] = 'Bitte kürzen Sie Ihre Eingabe auf höchstens ' . $maxLength . ' Zeichen.';
        return '';
    }
    return $value;
}

function encode_header(string $value): string
{
    return '=?UTF-8?B?' . base64_encode($value) . '?=';
}

// Honeypot: unsichtbares Feld, das nur Bots ausfüllen. Still „erfolgreich“
// antworten, damit der Bot nicht lernt, dass er erkannt wurde.
if (trim((string) ($_POST['website'] ?? '')) !== '') {
    send_json(200, ['ok' => true]);
}

// Begrenzung pro IP-Adresse (greift auch, wenn ein Bot keine Cookies speichert)
if (!rate_limit('submit', IP_SUBMIT_LIMIT)) {
    send_json(429, ['ok' => false, 'error' => 'Es wurden zu viele Anfragen gesendet. Bitte versuchen Sie es später erneut oder rufen Sie uns an: 06249 937 9999.']);
}

$errors = [];
$name = field('name', 200, false, $errors, 'Bitte tragen Sie Ihren Namen ein.');
$email = field('email', 254, false, $errors, 'Bitte prüfen Sie Ihre E-Mail-Adresse.');
$phone = field('phone', 50, false, $errors, 'Bitte prüfen Sie Ihre Telefonnummer.');
$topic = field('topic', 60, false, $errors, 'Bitte wählen Sie ein Anliegen aus der Liste.');
$message = field('message', 5000, true, $errors, 'Bitte schreiben Sie uns kurz, worum es geht.');
$consent = ($_POST['consent'] ?? '') !== '';

if (!isset($errors['name']) && mb_strlen($name) < 2) {
    $errors['name'] = 'Bitte tragen Sie Ihren Namen ein.';
}
if (!isset($errors['email']) && filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
    $errors['email'] = 'Bitte prüfen Sie Ihre E-Mail-Adresse.';
}
if (!isset($errors['phone']) && $phone === '') {
    $errors['phone'] = 'Bitte tragen Sie Ihre Telefonnummer ein.';
} elseif (!isset($errors['phone']) && !preg_match('/^[0-9+()\/\-\s.]{3,50}$/', $phone)) {
    $errors['phone'] = 'Bitte prüfen Sie Ihre Telefonnummer.';
}
if ($topic !== '' && !isset(TOPICS[$topic])) {
    $topic = '';
}
if (!isset($errors['message']) && $message === '') {
    $errors['message'] = 'Bitte schreiben Sie uns kurz, worum es geht.';
}
if (!$consent) {
    $errors['consent'] = 'Bitte bestätigen Sie, dass Sie die Datenschutzhinweise gelesen haben.';
}
if ($errors) {
    send_json(400, ['ok' => false, 'fields' => $errors, 'error' => 'Bitte prüfen Sie Ihre Angaben und füllen Sie die markierten Felder aus.']);
}

// Captcha muss in dieser Sitzung gelöst worden sein und wird danach verbraucht
$captcha = $_SESSION['captcha'] ?? null;
unset($_SESSION['captcha']);
if (!is_array($captcha) || empty($captcha['solved']) || time() - $captcha['issued'] > CAPTCHA_TTL
    || time() - (int) ($captcha['solved_at'] ?? 0) > CAPTCHA_SOLVED_TTL) {
    send_json(400, ['ok' => false, 'captcha' => true, 'error' => 'Bitte lösen Sie die Sicherheitsprüfung erneut.']);
}

// Einfache Begrenzung pro Sitzung
$recent = array_filter($_SESSION['sent'] ?? [], function ($t) {
    return is_int($t) && $t > time() - 3600;
});
if (count($recent) >= SUBMIT_LIMIT) {
    send_json(429, ['ok' => false, 'error' => 'Sie haben uns bereits mehrere Anfragen geschickt. Bitte rufen Sie uns an, wenn es eilig ist.']);
}

$topicLabel = $topic !== '' ? TOPICS[$topic] : 'nicht angegeben';

$subject = 'Website-Anfrage: ' . $topicLabel . ' – ' . $name;
$body = implode("\n", [
    'Neue Anfrage über das Kontaktformular der Website',
    '',
    'Name:     ' . $name,
    'E-Mail:   ' . $email,
    'Telefon:  ' . $phone,
    'Anliegen: ' . $topicLabel,
    '',
    'Nachricht:',
    $message,
    '',
    '---',
    'Gesendet am ' . date('d.m.Y \u\m H:i') . ' Uhr. Datenschutzhinweise wurden zur Kenntnis genommen.',
    'Mit „Antworten“ geht Ihre Antwort direkt an ' . $email . '.',
]);

// Nur geprüfte Werte in Kopfzeilen (E-Mail per filter_var validiert, keine Zeilenumbrüche möglich)
$headers = implode("\r\n", [
    'From: ' . encode_header(MAIL_FROM_NAME) . ' <' . MAIL_FROM . '>',
    'Reply-To: ' . $email,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
]);

$sent = mail(MAIL_TO, encode_header($subject), $body, $headers, '-f' . MAIL_FROM);

if (!$sent) {
    error_log('Kontaktformular: mail() fehlgeschlagen');
    send_json(500, ['ok' => false, 'captcha' => true, 'error' => 'Ihre Nachricht konnte gerade nicht versendet werden. Bitte rufen Sie uns an oder schreiben Sie an info@sicura-sicherheitstechnik.de.']);
}

$recent[] = time();
$_SESSION['sent'] = array_values($recent);
send_json(200, ['ok' => true]);
