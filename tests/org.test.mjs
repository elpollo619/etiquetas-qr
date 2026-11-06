// Tests für «Lager organisieren» (Erweiterung von supabase/schema.sql) – PGlite wie db.test.mjs.
// 1) Migration: altes Schema (tests/fixtures/schema-v1.sql) mit Daten → neues Schema: Daten bleiben erhalten.
// 2) Kategorien, Fotos, KI-Import, Prüfung, Aufgaben, Hotspots, Sets, Raumstatus, Rechte.
// Ausführen:  cd web/tests && npm test

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const SCHEMA = await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8');
const SCHEMA_V1 = await readFile(new URL('./fixtures/schema-v1.sql', import.meta.url), 'utf8');

const SUPABASE_ENV = `
  create role anon nologin noinherit;
  create role authenticated nologin noinherit;
  grant usage on schema public to anon, authenticated;
  alter default privileges in schema public grant all on tables    to anon, authenticated;
  alter default privileges in schema public grant all on sequences to anon, authenticated;
  alter default privileges in schema public grant all on functions to anon, authenticated;
  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}', email_confirmed_at timestamptz);
  create function auth.uid() returns uuid language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
                    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid
  $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
`;

/** @type {PGlite} */
let db;
const U = {
  admin: '00000000-0000-4000-8000-000000000001',
  lv:    '00000000-0000-4000-8000-000000000002',
  ma:    '00000000-0000-4000-8000-000000000003',
};
const S = {};
const su = (sql, params = []) => db.query(sql, params);
async function as(userId, sql, params = []) {
  await db.exec('reset role');
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: userId, role: 'authenticated' })]);
  await db.exec('set role authenticated');
  try { return await db.query(sql, params); } finally {
    await db.exec('reset role');
    await db.query(`select set_config('request.jwt.claims', '', false)`);
  }
}
async function asAnon(sql, params = []) {
  await db.exec('reset role');
  await db.exec('set role anon');
  try { return await db.query(sql, params); } finally { await db.exec('reset role'); }
}
const one = async (u, sql, p = []) => (await as(u, sql, p)).rows[0];
async function rpc(u, fn, args = {}) {
  const keys = Object.keys(args);
  const r = await as(u, `select * from public.${fn}(${keys.map((k, i) => `${k} => $${i + 1}`).join(', ')})`, keys.map((k) => args[k]));
  return r.rows[0];
}
const rpcJson = async (u, fn, args) => Object.values(await rpc(u, fn, args))[0];
async function fails(promise, pattern) {
  await assert.rejects(promise, (e) => { assert.match(String(e.message), pattern); return true; });
}
const sha = (n) => String(n).padStart(64, 'a').slice(-64).replace(/[^0-9a-f]/g, 'b');

before(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_ENV);
  // --- altes Schema mit echten Daten ---
  await db.exec(SCHEMA_V1);
  await su(`insert into public.bootstrap_admins (email) values ('chef@firma.ch')`);
  await su(`insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at) values
    ($1, 'chef@firma.ch', '{"full_name":"Chef"}', now()),
    ($2, 'lv@firma.ch', '{"full_name":"Lea Lager"}', now()),
    ($3, 'ma@firma.ch', '{"full_name":"Max Muster"}', now())`, [U.admin, U.lv, U.ma]);
  await su(`update public.profiles set active = true, role = 'lagerverantwortlicher' where id = $1`, [U.lv]);
  await su(`update public.profiles set active = true where id = $1`, [U.ma]);
  S.oldLoc = (await one(U.admin, `insert into public.locations (name, type) values ('Büro', 'raum') returning *`));
  S.oldArt = (await one(U.admin, `insert into public.articles (name, category, stock, location_id) values ('Druckerpapier A4', 'Büro', 12, $1) returning *`, [S.oldLoc.id]));
  S.oldMach = (await one(U.admin, `insert into public.machines (name, category, brand) values ('Bohrhammer', 'Maschinen', 'Bosch') returning *`));
  // --- neues Schema darüber ---
  await db.exec(SCHEMA);
});
after(async () => { await db?.close(); });

