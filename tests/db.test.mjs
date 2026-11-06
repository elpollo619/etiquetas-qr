// Tests für supabase/schema.sql – laufen gegen PGlite (Postgres in WASM, ein Prozess, eine Verbindung).
// Vor dem Laden des Schemas wird die relevante Supabase-Umgebung nachgebaut:
//   Rollen anon/authenticated, Supabase-Default-Privileges (GRANT ALL an anon/authenticated),
//   Schema auth mit auth.users + auth.uid() (liest den JWT-«sub» wie Supabase), KEIN storage-Schema.
// Ausführen:  cd web/tests && npm install && npm test
//
// Hinweis: Echte Gleichzeitigkeit lässt sich mit PGlite (eine Verbindung) nicht testen. Dafür sorgen im
// Schema der eindeutige Teilindex loans_one_open_per_machine sowie «select … for update» / Advisory-Locks.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';

const SCHEMA = await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8');

const SUPABASE_ENV = `
  create role anon nologin noinherit;
  create role authenticated nologin noinherit;
  grant usage on schema public to anon, authenticated;
  alter default privileges in schema public grant all on tables    to anon, authenticated;
  alter default privileges in schema public grant all on sequences to anon, authenticated;
  alter default privileges in schema public grant all on functions to anon, authenticated;

  create schema auth;
  create table auth.users (
    id                 uuid primary key,
    email              text,
    raw_user_meta_data jsonb default '{}',
    email_confirmed_at timestamptz
  );
  create function auth.uid() returns uuid language sql stable as $$
    select coalesce(
      nullif(current_setting('request.jwt.claim.sub', true), ''),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
    )::uuid
  $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
`;

/** @type {PGlite} */
let db;

// Benutzer
const U = {
  admin: '00000000-0000-4000-8000-000000000001', // erstes Konto → aktiver Admin
  a:     '00000000-0000-4000-8000-000000000002', // Mitarbeiter A («Alex»)
  b:     '00000000-0000-4000-8000-000000000003', // Mitarbeiter B («Bea»)
  lv:    '00000000-0000-4000-8000-000000000004', // Lagerverantwortlicher
  x:     '00000000-0000-4000-8000-000000000005', // bleibt inaktiv
};

// Gemeinsamer Zustand zwischen den (sequenziell laufenden) Tests
const S = {};

// ---------------------------------------------------------------------------------------------------
//  Hilfsfunktionen
// ---------------------------------------------------------------------------------------------------
const su = (sql, params = []) => db.query(sql, params); // als Superuser (wie SQL-Editor / Auth-Server)

/** Abfrage als angemeldeter Benutzer (Rolle authenticated, JWT-Claims mit sub = userId). */
async function as(userId, sql, params = []) {
  await db.exec('reset role');
  await db.query(`select set_config('request.jwt.claims', $1, false)`,
    [JSON.stringify({ sub: userId, role: 'authenticated' })]);
  await db.exec('set role authenticated');
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec('reset role');
    await db.query(`select set_config('request.jwt.claims', '', false)`);
  }
}

/** Abfrage als anonymer Besucher (Rolle anon, keine Claims). */
async function asAnon(sql, params = []) {
  await db.exec('reset role');
  await db.query(`select set_config('request.jwt.claims', '', false)`);
  await db.exec('set role anon');
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec('reset role');
  }
}

/** RPC wie PostgREST: Funktionsaufruf mit benannten Parametern → erste Zeile. */
async function rpc(userId, fn, args = {}) {
  const keys = Object.keys(args);
  const sql = `select * from public.${fn}(${keys.map((k, i) => `${k} => $${i + 1}`).join(', ')})`;
  const r = await as(userId, sql, keys.map((k) => args[k]));
  return r.rows[0];
}

async function one(userId, sql, params = []) {
  return (await as(userId, sql, params)).rows[0];
}

/** Erwartet einen Fehler, dessen Meldung zum Muster passt (z. B. /^LGR:not_authorized$/). */
async function fails(promise, pattern, code) {
  await assert.rejects(promise, (e) => {
    assert.match(String(e.message), pattern);
    if (code) assert.equal(e.code, code);
    return true;
  });
}
const DENIED = /permission denied/;
const RLS = /row-level security/;

async function createUser(id, email, meta = {}, confirmed = true) {
  await su(`insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at) values ($1, $2, $3::jsonb, $4)`,
    [id, email, JSON.stringify(meta), confirmed ? new Date().toISOString() : null]);
  return (await su(`select * from public.profiles where id = $1`, [id])).rows[0];
}

const num = (v) => (v === null || v === undefined ? v : Number(v));
const inDays = (d) => new Date(Date.now() + d * 86400000).toISOString();

// ---------------------------------------------------------------------------------------------------
//  Setup
// ---------------------------------------------------------------------------------------------------
before(async () => {
  db = await PGlite.create();
  await db.exec(SUPABASE_ENV);
  await db.exec(SCHEMA);  // erster Lauf
  await db.exec(SCHEMA);  // zweiter Lauf: Skript muss wiederholbar sein
});

after(async () => {
  await db?.close();
});

// ---------------------------------------------------------------------------------------------------
//  Schema / Verträge
// ---------------------------------------------------------------------------------------------------
test('schema: läuft zweimal ohne Fehler, ohne storage-Schema; Trigger/Policies nicht doppelt', async () => {
  const st = await su(`select count(*)::int n from pg_namespace where nspname = 'storage'`);
  assert.equal(st.rows[0].n, 0);
  const trg = await su(`select count(*)::int n from pg_trigger where tgname = 'on_auth_user_created'`);
  assert.equal(trg.rows[0].n, 1);
  const pol = await su(`select count(*)::int n from pg_policies where schemaname = 'public' and policyname = 'machines_read'`);
  assert.equal(pol.rows[0].n, 1);
  const rls = await su(`select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
                         where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`);
  assert.deepEqual(rls.rows, [], 'alle Tabellen haben RLS');
});

test('vertrag: Funktionssignaturen und Rückgabetypen unverändert', async () => {
  const expected = {
    machine_checkout: ['p_machine uuid, p_request uuid, p_due timestamp with time zone, p_note text, p_borrower uuid', 'loans'],
    machine_return: ['p_machine uuid, p_request uuid, p_condition text, p_note text', 'loans'],
    machine_set_status: ['p_machine uuid, p_status text, p_note text', 'machines'],
    admin_correct_loan: ['p_loan uuid, p_checked_out_at timestamp with time zone, p_due_at timestamp with time zone, p_returned_at timestamp with time zone, p_reason text', 'loans'],
    stock_move: ['p_article uuid, p_type text, p_qty numeric, p_request uuid, p_note text, p_to_location uuid', 'stock_movements'],
    update_my_profile: ['p_full_name text, p_lang text', 'profiles'],
    admin_update_profile: ['p_id uuid, p_full_name text, p_role text, p_active boolean', 'profiles'],
    set_primary_attachment: ['p_id uuid', 'attachments'],
    inventory_count: ['p_inventory uuid, p_article uuid, p_counted numeric', 'inventory_counts'],
    inventory_check_machine: ['p_inventory uuid, p_machine uuid, p_result text, p_note text', 'inventory_machine_checks'],
    inventory_close: ['p_inventory uuid, p_apply boolean', 'inventories'],
  };
  const r = await su(`select p.proname, pg_get_function_identity_arguments(p.oid) args, p.prorettype::regtype::text ret
                        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                       where n.nspname = 'public' and p.proname = any($1)`, [Object.keys(expected)]);
  assert.equal(r.rows.length, Object.keys(expected).length, 'keine Überladungen, alle vorhanden');
  for (const row of r.rows) {
    assert.deepEqual([row.args, row.ret], expected[row.proname], row.proname);
  }
});

