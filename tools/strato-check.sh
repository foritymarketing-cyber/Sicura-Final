#!/bin/sh
# Prüft die veröffentlichte Website auf STRATO von außen (nur lesende Abrufe).
# Aufruf:  sh tools/strato-check.sh https://www.sicura-sicherheitstechnik.de
# Dieses Skript gehört NICHT auf den Webspace.

BASE="${1:-https://www.sicura-sicherheitstechnik.de}"
HOST=$(echo "$BASE" | sed -E 's#https?://##; s#/.*##')
BARE=$(echo "$HOST" | sed 's/^www\.//')
FAIL=0
ok()   { printf '  \033[32mOK\033[0m    %s\n' "$1"; }
bad()  { printf '  \033[31mFEHLER\033[0m %s\n' "$1"; FAIL=1; }
code() { curl -s -o /dev/null -w '%{http_code}' "$1"; }

echo "== HTTPS und Weiterleitungen"
r=$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' "http://$HOST/kontakt")
case "$r" in 301\ https://www.$BARE/kontakt) ok "HTTP -> HTTPS ($r)";; *) bad "HTTP -> HTTPS: $r";; esac
r=$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' "https://$BARE/")
case "$r" in 301\ https://www.$BARE/) ok "ohne www -> www";; *) bad "ohne www -> www: $r";; esac
r=$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' "$BASE/leistungen/videoueberwachung")
case "$r" in 301*leistungen-videoueberwachung) ok "alte Leistungs-URL -> 301";; *) bad "alte Leistungs-URL: $r";; esac

echo "== Seiten (Clean URLs)"
for p in / /leistungen /leistungen-videoueberwachung /leistungen-einbruchmeldeanlagen /leistungen-service-wartung \
         /leistungen-verdeckte-videoueberwachung /leistungen-kurzeinsaetze /ueber-uns /referenzen /partner /faq \
         /ratgeber /kontakt /impressum /datenschutz /danke /sitemap.xml /robots.txt; do
  c=$(code "$BASE$p"); [ "$c" = 200 ] && ok "$p" || bad "$p -> $c"
done
c=$(code "$BASE/gibt-es-nicht"); [ "$c" = 404 ] && ok "404-Seite" || bad "404-Seite -> $c"

echo "== Gesperrte Dateien (erwartet 403/404, niemals 200)"
for p in /api/_intern/lib.php /api/_intern/data/salt.php /api/_lib.php /api/captcha/bild.jpg /.htaccess /.git/config \
         /.env /.claude/launch.json /CLAUDE.md /design-briefing-ajax-inspiration.md /tools/strato-check.sh \
         /docs/STRATO-CHECKLISTE.md /index.html.bak; do
  c=$(code "$BASE$p"); case "$c" in 403|404) ok "$p ($c)";; *) bad "$p -> $c";; esac
done

echo "== PHP wird ausgeführt (kein Quellcode)"
for p in /api/captcha.php /api/kontakt.php /api/_intern/lib.php; do
  if curl -s "$BASE$p" | grep -q '<?php'; then bad "$p liefert PHP-Quellcode!"; else ok "$p kein Quellcode"; fi
done

echo "== CAPTCHA-Endpunkt (PHP-Version, GD, Sitzung)"
JAR=$(mktemp); HDR=$(mktemp)
body=$(curl -s -D "$HDR" -c "$JAR" "$BASE/api/captcha.php")
echo "$body" | grep -q '^{"ok":true,"bg":"data:image/jpeg;base64,' && ok "JSON mit Puzzlebildern (GD funktioniert)" || bad "CAPTCHA-Antwort: $(echo "$body" | head -c 200)"
grep -qi '^content-type: application/json' "$HDR" && ok "Content-Type JSON" || bad "Content-Type nicht JSON"
cookie=$(grep -i '^set-cookie: sicura_form' "$HDR")
[ -n "$cookie" ] && ok "Sitzungs-Cookie gesetzt" || bad "kein Sitzungs-Cookie"
echo "$cookie" | grep -qi 'secure'   && ok "Cookie Secure"   || bad "Cookie ohne Secure"
echo "$cookie" | grep -qi 'httponly' && ok "Cookie HttpOnly" || bad "Cookie ohne HttpOnly"
echo "$cookie" | grep -qi 'samesite=strict' && ok "Cookie SameSite=Strict" || bad "Cookie ohne SameSite"
grep -qi '^x-powered-by' "$HDR" && bad "X-Powered-By verrät die PHP-Version" || ok "keine PHP-Versionsangabe im Header"
r=$(curl -s -b "$JAR" -X POST -d 'action=verify&x=1' "$BASE/api/captcha.php")
[ "$r" = '{"ok":false}' ] && ok "Falsche Puzzle-Lösung wird abgelehnt" || bad "Verify-Antwort: $r"
r=$(curl -s -b "$JAR" -X POST -d 'name=Test&email=test@example.org&message=Testnachricht&consent=on' "$BASE/api/kontakt.php")
echo "$r" | grep -q '"captcha":true' && ok "Formular ohne gelöstes CAPTCHA abgelehnt" || bad "Formular-Antwort: $r"
r=$(curl -s -H 'Origin: https://evil.example' -X POST -d 'name=x' "$BASE/api/kontakt.php")
echo "$r" | grep -q 'Ungültige Anfrage' && ok "Fremde Origin abgelehnt" || bad "Fremde Origin: $r"
rm -f "$JAR" "$HDR"

echo "== Sicherheitsheader (Startseite)"
H=$(curl -s -D - -o /dev/null "$BASE/")
for h in 'content-security-policy:' "frame-ancestors 'none'" 'x-frame-options: deny' 'x-content-type-options: nosniff' \
         'referrer-policy: strict-origin-when-cross-origin' 'permissions-policy:'; do
  echo "$H" | grep -qi "$h" && ok "$h" || bad "fehlt: $h"
done
echo "$H" | grep -qi 'strict-transport-security' && ok "HSTS aktiv" || echo "  Hinweis: HSTS noch nicht aktiv (erst nach stabilem HTTPS einschalten)"

echo "== Gemischte Inhalte"
if curl -s "$BASE/" "$BASE/kontakt" | grep -Eo '(src|href)="http://[^"]+' | grep -q .; then bad "http://-Ressourcen gefunden"; else ok "keine http://-Ressourcen"; fi

echo
[ $FAIL = 0 ] && echo "Alle automatischen Prüfungen bestanden. Manuelle Tests siehe docs/STRATO-CHECKLISTE.md." || echo "Es gibt Fehler – siehe oben."
exit $FAIL
