// Globale Suche über Einzelinventar (inkl. Sets), Bestandsartikel, Lagerorte und noch nicht geprüfte Fotofunde.
// Route: 'suche' – Query: ?q=<Text> &typ=<Typ> &kat=<Kategorie-id>|ohne &ort=<L-Code>|ohne &status=<Status> &arch=1
// Alle Wörter müssen vorkommen (UND); Gross/Klein und Akzente egal; ä = ae, ö = oe, ü = ue.
import { t, registerStrings, fmtQty, fmtNum, fmtElapsed } from '../i18n.js';
import { esc, clean, icon, errorText, toast, thumbHtml, hydrateThumbs, statusPill, debounce, parseScanned, routeForCode, locTypeLabel } from '../util.js';
import { categorySubtreeIds, locationSubtreeIds, locationDisplayCode, kindLabel, confidencePill, detectionStatusLabel } from '../org-common.js';

registerStrings({
  de: {
    'search.sub': 'Einzelinventar, Bestandsartikel, Lagerorte und Fotofunde – alles an einem Ort.',
    'search.label': 'Suchbegriff',
    'search.placeholder': 'Name, Marke, Modell, Seriennummer, Code, Person …',
    'search.clear': 'Suchbegriff löschen',
    'search.hint': 'Alle Wörter müssen vorkommen. Gross/Klein und Akzente sind egal (ä = ae). Enter öffnet den ersten Treffer.',
    'search.examples': 'Beispiele',
    'search.typeGroup': 'Nach Typ filtern',
    'search.type.alle': 'Alle',
    'search.type.einzelinventar': 'Einzelinventar',
    'search.type.set': 'Sets',
    'search.type.bestandsartikel': 'Bestandsartikel',
    'search.type.lagerort': 'Lagerorte',
    'search.type.fotofund': 'Fotofunde',
    'search.filters': 'Filter',
    'search.filtersActive': '{n} aktiv',
    'search.category': 'Kategorie (inkl. Unterkategorien)',
    'search.allCategories': 'Alle Kategorien',
    'search.noCategory': '– ohne Kategorie –',
    'search.location': 'Raum / Lagerort (inkl. Unterorte)',
    'search.allLocations': 'Alle Räume und Lagerorte',
    'search.noLocation': '– ohne Lagerort –',
    'search.status': 'Status',
    'search.allStatus': 'Alle Status',
    'search.overdue': 'Überfällig',
    'search.lowStock': 'Wenig Bestand',
    'search.archived': 'Archivierte einbeziehen',
    'search.reset': 'Filter zurücksetzen',
    'search.count0': 'Keine Treffer',
    'search.count1': '1 Treffer',
    'search.countN': '{n} Treffer',
    'search.scope': 'Durchsucht werden',
    'search.start': 'Tippe einen Begriff ein, wähle ein Beispiel oder einen Filter.',
    'search.noneFor': 'Nichts gefunden für «{q}».',
    'search.noneFiltered': 'Mit diesen Filtern gibt es keine Treffer.',
    'search.noneTip': 'Tipp: weniger oder kürzere Wörter verwenden, die Schreibweise prüfen oder die Filter zurücksetzen.',
    'search.showAll': 'Alle {n} anzeigen',
    'search.unverified': 'Fotofund, noch nicht geprüft',
    'search.nowAt': 'Aktuell bei {name} (seit {t})',
    'search.lastAt': 'Zuletzt: {name}',
    'search.responsible': 'Verantwortlich: {name}',
    'search.invNo': 'Inv.-Nr. {n}',
    'search.serial': 'SN {n}',
    'search.artNo': 'Art.-Nr. {n}',
    'search.withoutLocation': 'Ohne Lagerort',
    'search.set': 'Set',
    'search.components': '{n} Komponenten',
    'search.photoAt': 'Foto: {path}',
    'search.targetAt': 'Vorgeschlagener Lagerort: {path}',
    'search.read': 'Gelesen: {text}',
    'search.qtyUncertain': 'Menge unsicher',
    'search.matchIn': '{field}: {value}',
    'search.unknownFilter': 'Filter «{v}» nicht gefunden – er wird ignoriert.',
    'search.partialDetections': 'Fotofunde konnten nicht geladen werden – sie fehlen in den Ergebnissen.',
    'search.partialCategories': 'Kategorien konnten nicht geladen werden – der Kategorie-Filter ist nicht verfügbar.',
    'search.f.serial': 'Seriennummer',
    'search.f.invNo': 'Inventarnummer',
    'search.f.artNo': 'Referenz / Art.-Nr.',
    'search.f.responsible': 'Verantwortlich',
    'search.f.borrower': 'Aktueller Benutzer',
    'search.f.lastBorrower': 'Letzter Benutzer',
    'search.f.textRead': 'Gelesene Beschriftung',
    'search.f.labelText': 'Etikettentext',
    'search.f.conditionNote': 'Zustand',
    'search.f.size': 'Grösse',
    'search.f.color': 'Farbe',
    'search.f.usage': 'Verwendung',
    'search.f.type': 'Typ',
    'search.f.shortCode': 'Kurzcode',
    'search.f.photo': 'Foto',
    'search.f.target': 'Vorgeschlagener Lagerort',
  },
  pt: {
    'search.sub': 'Artigos individuais, material com stock, localizações e achados em fotos – tudo num só lugar.',
    'search.label': 'Termo de pesquisa',
    'search.placeholder': 'Nome, marca, modelo, n.º de série, código, pessoa …',
    'search.clear': 'Apagar termo de pesquisa',
    'search.hint': 'Todas as palavras têm de aparecer. Maiúsculas e acentos não importam (ä = ae). Enter abre o primeiro resultado.',
    'search.examples': 'Exemplos',
    'search.typeGroup': 'Filtrar por tipo',
    'search.type.alle': 'Todos',
    'search.type.einzelinventar': 'Artigos individuais',
    'search.type.set': 'Conjuntos',
    'search.type.bestandsartikel': 'Material com stock',
    'search.type.lagerort': 'Localizações',
    'search.type.fotofund': 'Achados em fotos',
    'search.filters': 'Filtros',
    'search.filtersActive': '{n} ativo(s)',
    'search.category': 'Categoria (incl. subcategorias)',
    'search.allCategories': 'Todas as categorias',
    'search.noCategory': '– sem categoria –',
    'search.location': 'Divisão / localização (incl. sublocalizações)',
    'search.allLocations': 'Todas as divisões e localizações',
    'search.noLocation': '– sem localização –',
    'search.status': 'Estado',
    'search.allStatus': 'Todos os estados',
    'search.overdue': 'Em atraso',
    'search.lowStock': 'Stock baixo',
    'search.archived': 'Incluir arquivados',
    'search.reset': 'Repor filtros',
    'search.count0': 'Sem resultados',
    'search.count1': '1 resultado',
    'search.countN': '{n} resultados',
    'search.scope': 'Pesquisa em',
    'search.start': 'Escreve um termo, escolhe um exemplo ou um filtro.',
    'search.noneFor': 'Nada encontrado para «{q}».',
    'search.noneFiltered': 'Não há resultados com estes filtros.',
    'search.noneTip': 'Dica: usa menos palavras ou palavras mais curtas, verifica a ortografia ou repõe os filtros.',
    'search.showAll': 'Mostrar todos os {n}',
    'search.unverified': 'Achado em foto, ainda não verificado',
    'search.nowAt': 'Atualmente com {name} (há {t})',
    'search.lastAt': 'Último: {name}',
    'search.responsible': 'Responsável: {name}',
    'search.invNo': 'N.º inv. {n}',
    'search.serial': 'N.º série {n}',
    'search.artNo': 'Ref. {n}',
    'search.withoutLocation': 'Sem localização',
    'search.set': 'Conjunto',
    'search.components': '{n} componentes',
    'search.photoAt': 'Foto: {path}',
    'search.targetAt': 'Localização proposta: {path}',
    'search.read': 'Lido: {text}',
    'search.qtyUncertain': 'Quantidade incerta',
    'search.matchIn': '{field}: {value}',
    'search.unknownFilter': 'Filtro «{v}» não encontrado – é ignorado.',
    'search.partialDetections': 'Não foi possível carregar os achados em fotos – faltam nos resultados.',
    'search.partialCategories': 'Não foi possível carregar as categorias – o filtro de categoria não está disponível.',
    'search.f.serial': 'N.º de série',
    'search.f.invNo': 'N.º de inventário',
    'search.f.artNo': 'Referência',
    'search.f.responsible': 'Responsável',
    'search.f.borrower': 'Utilizador atual',
    'search.f.lastBorrower': 'Último utilizador',
    'search.f.textRead': 'Texto lido',
    'search.f.labelText': 'Texto da etiqueta',
    'search.f.conditionNote': 'Estado',
    'search.f.size': 'Tamanho',
    'search.f.color': 'Cor',
    'search.f.usage': 'Utilização',
    'search.f.type': 'Tipo',
    'search.f.shortCode': 'Código curto',
    'search.f.photo': 'Foto',
    'search.f.target': 'Localização proposta',
  },
  es: {
    'search.sub': 'Activos individuales, material con stock, ubicaciones y hallazgos en fotos: todo en un solo lugar.',
    'search.label': 'Término de búsqueda',
    'search.placeholder': 'Nombre, marca, modelo, n.º de serie, código, persona …',
    'search.clear': 'Borrar término de búsqueda',
    'search.hint': 'Deben aparecer todas las palabras. Mayúsculas y acentos dan igual (ä = ae). Enter abre el primer resultado.',
    'search.examples': 'Ejemplos',
    'search.typeGroup': 'Filtrar por tipo',
    'search.type.alle': 'Todos',
    'search.type.einzelinventar': 'Activos individuales',
    'search.type.set': 'Sets',
    'search.type.bestandsartikel': 'Material con stock',
    'search.type.lagerort': 'Ubicaciones',
    'search.type.fotofund': 'Hallazgos en fotos',
    'search.filters': 'Filtros',
    'search.filtersActive': '{n} activo(s)',
    'search.category': 'Categoría (incl. subcategorías)',
    'search.allCategories': 'Todas las categorías',
    'search.noCategory': '– sin categoría –',
    'search.location': 'Sala / ubicación (incl. sububicaciones)',
    'search.allLocations': 'Todas las salas y ubicaciones',
    'search.noLocation': '– sin ubicación –',
    'search.status': 'Estado',
    'search.allStatus': 'Todos los estados',
    'search.overdue': 'Con retraso',
    'search.lowStock': 'Stock bajo',
    'search.archived': 'Incluir archivados',
    'search.reset': 'Restablecer filtros',
    'search.count0': 'Sin resultados',
    'search.count1': '1 resultado',
    'search.countN': '{n} resultados',
    'search.scope': 'Se busca en',
    'search.start': 'Escribe un término, elige un ejemplo o un filtro.',
    'search.noneFor': 'No se encontró nada para «{q}».',
    'search.noneFiltered': 'No hay resultados con estos filtros.',
    'search.noneTip': 'Consejo: usa menos palabras o más cortas, revisa la ortografía o restablece los filtros.',
    'search.showAll': 'Mostrar los {n}',
    'search.unverified': 'Hallazgo en foto, aún sin revisar',
    'search.nowAt': 'Ahora lo tiene {name} (desde hace {t})',
    'search.lastAt': 'Último: {name}',
    'search.responsible': 'Responsable: {name}',
    'search.invNo': 'N.º inv. {n}',
    'search.serial': 'N.º serie {n}',
    'search.artNo': 'Ref. {n}',
    'search.withoutLocation': 'Sin ubicación',
    'search.set': 'Set',
    'search.components': '{n} componentes',
    'search.photoAt': 'Foto: {path}',
    'search.targetAt': 'Ubicación propuesta: {path}',
    'search.read': 'Leído: {text}',
    'search.qtyUncertain': 'Cantidad incierta',
    'search.matchIn': '{field}: {value}',
    'search.unknownFilter': 'Filtro «{v}» no encontrado: se ignora.',
    'search.partialDetections': 'No se pudieron cargar los hallazgos en fotos: faltan en los resultados.',
    'search.partialCategories': 'No se pudieron cargar las categorías: el filtro de categoría no está disponible.',
    'search.f.serial': 'N.º de serie',
    'search.f.invNo': 'N.º de inventario',
    'search.f.artNo': 'Referencia',
    'search.f.responsible': 'Responsable',
    'search.f.borrower': 'Usuario actual',
    'search.f.lastBorrower': 'Último usuario',
    'search.f.textRead': 'Texto leído',
    'search.f.labelText': 'Texto de la etiqueta',
    'search.f.conditionNote': 'Estado',
    'search.f.size': 'Tamaño',
    'search.f.color': 'Color',
    'search.f.usage': 'Uso',
    'search.f.type': 'Tipo',
    'search.f.shortCode': 'Código corto',
    'search.f.photo': 'Foto',
    'search.f.target': 'Ubicación propuesta',
  },
});