test('vertrag: Ansichten haben alle Spalten aus ARCHITECTURE.md', async () => {
  const expected = {
    location_paths: 'id path depth',
    location_overview: 'id code name type parent_id notes archived path depth photo_path',
    article_overview: 'id code name description art_no category brand model size color usage label_text unit stock min_stock location_id notes archived location_path low_stock photo_path',
    machine_overview: 'id code name category brand model serial_no inventory_no home_location_id status condition condition_note notes archived location_path open_loan_id open_borrower_id open_borrower_name open_since open_due_at overdue last_borrower_id last_borrower_name last_checked_out_at last_returned_at last_returned_by_name last_return_condition photo_path',
    loan_overview: 'id machine_id borrower_id checked_out_at due_at checkout_note returned_at returned_by return_condition return_note corrected created_by machine_code machine_name machine_status borrower_name returned_by_name created_by_name overdue',
    movement_overview: 'id article_id type qty stock_before stock_after from_location_id to_location_id user_id note created_at article_code article_name unit user_name from_path to_path',
  };
  for (const [view, cols] of Object.entries(expected)) {
    const r = await su(`select column_name from information_schema.columns where table_schema = 'public' and table_name = $1`, [view]);
    const have = new Set(r.rows.map((x) => x.column_name));
    for (const c of cols.split(' ')) assert.ok(have.has(c), `${view}.${c} fehlt`);
  }
});

// ---------------------------------------------------------------------------------------------------
//  Mitarbeiter / Profile
// ---------------------------------------------------------------------------------------------------
test('profile: nur die eingetragene, bestätigte E-Mail wird erster Admin; alle anderen inaktive Mitarbeiter', async () => {
  // Ein Fremder, der sich zuerst registriert, wird NICHT Admin (früher: erstes Konto = Admin)
  const stranger = await createUser(randomUUID(), 'fremd@example.com', { full_name: 'Fremd' }, true);
  assert.deepEqual([stranger.role, stranger.active], ['mitarbeiter', false]);

  await su(`insert into public.bootstrap_admins (email) values ('Anna@Firma.ch')`);
  // Bootstrap-Tabelle ist für Benutzer unsichtbar und unveränderbar
  await fails(as(U.a, `select * from public.bootstrap_admins`), DENIED);
  await fails(asAnon(`insert into public.bootstrap_admins (email) values ('x@y.ch')`), DENIED);

  // Registrierung mit unbestätigter E-Mail → noch kein Admin; nach Bestätigung → Admin, Eintrag verbraucht
  let admin = await createUser(U.admin, 'anna@firma.ch', { full_name: 'Anna Admin' }, false);
  assert.deepEqual([admin.role, admin.active], ['mitarbeiter', false]);
  await su(`update auth.users set email_confirmed_at = now() where id = $1`, [U.admin]);
  admin = (await su(`select * from public.profiles where id = $1`, [U.admin])).rows[0];
  assert.equal(admin.role, 'admin');
  assert.equal(admin.active, true);
  assert.equal(admin.full_name, 'Anna Admin');
  assert.equal((await su(`select count(*)::int as n from public.bootstrap_admins`)).rows[0].n, 0, 'Eintrag nur einmal gültig');

  const a = await createUser(U.a, 'alex@firma.ch', { full_name: '  Alex A ', lang: 'pt' });
  assert.deepEqual([a.role, a.active, a.full_name, a.lang], ['mitarbeiter', false, 'Alex A', 'pt']);
  const b = await createUser(U.b, 'bea@firma.ch', { full_name: 'Bea B' });
  assert.deepEqual([b.role, b.active], ['mitarbeiter', false]);
  const lv = await createUser(U.lv, 'lukas@firma.ch', { full_name: 'Lukas Lager', lang: 'xx' });
  assert.equal(lv.lang, 'de', 'ungültige Sprache → de');
  const x = await createUser(U.x, 'xaver@firma.ch');
  assert.equal(x.full_name, 'xaver', 'ohne Namen → Teil vor @');

  // Konto ohne E-Mail (z. B. Telefon-Login) darf die Registrierung nicht scheitern lassen
  const noMail = await createUser(randomUUID(), null);
  assert.ok(noMail && noMail.full_name.length > 0);
  assert.equal(noMail.active, false);
});

test('profile: inaktiver Benutzer sieht nur sich selbst', async () => {
  const r = await as(U.a, `select id from public.profiles`);
  assert.deepEqual(r.rows.map((x) => x.id), [U.a]);
  const all = await as(U.admin, `select id from public.profiles`);
  assert.ok(all.rows.length >= 5);
});

test('profile: Admin gibt frei, Rollen, Schutz des letzten Admins', async () => {
  await fails(rpc(U.a, 'admin_update_profile', { p_id: U.a, p_full_name: 'Alex A', p_role: 'admin', p_active: true }), /^LGR:not_authorized$/);

  const a = await rpc(U.admin, 'admin_update_profile', { p_id: U.a, p_full_name: 'Alex A', p_role: 'mitarbeiter', p_active: true });
  assert.equal(a.active, true);
  await rpc(U.admin, 'admin_update_profile', { p_id: U.b, p_full_name: 'Bea B', p_role: 'mitarbeiter', p_active: true });
  const lv = await rpc(U.admin, 'admin_update_profile', { p_id: U.lv, p_full_name: 'Lukas Lager', p_role: 'lagerverantwortlicher', p_active: true });
  assert.equal(lv.role, 'lagerverantwortlicher');

  // letzter Admin: weder herabstufen noch sperren
  await fails(rpc(U.admin, 'admin_update_profile', { p_id: U.admin, p_full_name: 'Anna Admin', p_role: 'mitarbeiter', p_active: true }), /^LGR:last_admin$/);
  await fails(rpc(U.admin, 'admin_update_profile', { p_id: U.admin, p_full_name: 'Anna Admin', p_role: 'admin', p_active: false }), /^LGR:last_admin$/);
  // Lagerverantwortlicher ist kein Admin
  await fails(rpc(U.lv, 'admin_update_profile', { p_id: U.b, p_full_name: 'Bea B', p_role: 'admin', p_active: true }), /^LGR:not_authorized$/);
  await fails(rpc(U.admin, 'admin_update_profile', { p_id: U.b, p_full_name: 'Bea B', p_role: 'chef', p_active: true }), /^LGR:invalid_role$/);
  await fails(rpc(U.admin, 'admin_update_profile', { p_id: U.b, p_full_name: '  ', p_role: 'mitarbeiter', p_active: true }), /^LGR:name_required$/);

  // mit zweitem Admin darf der erste herabgestuft werden – danach wieder zurück
  await rpc(U.admin, 'admin_update_profile', { p_id: U.b, p_full_name: 'Bea B', p_role: 'admin', p_active: true });
  await rpc(U.b, 'admin_update_profile', { p_id: U.admin, p_full_name: 'Anna Admin', p_role: 'mitarbeiter', p_active: true });
  await fails(rpc(U.b, 'admin_update_profile', { p_id: U.b, p_full_name: 'Bea B', p_role: 'mitarbeiter', p_active: true }), /^LGR:last_admin$/);
  await rpc(U.b, 'admin_update_profile', { p_id: U.admin, p_full_name: 'Anna Admin', p_role: 'admin', p_active: true });
  await rpc(U.admin, 'admin_update_profile', { p_id: U.b, p_full_name: 'Bea B', p_role: 'mitarbeiter', p_active: true });

  const roles = await su(`select id, role, active from public.profiles where id = any($1) order by id`, [[U.admin, U.a, U.b, U.lv, U.x]]);
  assert.deepEqual(roles.rows.map((r) => [r.role, r.active]), [
    ['admin', true], ['mitarbeiter', true], ['mitarbeiter', true], ['lagerverantwortlicher', true], ['mitarbeiter', false],
  ]);
  const log = await su(`select count(*)::int n from public.audit_log where action = 'mitarbeiter' and entity = 'profiles'`);
  assert.ok(log.rows[0].n >= 3);
  // Profile können nicht direkt geändert werden
  await fails(as(U.admin, `update public.profiles set role = 'admin' where id = $1`, [U.a]), DENIED);
});

