// «Lager organisieren» im Demo-Modus (Vertrag: docs/ARCHITECTURE.md, Abschnitt «Erweiterung «Lager organisieren»»).
// Regeln, Rechte, Fehlercodes und Protokoll wie supabase/schema.sql:
//   Tabellen categories, photos (kind foto|plan), detections, photo_hotspots, org_tasks, set_components,
//   floor_plans (Gebäudeplan, Ansicht floor_plan_overview), sites (Standorte, Ansicht site_overview) + neue Spalten,
//   Trigger check_category_parent, photo_insert_defaults, photo_delete_guard, org_task_status, location_site_top_only,
//   Funktionen import_photo_analysis, set_photo_status, add_detection, review_detection, set_location_organized,
//   category_by_path, location_root, Ansichten category_paths, photo_overview, detection_overview,
//   org_task_overview, space_overview, org_stats.
// Eingaben/Rückgaben wie js/api-supabase.js. Geladen von js/api-demo.js: installOrgDemo(api, interna).

export const ORG_TABLES = Object.freeze(['categories', 'photos', 'detections', 'photo_hotspots', 'org_tasks', 'set_components', 'floor_plans',
  'sites']);

// Startkategorien – exakt der DO-Block «Startkategorien» in supabase/schema.sql (sort = Position × 10)
export const START_CATEGORIES = Object.freeze([
  ['Maschinen & Geräte', ['Bohrmaschinen & Bohrhämmer', 'Schleifmaschinen', 'Sägen', 'Weitere Elektrowerkzeuge', 'Kompressoren',
    'Messgeräte', 'Reinigungsmaschinen', 'Garten- & Forstgeräte', 'Bau- & Baustellengeräte', 'Leitern & Transporthilfen',
    'Haushalts- & Klimageräte', 'Spezialmaschinen']],
  ['Werkzeuge', ['Handwerkzeuge', 'Schraubwerkzeuge', 'Schneidwerkzeuge', 'Messwerkzeuge', 'Werkzeugkoffer & Sets', 'Werkzeugzubehör']],
  ['Bau- & Montagematerial', ['Befestigungsmaterial', 'Dicht- & Klebstoffe', 'Abdichtungsmaterial', 'Metallprofile', 'Holz & Platten',
    'Dämmstoffe', 'Farben & Lacke', 'Montagezubehör']],
  ['IT & Elektronik', ['Computer & Tablets', 'Monitore', 'Peripherie', 'Drucker & Scanner', 'Netzwerkgeräte', 'Kameras', 'Telefonie',
    'Kabel & Adapter', 'Unterhaltungselektronik']],
  ['Bürobedarf', ['Papier', 'Schreibmaterial', 'Ordner & Ablage', 'Büroverbrauchsmaterial', 'Versandmaterial', 'Bürogeräte']],
  ['Büromöbel', ['Tische', 'Stühle', 'Schränke', 'Regale', 'Lampen', 'Boxen & Behälter']],
  ['Reinigung & Unterhalt', ['Reinigungsgeräte', 'Reinigungsmittel', 'Unterhaltsmaterial', 'Verbrauchsmaterial']],
  ['Elektro & Installation', ['Kabel & Leitungen', 'Steckdosenleisten & Verlängerungen', 'Schalter & Steckdosen', 'Sicherungen',
    'Leuchtmittel', 'Installationsmaterial']],
  ['Ersatzteile & Zubehör', ['Maschinenersatzteile', 'Technische Ersatzteile', 'Akkus', 'Ladegeräte', 'Zubehör']],
  ['Arbeitssicherheit', ['Persönliche Schutzausrüstung', 'Erste Hilfe & Brandschutz']],
  ['Küche & Aufenthalt', ['Geräte', 'Geschirr & Verbrauch']],
].map(([top, subs]) => Object.freeze([top, Object.freeze(subs)])));

// Spalten wie in schema.sql
const CATEGORY_COLS = ['id', 'parent_id', 'name', 'sort', 'archived', 'created_by', 'created_at', 'updated_at'];
const PHOTO_COLS = ['id', 'location_id', 'path', 'sha256', 'file_name', 'folder', 'mime', 'size_bytes', 'width', 'height', 'status',
  'analysis_error', 'analysis_source', 'analyzed_at', 'scene', 'area', 'observations', 'recommendations', 'uploaded_by', 'created_at',
  'kind'];
const FLOOR_PLAN_COLS = ['id', 'name', 'sort', 'photo_id', 'notes', 'created_by', 'created_at', 'updated_at', 'site_id'];
const SITE_COLS = ['id', 'name', 'address', 'sort', 'notes', 'created_by', 'created_at', 'updated_at'];
const PHOTO_KINDS = ['foto', 'plan'];   // photos_kind_chk; Planbilder zählen nicht als Fotos
const isFoto = (p) => (p.kind ?? 'foto') === 'foto';
const DETECTION_COLS = ['id', 'photo_id', 'obj_key', 'source', 'name', 'kind', 'category_id', 'category_text', 'brand', 'model',
  'serial_no', 'text_read', 'quantity', 'quantity_certain', 'unit', 'condition', 'confidence', 'pos_x', 'pos_y', 'part_of_key',
  'notes', 'product', 'status', 'article_id', 'machine_id', 'location_ref_id', 'target_location_id', 'merged_into',
  'reviewed_by', 'reviewed_at', 'created_at'];
const HOTSPOT_COLS = ['id', 'photo_id', 'location_id', 'x', 'y', 'w', 'h', 'label', 'created_by', 'created_at'];
const TASK_COLS = ['id', 'location_id', 'photo_id', 'title', 'details', 'source', 'status', 'assigned_to', 'sort',
  'created_by', 'created_at', 'done_by', 'done_at'];
const COMPONENT_COLS = ['id', 'set_id', 'machine_id', 'article_id', 'name', 'qty', 'note', 'sort', 'created_by', 'created_at'];

const KINDS = ['einzelinventar', 'bestandsartikel', 'set', 'einrichtung', 'unbekannt'];
const KNOWN_KINDS = ['einzelinventar', 'bestandsartikel', 'set', 'einrichtung'];
const SETTABLE_PHOTO_STATUS = ['neu', 'in_analyse'];
const TASK_SOURCES = ['manuell', 'foto_analyse', 'regel'];
const TASK_STATUSES = ['offen', 'erledigt', 'verworfen'];
const TASK_RANK = { offen: 0, erledigt: 1, verworfen: 2 };
const REVIEW_UNITS = ['Stk', 'm', 'm²', 'kg', 'l', 'Rolle', 'Pkg', 'Paar', 'Set'];   // review_detection, Bestandsartikel
const PACK_UNITS = ['Pack', 'Packung', 'Paket', 'Karton'];
const reviewUnit = (u) => (REVIEW_UNITS.includes(u) ? u : PACK_UNITS.includes(u) ? 'Pkg' : 'Stk');
// jsonb-Semantik: Schlüssel nach Bytelänge, dann bytewise sortiert; Textausgabe wie jsonb_each_text / jsonb::text
const UTF8 = typeof TextEncoder === 'function' ? new TextEncoder() : null;
function jsonbKeys(o) {
  const b = (s) => (UTF8 ? UTF8.encode(s) : Array.from(String(s), (ch) => ch.charCodeAt(0)));
  return Object.keys(o).sort((x, y) => {
    const A = b(x); const B = b(y);
    if (A.length !== B.length) return A.length - B.length;
    for (let i = 0; i < A.length; i++) if (A[i] !== B[i]) return A[i] - B[i];
    return 0;
  });
}
function jsonbOut(v) {
  if (v === null || v === undefined) return 'null';
  if (Array.isArray(v)) return `[${v.map(jsonbOut).join(', ')}]`;
  if (typeof v === 'object') return `{${jsonbKeys(v).map((k) => `${JSON.stringify(k)}: ${jsonbOut(v[k])}`).join(', ')}}`;
  return JSON.stringify(v);
}
// wie public.product_summary(): «Zweck: …» und «Technische Daten (laut <Quelle>): k v; …» (JSON-null-Werte fallen weg)
function productSummary(p) {
  if (!p || typeof p !== 'object' || Array.isArray(p)) return null;
  const purpose = typeof p.purpose === 'string' ? `Zweck: ${p.purpose}` : null;
  let specs = null;
  if (p.specs && typeof p.specs === 'object' && !Array.isArray(p.specs)) {
    const parts = [];
    for (const k of jsonbKeys(p.specs)) {
      const v = p.specs[k];
      if (v === null || v === undefined) continue;   // key || ' ' || null → null → string_agg überspringt
      parts.push(`${k} ${typeof v === 'string' ? v : jsonbOut(v)}`);
    }
    const src = p.source === null || p.source === undefined ? 'Hersteller' : (typeof p.source === 'string' ? p.source : jsonbOut(p.source));
    if (parts.length) specs = `Technische Daten (laut ${src}): ${parts.join('; ')}`;
  }
  const out = [purpose, specs].filter((s) => s !== null).join('\n');
  return out === '' ? null : out;
}
const IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'];
const IMAGE_EXT = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', heic: 'image/heic', heif: 'image/heif' };
const MAX_ANALYSIS_ITEMS = 250;
const SHORT_CODE_RE = /^[A-Z0-9]{1,10}$/;
const URL_RE = /^https?:\/\/[^\s]+$/i;
const SHA_RE = /^[0-9a-f]{64}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COLLATOR = (() => { try { return new Intl.Collator('de-CH', { numeric: true, sensitivity: 'base' }); } catch { return null; } })();

