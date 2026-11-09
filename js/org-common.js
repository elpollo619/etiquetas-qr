// Gemeinsame Bausteine für «Lager organisieren», Kategorien, Suche und Formulare (vom Lead geschrieben).
// Nur benutzen; Erweiterungen bitte mit dem Lead absprechen.
import { t, registerStrings } from './i18n.js';
import { esc } from './util.js';

registerStrings({
  de: {
    'org.status.nicht_erfasst': 'Nicht erfasst', 'org.status.fotos_vorhanden': 'Fotos vorhanden', 'org.status.in_analyse': 'In Analyse',
    'site.noRooms': 'An dieser Adresse sind noch keine Räume erfasst.', 'site.label': 'Adresse', 'site.none': '– ohne Adresse –', 'site.noneGroup': 'Ohne Adresse', 'site.all': 'Alle Adressen',
    'site.hint': 'Nur für Räume (oberste Ebene). Gruppiert nach Gebäude – steht nicht im Code.',
    'site.manage': 'Adressen', 'site.add': 'Adresse hinzufügen', 'site.edit': 'Adresse bearbeiten', 'site.name': 'Bezeichnung',
    'site.namePh': 'z. B. Lager Nord', 'site.address': 'Strasse, PLZ Ort', 'site.addressPh': 'z. B. Musterweg 8, 3000 Bern', 'site.sort': 'Reihenfolge',
    'site.notes': 'Notiz', 'site.counts': 'Räume: {s} · Pläne: {p}', 'site.saved': 'Adresse gespeichert', 'site.deleted': 'Adresse gelöscht',
    'site.deleteQ': 'Adresse löschen?', 'site.deleteMsg': 'Die Adresse «{name}» wird gelöscht. Das geht nur, wenn ihr kein Raum und kein Plan mehr zugeordnet ist.',
    'site.inUse': 'Dieser Adresse sind noch Räume oder Pläne zugeordnet.', 'site.none.list': 'Noch keine Adressen. Lege für jedes Gebäude (Büro, Lager …) eine Adresse an.',
    'site.intro': 'Adressen sind eure Gebäude (Büro, Lager …). Sie gruppieren Räume und Gebäudepläne; der Code auf der Etikette bleibt kurz (z. B. G1-RG01).',
    'org.status.zu_pruefen': 'Zu prüfen', 'org.status.in_organisation': 'In Organisation', 'org.status.organisiert': 'Organisiert',
    'org.conf.sicher': 'Sicher erkannt', 'org.conf.wahrscheinlich': 'Wahrscheinlich erkannt', 'org.conf.unbekannt': 'Unbekannt',
    'org.det.offen': 'Zu prüfen', 'org.det.bestaetigt': 'Bestätigt', 'org.det.zusammengefuehrt': 'Zusammengeführt',
    'org.det.abgelehnt': 'Abgelehnt', 'org.det.spaeter': 'Später prüfen',
    'org.kind.einzelinventar': 'Einzelinventar', 'org.kind.bestandsartikel': 'Bestandsartikel', 'org.kind.set': 'Set',
    'org.kind.einrichtung': 'Lagerort / Einrichtung', 'org.kind.unbekannt': 'Unbekannt',
    'org.kindHint.einzelinventar': 'Einzelnes Gerät mit eigener Identität und eigenem QR (z. B. Bohrmaschine, Monitor).',
    'org.kindHint.bestandsartikel': 'Material, das nach Menge geführt wird (z. B. Schrauben, Kabel, Papier).',
    'org.kindHint.set': 'Zusammengehörige Teile mit Komponentenliste (z. B. Koffer, Bohrmaschine mit Akkus).',
    'org.kindHint.einrichtung': 'Regal, Schrank, Box … – wird als Lagerort angelegt.',
    'org.photo.neu': 'Neu', 'org.photo.in_analyse': 'Zur Analyse vorgemerkt', 'org.photo.analysiert': 'Analysiert', 'org.photo.fehler': 'Analyse fehlgeschlagen',
    'org.task.offen': 'Offen', 'org.task.erledigt': 'Erledigt', 'org.task.verworfen': 'Verworfen',
    'org.src.manuell': 'Von Hand', 'org.src.foto_analyse': 'Aus Fotoanalyse', 'org.src.regel': 'Aus den Daten abgeleitet', 'org.src.ki': 'KI-Fotoanalyse',
    'org.noCategory': '– ohne Kategorie –',
  },
  pt: {
    'org.status.nicht_erfasst': 'Não registado', 'org.status.fotos_vorhanden': 'Fotos disponíveis', 'org.status.in_analyse': 'Em análise',
    'site.noRooms': 'Ainda não há espaços registados neste endereço.', 'site.label': 'Endereço', 'site.none': '– sem endereço –', 'site.noneGroup': 'Sem endereço', 'site.all': 'Todos os endereços',
    'site.hint': 'Só para espaços (nível superior). Agrupa por edifício – não entra no código.',
    'site.manage': 'Endereços', 'site.add': 'Adicionar endereço', 'site.edit': 'Editar endereço', 'site.name': 'Designação',
    'site.namePh': 'p. ex. Armazém Norte', 'site.address': 'Rua, código postal, localidade', 'site.addressPh': 'p. ex. Musterweg 8, 3000 Bern', 'site.sort': 'Ordem',
    'site.notes': 'Nota', 'site.counts': 'Espaços: {s} · Plantas: {p}', 'site.saved': 'Endereço guardado', 'site.deleted': 'Endereço eliminado',
    'site.deleteQ': 'Eliminar endereço?', 'site.deleteMsg': 'O endereço «{name}» é eliminado. Só é possível se já não tiver espaços nem plantas.',
    'site.inUse': 'Este endereço ainda tem espaços ou plantas.', 'site.none.list': 'Ainda não há endereços. Cria um para cada edifício (escritório, armazém …).',
    'site.intro': 'Os endereços são os vossos edifícios (escritório, armazéns …). Agrupam espaços e plantas; o código na etiqueta continua curto (p. ex. G1-RG01).',
    'org.status.zu_pruefen': 'Por verificar', 'org.status.in_organisation': 'Em organização', 'org.status.organisiert': 'Organizado',
    'org.conf.sicher': 'Reconhecido com certeza', 'org.conf.wahrscheinlich': 'Provavelmente reconhecido', 'org.conf.unbekannt': 'Desconhecido',
    'org.det.offen': 'Por verificar', 'org.det.bestaetigt': 'Confirmado', 'org.det.zusammengefuehrt': 'Fundido',
    'org.det.abgelehnt': 'Rejeitado', 'org.det.spaeter': 'Verificar mais tarde',
    'org.kind.einzelinventar': 'Artigo individual', 'org.kind.bestandsartikel': 'Material com stock', 'org.kind.set': 'Conjunto',
    'org.kind.einrichtung': 'Localização / mobiliário', 'org.kind.unbekannt': 'Desconhecido',
    'org.kindHint.einzelinventar': 'Equipamento com identidade e QR próprios (p. ex. berbequim, monitor).',
    'org.kindHint.bestandsartikel': 'Material gerido por quantidade (p. ex. parafusos, cabos, papel).',
    'org.kindHint.set': 'Peças que formam um conjunto com lista de componentes (p. ex. mala de ferramentas).',
    'org.kindHint.einrichtung': 'Estante, armário, caixa … – é criado como localização.',
    'org.photo.neu': 'Nova', 'org.photo.in_analyse': 'Marcada para análise', 'org.photo.analysiert': 'Analisada', 'org.photo.fehler': 'Análise falhou',
    'org.task.offen': 'Aberta', 'org.task.erledigt': 'Concluída', 'org.task.verworfen': 'Descartada',
    'org.src.manuell': 'Manual', 'org.src.foto_analyse': 'Da análise de fotos', 'org.src.regel': 'Derivado dos dados', 'org.src.ki': 'Análise de fotos por IA',
    'org.noCategory': '– sem categoria –',
  },
  es: {
    'org.status.nicht_erfasst': 'Sin registrar', 'org.status.fotos_vorhanden': 'Fotos disponibles', 'org.status.in_analyse': 'En análisis',
    'site.noRooms': 'Todavía no hay espacios registrados en esta dirección.', 'site.label': 'Dirección', 'site.none': '– sin dirección –', 'site.noneGroup': 'Sin dirección', 'site.all': 'Todas las direcciones',
    'site.hint': 'Solo para espacios (nivel superior). Agrupa por edificio – no entra en el código.',
    'site.manage': 'Direcciones', 'site.add': 'Añadir dirección', 'site.edit': 'Editar dirección', 'site.name': 'Nombre',
    'site.namePh': 'p. ej. Almacén Norte', 'site.address': 'Calle, código postal, localidad', 'site.addressPh': 'p. ej. Musterweg 8, 3000 Bern', 'site.sort': 'Orden',
    'site.notes': 'Nota', 'site.counts': 'Espacios: {s} · Planos: {p}', 'site.saved': 'Dirección guardada', 'site.deleted': 'Dirección eliminada',
    'site.deleteQ': '¿Eliminar dirección?', 'site.deleteMsg': 'Se elimina la dirección «{name}». Solo es posible si ya no tiene espacios ni planos.',
    'site.inUse': 'Esta dirección todavía tiene espacios o planos.', 'site.none.list': 'Todavía no hay direcciones. Crea una para cada edificio (oficina, almacén …).',
    'site.intro': 'Las direcciones son vuestros edificios (oficina, almacenes …). Agrupan espacios y planos; el código de la etiqueta sigue corto (p. ej. G1-RG01).',
    'org.status.zu_pruefen': 'Por revisar', 'org.status.in_organisation': 'En organización', 'org.status.organisiert': 'Organizado',
    'org.conf.sicher': 'Reconocido con seguridad', 'org.conf.wahrscheinlich': 'Probablemente reconocido', 'org.conf.unbekannt': 'Desconocido',
    'org.det.offen': 'Por revisar', 'org.det.bestaetigt': 'Confirmado', 'org.det.zusammengefuehrt': 'Fusionado',
    'org.det.abgelehnt': 'Rechazado', 'org.det.spaeter': 'Revisar más tarde',
    'org.kind.einzelinventar': 'Activo individual', 'org.kind.bestandsartikel': 'Material con stock', 'org.kind.set': 'Set',
    'org.kind.einrichtung': 'Ubicación / mobiliario', 'org.kind.unbekannt': 'Desconocido',
    'org.kindHint.einzelinventar': 'Equipo con identidad y QR propios (p. ej. taladro, monitor).',
    'org.kindHint.bestandsartikel': 'Material gestionado por cantidad (p. ej. tornillos, cables, papel).',
    'org.kindHint.set': 'Piezas que forman un conjunto con lista de componentes (p. ej. maletín).',
    'org.kindHint.einrichtung': 'Estantería, armario, caja … – se crea como ubicación.',
    'org.photo.neu': 'Nueva', 'org.photo.in_analyse': 'Marcada para análisis', 'org.photo.analysiert': 'Analizada', 'org.photo.fehler': 'Análisis fallido',
    'org.task.offen': 'Abierta', 'org.task.erledigt': 'Hecha', 'org.task.verworfen': 'Descartada',
    'org.src.manuell': 'Manual', 'org.src.foto_analyse': 'Del análisis de fotos', 'org.src.regel': 'Derivado de los datos', 'org.src.ki': 'Análisis de fotos con IA',
    'org.noCategory': '– sin categoría –',
  },
});