test('profile: eigenes Profil ändern (auch inaktiv)', async () => {
  const p = await rpc(U.x, 'update_my_profile', { p_full_name: ' Xaver X ', p_lang: 'es' });
  assert.deepEqual([p.full_name, p.lang, p.active], ['Xaver X', 'es', false]);
  await fails(rpc(U.a, 'update_my_profile', { p_full_name: 'Alex', p_lang: 'en' }), /^LGR:invalid_lang$/);
  await fails(rpc(U.a, 'update_my_profile', { p_full_name: '', p_lang: 'de' }), /^LGR:name_required$/);
});

// ---------------------------------------------------------------------------------------------------
//  Lagerorte
// ---------------------------------------------------------------------------------------------------
test('lagerorte: Codes L-0001…, Pfade, Zyklus verhindert, Code unveränderlich', async () => {
  const main = await one(U.lv, `insert into public.locations (name, type) values ('Hauptlager', 'lager') returning *`);
  assert.equal(main.code, 'L-0001');
  assert.equal(main.created_by, U.lv);
  const regal = await one(U.lv, `insert into public.locations (name, type, parent_id) values ('Regal B', 'regal', $1) returning *`, [main.id]);
  assert.equal(regal.code, 'L-0002');
  const fach = await one(U.lv, `insert into public.locations (name, type, parent_id) values ('Fach 03', 'fach', $1) returning *`, [regal.id]);
  assert.equal(fach.code, 'L-0003');
  Object.assign(S, { locMain: main.id, locRegal: regal.id, locFach: fach.id });

  const p = await one(U.a, `select path, depth from public.location_paths where id = $1`, [regal.id]);
  assert.deepEqual([p.path, p.depth], ['Hauptlager / Regal B', 1]);
  const o = await one(U.a, `select code, path, depth from public.location_overview where id = $1`, [fach.id]);
  assert.deepEqual([o.code, o.path, o.depth], ['L-0003', 'Hauptlager / Regal B / Fach 03', 2]);

  await fails(as(U.lv, `update public.locations set parent_id = $1 where id = $2`, [fach.id, main.id]), /^LGR:location_cycle$/);
  await fails(as(U.lv, `update public.locations set parent_id = id where id = $1`, [regal.id]), /^LGR:location_cycle$/);
  // Code-Spalte ist für Benutzer gar nicht änderbar (Spaltenrechte); der Trigger schützt zusätzlich
  await fails(as(U.lv, `update public.locations set code = 'L-0099' where id = $1`, [main.id]), /permission denied for table locations/);
  await fails(su(`update public.locations set code = 'L-0099' where id = $1`, [main.id]), /^LGR:code_immutable$/);
  await fails(as(U.lv, `update public.locations set created_by = null where id = $1`, [main.id]), /permission denied for table locations/);

  // eigener Code wird normalisiert; Nummerierung läuft danach weiter
  const custom = await one(U.lv, `insert into public.locations (name, code) values ('Fahrzeug 1', ' l-0010 ') returning code`);
  assert.equal(custom.code, 'L-0010');
  const next = await one(U.lv, `insert into public.locations (name, type) values ('Temporär', 'temporaer') returning id, code`);
  assert.equal(next.code, 'L-0011');
  S.locTemp = next.id;
  // Codes mit falschem Präfix würden beim Scannen als anderer Typ erkannt
  await fails(as(U.lv, `insert into public.locations (name, code) values ('Falsch', 'M-0001')`), /^LGR:invalid_code$/);
  // sehr lange Nummer darf die automatische Nummerierung nicht kaputt machen
  await one(U.lv, `insert into public.locations (name, code) values ('Lange Nummer', 'L-99999999999')`);
  const after = await one(U.lv, `insert into public.locations (name) values ('Nach langer Nummer') returning code`);
  assert.equal(after.code, 'L-0012');
  // ab 10000 nicht abschneiden (lpad kürzt sonst «10000» zu «1000»)
  await one(U.lv, `insert into public.locations (name, code) values ('Ende Bereich', 'L-9999')`);
  const big = await one(U.lv, `insert into public.locations (name) values ('Fünfstellig') returning code`);
  assert.equal(big.code, 'L-10000');
  await fails(as(U.lv, `insert into public.locations (name, code) values ('Leerzeichen', 'L-00 01')`), /^LGR:invalid_code$/);

  // Mitarbeiter darf keine Lagerorte anlegen/ändern/löschen
  await fails(as(U.a, `insert into public.locations (name) values ('Privat')`), RLS);
  const upd = await as(U.a, `update public.locations set name = 'X' where id = $1`, [main.id]);
  assert.equal(upd.affectedRows, 0);
  const del = await as(U.lv, `delete from public.locations where id = $1`, [S.locTemp]);
  assert.equal(del.affectedRows, 0, 'nur Admin darf löschen');
});

// ---------------------------------------------------------------------------------------------------
//  Maschinen
// ---------------------------------------------------------------------------------------------------
test('maschinen: anlegen, Rechte, Status nicht direkt änderbar', async () => {
  const m1 = await one(U.lv, `insert into public.machines (name, category, home_location_id) values ('Bohrhammer', 'Bohren', $1) returning *`, [S.locRegal]);
  assert.deepEqual([m1.code, m1.status, m1.condition, m1.created_by], ['M-0001', 'verfuegbar', 'ok', U.lv]);
  const m2 = await one(U.admin, `insert into public.machines (name, home_location_id) values ('Akkuschrauber', $1) returning *`, [S.locFach]);
  assert.equal(m2.code, 'M-0002');
  const m3 = await one(U.lv, `insert into public.machines (name) values ('Laser') returning *`);
  Object.assign(S, { m1: m1.id, m2: m2.id, m3: m3.id });

  await fails(as(U.a, `insert into public.machines (name) values ('Meine Säge')`), RLS);
  await fails(as(U.lv, `insert into public.machines (name, status) values ('Schon weg', 'ausgeliehen')`), /^LGR:invalid_status$/);
  await fails(as(U.lv, `insert into public.machines (name, code) values ('Falsch', 'INV-0001')`), /^LGR:invalid_code$/);
  await fails(as(U.lv, `update public.machines set status = 'verloren' where id = $1`, [m1.id]), DENIED);
  await fails(as(U.lv, `update public.machines set code = 'M-0100' where id = $1`, [m1.id]), DENIED);

  const r = await as(U.lv, `update public.machines set name = 'Bohrhammer Hilti' where id = $1`, [m1.id]);
  assert.equal(r.affectedRows, 1);
  const mUpd = await as(U.a, `update public.machines set name = 'Meins' where id = $1`, [m1.id]);
  assert.equal(mUpd.affectedRows, 0, 'Mitarbeiter: RLS → 0 Zeilen');

  const audit = await su(`select action, details from public.audit_log where entity = 'machines' and entity_id = $1 order by id`, [m1.id]);
  assert.deepEqual(audit.rows.map((x) => x.action), ['insert', 'update']);
  assert.deepEqual(audit.rows[1].details.name, { alt: 'Bohrhammer', neu: 'Bohrhammer Hilti' });

  const ov = await one(U.a, `select location_path, open_loan_id from public.machine_overview where id = $1`, [m1.id]);
  assert.equal(ov.location_path, 'Hauptlager / Regal B');
  assert.equal(ov.open_loan_id, null);
});

