-- =====================================================================
--  Lagerverwaltung · Datenbankschema für Supabase
--  Ausführen: Supabase → SQL Editor → «New query» → alles einfügen → «Run».
--  Das Skript kann erneut ausgeführt werden (Aktualisierungen); Daten bleiben erhalten.
-- =====================================================================

-- ---------------------------------------------------------------------
--  Mitarbeiter (Profile zu den Supabase-Konten)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null,
  email       text,
  role        text not null default 'mitarbeiter' check (role in ('admin','lagerverantwortlicher','mitarbeiter')),
  active      boolean not null default false,
  lang        text not null default 'de' check (lang in ('de','pt','es')),
  created_at  timestamptz not null default now()
);

create or replace function public.current_role_name() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and active
$$;
create or replace function public.is_active_user() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and active)
$$;
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.current_role_name() in ('admin','lagerverantwortlicher'), false)
$$;
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.current_role_name() = 'admin', false)
$$;

-- Erster Administrator: Die E-Mail-Adresse wird einmalig im SQL Editor eingetragen
--   insert into public.bootstrap_admins (email) values ('chef@firma.ch');
-- Sobald dieses Konto seine E-Mail bestätigt hat, wird es aktiver Administrator und der Eintrag gelöscht.
-- Alle anderen Konten starten als inaktive Mitarbeiter und müssen freigegeben werden.
-- (Früher wurde einfach das erste Konto Admin – bei öffentlicher Adresse könnte das ein Fremder sein.)
create table if not exists public.bootstrap_admins (
  email       text primary key,
  created_at  timestamptz not null default now()
);
alter table public.bootstrap_admins enable row level security;

-- Einladungen (Freigabeliste): Wer sich mit einer dieser E-Mails registriert und sie bestätigt,
-- ist sofort aktiv – mit der hinterlegten Rolle. Jeder wählt sein eigenes Passwort. Einladung gilt einmal.
--   insert into public.invites (email, role) values ('name@firma.ch', 'mitarbeiter');
create table if not exists public.invites (
  email       text primary key check (email = lower(trim(email)) and email like '%_@_%'),
  role        text not null default 'mitarbeiter' check (role in ('admin','lagerverantwortlicher','mitarbeiter')),
  created_at  timestamptz not null default now()
);
alter table public.invites enable row level security;

create or replace function public.promote_bootstrap_admin(p_user uuid, p_email text) returns void
language plpgsql security definer set search_path = public as $$
declare v_role text;
begin
  if p_email is null then return; end if;
  if exists (select 1 from public.bootstrap_admins where lower(email) = lower(p_email)) then
    update public.profiles set role = 'admin', active = true where id = p_user;
    delete from public.bootstrap_admins where lower(email) = lower(p_email);
    insert into public.audit_log (user_id, action, entity, entity_id, details)
    values (p_user, 'mitarbeiter', 'profiles', p_user, jsonb_build_object('erster_admin', true));
    return;
  end if;
  select role into v_role from public.invites where email = lower(trim(p_email));
  if found then
    update public.profiles set role = v_role, active = true where id = p_user;
    delete from public.invites where email = lower(trim(p_email));
    insert into public.audit_log (user_id, action, entity, entity_id, details)
    values (p_user, 'mitarbeiter', 'profiles', p_user, jsonb_build_object('einladung', true, 'rolle', v_role));
  end if;
end $$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_lang  text := coalesce(new.raw_user_meta_data->>'lang', 'de');
begin
  if v_lang not in ('de','pt','es') then v_lang := 'de'; end if;
  insert into public.profiles (id, full_name, email, role, active, lang)
  values (new.id,
          -- Konto ohne E-Mail (z. B. Telefon) darf die Registrierung nicht scheitern lassen
          coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
                   nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
                   'Mitarbeiter'),
          new.email, 'mitarbeiter', false, v_lang)
  on conflict (id) do nothing;
  if new.email_confirmed_at is not null then
    perform public.promote_bootstrap_admin(new.id, new.email);
  end if;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- E-Mail bestätigt → ggf. erster Administrator
create or replace function public.handle_user_confirmed() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.email_confirmed_at is not null and old.email_confirmed_at is null then
    perform public.promote_bootstrap_admin(new.id, new.email);
  end if;
  return new;
end $$;
drop trigger if exists on_auth_user_confirmed on auth.users;
create trigger on_auth_user_confirmed after update of email_confirmed_at on auth.users
  for each row execute function public.handle_user_confirmed();

-- ---------------------------------------------------------------------
--  Protokoll (Audit-Log) – wird nie überschrieben
-- ---------------------------------------------------------------------
create table if not exists public.audit_log (
  id         bigint generated always as identity primary key,
  at         timestamptz not null default now(),
  user_id    uuid,
  action     text not null,
  entity     text not null,
  entity_id  uuid,
  details    jsonb
);
create index if not exists audit_log_at_idx on public.audit_log (at desc);
create index if not exists audit_log_entity_idx on public.audit_log (entity, entity_id);

-- ---------------------------------------------------------------------
--  Lagerorte (hierarchisch: Hauptlager → Regal A → Fach 02 → Box 03)
-- ---------------------------------------------------------------------
create table if not exists public.locations (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  name        text not null check (length(trim(name)) > 0),
  type        text not null default 'lager'
              check (type in ('lager','raum','bereich','regal','schrank','tablar','fach','schublade','box','behaelter',
                                'werkzeugwand','halterung','arbeitsplatz','fahrzeug','container','temporaer')),
  parent_id   uuid references public.locations(id) on delete restrict,
  notes       text,
  archived    boolean not null default false,
  created_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists locations_parent_idx on public.locations (parent_id);

-- ---------------------------------------------------------------------
--  Artikel / Material (Verbrauchsmaterial mit Lagerbestand)
-- ---------------------------------------------------------------------
create table if not exists public.articles (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique,
  name         text not null check (length(trim(name)) > 0),
  description  text,
  art_no       text,
  category     text,
  brand        text,
  model        text,
  size         text,
  color        text,
  usage        text,
  label_text   text,
  unit         text not null default 'Stk',
  stock        numeric not null default 0 check (stock >= 0),
  min_stock    numeric check (min_stock is null or min_stock >= 0),
  location_id  uuid references public.locations(id) on delete restrict,
  notes        text,
  archived     boolean not null default false,
  created_by   uuid references public.profiles(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists articles_location_idx on public.articles (location_id);

-- ---------------------------------------------------------------------
--  Maschinen und Werkzeuge
-- ---------------------------------------------------------------------
create table if not exists public.machines (
  id                uuid primary key default gen_random_uuid(),
  code              text not null unique,
  name              text not null check (length(trim(name)) > 0),
  category          text,
  brand             text,
  model             text,
  serial_no         text,
  inventory_no      text,
  home_location_id  uuid references public.locations(id) on delete restrict,
  status            text not null default 'verfuegbar'
                    check (status in ('verfuegbar','ausgeliehen','reserviert','wartung','defekt','verloren')),
  condition         text not null default 'ok' check (condition in ('ok','maengel','defekt')),
  condition_note    text,
  notes             text,
  archived          boolean not null default false,
  created_by        uuid references public.profiles(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists machines_location_idx on public.machines (home_location_id);

-- ---------------------------------------------------------------------
--  Ausleihen (Nutzungsverlauf). Pro Maschine höchstens EINE offene Ausleihe.
-- ---------------------------------------------------------------------
create table if not exists public.loans (
  id                uuid primary key default gen_random_uuid(),
  machine_id        uuid not null references public.machines(id) on delete restrict,
  borrower_id       uuid not null references public.profiles(id),
  checked_out_at    timestamptz not null default now(),
  due_at            timestamptz,
  checkout_note     text,
  returned_at       timestamptz,
  returned_by       uuid references public.profiles(id),
  return_condition  text check (return_condition in ('ok','maengel','defekt')),
  return_note       text,
  checkout_request  uuid unique,     -- verhindert doppelte Buchungen bei wiederholtem Scannen
  return_request    uuid unique,
  corrected         boolean not null default false,
  created_by        uuid references public.profiles(id),
  constraint loans_dates_chk check (returned_at is null or returned_at >= checked_out_at)
);
create unique index if not exists loans_one_open_per_machine on public.loans (machine_id) where returned_at is null;
create index if not exists loans_borrower_idx on public.loans (borrower_id, checked_out_at desc);
create index if not exists loans_machine_idx on public.loans (machine_id, checked_out_at desc);

-- ---------------------------------------------------------------------
--  Lagerbewegungen (Zugang, Entnahme, Umlagerung, Korrektur, Inventur)
-- ---------------------------------------------------------------------
create table if not exists public.stock_movements (
  id                bigint generated always as identity primary key,
  article_id        uuid not null references public.articles(id) on delete restrict,
  type              text not null check (type in ('anlage','zugang','entnahme','umlagerung','korrektur','inventur')),
  qty               numeric not null,            -- Veränderung (+/-)
  stock_before      numeric not null,
  stock_after       numeric not null,
  from_location_id  uuid references public.locations(id),
  to_location_id    uuid references public.locations(id),
  user_id           uuid references public.profiles(id),
  note              text,
  request_id        uuid unique,
  created_at        timestamptz not null default now()
);
create index if not exists stock_movements_article_idx on public.stock_movements (article_id, created_at desc);
create index if not exists stock_movements_user_idx on public.stock_movements (user_id, created_at desc);

-- ---------------------------------------------------------------------
--  Fotos und Dokumente (Dateien liegen im Storage-Bucket «media»)
-- ---------------------------------------------------------------------
create table if not exists public.attachments (
  id           uuid primary key default gen_random_uuid(),
  entity       text not null check (entity in ('article','machine','location')),
  entity_id    uuid not null,
  kind         text not null default 'photo' check (kind in ('photo','document','damage')),
  path         text not null unique,
  file_name    text,
  mime         text,
  size_bytes   bigint,
  is_primary   boolean not null default false,
  note         text,
  loan_id      uuid references public.loans(id),
  uploaded_by  uuid references public.profiles(id),
  created_at   timestamptz not null default now()
);
create index if not exists attachments_entity_idx on public.attachments (entity, entity_id);

-- ---------------------------------------------------------------------
--  Inventur
-- ---------------------------------------------------------------------
create table if not exists public.inventories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) > 0),
  status      text not null default 'offen' check (status in ('offen','abgeschlossen')),
  note        text,
  started_by  uuid references public.profiles(id),
  started_at  timestamptz not null default now(),
  closed_by   uuid references public.profiles(id),
  closed_at   timestamptz,
  applied     boolean not null default false
);
create table if not exists public.inventory_counts (
  id            uuid primary key default gen_random_uuid(),
  inventory_id  uuid not null references public.inventories(id) on delete cascade,
  article_id    uuid not null references public.articles(id),
  expected      numeric not null,
  counted       numeric not null check (counted >= 0),
  counted_by    uuid references public.profiles(id),
  counted_at    timestamptz not null default now(),
  applied       boolean not null default false,
  unique (inventory_id, article_id)
);
create table if not exists public.inventory_machine_checks (
  id            uuid primary key default gen_random_uuid(),
  inventory_id  uuid not null references public.inventories(id) on delete cascade,
  machine_id    uuid not null references public.machines(id),
  result        text not null check (result in ('vorhanden','fehlt','defekt','ausgeliehen')),
  note          text,
  checked_by    uuid references public.profiles(id),
  checked_at    timestamptz not null default now(),
  unique (inventory_id, machine_id)
);

-- =====================================================================
--  Lager organisieren (Erweiterung November 2026)
--  Kategorien, Fotoimport, KI-Erkennung, Organisationsaufgaben, Foto-Bereiche (Hotspots),
--  Sets mit Komponenten, Verantwortliche, Kurzcodes für Lagerorte.
--  Nur additive Änderungen: neue Tabellen und neue Spalten. Bestehende Daten bleiben unverändert.
-- =====================================================================

-- Kategorien (hierarchisch: «IT & Elektronik» → «Kabel & Adapter» → «HDMI-Kabel»)
create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  parent_id   uuid references public.categories(id) on delete restrict,
  name        text not null check (length(trim(name)) between 1 and 80),
  sort        int not null default 0,
  archived    boolean not null default false,
  created_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index if not exists categories_name_uniq
  on public.categories (coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));

-- Lagerorte: weitere Typen (Bereich, Schrank, Tablar, Schublade, Werkzeugwand, Halterung, Arbeitsplatz, Container)
do $$
begin
  alter table public.locations drop constraint if exists locations_type_check;
  alter table public.locations add constraint locations_type_check check (type in (
    'lager','raum','bereich','regal','schrank','tablar','fach','schublade','box','behaelter',
    'werkzeugwand','halterung','arbeitsplatz','fahrzeug','container','temporaer'));
end $$;
-- Kurzcode je Ebene (HL, RG01, FA02, BX03 → «HL-RG01-FA02-BX03»). Der interne Code (L-0001, QR) bleibt immer gleich.
alter table public.locations add column if not exists short_code     text;
alter table public.locations add column if not exists responsible_id uuid references public.profiles(id) on delete set null;
alter table public.locations add column if not exists organized_at   timestamptz;
alter table public.locations add column if not exists organized_by   uuid references public.profiles(id) on delete set null;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'locations_short_code_chk') then
    alter table public.locations add constraint locations_short_code_chk
      check (short_code is null or short_code ~ '^[A-Z0-9]{1,10}$');
  end if;
end $$;
create unique index if not exists locations_short_code_uniq
  on public.locations (coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), short_code)
  where short_code is not null;

