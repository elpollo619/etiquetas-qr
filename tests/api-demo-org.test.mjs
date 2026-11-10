// Tests für «Lager organisieren» im Demo-Modus (js/api-demo-org.js + Erweiterungen in js/api-demo.js).
// Die Szenarien entsprechen tests/org.test.mjs (SQL): das Demo muss sich gleich verhalten (Regeln, Rechte, Fehlercodes).
// Ausführen (im Ordner web/tests):  node --test
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { createApi, DEMO_USER_IDS as U, STORAGE_KEY } from '../js/api-demo.js';
import { START_CATEGORIES, ORG_TABLES } from '../js/api-demo-org.js';

class LgrError extends Error {
  constructor(code, detail = null) { super(detail ? `${code}: ${detail}` : code); this.name = 'LgrError'; this.code = code; this.detail = detail ?? null; }
}
class MemoryStorage {
  constructor() { this.map = new Map(); }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
  clear() { this.map.clear(); }
}

const fresh = (storage = new MemoryStorage()) => createApi({ LgrError, storage });
async function demo() { const api = fresh(); await api.init(); return api; }
const as = (api, key) => api.demoSwitchUser(U[key]);
async function rejects(promise, code, detail) {
  await assert.rejects(promise, (e) => {
    assert.ok(e instanceof LgrError, `LgrError erwartet, erhalten: ${e && e.stack}`);
    assert.equal(e.code, code, `Code ${code} erwartet, erhalten ${e.code} (${e.message})`);
    if (detail !== undefined) assert.equal(e.detail, detail);
    return true;
  });
}
const sha = (n) => String(n).padStart(64, 'a').slice(-64).replace(/[^0-9a-f]/g, 'b');   // wie org.test.mjs
const jpeg = (name, n = 1) => new File([new Uint8Array([0xff, 0xd8, n, n + 1, 7])], name, { type: 'image/jpeg' });
const png = (name, n = 1) => new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, n])], name, { type: 'image/png' });
const auditOf = async (api, action) => (await api.listAudit({ limit: 100000 })).filter((r) => r.action === action);

// Startkategorien aus supabase/schema.sql (DO-Block «Startkategorien») – das Demo muss exakt dieselbe Liste haben
const SCHEMA = await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8');
const SQL_TREE = JSON.parse(/v_tree jsonb := '(\[[\s\S]*?\])';/.exec(SCHEMA)[1]);
function assertSeedCategories(rows) {
  const expected = [];
  SQL_TREE.forEach(([top, subs], i) => {
    expected.push([top, (i + 1) * 10, 0]);
    subs.forEach((s, j) => expected.push([`${top} › ${s}`, (j + 1) * 10, 1]));
  });
  assert.deepEqual(rows.map((c) => [c.path, c.sort, c.depth]), expected);
}

// =============================================================================================
describe('Speicher-Migration und Startdaten', () => {
  test('Startkategorien = SQL-Seed; neue Demo ohne Fotos, Erkennungen und Aufgaben', async () => {
    assert.deepEqual(START_CATEGORIES.map(([t, s]) => [t, [...s]]), SQL_TREE);
    const api = await demo();
    assert.deepEqual(api._seedErrors, []);
    const cats = await api.listCategories();
    assertSeedCategories(cats);
    assert.ok(cats.every((c) => c.created_by === null && c.archived === false));
    assert.deepEqual(await api.listPhotos(), []);
    assert.deepEqual(await api.listDetections(), []);
    assert.deepEqual(await api.listTasks(), []);
    const st = await api.orgStats();
    assert.deepEqual([st.photos_total, st.detections_total, st.tasks_open, st.sets_total], [0, 0, 0, 0]);
    assert.equal(st.machines_total, 7);
    assert.equal(st.articles_total, 6);
    assert.equal(st.loans_open, 2);
    assert.equal(st.spaces_total, 3);   // Hauptlager, Büro, Lieferwagen 1
    const spaces = await api.listSpaces();
    assert.deepEqual(spaces.map((s) => s.name), ['Büro', 'Hauptlager', 'Lieferwagen 1']);
    const hl = spaces.find((s) => s.name === 'Hauptlager');
    assert.deepEqual([hl.org_status, hl.progress, hl.sublocations, hl.machines, hl.articles], ['nicht_erfasst', 0, 4, 5, 4]);
  });

  test('Datenstand Version 1 wird übernommen: nichts geht verloren, neue Spalten leer, Kategorien angelegt', async () => {
    const storage = new MemoryStorage();
    const a = fresh(storage);
    await a.init();
    await as(a, 'daniel');
    const cat = await a.getArticleByCode('INV-0002');
    await a.moveStock(cat.id, { type: 'entnahme', qty: 3, note: 'vor der Migration' });
    await as(a, 'luca');
    const before = {
      machines: (await a.listMachines({ includeArchived: true })).map((m) => [m.code, m.status, m.location_path]),
      articles: (await a.listArticles({ includeArchived: true })).map((x) => [x.code, x.stock]),
      locations: (await a.listLocations({ includeArchived: true })).map((l) => [l.code, l.path]),
      loans: (await a.listLoans({ limit: 1000 })).length,
      movements: (await a.listMovements({ limit: 1000 })).length,
      inventories: (await a.listInventories()).length,
      audit: (await a.listAudit({ limit: 100000 })).length,
    };
    // Version 1 nachbilden: ohne neue Tabellen und Spalten
    const v3 = JSON.parse(storage.getItem(STORAGE_KEY));
    assert.equal(v3.version, 3);
    const v1 = JSON.parse(JSON.stringify(v3));
    v1.version = 1;
    for (const t of ORG_TABLES) delete v1[t];
    for (const l of v1.locations) for (const k of ['short_code', 'responsible_id', 'organized_at', 'organized_by', 'cover_photo_id']) delete l[k];
    for (const x of v1.articles) { delete x.category_id; delete x.product_url; }
    for (const m of v1.machines) for (const k of ['category_id', 'responsible_id', 'is_set', 'product_url']) delete m[k];
    for (const i of v1.inventories) delete i.location_id;
    delete v1.machine_supplies;   // Bedarf je Maschine gab es damals auch nicht
    storage.setItem(STORAGE_KEY, JSON.stringify(v1));

    const b = fresh(storage);
    assert.equal((await b.getSession()).userId, U.luca, 'Sitzung bleibt');
    assert.deepEqual((await b.listMachines({ includeArchived: true })).map((m) => [m.code, m.status, m.location_path]), before.machines);
    assert.deepEqual((await b.listArticles({ includeArchived: true })).map((x) => [x.code, x.stock]), before.articles);
    assert.deepEqual((await b.listLocations({ includeArchived: true })).map((l) => [l.code, l.path]), before.locations);
    assert.equal((await b.listLoans({ limit: 1000 })).length, before.loans);
    assert.equal((await b.listMovements({ limit: 1000 })).length, before.movements);
    assert.equal((await b.listInventories()).length, before.inventories);
    assert.equal((await b.listAudit({ limit: 100000 })).length, before.audit, 'Migration schreibt kein Protokoll');
    const loc = await b.getLocationByCode('L-0001');
    assert.deepEqual([loc.short_code, loc.code_path, loc.root_id, loc.responsible_id, loc.cover_photo_path, loc.organized_at],
      [null, null, loc.id, null, null, null]);
    const m = await b.getMachineByCode('M-0001');
    assert.deepEqual([m.is_set, m.component_count, m.category_id, m.category_path, m.product_url], [false, 0, null, null, null]);
    assert.ok(m.photo_path, 'Anhang-Foto bleibt');
    assert.equal((await b.listInventories())[0].location_id, null);
    assertSeedCategories(await b.listCategories());
    const stored = JSON.parse(storage.getItem(STORAGE_KEY));
    assert.equal(stored.version, 3, 'migrierter Stand gespeichert');
    for (const t of ORG_TABLES) assert.ok(Array.isArray(stored[t]), t);
    assert.deepEqual(stored.machine_supplies, [], 'Bedarf je Maschine: leere Tabelle ergänzt');
    assert.deepEqual(await b.listSupplies(), []);
    // erneut laden: keine doppelten Kategorien
    const c = fresh(storage);
    const again = await c.listCategories();
    assert.deepEqual(again.map((x) => x.id), (await b.listCategories()).map((x) => x.id));
  });
});