test('maschinen: inaktiver Benutzer sieht nichts und darf nicht ausleihen', async () => {
  const r = await as(U.x, `select * from public.machines`);
  assert.equal(r.rows.length, 0);
  const v = await as(U.x, `select * from public.machine_overview`);
  assert.equal(v.rows.length, 0);
  await fails(rpc(U.x, 'machine_checkout', { p_machine: S.m1, p_request: randomUUID() }), /^LGR:not_authorized$/);
  await fails(rpc(U.x, 'machine_return', { p_machine: S.m1 }), /^LGR:not_authorized$/);
  await fails(rpc(U.x, 'stock_move', { p_article: randomUUID(), p_type: 'entnahme', p_qty: 1 }), /^LGR:not_authorized$/);
});

// ---------------------------------------------------------------------------------------------------
//  Ausleihen / Zurückgeben
// ---------------------------------------------------------------------------------------------------
test('ausleihen: Anfrage-ID verhindert Doppelbuchung, zweite Person → not_available', async () => {
  S.r1 = randomUUID();
  const due = inDays(3);
  const l1 = await rpc(U.a, 'machine_checkout', { p_machine: S.m1, p_request: S.r1, p_due: due, p_note: ' Baustelle Nord ' });
  assert.equal(l1.borrower_id, U.a);
  assert.equal(l1.created_by, U.a);
  assert.equal(l1.checkout_note, 'Baustelle Nord');
  assert.equal(l1.returned_at, null);
  S.loan1 = l1.id;

  const m = await su(`select status from public.machines where id = $1`, [S.m1]);
  assert.equal(m.rows[0].status, 'ausgeliehen');

  const again = await rpc(U.a, 'machine_checkout', { p_machine: S.m1, p_request: S.r1 });
  assert.equal(again.id, l1.id, 'gleiche Anfrage → gleiche Ausleihe');
  const cnt = await su(`select count(*)::int n from public.loans where machine_id = $1`, [S.m1]);
  assert.equal(cnt.rows[0].n, 1);

  await fails(rpc(U.b, 'machine_checkout', { p_machine: S.m1, p_request: randomUUID() }), /^LGR:not_available:ausgeliehen$/);

  const audit = await su(`select count(*)::int n from public.audit_log where action = 'ausleihen' and entity_id = $1`, [S.m1]);
  assert.equal(audit.rows[0].n, 1, 'Ausleihe genau einmal protokolliert, keine zusätzliche update-Zeile');
  const upd = await su(`select count(*)::int n from public.audit_log where action = 'update' and entity_id = $1 and details ? 'status'`, [S.m1]);
  assert.equal(upd.rows[0].n, 0);
});

test('ausleihen: direkte Einträge verboten, für andere nur Lagerverantwortliche', async () => {
  await fails(as(U.a, `insert into public.loans (machine_id, borrower_id) values ($1, $2)`, [S.m2, U.a]), DENIED);
  await fails(rpc(U.a, 'machine_checkout', { p_machine: S.m2, p_request: randomUUID(), p_borrower: U.b }), /^LGR:not_authorized$/);
  await fails(rpc(U.lv, 'machine_checkout', { p_machine: S.m2, p_request: randomUUID(), p_borrower: U.x }), /^LGR:invalid_borrower$/);
  await fails(rpc(U.a, 'machine_checkout', { p_machine: S.m2, p_request: randomUUID(), p_due: inDays(-1) }), /^LGR:due_in_past$/);
  await fails(rpc(U.a, 'machine_checkout', { p_machine: randomUUID(), p_request: randomUUID() }), /^LGR:not_found$/);

  const l = await rpc(U.lv, 'machine_checkout', { p_machine: S.m2, p_request: randomUUID(), p_borrower: U.b });
  assert.deepEqual([l.borrower_id, l.created_by], [U.b, U.lv]);
  // eigener Ausleiher explizit angegeben ist erlaubt
  const back = await rpc(U.b, 'machine_return', { p_machine: S.m2, p_request: randomUUID() });
  assert.equal(back.id, l.id);
  const own = await rpc(U.a, 'machine_checkout', { p_machine: S.m2, p_request: randomUUID(), p_borrower: U.a });
  assert.equal(own.borrower_id, U.a);
  await rpc(U.a, 'machine_return', { p_machine: S.m2, p_request: randomUUID() });
});

test('zurückgeben: stellvertretend, Mängel brauchen Notiz, Idempotenz', async () => {
  await fails(rpc(U.b, 'machine_return', { p_machine: S.m1, p_request: randomUUID(), p_condition: 'maengel' }), /^LGR:note_required$/);
  await fails(rpc(U.b, 'machine_return', { p_machine: S.m1, p_request: randomUUID(), p_condition: 'kaputt', p_note: 'x' }), /^LGR:invalid_condition$/);

  S.rr1 = randomUUID();
  const l = await rpc(U.b, 'machine_return', { p_machine: S.m1, p_request: S.rr1, p_condition: 'maengel', p_note: 'Kabel beschädigt' });
  assert.equal(l.id, S.loan1);
  assert.equal(l.borrower_id, U.a);
  assert.equal(l.returned_by, U.b);
  assert.equal(l.return_condition, 'maengel');
  assert.equal(l.return_note, 'Kabel beschädigt');
  assert.ok(l.returned_at instanceof Date);

  const m = await su(`select status, condition, condition_note from public.machines where id = $1`, [S.m1]);
  assert.deepEqual(m.rows[0], { status: 'verfuegbar', condition: 'maengel', condition_note: 'Kabel beschädigt' });

  const again = await rpc(U.b, 'machine_return', { p_machine: S.m1, p_request: S.rr1, p_condition: 'maengel', p_note: 'Kabel beschädigt' });
  assert.equal(again.id, S.loan1);
  await fails(rpc(U.b, 'machine_return', { p_machine: S.m1, p_request: randomUUID() }), /^LGR:not_on_loan$/);

  const audit = await su(`select details from public.audit_log where action = 'zurueckgeben' and entity_id = $1`, [S.m1]);
  assert.equal(audit.rows.length, 1);
  assert.equal(audit.rows[0].details.stellvertretend, true);
});

test('ansichten: machine_overview und loan_overview zeigen Ausleiher und Rückgeber', async () => {
  const o = await one(U.a, `select * from public.machine_overview where id = $1`, [S.m1]);
  assert.equal(o.last_borrower_id, U.a);
  assert.equal(o.last_borrower_name, 'Alex A');
  assert.equal(o.last_returned_by_name, 'Bea B');
  assert.equal(o.last_return_condition, 'maengel');
  assert.equal(o.open_loan_id, null);
  assert.equal(o.open_borrower_id, null);
  assert.equal(o.open_borrower_name, null);
  assert.equal(o.open_since, null);
  assert.equal(o.overdue, false);

  const r = await as(U.a, `select * from public.loan_overview where machine_id = $1`, [S.m1]);
  assert.equal(r.rows.length, 1);
  const l = r.rows[0];
  assert.deepEqual([l.borrower_name, l.returned_by_name, l.created_by_name, l.machine_code, l.machine_status, l.overdue],
    ['Alex A', 'Bea B', 'Alex A', 'M-0001', 'verfuegbar', false]);

  // offene Ausleihe erscheint als open_*
  const l2 = await rpc(U.a, 'machine_checkout', { p_machine: S.m3, p_request: randomUUID(), p_due: inDays(1) });
  const o3 = await one(U.b, `select * from public.machine_overview where id = $1`, [S.m3]);
  assert.deepEqual([o3.open_loan_id, o3.open_borrower_id, o3.open_borrower_name, o3.overdue], [l2.id, U.a, 'Alex A', false]);
  assert.equal(o3.status, 'ausgeliehen');
  await rpc(U.a, 'machine_return', { p_machine: S.m3, p_request: randomUUID() });
});