-- Einzelinventar (Maschinen/Geräte/IT) und Bestandsartikel: Kategorie, Verantwortliche, Herstellerseite
alter table public.machines add column if not exists category_id    uuid references public.categories(id) on delete restrict;
alter table public.machines add column if not exists responsible_id uuid references public.profiles(id) on delete set null;
alter table public.machines add column if not exists is_set         boolean not null default false;
alter table public.machines add column if not exists product_url    text;
alter table public.articles add column if not exists category_id    uuid references public.categories(id) on delete restrict;
alter table public.articles add column if not exists product_url    text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'machines_product_url_chk') then
    alter table public.machines add constraint machines_product_url_chk
      check (product_url is null or product_url ~* '^https?://[^\s]+$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'articles_product_url_chk') then
    alter table public.articles add constraint articles_product_url_chk
      check (product_url is null or product_url ~* '^https?://[^\s]+$');
  end if;
end $$;
create index if not exists machines_category_idx on public.machines (category_id);
create index if not exists articles_category_idx on public.articles (category_id);
create index if not exists machines_responsible_idx on public.machines (responsible_id);

-- Sets: Komponenten eines Sets (Koffer, Bohrmaschine mit Akkus und Ladegerät, Messkit …)
create table if not exists public.set_components (
  id          uuid primary key default gen_random_uuid(),
  set_id      uuid not null references public.machines(id) on delete cascade,
  machine_id  uuid references public.machines(id) on delete restrict,
  article_id  uuid references public.articles(id) on delete restrict,
  name        text check (name is null or length(trim(name)) between 1 and 200),
  qty         numeric not null default 1 check (qty > 0 and qty < 1e6),
  note        text,
  sort        int not null default 0,
  created_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now(),
  constraint set_components_target_chk check (num_nonnulls(machine_id, article_id, name) >= 1),
  constraint set_components_self_chk check (machine_id is null or machine_id <> set_id)
);
create index if not exists set_components_set_idx on public.set_components (set_id, sort);

-- Fotos (Import-Pool je Raum/Lagerort). SHA-256 der Originaldatei verhindert Doppelimporte.
create table if not exists public.photos (
  id               uuid primary key default gen_random_uuid(),
  location_id      uuid references public.locations(id) on delete restrict,
  path             text not null unique,
  sha256           text not null unique check (sha256 ~ '^[0-9a-f]{64}$'),
  file_name        text,
  folder           text,
  mime             text,
  size_bytes       bigint,
  width            int,
  height           int,
  status           text not null default 'neu' check (status in ('neu','in_analyse','analysiert','fehler')),
  analysis_error   text,
  analysis_source  text,
  analyzed_at      timestamptz,
  scene            text,
  area             text,
  observations     jsonb not null default '[]'::jsonb,
  recommendations  jsonb not null default '[]'::jsonb,
  uploaded_by      uuid references public.profiles(id),
  created_at       timestamptz not null default now()
);
create index if not exists photos_location_idx on public.photos (location_id, created_at);
alter table public.locations add column if not exists cover_photo_id uuid references public.photos(id) on delete set null;

-- Erkannte Objekte (Vorschläge). Werden erst nach Prüfung zu Inventar (Artikel / Maschine / Lagerort).
create table if not exists public.detections (
  id                  uuid primary key default gen_random_uuid(),
  photo_id            uuid not null references public.photos(id) on delete cascade,
  obj_key             text not null check (length(obj_key) between 1 and 120),
  source              text not null default 'ki' check (source in ('ki','manuell')),
  name                text not null check (length(trim(name)) between 1 and 200),
  kind                text not null default 'unbekannt'
                      check (kind in ('einzelinventar','bestandsartikel','set','einrichtung','unbekannt')),
  category_id         uuid references public.categories(id) on delete set null,
  category_text       text,
  brand               text,
  model               text,
  serial_no           text,
  text_read           jsonb not null default '[]'::jsonb,
  quantity            numeric check (quantity is null or (quantity >= 0 and quantity < 1e9)),
  quantity_certain    boolean not null default false,
  unit                text,
  condition           text,
  confidence          text not null default 'unbekannt' check (confidence in ('sicher','wahrscheinlich','unbekannt')),
  pos_x               real check (pos_x is null or (pos_x >= 0 and pos_x <= 1)),
  pos_y               real check (pos_y is null or (pos_y >= 0 and pos_y <= 1)),
  part_of_key         text,
  notes               text,
  product             jsonb,
  status              text not null default 'offen'
                      check (status in ('offen','bestaetigt','zusammengefuehrt','abgelehnt','spaeter')),
  article_id          uuid references public.articles(id) on delete set null,
  machine_id          uuid references public.machines(id) on delete set null,
  location_ref_id     uuid references public.locations(id) on delete set null,
  target_location_id  uuid references public.locations(id) on delete set null,
  merged_into         uuid references public.detections(id) on delete set null,
  reviewed_by         uuid references public.profiles(id),
  reviewed_at         timestamptz,
  created_at          timestamptz not null default now(),
  unique (photo_id, obj_key)
);
create index if not exists detections_photo_idx on public.detections (photo_id);
create index if not exists detections_status_idx on public.detections (status);
create index if not exists detections_article_idx on public.detections (article_id);
create index if not exists detections_machine_idx on public.detections (machine_id);

-- Bereiche auf Fotos (Hotspots): Punkt (x, y) oder Rechteck (x, y, w, h), relativ 0–1, verknüpft mit einem Lagerort
create table if not exists public.photo_hotspots (
  id           uuid primary key default gen_random_uuid(),
  photo_id     uuid not null references public.photos(id) on delete cascade,
  location_id  uuid not null references public.locations(id) on delete cascade,
  x            real not null check (x >= 0 and x <= 1),
  y            real not null check (y >= 0 and y <= 1),
  w            real check (w is null or (w > 0 and w <= 1)),
  h            real check (h is null or (h > 0 and h <= 1)),
  label        text,
  created_by   uuid references public.profiles(id),
  created_at   timestamptz not null default now()
);
create index if not exists photo_hotspots_photo_idx on public.photo_hotspots (photo_id);
create index if not exists photo_hotspots_location_idx on public.photo_hotspots (location_id);

-- Gebäudepläne (Grundriss je Stockwerk): Das Bild liegt in photos (kind = 'plan'), die Räume sind Bereiche
-- (photo_hotspots). Ein Bereich auf dem Plan darf zunächst nur beschriftet sein (Raum noch nicht angelegt).
alter table public.photos add column if not exists kind text not null default 'foto';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'photos_kind_chk') then
    alter table public.photos add constraint photos_kind_chk check (kind in ('foto','plan'));
  end if;
  alter table public.photo_hotspots alter column location_id drop not null;
  if not exists (select 1 from pg_constraint where conname = 'photo_hotspots_label_or_location_chk') then
    alter table public.photo_hotspots add constraint photo_hotspots_label_or_location_chk
      check (location_id is not null or length(trim(coalesce(label, ''))) > 0);
  end if;
end $$;
create table if not exists public.floor_plans (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) between 1 and 80),
  sort        int not null default 0,
  photo_id    uuid not null unique references public.photos(id) on delete restrict,
  notes       text,
  created_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Standorte (Adressen, z. B. Büro und weitere Lager). Ein Raum (oberster Lagerort) und ein Gebäudeplan gehören
-- zu höchstens einem Standort. Der Standort steht NICHT im lesbaren Code (G1-RG01 bleibt) – er gruppiert nur;
-- Kurzcodes der Räume bleiben deshalb über alle Standorte eindeutig.
create table if not exists public.sites (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) between 1 and 80),
  address     text check (address is null or length(address) <= 200),
  sort        int not null default 0,
  notes       text check (notes is null or length(notes) <= 2000),
  created_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index if not exists sites_name_uniq on public.sites (lower(trim(name)));
alter table public.locations   add column if not exists site_id uuid references public.sites(id) on delete restrict;
alter table public.floor_plans add column if not exists site_id uuid references public.sites(id) on delete restrict;
create index if not exists locations_site_idx   on public.locations (site_id)   where site_id is not null;
create index if not exists floor_plans_site_idx on public.floor_plans (site_id) where site_id is not null;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'locations_site_top_chk') then
    alter table public.locations add constraint locations_site_top_chk check (site_id is null or parent_id is null);
  end if;
end $$;

-- Organisationsplan: Aufgaben je Raum/Lagerort
create table if not exists public.org_tasks (
  id           uuid primary key default gen_random_uuid(),
  location_id  uuid not null references public.locations(id) on delete cascade,
  photo_id     uuid references public.photos(id) on delete set null,
  title        text not null check (length(trim(title)) between 1 and 300),
  details      text,
  source       text not null default 'manuell' check (source in ('manuell','foto_analyse','regel')),
  status       text not null default 'offen' check (status in ('offen','erledigt','verworfen')),
  assigned_to  uuid references public.profiles(id) on delete set null,
  sort         int not null default 0,
  created_by   uuid references public.profiles(id),
  created_at   timestamptz not null default now(),
  done_by      uuid references public.profiles(id),
  done_at      timestamptz
);
create index if not exists org_tasks_location_idx on public.org_tasks (location_id, status);

-- Inventur für einen bestimmten Raum/Lagerort (optional)
alter table public.inventories add column if not exists location_id uuid references public.locations(id) on delete set null;

-- Startkategorien (de-CH) – nur wenn noch keine Kategorien existieren; danach frei änderbar
do $$
declare
  v_tree jsonb := '[
    ["Maschinen & Geräte", ["Bohrmaschinen & Bohrhämmer","Schleifmaschinen","Sägen","Weitere Elektrowerkzeuge","Kompressoren","Messgeräte","Reinigungsmaschinen","Garten- & Forstgeräte","Bau- & Baustellengeräte","Leitern & Transporthilfen","Haushalts- & Klimageräte","Spezialmaschinen"]],
    ["Werkzeuge", ["Handwerkzeuge","Schraubwerkzeuge","Schneidwerkzeuge","Messwerkzeuge","Werkzeugkoffer & Sets","Werkzeugzubehör"]],
    ["Bau- & Montagematerial", ["Befestigungsmaterial","Dicht- & Klebstoffe","Abdichtungsmaterial","Metallprofile","Holz & Platten","Dämmstoffe","Farben & Lacke","Montagezubehör"]],
    ["IT & Elektronik", ["Computer & Tablets","Monitore","Peripherie","Drucker & Scanner","Netzwerkgeräte","Kameras","Telefonie","Kabel & Adapter","Unterhaltungselektronik"]],
    ["Bürobedarf", ["Papier","Schreibmaterial","Ordner & Ablage","Büroverbrauchsmaterial","Versandmaterial","Bürogeräte"]],
    ["Büromöbel", ["Tische","Stühle","Schränke","Regale","Lampen","Boxen & Behälter"]],
    ["Reinigung & Unterhalt", ["Reinigungsgeräte","Reinigungsmittel","Unterhaltsmaterial","Verbrauchsmaterial"]],
    ["Elektro & Installation", ["Kabel & Leitungen","Steckdosenleisten & Verlängerungen","Schalter & Steckdosen","Sicherungen","Leuchtmittel","Installationsmaterial"]],
    ["Ersatzteile & Zubehör", ["Maschinenersatzteile","Technische Ersatzteile","Akkus","Ladegeräte","Zubehör"]],
    ["Arbeitssicherheit", ["Persönliche Schutzausrüstung","Erste Hilfe & Brandschutz"]],
    ["Küche & Aufenthalt", ["Geräte","Geschirr & Verbrauch"]]
  ]';
  v_top jsonb; v_sub jsonb; v_id uuid; i int := 0; j int;
begin
  if exists (select 1 from public.categories) then return; end if;
  for v_top in select * from jsonb_array_elements(v_tree) loop
    i := i + 1;
    insert into public.categories (name, sort) values (v_top->>0, i * 10) returning id into v_id;
    j := 0;
    for v_sub in select * from jsonb_array_elements(v_top->1) loop
      j := j + 1;
      insert into public.categories (parent_id, name, sort) values (v_id, v_sub #>> '{}', j * 10);
    end loop;
  end loop;
end $$;

-- Mengen müssen endliche Zahlen sein (NaN/Infinity würden die Prüfungen «>= 0» umgehen)
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'articles_stock_finite') then
    alter table public.articles add constraint articles_stock_finite check (stock < 1e12);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'articles_min_stock_finite') then
    alter table public.articles add constraint articles_min_stock_finite check (min_stock is null or min_stock < 1e12);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'inventory_counts_finite') then
    alter table public.inventory_counts add constraint inventory_counts_finite check (counted < 1e12 and expected < 1e12);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'stock_movements_finite') then
    alter table public.stock_movements add constraint stock_movements_finite
      check (qty > -1e12 and qty < 1e12 and stock_before < 1e12 and stock_after < 1e12);
  end if;
end $$;

-- =====================================================================
--  Trigger
-- =====================================================================
create or replace function public.set_updated_at() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at := now(); return new; end $$;

create or replace function public.set_created_by() returns trigger language plpgsql set search_path = public as $$
begin
  if tg_table_name = 'attachments' then
    new.uploaded_by := auth.uid();
    new.created_at := now();
    -- Hauptfoto entscheidet der Server: das erste Foto eines Eintrags
    new.is_primary := new.kind = 'photo' and not exists (
      select 1 from public.attachments a
       where a.entity = new.entity and a.entity_id = new.entity_id and a.kind = 'photo' and a.is_primary);
  elsif tg_table_name = 'inventories' then new.started_by := auth.uid();
  else new.created_by := auth.uid();
  end if;
  return new;
end $$;

-- Dauerhafte Codes für QR-Etiketten (M-0001, INV-0001, L-0001). Ein Code ändert sich nie.
create or replace function public.assign_code() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_prefix text := tg_argv[0]; v_n int;
begin
  if tg_op = 'UPDATE' then
    if new.code is distinct from old.code then raise exception 'LGR:code_immutable'; end if;
    return new;
  end if;
  new.code := upper(trim(coalesce(new.code, '')));
  if new.code = '' then
    perform pg_advisory_xact_lock(hashtext('lgr:code:' || v_prefix));
    -- höchstens 9 Ziffern berücksichtigen: ein eigener Code wie «M-20260101123456» darf die
    -- Nummerierung nicht durch einen int-Überlauf blockieren
    execute format('select coalesce(max((substring(code from %L))::int), 0) + 1 from %I.%I',
                   '^' || v_prefix || '([0-9]{1,9})$', tg_table_schema, tg_table_name) into v_n;
    -- lpad kürzt längere Zahlen («10000» → «1000»), daher Breite mindestens 4
    new.code := v_prefix || lpad(v_n::text, greatest(4, length(v_n::text)), '0');
  -- Der Präfix bestimmt beim Scannen den Typ (M- Maschine, L- Lagerort, sonst Artikel)
  elsif new.code ~ '\s'
     or (v_prefix in ('M-', 'L-') and left(new.code, 2) <> v_prefix)
     or (v_prefix not in ('M-', 'L-') and left(new.code, 2) in ('M-', 'L-')) then
    raise exception 'LGR:invalid_code';
  end if;
  return new;