test('migration: bestehende Daten bleiben unverändert, neue Spalten leer, Kategorien angelegt', async () => {
  const loc = await one(U.admin, `select * from public.locations where id = $1`, [S.oldLoc.id]);
  assert.equal(loc.code, S.oldLoc.code);
  assert.equal(loc.name, 'Büro');
  assert.equal(loc.short_code, null);
  const art = await one(U.admin, `select * from public.article_overview where id = $1`, [S.oldArt.id]);
  assert.equal(Number(art.stock), 12);
  assert.equal(art.category, 'Büro');
  assert.equal(art.category_id, null);
  const m = await one(U.admin, `select * from public.machine_overview where id = $1`, [S.oldMach.id]);
  assert.equal(m.brand, 'Bosch');
  assert.equal(m.is_set, false);
  assert.equal(Number(m.component_count), 0);
  const tops = (await as(U.ma, `select name from public.categories where parent_id is null order by sort`)).rows.map((r) => r.name);
  assert.equal(tops[0], 'Maschinen & Geräte');
  assert.ok(tops.includes('IT & Elektronik') && tops.includes('Reinigung & Unterhalt'));
  // nochmals ausführen: keine doppelten Kategorien, Daten bleiben
  await db.exec(SCHEMA);
  const n = await one(U.admin, `select count(*)::int as n from public.categories where parent_id is null`);
  assert.equal(n.n, tops.length);
  const art2 = await one(U.admin, `select stock from public.articles where id = $1`, [S.oldArt.id]);
  assert.equal(Number(art2.stock), 12);
});

test('kategorien: Pfade, Rechte, Zyklus, Löschen nur ungenutzt', async () => {
  const kab = await one(U.ma, `select * from public.category_paths where path = 'IT & Elektronik › Kabel & Adapter'`);
  assert.ok(kab, 'Pfad vorhanden');
  S.catKabel = kab.id;
  await fails(as(U.ma, `insert into public.categories (parent_id, name) values ($1, 'HDMI-Kabel')`, [kab.id]), /row-level security/);
  const hdmi = await one(U.lv, `insert into public.categories (parent_id, name) values ($1, 'HDMI-Kabel') returning *`, [kab.id]);
  assert.equal((await one(U.ma, `select path from public.category_paths where id = $1`, [hdmi.id])).path,
    'IT & Elektronik › Kabel & Adapter › HDMI-Kabel');
  await fails(as(U.lv, `insert into public.categories (parent_id, name) values ($1, 'hdmi-kabel')`, [kab.id]), /duplicate key/);
  const it = await one(U.ma, `select id from public.categories where name = 'IT & Elektronik' and parent_id is null`);
  await fails(as(U.lv, `update public.categories set parent_id = $1 where id = $2`, [hdmi.id, it.id]), /LGR:category_cycle/);
  // Hilfsfunktionen sind nur intern (in anderen Funktionen) nutzbar
  await fails(rpc(U.ma, 'category_by_path', { p_path: 'x' }), /permission denied/);
  await fails(rpc(U.ma, 'location_root', { p_id: S.oldLoc.id }), /permission denied/);
  assert.equal((await su(`select public.category_by_path('it & elektronik > Kabel & Adapter > HDMI-Kabel') as c`)).rows[0].c, hdmi.id);
  assert.equal((await su(`select public.category_by_path('Gibt es nicht') as c`)).rows[0].c, null);
  await as(U.lv, `update public.machines set category_id = $1 where id = $2`, [hdmi.id, S.oldMach.id]);
  const lvDel = await as(U.lv, `delete from public.categories where id = $1 returning id`, [hdmi.id]);   // RLS: nur Admins
  assert.equal(lvDel.rows.length, 0);
  await fails(as(U.admin, `delete from public.categories where id = $1`, [hdmi.id]), /foreign key|violates/);
  await as(U.lv, `update public.machines set category_id = null where id = $1`, [S.oldMach.id]);
  await as(U.admin, `delete from public.categories where id = $1`, [hdmi.id]);
});

