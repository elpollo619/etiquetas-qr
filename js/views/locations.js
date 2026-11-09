// Ansicht «Lagerorte» (hierarchisch: Hauptlager → Regal A → Fach 02 → Box 03):
//   'lagerorte'            Baum mit Suche, Zählern und «Unterort hinzufügen»
//   'l/:code'              Lagerort nach dem Scannen: Pfad, Unterorte, Maschinen und Artikel darin (inkl. Unterorte)
//   'lagerorte/neu'        Formular (neu, optional ?parent=ID)
//   'l/:code/bearbeiten'   Formular (bearbeiten)
import { t, registerStrings, fmtQty, locale } from '../i18n.js';
import {
  esc, clean, debounce, can, toast, sheet, confirmSheet, errorText, emptyHtml, thumbHtml, hydrateThumbs,
  statusPill, locTypeLabel, formData, icon, openLightbox,
} from '../util.js';
import * as media from '../media.js';
import * as labels from '../labels.js';
import { LOCATION_TYPES, SPACE_PRESETS, suggestShortCode, normShortCode, siteOptionsHtml } from '../org-common.js';

// ---------------------------------------------------------------------------
// Texte
// ---------------------------------------------------------------------------
registerStrings({
  de: {
    'locations.title': 'Lagerorte',
    'locations.new': 'Neuer Lagerort',
    'locations.addChild': 'Unterort hinzufügen',
    'locations.addChildTo': 'Unterort zu «{name}» hinzufügen',
    'locations.searchLabel': 'Lagerorte suchen',
    'locations.searchPh': 'Name, Code oder Pfad…',
    'locations.expandAll': 'Alle aufklappen',
    'locations.collapseAll': 'Alle zuklappen',
    'locations.toggle': 'Unterorte von «{name}» ein- oder ausblenden',
    'locations.count1': '1 Lagerort',
    'locations.countN': '{n} Lagerorte',
    'locations.articles1': '1 Artikel',
    'locations.articlesN': '{n} Artikel',
    'locations.machines1': '1 Maschine',
    'locations.machinesN': '{n} Maschinen',
    'locations.subs1': '1 Unterort',
    'locations.subsN': '{n} Unterorte',
    'locations.emptyTree': 'Noch keine Lagerorte erfasst.',
    'locations.noMatch': 'Keine Lagerorte gefunden.',
    'locations.notFound': 'Lagerort {code} wurde nicht gefunden.',
    'locations.toList': 'Zu den Lagerorten',
    'locations.path': 'Pfad',
    'locations.archivedNote': 'Dieser Lagerort ist archiviert.',
    'locations.children': 'Unterorte',
    'locations.machines': 'Maschinen',
    'locations.articles': 'Artikel',
    'locations.here': 'Direkt hier',
    'locations.atBorrower': 'bei {name}',
    'locations.low': 'Wenig',
    'locations.emptyPlace': 'Dieser Lagerort ist leer.',
    'locations.manage': 'Verwaltung',
    'locations.printLabel': 'Etikett drucken',
    'locations.labelsAll': 'Etiketten für alles darin',
    'locations.labelsNone': 'Hier drin gibt es nichts, wofür ein Etikett gedruckt werden kann.',
    'locations.archiveQ': 'Lagerort archivieren?',
    'locations.archiveMsg': '«{name}» wird archiviert und in der Liste ausgeblendet. Unterorte, Artikel und Maschinen bleiben unverändert.',
    'locations.archivedToast': 'Lagerort archiviert.',
    'locations.unarchivedToast': 'Lagerort wiederhergestellt.',
    'locations.deleteQ': 'Lagerort endgültig löschen?',
    'locations.deleteMsg': '«{name}» wird endgültig gelöscht. Das kann nicht rückgängig gemacht werden.',
    'locations.deleted': 'Lagerort gelöscht.',
    'locations.inUseTitle': 'Löschen nicht möglich',
    'locations.inUseMsg': 'Dieser Lagerort wird noch verwendet: Er enthält Unterorte, Artikel oder Maschinen, oder er kommt in Bewegungen vor. Verschiebe zuerst den Inhalt – oder archiviere den Lagerort. Jetzt archivieren?',
    'locations.inUseArchived': 'Dieser Lagerort wird noch verwendet (Unterorte, Artikel, Maschinen oder Bewegungen) und kann deshalb nicht gelöscht werden.',
    'locations.newTitle': 'Neuer Lagerort',
    'locations.editTitle': 'Lagerort bearbeiten',
    'locations.f.name': 'Name',
    'locations.f.type': 'Typ',
    'locations.f.parent': 'Liegt in',
    'locations.f.noParent': '– oberste Ebene –',
    'locations.f.notes': 'Bemerkungen',
    'locations.f.code': 'Code',
    'locations.h.code': 'Leer lassen = automatisch (L-xxxx).',
    'locations.h.parent': 'Beispiel: Hauptlager → Regal A → Fach 02 → Box 03',
    'locations.namePh': 'z. B. Regal A',
    'locations.preview': 'Pfad: {path}',
    'locations.created': 'Lagerort {code} angelegt',
    'locations.printNow': 'Möchtest du jetzt das Etikett drucken?',
    'locations.later': 'Später',
    'locations.qrAlt': 'QR-Code für {code}',
    'locations.photoAlt': 'Foto von {name}',
    'locations.f.short': 'Kurzcode',
    'locations.h.short': 'Nur A–Z und 0–9, höchstens 10 Zeichen, eindeutig auf dieser Ebene. Konvention: Raum, Regal, Fach, Box – z. B. HL-RG01-FA02-BX03.',
    'locations.useSuggestion': 'Vorschlag {code} übernehmen',
    'locations.codePathPreview': 'Lesbarer Code: {code}',
    'locations.codePathMissing': 'Ein lesbarer Code entsteht erst, wenn dieser und alle übergeordneten Lagerorte einen Kurzcode haben.',
    'locations.qrHintEdit': 'Der interne Code {code} steht im QR-Etikett und ändert sich nie. Der Kurzcode darf sich ändern – gedruckte Etiketten bleiben gültig.',
    'locations.qrHintNew': 'Der interne Code (L-xxxx) steht im QR-Etikett und ändert sich nie. Der Kurzcode darf sich später ändern.',
    'locations.shortDuplicate': 'Den Kurzcode «{code}» gibt es auf dieser Ebene bereits (bei «{name}»). Bitte einen anderen wählen, z. B. «{suggest}».',
    'locations.shortDuplicateNoSug': 'Den Kurzcode «{code}» gibt es auf dieser Ebene bereits. Bitte einen anderen wählen.',
    'locations.f.responsible': 'Verantwortlich',
    'locations.noResponsible': '– niemand –',
    'locations.codePath': 'Lesbarer Code',
    'locations.internalCode': 'Interner Code (QR)',
    'locations.codeExplain': 'Der interne Code steht im QR-Etikett und bleibt immer gleich. Der lesbare Code setzt sich aus den Kurzcodes aller Ebenen zusammen und darf sich ändern.',
    'locations.openVisual': 'Visuell öffnen',
    'locations.inventory': 'Inventur für diesen Ort',
  },
  pt: {
    'locations.title': 'Localizações',
    'locations.new': 'Nova localização',
    'locations.addChild': 'Adicionar sublocalização',
    'locations.addChildTo': 'Adicionar sublocalização a «{name}»',
    'locations.searchLabel': 'Pesquisar localizações',
    'locations.searchPh': 'Nome, código ou caminho…',
    'locations.expandAll': 'Expandir tudo',
    'locations.collapseAll': 'Recolher tudo',
    'locations.toggle': 'Mostrar ou ocultar as sublocalizações de «{name}»',
    'locations.count1': '1 localização',
    'locations.countN': '{n} localizações',
    'locations.articles1': '1 artigo',
    'locations.articlesN': '{n} artigos',
    'locations.machines1': '1 máquina',
    'locations.machinesN': '{n} máquinas',
    'locations.subs1': '1 sublocalização',
    'locations.subsN': '{n} sublocalizações',
    'locations.emptyTree': 'Ainda não há localizações registadas.',
    'locations.noMatch': 'Nenhuma localização encontrada.',
    'locations.notFound': 'A localização {code} não foi encontrada.',
    'locations.toList': 'Ir para as localizações',
    'locations.path': 'Caminho',
    'locations.archivedNote': 'Esta localização está arquivada.',
    'locations.children': 'Sublocalizações',
    'locations.machines': 'Máquinas',
    'locations.articles': 'Artigos',
    'locations.here': 'Diretamente aqui',
    'locations.atBorrower': 'com {name}',
    'locations.low': 'Baixo',
    'locations.emptyPlace': 'Esta localização está vazia.',
    'locations.manage': 'Gestão',
    'locations.printLabel': 'Imprimir etiqueta',
    'locations.labelsAll': 'Etiquetas para tudo o que está dentro',
    'locations.labelsNone': 'Aqui dentro não há nada para etiquetar.',
    'locations.archiveQ': 'Arquivar a localização?',
    'locations.archiveMsg': '«{name}» é arquivada e deixa de aparecer na lista. As sublocalizações, os artigos e as máquinas não são alterados.',
    'locations.archivedToast': 'Localização arquivada.',
    'locations.unarchivedToast': 'Localização restaurada.',
    'locations.deleteQ': 'Eliminar a localização definitivamente?',
    'locations.deleteMsg': '«{name}» é eliminada definitivamente. Esta ação não pode ser anulada.',
    'locations.deleted': 'Localização eliminada.',
    'locations.inUseTitle': 'Não é possível eliminar',
    'locations.inUseMsg': 'Esta localização ainda está a ser usada: contém sublocalizações, artigos ou máquinas, ou aparece em movimentos. Muda primeiro o conteúdo de sítio – ou arquiva a localização. Arquivar agora?',
    'locations.inUseArchived': 'Esta localização ainda está a ser usada (sublocalizações, artigos, máquinas ou movimentos), por isso não pode ser eliminada.',
    'locations.newTitle': 'Nova localização',
    'locations.editTitle': 'Editar localização',
    'locations.f.name': 'Nome',
    'locations.f.type': 'Tipo',
    'locations.f.parent': 'Fica dentro de',
    'locations.f.noParent': '– nível superior –',
    'locations.f.notes': 'Observações',
    'locations.f.code': 'Código',
    'locations.h.code': 'Deixa em branco = automático (L-xxxx).',
    'locations.h.parent': 'Exemplo: Armazém principal → Estante A → Compartimento 02 → Caixa 03',
    'locations.namePh': 'p. ex. Estante A',
    'locations.preview': 'Caminho: {path}',
    'locations.created': 'Localização {code} criada',
    'locations.printNow': 'Queres imprimir a etiqueta agora?',
    'locations.later': 'Mais tarde',
    'locations.qrAlt': 'Código QR de {code}',
    'locations.photoAlt': 'Foto de {name}',
    'locations.f.short': 'Código curto',
    'locations.h.short': 'Só A–Z e 0–9, no máximo 10 caracteres, único neste nível. Convenção: divisão, estante, compartimento, caixa – p. ex. HL-RG01-FA02-BX03.',
    'locations.useSuggestion': 'Usar a sugestão {code}',
    'locations.codePathPreview': 'Código legível: {code}',
    'locations.codePathMissing': 'O código legível só existe quando esta e todas as localizações superiores têm código curto.',
    'locations.qrHintEdit': 'O código interno {code} está na etiqueta QR e nunca muda. O código curto pode mudar – as etiquetas impressas continuam válidas.',
    'locations.qrHintNew': 'O código interno (L-xxxx) está na etiqueta QR e nunca muda. O código curto pode ser alterado mais tarde.',
    'locations.shortDuplicate': 'O código curto «{code}» já existe neste nível (em «{name}»). Escolhe outro, p. ex. «{suggest}».',
    'locations.shortDuplicateNoSug': 'O código curto «{code}» já existe neste nível. Escolhe outro.',
    'locations.f.responsible': 'Responsável',
    'locations.noResponsible': '– ninguém –',
    'locations.codePath': 'Código legível',
    'locations.internalCode': 'Código interno (QR)',
    'locations.codeExplain': 'O código interno está na etiqueta QR e nunca muda. O código legível é composto pelos códigos curtos de todos os níveis e pode mudar.',
    'locations.openVisual': 'Abrir visualmente',
    'locations.inventory': 'Inventário deste local',
  },
  es: {
    'locations.title': 'Ubicaciones',
    'locations.new': 'Nueva ubicación',
    'locations.addChild': 'Añadir sububicación',
    'locations.addChildTo': 'Añadir sububicación a «{name}»',
    'locations.searchLabel': 'Buscar ubicaciones',
    'locations.searchPh': 'Nombre, código o ruta…',
    'locations.expandAll': 'Desplegar todo',
    'locations.collapseAll': 'Plegar todo',
    'locations.toggle': 'Mostrar u ocultar las sububicaciones de «{name}»',
    'locations.count1': '1 ubicación',
    'locations.countN': '{n} ubicaciones',
    'locations.articles1': '1 artículo',
    'locations.articlesN': '{n} artículos',
    'locations.machines1': '1 máquina',
    'locations.machinesN': '{n} máquinas',
    'locations.subs1': '1 sububicación',
    'locations.subsN': '{n} sububicaciones',
    'locations.emptyTree': 'Todavía no hay ubicaciones.',
    'locations.noMatch': 'No se han encontrado ubicaciones.',
    'locations.notFound': 'No se ha encontrado la ubicación {code}.',
    'locations.toList': 'Ir a las ubicaciones',
    'locations.path': 'Ruta',
    'locations.archivedNote': 'Esta ubicación está archivada.',
    'locations.children': 'Sububicaciones',
    'locations.machines': 'Máquinas',
    'locations.articles': 'Artículos',
    'locations.here': 'Directamente aquí',
    'locations.atBorrower': 'con {name}',
    'locations.low': 'Poco',
    'locations.emptyPlace': 'Esta ubicación está vacía.',
    'locations.manage': 'Gestión',
    'locations.printLabel': 'Imprimir etiqueta',
    'locations.labelsAll': 'Etiquetas para todo lo que contiene',
    'locations.labelsNone': 'Aquí dentro no hay nada que etiquetar.',
    'locations.archiveQ': '¿Archivar la ubicación?',
    'locations.archiveMsg': '«{name}» se archivará y dejará de aparecer en la lista. Las sububicaciones, los artículos y las máquinas no cambian.',
    'locations.archivedToast': 'Ubicación archivada.',
    'locations.unarchivedToast': 'Ubicación restaurada.',
    'locations.deleteQ': '¿Eliminar la ubicación definitivamente?',
    'locations.deleteMsg': '«{name}» se eliminará definitivamente. No se puede deshacer.',
    'locations.deleted': 'Ubicación eliminada.',
    'locations.inUseTitle': 'No se puede eliminar',
    'locations.inUseMsg': 'Esta ubicación todavía se usa: contiene sububicaciones, artículos o máquinas, o aparece en movimientos. Primero mueve el contenido o archiva la ubicación. ¿Archivarla ahora?',
    'locations.inUseArchived': 'Esta ubicación todavía se usa (sububicaciones, artículos, máquinas o movimientos), así que no se puede eliminar.',
    'locations.newTitle': 'Nueva ubicación',
    'locations.editTitle': 'Editar ubicación',
    'locations.f.name': 'Nombre',
    'locations.f.type': 'Tipo',
    'locations.f.parent': 'Está dentro de',
    'locations.f.noParent': '– nivel superior –',
    'locations.f.notes': 'Observaciones',
    'locations.f.code': 'Código',
    'locations.h.code': 'Déjalo vacío = automático (L-xxxx).',
    'locations.h.parent': 'Ejemplo: Almacén principal → Estantería A → Compartimento 02 → Caja 03',
    'locations.namePh': 'p. ej. Estantería A',
    'locations.preview': 'Ruta: {path}',
    'locations.created': 'Ubicación {code} creada',
    'locations.printNow': '¿Quieres imprimir la etiqueta ahora?',
    'locations.later': 'Más tarde',
    'locations.qrAlt': 'Código QR de {code}',
    'locations.photoAlt': 'Foto de {name}',
    'locations.f.short': 'Código corto',
    'locations.h.short': 'Solo A–Z y 0–9, máximo 10 caracteres, único en este nivel. Convención: sala, estantería, compartimento, caja – p. ej. HL-RG01-FA02-BX03.',
    'locations.useSuggestion': 'Usar la sugerencia {code}',
    'locations.codePathPreview': 'Código legible: {code}',
    'locations.codePathMissing': 'El código legible solo existe cuando esta y todas las ubicaciones superiores tienen código corto.',
    'locations.qrHintEdit': 'El código interno {code} está en la etiqueta QR y nunca cambia. El código corto puede cambiar: las etiquetas impresas siguen siendo válidas.',
    'locations.qrHintNew': 'El código interno (L-xxxx) está en la etiqueta QR y nunca cambia. El código corto se puede cambiar más tarde.',
    'locations.shortDuplicate': 'El código corto «{code}» ya existe en este nivel (en «{name}»). Elige otro, p. ej. «{suggest}».',
    'locations.shortDuplicateNoSug': 'El código corto «{code}» ya existe en este nivel. Elige otro.',
    'locations.f.responsible': 'Responsable',
    'locations.noResponsible': '– nadie –',
    'locations.codePath': 'Código legible',
    'locations.internalCode': 'Código interno (QR)',
    'locations.codeExplain': 'El código interno está en la etiqueta QR y nunca cambia. El código legible se compone de los códigos cortos de todos los niveles y puede cambiar.',
    'locations.openVisual': 'Abrir en vista visual',
    'locations.inventory': 'Inventario de este lugar',
  },
});