end $$;

create or replace function public.check_location_parent() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_cur uuid := new.parent_id; v_steps int := 0;
begin
  while v_cur is not null loop
    if v_cur = new.id then raise exception 'LGR:location_cycle'; end if;
    select parent_id into v_cur from public.locations where id = v_cur;
    v_steps := v_steps + 1;
    if v_steps > 60 then raise exception 'LGR:location_cycle'; end if;
  end loop;
  return new;
end $$;

create or replace function public.machine_insert_guard() returns trigger language plpgsql set search_path = public as $$
begin
  if new.status = 'ausgeliehen' then raise exception 'LGR:invalid_status'; end if;
  return new;
end $$;

-- Anfangsbestand eines neuen Artikels als Bewegung «anlage» festhalten
create or replace function public.article_initial_movement() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.stock > 0 then
    insert into public.stock_movements (article_id, type, qty, stock_before, stock_after, to_location_id, user_id)
    values (new.id, 'anlage', new.stock, 0, new.stock, new.location_id, auth.uid());
  end if;
  return new;
end $$;

-- Allgemeines Protokoll für Stammdaten (Funktionen mit eigenem Protokoll setzen lgr.skip_audit)
create or replace function public.audit_row() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_old jsonb; v_new jsonb; v_diff jsonb := '{}'::jsonb; k text;
begin
  if coalesce(current_setting('lgr.skip_audit', true), '') = 'on' then
    return coalesce(new, old);
  end if;
  if tg_op = 'INSERT' then
    insert into public.audit_log (user_id, action, entity, entity_id, details)
    values (auth.uid(), 'insert', tg_table_name, new.id, to_jsonb(new) - 'updated_at' - 'created_at');
    return new;
  elsif tg_op = 'DELETE' then
    insert into public.audit_log (user_id, action, entity, entity_id, details)
    values (auth.uid(), 'delete', tg_table_name, old.id, to_jsonb(old));
    return old;
  end if;
  v_old := to_jsonb(old); v_new := to_jsonb(new);
  for k in select jsonb_object_keys(v_new) loop
    if k not in ('updated_at') and (v_old -> k) is distinct from (v_new -> k) then
      v_diff := v_diff || jsonb_build_object(k, jsonb_build_object('alt', v_old -> k, 'neu', v_new -> k));
    end if;
  end loop;
  if v_diff <> '{}'::jsonb then
    insert into public.audit_log (user_id, action, entity, entity_id, details)
    values (auth.uid(), 'update', tg_table_name, new.id, v_diff);
  end if;
  return new;
end $$;

drop trigger if exists locations_code on public.locations;
create trigger locations_code before insert or update on public.locations for each row execute function public.assign_code('L-');
drop trigger if exists articles_code on public.articles;
create trigger articles_code before insert or update on public.articles for each row execute function public.assign_code('INV-');
drop trigger if exists machines_code on public.machines;
create trigger machines_code before insert or update on public.machines for each row execute function public.assign_code('M-');

drop trigger if exists locations_parent on public.locations;
create trigger locations_parent before insert or update of parent_id on public.locations for each row execute function public.check_location_parent();
drop trigger if exists machines_guard on public.machines;
create trigger machines_guard before insert on public.machines for each row execute function public.machine_insert_guard();

drop trigger if exists locations_created_by on public.locations;
create trigger locations_created_by before insert on public.locations for each row execute function public.set_created_by();
drop trigger if exists articles_created_by on public.articles;
create trigger articles_created_by before insert on public.articles for each row execute function public.set_created_by();
drop trigger if exists machines_created_by on public.machines;
create trigger machines_created_by before insert on public.machines for each row execute function public.set_created_by();
drop trigger if exists attachments_created_by on public.attachments;
create trigger attachments_created_by before insert on public.attachments for each row execute function public.set_created_by();
drop trigger if exists inventories_created_by on public.inventories;
create trigger inventories_created_by before insert on public.inventories for each row execute function public.set_created_by();

drop trigger if exists locations_updated on public.locations;
create trigger locations_updated before update on public.locations for each row execute function public.set_updated_at();
drop trigger if exists articles_updated on public.articles;
create trigger articles_updated before update on public.articles for each row execute function public.set_updated_at();
drop trigger if exists machines_updated on public.machines;
create trigger machines_updated before update on public.machines for each row execute function public.set_updated_at();

drop trigger if exists articles_initial on public.articles;
create trigger articles_initial after insert on public.articles for each row execute function public.article_initial_movement();

drop trigger if exists locations_audit on public.locations;
create trigger locations_audit after insert or update or delete on public.locations for each row execute function public.audit_row();
drop trigger if exists articles_audit on public.articles;
create trigger articles_audit after insert or update or delete on public.articles for each row execute function public.audit_row();
drop trigger if exists machines_audit on public.machines;
create trigger machines_audit after insert or update or delete on public.machines for each row execute function public.audit_row();
drop trigger if exists attachments_audit on public.attachments;
create trigger attachments_audit after insert or delete on public.attachments for each row execute function public.audit_row();


-- ---- Lager organisieren: Trigger ----
create or replace function public.check_category_parent() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_cur uuid := new.parent_id; v_steps int := 0;
begin
  while v_cur is not null loop
    if v_cur = new.id then raise exception 'LGR:category_cycle'; end if;
    select parent_id into v_cur from public.categories where id = v_cur;
    v_steps := v_steps + 1;
    if v_steps > 20 then raise exception 'LGR:category_cycle'; end if;
  end loop;
  return new;
end $$;

-- Neues Foto: Herkunft und Status setzt der Server (Analyse-Felder nur über import_photo_analysis)
create or replace function public.photo_insert_defaults() returns trigger
language plpgsql set search_path = public as $$
begin
  new.uploaded_by := auth.uid();
  new.created_at := now();
  new.status := 'neu';
  new.analysis_error := null; new.analysis_source := null; new.analyzed_at := null;
  new.scene := null; new.area := null;
  new.observations := '[]'::jsonb; new.recommendations := '[]'::jsonb;
  new.sha256 := lower(new.sha256);
  return new;
end $$;

-- Foto mit bestätigten Objekten nicht löschen (Herkunftsnachweis des Inventars)
create or replace function public.photo_delete_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.detections d where d.photo_id = old.id and d.status = 'bestaetigt') then
    raise exception 'LGR:in_use';
  end if;
  return old;
end $$;

-- Aufgabe erledigt → wer und wann
create or replace function public.org_task_status() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid(); new.created_at := now();
    new.done_by := null; new.done_at := null;
    if new.status = 'erledigt' then new.done_by := auth.uid(); new.done_at := now(); end if;
  elsif new.status is distinct from old.status then
    if new.status = 'erledigt' then new.done_by := auth.uid(); new.done_at := now();
    else new.done_by := null; new.done_at := null; end if;
  else
    new.done_by := old.done_by; new.done_at := old.done_at;
  end if;
  return new;
end $$;

drop trigger if exists categories_parent on public.categories;
create trigger categories_parent before insert or update of parent_id on public.categories for each row execute function public.check_category_parent();
drop trigger if exists categories_created_by on public.categories;
create trigger categories_created_by before insert on public.categories for each row execute function public.set_created_by();
drop trigger if exists categories_updated on public.categories;
create trigger categories_updated before update on public.categories for each row execute function public.set_updated_at();
drop trigger if exists categories_audit on public.categories;
create trigger categories_audit after insert or update or delete on public.categories for each row execute function public.audit_row();

drop trigger if exists photos_defaults on public.photos;
create trigger photos_defaults before insert on public.photos for each row execute function public.photo_insert_defaults();
drop trigger if exists photos_delete_guard on public.photos;
create trigger photos_delete_guard before delete on public.photos for each row execute function public.photo_delete_guard();
drop trigger if exists photos_audit on public.photos;
create trigger photos_audit after insert or delete on public.photos for each row execute function public.audit_row();

drop trigger if exists org_tasks_status on public.org_tasks;
create trigger org_tasks_status before insert or update on public.org_tasks for each row execute function public.org_task_status();
drop trigger if exists org_tasks_audit on public.org_tasks;
create trigger org_tasks_audit after insert or update or delete on public.org_tasks for each row execute function public.audit_row();

drop trigger if exists photo_hotspots_created_by on public.photo_hotspots;
create trigger photo_hotspots_created_by before insert on public.photo_hotspots for each row execute function public.set_created_by();
drop trigger if exists photo_hotspots_audit on public.photo_hotspots;
create trigger photo_hotspots_audit after insert or update or delete on public.photo_hotspots for each row execute function public.audit_row();

drop trigger if exists set_components_created_by on public.set_components;
create trigger set_components_created_by before insert on public.set_components for each row execute function public.set_created_by();
drop trigger if exists set_components_audit on public.set_components;
create trigger set_components_audit after insert or update or delete on public.set_components for each row execute function public.audit_row();

drop trigger if exists floor_plans_created_by on public.floor_plans;
create trigger floor_plans_created_by before insert on public.floor_plans for each row execute function public.set_created_by();
drop trigger if exists floor_plans_updated on public.floor_plans;
create trigger floor_plans_updated before update on public.floor_plans for each row execute function public.set_updated_at();
drop trigger if exists floor_plans_audit on public.floor_plans;
create trigger floor_plans_audit after insert or update or delete on public.floor_plans for each row execute function public.audit_row();
drop trigger if exists sites_created_by on public.sites;
create trigger sites_created_by before insert on public.sites for each row execute function public.set_created_by();
drop trigger if exists sites_updated on public.sites;
create trigger sites_updated before update on public.sites for each row execute function public.set_updated_at();
drop trigger if exists sites_audit on public.sites;
create trigger sites_audit after insert or update or delete on public.sites for each row execute function public.audit_row();

-- Der Standort gilt nur für Räume (oberste Lagerorte): wird ein Lagerort untergeordnet, fällt sein Standort weg
create or replace function public.location_site_top_only() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.parent_id is not null then new.site_id := null; end if;
  return new;
end $$;
drop trigger if exists locations_site_top_only on public.locations;
create trigger locations_site_top_only before insert or update on public.locations
  for each row execute function public.location_site_top_only();

-- =====================================================================
--  Geschäftslogik (nur über diese Funktionen; sicher gegen gleichzeitige Zugriffe)
-- =====================================================================

-- Maschine ausleihen
create or replace function public.machine_checkout(
  p_machine uuid, p_request uuid default null, p_due timestamptz default null,
  p_note text default null, p_borrower uuid default null)
returns public.loans language plpgsql security definer set search_path = public as $$
declare v_m public.machines; v_l public.loans; v_uid uuid := auth.uid(); v_borrower uuid;
begin
  if not public.is_active_user() then raise exception 'LGR:not_authorized'; end if;
  v_borrower := coalesce(p_borrower, v_uid);
  if v_borrower <> v_uid then
    if not public.is_staff() then raise exception 'LGR:not_authorized'; end if;
    if not exists (select 1 from public.profiles where id = v_borrower and active) then
      raise exception 'LGR:invalid_borrower';
    end if;
  end if;
  -- Zeile sperren: zwei gleichzeitige Ausleihen derselben Maschine werden nacheinander verarbeitet
  select * into v_m from public.machines where id = p_machine for update;
  if not found or v_m.archived then raise exception 'LGR:not_found'; end if;
  if p_request is not null then
    select * into v_l from public.loans where checkout_request = p_request;
    if found then return v_l; end if;            -- gleicher Scan noch einmal: nichts doppelt buchen
  end if;
  if v_m.status = 'reserviert' and not public.is_staff() then raise exception 'LGR:reserved'; end if;
  if v_m.status not in ('verfuegbar','reserviert') then raise exception 'LGR:not_available:%', v_m.status; end if;
  if p_due is not null and p_due < now() - interval '5 minutes' then raise exception 'LGR:due_in_past'; end if;
  begin
    insert into public.loans (machine_id, borrower_id, due_at, checkout_note, checkout_request, created_by)
    values (p_machine, v_borrower, p_due, nullif(trim(p_note), ''), p_request, v_uid)
    returning * into v_l;
  exception when unique_violation then
    raise exception 'LGR:not_available:ausgeliehen';
  end;
  perform set_config('lgr.skip_audit', 'on', true);
  update public.machines set status = 'ausgeliehen' where id = p_machine;
  perform set_config('lgr.skip_audit', '', true);   -- nur für diese Änderung, nicht für den Rest der Transaktion
  insert into public.audit_log (user_id, action, entity, entity_id, details)
  values (v_uid, 'ausleihen', 'machines', p_machine,
          jsonb_build_object('loan', v_l.id, 'borrower', v_borrower, 'due', p_due));
  return v_l;
end $$;

-- Maschine zurückgeben (auch für andere: Ausleiher UND Rückgeber werden gespeichert)
create or replace function public.machine_return(
  p_machine uuid, p_request uuid default null, p_condition text default 'ok', p_note text default null)
returns public.loans language plpgsql security definer set search_path = public as $$
declare
  v_m public.machines; v_l public.loans; v_uid uuid := auth.uid();
  v_cond text := coalesce(p_condition, 'ok'); v_note text := nullif(trim(p_note), '');
begin
  if not public.is_active_user() then raise exception 'LGR:not_authorized'; end if;
  if v_cond not in ('ok','maengel','defekt') then raise exception 'LGR:invalid_condition'; end if;
  if v_cond <> 'ok' and v_note is null then raise exception 'LGR:note_required'; end if;
  select * into v_m from public.machines where id = p_machine for update;
  if not found then raise exception 'LGR:not_found'; end if;
  if p_request is not null then
    select * into v_l from public.loans where return_request = p_request;
    if found then return v_l; end if;
  end if;
  select * into v_l from public.loans where machine_id = p_machine and returned_at is null for update;
  if not found then raise exception 'LGR:not_on_loan'; end if;
  update public.loans
     set returned_at = greatest(now(), checked_out_at),   -- Prüfregel loans_dates_chk nie verletzen
         returned_by = v_uid, return_condition = v_cond,
         return_note = v_note, return_request = p_request
   where id = v_l.id
  returning * into v_l;
  perform set_config('lgr.skip_audit', 'on', true);
  update public.machines
     set status = case when v_cond = 'defekt' then 'defekt' else 'verfuegbar' end,
         condition = v_cond,
         condition_note = coalesce(v_note, case when v_cond = 'ok' then null else condition_note end)
   where id = p_machine;
  perform set_config('lgr.skip_audit', '', true);
  insert into public.audit_log (user_id, action, entity, entity_id, details)
  values (v_uid, 'zurueckgeben', 'machines', p_machine,
          jsonb_build_object('loan', v_l.id, 'borrower', v_l.borrower_id, 'condition', v_cond,
                             'note', v_note, 'stellvertretend', v_l.borrower_id <> v_uid));
  return v_l;
