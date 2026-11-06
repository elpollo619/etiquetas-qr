// Tests für die Datenschicht. Ausführen (im Ordner web):  node --test tests/
// Teil 1: Demo-Implementierung (Regeln, Rechte, Fehlercodes wie schema.sql).
// Teil 2: Supabase-Implementierung mit Ersatz-Client (Anfragen, Fehlerzuordnung) – ohne echtes Projekt.
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import * as nodeModule from 'node:module';

// ---- localStorage-Ersatz (muss vor dem Import von api.js existieren) ----
class MemoryStorage {
  constructor() { this.map = new Map(); }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
  clear() { this.map.clear(); }
  key(i) { return [...this.map.keys()][i] ?? null; }
  get length() { return this.map.size; }
}
globalThis.localStorage = new MemoryStorage();

// supabase-js vom CDN durch einen Platzhalter ersetzen (Node lädt keine https-Module)
if (typeof nodeModule.registerHooks === 'function') {
  nodeModule.registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier.startsWith('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@')) {
        return { url: 'data:text/javascript,export function createClient(){throw new Error("kein echter Client im Test")}', shortCircuit: true };
      }
      return nextResolve(specifier, context);
    },
  });
}

// api.js unabhängig von config.js im Demo-Modus laden: Schalter «?demo=1» (merkt sich api.js im sessionStorage)
globalThis.sessionStorage = new MemoryStorage();
globalThis.location = { search: '?demo=1', hash: '' };
const { api: defaultApi, LgrError, API_METHODS, SUPABASE_CONFIGURED } = await import('../js/api.js');
delete globalThis.location;
const { createApi, DEMO_USER_IDS: U, STORAGE_KEY } = await import('../js/api-demo.js');

const fresh = (storage = new MemoryStorage()) => createApi({ LgrError, storage });
const tick = () => new Promise((r) => setTimeout(r, 5));

async function rejects(promise, code, detail) {
  await assert.rejects(promise, (e) => {
    assert.ok(e instanceof LgrError, `LgrError erwartet, erhalten: ${e && e.stack}`);
    assert.equal(e.code, code, `Code ${code} erwartet, erhalten ${e.code} (${e.message})`);
    if (detail !== undefined) assert.equal(e.detail, detail);
    return true;
  });
}
async function demo() {
  const api = fresh();
  await api.init();
  return api;
}
const as = (api, key) => api.demoSwitchUser(U[key]);
const M = (api, code) => api.getMachineByCode(code);
const A = (api, code) => api.getArticleByCode(code);
const L = (api, code) => api.getLocationByCode(code);

// =============================================================================================
//  Teil 1: Demo
// =============================================================================================
describe('api.js', () => {
  test('Demo-Modus (?demo=1 oder ohne Konfiguration), alle Vertragsmethoden vorhanden', async () => {
    assert.equal(defaultApi.mode, 'demo');
    for (const m of API_METHODS) assert.equal(typeof defaultApi[m], 'function', m);
    await defaultApi.init();
    await rejects(defaultApi.checkoutMachine(randomUUID(), {}), 'not_found');
    assert.ok(globalThis.localStorage.getItem(STORAGE_KEY), 'Demodaten im localStorage');
  });

  test('ohne Demo-Schalter: konfiguriert → Supabase (lokal gebündeltes supabase-js), alle Methoden vorhanden', async () => {
    globalThis.sessionStorage.clear();
    const logError = console.error;
    console.error = () => {};
    try {
      const mod = await import('../js/api.js?ohne-demo');   // eigene Modulinstanz
      if (!SUPABASE_CONFIGURED) { assert.equal(mod.api.mode, 'demo'); return; }
      assert.equal(mod.api.mode, 'supabase');
      assert.notEqual(mod.api.unavailable, true, 'js/vendor/supabase.js muss ladbar sein (kein CDN mehr)');
      for (const m of API_METHODS) assert.equal(typeof mod.api[m], 'function', m);
      // keine Netzwerkaufrufe gegen das echte Projekt im Test
    } finally {
      console.error = logError;
    }
  });
});