// ---------------------------------------------------------------------------
// Konstanten und private Hilfen
// ---------------------------------------------------------------------------
const TYPES = LOCATION_TYPES;
// Vorschlag für den Typ eines neuen Unterorts
const NEXT_TYPE = {
  lager: 'regal', raum: 'regal', bereich: 'regal', regal: 'fach', schrank: 'tablar', tablar: 'box', fach: 'box',
  schublade: 'box', box: 'box', behaelter: 'box', werkzeugwand: 'halterung', halterung: 'box', arbeitsplatz: 'schublade',
  fahrzeug: 'box', container: 'regal', temporaer: 'box',
};
const TYPE_ICON = {
  lager: 'home', raum: 'location', bereich: 'grid', regal: 'list', schrank: 'layers', tablar: 'list', fach: 'box',
  schublade: 'box', box: 'box', behaelter: 'box', werkzeugwand: 'wrench', halterung: 'wrench', arbeitsplatz: 'tree',
  fahrzeug: 'move', container: 'box', temporaer: 'clock',
};
const COLLAPSE_KEY = 'lgr-loc-collapsed';

const enc = encodeURIComponent;
const norm = (s) => clean(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const multi = (v) => { const s = String(v ?? '').replace(/\r\n?/g, '\n').trim(); return s === '' ? null : s; };
const plural = (base, n) => t(n === 1 ? base + '1' : base + 'N', { n });
const typeIcon = (ty) => icon(TYPE_ICON[ty] || 'location');
function cmp(a, b) {
  return new Intl.Collator(locale(), { numeric: true, sensitivity: 'base' }).compare(String(a ?? ''), String(b ?? ''));
}

function routeCode(ctx) {
  let c = (ctx.params && ctx.params.code) || '';
  try { c = decodeURIComponent(c); } catch (e) { /* bereits dekodiert */ }
  return clean(c).toUpperCase();
}
function queryParam(ctx, key) {
  const q = ctx.query;
  if (q) {
    if (typeof q.get === 'function') { const v = q.get(key); if (v !== null && v !== undefined) return v; }
    else if (q[key] !== undefined && q[key] !== null) return q[key];
  }
  try {
    const h = window.location.hash || '';
    const i = h.indexOf('?');
    if (i >= 0) return new URLSearchParams(h.slice(i + 1)).get(key);
  } catch (e) { /* egal */ }
  return null;
}

const loadingHtml = () => `<div class="page"><p class="muted" role="status">${esc(t('common.loading'))}</p></div>`;
function showError(ctx, err) {
  toast(errorText(err), 'error');
  ctx.el.innerHTML = `<div class="page">${emptyHtml(errorText(err),
    `<button type="button" class="btn" data-retry>${icon('history')}${esc(t('btn.retry'))}</button>`)}</div>`;
  const b = ctx.el.querySelector('[data-retry]');
  if (b) b.addEventListener('click', () => ctx.reload());
}
function showNotFound(ctx, code) {
  ctx.el.innerHTML = `<div class="page">${emptyHtml(t('locations.notFound', { code }),
    `<a class="btn" href="#/lagerorte">${icon('back')}${esc(t('locations.toList'))}</a>`)}</div>`;
}
function setErr(root, msg) {
  const b = root.querySelector('[data-err]');
  if (!b) return;
  b.textContent = msg || '';
  b.hidden = !msg;
}

function printLabels(makeItems) {
  try {
    const items = makeItems();
    if (!items.length) { toast(t('locations.labelsNone'), 'info'); return; }
    const r = labels.openLabelDialog(items);
    if (r && typeof r.catch === 'function') r.catch((err) => toast(errorText(err), 'error'));
  } catch (err) { toast(errorText(err), 'error'); }
}
async function fillQr(box, code) {
  try {
    if (typeof labels.ensureQrLib === 'function') await labels.ensureQrLib();
    const svg = await labels.qrSvg(labels.qrUrl(code), { margin: 1 });
    if (!svg) return;
    box.classList.remove('thumb-empty');
    box.style.background = '#fff';
    box.style.padding = '5px';
    box.innerHTML = svg;
    const s = box.querySelector('svg');
    if (s) { s.setAttribute('width', '100%'); s.setAttribute('height', '100%'); s.setAttribute('aria-hidden', 'true'); s.setAttribute('focusable', 'false'); }
  } catch (e) { /* QR ist nur Anzeige */ }
}
function mountMedia(container, opts) {
  try {
    if (!container || typeof media.mediaSection !== 'function') return;
    const r = media.mediaSection(container, opts);
    if (r && typeof r.catch === 'function') r.catch(() => { /* Fotos sind nicht kritisch */ });
  } catch (e) { /* Fotos sind nicht kritisch */ }
}
function locationPayload(l) {
  return { id: l.id, name: l.name, type: l.type || 'lager', parent_id: l.parent_id || null, notes: l.notes ?? null, archived: !!l.archived };
}

// Baum aus parent_id. Orte, deren übergeordneter Ort fehlt (z. B. archiviert und ausgeblendet), werden Wurzeln.
function buildTree(locs) {
  const byId = new Map(locs.map((l) => [l.id, l]));
  const kids = new Map();
  const roots = [];
  for (const l of locs) {
    if (l.parent_id && l.parent_id !== l.id && byId.has(l.parent_id)) {
      if (!kids.has(l.parent_id)) kids.set(l.parent_id, []);
      kids.get(l.parent_id).push(l);
    } else roots.push(l);
  }
  const byName = (x, y) => cmp(x.name, y.name);
  roots.sort(byName);
  kids.forEach((arr) => arr.sort(byName));
  return { byId, kids, roots };
}
// Alle Unterorte (Tiefensuche, Reihenfolge wie im Baum), sicher gegen Zyklen
function descendants(id, tree) {
  const out = [];
  const seen = new Set([id]);
  const walk = (pid) => {
    for (const c of tree.kids.get(pid) || []) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      out.push(c);
      walk(c.id);
    }
  };
  walk(id);
  return out;
}
function ancestors(loc, tree) {
  const out = [];
  const seen = new Set([loc.id]);
  let cur = loc.parent_id ? tree.byId.get(loc.parent_id) : null;
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    out.unshift(cur);
    cur = cur.parent_id ? tree.byId.get(cur.parent_id) : null;
  }
  return out;
}
function countBy(list, key) {
  const m = new Map();
  for (const x of list || []) if (x && x[key]) m.set(x[key], (m.get(x[key]) || 0) + 1);
  return m;
}
// Lesbarer Code (HL-RG01, aus den Kurzcodes) neben dem internen Code (L-0001, im QR)
function codesHtml(l) {
  return l.code_path
    ? `<b class="mono" style="color:var(--text)">${esc(l.code_path)}</b> · <span class="mono">${esc(l.code)}</span>`
    : `<span class="mono">${esc(l.code)}</span>`;
}
async function safeList(fn) {
  try { const r = await fn(); return Array.isArray(r) ? r : []; } catch (e) { return []; }
}
function countsText(nA, nM) {
  const parts = [];
  if (nA) parts.push(plural('locations.articles', nA));
  if (nM) parts.push(plural('locations.machines', nM));
  return parts.join(' · ');
}

