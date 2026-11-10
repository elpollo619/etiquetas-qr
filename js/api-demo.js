// Demo-Modus: dieselbe API wie api-supabase.js (Vertrag: docs/ARCHITECTURE.md), Daten nur in diesem Browser
// (localStorage, Schlüssel «lgr-demo:v1»; ohne localStorage im Speicher).
// Regeln, Rechte und Fehlercodes entsprechen den Funktionen und Triggern in supabase/schema.sql.
// «Lager organisieren» (Kategorien, Fotos, KI-Import, Prüfung, Aufgaben, Bereiche, Sets, Pläne, Standorte): js/api-demo-org.js.
// Einkaufsliste (shopping_items, shopping_overview, article_consumption, Trigger article_shopping_sync): hier, weil
// jede Bestandsänderung (Entnahme, Zugang, Korrektur, Inventur) sie nachführt.
// Bedarf je Maschine (machine_supplies, machine_supply_overview): ebenfalls hier.
import { installOrgDemo, upgradeDb, completeDb, seedCategories, orgViewIndex, orgInUse, orgAfterDelete } from './api-demo-org.js';

export const STORAGE_KEY = 'lgr-demo:v1';   // Schlüssel bleibt; der Datenstand trägt seine eigene Version
const VERSION = 3;                          // 2 = «Lager organisieren», 3 = Gebäudeplan (ältere Stände werden beim Laden übernommen)

const DEMO_IMAGE_MAX_PX = 800;
const DEMO_IMAGE_QUALITY = 0.8;
const DEMO_MAX_FILE_BYTES = 1.5 * 1024 * 1024;   // localStorage ist klein
const DEFAULT_LIMIT = 200;

const ROLES = ['admin', 'lagerverantwortlicher', 'mitarbeiter'];
const LANGS = ['de', 'pt', 'es'];
const LOCATION_TYPES = ['lager', 'raum', 'bereich', 'regal', 'schrank', 'tablar', 'fach', 'schublade', 'box', 'behaelter',
  'werkzeugwand', 'halterung', 'arbeitsplatz', 'fahrzeug', 'container', 'temporaer'];
const MACHINE_STATUS = ['verfuegbar', 'ausgeliehen', 'reserviert', 'wartung', 'defekt', 'verloren'];
const SETTABLE_STATUS = ['verfuegbar', 'reserviert', 'wartung', 'defekt', 'verloren'];
const CONDITIONS = ['ok', 'maengel', 'defekt'];
const MOVE_TYPES = ['zugang', 'entnahme', 'korrektur', 'umlagerung'];
const KINDS = ['photo', 'document', 'damage'];
const ENTITIES = ['article', 'machine', 'location'];
const CHECK_RESULTS = ['vorhanden', 'fehlt', 'defekt', 'ausgeliehen'];
const AUDIT_TABLE = {
  machine: 'machines', article: 'articles', location: 'locations', loan: 'loans',
  profile: 'profiles', inventory: 'inventories', attachment: 'attachments',
};

// Spalten wie in schema.sql
const PROFILE_COLS = ['id', 'full_name', 'email', 'role', 'active', 'lang', 'created_at'];
const LOCATION_COLS = ['id', 'code', 'name', 'type', 'parent_id', 'notes', 'archived', 'created_by', 'created_at', 'updated_at',
  'short_code', 'responsible_id', 'organized_at', 'organized_by', 'cover_photo_id', 'site_id'];
const ARTICLE_COLS = ['id', 'code', 'name', 'description', 'art_no', 'category', 'brand', 'model', 'size', 'color', 'usage',
  'label_text', 'unit', 'stock', 'min_stock', 'location_id', 'notes', 'archived', 'created_by', 'created_at', 'updated_at',
  'category_id', 'product_url', 'reorder_qty'];
const MACHINE_COLS = ['id', 'code', 'name', 'category', 'brand', 'model', 'serial_no', 'inventory_no', 'home_location_id',
  'status', 'condition', 'condition_note', 'notes', 'archived', 'created_by', 'created_at', 'updated_at',
  'category_id', 'responsible_id', 'is_set', 'product_url', 'battery_count', 'battery_type'];
const LOAN_COLS = ['id', 'machine_id', 'borrower_id', 'checked_out_at', 'due_at', 'checkout_note', 'returned_at', 'returned_by',
  'return_condition', 'return_note', 'checkout_request', 'return_request', 'corrected', 'created_by', 'batteries_out', 'batteries_back'];
const MOVEMENT_COLS = ['id', 'article_id', 'type', 'qty', 'stock_before', 'stock_after', 'from_location_id', 'to_location_id',
  'user_id', 'note', 'request_id', 'created_at'];
const SHOPPING_COLS = ['id', 'article_id', 'name', 'qty', 'unit', 'note', 'status', 'source', 'created_by', 'created_at',
  'updated_at', 'ordered_by', 'ordered_at', 'done_by', 'done_at'];
const SUPPLY_COLS = ['id', 'machine_id', 'article_id', 'note', 'created_by', 'created_at'];   // machine_supplies
const SUPPLY_NOTE_MAX = 300;                          // machine_supplies_note_check
const SHOPPING_STATUS = ['offen', 'bestellt', 'erledigt', 'verworfen'];
const SHOPPING_OPEN = ['offen', 'bestellt'];          // shopping_items_open_article_uniq: je Artikel höchstens ein solcher Eintrag
const SHOPPING_DONE_LIMIT = 40;                       // listShopping({ status: 'done' }): die letzten 40
const CONSUMPTION_MS = 90 * 24 * 3600 * 1000;         // article_consumption: Entnahmen der letzten 90 Tage

// Beschreibbare Spalten (wie GRANTs in schema.sql). Bestand/Status nie per Update.
const LOCATION_INSERT = ['code', 'name', 'type', 'parent_id', 'notes', 'archived', 'short_code', 'responsible_id', 'cover_photo_id', 'site_id'];
const LOCATION_UPDATE = ['name', 'type', 'parent_id', 'notes', 'archived', 'short_code', 'responsible_id', 'cover_photo_id', 'site_id'];
const ARTICLE_INSERT = ['code', 'name', 'description', 'art_no', 'category', 'brand', 'model', 'size', 'color', 'usage',
  'label_text', 'unit', 'stock', 'min_stock', 'reorder_qty', 'location_id', 'notes', 'archived', 'category_id', 'product_url'];
const ARTICLE_UPDATE = ['name', 'description', 'art_no', 'category', 'brand', 'model', 'size', 'color', 'usage',
  'label_text', 'unit', 'min_stock', 'reorder_qty', 'location_id', 'notes', 'archived', 'category_id', 'product_url'];
const MACHINE_INSERT = ['code', 'name', 'category', 'brand', 'model', 'serial_no', 'inventory_no', 'home_location_id',
  'status', 'condition', 'condition_note', 'notes', 'archived', 'category_id', 'responsible_id', 'is_set', 'product_url',
  'battery_count', 'battery_type'];
const MACHINE_UPDATE = ['name', 'category', 'brand', 'model', 'serial_no', 'inventory_no', 'home_location_id',
  'condition', 'condition_note', 'notes', 'archived', 'category_id', 'responsible_id', 'is_set', 'product_url',
  'battery_count', 'battery_type'];
const REF_COLS = new Set(['parent_id', 'location_id', 'home_location_id', 'category_id', 'responsible_id', 'cover_photo_id']);
const NUM_COLS = new Set(['stock', 'min_stock', 'reorder_qty']);
const BOOL_COLS = new Set(['archived', 'is_set']);
const ENUM_COLS = new Set(['type', 'unit', 'status', 'condition']);
const SHORT_CODE_RE = /^[A-Z0-9]{1,10}$/;          // locations_short_code_chk
const URL_RE = /^https?:\/\/[^\s]+$/i;             // machines_/articles_product_url_chk

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const LOCAL_DT_RE = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MONTHS_DE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

export const DEMO_USER_IDS = Object.freeze({
  cristian: '0d000000-0000-4000-8000-000000000001',
  luca: '0d000000-0000-4000-8000-000000000002',
  daniel: '0d000000-0000-4000-8000-000000000003',
  ana: '0d000000-0000-4000-8000-000000000004',
});

const COLLATOR = (() => { try { return new Intl.Collator('de-CH', { numeric: true, sensitivity: 'base' }); } catch { return null; } })();