describe('Demodaten', () => {
  test('Aufbau ohne Fehler, angemeldet als Cristian (Admin)', async () => {
    const api = await demo();
    assert.deepEqual(api._seedErrors, []);
    const s = await api.getSession();
    assert.equal(s.userId, U.cristian);
    const me = await api.getMyProfile();
    assert.equal(me.full_name, 'Cristian');
    assert.equal(me.role, 'admin');
    const users = await api.demoUsers();
    assert.deepEqual(users.map((u) => u.full_name), ['Cristian', 'Luca', 'Daniel', 'Ana']);
    assert.deepEqual(users.map((u) => [u.role, u.active]),
      [['admin', true], ['lagerverantwortlicher', true], ['mitarbeiter', true], ['mitarbeiter', false]]);
  });

  test('Bohrhammer: offen bei Cristian, Verlauf Daniel und Luca', async () => {
    const api = await demo();
    const bh = await M(api, 'm-0001');
    assert.equal(bh.name, 'Bosch Bohrhammer GBH 2-28');
    assert.equal(bh.status, 'ausgeliehen');
    assert.equal(bh.location_path, 'Hauptlager / Regal B');
    assert.equal(bh.open_borrower_name, 'Cristian');
    assert.equal(bh.overdue, false);
    assert.equal(bh.last_borrower_name, 'Daniel');
    assert.equal(bh.last_return_condition, 'ok');
    assert.ok(bh.photo_path);
    const loans = await api.listLoans({ machineId: bh.id });
    assert.deepEqual(loans.map((l) => l.borrower_name), ['Cristian', 'Daniel', 'Luca']);
    const hm = (iso) => { const d = new Date(iso); return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`; };
    assert.equal(loans[0].returned_at, null);
    assert.deepEqual([hm(loans[1].checked_out_at), hm(loans[1].returned_at)], ['8:00', '17:00']);
    assert.deepEqual([hm(loans[2].checked_out_at), hm(loans[2].returned_at)], ['9:15', '15:30']);
    const today = new Date(); today.setHours(7, 50, 0, 0);
    if (Date.now() > today.getTime()) assert.equal(hm(loans[0].checked_out_at), '7:30');
    assert.ok(new Date(loans[0].checked_out_at).getTime() <= Date.now(), 'offene Ausleihe nicht in der Zukunft');
  });

  test('weitere Maschinen, Material, Lagerorte, Inventur', async () => {
    const api = await demo();
    const st = async (c) => (await M(api, c)).status;
    assert.equal(await st('M-0003'), 'defekt');
    assert.equal(await st('M-0004'), 'wartung');
    assert.equal(await st('M-0006'), 'reserviert');
    assert.equal(await st('M-0007'), 'verfuegbar');
    const schlag = await M(api, 'M-0005');
    assert.equal(schlag.open_borrower_name, 'Daniel');
    assert.equal(schlag.overdue, true);
    const hilti = await M(api, 'M-0002');
    assert.equal(hilti.status, 'verfuegbar');
    assert.equal(hilti.last_borrower_name, 'Cristian');
    assert.equal(hilti.last_returned_by_name, 'Luca');

    const cat = await A(api, 'INV-0001');
    assert.equal(cat.art_no, "237'103");
    assert.equal(cat.size, '1,5 m');
    assert.equal(cat.brand, 'QUALY-PATCH');
    assert.equal(cat.location_path, 'Büro / Auf dem schwarzen Schrank / Box «Cat 6 slim 1,5 m»');
    assert.equal(cat.stock, 13);
    assert.equal((await A(api, 'INV-0002')).art_no, "237'104");
    const schrauben = await A(api, 'INV-0003');
    assert.equal(schrauben.stock, 130);
    assert.equal(schrauben.low_stock, true);
    assert.equal((await A(api, 'INV-0004')).location_path, 'Hauptlager / Regal A / Fach 02');
    assert.equal((await A(api, 'INV-0006')).unit, 'm');

    const box = await L(api, 'L-0004');
    assert.equal(box.path, 'Hauptlager / Regal A / Fach 02 / Box 03');
    assert.equal(box.depth, 3);
    const locs = await api.listLocations();
    assert.equal(locs[0].path, 'Büro');

    const invs = await api.listInventories();
    assert.equal(invs.length, 1);
    assert.equal(invs[0].status, 'abgeschlossen');
    assert.equal(invs[0].applied, true);
    assert.match(invs[0].name, /^Inventur \S+ \d{4}$/);
    const mv = await api.listMovements({ articleId: cat.id });
    assert.deepEqual(mv.map((m) => m.type).sort(), ['anlage', 'entnahme', 'inventur']);
    assert.ok((await api.listAudit({ limit: 500 })).length > 30);
    assert.ok((await api.listAudit({ entity: 'machine', entityId: hilti.id })).some((r) => r.action === 'zurueckgeben'));
  });
});

describe('Ausleihe', () => {
  test('zweimal ausleihen: zweite Ausleihe abgelehnt, gleiche requestId = gleiche Buchung', async () => {
    const api = await demo();
    await as(api, 'daniel');
    const hilti = await M(api, 'M-0002');
    const req = randomUUID();
    const loan = await api.checkoutMachine(hilti.id, { requestId: req, note: '  Baustelle  ' });
    assert.equal(loan.borrower_id, U.daniel);
    assert.equal(loan.checkout_note, 'Baustelle');
    assert.equal(loan.returned_at, null);
    const again = await api.checkoutMachine(hilti.id, { requestId: req });
    assert.equal(again.id, loan.id);
    await rejects(api.checkoutMachine(hilti.id, { requestId: randomUUID() }), 'not_available', 'ausgeliehen');
    await as(api, 'luca');
    await rejects(api.checkoutMachine(hilti.id, {}), 'not_available', 'ausgeliehen');
    assert.equal((await api.listLoans({ machineId: hilti.id, open: true })).length, 1);
    const m = await M(api, 'M-0002');
    assert.equal(m.status, 'ausgeliehen');
    assert.equal(m.open_borrower_name, 'Daniel');
  });

  test('Rückgabe durch eine andere Person: Ausleiher und Rückgeber getrennt', async () => {
    const api = await demo();
    await as(api, 'daniel');
    const hilti = await M(api, 'M-0002');
    await api.checkoutMachine(hilti.id, {});
    await as(api, 'luca');
    const req = randomUUID();
    const loan = await api.returnMachine(hilti.id, { requestId: req });
    assert.equal(loan.borrower_id, U.daniel);
    assert.equal(loan.returned_by, U.luca);
    assert.equal(loan.return_condition, 'ok');
    const again = await api.returnMachine(hilti.id, { requestId: req });
    assert.equal(again.id, loan.id);
    await rejects(api.returnMachine(hilti.id, { requestId: randomUUID() }), 'not_on_loan');
    const m = await M(api, 'M-0002');
    assert.equal(m.status, 'verfuegbar');
    assert.equal(m.last_borrower_name, 'Daniel');
    assert.equal(m.last_returned_by_name, 'Luca');
    const [last] = await api.listAudit({ entity: 'machines', entityId: hilti.id, limit: 1 });
    assert.equal(last.action, 'zurueckgeben');
    assert.equal(last.details.stellvertretend, true);
    const [lo] = await api.listLoans({ machineId: hilti.id, limit: 1 });
    assert.equal(lo.returned_by_name, 'Luca');
    assert.equal(lo.borrower_name, 'Daniel');
  });

  test('defekt zurückgeben: Bemerkung nötig, Status defekt, danach nicht ausleihbar', async () => {
    const api = await demo();
    await as(api, 'daniel');
    const hilti = await M(api, 'M-0002');
    await api.checkoutMachine(hilti.id, {});
    await rejects(api.returnMachine(hilti.id, { condition: 'defekt' }), 'note_required');
    await rejects(api.returnMachine(hilti.id, { condition: 'maengel', note: '   ' }), 'note_required');
    await rejects(api.returnMachine(hilti.id, { condition: 'kaputt', note: 'x' }), 'invalid_condition');
    const loan = await api.returnMachine(hilti.id, { condition: 'defekt', note: 'Akku lädt nicht' });
    assert.equal(loan.return_condition, 'defekt');
    let m = await M(api, 'M-0002');
    assert.equal(m.status, 'defekt');
    assert.equal(m.condition, 'defekt');
    assert.equal(m.condition_note, 'Akku lädt nicht');
    await rejects(api.checkoutMachine(hilti.id, {}), 'not_available', 'defekt');
    await as(api, 'luca');
    await api.setMachineStatus(hilti.id, 'verfuegbar');
    m = await M(api, 'M-0002');
    assert.equal(m.status, 'verfuegbar');
    assert.equal(m.condition, 'ok');
    assert.equal(m.condition_note, null, 'repariert: alte Schadensnotiz entfernt');
  });

  test('Mängel: Status verfügbar, Zustand Mängel', async () => {
    const api = await demo();
    await as(api, 'daniel');
    const s = await M(api, 'M-0007');
    await api.checkoutMachine(s.id, {});
    await api.returnMachine(s.id, { condition: 'maengel', note: 'Schlauch rissig' });
    const m = await M(api, 'M-0007');
    assert.equal(m.status, 'verfuegbar');
    assert.equal(m.condition, 'maengel');
  });

  test('reserviert, für andere ausleihen, Rückgabedatum in der Vergangenheit', async () => {
    const api = await demo();
    const disto = await M(api, 'M-0006');
    const sauger = await M(api, 'M-0007');
    await as(api, 'daniel');
    await rejects(api.checkoutMachine(disto.id, {}), 'reserved');
    await rejects(api.checkoutMachine(sauger.id, { borrowerId: U.luca }), 'not_authorized');
    await rejects(api.checkoutMachine(sauger.id, { dueAt: new Date(Date.now() - 3600e3) }), 'due_in_past');
    await as(api, 'luca');
    await rejects(api.checkoutMachine(sauger.id, { borrowerId: U.ana }), 'invalid_borrower');
    const loan = await api.checkoutMachine(disto.id, { borrowerId: U.daniel, dueAt: '2099-01-31' });
    assert.equal(loan.borrower_id, U.daniel);
    assert.equal(loan.created_by, U.luca);
    const due = new Date(loan.due_at);
    assert.deepEqual([due.getFullYear(), due.getMonth(), due.getDate(), due.getHours()], [2099, 0, 31, 23]);
    await rejects(api.checkoutMachine(randomUUID(), {}), 'not_found');
  });

  test('Status setzen: nur Lagerverantwortliche, nicht während Ausleihe', async () => {
    const api = await demo();
    const sauger = await M(api, 'M-0007');
    const bh = await M(api, 'M-0001');
    await as(api, 'daniel');
    await rejects(api.setMachineStatus(sauger.id, 'wartung'), 'not_authorized');
    await as(api, 'luca');
    await rejects(api.setMachineStatus(bh.id, 'wartung'), 'on_loan');
    await rejects(api.setMachineStatus(sauger.id, 'ausgeliehen'), 'invalid_status');
    const m = await api.setMachineStatus(sauger.id, 'wartung', 'Filter tauschen');
    assert.equal(m.status, 'wartung');
    assert.equal(m.condition_note, 'Filter tauschen');
    await rejects(api.checkoutMachine(sauger.id, {}), 'not_available', 'wartung');
    const [a] = await api.listAudit({ entity: 'machines', entityId: sauger.id, limit: 1 });
    assert.deepEqual([a.action, a.details.alt, a.details.neu], ['status', 'verfuegbar', 'wartung']);
  });

  test('Ausleihe korrigieren (nur Admin, mit Begründung)', async () => {
    const api = await demo();
    const schlag = await M(api, 'M-0005');
    const loanId = schlag.open_loan_id;
    await as(api, 'luca');
    await rejects(api.correctLoan(loanId, { due_at: null, reason: 'x' }), 'not_authorized');
    await as(api, 'cristian');
    await rejects(api.correctLoan(loanId, { due_at: null, reason: '  ' }), 'reason_required');
    await rejects(api.correctLoan(loanId, { returned_at: '2000-01-01T10:00:00Z', reason: 'Test' }), 'invalid_dates');
    await rejects(api.correctLoan(loanId, { returned_at: new Date(Date.now() + 3600e3), reason: 'Zukunft' }), 'invalid_dates');
    const tomorrow = new Date(Date.now() + 86400e3).toISOString();
    const l = await api.correctLoan(loanId, { due_at: tomorrow, reason: 'Verlängert' });
    assert.equal(l.corrected, true);
    assert.equal(l.checked_out_at, schlag.open_since, 'nicht übergebene Felder bleiben');
    assert.equal(l.returned_at, null);
    assert.equal((await M(api, 'M-0005')).overdue, false);
    const back = await api.correctLoan(loanId, { returned_at: new Date().toISOString(), reason: 'Vergessen zurückzubuchen' });
    assert.equal(back.returned_by, U.cristian);
    assert.equal(back.return_condition, 'ok');
    assert.equal((await M(api, 'M-0005')).status, 'verfuegbar');
    const [a] = await api.listAudit({ entity: 'loans', entityId: loanId, limit: 1 });
    assert.equal(a.action, 'korrektur');
    assert.equal(a.details.grund, 'Vergessen zurückzubuchen');
  });
});

describe('Material', () => {
  test('Entnahme: Bestand nie negativ, requestId, Mengen', async () => {
    const api = await demo();
    const sch = await A(api, 'INV-0003');
    await as(api, 'daniel');
    await rejects(api.moveStock(sch.id, { type: 'entnahme', qty: 131 }), 'insufficient_stock');
    await rejects(api.moveStock(sch.id, { type: 'entnahme', qty: 0 }), 'invalid_qty');
    await rejects(api.moveStock(sch.id, { type: 'entnahme', qty: 'abc' }), 'invalid_qty');
    await rejects(api.moveStock(sch.id, { type: 'verkauf', qty: 1 }), 'invalid_type');
    const req = randomUUID();
    const mv = await api.moveStock(sch.id, { type: 'entnahme', qty: 30, requestId: req, note: 'Baustelle' });
    assert.deepEqual([mv.qty, mv.stock_before, mv.stock_after, mv.user_id], [-30, 130, 100, U.daniel]);
    const again = await api.moveStock(sch.id, { type: 'entnahme', qty: 30, requestId: req });
    assert.equal(again.id, mv.id);
    assert.equal((await A(api, 'INV-0003')).stock, 100);
    const nym = await A(api, 'INV-0006');
    const z = await api.moveStock(nym.id, { type: 'zugang', qty: '2,5' });
    assert.equal(z.stock_after, 117.5);
    const [last] = await api.listMovements({ userId: U.daniel, limit: 1 });
    assert.equal(last.article_name, nym.name);
    assert.equal(last.user_name, 'Daniel');
  });

  test('Korrektur und Umlagerung nur für Lagerverantwortliche', async () => {
    const api = await demo();
    const sch = await A(api, 'INV-0003');
    const buero = await L(api, 'L-0006');
    await as(api, 'daniel');
    await rejects(api.moveStock(sch.id, { type: 'korrektur', qty: 5, note: 'x' }), 'not_authorized');
    await rejects(api.moveStock(sch.id, { type: 'umlagerung', toLocationId: buero.id }), 'not_authorized');
    await as(api, 'luca');
    await rejects(api.moveStock(sch.id, { type: 'korrektur', qty: 7 }), 'reason_required');
    await rejects(api.moveStock(sch.id, { type: 'korrektur', qty: -1, note: 'x' }), 'invalid_qty');
    const k = await api.moveStock(sch.id, { type: 'korrektur', qty: 7, note: 'Nachgezählt' });
    assert.deepEqual([k.qty, k.stock_after], [-123, 7]);
    await rejects(api.moveStock(sch.id, { type: 'umlagerung', toLocationId: randomUUID() }), 'invalid_location');
    const u = await api.moveStock(sch.id, { type: 'umlagerung', toLocationId: buero.id });
    assert.equal(u.qty, 0);
    const a = await A(api, 'INV-0003');
    assert.equal(a.location_path, 'Büro');
    const [mv] = await api.listMovements({ articleId: sch.id, limit: 1 });
    assert.deepEqual([mv.type, mv.from_path, mv.to_path], ['umlagerung', 'Hauptlager / Regal A / Fach 02 / Box 03', 'Büro']);
    await api.saveArticle({ id: sch.id, archived: true });
    await rejects(api.moveStock(sch.id, { type: 'zugang', qty: 1 }), 'not_found');
    assert.ok(!(await api.listArticles()).some((x) => x.id === sch.id));
    assert.ok((await api.listArticles({ includeArchived: true })).some((x) => x.id === sch.id));
  });
});

describe('Rechte', () => {
  test('Mitarbeiter darf keine Stammdaten ändern, Protokoll leer', async () => {
    const api = await demo();
    const sauger = await M(api, 'M-0007');
    await as(api, 'daniel');
    await rejects(api.saveArticle({ name: 'Dübel 6 mm' }), 'not_authorized');
    await rejects(api.saveMachine({ id: sauger.id, name: 'Sauger' }), 'not_authorized');
    await rejects(api.saveLocation({ name: 'Keller' }), 'not_authorized');
    await rejects(api.createInventory({ name: 'X' }), 'not_authorized');
    assert.deepEqual(await api.listAudit(), []);
    assert.equal((await api.listMachines()).length, 7);
  });

  test('Löschen nur Admin; mit Verlauf nicht möglich', async () => {
    const api = await demo();
    const cat = await A(api, 'INV-0001');
    await as(api, 'luca');
    await rejects(api.deleteArticle(cat.id), 'not_authorized');
    const neu = await api.saveArticle({ name: 'Dübel 6 mm', unit: 'Pkg' });
    assert.equal(neu.stock, 0);
    await as(api, 'cristian');
    await rejects(api.deleteArticle(cat.id), 'in_use');
    await rejects(api.deleteMachine((await M(api, 'M-0001')).id), 'in_use');
    await rejects(api.deleteLocation((await L(api, 'L-0001')).id), 'in_use');
    await api.deleteArticle(neu.id);
    assert.equal(await api.getArticle(neu.id), null);
    await rejects(api.deleteArticle(neu.id), 'not_found');
  });

  test('nicht freigegeben (Ana) sieht nichts; abgemeldet → not_authorized', async () => {
    const api = await demo();
    const sauger = await M(api, 'M-0007');
    await as(api, 'ana');
    assert.deepEqual(await api.listMachines(), []);
    assert.equal(await api.getMachine(sauger.id), null);
    await rejects(api.checkoutMachine(sauger.id, {}), 'not_authorized');
    await rejects(api.moveStock(randomUUID(), { type: 'zugang', qty: 1 }), 'not_authorized');
    assert.equal((await api.getMyProfile()).full_name, 'Ana');
    assert.deepEqual((await api.listProfiles()).map((p) => p.full_name), ['Ana']);
    await api.signOut();
    assert.equal(await api.getSession(), null);
    assert.equal(await api.getMyProfile(), null);
    await rejects(api.listMachines(), 'not_authorized');
  });

  test('Mitarbeiter verwalten: letzter Admin bleibt, Freigabe, eigenes Profil', async () => {
    const api = await demo();
    await rejects(api.adminUpdateProfile(U.cristian, { role: 'mitarbeiter' }), 'last_admin');
    await rejects(api.adminUpdateProfile(U.cristian, { active: false }), 'last_admin');
    await rejects(api.adminUpdateProfile(U.ana, { role: 'chef' }), 'invalid_role');
    const ana = await api.adminUpdateProfile(U.ana, { active: true });
    assert.deepEqual([ana.active, ana.role, ana.full_name], [true, 'mitarbeiter', 'Ana']);
    await as(api, 'ana');
    assert.equal((await api.listMachines()).length, 7);
    await rejects(api.adminUpdateProfile(U.daniel, { active: false }), 'not_authorized');
    await rejects(api.updateMyProfile({ lang: 'fr' }), 'invalid_lang');
    await rejects(api.updateMyProfile({ full_name: ' ' }), 'name_required');
    const p = await api.updateMyProfile({ lang: 'es' });
    assert.deepEqual([p.full_name, p.lang], ['Ana', 'es']);
  });
});

describe('Stammdaten', () => {
  test('Codes: fortlaufend, unveränderlich, eindeutig; Bestand nur bei neu', async () => {
    const api = await demo();
    await as(api, 'luca');
    const m = await api.saveMachine({ name: 'Metabo Stichsäge STEB 65', status: 'reserviert', home_location_id: (await L(api, 'L-0005')).id });
    assert.equal(m.code, 'M-0008');
    assert.equal(m.status, 'reserviert');
    assert.equal(m.location_path, 'Hauptlager / Regal B');
    assert.equal(m.open_loan_id, null);
    await rejects(api.saveMachine({ id: m.id, code: 'M-0099', name: 'x' }), 'code_immutable');
    const same = await api.saveMachine({ ...m, code: ' m-0008 ', name: 'Metabo Stichsäge', status: 'defekt' });
    assert.equal(same.name, 'Metabo Stichsäge');
    assert.equal(same.status, 'reserviert', 'Status nur über setMachineStatus');
    await rejects(api.saveMachine({ name: 'Doppelt', code: 'M-0001' }), 'duplicate_code');
    await rejects(api.saveMachine({ name: 'Falsch', code: 'INV-0100' }), 'invalid_code');
    await rejects(api.saveMachine({ name: 'Falsch', code: 'M- 0100' }), 'invalid_code');
    await rejects(api.saveArticle({ name: 'Falsch', code: 'L-0100' }), 'invalid_code');
    await rejects(api.saveMachine({ name: 'Falsch', status: 'ausgeliehen' }), 'invalid_status');
    await rejects(api.saveMachine({ name: '  ' }), 'name_required');
    const a = await api.saveArticle({ name: 'Dübel 8 mm', stock: '25', min_stock: '10', unit: 'Stk' });
    assert.equal(a.code, 'INV-0007');
    assert.equal(a.stock, 25);
    const [anlage] = await api.listMovements({ articleId: a.id });
    assert.deepEqual([anlage.type, anlage.qty, anlage.user_name], ['anlage', 25, 'Luca']);
    const b = await api.saveArticle({ id: a.id, stock: 999, min_stock: '', color: 'Grau' });
    assert.deepEqual([b.stock, b.min_stock, b.color, b.low_stock], [25, null, 'Grau', false]);
    await rejects(api.saveArticle({ name: 'Minus', stock: -1 }), 'invalid_qty');
    const [upd] = await api.listAudit({ entity: 'article', entityId: a.id, limit: 1 });
    assert.equal(upd.action, 'update');
    assert.deepEqual(upd.details.color, { alt: null, neu: 'Grau' });
  });

  test('Lagerorte: Hierarchie und Zyklusprüfung', async () => {
    const api = await demo();
    await as(api, 'luca');
    const hl = await L(api, 'L-0001');
    const box = await L(api, 'L-0004');
    const regalB = await L(api, 'L-0005');
    await rejects(api.saveLocation({ id: hl.id, parent_id: box.id }), 'location_cycle');
    await rejects(api.saveLocation({ id: hl.id, parent_id: hl.id }), 'location_cycle');
    await rejects(api.saveLocation({ name: 'X', parent_id: randomUUID() }), 'invalid_location');
    await rejects(api.saveLocation({ name: 'X', type: 'garage' }), 'invalid_type');
    const fach = await api.saveLocation({ name: 'Fach 01', type: 'fach', parent_id: regalB.id });
    assert.deepEqual([fach.code, fach.path, fach.depth], ['L-0011', 'Hauptlager / Regal B / Fach 01', 2]);
    const moved = await api.saveLocation({ id: fach.id, parent_id: (await L(api, 'L-0006')).id });
    assert.equal(moved.path, 'Büro / Fach 01');
  });
});

describe('Inventur', () => {
  test('zählen, prüfen, abschliessen mit Buchung', async () => {
    const api = await demo();
    const cat = await A(api, 'INV-0001');
    const sauger = await M(api, 'M-0007');
    await as(api, 'luca');
    const inv = await api.createInventory({ name: 'Inventur Test', note: 'Büro' });
    assert.equal(inv.status, 'offen');
    await rejects(api.createInventory({ name: ' ' }), 'name_required');
    await as(api, 'daniel');
    await rejects(api.countArticle(inv.id, cat.id, -1), 'invalid_qty');
    const c = await api.countArticle(inv.id, cat.id, 10);
    assert.deepEqual([c.expected, c.counted, c.counted_by], [13, 10, U.daniel]);
    await rejects(api.checkMachine(inv.id, sauger.id, 'kaputt'), 'invalid_status');
    await api.checkMachine(inv.id, sauger.id, 'fehlt', 'Nicht auffindbar');
    await rejects(api.closeInventory(inv.id, true), 'not_authorized');
    await as(api, 'luca');
    const closed = await api.closeInventory(inv.id, true);
    assert.deepEqual([closed.status, closed.applied, closed.closed_by], ['abgeschlossen', true, U.luca]);
    assert.equal((await A(api, 'INV-0001')).stock, 10);
    const [mv] = await api.listMovements({ articleId: cat.id, limit: 1 });
    assert.deepEqual([mv.type, mv.qty, mv.note], ['inventur', -3, 'Inventur: Inventur Test']);
    assert.equal((await M(api, 'M-0007')).status, 'verloren');
    await rejects(api.countArticle(inv.id, cat.id, 1), 'inventory_closed');
    await rejects(api.closeInventory(inv.id, false), 'inventory_closed');
    const full = await api.getInventory(inv.id);
    assert.equal(full.counts.length, 1);
    assert.equal(full.counts[0].applied, true);
    assert.equal(full.checks[0].result, 'fehlt');
    assert.equal(await api.getInventory(randomUUID()), null);
  });
});

describe('Fotos und Dokumente', () => {
  const png = (n = 64) => new Blob([new Uint8Array(n).fill(7)], { type: 'image/png' });

  test('hochladen ohne createImageBitmap (Original), Hauptfoto, Rechte beim Löschen', async () => {
    const api = await demo();
    const sauger = await M(api, 'M-0007');
    assert.equal(sauger.photo_path, null);
    await as(api, 'daniel');
    const a = await api.uploadAttachment('machine', sauger.id, png());
    assert.deepEqual([a.kind, a.is_primary, a.uploaded_by, a.mime], ['photo', true, U.daniel, 'image/png']);
    assert.ok(a.path.startsWith(`machine/${sauger.id}/`) && a.path.endsWith('.png'));
    const urls = await api.fileUrls([a.path, 'gibt/es/nicht.jpg']);
    assert.ok(urls.get(a.path).startsWith('data:image/png;base64,'));
    assert.equal(urls.has('gibt/es/nicht.jpg'), false);
    assert.equal((await M(api, 'M-0007')).photo_path, a.path);
    const doc = await api.uploadAttachment('machine', sauger.id, new Blob(['Handbuch'], { type: 'text/plain' }), { note: 'Anleitung' });
    assert.equal(doc.kind, 'document');
    await rejects(api.uploadAttachment('machine', sauger.id, new Blob([new Uint8Array(2 * 1024 * 1024)], { type: 'application/pdf' })), 'file_too_large');
    await rejects(api.uploadAttachment('kunde', sauger.id, png()), 'invalid_entity');

    await as(api, 'luca');
    const b = await api.uploadAttachment('machine', sauger.id, png(), { kind: 'photo' });
    assert.equal(b.is_primary, false);
    await as(api, 'daniel');
    await rejects(api.deleteAttachment(b), 'not_authorized');
    await rejects(api.setPrimaryAttachment(b.id), 'not_authorized');
    await api.deleteAttachment(doc.id);       // eigene Datei innerhalb 1 h
    await as(api, 'luca');
    await api.setPrimaryAttachment(b.id);
    const list = await api.listAttachments('machine', sauger.id);
    assert.deepEqual(list.map((x) => x.id), [b.id, a.id]);
    assert.equal((await M(api, 'M-0007')).photo_path, b.path);
    await api.deleteAttachment(a);
    assert.equal((await api.fileUrls([a.path])).size, 0);
  });

  test('Bilder werden verkleinert (createImageBitmap/OffscreenCanvas simuliert)', async () => {
    const api = await demo();
    const sauger = await M(api, 'M-0007');
    let canvasSize = null;
    globalThis.createImageBitmap = async () => ({ width: 4000, height: 3000, close() {} });
    globalThis.OffscreenCanvas = class {
      constructor(w, h) { this.width = w; this.height = h; canvasSize = [w, h]; }
      getContext() { return { fillStyle: '', fillRect() {}, drawImage() {} }; }
      async convertToBlob(o) { return new Blob([new Uint8Array(100)], { type: o.type }); }
    };
    try {
      const f = new Blob([new Uint8Array(5000)], { type: 'image/heic' });
      f.name = 'IMG_0001.HEIC';
      const a = await api.uploadAttachment('machine', sauger.id, f);
      assert.deepEqual(canvasSize, [800, 600]);
      assert.equal(a.mime, 'image/jpeg');
      assert.equal(a.file_name, 'IMG_0001.jpg');
      assert.equal(a.size_bytes, 100);
      assert.ok(a.path.endsWith('.jpg'));
    } finally {
      delete globalThis.createImageBitmap;
      delete globalThis.OffscreenCanvas;
    }
  });
});

describe('Anmeldung (Demo)', () => {
  test('Benutzer wechseln, abmelden, anmelden, registrieren', async () => {
    const api = await demo();
    const seen = [];
    const off = api.onAuthChange((e, s) => seen.push([e, s && s.userId]));
    await as(api, 'luca');
    await tick();
    assert.deepEqual(seen, [['SIGNED_IN', U.luca]]);
    await api.signOut();
    await tick();
    assert.deepEqual(seen.at(-1), ['SIGNED_OUT', null]);
    await rejects(api.signIn('niemand@example.com', 'x'), 'auth_invalid');
    const s = await api.signIn(' LUCA@example.com ', 'beliebig');
    assert.equal(s.userId, U.luca);
    await rejects(api.signUp({ fullName: 'Luca 2', email: 'luca@example.com', password: 'geheim123' }), 'auth_exists');
    await rejects(api.signUp({ fullName: 'Neu', email: 'neu@example.com', password: '123' }), 'weak_password');
    await rejects(api.signUp({ fullName: 'Neu', email: 'kein-mail', password: 'geheim123' }), 'invalid_email');
    const r = await api.signUp({ fullName: 'Marco Neu', email: 'marco@example.com', password: 'geheim123', lang: 'pt' });
    assert.deepEqual(r, { needsConfirmation: false });
    const me = await api.getMyProfile();
    assert.deepEqual([me.full_name, me.role, me.active, me.lang], ['Marco Neu', 'mitarbeiter', false, 'pt']);
    await rejects(api.updatePassword('kurz'), 'weak_password');
    await api.updatePassword('neuesPasswort');
    await api.signOut();
    await rejects(api.signIn('marco@example.com', 'geheim123'), 'auth_invalid');
    await api.signIn('marco@example.com', 'neuesPasswort');
    await api.resetPassword('marco@example.com');
    await rejects(api.demoSwitchUser(randomUUID()), 'not_found');
    await tick();
    assert.deepEqual(seen.map((x) => x[0]),
      ['SIGNED_IN', 'SIGNED_OUT', 'SIGNED_IN', 'SIGNED_IN', 'USER_UPDATED', 'SIGNED_OUT', 'SIGNED_IN']);
    off();
    const before = seen.length;
    await api.signOut();         // Ereignis wird nach off() nicht mehr zugestellt
    await api.signIn('luca@example.com', 'x');
    await as(api, 'cristian');
    await tick();
    assert.equal(seen.length, before, 'abgemeldeter Rückruf');
  });
});

describe('Speicher', () => {
  test('Daten bleiben im localStorage; defekter Speicher → im Speicher weiter', async () => {
    const storage = new MemoryStorage();
    const a = fresh(storage);
    await a.init();
    await as(a, 'daniel');
    const cat = await A(a, 'INV-0002');
    await a.moveStock(cat.id, { type: 'entnahme', qty: 2 });
    const b = fresh(storage);
    assert.equal((await A(b, 'INV-0002')).stock, cat.stock - 2);
    assert.equal((await b.getSession()).userId, U.daniel);

    const broken = { getItem() { throw new Error('gesperrt'); }, setItem() { throw new Error('voll'); }, removeItem() {} };
    const warn = console.warn;
    console.warn = () => {};
    try {
      const c = createApi({ LgrError, storage: broken });
      await c.init();
      const m = await c.saveMachine({ name: 'Testgerät' });
      assert.equal((await c.getMachine(m.id)).name, 'Testgerät');
    } finally { console.warn = warn; }

    const bad = new MemoryStorage();
    bad.setItem(STORAGE_KEY, '{kaputt');
    const d = fresh(bad);
    assert.equal((await d.listMachines()).length, 7);

    const mem = createApi({ LgrError, storage: null });
    assert.equal((await mem.listArticles()).length, 6);
  });

  test('Demo zurücksetzen', async () => {
    const api = await demo();
    await api.saveMachine({ name: 'Wird verworfen' });
    await api.demoReset();
    assert.equal((await api.listMachines()).length, 7);
  });
});

// =============================================================================================
//  Teil 2: Supabase-Implementierung mit Ersatz-Client
// =============================================================================================
const hasHooks = typeof nodeModule.registerHooks === 'function';

describe('Supabase-Implementierung (Ersatz-Client)', { skip: !hasHooks && 'module.registerHooks fehlt' }, () => {
  let createSupabaseApi;
  let PUBLIC_BASE_URL;
  before(async () => {
    ({ createApi: createSupabaseApi } = await import('../js/api-supabase.js'));
    ({ PUBLIC_BASE_URL } = await import('../js/config.js'));
  });
  const ME = '11111111-1111-4111-8111-111111111111';
  const ID = '22222222-2222-4222-8222-222222222222';

  function fakeClient(handler) {
    const calls = [];
    const authCbs = [];
    const run = (op) => { calls.push(op); return Promise.resolve().then(() => handler(op) || { data: null, error: null }); };
    const builder = (table) => {
      const op = { table, method: 'select', filters: [], order: [], payload: undefined, columns: undefined, limit: null, range: null, single: null };
      const b = {
        select(cols) { op.columns = cols; return b; },
        insert(p) { op.method = 'insert'; op.payload = p; return b; },
        update(p) { op.method = 'update'; op.payload = p; return b; },
        delete() { op.method = 'delete'; return b; },
        eq(c, v) { op.filters.push(['eq', c, v]); return b; },
        is(c, v) { op.filters.push(['is', c, v]); return b; },
        not(c, o, v) { op.filters.push(['not', c, o, v]); return b; },
        gte(c, v) { op.filters.push(['gte', c, v]); return b; },
        lte(c, v) { op.filters.push(['lte', c, v]); return b; },
        order(c, o) { op.order.push([c, o && o.ascending === false ? 'desc' : 'asc']); return b; },
        limit(n) { op.limit = n; return b; },
        range(a, z) { op.range = [a, z]; return b; },
        maybeSingle() { op.single = 'maybe'; return b; },
        single() { op.single = 'single'; return b; },
        then(res, rej) { return run(op).then(res, rej); },
      };
      return b;
    };
    return {
      calls,
      emit: (event, session) => authCbs.forEach((cb) => cb(event, session)),
      from: builder,
      rpc: (fn, args) => ({ then: (res, rej) => run({ rpc: fn, args }).then(res, rej) }),
      storage: {
        from: (bucket) => ({
          upload: (path, body, opts) => run({ storage: 'upload', bucket, path, body, opts }),
          remove: (paths) => run({ storage: 'remove', bucket, paths }),
          createSignedUrls: (paths, ttl) => run({ storage: 'sign', bucket, paths, ttl }),
        }),
      },
      auth: {
        onAuthStateChange(cb) { authCbs.push(cb); return { data: { subscription: { unsubscribe() {} } } }; },
        getSession: async () => ({ data: { session: { user: { id: ME, email: 'me@example.com' } } }, error: null }),
        signInWithPassword: (args) => run({ auth: 'signIn', args }),
        signUp: (args) => run({ auth: 'signUp', args }),
        signOut: (args) => run({ auth: 'signOut', args }),
        resetPasswordForEmail: (email, opts) => run({ auth: 'reset', email, opts }),
        updateUser: (args) => run({ auth: 'updateUser', args }),
      },
    };
  }
  const make = (handler) => { const client = fakeClient(handler); return { client, api: createSupabaseApi({ LgrError, client }) }; };

  test('alle Vertragsmethoden vorhanden, Modus supabase', () => {
    const { api } = make(() => {});
    assert.equal(api.mode, 'supabase');
    for (const m of API_METHODS) assert.equal(typeof api[m], 'function', m);
  });

  test('Fehlerzuordnung', () => {
    const { api } = make(() => {});
    const map = (e) => { const r = api._mapError(e); return r.detail ? `${r.code}:${r.detail}` : r.code; };
    assert.equal(map({ code: 'P0001', message: 'LGR:not_available:ausgeliehen' }), 'not_available:ausgeliehen');
    assert.equal(map({ code: 'P0001', message: 'LGR:note_required' }), 'note_required');
    assert.equal(map({ code: '42501', message: 'permission denied for table machines' }), 'not_authorized');
    assert.equal(map({ code: '42501', message: 'new row violates row-level security policy for table "machines"' }), 'not_authorized');
    assert.equal(map({ code: '23505', message: 'duplicate key value violates unique constraint "machines_code_key"', details: 'Key (code)=(M-0001) already exists.' }), 'duplicate_code');
    assert.equal(map({ code: '23503', message: 'update or delete on table "machines" violates foreign key constraint "loans_machine_id_fkey" on table "loans"' }), 'in_use');
    assert.equal(map({ code: '23503', message: 'insert or update on table "articles" violates foreign key constraint "articles_location_id_fkey"' }), 'invalid_location');
    assert.equal(map({ code: '23514', message: 'new row for relation "articles" violates check constraint "articles_stock_check"' }), 'invalid_qty');
    assert.equal(map({ code: '23514', message: 'new row for relation "locations" violates check constraint "locations_name_check"' }), 'name_required');
    assert.equal(map({ code: '23514', message: 'new row for relation "loans" violates check constraint "loans_dates_chk"' }), 'invalid_dates');
    assert.equal(map({ code: '22P02', message: 'invalid input syntax for type uuid: "abc"' }), 'not_found');
    assert.equal(map({ code: '', message: 'TypeError: Failed to fetch', details: 'TypeError: Failed to fetch' }).split(':')[0], 'network');
    assert.equal(map(new TypeError('Load failed')).split(':')[0], 'network');
    assert.equal(map({ __isAuthError: true, name: 'AuthApiError', status: 400, code: 'invalid_credentials', message: 'Invalid login credentials' }), 'auth_invalid');
    assert.equal(map({ __isAuthError: true, name: 'AuthApiError', status: 422, code: 'user_already_exists', message: 'User already registered' }), 'auth_exists');
    assert.equal(map({ __isAuthError: true, name: 'AuthWeakPasswordError', status: 422, code: 'weak_password', message: 'Password should be at least 6 characters.' }), 'weak_password');
    assert.equal(map({ __isAuthError: true, name: 'AuthRetryableFetchError', status: 0, message: 'Failed to fetch' }).split(':')[0], 'network');
    assert.equal(map({ __isAuthError: true, name: 'AuthApiError', status: 400, code: 'email_not_confirmed', message: 'Email not confirmed' }), 'email_not_confirmed');
    assert.equal(map({ name: 'StorageApiError', status: 400, statusCode: '403', message: 'new row violates row-level security policy' }), 'not_authorized');
    assert.ok(api._mapError({ code: 'P0001', message: 'LGR:reserved' }) instanceof LgrError);
  });

  test('Ausleihen: RPC-Parameter und LGR-Fehler', async () => {
    let answer = { data: { id: ID }, error: null };
    const { client, api } = make((op) => (op.rpc ? answer : null));
    const loan = await api.checkoutMachine(ID, { requestId: ME, dueAt: '2099-01-31T17:00', note: ' Baustelle ' });
    assert.equal(loan.id, ID);
    const call = client.calls.at(-1);
    assert.equal(call.rpc, 'machine_checkout');
    assert.deepEqual(Object.keys(call.args).sort(), ['p_borrower', 'p_due', 'p_machine', 'p_note', 'p_request']);
    assert.equal(call.args.p_note, 'Baustelle');
    assert.equal(call.args.p_borrower, null);
    assert.equal(call.args.p_due, new Date(2099, 0, 31, 17, 0).toISOString());
    answer = { data: null, error: { code: 'P0001', message: 'LGR:not_available:defekt', details: null, hint: null } };
    await rejects(api.checkoutMachine(ID, {}), 'not_available', 'defekt');
    answer = { data: null, error: { code: 'P0001', message: 'LGR:note_required' } };
    await rejects(api.returnMachine(ID, { condition: 'defekt' }), 'note_required');
    assert.deepEqual(client.calls.at(-1).args, { p_machine: ID, p_request: null, p_condition: 'defekt', p_note: null });
    await rejects(api.checkoutMachine('M-0001', {}), 'not_found');
  });

  test('Speichern: nur erlaubte Spalten, kein Bestand/Code/Status im Update, 0 Zeilen → not_authorized', async () => {
    let updateRows = [{ id: ID }];
    const { client, api } = make((op) => {
      if (op.table === 'articles' && op.method === 'select' && op.columns === 'code') return { data: { code: 'INV-0001' }, error: null };
      if (op.table === 'articles' && op.method === 'select' && op.columns === 'id') return { data: { id: ID }, error: null };
      if (op.table === 'articles' && op.method === 'update') return { data: updateRows, error: null };
      if (op.table === 'article_overview') return { data: { id: ID, code: 'INV-0001', stock: 5 }, error: null };
      return null;
    });
    const row = await api.saveArticle({
      id: ID, code: 'inv-0001', name: ' Patchkabel ', stock: 99, min_stock: '3,5', color: '', location_id: '',
      location_path: 'Büro', low_stock: true, photo_path: null, archived: 0,
    });
    assert.equal(row.code, 'INV-0001');
    const upd = client.calls.find((c) => c.method === 'update');
    assert.deepEqual(upd.payload, { name: 'Patchkabel', color: null, min_stock: 3.5, location_id: null, archived: false });
    assert.deepEqual(upd.filters, [['eq', 'id', ID]]);
    await rejects(api.saveArticle({ id: ID, code: 'INV-0002', name: 'x' }), 'code_immutable');
    updateRows = [];
    await rejects(api.saveArticle({ id: ID, name: 'x' }), 'not_authorized');
    await rejects(api.saveArticle({ name: '' }), 'name_required');
    await rejects(api.saveMachine({ name: 'x', code: 'L-0001' }), 'invalid_code');
  });

  test('Neue Maschine: Code normalisiert, Status erlaubt, Rückgabe = Übersichtszeile', async () => {
    const { client, api } = make((op) => {
      if (op.table === 'machines' && op.method === 'insert') return { data: { id: ID }, error: null };
      if (op.table === 'machine_overview') return { data: { id: ID, code: 'M-0042', location_path: 'Büro' }, error: null };
      return null;
    });
    const m = await api.saveMachine({ name: 'Stichsäge', code: ' m-0042 ', status: 'reserviert', condition: '', serial_no: ' ' });
    assert.equal(m.location_path, 'Büro');
    const ins = client.calls.find((c) => c.method === 'insert');
    assert.deepEqual(ins.payload, { code: 'M-0042', name: 'Stichsäge', serial_no: null, status: 'reserviert' });
  });

  test('Löschen: 0 Zeilen, Fremdschlüssel → in_use', async () => {
    let del = { data: [], error: null };
    const { api } = make((op) => {
      if (op.method === 'delete' && op.table === 'machines') return del;
      if (op.method === 'select' && op.table === 'machines') return { data: { id: ID }, error: null };
      if (op.method === 'delete' && op.table === 'attachments') return { data: [], error: null };
      return null;
    });
    await rejects(api.deleteMachine(ID), 'not_authorized');
    del = { data: null, error: { code: '23503', message: 'update or delete on table "machines" violates foreign key constraint "loans_machine_id_fkey" on table "loans"' } };
    await rejects(api.deleteMachine(ID), 'in_use');
    del = { data: [{ id: ID }], error: null };
    await api.deleteMachine(ID);
  });

  test('Ausleihen-Liste: Filter, Reihenfolge, Standardlimit', async () => {
    const { client, api } = make(() => ({ data: [], error: null }));
    await api.listLoans({ machineId: ID, open: true, from: '2026-11-01', to: '2026-11-06' });
    let c = client.calls.at(-1);
    assert.equal(c.table, 'loan_overview');
    assert.deepEqual(c.filters, [
      ['eq', 'machine_id', ID], ['is', 'returned_at', null],
      ['gte', 'checked_out_at', new Date(2026, 10, 1).toISOString()],
      ['lte', 'checked_out_at', new Date(2026, 10, 6, 23, 59, 59, 999).toISOString()],
    ]);
    assert.deepEqual(c.order[0], ['checked_out_at', 'desc']);
    assert.equal(c.limit, 200);
    await api.listLoans({ open: false, limit: 5 });
    c = client.calls.at(-1);
    assert.deepEqual(c.filters, [['not', 'returned_at', 'is', null]]);
    assert.equal(c.limit, 5);
  });

  test('Ausleihe korrigieren: fehlende Felder werden aus der Ausleihe übernommen', async () => {
    const { client, api } = make((op) => {
      if (op.table === 'loans') return { data: { checked_out_at: '2026-11-01T07:00:00+00:00', due_at: null, returned_at: '2026-11-01T16:00:00+00:00' }, error: null };
      if (op.rpc) return { data: { id: ID }, error: null };
      return null;
    });
    await api.correctLoan(ID, { due_at: '2026-11-02T12:00:00Z', reason: 'Tippfehler' });
    assert.deepEqual(client.calls.at(-1).args, {
      p_loan: ID, p_checked_out_at: '2026-11-01T07:00:00+00:00', p_due_at: '2026-11-02T12:00:00.000Z',
      p_returned_at: '2026-11-01T16:00:00+00:00', p_reason: 'Tippfehler',
    });
  });

  test('signierte URLs: ein Aufruf für dieselben Pfade (Zwischenspeicher, gleichzeitige Anfragen)', async () => {
    let signCalls = 0;
    const { api } = make((op) => {
      if (op.storage === 'sign') {
        signCalls++;
        return { data: op.paths.map((p) => ({ path: p, signedUrl: `https://x.test/${p}?token=1`, error: null })), error: null };
      }
      return null;
    });
    const [m1, m2] = await Promise.all([api.fileUrls(['a/1.jpg', 'a/2.jpg']), api.fileUrls(['a/1.jpg'])]);
    const m3 = await api.fileUrls(['a/2.jpg', 'a/1.jpg', null, '']);
    assert.equal(signCalls, 1);
    assert.equal(m1.get('a/1.jpg'), 'https://x.test/a/1.jpg?token=1');
    assert.equal(m2.get('a/1.jpg'), m1.get('a/1.jpg'));
    assert.equal(m3.size, 2);
  });

  test('Registrierung: Metadaten, Weiterleitung, bestehendes Konto', async () => {
    let answer = { data: { user: { id: ME, identities: [{}] }, session: null }, error: null };
    const { client, api } = make((op) => (op.auth === 'signUp' ? answer : null));
    const r = await api.signUp({ fullName: ' Marco ', email: ' marco@example.com ', password: 'geheim123', lang: 'pt' });
    assert.deepEqual(r, { needsConfirmation: true });
    const call = client.calls.at(-1).args;
    assert.equal(call.email, 'marco@example.com');
    assert.deepEqual(call.options, { data: { full_name: 'Marco', lang: 'pt' }, emailRedirectTo: PUBLIC_BASE_URL });
    answer = { data: { user: { id: ME, identities: [] }, session: null }, error: null };
    await rejects(api.signUp({ fullName: 'M', email: 'm@example.com', password: 'geheim123' }), 'auth_exists');
    answer = { data: { user: null, session: null }, error: { __isAuthError: true, name: 'AuthWeakPasswordError', status: 422, code: 'weak_password', message: 'weak' } };
    await rejects(api.signUp({ fullName: 'M', email: 'm@example.com', password: '1' }), 'weak_password');
  });

  test('Anmeldeereignisse: nur echte Wechsel, Passwort-Wiederherstellung wird nachgereicht', async () => {
    const { client, api } = make(() => null);
    const s = (id) => ({ user: { id, email: `${id}@x.test` } });
    client.emit('PASSWORD_RECOVERY', s(ME));          // vor der Anmeldung eines Rückrufs (beim Seitenladen)
    client.emit('INITIAL_SESSION', s(ME));
    const seen = [];
    api.onAuthChange((e, sess) => seen.push([e, sess && sess.userId]));
    await tick();
    assert.deepEqual(seen, [['PASSWORD_RECOVERY', ME]]);
    client.emit('SIGNED_IN', s(ME));                  // Tab wieder aktiv: gleicher Benutzer → ignorieren
    client.emit('TOKEN_REFRESHED', s(ME));
    client.emit('SIGNED_IN', s(ID));
    client.emit('SIGNED_OUT', null);
    await tick();
    assert.deepEqual(seen.slice(1), [['SIGNED_IN', ID], ['SIGNED_OUT', null]]);
  });

  test('Upload: Pfad, Hauptfoto, Aufräumen bei Fehler', async () => {
    let insertError = null;
    const { client, api } = make((op) => {
      if (op.storage === 'upload') return { data: { path: op.path }, error: null };
      if (op.table === 'attachments' && op.method === 'select') return { data: [], error: null };
      if (op.table === 'attachments' && op.method === 'insert') return insertError ? { data: null, error: insertError } : { data: { id: ID, ...op.payload }, error: null };
      return null;
    });
    const file = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
    file.name = 'Handbuch.PDF';
    const a = await api.uploadAttachment('machine', ID, file, { note: 'Anleitung' });
    assert.match(a.path, new RegExp(`^machine/${ID}/[0-9a-f-]{36}\\.pdf$`));
    assert.deepEqual([a.kind, a.mime, a.file_name, a.note], ['document', 'application/pdf', 'Handbuch.PDF', 'Anleitung']);
    // Hauptfoto bestimmt der Server – der Client schickt is_primary nie mit
    const inserts = () => client.calls.filter((c) => c.table === 'attachments' && c.method === 'insert');
    assert.ok(inserts().every((c) => !('is_primary' in c.payload)));
    const up = client.calls.find((c) => c.storage === 'upload');
    assert.equal(up.bucket, 'media');
    assert.equal(up.opts.contentType, 'application/pdf');
    const img = await api.uploadAttachment('article', ID, new Blob([new Uint8Array(10)], { type: 'image/png' }));
    assert.equal(img.kind, 'photo');
    assert.ok(inserts().every((c) => !('is_primary' in c.payload)));
    // HTML/SVG werden gar nicht erst hochgeladen
    const before = client.calls.length;
    await rejects(api.uploadAttachment('machine', ID, new Blob(['<script>'], { type: 'text/html' })), 'file_type');
    await rejects(api.uploadAttachment('machine', ID, new Blob(['<svg/>'], { type: 'image/svg+xml' })), 'file_type');
    assert.equal(client.calls.length, before);
    insertError = { code: '42501', message: 'new row violates row-level security policy for table "attachments"' };
    await rejects(api.uploadAttachment('machine', ID, file), 'not_authorized');
    assert.equal(client.calls.at(-1).storage, 'remove');
  });
});