// =============================================================================================
describe('Lager organisieren (Ablauf wie tests/org.test.mjs)', () => {
  let api;
  const S = {};
  before(async () => {
    api = await demo();
    S.oldArt = await api.getArticleByCode('INV-0001');
    S.oldMach = await api.getMachineByCode('M-0001');
  });

  test('kategorien: Pfade, Rechte, Zyklus, Löschen nur ungenutzt (nur Admin)', async () => {
    await as(api, 'daniel');
    const cats = await api.listCategories();
    const kab = cats.find((c) => c.path === 'IT & Elektronik › Kabel & Adapter');
    assert.ok(kab, 'Pfad vorhanden');
    S.catKabel = kab.id;
    await rejects(api.saveCategory({ parent_id: kab.id, name: 'HDMI-Kabel' }), 'not_authorized');
    await as(api, 'luca');
    const hdmi = await api.saveCategory({ parent_id: kab.id, name: ' HDMI-Kabel ' });
    assert.deepEqual([hdmi.path, hdmi.depth, hdmi.name, hdmi.created_by, hdmi.root_id],
      ['IT & Elektronik › Kabel & Adapter › HDMI-Kabel', 2, 'HDMI-Kabel', U.luca, kab.root_id]);
    const tree = await api.listCategories();
    assert.equal(tree[tree.findIndex((c) => c.id === kab.id) + 1].id, hdmi.id, 'Baumreihenfolge');
    await rejects(api.saveCategory({ parent_id: kab.id, name: 'hdmi-kabel' }), 'duplicate', 'category');
    await rejects(api.saveCategory({ name: '  ' }), 'name_required');
    await rejects(api.saveCategory({ name: 'x'.repeat(81) }), 'name_required');
    const it = cats.find((c) => c.name === 'IT & Elektronik' && !c.parent_id);
    await rejects(api.saveCategory({ id: it.id, parent_id: hdmi.id }), 'category_cycle');
    await rejects(api.saveCategory({ id: it.id, parent_id: it.id }), 'category_cycle');
    // archiviert: ausgeblendet (Unterkategorien bleiben sichtbar), mit includeArchived sichtbar
    const kueche = cats.find((c) => c.name === 'Küche & Aufenthalt');
    await api.saveCategory({ id: kueche.id, archived: true });
    const visible = await api.listCategories();
    assert.ok(!visible.some((c) => c.id === kueche.id));
    assert.ok(visible.some((c) => c.path === 'Küche & Aufenthalt › Geräte'));
    assert.ok((await api.listCategories({ includeArchived: true })).some((c) => c.id === kueche.id));
    await api.saveCategory({ id: kueche.id, archived: false });
    // in Gebrauch → nicht löschbar
    await rejects(api.saveMachine({ id: S.oldMach.id, category_id: randomUUID() }), 'not_found');
    const m = await api.saveMachine({ id: S.oldMach.id, category_id: hdmi.id });
    assert.equal(m.category_path, hdmi.path);
    await rejects(api.deleteCategory(hdmi.id), 'not_authorized');
    await as(api, 'cristian');
    await rejects(api.deleteCategory(hdmi.id), 'in_use');
    await rejects(api.deleteCategory(kab.id), 'in_use', undefined);   // hat Unterkategorie
    await as(api, 'luca');
    await api.saveMachine({ id: S.oldMach.id, category_id: null });
    await as(api, 'cristian');
    await api.deleteCategory(hdmi.id);
    assert.ok(!(await api.listCategories()).some((c) => c.id === hdmi.id));
    const au = (await api.listAudit({ entity: 'categories', entityId: hdmi.id })).map((r) => r.action);
    assert.deepEqual(au, ['delete', 'insert']);
  });

  test('fotos: nur Lagerverantwortliche importieren, Status setzt der Server, Doppelimport verhindert', async () => {
    await as(api, 'luca');
    const space = await api.saveLocation({ name: 'Werkstatt', type: 'raum', short_code: ' ws ' });
    assert.deepEqual([space.short_code, space.code_path, space.root_id], ['WS', 'WS', space.id]);
    S.space = space;
    await as(api, 'daniel');
    await rejects(api.importPhoto(jpeg('IMG_1.jpeg'), { locationId: space.id, sha256: sha(1) }), 'not_authorized');
    await as(api, 'luca');
    await rejects(api.importPhoto(new File(['%PDF'], 'liste.pdf', { type: 'application/pdf' })), 'file_type', 'application/pdf');
    await rejects(api.importPhoto(jpeg('a.jpeg'), { sha256: 'xyz' }), 'invalid_file');
    await rejects(api.importPhoto(jpeg('a.jpeg'), { locationId: randomUUID() }), 'invalid_location');
    const r1 = await api.importPhoto(jpeg('IMG_1.jpeg'), { locationId: space.id, sha256: sha(1), folder: 'Werkstatt' });
    assert.equal(r1.duplicate, false);
    const p1 = r1.photo;
    assert.deepEqual([p1.status, p1.uploaded_by, p1.uploaded_by_name, p1.path, p1.root_id, p1.location_path, p1.folder, p1.detection_count],
      ['neu', U.luca, 'Luca', `photos/${sha(1)}.jpg`, space.id, 'Werkstatt', 'Werkstatt', 0]);
    assert.deepEqual([p1.observations, p1.recommendations, p1.analyzed_at], [[], [], null]);
    assert.ok((await api.fileUrls([p1.path])).get(p1.path).startsWith('data:image/jpeg;base64,'));
    const dup = await api.importPhoto(jpeg('Kopie.jpeg'), { locationId: space.id, sha256: sha(1).toUpperCase() });
    assert.deepEqual([dup.duplicate, dup.photo.id, dup.photo.file_name], [true, p1.id, 'IMG_1.jpeg']);
    const p2 = (await api.importPhoto(jpeg('IMG_2.jpeg', 2), { locationId: space.id, sha256: sha(2) })).photo;
    const p3 = (await api.importPhoto(jpeg('IMG_3.jpeg', 3), { locationId: space.id, sha256: sha(3) })).photo;
    S.p1 = p1; S.p2 = p2; S.p3 = p3;
    // SHA-256 der Originaldatei selbst berechnet (crypto.subtle), verschieben, löschen
    const f = jpeg('ohne-sha.jpeg', 42);
    const expected = createHash('sha256').update(Buffer.from(await f.arrayBuffer())).digest('hex');
    const r4 = await api.importPhoto(f);
    assert.deepEqual([r4.photo.sha256, r4.photo.location_id, r4.photo.root_id], [expected, null, null]);
    assert.equal((await api.movePhoto(r4.photo.id, space.id)).root_id, space.id);
    await rejects(api.movePhoto(r4.photo.id, randomUUID()), 'invalid_location');
    await api.deletePhoto(r4.photo);
    assert.equal((await api.listPhotos({ ids: [r4.photo.id] })).length, 0);
    assert.equal((await api.fileUrls([r4.photo.path])).size, 0, 'Datei entfernt');
    // vormerken
    assert.equal(await api.setPhotoStatus([p1.id, p2.id], 'in_analyse'), 2);
    assert.equal(await api.setPhotoStatus([p1.id], 'in_analyse'), 0, 'schon vorgemerkt');
    await rejects(api.setPhotoStatus([p1.id], 'analysiert'), 'invalid_status');
    const sp = (await api.listSpaces()).find((s) => s.id === space.id);
    assert.deepEqual([sp.org_status, sp.photos, sp.photos_queued, sp.code_path], ['in_analyse', 3, 2, 'WS']);
    await as(api, 'daniel');
    await rejects(api.setPhotoStatus([p1.id], 'neu'), 'not_authorized');
    assert.deepEqual((await api.listPhotos({ spaceId: space.id })).map((p) => p.file_name), ['IMG_1.jpeg', 'IMG_2.jpeg', 'IMG_3.jpeg']);
    assert.deepEqual((await api.listPhotos({ status: 'in_analyse' })).map((p) => p.id).sort(), [p1.id, p2.id].sort());
  });

  test('ki-import: Zuordnung über SHA-256, Kategorien, idempotent, Fehler und Unbekanntes gemeldet', async () => {
    const items = [
      { sha256: sha(1), file: 'IMG_1.jpeg', status: 'analysiert', scene: 'Werkbank mit Maschinen', area: 'Werkbank',
        observations: ['Kabel am Boden'], recommendations: ['Kabelhaken montieren'],
        objects: [
          { key: 'bosch-gbh-2-28', name: 'Bohrhammer Bosch GBH 2-28', kind: 'einzelinventar', category: 'Maschinen & Geräte > Bohrmaschinen & Bohrhämmer',
            brand: 'Bosch', model: 'GBH 2-28', quantity: 1, quantity_certain: true, confidence: 'sicher', pos: [0.4, 0.5],
            product: { url: 'https://www.bosch-professional.com/ch/de/', source: 'Hersteller' } },
          { key: 'schrauben-box', name: 'Schrauben (Sortiment)', kind: 'bestandsartikel', category: 'Bau- & Montagematerial > Befestigungsmaterial',
            quantity: 200, quantity_certain: false, unit: 'Stk', confidence: 'wahrscheinlich', pos: [2, 0.5] },
          { key: 'metallregal', name: 'Metallregal grau', kind: 'einrichtung', category: 'Büromöbel > Regale', confidence: 'sicher', quantity: 1, quantity_certain: true },
          { key: 'akku-schrauber', name: 'Akkuschrauber', kind: 'einzelinventar', quantity: 2, quantity_certain: true, confidence: 'wahrscheinlich' },
          { key: 'ding', name: 'Unklares Teil', confidence: 'unbekannt' },
          { key: '', name: 'ohne Schlüssel' },
        ] },
      { sha256: sha(2), file: 'IMG_2.jpeg', status: 'analysiert', scene: 'Gleiche Werkbank',
        objects: [{ key: 'bosch-gbh-2-28', name: 'Bohrhammer Bosch GBH 2-28', kind: 'einzelinventar', confidence: 'sicher', quantity: 1, quantity_certain: true }] },
      { sha256: sha(3), file: 'IMG_3.jpeg', status: 'fehler', error: 'Foto unscharf' },
      { sha256: sha(9), file: 'nicht-importiert.jpeg', status: 'analysiert', objects: [] },
    ];
    await as(api, 'daniel');
    await rejects(api.importAnalysis(items, 'Test'), 'not_authorized');
    await as(api, 'luca');
    await rejects(api.importAnalysis({ photos: items }, 'Test'), 'invalid_input');
    await rejects(api.importAnalysis(new Array(251).fill({}), 'Test'), 'too_many');
    const r = await api.importAnalysis(items, 'Claude (Test)');
    assert.equal(r.matched, 3);
    assert.equal(r.created, 6);
    assert.equal(r.failed, 1);
    assert.equal(r.invalid, 1);
    assert.equal(r.duplicates, 0);
    assert.deepEqual(r.unmatched, ['nicht-importiert.jpeg']);
    const again = await api.importAnalysis(items, 'Claude (Test)');
    assert.equal(again.created, 0);
    assert.equal(again.existing, 6);
    const p3 = (await api.listPhotos({ ids: [S.p3.id] }))[0];
    assert.deepEqual([p3.status, p3.analysis_error], ['fehler', 'Foto unscharf']);
    const dets = (await api.listDetections({ spaceId: S.space.id })).sort((a, b) => a.name.localeCompare(b.name));
    const by = (k) => dets.find((d) => d.obj_key === k);
    assert.equal(by('bosch-gbh-2-28').category_path, 'Maschinen & Geräte › Bohrmaschinen & Bohrhämmer');
    assert.equal(by('bosch-gbh-2-28').same_key_count, 1);
    assert.deepEqual([by('bosch-gbh-2-28').pos_x, by('bosch-gbh-2-28').pos_y, by('bosch-gbh-2-28').photo_path], [0.4, 0.5, S.p1.path]);
    assert.equal(by('schrauben-box').pos_x, null, 'ungültige Position verworfen');
    assert.equal(by('schrauben-box').quantity_certain, false);
    assert.equal(by('ding').kind, 'unbekannt');
    assert.deepEqual([by('ding').source, by('ding').status, by('ding').space_id], ['ki', 'offen', S.space.id]);
    const p1 = (await api.listPhotos({ ids: [S.p1.id] }))[0];
    assert.deepEqual([p1.status, p1.analysis_source, p1.observations, p1.detection_count, p1.open_count],
      ['analysiert', 'Claude (Test)', ['Kabel am Boden'], 5, 5]);
    await as(api, 'daniel');
    const stats = await api.orgStats();
    assert.equal(stats.photos_analyzed, 2);
    assert.equal(stats.photos_failed, 1);
    assert.equal(stats.detections_unknown, 1);
    assert.equal(stats.duplicate_groups, 1);
    assert.equal(stats.locations_proposed, 1);
    assert.equal(stats.detections_open, 6);
    const sp = (await api.listSpaces()).find((s) => s.id === S.space.id);
    assert.equal(sp.org_status, 'zu_pruefen');
    assert.equal(sp.progress, 0);
    await as(api, 'cristian');
    const imp = await auditOf(api, 'ki_import');
    assert.equal(imp.length, 4, 'je Import und analysiertem Foto ein Eintrag');
    assert.deepEqual(imp.find((x) => x.entity_id === S.p1.id && x.details.neue_objekte === 5).details,
      { quelle: 'Claude (Test)', datei: 'IMG_1.jpeg', neue_objekte: 5 });
    S.dets = dets;
  });

  test('prüfen: bestätigen erzeugt Inventar, unsichere Mengen nie als Bestand, gleiche Objekte verknüpft', async () => {
    const by = (k) => S.dets.find((d) => d.obj_key === k && d.photo_id === S.p1.id);
    await as(api, 'daniel');
    await rejects(api.reviewDetection(by('bosch-gbh-2-28').id, 'bestaetigen', {}), 'not_authorized');
    await as(api, 'luca');
    // Einzelinventar, sicher, 1 Stück → eine Maschine; das gleiche Objekt auf Foto 2 wird verknüpft
    const r1 = await api.reviewDetection(by('bosch-gbh-2-28').id, 'bestaetigen', {});
    assert.equal(r1.entity, 'machine');
    assert.equal(r1.codes.length, 1);
    assert.equal(r1.merged, 1);
    assert.equal(r1.detection.status, 'bestaetigt');
    assert.equal(r1.detection.reviewed_by, U.luca);
    const m = await api.getMachineByCode(r1.codes[0]);
    assert.equal(r1.entity_id, m.id);
    assert.equal(m.brand, 'Bosch');
    assert.equal(m.home_location_id, S.space.id);
    assert.equal(m.location_code_path, 'WS');
    assert.equal(m.product_url, 'https://www.bosch-professional.com/ch/de/');
    assert.equal(m.category, 'Bohrmaschinen & Bohrhämmer');
    assert.equal(m.category_path, 'Maschinen & Geräte › Bohrmaschinen & Bohrhämmer');
    assert.match(m.notes, /Erfasst aus Foto IMG_1\.jpeg/);
    assert.ok(m.photo_path.startsWith('photos/'), 'Originalfoto aus der Erkennung');
    const other = (await api.listDetections({ photoId: S.p2.id })).find((d) => d.obj_key === 'bosch-gbh-2-28');
    assert.deepEqual([other.status, other.machine_id, other.machine_code, other.merged_into], ['zusammengefuehrt', m.id, m.code, r1.detection.id]);
    await rejects(api.reviewDetection(by('bosch-gbh-2-28').id, 'bestaetigen', {}), 'already_reviewed');
    // zwei Einzelstücke → zwei Maschinen mit eigenem Code
    const r2 = await api.reviewDetection(by('akku-schrauber').id, 'bestaetigen', {});
    assert.equal(r2.codes.length, 2);
    assert.notEqual(r2.codes[0], r2.codes[1]);
    // Bestandsartikel mit unsicherer Menge
    await rejects(api.reviewDetection(by('schrauben-box').id, 'bestaetigen', {}), 'quantity_uncertain');
    const r3 = await api.reviewDetection(by('schrauben-box').id, 'bestaetigen', { without_stock: true });
    const a = await api.getArticleByCode(r3.codes[0]);
    assert.equal(a.stock, 0);
    assert.match(a.notes, /Menge noch nicht gezählt/);
    assert.deepEqual([a.unit, a.category_path], ['Stk', 'Bau- & Montagematerial › Befestigungsmaterial']);
    assert.equal(a.photo_path, S.p1.path, 'Foto der Erkennung');
    assert.equal((await api.listMovements({ articleId: a.id })).length, 0, 'kein Bestand → keine Bewegung');
    // unbekannt → erst Art festlegen; gezählte Menge eingeben → als Bestand übernommen
    await rejects(api.reviewDetection(by('ding').id, 'bestaetigen', {}), 'kind_required');
    const r4 = await api.reviewDetection(by('ding').id, 'bestaetigen', { kind: 'bestandsartikel', name: 'Distanzhülsen', quantity: 15, unit: 'Stk' });
    const a2 = await api.getArticleByCode(r4.codes[0]);
    assert.deepEqual([a2.name, a2.stock], ['Distanzhülsen', 15]);
    const mv = await api.listMovements({ articleId: a2.id });
    assert.deepEqual(mv.map((x) => [x.type, x.qty]), [['anlage', 15]]);
    // Einrichtung → neuer Lagerort im Raum, mit Kurzcode
    const r5 = await api.reviewDetection(by('metallregal').id, 'bestaetigen', { loc_type: 'regal', short_code: 'rg01' });
    assert.equal(r5.entity, 'location');
    const loc = await api.getLocationByCode(r5.codes[0]);
    assert.equal(loc.parent_id, S.space.id);
    assert.equal(loc.code_path, 'WS-RG01');
    assert.equal(loc.type, 'regal');
    S.regal = loc;
    const d5 = (await api.listDetections({ photoId: S.p1.id })).find((d) => d.obj_key === 'metallregal');
    assert.deepEqual([d5.location_ref_code, d5.location_ref_name], [loc.code, 'Metallregal grau']);
    // Protokoll
    await as(api, 'cristian');
    const au = await auditOf(api, 'ki_bestaetigen');
    assert.equal(au.length, 5);
    const first = au.find((x) => x.entity_id === r1.detection.id);
    assert.deepEqual(first.details, { name: 'Bohrhammer Bosch GBH 2-28', status: 'bestaetigt', erfasst: 'machine', codes: r1.codes, verknuepft: 1 });
    assert.ok((await api.listAudit({ entity: 'machines', entityId: m.id })).some((x) => x.action === 'insert'), 'neue Maschine protokolliert');
  });

  test('prüfen: bearbeiten, später, ablehnen, wieder öffnen, zusammenführen, verknüpfen', async () => {
    await as(api, 'luca');
    const add = (key, name) => api.addDetection(S.p2.id, { name, notes: key });
    const d1 = await add('x1', 'Verlängerungskabel');
    assert.equal(d1.source, 'manuell');
    assert.equal(d1.confidence, 'unbekannt');
    assert.match(d1.obj_key, /^manuell-[0-9a-f]{32}$/);
    const d2 = await add('x2', 'Verlängerungskabel (anderes Foto)');
    await rejects(api.reviewDetection(d1.id, 'bearbeiten', { name: '  ' }), 'name_required');
    await rejects(api.reviewDetection(d1.id, 'bearbeiten', { quantity: -1 }), 'invalid_qty');
    await rejects(api.reviewDetection(d1.id, 'bearbeiten', { kind: 'werkzeug' }), 'invalid_input');
    await rejects(api.reviewDetection(d1.id, 'bearbeiten', { category_id: randomUUID() }), 'not_found');
    const e = await api.reviewDetection(d1.id, 'bearbeiten', { kind: 'bestandsartikel', quantity: 3, target_location_id: S.regal.id, category_id: S.catKabel });
    assert.equal(e.detection.quantity_certain, true);
    assert.equal(e.detection.target_location_id, S.regal.id);
    assert.deepEqual(Object.keys(e), ['detection']);
    const v1 = (await api.listDetections({ photoId: S.p2.id })).find((d) => d.id === d1.id);
    assert.deepEqual([v1.target_location_path, v1.category_path], ['Werkstatt / Metallregal grau', 'IT & Elektronik › Kabel & Adapter']);
    await api.reviewDetection(d2.id, 'spaeter', {});
    await rejects(api.reviewDetection(d2.id, 'spaeter', {}), 'already_reviewed');
    const z = await api.reviewDetection(d2.id, 'zusammenfuehren', { into: d1.id });
    assert.equal(z.detection.status, 'zusammengefuehrt');
    assert.equal(z.detection.merged_into, d1.id);
    await rejects(api.reviewDetection(d1.id, 'zusammenfuehren', { into: d2.id }), 'invalid_input');   // Kette führt auf sich selbst
    const w = await api.reviewDetection(d2.id, 'wiederoeffnen', {});
    assert.equal(w.detection.status, 'offen');
    assert.equal(w.detection.merged_into, null);
    const ab = await api.reviewDetection(d2.id, 'ablehnen', { reason: 'doppelt fotografiert' });
    assert.equal(ab.detection.status, 'abgelehnt');
    assert.equal(ab.detection.notes, 'x2 · Abgelehnt: doppelt fotografiert');
    await rejects(api.reviewDetection(d2.id, 'bestaetigen', {}), 'already_reviewed');
    // verknüpfen mit bestehendem Artikel statt neu anlegen
    await rejects(api.reviewDetection(d1.id, 'bestaetigen', { mode: 'verknuepfen' }), 'invalid_input');
    await rejects(api.reviewDetection(d1.id, 'bestaetigen', { mode: 'verknuepfen', article_id: randomUUID() }), 'not_found');
    const v = await api.reviewDetection(d1.id, 'bestaetigen', { mode: 'verknuepfen', article_id: S.oldArt.id });
    assert.equal(v.entity, 'article');
    assert.deepEqual(v.codes, [S.oldArt.code]);
    assert.equal(v.merged, 0);
    assert.equal((await api.listArticles()).filter((a) => a.name === 'Verlängerungskabel').length, 0, 'kein Duplikat angelegt');
    assert.equal((await api.listDetections({ articleId: S.oldArt.id })).length, 1);
    await rejects(api.reviewDetection(d1.id, 'unsinn', {}), 'invalid_input');
    await rejects(api.reviewDetection(d1.id, 'bearbeiten', { name: 'zu spät' }), 'already_reviewed');
    await rejects(api.reviewDetection(randomUUID(), 'spaeter', {}), 'not_found');
  });

  test('aufgaben, hotspots, sets: Rechte und Protokoll', async () => {
    await as(api, 'daniel');
    await rejects(api.saveTask({ location_id: S.space.id, title: 'Kabel sortieren' }), 'not_authorized');
    await as(api, 'luca');
    await rejects(api.saveTask({ location_id: S.space.id, title: '  ' }), 'name_required');
    await rejects(api.saveTask({ location_id: randomUUID(), title: 'x' }), 'invalid_location');
    await rejects(api.saveTask({ location_id: S.space.id, title: 'x', source: 'raten' }), 'invalid_value');
    const t1 = await api.saveTask({ location_id: S.space.id, title: 'Kabel nach Typ sortieren', source: 'foto_analyse', photo_id: S.p1.id });
    assert.deepEqual([t1.created_by, t1.created_by_name, t1.status, t1.root_id, t1.location_path, t1.done_by], [U.luca, 'Luca', 'offen', S.space.id, 'Werkstatt', null]);
    const t1d = await api.saveTask({ id: t1.id, status: 'erledigt' });
    assert.equal(t1d.done_by, U.luca);
    assert.equal(t1d.done_by_name, 'Luca');
    assert.ok(t1d.done_at);
    const t1o = await api.saveTask({ id: t1.id, status: 'offen' });
    assert.equal(t1o.done_by, null);
    assert.equal(t1o.done_at, null);
    const t1x = await api.saveTask({ id: t1.id, done_by: U.daniel, title: 'Kabel nach Typ und Länge sortieren' });
    assert.equal(t1x.done_by, null, 'done_by nur über den Status');
    await rejects(api.saveTask({ id: t1.id, status: 'fertig' }), 'invalid_status');
    const t2 = await api.saveTask({ location_id: S.regal.id, title: 'Regal beschriften', status: 'erledigt', sort: 5 });
    assert.equal(t2.done_by, U.luca);
    const t3 = await api.saveTask({ location_id: S.regal.id, title: 'Unnötiges', status: 'verworfen' });
    assert.deepEqual((await api.listTasks({ spaceId: S.space.id })).map((t) => t.id), [t1.id, t2.id, t3.id], 'offene zuerst');
    assert.deepEqual((await api.listTasks({ locationId: S.regal.id, status: ['offen', 'erledigt'] })).map((t) => t.id), [t2.id]);
    S.task = t1;
    await api.saveTask({ id: t2.id, status: 'offen' });   // wieder offen
    S.task2 = t2;
    // Hotspot (Rechteck) auf dem Raumfoto → Regal
    await as(api, 'daniel');
    await rejects(api.saveHotspot({ photo_id: S.p1.id, location_id: S.regal.id, x: 0.1, y: 0.1 }), 'not_authorized');
    await as(api, 'luca');
    await rejects(api.saveHotspot({ photo_id: S.p1.id, location_id: S.regal.id, x: 0.1, y: 0.1, w: 1.5 }), 'invalid_value');
    await rejects(api.saveHotspot({ photo_id: S.p1.id, location_id: S.regal.id, x: 0.1, y: 0.1, w: 0 }), 'invalid_value');
    const h = await api.saveHotspot({ photo_id: S.p1.id, location_id: S.regal.id, x: 0.1, y: 0.2, w: 0.3, h: 0.4, label: 'Regal 01' });
    assert.deepEqual([h.created_by, h.location_code, h.location_name, h.location_type, h.w], [U.luca, S.regal.code, 'Metallregal grau', 'regal', 0.3]);
    const h2 = await api.saveHotspot({ id: h.id, label: ' Regal 1 ', x: 0.15 });
    assert.deepEqual([h2.label, h2.x, h2.y], ['Regal 1', 0.15, 0.2]);
    const pt = await api.saveHotspot({ photo_id: S.p2.id, location_id: S.space.id, x: 0.5, y: 0.5 });
    assert.deepEqual([pt.w, pt.h], [null, null]);
    assert.deepEqual((await api.listHotspots({ photoIds: [S.p1.id, S.p2.id] })).map((x) => x.id), [h.id, pt.id]);
    assert.deepEqual(await api.listHotspots({}), []);
    await api.deleteHotspot(pt.id);
    assert.deepEqual((await api.listHotspots({ photoId: S.p2.id })), []);
    // Übersichtsfoto des Raums
    await rejects(api.saveLocation({ id: S.space.id, cover_photo_id: randomUUID() }), 'not_found');
    await api.saveLocation({ id: S.space.id, cover_photo_id: S.p1.id });
    const lo = await api.getLocation(S.space.id);
    assert.equal(lo.cover_photo_path, S.p1.path);
    assert.equal(lo.photo_path, S.p1.path);
    // Set mit Komponenten
    const set = await api.saveMachine({ name: 'Messkoffer', is_set: true });
    assert.equal(set.is_set, true);
    const c1 = await api.saveComponent({ set_id: set.id, article_id: S.oldArt.id, qty: 2 });
    assert.deepEqual([c1.qty, c1.created_by], [2, U.luca]);
    const c2 = await api.saveComponent({ set_id: set.id, name: 'Spannschlüssel', sort: 10 });
    await rejects(api.saveComponent({ set_id: set.id }), 'name_required');
    await rejects(api.saveComponent({ set_id: set.id, machine_id: set.id }), 'invalid_input');
    await rejects(api.saveComponent({ set_id: set.id, name: 'x', qty: 0 }), 'invalid_qty');
    await rejects(api.saveComponent({ set_id: randomUUID(), name: 'x' }), 'not_found');
    await rejects(api.saveComponent({ id: c2.id, name: '' }), 'invalid_input');
    assert.equal((await api.saveComponent({ id: c2.id, qty: 1.5, note: 'im Deckel' })).qty, 1.5);
    const so = await api.getMachine(set.id);
    assert.equal(so.component_count, 2);
    const comps = await api.listComponents(set.id);
    assert.deepEqual(comps.map((c) => [c.article_code, c.unit, c.name]), [[S.oldArt.code, S.oldArt.unit, null], [null, null, 'Spannschlüssel']]);
    await as(api, 'daniel');
    await rejects(api.saveComponent({ set_id: set.id, name: 'x' }), 'not_authorized');
    await rejects(api.deleteComponent(c2.id), 'not_authorized');
    assert.equal((await api.orgStats()).sets_total, 1);
    S.set = set;
    await as(api, 'cristian');
    const actions = (await api.listAudit({ limit: 100000 }))
      .filter((r) => ['org_tasks', 'photo_hotspots', 'set_components'].includes(r.entity))
      .map((r) => `${r.entity}:${r.action}`);
    for (const a of ['org_tasks:insert', 'org_tasks:update', 'photo_hotspots:insert', 'photo_hotspots:update', 'photo_hotspots:delete', 'set_components:insert', 'set_components:update']) {
      assert.ok(actions.includes(a), a);
    }
  });

  test('raum abschliessen: nur ohne offene Prüfungen/Aufgaben; Status und Fortschritt aus echten Daten', async () => {
    await as(api, 'luca');
    await rejects(api.setLocationOrganized(S.space.id, true), 'open_items', '0/2');
    await api.saveTask({ id: S.task.id, status: 'erledigt' });
    await api.saveTask({ id: S.task2.id, status: 'verworfen' });
    let sp = (await api.listSpaces()).find((s) => s.id === S.space.id);
    assert.equal(sp.org_status, 'in_organisation');
    assert.equal(sp.progress, 100);
    assert.deepEqual([sp.detections_open, sp.tasks_open, sp.tasks_done, sp.sublocations], [0, 0, 1, 1]);
    await as(api, 'daniel');
    await rejects(api.setLocationOrganized(S.space.id, true), 'not_authorized');
    await as(api, 'luca');
    const l = await api.setLocationOrganized(S.space.id, true);
    assert.ok(l.organized_at);
    assert.equal(l.organized_by, U.luca);
    sp = (await api.listSpaces()).find((s) => s.id === S.space.id);
    assert.equal(sp.org_status, 'organisiert');
    assert.equal((await api.orgStats()).spaces_organized, 1);
    // neues offenes Objekt → Raum wieder «zu prüfen»
    const nd = await api.addDetection(S.p1.id, { name: 'Neues Teil', pos_x: 0.2, pos_y: 7, target_location_id: S.regal.id });
    assert.deepEqual([nd.pos_x, nd.pos_y, nd.target_location_id, nd.kind], [0.2, null, S.regal.id, 'unbekannt']);
    sp = (await api.listSpaces()).find((s) => s.id === S.space.id);
    assert.equal(sp.org_status, 'zu_pruefen');
    const off = await api.setLocationOrganized(S.space.id, false);
    assert.equal(off.organized_at, null);
    await as(api, 'cristian');
    assert.deepEqual((await auditOf(api, 'organisiert')).map((r) => r.details.organisiert), [false, true]);
  });

  test('fotos: mit bestätigten Objekten nicht löschbar; Mitarbeiter löscht nie', async () => {
    await as(api, 'luca');
    await rejects(api.deletePhoto(S.p1), 'in_use');
    await as(api, 'daniel');
    await rejects(api.deletePhoto(S.p3.id), 'not_authorized');
    await as(api, 'luca');
    await api.deletePhoto(S.p3.id);
    assert.equal((await api.listPhotos({ ids: [S.p3.id] })).length, 0);
    await rejects(api.deletePhoto(S.p3.id), 'not_found');
    await as(api, 'cristian');
    await rejects(api.deleteLocation(S.space.id), 'in_use');   // Fotos (und Unterorte) hängen daran
  });

  test('nicht freigegeben sieht nichts; abgemeldet → not_authorized', async () => {
    await as(api, 'ana');
    assert.deepEqual(await api.listCategories(), []);
    assert.deepEqual(await api.listSpaces(), []);
    assert.deepEqual(await api.listPhotos(), []);
    assert.deepEqual(await api.listDetections(), []);
    assert.deepEqual(await api.listTasks(), []);
    assert.deepEqual(await api.listHotspots({ photoId: S.p1.id }), []);
    assert.deepEqual(await api.listComponents(S.set.id), []);
    const st = await api.orgStats();
    assert.ok(Object.values(st).every((v) => v === 0));
    await rejects(api.reviewDetection(S.dets[0].id, 'spaeter', {}), 'not_authorized');
    await rejects(api.importAnalysis([], 'x'), 'not_authorized');
    await rejects(api.addDetection(S.p1.id, {}), 'not_authorized');
    await api.signOut();
    await rejects(api.listCategories(), 'not_authorized');
    await rejects(api.orgStats(), 'not_authorized');
    await rejects(api.listSpaces(), 'not_authorized');
    await rejects(api.listDetections(), 'not_authorized');
  });
});

