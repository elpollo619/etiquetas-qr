// Supabase-Implementierung der API (Vertrag: docs/ARCHITECTURE.md, «API-Vertrag»; Datenbank: supabase/schema.sql).
// Wird nur von api.js geladen, wenn SUPABASE_URL und SUPABASE_ANON_KEY gesetzt sind.
// supabase-js 2.110.9, lokal gebündelt (kein fremdes CDN zur Laufzeit; erzeugt mit esbuild)
import { createClient } from './vendor/supabase.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY, PUBLIC_BASE_URL } from './config.js';

export const SUPABASE_JS_VERSION = '2.110.9';

const BUCKET = 'media';
const SIGNED_URL_TTL = 3600;                 // Sekunden
const SIGNED_URL_MARGIN_MS = 5 * 60 * 1000;  // so lange vor Ablauf neu signieren
const SIGN_CHUNK = 100;
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;   // Bucket-Limit (schema.sql)
// Erlaubte Dateitypen – identisch mit allowed_mime_types des Buckets in schema.sql
const ALLOWED_MIME = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif',
  'application/pdf', 'text/plain', 'text/csv',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];
const IMAGE_MAX_PX = 1600;
const IMAGE_QUALITY = 0.85;
const PAGE_SIZE = 1000;                      // Supabase-Standard «Max rows»
const DEFAULT_LIMIT = 200;

const ENTITIES = ['article', 'machine', 'location'];
const AUDIT_TABLE = {
  machine: 'machines', article: 'articles', location: 'locations', loan: 'loans',
  profile: 'profiles', inventory: 'inventories', attachment: 'attachments',
};
const AUTH_EVENTS = new Set(['SIGNED_IN', 'SIGNED_OUT', 'PASSWORD_RECOVERY', 'USER_UPDATED']);

// Spalten, die geschrieben werden dürfen (siehe GRANTs in schema.sql). Bestand und Status nie per Update.
const LOCATION_INSERT = ['code', 'name', 'type', 'parent_id', 'notes', 'archived', 'short_code', 'responsible_id', 'cover_photo_id', 'site_id'];
const LOCATION_UPDATE = ['name', 'type', 'parent_id', 'notes', 'archived', 'short_code', 'responsible_id', 'cover_photo_id', 'site_id'];
const ARTICLE_INSERT = ['code', 'name', 'description', 'art_no', 'category', 'brand', 'model', 'size', 'color', 'usage',
  'label_text', 'unit', 'stock', 'min_stock', 'reorder_qty', 'location_id', 'notes', 'archived', 'category_id', 'product_url'];
const ARTICLE_UPDATE = ['name', 'description', 'art_no', 'category', 'brand', 'model', 'size', 'color', 'usage',
  'label_text', 'unit', 'min_stock', 'reorder_qty', 'location_id', 'notes', 'archived', 'category_id', 'product_url'];
const MACHINE_INSERT = ['code', 'name', 'category', 'brand', 'model', 'serial_no', 'inventory_no', 'home_location_id',
  'status', 'condition', 'condition_note', 'notes', 'archived', 'category_id', 'responsible_id', 'is_set', 'product_url'];
const MACHINE_UPDATE = ['name', 'category', 'brand', 'model', 'serial_no', 'inventory_no', 'home_location_id',
  'condition', 'condition_note', 'notes', 'archived', 'category_id', 'responsible_id', 'is_set', 'product_url'];

const REF_COLS = new Set(['parent_id', 'location_id', 'home_location_id', 'category_id', 'responsible_id', 'cover_photo_id']);
const NUM_COLS = new Set(['stock', 'min_stock', 'reorder_qty']);
const BOOL_COLS = new Set(['archived', 'is_set']);
const URL_RE = /^https?:\/\/[^\s]+$/i;
const IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'];
const PHOTO_STATUS = ['neu', 'in_analyse'];
const ANALYSIS_CHUNK_MAX = 250;
const ENUM_COLS = new Set(['type', 'unit', 'status', 'condition']);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const LOCAL_DT_RE = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?$/;
const NETWORK_RE = /failed to fetch|networkerror|network request failed|load failed|fetch failed|err_internet|err_network|err_connection|socket hang up|econnrefused|enotfound/i;

const COLLATOR = (() => { try { return new Intl.Collator('de-CH', { numeric: true, sensitivity: 'base' }); } catch { return null; } })();