test('fotos: nur Lagerverantwortliche importieren, Status setzt der Server, Doppelimport verhindert', async () => {
  const space = await one(U.lv, `insert into public.locations (name, type, short_code) values ('Werkstatt', 'raum', 'WS') returning *`);
  S.space = space;
  await fails(as(U.ma, `insert into public.photos (location_id, path, sha256) values ($1, 'photos/x.jpg', $2)`, [space.id, sha(1)]), /row-level security/);
  await fails(as(U.lv, `insert into public.photos (location_id, path, sha256, status) values ($1, 'photos/x.jpg', $2, 'analysiert')`, [space.id, sha(1)]), /permission denied/);
  const p1 = await one(U.lv, `insert into public.photos (location_id, path, sha256, file_name) values ($1, $2, $3, 'IMG_1.jpeg') returning *`,
    [space.id, `photos/${sha(1)}.jpg`, sha(1)]);
  assert.equal(p1.status, 'neu');
  assert.equal(p1.uploaded_by, U.lv);
  await fails(as(U.lv, `insert into public.photos (location_id, path, sha256) values ($1, 'photos/y.jpg', $2)`, [space.id, sha(1)]), /duplicate key/);
  await fails(as(U.lv, `update public.photos set status = 'analysiert' where id = $1`, [p1.id]), /permission denied/);
  const p2 = await one(U.lv, `insert into public.photos (location_id, path, sha256, file_name) values ($1, $2, $3, 'IMG_2.jpeg') returning *`,
    [space.id, `photos/${sha(2)}.jpg`, sha(2)]);
  const p3 = await one(U.lv, `insert into public.photos (location_id, path, sha256, file_name) values ($1, $2, $3, 'IMG_3.jpeg') returning *`,
    [space.id, `photos/${sha(3)}.jpg`, sha(3)]);
  S.p1 = p1; S.p2 = p2; S.p3 = p3;
  assert.equal(await rpcJson(U.lv, 'set_photo_status', { p_ids: [p1.id, p2.id], p_status: 'in_analyse' }), 2);
  const sp = await one(U.ma, `select org_status, photos, photos_queued from public.space_overview where id = $1`, [space.id]);
  assert.equal(sp.org_status, 'in_analyse');
  assert.equal(Number(sp.photos), 3);
  await fails(rpc(U.ma, 'set_photo_status', { p_ids: [p1.id], p_status: 'neu' }), /LGR:not_authorized/);
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
  await fails(rpc(U.ma, 'import_photo_analysis', { p_items: JSON.stringify(items), p_source: 'Test' }), /LGR:not_authorized/);
  const r = await rpcJson(U.lv, 'import_photo_analysis', { p_items: JSON.stringify(items), p_source: 'Claude (Test)' });
  assert.equal(r.matched, 3);
  assert.equal(r.created, 6);
  assert.equal(r.failed, 1);
  assert.equal(r.invalid, 1);
  assert.deepEqual(r.unmatched, ['nicht-importiert.jpeg']);
  const again = await rpcJson(U.lv, 'import_photo_analysis', { p_items: JSON.stringify(items), p_source: 'Claude (Test)' });
  assert.equal(again.created, 0);
  assert.equal(again.existing, 6);
  const p3 = await one(U.ma, `select status, analysis_error from public.photos where id = $1`, [S.p3.id]);
  assert.deepEqual([p3.status, p3.analysis_error], ['fehler', 'Foto unscharf']);
  const dets = (await as(U.ma, `select * from public.detection_overview where space_id = $1 order by name`, [S.space.id])).rows;
  const by = (k) => dets.find((d) => d.obj_key === k);
  assert.equal(by('bosch-gbh-2-28').category_path, 'Maschinen & Geräte › Bohrmaschinen & Bohrhämmer');
  assert.equal(Number(by('bosch-gbh-2-28').same_key_count), 1);
  assert.equal(by('schrauben-box').pos_x, null, 'ungültige Position verworfen');
  assert.equal(by('schrauben-box').quantity_certain, false);
  assert.equal(by('ding').kind, 'unbekannt');
  const p1 = await one(U.ma, `select status, analysis_source, observations from public.photos where id = $1`, [S.p1.id]);
  assert.equal(p1.status, 'analysiert');
  assert.deepEqual(p1.observations, ['Kabel am Boden']);
  const stats = await one(U.ma, `select * from public.org_stats`);
  assert.equal(Number(stats.photos_analyzed), 2);
  assert.equal(Number(stats.detections_unknown), 1);
  assert.equal(Number(stats.duplicate_groups), 1);
  assert.equal(Number(stats.locations_proposed), 1);
  const sp = await one(U.ma, `select org_status, progress from public.space_overview where id = $1`, [S.space.id]);
  assert.equal(sp.org_status, 'zu_pruefen');
  assert.equal(sp.progress, 0);
  S.dets = dets;
});