// =============================================================================================
describe('Regeln im Detail', () => {
  async function space(api, name, short, shas) {
    await as(api, 'luca');
    const sp = await api.saveLocation({ name, type: 'raum', short_code: short });
    const photos = [];
    for (const [i, s] of shas.entries()) photos.push((await api.importPhoto(jpeg(`${name}-${i}.jpeg`, i), { locationId: sp.id, sha256: s })).photo);
    return { sp, photos };
  }

  test('Lagerorte, Maschinen, Artikel: Kurzcode, Verantwortliche, Herstellerseite, Inventur je Raum', async () => {
    const api = await demo();
    await as(api, 'luca');
    const hl = await api.getLocationByCode('L-0001');     // Hauptlager / Regal A / Fach 02
    const ra = await api.getLocationByCode('L-0002');
    const fa = await api.getLocationByCode('L-0003');
    await rejects(api.saveLocation({ id: ra.id, short_code: 'RG-01' }), 'invalid_short_code', 'RG-01');
    await rejects(api.saveLocation({ id: ra.id, short_code: 'ABCDEFGHIJK' }), 'invalid_short_code');
    await api.saveLocation({ id: hl.id, short_code: 'hl' });
    await api.saveLocation({ id: ra.id, short_code: 'rg 01' });
    assert.equal((await api.getLocation(fa.id)).code_path, null, 'nicht jede Ebene hat einen Kurzcode');
    const f2 = await api.saveLocation({ id: fa.id, short_code: 'FA02' });
    assert.deepEqual([f2.short_code, f2.code_path, f2.root_id], ['FA02', 'HL-RG01-FA02', hl.id]);
    const kb = await api.getArticleByCode('INV-0004');     // Kabelbinder liegen in Fach 02
    assert.equal(kb.location_code_path, 'HL-RG01-FA02');
    // eindeutig je Ebene
    const rb = await api.getLocationByCode('L-0005');      // Regal B (ebenfalls im Hauptlager)
    await rejects(api.saveLocation({ id: rb.id, short_code: 'RG01' }), 'duplicate_short_code');
    await rejects(api.saveLocation({ name: 'Regal C', type: 'regal', parent_id: hl.id, short_code: 'RG01' }), 'duplicate_short_code');
    const other = await api.saveLocation({ name: 'Anderes Regal', type: 'werkzeugwand', short_code: 'RG01' });   // andere Ebene: erlaubt
    assert.equal(other.code_path, 'RG01');
    await rejects(api.saveLocation({ id: other.id, parent_id: hl.id }), 'duplicate_short_code');
    const cleared = await api.saveLocation({ id: other.id, short_code: '' });
    assert.equal(cleared.short_code, null);
    await rejects(api.saveLocation({ name: 'x', type: 'keller' }), 'invalid_type');
    // Verantwortliche
    await rejects(api.saveLocation({ id: hl.id, responsible_id: randomUUID() }), 'not_found');
    assert.equal((await api.saveLocation({ id: hl.id, responsible_id: U.daniel })).responsible_name, 'Daniel');
    const laptop = await api.saveMachine({ name: 'Laptop ThinkPad', responsible_id: U.daniel, product_url: 'https://www.lenovo.com/ch/de/' });
    assert.deepEqual([laptop.responsible_name, laptop.is_set, laptop.product_url, laptop.component_count], ['Daniel', false, 'https://www.lenovo.com/ch/de/', 0]);
    await rejects(api.saveMachine({ id: laptop.id, responsible_id: randomUUID() }), 'not_found');
    await rejects(api.saveMachine({ id: laptop.id, product_url: 'ftp://server/datei' }), 'invalid_url');
    await rejects(api.saveArticle({ name: 'Papier', product_url: 'www.ohne-protokoll.ch' }), 'invalid_url');
    const papier = await api.saveArticle({ name: 'Papier A4', product_url: ' https://example.com/a4 ' });
    assert.equal(papier.product_url, 'https://example.com/a4');
    // Inventur für einen Raum
    const inv = await api.createInventory({ name: 'Inventur Hauptlager', location_id: hl.id });
    assert.equal(inv.location_id, hl.id);
    await rejects(api.createInventory({ name: 'x', location_id: randomUUID() }), 'invalid_location');
    await as(api, 'daniel');
    await rejects(api.saveLocation({ id: hl.id, short_code: 'XX' }), 'not_authorized');
  });

  test('Einrichtung/Set bestätigen: Kurzcode, Typ, Rückrollen; Gruppen nur im selben Raum', async () => {
    const api = await demo();
    const a = await space(api, 'Lager Nord', 'LN', [sha(11), sha(12)]);
    const b = await space(api, 'Lager Süd', 'LS', [sha(13)]);
    const obj = (key, name, kind, extra = {}) => ({ key, name, kind, confidence: 'sicher', quantity: 1, quantity_certain: true, ...extra });
    const r = await api.importAnalysis([
      { sha256: sha(11), file: 'n1.jpeg', status: 'analysiert', objects: [
        obj('regal-1', 'Regal 1', 'einrichtung'), obj('regal-2', 'Regal 2', 'einrichtung'),
        obj('koffer', 'Messkoffer', 'set', { condition: 'beschaedigt', serial: 'SN-1', product: { url: 'javascript:alert(1)' } }),
        obj('leiter', 'Leiter', 'einzelinventar', { quantity: 51 }),
      ] },
      { sha256: sha(12), file: 'n2.jpeg', status: 'duplikat' },
      { sha256: sha(13), file: 's1.jpeg', status: 'analysiert', objects: [obj('koffer', 'Messkoffer', 'set')] },
    ], '  ');
    assert.deepEqual([r.matched, r.created, r.duplicates], [3, 5, 1]);
    assert.equal((await api.listPhotos({ ids: [a.photos[0].id] }))[0].analysis_source, 'KI-Analyse', 'leere Quelle → «KI-Analyse»');
    const dets = await api.listDetections();
    const d = (key, photo) => dets.find((x) => x.obj_key === key && x.photo_id === photo.id);
    assert.equal(d('koffer', a.photos[0]).same_key_count, 0, 'anderer Raum zählt nicht');
    const r1 = await api.reviewDetection(d('regal-1', a.photos[0]).id, 'bestaetigen', { short_code: 'RG01', loc_type: 'schrank' });
    assert.equal((await api.getLocationByCode(r1.codes[0])).code_path, 'LN-RG01');
    const before = (await api.listLocations()).length;
    await rejects(api.reviewDetection(d('regal-2', a.photos[0]).id, 'bestaetigen', { short_code: 'rg01' }), 'duplicate_short_code');
    await rejects(api.reviewDetection(d('regal-2', a.photos[0]).id, 'bestaetigen', { short_code: 'R G' }), 'invalid_short_code');
    await rejects(api.reviewDetection(d('regal-2', a.photos[0]).id, 'bestaetigen', { loc_type: 'keller' }), 'invalid_type');
    assert.equal((await api.listLocations()).length, before, 'nichts halb angelegt');
    assert.equal((await api.listDetections({ status: 'offen' })).filter((x) => x.obj_key === 'regal-2').length, 1, 'bleibt offen');
    // Ziel-Lagerort archiviert → invalid_location
    const ziel = await api.saveLocation({ name: 'Altes Regal', type: 'regal', parent_id: a.sp.id });
    await api.reviewDetection(d('regal-2', a.photos[0]).id, 'lagerort', { target_location_id: ziel.id });
    await api.saveLocation({ id: ziel.id, archived: true });
    await rejects(api.reviewDetection(d('regal-2', a.photos[0]).id, 'bestaetigen', {}), 'invalid_location');
    await rejects(api.reviewDetection(d('regal-2', a.photos[0]).id, 'lagerort', { target_location_id: ziel.id }), 'invalid_location');
    // Set: Maschine mit is_set, Zustand «beschaedigt» → Mängel, unsicherer Link verworfen, Seriennummer bei 1 Stück
    const rs = await api.reviewDetection(d('koffer', a.photos[0]).id, 'bestaetigen', {});
    assert.equal(rs.merged, 0, 'gleicher Schlüssel im anderen Raum wird nicht verknüpft');
    const koffer = await api.getMachineByCode(rs.codes[0]);
    assert.deepEqual([koffer.is_set, koffer.condition, koffer.product_url, koffer.serial_no, koffer.status], [true, 'maengel', null, 'SN-1', 'verfuegbar']);
    assert.equal((await api.listDetections({ photoId: b.photos[0].id }))[0].status, 'offen');
    // mehr als 50 Einzelstücke → invalid_qty
    await rejects(api.reviewDetection(d('leiter', a.photos[0]).id, 'bestaetigen', {}), 'invalid_qty');
    // mit bestehender Maschine / Lagerort verknüpfen
    const lv = await api.reviewDetection(d('leiter', a.photos[0]).id, 'bestaetigen', { mode: 'verknuepfen', machine_id: koffer.id });
    assert.deepEqual([lv.entity, lv.entity_id, lv.codes], ['machine', koffer.id, [koffer.code]]);
    const reg = await api.reviewDetection(d('koffer', b.photos[0]).id, 'bestaetigen', { mode: 'verknuepfen', location_id: b.sp.id });
    assert.deepEqual([reg.entity, reg.codes], ['location', [b.sp.code]]);
  });

  test('Löschen: Kaskaden und Löschschutz wie in schema.sql', async () => {
    const api = await demo();
    const { sp, photos: [p] } = await space(api, 'Archiv', 'AR', [sha(21)]);
    const fach = await api.saveLocation({ name: 'Fach 1', type: 'fach', parent_id: sp.id });
    await api.importAnalysis([{ sha256: sha(21), status: 'analysiert', objects: [{ key: 'a', name: 'A' }, { key: 'b', name: 'B' }] }], 'T');
    const [da, db] = await api.listDetections({ photoId: p.id });
    await api.reviewDetection(db.id, 'zusammenfuehren', { into: da.id });
    const h = await api.saveHotspot({ photo_id: p.id, location_id: fach.id, x: 0.2, y: 0.2 });
    const t = await api.saveTask({ location_id: fach.id, title: 'Fach leeren', photo_id: p.id });
    await api.saveLocation({ id: sp.id, cover_photo_id: p.id });
    // Foto löschen: Erkennungen und Bereiche weg, Aufgabe und Übersichtsfoto ohne Foto
    await api.deletePhoto(p.id);
    assert.deepEqual(await api.listDetections({ photoId: p.id }), []);
    assert.deepEqual(await api.listHotspots({ photoId: p.id }), []);
    assert.equal((await api.listTasks({ locationId: fach.id }))[0].photo_id, null);
    assert.equal((await api.getLocation(sp.id)).cover_photo_id, null);
    await as(api, 'cristian');
    const au = (await api.listAudit({ limit: 100000 })).map((r) => `${r.entity}:${r.action}:${r.entity_id}`);
    assert.ok(au.includes(`photo_hotspots:delete:${h.id}`) && au.includes(`photos:delete:${p.id}`) && au.includes(`org_tasks:update:${t.id}`));
    // Lagerort löschen: Aufgaben (und Bereiche) werden mitgelöscht
    await api.deleteLocation(fach.id);
    assert.deepEqual(await api.listTasks({ locationId: fach.id }), []);
    // Set löschen: Komponenten mitgelöscht; als Komponente benutzt → in_use
    await as(api, 'luca');
    const set = await api.saveMachine({ name: 'Bohrset', is_set: true });
    const teil = await api.saveMachine({ name: 'Bohrmaschine' });
    const art = await api.saveArticle({ name: 'Bohrer 6 mm' });
    await api.saveComponent({ set_id: set.id, machine_id: teil.id });
    await api.saveComponent({ set_id: set.id, article_id: art.id, qty: 3 });
    const bedarf = await api.saveSupply({ machine_id: teil.id, article_id: art.id });   // Bedarf je Maschine: kein Löschschutz
    const bedarf2 = await api.saveSupply({ machine_id: set.id, article_id: art.id });
    await as(api, 'cristian');
    await rejects(api.deleteMachine(teil.id), 'in_use');
    await rejects(api.deleteArticle(art.id), 'in_use');
    assert.equal((await api.listSupplies({ articleId: art.id })).length, 2, 'abgelehntes Löschen lässt die Verknüpfungen stehen');
    await api.deleteMachine(set.id);
    assert.deepEqual(await api.listComponents(set.id), []);
    assert.deepEqual((await api.listSupplies({ articleId: art.id })).map((s) => s.id), [bedarf.id], 'mit der Maschine gelöscht');
    await api.deleteMachine(teil.id);
    assert.deepEqual(await api.listSupplies({ articleId: art.id }), []);
    await api.deleteArticle(art.id);
    const gone = (await api.listAudit({ entity: 'machine_supplies', limit: 100000 })).filter((r) => r.action === 'delete').map((r) => r.entity_id);
    assert.deepEqual(gone.sort(), [bedarf.id, bedarf2.id].sort());
    // Kategorie nur als Vorschlag benutzt → löschbar, Erkennung verliert die Kategorie
    await as(api, 'luca');
    const kat = await api.saveCategory({ name: 'Nur Vorschlag' });
    const { photos: [p2] } = await space(api, 'Keller', 'KE', [sha(22)]);
    await api.importAnalysis([{ sha256: sha(22), status: 'analysiert', objects: [{ key: 'x', name: 'X', category: 'nur vorschlag' }] }], 'T');
    assert.equal((await api.listDetections({ photoId: p2.id }))[0].category_id, kat.id, 'category_by_path: Gross/Klein egal');
    await as(api, 'cristian');
    await api.deleteCategory(kat.id);
    assert.equal((await api.listDetections({ photoId: p2.id }))[0].category_id, null);
  });

  test('Fotoimport: Bild verkleinert (createImageBitmap/OffscreenCanvas simuliert), SHA der Originaldatei, gespeichert', async () => {
    const storage = new MemoryStorage();
    const api = fresh(storage);
    await api.init();
    await as(api, 'luca');
    let canvasSize = null;
    const types = [];
    globalThis.createImageBitmap = async () => ({ width: 4000, height: 3000, close() {} });
    globalThis.OffscreenCanvas = class {
      constructor(w, h) { this.width = w; this.height = h; canvasSize = [w, h]; }
      getContext() { return { fillStyle: '', fillRect() {}, drawImage() {} }; }
      async convertToBlob(o) { types.push(o.type); return new Blob([new Uint8Array(100)], { type: o.type }); }
    };
    try {
      const f = new File([new Uint8Array(5000).fill(9)], 'IMG_0001.HEIC', { type: '' });   // Typ aus der Endung
      const orig = createHash('sha256').update(Buffer.from(await f.arrayBuffer())).digest('hex');
      const { photo } = await api.importPhoto(f, { folder: 'Handy' });
      assert.deepEqual(canvasSize, [800, 600]);
      assert.deepEqual([photo.mime, photo.width, photo.height, photo.size_bytes, photo.sha256, photo.path, photo.file_name, photo.kind],
        ['image/jpeg', 800, 600, 100, orig, `photos/${orig}.jpg`, 'IMG_0001.HEIC', 'foto']);
      // Gebäudeplan als PNG bleibt PNG (Beschriftung bleibt scharf); ein Foto als PNG wird JPEG
      const plan = (await api.importPhoto(png('grundriss.png', 5), { kind: 'plan' })).photo;
      assert.deepEqual([plan.kind, plan.mime, plan.width], ['plan', 'image/png', 800]);
      assert.ok(plan.path.endsWith('.png'));
      const fotoPng = (await api.importPhoto(png('screenshot.png', 6))).photo;
      assert.equal(fotoPng.mime, 'image/jpeg');
      assert.deepEqual(types, ['image/jpeg', 'image/png', 'image/jpeg']);
      await api.deletePhoto(fotoPng.id);
      await api.deletePhoto(plan.id);
    } finally {
      delete globalThis.createImageBitmap;
      delete globalThis.OffscreenCanvas;
    }
    const big = new File([new Uint8Array(2 * 1024 * 1024)], 'gross.png', { type: 'image/png' });
    await rejects(api.importPhoto(big), 'file_too_large');
    // neuer Speicherstand: Fotos, Erkennungen usw. bleiben nach dem Neuladen
    const again = fresh(storage);
    assert.equal((await again.listPhotos()).length, 1);
    assert.equal((await again.listPhotos())[0].folder, 'Handy');
  });
});