// ---------------------------------------------------------------------------
// Baum ('lagerorte')
// ---------------------------------------------------------------------------
const treeState = { q: '', archived: false, collapsed: null };
function collapsedSet() {
  if (!treeState.collapsed) {
    let arr = [];
    try { arr = JSON.parse(localStorage.getItem(COLLAPSE_KEY) || '[]'); } catch (e) { arr = []; }
    treeState.collapsed = new Set(Array.isArray(arr) ? arr : []);
  }
  return treeState.collapsed;
}
function saveCollapsed() {
  try { localStorage.setItem(COLLAPSE_KEY, JSON.stringify([...collapsedSet()])); } catch (e) { /* ohne Speicher */ }
}

async function listView(ctx) {
  const { api, user } = ctx;
  const staff = can(user, 'staff');
  ctx.setTitle(t('locations.title'));
  ctx.el.innerHTML = loadingHtml();
  let locs, arts, machs;
  try {
    [locs, arts, machs] = await Promise.all([
      api.listLocations({ includeArchived: staff }),
      api.listArticles({}).catch(() => null),      // Zähler sind nicht kritisch
      api.listMachines({}).catch(() => null),
    ]);
  } catch (err) { showError(ctx, err); return; }
  locs = locs || [];
  const directA = countBy(arts, 'location_id');
  const directM = countBy(machs, 'home_location_id');
  const hay = new Map(locs.map((l) => [l.id, norm([l.name, l.code, l.path, l.short_code, l.code_path, l.responsible_name,
    locTypeLabel(l.type)].join(' '))]));

  ctx.el.innerHTML = `<div class="page">
    <div class="page-head">
      <div><h1>${esc(t('locations.title'))}</h1><div class="sub" data-count aria-live="polite"></div></div>
      ${staff ? `<div class="actions"><a class="btn primary" href="#/lagerorte/neu">${icon('plus')}${esc(t('locations.new'))}</a></div>` : ''}
    </div>
    <div class="filters">
      <div class="searchbar" style="flex:1 1 240px">${icon('search')}<input type="search" data-q value="${esc(treeState.q)}"
        aria-label="${esc(t('locations.searchLabel'))}" placeholder="${esc(t('locations.searchPh'))}" autocomplete="off" enterkeyhint="search"></div>
      ${staff ? `<label class="check"><input type="checkbox" data-arch${treeState.archived ? ' checked' : ''}>${esc(t('common.showArchived'))}</label>` : ''}
    </div>
    <div class="row" data-tools>
      <button type="button" class="btn sm ghost" data-expand>${icon('chevron')}${esc(t('locations.expandAll'))}</button>
      <button type="button" class="btn sm ghost" data-collapse>${icon('minus')}${esc(t('locations.collapseAll'))}</button>
    </div>
    <div data-tree></div>
  </div>`;
  const root = ctx.el.firstElementChild;
  const treeEl = root.querySelector('[data-tree]');
  const countEl = root.querySelector('[data-count]');
  const toolsEl = root.querySelector('[data-tools]');

  const rowHtml = (l, depth, nKids, expanded, searching) => {
    const nA = directA.get(l.id) || 0;
    const nM = directM.get(l.id) || 0;
    const toggle = nKids && !searching
      ? `<button type="button" class="icon-btn" data-toggle="${esc(l.id)}" aria-expanded="${expanded}"
          aria-label="${esc(t('locations.toggle', { name: l.name }))}">
          <span style="display:inline-flex;transition:transform .15s;transform:rotate(${expanded ? 90 : 0}deg)">${icon('chevron')}</span></button>`
      : '<span style="width:40px;flex:none" aria-hidden="true"></span>';
    return `<div class="list-item" style="padding-left:${6 + depth * 20}px;gap:8px">
      ${toggle}
      <a class="li-main" href="#/l/${enc(l.code)}" style="text-decoration:none;align-self:stretch;justify-content:center">
        <span class="li-title"><span class="muted" aria-hidden="true" style="display:inline-flex;vertical-align:-4px;margin-right:6px">${typeIcon(l.type)}</span>${esc(l.name)}</span>
        <span class="li-sub">${esc(locTypeLabel(l.type))} · ${codesHtml(l)}${l.archived ? ' · ' + esc(t('common.archived')) : ''}</span>
      </a>
      <div class="li-end">
        ${nA ? `<span>${esc(plural('locations.articles', nA))}</span>` : ''}
        ${nM ? `<span class="muted">${esc(plural('locations.machines', nM))}</span>` : ''}
      </div>
      ${staff ? `<a class="icon-btn" href="#/lagerorte/neu?parent=${enc(l.id)}" title="${esc(t('locations.addChild'))}"
        aria-label="${esc(t('locations.addChildTo', { name: l.name }))}">${icon('plus')}</a>` : ''}
    </div>`;
  };

  const render = (focusToggleId) => {
    const shown = locs.filter((l) => !l.archived || (staff && treeState.archived));
    const tree = buildTree(shown);
    const words = norm(treeState.q).split(' ').filter(Boolean);
    let visible = null;
    let matches = 0;
    if (words.length) {
      visible = new Set();
      for (const l of shown) {
        const h = hay.get(l.id) || '';
        if (!words.every((w) => h.includes(w))) continue;
        matches++;
        let cur = l;
        let guard = 0;
        while (cur && !visible.has(cur.id) && guard++ < 100) {     // Vorfahren sichtbar lassen
          visible.add(cur.id);
          cur = cur.parent_id ? tree.byId.get(cur.parent_id) : null;
        }
      }
    }
    const collapsed = collapsedSet();
    const out = [];
    const seen = new Set();
    const walk = (node, depth) => {
      if (seen.has(node.id)) return;
      seen.add(node.id);
      if (visible && !visible.has(node.id)) return;
      const children = (tree.kids.get(node.id) || []).filter((c) => !visible || visible.has(c.id));
      const expanded = visible ? true : !collapsed.has(node.id);
      out.push(rowHtml(node, depth, children.length, expanded, !!visible));
      if (expanded) children.forEach((c) => walk(c, depth + 1));
    };
    tree.roots.forEach((r) => walk(r, 0));

    countEl.textContent = plural('locations.count', visible ? matches : shown.length);
    toolsEl.hidden = !!visible || !tree.kids.size;
    if (!out.length) {
      treeEl.innerHTML = emptyHtml(shown.length ? t('locations.noMatch') : t('locations.emptyTree'),
        staff && !shown.length ? `<a class="btn primary" href="#/lagerorte/neu">${icon('plus')}${esc(t('locations.new'))}</a>` : '');
      return;
    }
    treeEl.innerHTML = `<div class="list">${out.join('')}</div>`;
    if (focusToggleId) {
      const b = [...treeEl.querySelectorAll('[data-toggle]')].find((x) => x.dataset.toggle === focusToggleId);
      if (b) b.focus();
    }
  };
  render();

  const qInput = root.querySelector('[data-q]');
  qInput.addEventListener('input', debounce(() => { treeState.q = qInput.value; render(); }, 150));
  qInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); treeState.q = qInput.value; render(); } });
  const arch = root.querySelector('[data-arch]');
  if (arch) arch.addEventListener('change', () => { treeState.archived = arch.checked; render(); });
  treeEl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-toggle]');
    if (!b) return;
    const id = b.dataset.toggle;
    const set = collapsedSet();
    if (set.has(id)) set.delete(id); else set.add(id);
    saveCollapsed();
    render(id);
  });
  root.querySelector('[data-expand]').addEventListener('click', () => { collapsedSet().clear(); saveCollapsed(); render(); });
  root.querySelector('[data-collapse]').addEventListener('click', () => {
    const set = collapsedSet();
    for (const l of locs) if (l.parent_id) set.add(l.parent_id);
    saveCollapsed();
    render();
  });
}