// ---------------------------------------------------------------------------------------------
//  Kleine Hilfsfunktionen
// ---------------------------------------------------------------------------------------------
const has = (o, k) => o != null && Object.prototype.hasOwnProperty.call(o, k) && o[k] !== undefined;
const isUuid = (s) => typeof s === 'string' && UUID_RE.test(s);
const normCode = (c) => String(c ?? '').trim().toUpperCase();
function trimOrNull(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}
// Zahl aus Eingabe ('1,5', "1'000", 3) → number | null (leer) | NaN (ungültig)
function num(v) {
  if (v === undefined || v === null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
  const s = String(v).trim().replace(/[\s'’]/g, '').replace(',', '.');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}
function cmp(a, b) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return COLLATOR ? COLLATOR.compare(String(a), String(b)) : String(a).localeCompare(String(b));
}
const sortRows = (rows, key, tie = 'code') => rows.sort((x, y) => cmp(x[key], y[key]) || cmp(x[tie], y[tie]));
function uuid() {
  try { if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') return globalThis.crypto.randomUUID(); } catch { /* weiter */ }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
const defer = (fn) => setTimeout(fn, 0);

const MIME_EXT = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/heic': 'heic',
  'image/heif': 'heif', 'image/svg+xml': 'svg', 'application/pdf': 'pdf', 'text/plain': 'txt', 'text/csv': 'csv',
  'application/zip': 'zip',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
};
function extFor(name, mime) {
  const m = /\.([A-Za-z0-9]{1,8})$/.exec(String(name || ''));
  if (m) return m[1].toLowerCase();
  return MIME_EXT[String(mime || '').toLowerCase()] || 'bin';
}
function renameExt(name, ext) {
  const base = String(name || 'foto').replace(/\.[A-Za-z0-9]{1,8}$/, '');
  return `${base || 'foto'}.${ext}`;
}

// Bilder im Browser verkleinern (max. Kantenlänge, JPEG). null = nicht möglich → Original hochladen.
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
    ctx.fillStyle = '#ffffff';            // transparente PNGs nicht schwarz werden lassen
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

// Kategorien in Baumreihenfolge (Eltern vor Kindern, je Ebene nach sort, Name)
function treeOrder(rows) {
  const kids = new Map();
  for (const r of rows) {
    const k = r.parent_id || null;
    if (!kids.has(k)) kids.set(k, []);
    kids.get(k).push(r);
  }
  for (const list of kids.values()) list.sort((a, b) => ((a.sort || 0) - (b.sort || 0)) || cmp(a.name, b.name));
  const ids = new Set(rows.map((r) => r.id));
  const out = [];
  const seen = new Set();
  const walk = (parent) => {
    for (const r of kids.get(parent) || []) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      out.push(r);
      walk(r.id);
    }
  };
  walk(null);
  // Kinder archivierter (ausgeblendeter) Eltern trotzdem zeigen
  for (const r of rows) if (!seen.has(r.id) && (!r.parent_id || !ids.has(r.parent_id))) { seen.add(r.id); out.push(r); walk(r.id); }
  return out;
}
function guessImageMime(name) {
  const e = /\.([a-z0-9]+)$/i.exec(String(name || ''));
  return { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif',
    heic: 'image/heic', heif: 'image/heif' }[e ? e[1].toLowerCase() : ''] || '';
}
// SHA-256 der Originaldatei (identifiziert ein Foto: Doppelimport, Zuordnung des KI-Ergebnisses)
async function sha256Of(blob) {
  const hash = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function imageSize(blob) {
  if (typeof createImageBitmap !== 'function') return null;
  try {
    const bmp = await createImageBitmap(blob);
    const out = { w: bmp.width, h: bmp.height };
    try { bmp.close && bmp.close(); } catch { /* egal */ }
    return out;
  } catch { return null; }
}

// ---------------------------------------------------------------------------------------------
//  Fabrik
// ---------------------------------------------------------------------------------------------
/**
 * @param {{ LgrError: typeof Error, client?: object }} opts  `client` nur für Tests (Ersatz für createClient).
 */
export function createApi({ LgrError, client } = {}) {
  if (!LgrError) throw new Error('createApi: LgrError fehlt');
  const E = (code, detail) => new LgrError(code, detail);

  const urlCache = new Map();   // signierte URLs: path → { url, exp }
  const inflight = new Map();   // path → Promise<string|null> (laufende Signierung)

  const sb = client || createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,   // Bestätigungs-/Passwort-Links (#access_token=…) auswerten
      flowType: 'implicit',
    },
  });

  // -------------------------------------------------------------------------------------------
  //  Fehler → LgrError
  // -------------------------------------------------------------------------------------------
  function isNetworkError(e, depth = 0) {
    if (!e || depth > 3) return false;
    const name = String(e.name || '');
    const msg = String(e.message || '');
    if (name === 'AuthRetryableFetchError' || name === 'AbortError' || name === 'TimeoutError') return true;
    if (NETWORK_RE.test(msg) || NETWORK_RE.test(String(e.details || ''))) return true;
    if (name === 'TypeError' && /fetch|network/i.test(msg)) return true;
    if (e.originalError && isNetworkError(e.originalError, depth + 1)) return true;
    if (e.cause && isNetworkError(e.cause, depth + 1)) return true;
    return false;
  }

  function mapAuthError(e, msg, code, name) {
    const status = Number(e.status);
    if (isNetworkError(e) || status === 0) return E('network', msg);
    if (name === 'AuthSessionMissingError') return E('not_authorized');
    if (code === 'invalid_credentials' || name === 'AuthInvalidCredentialsError'
        || /invalid login credentials|invalid (email|password)|missing email or phone/i.test(msg)) return E('auth_invalid');
    if (code === 'email_not_confirmed' || /email not confirmed/i.test(msg)) return E('email_not_confirmed');
    if (['user_already_exists', 'email_exists', 'phone_exists', 'identity_already_exists'].includes(code)
        || /already (been )?registered|already exists/i.test(msg)) return E('auth_exists');
    if (code === 'weak_password' || name === 'AuthWeakPasswordError'
        || /password should|weak password|password is too weak|at least \d+ char/i.test(msg)) return E('weak_password');
    if (code === 'same_password' || /different from the old password/i.test(msg)) return E('same_password');
    if (status === 429 || /rate.?limit/i.test(code) || /rate limit|too many requests/i.test(msg)) return E('rate_limited');
    if (code === 'email_address_invalid' || /invalid format|email address .*invalid|unable to validate email/i.test(msg)) return E('invalid_email');
    if (code === 'signup_disabled' || /signups not allowed/i.test(msg)) return E('signup_disabled');
    if (status === 401 || status === 403) return E('not_authorized');
    return E('unknown', msg);
  }

  function constraintName(msg) {
    const m = /constraint "([^"]+)"/.exec(msg);
    return m ? m[1] : '';
  }

  function mapError(e) {
    if (e instanceof LgrError) return e;
    if (e === undefined || e === null) return E('unknown');
    const msg = String(e.message ?? e.msg ?? e.error_description ?? e.error ?? e);
    const details = String(e.details ?? '');
    // Fachliche Fehler aus den Funktionen/Triggern: 'LGR:code' oder 'LGR:code:detail'
    const lgr = /LGR:([a-z_]+)(?::([^\r\n]*))?/.exec(msg) || /LGR:([a-z_]+)(?::([^\r\n]*))?/.exec(details);
    if (lgr) return E(lgr[1], lgr[2] ? lgr[2].trim() : null);

    const code = e.code !== undefined && e.code !== null ? String(e.code) : '';
    const name = String(e.name || '');
    if (e.__isAuthError || /^Auth/.test(name)) return mapAuthError(e, msg, code, name);

    switch (code) {
      case '42501': return E('not_authorized');
      case '23505': {
        const cn = constraintName(msg);
        if (/_code_key$/.test(cn) || /\(code\)/.test(details)) return E('duplicate_code');
        if (/one_open_per_machine/.test(cn)) return E('not_available', 'ausgeliehen');
        if (/shopping_items_open_article/.test(cn)) return E('already_on_list');
        if (/machine_supplies_pair/.test(cn)) return E('duplicate', 'supply');
        if (/short_code/.test(cn)) return E('duplicate_short_code');
        if (/categories_name/.test(cn)) return E('duplicate', 'category');
        return E('duplicate', cn || null);
      }
      case '23001': return E('in_use');   // ON DELETE RESTRICT (ab Postgres 18 eigener Code)
      case '23503': {
        if (/update or delete on table/i.test(msg)) return E('in_use');
        const cn = constraintName(msg);
        if (/responsible|cover_photo|category|site/.test(cn)) return E('not_found');
        if (/location|parent/.test(cn)) return E('invalid_location');
        if (/borrower/.test(cn)) return E('invalid_borrower');
        return E('not_found');
      }
      case '23514': {
        const cn = constraintName(msg);
        if (/short_code/.test(cn)) return E('invalid_short_code');
        if (/product_url/.test(cn)) return E('invalid_url');
        if (/set_components_(target|self)/.test(cn)) return E('invalid_input');
        if (/name|title/.test(cn)) return E('name_required');
        if (/stock|qty|counted/.test(cn)) return E('invalid_qty');
        if (/dates/.test(cn)) return E('invalid_dates');
        if (/condition/.test(cn)) return E('invalid_condition');
        if (/status|result/.test(cn)) return E('invalid_status');
        if (/type/.test(cn)) return E('invalid_type');
        if (/role/.test(cn)) return E('invalid_role');
        if (/lang/.test(cn)) return E('invalid_lang');
        if (/kind/.test(cn)) return E('invalid_kind');
        if (/entity/.test(cn)) return E('invalid_entity');
        return E('invalid_value', cn || null);
      }
      case '23502':
        if (/column "name"/.test(msg)) return E('name_required');
        if (/column "(stock|qty|counted)"/.test(msg)) return E('invalid_qty');
        return E('invalid_value', msg);
      case '22P02':
        if (/uuid/i.test(msg)) return E('not_found');
        if (/numeric|integer/i.test(msg)) return E('invalid_qty');
        return E('invalid_value', msg);
      case '22003': return E('invalid_qty');
      case '22007': case '22008': return E('invalid_dates');
      case 'PGRST116': return E('not_found');
      case 'PGRST301': case 'PGRST302': case 'PGRST303': return E('not_authorized');
      case '57014': return E('network', msg);
      default: break;
    }
    if (isNetworkError(e)) return E('network', msg);
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return E('network', msg);
    const status = Number(e.status ?? e.statusCode);
    if (status === 401 || status === 403 || /permission denied|row-level security|unauthorized/i.test(msg)) return E('not_authorized');
    if (status === 413 || /payload too large|maximum allowed size|exceeded the maximum/i.test(msg)) return E('file_too_large');
    if (status === 409 || /already exists/i.test(msg)) return E('duplicate');
    return E('unknown', msg);
  }

  // Abfrage ausführen: { data, error } → data oder LgrError
  async function q(builder) {
    let res;
    try { res = await builder; } catch (err) { throw mapError(err); }
    if (res && res.error) throw mapError(res.error);
    return res ? res.data : null;
  }
  // Öffentliche Methode: alles, was nicht LgrError ist, umwandeln
  const wrap = (fn) => async (...args) => {
    try { return await fn(...args); } catch (err) { throw mapError(err); }
  };

  async function fetchAll(make) {
    const out = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      const rows = (await q(make().range(from, from + PAGE_SIZE - 1))) || [];
      out.push(...rows);
      if (rows.length < PAGE_SIZE) break;
    }
    return out;
  }

  // 0 Zeilen bei update/delete: Zeile unsichtbar/fehlend → not_found, sonst RLS → not_authorized
  async function zeroRowsError(table, id) {
    if (!isUuid(id)) return E('not_found');
    try {
      const row = await q(sb.from(table).select('id').eq('id', id).maybeSingle());
      return row ? E('not_authorized') : E('not_found');
    } catch (err) {
      const m = mapError(err);
      return m.code === 'network' ? m : E('not_authorized');
    }
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
      } else if (LOCAL_DT_RE.test(s)) {
        d = new Date(s.replace(' ', 'T'));   // ohne Zeitzone = Ortszeit des Geräts
      } else d = new Date(s);
    }
    if (Number.isNaN(d.getTime())) throw E('invalid_dates');
    return d.toISOString();
  }

  // Formularobjekt → erlaubte Spalten (nur vorhandene Schlüssel)
  function cleanPayload(obj, keys) {
    const out = {};
    for (const k of keys) {
      if (!has(obj, k)) continue;
      let v = obj[k];
      if (k === 'code') { v = normCode(v); if (!v) continue; }
      else if (k === 'short_code') { v = String(v ?? '').toUpperCase().replace(/\s+/g, ''); if (!v) v = null; else if (!/^[A-Z0-9]{1,10}$/.test(v)) throw E('invalid_short_code', v); }
      else if (k === 'product_url') { v = trimOrNull(v); if (v !== null && !URL_RE.test(v)) throw E('invalid_url'); }
      else if (k === 'name') v = v === null ? '' : String(v).trim();
      else if (BOOL_COLS.has(k)) v = Boolean(v);
      else if (NUM_COLS.has(k)) {
        v = num(v);
        if (Number.isNaN(v) || (v !== null && v < 0)) throw E('invalid_qty');
        if (v === null && k === 'stock') continue;    // Standard 0
      } else if (REF_COLS.has(k)) v = v ? String(v) : null;
      else if (ENUM_COLS.has(k)) { v = v === null ? '' : String(v).trim(); if (!v) continue; }
      else v = trimOrNull(v);
      out[k] = v;
    }
    return out;
  }
  function validateSave(payload, isNew, prefix) {
    if ((isNew || has(payload, 'name')) && !payload.name) throw E('name_required');
    if (isNew && payload.code) {
      const c = payload.code;
      const ok = !/\s/.test(c) && (prefix === 'INV-' ? !c.startsWith('M-') && !c.startsWith('L-') : c.startsWith(prefix));
      if (!ok) throw E('invalid_code', c);
    }
  }
  async function assertCodeUnchanged(table, id, code) {
    const c = normCode(code);
    if (!c || !isUuid(id)) return;
    const row = await q(sb.from(table).select('code').eq('id', id).maybeSingle());
    if (row && row.code !== c) throw E('code_immutable');
  }

  async function getOne(view, col, val) {
    if (col === 'id' && !isUuid(val)) return null;
    if (col === 'code') { val = normCode(val); if (!val) return null; }
    return (await q(sb.from(view).select('*').eq(col, val).maybeSingle())) || null;
  }

  async function saveRow({ table, view, keysInsert, keysUpdate, prefix }, obj) {
    if (!obj || typeof obj !== 'object') throw E('invalid_value');
    if (!obj.id) {
      const payload = cleanPayload(obj, keysInsert);
      validateSave(payload, true, prefix);
      const row = await q(sb.from(table).insert(payload).select('id').single());
      return getOne(view, 'id', row.id);
    }
    if (!isUuid(obj.id)) throw E('not_found');
    if (has(obj, 'code')) await assertCodeUnchanged(table, obj.id, obj.code);
    const payload = cleanPayload(obj, keysUpdate);
    validateSave(payload, false, prefix);
    if (Object.keys(payload).length) {
      const rows = await q(sb.from(table).update(payload).eq('id', obj.id).select('id'));
      if (!rows || !rows.length) throw await zeroRowsError(table, obj.id);
    }
    const out = await getOne(view, 'id', obj.id);
    if (!out) throw E('not_found');
    return out;
  }

  async function purgeAttachments(entity, entityId) {
    try {
      const rows = await q(sb.from('attachments').delete().eq('entity', entity).eq('entity_id', entityId).select('path'));
      const paths = (rows || []).map((r) => r.path).filter(Boolean);
      if (paths.length) await sb.storage.from(BUCKET).remove(paths);
      for (const p of paths) urlCache.delete(p);
    } catch (err) {
      console.warn('[api] Anhänge konnten nicht entfernt werden:', err);
    }
  }

  async function deleteRow(table, entity, id) {
    if (!isUuid(id)) throw E('not_found');
    const rows = await q(sb.from(table).delete().eq('id', id).select('id'));
    if (!rows || !rows.length) throw await zeroRowsError(table, id);
    await purgeAttachments(entity, id);   // Fotos/Dokumente der gelöschten Sache (best effort)
  }

  async function rpc(fn, args) {
    return q(sb.rpc(fn, args));
  }

  // -------------------------------------------------------------------------------------------
  //  Anmeldung
  // -------------------------------------------------------------------------------------------
  const subscribers = new Set();
  let knownUserId;            // undefined = noch unbekannt
  let pendingRecovery = false;
  const mapSession = (s) => (s && s.user ? { userId: s.user.id, email: s.user.email ?? null } : null);

  // Dieser Beobachter wird vor dem Auswerten der Adresse (#access_token…, type=recovery) registriert und
  // merkt sich PASSWORD_RECOVERY, falls die App ihren Rückruf erst später anmeldet.
  sb.auth.onAuthStateChange((event, session) => {
    const s = mapSession(session);
    if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') {
      if (event === 'INITIAL_SESSION' || s) knownUserId = s ? s.userId : null;
      return;
    }
    if (!AUTH_EVENTS.has(event)) return;
    // supabase-js meldet SIGNED_IN auch beim Zurückkehren in den Tab – nur echte Wechsel weitergeben
    if (event === 'SIGNED_IN' && s && knownUserId === s.userId) return;
    if (event === 'SIGNED_OUT') urlCache.clear();
    knownUserId = s ? s.userId : null;
    if (event === 'PASSWORD_RECOVERY') pendingRecovery = subscribers.size === 0;
    // Rückruf entkoppeln: supabase-Aufrufe innerhalb des Rückrufs würden sonst blockieren
    for (const cb of [...subscribers]) {
      defer(() => {
        if (!subscribers.has(cb)) return;   // inzwischen abgemeldet
        try { cb(event, s); } catch (err) { console.error(err); }
      });
    }
  });

  async function currentSession() {
    const { data, error } = await sb.auth.getSession();
    if (error && isNetworkError(error)) throw E('network', error.message);
    return mapSession(data && data.session);
  }
  async function requireUserId() {
    const s = await currentSession();
    if (!s) throw E('not_authorized');
    return s.userId;
  }

  // -------------------------------------------------------------------------------------------
  //  Signierte URLs (privater Bucket), im Speicher zwischengespeichert
  // -------------------------------------------------------------------------------------------
  async function signBatch(paths) {
    const out = new Map();
    for (let i = 0; i < paths.length; i += SIGN_CHUNK) {
      const chunk = paths.slice(i, i + SIGN_CHUNK);
      const data = await q(sb.storage.from(BUCKET).createSignedUrls(chunk, SIGNED_URL_TTL));
      const exp = Date.now() + SIGNED_URL_TTL * 1000;
      for (const d of data || []) {
        const url = d && !d.error ? (d.signedUrl || d.signedURL) : null;
        if (d && d.path && url) { urlCache.set(d.path, { url, exp }); out.set(d.path, url); }
      }
    }
    return out;
  }

  // -------------------------------------------------------------------------------------------
  //  Die API
  // -------------------------------------------------------------------------------------------
  const api = {
    mode: 'supabase',

    async init() {
      try { await sb.auth.getSession(); } catch (err) { console.warn('[api] init:', err); }
    },
    getSession: wrap(async () => currentSession()),
    onAuthChange(cb) {
      if (typeof cb !== 'function') return () => {};
      subscribers.add(cb);
      if (pendingRecovery) {
        pendingRecovery = false;
        currentSession().then((s) => { if (s && subscribers.has(cb)) cb('PASSWORD_RECOVERY', s); }, () => {});
      }
      return () => { subscribers.delete(cb); };
    },
    signIn: wrap(async (email, password) => {
      const { data, error } = await sb.auth.signInWithPassword({ email: String(email ?? '').trim(), password: String(password ?? '') });
      if (error) throw mapError(error);
      return mapSession(data && data.session);
    }),
    signUp: wrap(async ({ fullName, email, password, lang } = {}) => {
      const { data, error } = await sb.auth.signUp({
        email: String(email ?? '').trim(),
        password: String(password ?? ''),
        options: {
          data: { full_name: trimOrNull(fullName) || '', lang: ['de', 'pt', 'es'].includes(lang) ? lang : 'de' },
          emailRedirectTo: PUBLIC_BASE_URL,
        },
      });
      if (error) throw mapError(error);
      // Bei aktiver E-Mail-Bestätigung meldet Supabase ein bestehendes Konto nicht als Fehler,
      // sondern liefert einen Benutzer ohne Identitäten.
      const user = data && data.user;
      if (user && Array.isArray(user.identities) && user.identities.length === 0) throw E('auth_exists');
      return { needsConfirmation: !(data && data.session) };
    }),
    signOut: wrap(async () => {
      const { error } = await sb.auth.signOut();
      if (error) await sb.auth.signOut({ scope: 'local' });   // offline: wenigstens lokal abmelden
      urlCache.clear();
    }),
    resetPassword: wrap(async (email) => {
      const { error } = await sb.auth.resetPasswordForEmail(String(email ?? '').trim(), { redirectTo: PUBLIC_BASE_URL });
      if (error) throw mapError(error);
    }),
    updatePassword: wrap(async (newPassword) => {
      const { error } = await sb.auth.updateUser({ password: String(newPassword ?? '') });
      if (error) throw mapError(error);
    }),

    getMyProfile: wrap(async () => {
      const s = await currentSession();
      if (!s) return null;
      return (await q(sb.from('profiles').select('*').eq('id', s.userId).maybeSingle())) || null;
    }),
    updateMyProfile: wrap(async ({ full_name, lang } = {}) => {
      const uid = await requireUserId();
      let cur = null;
      if (full_name === undefined || lang === undefined) {
        cur = await q(sb.from('profiles').select('*').eq('id', uid).maybeSingle());
        if (!cur) throw E('not_found');
      }
      return rpc('update_my_profile', {
        p_full_name: full_name === undefined ? cur.full_name : full_name,
        p_lang: lang === undefined ? cur.lang : lang,
      });
    }),
    demoUsers: async () => [],
    demoSwitchUser: async () => { throw E('not_authorized', 'demo'); },
    demoReset: async () => { throw E('not_authorized', 'demo'); },

    listProfiles: wrap(async () => sortRows(await fetchAll(() => sb.from('profiles').select('*').order('full_name').order('id')), 'full_name', 'email')),
    adminUpdateProfile: wrap(async (id, { full_name, role, active } = {}) => {
      if (!isUuid(id)) throw E('not_found');
      let cur = null;
      if (full_name === undefined || role === undefined || active === undefined) {
        cur = await q(sb.from('profiles').select('*').eq('id', id).maybeSingle());
        if (!cur) throw E('not_found');
      }
      return rpc('admin_update_profile', {
        p_id: id,
        p_full_name: full_name === undefined ? cur.full_name : full_name,
        p_role: role === undefined ? cur.role : role,
        p_active: active === undefined ? cur.active : Boolean(active),
      });
    }),

    // ---- Einladungen (nur Administratoren, RLS) ----
    listInvites: wrap(async () => (await q(sb.from('invites').select('*').order('email'))) || []),
    addInvite: wrap(async (email, role = 'mitarbeiter') => {
      const e = String(email || '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw E('invalid_email');
      if (!['admin', 'lagerverantwortlicher', 'mitarbeiter'].includes(role)) throw E('invalid_role');
      return q(sb.from('invites').insert({ email: e, role }).select('*').single());
    }),
    deleteInvite: wrap(async (email) => {
      const e = String(email || '').trim().toLowerCase();
      const rows = await q(sb.from('invites').delete().eq('email', e).select('email'));
      if (!rows || !rows.length) throw E('not_found');
    }),

    // ---- Lagerorte ----
    listLocations: wrap(async ({ includeArchived = false } = {}) => {
      const rows = await fetchAll(() => {
        let qb = sb.from('location_overview').select('*');
        if (!includeArchived) qb = qb.eq('archived', false);
        return qb.order('path').order('id');
      });
      return sortRows(rows, 'path');
    }),
    getLocation: wrap(async (id) => getOne('location_overview', 'id', id)),
    getLocationByCode: wrap(async (code) => getOne('location_overview', 'code', code)),
    saveLocation: wrap(async (obj) => saveRow({ table: 'locations', view: 'location_overview', keysInsert: LOCATION_INSERT, keysUpdate: LOCATION_UPDATE, prefix: 'L-' }, obj)),
    deleteLocation: wrap(async (id) => deleteRow('locations', 'location', id)),

    // ---- Maschinen ----
    listMachines: wrap(async ({ includeArchived = false } = {}) => {
      const rows = await fetchAll(() => {
        let qb = sb.from('machine_overview').select('*');
        if (!includeArchived) qb = qb.eq('archived', false);
        return qb.order('name').order('id');
      });
      return sortRows(rows, 'name');
    }),
    getMachine: wrap(async (id) => getOne('machine_overview', 'id', id)),
    getMachineByCode: wrap(async (code) => getOne('machine_overview', 'code', code)),
    saveMachine: wrap(async (obj) => saveRow({ table: 'machines', view: 'machine_overview', keysInsert: MACHINE_INSERT, keysUpdate: MACHINE_UPDATE, prefix: 'M-' }, obj)),
    deleteMachine: wrap(async (id) => deleteRow('machines', 'machine', id)),
    checkoutMachine: wrap(async (id, { requestId, dueAt, note, borrowerId } = {}) => {
      if (!isUuid(id)) throw E('not_found');
      return rpc('machine_checkout', {
        p_machine: id,
        p_request: requestId || null,
        p_due: toIso(dueAt, { endOfDay: true }),
        p_note: trimOrNull(note),
        p_borrower: borrowerId || null,
      });
    }),
    returnMachine: wrap(async (id, { requestId, condition, note } = {}) => {
      if (!isUuid(id)) throw E('not_found');
      return rpc('machine_return', {
        p_machine: id,
        p_request: requestId || null,
        p_condition: condition || 'ok',
        p_note: trimOrNull(note),
      });
    }),
    setMachineStatus: wrap(async (id, status, note) => {
      if (!isUuid(id)) throw E('not_found');
      return rpc('machine_set_status', { p_machine: id, p_status: status ?? null, p_note: trimOrNull(note) });
    }),
    listLoans: wrap(async ({ machineId, borrowerId, open, from, to, limit } = {}) => {
      let qb = sb.from('loan_overview').select('*');
      if (machineId) qb = qb.eq('machine_id', machineId);
      if (borrowerId) qb = qb.eq('borrower_id', borrowerId);
      if (open === true) qb = qb.is('returned_at', null);
      else if (open === false) qb = qb.not('returned_at', 'is', null);
      const f = toIso(from);
      const t = toIso(to, { endOfDay: true });
      if (f) qb = qb.gte('checked_out_at', f);
      if (t) qb = qb.lte('checked_out_at', t);
      const n = Number(limit) > 0 ? Math.floor(Number(limit)) : DEFAULT_LIMIT;
      return (await q(qb.order('checked_out_at', { ascending: false }).order('id').limit(n))) || [];
    }),
    correctLoan: wrap(async (loanId, { checked_out_at, due_at, returned_at, reason } = {}) => {
      if (!isUuid(loanId)) throw E('not_found');
      // Nicht übergebene Felder (undefined) behalten ihren Wert; null = bewusst leeren.
      let cur = null;
      if (checked_out_at === undefined || due_at === undefined || returned_at === undefined) {
        cur = await q(sb.from('loans').select('checked_out_at, due_at, returned_at').eq('id', loanId).maybeSingle());
        if (!cur) throw E('not_found');
      }
      return rpc('admin_correct_loan', {
        p_loan: loanId,
        p_checked_out_at: checked_out_at === undefined ? cur.checked_out_at : toIso(checked_out_at),
        p_due_at: due_at === undefined ? cur.due_at : toIso(due_at, { endOfDay: true }),
        p_returned_at: returned_at === undefined ? cur.returned_at : toIso(returned_at),
        p_reason: reason ?? null,
      });
    }),

    // ---- Artikel ----
    listArticles: wrap(async ({ includeArchived = false } = {}) => {
      const rows = await fetchAll(() => {
        let qb = sb.from('article_overview').select('*');
        if (!includeArchived) qb = qb.eq('archived', false);
        return qb.order('name').order('id');
      });
      return sortRows(rows, 'name');
    }),
    getArticle: wrap(async (id) => getOne('article_overview', 'id', id)),
    getArticleByCode: wrap(async (code) => getOne('article_overview', 'code', code)),
    saveArticle: wrap(async (obj) => saveRow({ table: 'articles', view: 'article_overview', keysInsert: ARTICLE_INSERT, keysUpdate: ARTICLE_UPDATE, prefix: 'INV-' }, obj)),
    deleteArticle: wrap(async (id) => deleteRow('articles', 'article', id)),
    moveStock: wrap(async (articleId, { type, qty, requestId, note, toLocationId } = {}) => {
      if (!isUuid(articleId)) throw E('not_found');
      const n = num(qty);
      return rpc('stock_move', {
        p_article: articleId,
        p_type: type ?? null,
        p_qty: Number.isNaN(n) ? null : n,
        p_request: requestId || null,
        p_note: trimOrNull(note),
        p_to_location: toLocationId || null,
      });
    }),
    listMovements: wrap(async ({ articleId, userId, limit } = {}) => {
      let qb = sb.from('movement_overview').select('*');
      if (articleId) qb = qb.eq('article_id', articleId);
      if (userId) qb = qb.eq('user_id', userId);
      const n = Number(limit) > 0 ? Math.floor(Number(limit)) : DEFAULT_LIMIT;
      return (await q(qb.order('created_at', { ascending: false }).order('id', { ascending: false }).limit(n))) || [];
    }),

    // ---- Fotos und Dokumente ----
    listAttachments: wrap(async (entity, entityId) => {
      if (!isUuid(entityId)) return [];
      return (await q(sb.from('attachments').select('*').eq('entity', entity).eq('entity_id', entityId)
        .order('is_primary', { ascending: false }).order('created_at', { ascending: true }))) || [];
    }),
    uploadAttachment: wrap(async (entity, entityId, file, { kind, note, loanId } = {}) => {
      if (!ENTITIES.includes(entity)) throw E('invalid_entity');
      if (!isUuid(entityId)) throw E('not_found');
      if (!file || typeof file.size !== 'number') throw E('file_required');
      const origMime = String(file.type || '').toLowerCase();
      // Nur Fotos und Büro-Dokumente (kein HTML/SVG – könnte im Browser Code ausführen)
      if (!ALLOWED_MIME.includes(origMime)) throw E('file_type', origMime || '?');
      const isImage = origMime.startsWith('image/');
      const k = kind || (isImage ? 'photo' : 'document');
      let body = file;
      let mime = origMime || 'application/octet-stream';
      let fileName = String(file.name || (isImage ? 'foto' : 'datei'));
      if (isImage && !/svg/.test(origMime)) {
        const small = await resizeImage(file, IMAGE_MAX_PX, IMAGE_QUALITY);
        if (small) { body = small; mime = 'image/jpeg'; fileName = renameExt(fileName, 'jpg'); }
      }
      if (body.size > MAX_UPLOAD_BYTES) throw E('file_too_large');
      const path = `${entity}/${entityId}/${uuid()}.${mime === 'image/jpeg' ? 'jpg' : extFor(fileName, mime)}`;
      await q(sb.storage.from(BUCKET).upload(path, body, { contentType: mime, upsert: false, cacheControl: '3600' }));
      try {
        // Hauptfoto bestimmt der Server (erstes Foto eines Eintrags)
        return await q(sb.from('attachments').insert({
          entity, entity_id: entityId, kind: k, path, file_name: fileName, mime, size_bytes: body.size,
          note: trimOrNull(note), loan_id: loanId || null,
        }).select('*').single());
      } catch (err) {
        try { await sb.storage.from(BUCKET).remove([path]); } catch { /* egal */ }
        throw err;
      }
    }),
    deleteAttachment: wrap(async (attachment) => {
      const id = typeof attachment === 'string' ? attachment : attachment && attachment.id;
      if (!isUuid(id)) throw E('not_found');
      const rows = await q(sb.from('attachments').delete().eq('id', id).select('id, path'));
      if (!rows || !rows.length) throw await zeroRowsError('attachments', id);
      const path = rows[0].path;
      urlCache.delete(path);
      try { await sb.storage.from(BUCKET).remove([path]); } catch (err) { console.warn('[api] Datei bleibt im Speicher:', err); }
    }),
    setPrimaryAttachment: wrap(async (id) => {
      if (!isUuid(id)) throw E('not_found');
      return rpc('set_primary_attachment', { p_id: id });
    }),
    fileUrls: wrap(async (paths) => {
      const list = [...new Set((Array.isArray(paths) ? paths : [paths]).filter((p) => typeof p === 'string' && p))];
      const out = new Map();
      const nowMs = Date.now();
      const missing = [];
      for (const p of list) {
        const c = urlCache.get(p);
        if (c && c.exp - SIGNED_URL_MARGIN_MS > nowMs) out.set(p, c.url);
        else missing.push(p);
      }
      if (!missing.length) return out;
      const toFetch = missing.filter((p) => !inflight.has(p));
      if (toFetch.length) {
        const batch = signBatch(toFetch);
        for (const p of toFetch) {
          const pr = batch.then((m) => m.get(p) || null);
          inflight.set(p, pr);
          pr.catch(() => {}).finally(() => { if (inflight.get(p) === pr) inflight.delete(p); });
        }
      }
      const urls = await Promise.all(missing.map((p) => inflight.get(p) || Promise.resolve(urlCache.get(p)?.url || null)));
      missing.forEach((p, i) => { if (urls[i]) out.set(p, urls[i]); });
      return out;
    }),

    // ---- Inventur ----
    listInventories: wrap(async () => (await q(sb.from('inventories').select('*').order('started_at', { ascending: false }).order('id'))) || []),
    createInventory: wrap(async ({ name, note, location_id } = {}) => {
      const n = trimOrNull(name);
      if (!n) throw E('name_required');
      if (location_id && !isUuid(location_id)) throw E('invalid_location');
      return q(sb.from('inventories').insert({ name: n, note: trimOrNull(note), location_id: location_id || null }).select('*').single());
    }),
    getInventory: wrap(async (id) => {
      if (!isUuid(id)) return null;
      const [inventory, counts, checks] = await Promise.all([
        q(sb.from('inventories').select('*').eq('id', id).maybeSingle()),
        fetchAll(() => sb.from('inventory_counts').select('*').eq('inventory_id', id).order('counted_at', { ascending: false }).order('id')),
        fetchAll(() => sb.from('inventory_machine_checks').select('*').eq('inventory_id', id).order('checked_at', { ascending: false }).order('id')),
      ]);
      if (!inventory) return null;
      return { inventory, counts, checks };
    }),
    countArticle: wrap(async (inventoryId, articleId, counted) => {
      if (!isUuid(inventoryId)) throw E('inventory_closed');
      if (!isUuid(articleId)) throw E('not_found');
      const n = num(counted);
      return rpc('inventory_count', { p_inventory: inventoryId, p_article: articleId, p_counted: Number.isNaN(n) ? null : n });
    }),
    checkMachine: wrap(async (inventoryId, machineId, result, note) => {
      if (!isUuid(inventoryId)) throw E('inventory_closed');
      if (!isUuid(machineId)) throw E('not_found');
      return rpc('inventory_check_machine', { p_inventory: inventoryId, p_machine: machineId, p_result: result ?? null, p_note: trimOrNull(note) });
    }),
    closeInventory: wrap(async (inventoryId, apply) => {
      if (!isUuid(inventoryId)) throw E('not_found');
      return rpc('inventory_close', { p_inventory: inventoryId, p_apply: Boolean(apply) });
    }),

    // ---- Lager organisieren: Kategorien ----
    listCategories: wrap(async ({ includeArchived = false } = {}) => {
      const rows = await fetchAll(() => {
        let qb = sb.from('category_paths').select('*');
        if (!includeArchived) qb = qb.eq('archived', false);
        return qb.order('depth').order('sort').order('name').order('id');
      });
      return treeOrder(rows);
    }),
    saveCategory: wrap(async (obj) => {
      if (!obj || typeof obj !== 'object') throw E('invalid_value');
      const payload = {};
      if (has(obj, 'name')) { payload.name = String(obj.name ?? '').trim(); if (!payload.name) throw E('name_required'); }
      if (has(obj, 'parent_id')) payload.parent_id = obj.parent_id || null;
      if (has(obj, 'sort')) { const n = Number(obj.sort); if (!Number.isFinite(n)) throw E('invalid_value'); payload.sort = Math.round(n); }
      if (has(obj, 'archived')) payload.archived = Boolean(obj.archived);
      let id = obj.id;
      if (!id) {
        if (!payload.name) throw E('name_required');
        id = (await q(sb.from('categories').insert(payload).select('id').single())).id;
      } else {
        if (!isUuid(id)) throw E('not_found');
        if (Object.keys(payload).length) {
          const rows = await q(sb.from('categories').update(payload).eq('id', id).select('id'));
          if (!rows || !rows.length) throw await zeroRowsError('categories', id);
        }
      }
      return getOne('category_paths', 'id', id);
    }),
    deleteCategory: wrap(async (id) => {
      if (!isUuid(id)) throw E('not_found');
      const rows = await q(sb.from('categories').delete().eq('id', id).select('id'));
      if (!rows || !rows.length) throw await zeroRowsError('categories', id);
    }),

    // ---- Räume, Kennzahlen ----
    listSpaces: wrap(async () => sortRows((await q(sb.from('space_overview').select('*').eq('archived', false))) || [], 'name')),
    orgStats: wrap(async () => (await q(sb.from('org_stats').select('*').maybeSingle())) || {}),
    setLocationOrganized: wrap(async (locationId, done) => {
      if (!isUuid(locationId)) throw E('not_found');
      return rpc('set_location_organized', { p_location: locationId, p_done: Boolean(done) });
    }),

    // ---- Fotos ----
    listPhotos: wrap(async ({ locationId, spaceId, status, ids, kind = 'foto' } = {}) => {
      const rows = await fetchAll(() => {
        let qb = sb.from('photo_overview').select('*');
        if (kind) qb = qb.eq('kind', kind);   // Planbilder (kind 'plan') erscheinen nicht in Fotolisten
        if (locationId) qb = qb.eq('location_id', locationId);
        if (spaceId) qb = qb.eq('root_id', spaceId);
        if (status) qb = Array.isArray(status) ? qb.in('status', status) : qb.eq('status', status);
        if (Array.isArray(ids)) qb = qb.in('id', ids.filter(isUuid));
        return qb.order('created_at').order('file_name').order('id');
      });
      return rows;
    }),
    importPhoto: wrap(async (file, { locationId, folder, sha256, kind = 'foto' } = {}) => {
      if (kind !== 'foto' && kind !== 'plan') throw E('invalid_input');
      if (!file || typeof file.size !== 'number') throw E('file_required');
      const origMime = String(file.type || '').toLowerCase() || guessImageMime(file.name);
      if (!IMAGE_MIME.includes(origMime)) throw E('file_type', origMime || '?');
      if (locationId && !isUuid(locationId)) throw E('invalid_location');
      const sha = String(sha256 || await sha256Of(file)).toLowerCase();
      if (!/^[0-9a-f]{64}$/.test(sha)) throw E('invalid_file');
      const existing = await getOne('photo_overview', 'sha256', sha);
      if (existing) return { photo: existing, duplicate: true };
      let body = file;
      let mime = origMime;
      // Pläne (Strichzeichnungen) nicht als JPEG verkleinern – sonst wird die Beschriftung unscharf
      const small = kind === 'plan' ? null : await resizeImage(file, IMAGE_MAX_PX, IMAGE_QUALITY);
      if (small) { body = small; mime = 'image/jpeg'; }
      if (body.size > MAX_UPLOAD_BYTES) throw E('file_too_large');
      const dims = await imageSize(body);
      const path = `photos/${sha}.${mime === 'image/jpeg' ? 'jpg' : extFor(file.name, mime)}`;
      // Unter photos/ dürfen nur Lagerverantwortliche/Admins hochladen (Storage-Regel). Existiert die Datei schon
      // (abgebrochener früherer Versuch derselben Datei = gleicher SHA-256), wird sie weiterverwendet.
      try {
        await q(sb.storage.from(BUCKET).upload(path, body, { contentType: mime, upsert: false, cacheControl: '3600' }));
      } catch (err) {
        if (!(err instanceof LgrError && err.code === 'duplicate')) throw err;
      }
      let row;
      try {
        row = await q(sb.from('photos').insert({
          location_id: locationId || null, path, sha256: sha, file_name: String(file.name || 'foto').slice(0, 255),
          folder: trimOrNull(folder), mime, size_bytes: body.size, width: dims ? dims.w : null, height: dims ? dims.h : null, kind,
        }).select('id').single());
      } catch (err) {
        if (err instanceof LgrError && err.code === 'duplicate') {
          const again = await getOne('photo_overview', 'sha256', sha);
          if (again) return { photo: again, duplicate: true };
        }
        // keine verwaiste Datei zurücklassen
        try { await sb.storage.from(BUCKET).remove([path]); } catch { /* egal */ }
        throw err;
      }
      return { photo: await getOne('photo_overview', 'id', row.id), duplicate: false };
    }),
    setPhotoStatus: wrap(async (ids, status) => {
      const list = (Array.isArray(ids) ? ids : [ids]).filter(isUuid);
      if (!PHOTO_STATUS.includes(status)) throw E('invalid_status');
      if (!list.length) return 0;
      return rpc('set_photo_status', { p_ids: list, p_status: status });
    }),
    movePhoto: wrap(async (id, locationId) => {
      if (!isUuid(id)) throw E('not_found');
      if (locationId && !isUuid(locationId)) throw E('invalid_location');
      const rows = await q(sb.from('photos').update({ location_id: locationId || null }).eq('id', id).select('id'));
      if (!rows || !rows.length) throw await zeroRowsError('photos', id);
      return getOne('photo_overview', 'id', id);
    }),
    deletePhoto: wrap(async (photo) => {
      const id = typeof photo === 'string' ? photo : photo && photo.id;
      if (!isUuid(id)) throw E('not_found');
      const rows = await q(sb.from('photos').delete().eq('id', id).select('id, path'));
      if (!rows || !rows.length) throw await zeroRowsError('photos', id);
      urlCache.delete(rows[0].path);
      try { await sb.storage.from(BUCKET).remove([rows[0].path]); } catch (err) { console.warn('[api] Datei bleibt im Speicher:', err); }
    }),
    importAnalysis: wrap(async (items, source) => {
      if (!Array.isArray(items)) throw E('invalid_input');
      if (items.length > ANALYSIS_CHUNK_MAX) throw E('too_many');
      return rpc('import_photo_analysis', { p_items: items, p_source: trimOrNull(source) || 'KI-Analyse' });
    }),

    // ---- Erkennungen ----
    listDetections: wrap(async ({ spaceId, photoId, status, articleId, machineId } = {}) => fetchAll(() => {
      let qb = sb.from('detection_overview').select('*');
      if (spaceId) qb = qb.eq('space_id', spaceId);
      if (photoId) qb = qb.eq('photo_id', photoId);
      if (articleId) qb = qb.eq('article_id', articleId);
      if (machineId) qb = qb.eq('machine_id', machineId);
      if (status) qb = Array.isArray(status) ? qb.in('status', status) : qb.eq('status', status);
      return qb.order('created_at').order('id');
    })),
    reviewDetection: wrap(async (id, action, data = {}) => {
      if (!isUuid(id)) throw E('not_found');
      return rpc('review_detection', { p_id: id, p_action: String(action || ''), p_data: data && typeof data === 'object' ? data : {} });
    }),
    addDetection: wrap(async (photoId, data = {}) => {
      if (!isUuid(photoId)) throw E('not_found');
      return rpc('add_detection', { p_photo: photoId, p_data: data && typeof data === 'object' ? data : {} });
    }),

    // ---- Organisationsaufgaben ----
    listTasks: wrap(async ({ locationId, spaceId, status } = {}) => {
      const rows = await fetchAll(() => {
        let qb = sb.from('org_task_overview').select('*');
        if (locationId) qb = qb.eq('location_id', locationId);
        if (spaceId) qb = qb.eq('root_id', spaceId);
        if (status) qb = Array.isArray(status) ? qb.in('status', status) : qb.eq('status', status);
        return qb.order('created_at').order('id');
      });
      const rank = { offen: 0, erledigt: 1, verworfen: 2 };
      return rows.sort((a, b) => (rank[a.status] - rank[b.status]) || ((a.sort || 0) - (b.sort || 0))
        || String(a.created_at).localeCompare(String(b.created_at)));
    }),
    saveTask: wrap(async (obj) => {
      if (!obj || typeof obj !== 'object') throw E('invalid_value');
      const text = (k) => (has(obj, k) ? trimOrNull(obj[k]) : undefined);
      let id = obj.id;
      if (!id) {
        const title = text('title');
        if (!title) throw E('name_required');
        if (!isUuid(obj.location_id)) throw E('invalid_location');
        const row = { location_id: obj.location_id, title, details: text('details') ?? null,
          source: obj.source || 'manuell', status: obj.status || 'offen', assigned_to: obj.assigned_to || null,
          photo_id: obj.photo_id || null, sort: Number.isFinite(Number(obj.sort)) ? Math.round(Number(obj.sort)) : 0 };
        id = (await q(sb.from('org_tasks').insert(row).select('id').single())).id;
      } else {
        if (!isUuid(id)) throw E('not_found');
        const patch = {};
        if (has(obj, 'title')) { patch.title = text('title'); if (!patch.title) throw E('name_required'); }
        if (has(obj, 'details')) patch.details = text('details');
        if (has(obj, 'status')) patch.status = obj.status;
        if (has(obj, 'assigned_to')) patch.assigned_to = obj.assigned_to || null;
        if (has(obj, 'sort')) patch.sort = Math.round(Number(obj.sort) || 0);
        if (Object.keys(patch).length) {
          const rows = await q(sb.from('org_tasks').update(patch).eq('id', id).select('id'));
          if (!rows || !rows.length) throw await zeroRowsError('org_tasks', id);
        }
      }
      return getOne('org_task_overview', 'id', id);
    }),

    // ---- Bereiche auf Fotos ----
    listHotspots: wrap(async ({ photoId, photoIds, locationId } = {}) => {
      const ids = (photoIds || (photoId ? [photoId] : [])).filter(isUuid);
      if (!ids.length && !isUuid(locationId)) return [];
      let qb = sb.from('photo_hotspots').select('*');
      if (ids.length) qb = qb.in('photo_id', ids);
      if (isUuid(locationId)) qb = qb.eq('location_id', locationId);
      const rows = (await q(qb.order('created_at').order('id'))) || [];
      const locIds = [...new Set(rows.map((r) => r.location_id).filter(Boolean))];
      const locs = locIds.length ? (await q(sb.from('locations').select('id, code, name, type').in('id', locIds))) || [] : [];
      const byId = new Map(locs.map((l) => [l.id, l]));
      return rows.map((r) => {
        const l = byId.get(r.location_id);
        return { ...r, location_code: l ? l.code : null, location_name: l ? l.name : null, location_type: l ? l.type : null };
      });
    }),
    saveHotspot: wrap(async (obj) => {
      if (!obj || typeof obj !== 'object') throw E('invalid_value');
      const pick = {};
      for (const k of ['location_id', 'x', 'y', 'w', 'h', 'label']) if (has(obj, k)) pick[k] = obj[k];
      for (const k of ['x', 'y', 'w', 'h']) {
        if (!has(pick, k)) continue;
        if (pick[k] === null && (k === 'w' || k === 'h')) continue;
        const n = Number(pick[k]);
        if (!Number.isFinite(n) || n < 0 || n > 1) throw E('invalid_value');
        pick[k] = Math.round(n * 10000) / 10000;
      }
      if (has(pick, 'label')) pick.label = trimOrNull(pick.label);
      if (has(pick, 'location_id')) pick.location_id = pick.location_id || null;
      let row;
      if (!obj.id) {
        if (!isUuid(obj.photo_id)) throw E('not_found');
        if (pick.location_id && !isUuid(pick.location_id)) throw E('invalid_location');
        // auf einem Gebäudeplan darf ein Bereich zunächst nur beschriftet sein
        if (!pick.location_id && !pick.label) throw E('name_required');
        row = await q(sb.from('photo_hotspots').insert({ photo_id: obj.photo_id, ...pick }).select('*').single());
      } else {
        if (!isUuid(obj.id)) throw E('not_found');
        const rows = await q(sb.from('photo_hotspots').update(pick).eq('id', obj.id).select('*'));
        if (!rows || !rows.length) throw await zeroRowsError('photo_hotspots', obj.id);
        row = rows[0];
      }
      const l = row.location_id ? await q(sb.from('locations').select('code, name, type').eq('id', row.location_id).maybeSingle()) : null;
      return { ...row, location_code: l ? l.code : null, location_name: l ? l.name : null, location_type: l ? l.type : null };
    }),

    // ---- Gebäudepläne (Grundriss je Stockwerk; Bild = Foto mit kind 'plan', Räume = Bereiche) ----
    // ---- Standorte (Adressen; gruppieren Räume und Pläne, stehen nicht im Code) ----
    listSites: wrap(async () => (await q(sb.from('site_overview').select('*').order('sort').order('name').order('id'))) || []),
    saveSite: wrap(async (obj) => {
      if (!obj || typeof obj !== 'object') throw E('invalid_value');
      const patch = {};
      if (has(obj, 'name')) { patch.name = String(obj.name ?? '').trim(); if (!patch.name) throw E('name_required'); if (patch.name.length > 80) throw E('invalid_value'); }
      if (has(obj, 'address')) { patch.address = trimOrNull(obj.address); if (patch.address && patch.address.length > 200) throw E('invalid_value'); }
      if (has(obj, 'sort')) patch.sort = Math.round(Number(obj.sort) || 0);
      if (has(obj, 'notes')) { patch.notes = trimOrNull(obj.notes); if (patch.notes && patch.notes.length > 2000) throw E('invalid_value'); }
      let id = obj.id;
      if (!id) {
        if (!patch.name) throw E('name_required');
        id = (await q(sb.from('sites').insert(patch).select('id').single())).id;
      } else {
        if (!isUuid(id)) throw E('not_found');
        if (Object.keys(patch).length) {
          const rows = await q(sb.from('sites').update(patch).eq('id', id).select('id'));
          if (!rows || !rows.length) throw await zeroRowsError('sites', id);
        }
      }
      return getOne('site_overview', 'id', id);
    }),
    deleteSite: wrap(async (id) => {
      if (!isUuid(id)) throw E('not_found');
      const rows = await q(sb.from('sites').delete().eq('id', id).select('id'));
      if (!rows || !rows.length) throw await zeroRowsError('sites', id);
    }),

    // ---- Bedarf je Maschine (Verbrauchsmaterial/Zubehör, das ein Gerät braucht) ----
    listSupplies: wrap(async ({ machineId, articleId } = {}) => {
      if (machineId && !isUuid(machineId)) return [];
      if (articleId && !isUuid(articleId)) return [];
      return fetchAll(() => {
        let qb = sb.from('machine_supply_overview').select('*');
        if (machineId) qb = qb.eq('machine_id', machineId);
        if (articleId) qb = qb.eq('article_id', articleId);
        return qb.order('article_name').order('machine_name').order('id');
      });
    }),
    saveSupply: wrap(async (obj) => {
      if (!obj || typeof obj !== 'object') throw E('invalid_value');
      const note = has(obj, 'note') ? trimOrNull(obj.note) : undefined;
      if (note && note.length > 300) throw E('invalid_value');
      let id = obj.id;
      if (!id) {
        if (!isUuid(obj.machine_id) || !isUuid(obj.article_id)) throw E('not_found');
        id = (await q(sb.from('machine_supplies').insert({ machine_id: obj.machine_id, article_id: obj.article_id, note: note ?? null })
          .select('id').single())).id;
      } else {
        if (!isUuid(id)) throw E('not_found');
        if (note !== undefined) {
          const rows = await q(sb.from('machine_supplies').update({ note }).eq('id', id).select('id'));
          if (!rows || !rows.length) throw await zeroRowsError('machine_supplies', id);
        }
      }
      const out = await getOne('machine_supply_overview', 'id', id);
      if (!out) throw E('not_found');
      return out;
    }),
    deleteSupply: wrap(async (id) => {
      if (!isUuid(id)) throw E('not_found');
      const rows = await q(sb.from('machine_supplies').delete().eq('id', id).select('id'));
      if (!rows || !rows.length) throw await zeroRowsError('machine_supplies', id);
    }),

    // ---- Einkaufsliste (was gekauft werden muss; kein Bestellmodul) ----
    // status 'open' = offen + bestellt (neueste zuerst), 'done' = erledigt/verworfen (die letzten 40)
    listShopping: wrap(async ({ status = 'open' } = {}) => {
      if (status === 'done') {
        return (await q(sb.from('shopping_overview').select('*').in('status', ['erledigt', 'verworfen'])
          .order('done_at', { ascending: false, nullsFirst: false }).order('id').limit(40))) || [];
      }
      return fetchAll(() => sb.from('shopping_overview').select('*').in('status', ['offen', 'bestellt'])
        .order('created_at', { ascending: false }).order('id'));
    }),
    saveShoppingItem: wrap(async (obj) => {
      if (!obj || typeof obj !== 'object') throw E('invalid_value');
      const patch = {};
      if (has(obj, 'name')) { patch.name = trimOrNull(obj.name); if (patch.name && patch.name.length > 200) throw E('invalid_value'); }
      if (has(obj, 'qty')) {
        const n = num(obj.qty);
        if (Number.isNaN(n) || (n !== null && !(n > 0 && n < 1e9))) throw E('invalid_qty');
        patch.qty = n;
      }
      if (has(obj, 'unit')) { patch.unit = trimOrNull(obj.unit); if (patch.unit && patch.unit.length > 20) throw E('invalid_value'); }
      if (has(obj, 'note')) { patch.note = trimOrNull(obj.note); if (patch.note && patch.note.length > 500) throw E('invalid_value'); }
      let id = obj.id;
      if (!id) {
        const articleId = obj.article_id || null;
        if (articleId && !isUuid(articleId)) throw E('not_found');
        if (!articleId && !patch.name) throw E('name_required');
        // Name/Einheit setzt die Datenbank vom Artikel, wenn leer
        const row = { ...patch, article_id: articleId, name: patch.name || '' };
        id = (await q(sb.from('shopping_items').insert(row).select('id').single())).id;
      } else {
        if (!isUuid(id)) throw E('not_found');
        if (has(patch, 'name') && !patch.name) throw E('name_required');
        if (Object.keys(patch).length) {
          const rows = await q(sb.from('shopping_items').update(patch).eq('id', id).select('id'));
          if (!rows || !rows.length) throw await zeroRowsError('shopping_items', id);
        }
      }
      const out = await getOne('shopping_overview', 'id', id);
      if (!out) throw E('not_found');
      return out;
    }),
    setShoppingStatus: wrap(async (id, status) => {
      if (!isUuid(id)) throw E('not_found');
      if (!['offen', 'bestellt', 'erledigt', 'verworfen'].includes(status)) throw E('invalid_status');
      const rows = await q(sb.from('shopping_items').update({ status }).eq('id', id).select('id'));
      if (!rows || !rows.length) throw await zeroRowsError('shopping_items', id);
      return getOne('shopping_overview', 'id', id);
    }),
    deleteShoppingItem: wrap(async (id) => {
      if (!isUuid(id)) throw E('not_found');
      const rows = await q(sb.from('shopping_items').delete().eq('id', id).select('id'));
      if (!rows || !rows.length) throw await zeroRowsError('shopping_items', id);
    }),
    // Entnahmen der letzten 90 Tage je Artikel: [{ article_id, used_90d, takes_90d, first_take_at, last_take_at }]
    listConsumption: wrap(async () => fetchAll(() => sb.from('article_consumption').select('*').order('article_id'))),

    listFloorPlans: wrap(async () => (await q(sb.from('floor_plan_overview').select('*').order('sort').order('name').order('id'))) || []),
    saveFloorPlan: wrap(async (obj) => {
      if (!obj || typeof obj !== 'object') throw E('invalid_value');
      const patch = {};
      if (has(obj, 'name')) { patch.name = String(obj.name ?? '').trim(); if (!patch.name) throw E('name_required'); }
      if (has(obj, 'sort')) patch.sort = Math.round(Number(obj.sort) || 0);
      if (has(obj, 'notes')) patch.notes = trimOrNull(obj.notes);
      if (has(obj, 'site_id')) {
        patch.site_id = obj.site_id || null;
        if (patch.site_id && !isUuid(patch.site_id)) throw E('invalid_value');
      }
      let id = obj.id;
      if (!id) {
        if (!patch.name) throw E('name_required');
        if (!isUuid(obj.photo_id)) throw E('file_required');
        id = (await q(sb.from('floor_plans').insert({ ...patch, photo_id: obj.photo_id }).select('id').single())).id;
      } else {
        if (!isUuid(id)) throw E('not_found');
        if (Object.keys(patch).length) {
          const rows = await q(sb.from('floor_plans').update(patch).eq('id', id).select('id'));
          if (!rows || !rows.length) throw await zeroRowsError('floor_plans', id);
        }
      }
      return getOne('floor_plan_overview', 'id', id);
    }),
    deleteFloorPlan: wrap(async (id) => {
      if (!isUuid(id)) throw E('not_found');
      const rows = await q(sb.from('floor_plans').delete().eq('id', id).select('id, photo_id'));
      if (!rows || !rows.length) throw await zeroRowsError('floor_plans', id);
      // Planbild samt Bereichen entfernen (best effort; Bereiche hängen am Bild)
      try {
        const ph = await q(sb.from('photos').delete().eq('id', rows[0].photo_id).select('path'));
        if (ph && ph[0]) { urlCache.delete(ph[0].path); await sb.storage.from(BUCKET).remove([ph[0].path]); }
      } catch (err) { console.warn('[api] Planbild bleibt erhalten:', err); }
    }),
    deleteHotspot: wrap(async (id) => {
      if (!isUuid(id)) throw E('not_found');
      const rows = await q(sb.from('photo_hotspots').delete().eq('id', id).select('id'));
      if (!rows || !rows.length) throw await zeroRowsError('photo_hotspots', id);
    }),

    // ---- Sets ----
    listComponents: wrap(async (setId) => {
      if (!isUuid(setId)) return [];
      const rows = (await q(sb.from('set_components').select('*').eq('set_id', setId).order('sort').order('created_at').order('id'))) || [];
      const mIds = [...new Set(rows.map((r) => r.machine_id).filter(Boolean))];
      const aIds = [...new Set(rows.map((r) => r.article_id).filter(Boolean))];
      const [ms, as] = await Promise.all([
        mIds.length ? q(sb.from('machines').select('id, code, name').in('id', mIds)) : [],
        aIds.length ? q(sb.from('articles').select('id, code, name, unit').in('id', aIds)) : [],
      ]);
      const mm = new Map((ms || []).map((m) => [m.id, m]));
      const am = new Map((as || []).map((a) => [a.id, a]));
      return rows.map((r) => ({
        ...r,
        machine_code: mm.get(r.machine_id)?.code ?? null, machine_name: mm.get(r.machine_id)?.name ?? null,
        article_code: am.get(r.article_id)?.code ?? null, article_name: am.get(r.article_id)?.name ?? null,
        unit: am.get(r.article_id)?.unit ?? null,
      }));
    }),
    saveComponent: wrap(async (obj) => {
      if (!obj || typeof obj !== 'object') throw E('invalid_value');
      const qty = has(obj, 'qty') ? num(obj.qty) : undefined;
      if (qty !== undefined && (qty === null || Number.isNaN(qty) || qty <= 0)) throw E('invalid_qty');
      if (!obj.id) {
        if (!isUuid(obj.set_id)) throw E('not_found');
        const row = { set_id: obj.set_id, machine_id: obj.machine_id || null, article_id: obj.article_id || null,
          name: trimOrNull(obj.name), qty: qty ?? 1, note: trimOrNull(obj.note),
          sort: Number.isFinite(Number(obj.sort)) ? Math.round(Number(obj.sort)) : 0 };
        if (!row.machine_id && !row.article_id && !row.name) throw E('name_required');
        return q(sb.from('set_components').insert(row).select('*').single());
      }
      if (!isUuid(obj.id)) throw E('not_found');
      const patch = {};
      if (qty !== undefined) patch.qty = qty;
      if (has(obj, 'note')) patch.note = trimOrNull(obj.note);
      if (has(obj, 'name')) patch.name = trimOrNull(obj.name);
      if (has(obj, 'sort')) patch.sort = Math.round(Number(obj.sort) || 0);
      const rows = await q(sb.from('set_components').update(patch).eq('id', obj.id).select('*'));
      if (!rows || !rows.length) throw await zeroRowsError('set_components', obj.id);
      return rows[0];
    }),
    deleteComponent: wrap(async (id) => {
      if (!isUuid(id)) throw E('not_found');
      const rows = await q(sb.from('set_components').delete().eq('id', id).select('id'));
      if (!rows || !rows.length) throw await zeroRowsError('set_components', id);
    }),

    // ---- Protokoll ----
    listAudit: wrap(async ({ limit, entity, entityId } = {}) => {
      let qb = sb.from('audit_log').select('*');
      if (entity) qb = qb.eq('entity', AUDIT_TABLE[entity] || entity);
      if (entityId) qb = qb.eq('entity_id', entityId);
      const n = Number(limit) > 0 ? Math.floor(Number(limit)) : DEFAULT_LIMIT;
      return (await q(qb.order('at', { ascending: false }).order('id', { ascending: false }).limit(n))) || [];
    }),
  };

  api._mapError = mapError;   // für Tests
  return api;
}