// =============================================================================================
describe('Gebäudeplan', () => {
  test('Planbild zählt nicht als Foto; Plan anlegen/ändern (Lagerverantwortliche), löschen nur Admin', async () => {
    const api = await demo();
    await as(api, 'luca');
    const space = await api.saveLocation({ name: 'Büro 3', type: 'raum' });
    const foto = (await api.importPhoto(jpeg('raum.jpeg'), { locationId: space.id, sha256: sha(31) })).photo;
    const before = await api.orgStats();
    await rejects(api.importPhoto(png('eg.png'), { kind: 'skizze' }), 'invalid_input');
    const { photo: plan } = await api.importPhoto(png('eg.png'), { kind: 'plan', sha256: sha(32) });
    assert.deepEqual([plan.kind, plan.mime, plan.path, plan.location_id, plan.status], ['plan', 'image/png', `photos/${sha(32)}.png`, null, 'neu']);
    const planInSpace = (await api.importPhoto(png('og.png', 2), { kind: 'plan', locationId: space.id, sha256: sha(33) })).photo;
    const after = await api.orgStats();
    assert.deepEqual([after.photos_total, after.photos_pending], [before.photos_total, before.photos_pending], 'Plan nicht in Foto-Kennzahlen');
    const sp = (await api.listSpaces()).find((s) => s.id === space.id);
    assert.deepEqual([sp.photos, sp.org_status], [1, 'fotos_vorhanden']);
    assert.deepEqual((await api.listPhotos()).map((p) => p.id), [foto.id], 'Standard: nur Fotos');
    assert.deepEqual((await api.listPhotos({ kind: 'plan' })).map((p) => p.id), [plan.id, planInSpace.id]);
    assert.equal((await api.listPhotos({ kind: null })).length, 3);
    // Plan anlegen
    await as(api, 'daniel');
    await rejects(api.saveFloorPlan({ name: 'EG', photo_id: plan.id }), 'not_authorized');
    await as(api, 'luca');
    await rejects(api.saveFloorPlan({ name: ' ', photo_id: plan.id }), 'name_required');
    await rejects(api.saveFloorPlan({ name: 'x'.repeat(81), photo_id: plan.id }), 'name_required');
    await rejects(api.saveFloorPlan({ name: 'EG' }), 'file_required');
    await rejects(api.saveFloorPlan({ name: 'EG', photo_id: randomUUID() }), 'not_found');
    const fp = await api.saveFloorPlan({ name: ' EG ', sort: 10, photo_id: plan.id, notes: ' Erdgeschoss ' });
    assert.deepEqual([fp.name, fp.sort, fp.notes, fp.created_by, fp.photo_path, fp.area_count, fp.linked_count],
      ['EG', 10, 'Erdgeschoss', U.luca, plan.path, 0, 0]);
    await rejects(api.saveFloorPlan({ name: 'EG 2', photo_id: plan.id }), 'duplicate', 'floor_plans_photo_id_key');
    const og = await api.saveFloorPlan({ name: 'OG', sort: 20, photo_id: planInSpace.id });
    // Räume auf dem Plan: nur beschriftet oder mit Lagerort verknüpft
    const h1 = await api.saveHotspot({ photo_id: plan.id, x: 0.3, y: 0.19, w: 0.4, h: 0.16, label: 'Büro 1' });
    assert.deepEqual([h1.location_id, h1.location_code, h1.location_name, h1.label], [null, null, null, 'Büro 1']);
    const h2 = await api.saveHotspot({ photo_id: plan.id, location_id: space.id, x: 0.3, y: 0.69, w: 0.4, h: 0.16, label: 'Büro 3' });
    await rejects(api.saveHotspot({ photo_id: plan.id, x: 0.5, y: 0.5 }), 'name_required');
    await rejects(api.saveHotspot({ photo_id: plan.id, x: 0.5, y: 0.5, label: '  ' }), 'name_required');
    await rejects(api.saveHotspot({ photo_id: randomUUID(), location_id: space.id, x: 0.5, y: 0.5 }), 'not_found');
    await rejects(api.saveHotspot({ id: h1.id, label: null }), 'invalid_value');
    assert.equal((await api.saveHotspot({ id: h1.id, location_id: space.id })).location_code, space.code, 'Raum später verknüpft');
    assert.equal((await api.saveHotspot({ id: h1.id, location_id: null })).location_id, null, 'wieder nur beschriftet');
    const h3 = await api.saveHotspot({ photo_id: foto.id, location_id: space.id, x: 0.1, y: 0.1 });
    assert.deepEqual((await api.listHotspots({ locationId: space.id })).map((h) => h.id), [h2.id, h3.id], 'alle Bereiche zu diesem Lagerort');
    assert.deepEqual((await api.listHotspots({ photoId: plan.id, locationId: space.id })).map((h) => h.id), [h2.id]);
    assert.deepEqual((await api.listFloorPlans()).map((f) => [f.name, f.area_count, f.linked_count]), [['EG', 2, 1], ['OG', 0, 0]]);
    const upd = await api.saveFloorPlan({ id: fp.id, name: 'Erdgeschoss', sort: 30, photo_id: foto.id });
    assert.deepEqual([upd.name, upd.photo_id], ['Erdgeschoss', plan.id], 'Planbild nach dem Anlegen fest');
    assert.deepEqual((await api.listFloorPlans()).map((f) => f.name), ['OG', 'Erdgeschoss'], 'nach sort, Name');
    // Löschschutz und Löschen
    await rejects(api.deletePhoto(plan.id), 'in_use');
    await rejects(api.deleteFloorPlan(fp.id), 'not_authorized');
    await as(api, 'ana');
    assert.deepEqual(await api.listFloorPlans(), []);
    await as(api, 'cristian');
    await api.deleteFloorPlan(fp.id);
    assert.deepEqual((await api.listFloorPlans()).map((f) => f.id), [og.id]);
    assert.deepEqual(await api.listPhotos({ kind: 'plan', ids: [plan.id] }), [], 'Planbild entfernt');
    assert.deepEqual(await api.listHotspots({ photoId: plan.id }), [], 'Bereiche entfernt');
    assert.equal((await api.fileUrls([plan.path])).size, 0);
    assert.deepEqual((await api.listHotspots({ locationId: space.id })).map((h) => h.id), [h3.id]);
    await rejects(api.deleteFloorPlan(fp.id), 'not_found');
    const au = (await api.listAudit({ entity: 'floor_plans', entityId: fp.id })).map((r) => r.action);
    assert.deepEqual(au, ['delete', 'update', 'insert']);
    assert.ok((await api.listAudit({ entity: 'photos', entityId: plan.id })).some((r) => r.action === 'delete'));
    await api.signOut();
    await rejects(api.listFloorPlans(), 'not_authorized');
  });

  test('Datenstand Version 2 (vor Gebäudeplan) wird übernommen: bestehende Bilder sind Fotos', async () => {
    const storage = new MemoryStorage();
    const a = fresh(storage);
    await a.init();
    await as(a, 'luca');
    const { photo } = await a.importPhoto(jpeg('alt.jpeg'), { sha256: sha(41) });
    await a.saveHotspot({ photo_id: photo.id, location_id: (await a.getLocationByCode('L-0001')).id, x: 0.5, y: 0.5 });
    const v2 = JSON.parse(storage.getItem(STORAGE_KEY));
    v2.version = 2;
    delete v2.floor_plans;
    for (const p of v2.photos) delete p.kind;
    storage.setItem(STORAGE_KEY, JSON.stringify(v2));
    const b = fresh(storage);
    assert.deepEqual((await b.listPhotos()).map((p) => [p.id, p.kind]), [[photo.id, 'foto']]);
    assert.deepEqual(await b.listFloorPlans(), []);
    assert.equal((await b.orgStats()).photos_total, 1);
    assert.equal((await b.listHotspots({ photoId: photo.id })).length, 1);
    const stored = JSON.parse(storage.getItem(STORAGE_KEY));
    assert.deepEqual([stored.version, stored.floor_plans, stored.categories.length], [3, [], v2.categories.length]);
  });
});

