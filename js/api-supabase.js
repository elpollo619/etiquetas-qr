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
const LOCATION_INSERT = ['code', 'name', 'type', 'parent_id', 'notes', 'archived'];
const LOCATION_UPDATE = ['name', 'type', 'parent_id', 'notes', 'archived'];
const ARTICLE_INSERT = ['code', 'name', 'description', 'art_no', 'category', 'brand', 'model', 'size', 'color', 'usage',
  'label_text', 'unit', 'stock', 'min_stock', 'location_id', 'notes', 'archived'];
const ARTICLE_UPDATE = ['name', 'description', 'art_no', 'category', 'brand', 'model', 'size', 'color', 'usage',
  'label_text', 'unit', 'min_stock', 'location_id', 'notes', 'archived'];
const MACHINE_INSERT = ['code', 'name', 'category', 'brand', 'model', 'serial_no', 'inventory_no', 'home_location_id',
  'status', 'condition', 'condition_note', 'notes', 'archived'];
const MACHINE_UPDATE = ['name', 'category', 'brand', 'model', 'serial_no', 'inventory_no', 'home_location_id',
  'condition', 'condition_note', 'notes', 'archived'];

const REF_COLS = new Set(['parent_id', 'location_id', 'home_location_id']);
const NUM_COLS = new Set(['stock', 'min_stock']);
const BOOL_COLS = new Set(['archived']);
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
        return E('duplicate', cn || null);
      }
      case '23503': {
        if (/update or delete on table/i.test(msg)) return E('in_use');
        const cn = constraintName(msg);
        if (/location|parent/.test(cn)) return E('invalid_location');
        if (/borrower/.test(cn)) return E('invalid_borrower');
        return E('not_found');
      }
      case '23514': {
        const cn = constraintName(msg);
        if (/name/.test(cn)) return E('name_required');
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
    createInventory: wrap(async ({ name, note } = {}) => {
      const n = trimOrNull(name);
      if (!n) throw E('name_required');
      return q(sb.from('inventories').insert({ name: n, note: trimOrNull(note) }).select('*').single());
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
