// Farbschema (Hell / Dunkel / System). Wird beim Start von app.js importiert und sofort angewendet.
// Wirkung: <html data-theme="light"|"dark"> erzwingt das Schema (css/app.css, Abschnitt «Dunkel-Modus»);
// ohne Attribut folgt die App der Systemeinstellung (prefers-color-scheme). Gespeichert pro Gerät/Browser.
const KEY = 'lgr-theme';
export const THEMES = ['system', 'light', 'dark'];
export function getTheme() {
  try { const v = localStorage.getItem(KEY); return THEMES.includes(v) ? v : 'system'; } catch (e) { return 'system'; }
}
export function applyTheme(theme = getTheme()) {
  const root = document.documentElement;
  if (theme === 'light' || theme === 'dark') root.setAttribute('data-theme', theme);
  else root.removeAttribute('data-theme');
}
export function setTheme(theme) {
  const v = THEMES.includes(theme) ? theme : 'system';
  try { if (v === 'system') localStorage.removeItem(KEY); else localStorage.setItem(KEY, v); } catch (e) { /* egal */ }
  applyTheme(v);
}
applyTheme();
// Änderung in einem anderen Tab desselben Browsers sofort übernehmen
try {
  window.addEventListener('storage', (e) => { if (e.key === KEY || e.key === null) applyTheme(); });
} catch (e) { /* egal */ }
