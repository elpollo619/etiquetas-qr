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
              check (type in ('lager','raum','regal','fach','box','behaelter','fahrzeug','temporaer')),
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
--  Ansichten (respektieren die Zugriffsregeln des angemeldeten Benutzers)
-- =====================================================================
drop view if exists public.movement_overview, public.loan_overview, public.article_overview,
                    public.machine_overview, public.location_overview, public.location_paths cascade;

create view public.location_paths with (security_invoker = true) as
with recursive t (id, path, depth, trail) as (
  select l.id, l.name::text, 0, array[l.id] from public.locations l where l.parent_id is null
  union all
  select c.id, t.path || ' / ' || c.name, t.depth + 1, t.trail || c.id
    from public.locations c join t on c.parent_id = t.id
   where not c.id = any (t.trail)
)
select id, path, depth from t;

create view public.location_overview with (security_invoker = true) as
select l.*, lp.path, lp.depth, ph.path as photo_path
  from public.locations l
  left join public.location_paths lp on lp.id = l.id
  left join lateral (select x.path from public.attachments x
                      where x.entity = 'location' and x.entity_id = l.id and x.kind = 'photo'
                      order by x.is_primary desc, x.created_at limit 1) ph on true;

create view public.machine_overview with (security_invoker = true) as
select m.*,
       lp.path                      as location_path,
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
       ph.path                      as photo_path
  from public.machines m
  left join public.location_paths lp on lp.id = m.home_location_id
  left join public.loans al on al.machine_id = m.id and al.returned_at is null
  left join public.profiles pb on pb.id = al.borrower_id
  left join lateral (select x.* from public.loans x
                      where x.machine_id = m.id and x.returned_at is not null
                      order by x.returned_at desc limit 1) ll on true
  left join public.profiles lb on lb.id = ll.borrower_id
  left join public.profiles lr on lr.id = ll.returned_by
  left join lateral (select x.path from public.attachments x
                      where x.entity = 'machine' and x.entity_id = m.id and x.kind = 'photo'
                      order by x.is_primary desc, x.created_at limit 1) ph on true;

create view public.article_overview with (security_invoker = true) as
select a.*,
       lp.path as location_path,
       (a.min_stock is not null and a.stock <= a.min_stock) as low_stock,
       ph.path as photo_path
  from public.articles a
  left join public.location_paths lp on lp.id = a.location_id
  left join lateral (select x.path from public.attachments x
                      where x.entity = 'article' and x.entity_id = a.id and x.kind = 'photo'
                      order by x.is_primary desc, x.created_at limit 1) ph on true;

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
                         'current_role_name','is_active_user','is_staff','is_admin',
                         'handle_new_user','set_updated_at','set_created_by','assign_code','check_location_parent',
                         'machine_insert_guard','article_initial_movement','audit_row',
                         'promote_bootstrap_admin','handle_user_confirmed')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
    if f.proname not in ('handle_new_user','set_updated_at','set_created_by','assign_code','check_location_parent',
                         'machine_insert_guard','article_initial_movement','audit_row',
                         'promote_bootstrap_admin','handle_user_confirmed') then
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
             with check (bucket_id = 'media' and public.is_active_user())$p$;
    execute 'drop policy if exists "lgr media delete" on storage.objects';
    execute $p$create policy "lgr media delete" on storage.objects for delete to authenticated
             using (bucket_id = 'media' and public.is_staff())$p$;
  end if;
end $$;