// =============================================================================================
describe('Standorte (wie tests/org.test.mjs «standorte»)', () => {
  test('anlegen nur Lagerverantwortliche/Admins, Name eindeutig (Gross/Klein egal), Längen, Reihenfolge sort/Name', async () => {
    const api = await demo();
    await as(api, 'daniel');
    assert.deepEqual(await api.listSites(), []);
    await rejects(api.saveSite({ name: 'Aussenlager' }), 'not_authorized');
    await as(api, 'luca');
    await rejects(api.saveSite(null), 'invalid_value');
    await rejects(api.saveSite({}), 'name_required');
    await rejects(api.saveSite({ name: '  ' }), 'name_required');
    await rejects(api.saveSite({ name: 'x'.repeat(81) }), 'invalid_value');
    await rejects(api.saveSite({ name: 'A', address: 'x'.repeat(201) }), 'invalid_value');
    await rejects(api.saveSite({ name: 'A', notes: 'x'.repeat(2001) }), 'invalid_value');
    const hw = await api.saveSite({ name: ' Musterweg 8 ', address: ' Musterweg 8, 3000 Bern ', sort: 20 });
    assert.deepEqual([hw.name, hw.address, hw.sort, hw.notes, hw.created_by, hw.space_count, hw.plan_count],
      ['Musterweg 8', 'Musterweg 8, 3000 Bern', 20, null, U.luca, 0, 0]);
    await rejects(api.saveSite({ name: ' musterweg 8 ' }), 'duplicate', 'sites_name_uniq');
    const ke = await api.saveSite({ name: 'Aussenlager', sort: 20 });
    const bu = await api.saveSite({ name: 'Büro Bern', sort: 10 });
    assert.deepEqual((await api.listSites()).map((s) => s.name), ['Büro Bern', 'Aussenlager', 'Musterweg 8'], 'nach sort, dann Name');
    await rejects(api.saveSite({ id: ke.id, name: 'MUSTERWEG 8' }), 'duplicate', 'sites_name_uniq');
    assert.equal((await api.saveSite({ id: bu.id, name: 'BÜRO BERN' })).name, 'BÜRO BERN', 'eigener Name zählt nicht als doppelt');
    const ke2 = await api.saveSite({ id: ke.id, name: 'Aussenlager Halle', sort: 5, notes: ' Halle 2 ' });
    assert.deepEqual([ke2.name, ke2.sort, ke2.notes, ke2.created_by], ['Aussenlager Halle', 5, 'Halle 2', U.luca]);
    assert.deepEqual((await api.listSites()).map((s) => s.id), [ke.id, bu.id, hw.id]);
    // Mitarbeiter liest, ändert nichts; nicht freigegebene sehen nichts
    await as(api, 'daniel');
    assert.equal((await api.listSites()).length, 3);
    await rejects(api.saveSite({ id: ke.id, name: 'X' }), 'not_authorized');
    await as(api, 'ana');
    assert.deepEqual(await api.listSites(), []);
    await rejects(api.saveSite({ id: ke.id, name: 'X' }), 'not_found');
    await as(api, 'luca');
    await rejects(api.saveSite({ id: 'kein-uuid', name: 'X' }), 'not_found');
    await rejects(api.saveSite({ id: randomUUID(), name: 'X' }), 'not_found');
    assert.equal((await api.listSites()).find((s) => s.id === ke.id).name, 'Aussenlager Halle', 'unverändert');
    const au = (await api.listAudit({ entity: 'sites', entityId: ke.id })).map((r) => r.action);
    assert.deepEqual(au, ['update', 'insert']);
    await api.signOut();
    await rejects(api.listSites(), 'not_authorized');
  });

  test('Raum am Standort: Unterorte zeigen ihn nur an, Code ohne Standort, Gebäudeplan, Zählung, Löschen, Umhängen', async () => {
    const api = await demo();
    await as(api, 'luca');
    const site = await api.saveSite({ name: 'Musterweg 8', sort: 20 });
    await rejects(api.saveLocation({ name: 'Lager H', type: 'raum', site_id: randomUUID() }), 'not_found');
    await rejects(api.saveLocation({ name: 'Lager H', type: 'raum', site_id: 'kein-uuid' }), 'not_found');
    const room = await api.saveLocation({ name: 'Lager H', type: 'raum', short_code: 'H1', site_id: site.id });
    assert.deepEqual([room.site_id, room.space_site_id, room.site_name, room.code_path], [site.id, site.id, 'Musterweg 8', 'H1']);
    // Unterort: kein eigener Standort (Trigger setzt ihn vor der Fremdschlüsselprüfung auf null), zeigt den des Raums
    const shelf = await api.saveLocation({ name: 'Regal', type: 'regal', short_code: 'RG01', parent_id: room.id, site_id: site.id });
    assert.deepEqual([shelf.site_id, shelf.space_site_id, shelf.site_name, shelf.code_path],
      [null, site.id, 'Musterweg 8', 'H1-RG01'], 'Standort steht nicht im Code');
    const box = await api.saveLocation({ name: 'Box', type: 'box', parent_id: shelf.id, site_id: randomUUID() });
    assert.deepEqual([box.site_id, box.space_site_id, box.site_name], [null, site.id, 'Musterweg 8']);
    assert.equal((await api.saveLocation({ id: shelf.id, site_id: site.id })).site_id, null);
    assert.equal((await api.listAudit({ entity: 'locations', entityId: shelf.id })).filter((r) => r.action === 'update').length, 0,
      'nichts geändert → kein Protokoll');
    // alle Lesewege: listLocations, getLocation, getLocationByCode, listSpaces
    const locs = await api.listLocations();
    assert.equal(locs.find((l) => l.id === box.id).site_name, 'Musterweg 8');
    const hl = locs.find((l) => l.code === 'L-0001');
    assert.deepEqual([hl.site_id, hl.space_site_id, hl.site_name], [null, null, null], 'Raum ohne Standort');
    assert.equal((await api.getLocation(shelf.id)).space_site_id, site.id);
    assert.equal((await api.getLocationByCode(box.code)).site_name, 'Musterweg 8');
    const sp = (await api.listSpaces()).find((s) => s.id === room.id);
    assert.deepEqual([sp.site_id, sp.space_site_id, sp.site_name], [site.id, site.id, 'Musterweg 8']);
    await as(api, 'daniel');
    await rejects(api.saveLocation({ id: room.id, site_id: null }), 'not_authorized');
    await as(api, 'luca');
    // Gebäudeplan am Standort
    const { photo: pic } = await api.importPhoto(png('h-eg.png'), { kind: 'plan', sha256: sha(91) });
    await rejects(api.saveFloorPlan({ name: 'EG', photo_id: pic.id, site_id: 'kein-uuid' }), 'invalid_value');
    await rejects(api.saveFloorPlan({ name: 'EG', photo_id: pic.id, site_id: randomUUID() }), 'not_found');
    const fp = await api.saveFloorPlan({ name: 'EG', photo_id: pic.id, site_id: site.id });
    assert.deepEqual([fp.site_id, fp.site_name, fp.site_sort], [site.id, 'Musterweg 8', 20]);
    const { photo: pic2 } = await api.importPhoto(png('h-og.png', 2), { kind: 'plan', sha256: sha(92) });
    const og = await api.saveFloorPlan({ name: 'OG', sort: 10, photo_id: pic2.id });
    assert.deepEqual([og.site_id, og.site_name, og.site_sort], [null, null, null]);
    await rejects(api.saveFloorPlan({ id: og.id, site_id: randomUUID() }), 'not_found');
    assert.equal((await api.saveFloorPlan({ id: og.id, site_id: site.id })).site_name, 'Musterweg 8');
    assert.deepEqual((await api.listFloorPlans()).map((f) => [f.name, f.site_id, f.site_name, f.site_sort]),
      [['EG', site.id, 'Musterweg 8', 20], ['OG', site.id, 'Musterweg 8', 20]]);
    assert.equal((await api.saveFloorPlan({ id: og.id, site_id: '' })).site_id, null, 'leer = ohne Standort');
    // site_overview: nur nicht archivierte Räume, Pläne
    const room2 = await api.saveLocation({ name: 'Archiv H', type: 'raum', site_id: site.id, archived: true });
    const count = async () => { const s = (await api.listSites()).find((r) => r.id === site.id); return [s.space_count, s.plan_count]; };
    assert.deepEqual(await count(), [1, 1]);
    assert.equal((await api.saveSite({ id: site.id, sort: 21 })).space_count, 1, 'saveSite liefert die Ansicht');
    // Löschen: nur Admin (sonst bleibt alles), nur ungenutzt
    await rejects(api.deleteSite(site.id), 'not_authorized');
    assert.ok((await api.listSites()).some((s) => s.id === site.id), 'nichts gelöscht');
    await as(api, 'cristian');
    await rejects(api.deleteSite('kein-uuid'), 'not_found');
    await rejects(api.deleteSite(randomUUID()), 'not_found');
    await rejects(api.deleteSite(site.id), 'in_use');
    // Raum wird untergeordnet → Standort fällt weg (auch für seine Unterorte)
    const moved = await api.saveLocation({ id: room.id, parent_id: hl.id });
    assert.deepEqual([moved.site_id, moved.space_site_id, moved.site_name], [null, null, null]);
    const boxNow = await api.getLocation(box.id);
    assert.deepEqual([boxNow.space_site_id, boxNow.site_name, boxNow.root_id], [null, null, hl.id]);
    const diff = (await api.listAudit({ entity: 'locations', entityId: room.id })).find((r) => r.action === 'update').details;
    assert.deepEqual(diff.site_id, { alt: site.id, neu: null });
    assert.deepEqual(await count(), [0, 1]);
    await rejects(api.deleteSite(site.id), 'in_use');               // archivierter Raum und Plan hängen noch daran
    await api.saveLocation({ id: room2.id, site_id: null });
    await rejects(api.deleteSite(site.id), 'in_use');               // Plan
    await api.saveFloorPlan({ id: fp.id, site_id: null });
    await api.deleteSite(site.id);
    assert.deepEqual(await api.listSites(), []);
    assert.deepEqual((await api.listAudit({ entity: 'sites', entityId: site.id })).map((r) => r.action), ['delete', 'update', 'insert']);
    await rejects(api.deleteSite(site.id), 'not_found');
  });

  test('gespeicherter Stand Version 3 ohne Standorte wird ohne Verlust ergänzt', async () => {
    const storage = new MemoryStorage();
    const a = fresh(storage);
    await a.init();
    await as(a, 'luca');
    const { photo } = await a.importPhoto(png('plan.png'), { kind: 'plan', sha256: sha(93) });
    const fp = await a.saveFloorPlan({ name: 'EG', photo_id: photo.id });
    const before = (await a.listLocations({ includeArchived: true })).map((l) => [l.code, l.path, l.code_path]);
    const old = JSON.parse(storage.getItem(STORAGE_KEY));
    assert.equal(old.version, 3);
    delete old.sites;
    for (const l of old.locations) delete l.site_id;
    for (const f of old.floor_plans) delete f.site_id;
    storage.setItem(STORAGE_KEY, JSON.stringify(old));
    const b = fresh(storage);
    assert.deepEqual(await b.listSites(), []);
    const locs = await b.listLocations({ includeArchived: true });
    assert.deepEqual(locs.map((l) => [l.code, l.path, l.code_path]), before);
    assert.ok(locs.every((l) => l.site_id === null && l.space_site_id === null && l.site_name === null));
    assert.deepEqual((await b.listFloorPlans()).map((f) => [f.id, f.site_id, f.site_name, f.site_sort]), [[fp.id, null, null, null]]);
    // weiterarbeiten: Standort anlegen und zuweisen, Version bleibt 3
    const site = await b.saveSite({ name: 'Büro' });
    const hl = await b.saveLocation({ id: locs.find((l) => l.code === 'L-0001').id, site_id: site.id });
    assert.equal(hl.site_name, 'Büro');
    const stored = JSON.parse(storage.getItem(STORAGE_KEY));
    assert.deepEqual([stored.version, stored.sites.length], [3, 1]);
  });
});