export const ORG_STATUSES = ['nicht_erfasst', 'fotos_vorhanden', 'in_analyse', 'zu_pruefen', 'in_organisation', 'organisiert'];
export const CONFIDENCES = ['sicher', 'wahrscheinlich', 'unbekannt'];
export const DETECTION_STATUSES = ['offen', 'spaeter', 'bestaetigt', 'zusammengefuehrt', 'abgelehnt'];
export const KINDS = ['einzelinventar', 'bestandsartikel', 'set', 'einrichtung', 'unbekannt'];
export const LOCATION_TYPES = ['lager', 'raum', 'bereich', 'regal', 'schrank', 'tablar', 'fach', 'schublade', 'box', 'behaelter',
  'werkzeugwand', 'halterung', 'arbeitsplatz', 'fahrzeug', 'container', 'temporaer'];

/** Vorschläge für Räume (Karten in «Lager organisieren»). Werden nur angelegt, wenn jemand sie auswählt. */
export const SPACE_PRESETS = [
  { name: 'Hauptlager', short: 'HL', type: 'lager' },
  { name: 'Werkstatt', short: 'WS', type: 'raum' },
  { name: 'Büro', short: 'BU', type: 'raum' },
  { name: 'IT-Raum', short: 'IT', type: 'raum' },
  { name: 'Archiv', short: 'AR', type: 'raum' },
  { name: 'Materialraum', short: 'MR', type: 'raum' },
  { name: 'Technikraum', short: 'TR', type: 'raum' },
  { name: 'Reinigungsraum', short: 'RR', type: 'raum' },
  { name: 'Fahrzeuge', short: 'FZ', type: 'fahrzeug' },
  { name: 'Container', short: 'CT', type: 'container' },
];