end $$;

-- Status setzen (Reserviert, In Wartung, Defekt, Verloren, Verfügbar) – nur Lagerverantwortliche/Admins
create or replace function public.machine_set_status(p_machine uuid, p_status text, p_note text default null)
returns public.machines language plpgsql security definer set search_path = public as $$
declare v_m public.machines; v_old text;
begin
  if not public.is_staff() then raise exception 'LGR:not_authorized'; end if;
  if p_status not in ('verfuegbar','reserviert','wartung','defekt','verloren') then raise exception 'LGR:invalid_status'; end if;
  select * into v_m from public.machines where id = p_machine for update;
  if not found then raise exception 'LGR:not_found'; end if;
  if v_m.status = 'ausgeliehen' or exists (select 1 from public.loans where machine_id = p_machine and returned_at is null) then
    raise exception 'LGR:on_loan';
  end if;
  v_old := v_m.status;
  perform set_config('lgr.skip_audit', 'on', true);
  update public.machines
     set status = p_status,
         condition = case when p_status = 'defekt' then 'defekt'
                          when p_status = 'verfuegbar' and condition = 'defekt' then 'ok'
                          else condition end,
         -- repariert (defekt → verfügbar/ok): alte Schadensnotiz nicht weiter anzeigen
         condition_note = case when p_status = 'verfuegbar' and condition = 'defekt'
                               then nullif(trim(p_note), '')
                               else coalesce(nullif(trim(p_note), ''), condition_note) end
   where id = p_machine
  returning * into v_m;
  perform set_config('lgr.skip_audit', '', true);
  insert into public.audit_log (user_id, action, entity, entity_id, details)
  values (auth.uid(), 'status', 'machines', p_machine,
          jsonb_build_object('alt', v_old, 'neu', p_status, 'note', nullif(trim(p_note), '')));
  return v_m;
end $$;

-- Korrektur einer Ausleihe durch Administratoren (mit Begründung, wird protokolliert)
create or replace function public.admin_correct_loan(
  p_loan uuid, p_checked_out_at timestamptz, p_due_at timestamptz, p_returned_at timestamptz, p_reason text)
returns public.loans language plpgsql security definer set search_path = public as $$
declare v_l public.loans; v_old public.loans; v_m public.machines;
begin
  if not public.is_admin() then raise exception 'LGR:not_authorized'; end if;
  if nullif(trim(p_reason), '') is null then raise exception 'LGR:reason_required'; end if;
  select * into v_old from public.loans where id = p_loan for update;
  if not found then raise exception 'LGR:not_found'; end if;
  select * into v_m from public.machines where id = v_old.machine_id for update;
  if p_returned_at is not null and p_returned_at < coalesce(p_checked_out_at, v_old.checked_out_at) then
    raise exception 'LGR:invalid_dates';
  end if;
  -- Zeitpunkte in der Zukunft ergeben keinen Sinn (Maschine wäre sonst «verfügbar», obwohl noch draussen)
  if coalesce(p_checked_out_at, v_old.checked_out_at) > now() + interval '5 minutes'
     or p_returned_at > now() + interval '5 minutes' then
    raise exception 'LGR:invalid_dates';
  end if;
  begin
    update public.loans
       set checked_out_at   = coalesce(p_checked_out_at, checked_out_at),
           due_at           = p_due_at,
           returned_at      = p_returned_at,
           returned_by      = case when p_returned_at is null then null
                                   when v_old.returned_at is null then auth.uid() else returned_by end,
           return_condition = case when p_returned_at is null then null else coalesce(return_condition, 'ok') end,
           return_note      = case when p_returned_at is null then null else return_note end,
           return_request   = case when p_returned_at is null then null else return_request end,
           corrected        = true
     where id = p_loan
    returning * into v_l;
  exception when unique_violation then
    raise exception 'LGR:not_available:ausgeliehen';
  end;
  perform set_config('lgr.skip_audit', 'on', true);
  if v_l.returned_at is null then
    update public.machines set status = 'ausgeliehen' where id = v_l.machine_id;
  elsif v_old.returned_at is null and v_m.status = 'ausgeliehen' then
    update public.machines set status = 'verfuegbar' where id = v_l.machine_id;
  end if;
  perform set_config('lgr.skip_audit', '', true);
  insert into public.audit_log (user_id, action, entity, entity_id, details)
  values (auth.uid(), 'korrektur', 'loans', p_loan,
          jsonb_build_object('grund', trim(p_reason),
            'alt', jsonb_build_object('checked_out_at', v_old.checked_out_at, 'due_at', v_old.due_at, 'returned_at', v_old.returned_at),
            'neu', jsonb_build_object('checked_out_at', v_l.checked_out_at, 'due_at', v_l.due_at, 'returned_at', v_l.returned_at)));
  return v_l;
end $$;

-- Lagerbewegung buchen. Mitarbeiter: Entnahme/Zugang. Lagerverantwortliche: auch Umlagerung/Korrektur.
create or replace function public.stock_move(
  p_article uuid, p_type text, p_qty numeric, p_request uuid default null,
  p_note text default null, p_to_location uuid default null)
returns public.stock_movements language plpgsql security definer set search_path = public as $$
declare
  v_a public.articles; v_mv public.stock_movements; v_delta numeric; v_new numeric;
  v_note text := nullif(trim(p_note), '');
begin
  if not public.is_active_user() then raise exception 'LGR:not_authorized'; end if;
  if p_type not in ('zugang','entnahme','korrektur','umlagerung') then raise exception 'LGR:invalid_type'; end if;
  if p_type in ('korrektur','umlagerung') and not public.is_staff() then raise exception 'LGR:not_authorized'; end if;
  select * into v_a from public.articles where id = p_article for update;
  if not found or v_a.archived then raise exception 'LGR:not_found'; end if;
  if p_request is not null then
    select * into v_mv from public.stock_movements where request_id = p_request;
    if found then return v_mv; end if;
  end if;
  if p_type in ('zugang','entnahme') then
    -- «not (… < 1e9)» weist auch NaN und Infinity ab (NaN gilt in Postgres als grösser als jede Zahl)
    if p_qty is null or not (p_qty > 0 and p_qty < 1e9) then raise exception 'LGR:invalid_qty'; end if;
    v_delta := case when p_type = 'zugang' then p_qty else -p_qty end;
  elsif p_type = 'korrektur' then
    if p_qty is null or not (p_qty >= 0 and p_qty < 1e9) then raise exception 'LGR:invalid_qty'; end if;
    if v_note is null then raise exception 'LGR:reason_required'; end if;
    v_delta := p_qty - v_a.stock;
  else
    if p_to_location is null or not exists (select 1 from public.locations where id = p_to_location) then
      raise exception 'LGR:invalid_location';
    end if;
    v_delta := 0;
  end if;
  v_new := v_a.stock + v_delta;
  if v_new < 0 then raise exception 'LGR:insufficient_stock'; end if;
  perform set_config('lgr.skip_audit', 'on', true);
  update public.articles
     set stock = v_new,
         location_id = case when p_type = 'umlagerung' then p_to_location else location_id end
   where id = p_article;
  perform set_config('lgr.skip_audit', '', true);
  insert into public.stock_movements (article_id, type, qty, stock_before, stock_after,
                                      from_location_id, to_location_id, user_id, note, request_id)
  values (p_article, p_type, v_delta, v_a.stock, v_new, v_a.location_id,
          case when p_type = 'umlagerung' then p_to_location else v_a.location_id end,
          auth.uid(), v_note, p_request)
  returning * into v_mv;
  return v_mv;
end $$;

-- Eigenes Profil (Name, Sprache)
create or replace function public.update_my_profile(p_full_name text, p_lang text)
returns public.profiles language plpgsql security definer set search_path = public as $$
declare v_p public.profiles;
begin
  if auth.uid() is null then raise exception 'LGR:not_authorized'; end if;
  if nullif(trim(p_full_name), '') is null then raise exception 'LGR:name_required'; end if;
  if p_lang not in ('de','pt','es') then raise exception 'LGR:invalid_lang'; end if;
  update public.profiles set full_name = trim(p_full_name), lang = p_lang where id = auth.uid() returning * into v_p;
  return v_p;
end $$;

-- Mitarbeiter verwalten (freigeben, Rolle, sperren) – nur Administratoren
create or replace function public.admin_update_profile(p_id uuid, p_full_name text, p_role text, p_active boolean)
returns public.profiles language plpgsql security definer set search_path = public as $$
declare v_old public.profiles; v_p public.profiles;
begin
  if not public.is_admin() then raise exception 'LGR:not_authorized'; end if;
  if p_role not in ('admin','lagerverantwortlicher','mitarbeiter') then raise exception 'LGR:invalid_role'; end if;
  if nullif(trim(p_full_name), '') is null then raise exception 'LGR:name_required'; end if;
  -- Änderungen an Mitarbeitern nacheinander: zwei Admins, die sich gleichzeitig gegenseitig
  -- herabstufen, dürfen nicht beide die Prüfung «es gibt noch einen anderen Admin» bestehen
  perform pg_advisory_xact_lock(hashtext('lgr:admins'));
  select * into v_old from public.profiles where id = p_id for update;
  if not found then raise exception 'LGR:not_found'; end if;
  if v_old.role = 'admin' and v_old.active and (p_role <> 'admin' or not p_active)
     and not exists (select 1 from public.profiles where role = 'admin' and active and id <> p_id) then
    raise exception 'LGR:last_admin';
  end if;
  update public.profiles set full_name = trim(p_full_name), role = p_role, active = p_active
   where id = p_id returning * into v_p;
  insert into public.audit_log (user_id, action, entity, entity_id, details)
  values (auth.uid(), 'mitarbeiter', 'profiles', p_id,
          jsonb_build_object('alt', jsonb_build_object('name', v_old.full_name, 'rolle', v_old.role, 'aktiv', v_old.active),
                             'neu', jsonb_build_object('name', v_p.full_name, 'rolle', v_p.role, 'aktiv', v_p.active)));
  return v_p;
end $$;

-- Hauptfoto wählen
create or replace function public.set_primary_attachment(p_id uuid)
returns public.attachments language plpgsql security definer set search_path = public as $$
declare v_a public.attachments;
begin
  if not public.is_staff() then raise exception 'LGR:not_authorized'; end if;
  select * into v_a from public.attachments where id = p_id;
  if not found then raise exception 'LGR:not_found'; end if;
  update public.attachments set is_primary = (id = p_id)
   where entity = v_a.entity and entity_id = v_a.entity_id and kind = 'photo';
  select * into v_a from public.attachments where id = p_id;
  return v_a;
end $$;

-- Inventur: Artikel zählen (jeder aktive Mitarbeiter)
create or replace function public.inventory_count(p_inventory uuid, p_article uuid, p_counted numeric)
returns public.inventory_counts language plpgsql security definer set search_path = public as $$
declare v_c public.inventory_counts; v_stock numeric;
begin
  if not public.is_active_user() then raise exception 'LGR:not_authorized'; end if;
  if p_counted is null or not (p_counted >= 0 and p_counted < 1e9) then raise exception 'LGR:invalid_qty'; end if;
  -- «for share»: wartet auf ein gleichzeitiges inventory_close und sieht danach «abgeschlossen»
  perform 1 from public.inventories where id = p_inventory and status = 'offen' for share;
  if not found then raise exception 'LGR:inventory_closed'; end if;
  select stock into v_stock from public.articles where id = p_article;
  if not found then raise exception 'LGR:not_found'; end if;
  insert into public.inventory_counts (inventory_id, article_id, expected, counted, counted_by)
  values (p_inventory, p_article, v_stock, p_counted, auth.uid())
  on conflict (inventory_id, article_id) do update
     set expected = excluded.expected, counted = excluded.counted,
         counted_by = excluded.counted_by, counted_at = now(), applied = false
  returning * into v_c;
  return v_c;
end $$;

-- Inventur: Maschine prüfen
create or replace function public.inventory_check_machine(p_inventory uuid, p_machine uuid, p_result text, p_note text default null)
returns public.inventory_machine_checks language plpgsql security definer set search_path = public as $$
declare v_c public.inventory_machine_checks;
begin
  if not public.is_active_user() then raise exception 'LGR:not_authorized'; end if;
  if p_result not in ('vorhanden','fehlt','defekt','ausgeliehen') then raise exception 'LGR:invalid_status'; end if;
  perform 1 from public.inventories where id = p_inventory and status = 'offen' for share;
  if not found then raise exception 'LGR:inventory_closed'; end if;
  if not exists (select 1 from public.machines where id = p_machine) then raise exception 'LGR:not_found'; end if;
  insert into public.inventory_machine_checks (inventory_id, machine_id, result, note, checked_by)
  values (p_inventory, p_machine, p_result, nullif(trim(p_note), ''), auth.uid())
  on conflict (inventory_id, machine_id) do update
     set result = excluded.result, note = excluded.note, checked_by = excluded.checked_by, checked_at = now()
  returning * into v_c;
  return v_c;
end $$;

-- Inventur abschliessen und (optional) Differenzen buchen
create or replace function public.inventory_close(p_inventory uuid, p_apply boolean)
returns public.inventories language plpgsql security definer set search_path = public as $$
declare v_i public.inventories; r record; v_a public.articles; v_new numeric;
        v_apply boolean := coalesce(p_apply, false);   -- null → nicht buchen (statt NOT-NULL-Fehler)
