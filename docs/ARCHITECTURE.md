# Lagerverwaltung – Architektur und Verträge (für alle Mitwirkenden)

Statische Web-App (GitHub Pages, **ohne Build-Schritt**, native ES-Module) + Supabase (Postgres, Auth, Storage).
Hauptsprache **Deutsch (de-CH, kein «ß», z. B. «Grösse», «Strasse»)**, dazu **Portugiesisch (pt-PT)** und **Spanisch (es)**.
Mobile first: ein Mitarbeiter muss eine Maschine mit Scannen → «Maschine ausleihen» → Bestätigen ausleihen können.

## Dateien

```
index.html            Shell, lädt css/app.css und js/app.js (type=module)
css/app.css           Gemeinsame Komponenten (siehe «CSS-Klassen»)
js/config.js          SUPABASE_URL, SUPABASE_ANON_KEY, PUBLIC_BASE_URL
js/i18n.js            t(), registerStrings(), setLang(), getLang(), fmtDateTime(), fmtDate(), fmtElapsed(), fmtQty()
js/util.js            esc(), uuid(), toast(), sheet(), confirmSheet(), errorText(), statusPill(), conditionLabel(),
                      can(), routeForCode(), downloadCsv(), thumbHtml(), hydrateThumbs(), emptyHtml(), debounce()
js/api.js             export const api  → Supabase (wenn konfiguriert) oder Demo
js/api-supabase.js    Implementierung mit supabase-js
js/api-demo.js        Gleiche API, Daten in localStorage, gleiche Regeln und Fehlercodes
js/labels.js          Etiketten-Engine (Brother QL-800, QR) – printLabels(), labelSvg(), downloadLabelPng()
js/scanner.js         openScanner({ title, onCode }) – Kamera, BarcodeDetector oder jsQR
js/app.js             Router, Navigation, Login/Registrierung, Kontext für Ansichten
js/views/*.js         Ansichten; jede Datei exportiert `routes` und registriert ihre Texte
supabase/schema.sql   Datenbank (Tabellen, Ansichten, Funktionen, RLS) – Quelle der Wahrheit
```

## Datenmodell (Kurzfassung; Details in supabase/schema.sql)

- `profiles` (Mitarbeiter): id, full_name, email, role (`admin` | `lagerverantwortlicher` | `mitarbeiter`), active, lang (`de`|`pt`|`es`)
- `locations` / Ansicht `location_overview`: id, code (`L-0001`), name, type (`lager`,`raum`,`regal`,`fach`,`box`,`behaelter`,`fahrzeug`,`temporaer`), parent_id, notes, archived, **path** («Hauptlager / Regal A / Fach 02»), depth, photo_path
- `articles` / `article_overview`: id, code (`INV-0001`), name, description, art_no, category, brand, model, size, color, usage, label_text, unit (`Stk`,`m`,`m²`,`kg`,`l`,`Rolle`,`Pkg`,`Paar`,`Set`), stock, min_stock, location_id, notes, archived, **location_path**, **low_stock**, photo_path
- `machines` / `machine_overview`: id, code (`M-0001`), name, category, brand, model, serial_no, inventory_no, home_location_id, status (`verfuegbar`,`ausgeliehen`,`reserviert`,`wartung`,`defekt`,`verloren`), condition (`ok`,`maengel`,`defekt`), condition_note, notes, archived, **location_path**, **open_loan_id, open_borrower_id, open_borrower_name, open_since, open_due_at, overdue**, **last_borrower_id, last_borrower_name, last_checked_out_at, last_returned_at, last_returned_by_name, last_return_condition**, photo_path
- `loans` / `loan_overview`: id, machine_id, borrower_id, checked_out_at, due_at, checkout_note, returned_at, returned_by, return_condition, return_note, corrected, created_by, **machine_code, machine_name, machine_status, borrower_name, returned_by_name, created_by_name, overdue**
- `stock_movements` / `movement_overview`: id, article_id, type (`anlage`,`zugang`,`entnahme`,`umlagerung`,`korrektur`,`inventur`), qty (+/-), stock_before, stock_after, from_location_id, to_location_id, user_id, note, created_at, **article_code, article_name, unit, user_name, from_path, to_path**
- `attachments`: id, entity (`article`|`machine`|`location`), entity_id, kind (`photo`|`document`|`damage`), path, file_name, mime, size_bytes, is_primary, note, loan_id, uploaded_by, created_at
- `inventories`: id, name, status (`offen`|`abgeschlossen`), note, started_by, started_at, closed_by, closed_at, applied
- `inventory_counts`: id, inventory_id, article_id, expected, counted, counted_by, counted_at, applied
- `inventory_machine_checks`: id, inventory_id, machine_id, result (`vorhanden`,`fehlt`,`defekt`,`ausgeliehen`), note, checked_by, checked_at
- `audit_log`: id, at, user_id, action, entity, entity_id, details (jsonb)