// ---------------------------------------------------------------------------
// Lagerort nach dem Scannen ('l/:code') – der ganze Inhalt sofort
// ---------------------------------------------------------------------------
async function cardView(ctx) {
  const { api, user } = ctx;
  const staff = can(user, 'staff');
  const admin = can(user, 'admin');
  const code = routeCode(ctx);
  ctx.setTitle(code || t('locations.title'));
  ctx.el.innerHTML = loadingHtml();

  let loc, all, arts, machs;
  try {
    [loc, all, arts, machs] = await Promise.all([
      api.getLocationByCode(code),
      api.listLocations({ includeArchived: true }),
      api.listArticles({}),
      api.listMachines({}),
    ]);
  } catch (err) { showError(ctx, err); return; }
  if (!loc) { showNotFound(ctx, code); return; }
  ctx.setTitle(loc.name);

  all = all || [];
  if (!all.some((l) => l.id === loc.id)) all.push(loc);
  const tree = buildTree(all);
  const anc = ancestors(loc, tree);
  const desc = descendants(loc.id, tree);
  const order = [loc.id, ...desc.map((d) => d.id)];          // Reihenfolge der Gruppen
  const inside = new Set(order);
  const articles = (arts || []).filter((a) => a.location_id && inside.has(a.location_id));
  const machines = (machs || []).filter((m) => m.home_location_id && inside.has(m.home_location_id));
  const children = (tree.kids.get(loc.id) || []).filter((c) => !c.archived || staff);

  // Inhalt je Unterort (inkl. dessen Unterorte) für die Liste der Unterorte
  const dA = countBy(articles, 'location_id');
  const dM = countBy(machines, 'home_location_id');
  const subtotal = (id) => {
    let nA = dA.get(id) || 0;
    let nM = dM.get(id) || 0;
    for (const d of descendants(id, tree)) { nA += dA.get(d.id) || 0; nM += dM.get(d.id) || 0; }
    return { nA, nM };
  };
  // Pfad relativ zu diesem Lagerort («Fach 02 / Box 03»)
  const relPath = (id) => {
    const names = [];
    let cur = tree.byId.get(id);
    let guard = 0;
    while (cur && cur.id !== loc.id && guard++ < 100) {
      names.unshift(cur.name);
      cur = cur.parent_id ? tree.byId.get(cur.parent_id) : null;
    }
    return names.join(' / ');
  };
  const grouped = (items, key, rowFn) => {
    const groups = new Map();
    for (const it of items) {
      if (!groups.has(it[key])) groups.set(it[key], []);
      groups.get(it[key]).push(it);
    }
    const withLabels = groups.size > 1 || !groups.has(loc.id);
    let html = '';
    for (const id of order) {
      const g = groups.get(id);
      if (!g) continue;
      if (withLabels) {
        const l = tree.byId.get(id);
        html += `<div class="group-label">${id === loc.id
          ? esc(t('locations.here'))
          : `<a href="#/l/${enc(l.code)}" style="color:inherit">${esc(relPath(id))}</a>`}</div>`;
      }
      html += g.map(rowFn).join('');
    }
    return `<div class="list">${html}</div>`;
  };

  const articleRow = (a) => `<a class="list-item" href="#/a/${enc(a.code)}">
      ${thumbHtml(a.photo_path, '', 'thumb', 'box')}
      <div class="li-main">
        <span class="li-title">${esc(a.name)}${a.size ? ` <span class="muted">· ${esc(a.size)}</span>` : ''}</span>
        <span class="li-sub mono">${esc(a.code)}</span>
      </div>
      <div class="li-end">
        <span class="nowrap" style="font-size:17px;font-weight:750;font-variant-numeric:tabular-nums">${esc(fmtQty(a.stock, a.unit))}</span>
        ${a.low_stock ? `<span class="pill pill-danger">${esc(t('locations.low'))}</span>` : ''}
      </div>
    </a>`;
  const machineRow = (m) => {
    const sub = [m.code, [m.brand, m.model].map(clean).filter(Boolean).join(' ')].filter(Boolean).join(' · ');
    const onLoan = (m.open_loan_id || m.status === 'ausgeliehen') && m.open_borrower_name;
    return `<a class="list-item" href="#/m/${enc(m.code)}">
      ${thumbHtml(m.photo_path, '', 'thumb', 'machine')}
      <div class="li-main">
        <span class="li-title">${esc(m.name)}</span>
        <span class="li-sub">${esc(sub)}</span>
      </div>
      <div class="li-end">
        ${statusPill(m.status)}
        ${onLoan ? `<span class="small muted">${esc(t('locations.atBorrower', { name: m.open_borrower_name }))}</span>` : ''}
      </div>
    </a>`;
  };
  const childRow = (c) => {
    const { nA, nM } = subtotal(c.id);
    const nSub = (tree.kids.get(c.id) || []).filter((x) => !x.archived).length;
    const info = [locTypeLabel(c.type), c.code_path, c.code, nSub ? plural('locations.subs', nSub) : '', countsText(nA, nM)].filter(Boolean).join(' · ');
    return `<a class="list-item" href="#/l/${enc(c.code)}">
      <div class="thumb thumb-empty" aria-hidden="true">${typeIcon(c.type)}</div>
      <div class="li-main">
        <span class="li-title">${esc(c.name)}</span>
        <span class="li-sub">${esc(info)}</span>
      </div>
      <div class="li-end">${c.archived ? `<span class="pill pill-muted">${esc(t('common.archived'))}</span>` : ''}<span class="muted">${icon('chevron')}</span></div>
    </a>`;
  };

  const hero = loc.photo_path
    ? thumbHtml(loc.photo_path, t('locations.photoAlt', { name: loc.name }), 'thumb lg', 'location')
    : `<div class="thumb lg thumb-empty" data-qr role="img" aria-label="${esc(t('locations.qrAlt', { code: loc.code }))}">${typeIcon(loc.type)}</div>`;
  const crumbs = [`<a href="#/lagerorte" style="color:inherit">${esc(t('locations.title'))}</a>`,
    ...anc.map((p) => `<a href="#/l/${enc(p.code)}" style="color:inherit">${esc(p.name)}</a>`),
    `<span aria-current="page" style="color:var(--text);font-weight:600">${esc(loc.name)}</span>`];
  const isEmpty = !children.length && !machines.length && !articles.length;

  ctx.el.innerHTML = `<div class="page">
    <nav aria-label="${esc(t('locations.path'))}" class="small muted" style="overflow-wrap:anywhere">
      ${crumbs.join('<span aria-hidden="true"> / </span>')}
    </nav>
    <div class="card stack">
      <div class="machine-hero">
        <div data-hero>${hero}</div>
        <div>
          <h1>${esc(loc.name)}</h1>
          <div class="code"><span>${esc(locTypeLabel(loc.type))}</span> · ${codesHtml(loc)}</div>
          <div class="row">
            ${loc.archived ? `<span class="pill pill-muted">${esc(t('common.archived'))}</span>` : ''}
            ${countsText(articles.length, machines.length) ? `<span class="small muted">${esc(countsText(articles.length, machines.length))}</span>` : ''}
          </div>
        </div>
      </div>
      <dl class="kv">
        ${loc.code_path ? `<dt>${esc(t('locations.codePath'))}</dt><dd class="mono">${esc(loc.code_path)}</dd>` : ''}
        <dt>${esc(t('locations.internalCode'))}</dt><dd class="mono">${esc(loc.code)}</dd>
        ${loc.responsible_name ? `<dt>${esc(t('locations.f.responsible'))}</dt><dd>${esc(loc.responsible_name)}</dd>` : ''}
        ${loc.site_name ? `<dt>${esc(t('site.label'))}</dt><dd>${esc(loc.site_name)}</dd>` : ''}
      </dl>
      ${loc.code_path ? `<p class="hint" style="margin:0">${esc(t('locations.codeExplain'))}</p>` : ''}
      ${loc.notes ? `<div style="white-space:pre-line;overflow-wrap:anywhere">${esc(loc.notes)}</div>` : ''}
      ${loc.archived ? `<div class="alert">${icon('box')}<span>${esc(t('locations.archivedNote'))}</span></div>` : ''}
      <div class="row">
        <a class="btn" href="#/o/${enc(loc.code)}">${icon('image')}${esc(t('locations.openVisual'))}</a>
        ${staff && !loc.archived ? `<a class="btn" href="#/inventur?ort=${enc(loc.code)}">${icon('clipboard')}${esc(t('locations.inventory'))}</a>` : ''}
      </div>
    </div>

    ${staff ? `<section class="section" aria-labelledby="loc-manage-h">
      <h2 id="loc-manage-h">${esc(t('locations.manage'))}</h2>
      <div class="row">
        <a class="btn sm" href="#/l/${enc(loc.code)}/bearbeiten">${icon('edit')}${esc(t('btn.edit'))}</a>
        ${!loc.archived ? `<a class="btn sm" href="#/lagerorte/neu?parent=${enc(loc.id)}">${icon('plus')}${esc(t('locations.addChild'))}</a>` : ''}
        <button type="button" class="btn sm" data-act="label">${icon('print')}${esc(t('locations.printLabel'))}</button>
        <button type="button" class="btn sm" data-act="labels-all">${icon('label')}${esc(t('locations.labelsAll'))}</button>
        <button type="button" class="btn sm" data-act="archive">${icon(loc.archived ? 'history' : 'box')}${esc(t(loc.archived ? 'btn.unarchive' : 'btn.archive'))}</button>
        ${admin ? `<button type="button" class="btn sm danger-outline" data-act="delete">${icon('trash')}${esc(t('btn.delete'))}</button>` : ''}
      </div>
    </section>` : ''}

    ${children.length ? `<section class="section" aria-labelledby="loc-children-h">
      <h2 id="loc-children-h">${esc(t('locations.children'))} (${children.length})</h2>
      <div class="list">${children.map(childRow).join('')}</div>
    </section>` : ''}

    ${machines.length ? `<section class="section" aria-labelledby="loc-machines-h">
      <h2 id="loc-machines-h">${esc(t('locations.machines'))} (${machines.length})</h2>
      ${grouped(machines, 'home_location_id', machineRow)}
    </section>` : ''}

    ${articles.length ? `<section class="section" aria-labelledby="loc-articles-h">
      <h2 id="loc-articles-h">${esc(t('locations.articles'))} (${articles.length})</h2>
      ${grouped(articles, 'location_id', articleRow)}
    </section>` : ''}

    ${isEmpty ? emptyHtml(t('locations.emptyPlace'), staff && !loc.archived
      ? `<a class="btn" href="#/lagerorte/neu?parent=${enc(loc.id)}">${icon('plus')}${esc(t('locations.addChild'))}</a>` : '') : ''}

    <div data-media></div>
  </div>`;
  const root = ctx.el.firstElementChild;

  const qrBox = root.querySelector('[data-qr]');
  if (qrBox) fillQr(qrBox, loc.code);
  Promise.resolve(hydrateThumbs(root, api)).then(() => {
    const img = root.querySelector('[data-hero] img[src]');
    if (img) { img.style.cursor = 'zoom-in'; img.addEventListener('click', () => openLightbox(img.src, loc.name)); }
  });
  mountMedia(root.querySelector('[data-media]'), { ctx, entity: 'location', entityId: loc.id, kinds: ['photo'] });

  root.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', async () => {
    const act = b.dataset.act;
    if (act === 'label') printLabels(() => [labels.labelItem('location', loc)]);
    else if (act === 'labels-all') {
      printLabels(() => [
        ...desc.filter((l) => !l.archived).map((l) => labels.labelItem('location', l)),
        ...machines.map((m) => labels.labelItem('machine', m)),
        ...articles.map((a) => labels.labelItem('article', a)),
      ]);
    } else if (act === 'archive') await setArchived(ctx, loc, !loc.archived);
    else if (act === 'delete') await removeLocation(ctx, loc);
  }));
}