test('prüfen: bestätigen erzeugt Inventar, unsichere Mengen nie als Bestand, gleiche Objekte verknüpft', async () => {
  const by = (k) => S.dets.find((d) => d.obj_key === k && d.photo_id === S.p1.id);
  await fails(rpc(U.ma, 'review_detection', { p_id: by('bosch-gbh-2-28').id, p_action: 'bestaetigen', p_data: '{}' }), /LGR:not_authorized/);
  // Einzelinventar, sicher, 1 Stück → eine Maschine; das gleiche Objekt auf Foto 2 wird verknüpft
  const r1 = await rpcJson(U.lv, 'review_detection', { p_id: by('bosch-gbh-2-28').id, p_action: 'bestaetigen', p_data: '{}' });
  assert.equal(r1.entity, 'machine');
  assert.equal(r1.codes.length, 1);
  assert.equal(r1.merged, 1);
  const m = await one(U.ma, `select * from public.machine_overview where code = $1`, [r1.codes[0]]);
  assert.equal(m.brand, 'Bosch');
  assert.equal(m.home_location_id, S.space.id);
  assert.equal(m.product_url, 'https://www.bosch-professional.com/ch/de/');
  assert.ok(m.photo_path.startsWith('photos/'), 'Originalfoto aus der Erkennung');
  const other = await one(U.ma, `select status, machine_id from public.detections where photo_id = $1 and obj_key = 'bosch-gbh-2-28'`, [S.p2.id]);
  assert.deepEqual([other.status, other.machine_id], ['zusammengefuehrt', m.id]);
  await fails(rpc(U.lv, 'review_detection', { p_id: by('bosch-gbh-2-28').id, p_action: 'bestaetigen', p_data: '{}' }), /LGR:already_reviewed/);
  // zwei Einzelstücke → zwei Maschinen mit eigenem Code
  const r2 = await rpcJson(U.lv, 'review_detection', { p_id: by('akku-schrauber').id, p_action: 'bestaetigen', p_data: '{}' });
  assert.equal(r2.codes.length, 2);
  assert.notEqual(r2.codes[0], r2.codes[1]);
  // Bestandsartikel mit unsicherer Menge
  await fails(rpc(U.lv, 'review_detection', { p_id: by('schrauben-box').id, p_action: 'bestaetigen', p_data: '{}' }), /LGR:quantity_uncertain/);
  const r3 = await rpcJson(U.lv, 'review_detection', { p_id: by('schrauben-box').id, p_action: 'bestaetigen', p_data: '{"without_stock": true}' });
  const a = await one(U.ma, `select * from public.articles where code = $1`, [r3.codes[0]]);
  assert.equal(Number(a.stock), 0);
  assert.match(a.notes, /Menge noch nicht gezählt/);
  // unbekannt → erst Art festlegen; gezählte Menge eingeben → als Bestand übernommen
  await fails(rpc(U.lv, 'review_detection', { p_id: by('ding').id, p_action: 'bestaetigen', p_data: '{}' }), /LGR:kind_required/);
  const r4 = await rpcJson(U.lv, 'review_detection', { p_id: by('ding').id, p_action: 'bestaetigen',
    p_data: JSON.stringify({ kind: 'bestandsartikel', name: 'Distanzhülsen', quantity: 15, unit: 'Stk' }) });
  const a2 = await one(U.ma, `select * from public.articles where code = $1`, [r4.codes[0]]);
  assert.equal(Number(a2.stock), 15);
  const mv = await one(U.admin, `select type, qty from public.stock_movements where article_id = $1`, [a2.id]);
  assert.deepEqual([mv.type, Number(mv.qty)], ['anlage', 15]);
  // Einrichtung → neuer Lagerort im Raum, mit Kurzcode
  const r5 = await rpcJson(U.lv, 'review_detection', { p_id: by('metallregal').id, p_action: 'bestaetigen',
    p_data: JSON.stringify({ loc_type: 'regal', short_code: 'rg01' }) });
  assert.equal(r5.entity, 'location');
  const loc = await one(U.ma, `select * from public.location_overview where code = $1`, [r5.codes[0]]);
  assert.equal(loc.parent_id, S.space.id);
  assert.equal(loc.code_path, 'WS-RG01');
  S.regal = loc;
  // Protokoll
  const au = await one(U.admin, `select count(*)::int as n from public.audit_log where action = 'ki_bestaetigen'`);
  assert.equal(au.n, 5);
});