QR-Codes enthalten **nur** `PUBLIC_BASE_URL + '?c=' + CODE` (z. B. `…/etiquetas-qr/?c=M-0028`). Codes sind dauerhaft.
Präfix → Typ: `M-` Maschine, `L-` Lagerort, sonst Artikel (`INV-…`). Alte Etiketten `?id=INV-0001` funktionieren weiter.

## Rechte

| Aktion | Mitarbeiter | Lagerverantwortlicher | Admin |
|---|---|---|---|
| Alles lesen | ✓ | ✓ | ✓ |
| Maschine ausleihen / zurückgeben (auch für andere zurückgeben) | ✓ | ✓ | ✓ |
| Ausleihen für eine andere Person buchen | – | ✓ | ✓ |
| Material Entnahme / Zugang | ✓ | ✓ | ✓ |
| Umlagerung, Korrektur, Status setzen, Stammdaten anlegen/bearbeiten/archivieren | – | ✓ | ✓ |
| Inventur zählen | ✓ | ✓ | ✓ |
| Inventur anlegen / abschliessen | – | ✓ | ✓ |
| Löschen, Ausleihe korrigieren, Mitarbeiter verwalten | – | – | ✓ |
| Protokoll ansehen | – | ✓ | ✓ |

`can(user, 'staff')` = admin oder lagerverantwortlicher; `can(user, 'admin')`.

## API-Vertrag (`import { api } from './api.js'`) – alle Methoden async

Fehler: `throw new LgrError(code, detail)` (`LgrError` aus api.js). Codes = die `LGR:`-Codes aus schema.sql ohne Präfix
(`not_authorized`, `not_found`, `not_available` (detail = aktueller Status), `reserved`, `not_on_loan`, `on_loan`,
`note_required`, `reason_required`, `insufficient_stock`, `invalid_qty`, `invalid_location`, `location_cycle`,
`code_immutable`, `inventory_closed`, `last_admin`, `invalid_dates`, `due_in_past`, `name_required`, …) sowie
`network`, `duplicate_code`, `in_use` (Löschen nicht möglich, weil Verlauf existiert), `auth_invalid`, `auth_exists`,
`weak_password`, `unknown`. Postgres 42501 bzw. RLS-«0 Zeilen» → `not_authorized`.