async function setArchived(ctx, loc, archived) {
  if (archived && !(await confirmSheet(t('locations.archiveQ'), t('locations.archiveMsg', { name: loc.name }), { okLabel: t('btn.archive') }))) return;
  try {
    await ctx.api.saveLocation({ ...locationPayload(loc), archived });
    toast(t(archived ? 'locations.archivedToast' : 'locations.unarchivedToast'));
    ctx.reload();
  } catch (err) { toast(errorText(err), 'error'); }
}

async function removeLocation(ctx, loc) {
  if (!(await confirmSheet(t('locations.deleteQ'), t('locations.deleteMsg', { name: loc.name }), { okLabel: t('btn.delete'), danger: true }))) return;
  try {
    await ctx.api.deleteLocation(loc.id);
    toast(t('locations.deleted'));
    ctx.go('lagerorte');
  } catch (err) {
    if (!err || err.code !== 'in_use') { toast(errorText(err), 'error'); return; }
    if (loc.archived) {
      await sheet({ title: t('locations.inUseTitle'), body: `<p>${esc(t('locations.inUseArchived'))}</p>`,
        actions: [{ label: t('btn.close'), kind: 'primary', value: true }] });
      return;
    }
    if (await confirmSheet(t('locations.inUseTitle'), t('locations.inUseMsg'), { okLabel: t('btn.archive') })) {
      try {
        await ctx.api.saveLocation({ ...locationPayload(loc), archived: true });
        toast(t('locations.archivedToast'));
        ctx.reload();
      } catch (e2) { toast(errorText(e2), 'error'); }
    }
  }
}