test('prüfen: bearbeiten, später, ablehnen, wieder öffnen, zusammenführen, verknüpfen', async () => {
  const add = async (key, name) => (await rpc(U.lv, 'add_detection', { p_photo: S.p2.id, p_data: JSON.stringify({ name, notes: key }) }));
  const d1 = await add('x1', 'Verlängerungskabel');
  assert.equal(d1.source, 'manuell');
  assert.equal(d1.confidence, 'unbekannt');
  const d2 = await add('x2', 'Verlängerungskabel (anderes Foto)');
  await fails(rpc(U.lv, 'review_detection', { p_id: d1.id, p_action: 'bearbeiten', p_data: '{"name": "  "}' }), /LGR:name_required/);
  await fails(rpc(U.lv, 'review_detection', { p_id: d1.id, p_action: 'bearbeiten', p_data: '{"quantity": -1}' }), /LGR:invalid_qty/);
  const e = await rpcJson(U.lv, 'review_detection', { p_id: d1.id, p_action: 'bearbeiten',
    p_data: JSON.stringify({ kind: 'bestandsartikel', quantity: 3, target_location_id: S.regal.id, category_id: S.catKabel }) });
  assert.equal(e.detection.quantity_certain, true);
  assert.equal(e.detection.target_location_id, S.regal.id);
  await rpcJson(U.lv, 'review_detection', { p_id: d2.id, p_action: 'spaeter', p_data: '{}' });
  const z = await rpcJson(U.lv, 'review_detection', { p_id: d2.id, p_action: 'zusammenfuehren', p_data: JSON.stringify({ into: d1.id }) });
  assert.equal(z.detection.status, 'zusammengefuehrt');
  assert.equal(z.detection.merged_into, d1.id);
  const w = await rpcJson(U.lv, 'review_detection', { p_id: d2.id, p_action: 'wiederoeffnen', p_data: '{}' });
  assert.equal(w.detection.status, 'offen');
  const ab = await rpcJson(U.lv, 'review_detection', { p_id: d2.id, p_action: 'ablehnen', p_data: '{"reason": "doppelt fotografiert"}' });
  assert.equal(ab.detection.status, 'abgelehnt');
  assert.match(ab.detection.notes, /doppelt fotografiert/);
  // verknüpfen mit bestehendem Artikel statt neu anlegen
  const v = await rpcJson(U.lv, 'review_detection', { p_id: d1.id, p_action: 'bestaetigen',
    p_data: JSON.stringify({ mode: 'verknuepfen', article_id: S.oldArt.id }) });
  assert.equal(v.entity, 'article');
  assert.deepEqual(v.codes, [S.oldArt.code]);
  const cnt = await one(U.ma, `select count(*)::int as n from public.articles where name = 'Verlängerungskabel'`);
  assert.equal(cnt.n, 0, 'kein Duplikat angelegt');
  await fails(rpc(U.lv, 'review_detection', { p_id: d1.id, p_action: 'unsinn', p_data: '{}' }), /LGR:already_reviewed|LGR:invalid_input/);
});