test('defekt: Rückgabe defekt sperrt Maschine, nur Lagerverantwortliche setzen Status', async () => {
  await rpc(U.a, 'machine_checkout', { p_machine: S.m1, p_request: randomUUID() });
  await fails(rpc(U.lv, 'machine_set_status', { p_machine: S.m1, p_status: 'wartung' }), /^LGR:on_loan$/);
  await rpc(U.a, 'machine_return', { p_machine: S.m1, p_request: randomUUID(), p_condition: 'defekt', p_note: 'Motor raucht' });
  let m = (await su(`select status, condition, condition_note from public.machines where id = $1`, [S.m1])).rows[0];
  assert.deepEqual(m, { status: 'defekt', condition: 'defekt', condition_note: 'Motor raucht' });

  await fails(rpc(U.b, 'machine_checkout', { p_machine: S.m1, p_request: randomUUID() }), /^LGR:not_available:defekt$/);
  await fails(rpc(U.a, 'machine_set_status', { p_machine: S.m1, p_status: 'verfuegbar' }), /^LGR:not_authorized$/);
  await fails(rpc(U.lv, 'machine_set_status', { p_machine: S.m1, p_status: 'ausgeliehen' }), /^LGR:invalid_status$/);

  const ok = await rpc(U.lv, 'machine_set_status', { p_machine: S.m1, p_status: 'verfuegbar', p_note: null });
  assert.equal(ok.status, 'verfuegbar');
  assert.equal(ok.condition, 'ok');
  assert.equal(ok.condition_note, null, 'repariert → alte Schadensnotiz weg');
  const log = await su(`select details from public.audit_log where action = 'status' and entity_id = $1 order by id desc limit 1`, [S.m1]);
  assert.deepEqual([log.rows[0].details.alt, log.rows[0].details.neu], ['defekt', 'verfuegbar']);
});

test('reserviert: Mitarbeiter → reserved, Lagerverantwortlicher darf ausleihen', async () => {
  await rpc(U.lv, 'machine_set_status', { p_machine: S.m1, p_status: 'reserviert', p_note: 'für Montag' });
  await fails(rpc(U.a, 'machine_checkout', { p_machine: S.m1, p_request: randomUUID() }), /^LGR:reserved$/);
  const l = await rpc(U.lv, 'machine_checkout', { p_machine: S.m1, p_request: randomUUID(), p_borrower: U.a });
  assert.equal(l.borrower_id, U.a);
  await rpc(U.a, 'machine_return', { p_machine: S.m1, p_request: randomUUID() });
  const m = (await su(`select status from public.machines where id = $1`, [S.m1])).rows[0];
  assert.equal(m.status, 'verfuegbar');
});

// ---------------------------------------------------------------------------------------------------
//  Artikel / Lagerbewegungen
// ---------------------------------------------------------------------------------------------------
test('artikel: Anlage mit Bestand, Entnahme, Idempotenz, Rechte', async () => {
  const art = await one(U.lv, `insert into public.articles (name, unit, stock, location_id) values ('Schrauben 4x40', 'Stk', 100, $1) returning *`, [S.locRegal]);
  assert.equal(art.code, 'INV-0001');
  S.art = art.id;
  const mv0 = await su(`select * from public.stock_movements where article_id = $1`, [art.id]);
  assert.equal(mv0.rows.length, 1);
  assert.deepEqual([mv0.rows[0].type, num(mv0.rows[0].qty), num(mv0.rows[0].stock_before), num(mv0.rows[0].stock_after), mv0.rows[0].user_id],
    ['anlage', 100, 0, 100, U.lv]);

  await fails(as(U.a, `insert into public.articles (name) values ('Privat')`), RLS);
  await fails(as(U.lv, `insert into public.articles (name, code) values ('Falsch', 'M-0009')`), /^LGR:invalid_code$/);

  S.q1 = randomUUID();
  const e = await rpc(U.a, 'stock_move', { p_article: art.id, p_type: 'entnahme', p_qty: 10, p_request: S.q1, p_note: '  ' });
  assert.deepEqual([e.type, num(e.qty), num(e.stock_before), num(e.stock_after), e.user_id, e.note], ['entnahme', -10, 100, 90, U.a, null]);
  const again = await rpc(U.a, 'stock_move', { p_article: art.id, p_type: 'entnahme', p_qty: 10, p_request: S.q1 });
  assert.equal(again.id, e.id);
  let st = await su(`select stock from public.articles where id = $1`, [art.id]);
  assert.equal(num(st.rows[0].stock), 90);

  await fails(rpc(U.a, 'stock_move', { p_article: art.id, p_type: 'entnahme', p_qty: 1000, p_request: randomUUID() }), /^LGR:insufficient_stock$/);
  await fails(rpc(U.a, 'stock_move', { p_article: art.id, p_type: 'entnahme', p_qty: 0 }), /^LGR:invalid_qty$/);
  await fails(rpc(U.a, 'stock_move', { p_article: art.id, p_type: 'zugang', p_qty: -5 }), /^LGR:invalid_qty$/);
  await fails(rpc(U.a, 'stock_move', { p_article: art.id, p_type: 'inventur', p_qty: 5 }), /^LGR:invalid_type$/);
  await fails(rpc(U.a, 'stock_move', { p_article: art.id, p_type: 'korrektur', p_qty: 50, p_note: 'x' }), /^LGR:not_authorized$/);
  await fails(rpc(U.a, 'stock_move', { p_article: art.id, p_type: 'umlagerung', p_qty: 0, p_to_location: S.locFach }), /^LGR:not_authorized$/);

  const z = await rpc(U.a, 'stock_move', { p_article: art.id, p_type: 'zugang', p_qty: 5, p_request: randomUUID() });
  assert.equal(num(z.stock_after), 95);

  await fails(as(U.a, `update public.articles set stock = 1000 where id = $1`, [art.id]), DENIED);
  await fails(as(U.lv, `update public.articles set stock = 1000 where id = $1`, [art.id]), DENIED);
  const nameUpd = await as(U.a, `update public.articles set name = 'Gehackt' where id = $1`, [art.id]);
  assert.equal(nameUpd.affectedRows, 0, 'RLS: Mitarbeiter ändert 0 Zeilen');
  st = await su(`select name, stock from public.articles where id = $1`, [art.id]);
  assert.deepEqual([st.rows[0].name, num(st.rows[0].stock)], ['Schrauben 4x40', 95]);
});