```
api.mode                                   'supabase' | 'demo'
api.init()
api.getSession()                           → { userId, email } | null
api.onAuthChange(cb)                       cb(event, session); event ∈ SIGNED_IN, SIGNED_OUT, PASSWORD_RECOVERY, USER_UPDATED
api.signIn(email, password)
api.signUp({ fullName, email, password, lang }) → { needsConfirmation: boolean }
api.signOut()
api.resetPassword(email)
api.updatePassword(newPassword)
api.getMyProfile()                         → profile | null
api.updateMyProfile({ full_name, lang })   → profile
api.demoUsers()  / api.demoSwitchUser(id)  nur im Demo-Modus

api.listProfiles()                         → profiles (alle, sortiert nach Name)
api.adminUpdateProfile(id, { full_name, role, active }) → profile

api.listLocations({ includeArchived })     → location_overview, sortiert nach path
api.getLocation(id) / api.getLocationByCode(code) → row | null
api.saveLocation(obj)                      → row   (ohne id = neu; code optional nur bei neu)
api.deleteLocation(id)

api.listMachines({ includeArchived })      → machine_overview, sortiert nach name
api.getMachine(id) / api.getMachineByCode(code) → row | null
api.saveMachine(obj)                       → machine_overview-Zeile
api.deleteMachine(id)
api.checkoutMachine(id, { requestId, dueAt, note, borrowerId }) → loan
api.returnMachine(id, { requestId, condition, note })            → loan
api.setMachineStatus(id, status, note)     → machine
api.listLoans({ machineId, borrowerId, open, from, to, limit })  → loan_overview, neueste zuerst
api.correctLoan(loanId, { checked_out_at, due_at, returned_at, reason }) → loan

api.listArticles({ includeArchived })      → article_overview, sortiert nach name
api.getArticle(id) / api.getArticleByCode(code) → row | null
api.saveArticle(obj)                       → article_overview-Zeile (stock nur bei neu)
api.deleteArticle(id)
api.moveStock(articleId, { type, qty, requestId, note, toLocationId }) → movement
api.listMovements({ articleId, userId, limit }) → movement_overview, neueste zuerst

api.listAttachments(entity, entityId)      → attachments (Hauptfoto zuerst, dann nach Datum)
api.uploadAttachment(entity, entityId, file, { kind, note, loanId }) → attachment (Bilder werden auf max. 1600 px verkleinert)
api.deleteAttachment(attachment)
api.setPrimaryAttachment(id)
api.fileUrls(paths)                        → Map(path → url)   (signierte URLs, zwischengespeichert)

api.listInventories()                      → inventories, neueste zuerst
api.createInventory({ name, note })        → inventory
api.getInventory(id)                       → { inventory, counts, checks }
api.countArticle(inventoryId, articleId, counted) → count
api.checkMachine(inventoryId, machineId, result, note) → check
api.closeInventory(inventoryId, apply)     → inventory

api.listAudit({ limit, entity, entityId }) → audit_log, neueste zuerst
```

`requestId` = `uuid()` beim Öffnen des Bestätigungsdialogs erzeugen und bei Wiederholung derselben Aktion wiederverwenden
(verhindert Doppelbuchungen bei Doppeltipp oder Verbindungsproblemen).

## Ansichten (js/views/*.js)

Jede Datei:

```js
import { t, registerStrings } from '../i18n.js';
registerStrings({ de: { 'machines.title': 'Maschinen', … }, pt: { … }, es: { … } });   // eigene Texte, Präfix = Dateiname
export const routes = {
  'maschinen': async (ctx) => { … },
  'm/:code':   async (ctx) => { … },
};
```

`ctx` = `{ el, params, query, user, api, go(path), reload(), setTitle(text) }`
- `el`: leerer Container der Seite – Ansicht füllt ihn (innerHTML + Event-Listener).
- `user`: eigenes Profil `{ id, full_name, role, active, lang }`.
- `go('m/M-0001')` navigiert (Hash-Routing `#/m/M-0001`); `reload()` rendert die aktuelle Route neu.
- Alle Benutzerdaten mit `esc()` ausgeben. Fehler mit `toast(errorText(err), 'error')` anzeigen.
- Routen: `''` (Übersicht), `scan`, `maschinen`, `maschinen/neu`, `m/:code`, `m/:code/bearbeiten`, `ausgeliehen`,
  `artikel`, `artikel/neu`, `a/:code`, `a/:code/bearbeiten`, `lagerorte`, `lagerorte/neu`, `l/:code`, `l/:code/bearbeiten`,
  `inventur`, `inventur/:id`, `mitarbeiter`, `mitarbeiter/:id`, `protokoll`, `etiketten`, `profil`.

## Gemeinsame Module (vom Lead geschrieben – nur benutzen, nicht ändern)

**js/util.js** – `esc, clean, $, $$, uuid, debounce, can(user, 'staff'|'admin'), routeForCode(code), parseScanned(text),
statusPill(status), conditionLabel(c), roleLabel(r), locTypeLabel(type), emptyHtml(text, actionHtml), errorText(err),
toast(msg, 'ok'|'error'|'info'), sheet({ title, body, actions:[{label, kind, icon, block, value, onClick:async(el, close)=>…}], onOpen(el, close), wide }) → Promise,
confirmSheet(title, message, { okLabel, danger }) → Promise<boolean>, openLightbox(url), thumbHtml(path, alt, cls, iconName),
hydrateThumbs(root, api), downloadCsv(filename, rows), downloadBlob, today(), formData(form), nullIfEmpty, numOrNull,
toLocalInput(iso), fromLocalInput(value), icon(name)` (Icons: home, scan, machine, box, location, users, user, clipboard,
handoff, label, history, more, plus, minus, back, chevron, x, check, alert, camera, file, print, edit, trash, logout,
search, clock, arrowIn, arrowOut, move, download, globe, wrench, list).
In `sheet()`: Fehler aus `onClick` werden automatisch im Dialog angezeigt; `return false` hält ihn offen.