begin
  if not public.is_staff() then raise exception 'LGR:not_authorized'; end if;
  select * into v_i from public.inventories where id = p_inventory for update;
  if not found then raise exception 'LGR:not_found'; end if;
  if v_i.status <> 'offen' then raise exception 'LGR:inventory_closed'; end if;
  perform set_config('lgr.skip_audit', 'on', true);
  if v_apply then
    for r in select * from public.inventory_counts
              where inventory_id = p_inventory and not applied and counted <> expected loop
      select * into v_a from public.articles where id = r.article_id for update;
      v_new := greatest(v_a.stock + (r.counted - r.expected), 0);
      update public.articles set stock = v_new where id = v_a.id;
      insert into public.stock_movements (article_id, type, qty, stock_before, stock_after,
                                          from_location_id, to_location_id, user_id, note)
      values (v_a.id, 'inventur', v_new - v_a.stock, v_a.stock, v_new, v_a.location_id, v_a.location_id,
              auth.uid(), 'Inventur: ' || v_i.name);
      update public.inventory_counts set applied = true where id = r.id;
    end loop;
    for r in select c.*, m.status as mstatus from public.inventory_machine_checks c
               join public.machines m on m.id = c.machine_id
              where c.inventory_id = p_inventory and c.result in ('fehlt','defekt') loop
      if r.mstatus <> 'ausgeliehen' then
        update public.machines
           set status = case when r.result = 'fehlt' then 'verloren' else 'defekt' end,
               condition = case when r.result = 'defekt' then 'defekt' else condition end
         where id = r.machine_id;
        insert into public.audit_log (user_id, action, entity, entity_id, details)
        values (auth.uid(), 'status', 'machines', r.machine_id,
                jsonb_build_object('alt', r.mstatus, 'neu', case when r.result = 'fehlt' then 'verloren' else 'defekt' end,
                                   'note', 'Inventur: ' || v_i.name));
      end if;
    end loop;
  end if;
  perform set_config('lgr.skip_audit', '', true);
  update public.inventories set status = 'abgeschlossen', closed_by = auth.uid(), closed_at = now(), applied = v_apply
   where id = p_inventory returning * into v_i;
  insert into public.audit_log (user_id, action, entity, entity_id, details)
  values (auth.uid(), 'inventur', 'inventories', p_inventory, jsonb_build_object('gebucht', v_apply));
  return v_i;
end $$;


-- =====================================================================
--  Lager organisieren: Funktionen
-- =====================================================================