// ---------------------------------------------------------------------------------------------
//  Hilfsfunktionen
// ---------------------------------------------------------------------------------------------
class FallbackLgrError extends Error {
  constructor(code, detail = null) { super(detail ? `${code}: ${detail}` : code); this.name = 'LgrError'; this.code = code; this.detail = detail ?? null; }
}
const has = (o, k) => o != null && Object.prototype.hasOwnProperty.call(o, k) && o[k] !== undefined;
const isUuid = (s) => typeof s === 'string' && UUID_RE.test(s);
const normCode = (c) => String(c ?? '').trim().toUpperCase();
const ms = (v) => (v ? Date.parse(v) : NaN);
const iso = (t) => new Date(t).toISOString();
const round6 = (x) => Math.round(x * 1e6) / 1e6;
const charLen = (s) => Array.from(String(s)).length;                           // length() in SQL (Zeichen)
const leftChars = (s, n) => Array.from(String(s ?? '')).slice(0, n).join('');  // left() in SQL
const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);               // uuid-Reihenfolge wie order('id')
function trimOrNull(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}
function num(v) {
  if (v === undefined || v === null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
  const s = String(v).trim().replace(/[\s'’]/g, '').replace(',', '.');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}
function clone(x) {
  if (x === undefined) return undefined;
  if (typeof structuredClone === 'function') return structuredClone(x);
  return JSON.parse(JSON.stringify(x));
}
const pick = (row, cols) => { const o = {}; for (const c of cols) o[c] = row[c] === undefined ? null : row[c]; return o; };
const omit = (row, keys) => { const o = { ...row }; for (const k of keys) delete o[k]; return o; };
const sameVal = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
function cmp(a, b) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return COLLATOR ? COLLATOR.compare(String(a), String(b)) : String(a).localeCompare(String(b));
}
const sortRows = (rows, key, tie = 'code') => rows.sort((x, y) => cmp(x[key], y[key]) || cmp(x[tie], y[tie]));
const newestFirst = (key) => (a, b) => (ms(b[key]) - ms(a[key])) || (typeof a.id === 'number' ? b.id - a.id : 0);
function uuid() {
  try { if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') return globalThis.crypto.randomUUID(); } catch { /* weiter */ }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
function renameExt(name, ext) {
  const base = String(name || 'foto').replace(/\.[A-Za-z0-9]{1,8}$/, '');
  return `${base || 'foto'}.${ext}`;
}
function extFor(name, mime) {
  const m = /\.([A-Za-z0-9]{1,8})$/.exec(String(name || ''));
  if (m) return m[1].toLowerCase();
  const map = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg', 'application/pdf': 'pdf' };
  return map[String(mime || '').toLowerCase()] || 'bin';
}
async function resizeImage(file, maxPx, quality) {
  if (typeof createImageBitmap !== 'function') return null;
  let bmp;
  try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch {
    try { bmp = await createImageBitmap(file); } catch { return null; }
  }
  try {
    const scale = Math.min(1, maxPx / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));
    let canvas;
    if (typeof document !== 'undefined' && document.createElement) {
      canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
    } else if (typeof OffscreenCanvas !== 'undefined') {
      canvas = new OffscreenCanvas(w, h);
    } else return null;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bmp, 0, 0, w, h);
    const blob = typeof canvas.convertToBlob === 'function'
      ? await canvas.convertToBlob({ type: 'image/jpeg', quality })
      : await new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality));
    return blob && blob.size ? blob : null;
  } catch {
    return null;
  } finally {
    try { bmp.close && bmp.close(); } catch { /* egal */ }
  }
}
async function blobToDataUrl(blob, mime) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return `data:${mime || 'application/octet-stream'};base64,${btoa(bin)}`;
}
const xmlEsc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function placeholderPhoto(title, sub, hue) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">`
    + `<rect width="800" height="600" fill="hsl(${hue},28%,90%)"/>`
    + `<rect x="36" y="36" width="728" height="528" rx="28" fill="none" stroke="hsl(${hue},22%,62%)" stroke-width="6" stroke-dasharray="20 14"/>`
    + `<text x="400" y="292" font-family="system-ui,Segoe UI,Arial,sans-serif" font-size="44" font-weight="700" text-anchor="middle" fill="hsl(${hue},32%,24%)">${xmlEsc(title)}</text>`
    + `<text x="400" y="350" font-family="system-ui,Segoe UI,Arial,sans-serif" font-size="28" text-anchor="middle" fill="hsl(${hue},18%,42%)">${xmlEsc(sub)}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
function resolveStorage(s) {
  if (s !== undefined) return s;   // null = nur Speicher
  try {
    const ls = globalThis.localStorage;
    if (!ls) return null;
    const k = '__lgr_probe__';
    ls.setItem(k, '1');
    ls.removeItem(k);
    return ls;
  } catch {
    return null;
  }
}
function emptyDb() {
  return {
    version: VERSION,
    seq: { movement: 0, audit: 0 },
    session: null,
    auth: {},                     // userId → { password } (nur für selbst registrierte Demo-Konten)
    profiles: [], locations: [], articles: [], machines: [], loans: [], stock_movements: [],
    attachments: [], files: {},   // files: path → data:-URL
    inventories: [], inventory_counts: [], inventory_machine_checks: [], audit_log: [],
    // «Lager organisieren»
    categories: [], photos: [], detections: [], photo_hotspots: [], org_tasks: [], set_components: [], floor_plans: [],
    sites: [],
    shopping_items: [],           // Einkaufsliste
    machine_supplies: [],         // Bedarf je Maschine (Maschine ↔ Artikel)
  };
}

// ---------------------------------------------------------------------------------------------
//  Fabrik
// ---------------------------------------------------------------------------------------------
/**
 * @param {{ LgrError?: Function, storage?: Storage|null, storageKey?: string, now?: () => number }} opts
 *   storage: undefined = localStorage (falls nutzbar), null = nur im Speicher. now: Uhr (für Tests).
 */
export function createApi({ LgrError = FallbackLgrError, storage, storageKey = STORAGE_KEY, now: nowFn = () => Date.now() } = {}) {
  const E = (code, detail) => new LgrError(code, detail);
  const store = resolveStorage(storage);
  let db = null;
  let actor = null;          // während des Aufbaus der Demodaten: handelnde Person
  let clock = null;          // während des Aufbaus der Demodaten: Zeitpunkt
  let warnedPersist = false;
  const seedErrors = [];
  const listeners = new Set();

  const nowMs = () => (clock !== null ? clock : nowFn());
  const nowIso = () => iso(nowMs());

  // ---- Speicher ----
  function persist() {
    if (!store) return;
    try {
      store.setItem(storageKey, JSON.stringify(db));
    } catch (err) {
      if (!warnedPersist) { warnedPersist = true; console.warn('[api-demo] Speichern im Browser nicht möglich, Daten nur bis zum Neuladen:', err); }
    }
  }
  function load() {
    if (db) return db;
    let raw = null;
    try { raw = store ? store.getItem(storageKey) : null; } catch { raw = null; }
    let upgraded = false;
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.machines)) {
          // ältere Stände (1: vor «Lager organisieren», 2: vor Gebäudeplan) übernehmen: fehlende Tabellen/Spalten
          // ergänzen, Startkategorien anlegen falls keine – nur additiv, nichts geht verloren
          if (Number.isInteger(parsed.version) && parsed.version >= 1 && parsed.version < VERSION) {
            upgradeDb(parsed, nowIso());
            parsed.version = VERSION;
            upgraded = true;
          }
          // Standorte kamen ohne neue Version dazu: fehlende Tabelle/Spalten bei jedem Laden ergänzen (nur additiv)
          if (parsed.version === VERSION) db = completeDb(parsed);
        }
      } catch { /* defekt → neu aufbauen */ }
    }
    if (!db) { buildSeed(); persist(); } else if (upgraded) persist();
    return db;
  }
  function read(fn) { load(); return clone(fn()); }
  function mutate(fn) {
    load();
    const { files, ...rest } = db;
    const snapshot = clone(rest);
    try {
      const result = fn();
      persist();
      return clone(result);
    } catch (err) {
      db = { ...snapshot, files };   // nichts halb gebucht lassen
      throw err;
    }
  }
  try {
    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('storage', (e) => { if (e.key === storageKey) db = null; });   // anderer Tab hat geändert
    }
  } catch { /* egal */ }

  // ---- Sitzung und Rollen ----
  const uid = () => (actor !== null ? actor : (db && db.session ? db.session.userId : null));
  const profileOf = (id) => (id ? db.profiles.find((p) => p.id === id) || null : null);
  const me = () => profileOf(uid());
  const isActive = () => { const p = me(); return !!(p && p.active); };
  const isStaff = () => { const p = me(); return !!(p && p.active && (p.role === 'admin' || p.role === 'lagerverantwortlicher')); };
  const isAdmin = () => { const p = me(); return !!(p && p.active && p.role === 'admin'); };
  // Lesen: ohne Anmeldung Fehler (wie anon in Supabase), nicht freigegeben → leere Ergebnisse (wie RLS)
  function canRead() {
    if (!me()) throw E('not_authorized');
    return isActive();
  }
  function sessionObj() {
    const p = db && db.session ? profileOf(db.session.userId) : null;
    return p ? { userId: p.id, email: p.email ?? null } : null;
  }
  function emit(event) {
    const s = sessionObj();
    for (const cb of [...listeners]) {
      setTimeout(() => {
        if (!listeners.has(cb)) return;   // inzwischen abgemeldet
        try { cb(event, s); } catch (err) { console.error(err); }
      }, 0);
    }
  }

  function audit(action, entity, entityId, details, userId = uid()) {
    db.audit_log.push({
      id: ++db.seq.audit, at: nowIso(), user_id: userId ?? null, action, entity,
      entity_id: entityId ?? null, details: details === undefined || details === null ? null : clone(details),
    });
  }
  function applyPatch(row, patch) {
    const diff = {};
    for (const [k, v] of Object.entries(patch)) {
      if (!sameVal(row[k], v)) { diff[k] = { alt: row[k] ?? null, neu: v ?? null }; row[k] = v; }
    }
    return diff;
  }
  function nextCode(table, prefix) {
    const re = new RegExp(`^${prefix}([0-9]{1,9})$`);   // wie assign_code(): höchstens 9 Ziffern
    let max = 0;
    for (const r of db[table]) { const m = re.exec(r.code); if (m) max = Math.max(max, parseInt(m[1], 10)); }
    return prefix + String(max + 1).padStart(4, '0');
  }
  function takeCode(table, prefix, given) {
    if (!given) return nextCode(table, prefix);
    if (db[table].some((r) => r.code === given)) throw E('duplicate_code');
    return given;
  }

  function toIso(v, { endOfDay = false } = {}) {
    if (v === undefined || v === null || v === '') return null;
    let d;
    if (v instanceof Date) d = new Date(v.getTime());
    else if (typeof v === 'number') d = new Date(v);
    else {
      const s = String(v).trim();
      if (DATE_ONLY_RE.test(s)) {
        const [y, mo, da] = s.split('-').map(Number);
        d = endOfDay ? new Date(y, mo - 1, da, 23, 59, 59, 999) : new Date(y, mo - 1, da);
      } else if (LOCAL_DT_RE.test(s)) d = new Date(s.replace(' ', 'T'));
      else d = new Date(s);
    }
    if (Number.isNaN(d.getTime())) throw E('invalid_dates');
    return d.toISOString();
  }
  function cleanPayload(obj, keys) {
    const out = {};
    for (const k of keys) {
      if (!has(obj, k)) continue;
      let v = obj[k];
      if (k === 'code') { v = normCode(v); if (!v) continue; }
      else if (k === 'short_code') {   // Grossbuchstaben, ohne Leerzeichen; leer → null
        v = v === null ? '' : String(v).toUpperCase().replace(/\s+/g, '');
        if (!v) v = null;
        else if (!SHORT_CODE_RE.test(v)) throw E('invalid_short_code', v);
      } else if (k === 'product_url') {
        v = trimOrNull(v);
        if (v !== null && !URL_RE.test(v)) throw E('invalid_url');
      } else if (k === 'name') v = v === null ? '' : String(v).trim();
      else if (BOOL_COLS.has(k)) v = Boolean(v);
      else if (k === 'battery_count') {   // machines_battery_count_chk: leer oder ganze Zahl 0–50
        v = num(v);
        if (Number.isNaN(v) || (v !== null && (!Number.isInteger(v) || v < 0 || v > 50))) throw E('invalid_batteries');
      } else if (k === 'battery_type') {   // machines_battery_type_chk: höchstens 120 Zeichen
        v = trimOrNull(v);
        if (v !== null && v.length > 120) throw E('invalid_value', 'battery_type');
      } else if (NUM_COLS.has(k)) {
        v = num(v);
        if (Number.isNaN(v) || (v !== null && v < 0)) throw E('invalid_qty');
        // articles_reorder_qty_chk: leer oder 0 < n < 1e9
        if (k === 'reorder_qty' && v !== null && !(v > 0 && v < 1e9)) throw E('invalid_qty');
        if (v === null && k === 'stock') continue;
      } else if (REF_COLS.has(k)) v = v ? String(v) : null;
      else if (ENUM_COLS.has(k)) { v = v === null ? '' : String(v).trim(); if (!v) continue; }
      else v = trimOrNull(v);
      out[k] = v;
    }
    return out;
  }
  function validateSave(payload, isNew, prefix) {
    if ((isNew || has(payload, 'name')) && !payload.name) throw E('name_required');
    if (isNew && payload.code) {   // wie assign_code(): Präfix bestimmt beim Scannen den Typ
      const c = payload.code;
      const ok = !/\s/.test(c) && (prefix === 'INV-' ? !c.startsWith('M-') && !c.startsWith('L-') : c.startsWith(prefix));
      if (!ok) throw E('invalid_code', c);
    }
  }
  const locExists = (id) => db.locations.some((l) => l.id === id);
  function assertNoCycle(id, parentId) {
    let cur = parentId;
    let steps = 0;
    while (cur) {
      if (cur === id) throw E('location_cycle');
      const p = db.locations.find((l) => l.id === cur);
      cur = p ? p.parent_id : null;
      if (++steps > 60) throw E('location_cycle');
    }
  }
  function assertCodeUnchanged(row, obj) {
    if (!row || !has(obj, 'code') || !isActive()) return;
    const c = normCode(obj.code);
    if (c && c !== row.code) throw E('code_immutable');
  }
  // Fremdschlüssel der neuen Spalten (Fehlerzuordnung wie api-supabase.js: responsible/cover_photo/category → not_found)
  function assertOrgRefs(table, p) {
    if (p.category_id && !db.categories.some((c) => c.id === p.category_id)) throw E('not_found');
    if (p.responsible_id && !profileOf(p.responsible_id)) throw E('not_found');
    if (p.cover_photo_id && !db.photos.some((ph) => ph.id === p.cover_photo_id)) throw E('not_found');
    if (p.site_id && !db.sites.some((s) => s.id === p.site_id)) throw E('not_found');   // Standort (locations_site_id_fkey)
  }
  // Kurzcode eindeutig je Ebene (locations_short_code_uniq: coalesce(parent_id, 0) + short_code)
  function assertShortCodeFree(id, parentId, shortCode) {
    if (!shortCode) return;
    const parent = parentId || null;
    if (db.locations.some((l) => l.id !== id && (l.parent_id || null) === parent && l.short_code === shortCode)) {
      throw E('duplicate_short_code');
    }
  }

  // ---- Ansichten (wie die SQL-Views) ----
  function pathIndex() {
    const byParent = new Map();
    for (const l of db.locations) {
      const k = l.parent_id || null;
      if (!byParent.has(k)) byParent.set(k, []);
      byParent.get(k).push(l);
    }
    // wie location_paths: Pfad, Tiefe, Raum (root_id) und code_path («HL-RG01-FA02», nur wenn jede Ebene einen Kurzcode hat);
    // site = Standort des Raums (location_overview.space_site_id) – steht nicht im Code
    const idx = new Map();
    const stack = (byParent.get(null) || []).map((l) => ({
      l, path: l.name, depth: 0, trail: [l.id], code: l.short_code || null, root: l.id, site: l.site_id || null,
    }));
    while (stack.length) {
      const { l, path, depth, trail, code, root, site } = stack.pop();
      idx.set(l.id, { path, depth, code, root, site });
      for (const c of byParent.get(l.id) || []) {
        if (trail.includes(c.id)) continue;
        stack.push({
          l: c, path: `${path} / ${c.name}`, depth: depth + 1, trail: [...trail, c.id],
          code: code && c.short_code ? `${code}-${c.short_code}` : null, root, site,
        });
      }
    }
    return idx;
  }
  function photoIndex(entity) {
    const best = new Map();
    for (const a of db.attachments) {
      if (a.entity !== entity || a.kind !== 'photo') continue;
      const cur = best.get(a.entity_id);
      if (!cur || (a.is_primary && !cur.is_primary)
          || (a.is_primary === cur.is_primary && ms(a.created_at) < ms(cur.created_at))) best.set(a.entity_id, a);
    }
    return (id) => (best.has(id) ? best.get(id).path : null);
  }
  function viewCtx() {
    const paths = pathIndex();
    const names = new Map(db.profiles.map((p) => [p.id, p.full_name]));
    const machines = new Map(db.machines.map((m) => [m.id, m]));
    const articles = new Map(db.articles.map((a) => [a.id, a]));
    const openLoan = new Map();
    const lastLoan = new Map();
    for (const l of db.loans) {
      if (!l.returned_at) openLoan.set(l.machine_id, l);
      else {
        const cur = lastLoan.get(l.machine_id);
        if (!cur || ms(l.returned_at) > ms(cur.returned_at)) lastLoan.set(l.machine_id, l);
      }
    }
    return {
      t: nowMs(),
      path: (id) => (id && paths.has(id) ? paths.get(id).path : null),
      depth: (id) => (id && paths.has(id) ? paths.get(id).depth : null),
      codePath: (id) => (id && paths.has(id) ? paths.get(id).code : null),
      rootId: (id) => (id && paths.has(id) ? paths.get(id).root : null),
      spaceSiteId: (id) => (id && paths.has(id) ? paths.get(id).site : null),
      name: (id) => (id && names.has(id) ? names.get(id) : null),
      machines, articles, openLoan, lastLoan,
      photo: { article: photoIndex('article'), machine: photoIndex('machine'), location: photoIndex('location') },
      org: orgViewIndex(db),   // Kategorie-Pfade, Fotos, Foto der Erkennung, Anzahl Set-Komponenten
    };
  }
  function vLocation(l, c) {
    const cover = c.org.photoPath(l.cover_photo_id);
    const site = c.spaceSiteId(l.id);
    return {
      ...pick(l, LOCATION_COLS), path: c.path(l.id), depth: c.depth(l.id), code_path: c.codePath(l.id), root_id: c.rootId(l.id),
      photo_path: cover ?? c.photo.location(l.id),   // Übersichtsfoto, sonst Hauptfoto der Anhänge
      cover_photo_path: cover,
      responsible_name: c.name(l.responsible_id),
      organized_by_name: c.name(l.organized_by),
      space_site_id: site,                           // Standort des Raums (auch für Möbel/Unterorte)
      site_name: c.org.siteName(site),
    };
  }
  // Punkt des Objekts im Originalfoto – nur wenn kein eigenes Bild (wie photo_pos_x/photo_pos_y der Ansichten)
  const detFocus = (c, kind, id) => (c.photo[kind](id) ? { x: null, y: null } : c.org.detectionPos[kind](id));
  const vArticle = (a, c) => {
    const f = detFocus(c, 'article', a.id);
    return {
      ...pick(a, ARTICLE_COLS),
      location_path: c.path(a.location_id),
      location_code_path: c.codePath(a.location_id),
      category_path: c.org.categoryPath(a.category_id),
      low_stock: a.min_stock !== null && a.min_stock !== undefined && a.stock <= a.min_stock,
      photo_path: c.photo.article(a.id) ?? c.org.detectionPhoto.article(a.id),
      photo_pos_x: f.x,
      photo_pos_y: f.y,
    };
  };
  function vMachine(m, c) {
    const o = c.openLoan.get(m.id) || null;
    const l = c.lastLoan.get(m.id) || null;
    return {
      ...pick(m, MACHINE_COLS),
      location_path: c.path(m.home_location_id),
      location_code_path: c.codePath(m.home_location_id),
      category_path: c.org.categoryPath(m.category_id),
      responsible_name: c.name(m.responsible_id),
      component_count: c.org.componentCount(m.id),
      open_loan_id: o ? o.id : null,
      open_borrower_id: o ? o.borrower_id : null,
      open_borrower_name: o ? c.name(o.borrower_id) : null,
      open_since: o ? o.checked_out_at : null,
      open_due_at: o ? o.due_at : null,
      overdue: !!(o && o.due_at && ms(o.due_at) < c.t),
      last_borrower_id: l ? l.borrower_id : null,
      last_borrower_name: l ? c.name(l.borrower_id) : null,
      last_checked_out_at: l ? l.checked_out_at : null,
      last_returned_at: l ? l.returned_at : null,
      last_returned_by_name: l ? c.name(l.returned_by) : null,
      last_return_condition: l ? l.return_condition : null,
      open_batteries_out: o ? o.batteries_out ?? null : null,
      last_batteries_out: l ? l.batteries_out ?? null : null,
      last_batteries_back: l ? l.batteries_back ?? null : null,
      photo_path: c.photo.machine(m.id) ?? c.org.detectionPhoto.machine(m.id),   // sonst Originalfoto der Erkennung
      photo_pos_x: detFocus(c, 'machine', m.id).x,
      photo_pos_y: detFocus(c, 'machine', m.id).y,
    };
  }
  function vLoan(l, c) {
    const m = c.machines.get(l.machine_id);
    return {
      ...pick(l, LOAN_COLS),
      machine_code: m ? m.code : null,
      machine_name: m ? m.name : null,
      machine_status: m ? m.status : null,
      borrower_name: c.name(l.borrower_id),
      returned_by_name: c.name(l.returned_by),
      created_by_name: c.name(l.created_by),
      overdue: !l.returned_at && !!l.due_at && ms(l.due_at) < c.t,
    };
  }
  function vMovement(mv, c) {
    const a = c.articles.get(mv.article_id);
    return {
      ...pick(mv, MOVEMENT_COLS),
      article_code: a ? a.code : null,
      article_name: a ? a.name : null,
      unit: a ? a.unit : null,
      user_name: c.name(mv.user_id),
      from_path: c.path(mv.from_location_id),
      to_path: c.path(mv.to_location_id),
    };
  }
  // shopping_overview: Eintrag + Angaben aus article_overview + Namen (wer eingetragen / bestellt / besorgt)
  function vShopping(s, c) {
    const a = s.article_id && c.articles.has(s.article_id) ? vArticle(c.articles.get(s.article_id), c) : null;
    const f = (k) => (a ? a[k] ?? null : null);
    return {
      ...pick(s, SHOPPING_COLS),
      article_code: f('code'), article_stock: f('stock'), article_min_stock: f('min_stock'),
      article_reorder_qty: f('reorder_qty'), article_unit: f('unit'), article_archived: f('archived'),
      article_product_url: f('product_url'), article_location_path: f('location_path'),
      article_location_code_path: f('location_code_path'), article_photo_path: f('photo_path'),
      created_by_name: c.name(s.created_by), ordered_by_name: c.name(s.ordered_by), done_by_name: c.name(s.done_by),
    };
  }
  // machine_supply_overview: Verknüpfung + Angaben aus article_overview und machine_overview (innere Joins:
  // beide Seiten gibt es immer, weil Löschen die Verknüpfung mitnimmt)
  function vSupply(s, c) {
    const a = c.articles.has(s.article_id) ? vArticle(c.articles.get(s.article_id), c) : null;
    const m = c.machines.has(s.machine_id) ? vMachine(c.machines.get(s.machine_id), c) : null;
    if (!a || !m) return null;
    return {
      ...pick(s, SUPPLY_COLS),
      article_code: a.code, article_name: a.name, article_unit: a.unit, article_stock: a.stock,
      article_min_stock: a.min_stock, article_low_stock: a.low_stock, article_archived: a.archived,
      article_notes: a.notes, article_location_path: a.location_path,
      article_location_code_path: a.location_code_path, article_photo_path: a.photo_path,
      machine_code: m.code, machine_name: m.name, machine_archived: m.archived,
      machine_location_path: m.location_path, machine_photo_path: m.photo_path,
    };
  }
  function getView(kind, col, val) {
    if (!canRead()) return null;
    if (col === 'id' && !isUuid(val)) return null;
    if (col === 'code') { val = normCode(val); if (!val) return null; }
    const table = { location: 'locations', machine: 'machines', article: 'articles' }[kind];
    const row = db[table].find((r) => r[col] === val);
    if (!row) return null;
    const c = viewCtx();
    return kind === 'location' ? vLocation(row, c) : kind === 'machine' ? vMachine(row, c) : vArticle(row, c);
  }

  // ---- Stammdaten ----
  function coreSaveLocation(obj) {
    if (!obj || typeof obj !== 'object') throw E('invalid_value');
    if (!obj.id) {
      const p = cleanPayload(obj, LOCATION_INSERT);
      validateSave(p, true, 'L-');
      if (!isStaff()) throw E('not_authorized');
      const type = p.type ?? 'lager';
      if (!LOCATION_TYPES.includes(type)) throw E('invalid_type');
      const parent = p.parent_id ?? null;
      if (parent && !locExists(parent)) throw E('invalid_location');
      // location_site_top_only (Trigger vor der Fremdschlüsselprüfung): ein Unterort hat keinen eigenen Standort
      if (parent && has(p, 'site_id')) p.site_id = null;
      assertOrgRefs('locations', p);
      const code = takeCode('locations', 'L-', p.code);
      assertShortCodeFree(null, parent, p.short_code);
      const t = nowIso();
      const row = {
        id: uuid(), code, name: p.name, type, parent_id: parent,
        notes: p.notes ?? null, archived: p.archived ?? false, created_by: uid(), created_at: t, updated_at: t,
        short_code: p.short_code ?? null, responsible_id: p.responsible_id ?? null, organized_at: null, organized_by: null,
        cover_photo_id: p.cover_photo_id ?? null, site_id: p.site_id ?? null,
      };
      db.locations.push(row);
      audit('insert', 'locations', row.id, omit(row, ['created_at', 'updated_at']));
      return row.id;
    }
    const row = db.locations.find((l) => l.id === obj.id) || null;
    assertCodeUnchanged(row, obj);
    const p = cleanPayload(obj, LOCATION_UPDATE);
    validateSave(p, false, 'L-');
    if (!Object.keys(p).length) { if (!row || !canRead()) throw E('not_found'); return row.id; }
    if (!row) throw E('not_found');
    if (!isStaff()) throw E('not_authorized');
    if (has(p, 'type') && !LOCATION_TYPES.includes(p.type)) throw E('invalid_type');
    if (has(p, 'parent_id')) {
      if (p.parent_id && !locExists(p.parent_id)) throw E('invalid_location');
      assertNoCycle(row.id, p.parent_id);
    }
    // location_site_top_only: wird ein Lagerort untergeordnet (oder ist er es schon), fällt sein Standort weg
    if ((has(p, 'parent_id') ? p.parent_id : row.parent_id) && (has(p, 'site_id') || row.site_id)) p.site_id = null;
    assertOrgRefs('locations', p);
    if (has(p, 'short_code') || has(p, 'parent_id')) {
      assertShortCodeFree(row.id, has(p, 'parent_id') ? p.parent_id : row.parent_id, has(p, 'short_code') ? p.short_code : row.short_code);
    }
    const diff = applyPatch(row, p);
    row.updated_at = nowIso();
    if (Object.keys(diff).length) audit('update', 'locations', row.id, diff);
    return row.id;
  }

  function coreSaveArticle(obj) {
    if (!obj || typeof obj !== 'object') throw E('invalid_value');
    if (!obj.id) {
      const p = cleanPayload(obj, ARTICLE_INSERT);
      validateSave(p, true, 'INV-');
      if (!isStaff()) throw E('not_authorized');
      if (p.location_id && !locExists(p.location_id)) throw E('invalid_location');
      assertOrgRefs('articles', p);
      const t = nowIso();
      const row = { id: uuid(), code: takeCode('articles', 'INV-', p.code) };
      for (const k of ARTICLE_INSERT) if (k !== 'code') row[k] = p[k] ?? null;
      row.unit = p.unit ?? 'Stk';
      row.stock = p.stock ?? 0;
      row.archived = p.archived ?? false;
      Object.assign(row, { created_by: uid(), created_at: t, updated_at: t });
      db.articles.push(row);
      audit('insert', 'articles', row.id, omit(row, ['created_at', 'updated_at']));
      if (row.stock > 0) {   // Trigger «article_initial_movement»
        db.stock_movements.push({
          id: ++db.seq.movement, article_id: row.id, type: 'anlage', qty: row.stock, stock_before: 0, stock_after: row.stock,
          from_location_id: null, to_location_id: row.location_id, user_id: uid(), note: null, request_id: null, created_at: t,
        });
      }
      return row.id;
    }
    const row = db.articles.find((a) => a.id === obj.id) || null;
    assertCodeUnchanged(row, obj);
    const p = cleanPayload(obj, ARTICLE_UPDATE);
    validateSave(p, false, 'INV-');
    if (!Object.keys(p).length) { if (!row || !canRead()) throw E('not_found'); return row.id; }
    if (!row) throw E('not_found');
    if (!isStaff()) throw E('not_authorized');
    if (p.location_id && !locExists(p.location_id)) throw E('invalid_location');
    assertOrgRefs('articles', p);
    const diff = applyPatch(row, p);
    row.updated_at = nowIso();
    if (Object.keys(diff).length) audit('update', 'articles', row.id, diff);
    return row.id;
  }

  function coreSaveMachine(obj) {
    if (!obj || typeof obj !== 'object') throw E('invalid_value');
    if (!obj.id) {
      const p = cleanPayload(obj, MACHINE_INSERT);
      validateSave(p, true, 'M-');
      if (!isStaff()) throw E('not_authorized');
      const status = p.status ?? 'verfuegbar';
      if (status === 'ausgeliehen' || !MACHINE_STATUS.includes(status)) throw E('invalid_status');
      const condition = p.condition ?? 'ok';
      if (!CONDITIONS.includes(condition)) throw E('invalid_condition');
      if (p.home_location_id && !locExists(p.home_location_id)) throw E('invalid_location');
      assertOrgRefs('machines', p);
      const t = nowIso();
      const row = { id: uuid(), code: takeCode('machines', 'M-', p.code) };
      for (const k of MACHINE_INSERT) if (k !== 'code') row[k] = p[k] ?? null;
      Object.assign(row, {
        status, condition, archived: p.archived ?? false, is_set: p.is_set ?? false, created_by: uid(), created_at: t, updated_at: t,
      });
      db.machines.push(row);
      audit('insert', 'machines', row.id, omit(row, ['created_at', 'updated_at']));
      return row.id;
    }
    const row = db.machines.find((m) => m.id === obj.id) || null;
    assertCodeUnchanged(row, obj);
    const p = cleanPayload(obj, MACHINE_UPDATE);
    validateSave(p, false, 'M-');
    if (!Object.keys(p).length) { if (!row || !canRead()) throw E('not_found'); return row.id; }
    if (!row) throw E('not_found');
    if (!isStaff()) throw E('not_authorized');
    if (has(p, 'condition') && !CONDITIONS.includes(p.condition)) throw E('invalid_condition');
    if (p.home_location_id && !locExists(p.home_location_id)) throw E('invalid_location');
    assertOrgRefs('machines', p);
    const diff = applyPatch(row, p);
    row.updated_at = nowIso();
    if (Object.keys(diff).length) audit('update', 'machines', row.id, diff);
    return row.id;
  }

  function purgeAttachments(entity, entityId) {
    const gone = db.attachments.filter((a) => a.entity === entity && a.entity_id === entityId);
    if (!gone.length) return;
    db.attachments = db.attachments.filter((a) => !(a.entity === entity && a.entity_id === entityId));
    for (const a of gone) { delete db.files[a.path]; audit('delete', 'attachments', a.id, a); }
  }
  function coreDelete(table, entity, id, inUse) {
    const row = isUuid(id) ? db[table].find((r) => r.id === id) : null;
    if (!row) throw E('not_found');
    if (!isAdmin()) throw E('not_authorized');
    if (inUse(row)) throw E('in_use');   // Fremdschlüssel «on delete restrict»
    db[table] = db[table].filter((r) => r.id !== id);
    audit('delete', table, id, row);
    purgeAttachments(entity, id);
  }

  // ---- Maschinen: Ausleihe ----
  // Anzahl Akkus (loans_batteries_chk): leer → null, sonst ganze Zahl 0–50
  function batteryArg(v) {
    if (v === undefined || v === null || v === '') return null;
    const n = typeof v === 'number' ? v : Number(String(v).trim());
    if (!Number.isInteger(n) || n < 0 || n > 50) throw E('invalid_batteries');
    return n;
  }

  function coreCheckout(machineId, { requestId, dueAt, note, borrowerId, batteries } = {}) {
    if (!isActive()) throw E('not_authorized');
    const bat = batteryArg(batteries);
    const self = uid();
    const borrower = borrowerId || self;
    if (borrower !== self) {
      if (!isStaff()) throw E('not_authorized');
      const bp = profileOf(borrower);
      if (!bp || !bp.active) throw E('invalid_borrower');
    }
    const m = db.machines.find((x) => x.id === machineId);
    if (!m || m.archived) throw E('not_found');
    if (requestId) {
      const prev = db.loans.find((l) => l.checkout_request === requestId);
      if (prev) return prev;                       // gleicher Scan noch einmal: nichts doppelt buchen
    }
    if (m.status === 'reserviert' && !isStaff()) throw E('reserved');
    if (m.status !== 'verfuegbar' && m.status !== 'reserviert') throw E('not_available', m.status);
    const due = toIso(dueAt, { endOfDay: true });
    if (due && ms(due) < nowMs() - 5 * 60 * 1000) throw E('due_in_past');
    if (db.loans.some((l) => l.machine_id === m.id && !l.returned_at)) throw E('not_available', 'ausgeliehen');
    const loan = {
      id: uuid(), machine_id: m.id, borrower_id: borrower, checked_out_at: nowIso(), due_at: due,
      checkout_note: trimOrNull(note), returned_at: null, returned_by: null, return_condition: null, return_note: null,
      checkout_request: requestId || null, return_request: null, corrected: false, created_by: self,
      batteries_out: bat, batteries_back: null,
    };
    db.loans.push(loan);
    m.status = 'ausgeliehen';
    m.updated_at = nowIso();
    audit('ausleihen', 'machines', m.id, { loan: loan.id, borrower, due, akkus: bat });
    return loan;
  }

  function coreReturn(machineId, { requestId, condition, note, batteries } = {}) {
    if (!isActive()) throw E('not_authorized');
    const cond = condition || 'ok';
    if (!CONDITIONS.includes(cond)) throw E('invalid_condition');
    const n = trimOrNull(note);
    if (cond !== 'ok' && !n) throw E('note_required');
    const bat = batteryArg(batteries);
    const m = db.machines.find((x) => x.id === machineId);
    if (!m) throw E('not_found');
    if (requestId) {
      const prev = db.loans.find((l) => l.return_request === requestId);
      if (prev) return prev;
    }
    const l = db.loans.find((x) => x.machine_id === m.id && !x.returned_at);
    if (!l) throw E('not_on_loan');
    // fehlen Akkus, ist eine Notiz Pflicht (wo sind sie?)
    if (bat !== null && l.batteries_out != null && bat < l.batteries_out && !n) throw E('batteries_note_required');
    const t = iso(Math.max(nowMs(), ms(l.checked_out_at)));   // greatest(now(), checked_out_at)
    Object.assign(l, { returned_at: t, returned_by: uid(), return_condition: cond, return_note: n, return_request: requestId || null,
      batteries_back: bat });
    m.status = cond === 'defekt' ? 'defekt' : 'verfuegbar';
    m.condition = cond;
    m.condition_note = n ?? (cond === 'ok' ? null : m.condition_note);
    m.updated_at = t;
    audit('zurueckgeben', 'machines', m.id, {
      loan: l.id, borrower: l.borrower_id, condition: cond, note: n, stellvertretend: l.borrower_id !== uid(),
      akkus_mit: l.batteries_out ?? null, akkus_zurueck: bat,
    });
    return l;
  }

  function coreSetStatus(machineId, status, note) {
    if (!isStaff()) throw E('not_authorized');
    if (!SETTABLE_STATUS.includes(status)) throw E('invalid_status');
    const m = db.machines.find((x) => x.id === machineId);
    if (!m) throw E('not_found');
    if (m.status === 'ausgeliehen' || db.loans.some((l) => l.machine_id === m.id && !l.returned_at)) throw E('on_loan');
    const old = m.status;
    const n = trimOrNull(note);
    const repaired = status === 'verfuegbar' && m.condition === 'defekt';
    m.status = status;
    if (status === 'defekt') m.condition = 'defekt';
    else if (repaired) m.condition = 'ok';
    m.condition_note = repaired ? n : (n ?? m.condition_note);   // repariert: alte Schadensnotiz weg
    m.updated_at = nowIso();
    audit('status', 'machines', m.id, { alt: old, neu: status, note: n });
    return m;
  }

  function coreCorrectLoan(loanId, { checked_out_at, due_at, returned_at, reason } = {}) {
    if (!isAdmin()) throw E('not_authorized');
    const why = trimOrNull(reason);
    if (!why) throw E('reason_required');
    const l = db.loans.find((x) => x.id === loanId);
    if (!l) throw E('not_found');
    const old = { ...l };
    const m = db.machines.find((x) => x.id === l.machine_id);
    // undefined = Wert behalten, null = leeren (Ausleihdatum kann nicht geleert werden)
    const co = (checked_out_at === undefined ? null : toIso(checked_out_at)) ?? old.checked_out_at;
    const due = due_at === undefined ? old.due_at : toIso(due_at, { endOfDay: true });
    const ret = returned_at === undefined ? old.returned_at : toIso(returned_at);
    if (ret && ms(ret) < ms(co)) throw E('invalid_dates');
    const limit = nowMs() + 5 * 60 * 1000;   // Zeitpunkte in der Zukunft ergeben keinen Sinn
    if (ms(co) > limit || (ret && ms(ret) > limit)) throw E('invalid_dates');
    if (!ret && db.loans.some((x) => x.machine_id === l.machine_id && !x.returned_at && x.id !== l.id)) {
      throw E('not_available', 'ausgeliehen');
    }
    Object.assign(l, {
      checked_out_at: co,
      due_at: due,
      returned_at: ret,
      returned_by: ret === null ? null : (old.returned_at === null ? uid() : old.returned_by),
      return_condition: ret === null ? null : (old.return_condition ?? 'ok'),
      return_note: ret === null ? null : old.return_note,
      return_request: ret === null ? null : old.return_request,
      corrected: true,
    });
    if (m) {
      if (l.returned_at === null) { m.status = 'ausgeliehen'; m.updated_at = nowIso(); }
      else if (old.returned_at === null && m.status === 'ausgeliehen') { m.status = 'verfuegbar'; m.updated_at = nowIso(); }
    }
    audit('korrektur', 'loans', l.id, {
      grund: why,
      alt: { checked_out_at: old.checked_out_at, due_at: old.due_at, returned_at: old.returned_at },
      neu: { checked_out_at: l.checked_out_at, due_at: l.due_at, returned_at: l.returned_at },
    });
    return l;
  }

  // ---- Material ----
  function coreMoveStock(articleId, { type, qty, requestId, note, toLocationId } = {}) {
    if (!isActive()) throw E('not_authorized');
    if (!MOVE_TYPES.includes(type)) throw E('invalid_type');
    if ((type === 'korrektur' || type === 'umlagerung') && !isStaff()) throw E('not_authorized');
    const a = db.articles.find((x) => x.id === articleId);
    if (!a || a.archived) throw E('not_found');
    if (requestId) {
      const prev = db.stock_movements.find((mv) => mv.request_id === requestId);
      if (prev) return prev;
    }
    const n = trimOrNull(note);
    const q = num(qty);
    let delta;
    if (type === 'zugang' || type === 'entnahme') {
      if (q === null || !(q > 0)) throw E('invalid_qty');
      delta = type === 'zugang' ? q : -q;
    } else if (type === 'korrektur') {
      if (q === null || !(q >= 0)) throw E('invalid_qty');
      if (!n) throw E('reason_required');
      delta = round6(q - a.stock);
    } else {
      if (!toLocationId || !locExists(toLocationId)) throw E('invalid_location');
      delta = 0;
    }
    const after = round6(a.stock + delta);
    if (after < 0) throw E('insufficient_stock');
    const before = a.stock;
    const from = a.location_id;
    a.stock = after;
    if (type === 'umlagerung') a.location_id = toLocationId;
    a.updated_at = nowIso();
    shoppingSync(a, before);   // Trigger articles_shopping_sync (after update of stock)
    const mv = {
      id: ++db.seq.movement, article_id: a.id, type, qty: delta, stock_before: before, stock_after: after,
      from_location_id: from, to_location_id: type === 'umlagerung' ? toLocationId : from,
      user_id: uid(), note: n, request_id: requestId || null, created_at: nowIso(),
    };
    db.stock_movements.push(mv);
    return mv;
  }

  // ---- Einkaufsliste (shopping_items; Trigger shopping_item_defaults, set_updated_at, audit_row, article_shopping_sync) ----
  const shoppingOpenFor = (articleId, exceptId = null) => db.shopping_items.find((s) =>
    s.article_id === articleId && s.id !== exceptId && SHOPPING_OPEN.includes(s.status)) || null;
  function shoppingAudit(row, before) {   // audit_row: Änderungen aller Spalten ausser updated_at
    const diff = {};
    for (const k of SHOPPING_COLS) {
      if (k !== 'updated_at' && !sameVal(before[k], row[k])) diff[k] = { alt: before[k] ?? null, neu: row[k] ?? null };
    }
    if (Object.keys(diff).length) audit('update', 'shopping_items', row.id, diff);
  }
  // Neuer Eintrag (nur aktive Benutzer; Herkunft «manuell» oder – nur über article_shopping_sync – «automatisch»).
  // shopping_item_defaults: Name/Einheit vom Artikel, wenn leer; getrimmt; Ersteller = handelnde Person; Status «offen».
  function insertShopping({ article_id = null, name = null, qty = null, unit = null, note = null, source = 'manuell' }) {
    let n = name;
    let u = unit;
    if (article_id) {
      const a = db.articles.find((x) => x.id === article_id);
      if (!a) throw E('not_found');
      if (!trimOrNull(n)) n = leftChars(a.name, 200);
      if (!trimOrNull(u)) u = a.unit;
    }
    n = String(n ?? '').trim();
    u = trimOrNull(u);
    if (!n || charLen(n) > 200) throw E('name_required');                                  // shopping_items_name_check
    if (qty !== null && !(qty > 0 && qty < 1e9)) throw E('invalid_qty');                    // shopping_items_qty_check
    if (u !== null && charLen(u) > 20) throw E('invalid_value', 'shopping_items_unit_check');
    if (article_id && shoppingOpenFor(article_id)) throw E('already_on_list');              // shopping_items_open_article_uniq
    const t = nowIso();
    const row = {
      id: uuid(), article_id: article_id || null, name: n, qty, unit: u, note: trimOrNull(note), status: 'offen', source,
      created_by: uid(), created_at: t, updated_at: t, ordered_by: null, ordered_at: null, done_by: null, done_at: null,
    };
    db.shopping_items.push(row);
    audit('insert', 'shopping_items', row.id, omit(row, ['created_at', 'updated_at']));
    return row;
  }
  // Name/Menge/Einheit/Notiz ändern; Artikel, Herkunft und Zeitstempel bleiben (shopping_item_defaults bei update)
  function updateShopping(row, patch) {
    const before = { ...row };
    const next = { ...row, ...patch };
    const a = row.article_id ? db.articles.find((x) => x.id === row.article_id) : null;
    if (a) {
      if (!trimOrNull(next.name)) next.name = leftChars(a.name, 200);
      if (!trimOrNull(next.unit)) next.unit = a.unit;
    }
    next.name = String(next.name ?? '').trim();
    next.unit = trimOrNull(next.unit);
    next.note = trimOrNull(next.note);
    if (!next.name || charLen(next.name) > 200) throw E('name_required');
    if (next.unit !== null && charLen(next.unit) > 20) throw E('invalid_value', 'shopping_items_unit_check');
    if (next.note !== null && charLen(next.note) > 500) throw E('invalid_value', 'shopping_items_note_check');
    for (const k of ['name', 'qty', 'unit', 'note']) row[k] = next[k];
    row.updated_at = nowIso();
    shoppingAudit(row, before);
  }
  // Status wechseln: Stempel wie shopping_item_defaults (nur bei echtem Wechsel; sonst bleiben sie)
  function changeShoppingStatus(row, status) {
    const before = { ...row };
    if (status !== row.status) {
      if (row.article_id && SHOPPING_OPEN.includes(status) && shoppingOpenFor(row.article_id, row.id)) throw E('already_on_list');
      const t = nowIso();
      row.status = status;
      if (status === 'offen') { row.ordered_by = null; row.ordered_at = null; }
      if (status === 'bestellt') { row.ordered_by = uid(); row.ordered_at = t; }
      if (status === 'erledigt' || status === 'verworfen') { row.done_by = uid(); row.done_at = t; } else { row.done_by = null; row.done_at = null; }
    }
    row.updated_at = nowIso();
    shoppingAudit(row, before);
  }
  // article_shopping_sync: nach jeder Bestandsänderung eines Artikels mit Mindestbestand (nicht archiviert).
  // Sinkt der Bestand auf/unter den Mindestbestand → automatisch auf die Liste (ausser es gibt schon einen offenen Eintrag);
  // steigt er über den Mindestbestand → offene Einträge des Artikels «erledigt». Mindestbestand setzen allein ändert nichts.
  function shoppingSync(a, before) {
    if (a.archived || a.min_stock === null || a.min_stock === undefined || a.stock === before) return;
    if (a.stock < before && a.stock <= a.min_stock) {
      if (shoppingOpenFor(a.id)) return;   // on conflict do nothing
      const qty = a.reorder_qty ?? Math.min(Math.max(Math.ceil(round6(a.min_stock * 2 - a.stock)), 1), 999999999);
      insertShopping({ article_id: a.id, name: leftChars(a.name, 200), qty, unit: a.unit, source: 'automatisch' });
    } else if (a.stock > before && a.stock > a.min_stock) {
      for (const s of db.shopping_items) {
        if (s.article_id === a.id && SHOPPING_OPEN.includes(s.status)) changeShoppingStatus(s, 'erledigt');
      }
    }
  }
  // saveShoppingItem: Eingaben wie js/api-supabase.js prüfen, dann wie die Datenbank (RLS shopping_insert/_update)
  function coreSaveShopping(obj) {
    if (!obj || typeof obj !== 'object') throw E('invalid_value');
    const patch = {};
    if (has(obj, 'name')) { patch.name = trimOrNull(obj.name); if (patch.name && patch.name.length > 200) throw E('invalid_value'); }
    if (has(obj, 'qty')) {
      const q = num(obj.qty);
      if (Number.isNaN(q) || (q !== null && !(q > 0 && q < 1e9))) throw E('invalid_qty');
      patch.qty = q;
    }
    if (has(obj, 'unit')) { patch.unit = trimOrNull(obj.unit); if (patch.unit && patch.unit.length > 20) throw E('invalid_value'); }
    if (has(obj, 'note')) { patch.note = trimOrNull(obj.note); if (patch.note && patch.note.length > 500) throw E('invalid_value'); }
    if (!obj.id) {
      const articleId = obj.article_id || null;
      if (articleId && !isUuid(articleId)) throw E('not_found');
      if (!articleId && !patch.name) throw E('name_required');
      if (!isActive()) throw E('not_authorized');   // shopping_insert: nur aktive Benutzer
      // Herkunft ist nie wählbar (grant insert ohne source/status): immer «manuell», Status «offen»
      return insertShopping({ ...patch, article_id: articleId, source: 'manuell' }).id;
    }
    if (!isUuid(obj.id)) throw E('not_found');
    if (has(patch, 'name') && !patch.name) throw E('name_required');
    const row = db.shopping_items.find((s) => s.id === obj.id) || null;
    if (!row || !canRead()) throw E('not_found');   // für Nicht-Freigegebene unsichtbar (RLS)
    if (Object.keys(patch).length) updateShopping(row, patch);
    return row.id;
  }

  // ---- Bedarf je Maschine (machine_supplies; Trigger set_created_by, audit_row) ----
  // saveSupply: Eingaben wie js/api-supabase.js prüfen, dann wie die Datenbank (RLS machine_supplies_insert/_update:
  // nur Lagerverantwortliche/Admins; eindeutig je Maschine + Artikel; Fremdschlüssel). Ändern lässt sich nur die Notiz.
  function coreSaveSupply(obj) {
    if (!obj || typeof obj !== 'object') throw E('invalid_value');
    const note = has(obj, 'note') ? trimOrNull(obj.note) : undefined;
    if (note && note.length > SUPPLY_NOTE_MAX) throw E('invalid_value');
    if (!obj.id) {
      if (!isUuid(obj.machine_id) || !isUuid(obj.article_id)) throw E('not_found');
      if (!isStaff()) throw E('not_authorized');
      if (db.machine_supplies.some((s) => s.machine_id === obj.machine_id && s.article_id === obj.article_id)) {
        throw E('duplicate', 'supply');   // machine_supplies_pair_uniq
      }
      if (!db.machines.some((m) => m.id === obj.machine_id) || !db.articles.some((a) => a.id === obj.article_id)) throw E('not_found');
      const row = {
        id: uuid(), machine_id: obj.machine_id, article_id: obj.article_id, note: note ?? null,
        created_by: uid(), created_at: nowIso(),
      };
      db.machine_supplies.push(row);
      audit('insert', 'machine_supplies', row.id, omit(row, ['created_at']));
      return row.id;
    }
    if (!isUuid(obj.id)) throw E('not_found');
    const row = db.machine_supplies.find((s) => s.id === obj.id) || null;
    if (!row || !canRead()) throw E('not_found');   // für Nicht-Freigegebene unsichtbar (RLS)
    if (note !== undefined) {
      if (!isStaff()) throw E('not_authorized');
      const diff = applyPatch(row, { note });
      if (Object.keys(diff).length) audit('update', 'machine_supplies', row.id, diff);
    }
    return row.id;
  }

  // ---- Mitarbeiter ----
  function coreUpdateMyProfile({ full_name, lang } = {}) {
    const p = me();
    if (!p) throw E('not_authorized');
    const name = trimOrNull(full_name === undefined ? p.full_name : full_name);
    const l = lang === undefined ? p.lang : lang;
    if (!name) throw E('name_required');
    if (!LANGS.includes(l)) throw E('invalid_lang');
    p.full_name = name;
    p.lang = l;
    return p;
  }
  function coreAdminUpdateProfile(id, { full_name, role, active } = {}) {
    if (!isAdmin()) throw E('not_authorized');
    const target = profileOf(id);
    const r = role === undefined ? target && target.role : role;
    const name = trimOrNull(full_name === undefined ? target && target.full_name : full_name);
    const act = active === undefined ? !!(target && target.active) : Boolean(active);
    if (!target && (role === undefined || full_name === undefined)) throw E('not_found');
    if (!ROLES.includes(r)) throw E('invalid_role');
    if (!name) throw E('name_required');
    if (!target) throw E('not_found');
    if (target.role === 'admin' && target.active && (r !== 'admin' || !act)
        && !db.profiles.some((p) => p.role === 'admin' && p.active && p.id !== target.id)) throw E('last_admin');
    const old = { name: target.full_name, rolle: target.role, aktiv: target.active };
    Object.assign(target, { full_name: name, role: r, active: act });
    audit('mitarbeiter', 'profiles', target.id, { alt: old, neu: { name: target.full_name, rolle: target.role, aktiv: target.active } });
    return target;
  }

  // ---- Anhänge ----
  function addAttachment({ entity, entityId, kind, path, dataUrl, fileName, mime, size, note, loanId, by, isPrimary }) {
    const primary = isPrimary ?? (kind === 'photo'
      && !db.attachments.some((a) => a.entity === entity && a.entity_id === entityId && a.kind === 'photo' && a.is_primary));
    const row = {
      id: uuid(), entity, entity_id: entityId, kind, path, file_name: fileName ?? null, mime: mime ?? null,
      size_bytes: size ?? null, is_primary: primary, note: trimOrNull(note), loan_id: loanId || null,
      uploaded_by: by ?? null, created_at: nowIso(),
    };
    db.attachments.push(row);
    if (dataUrl) db.files[path] = dataUrl;
    audit('insert', 'attachments', row.id, omit(row, ['created_at']), by ?? null);
    return row;
  }

  // ---- Inventur ----
  function coreCreateInventory({ name, note, location_id } = {}) {
    const n = trimOrNull(name);
    if (!n) throw E('name_required');
    const loc = location_id ? String(location_id) : null;   // Inventur nur für einen Raum/Lagerort (optional)
    if (loc && !isUuid(loc)) throw E('invalid_location');
    if (!isStaff()) throw E('not_authorized');
    if (loc && !locExists(loc)) throw E('invalid_location');
    const inv = {
      id: uuid(), name: n, status: 'offen', note: trimOrNull(note), started_by: uid(), started_at: nowIso(),
      closed_by: null, closed_at: null, applied: false, location_id: loc,
    };
    db.inventories.push(inv);
    return inv;
  }
  const openInventory = (id) => db.inventories.find((i) => i.id === id && i.status === 'offen');
  function coreCount(inventoryId, articleId, counted) {
    if (!isActive()) throw E('not_authorized');
    const c = num(counted);
    if (c === null || !(c >= 0)) throw E('invalid_qty');
    if (!openInventory(inventoryId)) throw E('inventory_closed');
    const a = db.articles.find((x) => x.id === articleId);
    if (!a) throw E('not_found');
    let row = db.inventory_counts.find((x) => x.inventory_id === inventoryId && x.article_id === articleId);
    if (!row) {
      row = { id: uuid(), inventory_id: inventoryId, article_id: articleId };
      db.inventory_counts.push(row);
    }
    Object.assign(row, { expected: a.stock, counted: c, counted_by: uid(), counted_at: nowIso(), applied: false });
    return row;
  }
  function coreCheckMachine(inventoryId, machineId, result, note) {
    if (!isActive()) throw E('not_authorized');
    if (!CHECK_RESULTS.includes(result)) throw E('invalid_status');
    if (!openInventory(inventoryId)) throw E('inventory_closed');
    if (!db.machines.some((m) => m.id === machineId)) throw E('not_found');
    let row = db.inventory_machine_checks.find((x) => x.inventory_id === inventoryId && x.machine_id === machineId);
    if (!row) {
      row = { id: uuid(), inventory_id: inventoryId, machine_id: machineId };
      db.inventory_machine_checks.push(row);
    }
    Object.assign(row, { result, note: trimOrNull(note), checked_by: uid(), checked_at: nowIso() });
    return row;
  }
  function coreCloseInventory(inventoryId, apply) {
    if (!isStaff()) throw E('not_authorized');
    const inv = db.inventories.find((i) => i.id === inventoryId);
    if (!inv) throw E('not_found');
    if (inv.status !== 'offen') throw E('inventory_closed');
    const doApply = Boolean(apply);
    if (doApply) {
      for (const r of db.inventory_counts) {
        if (r.inventory_id !== inv.id || r.applied || r.counted === r.expected) continue;
        const a = db.articles.find((x) => x.id === r.article_id);
        if (!a) continue;
        const after = Math.max(round6(a.stock + (r.counted - r.expected)), 0);
        const before = a.stock;
        db.stock_movements.push({
          id: ++db.seq.movement, article_id: a.id, type: 'inventur', qty: round6(after - before), stock_before: before,
          stock_after: after, from_location_id: a.location_id, to_location_id: a.location_id, user_id: uid(),
          note: `Inventur: ${inv.name}`, request_id: null, created_at: nowIso(),
        });
        a.stock = after;
        a.updated_at = nowIso();
        shoppingSync(a, before);   // Trigger articles_shopping_sync
        r.applied = true;
      }
      for (const c of db.inventory_machine_checks) {
        if (c.inventory_id !== inv.id || (c.result !== 'fehlt' && c.result !== 'defekt')) continue;
        const m = db.machines.find((x) => x.id === c.machine_id);
        if (!m || m.status === 'ausgeliehen') continue;
        const neu = c.result === 'fehlt' ? 'verloren' : 'defekt';
        const alt = m.status;
        m.status = neu;
        if (c.result === 'defekt') m.condition = 'defekt';
        m.updated_at = nowIso();
        audit('status', 'machines', m.id, { alt, neu, note: `Inventur: ${inv.name}` });
      }
    }
    Object.assign(inv, { status: 'abgeschlossen', closed_by: uid(), closed_at: nowIso(), applied: doApply });
    audit('inventur', 'inventories', inv.id, { gebucht: doApply });
    return inv;
  }

  // ---------------------------------------------------------------------------------------------
  //  Demodaten (Schweizer Büro/Werkstatt). Aufgebaut mit denselben Regeln wie oben.
  // ---------------------------------------------------------------------------------------------
  function buildSeed() {
    db = emptyDb();
    seedErrors.length = 0;
    const real = nowFn();
    const base = new Date(real);
    const D = (d, h, mi = 0) => new Date(base.getFullYear(), base.getMonth(), base.getDate() + d, h, mi, 0, 0).getTime();
    // Startkategorien wie im SQL-Seed (beim Einrichten der Datenbank, vor dem ersten Konto). Keine Fotos/Erkennungen/Aufgaben.
    seedCategories(db, iso(D(-46, 17, 0)), uuid);
    const U = DEMO_USER_IDS;
    const R = {};
    const ev = [];
    const at = (t, who, fn) => ev.push({ t, who, fn, i: ev.length });
    const addProfile = (id, full_name, email, role, active, lang, t) =>
      db.profiles.push({ id, full_name, email, role, active, lang, created_at: iso(t) });
    const stockOf = (id) => db.articles.find((a) => a.id === id).stock;
    const statusOf = (id) => db.machines.find((m) => m.id === id).status;
    const photo = (entity, idKey, title, hue, who) => () => addAttachment({
      entity, entityId: R[idKey], kind: 'photo', path: `${entity}/${R[idKey]}/${uuid()}.svg`,
      dataUrl: placeholderPhoto(title, 'Demo-Foto', hue), fileName: 'demo-foto.svg', mime: 'image/svg+xml', size: 600, by: who,
    });

    // Konten: Cristian (erstes Konto → Administrator), Luca und Daniel registrieren sich und werden freigegeben.
    addProfile(U.cristian, 'Cristian', 'cristian@example.com', 'admin', true, 'de', D(-46, 17, 5));
    addProfile(U.luca, 'Luca', 'luca@example.com', 'mitarbeiter', false, 'de', D(-45, 7, 40));
    addProfile(U.daniel, 'Daniel', 'daniel@example.com', 'mitarbeiter', false, 'de', D(-45, 7, 42));
    at(D(-45, 7, 55), U.cristian, () => coreAdminUpdateProfile(U.luca, { role: 'lagerverantwortlicher', active: true }));
    at(D(-45, 7, 56), U.cristian, () => coreAdminUpdateProfile(U.daniel, { role: 'mitarbeiter', active: true }));

    // Lagerorte
    const loc = (key, minute, o) => at(D(-45, 8, minute), U.cristian, () => {
      R[key] = coreSaveLocation({ ...o, parent_id: o.parent ? R[o.parent] : null });
    });
    loc('hauptlager', 10, { name: 'Hauptlager', type: 'lager', notes: 'Werkstatt Untergeschoss' });
    loc('regalA', 11, { name: 'Regal A', type: 'regal', parent: 'hauptlager', notes: 'Kleinmaterial und Akku-Geräte' });
    loc('fach02', 12, { name: 'Fach 02', type: 'fach', parent: 'regalA' });
    loc('box03', 13, { name: 'Box 03', type: 'box', parent: 'fach02', notes: 'Schrauben und Dübel' });
    loc('regalB', 14, { name: 'Regal B', type: 'regal', parent: 'hauptlager', notes: 'Elektrowerkzeuge und Kabel' });
    loc('buero', 15, { name: 'Büro', type: 'raum', notes: '1. OG' });
    loc('lieferwagen', 16, { name: 'Lieferwagen 1', type: 'fahrzeug', notes: 'VW Crafter, Werkzeugausbau' });
    loc('schrank', 17, { name: 'Auf dem schwarzen Schrank', type: 'fach', parent: 'buero', notes: 'Encima del armario negro' });
    loc('boxCat15', 18, { name: 'Box «Cat 6 slim 1,5 m»', type: 'box', parent: 'schrank' });
    loc('boxCat20', 19, { name: 'Box «Cat 6 slim 2,0 m»', type: 'box', parent: 'schrank' });

    // Material
    const art = (key, minute, o) => at(D(-45, 9, minute), U.cristian, () => {
      R[key] = coreSaveArticle({ ...o, location_id: R[o.loc] });
    });
    const patch = {
      name: 'CAT 6 Slim UTP Patchkabel', description: 'UTP · CCA · PVC · 28 AWG · Ø 4,0 mm', category: 'Netzwerkkabel',
      brand: 'QUALY-PATCH', model: 'Cat 6 Slim', color: 'Grau', unit: 'Stk',
      usage: 'PC, Drucker oder IP-Telefon mit dem Netzwerk verbinden (Wanddose oder Switch)',
    };
    art('cat15', 0, { ...patch, art_no: "237'103", size: '1,5 m', label_text: 'CAT 6 · 1,5 m', stock: 15, min_stock: 5, loc: 'boxCat15' });
    art('cat20', 1, { ...patch, art_no: "237'104", size: '2,0 m', label_text: 'CAT 6 · 2,0 m', stock: 10, min_stock: 5, loc: 'boxCat20' });
    art('schrauben', 2, {
      name: 'Schrauben 4×40', description: 'Spanplattenschrauben, Senkkopf, Torx T20, verzinkt', category: 'Befestigung',
      brand: 'SPAX', size: '4 × 40 mm', unit: 'Stk', stock: 400, min_stock: 150, loc: 'box03',
    });
    art('kabelbinder', 3, {
      name: 'Kabelbinder 200 × 4,8 mm', description: 'Packung à 100 Stück', category: 'Elektro', color: 'Schwarz',
      size: '200 × 4,8 mm', unit: 'Pkg', stock: 12, min_stock: 4, loc: 'regalA',
    });
    art('isolierband', 4, {
      name: 'Isolierband', description: 'PVC, VDE', category: 'Elektro', brand: 'tesa', color: 'Schwarz',
      size: '19 mm × 20 m', unit: 'Rolle', stock: 10, min_stock: 4, loc: 'regalA',
    });
    art('nym', 5, {
      name: 'Kabel NYM-J 3×1,5 mm²', description: 'Installationskabel, grau', category: 'Elektro', size: '3×1,5 mm²',
      unit: 'm', stock: 100, min_stock: 50, loc: 'regalB',
    });

    // Maschinen
    const mach = (key, minute, o) => at(D(-45, 10, minute), U.cristian, () => {
      R[key] = coreSaveMachine({ ...o, home_location_id: R[o.loc] });
    });
    mach('bohrhammer', 0, {
      name: 'Bosch Bohrhammer GBH 2-28', category: 'Bohrhammer', brand: 'Bosch', model: 'GBH 2-28',
      serial_no: '611267500-0471', inventory_no: 'W-1001', loc: 'regalB', notes: 'Koffer mit SDS-plus-Bohrern 6–12 mm',
    });
    mach('hilti', 1, {
      name: 'Hilti Akku-Bohrschrauber SF 6H-A22', category: 'Akku-Bohrschrauber', brand: 'Hilti', model: 'SF 6H-A22',
      serial_no: '2207-3318', inventory_no: 'W-1002', loc: 'regalA', notes: '2 Akkus B22, Ladegerät C4/36',
    });
    mach('winkelschleifer', 2, {
      name: 'Makita Winkelschleifer GA5030R', category: 'Winkelschleifer', brand: 'Makita', model: 'GA5030R',
      serial_no: '0098412', inventory_no: 'W-1003', loc: 'regalB',
    });
    mach('tauchsaege', 3, {
      name: 'Festool Tauchsäge TS 55 FEBQ', category: 'Handkreissäge', brand: 'Festool', model: 'TS 55 FEBQ-Plus',
      serial_no: '10284417', inventory_no: 'W-1004', loc: 'hauptlager', notes: 'Führungsschiene 1400 mm im Systainer',
    });
    mach('schlagschrauber', 4, {
      name: 'Makita Akku-Schlagschrauber DTD153', category: 'Akku-Schlagschrauber', brand: 'Makita', model: 'DTD153',
      serial_no: '0457793', inventory_no: 'W-1005', loc: 'lieferwagen',
    });
    mach('disto', 5, {
      name: 'Leica Distanzmessgerät DISTO D2', category: 'Messgerät', brand: 'Leica', model: 'DISTO D2',
      serial_no: '1520-3341', inventory_no: 'W-1006', loc: 'buero',
    });
    mach('sauger', 6, {
      name: 'Kärcher Nass-/Trockensauger WD 5', category: 'Reinigung', brand: 'Kärcher', model: 'WD 5',
      serial_no: '0102-5571', inventory_no: 'W-1007', loc: 'hauptlager',
    });

    // Bedarf je Maschine: beide Akku-Schrauber brauchen die Schrauben 4×40 (einmal mit Hinweis, einmal ohne)
    at(D(-45, 10, 20), U.luca, () => coreSaveSupply({ machine_id: R.hilti, article_id: R.schrauben, note: 'Bit Torx T20' }));
    at(D(-45, 10, 21), U.luca, () => coreSaveSupply({ machine_id: R.schlagschrauber, article_id: R.schrauben }));

    // Fotos (Platzhalter)
    at(D(-45, 10, 30), U.cristian, photo('machine', 'bohrhammer', 'Bosch GBH 2-28', 210, U.cristian));
    at(D(-45, 10, 31), U.cristian, photo('machine', 'hilti', 'Hilti SF 6H-A22', 0, U.cristian));
    at(D(-45, 10, 32), U.cristian, photo('article', 'cat15', 'CAT 6 Slim · 1,5 m', 140, U.cristian));
    at(D(-45, 10, 33), U.cristian, photo('article', 'cat20', 'CAT 6 Slim · 2,0 m', 140, U.cristian));

    // Ausleihen und Bewegungen (chronologisch sortiert, siehe unten)
    const loan = (key, out, back, machineKey, who, o = {}) => {
      at(out, who, () => { R[key] = coreCheckout(R[machineKey], { dueAt: o.due ? iso(o.due) : null, note: o.note }).id; });
      if (back) at(back, o.returnedBy || who, () => coreReturn(R[machineKey], { condition: o.condition || 'ok', note: o.returnNote }));
    };
    const move = (t, who, articleKey, type, qty, note, extra = {}) =>
      at(t, who, () => coreMoveStock(R[articleKey], { type, qty, note, ...extra, toLocationId: extra.to ? R[extra.to] : undefined }));

    loan('lSauger1', D(-38, 8, 0), D(-38, 16, 40), 'sauger', U.daniel, { due: D(-38, 17, 0) });
    move(D(-20, 10, 15), U.daniel, 'schrauben', 'entnahme', 100, 'Montage Regale Büro 2. OG');
    move(D(-15, 14, 0), U.cristian, 'cat20', 'zugang', 10, 'Nachbestellung Lieferant');
    move(D(-14, 9, 0), U.luca, 'kabelbinder', 'zugang', 5, 'Lieferung, Lieferschein 48211');
    move(D(-12, 11, 20), U.daniel, 'cat15', 'entnahme', 1, 'Arbeitsplatz Empfang');
    loan('lSauger2', D(-10, 7, 30), D(-10, 12, 0), 'sauger', U.luca);
    loan('lHilti1', D(-8, 8, 0), D(-8, 16, 30), 'hilti', U.daniel, { due: D(-8, 17, 0) });
    loan('lSaege', D(-7, 9, 0), D(-7, 17, 10), 'tauchsaege', U.luca, { condition: 'maengel', returnNote: 'Kohlebürsten funken stark, Leistung lässt nach' });
    move(D(-6, 7, 45), U.luca, 'nym', 'zugang', 50, 'Lieferung Elektrogrossist');
    at(D(-6, 8, 0), U.luca, () => coreSetStatus(R.tauchsaege, 'wartung', 'Kohlebürsten ersetzen – beim Händler zur Reparatur'));
    move(D(-6, 13, 10), U.daniel, 'nym', 'entnahme', 35, 'Baustelle Seestrasse 12');
    move(D(-6, 13, 15), U.daniel, 'isolierband', 'entnahme', 2, 'Baustelle Seestrasse 12');
    move(D(-5, 8, 0), U.luca, 'kabelbinder', 'umlagerung', null, 'Neu eingeräumt', { to: 'fach02' });
    loan('lSchleifer', D(-4, 7, 30), D(-4, 16, 45), 'winkelschleifer', U.daniel, {
      due: D(-4, 17, 0), condition: 'defekt', returnNote: 'Schutzhaube gebrochen, Scheibe läuft unrund',
    });
    at(D(-4, 16, 46), U.daniel, () => addAttachment({
      entity: 'machine', entityId: R.winkelschleifer, kind: 'damage', path: `machine/${R.winkelschleifer}/${uuid()}.svg`,
      dataUrl: placeholderPhoto('Schutzhaube gebrochen', 'Schadenfoto (Demo)', 20), fileName: 'schaden.svg',
      mime: 'image/svg+xml', size: 600, note: 'Schutzhaube gebrochen', loanId: R.lSchleifer, by: U.daniel,
    }));
    move(D(-4, 10, 30), U.daniel, 'schrauben', 'entnahme', 120, 'Baustelle Seestrasse 12');
    loan('lBohr1', D(-3, 9, 15), D(-3, 15, 30), 'bohrhammer', U.luca, { due: D(-3, 17, 0) });
    loan('lSchlag', D(-2, 7, 0), null, 'schlagschrauber', U.daniel, { due: D(-1, 17, 0), note: 'Baustelle Seestrasse 12' });
    loan('lBohr2', D(-2, 8, 0), D(-2, 17, 0), 'bohrhammer', U.daniel, { due: D(-2, 17, 0) });
    loan('lHilti2', D(-2, 13, 0), D(-1, 8, 10), 'hilti', U.cristian, {
      due: D(-1, 12, 0), returnedBy: U.luca, returnNote: 'Lag im Lieferwagen 1',
    });
    at(D(-1, 11, 0), U.luca, () => coreSetStatus(R.disto, 'reserviert', 'Reserviert für Aufmass Projekt Seefeld'));
    move(D(-1, 15, 0), U.cristian, 'schrauben', 'entnahme', 50, 'Reparatur Werkbank');
    at(D(-1, 18, 20), null, () => addProfile(U.ana, 'Ana', 'ana@example.com', 'mitarbeiter', false, 'pt', D(-1, 18, 20)));

    // Offene Ausleihe heute (realistisch zum echten Datum): Cristian, Bohrhammer, seit 07:30 bis 17:00
    const since = Math.min(D(0, 7, 30), real - 20 * 60 * 1000);
    let due = D(0, 17, 0);
    if (due - real < 30 * 60 * 1000) due = D(1, 17, 0);
    loan('lBohr3', since, null, 'bohrhammer', U.cristian, { due });

    // Abgeschlossene Inventur im Vormonat
    const invDay = new Date(base.getFullYear(), base.getMonth() - 1, 25);
    const T = (h, mi) => new Date(invDay.getFullYear(), invDay.getMonth(), invDay.getDate(), h, mi).getTime();
    const invName = `Inventur ${MONTHS_DE[invDay.getMonth()]} ${invDay.getFullYear()}`;
    at(T(13, 30), U.luca, () => { R.inv = coreCreateInventory({ name: invName, note: 'Stichtagsinventur Hauptlager und Büro' }).id; });
    at(T(14, 0), U.luca, () => coreCount(R.inv, R.cat15, stockOf(R.cat15) - 1));
    at(T(14, 5), U.luca, () => coreCount(R.inv, R.cat20, stockOf(R.cat20)));
    at(T(14, 20), U.daniel, () => coreCount(R.inv, R.kabelbinder, stockOf(R.kabelbinder)));
    at(T(14, 30), U.daniel, () => coreCount(R.inv, R.isolierband, stockOf(R.isolierband) + 1));
    at(T(14, 40), U.daniel, () => coreCount(R.inv, R.schrauben, stockOf(R.schrauben)));
    ['bohrhammer', 'hilti', 'winkelschleifer', 'tauchsaege', 'schlagschrauber', 'disto', 'sauger'].forEach((k, i) => {
      at(T(15, i), U.luca, () => coreCheckMachine(R.inv, R[k], statusOf(R[k]) === 'ausgeliehen' ? 'ausgeliehen' : 'vorhanden'));
    });
    at(T(16, 30), U.luca, () => coreCloseInventory(R.inv, true));

    ev.sort((a, b) => a.t - b.t || a.i - b.i);
    for (const e of ev) {
      actor = e.who; clock = e.t;
      try { e.fn(); } catch (err) { seedErrors.push(err); console.warn('[api-demo] Demodaten:', err); }
      finally { actor = null; clock = null; }
    }
    db.session = { userId: U.cristian };   // Start: angemeldet als erster Demo-Benutzer
  }

  // ---------------------------------------------------------------------------------------------
  //  Öffentliche API
  // ---------------------------------------------------------------------------------------------
  const api = {
    mode: 'demo',

    async init() { load(); },
    async getSession() { load(); return sessionObj(); },
    onAuthChange(cb) {
      if (typeof cb !== 'function') return () => {};
      listeners.add(cb);
      return () => { listeners.delete(cb); };
    },
    async signIn(email, password) {
      load();
      const e = String(email ?? '').trim().toLowerCase();
      const p = db.profiles.find((x) => String(x.email || '').toLowerCase() === e);
      if (!p || !password) throw E('auth_invalid');
      const cred = db.auth[p.id];
      if (cred && cred.password && cred.password !== String(password)) throw E('auth_invalid');
      db.session = { userId: p.id };
      persist();
      emit('SIGNED_IN');
      return sessionObj();
    },
    async signUp({ fullName, email, password, lang } = {}) {
      load();
      const e = String(email ?? '').trim();
      if (!EMAIL_RE.test(e)) throw E('invalid_email');
      if (!password || String(password).length < 6) throw E('weak_password');
      if (db.profiles.some((x) => String(x.email || '').toLowerCase() === e.toLowerCase())) throw E('auth_exists');
      const first = db.profiles.length === 0;
      const p = {
        id: uuid(), full_name: trimOrNull(fullName) || e.split('@')[0], email: e,
        role: first ? 'admin' : 'mitarbeiter', active: first, lang: LANGS.includes(lang) ? lang : 'de', created_at: nowIso(),
      };
      db.profiles.push(p);
      db.auth[p.id] = { password: String(password) };
      db.session = { userId: p.id };       // Demo: keine E-Mail-Bestätigung
      persist();
      emit('SIGNED_IN');
      return { needsConfirmation: false };
    },
    async signOut() {
      load();
      db.session = null;
      persist();
      emit('SIGNED_OUT');
    },
    async resetPassword(email) {
      if (!EMAIL_RE.test(String(email ?? '').trim())) throw E('invalid_email');
      // Demo: keine E-Mail. Wie bei Supabase kein Hinweis, ob das Konto existiert.
    },
    async updatePassword(newPassword) {
      load();
      const self = uid();
      if (!self) throw E('not_authorized');
      if (!newPassword || String(newPassword).length < 6) throw E('weak_password');
      db.auth[self] = { password: String(newPassword) };
      persist();
      emit('USER_UPDATED');
    },
    async getMyProfile() { return read(() => { const p = me(); return p ? pick(p, PROFILE_COLS) : null; }); },
    async updateMyProfile(fields) { return mutate(() => pick(coreUpdateMyProfile(fields), PROFILE_COLS)); },

    async demoUsers() { return read(() => db.profiles.map((p) => pick(p, PROFILE_COLS))); },
    async demoSwitchUser(id) {
      load();
      if (!profileOf(id)) throw E('not_found');
      db.session = { userId: id };
      persist();
      emit('SIGNED_IN');
      return sessionObj();
    },
    async demoReset() {
      buildSeed();
      persist();
      emit('SIGNED_IN');
    },

    async listProfiles() {
      return read(() => {
        const rows = canRead() ? db.profiles : db.profiles.filter((p) => p.id === uid());
        return sortRows(rows.map((p) => pick(p, PROFILE_COLS)), 'full_name', 'email');
      });
    },
    async adminUpdateProfile(id, fields) { return mutate(() => pick(coreAdminUpdateProfile(id, fields), PROFILE_COLS)); },

    // ---- Einladungen (nur Administratoren) ----
    async listInvites() {
      return read(() => {
        if (!isAdmin()) return [];
        return (db.invites || []).slice().sort((a, b) => a.email.localeCompare(b.email));
      });
    },
    async addInvite(email, role = 'mitarbeiter') {
      return mutate(() => {
        if (!isAdmin()) throw E('not_authorized');
        const e = String(email || '').trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw E('invalid_email');
        if (!ROLES.includes(role)) throw E('invalid_role');
        db.invites = db.invites || [];
        if (db.invites.some((i) => i.email === e)) throw E('duplicate');
        const row = { email: e, role, created_at: nowIso() };
        db.invites.push(row);
        return { ...row };
      });
    },
    async deleteInvite(email) {
      return mutate(() => {
        if (!isAdmin()) throw E('not_authorized');
        const e = String(email || '').trim().toLowerCase();
        const i = (db.invites || []).findIndex((x) => x.email === e);
        if (i < 0) throw E('not_found');
        db.invites.splice(i, 1);
      });
    },

    // ---- Lagerorte ----
    async listLocations({ includeArchived = false } = {}) {
      return read(() => {
        if (!canRead()) return [];
        const c = viewCtx();
        return sortRows(db.locations.filter((l) => includeArchived || !l.archived).map((l) => vLocation(l, c)), 'path');
      });
    },
    async getLocation(id) { return read(() => getView('location', 'id', id)); },
    async getLocationByCode(code) { return read(() => getView('location', 'code', code)); },
    async saveLocation(obj) { return mutate(() => getView('location', 'id', coreSaveLocation(obj))); },
    async deleteLocation(id) {
      return mutate(() => {
        coreDelete('locations', 'location', id, (l) =>
          db.locations.some((x) => x.parent_id === l.id)
          || db.articles.some((a) => a.location_id === l.id)
          || db.machines.some((m) => m.home_location_id === l.id)
          || db.stock_movements.some((mv) => mv.from_location_id === l.id || mv.to_location_id === l.id)
          || orgInUse(db, 'locations', l.id));
        orgAfterDelete(db, 'locations', id, audit);
      });
    },

    // ---- Maschinen ----
    async listMachines({ includeArchived = false } = {}) {
      return read(() => {
        if (!canRead()) return [];
        const c = viewCtx();
        return sortRows(db.machines.filter((m) => includeArchived || !m.archived).map((m) => vMachine(m, c)), 'name');
      });
    },
    async getMachine(id) { return read(() => getView('machine', 'id', id)); },
    async getMachineByCode(code) { return read(() => getView('machine', 'code', code)); },
    async saveMachine(obj) { return mutate(() => getView('machine', 'id', coreSaveMachine(obj))); },
    async deleteMachine(id) {
      return mutate(() => {
        coreDelete('machines', 'machine', id, (m) =>
          db.loans.some((l) => l.machine_id === m.id) || db.inventory_machine_checks.some((c) => c.machine_id === m.id)
          || orgInUse(db, 'machines', m.id));
        orgAfterDelete(db, 'machines', id, audit);
      });
    },
    async checkoutMachine(id, opts) { return mutate(() => pick(coreCheckout(id, opts || {}), LOAN_COLS)); },
    async returnMachine(id, opts) { return mutate(() => pick(coreReturn(id, opts || {}), LOAN_COLS)); },
    async setMachineStatus(id, status, note) { return mutate(() => pick(coreSetStatus(id, status, note), MACHINE_COLS)); },
    async listLoans({ machineId, borrowerId, open, from, to, limit } = {}) {
      return read(() => {
        if (!canRead()) return [];
        const f = toIso(from);
        const t = toIso(to, { endOfDay: true });
        const n = Number(limit) > 0 ? Math.floor(Number(limit)) : DEFAULT_LIMIT;
        const c = viewCtx();
        return db.loans
          .filter((l) => c.machines.has(l.machine_id)
            && (!machineId || l.machine_id === machineId)
            && (!borrowerId || l.borrower_id === borrowerId)
            && (open === true ? !l.returned_at : open === false ? !!l.returned_at : true)
            && (!f || ms(l.checked_out_at) >= ms(f))
            && (!t || ms(l.checked_out_at) <= ms(t)))
          .sort(newestFirst('checked_out_at'))
          .slice(0, n)
          .map((l) => vLoan(l, c));
      });
    },
    async correctLoan(loanId, fields) { return mutate(() => pick(coreCorrectLoan(loanId, fields || {}), LOAN_COLS)); },

    // ---- Material ----
    async listArticles({ includeArchived = false } = {}) {
      return read(() => {
        if (!canRead()) return [];
        const c = viewCtx();
        return sortRows(db.articles.filter((a) => includeArchived || !a.archived).map((a) => vArticle(a, c)), 'name');
      });
    },
    async getArticle(id) { return read(() => getView('article', 'id', id)); },
    async getArticleByCode(code) { return read(() => getView('article', 'code', code)); },
    async saveArticle(obj) { return mutate(() => getView('article', 'id', coreSaveArticle(obj))); },
    async deleteArticle(id) {
      return mutate(() => {
        coreDelete('articles', 'article', id, (a) =>
          db.stock_movements.some((mv) => mv.article_id === a.id) || db.inventory_counts.some((c) => c.article_id === a.id)
          || orgInUse(db, 'articles', a.id));
        orgAfterDelete(db, 'articles', id, audit);
      });
    },
    async moveStock(articleId, opts) { return mutate(() => pick(coreMoveStock(articleId, opts || {}), MOVEMENT_COLS)); },
    async listMovements({ articleId, userId, limit } = {}) {
      return read(() => {
        if (!canRead()) return [];
        const n = Number(limit) > 0 ? Math.floor(Number(limit)) : DEFAULT_LIMIT;
        const c = viewCtx();
        return db.stock_movements
          .filter((mv) => c.articles.has(mv.article_id) && (!articleId || mv.article_id === articleId) && (!userId || mv.user_id === userId))
          .sort(newestFirst('created_at'))
          .slice(0, n)
          .map((mv) => vMovement(mv, c));
      });
    },

    // ---- Bedarf je Maschine (Verbrauchsmaterial/Zubehör, das ein Gerät braucht) ----
    // Zeilen wie machine_supply_overview, nach Artikelname, Maschinenname, id; lesen alle Freigegebenen
    async listSupplies({ machineId, articleId } = {}) {
      return read(() => {
        if (machineId && !isUuid(machineId)) return [];
        if (articleId && !isUuid(articleId)) return [];
        if (!canRead()) return [];
        const c = viewCtx();
        return db.machine_supplies
          .filter((s) => (!machineId || s.machine_id === machineId) && (!articleId || s.article_id === articleId))
          .map((s) => vSupply(s, c))
          .filter(Boolean)
          .sort((a, b) => cmp(a.article_name, b.article_name) || cmp(a.machine_name, b.machine_name) || byId(a, b));
      });
    },
    async saveSupply(obj) {
      return mutate(() => {
        const id = coreSaveSupply(obj);
        const out = vSupply(db.machine_supplies.find((s) => s.id === id), viewCtx());
        if (!out) throw E('not_found');
        return out;
      });
    },
    async deleteSupply(id) {
      return mutate(() => {
        const row = isUuid(id) ? db.machine_supplies.find((s) => s.id === id) : null;
        if (!row || !canRead()) throw E('not_found');   // für Nicht-Freigegebene unsichtbar (RLS)
        if (!isStaff()) throw E('not_authorized');      // machine_supplies_delete
        db.machine_supplies = db.machine_supplies.filter((s) => s.id !== id);
        audit('delete', 'machine_supplies', row.id, row);
      });
    },

    // ---- Einkaufsliste (was gekauft werden muss; kein Bestellmodul) ----
    // status 'open' = offen + bestellt (neueste zuerst), 'done' = erledigt/verworfen (die letzten 40)
    async listShopping({ status = 'open' } = {}) {
      return read(() => {
        if (!canRead()) return [];
        const c = viewCtx();
        if (status === 'done') {
          const t = (s) => { const v = ms(s.done_at); return Number.isNaN(v) ? -Infinity : v; };   // nulls last
          return db.shopping_items
            .filter((s) => s.status === 'erledigt' || s.status === 'verworfen')
            .sort((a, b) => (t(b) - t(a)) || byId(a, b))
            .slice(0, SHOPPING_DONE_LIMIT)
            .map((s) => vShopping(s, c));
        }
        return db.shopping_items
          .filter((s) => SHOPPING_OPEN.includes(s.status))
          .sort((a, b) => (ms(b.created_at) - ms(a.created_at)) || byId(a, b))
          .map((s) => vShopping(s, c));
      });
    },
    async saveShoppingItem(obj) {
      return mutate(() => {
        const id = coreSaveShopping(obj);
        return vShopping(db.shopping_items.find((s) => s.id === id), viewCtx());
      });
    },
    async setShoppingStatus(id, status) {
      return mutate(() => {
        if (!isUuid(id)) throw E('not_found');
        if (!SHOPPING_STATUS.includes(status)) throw E('invalid_status');
        const row = db.shopping_items.find((s) => s.id === id) || null;
        if (!row || !canRead()) throw E('not_found');
        changeShoppingStatus(row, status);
        return vShopping(row, viewCtx());
      });
    },
    async deleteShoppingItem(id) {
      return mutate(() => {
        const row = isUuid(id) ? db.shopping_items.find((s) => s.id === id) : null;
        if (!row || !canRead()) throw E('not_found');
        // shopping_delete: nur der eigene Eintrag oder Lagerverantwortliche/Admins (sonst «verworfen» setzen)
        if (row.created_by !== uid() && !isStaff()) throw E('not_authorized');
        db.shopping_items = db.shopping_items.filter((s) => s.id !== id);
        audit('delete', 'shopping_items', row.id, row);
      });
    },
    // article_consumption: Entnahmen der letzten 90 Tage je Artikel (Entnahmen sind negativ gebucht → used_90d positiv)
    async listConsumption() {
      return read(() => {
        if (!canRead()) return [];
        const since = nowMs() - CONSUMPTION_MS;
        const out = new Map();
        for (const mv of db.stock_movements) {
          if (mv.type !== 'entnahme' || !(ms(mv.created_at) > since)) continue;
          let e = out.get(mv.article_id);
          if (!e) {
            e = { article_id: mv.article_id, used_90d: 0, takes_90d: 0, first_take_at: mv.created_at, last_take_at: mv.created_at };
            out.set(mv.article_id, e);
          }
          e.used_90d = round6(e.used_90d - mv.qty);
          e.takes_90d += 1;
          if (ms(mv.created_at) < ms(e.first_take_at)) e.first_take_at = mv.created_at;
          if (ms(mv.created_at) > ms(e.last_take_at)) e.last_take_at = mv.created_at;
        }
        return [...out.values()].sort((a, b) => (a.article_id < b.article_id ? -1 : a.article_id > b.article_id ? 1 : 0));
      });
    },

    // ---- Fotos und Dokumente ----
    async listAttachments(entity, entityId) {
      return read(() => {
        if (!canRead()) return [];
        return db.attachments
          .filter((a) => a.entity === entity && a.entity_id === entityId)
          .sort((a, b) => (Number(b.is_primary) - Number(a.is_primary)) || (ms(a.created_at) - ms(b.created_at)));
      });
    },
    async uploadAttachment(entity, entityId, file, { kind, note, loanId } = {}) {
      load();
      if (!ENTITIES.includes(entity)) throw E('invalid_entity');
      if (!isUuid(entityId)) throw E('not_found');
      if (!file || typeof file.size !== 'number') throw E('file_required');
      if (!isActive()) throw E('not_authorized');
      const origMime = String(file.type || '').toLowerCase();
      const isImage = origMime.startsWith('image/');
      const k = kind || (isImage ? 'photo' : 'document');
      if (!KINDS.includes(k)) throw E('invalid_kind');
      if (loanId && !db.loans.some((l) => l.id === loanId)) throw E('not_found');
      const by = uid();
      let blob = file;
      let mime = origMime || 'application/octet-stream';
      let fileName = String(file.name || (isImage ? 'foto' : 'datei'));
      if (isImage && !/svg/.test(origMime)) {
        const small = await resizeImage(file, DEMO_IMAGE_MAX_PX, DEMO_IMAGE_QUALITY);
        if (small) { blob = small; mime = 'image/jpeg'; fileName = renameExt(fileName, 'jpg'); }
      }
      if (blob.size > DEMO_MAX_FILE_BYTES) throw E('file_too_large');
      const dataUrl = await blobToDataUrl(blob, mime);
      return mutate(() => {
        const ext = mime === 'image/jpeg' ? 'jpg' : extFor(fileName, mime);
        return addAttachment({
          entity, entityId, kind: k, path: `${entity}/${entityId}/${uuid()}.${ext}`, dataUrl, fileName, mime,
          size: blob.size, note, loanId, by,
        });
      });
    },
    async deleteAttachment(attachment) {
      const id = typeof attachment === 'string' ? attachment : attachment && attachment.id;
      return mutate(() => {
        const a = db.attachments.find((x) => x.id === id);
        if (!a || !canRead()) throw E('not_found');
        const own = a.uploaded_by === uid() && ms(a.created_at) > nowMs() - 60 * 60 * 1000;
        if (!isStaff() && !own) throw E('not_authorized');
        db.attachments = db.attachments.filter((x) => x.id !== id);
        delete db.files[a.path];
        audit('delete', 'attachments', a.id, a);
      });
    },
    async setPrimaryAttachment(id) {
      return mutate(() => {
        if (!isStaff()) throw E('not_authorized');
        const a = db.attachments.find((x) => x.id === id);
        if (!a) throw E('not_found');
        for (const x of db.attachments) {
          if (x.entity === a.entity && x.entity_id === a.entity_id && x.kind === 'photo') x.is_primary = x.id === id;
        }
        return a;
      });
    },
    async fileUrls(paths) {
      load();
      const out = new Map();
      if (!me() || !isActive()) return out;
      for (const p of Array.isArray(paths) ? paths : [paths]) {
        if (typeof p === 'string' && db.files[p]) out.set(p, db.files[p]);
      }
      return out;
    },

    // ---- Inventur ----
    async listInventories() {
      return read(() => (canRead() ? [...db.inventories].sort(newestFirst('started_at')) : []));
    },
    async createInventory(fields) { return mutate(() => coreCreateInventory(fields || {})); },
    async getInventory(id) {
      return read(() => {
        if (!canRead()) return null;
        const inventory = db.inventories.find((i) => i.id === id);
        if (!inventory) return null;
        return {
          inventory,
          counts: db.inventory_counts.filter((c) => c.inventory_id === id).sort(newestFirst('counted_at')),
          checks: db.inventory_machine_checks.filter((c) => c.inventory_id === id).sort(newestFirst('checked_at')),
        };
      });
    },
    async countArticle(inventoryId, articleId, counted) { return mutate(() => coreCount(inventoryId, articleId, counted)); },
    async checkMachine(inventoryId, machineId, result, note) { return mutate(() => coreCheckMachine(inventoryId, machineId, result, note)); },
    async closeInventory(inventoryId, apply) { return mutate(() => coreCloseInventory(inventoryId, apply)); },

    // ---- Protokoll ----
    async listAudit({ limit, entity, entityId } = {}) {
      return read(() => {
        canRead();
        if (!isStaff()) return [];
        const ent = entity ? (AUDIT_TABLE[entity] || entity) : null;
        const n = Number(limit) > 0 ? Math.floor(Number(limit)) : DEFAULT_LIMIT;
        return db.audit_log
          .filter((r) => (!ent || r.entity === ent) && (!entityId || r.entity_id === entityId))
          .sort(newestFirst('at'))
          .slice(0, n);
      });
    },
  };

  // «Lager organisieren» (js/api-demo-org.js) mit Zugriff auf die Interna dieser Fabrik
  installOrgDemo(api, {
    get db() { return db; },   // db wird bei Laden/Rückrollen ersetzt → immer frisch lesen
    E, load, read, mutate, audit, applyPatch, uid, me, profileOf, isActive, isStaff, isAdmin, canRead, nowIso, nowMs,
    viewCtx, vLocation, vMachine, vArticle, coreSaveLocation, coreSaveArticle, coreSaveMachine,
    resizeImage, blobToDataUrl,
    util: { uuid, trimOrNull, num, clone, pick, omit, has, isUuid, cmp, sortRows, ms },
    cols: { LOCATION_COLS, ARTICLE_COLS, MACHINE_COLS },
    limits: { imageMaxPx: DEMO_IMAGE_MAX_PX, imageQuality: DEMO_IMAGE_QUALITY, maxFileBytes: DEMO_MAX_FILE_BYTES },
  });

  // Für Tests: Fehler beim Aufbau der Demodaten
  Object.defineProperty(api, '_seedErrors', { get: () => { load(); return seedErrors.slice(); }, enumerable: false });
  return api;
}
