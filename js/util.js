// Gemeinsame Hilfsfunktionen für alle Ansichten
import { t, has } from './i18n.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
export const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function debounce(fn, ms = 250) {
  let tm = 0;
  return (...a) => { clearTimeout(tm); tm = setTimeout(() => fn(...a), ms); };
}

// ---------- Rechte ----------
export function can(user, perm = 'active') {
  if (!user || !user.active) return false;
  if (perm === 'admin') return user.role === 'admin';
  if (perm === 'staff') return user.role === 'admin' || user.role === 'lagerverantwortlicher';
  return true;
}

// ---------- Codes / QR ----------
export function routeForCode(code) {
  const c = clean(code).toUpperCase();
  if (!c) return '';
  if (c.startsWith('M-')) return 'm/' + encodeURIComponent(c);
  if (c.startsWith('L-')) return 'l/' + encodeURIComponent(c);
  return 'a/' + encodeURIComponent(c);
}
// Liest einen gescannten Text: unsere URL (?c=… oder alt ?id=…) oder ein reiner Code
export function parseScanned(text) {
  const s = clean(text);
  if (!s) return null;
  try {
    const u = new URL(s);
    const c = u.searchParams.get('c') || u.searchParams.get('id');
    if (c) return clean(c).toUpperCase();
    const m = /#\/(?:m|a|l)\/([A-Z0-9-]+)/i.exec(u.hash);
    if (m) return decodeURIComponent(m[1]).toUpperCase();
  } catch (e) { /* kein URL */ }
  if (/^[A-Z]{1,5}-\d{1,8}$/i.test(s)) return s.toUpperCase();
  const legacy = /\bID:\s*([A-Z]{1,5}-\d{1,8})\b/i.exec(s);   // alte Text-QR-Etiketten
  if (legacy) return legacy[1].toUpperCase();
  return null;
}

// ---------- Anzeige-Bausteine ----------
export function statusPill(status) {
  return `<span class="pill pill-${esc(status)}">${esc(t('status.' + status))}</span>`;
}
export function conditionLabel(c) { return c ? t('cond.' + c) : '–'; }
export function roleLabel(r) { return r ? t('role.' + r) : '–'; }
export function locTypeLabel(ty) { return ty ? t('loc.' + ty) : '–'; }
export function emptyHtml(text, actionHtml = '') {
  return `<div class="empty">${icon('box')}<p>${esc(text || t('common.none'))}</p>${actionHtml}</div>`;
}
export function errorText(err) {
  const code = (err && err.code) || 'unknown';
  if (has('err.' + code)) {
    const st = err && err.detail ? (has('status.' + err.detail) ? t('status.' + err.detail) : err.detail) : '';
    return t('err.' + code, { status: st }).replace(' ()', '');
  }
  if (/^invalid_/.test(code)) return t('err.invalid');
  return t('err.unknown');
}

// ---------- Toast ----------
export function toast(msg, kind = 'ok') {
  let box = document.getElementById('toasts');
  if (!box) { box = document.createElement('div'); box.id = 'toasts'; document.body.appendChild(box); }
  const el = document.createElement('div');
  el.className = 'toast toast-' + kind;
  el.setAttribute('role', kind === 'error' ? 'alert' : 'status');
  el.innerHTML = `${icon(kind === 'error' ? 'alert' : 'check')}<span>${esc(msg)}</span>`;
  box.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, kind === 'error' ? 6000 : 3200);
}