/** Kurzcode-Präfix je Lagerort-Typ (Konvention: HL-RG01-FA02-BX03). */
export const SHORT_PREFIX = {
  bereich: 'BE', regal: 'RG', schrank: 'SC', tablar: 'TB', fach: 'FA', schublade: 'SL', box: 'BX', behaelter: 'BH',
  werkzeugwand: 'W', halterung: 'HA', arbeitsplatz: 'AP', fahrzeug: 'FZ', container: 'CT', temporaer: 'TMP',
};

/** Nächster freier Kurzcode für einen neuen Unter-Lagerort (z. B. 'RG03'). siblings = Lagerorte mit gleichem parent_id. */
export function suggestShortCode(type, siblings = []) {
  const prefix = SHORT_PREFIX[type];
  if (!prefix) return '';
  const used = new Set(siblings.map((s) => s.short_code).filter(Boolean));
  for (let n = 1; n < 1000; n++) {
    const c = prefix + String(n).padStart(2, '0');
    if (!used.has(c)) return c;
  }
  return '';
}
export const normShortCode = (s) => String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);

export const orgStatusLabel = (s) => t('org.status.' + (s || 'nicht_erfasst'));
export function orgStatusPill(s) {
  const cls = { organisiert: 'pill-ok', in_organisation: 'pill-warn', zu_pruefen: 'pill-danger', in_analyse: 'pill-warn',
    fotos_vorhanden: 'pill-muted', nicht_erfasst: 'pill-muted' }[s] || 'pill-muted';
  return `<span class="pill ${cls}">${esc(orgStatusLabel(s))}</span>`;
}
export const confidenceLabel = (c) => t('org.conf.' + (c || 'unbekannt'));
export function confidencePill(c) {
  const cls = { sicher: 'pill-ok', wahrscheinlich: 'pill-warn', unbekannt: 'pill-danger' }[c] || 'pill-muted';
  return `<span class="pill ${cls}">${esc(confidenceLabel(c))}</span>`;
}
export const detectionStatusLabel = (s) => t('org.det.' + (s || 'offen'));
export const kindLabel = (k) => t('org.kind.' + (k || 'unbekannt'));
export const photoStatusLabel = (s) => t('org.photo.' + (s || 'neu'));
export const taskStatusLabel = (s) => t('org.task.' + (s || 'offen'));
export const sourceLabel = (s) => t('org.src.' + (s || 'manuell'));

