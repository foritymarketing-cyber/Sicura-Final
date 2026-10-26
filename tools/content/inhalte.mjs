// Zentrale Quelle für Texte, die auf mehreren Seiten (oder an mehreren
// Stellen einer Seite) gleich erscheinen sollen.
//
// So funktioniert es:
// - In den HTML-Seiten trägt das jeweilige Element data-inhalt="<schlüssel>".
//   Sein Inhalt wird beim Abgleich durch den Text unten ersetzt.
// - Das Laufband auf /referenzen wird vollständig aus `referenzKategorien`
//   erzeugt (zwischen <!-- inhalt:referenzen-laufband --> und dem Endmarker).
// - Die strukturierten FAQ-Daten (JSON-LD) in faq.html werden aus den
//   sichtbaren Fragen und Antworten der Seite erzeugt.
//
// Nach einer Änderung hier:  cd tools/build && npm run inhalte
// (npm run build gleicht vorher automatisch ab; npm run pruefen prüft nur.)
//
// Texte als reiner Text, ohne HTML. Keine Gedankenstriche als Satzzeichen.

export const texte = {
  // Allgemeine Beratungsbereiche (Abschluss-Banner) und Beratungsknöpfe,
  // auch der Knopf oben in der Navigation
  'beratung-titel': 'Persönliche Beratung',
  'beratung-text':
    'Wir beraten Sie telefonisch zu passenden Sicherheitslösungen und erstellen ein kostenloses, unverbindliches Angebot. Über mögliche Kosten einer Vor-Ort-Besichtigung informieren wir Sie im Voraus.',
  'beratung-knopf': 'Kostenlos beraten lassen',

  // Karte „Service und Wartung“ (Startseite, Leistungsübersicht)
  'service-karte':
    'Auch nach der Installation sind wir für Sie da. Wir übernehmen Wartung, Reparatur und Erweiterung der Sicherheitstechnik, die wir bei Ihnen installiert haben.',

  // Kurze Vorstellung der Inhaberin (Startseite, Kontakt, Über uns)
  'inhaberin-name': 'Angela Foggia, Inhaberin',
  'inhaberin-text': 'Ihre Ansprechpartnerin für Anfragen, Angebote und die persönliche Betreuung.',

  // „Auf bewährte Systeme spezialisiert“ (Startseite, Partner)
  'hersteller-text':
    'Wir arbeiten mit bewährten Sicherheitssystemen verschiedener Hersteller. Welche Technik wir empfehlen, richtet sich nach Ihrem Bedarf. Wir erklären die Unterschiede, installieren fachgerecht und betreuen Ihre Anlage auch nach der Inbetriebnahme.',

  // Bewertungsbereich (Startseite, Referenzen): steht vor den beiden Knöpfen
  'bewertungen-text':
    'Das Vertrauen unserer Kunden ist unsere beste Empfehlung. Über den folgenden Link erfahren Sie, wie unsere Kunden die Zusammenarbeit mit uns erleben. Wir freuen uns über Ihre ehrliche Bewertung und Ihre Erfahrungen mit Sicura.',

  // Beschriftungen Referenzen: Übersicht (Startseite) und einzelne Projekte
  // (Karten im Laufband) bewusst getrennt
  'referenzen-uebersicht-knopf': 'Referenzen ansehen',
  'projekt-knopf': 'Anonymisiertes Kundenprojekt ansehen',

  // FAQ Videoüberwachung
  'faq-video-internet':
    'Für die lokale Aufzeichnung benötigen Sie keine Internetverbindung. Für den Zugriff von unterwegs auf Livebilder und Aufzeichnungen ist eine geeignete Internetverbindung erforderlich.',
  'faq-video-speicherdauer':
    'Die Speicherdauer richtet sich nach dem Einsatzzweck und den geltenden Datenschutzanforderungen. Die technischen Einstellungen stimmen wir darauf ab.',
  'faq-video-erweitern':
    'Bei Anlagen, die wir selbst geliefert und installiert haben, prüfen wir gerne die Erweiterungsmöglichkeiten. Die Betreuung von Fremdanlagen gehört nicht zu unserem Leistungsangebot.',

  // FAQ Einbruchmeldeanlagen (Notstromakku betrifft die Alarmzentrale)
  'faq-ema-stromausfall':
    'Die Alarmzentrale verfügt über einen Notstromakku, der den Betrieb bei einem Stromausfall für eine begrenzte Zeit aufrechterhält. Die Überbrückungsdauer hängt vom System und dessen Ausstattung ab.',
  'faq-ema-erweitern':
    'Mögliche Erweiterungen berücksichtigen wir bereits bei der Planung. Welche zusätzlichen Melder und Funktionen später ergänzt werden können, hängt vom gewählten System und dessen Ausbau ab.',
};

// Kundenkategorien im Laufband auf /referenzen. `projekt` verweist auf den
// Projekteintrag im Dialog (id="projekt-<projekt>"). Alle Bilder sind
// KI-generierte Symbolbilder.
export const referenzKategorien = [
  { projekt: 'klinik', bild: 'branche-klinik.jpg', alt: 'Beleuchteter Eingangsbereich eines Klinikgebäudes am Abend (KI-generiertes Symbolbild)', titel: 'Krankenhäuser und Kliniken', technik: 'Videoüberwachung und Alarmtechnik' },
  { projekt: 'praxen', bild: 'branche-praxen.jpg', alt: 'Heller Empfangsbereich einer modernen Arztpraxis (KI-generiertes Symbolbild)', titel: 'Ärzte und Praxen', technik: 'Videoüberwachung und Alarmtechnik' },
  { projekt: 'waschstrasse', bild: 'branche-waschstrasse.jpg', alt: 'Auto in einer Waschstraße mit blauen Bürsten (KI-generiertes Symbolbild)', titel: 'Waschstraßen und Fahrzeugpflege', technik: 'Videoüberwachung und Alarmtechnik' },
  { projekt: 'schiesssport', bild: 'branche-schiesssport.jpg', alt: 'Schießstand mit Zielscheiben in einer Halle (KI-generiertes Symbolbild)', titel: 'Schießsportvereine', technik: 'Videoüberwachung' },
  { projekt: 'fussball', bild: 'branche-fussball.jpg', alt: 'Fußballplatz mit Tor im Abendlicht (KI-generiertes Symbolbild)', titel: 'Fußballvereine', technik: 'Videoüberwachung' },
  { projekt: 'entsorgung', bild: 'branche-entsorgung.jpg', alt: 'Schrottplatz mit Greifbagger und Containern (KI-generiertes Symbolbild)', titel: 'Entsorgung und Metallrecycling', technik: 'Videoüberwachung' },
  { projekt: 'privatkunden', bild: 'branche-privatkunden.jpg', alt: 'Modernes Einfamilienhaus mit beleuchteter Fassade am Abend (KI-generiertes Symbolbild)', titel: 'Privatkunden', technik: 'Videoüberwachung und Alarmtechnik' },
  { projekt: 'kfz', bild: 'branche-kfz-werkstatt.jpg', alt: 'Kfz-Werkstatt mit Fahrzeugen auf Hebebühnen (KI-generiertes Symbolbild)', titel: 'Kfz-Werkstätten und Lackierereien', technik: 'Videoüberwachung und Alarmtechnik' },
  { projekt: 'lebensmittel', bild: 'branche-lebensmittelhandel.jpg', alt: 'Hochregallager eines Lebensmittelgroßhandels (KI-generiertes Symbolbild)', titel: 'Lebensmittelgroßhandel', technik: 'Videoüberwachung' },
];
