// Erzeugt die Upload-Version der Website in dist/ (Projektordner).
// - HTML, CSS und JavaScript werden minifiziert (Kommentare entfernt,
//   Leerraum komprimiert, lokale Variablennamen in JS verkürzt).
// - Es werden nur Dateien übernommen, die auf den Webspace gehören
//   (siehe docs/STRATO-CHECKLISTE.md). Aus assets/Medien/ nur Dateien,
//   die in HTML/CSS/JS/PHP tatsächlich referenziert werden – Rohfotos
//   und unverpixelte Originale bleiben damit automatisch draußen.
// Aufruf:  cd tools/build && npm install && npm run build
// Die Quelldateien im Projektordner bleiben unverändert.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { transform } from 'esbuild';
import { minify as minifyHtml } from 'html-minifier-terser';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DIST = path.join(ROOT, 'dist');

// Nie hochladen (relativ zum Projektordner)
const EXCLUDE_DIRS = new Set(['.git', '.claude', 'docs', 'tools', 'dist', 'node_modules']);
const EXCLUDE_FILES = /(^|\/)(\.DS_Store|\.gitignore|CLAUDE\.md)$|\.(md|sh|bak|log|orig|swp)$|~$/i;
// Laufzeitdaten des Kontaktformulars (Salt, Rate-Limit, Fehlerprotokoll) –
// werden auf dem Server neu erzeugt; nur die Schutz-.htaccess mitnehmen.
const RUNTIME_DATA = /^api\/_intern\/data\/(?!\.htaccess$)/;
const MEDIA_DIR = 'assets/Medien/';

async function walk(dir, rel = '') {
  const out = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const r = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (!EXCLUDE_DIRS.has(r)) out.push(...(await walk(path.join(dir, entry.name), r)));
    } else if (entry.isFile() && !EXCLUDE_FILES.test(r) && !RUNTIME_DATA.test(r)) {
      out.push(r);
    }
  }
  return out;
}

const files = await walk(ROOT);

// Alle Texte, in denen Medien referenziert sein können
const referencing = files.filter((f) => /\.(html|css|js|php|xml)$/i.test(f) && !f.startsWith(MEDIA_DIR));
const haystack = (await Promise.all(referencing.map((f) => fs.readFile(path.join(ROOT, f), 'utf8')))).join('\n');
const isReferenced = (f) => {
  const name = f.slice(MEDIA_DIR.length);
  return haystack.includes(name) || haystack.includes(encodeURI(name));
};

const htmlOptions = {
  collapseWhitespace: true,
  conservativeCollapse: true, // ein Leerzeichen bleibt, damit sich Inline-Abstände nicht ändern
  removeComments: true,
  minifyCSS: true,
  minifyJS: false, // nur JSON-LD inline; bleibt unverändert
  keepClosingSlash: true,
  decodeEntities: false,
};

await fs.rm(DIST, { recursive: true, force: true });

let copied = 0, minified = 0, saved = 0;
const skippedMedia = [];
for (const f of files) {
  if (f.startsWith(MEDIA_DIR) && !isReferenced(f)) { skippedMedia.push(f); continue; }
  const src = path.join(ROOT, f);
  const dest = path.join(DIST, f);
  await fs.mkdir(path.dirname(dest), { recursive: true });

  const ext = path.extname(f).toLowerCase();
  const isVendor = f.startsWith('assets/js/vendor/');
  if (!isVendor && (ext === '.html' || ext === '.css' || ext === '.js')) {
    const input = await fs.readFile(src, 'utf8');
    let output;
    if (ext === '.html') {
      output = await minifyHtml(input, htmlOptions);
    } else {
      // Klassische Skripte (kein Modul): globale Namen bleiben erhalten
      const res = await transform(input, { loader: ext.slice(1), minify: true, legalComments: 'none', target: 'es2019' });
      output = res.code;
    }
    await fs.writeFile(dest, output);
    saved += Buffer.byteLength(input) - Buffer.byteLength(output);
    minified++;
  } else {
    await fs.copyFile(src, dest);
    copied++;
  }
}

console.log(`dist/ erstellt: ${minified} Dateien minifiziert (−${(saved / 1024).toFixed(0)} KB), ${copied} kopiert.`);
if (skippedMedia.length) {
  console.log(`Nicht übernommen (in keiner Seite verwendet, ${skippedMedia.length}):`);
  for (const f of skippedMedia) console.log(`  - ${f}`);
}