// ---------- Dialog (unten auf dem Handy, mittig auf dem PC) ----------
// actions: [{ label, kind: 'primary'|'danger'|'ghost', onClick: async (el, close) => false|any }]
// Gibt ein Promise zurück, das beim Schliessen mit dem Wert aus close(value) erfüllt wird.
export function sheet({ title, body = '', actions = [], onOpen, wide = false } = {}) {
  return new Promise((resolve) => {
    const prevFocus = document.activeElement;
    const bd = document.createElement('div');
    bd.className = 'sheet-backdrop';
    bd.innerHTML = `<div class="sheet${wide ? ' wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="sheet-t">
      <div class="sheet-head"><h2 id="sheet-t">${esc(title || '')}</h2>
        <button type="button" class="icon-btn" data-close aria-label="${esc(t('btn.close'))}">${icon('x')}</button></div>
      <div class="sheet-body">${body}</div>
      <div class="sheet-error alert danger" hidden></div>
      ${actions.length ? `<div class="sheet-actions">${actions.map((a, i) =>
        `<button type="button" class="btn ${a.kind || ''} ${a.block ? 'block' : ''}" data-i="${i}">${a.icon ? icon(a.icon) : ''}${esc(a.label)}</button>`).join('')}</div>` : ''}
    </div>`;
    document.body.appendChild(bd);
    document.body.classList.add('no-scroll');
    const el = bd.querySelector('.sheet');
    let done = false;
    const close = (val) => {
      if (done) return; done = true;
      bd.classList.remove('show');
      document.removeEventListener('keydown', onKey);
      setTimeout(() => { bd.remove(); if (!document.querySelector('.sheet-backdrop')) document.body.classList.remove('no-scroll'); }, 180);
      if (prevFocus && prevFocus.focus) try { prevFocus.focus(); } catch (e) { /* egal */ }
      resolve(val);
    };
    const onKey = (e) => { if (e.key === 'Escape') close(undefined); };
    document.addEventListener('keydown', onKey);
    bd.addEventListener('click', (e) => { if (e.target === bd) close(undefined); });
    el.querySelector('[data-close]').addEventListener('click', () => close(undefined));
    const errBox = el.querySelector('.sheet-error');
    el.querySelectorAll('.sheet-actions button').forEach((btn) => btn.addEventListener('click', async () => {
      const a = actions[+btn.dataset.i];
      if (!a.onClick) { close(a.value); return; }
      const all = el.querySelectorAll('.sheet-actions button');
      all.forEach((b) => { b.disabled = true; });
      errBox.hidden = true;
      try {
        const r = await a.onClick(el, close);
        if (r !== false && !done) close(r === undefined ? a.value ?? true : r);
      } catch (err) {
        errBox.textContent = errorText(err);
        errBox.hidden = false;
      } finally {
        all.forEach((b) => { b.disabled = false; });
      }
    }));
    requestAnimationFrame(() => {
      bd.classList.add('show');
      const f = el.querySelector('[autofocus], .sheet-body input:not([type=hidden]), .sheet-body select, .sheet-body textarea')
        || el.querySelector('.sheet-actions .primary') || el.querySelector('[data-close]');
      if (f) try { f.focus({ preventScroll: true }); } catch (e) { /* egal */ }
    });
    if (onOpen) onOpen(el, close);
  });
}
export function confirmSheet(title, message, { okLabel, danger = false } = {}) {
  return sheet({
    title,
    body: `<p>${esc(message)}</p>`,
    actions: [
      { label: t('btn.cancel'), kind: 'ghost', value: false },
      { label: okLabel || t('btn.confirm'), kind: danger ? 'danger' : 'primary', value: true },
    ],
  }).then((v) => v === true);
}
export function openLightbox(url, alt = '') {
  const bd = document.createElement('div');
  bd.className = 'lightbox';
  bd.innerHTML = `<button type="button" class="icon-btn" aria-label="${esc(t('btn.close'))}">${icon('x')}</button><img src="${esc(url)}" alt="${esc(alt)}">`;
  const close = () => { bd.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  bd.addEventListener('click', close);
  document.addEventListener('keydown', onKey);
  document.body.appendChild(bd);
}

// ---------- Fotos (signierte URLs werden gesammelt nachgeladen) ----------
export function thumbHtml(path, alt = '', cls = 'thumb', iconName = 'box') {
  if (!path) return `<div class="${cls} thumb-empty" aria-hidden="true">${icon(iconName)}</div>`;
  return `<img class="${cls}" data-path="${esc(path)}" alt="${esc(alt)}" loading="lazy">`;
}
export async function hydrateThumbs(root, api) {
  const imgs = [...root.querySelectorAll('img[data-path]:not([src])')];
  if (!imgs.length) return;
  try {
    const map = await api.fileUrls([...new Set(imgs.map((i) => i.dataset.path))]);
    imgs.forEach((i) => { const u = map.get(i.dataset.path); if (u) i.src = u; });
  } catch (e) { /* Fotos sind nicht kritisch */ }
}

// ---------- Excel-Export (CSV mit BOM und Semikolon für Excel CH/DE) ----------
export function downloadCsv(filename, rows) {
  const cell = (v) => {
    let s = v === null || v === undefined ? '' : String(v);
    // Schutz vor Formel-Injektion in Excel (=, +, -, @ am Anfang), Zahlen bleiben Zahlen
    if (typeof v !== 'number' && /^[=+\-@\t\r]/.test(s) && !/^-?\d+([.,]\d+)?$/.test(s)) s = "'" + s;
    return /[";\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const csv = '﻿' + rows.map((r) => r.map(cell).join(';')).join('\r\n');
  downloadBlob(filename, new Blob([csv], { type: 'text/csv;charset=utf-8' }));
}
export function downloadBlob(filename, blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}
export const today = () => new Date().toISOString().slice(0, 10);

// ---------- Formular-Hilfen ----------
export function formData(form) {
  const o = {};
  for (const el of form.elements) {
    if (!el.name || el.disabled) continue;
    if (el.type === 'checkbox') o[el.name] = el.checked;
    else if (el.type === 'radio') { if (el.checked) o[el.name] = el.value; }
    else o[el.name] = el.value;
  }
  return o;
}
export function nullIfEmpty(v) { const s = clean(v); return s === '' ? null : s; }
export function numOrNull(v) {
  const s = String(v ?? '').replace(',', '.').trim();
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
// <input type="datetime-local"> ↔ ISO
export function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
export function fromLocalInput(v) { return v ? new Date(v).toISOString() : null; }

// ---------- Icons (inline SVG, currentColor) ----------
const ICONS = {
  home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
  scan: '<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><path d="M7 12h10"/>',
  machine: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/>',
  box: '<path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/>',
  location: '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  clipboard: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1"/><path d="M9 11l2 2 4-4M9 17h6"/>',
  handoff: '<path d="M7 12h10M13 8l4 4-4 4"/><circle cx="5" cy="12" r="2"/>',
  label: '<path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9-9-9z"/><circle cx="8" cy="8" r="1.5"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
  more: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  cart: '<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2.5 3.5h2.8l2.4 11.6a1 1 0 0 0 1 .8h9.4a1 1 0 0 0 1-.8L21 7.5H6.1"/>',
  minus: '<path d="M5 12h14"/>',
  back: '<path d="M15 18l-6-6 6-6"/>',
  chevron: '<path d="M9 18l6-6-6-6"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  check: '<path d="M5 12l5 5L20 7"/>',
  alert: '<path d="M12 3l9.5 17h-19z"/><path d="M12 10v4M12 17.5v.5"/>',
  camera: '<path d="M4 7h3l2-3h6l2 3h3v13H4z"/><circle cx="12" cy="13" r="4"/>',
  file: '<path d="M14 3H6v18h12V7z"/><path d="M14 3v4h4"/>',
  print: '<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="1"/><path d="M7 14h10v7H7z"/>',
  edit: '<path d="M4 20h4L20 8l-4-4L4 16z"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14"/>',
  logout: '<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  arrowIn: '<path d="M12 4v12M7 11l5 5 5-5M5 20h14"/>',
  arrowOut: '<path d="M12 16V4M7 9l5-5 5 5M5 20h14"/>',
  move: '<path d="M5 12h14M15 8l4 4-4 4M9 16l-4-4 4-4"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  wrench: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
  grid: '<rect x="3" y="3" width="7.5" height="7.5" rx="1"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1"/>',
  sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
  tag: '<path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9-9-9z"/><circle cx="8" cy="8" r="1.5"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  tree: '<path d="M6 3v18M6 8h6M6 15h6"/><rect x="12" y="5" width="8" height="6" rx="1"/><rect x="12" y="12" width="8" height="6" rx="1"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5M5 20h14"/>',
  folder: '<path d="M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/>',
  pin: '<path d="M12 21s-6-5.6-6-10a6 6 0 0 1 12 0c0 4.4-6 10-6 10z"/><circle cx="12" cy="11" r="2"/>',
};
export function icon(name, cls = 'ic') {
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.box}</svg>`;
}