-- JSON-Wert als Zahl (sonst null) – ungültige Werte sollen einen Import nicht abbrechen
create or replace function public.jnum(j jsonb) returns numeric
language sql immutable set search_path = public as $$
  select case when jsonb_typeof(j) = 'number' then (j #>> '{}')::numeric end
$$;

-- Oberster Lagerort (Raum) eines Lagerorts
create or replace function public.location_root(p_id uuid) returns uuid
language plpgsql stable security definer set search_path = public as $$
declare v_cur uuid := p_id; v_parent uuid; v_steps int := 0;
begin
  if p_id is null then return null; end if;
  loop
    select parent_id into v_parent from public.locations where id = v_cur;
    if not found then return null; end if;
    exit when v_parent is null;
    v_cur := v_parent;
    v_steps := v_steps + 1;
    if v_steps > 60 then return null; end if;
  end loop;
  return v_cur;
end $$;

-- Kategorie über den Pfad «Oberkategorie > Unterkategorie» finden (Gross/Klein egal), sonst null
create or replace function public.category_by_path(p_path text) returns uuid
language plpgsql stable security definer set search_path = public as $$
declare v_part text; v_id uuid := null; v_found uuid;
begin
  if p_path is null or trim(p_path) = '' then return null; end if;
  foreach v_part in array regexp_split_to_array(p_path, '\s*(>|›|»|/)\s*') loop
    v_part := trim(v_part);
    continue when v_part = '';
    select id into v_found from public.categories
     where lower(name) = lower(v_part) and parent_id is not distinct from v_id and not archived
     limit 1;
    if not found then return null; end if;
    v_id := v_found;
  end loop;
  return v_id;
end $$;

-- Produktrecherche als lesbarer Text für die Notizen (Zweck, technische Daten laut Quelle)
create or replace function public.product_summary(p jsonb) returns text
language sql immutable set search_path = public as $$
  select nullif(concat_ws(E'\n',
    case when jsonb_typeof(p->'purpose') = 'string' then 'Zweck: ' || (p->>'purpose') end,
    (select 'Technische Daten (laut ' || coalesce(p->>'source', 'Hersteller') || '): ' || string_agg(key || ' ' || value, '; ')
       from jsonb_each_text(case when jsonb_typeof(p->'specs') = 'object' then p->'specs' else '{}'::jsonb end))
  ), '')
$$;

-- KI-Analyse importieren (Ergebnis einer Fotoanalyse als JSON; Zuordnung über SHA-256 der Originaldatei).
-- Mehrfacher Import derselben Datei erzeugt keine doppelten Objekte (eindeutig je Foto + Objektschlüssel).
create or replace function public.import_photo_analysis(p_items jsonb, p_source text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_item jsonb; v_obj jsonb; v_photo public.photos; v_key text; v_n int;
  v_matched int := 0; v_created int := 0; v_existing int := 0; v_failed int := 0; v_invalid int := 0;
  v_dupes int := 0; v_photo_new int;
  v_unmatched jsonb := '[]'::jsonb;
  v_source text := left(coalesce(nullif(trim(p_source), ''), 'KI-Analyse'), 200);
  v_kind text; v_conf text; v_px numeric; v_py numeric; v_qty numeric;
begin
  if not public.is_staff() then raise exception 'LGR:not_authorized'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then raise exception 'LGR:invalid_input'; end if;
  if jsonb_array_length(p_items) > 250 then raise exception 'LGR:too_many'; end if;
  for v_item in select * from jsonb_array_elements(p_items) loop
    if jsonb_typeof(v_item) <> 'object' then v_invalid := v_invalid + 1; continue; end if;
    select * into v_photo from public.photos where sha256 = lower(trim(coalesce(v_item->>'sha256', ''))) for update;
    if not found then
      v_unmatched := v_unmatched || to_jsonb(coalesce(v_item->>'file', v_item->>'sha256', '?'));
      continue;
    end if;
    v_matched := v_matched + 1;
    if v_item->>'status' = 'duplikat' then v_dupes := v_dupes + 1; continue; end if;
    if v_item->>'status' = 'fehler' then
      -- ein bereits erfolgreich analysiertes Foto wird durch einen späteren Fehlversuch nicht zurückgesetzt
      if v_photo.status in ('neu', 'in_analyse', 'fehler') then
        update public.photos
           set status = 'fehler', analyzed_at = now(), analysis_source = v_source,
               analysis_error = left(coalesce(nullif(trim(v_item->>'error'), ''), 'Analyse nicht möglich'), 500)
         where id = v_photo.id;
      end if;
      v_failed := v_failed + 1;
      continue;
    end if;
    update public.photos
       set status = 'analysiert', analysis_error = null, analysis_source = v_source, analyzed_at = now(),
           scene = left(v_item->>'scene', 1000),
           area = left(v_item->>'area', 300),
           observations = case when jsonb_typeof(v_item->'observations') = 'array' then v_item->'observations' else '[]'::jsonb end,
           recommendations = case when jsonb_typeof(v_item->'recommendations') = 'array' then v_item->'recommendations' else '[]'::jsonb end
     where id = v_photo.id;
    v_photo_new := 0;
    for v_obj in select * from jsonb_array_elements(case when jsonb_typeof(v_item->'objects') = 'array' then v_item->'objects' else '[]'::jsonb end) loop
      v_key := left(lower(trim(coalesce(v_obj->>'key', ''))), 120);
      if jsonb_typeof(v_obj) <> 'object' or v_key = '' or coalesce(trim(v_obj->>'name'), '') = '' then
        v_invalid := v_invalid + 1;   -- wird gezählt und gemeldet, nicht still verworfen
        continue;
      end if;
      v_kind := case when v_obj->>'kind' in ('einzelinventar','bestandsartikel','set','einrichtung') then v_obj->>'kind' else 'unbekannt' end;
      v_conf := case when v_obj->>'confidence' in ('sicher','wahrscheinlich') then v_obj->>'confidence' else 'unbekannt' end;
      v_px := public.jnum(v_obj->'pos'->0); v_py := public.jnum(v_obj->'pos'->1);
      if v_px is null or v_py is null or v_px < 0 or v_px > 1 or v_py < 0 or v_py > 1 then v_px := null; v_py := null; end if;
      v_qty := public.jnum(v_obj->'quantity');
      if v_qty is not null and (v_qty < 0 or v_qty >= 1e9) then v_qty := null; end if;
      insert into public.detections (photo_id, obj_key, source, name, kind, category_id, category_text, brand, model, serial_no,
                                     text_read, quantity, quantity_certain, unit, condition, confidence, pos_x, pos_y,
                                     part_of_key, notes, product)
      values (v_photo.id, v_key, 'ki', left(trim(v_obj->>'name'), 200), v_kind,
              public.category_by_path(v_obj->>'category'), left(v_obj->>'category', 200),
              left(nullif(trim(v_obj->>'brand'), ''), 100), left(nullif(trim(v_obj->>'model'), ''), 100),
              left(nullif(trim(v_obj->>'serial'), ''), 100),
              case when jsonb_typeof(v_obj->'text_read') = 'array' then v_obj->'text_read' else '[]'::jsonb end,
              v_qty, coalesce(v_qty is not null and (v_obj->>'quantity_certain') = 'true', false),
              left(nullif(trim(v_obj->>'unit'), ''), 20), left(nullif(trim(v_obj->>'condition'), ''), 30), v_conf,
              v_px, v_py, left(nullif(lower(trim(v_obj->>'part_of')), ''), 120), left(v_obj->>'notes', 1000),
              case when jsonb_typeof(v_obj->'product') = 'object' then v_obj->'product' end)
      on conflict (photo_id, obj_key) do nothing;
      get diagnostics v_n = row_count;
      if v_n > 0 then v_created := v_created + 1; v_photo_new := v_photo_new + 1; else v_existing := v_existing + 1; end if;
    end loop;
    insert into public.audit_log (user_id, action, entity, entity_id, details)
    values (auth.uid(), 'ki_import', 'photos', v_photo.id,
            jsonb_build_object('quelle', v_source, 'datei', v_photo.file_name, 'neue_objekte', v_photo_new));
  end loop;
  return jsonb_build_object('matched', v_matched, 'created', v_created, 'existing', v_existing, 'failed', v_failed,
                            'duplicates', v_dupes, 'invalid', v_invalid, 'unmatched', v_unmatched);
end $$;

-- Fotos zur Analyse vormerken / zurücksetzen (z. B. «Analyse wiederholen» nach Fehler)
create or replace function public.set_photo_status(p_ids uuid[], p_status text)
returns int language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  if not public.is_staff() then raise exception 'LGR:not_authorized'; end if;
  if p_status = 'in_analyse' then
    update public.photos set status = 'in_analyse', analysis_error = null
     where id = any (p_ids) and status in ('neu', 'fehler');
  elsif p_status = 'neu' then
    update public.photos set status = 'neu', analysis_error = null
     where id = any (p_ids) and status in ('in_analyse', 'fehler');
  else
    raise exception 'LGR:invalid_status';
  end if;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- Objekt von Hand erfassen (z. B. unbekanntes Objekt bei der Inventur)
create or replace function public.add_detection(p_photo uuid, p_data jsonb)
returns public.detections language plpgsql security definer set search_path = public as $$
declare v_d public.detections; v_name text := left(trim(coalesce(p_data->>'name', '')), 200);
begin
  if not public.is_staff() then raise exception 'LGR:not_authorized'; end if;
  if not exists (select 1 from public.photos where id = p_photo) then raise exception 'LGR:not_found'; end if;
  if v_name = '' then v_name := 'Unbekanntes Objekt'; end if;
  insert into public.detections (photo_id, obj_key, source, name, kind, confidence, notes, pos_x, pos_y, target_location_id)
  values (p_photo, 'manuell-' || replace(gen_random_uuid()::text, '-', ''), 'manuell', v_name,
          case when p_data->>'kind' in ('einzelinventar','bestandsartikel','set','einrichtung') then p_data->>'kind' else 'unbekannt' end,
          'unbekannt', left(p_data->>'notes', 1000),
          case when public.jnum(p_data->'pos_x') between 0 and 1 then public.jnum(p_data->'pos_x') end,
          case when public.jnum(p_data->'pos_y') between 0 and 1 then public.jnum(p_data->'pos_y') end,
          (select id from public.locations where id = nullif(p_data->>'target_location_id', '')::uuid))
  returning * into v_d;
  insert into public.audit_log (user_id, action, entity, entity_id, details)
  values (auth.uid(), 'insert', 'detections', v_d.id, jsonb_build_object('name', v_d.name, 'quelle', 'manuell'));
  return v_d;
end $$;

-- Prüfaktionen für ein erkanntes Objekt:
--   bearbeiten, lagerort, spaeter, ablehnen, wiederoeffnen, zusammenfuehren, bestaetigen
create or replace function public.review_detection(p_id uuid, p_action text, p_data jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  d public.detections; v_into public.detections; v_photo public.photos;
  v_data jsonb := coalesce(p_data, '{}'::jsonb);
  v_root uuid; v_loc uuid; v_qty numeric; v_n int := 0; i int;
  v_codes text[] := '{}'; v_entity text := null; v_first uuid := null;
  v_m public.machines; v_a public.articles; v_l public.locations;
  v_cat_name text; v_type text; v_note text;
begin
  if not public.is_staff() then raise exception 'LGR:not_authorized'; end if;
  select * into d from public.detections where id = p_id for update;
  if not found then raise exception 'LGR:not_found'; end if;
  select * into v_photo from public.photos where id = d.photo_id;
  v_root := public.location_root(v_photo.location_id);

  -- Änderungen (bei «bearbeiten» und optional bei «bestaetigen»)
  if p_action in ('bearbeiten', 'bestaetigen', 'lagerort') and v_data <> '{}'::jsonb then
    if d.status in ('bestaetigt', 'zusammengefuehrt') then raise exception 'LGR:already_reviewed'; end if;
    if v_data ? 'name' and coalesce(trim(v_data->>'name'), '') = '' then raise exception 'LGR:name_required'; end if;
    if v_data ? 'kind' and coalesce(v_data->>'kind', '') not in ('einzelinventar','bestandsartikel','set','einrichtung','unbekannt') then
      raise exception 'LGR:invalid_input';
    end if;
    if nullif(v_data->>'category_id', '') is not null
       and not exists (select 1 from public.categories where id = (v_data->>'category_id')::uuid) then
      raise exception 'LGR:not_found';
    end if;
    if nullif(v_data->>'target_location_id', '') is not null
       and not exists (select 1 from public.locations where id = (v_data->>'target_location_id')::uuid and not archived) then
      raise exception 'LGR:invalid_location';
    end if;
    if v_data ? 'quantity' and v_data->'quantity' <> 'null'::jsonb
       and (public.jnum(v_data->'quantity') is null or public.jnum(v_data->'quantity') < 0 or public.jnum(v_data->'quantity') >= 1e9) then
      raise exception 'LGR:invalid_qty';
    end if;
    update public.detections set
      name = case when v_data ? 'name' then left(trim(v_data->>'name'), 200) else name end,
      kind = case when v_data ? 'kind' then v_data->>'kind' else kind end,
      category_id = case when v_data ? 'category_id' then nullif(v_data->>'category_id', '')::uuid else category_id end,
      brand = case when v_data ? 'brand' then left(nullif(trim(v_data->>'brand'), ''), 100) else brand end,
      model = case when v_data ? 'model' then left(nullif(trim(v_data->>'model'), ''), 100) else model end,
      serial_no = case when v_data ? 'serial_no' then left(nullif(trim(v_data->>'serial_no'), ''), 100) else serial_no end,
      unit = case when v_data ? 'unit' then left(nullif(trim(v_data->>'unit'), ''), 20) else unit end,
      notes = case when v_data ? 'notes' then left(v_data->>'notes', 1000) else notes end,
      quantity = case when v_data ? 'quantity' then public.jnum(v_data->'quantity') else quantity end,
      -- eine von Hand eingegebene Menge gilt als gezählt; ohne Menge nie «sicher»
      quantity_certain = case
        when v_data ? 'quantity' then public.jnum(v_data->'quantity') is not null
                                      and coalesce((v_data->>'quantity_certain')::boolean, true)
        else quantity_certain end,
      target_location_id = case when v_data ? 'target_location_id' then nullif(v_data->>'target_location_id', '')::uuid
                                else target_location_id end,
      status = case when status = 'spaeter' and p_action = 'bearbeiten' then 'offen' else status end,
      reviewed_by = auth.uid(), reviewed_at = now()
     where id = p_id
    returning * into d;
    if p_action = 'bearbeiten' or p_action = 'lagerort' then
      insert into public.audit_log (user_id, action, entity, entity_id, details)
      values (auth.uid(), 'ki_bearbeitet', 'detections', d.id, v_data);
      return jsonb_build_object('detection', to_jsonb(d));
    end if;
  elsif p_action in ('bearbeiten', 'lagerort') then
    return jsonb_build_object('detection', to_jsonb(d));
  end if;

  if p_action = 'spaeter' then
    if d.status <> 'offen' then raise exception 'LGR:already_reviewed'; end if;
    update public.detections set status = 'spaeter', reviewed_by = auth.uid(), reviewed_at = now() where id = p_id returning * into d;

  elsif p_action = 'ablehnen' then
    if d.status in ('bestaetigt') then raise exception 'LGR:already_reviewed'; end if;
    v_note := nullif(trim(v_data->>'reason'), '');
    update public.detections
       set status = 'abgelehnt', merged_into = null, reviewed_by = auth.uid(), reviewed_at = now(),
           notes = case when v_note is null then notes else left(concat_ws(' · ', notes, 'Abgelehnt: ' || v_note), 1000) end
     where id = p_id returning * into d;

  elsif p_action = 'wiederoeffnen' then
    if d.status = 'bestaetigt' then raise exception 'LGR:already_reviewed'; end if;
    update public.detections
       set status = 'offen', merged_into = null, article_id = null, machine_id = null, location_ref_id = null,
           reviewed_by = auth.uid(), reviewed_at = now()
     where id = p_id returning * into d;

  elsif p_action = 'zusammenfuehren' then
    if d.status = 'bestaetigt' then raise exception 'LGR:already_reviewed'; end if;
    select * into v_into from public.detections where id = nullif(v_data->>'into', '')::uuid;
    if not found or v_into.id = d.id then raise exception 'LGR:not_found'; end if;
    -- Kette auflösen: auf das Hauptobjekt zeigen
    for i in 1..10 loop
      exit when v_into.status <> 'zusammengefuehrt' or v_into.merged_into is null;
      select * into v_into from public.detections where id = v_into.merged_into;
    end loop;
    if v_into.id = d.id then raise exception 'LGR:invalid_input'; end if;
    update public.detections
       set status = 'zusammengefuehrt', merged_into = v_into.id,
           article_id = v_into.article_id, machine_id = v_into.machine_id, location_ref_id = v_into.location_ref_id,
           reviewed_by = auth.uid(), reviewed_at = now()
     where id = p_id returning * into d;
    -- Objekte, die bisher auf dieses zeigten, zeigen jetzt auf das Hauptobjekt
    update public.detections set merged_into = v_into.id where merged_into = p_id;

  elsif p_action = 'bestaetigen' then
    if d.status in ('bestaetigt', 'zusammengefuehrt', 'abgelehnt') then raise exception 'LGR:already_reviewed'; end if;
    v_loc := coalesce(d.target_location_id, v_photo.location_id);
    if v_loc is not null and exists (select 1 from public.locations where id = v_loc and archived) then
      raise exception 'LGR:invalid_location';
    end if;
    select name into v_cat_name from public.categories where id = d.category_id;

    if coalesce(v_data->>'mode', 'neu') = 'verknuepfen' then
      -- mit bestehendem Inventar verknüpfen (keine Doppelerfassung)
      if nullif(v_data->>'article_id', '') is not null then
        select * into v_a from public.articles where id = (v_data->>'article_id')::uuid;
        if not found then raise exception 'LGR:not_found'; end if;
        update public.detections set article_id = v_a.id where id = p_id;
        v_entity := 'article'; v_codes := array[v_a.code]; v_first := v_a.id;
      elsif nullif(v_data->>'machine_id', '') is not null then
        select * into v_m from public.machines where id = (v_data->>'machine_id')::uuid;
        if not found then raise exception 'LGR:not_found'; end if;
        update public.detections set machine_id = v_m.id where id = p_id;
        v_entity := 'machine'; v_codes := array[v_m.code]; v_first := v_m.id;
      elsif nullif(v_data->>'location_id', '') is not null then
        select * into v_l from public.locations where id = (v_data->>'location_id')::uuid;
        if not found then raise exception 'LGR:not_found'; end if;
        update public.detections set location_ref_id = v_l.id where id = p_id;
        v_entity := 'location'; v_codes := array[v_l.code]; v_first := v_l.id;
      else
        raise exception 'LGR:invalid_input';
      end if;

    elsif d.kind = 'unbekannt' then
      raise exception 'LGR:kind_required';

    elsif d.kind in ('einzelinventar', 'set') then
      -- jedes Einzelstück bekommt eine eigene Identität (eigener Code/QR)
      if not d.quantity_certain or d.quantity is null then raise exception 'LGR:quantity_uncertain'; end if;
      v_qty := d.quantity;
      if v_qty < 1 or v_qty > 50 or v_qty <> floor(v_qty) then raise exception 'LGR:invalid_qty'; end if;
      for i in 1..v_qty::int loop
        insert into public.machines (name, category, category_id, brand, model, serial_no, home_location_id, is_set,
                                     product_url, condition, notes)
        values (d.name, v_cat_name, d.category_id, d.brand, d.model, case when v_qty = 1 then d.serial_no end, v_loc,
                d.kind = 'set',
                case when d.product->>'url' ~* '^https?://[^\s]+$' then d.product->>'url' end,
                case when d.condition = 'beschaedigt' then 'maengel' else 'ok' end,
                left(concat_ws(E'\n', nullif(d.notes, ''), public.product_summary(d.product), 'Erfasst aus Foto ' || coalesce(v_photo.file_name, '')), 2000))
        returning * into v_m;
        v_codes := v_codes || v_m.code;
        if v_first is null then v_first := v_m.id; end if;
      end loop;
      update public.detections set machine_id = v_first where id = p_id;
      v_entity := 'machine';

    elsif d.kind = 'bestandsartikel' then
      -- unsichere Mengen werden nie als Bestand übernommen
      if not d.quantity_certain or d.quantity is null then
        if coalesce((v_data->>'without_stock')::boolean, false) is not true then raise exception 'LGR:quantity_uncertain'; end if;
        v_qty := 0;
      else
        v_qty := d.quantity;
      end if;
      insert into public.articles (name, category, category_id, brand, model, unit, stock, location_id, product_url, notes)
      values (d.name, v_cat_name, d.category_id, d.brand, d.model,
              case when d.unit in ('Stk','m','m²','kg','l','Rolle','Pkg','Paar','Set') then d.unit
                   when d.unit in ('Pack','Packung','Paket','Karton') then 'Pkg' else 'Stk' end,
              v_qty, v_loc,
              case when d.product->>'url' ~* '^https?://[^\s]+$' then d.product->>'url' end,
              left(concat_ws(E'\n', nullif(d.notes, ''),
                             case when v_qty = 0 and not d.quantity_certain then 'Menge noch nicht gezählt' end,
                             public.product_summary(d.product),
                             'Erfasst aus Foto ' || coalesce(v_photo.file_name, '')), 2000))
      returning * into v_a;
      update public.detections set article_id = v_a.id where id = p_id;
      v_entity := 'article'; v_codes := array[v_a.code]; v_first := v_a.id;

    elsif d.kind = 'einrichtung' then
      v_type := coalesce(nullif(v_data->>'loc_type', ''), 'regal');
      insert into public.locations (name, type, parent_id, short_code, notes)
      values (d.name, v_type, v_loc, nullif(upper(trim(v_data->>'short_code')), ''),
              left(concat_ws(E'\n', nullif(d.notes, ''), 'Erfasst aus Foto ' || coalesce(v_photo.file_name, '')), 2000))
      returning * into v_l;
      update public.detections set location_ref_id = v_l.id where id = p_id;
      v_entity := 'location'; v_codes := array[v_l.code]; v_first := v_l.id;
    end if;

    update public.detections set status = 'bestaetigt', reviewed_by = auth.uid(), reviewed_at = now()
     where id = p_id returning * into d;
    -- dasselbe Objekt auf weiteren Fotos desselben Raums: als «zusammengeführt» verknüpfen
    update public.detections x
       set status = 'zusammengefuehrt', merged_into = d.id,
           article_id = d.article_id, machine_id = d.machine_id, location_ref_id = d.location_ref_id,
           reviewed_by = auth.uid(), reviewed_at = now()
      from public.photos p
     where x.photo_id = p.id and x.id <> d.id and x.obj_key = d.obj_key and x.status in ('offen', 'spaeter')
       -- nur im selben Raum; Fotos ohne Lagerort werden nie raumübergreifend verknüpft
       and ((v_root is not null and public.location_root(p.location_id) = v_root)
            or (v_root is null and x.photo_id = d.photo_id));
    get diagnostics v_n = row_count;
  else
    raise exception 'LGR:invalid_input';
  end if;

  insert into public.audit_log (user_id, action, entity, entity_id, details)
  values (auth.uid(), 'ki_' || p_action, 'detections', d.id,
          jsonb_strip_nulls(jsonb_build_object('name', d.name, 'status', d.status, 'erfasst', v_entity,
                                               'codes', to_jsonb(v_codes), 'verknuepft', nullif(v_n, 0))));
  return jsonb_build_object('detection', to_jsonb(d), 'entity', v_entity, 'entity_id', v_first,
                            'codes', to_jsonb(v_codes), 'merged', v_n);
end $$;

-- Raum/Lagerort als «organisiert» abschliessen (nur ohne offene Prüfungen und Aufgaben) oder wieder öffnen
create or replace function public.set_location_organized(p_location uuid, p_done boolean)
returns public.locations language plpgsql security definer set search_path = public as $$
declare v_l public.locations; v_det int; v_tasks int;
begin
  if not public.is_staff() then raise exception 'LGR:not_authorized'; end if;
  select * into v_l from public.locations where id = p_location for update;
  if not found then raise exception 'LGR:not_found'; end if;
  if p_done then
    with recursive sub(id) as (
      select p_location union all select c.id from public.locations c join sub on c.parent_id = sub.id
    )
    select (select count(*) from public.detections d join public.photos p on p.id = d.photo_id
             where p.location_id in (select id from sub) and d.status in ('offen', 'spaeter')),
           (select count(*) from public.org_tasks t where t.location_id in (select id from sub) and t.status = 'offen')
      into v_det, v_tasks;
    if v_det > 0 or v_tasks > 0 then raise exception 'LGR:open_items:%/%', v_det, v_tasks; end if;
    perform set_config('lgr.skip_audit', 'on', true);
    update public.locations set organized_at = now(), organized_by = auth.uid() where id = p_location returning * into v_l;
  else
    perform set_config('lgr.skip_audit', 'on', true);
    update public.locations set organized_at = null, organized_by = null where id = p_location returning * into v_l;
  end if;
  perform set_config('lgr.skip_audit', '', true);
  insert into public.audit_log (user_id, action, entity, entity_id, details)
  values (auth.uid(), 'organisiert', 'locations', p_location, jsonb_build_object('organisiert', p_done));
  return v_l;
end $$;

-- =====================================================================
--  Ansichten (respektieren die Zugriffsregeln des angemeldeten Benutzers)
-- =====================================================================
drop view if exists public.site_overview, public.floor_plan_overview,
                    public.org_stats, public.space_overview, public.org_task_overview, public.detection_overview,
                    public.photo_overview, public.category_paths,
                    public.movement_overview, public.loan_overview, public.article_overview,
                    public.machine_overview, public.location_overview, public.location_paths cascade;

-- Pfad, Tiefe, Raum (root_id) und lesbarer Code «HL-RG01-FA02» (nur wenn alle Ebenen einen Kurzcode haben)
create view public.location_paths with (security_invoker = true) as
with recursive t (id, path, depth, trail, code_path, root_id) as (
  select l.id, l.name::text, 0, array[l.id], l.short_code::text, l.id from public.locations l where l.parent_id is null
  union all
  select c.id, t.path || ' / ' || c.name, t.depth + 1, t.trail || c.id,
         case when t.code_path is null or c.short_code is null then null else t.code_path || '-' || c.short_code end,
         t.root_id
    from public.locations c join t on c.parent_id = t.id
   where not c.id = any (t.trail)
)
select id, path, depth, code_path, root_id from t;

create view public.category_paths with (security_invoker = true) as
with recursive t (id, path, depth, trail, root_id) as (
  select c.id, c.name::text, 0, array[c.id], c.id from public.categories c where c.parent_id is null
  union all
  select c.id, t.path || ' › ' || c.name, t.depth + 1, t.trail || c.id, t.root_id
    from public.categories c join t on c.parent_id = t.id
   where not c.id = any (t.trail)
)
select c.*, t.path, t.depth, t.root_id
  from public.categories c join t on t.id = c.id;

create view public.location_overview with (security_invoker = true) as
select l.*, lp.path, lp.depth, lp.code_path, lp.root_id,
       coalesce(cp.path, ph.path) as photo_path,
       cp.path as cover_photo_path,
       rp.full_name as responsible_name,
       ob.full_name as organized_by_name,
       rl.site_id as space_site_id,          -- Standort des Raums (auch für Möbel/Unterorte)
       st.name as site_name
  from public.locations l
  left join public.location_paths lp on lp.id = l.id
  left join public.locations rl on rl.id = lp.root_id
  left join public.sites st on st.id = rl.site_id
  left join public.photos cp on cp.id = l.cover_photo_id
  left join public.profiles rp on rp.id = l.responsible_id
  left join public.profiles ob on ob.id = l.organized_by
  left join lateral (select x.path from public.attachments x
                      where x.entity = 'location' and x.entity_id = l.id and x.kind = 'photo'
                      order by x.is_primary desc, x.created_at limit 1) ph on true;

create view public.machine_overview with (security_invoker = true) as
select m.*,
       lp.path                      as location_path,
       lp.code_path                 as location_code_path,
       cp.path                      as category_path,
       rp.full_name                 as responsible_name,
       al.id                        as open_loan_id,
       al.borrower_id               as open_borrower_id,
       pb.full_name                 as open_borrower_name,
       al.checked_out_at            as open_since,
       al.due_at                    as open_due_at,
       (al.due_at is not null and al.due_at < now()) as overdue,
       ll.borrower_id               as last_borrower_id,
       lb.full_name                 as last_borrower_name,
       ll.checked_out_at            as last_checked_out_at,
       ll.returned_at               as last_returned_at,
       lr.full_name                 as last_returned_by_name,
       ll.return_condition          as last_return_condition,
       coalesce(ph.path, dp.path)   as photo_path,
       (select count(*) from public.set_components sc where sc.set_id = m.id) as component_count
  from public.machines m
  left join public.location_paths lp on lp.id = m.home_location_id
  left join public.category_paths cp on cp.id = m.category_id
  left join public.profiles rp on rp.id = m.responsible_id
  left join public.loans al on al.machine_id = m.id and al.returned_at is null
  left join public.profiles pb on pb.id = al.borrower_id
  left join lateral (select x.* from public.loans x
                      where x.machine_id = m.id and x.returned_at is not null
                      order by x.returned_at desc limit 1) ll on true
  left join public.profiles lb on lb.id = ll.borrower_id
  left join public.profiles lr on lr.id = ll.returned_by
  left join lateral (select x.path from public.attachments x
                      where x.entity = 'machine' and x.entity_id = m.id and x.kind = 'photo'
                      order by x.is_primary desc, x.created_at limit 1) ph on true
  left join lateral (select p.path from public.detections d join public.photos p on p.id = d.photo_id
                      where d.machine_id = m.id
                      order by (d.status = 'bestaetigt') desc, d.created_at limit 1) dp on true;

create view public.article_overview with (security_invoker = true) as
select a.*,
       lp.path as location_path,
       lp.code_path as location_code_path,
       cp.path as category_path,
       (a.min_stock is not null and a.stock <= a.min_stock) as low_stock,
       coalesce(ph.path, dp.path) as photo_path
  from public.articles a
  left join public.location_paths lp on lp.id = a.location_id
  left join public.category_paths cp on cp.id = a.category_id
  left join lateral (select x.path from public.attachments x
                      where x.entity = 'article' and x.entity_id = a.id and x.kind = 'photo'
                      order by x.is_primary desc, x.created_at limit 1) ph on true
  left join lateral (select p.path from public.detections d join public.photos p on p.id = d.photo_id
                      where d.article_id = a.id
                      order by (d.status = 'bestaetigt') desc, d.created_at limit 1) dp on true;

create view public.loan_overview with (security_invoker = true) as
select l.*,
       m.code   as machine_code,
       m.name   as machine_name,
       m.status as machine_status,
       b.full_name as borrower_name,
       r.full_name as returned_by_name,
       c.full_name as created_by_name,
       (l.returned_at is null and l.due_at is not null and l.due_at < now()) as overdue
  from public.loans l
  join public.machines m on m.id = l.machine_id
  left join public.profiles b on b.id = l.borrower_id
  left join public.profiles r on r.id = l.returned_by
  left join public.profiles c on c.id = l.created_by;

create view public.movement_overview with (security_invoker = true) as
select mv.*,
       a.code as article_code, a.name as article_name, a.unit,
       u.full_name as user_name,
       fl.path as from_path, tl.path as to_path
  from public.stock_movements mv
  join public.articles a on a.id = mv.article_id
  left join public.profiles u on u.id = mv.user_id
  left join public.location_paths fl on fl.id = mv.from_location_id
  left join public.location_paths tl on tl.id = mv.to_location_id;

create view public.photo_overview with (security_invoker = true) as
select p.*, lp.path as location_path, lp.root_id,
       u.full_name as uploaded_by_name,
       (select count(*) from public.detections d where d.photo_id = p.id) as detection_count,
       (select count(*) from public.detections d where d.photo_id = p.id and d.status in ('offen', 'spaeter')) as open_count
  from public.photos p
  left join public.location_paths lp on lp.id = p.location_id
  left join public.profiles u on u.id = p.uploaded_by;

create view public.detection_overview with (security_invoker = true) as
select d.*,
       p.path as photo_path, p.file_name as photo_file_name, p.location_id as photo_location_id,
       p.width as photo_width, p.height as photo_height,
       lp.root_id as space_id, lp.path as photo_location_path,
       tl.path as target_location_path,
       cp.path as category_path,
       a.code as article_code, a.name as article_name,
       m.code as machine_code, m.name as machine_name,
       rl.code as location_ref_code, rl.name as location_ref_name,
       rv.full_name as reviewed_by_name,
       (select count(*) from public.detections x
         where x.obj_key = d.obj_key and x.id <> d.id
           and x.photo_id in (select p2.id from public.photos p2 join public.location_paths l2 on l2.id = p2.location_id
                               where l2.root_id is not distinct from lp.root_id)) as same_key_count
  from public.detections d
  join public.photos p on p.id = d.photo_id
  left join public.location_paths lp on lp.id = p.location_id
  left join public.location_paths tl on tl.id = d.target_location_id
  left join public.category_paths cp on cp.id = d.category_id
  left join public.articles a on a.id = d.article_id
  left join public.machines m on m.id = d.machine_id
  left join public.locations rl on rl.id = d.location_ref_id
  left join public.profiles rv on rv.id = d.reviewed_by;

-- Gebäudepläne mit Bild und Anzahl Bereiche (verknüpft / nur beschriftet)
create view public.floor_plan_overview with (security_invoker = true) as
select f.*, p.path as photo_path, p.width as photo_width, p.height as photo_height,
       (select count(*) from public.photo_hotspots h where h.photo_id = f.photo_id) as area_count,
       (select count(*) from public.photo_hotspots h where h.photo_id = f.photo_id and h.location_id is not null) as linked_count,
       st.name as site_name, st.sort as site_sort
  from public.floor_plans f
  join public.photos p on p.id = f.photo_id
  left join public.sites st on st.id = f.site_id;

create view public.site_overview with (security_invoker = true) as
select s.*,
       (select count(*) from public.locations l where l.site_id = s.id and l.parent_id is null and not l.archived) as space_count,
       (select count(*) from public.floor_plans f where f.site_id = s.id) as plan_count
  from public.sites s;

create view public.org_task_overview with (security_invoker = true) as
select t.*, lp.path as location_path, lp.root_id,
       au.full_name as assigned_name, cu.full_name as created_by_name, du.full_name as done_by_name
  from public.org_tasks t
  left join public.location_paths lp on lp.id = t.location_id
  left join public.profiles au on au.id = t.assigned_to
  left join public.profiles cu on cu.id = t.created_by
  left join public.profiles du on du.id = t.done_by;

-- Räume (oberste Lagerorte) mit Kennzahlen und Organisationsstatus – alles aus echten Datensätzen
create view public.space_overview with (security_invoker = true) as
with s as (
  select l.id,
    (select count(*) from public.location_paths d where d.root_id = l.id and d.id <> l.id) as sublocations,
    (select count(*) from public.articles a join public.location_paths d on d.id = a.location_id
      where d.root_id = l.id and not a.archived) as articles,
    (select count(*) from public.machines m join public.location_paths d on d.id = m.home_location_id
      where d.root_id = l.id and not m.archived) as machines,
    (select count(*) from public.photos p join public.location_paths d on d.id = p.location_id where d.root_id = l.id and p.kind = 'foto') as photos,
    (select count(*) from public.photos p join public.location_paths d on d.id = p.location_id
      where d.root_id = l.id and p.kind = 'foto' and p.status = 'analysiert') as photos_analyzed,
    (select count(*) from public.photos p join public.location_paths d on d.id = p.location_id
      where d.root_id = l.id and p.kind = 'foto' and p.status = 'in_analyse') as photos_queued,
    (select count(*) from public.photos p join public.location_paths d on d.id = p.location_id
      where d.root_id = l.id and p.kind = 'foto' and p.status = 'fehler') as photos_failed,
    (select count(*) from public.detections x join public.photos p on p.id = x.photo_id
      join public.location_paths d on d.id = p.location_id
      where d.root_id = l.id and x.status in ('offen', 'spaeter')) as detections_open,
    (select count(*) from public.detections x join public.photos p on p.id = x.photo_id
      join public.location_paths d on d.id = p.location_id
      where d.root_id = l.id and x.status in ('bestaetigt', 'zusammengefuehrt')) as detections_done,
    (select count(*) from public.org_tasks t join public.location_paths d on d.id = t.location_id
      where d.root_id = l.id and t.status = 'offen') as tasks_open,
    (select count(*) from public.org_tasks t join public.location_paths d on d.id = t.location_id
      where d.root_id = l.id and t.status = 'erledigt') as tasks_done
  from public.locations l
  where l.parent_id is null
)
select lo.*, s.sublocations, s.articles, s.machines, s.photos, s.photos_analyzed, s.photos_queued, s.photos_failed,
       s.detections_open, s.detections_done, s.tasks_open, s.tasks_done,
       case
         when lo.organized_at is not null and s.detections_open = 0 and s.tasks_open = 0 then 'organisiert'
         when s.detections_open > 0 then 'zu_pruefen'
         when s.photos_queued > 0 then 'in_analyse'
         when s.tasks_open > 0 or s.detections_done > 0 or s.tasks_done > 0 then 'in_organisation'
         when s.photos > 0 then 'fotos_vorhanden'
         else 'nicht_erfasst'
       end as org_status,
       case
         when (s.detections_done + s.tasks_done + s.detections_open + s.tasks_open) = 0 then
           case when lo.organized_at is not null then 100 else 0 end
         else round(100.0 * (s.detections_done + s.tasks_done)
                    / (s.detections_done + s.tasks_done + s.detections_open + s.tasks_open))::int
       end as progress
  from public.location_overview lo join s on s.id = lo.id;

-- Kennzahlen für Übersicht und «Lager organisieren»
create view public.org_stats with (security_invoker = true) as
select
  (select count(*) from public.articles where not archived)                                     as articles_total,
  (select count(*) from public.machines where not archived)                                     as machines_total,
  (select count(*) from public.machines where not archived and is_set)                          as sets_total,
  (select count(*) from public.loans where returned_at is null)                                 as loans_open,
  (select count(*) from public.loans where returned_at is null and due_at is not null and due_at < now()) as loans_overdue,
  (select count(*) from public.articles where not archived and location_id is null)
    + (select count(*) from public.machines where not archived and home_location_id is null)    as items_without_location,
  (select count(*) from public.locations where not archived)                                    as locations_total,
  (select count(*) from public.locations where parent_id is null and not archived)              as spaces_total,
  (select count(*) from public.locations where parent_id is null and not archived and organized_at is not null) as spaces_organized,
  (select count(*) from public.photos where kind = 'foto')                                      as photos_total,
  (select count(*) from public.photos where kind = 'foto' and status = 'analysiert')            as photos_analyzed,
  (select count(*) from public.photos where kind = 'foto' and status in ('neu', 'in_analyse'))  as photos_pending,
  (select count(*) from public.photos where kind = 'foto' and status = 'fehler')                as photos_failed,
  (select count(*) from public.detections where status <> 'abgelehnt')                          as detections_total,
  (select count(*) from public.detections where status <> 'abgelehnt' and confidence in ('sicher', 'wahrscheinlich')) as detections_identified,
  (select count(*) from public.detections where status <> 'abgelehnt' and confidence = 'unbekannt') as detections_unknown,
  (select count(*) from public.detections where status in ('bestaetigt', 'zusammengefuehrt'))   as detections_confirmed,
  (select count(*) from public.detections where status in ('offen', 'spaeter'))                 as detections_open,
  (select count(*) from public.detections where status in ('offen', 'spaeter') and kind = 'einrichtung') as locations_proposed,
  (select count(*) from (select obj_key from public.detections where status in ('offen', 'spaeter')
                          group by obj_key having count(*) > 1) g)                              as duplicate_groups,
  (select count(*) from public.org_tasks where status = 'offen')                                as tasks_open,
  (select count(*) from public.stock_movements where created_at > now() - interval '7 days')    as movements_7d;


-- =====================================================================
--  Zugriffsrechte (Row Level Security)
-- =====================================================================
alter table public.profiles                 enable row level security;
alter table public.audit_log                enable row level security;
alter table public.locations                enable row level security;
alter table public.articles                 enable row level security;
alter table public.machines                 enable row level security;
alter table public.loans                    enable row level security;
alter table public.stock_movements          enable row level security;
alter table public.attachments              enable row level security;
alter table public.inventories              enable row level security;
alter table public.inventory_counts         enable row level security;
alter table public.inventory_machine_checks enable row level security;

-- Grundsatz: lesen dürfen alle freigegebenen Mitarbeiter; schreiben nur über Regeln/Funktionen.
-- Supabase vergibt per Default-Privileges ALL (inkl. TRUNCATE, das RLS umgeht) an anon/authenticated
-- auf Tabellen und Sequenzen – deshalb zuerst alles entziehen und gezielt neu vergeben.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
grant select on all tables in schema public to authenticated;

grant insert, delete on public.locations to authenticated;
grant update (name, type, parent_id, notes, archived) on public.locations to authenticated;
grant insert, delete on public.articles to authenticated;
grant update (name, description, art_no, category, brand, model, size, color, usage, label_text, unit,
              min_stock, location_id, notes, archived) on public.articles to authenticated;
grant insert, delete on public.machines to authenticated;
grant update (name, category, brand, model, serial_no, inventory_no, home_location_id,
              condition, condition_note, notes, archived) on public.machines to authenticated;
grant delete on public.attachments to authenticated;
grant insert (entity, entity_id, kind, path, file_name, mime, size_bytes, note, loan_id) on public.attachments to authenticated;
revoke all on public.bootstrap_admins from anon, authenticated;
revoke all on public.invites from anon, authenticated;
grant select, insert, delete on public.invites to authenticated;   -- nur Admins, siehe RLS
grant update (note) on public.attachments to authenticated;
grant insert (name, note) on public.inventories to authenticated;

-- «(select …)»: Postgres wertet die Rechteprüfung einmal pro Abfrage statt einmal pro Zeile aus
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated
  using ((select public.is_active_user()) or id = (select auth.uid()));

drop policy if exists audit_read on public.audit_log;
create policy audit_read on public.audit_log for select to authenticated using ((select public.is_staff()));

drop policy if exists locations_read on public.locations;
create policy locations_read on public.locations for select to authenticated using ((select public.is_active_user()));
drop policy if exists locations_insert on public.locations;
create policy locations_insert on public.locations for insert to authenticated with check ((select public.is_staff()));
drop policy if exists locations_update on public.locations;
create policy locations_update on public.locations for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
drop policy if exists locations_delete on public.locations;
create policy locations_delete on public.locations for delete to authenticated using ((select public.is_admin()));

drop policy if exists articles_read on public.articles;
create policy articles_read on public.articles for select to authenticated using ((select public.is_active_user()));
drop policy if exists articles_insert on public.articles;
create policy articles_insert on public.articles for insert to authenticated with check ((select public.is_staff()));
drop policy if exists articles_update on public.articles;
create policy articles_update on public.articles for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
drop policy if exists articles_delete on public.articles;
create policy articles_delete on public.articles for delete to authenticated using ((select public.is_admin()));

drop policy if exists machines_read on public.machines;
create policy machines_read on public.machines for select to authenticated using ((select public.is_active_user()));
drop policy if exists machines_insert on public.machines;
create policy machines_insert on public.machines for insert to authenticated with check ((select public.is_staff()));
drop policy if exists machines_update on public.machines;
create policy machines_update on public.machines for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
drop policy if exists machines_delete on public.machines;
create policy machines_delete on public.machines for delete to authenticated using ((select public.is_admin()));

drop policy if exists loans_read on public.loans;
create policy loans_read on public.loans for select to authenticated using ((select public.is_active_user()));
drop policy if exists movements_read on public.stock_movements;
create policy movements_read on public.stock_movements for select to authenticated using ((select public.is_active_user()));

drop policy if exists attachments_read on public.attachments;
create policy attachments_read on public.attachments for select to authenticated using ((select public.is_active_user()));
drop policy if exists attachments_insert on public.attachments;
create policy attachments_insert on public.attachments for insert to authenticated with check ((select public.is_active_user()));
drop policy if exists attachments_update on public.attachments;
create policy attachments_update on public.attachments for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
drop policy if exists attachments_delete on public.attachments;
-- Löschen nur durch Lagerverantwortliche/Admins (Datei im Storage ebenso), damit nichts verwaist
create policy attachments_delete on public.attachments for delete to authenticated
  using ((select public.is_staff()));

drop policy if exists invites_admin_read on public.invites;
create policy invites_admin_read on public.invites for select to authenticated using ((select public.is_admin()));
drop policy if exists invites_admin_insert on public.invites;
create policy invites_admin_insert on public.invites for insert to authenticated with check ((select public.is_admin()));
drop policy if exists invites_admin_delete on public.invites;
create policy invites_admin_delete on public.invites for delete to authenticated using ((select public.is_admin()));

drop policy if exists inventories_read on public.inventories;
create policy inventories_read on public.inventories for select to authenticated using ((select public.is_active_user()));
drop policy if exists inventories_insert on public.inventories;
create policy inventories_insert on public.inventories for insert to authenticated with check ((select public.is_staff()));
drop policy if exists inventory_counts_read on public.inventory_counts;
create policy inventory_counts_read on public.inventory_counts for select to authenticated using ((select public.is_active_user()));
drop policy if exists inventory_checks_read on public.inventory_machine_checks;
create policy inventory_checks_read on public.inventory_machine_checks for select to authenticated using ((select public.is_active_user()));

-- ---- Lager organisieren: Zugriffsrechte ----
alter table public.categories     enable row level security;
alter table public.photos         enable row level security;
alter table public.detections     enable row level security;
alter table public.photo_hotspots enable row level security;
alter table public.org_tasks      enable row level security;
alter table public.set_components enable row level security;

grant update (short_code, responsible_id, cover_photo_id) on public.locations to authenticated;
grant update (site_id) on public.locations to authenticated;
grant update (category_id, product_url) on public.articles to authenticated;
grant update (category_id, responsible_id, is_set, product_url) on public.machines to authenticated;
grant insert (location_id) on public.inventories to authenticated;
grant insert (parent_id, name, sort, archived) on public.categories to authenticated;
grant update (parent_id, name, sort, archived) on public.categories to authenticated;
grant delete on public.categories to authenticated;
grant insert (location_id, path, sha256, file_name, folder, mime, size_bytes, width, height, kind) on public.photos to authenticated;
grant update (location_id) on public.photos to authenticated;
grant delete on public.photos to authenticated;
grant insert (photo_id, location_id, x, y, w, h, label) on public.photo_hotspots to authenticated;
grant update (location_id, x, y, w, h, label) on public.photo_hotspots to authenticated;
grant delete on public.photo_hotspots to authenticated;
grant insert (location_id, photo_id, title, details, source, status, assigned_to, sort) on public.org_tasks to authenticated;
grant update (title, details, status, assigned_to, sort) on public.org_tasks to authenticated;
grant insert (set_id, machine_id, article_id, name, qty, note, sort) on public.set_components to authenticated;
grant update (qty, note, sort, name) on public.set_components to authenticated;
grant delete on public.set_components to authenticated;
-- detections: nur lesen; Änderungen ausschliesslich über import_photo_analysis / review_detection / add_detection

drop policy if exists categories_read on public.categories;
create policy categories_read on public.categories for select to authenticated using ((select public.is_active_user()));
drop policy if exists categories_insert on public.categories;
create policy categories_insert on public.categories for insert to authenticated with check ((select public.is_staff()));
drop policy if exists categories_update on public.categories;
create policy categories_update on public.categories for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
drop policy if exists categories_delete on public.categories;
create policy categories_delete on public.categories for delete to authenticated using ((select public.is_admin()));

drop policy if exists photos_read on public.photos;
create policy photos_read on public.photos for select to authenticated using ((select public.is_active_user()));
drop policy if exists photos_insert on public.photos;
create policy photos_insert on public.photos for insert to authenticated with check ((select public.is_staff()));
drop policy if exists photos_update on public.photos;
create policy photos_update on public.photos for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
drop policy if exists photos_delete on public.photos;
create policy photos_delete on public.photos for delete to authenticated using ((select public.is_staff()));

drop policy if exists detections_read on public.detections;
create policy detections_read on public.detections for select to authenticated using ((select public.is_active_user()));

drop policy if exists photo_hotspots_read on public.photo_hotspots;
create policy photo_hotspots_read on public.photo_hotspots for select to authenticated using ((select public.is_active_user()));
drop policy if exists photo_hotspots_insert on public.photo_hotspots;
create policy photo_hotspots_insert on public.photo_hotspots for insert to authenticated with check ((select public.is_staff()));
drop policy if exists photo_hotspots_update on public.photo_hotspots;
create policy photo_hotspots_update on public.photo_hotspots for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
drop policy if exists photo_hotspots_delete on public.photo_hotspots;
create policy photo_hotspots_delete on public.photo_hotspots for delete to authenticated using ((select public.is_staff()));

drop policy if exists org_tasks_read on public.org_tasks;
create policy org_tasks_read on public.org_tasks for select to authenticated using ((select public.is_active_user()));
drop policy if exists org_tasks_insert on public.org_tasks;
create policy org_tasks_insert on public.org_tasks for insert to authenticated with check ((select public.is_staff()));
drop policy if exists org_tasks_update on public.org_tasks;
create policy org_tasks_update on public.org_tasks for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));

drop policy if exists set_components_read on public.set_components;
create policy set_components_read on public.set_components for select to authenticated using ((select public.is_active_user()));
drop policy if exists set_components_insert on public.set_components;
create policy set_components_insert on public.set_components for insert to authenticated with check ((select public.is_staff()));
drop policy if exists set_components_update on public.set_components;
create policy set_components_update on public.set_components for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
drop policy if exists set_components_delete on public.set_components;
create policy set_components_delete on public.set_components for delete to authenticated using ((select public.is_staff()));

alter table public.floor_plans enable row level security;
grant insert (name, sort, photo_id, notes, site_id) on public.floor_plans to authenticated;
grant update (name, sort, notes, site_id) on public.floor_plans to authenticated;
grant delete on public.floor_plans to authenticated;
drop policy if exists floor_plans_read on public.floor_plans;
create policy floor_plans_read on public.floor_plans for select to authenticated using ((select public.is_active_user()));
drop policy if exists floor_plans_insert on public.floor_plans;
create policy floor_plans_insert on public.floor_plans for insert to authenticated with check ((select public.is_staff()));
drop policy if exists floor_plans_update on public.floor_plans;
create policy floor_plans_update on public.floor_plans for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
drop policy if exists floor_plans_delete on public.floor_plans;
create policy floor_plans_delete on public.floor_plans for delete to authenticated using ((select public.is_admin()));

-- Standorte: alle aktiven Benutzer lesen; Lagerverantwortliche/Admins anlegen und ändern; nur Admins löschen
-- (ein Standort mit Räumen oder Plänen lässt sich nicht löschen: Fremdschlüssel «restrict»)
alter table public.sites enable row level security;
revoke insert, update, delete on public.sites from authenticated;
grant insert (name, address, sort, notes) on public.sites to authenticated;
grant update (name, address, sort, notes) on public.sites to authenticated;
grant delete on public.sites to authenticated;
drop policy if exists sites_read on public.sites;
create policy sites_read on public.sites for select to authenticated using ((select public.is_active_user()));
drop policy if exists sites_insert on public.sites;
create policy sites_insert on public.sites for insert to authenticated with check ((select public.is_staff()));
drop policy if exists sites_update on public.sites;
create policy sites_update on public.sites for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
drop policy if exists sites_delete on public.sites;
create policy sites_delete on public.sites for delete to authenticated using ((select public.is_admin()));

-- Funktionen: nur angemeldete Benutzer (nicht anonym) dürfen sie aufrufen
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig, p.proname
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('machine_checkout','machine_return','machine_set_status','admin_correct_loan','stock_move',
                         'update_my_profile','admin_update_profile','set_primary_attachment',
                         'inventory_count','inventory_check_machine','inventory_close',
                         'import_photo_analysis','set_photo_status','add_detection','review_detection',
                         'set_location_organized','category_by_path','location_root','jnum','product_summary',
                         'check_category_parent','photo_insert_defaults','photo_delete_guard','org_task_status',
                         'current_role_name','is_active_user','is_staff','is_admin',
                         'handle_new_user','set_updated_at','set_created_by','assign_code','check_location_parent',
                         'machine_insert_guard','article_initial_movement','audit_row',
                         'promote_bootstrap_admin','handle_user_confirmed','location_site_top_only')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
    if f.proname not in ('handle_new_user','set_updated_at','set_created_by','assign_code','check_location_parent',
                         'machine_insert_guard','article_initial_movement','audit_row',
                         'promote_bootstrap_admin','handle_user_confirmed',
                         'check_category_parent','photo_insert_defaults','photo_delete_guard','org_task_status','product_summary',
                         'location_root','category_by_path','jnum','location_site_top_only') then   -- nur intern in anderen Funktionen
      execute format('grant execute on function %s to authenticated', f.sig);
    end if;
  end loop;
end $$;

-- =====================================================================
--  Dateien (Supabase Storage): privater Bucket «media», max. 25 MB pro Datei
-- =====================================================================
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit)
    values ('media', 'media', false, 26214400)
    on conflict (id) do nothing;
    -- nur Fotos und Büro-Dokumente (kein HTML/SVG, das im Browser Code ausführen könnte)
    update storage.buckets
       set allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif',
                                      'application/pdf','text/plain','text/csv','application/msword',
                                      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                                      'application/vnd.ms-excel',
                                      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
           file_size_limit = 26214400
     where id = 'media';
    execute 'drop policy if exists "lgr media read" on storage.objects';
    execute $p$create policy "lgr media read" on storage.objects for select to authenticated
             using (bucket_id = 'media' and public.is_active_user())$p$;
    execute 'drop policy if exists "lgr media upload" on storage.objects';
    execute $p$create policy "lgr media upload" on storage.objects for insert to authenticated
             with check (bucket_id = 'media' and public.is_active_user()
                         -- Import-Fotos (photos/<sha256>) nur Lagerverantwortliche/Admins: niemand kann einem
                         -- künftigen Import eine andere Datei unterschieben
                         and (name not like 'photos/%' or public.is_staff()))$p$;
    execute 'drop policy if exists "lgr media delete" on storage.objects';
    execute $p$create policy "lgr media delete" on storage.objects for delete to authenticated
             using (bucket_id = 'media' and public.is_staff())$p$;
  end if;
end $$;
