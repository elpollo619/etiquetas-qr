// Datenzugriff der App: `import { api, LgrError } from './api.js'`.
// Beim Laden wird entschieden: Supabase (wenn SUPABASE_URL und SUPABASE_ANON_KEY gesetzt sind) oder Demo-Modus.
// Das supabase-js-Paket wird nur im Supabase-Modus geladen (dynamischer Import).
// Vertrag: docs/ARCHITECTURE.md, Abschnitt «API-Vertrag».
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

/** Fehler der Datenschicht. `code` = LGR-Code ohne Präfix (z. B. 'not_available'), `detail` = Zusatz (z. B. aktueller Status). */
export class LgrError extends Error {
  constructor(code, detail = null) {
    const c = String(code || 'unknown');
    const d = detail === undefined || detail === null || detail === '' ? null : detail;
    super(d === null ? c : `${c}: ${d}`);
    this.name = 'LgrError';
    this.code = c;
    this.detail = d;
  }
}

/** Alle Methoden des API-Vertrags (beide Implementierungen stellen genau diese bereit). */
export const API_METHODS = Object.freeze([
  'init', 'getSession', 'onAuthChange', 'signIn', 'signUp', 'signOut', 'resetPassword', 'updatePassword',
  'getMyProfile', 'updateMyProfile', 'demoUsers', 'demoSwitchUser', 'demoReset',
  'listProfiles', 'adminUpdateProfile', 'listInvites', 'addInvite', 'deleteInvite',
  'listLocations', 'getLocation', 'getLocationByCode', 'saveLocation', 'deleteLocation',
  'listMachines', 'getMachine', 'getMachineByCode', 'saveMachine', 'deleteMachine',
  'checkoutMachine', 'returnMachine', 'setMachineStatus', 'listLoans', 'correctLoan',
  'listArticles', 'getArticle', 'getArticleByCode', 'saveArticle', 'deleteArticle', 'moveStock', 'listMovements',
  'listAttachments', 'uploadAttachment', 'deleteAttachment', 'setPrimaryAttachment', 'fileUrls',
  'listInventories', 'createInventory', 'getInventory', 'countArticle', 'checkMachine', 'closeInventory',
  'listAudit',
]);

export const SUPABASE_CONFIGURED = Boolean(String(SUPABASE_URL || '').trim() && String(SUPABASE_ANON_KEY || '').trim());

// Ersatz, falls supabase-js nicht geladen werden kann (z. B. CDN nicht erreichbar):
// die App startet, jede Datenaktion meldet «network».
function unavailableApi(err) {
  const detail = String(err && err.message ? err.message : err || 'supabase-js');
  const fail = async () => { throw new LgrError('network', detail); };
  const out = { mode: 'supabase', unavailable: true };
  for (const m of API_METHODS) out[m] = fail;
  out.init = async () => {};
  out.getSession = async () => null;
  out.getMyProfile = async () => null;
  out.onAuthChange = () => () => {};
  out.demoUsers = async () => [];
  return out;
}

// Demo erzwingen (Ausprobieren/Schulung, ohne echte Daten): Adresse mit ?demo=1 öffnen; ?demo=0 beendet es.
function demoForced() {
  try {
    const sp = new URLSearchParams(location.search);
    const p = sp.get('demo');
    // Ein QR-Link (?c=… / ?id=…) startet nie den Demo-Modus – ein manipulierter QR könnte sonst
    // Ausleihen vortäuschen, die nicht gespeichert werden.
    if (sp.get('c') || sp.get('id')) { sessionStorage.removeItem('lgr-force-demo'); return false; }
    if (p === '1') sessionStorage.setItem('lgr-force-demo', '1');
    if (p === '0') sessionStorage.removeItem('lgr-force-demo');
    return sessionStorage.getItem('lgr-force-demo') === '1';
  } catch (e) { return false; }
}

async function loadApi() {
  if (!SUPABASE_CONFIGURED || demoForced()) {
    const mod = await import('./api-demo.js');
    return mod.createApi({ LgrError });
  }
  try {
    const mod = await import('./api-supabase.js');
    return mod.createApi({ LgrError });
  } catch (err) {
    console.error('[api] Supabase konnte nicht geladen werden:', err);
    return unavailableApi(err);
  }
}

// Hinweis: api-demo.js / api-supabase.js importieren diese Datei bewusst NICHT
// (zyklischer Import + Top-Level-await würde blockieren); LgrError wird übergeben.
export const api = await loadApi();