// ---------------------------------------------------------------------------
// Formular (neu / bearbeiten) – nur Lagerverantwortliche
// ---------------------------------------------------------------------------
async function formView(ctx, mode) {
  const { api, user } = ctx;
  const isNew = mode === 'new';
  ctx.setTitle(t(isNew ? 'locations.newTitle' : 'locations.editTitle'));
  if (!can(user, 'staff')) {
    ctx.el.innerHTML = `<div class="page">${emptyHtml(t('err.not_authorized'),
      `<a class="btn" href="#/lagerorte">${icon('back')}${esc(t('locations.toList'))}</a>`)}</div>`;
    return;
  }
  const code = isNew ? '' : routeCode(ctx);
  ctx.el.innerHTML = loadingHtml();
  let loc = null;
  let all = [];
  let profiles = [];
  let sites = [];
  try {
    [loc, all, profiles, sites] = await Promise.all([
      isNew ? Promise.resolve(null) : api.getLocationByCode(code),
      api.listLocations({ includeArchived: true }),
      safeList(() => api.listProfiles()),
      safeList(() => (typeof api.listSites === 'function' ? api.listSites() : [])),
    ]);
  } catch (err) { showError(ctx, err); return; }
  if (!isNew && !loc) { showNotFound(ctx, code); return; }
  all = all || [];
  const tree = buildTree(all);

  // Sich selbst und eigene Unterorte nicht als «Liegt in» anbieten (Zyklen; der Server prüft auch)
  const excluded = new Set();
  if (loc) { excluded.add(loc.id); descendants(loc.id, tree).forEach((d) => excluded.add(d.id)); }
  let parentId = null;
  if (isNew) {
    const pq = clean(queryParam(ctx, 'parent') || '');
    if (pq) {
      const p = all.find((l) => l.id === pq || String(l.code || '').toUpperCase() === pq.toUpperCase());
      if (p) parentId = p.id;
    }
  } else parentId = loc.parent_id || null;
  const parent = parentId ? tree.byId.get(parentId) : null;
  const type = loc ? loc.type : (parent ? (NEXT_TYPE[parent.type] || 'box') : 'lager');
  const options = all.filter((l) => !excluded.has(l.id) && (!l.archived || l.id === parentId))
    .sort((x, y) => cmp(x.path || x.name, y.path || y.name));
  const pathOf = (l) => l.path || [...ancestors(l, tree).map((p) => p.name), l.name].join(' / ');
  const back = isNew ? (parent ? `#/l/${enc(parent.code)}` : '#/lagerorte') : `#/l/${enc(loc.code)}`;
  // Kurzcode: Geschwister = gleicher übergeordneter Lagerort (eindeutig je Ebene)
  const siblings = (pid) => all.filter((l) => (l.parent_id || null) === (pid || null) && (!loc || l.id !== loc.id));
  const suggestFor = (ty, pid, name) => {
    const sib = siblings(pid);
    let s = suggestShortCode(ty, sib);
    if (!s && !pid) {   // Raum (oberste Ebene): bekannte Vorschläge wie «Hauptlager» → HL
      const p = SPACE_PRESETS.find((x) => norm(x.name) === norm(name));
      if (p && !sib.some((l) => l.short_code === p.short)) s = p.short;
    }
    return s;
  };
  const respId = loc && loc.responsible_id ? loc.responsible_id : '';
  const people = profiles.filter((p) => p.active !== false || p.id === respId);
  const respOpts = `<option value="">${esc(t('locations.noResponsible'))}</option>`
    + (respId && !people.some((p) => p.id === respId) ? `<option value="${esc(respId)}" selected>${esc(loc.responsible_name || '?')}</option>` : '')
    + people.map((p) => `<option value="${esc(p.id)}"${p.id === respId ? ' selected' : ''}>${esc(p.full_name || p.email || '–')}</option>`).join('');
  const initialShort = loc ? (loc.short_code || '') : suggestFor(type, parentId, '');
  sites = sites || [];
  const siteId = loc ? (loc.site_id || '') : (sites.find((x) => x.id === clean(queryParam(ctx, 'site') || '')) || {}).id || '';

  ctx.el.innerHTML = `<div class="page">
    <a class="back-link" href="${back}">${icon('back')}${esc(t('btn.back'))}</a>
    <div class="page-head"><h1>${esc(t(isNew ? 'locations.newTitle' : 'locations.editTitle'))}</h1>
      ${loc ? `<div class="sub mono">${esc(loc.code)}</div>` : ''}</div>
    <form class="card form" data-form novalidate>
      <div class="field full">
        <label for="lf-name">${esc(t('locations.f.name'))} <span aria-hidden="true">*</span></label>
        <input id="lf-name" name="name" type="text" required aria-required="true" maxlength="120" autocomplete="off"
          placeholder="${esc(t('locations.namePh'))}" value="${esc(loc ? loc.name : '')}">
      </div>
      <div class="field">
        <label for="lf-type">${esc(t('locations.f.type'))}</label>
        <select id="lf-type" name="type">${TYPES.map((ty) => `<option value="${ty}"${ty === type ? ' selected' : ''}>${esc(locTypeLabel(ty))}</option>`).join('')}</select>
      </div>
      ${isNew ? `<div class="field">
        <label for="lf-code">${esc(t('locations.f.code'))} (${esc(t('common.optional'))})</label>
        <input id="lf-code" name="code" type="text" maxlength="30" autocomplete="off" autocapitalize="characters" spellcheck="false"
          placeholder="L-…" aria-describedby="lf-code-h">
        <div class="hint" id="lf-code-h">${esc(t('locations.h.code'))}</div>
      </div>` : ''}
      <div class="field">
        <label for="lf-short">${esc(t('locations.f.short'))} (${esc(t('common.optional'))})</label>
        <input id="lf-short" name="short_code" type="text" maxlength="10" autocomplete="off" autocapitalize="characters" spellcheck="false"
          value="${esc(initialShort)}" style="text-transform:uppercase;font-family:var(--mono, ui-monospace, monospace)" aria-describedby="lf-short-h lf-codepath">
        <div><button type="button" class="btn sm ghost" data-suggest hidden></button></div>
        <div class="hint" id="lf-short-h">${esc(t('locations.h.short'))}</div>
        <div class="hint" id="lf-codepath" data-codepath aria-live="polite"></div>
      </div>
      <div class="field">
        <label for="lf-resp">${esc(t('locations.f.responsible'))}</label>
        <select id="lf-resp" name="responsible_id">${respOpts}</select>
      </div>
      <p class="hint" style="grid-column:1/-1;margin:0">${esc(loc ? t('locations.qrHintEdit', { code: loc.code }) : t('locations.qrHintNew'))}</p>
      <div class="field full">
        <label for="lf-parent">${esc(t('locations.f.parent'))}</label>
        <select id="lf-parent" name="parent_id" aria-describedby="lf-parent-h lf-preview">
          <option value="">${esc(t('locations.f.noParent'))}</option>
          ${options.map((l) => `<option value="${esc(l.id)}"${l.id === parentId ? ' selected' : ''}>${esc(pathOf(l))}</option>`).join('')}
        </select>
        <div class="hint" id="lf-parent-h">${esc(t('locations.h.parent'))}</div>
        <div class="hint" id="lf-preview" data-preview aria-live="polite"></div>
      </div>
      ${sites.length ? `<div class="field full" data-sitefield${parentId ? ' hidden' : ''}>
        <label for="lf-site">${esc(t('site.label'))}</label>
        <select id="lf-site" name="site_id" aria-describedby="lf-site-h">${siteOptionsHtml(sites, siteId)}</select>
        <div class="hint" id="lf-site-h">${esc(t('site.hint'))}</div>
      </div>` : ''}
      <div class="field full">
        <label for="lf-notes">${esc(t('locations.f.notes'))}</label>
        <textarea id="lf-notes" name="notes">${esc(loc && loc.notes ? loc.notes : '')}</textarea>
      </div>
      <div class="alert danger field full" data-err role="alert" hidden></div>
      <div class="field full"><div class="actions">
        <button type="submit" class="btn primary">${icon('check')}${esc(t('btn.save'))}</button>
        <a class="btn ghost" href="${back}">${esc(t('btn.cancel'))}</a>
      </div></div>
    </form>
  </div>`;
  const root = ctx.el.firstElementChild;
  const form = root.querySelector('[data-form]');
  const submitBtn = form.querySelector('button[type=submit]');
  const nameInp = form.querySelector('#lf-name');
  const parentSel = form.querySelector('#lf-parent');
  const typeSel = form.querySelector('#lf-type');
  const preview = form.querySelector('[data-preview]');
  const shortInp = form.querySelector('#lf-short');
  const suggestBtn = form.querySelector('[data-suggest]');
  const codePathEl = form.querySelector('[data-codepath]');
  let typeTouched = !isNew;
  // Neuanlage: Kurzcode automatisch vorschlagen, bis jemand das Feld selbst ändert.
  // Bearbeiten: nie automatisch ändern – nur der Knopf «Vorschlag … übernehmen».
  let shortEdited = !isNew;
  let suggestion = '';
  const updateShort = () => {
    const pid = parentSel.value || null;
    suggestion = suggestFor(typeSel.value, pid, nameInp.value);
    if (!shortEdited && normShortCode(shortInp.value) !== suggestion) shortInp.value = suggestion;
    const now = normShortCode(shortInp.value);
    suggestBtn.hidden = !suggestion || suggestion === now;
    suggestBtn.textContent = suggestion ? t('locations.useSuggestion', { code: suggestion }) : '';
    // Lesbarer Code = Code des übergeordneten Lagerorts + Kurzcode
    const p = pid ? tree.byId.get(pid) : null;
    const full = !now ? '' : !p ? now : p.code_path ? `${p.code_path}-${now}` : '';
    codePathEl.textContent = full ? t('locations.codePathPreview', { code: full }) : t('locations.codePathMissing');
  };
  typeSel.addEventListener('change', () => { typeTouched = true; updateShort(); });
  shortInp.addEventListener('input', () => { shortEdited = true; shortInp.removeAttribute('aria-invalid'); updateShort(); });
  shortInp.addEventListener('blur', () => { shortInp.value = normShortCode(shortInp.value); updateShort(); });
  suggestBtn.addEventListener('click', () => {
    if (!suggestion) return;
    shortInp.value = suggestion;
    shortInp.removeAttribute('aria-invalid');
    updateShort();
    shortInp.focus();
  });
  const updatePreview = () => {
    const p = parentSel.value ? tree.byId.get(parentSel.value) : null;
    const name = clean(nameInp.value) || '…';
    preview.textContent = t('locations.preview', { path: p ? `${pathOf(p)} / ${name}` : name });
  };
  nameInp.addEventListener('input', () => { updatePreview(); if (!parentSel.value) updateShort(); });
  parentSel.addEventListener('change', () => {
    const p = parentSel.value ? tree.byId.get(parentSel.value) : null;
    if (!typeTouched) typeSel.value = p ? (NEXT_TYPE[p.type] || 'box') : 'lager';
    const sf = form.querySelector('[data-sitefield]');
    if (sf) sf.hidden = !!p;   // Standort nur für Räume (oberste Ebene)
    updatePreview();
    updateShort();
  });
  updatePreview();
  updateShort();
  // Fehlermeldung bei doppeltem Kurzcode auf derselben Ebene (mit Vorschlag)
  const duplicateMsg = (short, pid) => {
    const other = siblings(pid).find((l) => l.short_code === short);
    const sug = suggestFor(typeSel.value, pid, nameInp.value);
    return other && sug && sug !== short
      ? t('locations.shortDuplicate', { code: short, name: other.name, suggest: sug })
      : t('locations.shortDuplicateNoSug', { code: short });
  };

  const fail = (msg, fieldName) => {
    setErr(form, msg);
    const f = fieldName && form.querySelector(`[name="${fieldName}"]`);
    if (f) { f.setAttribute('aria-invalid', 'true'); f.focus(); }
  };
  let busy = false;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (busy) return;
    form.querySelectorAll('[aria-invalid]').forEach((x) => x.removeAttribute('aria-invalid'));
    setErr(form, '');
    const d = formData(form);
    const name = clean(d.name);
    if (!name) { fail(t('err.name_required'), 'name'); return; }
    const short = normShortCode(d.short_code);
    shortInp.value = short;
    const obj = {
      name, type: TYPES.includes(d.type) ? d.type : 'lager', parent_id: d.parent_id || null, notes: multi(d.notes),
      short_code: short || null, responsible_id: d.responsible_id || null,
    };
    if (sites.length) obj.site_id = obj.parent_id ? null : (d.site_id || null);
    if (short && siblings(obj.parent_id).some((l) => l.short_code === short)) {
      fail(duplicateMsg(short, obj.parent_id), 'short_code');
      return;
    }
    if (isNew) {
      const c = clean(d.code).toUpperCase().replace(/\s+/g, '');
      if (c) obj.code = c;
    } else {
      if (obj.parent_id && excluded.has(obj.parent_id)) { fail(t('err.location_cycle'), 'parent_id'); return; }
      obj.id = loc.id;
      obj.archived = !!loc.archived;
    }
    busy = true;
    submitBtn.disabled = true;
    try {
      const row = await api.saveLocation(obj);
      const savedCode = (row && row.code) || obj.code || (loc && loc.code);
      toast(t('common.saved'));
      if (savedCode) ctx.go('l/' + enc(savedCode)); else ctx.go('lagerorte');
      if (isNew && row) offerLabel(row);
    } catch (err) {
      const c = err && err.code;
      // Gleicher Kurzcode auf derselben Ebene (eindeutiger Index locations_short_code_uniq)
      const shortDup = obj.short_code && (c === 'duplicate_short_code' || c === 'duplicate'
        || (c === 'duplicate_code' && /short/i.test(String(err.detail || ''))));
      const msg = shortDup ? duplicateMsg(obj.short_code, obj.parent_id) : errorText(err);
      fail(msg, shortDup ? 'short_code'
        : (c === 'duplicate_code' || c === 'invalid_code') && isNew ? 'code'
          : (c === 'location_cycle' || c === 'invalid_location') ? 'parent_id' : (c === 'name_required' ? 'name' : null));
      toast(msg, 'error');
    } finally {
      busy = false;
      submitBtn.disabled = false;
    }
  });
}

async function offerLabel(row) {
  const yes = await sheet({
    title: t('locations.created', { code: row.code }),
    body: `<p>${esc(t('locations.printNow'))}</p>`,
    actions: [
      { label: t('locations.later'), kind: 'ghost', value: false },
      { label: t('locations.printLabel'), kind: 'primary', icon: 'print', value: true },
    ],
  });
  if (yes === true) printLabels(() => [labels.labelItem('location', row)]);
}

// ---------------------------------------------------------------------------
// Routen
// ---------------------------------------------------------------------------
export const routes = {
  'lagerorte': (ctx) => listView(ctx),
  'lagerorte/neu': (ctx) => formView(ctx, 'new'),
  'l/:code': (ctx) => cardView(ctx),
  'l/:code/bearbeiten': (ctx) => formView(ctx, 'edit'),
};