test('aufgaben, hotspots, sets: Rechte und Protokoll', async () => {
  await fails(as(U.ma, `insert into public.org_tasks (location_id, title) values ($1, 'Kabel sortieren')`, [S.space.id]), /row-level security/);
  const t1 = await one(U.lv, `insert into public.org_tasks (location_id, title, source, photo_id) values ($1, 'Kabel nach Typ sortieren', 'foto_analyse', $2) returning *`, [S.space.id, S.p1.id]);
  assert.equal(t1.created_by, U.lv);
  assert.equal(t1.status, 'offen');
  const t1d = await one(U.lv, `update public.org_tasks set status = 'erledigt' where id = $1 returning *`, [t1.id]);
  assert.equal(t1d.done_by, U.lv);
  assert.ok(t1d.done_at);
  const t1o = await one(U.lv, `update public.org_tasks set status = 'offen' where id = $1 returning *`, [t1.id]);
  assert.equal(t1o.done_by, null);
  await fails(as(U.lv, `update public.org_tasks set done_by = $1 where id = $2`, [U.ma, t1.id]), /permission denied/);
  S.task = t1;
  // Hotspot (Rechteck) auf dem Raumfoto → Regal
  await fails(as(U.ma, `insert into public.photo_hotspots (photo_id, location_id, x, y) values ($1, $2, 0.1, 0.1)`, [S.p1.id, S.regal.id]), /row-level security/);
  await fails(as(U.lv, `insert into public.photo_hotspots (photo_id, location_id, x, y, w) values ($1, $2, 0.1, 0.1, 1.5)`, [S.p1.id, S.regal.id]), /check constraint/);
  const h = await one(U.lv, `insert into public.photo_hotspots (photo_id, location_id, x, y, w, h, label) values ($1, $2, 0.1, 0.2, 0.3, 0.4, 'Regal 01') returning *`, [S.p1.id, S.regal.id]);
  assert.equal(h.created_by, U.lv);
  await as(U.lv, `update public.locations set cover_photo_id = $1 where id = $2`, [S.p1.id, S.space.id]);
  const lo = await one(U.ma, `select cover_photo_path, photo_path from public.location_overview where id = $1`, [S.space.id]);
  assert.equal(lo.cover_photo_path, S.p1.path);
  // Set mit Komponenten
  const set = await one(U.lv, `insert into public.machines (name, is_set) values ('Messkoffer', true) returning *`);
  await one(U.lv, `insert into public.set_components (set_id, article_id, qty) values ($1, $2, 2) returning *`, [set.id, S.oldArt.id]);
  await one(U.lv, `insert into public.set_components (set_id, name) values ($1, 'Spannschlüssel') returning *`, [set.id]);
  await fails(as(U.lv, `insert into public.set_components (set_id) values ($1)`, [set.id]), /set_components_target_chk/);
  await fails(as(U.lv, `insert into public.set_components (set_id, machine_id) values ($1, $1)`, [set.id]), /set_components_self_chk/);
  const so = await one(U.ma, `select component_count from public.machine_overview where id = $1`, [set.id]);
  assert.equal(Number(so.component_count), 2);
  await fails(as(U.ma, `insert into public.set_components (set_id, name) values ($1, 'x')`, [set.id]), /row-level security/);
});

