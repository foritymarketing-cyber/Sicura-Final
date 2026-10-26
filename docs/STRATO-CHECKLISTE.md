# Sicura – Veröffentlichung auf STRATO: Checkliste

Stand: 12.10.2026. Dieses Dokument wird **nicht** hochgeladen (per `.htaccess` zusätzlich gesperrt).

## 1. Was auf den Webspace gehört

**Empfohlen: Upload-Version bauen.** Das Build-Skript legt den Ordner `dist/` an, in dem HTML, CSS und JavaScript minifiziert sind (schwerer lesbar und kopierbar, schnellere Ladezeit) und nur Dateien liegen, die auf den Webspace gehören. Rohfotos aus `assets/Medien/`, die keine Seite verwendet, bleiben automatisch draußen. Danach den **Inhalt** von `dist/` (inkl. der versteckten `.htaccess`-Dateien) hochladen.

```bash
cd tools/build && npm install && npm run build
```

Vor dem Minifizieren gleicht der Build die mehrfach verwendeten Texte (Beratungsbereiche, Inhaberin, Herstellertext, einzelne FAQ-Antworten, Laufband der Referenzen, FAQ-Daten) aus `tools/content/inhalte.mjs` in die Seiten ab und prüft auf Gedankenstriche. Diese Texte werden nur dort geändert; `npm run inhalte` überträgt sie ohne Build in die Seiten, `npm run pruefen` prüft nur.

Lokal prüfen lässt sich die Upload-Version über die Preview-Konfiguration `sicura-dist` (Port 4324). Dabei entstehen in `dist/api/_intern/data/` Laufzeitdateien – vor dem Upload deshalb den Build erneut ausführen. Hinweis: HTML, CSS und JavaScript muss jeder Browser laden, minifizierter Code lässt sich also weiterhin ansehen, nur deutlich schwerer nachvollziehen.

Ohne Build-Schritt gilt (Inhalt des Projektordners):

- alle `*.html`, `styles.css`, `script.js`, `motion-effects.js`, `robots.txt`, `sitemap.xml`, `.htaccess`
- `assets/` **ohne** die Rohdateien in `assets/Medien/` (siehe unten)
- `api/captcha.php`, `api/kontakt.php`, `api/captcha/` (inkl. `.htaccess`), `api/_intern/` (inkl. `.htaccess`, `lib.php`, `data/.htaccess`)

**Nicht** hochladen:

- `.git/`, `.claude/`, `.gitignore`, `.DS_Store`, `CLAUDE.md`, `design-briefing-ajax-inspiration.md`
- `docs/`, `tools/`
- Rohdateien in `assets/Medien/`: `ChatGPT Image …png`, `*.JPG`, `*.MP4`, `f8a93236-….png`, `Hauseingang …png`, `Kompakte Minikamera …png`, `Moderne Haustür …png`, `Sicherheitskamera und Sensoren …png`, `Traumhafte Villa …png`, `Weiße Außenkamera …png`
  (enthalten u. a. **unverpixelte** Originalfotos mit Praxisschild und Vereinslogo!)
- Sicherungskopien, `.env`, Zugangsdaten jeglicher Art

Schreibrechte: `api/_intern/data/` muss für PHP beschreibbar sein (Rate-Limit, Fehlerprotokoll).

Optional: Liegt eine Ebene **über** dem Document Root eine Datei `sicura-config.php`, wird sie automatisch geladen (z. B. um `MAIL_TO` zu ändern), ohne dass sie im Web erreichbar ist.

## 2. Einstellungen im STRATO-Kundenlogin

- [ ] PHP-Version: aktuelle, unterstützte Version (mind. 8.2, besser 8.3/8.4) aktiviert
- [ ] SSL-Zertifikat für `www.sicura-sicherheitstechnik.de` **und** `sicura-sicherheitstechnik.de` aktiv
- [ ] Domain zeigt auf das richtige Verzeichnis
- [ ] Postfach `info@sicura-sicherheitstechnik.de` existiert (Absender muss eine Adresse der eigenen Domain sein)
- [ ] Vertrag zur Auftragsverarbeitung (AVV) mit STRATO im Kundenlogin abgeschlossen
- [x] Postfach liegt bei STRATO (in der Datenschutzerklärung beschrieben, abgedeckt durch denselben AVV)
- [ ] STRATO-Zugang: starkes, individuelles Passwort, Zwei-Faktor-Authentifizierung aktiv, keine unnötigen Unterzugänge/FTP-Benutzer
- [ ] Log-Aufbewahrungsfrist bei STRATO erfragen/im AVV nachlesen und ggf. in der Datenschutzerklärung (Abschnitt 3a) konkret nennen
- [ ] Cloudflare-Vorschau (temporärer Host) löschen bzw. Zugriff entfernen; Cloudflare wird nach dem Umzug nicht genutzt
- [ ] Sicherung der fertigen Website anlegen (STRATO-Backup + lokale Kopie des Git-Stands)

## 3. Automatische Prüfung nach dem Upload

```bash
sh tools/strato-check.sh https://www.sicura-sicherheitstechnik.de
```

Prüft HTTPS-/www-Weiterleitung, alle Seiten, Sperren für interne Dateien, dass PHP ausgeführt wird (kein Quellcode), CAPTCHA-JSON (bestätigt GD und Sitzungen), Cookie-Flags (Secure, HttpOnly, SameSite), Ablehnung ohne CAPTCHA/fremde Herkunft, Sicherheitsheader und gemischte Inhalte.

