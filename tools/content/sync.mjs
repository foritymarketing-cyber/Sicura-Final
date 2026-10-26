// Gleicht die HTML-Seiten mit der zentralen Inhaltsquelle (inhalte.mjs) ab.
//   node tools/content/sync.mjs            schreibt die Seiten
//   node tools/content/sync.mjs --pruefen  prüft nur (Exit-Code 1 bei Abweichungen)
// Geprüft wird außerdem, dass die Seiten keine Gedankenstriche als
// Satzzeichen enthalten und dass jeder zentrale Text verwendet wird.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { texte, referenzKategorien } from './inhalte.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const nurPruefen = process.argv.includes('--pruefen');

const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const decodeHtml = (s) =>
  s.replace(/&nbsp;/g, ' ').replace(/&shy;/g, '').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const textOf = (html) => decodeHtml(html.replace(/<br\s*\/?>/g, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

const fehler = [];
const verwendet = new Set();

// Elemente mit data-inhalt="schlüssel": Inhalt = zentraler Text
const ELEMENT = /(<([a-z][a-z0-9]*)\b[^>]*\sdata-inhalt="([a-z0-9-]+)"[^>]*>)([\s\S]*?)(<\/\2>)/g;
function ersetzeTexte(html, datei) {
  return html.replace(ELEMENT, (_, open, tag, key, inner, close) => {
    if (!(key in texte)) {
      fehler.push(`${datei}: unbekannter Schlüssel data-inhalt="${key}"`);
      return open + inner + close;
    }
    verwendet.add(key);
    return open + escapeHtml(texte[key]) + close;
  });
}

// Laufband auf /referenzen: erste Hälfte für alle, zweite Hälfte als
// ausgeblendete Kopie für die nahtlose Schleife (script.js erwartet zwei
// gleiche Hälften)
function laufband() {
  const knopf = escapeHtml(texte['projekt-knopf']);
  verwendet.add('projekt-knopf');
  const karte = (k, kopie) => {
    const titel = escapeHtml(k.titel);
    return [
      `              <li class="sector-card" data-project="${k.projekt}"${kopie ? ' aria-hidden="true"' : ''}>`,
      '                <div class="sector-card-media">',
      `                  <img src="assets/Medien/${k.bild}" alt="${kopie ? '' : escapeHtml(k.alt)}" loading="lazy" width="960" height="640" draggable="false">`,
      '                  <span class="ki-label">KI-generiert</span>',
      '                </div>',
      '                <div class="sector-card-body">',
      kopie
        ? `                  <p class="sector-card-title">${titel}</p>`
        : `                  <h3 class="sector-card-title">${titel}</h3>`,
      `                  <p class="sector-card-tech">Eingesetzte Technik:<br>${escapeHtml(k.technik)}</p>`,
      kopie
        ? `                  <span class="sector-card-more">${knopf}</span>`
        : `                  <button type="button" class="sector-card-more" aria-haspopup="dialog" aria-controls="project-dialog" aria-label="${knopf}: ${titel}">${knopf}</button>`,
      '                </div>',
      '              </li>',
    ].join('\n');
  };
  return [...referenzKategorien.map((k) => karte(k, false)), ...referenzKategorien.map((k) => karte(k, true))].join('\n');
}

function ersetzeBloecke(html, datei) {
  return html.replace(/(<!-- inhalt:([a-z0-9-]+) -->\n)[\s\S]*?(<!-- \/inhalt:\2 -->)/g, (_, open, key, close) => {
    if (key === 'referenzen-laufband') {
      for (const k of referenzKategorien) {
        if (!html.includes(`id="projekt-${k.projekt}"`)) fehler.push(`${datei}: Projekt "${k.projekt}" fehlt im Dialog`);
      }
      return open + laufband() + '\n' + close;
    }
    fehler.push(`${datei}: unbekannter Block inhalt:${key}`);
    return _;
  });
}

// FAQ-Seite: JSON-LD aus den sichtbaren Fragen und Antworten
function ersetzeFaqDaten(html) {
  if (!/"@type": "FAQPage"/.test(html)) return html;
  const fragen = [...html.matchAll(/<details class="qa-item"[\s\S]*?<h2 class="qa-question">([\s\S]*?)<\/h2>[\s\S]*?<div class="qa-answer">([\s\S]*?)<\/div>/g)].map(
    ([, frage, antwort]) => ({
      '@type': 'Question',
      name: textOf(frage),
      acceptedAnswer: { '@type': 'Answer', text: textOf(antwort) },
    }),
  );
  const json = JSON.stringify({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: fragen }, null, 2);
  return html.replace(/(<script type="application\/ld\+json">\n)\{\n  "@context": "https:\/\/schema\.org",\n  "@type": "FAQPage"[\s\S]*?\n\}(\n\s*<\/script>)/, (_, a, b) => a + json + b);
}

// Gedankenstriche als Satzzeichen im sichtbaren Text, in Text-Attributen
// und in strukturierten Daten finden (Wortbindestriche bleiben unberührt)
const STRICH = /[–—]|&[nm]dash;|&#821[12];|\s-\s/;
function pruefeStriche(html, datei) {
  const ohne = html.replace(/<!--[\s\S]*?-->/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<script(?![^>]*ld\+json)[\s\S]*?<\/script>/g, '');
  const teile = [];
  for (const [, t] of ohne.matchAll(/>([^<]+)</g)) teile.push(t);
  for (const [, , t] of ohne.matchAll(/\s(alt|title|aria-label|content|placeholder|value)="([^"]*)"/g)) teile.push(t);
  for (const t of teile) if (STRICH.test(t)) fehler.push(`${datei}: Gedankenstrich in „${t.trim().slice(0, 90)}“`);
}

const seiten = (await fs.readdir(ROOT)).filter((f) => f.endsWith('.html')).sort();
const geaendert = [];
for (const datei of seiten) {
  const pfad = path.join(ROOT, datei);
  const alt = await fs.readFile(pfad, 'utf8');
  const neu = ersetzeFaqDaten(ersetzeBloecke(ersetzeTexte(alt, datei), datei));
  if (/class="btn btn-primary nav-cta"(?![^>]*data-inhalt="beratung-knopf")/.test(neu)) {
    fehler.push(`${datei}: Beratungsknopf in der Navigation ohne data-inhalt="beratung-knopf"`);
  }
  pruefeStriche(neu, datei);
  if (neu !== alt) {
    geaendert.push(datei);
    if (!nurPruefen) await fs.writeFile(pfad, neu);
  }
}

// Texte in script.js (Statusmeldungen u. Ä.), ohne Kommentare
const js = (await fs.readFile(path.join(ROOT, 'script.js'), 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/.*$/gm, '$1');
for (const [, t] of js.matchAll(/'((?:[^'\\\n]|\\.)*)'/g)) if (STRICH.test(t)) fehler.push(`script.js: Gedankenstrich in „${t}“`);
for (const t of Object.values(texte)) if (STRICH.test(t)) fehler.push(`inhalte.mjs: Gedankenstrich in „${t}“`);

for (const key of Object.keys(texte)) if (!verwendet.has(key)) fehler.push(`inhalte.mjs: "${key}" wird auf keiner Seite verwendet`);

if (geaendert.length) {
  console.log(nurPruefen ? 'Nicht abgeglichen (npm run inhalte ausführen):' : 'Abgeglichen:', geaendert.join(', '));
  if (nurPruefen) fehler.push('Seiten weichen von der zentralen Inhaltsquelle ab');
} else {
  console.log('Alle Seiten entsprechen der zentralen Inhaltsquelle.');
}
if (fehler.length) {
  console.error(fehler.map((f) => '  FEHLER ' + f).join('\n'));
  process.exit(1);
}
console.log('Prüfung ohne Befund (zentrale Texte, Laufband, FAQ-Daten, Gedankenstriche).');