test('raum abschliessen: nur ohne offene Prüfungen/Aufgaben; Status und Fortschritt aus echten Daten', async () => {
  await fails(rpc(U.lv, 'set_location_organized', { p_location: S.space.id, p_done: true }), /LGR:open_items:0\/1/);
  await as(U.lv, `update public.org_tasks set status = 'erledigt' where id = $1`, [S.task.id]);
  let sp = await one(U.ma, `select org_status, progress, detections_done, tasks_done from public.space_overview where id = $1`, [S.space.id]);
  assert.equal(sp.org_status, 'in_organisation');
  assert.equal(sp.progress, 100);
  await fails(rpc(U.ma, 'set_location_organized', { p_location: S.space.id, p_done: true }), /LGR:not_authorized/);
  const l = await rpc(U.lv, 'set_location_organized', { p_location: S.space.id, p_done: true });
  assert.ok(l.organized_at);
  sp = await one(U.ma, `select org_status from public.space_overview where id = $1`, [S.space.id]);
  assert.equal(sp.org_status, 'organisiert');
  // neues offenes Objekt → Raum wieder «zu prüfen»
  await rpc(U.lv, 'add_detection', { p_photo: S.p1.id, p_data: '{"name": "Neues Teil"}' });
  sp = await one(U.ma, `select org_status from public.space_overview where id = $1`, [S.space.id]);
  assert.equal(sp.org_status, 'zu_pruefen');
});

test('ki-import: späterer Fehlversuch setzt ein analysiertes Foto nicht zurück; Leerzeichen im SHA egal', async () => {
  const r = await rpcJson(U.lv, 'import_photo_analysis', { p_items: JSON.stringify([
    { sha256: ` ${sha(1).toUpperCase()} `, file: 'IMG_1.jpeg', status: 'fehler', error: 'Timeout' }]), p_source: 'Test' });
  assert.equal(r.matched, 1);
  const p1 = await one(U.ma, `select status, analysis_error from public.photos where id = $1`, [S.p1.id]);
  assert.deepEqual([p1.status, p1.analysis_error], ['analysiert', null]);
});

test('prüfen: Fotos ohne Lagerort werden nie fotoübergreifend verknüpft', async () => {
  const a = await one(U.lv, `insert into public.photos (path, sha256, file_name) values ($1, $2, 'ohne-ort-a.jpg') returning *`, [`photos/${sha(51)}.jpg`, sha(51)]);
  const b = await one(U.lv, `insert into public.photos (path, sha256, file_name) values ($1, $2, 'ohne-ort-b.jpg') returning *`, [`photos/${sha(52)}.jpg`, sha(52)]);
  const obj = { key: 'gleich', name: 'Kiste', kind: 'bestandsartikel', quantity: 1, quantity_certain: true, confidence: 'sicher' };
  await rpcJson(U.lv, 'import_photo_analysis', { p_items: JSON.stringify([
    { sha256: sha(51), status: 'analysiert', objects: [obj] }, { sha256: sha(52), status: 'analysiert', objects: [obj] }]), p_source: 'Test' });
  const da = await one(U.ma, `select id from public.detections where photo_id = $1`, [a.id]);
  const r = await rpcJson(U.lv, 'review_detection', { p_id: da.id, p_action: 'bestaetigen', p_data: '{}' });
  assert.equal(r.merged, 0);
  const db2 = await one(U.ma, `select status from public.detections where photo_id = $1`, [b.id]);
  assert.equal(db2.status, 'offen');
});