describe('KI-Regeln (Stand schema.sql)', () => {
  test('Produktrecherche in den Notizen, Einheiten, späterer Fehlversuch, SHA mit Leerzeichen, Fotos ohne Lagerort', async () => {
    const api = await demo();
    await as(api, 'luca');
    const a = (await api.importPhoto(jpeg('a.jpeg'), { sha256: sha(51) })).photo;   // beide ohne Lagerort
    const b = (await api.importPhoto(jpeg('b.jpeg', 2), { sha256: sha(52) })).photo;
    const c = (await api.importPhoto(jpeg('c.jpeg', 3), { sha256: sha(53) })).photo;
    const kiste = { key: 'gleich', name: 'Kiste', kind: 'bestandsartikel', quantity: 1, quantity_certain: true, confidence: 'sicher' };
    const r = await api.importAnalysis([
      { sha256: ` ${sha(51).toUpperCase()} `, file: 'a.jpeg', status: 'analysiert', objects: [kiste,
        { key: 'kabel', name: 'Kabelrolle', kind: 'bestandsartikel', quantity: 3, quantity_certain: true, unit: 'Karton',
          product: { source: 'Hersteller', purpose: 'Verlängerung', specs: { 'Länge': '25 m', Querschnitt: '3×1,5 mm²', leer: null, IP: 44 } } },
        { key: 'bohrer', name: 'Bohrmaschine', kind: 'einzelinventar', quantity: 1, quantity_certain: true, notes: 'Koffer rot',
          product: { url: 'https://example.com/b', specs: { Watt: 750 } } },
        { key: 'papier', name: 'Papier', kind: 'bestandsartikel', quantity: 5, quantity_certain: true, unit: 'Ries' }] },
      { sha256: sha(52), file: 'b.jpeg', status: 'analysiert', objects: [kiste] },
      { sha256: sha(53), file: 'c.jpeg', status: 'fehler', error: 'Timeout' },
    ], 'T');
    assert.deepEqual([r.matched, r.created, r.failed], [3, 5, 1], 'SHA mit Leerzeichen und Grossbuchstaben zugeordnet');
    const dets = await api.listDetections({ photoId: a.id });
    const by = (k) => dets.find((d) => d.obj_key === k);
    const rk = await api.reviewDetection(by('gleich').id, 'bestaetigen', {});
    assert.equal(rk.merged, 0, 'Fotos ohne Lagerort werden nie fotoübergreifend verknüpft');
    assert.equal((await api.listDetections({ photoId: b.id }))[0].status, 'offen');
    const rc = await api.reviewDetection(by('kabel').id, 'bestaetigen', {});
    const kabel = await api.getArticleByCode(rc.codes[0]);
    assert.equal(kabel.unit, 'Pkg', 'Karton → Pkg');
    assert.equal(kabel.notes, 'Zweck: Verlängerung\nTechnische Daten (laut Hersteller): IP 44; Länge 25 m; Querschnitt 3×1,5 mm²\nErfasst aus Foto a.jpeg');
    const rp = await api.reviewDetection(by('papier').id, 'bestaetigen', {});
    assert.equal((await api.getArticleByCode(rp.codes[0])).unit, 'Stk', 'unbekannte Einheit → Stk');
    const rb = await api.reviewDetection(by('bohrer').id, 'bestaetigen', {});
    const m = await api.getMachineByCode(rb.codes[0]);
    assert.equal(m.notes, 'Koffer rot\nTechnische Daten (laut Hersteller): Watt 750\nErfasst aus Foto a.jpeg');
    assert.equal(m.product_url, 'https://example.com/b');
    // späterer Fehlversuch setzt ein analysiertes Foto nicht zurück; ein neues/fehlerhaftes schon
    const f = await api.importAnalysis([{ sha256: sha(51), status: 'fehler', error: 'Timeout' }], 'T');
    assert.deepEqual([f.matched, f.failed], [1, 1]);
    const pa = (await api.listPhotos({ ids: [a.id, c.id] })).map((p) => [p.file_name, p.status, p.analysis_error]);
    assert.deepEqual(pa, [['a.jpeg', 'analysiert', null], ['c.jpeg', 'fehler', 'Timeout']]);
  });
});
