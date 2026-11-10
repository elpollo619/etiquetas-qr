# Ordem – Lagerverwaltung mit QR-Etiketten

_Ordem e Progresso._

Interne Web-App für Lager, Material, Maschinen und Werkzeuge: QR-Etikett auf die Maschine kleben, mit dem Handy
scannen, **«Maschine ausleihen»** bzw. **«Maschine zurückgeben»** – jederzeit sichtbar, wer was hat.

- App: https://elpollo619.github.io/etiquetas-qr/ · Demo ohne echte Daten: `?demo=1`
- **Lager organisieren**: Räume mit Fotos und markierten Bereichen, Fotoimport (Ordner/ZIP/Handy), KI-Erkennung prüfen,
  Kategorien, Organisationsplan, globale Suche, Inventur je Raum mit Export (Excel/CSV/PDF) – Konzept: [docs/ORGANIZACION.md](docs/ORGANIZACION.md)
- Sprachen: Deutsch (de-CH), Português, Español
- Technik: statische Seite (GitHub Pages, ohne Build) + Supabase (Postgres mit RLS, Auth, Storage)
- Einrichtung / instalación: [docs/INSTALACION.md](docs/INSTALACION.md) · Aufbau: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Datenbank: [supabase/schema.sql](supabase/schema.sql) · Tests: `tests/`

Fremdbibliotheken in `js/vendor/`: qrcode-generator (MIT), jsQR (Apache-2.0), supabase-js (MIT, mit esbuild gebündelt).