// ---------------------------------------------------------------------------
// Konstanten
// ---------------------------------------------------------------------------
const TYPES = ['einzelinventar', 'set', 'bestandsartikel', 'lagerort', 'fotofund'];
const MACHINE_STATUSES = ['verfuegbar', 'ausgeliehen', 'reserviert', 'wartung', 'defekt', 'verloren'];
const STATUSES = [...MACHINE_STATUSES, 'ueberfaellig', 'wenig', 'offen', 'spaeter'];
// Suchvorschläge; angezeigt werden nur jene, die in den echten Daten etwas finden.
const EXAMPLES = ['HDMI Kabel', 'Druckerpapier', 'Bosch', 'Akku', 'Laptop', 'Schrauben', 'Monitor', 'Verlängerungskabel'];
const CODE_RE = /^[a-z]{1,5}-?\d{1,8}$/;
const NONE = 'ohne';

// ---------------------------------------------------------------------------
// Normalisieren: klein, ä→ae ö→oe ü→ue, Akzente weg. Zusätzlich eine Variante ä→a (für «Muller» → «Müller»).
// ---------------------------------------------------------------------------
const stripMarks = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
function fold(s) {
  return stripMarks(String(s ?? '').toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss'));
}
function foldPlain(s) { return stripMarks(String(s ?? '').toLowerCase().replace(/ß/g, 'ss')); }
function foldBoth(s) {
  const a = fold(s), b = foldPlain(s);
  return a === b ? a : a + '\u0001' + b;
}
const compact = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function queryTerms(q) {
  const out = [];
  for (const raw of clean(q).split(' ')) {
    const w = raw.replace(/^[«»"'„“”‚‘’()[\]{}.,;:!?]+|[«»"'„“”‚‘’()[\]{}.,;:!?]+$/g, '');
    if (!w) continue;
    const f = fold(w);
    if (CODE_RE.test(f)) { out.push(f); continue; }
    for (const p of f.split(/[-_/]+/)) if (p) out.push(p);
  }
  return [...new Set(out)];
}

const asText = (v) => (Array.isArray(v) ? v.filter(Boolean).join(' · ') : (v ?? ''));
const shorten = (s, n = 70) => { const x = clean(s); return x.length > n ? x.slice(0, n - 1) + '…' : x; };
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

// ---------------------------------------------------------------------------
// Suchindex
// ---------------------------------------------------------------------------
function makeEntry(type, row, href, fields, extra) {
  const list = fields
    .map(([key, label, value]) => ({ key, label, value: clean(asText(value)) }))
    .filter((f) => f.value);
  for (const f of list) f.f = foldBoth(f.value);
  const codes = [row.code, row.code_path, row.short_code].filter(Boolean);
  const hay = list.map((f) => f.f).join('\n') + '\n' + codes.map(compact).join('\n');
  return Object.assign({
    type, row, href, fields: list, hay,
    nameF: foldBoth(row.name || ''),
    codesF: codes.map((c) => fold(c)),
  }, extra);
}

function buildIndex({ machines, articles, locations, detections }) {
  const spaceCode = new Map(locations.map((l) => [l.id, l.code]));
  const out = [];
  for (const m of machines) {
    out.push(makeEntry(m.is_set ? 'set' : 'einzelinventar', m, '#/' + routeForCode(m.code), [
      ['name', t('common.name'), m.name],
      ['code', t('common.code'), m.code],
      ['category', t('common.category'), m.category_path || m.category],
      ['category2', t('common.category'), m.category_path && m.category && !m.category_path.includes(m.category) ? m.category : ''],
      ['brand', t('common.brand'), m.brand],
      ['model', t('common.model'), m.model],
      ['serial', t('search.f.serial'), m.serial_no],
      ['invNo', t('search.f.invNo'), m.inventory_no],
      ['location', t('common.location'), [m.location_code_path, m.location_path].filter(Boolean).join(' ')],
      ['responsible', t('search.f.responsible'), m.responsible_name],
      ['borrower', t('search.f.borrower'), m.open_borrower_name],
      ['lastBorrower', t('search.f.lastBorrower'), m.last_borrower_name],
      ['status', t('common.status'), m.status ? t('status.' + m.status) : ''],
      ['conditionNote', t('search.f.conditionNote'), m.condition_note],
      ['notes', t('common.notes'), m.notes],
    ], { catId: m.category_id || null, locIds: [m.home_location_id || null] }));
  }
  for (const a of articles) {
    out.push(makeEntry('bestandsartikel', a, '#/' + routeForCode(a.code), [
      ['name', t('common.name'), a.name],
      ['code', t('common.code'), a.code],
      ['artNo', t('search.f.artNo'), a.art_no],
      ['category', t('common.category'), a.category_path || a.category],
      ['category2', t('common.category'), a.category_path && a.category && !a.category_path.includes(a.category) ? a.category : ''],
      ['brand', t('common.brand'), a.brand],
      ['model', t('common.model'), a.model],
      ['description', t('common.description'), a.description],
      ['size', t('search.f.size'), a.size],
      ['color', t('search.f.color'), a.color],
      ['usage', t('search.f.usage'), a.usage],
      ['labelText', t('search.f.labelText'), a.label_text],
      ['location', t('common.location'), [a.location_code_path, a.location_path].filter(Boolean).join(' ')],
      ['notes', t('common.notes'), a.notes],
    ], { catId: a.category_id || null, locIds: [a.location_id || null] }));
  }
  for (const l of locations) {
    out.push(makeEntry('lagerort', l, '#/' + routeForCode(l.code), [
      ['name', t('common.name'), l.name],
      ['code', t('common.code'), l.code],
      ['shortCode', t('search.f.shortCode'), l.code_path || l.short_code],
      ['path', t('common.location'), l.path],
      ['type', t('search.f.type'), l.type ? locTypeLabel(l.type) : ''],
      ['responsible', t('search.f.responsible'), l.responsible_name],
      ['notes', t('common.notes'), l.notes],
    ], { catId: null, locIds: [l.id] }));
  }
  for (const d of detections) {
    const sc = d.space_id ? spaceCode.get(d.space_id) : null;
    out.push(makeEntry('fotofund', d, '#/organisieren/pruefen' + (sc ? '?raum=' + encodeURIComponent(sc) : ''), [
      ['name', t('common.name'), d.name],
      ['category', t('common.category'), d.category_path || d.category_text],
      ['brand', t('common.brand'), d.brand],
      ['model', t('common.model'), d.model],
      ['serial', t('search.f.serial'), d.serial_no],
      ['textRead', t('search.f.textRead'), d.text_read],
      ['type', t('search.f.type'), kindLabel(d.kind)],
      ['photo', t('search.f.photo'), [d.photo_location_path, d.photo_file_name].filter(Boolean).join(' ')],
      ['target', t('search.f.target'), d.target_location_path],
      ['notes', t('common.notes'), d.notes],
    ], { catId: d.category_id || null, locIds: [d.photo_location_id || null, d.target_location_id || null] }));
  }
  return out;
}

function statusMatch(e, st) {
  if (!st) return true;
  const r = e.row;
  if (e.type === 'einzelinventar' || e.type === 'set') {
    if (st === 'ueberfaellig') return r.overdue === true;
    return MACHINE_STATUSES.includes(st) && r.status === st;
  }
  if (e.type === 'bestandsartikel') return st === 'wenig' && !!r.low_stock;
  if (e.type === 'fotofund') return (st === 'offen' || st === 'spaeter') && r.status === st;
  return false;
}

function scoreOf(e, terms, termRes) {
  let s = 0;
  terms.forEach((term, i) => {
    const ct = compact(term);
    if (e.codesF.some((c) => c === term || (ct && compact(c) === ct))) s += 100;
    else if (e.nameF.startsWith(term)) s += 12;
    else if (termRes[i].test(e.nameF)) s += 8;
    else if (e.nameF.includes(term)) s += 5;
    else s += 1;
  });
  if (e.row.archived) s -= 3;
  return s;
}

// Felder, die in der Karte ohnehin sichtbar sind – Treffer darin werden nicht extra erwähnt.
const SHOWN = {
  einzelinventar: ['name', 'code', 'brand', 'model', 'location', 'responsible', 'borrower', 'lastBorrower', 'invNo', 'status'],
  bestandsartikel: ['name', 'code', 'artNo', 'brand', 'model', 'location'],
  lagerort: ['name', 'code', 'shortCode', 'path', 'type', 'responsible'],
  fotofund: ['name', 'brand', 'model', 'type', 'photo', 'textRead'],
};
SHOWN.set = SHOWN.einzelinventar;

function matchedFields(e, terms) {
  const shown = SHOWN[e.type] || [];
  const out = [];
  for (const term of terms) {
    if (e.nameF.includes(term) || e.codesF.some((c) => c.includes(term))) continue;
    const f = e.fields.find((x) => x.f.includes(term));
    if (f && !shown.includes(f.key) && !out.includes(f)) out.push(f);
  }
  return out.slice(0, 2);
}

// ---------------------------------------------------------------------------
// Darstellung der Treffer
// ---------------------------------------------------------------------------
const dot = ' · ';
const joinParts = (parts) => parts.filter(Boolean).join(dot);
/** « · Teil · Teil» nach einem Code (leer, wenn keine Teile) – bereits maskiert */
const tailHtml = (parts) => { const s = joinParts(parts); return s ? esc(dot + s) : ''; };

function matchHtml(e, terms) {
  const m = matchedFields(e, terms);
  if (!m.length) return '';
  return `<span class="sr-match">${icon('search')}${m.map((f) =>
    esc(t('search.matchIn', { field: f.label, value: shorten(f.value) }))).join(dot)}</span>`;
}
function locLine(code, path) {
  if (!code && !path) return `<span class="li-sub sr-wrap sr-noloc">${icon('location')}${esc(t('search.withoutLocation'))}</span>`;
  return `<span class="li-sub sr-wrap">${icon('location')}${code ? `<span class="mono">${esc(code)}</span>` + (path ? dot : '') : ''}${esc(path || '')}</span>`;
}

function machineHtml(e, terms) {
  const m = e.row;
  const who = [];
  if (m.open_borrower_name) who.push(t('search.nowAt', { name: m.open_borrower_name, t: fmtElapsed(m.open_since) }));
  if (m.last_borrower_name) who.push(t('search.lastAt', { name: m.last_borrower_name }));
  if (m.responsible_name) who.push(t('search.responsible', { name: m.responsible_name }));
  if (m.inventory_no) who.push(t('search.invNo', { n: m.inventory_no }));
  const pills = [statusPill(m.status)];
  if (m.overdue) pills.push(`<span class="pill pill-danger">${esc(t('search.overdue'))}</span>`);
  if (m.is_set) pills.push(`<span class="pill pill-info">${esc(t('search.set'))}</span>`);
  const comps = m.is_set && num(m.component_count) ? t('search.components', { n: fmtNum(m.component_count) }) : '';
  if (m.archived) pills.push(`<span class="pill pill-muted">${esc(t('common.archived'))}</span>`);
  return `<a class="list-item sr-item" href="${esc(e.href)}">
    ${thumbHtml(m.photo_path, m.name, 'thumb', 'machine')}
    <span class="li-main">
      <span class="li-title">${esc(m.name)}</span>
      <span class="li-sub"><span class="mono">${esc(m.code)}</span>${tailHtml([comps, [m.brand, m.model].filter(Boolean).join(' '), m.category_path || m.category])}</span>
      ${locLine(m.location_code_path, m.location_path)}
      ${who.length ? `<span class="li-sub sr-wrap">${icon('user')}${esc(who.join(dot))}</span>` : ''}
      ${matchHtml(e, terms)}
    </span>
    <span class="li-end">${pills.join('')}</span>
  </a>`;
}

function articleHtml(e, terms) {
  const a = e.row;
  const stock = num(a.stock);
  const cls = stock <= 0 ? 'pill-danger' : a.low_stock ? 'pill-warn' : 'pill-ok';
  return `<a class="list-item sr-item" href="${esc(e.href)}">
    ${thumbHtml(a.photo_path, a.name, 'thumb', 'box')}
    <span class="li-main">
      <span class="li-title">${esc(a.name)}</span>
      <span class="li-sub"><span class="mono">${esc(a.code)}</span>${tailHtml([a.art_no ? t('search.artNo', { n: a.art_no }) : '',
        [a.brand, a.model].filter(Boolean).join(' '), a.category_path || a.category])}</span>
      ${locLine(a.location_code_path, a.location_path)}
      ${matchHtml(e, terms)}
    </span>
    <span class="li-end"><span class="pill ${cls}">${esc(fmtQty(a.stock, a.unit))}</span>
      ${a.low_stock ? `<span class="small">${esc(t('search.lowStock'))}</span>` : ''}
      ${a.archived ? `<span class="pill pill-muted">${esc(t('common.archived'))}</span>` : ''}</span>
  </a>`;
}

function locationHtml(e, terms) {
  const l = e.row;
  const disp = locationDisplayCode(l);
  return `<a class="list-item sr-item" href="${esc(e.href)}">
    ${thumbHtml(l.photo_path, l.name, 'thumb', 'location')}
    <span class="li-main">
      <span class="li-title">${esc(l.name)}</span>
      <span class="li-sub"><span class="mono">${esc(disp)}</span>${disp !== l.code ? ` <span class="mono">(${esc(l.code)})</span>` : ''}${l.type ? dot + esc(locTypeLabel(l.type)) : ''}</span>
      ${l.path && l.path !== l.name ? `<span class="li-sub sr-wrap">${icon('location')}${esc(l.path)}</span>` : ''}
      ${l.responsible_name ? `<span class="li-sub sr-wrap">${icon('user')}${esc(t('search.responsible', { name: l.responsible_name }))}</span>` : ''}
      ${matchHtml(e, terms)}
    </span>
    <span class="li-end">${l.archived ? `<span class="pill pill-muted">${esc(t('common.archived'))}</span>` : icon('chevron')}</span>
  </a>`;
}

function detectionHtml(e, terms) {
  const d = e.row;
  const qty = d.quantity !== null && d.quantity !== undefined && d.quantity !== ''
    ? fmtQty(d.quantity, d.unit) + (d.quantity_certain === false ? ` (${t('search.qtyUncertain')})` : '') : '';
  const read = clean(asText(d.text_read));
  return `<a class="list-item sr-item sr-unverified" href="${esc(e.href)}">
    ${thumbHtml(d.photo_path, d.name, 'thumb', 'image')}
    <span class="li-main">
      <span class="li-title">${esc(d.name || kindLabel(d.kind))}</span>
      <span class="sr-badge">${icon('alert')}${esc(t('search.unverified'))}${d.status === 'spaeter' ? dot + esc(detectionStatusLabel('spaeter')) : ''}</span>
      <span class="li-sub sr-wrap">${esc(joinParts([kindLabel(d.kind), [d.brand, d.model].filter(Boolean).join(' '), d.category_path || d.category_text, qty]))}</span>
      ${d.photo_location_path ? `<span class="li-sub sr-wrap">${icon('image')}${esc(t('search.photoAt', { path: d.photo_location_path }))}</span>` : ''}
      ${d.target_location_path ? `<span class="li-sub sr-wrap">${icon('location')}${esc(t('search.targetAt', { path: d.target_location_path }))}</span>` : ''}
      ${read ? `<span class="li-sub sr-wrap">${esc(t('search.read', { text: shorten(read, 90) }))}</span>` : ''}
      ${matchHtml(e, terms)}
    </span>
    <span class="li-end">${confidencePill(d.confidence)}</span>
  </a>`;
}

const RENDER = { einzelinventar: machineHtml, set: machineHtml, bestandsartikel: articleHtml, lagerort: locationHtml, fotofund: detectionHtml };

// ---------------------------------------------------------------------------
// Optionen der Filter
// ---------------------------------------------------------------------------
const indent = (depth) => '   '.repeat(Math.max(0, num(depth)));
function categoryOptions(categories, selected) {
  const rows = categories.filter((c) => !c.archived || c.id === selected);
  return `<option value="">${esc(t('search.allCategories'))}</option>
    <option value="${NONE}"${selected === NONE ? ' selected' : ''}>${esc(t('search.noCategory'))}</option>`
    + rows.map((c) => `<option value="${esc(c.id)}"${c.id === selected ? ' selected' : ''}>${esc(indent(c.depth) + c.name)}</option>`).join('');
}
function locationOptions(locations, selectedId, noneSelected) {
  return `<option value="">${esc(t('search.allLocations'))}</option>
    <option value="${NONE}"${noneSelected ? ' selected' : ''}>${esc(t('search.noLocation'))}</option>`
    + locations.map((l) => {
      const code = locationDisplayCode(l);
      return `<option value="${esc(l.code)}"${l.id === selectedId ? ' selected' : ''}>${esc(indent(l.depth) + l.name + (code ? ' (' + code + ')' : ''))}</option>`;
    }).join('');
}
function statusOptions(selected) {
  const o = (v, label) => `<option value="${v}"${v === selected ? ' selected' : ''}>${esc(label)}</option>`;
  return o('', t('search.allStatus'))
    + `<optgroup label="${esc(t('search.type.einzelinventar'))}">${MACHINE_STATUSES.map((s) => o(s, t('status.' + s))).join('')}${o('ueberfaellig', t('search.overdue'))}</optgroup>`
    + `<optgroup label="${esc(t('search.type.bestandsartikel'))}">${o('wenig', t('search.lowStock'))}</optgroup>`
    + `<optgroup label="${esc(t('search.type.fotofund'))}">${o('offen', detectionStatusLabel('offen'))}${o('spaeter', detectionStatusLabel('spaeter'))}</optgroup>`;
}

// ---------------------------------------------------------------------------
// Daten laden (Haupt-Listen sind nötig; Kategorien und Fotofunde sind optional)
// ---------------------------------------------------------------------------
const settle = (fn) => Promise.resolve().then(fn).then((v) => ({ ok: true, v: v || [] }), (err) => ({ ok: false, err }));
async function loadData(api, arch) {
  const [m, a, l, c, d] = await Promise.all([
    settle(() => api.listMachines({ includeArchived: arch })),
    settle(() => api.listArticles({ includeArchived: arch })),
    settle(() => api.listLocations({ includeArchived: arch })),
    settle(() => api.listCategories({ includeArchived: true })),
    settle(() => api.listDetections({ status: ['offen', 'spaeter'] })),
  ]);
  const main = [m, a, l];
  if (main.every((r) => !r.ok)) throw m.err;
  const failed = [m, a, l, c, d].filter((r) => !r.ok);
  if (failed.length) toast(errorText(failed[0].err), 'error');
  return {
    machines: m.ok ? m.v : [], articles: a.ok ? a.v : [], locations: l.ok ? l.v : [],
    categories: c.ok ? c.v : [], detections: d.ok ? d.v : [],
    partial: { categories: !c.ok, detections: !d.ok },
  };
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------
async function searchRoute(ctx) {
  const { el, api } = ctx;
  if (ctx.setTitle) ctx.setTitle(t('nav.search'));
  const qp = (k) => {
    const q = ctx.query;
    const v = q && (typeof q.get === 'function' ? q.get(k) : q[k]);
    return v === null || v === undefined ? '' : String(v);
  };
  const st = {
    q: qp('q'),
    typ: TYPES.includes(qp('typ')) ? qp('typ') : 'alle',
    kat: qp('kat'),
    ort: qp('ort'),
    status: STATUSES.includes(qp('status')) ? qp('status') : '',
    arch: qp('arch') === '1',
  };
  const expanded = new Set();
  let data = null;
  let index = [];
  let lastResults = [];

  el.innerHTML = `<div class="page search-page">
    <div class="page-head"><div><h1>${esc(t('nav.search'))}</h1><div class="sub">${esc(t('search.sub'))}</div></div></div>
    <form class="search-form" role="search" data-form autocomplete="off">
      <div class="searchbar search-big">
        ${icon('search')}
        <input type="search" id="sr-q" name="q" enterkeyhint="search" autocapitalize="off" spellcheck="false"
          aria-label="${esc(t('search.label'))}" aria-describedby="sr-hint" placeholder="${esc(t('search.placeholder'))}" value="${esc(st.q)}">
        <button type="button" class="icon-btn search-clear" data-clear aria-label="${esc(t('search.clear'))}" ${st.q ? '' : 'hidden'}>${icon('x')}</button>
      </div>
      <p class="hint" id="sr-hint">${esc(t('search.hint'))}</p>
    </form>
    <div class="chips sr-types" role="group" aria-label="${esc(t('search.typeGroup'))}" data-types></div>
    <details class="search-filters" data-filters>
      <summary><span>${icon('list')}${esc(t('search.filters'))}</span><span class="pill pill-info" data-factive hidden></span></summary>
      <div class="filters">
        <div class="field"><label for="sr-kat">${esc(t('search.category'))}</label><select id="sr-kat" data-f="kat"></select></div>
        <div class="field"><label for="sr-ort">${esc(t('search.location'))}</label><select id="sr-ort" data-f="ort"></select></div>
        <div class="field"><label for="sr-status">${esc(t('search.status'))}</label><select id="sr-status" data-f="status">${statusOptions(st.status)}</select></div>
        <div class="sr-filter-end">
          <label class="check"><input type="checkbox" data-f="arch" ${st.arch ? 'checked' : ''}>${esc(t('search.archived'))}</label>
          <button type="button" class="btn sm ghost" data-reset>${icon('x')}${esc(t('search.reset'))}</button>
        </div>
      </div>
    </details>
    <div data-notes></div>
    <p class="sr-count" role="status" aria-live="polite" data-count>${esc(t('common.loading'))}</p>
    <div class="sr-results" data-results></div>
  </div>`;

  const $ = (s) => el.querySelector(s);
  const input = $('#sr-q');
  const resultsEl = $('[data-results]');
  const countEl = $('[data-count]');
  try { input.focus({ preventScroll: true }); const n = input.value.length; input.setSelectionRange(n, n); } catch (e) { /* egal */ }

  // ----- Hilfen für Filter -----
  const catById = () => new Map((data ? data.categories : []).map((c) => [c.id, c]));
  function resolveOrt() {
    if (!st.ort || !data) return { id: null, none: false, unknown: false };
    if (st.ort.toLowerCase() === NONE) return { id: null, none: true, unknown: false };
    const v = st.ort.toUpperCase();
    const l = data.locations.find((x) => String(x.code || '').toUpperCase() === v || String(x.code_path || '').toUpperCase() === v);
    return l ? { id: l.id, none: false, unknown: false } : { id: null, none: false, unknown: true };
  }
  function resolveKat() {
    if (!st.kat || !data) return { id: null, none: false, unknown: false };
    if (st.kat.toLowerCase() === NONE) return { id: null, none: true, unknown: false };
    return catById().has(st.kat) ? { id: st.kat, none: false, unknown: false } : { id: null, none: false, unknown: true };
  }
  const activeFilterCount = () => {
    const o = resolveOrt(), k = resolveKat();
    return (o.id || o.none ? 1 : 0) + (k.id || k.none ? 1 : 0) + (st.status ? 1 : 0) + (st.arch ? 1 : 0);
  };

  // Nur solange diese Seite angezeigt wird (sonst würde ein verspäteter Aufruf die Adresse der nächsten Seite überschreiben)
  const active = () => el.isConnected && /^#\/suche(\?|$)/.test(location.hash || '#/suche');
  function syncUrl() {
    if (!active()) return;
    const p = new URLSearchParams();
    if (clean(st.q)) p.set('q', clean(st.q));
    if (st.typ !== 'alle') p.set('typ', st.typ);
    if (st.kat) p.set('kat', st.kat);
    if (st.ort) p.set('ort', st.ort);
    if (st.status) p.set('status', st.status);
    if (st.arch) p.set('arch', '1');
    const qs = p.toString();
    const target = '#/suche' + (qs ? '?' + qs : '');
    if (location.hash !== target) {
      try { history.replaceState(history.state, '', target); } catch (e) { /* egal */ }
    }
  }

  function fillFilterOptions() {
    const k = resolveKat(), o = resolveOrt();
    const katSel = $('#sr-kat');
    katSel.innerHTML = categoryOptions(data.categories, k.none ? NONE : k.id);
    katSel.disabled = data.partial.categories;
    $('#sr-ort').innerHTML = locationOptions(data.locations, o.id, o.none);
    $('#sr-status').value = st.status;
    const notes = [];
    if (st.kat && k.unknown) notes.push(t('search.unknownFilter', { v: st.kat }));
    if (st.ort && o.unknown) notes.push(t('search.unknownFilter', { v: st.ort }));
    if (data.partial.detections) notes.push(t('search.partialDetections'));
    if (data.partial.categories) notes.push(t('search.partialCategories'));
    $('[data-notes]').innerHTML = notes.map((n) => `<div class="alert warn" role="status">${icon('alert')}<div>${esc(n)}</div></div>`).join('');
    if (activeFilterCount() > 0) $('[data-filters]').open = true;
  }

  // ----- Suche ausführen -----
  function compute() {
    const terms = queryTerms(st.q);
    const termRes = terms.map((x) => new RegExp('(^|[^a-z0-9])' + escRe(x)));
    const k = resolveKat(), o = resolveOrt();
    const catSet = k.id ? categorySubtreeIds(data.categories, k.id) : null;
    const locSet = o.id ? locationSubtreeIds(data.locations, o.id) : null;
    const base = [];
    for (const e of index) {
      if (k.none && (e.type === 'lagerort' || e.catId)) continue;
      if (catSet && !(e.catId && catSet.has(e.catId))) continue;
      if (o.none && (!['einzelinventar', 'set', 'bestandsartikel'].includes(e.type) || e.locIds[0])) continue;
      if (locSet && !e.locIds.some((id) => id && locSet.has(id))) continue;
      if (!statusMatch(e, st.status)) continue;
      if (terms.length && !terms.every((x, i) => (x.length > 1 ? e.hay.includes(x) : termRes[i].test(e.hay)))) continue;
      base.push(e);
    }
    const scored = base.map((e) => ({ e, s: terms.length ? scoreOf(e, terms, termRes) : 0 }));
    scored.sort((a, b) => b.s - a.s || String(a.e.row.name || '').localeCompare(String(b.e.row.name || ''), undefined, { sensitivity: 'base', numeric: true }));
    return { terms, all: scored.map((x) => x.e) };
  }

  function typeChipsHtml(all) {
    const counts = { alle: all.length };
    for (const ty of TYPES) counts[ty] = 0;
    for (const e of all) counts[e.type]++;
    return ['alle', ...TYPES].map((ty) => `<button type="button" class="chip" data-typ="${ty}" aria-pressed="${st.typ === ty}">
      ${esc(t('search.type.' + ty))}<span class="chip-n">${esc(fmtNum(counts[ty]))}</span></button>`).join('');
  }

  function examplesHtml() {
    const chips = [];
    for (const ex of EXAMPLES) {
      const terms = queryTerms(ex);
      if (index.some((e) => terms.every((x) => e.hay.includes(x)))) chips.push(ex);
      if (chips.length >= 6) break;
    }
    // häufige Marken aus den echten Daten ergänzen
    const brands = new Map();
    for (const e of index) {
      const b = clean(e.row.brand);
      if (b && (e.type === 'einzelinventar' || e.type === 'set' || e.type === 'bestandsartikel')) brands.set(b, (brands.get(b) || 0) + 1);
    }
    [...brands.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).forEach(([b]) => {
      if (!chips.some((c) => fold(c) === fold(b))) chips.push(b);
    });
    if (!chips.length) return '';
    return `<section class="section" aria-labelledby="sr-ex-h"><h2 id="sr-ex-h">${esc(t('search.examples'))}</h2>
      <div class="chips sr-examples">${chips.slice(0, 8).map((c) => `<button type="button" class="chip" data-example="${esc(c)}">${icon('search')}${esc(c)}</button>`).join('')}</div></section>`;
  }

  function scopeHtml() {
    const c = { einzelinventar: 0, set: 0, bestandsartikel: 0, lagerort: 0, fotofund: 0 };
    for (const e of index) c[e.type]++;
    const parts = TYPES.filter((ty) => !(ty === 'fotofund' && data.partial.detections))
      .map((ty) => `${fmtNum(c[ty])} ${t('search.type.' + ty)}`);
    return `<p class="small muted sr-scope">${esc(t('search.scope'))}: ${esc(parts.join(dot))}</p>`;
  }

  function render() {
    if (!data) return;
    const { terms, all } = compute();
    $('[data-types]').innerHTML = typeChipsHtml(all);
    const fc = activeFilterCount();
    const fEl = $('[data-factive]');
    fEl.hidden = !fc;
    fEl.textContent = fc ? t('search.filtersActive', { n: fc }) : '';

    const results = st.typ === 'alle' ? all : all.filter((e) => e.type === st.typ);
    lastResults = results;
    const hasQuery = terms.length > 0;
    const hasFilter = st.typ !== 'alle' || fc > 0;

    if (!hasQuery && !hasFilter) {
      countEl.textContent = t('search.start');
      resultsEl.innerHTML = examplesHtml() + scopeHtml();
      lastResults = [];
      return;
    }
    countEl.textContent = results.length === 0 ? t('search.count0')
      : results.length === 1 ? t('search.count1') : t('search.countN', { n: fmtNum(results.length) });

    if (!results.length) {
      resultsEl.innerHTML = `<div class="empty">${icon('search')}
        <p><b>${esc(hasQuery ? t('search.noneFor', { q: clean(st.q) }) : t('search.noneFiltered'))}</b></p>
        <p class="small">${esc(t('search.noneTip'))}</p>
        ${hasFilter ? `<button type="button" class="btn" data-reset>${icon('x')}${esc(t('search.reset'))}</button>` : ''}
      </div>${scopeHtml()}`;
      return;
    }

    const limit = groupLimit();
    const groups = TYPES.map((ty) => ({ ty, list: results.filter((e) => e.type === ty) })).filter((g) => g.list.length);
    resultsEl.innerHTML = groups.map((g) => {
      const open = expanded.has(g.ty);
      const shown = open ? g.list : g.list.slice(0, limit);
      return `<section class="section sr-group" aria-labelledby="sr-g-${g.ty}">
        <div class="section-head"><h2 id="sr-g-${g.ty}">${esc(t('search.type.' + g.ty))} <span class="sr-gcount">${esc(fmtNum(g.list.length))}</span></h2></div>
        <div class="list">${shown.map((e) => RENDER[e.type](e, terms)).join('')}</div>
        ${shown.length < g.list.length ? `<button type="button" class="btn ghost sr-more" data-more="${g.ty}">${icon('chevron')}${esc(t('search.showAll', { n: fmtNum(g.list.length) }))}</button>` : ''}
      </section>`;
    }).join('') + scopeHtml();
    hydrateThumbs(resultsEl, api);
  }

  function groupLimit() { return st.typ === 'alle' ? 15 : 60; }
  let leaving = false;   // nach Enter → Treffer geöffnet: verspätete Aktualisierungen ignorieren
  const runSoon = debounce(() => { if (leaving || !active()) return; expanded.clear(); render(); syncUrl(); }, 160);

  // ----- Ereignisse -----
  input.addEventListener('input', () => {
    st.q = input.value;
    $('[data-clear]').hidden = !input.value;
    runSoon();
  });
  input.addEventListener('keydown', (ev) => {
    if (ev.key === 'ArrowDown') {
      const first = resultsEl.querySelector('a.list-item, button');
      if (first) { ev.preventDefault(); first.focus(); }
    }
  });
  $('[data-clear]').addEventListener('click', () => {
    input.value = ''; st.q = '';
    $('[data-clear]').hidden = true;
    expanded.clear(); render(); syncUrl();
    input.focus();
  });
  $('[data-form]').addEventListener('submit', (ev) => {
    ev.preventDefault();
    st.q = input.value;
    // QR-Link (z. B. Handscanner) oder bekannter Code → direkt öffnen
    const raw = clean(input.value);
    const code = parseScanned(raw);
    const isUrl = /^https?:\/\//i.test(raw);
    if (code && (isUrl || index.some((e) => e.type !== 'fotofund' && String(e.row.code || '').toUpperCase() === code))) {
      leaving = true;
      ctx.go(routeForCode(code));
      return;
    }
    if (!data) return;
    render(); syncUrl();
    const first = lastResults[0];
    if (first && clean(st.q)) { leaving = true; location.hash = first.href; }
  });

  el.addEventListener('click', (ev) => {
    const typ = ev.target.closest('[data-typ]');
    if (typ) { st.typ = typ.dataset.typ; expanded.clear(); render(); syncUrl(); return; }
    const ex = ev.target.closest('[data-example]');
    if (ex) {
      input.value = ex.dataset.example; st.q = input.value;
      $('[data-clear]').hidden = false;
      render(); syncUrl();
      input.focus();
      return;
    }
    const more = ev.target.closest('[data-more]');
    if (more) {
      const ty = more.dataset.more;
      const limit = groupLimit();
      expanded.add(ty);
      render();
      // Fokus auf den ersten neu sichtbaren Treffer (Tastatur/Screenreader)
      const grp = resultsEl.querySelector(`#sr-g-${ty}`);
      const links = grp ? grp.closest('.sr-group').querySelectorAll('a.list-item') : [];
      if (links[limit]) links[limit].focus();
      return;
    }
    if (ev.target.closest('[data-reset]')) {
      st.typ = 'alle'; st.kat = ''; st.ort = ''; st.status = '';
      const hadArch = st.arch;
      st.arch = false;
      $('[data-f="arch"]').checked = false;
      if (hadArch) { reloadData(); } else { fillFilterOptions(); render(); }
      syncUrl();
    }
  });

  el.querySelectorAll('select[data-f]').forEach((sel) => sel.addEventListener('change', () => {
    st[sel.dataset.f] = sel.value;
    expanded.clear(); render(); syncUrl();
  }));
  $('[data-f="arch"]').addEventListener('change', (ev) => {
    st.arch = ev.target.checked;
    syncUrl();
    reloadData();
  });

  async function reloadData() {
    countEl.textContent = t('common.loading');
    try {
      data = await loadData(api, st.arch);
    } catch (err) {
      if (!el.isConnected) return;
      toast(errorText(err), 'error');
      countEl.textContent = '';
      resultsEl.innerHTML = `<div class="alert danger" role="alert">${icon('alert')}<div>${esc(errorText(err))}
        <div style="margin-top:8px"><button type="button" class="btn sm" data-retry>${icon('history')}${esc(t('btn.retry'))}</button></div></div></div>`;
      resultsEl.querySelector('[data-retry]').addEventListener('click', () => reloadData());
      return;
    }
    if (!el.isConnected) return;
    index = buildIndex(data);
    st.q = input.value;   // während des Ladens Getipptes übernehmen
    fillFilterOptions();
    render();
    syncUrl();
  }

  await reloadData();
}

export const routes = {
  'suche': searchRoute,
};