// ---------------------------------------------------------------------------------------------
//  Hilfsfunktionen (SQL-Semantik: trim = nur Leerzeichen, left() zählt Zeichen, ->> liefert Text)
// ---------------------------------------------------------------------------------------------
const isUuid = (s) => typeof s === 'string' && UUID_RE.test(s);
const hasKey = (o, k) => o != null && Object.prototype.hasOwnProperty.call(o, k) && o[k] !== undefined;
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const ms = (v) => (v ? Date.parse(v) : NaN);
const pick = (row, cols) => { const o = {}; for (const c of cols) o[c] = row[c] === undefined ? null : row[c]; return o; };
const omit = (row, keys) => { const o = { ...row }; for (const k of keys) delete o[k]; return o; };
const sqlTrim = (s) => String(s).replace(/^ +/, '').replace(/ +$/, '');
function left(s, n) {
  if (s === null || s === undefined) return null;
  const str = String(s);
  if (str.length <= n) return str;
  const chars = Array.from(str);
  return chars.length > n ? chars.slice(0, n).join('') : str;
}
const charLen = (s) => Array.from(String(s)).length;
/** jsonb ->> : Text oder null */
function txt(v) {
  if (v === undefined || v === null) return null;
  if (typeof v === 'string') return v;
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}
const nullif = (s) => (s === null || s === undefined || s === '' ? null : s);
/** jnum(): nur echte JSON-Zahlen, sonst null */
const jnum = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
/** left(nullif(trim(x), ''), n) */
function clean(v, n) {
  const s = txt(v);
  if (s === null) return null;
  const t = sqlTrim(s);
  return t === '' ? null : left(t, n);
}
/** Text als boolean wie Postgres (t/true/yes/on/1 …); ungültig → invalid_value */
function pgBool(v, E) {
  if (v === undefined || v === null) return null;
  if (typeof v === 'boolean') return v;
  const s = String(v).trim().toLowerCase();
  if (['t', 'true', 'y', 'yes', 'on', '1'].includes(s)) return true;
  if (['f', 'false', 'n', 'no', 'off', '0'].includes(s)) return false;
  throw E('invalid_value', String(v));
}
const concatWs = (sep, ...parts) => parts.filter((p) => p !== null && p !== undefined).join(sep);
/** wie supabase-js: Daten werden als JSON übertragen (undefined fällt weg, Datum → Text) */
function asJson(v) {
  if (v === undefined) return undefined;
  try { return JSON.parse(JSON.stringify(v)); } catch { return undefined; }
}
function cmp(a, b) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return COLLATOR ? COLLATOR.compare(String(a), String(b)) : String(a).localeCompare(String(b));
}
function newUuid() {
  try { if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') return globalThis.crypto.randomUUID(); } catch { /* weiter */ }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
function guessImageMime(name) {
  const m = /\.([a-z0-9]+)$/i.exec(String(name || ''));
  return IMAGE_EXT[m ? m[1].toLowerCase() : ''] || '';
}
async function sha256Hex(blob) {
  const subtle = globalThis.crypto && globalThis.crypto.subtle;
  if (!subtle) throw new Error('crypto.subtle nicht verfügbar');
  const hash = await subtle.digest('SHA-256', await blob.arrayBuffer());
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
// Bild verkleinern (wie uploadAttachment im Demo) und Masse zurückgeben; null = nicht möglich.
// type: 'image/jpeg' (Fotos) oder 'image/png' (Gebäudepläne als PNG bleiben PNG – Beschriftung bleibt scharf)
async function resizeWithSize(file, maxPx, quality, type = 'image/jpeg') {
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
      ? await canvas.convertToBlob({ type, quality })
      : await new Promise((res) => canvas.toBlob(res, type, quality));
    return blob && blob.size ? { blob, width: w, height: h, mime: type } : null;
  } catch {
    return null;
  } finally {
    try { bmp.close && bmp.close(); } catch { /* egal */ }
  }
}

// ---------------------------------------------------------------------------------------------
//  Für js/api-demo.js: Speicher-Migration, Startkategorien, Ansichtsfelder, Löschregeln
// ---------------------------------------------------------------------------------------------
/** Startkategorien anlegen (wie der SQL-Seed: ohne Ersteller, ohne Protokoll). */
export function seedCategories(db, at, makeId = newUuid) {
  const row = (id, parent_id, name, sort) => ({ id, parent_id, name, sort, archived: false, created_by: null, created_at: at, updated_at: at });
  START_CATEGORIES.forEach(([top, subs], i) => {
    const id = makeId();
    db.categories.push(row(id, null, top, (i + 1) * 10));
    subs.forEach((s, j) => db.categories.push(row(makeId(), id, s, (j + 1) * 10)));
  });
}

/**
 * Fehlende Tabellen und Spalten ergänzen (nur additiv, ohne Startdaten). Läuft bei jedem Laden, auch für den aktuellen
 * Datenstand: Standorte (sites, locations.site_id, floor_plans.site_id) kamen ohne neue Version dazu.
 */
export function completeDb(db) {
  for (const t of ORG_TABLES) if (!Array.isArray(db[t])) db[t] = [];
  const fill = (rows, defs) => {
    for (const r of Array.isArray(rows) ? rows : []) for (const [k, v] of Object.entries(defs)) if (r[k] === undefined) r[k] = v;
  };
  fill(db.locations, { short_code: null, responsible_id: null, organized_at: null, organized_by: null, cover_photo_id: null, site_id: null });
  // Einkaufsliste kam ebenfalls ohne neue Version dazu: leere Liste, Artikel ohne Nachkaufmenge
  if (!Array.isArray(db.shopping_items)) db.shopping_items = [];
  if (!Array.isArray(db.machine_supplies)) db.machine_supplies = [];   // Bedarf je Maschine: ebenso
  fill(db.articles, { category_id: null, product_url: null, reorder_qty: null });
  fill(db.machines, { category_id: null, responsible_id: null, is_set: false, product_url: null });
  fill(db.inventories, { location_id: null });
  fill(db.photos, { kind: 'foto' });   // Gebäudeplan: bestehende Bilder sind Fotos
  fill(db.floor_plans, { site_id: null });
  return db;
}

/** Demo-Datenstand Version 1 → 2: neue Tabellen und Spalten ergänzen (nur additiv), Kategorien anlegen falls keine. */
export function upgradeDb(db, at) {
  completeDb(db);
  if (!db.categories.length) seedCategories(db, at);
  return db;
}

/** category_paths: alle Kategorien in Baumreihenfolge mit path («A › B»), depth, root_id */
function categoryTree(db) {
  const kids = new Map();
  for (const c of db.categories || []) {
    const k = c.parent_id || null;
    if (!kids.has(k)) kids.set(k, []);
    kids.get(k).push(c);
  }
  for (const list of kids.values()) list.sort((a, b) => ((a.sort || 0) - (b.sort || 0)) || cmp(a.name, b.name) || cmp(a.id, b.id));
  const out = [];
  const walk = (parentId, path, depth, root, trail) => {
    for (const c of kids.get(parentId) || []) {
      if (trail.has(c.id)) continue;
      const p = parentId === null ? c.name : `${path} › ${c.name}`;
      const r = parentId === null ? c.id : root;
      out.push({ ...pick(c, CATEGORY_COLS), path: p, depth, root_id: r });
      walk(c.id, p, depth + 1, r, new Set([...trail, c.id]));
    }
  };
  walk(null, '', 0, null, new Set());
  return out;
}

/** Zusätzliche Ansichtsfelder für location_overview / machine_overview / article_overview */
export function orgViewIndex(db) {
  const cats = new Map(categoryTree(db).map((c) => [c.id, c.path]));
  const photoPath = new Map((db.photos || []).map((p) => [p.id, p.path]));
  // Foto der verknüpften Erkennung: bestätigte zuerst, dann älteste
  const best = { machine: new Map(), article: new Map() };
  for (const d of db.detections || []) {
    for (const [kind, key] of [['machine', 'machine_id'], ['article', 'article_id']]) {
      const id = d[key];
      if (!id || !photoPath.has(d.photo_id)) continue;
      const cur = best[kind].get(id);
      const better = !cur
        || ((d.status === 'bestaetigt') && cur.status !== 'bestaetigt')
        || ((d.status === 'bestaetigt') === (cur.status === 'bestaetigt') && ms(d.created_at) < ms(cur.created_at));
      if (better) best[kind].set(id, d);
    }
  }
  const comp = new Map();
  for (const c of db.set_components || []) comp.set(c.set_id, (comp.get(c.set_id) || 0) + 1);
  const detPath = (kind) => (id) => { const d = id ? best[kind].get(id) : null; return d ? photoPath.get(d.photo_id) ?? null : null; };
  const detPos = (kind) => (id) => { const d = id ? best[kind].get(id) : null; return d ? { x: d.pos_x ?? null, y: d.pos_y ?? null } : { x: null, y: null }; };
  const siteName = new Map((db.sites || []).map((s) => [s.id, s.name]));
  return {
    categoryPath: (id) => (id && cats.has(id) ? cats.get(id) : null),
    photoPath: (id) => (id && photoPath.has(id) ? photoPath.get(id) : null),
    detectionPhoto: { machine: detPath('machine'), article: detPath('article') },
    detectionPos: { machine: detPos('machine'), article: detPos('article') },
    componentCount: (id) => comp.get(id) || 0,
    siteName: (id) => (id && siteName.has(id) ? siteName.get(id) : null),   // location_overview.site_name
  };
}

/** Fremdschlüssel «on delete restrict» der neuen Tabellen */
export function orgInUse(db, table, id) {
  if (table === 'locations') return (db.photos || []).some((p) => p.location_id === id);
  if (table === 'machines') return (db.set_components || []).some((c) => c.machine_id === id);
  if (table === 'articles') return (db.set_components || []).some((c) => c.article_id === id);
  return false;
}

/** Nach dem Löschen: «on delete cascade» / «set null» der neuen Tabellen (mit Protokoll wie audit_row) */
export function orgAfterDelete(db, table, id, audit) {
  const drop = (name, test) => {
    const gone = (db[name] || []).filter(test);
    if (!gone.length) return;
    db[name] = db[name].filter((r) => !test(r));
    for (const r of gone) audit('delete', name, r.id, r);
  };
  const setNull = (name, col) => { for (const r of db[name] || []) if (r[col] === id) r[col] = null; };
  if (table === 'locations') {
    drop('photo_hotspots', (h) => h.location_id === id);
    drop('org_tasks', (t) => t.location_id === id);
    setNull('detections', 'target_location_id');
    setNull('detections', 'location_ref_id');
    setNull('inventories', 'location_id');
  } else if (table === 'machines') {
    drop('set_components', (c) => c.set_id === id);
    setNull('detections', 'machine_id');
    drop('machine_supplies', (s) => s.machine_id === id);   // Bedarf je Maschine: on delete cascade
  } else if (table === 'articles') {
    setNull('detections', 'article_id');
    drop('shopping_items', (s) => s.article_id === id);   // Einkaufsliste: on delete cascade
    drop('machine_supplies', (s) => s.article_id === id);   // Bedarf je Maschine: on delete cascade
  }
}

// ---------------------------------------------------------------------------------------------
//  API-Methoden
// ---------------------------------------------------------------------------------------------
/**
 * @param {object} api  Demo-API (wird um die neuen Methoden ergänzt)
 * @param {object} x    Interna von createApi() in js/api-demo.js
 */
export function installOrgDemo(api, x) {
  const { E } = x;
  const { uuid, trimOrNull, num, sortRows } = x.util;
  const now = () => x.nowIso();
  const D = () => x.db;

  // ---- gemeinsame Abfragen ----
  const locById = (id) => (id ? D().locations.find((l) => l.id === id) || null : null);
  const photoById = (id) => (id ? D().photos.find((p) => p.id === id) || null : null);
  const siteById = (id) => (id ? D().sites.find((s) => s.id === id) || null : null);
  /** location_root(): oberster Lagerort; null wenn unbekannt oder Zyklus */
  function locationRoot(id) {
    if (!id) return null;
    const byId = new Map(D().locations.map((l) => [l.id, l]));
    let cur = id;
    for (let steps = 0; ; ) {
      const l = byId.get(cur);
      if (!l) return null;
      if (!l.parent_id) return cur;
      cur = l.parent_id;
      if (++steps > 60) return null;
    }
  }
  function locationSubtree(id) {
    const out = new Set([id]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const l of D().locations) if (l.parent_id && out.has(l.parent_id) && !out.has(l.id)) { out.add(l.id); grew = true; }
    }
    return out;
  }
  /** category_by_path(): «Oberkategorie > Unterkategorie» (Gross/Klein egal, nur nicht archivierte), sonst null */
  function categoryByPath(p) {
    if (p === null || p === undefined || sqlTrim(p) === '') return null;
    let id = null;
    for (const raw of String(p).split(/\s*(?:>|›|»|\/)\s*/)) {
      const part = sqlTrim(raw);
      if (part === '') continue;
      const lp = part.toLowerCase();
      const f = D().categories.find((c) => (c.parent_id || null) === id && !c.archived && String(c.name).toLowerCase() === lp);
      if (!f) return null;
      id = f.id;
    }
    return id;
  }

  // ---- Ansichten ----
  function photoCounts() {
    const m = new Map();
    for (const d of D().detections) {
      const e = m.get(d.photo_id) || { n: 0, open: 0 };
      e.n += 1;
      if (d.status === 'offen' || d.status === 'spaeter') e.open += 1;
      m.set(d.photo_id, e);
    }
    return m;
  }
  function vPhoto(p, c, counts) {
    const k = counts.get(p.id) || { n: 0, open: 0 };
    return {
      ...pick(p, PHOTO_COLS), location_path: c.path(p.location_id), root_id: c.rootId(p.location_id),
      uploaded_by_name: c.name(p.uploaded_by), detection_count: k.n, open_count: k.open,
    };
  }
  const photoView = (p) => vPhoto(p, x.viewCtx(), photoCounts());

  function detectionCtx() {
    const db = D();
    const c = x.viewCtx();
    const photos = new Map(db.photos.map((p) => [p.id, p]));
    const locs = new Map(db.locations.map((l) => [l.id, l]));
    const articles = new Map(db.articles.map((a) => [a.id, a]));
    const machines = new Map(db.machines.map((m) => [m.id, m]));
    // same_key_count: gleicher Objektschlüssel auf Fotos (mit Lagerort) desselben Raums
    const sameKey = new Map();
    const keyOf = (d) => {
      const p = photos.get(d.photo_id);
      const root = p ? c.rootId(p.location_id) : null;
      return root ? `${root}\u0000${d.obj_key}` : null;
    };
    for (const d of db.detections) { const k = keyOf(d); if (k) sameKey.set(k, (sameKey.get(k) || 0) + 1); }
    return { c, photos, locs, articles, machines, sameKey, keyOf };
  }
  function vDetection(d, k) {
    const p = k.photos.get(d.photo_id) || {};
    const a = d.article_id ? k.articles.get(d.article_id) : null;
    const m = d.machine_id ? k.machines.get(d.machine_id) : null;
    const rl = d.location_ref_id ? k.locs.get(d.location_ref_id) : null;
    const key = k.keyOf(d);
    return {
      ...pick(d, DETECTION_COLS),
      photo_path: p.path ?? null, photo_file_name: p.file_name ?? null, photo_location_id: p.location_id ?? null,
      photo_width: p.width ?? null, photo_height: p.height ?? null,
      space_id: k.c.rootId(p.location_id), photo_location_path: k.c.path(p.location_id),
      target_location_path: k.c.path(d.target_location_id),
      category_path: k.c.org.categoryPath(d.category_id),
      article_code: a ? a.code : null, article_name: a ? a.name : null,
      machine_code: m ? m.code : null, machine_name: m ? m.name : null,
      location_ref_code: rl ? rl.code : null, location_ref_name: rl ? rl.name : null,
      reviewed_by_name: k.c.name(d.reviewed_by),
      same_key_count: key ? (k.sameKey.get(key) || 1) - 1 : 0,
    };
  }
  const vTask = (t, c) => ({
    ...pick(t, TASK_COLS), location_path: c.path(t.location_id), root_id: c.rootId(t.location_id),
    assigned_name: c.name(t.assigned_to), created_by_name: c.name(t.created_by), done_by_name: c.name(t.done_by),
  });
  function vHotspot(h) {
    const l = locById(h.location_id);
    return { ...pick(h, HOTSPOT_COLS), location_code: l ? l.code : null, location_name: l ? l.name : null, location_type: l ? l.type : null };
  }
  function vComponent(r) {
    const db = D();
    const m = r.machine_id ? db.machines.find((y) => y.id === r.machine_id) : null;
    const a = r.article_id ? db.articles.find((y) => y.id === r.article_id) : null;
    return {
      ...pick(r, COMPONENT_COLS),
      machine_code: m ? m.code : null, machine_name: m ? m.name : null,
      article_code: a ? a.code : null, article_name: a ? a.name : null, unit: a ? a.unit : null,
    };
  }
  /** Kategorien (gefiltert) in Baumreihenfolge; Kinder ausgeblendeter Eltern trotzdem zeigen (wie api-supabase.js) */
  function treeOrder(rows) {
    const kids = new Map();
    for (const r of rows) { const k = r.parent_id || null; if (!kids.has(k)) kids.set(k, []); kids.get(k).push(r); }
    for (const list of kids.values()) list.sort((a, b) => ((a.sort || 0) - (b.sort || 0)) || cmp(a.name, b.name) || cmp(a.id, b.id));
    const ids = new Set(rows.map((r) => r.id));
    const out = [];
    const seen = new Set();
    const walk = (parent) => {
      for (const r of kids.get(parent) || []) {
        if (seen.has(r.id)) continue;
        seen.add(r.id); out.push(r); walk(r.id);
      }
    };
    walk(null);
    for (const r of rows) if (!seen.has(r.id) && (!r.parent_id || !ids.has(r.parent_id))) { seen.add(r.id); out.push(r); walk(r.id); }
    return out;
  }
  const categoryRow = (id) => categoryTree(D()).find((c) => c.id === id) || null;

  function spaceRows() {
    const db = D();
    const c = x.viewCtx();
    const roots = db.locations.filter((l) => !l.parent_id);
    const s = new Map(roots.map((l) => [l.id, {
      sublocations: 0, articles: 0, machines: 0, photos: 0, photos_analyzed: 0, photos_queued: 0, photos_failed: 0,
      detections_open: 0, detections_done: 0, tasks_open: 0, tasks_done: 0,
    }]));
    const at = (locId) => { const r = locId ? c.rootId(locId) : null; return r ? s.get(r) || null : null; };
    for (const l of db.locations) { const e = at(l.id); if (e && c.rootId(l.id) !== l.id) e.sublocations += 1; }
    for (const a of db.articles) { const e = !a.archived && at(a.location_id); if (e) e.articles += 1; }
    for (const m of db.machines) { const e = !m.archived && at(m.home_location_id); if (e) e.machines += 1; }
    const photoRoot = new Map();
    for (const p of db.photos) {
      photoRoot.set(p.id, p.location_id);
      const e = at(p.location_id);
      if (!e || !isFoto(p)) continue;   // Foto-Kennzahlen nur kind = 'foto'
      e.photos += 1;
      if (p.status === 'analysiert') e.photos_analyzed += 1;
      else if (p.status === 'in_analyse') e.photos_queued += 1;
      else if (p.status === 'fehler') e.photos_failed += 1;
    }
    for (const d of db.detections) {
      const e = at(photoRoot.get(d.photo_id));
      if (!e) continue;
      if (d.status === 'offen' || d.status === 'spaeter') e.detections_open += 1;
      else if (d.status === 'bestaetigt' || d.status === 'zusammengefuehrt') e.detections_done += 1;
    }
    for (const t of db.org_tasks) {
      const e = at(t.location_id);
      if (!e) continue;
      if (t.status === 'offen') e.tasks_open += 1;
      else if (t.status === 'erledigt') e.tasks_done += 1;
    }
    return roots.map((l) => {
      const e = s.get(l.id);
      const orgStatus = l.organized_at && e.detections_open === 0 && e.tasks_open === 0 ? 'organisiert'
        : e.detections_open > 0 ? 'zu_pruefen'
          : e.photos_queued > 0 ? 'in_analyse'
            : (e.tasks_open > 0 || e.detections_done > 0 || e.tasks_done > 0) ? 'in_organisation'
              : e.photos > 0 ? 'fotos_vorhanden' : 'nicht_erfasst';
      const total = e.detections_done + e.tasks_done + e.detections_open + e.tasks_open;
      const progress = total === 0 ? (l.organized_at ? 100 : 0) : Math.round((100 * (e.detections_done + e.tasks_done)) / total);
      return { ...x.vLocation(l, c), ...e, org_status: orgStatus, progress };
    });
  }

  function orgStatsRow() {
    const db = D();
    const t = x.nowMs();
    const live = (r) => !r.archived;
    const openDet = db.detections.filter((d) => d.status === 'offen' || d.status === 'spaeter');
    const keyCount = new Map();
    for (const d of openDet) keyCount.set(d.obj_key, (keyCount.get(d.obj_key) || 0) + 1);
    const notRejected = db.detections.filter((d) => d.status !== 'abgelehnt');
    const fotos = db.photos.filter(isFoto);   // Planbilder zählen nicht
    return {
      articles_total: db.articles.filter(live).length,
      machines_total: db.machines.filter(live).length,
      sets_total: db.machines.filter((m) => live(m) && m.is_set).length,
      loans_open: db.loans.filter((l) => !l.returned_at).length,
      loans_overdue: db.loans.filter((l) => !l.returned_at && l.due_at && ms(l.due_at) < t).length,
      items_without_location: db.articles.filter((a) => live(a) && !a.location_id).length
        + db.machines.filter((m) => live(m) && !m.home_location_id).length,
      locations_total: db.locations.filter(live).length,
      spaces_total: db.locations.filter((l) => !l.parent_id && live(l)).length,
      spaces_organized: db.locations.filter((l) => !l.parent_id && live(l) && l.organized_at).length,
      photos_total: fotos.length,
      photos_analyzed: fotos.filter((p) => p.status === 'analysiert').length,
      photos_pending: fotos.filter((p) => p.status === 'neu' || p.status === 'in_analyse').length,
      photos_failed: fotos.filter((p) => p.status === 'fehler').length,
      detections_total: notRejected.length,
      detections_identified: notRejected.filter((d) => d.confidence === 'sicher' || d.confidence === 'wahrscheinlich').length,
      detections_unknown: notRejected.filter((d) => d.confidence === 'unbekannt').length,
      detections_confirmed: db.detections.filter((d) => d.status === 'bestaetigt' || d.status === 'zusammengefuehrt').length,
      detections_open: openDet.length,
      locations_proposed: openDet.filter((d) => d.kind === 'einrichtung').length,
      duplicate_groups: [...keyCount.values()].filter((n) => n > 1).length,
      tasks_open: db.org_tasks.filter((x2) => x2.status === 'offen').length,
      movements_7d: db.stock_movements.filter((mv) => ms(mv.created_at) > t - 7 * 24 * 3600 * 1000).length,
      shopping_open: (db.shopping_items || []).filter((s) => s.status === 'offen' || s.status === 'bestellt').length,
    };
  }
  const ZERO_STATS = () => Object.fromEntries(Object.keys(orgStatsRow()).map((k) => [k, 0]));

  // ---- Kategorien ----
  function assertCatNoCycle(id, parentId) {
    let cur = parentId;
    let steps = 0;
    while (cur) {
      if (cur === id) throw E('category_cycle');
      const p = D().categories.find((c) => c.id === cur);
      cur = p ? p.parent_id : null;
      if (++steps > 20) throw E('category_cycle');
    }
  }
  function assertCatUnique(id, parentId, name) {
    const parent = parentId || null;
    const n = String(name).toLowerCase();
    if (D().categories.some((c) => c.id !== id && (c.parent_id || null) === parent && String(c.name).toLowerCase() === n)) {
      throw E('duplicate', 'category');   // categories_name_uniq
    }
  }
  function coreSaveCategory(obj) {
    if (!obj || typeof obj !== 'object') throw E('invalid_value');
    const db = D();
    const p = {};
    if (hasKey(obj, 'name')) { p.name = String(obj.name ?? '').trim(); if (!p.name) throw E('name_required'); }
    if (hasKey(obj, 'parent_id')) p.parent_id = obj.parent_id ? String(obj.parent_id) : null;
    if (hasKey(obj, 'sort')) { const n = Number(obj.sort); if (!Number.isFinite(n)) throw E('invalid_value'); p.sort = Math.round(n); }
    if (hasKey(obj, 'archived')) p.archived = Boolean(obj.archived);
    if (has(p, 'name') && charLen(p.name) > 80) throw E('name_required');   // categories_name_check (1–80 Zeichen)
    if (!obj.id) {
      if (!p.name) throw E('name_required');
      if (!x.isStaff()) throw E('not_authorized');
      const parent = p.parent_id ?? null;
      if (parent && !db.categories.some((c) => c.id === parent)) throw E('invalid_location');   // wie Fehlerzuordnung «…parent…»
      assertCatUnique(null, parent, p.name);
      const t = now();
      const row = { id: uuid(), parent_id: parent, name: p.name, sort: p.sort ?? 0, archived: p.archived ?? false,
        created_by: x.uid(), created_at: t, updated_at: t };
      db.categories.push(row);
      x.audit('insert', 'categories', row.id, omit(row, ['created_at', 'updated_at']));
      return row.id;
    }
    if (!isUuid(obj.id)) throw E('not_found');
    const row = db.categories.find((c) => c.id === obj.id) || null;
    if (!Object.keys(p).length) { if (!row || !x.canRead()) throw E('not_found'); return row.id; }
    if (!row || !x.canRead()) throw E('not_found');
    if (!x.isStaff()) throw E('not_authorized');
    if (has(p, 'parent_id')) {
      if (p.parent_id && !db.categories.some((c) => c.id === p.parent_id)) throw E('invalid_location');
      assertCatNoCycle(row.id, p.parent_id);
    }
    assertCatUnique(row.id, has(p, 'parent_id') ? p.parent_id : row.parent_id, has(p, 'name') ? p.name : row.name);
    const diff = x.applyPatch(row, p);
    row.updated_at = now();
    if (Object.keys(diff).length) x.audit('update', 'categories', row.id, diff);
    return row.id;
  }
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

  // ---- Erkennungen prüfen (review_detection) ----
  function productUrl(product) {
    const u = isObj(product) ? txt(product.url) : null;
    return u !== null && URL_RE.test(u) ? u : null;
  }
  function coreReview(id, action, rawData) {
    if (!x.isStaff()) throw E('not_authorized');
    const db = D();
    const d = isUuid(id) ? db.detections.find((r) => r.id === id) : null;
    if (!d) throw E('not_found');
    const data = isObj(rawData) ? asJson(rawData) : {};
    const k = (key) => has(data, key);
    const photo = photoById(d.photo_id) || {};
    const root = locationRoot(photo.location_id);
    const u = x.uid();
    const t = now();
    const reviewed = () => { d.reviewed_by = u; d.reviewed_at = t; };

    // Änderungen (bei «bearbeiten», «lagerort» und optional bei «bestaetigen»)
    if (['bearbeiten', 'bestaetigen', 'lagerort'].includes(action) && Object.keys(data).length) {
      if (d.status === 'bestaetigt' || d.status === 'zusammengefuehrt') throw E('already_reviewed');
      if (k('name') && sqlTrim(txt(data.name) ?? '') === '') throw E('name_required');
      if (k('kind') && !KINDS.includes(txt(data.kind) ?? '')) throw E('invalid_input');
      const catId = nullif(txt(data.category_id));
      if (catId !== null && !(isUuid(catId) && db.categories.some((c) => c.id === catId))) throw E('not_found');
      const target = nullif(txt(data.target_location_id));
      if (target !== null) {
        if (!isUuid(target)) throw E('not_found');
        if (!db.locations.some((l) => l.id === target && !l.archived)) throw E('invalid_location');
      }
      if (k('quantity') && data.quantity !== null) {
        const q = jnum(data.quantity);
        if (q === null || q < 0 || q >= 1e9) throw E('invalid_qty');
      }
      const qc = k('quantity') ? jnum(data.quantity) !== null && (pgBool(data.quantity_certain, E) ?? true) : null;
      if (k('name')) d.name = left(sqlTrim(txt(data.name)), 200);
      if (k('kind')) d.kind = txt(data.kind);
      if (k('category_id')) d.category_id = catId;
      if (k('brand')) d.brand = clean(data.brand, 100);
      if (k('model')) d.model = clean(data.model, 100);
      if (k('serial_no')) d.serial_no = clean(data.serial_no, 100);
      if (k('unit')) d.unit = clean(data.unit, 20);
      if (k('notes')) d.notes = left(txt(data.notes), 1000);
      if (k('quantity')) { d.quantity = jnum(data.quantity); d.quantity_certain = qc; }   // von Hand eingegeben = gezählt
      if (k('target_location_id')) d.target_location_id = target;
      if (d.status === 'spaeter' && action === 'bearbeiten') d.status = 'offen';
      reviewed();
      if (action === 'bearbeiten' || action === 'lagerort') {
        x.audit('ki_bearbeitet', 'detections', d.id, data);
        return { detection: pick(d, DETECTION_COLS) };
      }
    } else if (action === 'bearbeiten' || action === 'lagerort') {
      return { detection: pick(d, DETECTION_COLS) };
    }

    let codes = [];
    let entity = null;
    let first = null;
    let merged = 0;
    if (action === 'spaeter') {
      if (d.status !== 'offen') throw E('already_reviewed');
      d.status = 'spaeter';
      reviewed();
    } else if (action === 'ablehnen') {
      if (d.status === 'bestaetigt') throw E('already_reviewed');
      const note = nullif(txt(data.reason) === null ? null : sqlTrim(txt(data.reason)));
      d.status = 'abgelehnt';
      d.merged_into = null;
      reviewed();
      if (note !== null) d.notes = left(concatWs(' · ', d.notes, `Abgelehnt: ${note}`), 1000);
    } else if (action === 'wiederoeffnen') {
      if (d.status === 'bestaetigt') throw E('already_reviewed');
      Object.assign(d, { status: 'offen', merged_into: null, article_id: null, machine_id: null, location_ref_id: null });
      reviewed();
    } else if (action === 'zusammenfuehren') {
      if (d.status === 'bestaetigt') throw E('already_reviewed');
      const intoId = nullif(txt(data.into));
      if (intoId !== null && !isUuid(intoId)) throw E('not_found');
      let into = intoId ? db.detections.find((r) => r.id === intoId) : null;
      if (!into || into.id === d.id) throw E('not_found');
      for (let i = 0; i < 10; i++) {   // Kette auflösen: auf das Hauptobjekt zeigen
        if (into.status !== 'zusammengefuehrt' || !into.merged_into) break;
        const next = db.detections.find((r) => r.id === into.merged_into);
        if (!next) break;
        into = next;
      }
      if (into.id === d.id) throw E('invalid_input');
      Object.assign(d, {
        status: 'zusammengefuehrt', merged_into: into.id,
        article_id: into.article_id, machine_id: into.machine_id, location_ref_id: into.location_ref_id,
      });
      reviewed();
      for (const r of db.detections) if (r.merged_into === d.id) r.merged_into = into.id;
    } else if (action === 'bestaetigen') {
      if (['bestaetigt', 'zusammengefuehrt', 'abgelehnt'].includes(d.status)) throw E('already_reviewed');
      const loc = d.target_location_id || photo.location_id || null;
      if (loc && db.locations.some((l) => l.id === loc && l.archived)) throw E('invalid_location');
      const cat = d.category_id ? db.categories.find((c) => c.id === d.category_id) : null;
      const catName = cat ? cat.name : null;
      const fromPhoto = `Erfasst aus Foto ${photo.file_name ?? ''}`;

      if ((txt(data.mode) ?? 'neu') === 'verknuepfen') {
        // mit bestehendem Inventar verknüpfen (keine Doppelerfassung)
        const aid = nullif(txt(data.article_id));
        const mid = nullif(txt(data.machine_id));
        const lid = nullif(txt(data.location_id));
        if (aid !== null) {
          const a = isUuid(aid) ? db.articles.find((r) => r.id === aid) : null;
          if (!a) throw E('not_found');
          d.article_id = a.id; entity = 'article'; codes = [a.code]; first = a.id;
        } else if (mid !== null) {
          const m = isUuid(mid) ? db.machines.find((r) => r.id === mid) : null;
          if (!m) throw E('not_found');
          d.machine_id = m.id; entity = 'machine'; codes = [m.code]; first = m.id;
        } else if (lid !== null) {
          const l = isUuid(lid) ? db.locations.find((r) => r.id === lid) : null;
          if (!l) throw E('not_found');
          d.location_ref_id = l.id; entity = 'location'; codes = [l.code]; first = l.id;
        } else throw E('invalid_input');
      } else if (d.kind === 'unbekannt') {
        throw E('kind_required');
      } else if (d.kind === 'einzelinventar' || d.kind === 'set') {
        // jedes Einzelstück bekommt eine eigene Identität (eigener Code/QR)
        if (!d.quantity_certain || d.quantity === null || d.quantity === undefined) throw E('quantity_uncertain');
        const q = Number(d.quantity);
        if (q < 1 || q > 50 || q !== Math.floor(q)) throw E('invalid_qty');
        const url = productUrl(d.product);
        for (let i = 0; i < q; i++) {
          const newId = x.coreSaveMachine({
            name: d.name, category: catName, category_id: d.category_id, brand: d.brand, model: d.model,
            serial_no: q === 1 ? d.serial_no : null, home_location_id: loc, is_set: d.kind === 'set', product_url: url,
            condition: d.condition === 'beschaedigt' ? 'maengel' : 'ok',
            notes: left(concatWs('\n', nullif(d.notes), productSummary(d.product), fromPhoto), 2000),
          });
          const m = db.machines.find((r) => r.id === newId);
          codes.push(m.code);
          if (!first) first = m.id;
        }
        d.machine_id = first;
        entity = 'machine';
      } else if (d.kind === 'bestandsartikel') {
        // unsichere Mengen werden nie als Bestand übernommen
        let q;
        if (!d.quantity_certain || d.quantity === null || d.quantity === undefined) {
          if (pgBool(data.without_stock, E) !== true) throw E('quantity_uncertain');
          q = 0;
        } else q = Number(d.quantity);
        const newId = x.coreSaveArticle({
          name: d.name, category: catName, category_id: d.category_id, brand: d.brand, model: d.model,
          unit: reviewUnit(d.unit), stock: q, location_id: loc, product_url: productUrl(d.product),
          notes: left(concatWs('\n', nullif(d.notes), q === 0 && !d.quantity_certain ? 'Menge noch nicht gezählt' : null,
            productSummary(d.product), fromPhoto), 2000),
        });
        const a = db.articles.find((r) => r.id === newId);
        d.article_id = a.id; entity = 'article'; codes = [a.code]; first = a.id;
      } else if (d.kind === 'einrichtung') {
        const type = nullif(txt(data.loc_type)) ?? 'regal';
        const scRaw = txt(data.short_code);
        const sc = scRaw === null ? null : nullif(sqlTrim(scRaw).toUpperCase());
        if (sc !== null && !SHORT_CODE_RE.test(sc)) throw E('invalid_short_code', sc);
        const newId = x.coreSaveLocation({
          name: d.name, type, parent_id: loc, short_code: sc, notes: left(concatWs('\n', nullif(d.notes), fromPhoto), 2000),
        });
        const l = db.locations.find((r) => r.id === newId);
        d.location_ref_id = l.id; entity = 'location'; codes = [l.code]; first = l.id;
      }
      d.status = 'bestaetigt';
      reviewed();
      // dasselbe Objekt auf weiteren Fotos desselben Raums: als «zusammengeführt» verknüpfen
      for (const o of db.detections) {
        if (o.id === d.id || o.obj_key !== d.obj_key || !(o.status === 'offen' || o.status === 'spaeter')) continue;
        const op = photoById(o.photo_id);
        // nur im selben Raum; Fotos ohne Lagerort werden nie fotoübergreifend verknüpft
        if (root === null || root === undefined) { if (o.photo_id !== d.photo_id) continue; }
        else if (locationRoot(op ? op.location_id : null) !== root) continue;
        Object.assign(o, {
          status: 'zusammengefuehrt', merged_into: d.id, article_id: d.article_id, machine_id: d.machine_id,
          location_ref_id: d.location_ref_id, reviewed_by: u, reviewed_at: t,
        });
        merged += 1;
      }
    } else {
      throw E('invalid_input');
    }
    const details = { name: d.name, status: d.status };
    if (entity !== null) details.erfasst = entity;
    details.codes = codes;
    if (merged) details.verknuepft = merged;
    x.audit(`ki_${action}`, 'detections', d.id, details);
    return { detection: pick(d, DETECTION_COLS), entity, entity_id: first, codes, merged };
  }

  // ---- KI-Ergebnis importieren (import_photo_analysis) ----
  function coreImportAnalysis(list, source) {
    if (!x.isStaff()) throw E('not_authorized');
    const db = D();
    const src = left(nullif(sqlTrim(txt(source) ?? '')) ?? 'KI-Analyse', 200);
    let matched = 0; let created = 0; let existing = 0; let failed = 0; let invalid = 0; let dupes = 0;
    const unmatched = [];
    for (const item of list) {
      if (!isObj(item)) { invalid += 1; continue; }
      const sha = (txt(item.sha256) ?? '').trim().toLowerCase();
      const photo = db.photos.find((p) => p.sha256 === sha);
      if (!photo) { unmatched.push(txt(item.file) ?? txt(item.sha256) ?? '?'); continue; }
      matched += 1;
      const status = txt(item.status);
      if (status === 'duplikat') { dupes += 1; continue; }
      const t = now();
      if (status === 'fehler') {
        // ein bereits analysiertes Foto wird durch einen späteren Fehlversuch nicht zurückgesetzt
        if (['neu', 'in_analyse', 'fehler'].includes(photo.status)) {
          Object.assign(photo, {
            status: 'fehler', analyzed_at: t, analysis_source: src,
            analysis_error: left(nullif(sqlTrim(txt(item.error) ?? '')) ?? 'Analyse nicht möglich', 500),
          });
        }
        failed += 1;
        continue;
      }
      Object.assign(photo, {
        status: 'analysiert', analysis_error: null, analysis_source: src, analyzed_at: t,
        scene: left(txt(item.scene), 1000), area: left(txt(item.area), 300),
        observations: Array.isArray(item.observations) ? item.observations : [],
        recommendations: Array.isArray(item.recommendations) ? item.recommendations : [],
      });
      let photoNew = 0;
      for (const obj of Array.isArray(item.objects) ? item.objects : []) {
        const key = isObj(obj) ? left(sqlTrim(txt(obj.key) ?? '').toLowerCase(), 120) : '';
        const name = isObj(obj) ? sqlTrim(txt(obj.name) ?? '') : '';
        if (!isObj(obj) || key === '' || name === '') { invalid += 1; continue; }   // gezählt und gemeldet
        if (db.detections.some((r) => r.photo_id === photo.id && r.obj_key === key)) { existing += 1; continue; }
        const kind = KNOWN_KINDS.includes(txt(obj.kind)) ? txt(obj.kind) : 'unbekannt';
        const conf = ['sicher', 'wahrscheinlich'].includes(txt(obj.confidence)) ? txt(obj.confidence) : 'unbekannt';
        let px = Array.isArray(obj.pos) ? jnum(obj.pos[0]) : null;
        let py = Array.isArray(obj.pos) ? jnum(obj.pos[1]) : null;
        if (px === null || py === null || px < 0 || px > 1 || py < 0 || py > 1) { px = null; py = null; }
        let qty = jnum(obj.quantity);
        if (qty !== null && (qty < 0 || qty >= 1e9)) qty = null;
        const partOf = txt(obj.part_of);
        db.detections.push({
          id: uuid(), photo_id: photo.id, obj_key: key, source: 'ki', name: left(name, 200), kind,
          category_id: categoryByPath(txt(obj.category)), category_text: left(txt(obj.category), 200),
          brand: clean(obj.brand, 100), model: clean(obj.model, 100), serial_no: clean(obj.serial, 100),
          text_read: Array.isArray(obj.text_read) ? obj.text_read : [],
          quantity: qty, quantity_certain: qty !== null && txt(obj.quantity_certain) === 'true',
          unit: clean(obj.unit, 20), condition: clean(obj.condition, 30), confidence: conf, pos_x: px, pos_y: py,
          part_of_key: partOf === null ? null : left(nullif(sqlTrim(partOf).toLowerCase()), 120),
          notes: left(txt(obj.notes), 1000), product: isObj(obj.product) ? obj.product : null,
          status: 'offen', article_id: null, machine_id: null, location_ref_id: null, target_location_id: null,
          merged_into: null, reviewed_by: null, reviewed_at: null, created_at: t,
        });
        created += 1;
        photoNew += 1;
      }
      x.audit('ki_import', 'photos', photo.id, { quelle: src, datei: photo.file_name ?? null, neue_objekte: photoNew });
    }
    return { matched, created, existing, failed, duplicates: dupes, invalid, unmatched };
  }

  // ---- Fotos löschen (photo_delete_guard + Kaskaden) ----
  function coreDeletePhoto(id) {
    const db = D();
    const p = isUuid(id) ? db.photos.find((r) => r.id === id) : null;
    if (!p || !x.canRead()) throw E('not_found');
    if (!x.isStaff()) throw E('not_authorized');
    if (db.detections.some((d) => d.photo_id === p.id && d.status === 'bestaetigt')) throw E('in_use');   // Herkunftsnachweis
    if (db.floor_plans.some((f) => f.photo_id === p.id)) throw E('in_use');   // Planbild eines Gebäudeplans (on delete restrict)
    const gone = new Set(db.detections.filter((d) => d.photo_id === p.id).map((d) => d.id));
    db.detections = db.detections.filter((d) => !gone.has(d.id));
    for (const d of db.detections) if (d.merged_into && gone.has(d.merged_into)) d.merged_into = null;
    const hs = db.photo_hotspots.filter((h) => h.photo_id === p.id);
    db.photo_hotspots = db.photo_hotspots.filter((h) => h.photo_id !== p.id);
    for (const h of hs) x.audit('delete', 'photo_hotspots', h.id, h);
    for (const t of db.org_tasks) {
      if (t.photo_id === p.id) { t.photo_id = null; x.audit('update', 'org_tasks', t.id, { photo_id: { alt: p.id, neu: null } }); }
    }
    for (const l of db.locations) {
      if (l.cover_photo_id === p.id) {
        l.cover_photo_id = null;
        l.updated_at = now();
        x.audit('update', 'locations', l.id, { cover_photo_id: { alt: p.id, neu: null } });
      }
    }
    db.photos = db.photos.filter((r) => r.id !== p.id);
    x.audit('delete', 'photos', p.id, p);
    delete db.files[p.path];
  }

  // ---- Aufgaben (org_task_status) ----
  function coreSaveTask(obj) {
    if (!obj || typeof obj !== 'object') throw E('invalid_value');
    const db = D();
    const text = (key) => (hasKey(obj, key) ? trimOrNull(obj[key]) : undefined);
    const sortOf = (v) => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : 0);
    const checkTitle = (s) => { if (!s) throw E('name_required'); if (charLen(s) > 300) throw E('name_required'); };
    if (!obj.id) {
      const title = text('title');
      checkTitle(title);
      if (!isUuid(obj.location_id)) throw E('invalid_location');
      if (!x.isStaff()) throw E('not_authorized');
      const status = obj.status || 'offen';
      if (!TASK_STATUSES.includes(status)) throw E('invalid_status');
      const source = obj.source || 'manuell';
      if (!TASK_SOURCES.includes(source)) throw E('invalid_value', 'org_tasks_source_check');
      if (!locById(obj.location_id)) throw E('invalid_location');
      const photoId = obj.photo_id || null;
      if (photoId && !photoById(photoId)) throw E('not_found');
      const assigned = obj.assigned_to || null;
      if (assigned && !x.profileOf(assigned)) throw E('not_found');
      const t = now();
      const u = x.uid();
      const done = status === 'erledigt';
      const row = {
        id: uuid(), location_id: obj.location_id, photo_id: photoId, title, details: text('details') ?? null, source, status,
        assigned_to: assigned, sort: sortOf(obj.sort), created_by: u, created_at: t, done_by: done ? u : null, done_at: done ? t : null,
      };
      db.org_tasks.push(row);
      x.audit('insert', 'org_tasks', row.id, omit(row, ['created_at']));
      return row.id;
    }
    if (!isUuid(obj.id)) throw E('not_found');
    const patch = {};
    if (hasKey(obj, 'title')) { patch.title = text('title'); checkTitle(patch.title); }
    if (hasKey(obj, 'details')) patch.details = text('details');
    if (hasKey(obj, 'status')) patch.status = obj.status;
    if (hasKey(obj, 'assigned_to')) patch.assigned_to = obj.assigned_to || null;
    if (hasKey(obj, 'sort')) patch.sort = Math.round(Number(obj.sort) || 0);
    const row = db.org_tasks.find((r) => r.id === obj.id) || null;
    if (!row || !x.canRead()) throw E('not_found');
    if (!Object.keys(patch).length) return row.id;
    if (!x.isStaff()) throw E('not_authorized');
    if (has(patch, 'status') && !TASK_STATUSES.includes(patch.status)) throw E('invalid_status');
    if (patch.assigned_to && !x.profileOf(patch.assigned_to)) throw E('not_found');
    if (has(patch, 'status') && patch.status !== row.status) {   // erledigt → wer und wann; sonst leeren
      const done = patch.status === 'erledigt';
      patch.done_by = done ? x.uid() : null;
      patch.done_at = done ? now() : null;
    }
    const diff = x.applyPatch(row, patch);
    if (Object.keys(diff).length) x.audit('update', 'org_tasks', row.id, diff);
    return row.id;
  }

  // ---- Bereiche auf Fotos ----
  function coreSaveHotspot(obj) {
    if (!obj || typeof obj !== 'object') throw E('invalid_value');
    const db = D();
    const p = {};
    for (const key of ['location_id', 'x', 'y', 'w', 'h', 'label']) if (hasKey(obj, key)) p[key] = obj[key];
    for (const key of ['x', 'y', 'w', 'h']) {
      if (!has(p, key)) continue;
      if (p[key] === null && (key === 'w' || key === 'h')) continue;
      const n = Number(p[key]);
      if (p[key] === null || p[key] === '' || !Number.isFinite(n) || n < 0 || n > 1) throw E('invalid_value');
      p[key] = Math.round(n * 10000) / 10000;
    }
    // photo_hotspots_w_check / _h_check: Breite/Höhe > 0
    for (const key of ['w', 'h']) if (has(p, key) && p[key] !== null && !(p[key] > 0)) throw E('invalid_value', `photo_hotspots_${key}_check`);
    if (has(p, 'label')) p.label = trimOrNull(p.label);
    if (has(p, 'location_id')) p.location_id = p.location_id || null;
    if (!obj.id) {
      if (!isUuid(obj.photo_id)) throw E('not_found');
      if (p.location_id && !isUuid(p.location_id)) throw E('invalid_location');
      // auf einem Gebäudeplan darf ein Bereich zunächst nur beschriftet sein (photo_hotspots_label_or_location_chk)
      if (!p.location_id && !p.label) throw E('name_required');
      if (!x.isStaff()) throw E('not_authorized');
      if (!has(p, 'x') || !has(p, 'y')) throw E('invalid_value');
      if (!photoById(obj.photo_id)) throw E('not_found');
      if (p.location_id && !locById(p.location_id)) throw E('invalid_location');
      const row = {
        id: uuid(), photo_id: obj.photo_id, location_id: p.location_id ?? null, x: p.x, y: p.y, w: p.w ?? null, h: p.h ?? null,
        label: p.label ?? null, created_by: x.uid(), created_at: now(),
      };
      db.photo_hotspots.push(row);
      x.audit('insert', 'photo_hotspots', row.id, omit(row, ['created_at']));
      return row;
    }
    if (!isUuid(obj.id)) throw E('not_found');
    const row = db.photo_hotspots.find((h) => h.id === obj.id) || null;
    if (!row || !x.canRead()) throw E('not_found');
    if (!x.isStaff()) throw E('not_authorized');
    const loc = has(p, 'location_id') ? p.location_id : row.location_id;
    const label = has(p, 'label') ? p.label : row.label;
    if (!loc && !label) throw E('invalid_value', 'photo_hotspots_label_or_location_chk');
    if (has(p, 'location_id') && p.location_id && !locById(p.location_id)) throw E('invalid_location');
    const diff = x.applyPatch(row, p);
    if (Object.keys(diff).length) x.audit('update', 'photo_hotspots', row.id, diff);
    return row;
  }

  // ---- Gebäudepläne (floor_plans / floor_plan_overview) ----
  function vFloorPlan(f) {
    const p = photoById(f.photo_id) || {};
    const st = siteById(f.site_id);
    const hs = D().photo_hotspots.filter((h) => h.photo_id === f.photo_id);
    return {
      ...pick(f, FLOOR_PLAN_COLS), photo_path: p.path ?? null, photo_width: p.width ?? null, photo_height: p.height ?? null,
      area_count: hs.length, linked_count: hs.filter((h) => h.location_id).length,
      site_name: st ? st.name : null, site_sort: st ? st.sort : null,
    };
  }
  function coreSaveFloorPlan(obj) {
    if (!obj || typeof obj !== 'object') throw E('invalid_value');
    const db = D();
    const patch = {};
    if (hasKey(obj, 'name')) {
      patch.name = String(obj.name ?? '').trim();
      if (!patch.name || charLen(patch.name) > 80) throw E('name_required');   // floor_plans_name_check (1–80)
    }
    if (hasKey(obj, 'sort')) patch.sort = Math.round(Number(obj.sort) || 0);
    if (hasKey(obj, 'notes')) patch.notes = trimOrNull(obj.notes);
    if (hasKey(obj, 'site_id')) {   // Standort: '' oder null = ohne
      patch.site_id = obj.site_id || null;
      if (patch.site_id && !isUuid(patch.site_id)) throw E('invalid_value');
    }
    if (!obj.id) {
      if (!patch.name) throw E('name_required');
      if (!isUuid(obj.photo_id)) throw E('file_required');
      if (!x.isStaff()) throw E('not_authorized');
      if (!photoById(obj.photo_id)) throw E('not_found');
      if (db.floor_plans.some((f) => f.photo_id === obj.photo_id)) throw E('duplicate', 'floor_plans_photo_id_key');
      if (patch.site_id && !siteById(patch.site_id)) throw E('not_found');   // floor_plans_site_id_fkey
      const t = now();
      const row = {
        id: uuid(), name: patch.name, sort: patch.sort ?? 0, photo_id: obj.photo_id, notes: patch.notes ?? null,
        created_by: x.uid(), created_at: t, updated_at: t, site_id: patch.site_id ?? null,
      };
      db.floor_plans.push(row);
      x.audit('insert', 'floor_plans', row.id, omit(row, ['created_at', 'updated_at']));
      return row.id;
    }
    if (!isUuid(obj.id)) throw E('not_found');
    const row = db.floor_plans.find((f) => f.id === obj.id) || null;
    if (!row || !x.canRead()) throw E('not_found');
    if (!Object.keys(patch).length) return row.id;
    if (!x.isStaff()) throw E('not_authorized');
    if (patch.site_id && !siteById(patch.site_id)) throw E('not_found');   // floor_plans_site_id_fkey
    const diff = x.applyPatch(row, patch);   // photo_id ist nach dem Anlegen fest
    row.updated_at = now();
    if (Object.keys(diff).length) x.audit('update', 'floor_plans', row.id, diff);
    return row.id;
  }

  // ---- Standorte (sites / site_overview; gruppieren Räume und Pläne, stehen nicht im Code) ----
  /** site_overview: sites.* + space_count (nicht archivierte Räume) + plan_count (Gebäudepläne) */
  function siteCounts() {
    const db = D();
    const spaces = new Map();
    const plans = new Map();
    for (const l of db.locations) if (l.site_id && !l.parent_id && !l.archived) spaces.set(l.site_id, (spaces.get(l.site_id) || 0) + 1);
    for (const f of db.floor_plans) if (f.site_id) plans.set(f.site_id, (plans.get(f.site_id) || 0) + 1);
    return { spaces, plans };
  }
  const vSite = (s, k = siteCounts()) => ({ ...pick(s, SITE_COLS), space_count: k.spaces.get(s.id) || 0, plan_count: k.plans.get(s.id) || 0 });
  /** sites_name_uniq: lower(trim(name)) eindeutig */
  function assertSiteUnique(id, name) {
    const n = sqlTrim(name).toLowerCase();
    if (D().sites.some((s) => s.id !== id && sqlTrim(s.name).toLowerCase() === n)) throw E('duplicate', 'sites_name_uniq');
  }
  function coreSaveSite(obj) {
    if (!obj || typeof obj !== 'object') throw E('invalid_value');
    const db = D();
    const patch = {};
    // Längen wie api-supabase.js (vor dem Senden geprüft → invalid_value)
    if (hasKey(obj, 'name')) {
      patch.name = String(obj.name ?? '').trim();
      if (!patch.name) throw E('name_required');
      if (patch.name.length > 80) throw E('invalid_value');
    }
    if (hasKey(obj, 'address')) { patch.address = trimOrNull(obj.address); if (patch.address && patch.address.length > 200) throw E('invalid_value'); }
    if (hasKey(obj, 'sort')) patch.sort = Math.round(Number(obj.sort) || 0);
    if (hasKey(obj, 'notes')) { patch.notes = trimOrNull(obj.notes); if (patch.notes && patch.notes.length > 2000) throw E('invalid_value'); }
    if (!obj.id) {
      if (!patch.name) throw E('name_required');
      if (!x.isStaff()) throw E('not_authorized');   // sites_insert: Lagerverantwortliche/Admins
      assertSiteUnique(null, patch.name);
      const t = now();
      const row = {
        id: uuid(), name: patch.name, address: patch.address ?? null, sort: patch.sort ?? 0, notes: patch.notes ?? null,
        created_by: x.uid(), created_at: t, updated_at: t,
      };
      db.sites.push(row);
      x.audit('insert', 'sites', row.id, omit(row, ['created_at', 'updated_at']));
      return row.id;
    }
    if (!isUuid(obj.id)) throw E('not_found');
    const row = db.sites.find((s) => s.id === obj.id) || null;
    if (!row || !x.canRead()) throw E('not_found');
    if (!Object.keys(patch).length) return row.id;
    if (!x.isStaff()) throw E('not_authorized');   // sites_update
    if (has(patch, 'name')) assertSiteUnique(row.id, patch.name);
    const diff = x.applyPatch(row, patch);
    row.updated_at = now();
    if (Object.keys(diff).length) x.audit('update', 'sites', row.id, diff);
    return row.id;
  }

  // ---- Sets ----
  function coreSaveComponent(obj) {
    if (!obj || typeof obj !== 'object') throw E('invalid_value');
    const db = D();
    const qty = hasKey(obj, 'qty') ? num(obj.qty) : undefined;
    if (qty !== undefined && (qty === null || Number.isNaN(qty) || qty <= 0 || qty >= 1e6)) throw E('invalid_qty');
    const nameOf = () => trimOrNull(obj.name);
    if (hasKey(obj, 'name') && nameOf() !== null && charLen(nameOf()) > 200) throw E('name_required');
    if (!obj.id) {
      if (!isUuid(obj.set_id)) throw E('not_found');
      const row = {
        id: null, set_id: obj.set_id, machine_id: obj.machine_id || null, article_id: obj.article_id || null,
        name: nameOf(), qty: qty ?? 1, note: trimOrNull(obj.note),
        sort: Number.isFinite(Number(obj.sort)) ? Math.round(Number(obj.sort)) : 0, created_by: null, created_at: null,
      };
      if (!row.machine_id && !row.article_id && !row.name) throw E('name_required');
      if (!x.isStaff()) throw E('not_authorized');
      if (row.machine_id && row.machine_id === row.set_id) throw E('invalid_input');   // set_components_self_chk
      if (!db.machines.some((m) => m.id === row.set_id)) throw E('not_found');
      if (row.machine_id && !db.machines.some((m) => m.id === row.machine_id)) throw E('not_found');
      if (row.article_id && !db.articles.some((a) => a.id === row.article_id)) throw E('not_found');
      Object.assign(row, { id: uuid(), created_by: x.uid(), created_at: now() });
      db.set_components.push(row);
      x.audit('insert', 'set_components', row.id, omit(row, ['created_at']));
      return row;
    }
    if (!isUuid(obj.id)) throw E('not_found');
    const patch = {};
    if (qty !== undefined) patch.qty = qty;
    if (hasKey(obj, 'note')) patch.note = trimOrNull(obj.note);
    if (hasKey(obj, 'name')) patch.name = nameOf();
    if (hasKey(obj, 'sort')) patch.sort = Math.round(Number(obj.sort) || 0);
    const row = db.set_components.find((r) => r.id === obj.id) || null;
    if (!row || !x.canRead()) throw E('not_found');
    if (!x.isStaff()) throw E('not_authorized');
    const name = has(patch, 'name') ? patch.name : row.name;
    if (!row.machine_id && !row.article_id && !name) throw E('invalid_input');   // set_components_target_chk
    const diff = x.applyPatch(row, patch);
    if (Object.keys(diff).length) x.audit('update', 'set_components', row.id, diff);
    return row;
  }

  const statusFilter = (status) => {
    if (status === undefined || status === null || status === '') return () => true;
    const list = Array.isArray(status) ? status : [status];
    return (s) => list.includes(s);
  };

  // =============================================================================================
  //  Öffentliche Methoden (Vertrag: docs/ARCHITECTURE.md «API (neu)»)
  // =============================================================================================
  Object.assign(api, {
    // ---- Kategorien ----
    async listCategories({ includeArchived = false } = {}) {
      return x.read(() => {
        if (!x.canRead()) return [];
        return treeOrder(categoryTree(D()).filter((c) => includeArchived || !c.archived));
      });
    },
    async saveCategory(obj) { return x.mutate(() => categoryRow(coreSaveCategory(obj))); },
    async deleteCategory(id) {
      return x.mutate(() => {
        const db = D();
        const c = isUuid(id) ? db.categories.find((r) => r.id === id) : null;
        if (!c || !x.canRead()) throw E('not_found');
        if (!x.isAdmin()) throw E('not_authorized');
        if (db.categories.some((r) => r.parent_id === c.id)
            || db.machines.some((m) => m.category_id === c.id)
            || db.articles.some((a) => a.category_id === c.id)) throw E('in_use');   // on delete restrict
        for (const d of db.detections) if (d.category_id === c.id) d.category_id = null;
        db.categories = db.categories.filter((r) => r.id !== c.id);
        x.audit('delete', 'categories', c.id, c);
      });
    },

    // ---- Räume, Kennzahlen ----
    async listSpaces() {
      return x.read(() => (x.canRead() ? sortRows(spaceRows().filter((s) => !s.archived), 'name') : []));
    },
    async orgStats() { return x.read(() => (x.canRead() ? orgStatsRow() : ZERO_STATS())); },
    async setLocationOrganized(locationId, done) {
      return x.mutate(() => {
        if (!isUuid(locationId)) throw E('not_found');
        if (!x.isStaff()) throw E('not_authorized');
        const db = D();
        const l = locById(locationId);
        if (!l) throw E('not_found');
        const flag = Boolean(done);
        if (flag) {
          const sub = locationSubtree(l.id);
          const photoIds = new Set(db.photos.filter((p) => sub.has(p.location_id)).map((p) => p.id));
          const det = db.detections.filter((d) => photoIds.has(d.photo_id) && (d.status === 'offen' || d.status === 'spaeter')).length;
          const tasks = db.org_tasks.filter((t) => sub.has(t.location_id) && t.status === 'offen').length;
          if (det > 0 || tasks > 0) throw E('open_items', `${det}/${tasks}`);
          l.organized_at = now();
          l.organized_by = x.uid();
        } else {
          l.organized_at = null;
          l.organized_by = null;
        }
        l.updated_at = now();
        x.audit('organisiert', 'locations', l.id, { organisiert: flag });
        return pick(l, x.cols.LOCATION_COLS);
      });
    },

    // ---- Fotos ----
    async listPhotos({ locationId, spaceId, status, ids, kind = 'foto' } = {}) {
      return x.read(() => {
        if (!x.canRead()) return [];
        const c = x.viewCtx();
        const counts = photoCounts();
        const st = statusFilter(status);
        const idSet = Array.isArray(ids) ? new Set(ids) : null;
        return D().photos
          .map((p) => vPhoto(p, c, counts))
          .filter((p) => (!kind || p.kind === kind)   // Planbilder (kind 'plan') erscheinen nicht in Fotolisten
            && (!locationId || p.location_id === locationId) && (!spaceId || p.root_id === spaceId)
            && st(p.status) && (!idSet || idSet.has(p.id)))
          .sort((a, b) => (ms(a.created_at) - ms(b.created_at)) || cmp(a.file_name, b.file_name) || cmp(a.id, b.id));
      });
    },
    async importPhoto(file, { locationId, folder, sha256, kind = 'foto' } = {}) {
      x.load();
      if (!PHOTO_KINDS.includes(kind)) throw E('invalid_input');
      if (!file || typeof file.size !== 'number') throw E('file_required');
      const origMime = String(file.type || '').toLowerCase() || guessImageMime(file.name);
      if (!IMAGE_MIME.includes(origMime)) throw E('file_type', origMime || '?');
      if (locationId && !isUuid(locationId)) throw E('invalid_location');
      let sha;
      try { sha = String(sha256 || await sha256Hex(file)).toLowerCase(); } catch { throw E('invalid_file'); }
      if (!SHA_RE.test(sha)) throw E('invalid_file');
      // gleiches Originalfoto schon importiert → bestehendes Foto (SHA-256 der Originaldatei)
      const existing = x.read(() => { const p = D().photos.find((r) => r.sha256 === sha); return p && x.canRead() ? photoView(p) : null; });
      if (existing) return { photo: existing, duplicate: true };
      if (!x.isStaff()) throw E('not_authorized');
      let blob = file;
      let mime = origMime;
      let width = null;
      let height = null;
      // Demo (localStorage ist klein): auch Pläne verkleinern, PNG-Pläne aber als PNG lassen (Strichzeichnung bleibt scharf)
      const outType = kind === 'plan' && origMime === 'image/png' ? 'image/png' : 'image/jpeg';
      const small = await resizeWithSize(file, x.limits.imageMaxPx, x.limits.imageQuality, outType);
      if (small) { blob = small.blob; mime = small.mime; width = small.width; height = small.height; }
      if (blob.size > x.limits.maxFileBytes) throw E('file_too_large');
      const dataUrl = await x.blobToDataUrl(blob, mime);
      const ext = mime === 'image/jpeg' ? 'jpg' : (Object.keys(IMAGE_EXT).find((k) => IMAGE_EXT[k] === mime) || 'jpg');
      return x.mutate(() => {
        const db = D();
        const again = db.photos.find((r) => r.sha256 === sha);
        if (again) return { photo: photoView(again), duplicate: true };
        if (!x.isStaff()) throw E('not_authorized');
        if (locationId && !locById(locationId)) throw E('invalid_location');
        const row = {
          id: uuid(), location_id: locationId || null, path: `photos/${sha}.${ext}`, sha256: sha,
          file_name: String(file.name || 'foto').slice(0, 255), folder: trimOrNull(folder), mime, size_bytes: blob.size,
          width, height,
          // photo_insert_defaults: Herkunft und Status setzt der Server
          status: 'neu', analysis_error: null, analysis_source: null, analyzed_at: null, scene: null, area: null,
          observations: [], recommendations: [], uploaded_by: x.uid(), created_at: now(), kind,
        };
        db.photos.push(row);
        db.files[row.path] = dataUrl;
        x.audit('insert', 'photos', row.id, omit(row, ['created_at']));
        return { photo: photoView(row), duplicate: false };
      });
    },
    async setPhotoStatus(ids, status) {
      const list = (Array.isArray(ids) ? ids : [ids]).filter(isUuid);
      if (!SETTABLE_PHOTO_STATUS.includes(status)) throw E('invalid_status');
      if (!list.length) return 0;
      return x.mutate(() => {
        if (!x.isStaff()) throw E('not_authorized');
        const from = status === 'in_analyse' ? ['neu', 'fehler'] : ['in_analyse', 'fehler'];
        const set = new Set(list);
        let n = 0;
        for (const p of D().photos) {
          if (!set.has(p.id) || !from.includes(p.status)) continue;
          p.status = status;
          p.analysis_error = null;
          n += 1;
        }
        return n;
      });
    },
    async movePhoto(id, locationId) {
      return x.mutate(() => {
        if (!isUuid(id)) throw E('not_found');
        if (locationId && !isUuid(locationId)) throw E('invalid_location');
        const p = photoById(id);
        if (!p || !x.canRead()) throw E('not_found');
        if (!x.isStaff()) throw E('not_authorized');
        if (locationId && !locById(locationId)) throw E('invalid_location');
        p.location_id = locationId || null;
        return photoView(p);
      });
    },
    async deletePhoto(photo) {
      const id = typeof photo === 'string' ? photo : photo && photo.id;
      return x.mutate(() => { coreDeletePhoto(id); });
    },
    async importAnalysis(items, source) {
      if (!Array.isArray(items)) throw E('invalid_input');
      if (items.length > MAX_ANALYSIS_ITEMS) throw E('too_many');
      const list = asJson(items);
      if (!Array.isArray(list)) throw E('invalid_input');
      return x.mutate(() => coreImportAnalysis(list, trimOrNull(source) || 'KI-Analyse'));
    },

    // ---- Erkennungen ----
    async listDetections({ spaceId, photoId, status, articleId, machineId } = {}) {
      return x.read(() => {
        if (!x.canRead()) return [];
        const k = detectionCtx();
        const st = statusFilter(status);
        return D().detections
          .filter((d) => (!photoId || d.photo_id === photoId) && (!articleId || d.article_id === articleId)
            && (!machineId || d.machine_id === machineId) && st(d.status))
          .map((d) => vDetection(d, k))
          .filter((d) => !spaceId || d.space_id === spaceId)
          .sort((a, b) => ms(a.created_at) - ms(b.created_at));
      });
    },
    async reviewDetection(id, action, data = {}) {
      return x.mutate(() => coreReview(id, String(action || ''), data && typeof data === 'object' ? data : {}));
    },
    async addDetection(photoId, data = {}) {
      return x.mutate(() => {
        if (!isUuid(photoId)) throw E('not_found');
        if (!x.isStaff()) throw E('not_authorized');
        const db = D();
        if (!photoById(photoId)) throw E('not_found');
        const p = isObj(data) ? asJson(data) : {};
        let name = left(sqlTrim(txt(p.name) ?? ''), 200);
        if (name === '') name = 'Unbekanntes Objekt';
        const target = nullif(txt(p.target_location_id));
        if (target !== null && !isUuid(target)) throw E('not_found');
        const pos = (v) => { const n = jnum(v); return n !== null && n >= 0 && n <= 1 ? n : null; };
        const row = {
          id: uuid(), photo_id: photoId, obj_key: `manuell-${uuid().replace(/-/g, '')}`, source: 'manuell', name,
          kind: KNOWN_KINDS.includes(txt(p.kind)) ? txt(p.kind) : 'unbekannt',
          category_id: null, category_text: null, brand: null, model: null, serial_no: null, text_read: [],
          quantity: null, quantity_certain: false, unit: null, condition: null, confidence: 'unbekannt',
          pos_x: pos(p.pos_x), pos_y: pos(p.pos_y), part_of_key: null, notes: left(txt(p.notes), 1000), product: null,
          status: 'offen', article_id: null, machine_id: null, location_ref_id: null,
          target_location_id: target !== null && locById(target) ? target : null,
          merged_into: null, reviewed_by: null, reviewed_at: null, created_at: now(),
        };
        db.detections.push(row);
        x.audit('insert', 'detections', row.id, { name: row.name, quelle: 'manuell' });
        return pick(row, DETECTION_COLS);
      });
    },

    // ---- Organisationsaufgaben ----
    async listTasks({ locationId, spaceId, status } = {}) {
      return x.read(() => {
        if (!x.canRead()) return [];
        const c = x.viewCtx();
        const st = statusFilter(status);
        return D().org_tasks
          .map((t) => vTask(t, c))
          .filter((t) => (!locationId || t.location_id === locationId) && (!spaceId || t.root_id === spaceId) && st(t.status))
          .sort((a, b) => (TASK_RANK[a.status] - TASK_RANK[b.status]) || ((a.sort || 0) - (b.sort || 0))
            || (ms(a.created_at) - ms(b.created_at)));
      });
    },
    async saveTask(obj) {
      return x.mutate(() => {
        const id = coreSaveTask(obj);
        const t = D().org_tasks.find((r) => r.id === id);
        return vTask(t, x.viewCtx());
      });
    },

    // ---- Bereiche auf Fotos ----
    async listHotspots({ photoId, photoIds, locationId } = {}) {
      return x.read(() => {
        const ids = (Array.isArray(photoIds) ? photoIds : (photoId ? [photoId] : [])).filter(isUuid);
        const loc = isUuid(locationId) ? locationId : null;   // alle Bereiche (auch auf Plänen), die auf diesen Lagerort zeigen
        if ((!ids.length && !loc) || !x.canRead()) return [];
        const set = new Set(ids);
        return D().photo_hotspots
          .filter((h) => (!ids.length || set.has(h.photo_id)) && (!loc || h.location_id === loc))
          .sort((a, b) => ms(a.created_at) - ms(b.created_at))
          .map(vHotspot);
      });
    },
    async saveHotspot(obj) { return x.mutate(() => vHotspot(coreSaveHotspot(obj))); },

    // ---- Standorte (Adressen; gruppieren Räume und Pläne, stehen nicht im Code) ----
    async listSites() {
      return x.read(() => {
        if (!x.canRead()) return [];
        const k = siteCounts();
        return D().sites
          .slice()
          .sort((a, b) => ((a.sort || 0) - (b.sort || 0)) || cmp(a.name, b.name) || cmp(a.id, b.id))
          .map((s) => vSite(s, k));
      });
    },
    async saveSite(obj) {
      return x.mutate(() => {
        const id = coreSaveSite(obj);
        return vSite(D().sites.find((s) => s.id === id));
      });
    },
    async deleteSite(id) {
      return x.mutate(() => {
        const db = D();
        const s = isUuid(id) ? db.sites.find((r) => r.id === id) : null;
        if (!s || !x.canRead()) throw E('not_found');
        if (!x.isAdmin()) throw E('not_authorized');   // sites_delete: nur Admins
        // Fremdschlüssel «on delete restrict»: Räume (auch archivierte) und Gebäudepläne am Standort
        if (db.locations.some((l) => l.site_id === s.id) || db.floor_plans.some((f) => f.site_id === s.id)) throw E('in_use');
        db.sites = db.sites.filter((r) => r.id !== s.id);
        x.audit('delete', 'sites', s.id, s);
      });
    },

    // ---- Gebäudepläne (Grundriss je Stockwerk; Bild = Foto mit kind 'plan', Räume = Bereiche) ----
    async listFloorPlans() {
      return x.read(() => {
        if (!x.canRead()) return [];
        return D().floor_plans
          .slice()
          .sort((a, b) => ((a.sort || 0) - (b.sort || 0)) || cmp(a.name, b.name) || cmp(a.id, b.id))
          .map(vFloorPlan);
      });
    },
    async saveFloorPlan(obj) {
      return x.mutate(() => {
        const id = coreSaveFloorPlan(obj);
        return vFloorPlan(D().floor_plans.find((f) => f.id === id));
      });
    },
    async deleteFloorPlan(id) {
      return x.mutate(() => {
        const db = D();
        const f = isUuid(id) ? db.floor_plans.find((r) => r.id === id) : null;
        if (!f || !x.canRead()) throw E('not_found');
        if (!x.isAdmin()) throw E('not_authorized');
        db.floor_plans = db.floor_plans.filter((r) => r.id !== f.id);
        x.audit('delete', 'floor_plans', f.id, f);
        // Planbild samt Bereichen entfernen (wie api-supabase.js: «best effort» – Prüfungen laufen vor jeder Änderung)
        try { coreDeletePhoto(f.photo_id); } catch { /* Planbild bleibt */ }
      });
    },
    async deleteHotspot(id) {
      return x.mutate(() => {
        const db = D();
        const h = isUuid(id) ? db.photo_hotspots.find((r) => r.id === id) : null;
        if (!h || !x.canRead()) throw E('not_found');
        if (!x.isStaff()) throw E('not_authorized');
        db.photo_hotspots = db.photo_hotspots.filter((r) => r.id !== id);
        x.audit('delete', 'photo_hotspots', h.id, h);
      });
    },

    // ---- Sets ----
    async listComponents(setId) {
      return x.read(() => {
        if (!isUuid(setId) || !x.canRead()) return [];
        return D().set_components
          .filter((r) => r.set_id === setId)
          .sort((a, b) => ((a.sort || 0) - (b.sort || 0)) || (ms(a.created_at) - ms(b.created_at)))
          .map(vComponent);
      });
    },
    async saveComponent(obj) { return x.mutate(() => pick(coreSaveComponent(obj), COMPONENT_COLS)); },
    async deleteComponent(id) {
      return x.mutate(() => {
        const db = D();
        const r = isUuid(id) ? db.set_components.find((c) => c.id === id) : null;
        if (!r || !x.canRead()) throw E('not_found');
        if (!x.isStaff()) throw E('not_authorized');
        db.set_components = db.set_components.filter((c) => c.id !== id);
        x.audit('delete', 'set_components', r.id, r);
      });
    },
  });
}