test('gebäudeplan: Planbild zählt nicht als Foto, Bereiche nur beschriftet oder verknüpft, Rechte', async () => {
  const before = await one(U.ma, `select photos_total from public.org_stats`);
  const plan = await one(U.lv, `insert into public.photos (path, sha256, file_name, kind) values ($1, $2, 'eg.png', 'plan') returning *`,
    [`photos/${sha(77)}.jpg`, sha(77)]);
  assert.equal(plan.kind, 'plan');
  const after = await one(U.ma, `select photos_total from public.org_stats`);
  assert.equal(Number(after.photos_total), Number(before.photos_total), 'Plan nicht in Foto-Kennzahlen');
  await fails(as(U.lv, `insert into public.photos (path, sha256, kind) values ('photos/x.png', $1, 'skizze')`, [sha(78)]), /photos_kind_chk/);
  await fails(as(U.ma, `insert into public.floor_plans (name, photo_id) values ('EG', $1)`, [plan.id]), /row-level security/);
  const fp = await one(U.lv, `insert into public.floor_plans (name, sort, photo_id) values ('EG', 10, $1) returning *`, [plan.id]);
  assert.equal(fp.created_by, U.lv);
  // Raum nur beschriftet (noch nicht angelegt) und Raum verknüpft
  await one(U.lv, `insert into public.photo_hotspots (photo_id, x, y, w, h, label) values ($1, 0.3, 0.19, 0.4, 0.16, 'Büro 1') returning *`, [plan.id]);
  await one(U.lv, `insert into public.photo_hotspots (photo_id, location_id, x, y, w, h, label) values ($1, $2, 0.3, 0.69, 0.4, 0.16, 'Büro 3') returning *`, [plan.id, S.space.id]);
  await fails(as(U.lv, `insert into public.photo_hotspots (photo_id, x, y) values ($1, 0.5, 0.5)`, [plan.id]), /label_or_location/);
  const ov = await one(U.ma, `select * from public.floor_plan_overview where id = $1`, [fp.id]);
  assert.equal(ov.photo_path, plan.path);
  assert.deepEqual([Number(ov.area_count), Number(ov.linked_count)], [2, 1]);
  await fails(as(U.lv, `delete from public.photos where id = $1`, [plan.id]), /foreign key|violates/);
  assert.equal((await as(U.lv, `delete from public.floor_plans where id = $1 returning id`, [fp.id])).rows.length, 0, 'nur Admin löscht');
  await fails(asAnon(`select * from public.floor_plan_overview`), /permission denied/);
});

test('fotos: mit bestätigten Objekten nicht löschbar; Mitarbeiter löscht nie', async () => {
  await fails(as(U.lv, `delete from public.photos where id = $1`, [S.p1.id]), /LGR:in_use/);
  const r = await as(U.ma, `delete from public.photos where id = $1 returning id`, [S.p3.id]);
  assert.equal(r.rows.length, 0);
  const r2 = await as(U.lv, `delete from public.photos where id = $1 returning id`, [S.p3.id]);
  assert.equal(r2.rows.length, 1);
});

test('erkennungen: nicht direkt schreibbar; anon sieht nichts', async () => {
  await fails(as(U.admin, `update public.detections set status = 'bestaetigt'`), /permission denied/);
  await fails(as(U.admin, `insert into public.detections (photo_id, obj_key, name) values ($1, 'x', 'x')`, [S.p1.id]), /permission denied/);
  for (const v of ['categories', 'photos', 'detections', 'org_tasks', 'photo_hotspots', 'set_components',
    'space_overview', 'detection_overview', 'org_stats', 'category_paths', 'photo_overview', 'org_task_overview']) {
    await fails(asAnon(`select * from public.${v}`), /permission denied/);
  }
  await fails(asAnon(`select public.review_detection('00000000-0000-0000-0000-000000000000', 'spaeter', '{}')`), /permission denied/);
});