Wenn alles grün ist und HTTPS stabil läuft: in `.htaccess` die HSTS-Zeile aktivieren und das Skript erneut ausführen.

## 4. Manuelle Tests (Desktop, iPhone, Android)

Für **jedes** Gerät eine vollständige Anfrage senden und im Postfach prüfen. Die Danke-Seite allein genügt nicht.

| Test | Desktop | iPhone | Android |
|---|---|---|---|
| Gültige Anfrage → Mail kommt im Sicura-Postfach an, Umlaute korrekt, „Antworten“ geht an Absender | | | |
| Pflichtfeld leer → verständliche Meldung am Feld | | | |
| Ungültige E-Mail → Meldung am Feld | | | |
| Puzzle falsch → „Nicht ganz …“, neues Puzzle lädt automatisch | | | |
| Puzzle per Button neu laden | | | |
| Puzzle per Tastatur lösen (Pfeiltasten, Enter) | | – | – |
| Puzzle lösen, > 30 Min. warten, absenden → Aufforderung, neu zu lösen | | | |
| Doppelt auf „Senden“ tippen → nur **eine** Mail | | | |
| Navigation, Burger-Menü, Kontakt-Button im Header | | | |
| Startvideo, Pause-Schalter, KI-Kennzeichnungen lesbar | | | |
| Telefon- und Mail-Links öffnen die richtige App | | | |

Fehlgeschlagener Mailversand: lokal getestet (Fehlermeldung mit Telefonnummer, Puzzle wird neu geladen). Auf STRATO nicht gefahrlos auslösbar – nur prüfen, falls ein Fehler auftritt (`api/_intern/data/php-error.log` per FTP ansehen).

## 5. Medienliste (echt / KI / bearbeitet)

| Datei | Verwendung | Art | Kennzeichnung |
|---|---|---|---|
| `hero-video.mp4`, `hero-video-720.mp4`, `hero-poster.jpg` | Startseite Hero | KI-generiert | „KI-generiertes Video“ am Video |
| `leistungen-videoueberwachung-hover.mp4` (+ Poster) | Kacheln Start/Leistungen | KI-generiert | „KI-generiertes Video“ |
| `leistungen-einbruchmeldeanlagen-hover.mp4` (+ Poster) | Kacheln Start/Leistungen | KI-generiert | „KI-generiertes Video“ |
| `solution-kamera-fassade.png` | Startseite „Ihr Weg zu uns“ | KI-generiert | „KI-generiertes Symbolbild“ |
| `ratgeber-alarmanlage-hauseingang.jpg` | Ratgeber, Startseite | KI-generiert | „KI-generiertes Symbolbild“ |
| `ratgeber-kurzeinsaetze-technik.jpg` | Ratgeber, Startseite, Kurzeinsätze, Videoüberwachung | KI-generiert | „KI-generiertes Symbolbild“ |
| `ratgeber-verdeckte-minikamera.jpg` | Ratgeber, verdeckte Überwachung, Videoüberwachung | KI-generiert | „KI-generiertes Symbolbild“ |
| `ratgeber-videoueberwachung-aussenkamera.jpg` | Ratgeber | KI-generiert | „KI-generiertes Symbolbild“ |
| `ratgeber-hero-hintergrund.jpg` | Ratgeber-Kopfbereich | KI-generiert | „KI-generiertes Symbolbild“ |
| `referenz-arztpraxen.jpg` | Referenzen, Startseite | echtes Foto, stark weichgezeichnet | keine (Freigabe Kunde prüfen) |
| `leistungen-service-wartung-montage.jpg` | Kachel „Service und Wartung“ | laut Historie „eigenes Montagefoto“ – **bestätigen** | offen |
| `angela-foggia.webp`, `angela-foggia-klein.webp` | Über uns, Startseite, Kontakt | echtes Foto (WhatsApp-Bild vom 12.10.2026), zugeschnitten; alte Telefonnummer auf dem Banner weichgezeichnet | – |
| `captcha/bild.jpg` | Puzzle-Hintergrund | **Herkunft klären** | – |
| `partner-logos/*` | Startseite, Partner | Herstellerlogos/Partnerbadges | Status bestätigen |

## 6. Offene rechtliche/inhaltliche Punkte

- [ ] Impressum: Unternehmensdaten, Inhaberin, Anschrift, USt-ID (DE313241112) anhand der Unterlagen bestätigen; berufsbezogene Angaben (z. B. Handwerkskammer/Gewerbeerlaubnis Bewachung?) und Hinweis zur Verbraucherschlichtung (§ 36 VSBG) prüfen; danach „Entwurf“-Hinweis entfernen
- [ ] Partnerstatus bestätigen: Ajax Superior Partner, Hikvision Certified Partner, Axis Authorized Partner, Telenot Authorized Partner, Lupus Certified Gold Partner (nur nennen, wenn aktuell gültig; Logo-Nutzung erlaubt?)
- [x] „5,0 Sterne bei Google“ von der Website entfernt (nur noch Links zum Google-Profil)
- [ ] Freigaben für Referenzfotos (Arztpraxis, Fußballverein) – auch weichgezeichnet erkennbar?
- [ ] Nach Livegang: Cookies, Browser-Speicher und externe Verbindungen im Browser kontrollieren (erwartet: nur `sicura_form` auf `/api/`, keine Drittanbieter)
- [ ] Kein Penetrationstest durchgeführt – die Maßnahmen reduzieren Risiken, garantieren aber keinen vollständigen Schutz