test('artikel: Korrektur braucht Begründung, Umlagerung ändert Lagerort', async () => {
  await fails(rpc(U.lv, 'stock_move', { p_article: S.art, p_type: 'korrektur', p_qty: 80, p_request: randomUUID() }), /^LGR:reason_required$/);
  const k = await rpc(U.lv, 'stock_move', { p_article: S.art, p_type: 'korrektur', p_qty: 80, p_request: randomUUID(), p_note: 'Zählfehler' });
  assert.deepEqual([k.type, num(k.qty), num(k.stock_before), num(k.stock_after), k.note], ['korrektur', -15, 95, 80, 'Zählfehler']);

  await fails(rpc(U.lv, 'stock_move', { p_article: S.art, p_type: 'umlagerung', p_qty: 0, p_to_location: randomUUID() }), /^LGR:invalid_location$/);
  const u = await rpc(U.lv, 'stock_move', { p_article: S.art, p_type: 'umlagerung', p_qty: 0, p_request: randomUUID(), p_to_location: S.locFach });
  assert.deepEqual([u.type, num(u.qty), u.from_location_id, u.to_location_id], ['umlagerung', 0, S.locRegal, S.locFach]);
  const a = await su(`select location_id, stock from public.articles where id = $1`, [S.art]);
  assert.deepEqual([a.rows[0].location_id, num(a.rows[0].stock)], [S.locFach, 80]);

  const mo = await one(U.a, `select * from public.movement_overview where id = $1`, [u.id]);
  assert.deepEqual([mo.article_code, mo.user_name, mo.from_path, mo.to_path],
    ['INV-0001', 'Lukas Lager', 'Hauptlager / Regal B', 'Hauptlager / Regal B / Fach 03']);

  const r = await as(U.lv, `update public.articles set min_stock = 80 where id = $1`, [S.art]);
  assert.equal(r.affectedRows, 1);
  const ao = await one(U.a, `select low_stock, location_path from public.article_overview where id = $1`, [S.art]);
  assert.deepEqual([ao.low_stock, ao.location_path], [true, 'Hauptlager / Regal B / Fach 03']);
});

// ---------------------------------------------------------------------------------------------------
//  Korrektur von Ausleihen
// ---------------------------------------------------------------------------------------------------
test('admin_correct_loan: Begründung, Protokoll, keine zweite offene Ausleihe', async () => {
  const l1 = (await su(`select * from public.loans where id = $1`, [S.loan1])).rows[0];
  const args = (over = {}) => ({
    p_loan: S.loan1, p_checked_out_at: l1.checked_out_at.toISOString(), p_due_at: inDays(5),
    p_returned_at: l1.returned_at.toISOString(), p_reason: 'Datum falsch erfasst', ...over,
  });

  await fails(rpc(U.lv, 'admin_correct_loan', args()), /^LGR:not_authorized$/);
  await fails(rpc(U.admin, 'admin_correct_loan', args({ p_reason: '   ' })), /^LGR:reason_required$/);
  await fails(rpc(U.admin, 'admin_correct_loan', args({ p_returned_at: new Date(l1.checked_out_at.getTime() - 60000).toISOString() })), /^LGR:invalid_dates$/);
  // Rückgabe in der Zukunft ergibt keinen Sinn (Maschine wäre sonst «verfügbar», obwohl noch draussen)
  await fails(rpc(U.admin, 'admin_correct_loan', args({ p_returned_at: inDays(2) })), /^LGR:invalid_dates$/);
  await fails(rpc(U.admin, 'admin_correct_loan', args({ p_loan: randomUUID() })), /^LGR:not_found$/);

  const c = await rpc(U.admin, 'admin_correct_loan', args());
  assert.equal(c.corrected, true);
  assert.equal(c.returned_by, U.b, 'Rückgeber bleibt');
  const log = await su(`select user_id, details from public.audit_log where action = 'korrektur' and entity = 'loans' and entity_id = $1`, [S.loan1]);
  assert.equal(log.rows.length, 1);
  assert.equal(log.rows[0].user_id, U.admin);
  assert.equal(log.rows[0].details.grund, 'Datum falsch erfasst');

  // Wiedereröffnen, während eine andere Ausleihe derselben Maschine offen ist → abgelehnt
  const open = await rpc(U.b, 'machine_checkout', { p_machine: S.m1, p_request: randomUUID() });
  await fails(rpc(U.admin, 'admin_correct_loan', args({ p_returned_at: null })), /^LGR:not_available:ausgeliehen$/);
  const still = (await su(`select returned_at from public.loans where id = $1`, [S.loan1])).rows[0];
  assert.ok(still.returned_at, 'unverändert zurückgegeben');

  // offene Ausleihe per Korrektur schliessen → Maschine verfügbar
  const closed = await rpc(U.admin, 'admin_correct_loan', {
    p_loan: open.id, p_checked_out_at: null, p_due_at: null, p_returned_at: new Date(Date.now() + 1000).toISOString(), p_reason: 'vergessen zurückzubuchen',
  });
  assert.equal(closed.returned_by, U.admin);
  assert.equal(closed.return_condition, 'ok');
  let m = (await su(`select status from public.machines where id = $1`, [S.m1])).rows[0];
  assert.equal(m.status, 'verfuegbar');

  // wieder öffnen (keine andere offene Ausleihe) → Maschine ausgeliehen, Rückgabedaten leer
  const reopened = await rpc(U.admin, 'admin_correct_loan', {
    p_loan: open.id, p_checked_out_at: null, p_due_at: null, p_returned_at: null, p_reason: 'doch noch draussen',
  });
  assert.deepEqual([reopened.returned_at, reopened.returned_by, reopened.return_condition, reopened.return_note], [null, null, null, null]);
  m = (await su(`select status from public.machines where id = $1`, [S.m1])).rows[0];
  assert.equal(m.status, 'ausgeliehen');
  const back = await rpc(U.b, 'machine_return', { p_machine: S.m1, p_request: randomUUID() });
  assert.equal(back.id, open.id);
});

