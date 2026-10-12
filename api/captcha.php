<?php
/**
 * Puzzle-Captcha
 *
 * GET  → erzeugt ein neues Puzzle: Hintergrund mit Lücke und Puzzleteil als
 *        Bilder. Die richtige x-Position bleibt in der Sitzung und wird nie an
 *        den Browser geschickt.
 * POST → action=verify, x=<Position>: prüft die Position. Pro Puzzle ist genau
 *        ein Versuch erlaubt, danach muss ein neues geladen werden.
 */
declare(strict_types=1);
require __DIR__ . '/_lib.php';

start_form_session();
require_same_origin();

// Geometrie in Pixeln des erzeugten Bildes (doppelte Auflösung der Anzeige)
const W = 720;
const H = 480;
const L = 88;               // Kantenlänge des Puzzleteils
const R = 18;               // Radius der Nasen
const PW = L + 2 * R + 8;   // Größe des Teil-Bildes
const OX = 4;               // Lage des Quadrats im Teil-Bild
const OY = 2 * R + 4;
const MIN_X = 8;
const MAX_X = W - L - R - 16;

/** Liegt der Punkt (relativ zur linken oberen Ecke des Quadrats) im Puzzleteil? */
function in_piece(float $px, float $py): bool
{
    $inSquare = $px >= 0 && $px < L && $py >= 0 && $py < L;
    $top = ($px - L / 2) ** 2 + ($py - (4 - R)) ** 2 <= R * R;
    $right = ($px - (L + R - 4)) ** 2 + ($py - L / 2) ** 2 <= R * R;
    $left = ($px - (R - 4)) ** 2 + ($py - L / 2) ** 2 <= (R + 1) ** 2;
    return ($inSquare || $top || $right) && !$left;
}

function is_edge(float $px, float $py): bool
{
    return in_piece($px, $py) && (
        !in_piece($px - 1.5, $py) || !in_piece($px + 1.5, $py) ||
        !in_piece($px, $py - 1.5) || !in_piece($px, $py + 1.5)
    );
}

function image_data_url($image, string $type): string
{
    ob_start();
    if ($type === 'png') {
        imagepng($image, null, 6);
    } else {
        imagejpeg($image, null, 80);
    }
    return 'data:image/' . $type . ';base64,' . base64_encode((string) ob_get_clean());
}

function new_puzzle(): void
{
    if (!function_exists('imagecreatefromjpeg')) {
        send_json(500, ['ok' => false, 'error' => 'Die Sicherheitsprüfung ist gerade nicht verfügbar.']);
    }

    $source = @imagecreatefromjpeg(__DIR__ . '/captcha/bild.jpg');
    if (!$source) {
        send_json(500, ['ok' => false, 'error' => 'Die Sicherheitsprüfung ist gerade nicht verfügbar.']);
    }

    // Zufälliger Bildausschnitt, damit die Lücke nicht per Vergleich mit dem
    // öffentlichen Originalbild gefunden werden kann
    $bg = imagecreatetruecolor(W, H);
    imagecopy($bg, $source, 0, 0, random_int(0, max(0, imagesx($source) - W)), random_int(0, max(0, imagesy($source) - H)), W, H);

    $tx = random_int((int) (W * 0.4), MAX_X - 8);
    $ty = random_int(2 * R + 8, H - L - 12);

    $piece = imagecreatetruecolor(PW, PW);
    imagesavealpha($piece, true);
    imagealphablending($piece, false);
    imagefill($piece, 0, 0, imagecolorallocatealpha($piece, 0, 0, 0, 127));

    $edgePiece = imagecolorallocatealpha($piece, 255, 255, 255, 20);

    // Teil ausschneiden (vor dem Abdunkeln der Lücke)
    for ($j = 0; $j < PW; $j++) {
        for ($i = 0; $i < PW; $i++) {
            $px = $i - OX + 0.5;
            $py = $j - OY + 0.5;
            if (!in_piece($px, $py)) {
                continue;
            }
            $sx = $tx + $i - OX;
            $sy = $ty + $j - OY;
            if ($sx < 0 || $sy < 0 || $sx >= W || $sy >= H) {
                continue;
            }
            imagesetpixel($piece, $i, $j, is_edge($px, $py) ? $edgePiece : imagecolorat($bg, $sx, $sy));
        }
    }

    // Lücke im Hintergrund abdunkeln und umranden
    for ($j = 0; $j < PW; $j++) {
        for ($i = 0; $i < PW; $i++) {
            $px = $i - OX + 0.5;
            $py = $j - OY + 0.5;
            if (!in_piece($px, $py)) {
                continue;
            }
            $sx = $tx + $i - OX;
            $sy = $ty + $j - OY;
            if ($sx < 0 || $sy < 0 || $sx >= W || $sy >= H) {
                continue;
            }
            $rgb = imagecolorat($bg, $sx, $sy);
            if (is_edge($px, $py)) {
                $r = (int) (((($rgb >> 16) & 255) * 0.3) + 178);
                $g = (int) (((($rgb >> 8) & 255) * 0.3) + 178);
                $b = (int) ((($rgb & 255) * 0.3) + 178);
            } else {
                $r = (int) ((($rgb >> 16) & 255) * 0.4);
                $g = (int) ((($rgb >> 8) & 255) * 0.4);
                $b = (int) (($rgb & 255) * 0.4);
            }
            imagesetpixel($bg, $sx, $sy, ($r << 16) | ($g << 8) | $b);
        }
    }

    $_SESSION['captcha'] = [
        'x' => $tx,
        'issued' => time(),
        'solved' => false,
        'used' => false,
    ];

    $data = [
        'ok' => true,
        'bg' => image_data_url($bg, 'jpeg'),
        'piece' => image_data_url($piece, 'png'),
        'y' => $ty,
        'w' => W,
        'h' => H,
        'pw' => PW,
        'ox' => OX,
        'oy' => OY,
        'minX' => MIN_X,
        'maxX' => MAX_X,
    ];
    send_json(200, $data);
}

function verify(): void
{
    $captcha = $_SESSION['captcha'] ?? null;
    $x = filter_input(INPUT_POST, 'x', FILTER_VALIDATE_FLOAT);

    if (!is_array($captcha) || $captcha['used'] || time() - $captcha['issued'] > CAPTCHA_TTL || $x === false || $x === null) {
        unset($_SESSION['captcha']);
        send_json(200, ['ok' => false]);
    }

    $_SESSION['captcha']['used'] = true;
    // Unter einer Sekunde löst das kein Mensch
    $solved = abs($x - $captcha['x']) <= CAPTCHA_TOLERANCE && time() - $captcha['issued'] >= 1;
    $_SESSION['captcha']['solved'] = $solved;
    if (!$solved) {
        unset($_SESSION['captcha']);
    }
    send_json(200, ['ok' => $solved]);
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    new_puzzle();
} elseif ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'verify') {
    verify();
}
send_json(405, ['ok' => false, 'error' => 'Methode nicht erlaubt.']);