/** Kategorien (Zeilen aus api.listCategories) als <option>-Liste mit Einrückung; nur nicht archivierte (ausser der gewählten). */
export function categoryOptionsHtml(categories, selectedId = null, { emptyLabel = t('org.noCategory') } = {}) {
  const rows = (categories || []).filter((c) => !c.archived || c.id === selectedId);
  return `<option value="">${esc(emptyLabel)}</option>` + rows.map((c) =>
    `<option value="${esc(c.id)}"${c.id === selectedId ? ' selected' : ''}>${'  '.repeat(c.depth || 0)}${esc(c.name)}</option>`).join('');
}
/** Kategorie-Pfad zu einer id (aus api.listCategories) */
export function categoryPathOf(categories, id) {
  const c = (categories || []).find((x) => x.id === id);
  return c ? c.path : null;
}
/** Alle Kategorie-ids unterhalb (inkl.) einer Kategorie – für Filter «Kategorie inkl. Unterkategorien». */
export function categorySubtreeIds(categories, id) {
  const out = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const c of categories || []) if (c.parent_id && out.has(c.parent_id) && !out.has(c.id)) { out.add(c.id); grew = true; }
  }
  return out;
}
/** Alle Lagerort-ids unterhalb (inkl.) eines Lagerorts (aus api.listLocations). */
export function locationSubtreeIds(locations, id) {
  const out = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const l of locations || []) if (l.parent_id && out.has(l.parent_id) && !out.has(l.id)) { out.add(l.id); grew = true; }
  }
  return out;
}
/** Anzeige-Code eines Lagerorts: lesbarer Code (HL-RG01) wenn vorhanden, sonst interner Code (L-0001). */
export const locationDisplayCode = (l) => (l && (l.code_path || l.code)) || '';

/** SHA-256 (hex) einer Datei/eines Blobs – identifiziert das Originalfoto (Doppelimport, KI-Ergebnis zuordnen). */
export async function sha256Hex(blob) {
  const buf = await blob.arrayBuffer();
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** <option>s für Standorte (Adressen); erster Eintrag = ohne Standort */
export function siteOptionsHtml(sites, selected) {
  return `<option value="">${esc(t('site.none'))}</option>` + (sites || []).map((s) => `<option value="${esc(s.id)}"${s.id === selected ? ' selected' : ''}>`
    + `${esc(s.name)}${s.address && s.address !== s.name ? ' – ' + esc(s.address) : ''}</option>`).join('');
}