// ---------------------------------------------------------------------------------------------------
//  Inventur
// ---------------------------------------------------------------------------------------------------
test('inventur: zählen, abschliessen mit Buchung, danach gesperrt', async () => {
  await fails(as(U.a, `insert into public.inventories (name) values ('Meine Inventur')`), RLS);
  await fails(as(U.lv, `insert into public.inventories (name, status) values ('X', 'abgeschlossen')`), DENIED);
  const inv = await one(U.lv, `insert into public.inventories (name, note) values ('Jahresinventur 2026', 'Halle 1') returning *`);
  assert.deepEqual([inv.status, inv.started_by, inv.applied], ['offen', U.lv, false]);
  S.inv = inv.id;

  const stock0 = num((await su(`select stock from public.articles where id = $1`, [S.art])).rows[0].stock); // 80
  const c = await rpc(U.a, 'inventory_count', { p_inventory: inv.id, p_article: S.art, p_counted: 70 });
  assert.deepEqual([num(c.expected), num(c.counted), c.counted_by], [stock0, 70, U.a]);
  await fails(rpc(U.a, 'inventory_count', { p_inventory: inv.id, p_article: S.art, p_counted: -1 }), /^LGR:invalid_qty$/);
  await fails(rpc(U.a, 'inventory_count', { p_inventory: inv.id, p_article: randomUUID(), p_counted: 1 }), /^LGR:not_found$/);

  const chk = await rpc(U.a, 'inventory_check_machine', { p_inventory: inv.id, p_machine: S.m2, p_result: 'fehlt', p_note: 'nicht auffindbar' });
  assert.equal(chk.result, 'fehlt');
  await fails(rpc(U.a, 'inventory_check_machine', { p_inventory: inv.id, p_machine: randomUUID(), p_result: 'vorhanden' }), /^LGR:not_found$/);
  await fails(rpc(U.a, 'inventory_check_machine', { p_inventory: inv.id, p_machine: S.m3, p_result: 'weg' }), /^LGR:invalid_status$/);

  // Entnahme zwischen Zählung und Abschluss: Differenz (gezählt − erwartet) wird gebucht
  await rpc(U.a, 'stock_move', { p_article: S.art, p_type: 'entnahme', p_qty: 5, p_request: randomUUID() });

  await fails(rpc(U.a, 'inventory_close', { p_inventory: inv.id, p_apply: true }), /^LGR:not_authorized$/);
  const closed = await rpc(U.lv, 'inventory_close', { p_inventory: inv.id, p_apply: true });
  assert.deepEqual([closed.status, closed.applied, closed.closed_by], ['abgeschlossen', true, U.lv]);

  const a = (await su(`select stock from public.articles where id = $1`, [S.art])).rows[0];
  assert.equal(num(a.stock), stock0 - 5 + (70 - stock0));
  const mv = (await su(`select * from public.stock_movements where article_id = $1 and type = 'inventur'`, [S.art])).rows;
  assert.equal(mv.length, 1);
  assert.deepEqual([num(mv[0].qty), num(mv[0].stock_before), num(mv[0].stock_after), mv[0].user_id], [70 - stock0, stock0 - 5, num(a.stock), U.lv]);
  const cnt = (await su(`select applied from public.inventory_counts where inventory_id = $1`, [inv.id])).rows[0];
  assert.equal(cnt.applied, true);

  const m2 = (await su(`select status from public.machines where id = $1`, [S.m2])).rows[0];
  assert.equal(m2.status, 'verloren');

  await fails(rpc(U.a, 'inventory_count', { p_inventory: inv.id, p_article: S.art, p_counted: 1 }), /^LGR:inventory_closed$/);
  await fails(rpc(U.a, 'inventory_check_machine', { p_inventory: inv.id, p_machine: S.m3, p_result: 'vorhanden' }), /^LGR:inventory_closed$/);
  await fails(rpc(U.lv, 'inventory_close', { p_inventory: inv.id, p_apply: true }), /^LGR:inventory_closed$/);
});

test('inventur: ohne Buchung abschliessen ändert nichts (auch p_apply = null)', async () => {
  const before = num((await su(`select stock from public.articles where id = $1`, [S.art])).rows[0].stock);
  const inv = await one(U.admin, `insert into public.inventories (name) values ('Stichprobe') returning id`);
  await rpc(U.b, 'inventory_count', { p_inventory: inv.id, p_article: S.art, p_counted: before + 50 });
  const closed = await rpc(U.lv, 'inventory_close', { p_inventory: inv.id, p_apply: null });
  assert.deepEqual([closed.status, closed.applied], ['abgeschlossen', false]);
  const after = num((await su(`select stock from public.articles where id = $1`, [S.art])).rows[0].stock);
  assert.equal(after, before);
});

// ---------------------------------------------------------------------------------------------------
//  Anhänge
// ---------------------------------------------------------------------------------------------------
test('anhänge: hochladen, Hauptfoto nur Lagerverantwortliche, löschen nur Lagerverantwortliche', async () => {
  const p1 = await one(U.a, `insert into public.attachments (entity, entity_id, kind, path) values ('machine', $1, 'photo', $2) returning *`,
    [S.m1, `machine/${S.m1}/a.jpg`]);
  assert.equal(p1.uploaded_by, U.a);
  const p2 = await one(U.lv, `insert into public.attachments (entity, entity_id, kind, path) values ('machine', $1, 'photo', $2) returning *`,
    [S.m1, `machine/${S.m1}/b.jpg`]);
  await fails(rpc(U.a, 'set_primary_attachment', { p_id: p2.id }), /^LGR:not_authorized$/);
  const prim = await rpc(U.lv, 'set_primary_attachment', { p_id: p2.id });
  assert.equal(prim.is_primary, true);
  const ov = await one(U.a, `select photo_path from public.machine_overview where id = $1`, [S.m1]);
  assert.equal(ov.photo_path, `machine/${S.m1}/b.jpg`);

  const delOther = await as(U.b, `delete from public.attachments where id = $1`, [p1.id]);
  assert.equal(delOther.affectedRows, 0);
  // auch eigene Dateien darf ein Mitarbeiter nicht löschen (die Datei im Storage könnte er ohnehin nicht entfernen)
  const delOwn = await as(U.a, `delete from public.attachments where id = $1`, [p1.id]);
  assert.equal(delOwn.affectedRows, 0);
  const delStaff = await as(U.lv, `delete from public.attachments where id = $1`, [p1.id]);
  assert.equal(delStaff.affectedRows, 1);
});

// ---------------------------------------------------------------------------------------------------
//  Protokoll, unveränderliche Verläufe, Rechte
// ---------------------------------------------------------------------------------------------------
test('protokoll: Lagerverantwortliche lesen, Mitarbeiter sehen nichts', async () => {
  const staff = await as(U.lv, `select * from public.audit_log`);
  assert.ok(staff.rows.length > 10);
  const emp = await as(U.a, `select * from public.audit_log`);
  assert.equal(emp.rows.length, 0);
  await fails(as(U.admin, `insert into public.audit_log (action, entity) values ('fake', 'x')`), DENIED);
});

test('verläufe: loans, stock_movements, audit_log nicht änder-/löschbar (auch nicht vom Admin)', async () => {
  for (const uid of [U.a, U.lv, U.admin]) {
    await fails(as(uid, `update public.stock_movements set qty = 0`), DENIED);
    await fails(as(uid, `delete from public.stock_movements`), DENIED);
    await fails(as(uid, `update public.loans set borrower_id = $1`, [uid]), DENIED);
    await fails(as(uid, `delete from public.loans`), DENIED);
    await fails(as(uid, `update public.audit_log set action = 'x'`), DENIED);
    await fails(as(uid, `delete from public.audit_log`), DENIED);
    await fails(as(uid, `truncate public.audit_log`), DENIED);
    await fails(as(uid, `truncate public.loans cascade`), DENIED);
  }
  const r = await su(`select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
                       where n.nspname = 'public' and c.relkind = 'r'
                         and (has_table_privilege('authenticated', c.oid, 'TRUNCATE')
                              or has_table_privilege('authenticated', c.oid, 'TRIGGER')
                              or has_table_privilege('authenticated', c.oid, 'REFERENCES'))`);
  assert.deepEqual(r.rows, [], 'keine TRUNCATE/TRIGGER/REFERENCES-Rechte');
  const seq = await su(`select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
                         where n.nspname = 'public' and c.relkind = 'S'
                           and (has_sequence_privilege('anon', c.oid, 'USAGE,SELECT,UPDATE')
                                or has_sequence_privilege('authenticated', c.oid, 'UPDATE'))`);
  assert.deepEqual(seq.rows, [], 'Sequenzen nicht manipulierbar');
});

test('anon: keine Tabelle/Ansicht lesbar, keine Funktion ausführbar', async () => {
  const rels = await su(`select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
                          where n.nspname = 'public' and c.relkind in ('r', 'v') order by 1`);
  assert.ok(rels.rows.length >= 17);
  for (const { relname } of rels.rows) {
    await fails(asAnon(`select * from public.${relname} limit 1`), DENIED);
  }
  await fails(asAnon(`select * from public.machine_checkout(p_machine => $1, p_request => $2)`, [S.m3, randomUUID()]), /permission denied for function/);
  await fails(asAnon(`insert into public.machines (name) values ('anon')`), DENIED);

  const fns = await su(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                         where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'EXECUTE')`);
  assert.deepEqual(fns.rows, [], 'anon darf keine public-Funktion ausführen');
  const trg = await su(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                         where n.nspname = 'public' and p.prorettype = 'trigger'::regtype
                           and has_function_privilege('authenticated', p.oid, 'EXECUTE')`);
  assert.deepEqual(trg.rows, [], 'Triggerfunktionen nicht direkt aufrufbar');
});