**js/i18n.js** – `t(key, vars), registerStrings({de,pt,es}), getLang(), setLang(), locale(), fmtDateTime(iso) («06.11.2026, 07:30»),
fmtDate, fmtTime, fmtElapsed(fromIso, toIso?) («2 T 3 Std»), fmtNum, fmtQty(n, unit), unitLabel(unit)`.
Gemeinsame Schlüssel (nicht neu definieren): `nav.*`, `btn.*`, `common.*`, `status.*`, `cond.*`, `role.*`, `loc.*`, `mv.*`, `unit.*`, `err.*`, `time.*`.

**js/media.js** – `mediaSection(container, { ctx, entity, entityId, kinds = ['photo','document'], allowUpload = true })`:
Fotogalerie (Hauptfoto, Lightbox, Schadenfotos mit Bemerkung), Dokumente (PDF), Hochladen per Kamera/Datei,
Hauptfoto wählen und Löschen für Lagerverantwortliche. `uploadDamagePhoto(ctx, entity, entityId, { note, loanId })`
öffnet die Kamera/Dateiauswahl und lädt ein Schadenfoto hoch (gibt die Anlage oder null zurück).

**js/labels.js** – `labelItem('machine'|'article'|'location', row)` → Etikett-Objekt; `openLabelDialog(items)` →
Dialog mit Vorschau, Format (Brother-Rollen), Kopien, Drucken (PDF über den Druckdialog) und PNG;
`qrSvg(text, { size, margin })` → SVG-String eines QR-Codes (für die Anzeige in Karten); `qrUrl(code)` → PUBLIC_BASE_URL + '?c=' + code.
`printLabels(items, settings)`, `LABEL_FORMATS`, `getLabelSettings()`, `setLabelSettings(patch)`, `ensureQrLib()`.

**js/scanner.js** – `openScanner({ title, hint, continuous = false, onCode: async (code, rawText) => {} })` → `{ close() }`.
Vollbild-Kamera (BarcodeDetector oder jsQR), manuelle Code-Eingabe als Ersatz. `continuous: true` = bleibt offen (Inventur).

**js/app.js** – Router/Shell. Ruft die Routen aus `js/views/*.js` auf (`dashboard.js, machines.js, articles.js,
locations.js, inventory.js, employees.js, audit.js, labels-page.js, profile.js`). Route `scan` gehört app.js.

## CSS-Klassen (css/app.css)

Layout: `.page`, `.page-head` (h1 + `.actions`), `.section` (mit `h2`), `.card`, `.grid-2`, `.stack` (vertikaler Abstand), `.row` (horizontal, wrap).
Listen: `.list` > `a.list-item` / `.list-item` mit `.thumb`, `.li-main` (`.li-title`, `.li-sub`), `.li-end`.
Schlüssel-Werte: `dl.kv` mit `dt`/`dd` (Label links, Wert rechts, gross & klar).
Tabellen: `.table-wrap > table.table` (auf dem Handy horizontal scrollbar).
Status: `statusPill(status)` → `<span class="pill pill-verfuegbar">Verfügbar</span>`; weitere `.pill-warn`, `.pill-danger`, `.pill-muted`, `.pill-ok`.
Knöpfe: `.btn`, `.btn.primary` (schwarz, Hauptaktion), `.btn.danger`, `.btn.ghost`, `.btn.block` (volle Breite, gross – für «Maschine ausleihen»), `.btn.sm`.
Formulare: `.form` (Raster), `.field` (label + input/select/textarea), `.field.full`, `.hint`, `.chips` > `button.chip[aria-pressed]`.
Kacheln: `.stats` > `a.stat` (`.stat-num`, `.stat-label`, Modifikatoren `.warn`, `.danger`, `.ok`).
Sonstiges: `.tabs` > `button.tab[aria-selected]`, `.empty`, `.muted`, `.small`, `.alert` (`.alert.warn`, `.alert.danger`, `.alert.ok`),
`.gallery` (Fotos, `img` klickbar → Lightbox via `openLightbox(url)` aus util.js), `.searchbar`, `.filters`.
