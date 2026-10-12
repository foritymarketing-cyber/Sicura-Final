<?php
/**
 * Kontaktformular: prüft Captcha und Eingaben und verschickt die Anfrage per
 * E-Mail an MAIL_TO. Antwortet immer mit JSON.
 */
declare(strict_types=1);
require __DIR__ . '/_lib.php';

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

function field(string $name, int $maxLength): string
{
    $value = $_POST[$name] ?? '';
    if (!is_string($value)) {
        return '';
    }
    $value = trim(str_replace("\0", '', $value));
    return function_exists('mb_substr') ? mb_substr($value, 0, $maxLength) : substr($value, 0, $maxLength);
}

function text_length(string $value): int
{
    return function_exists('mb_strlen') ? mb_strlen($value) : strlen($value);
}

function encode_header(string $value): string
{
    return '=?UTF-8?B?' . base64_encode($value) . '?=';
}

// Honeypot: unsichtbares Feld, das nur Bots ausfüllen. Still „erfolgreich“
// antworten, damit der Bot nicht lernt, dass er erkannt wurde.
if (field('website', 200) !== '') {
    send_json(200, ['ok' => true]);
}

// Captcha muss in dieser Sitzung gelöst worden sein und wird danach verbraucht
$captcha = $_SESSION['captcha'] ?? null;
unset($_SESSION['captcha']);
if (!is_array($captcha) || empty($captcha['solved']) || time() - $captcha['issued'] > CAPTCHA_TTL) {
    send_json(400, ['ok' => false, 'captcha' => true, 'error' => 'Bitte lösen Sie die Sicherheitsprüfung erneut.']);
}

// Einfache Begrenzung pro Sitzung
$recent = array_filter($_SESSION['sent'] ?? [], function ($t) {
    return is_int($t) && $t > time() - 3600;
});
if (count($recent) >= SUBMIT_LIMIT) {
    send_json(429, ['ok' => false, 'error' => 'Sie haben uns bereits mehrere Anfragen geschickt. Bitte rufen Sie uns an, wenn es eilig ist.']);
}

$name = field('name', 200);
$email = field('email', 254);
$phone = field('phone', 50);
$topic = field('topic', 60);
$message = field('message', 5000);
$consent = ($_POST['consent'] ?? '') !== '';

$errors = [];
if (text_length($name) < 2) {
    $errors['name'] = 'Bitte tragen Sie Ihren Namen ein.';
}
if (filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
    $errors['email'] = 'Bitte prüfen Sie Ihre E-Mail-Adresse.';
}
if ($phone !== '' && !preg_match('/^[0-9+()\/\-\s.]{3,50}$/', $phone)) {
    $errors['phone'] = 'Bitte prüfen Sie Ihre Telefonnummer.';
}
if ($topic !== '' && !isset(TOPICS[$topic])) {
    $topic = '';
}
if (text_length($message) < 10) {
    $errors['message'] = 'Bitte schreiben Sie uns kurz, worum es geht.';
}
if (!$consent) {
    $errors['consent'] = 'Bitte bestätigen Sie die Einwilligung.';
}
if ($errors) {
    send_json(400, ['ok' => false, 'fields' => $errors, 'error' => 'Bitte prüfen Sie Ihre Angaben und füllen Sie die markierten Felder aus.']);
}

$topicLabel = $topic !== '' ? TOPICS[$topic] : 'nicht angegeben';

$subject = 'Website-Anfrage: ' . $topicLabel . ' – ' . $name;
$body = implode("\n", [
    'Neue Anfrage über das Kontaktformular der Website',
    '',
    'Name:     ' . $name,
    'E-Mail:   ' . $email,
    'Telefon:  ' . ($phone !== '' ? $phone : 'nicht angegeben'),
    'Anliegen: ' . $topicLabel,
    '',
    'Nachricht:',
    $message,
    '',
    '---',
    'Gesendet am ' . date('d.m.Y \u\m H:i') . ' Uhr. Einwilligung zur Datenverarbeitung wurde erteilt.',
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
    send_json(500, ['ok' => false, 'error' => 'Ihre Nachricht konnte gerade nicht versendet werden. Bitte rufen Sie uns an oder schreiben Sie an info@sicura-sicherheitstechnik.de.']);
}

$recent[] = time();
$_SESSION['sent'] = array_values($recent);
send_json(200, ['ok' => true]);