test('protokoll: Funktion schaltet das Protokoll nur für ihre eigene Änderung ab (gleiche Transaktion)', async () => {
  await db.exec('reset role');
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: U.lv })]);
  await db.exec('set role authenticated');
  try {
    await db.exec(`begin;
      select public.machine_set_status(p_machine => '${S.m3}', p_status => 'wartung', p_note => 'Service');
      update public.machines set notes = 'nach Service prüfen' where id = '${S.m3}';
      commit;`);
  } finally {
    await db.exec('reset role');
    await db.query(`select set_config('request.jwt.claims', '', false)`);
  }
  const r = await su(`select action, details from public.audit_log where entity_id = $1 and action in ('status', 'update') order by id desc limit 2`, [S.m3]);
  assert.deepEqual(r.rows.map((x) => x.action).sort(), ['status', 'update']);
  assert.deepEqual(r.rows.find((x) => x.action === 'update').details.notes, { alt: null, neu: 'nach Service prüfen' });
  await rpc(U.lv, 'machine_set_status', { p_machine: S.m3, p_status: 'verfuegbar' });
});

test('schema: erneutes Ausführen mit Daten behält Daten und Rechte', async () => {
  const count = async () => (await su(`select (select count(*) from public.loans)::int l, (select count(*) from public.stock_movements)::int s,
                                              (select count(*) from public.audit_log)::int a, (select count(*) from public.profiles)::int p`)).rows[0];
  const before = await count();
  await db.exec(SCHEMA);
  assert.deepEqual(await count(), before);
  await fails(asAnon(`select * from public.machine_overview`), DENIED);
  await fails(as(U.lv, `update public.machines set status = 'verloren' where id = $1`, [S.m3]), DENIED);
  const ov = await as(U.a, `select * from public.machine_overview`);
  assert.equal(ov.rows.length, 3);
  // Nummerierung läuft nach erneutem Ausführen weiter
  const m4 = await one(U.lv, `insert into public.machines (name) values ('Kompressor') returning code`);
  assert.equal(m4.code, 'M-0004');
});

// ---------------------------------------------------------------------------------------------------
//  Sicherheitsprüfung (Review): NaN/Infinity, Anlagen
// ---------------------------------------------------------------------------------------------------
test('mengen: NaN, Infinity und riesige Werte werden abgewiesen', async () => {
  const art = await one(U.lv, `insert into public.articles (name, stock) values ('NaN-Test', 5) returning id`);
  for (const bad of ['NaN', 'Infinity', '-Infinity', '1e15']) {
    await fails(rpc(U.a, 'stock_move', { p_article: art.id, p_type: 'zugang', p_qty: bad }), /^LGR:invalid_qty$/);
    await fails(rpc(U.a, 'stock_move', { p_article: art.id, p_type: 'entnahme', p_qty: bad }), /^LGR:invalid_qty$/);
    await fails(rpc(U.lv, 'stock_move', { p_article: art.id, p_type: 'korrektur', p_qty: bad, p_note: 'x' }), /^LGR:invalid_qty$/);
  }
  await fails(as(U.lv, `update public.articles set min_stock = 'NaN' where id = $1`, [art.id]), /articles_min_stock_finite/);
  await fails(as(U.lv, `insert into public.articles (name, stock) values ('NaN2', 'NaN')`), /articles_stock_finite/);
  const s = await one(U.a, `select stock from public.articles where id = $1`, [art.id]);
  assert.equal(Number(s.stock), 5);
  const inv = await one(U.lv, `insert into public.inventories (name) values ('NaN-Inventur') returning id`);
  await fails(rpc(U.a, 'inventory_count', { p_inventory: inv.id, p_article: art.id, p_counted: 'NaN' }), /^LGR:invalid_qty$/);
  S.nanArticle = art.id;
});

test('anlagen: Hauptfoto und Zeitpunkt setzt der Server; nur Lagerverantwortliche löschen', async () => {
  const id = S.nanArticle;
  const ins = (user, path, extra = '') => as(user,
    `insert into public.attachments (entity, entity_id, kind, path${extra ? ', ' + extra.split('=')[0] : ''})
     values ('article', $1, 'photo', $2${extra ? ', ' + extra.split('=')[1] : ''}) returning id, is_primary, created_at, uploaded_by`, [id, path]);
  await fails(ins(U.a, 'article/x/1.jpg', 'is_primary=true'), DENIED);
  await fails(ins(U.a, 'article/x/2.jpg', "created_at='2099-01-01'"), DENIED);
  const p1 = (await ins(U.a, 'article/x/3.jpg')).rows[0];
  const p2 = (await ins(U.a, 'article/x/4.jpg')).rows[0];
  assert.equal(p1.is_primary, true, 'erstes Foto = Hauptfoto');
  assert.equal(p2.is_primary, false);
  assert.equal(p1.uploaded_by, U.a);
  assert.ok(new Date(p1.created_at) <= new Date(Date.now() + 1000));
  const del = await as(U.a, `delete from public.attachments where id = $1 returning id`, [p2.id]);
  assert.equal(del.rows.length, 0, 'Mitarbeiter löscht nichts');
  const delStaff = await as(U.lv, `delete from public.attachments where id = $1 returning id`, [p2.id]);
  assert.equal(delStaff.rows.length, 1);
});

test('einladungen: eingeladene E-Mail ist nach Bestätigung sofort aktiv mit ihrer Rolle', async () => {
  // nur Admins sehen/ändern die Freigabeliste
  await fails(as(U.lv, `insert into public.invites (email, role) values ('x@firma.ch', 'admin')`), RLS);
  assert.equal((await as(U.a, `select * from public.invites`)).rows.length, 0);
  await fails(asAnon(`select * from public.invites`), DENIED);
  await as(U.admin, `insert into public.invites (email, role) values ('neu.lager@firma.ch', 'lagerverantwortlicher'), ('chef2@firma.ch', 'admin')`);
  await fails(as(U.admin, `insert into public.invites (email) values ('Gross@Firma.ch')`), /invites_email_check/);
  assert.equal((await as(U.admin, `select * from public.invites`)).rows.length, 2);

  // bestätigt registriert (z. B. «Add user» mit Auto-Confirm) → sofort aktiv
  const n = await createUser(randomUUID(), 'Neu.Lager@firma.ch', { full_name: 'Neu Lager' }, true);
  assert.deepEqual([n.role, n.active], ['lagerverantwortlicher', true]);
  // unbestätigt → erst nach Bestätigung
  const cid = randomUUID();
  const c = await createUser(cid, 'chef2@firma.ch', { full_name: 'Chef Zwei' }, false);
  assert.deepEqual([c.role, c.active], ['mitarbeiter', false]);
  await su(`update auth.users set email_confirmed_at = now() where id = $1`, [cid]);
  const c2 = (await su(`select role, active from public.profiles where id = $1`, [cid])).rows[0];
  assert.deepEqual([c2.role, c2.active], ['admin', true]);
  assert.equal((await su(`select count(*)::int as n from public.invites`)).rows[0].n, 0, 'Einladungen verbraucht');
  // nicht eingeladene Person bleibt wartend
  const z = await createUser(randomUUID(), 'zufall@example.com', {}, true);
  assert.deepEqual([z.role, z.active], ['mitarbeiter', false]);
});
