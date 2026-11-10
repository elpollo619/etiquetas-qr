// Etiketten mit QR-Code für die Brother QL-800 (300 dpi). Der QR enthält nur den dauerhaften Link mit dem Code.
import { t, registerStrings, fmtQty } from './i18n.js';
import { esc, sheet, toast, errorText, downloadBlob } from './util.js';
import { PUBLIC_BASE_URL } from './config.js';

registerStrings({
  de: {
    'labels.title': 'Etiketten drucken', 'labels.count': '{n} Etikett(en)', 'labels.format': 'Rolle in der Brother QL-800',
    'labels.length': 'Länge (mm)', 'labels.copies': 'Kopien pro Etikett', 'labels.flip': 'Um 90° drehen (falls schief/abgeschnitten)',
    'labels.print': 'Drucken / PDF', 'labels.png': 'PNG', 'labels.loc': 'Standort', 'labels.use': 'Verwendung',
    'labels.scan': 'Scannen für Details', 'labels.scanMachine': 'Scannen: ausleihen / zurückgeben',
    'labels.machine': 'Maschine', 'labels.nr': 'Nr. {code}', 'labels.inv': 'Inv.', 'labels.artNo': 'Art.-Nr.', 'labels.min': 'Min. Bestand {qty}',
    'labels.qrOk': 'QR gut lesbar ({mm} mm pro Punkt).', 'labels.qrSmall': 'QR sehr klein – grössere Etikette wählen.',
    'labels.shortQr': 'Schmales Band: Der QR enthält nur den Code. Mit «Scannen» in der App lesen (nicht mit der Handy-Kamera).',
    'labels.printHint': 'Im Druckdialog: Drucker «Brother QL-800», Ränder «Keine», Skalierung 100 %. Für PDF «Als PDF speichern» wählen.',
    'labels.fmt.quer': 'quer', 'labels.fmt.hoch': 'hoch', 'labels.fmt.endlos': 'Endlos, Länge wählbar', 'labels.fmt.small': 'klein', 'labels.fmt.strip': 'Regalstreifen',
    'labels.noQr': 'QR-Generator nicht geladen.',
  },
  pt: {
    'labels.title': 'Imprimir etiquetas', 'labels.count': '{n} etiqueta(s)', 'labels.format': 'Rolo na Brother QL-800',
    'labels.length': 'Comprimento (mm)', 'labels.copies': 'Cópias por etiqueta', 'labels.flip': 'Rodar 90° (se sair torta/cortada)',
    'labels.print': 'Imprimir / PDF', 'labels.png': 'PNG', 'labels.loc': 'Localização', 'labels.use': 'Utilização',
    'labels.scan': 'Ler para ver detalhes', 'labels.scanMachine': 'Ler: levantar / devolver',
    'labels.machine': 'Máquina', 'labels.nr': 'N.º {code}', 'labels.inv': 'Inv.', 'labels.artNo': 'Ref.', 'labels.min': 'Stock mín. {qty}',
    'labels.qrOk': 'QR bem legível ({mm} mm por ponto).', 'labels.qrSmall': 'QR muito pequeno – escolhe uma etiqueta maior.',
    'labels.shortQr': 'Fita estreita: o QR só tem o código. Lê com «Digitalizar» na app (não com a câmara do telemóvel).',
    'labels.printHint': 'Na janela de impressão: impressora «Brother QL-800», margens «Nenhuma», escala 100 %. Para PDF escolhe «Guardar como PDF».',
    'labels.fmt.quer': 'horizontal', 'labels.fmt.hoch': 'vertical', 'labels.fmt.endlos': 'contínuo, comprimento à escolha', 'labels.fmt.small': 'pequena', 'labels.fmt.strip': 'tira de prateleira',
    'labels.noQr': 'Gerador de QR não carregado.',
  },
  es: {
    'labels.title': 'Imprimir etiquetas', 'labels.count': '{n} etiqueta(s)', 'labels.format': 'Rollo en la Brother QL-800',
    'labels.length': 'Largo (mm)', 'labels.copies': 'Copias de cada una', 'labels.flip': 'Girar 90° (si sale torcida o cortada)',
    'labels.print': 'Imprimir / PDF', 'labels.png': 'PNG', 'labels.loc': 'Ubicación', 'labels.use': 'Uso',
    'labels.scan': 'Escanea para ver la ficha', 'labels.scanMachine': 'Escanear: retirar / devolver',
    'labels.machine': 'Máquina', 'labels.nr': 'N.º {code}', 'labels.inv': 'Inv.', 'labels.artNo': 'N.º art.', 'labels.min': 'Stock mín. {qty}',
    'labels.qrOk': 'QR bien legible ({mm} mm por punto).', 'labels.qrSmall': 'QR muy pequeño: elige una etiqueta más grande.',
    'labels.shortQr': 'Cinta estrecha: el QR solo lleva el código. Léelo con «Escanear» en la app (no con la cámara del móvil).',
    'labels.printHint': 'En la ventana de impresión: impresora «Brother QL-800», márgenes «Ninguno», escala 100 %. Para PDF elige «Guardar como PDF».',
    'labels.fmt.quer': 'horizontal', 'labels.fmt.hoch': 'vertical', 'labels.fmt.endlos': 'continuo, largo a medida', 'labels.fmt.small': 'pequeña', 'labels.fmt.strip': 'tira para estantes',
    'labels.noQr': 'Generador de QR no cargado.',
  },
});

const DOT = 25.4 / 300;
const MFONT = '"Segoe UI", "Helvetica Neue", Arial, sans-serif';
const SFONT = "'Segoe UI', 'Helvetica Neue', Arial, sans-serif";
const PIN = 'M5 0C2.79 0 1 1.79 1 4c0 3.1 4 6 4 6s4-2.9 4-6c0-2.21-1.79-4-4-4zm0 5.7A1.7 1.7 0 1 1 5 2.3a1.7 1.7 0 0 1 0 3.4z';
const SETTINGS_KEY = 'lgr-labels';

// tape = Rollenbreite, len = Etikettenlänge; rotate = Inhalt liegt quer auf der Rolle
// shortQr = QR enthält nur den Code (schmales Band; die App liest ihn mit «Scannen»)
export const LABEL_FORMATS = {
  dk11201:  { size: '90 × 29 mm', dk: 'DK-11201', note: 'strip', tape: 29, len: 90, rotate: true },
  dk11202h: { size: '100 × 62 mm', dk: 'DK-11202', note: 'quer', tape: 62, len: 100, rotate: true },
  dk11202v: { size: '62 × 100 mm', dk: 'DK-11202', note: 'hoch', tape: 62, len: 100, rotate: false },
  cont29:   { size: '29 mm', dk: 'DK-22210', note: 'endlos', tape: 29, len: null, rotate: true },
  cont12:   { size: '12 mm', dk: 'DK-22214', note: 'endlos', tape: 12, len: null, rotate: true, shortQr: true },
  cont62:   { size: '62 mm', dk: 'DK-22205 / DK-22251', note: 'endlos', tape: 62, len: null, rotate: true },
  dk11209:  { size: '62 × 29 mm', dk: 'DK-11209', note: 'small', tape: 62, len: 29, rotate: false },
  dk11208:  { size: '90 × 38 mm', dk: 'DK-11208', note: '', tape: 38, len: 90, rotate: true },
};
const DEFAULTS = { format: 'dk11201', contLen: 80, copies: 1, flip: false };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const r3 = (n) => Math.round(n * 1000) / 1000;

export function formatName(key) {
  const f = LABEL_FORMATS[key];
  if (!f) return key;
  return `${f.size} · ${f.dk}${f.note ? ' (' + t('labels.fmt.' + f.note) + ')' : ''}`;
}
export function getLabelSettings() {
  let s = {};
  try { s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') || {}; } catch (e) { s = {}; }
  const out = { ...DEFAULTS, ...s };
  if (!LABEL_FORMATS[out.format]) out.format = DEFAULTS.format;
  return out;
}
export function setLabelSettings(patch) {
  const s = { ...getLabelSettings(), ...patch };
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch (e) { /* egal */ }
  return s;
}
export function qrUrl(code) { return PUBLIC_BASE_URL + '?c=' + encodeURIComponent(code); }

// ---------------------------------------------------------------------------
// QR-Generator (js/vendor/qrcode.js, synchron in index.html geladen)
// ---------------------------------------------------------------------------
function ensureUtf8() {
  if (window.qrcode && !window.qrcode.__lgrUtf8) {
    window.qrcode.stringToBytes = (s) => Array.from(new TextEncoder().encode(s));
    window.qrcode.__lgrUtf8 = true;
  }
}
export function ensureQrLib() {
  if (window.qrcode) { ensureUtf8(); return Promise.resolve(true); }
  return new Promise((resolve) => {
    const s = document.createElement('script');
    s.src = new URL('./vendor/qrcode.js', import.meta.url).href;
    s.onload = () => { ensureUtf8(); resolve(!!window.qrcode); };
    s.onerror = () => resolve(false);
    document.head.appendChild(s);
  });
}
const qrCache = new Map();
function makeQR(text) {
  if (!window.qrcode) return null;
  ensureUtf8();
  if (qrCache.has(text)) return qrCache.get(text);
  const q = window.qrcode(0, 'M');
  q.addData(text, 'Byte');
  q.make();
  const n = q.getModuleCount();
  const grid = new Uint8Array(n * n);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) grid[r * n + c] = q.isDark(r, c) ? 1 : 0;
  const res = { n, grid };
  if (qrCache.size > 300) qrCache.clear();
  qrCache.set(text, res);
  return res;
}
function qrRuns(e, cb) {
  const n = e.n, g = e.grid;
  for (let r = 0; r < n; r++) {
    let c = 0;
    while (c < n) {
      if (!g[r * n + c]) { c++; continue; }
      const s = c;
      while (c < n && g[r * n + c]) c++;
      cb(r, s, c - s);
    }
  }
}
// QR als SVG für die Anzeige in Karten
export function qrSvg(text, { size = 120, margin = 2 } = {}) {
  const qr = makeQR(text);
  if (!qr) return '';
  const total = qr.n + margin * 2;
  let d = '';
  qrRuns({ n: qr.n, grid: qr.grid }, (r, c0, len) => { d += `M${c0 + margin} ${r + margin}h${len}v1h${-len}z`; });
  return `<svg class="qr" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${size}" height="${size}" role="img" aria-label="QR"><rect width="${total}" height="${total}" fill="#fff"/><path d="${d}" fill="#000" shape-rendering="crispEdges"/></svg>`;
}

// ---------------------------------------------------------------------------
// Etikett-Inhalt
// ---------------------------------------------------------------------------
export function labelItem(kind, row) {
  if (!row) return null;
  if (kind === 'machine') {
    const bm = [clean(row.brand), clean(row.model)].filter(Boolean).join(' ');
    return {
      kind, code: row.code, qrText: qrUrl(row.code),
      cat: clean(row.category) || t('labels.machine'),
      title: clean(row.name), big: t('labels.nr', { code: row.code }),
      loc: clean(row.location_path), use: '',
      foot: [bm, row.inventory_no ? `${t('labels.inv')} ${clean(row.inventory_no)}` : ''].filter(Boolean).join(' · '),
    };
  }
  if (kind === 'location') {
    const parts = String(row.path || row.name || '').split(' / ');
    return {
      kind, code: row.code, qrText: qrUrl(row.code),
      cat: t('loc.' + row.type), title: clean(row.name), big: clean(row.code_path) || row.code,
      loc: parts.length > 1 ? parts.slice(0, -1).join(' / ') : '', use: '', foot: clean(row.code_path) ? row.code : '',
    };
  }
  return {
    kind: 'article', code: row.code, qrText: qrUrl(row.code),
    cat: clean(row.category), title: clean(row.label_text) || clean(row.name), big: clean(row.size),
    loc: clean(row.location_path), use: clean(row.usage),
    foot: [row.min_stock !== null && row.min_stock !== undefined && row.min_stock !== '' ? t('labels.min', { qty: fmtQty(row.min_stock, row.unit || 'Stk') }) : '',
      row.art_no ? `${t('labels.artNo')} ${clean(row.art_no)}` : '', row.code].filter(Boolean).join(' · '),
  };
}

// ---------------------------------------------------------------------------
// Text messen und umbrechen
// ---------------------------------------------------------------------------
const mctx = document.createElement('canvas').getContext('2d');
const wcache = new Map();
function textW(str, size, weight = 400, ls = 0) {
  const key = weight + '\u0000' + str;
  let w = wcache.get(key);
  if (w === undefined) {
    mctx.font = `${weight} 100px ${MFONT}`;
    w = mctx.measureText(str).width / 100;
    if (wcache.size > 5000) wcache.clear();
    wcache.set(key, w);
  }
  return w * size + ls * [...str].length;
}
function ellipsize(line, size, weight, maxW, ls = 0) {
  let s = line;
  while (s.length > 1 && textW(s + '…', size, weight, ls) > maxW) s = s.slice(0, -1);
  return s.replace(/[\s,;:·\-–]+$/, '') + '…';
}
function breakLines(text, size, weight, maxW, indent = 0) {
  const words = clean(text).split(' ').filter(Boolean);
  const lines = [];
  let cur = '';
  const avail = () => maxW - (lines.length ? 0 : indent);
  for (const w of words) {
    const tt = cur ? cur + ' ' + w : w;
    if (textW(tt, size, weight) <= avail()) { cur = tt; continue; }
    if (cur) { lines.push(cur); cur = ''; }
    if (textW(w, size, weight) <= avail()) { cur = w; continue; }
    let part = '';
    for (const ch of w) {
      if (!part || textW(part + ch, size, weight) <= avail()) part += ch;
      else { lines.push(part); part = ch; }
    }
    cur = part;
  }
  if (cur) lines.push(cur);
  return lines;
}
function wrapBlock(b, s, maxW) {
  if (b.bar) {
    let size = s;
    const fits = (z) => textW(b.text, z, 700, z * 0.08) <= maxW - z * 1.1;
    while (!fits(size) && size > b.min) size = Math.max(b.min, size * 0.94);
    const line = fits(size) ? b.text : ellipsize(b.text, size, 700, maxW - size * 1.1, size * 0.08);
    return { lines: [line], size, height: size * 1.75 };
  }
  const run = (z) => {
    let indent = b.icon ? z * 1.0 : b.label ? textW(b.label + ' ', z, 700) : 0;
    const own = !!b.label && indent > maxW * 0.5;
    if (own) indent = 0;
    return { z, indent, own, lines: breakLines(b.text, z, b.w, maxW, indent) };
  };
  const floor = Math.max(b.min, s * (b.floor || 0.7));
  let r = run(s);
  while (r.lines.length > b.maxLines && r.z > floor + 1e-6) r = run(Math.max(floor, r.z * 0.94));
  if (r.lines.length > 1) {
    for (const f of [0.92, 0.86]) {
      const tt = run(Math.max(floor, r.z * f));
      if (tt.lines.length < r.lines.length) { r = tt; break; }
    }
  }
  let lines = r.lines;
  if (lines.length > b.maxLines) {
    lines = lines.slice(0, b.maxLines);
    const last = b.maxLines - 1;
    lines[last] = ellipsize(lines[last], r.z, b.w, maxW - (last === 0 ? r.indent : 0));
  }
  const lh = r.z * 1.17;
  return { lines, size: r.z, lh, indent: r.indent, own: r.own, height: (lines.length + (r.own ? 1 : 0)) * lh };
}
function stackH(res, gap) { return res.reduce((h, r) => h + r.height, 0) + gap * Math.max(0, res.length - 1); }
function fitBlocks(blocks, maxW, maxH, gap) {
  let list = blocks.slice(), best = null;
  for (let attempt = 0; attempt < 6; attempt++) {
    let k = 1;
    for (let i = 0; i < 18; i++) {
      const res = list.map((b) => Object.assign({}, b, wrapBlock(b, Math.max(b.min, b.s * k), maxW)));
      const g = gap * Math.max(k, 0.6);
      const h = stackH(res, g);
      best = { res, h, gap: g };
      if (h <= maxH + 1e-6) return best;
      if (res.every((r) => r.size <= r.min + 1e-6)) break;
      k *= 0.93;
    }
    const cand = list.filter((b) => b.drop).sort((a, b) => a.drop - b.drop)[0];
    if (!cand) break;
    list = list.filter((b) => b !== cand);
  }
  return best;
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------
function designDims(s) {
  const f = LABEL_FORMATS[s.format] || LABEL_FORMATS.dk11209;
  const len = f.len || clamp(parseFloat(s.contLen) || 80, 40, 200);
  return f.rotate ? { f, W: len, H: f.tape, rot: true } : { f, W: f.tape, H: len, rot: false };
}
function pageGeom(s) {
  const d = designDims(s);
  const rot = d.rot !== !!s.flip;
  return rot ? { pw: d.H, ph: d.W, rot: true } : { pw: d.W, ph: d.H, rot: false };
}
function buildBlocks(item, base, big) {
  const out = [];
  if (big && item.cat) out.push({ k: 'cat', bar: true, text: item.cat.toLocaleUpperCase(), s: base * 0.5, min: 1.9, maxLines: 1, drop: 1 });
  out.push({ k: 'title', text: item.title || '—', w: 700, s: base, min: 2.4, maxLines: big ? 3 : 2 });
  if (item.big) out.push({ k: 'size', text: item.big, w: 700, s: base * 1.2, min: 2.8, maxLines: 1 });
  if (item.loc) out.push(big
    ? { k: 'loc', label: t('labels.loc') + ':', text: item.loc, w: 400, s: base * 0.6, min: 2, maxLines: 3, drop: 4 }
    : { k: 'loc', icon: 'pin', text: item.loc, w: 400, s: base * 0.6, min: 2, maxLines: 2, drop: 4 });
  if (big && item.use) out.push({ k: 'use', label: t('labels.use') + ':', text: item.use, w: 400, s: base * 0.55, min: 2, maxLines: 3, floor: 0.85, drop: 2 });
  if (item.foot) out.push({ k: 'foot', text: item.foot, w: 400, s: base * 0.48, min: 1.8, maxLines: 1, drop: 3 });
  return out;
}
function placeQr(qr, x, y, box, out) {
  if (!qr) {
    out.push({ t: 'rect', x: x + box * 0.08, y: y + box * 0.08, w: box * 0.84, h: box * 0.84, r: 1, fill: 'none', stroke: '#000', sw: 0.35 });
    out.push({ t: 'text', x: x + box / 2, y: y + box / 2 + box * 0.06, size: box * 0.16, anchor: 'middle', spans: [{ s: 'QR', w: 700 }] });
    return null;
  }
  const quiet = 2, total = qr.n + quiet * 2;
  const dots = Math.floor(box / DOT / total);
  const mod = dots >= 1 ? dots * DOT : box / total;
  const side = mod * total;
  const snap = (v) => Math.round(v / DOT) * DOT;
  const ox = snap(x + (box - side) / 2 + quiet * mod);
  const oy = snap(y + (box - side) / 2 + quiet * mod);
  out.push({ t: 'qr', ox, oy, mod, n: qr.n, grid: qr.grid });
  return { version: (qr.n - 17) / 4, n: qr.n, mod, dots };
}
function placeBlocks(res, x, y, w, gap, out) {
  let cy = y;
  res.forEach((b, i) => {
    if (b.bar) {
      out.push({ t: 'rect', x, y: cy, w, h: b.height, r: b.size * 0.3, fill: '#000' });
      out.push({ t: 'text', x: x + b.size * 0.55, y: cy + b.height / 2 + b.size * 0.36, size: b.size, ls: b.size * 0.08, fill: '#fff', spans: [{ s: b.lines[0], w: 700 }] });
    } else {
      let row = 0;
      if (b.own) { out.push({ t: 'text', x, y: cy + b.size * 0.88, size: b.size, spans: [{ s: b.label, w: 700 }] }); row = 1; }
      b.lines.forEach((ln, li) => {
        const by = cy + b.size * 0.88 + (row + li) * b.lh;
        if (li === 0 && !b.own && b.icon) {
          out.push({ t: 'icon', x, y: by - b.size * 0.8, s: b.size * 0.085 });
          out.push({ t: 'text', x: x + b.indent, y: by, size: b.size, spans: [{ s: ln, w: b.w }] });
        } else if (li === 0 && !b.own && b.label) {
          out.push({ t: 'text', x, y: by, size: b.size, spans: [{ s: b.label + ' ', w: 700 }, { s: ln, w: b.w }] });
        } else {
          out.push({ t: 'text', x, y: by, size: b.size, spans: [{ s: ln, w: b.w }] });
        }
      });
    }
    cy += b.height + (i < res.length - 1 ? gap : 0);
  });
}
function scanText(item) { return item.kind === 'machine' ? t('labels.scanMachine') : t('labels.scan'); }
function layoutH(item, W, H, qr, out) {
  const compact = H < 38;
  const m = H < 16 ? 1 : compact ? 2 : 3;
  const colGap = compact ? 1.5 : 3;
  const capS = clamp(H * 0.045, 2.1, 2.9);
  const showCap = !compact && H >= 50 && !!qr;
  const capH = showCap ? capS * 1.8 : 0;
  const qrBox = Math.min(H - 2 * m - capH, W * (compact ? 0.46 : 0.42));
  const qx = W - m - qrBox;
  const qy = m + (H - 2 * m - capH - qrBox) / 2;
  const info = placeQr(qr, qx, qy, qrBox, out);
  if (showCap) {
    const cap = scanText(item);
    const cs = Math.min(capS, capS * (qrBox + colGap) / textW(cap, capS));
    out.push({ t: 'text', x: qx + qrBox / 2, y: qy + qrBox + capH * 0.72, size: cs, anchor: 'middle', spans: [{ s: cap, w: 400 }] });
  }
  const tw = qx - colGap - m;
  const base = clamp(H * 0.15, 3, 7.2);
  const fit = fitBlocks(buildBlocks(item, base, !compact), tw, H - 2 * m, base * 0.22);
  const ty = compact ? m + Math.max(0, (H - 2 * m - fit.h) / 2) : m;
  placeBlocks(fit.res, m, ty, tw, fit.gap, out);
  return info;
}
function layoutV(item, W, H, qr, out) {
  const m = 3, tw = W - 2 * m;
  const base = clamp(W * 0.105, 3, 7.5), gap = base * 0.22;
  const capS = clamp(W * 0.045, 2.1, 2.9), capH = qr ? capS * 1.8 : 0;
  const minQr = Math.min(tw, H * 0.36);
  const fit = fitBlocks(buildBlocks(item, base, true), tw, H - 2 * m - minQr - capH - gap * 3, gap);
  const isHead = (b) => b.k === 'cat' || b.k === 'title' || b.k === 'size';
  const head = fit.res.filter(isHead), tail = fit.res.filter((b) => !isHead(b));
  const headH = stackH(head, fit.gap), tailH = stackH(tail, fit.gap);
  placeBlocks(head, m, m, tw, fit.gap, out);
  const top = m + headH + gap * 1.5;
  const bottom = H - m - tailH - (tail.length ? gap * 1.5 : 0);
  const qrBox = Math.max(6, Math.min(tw, bottom - top - capH));
  const qx = (W - qrBox) / 2, qy = top + (bottom - top - capH - qrBox) / 2;
  const info = placeQr(qr, qx, qy, qrBox, out);
  if (qr) {
    const cap = scanText(item);
    const cs = Math.min(capS, capS * tw / textW(cap, capS));
    out.push({ t: 'text', x: W / 2, y: qy + qrBox + capH * 0.72, size: cs, anchor: 'middle', spans: [{ s: cap, w: 400 }] });
  }
  if (tail.length) placeBlocks(tail, m, H - m - tailH, tw, fit.gap, out);
  return info;
}
function buildLabel(item, s) {
  const d = designDims(s);
  const qr = makeQR(d.f.shortQr ? item.code : (item.qrText || qrUrl(item.code)));
  const list = [];
  const qrInfo = (d.W >= d.H * 1.15 ? layoutH : layoutV)(item, d.W, d.H, qr, list);
  return { list, W: d.W, H: d.H, qrInfo };
}

// ---------------------------------------------------------------------------
// Ausgabe: SVG (Vorschau/Druck) und Canvas (PNG)
// ---------------------------------------------------------------------------
function listToSvg(list) {
  let s = '';
  for (const e of list) {
    if (e.t === 'rect') {
      s += `<rect x="${r3(e.x)}" y="${r3(e.y)}" width="${r3(e.w)}" height="${r3(e.h)}"${e.r ? ` rx="${r3(e.r)}"` : ''} fill="${e.fill || '#000'}"${e.stroke ? ` stroke="${e.stroke}" stroke-width="${r3(e.sw)}"` : ''}/>`;
    } else if (e.t === 'text') {
      const inner = e.spans.map((sp) => `<tspan font-weight="${sp.w}">${esc(sp.s)}</tspan>`).join('');
      s += `<text x="${r3(e.x)}" y="${r3(e.y)}" font-size="${r3(e.size)}" fill="${e.fill || '#000'}"${e.anchor ? ` text-anchor="${e.anchor}"` : ''}${e.ls ? ` letter-spacing="${r3(e.ls)}"` : ''} xml:space="preserve">${inner}</text>`;
    } else if (e.t === 'icon') {
      s += `<path d="${PIN}" transform="translate(${r3(e.x)} ${r3(e.y)}) scale(${r3(e.s)})" fill="#000" fill-rule="evenodd"/>`;
    } else if (e.t === 'qr') {
      let d = '';
      qrRuns(e, (r, c0, len) => { d += `M${r3(e.ox + c0 * e.mod)} ${r3(e.oy + r * e.mod)}h${r3(len * e.mod)}v${r3(e.mod)}h${r3(-len * e.mod)}z`; });
      s += `<path d="${d}" fill="#000" shape-rendering="crispEdges"/>`;
    }
  }
  return s;
}
function labelInner(lbl) {
  return `<rect width="${r3(lbl.W)}" height="${r3(lbl.H)}" fill="#fff"/><g font-family="${SFONT}" text-rendering="geometricPrecision">${listToSvg(lbl.list)}</g>`;
}
export function labelPreviewSvg(item, settings = getLabelSettings()) {
  const lbl = buildLabel(item, settings);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${r3(lbl.W)} ${r3(lbl.H)}" role="img" aria-label="${esc(item.title || '')}" style="width:100%;height:auto;display:block;background:#fff;border-radius:6px;box-shadow:0 1px 2px rgba(0,0,0,.15),0 6px 18px rgba(0,0,0,.12)">${labelInner(lbl)}</svg>`;
}
function printSvg(lbl, pg) {
  const g = pg.rot ? `<g transform="translate(${r3(pg.pw)} 0) rotate(90)">` : '<g>';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${r3(pg.pw)}mm" height="${r3(pg.ph)}mm" viewBox="0 0 ${r3(pg.pw)} ${r3(pg.ph)}">${g}${labelInner(lbl)}</g></svg>`;
}
function listToCanvas(ctx, list, k) {
  const hasLs = 'letterSpacing' in ctx;
  for (const e of list) {
    if (e.t === 'rect') {
      ctx.beginPath();
      if (e.r && ctx.roundRect) ctx.roundRect(e.x * k, e.y * k, e.w * k, e.h * k, e.r * k);
      else ctx.rect(e.x * k, e.y * k, e.w * k, e.h * k);
      if (e.fill && e.fill !== 'none') { ctx.fillStyle = e.fill; ctx.fill(); }
      if (e.stroke) { ctx.lineWidth = e.sw * k; ctx.strokeStyle = e.stroke; ctx.stroke(); }
    } else if (e.t === 'text') {
      ctx.fillStyle = e.fill || '#000'; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
      if (hasLs) ctx.letterSpacing = (e.ls ? e.ls * k : 0) + 'px';
      const fonts = e.spans.map((sp) => `${sp.w} ${e.size * k}px ${MFONT}`);
      let x = e.x * k;
      if (e.anchor === 'middle') {
        let total = 0;
        e.spans.forEach((sp, i) => { ctx.font = fonts[i]; total += ctx.measureText(sp.s).width; });
        x -= total / 2;
      }
      e.spans.forEach((sp, i) => { ctx.font = fonts[i]; ctx.fillText(sp.s, x, e.y * k); x += ctx.measureText(sp.s).width; });
    } else if (e.t === 'icon') {
      ctx.save(); ctx.translate(e.x * k, e.y * k); ctx.scale(e.s * k, e.s * k);
      ctx.fillStyle = '#000'; ctx.fill(new Path2D(PIN), 'evenodd'); ctx.restore();
    } else if (e.t === 'qr') {
      const m = Math.max(1, Math.round(e.mod * k)), ox = Math.round(e.ox * k), oy = Math.round(e.oy * k);
      ctx.fillStyle = '#000';
      qrRuns(e, (r, c0, len) => ctx.fillRect(ox + c0 * m, oy + r * m, len * m, m));
    }
  }
  if (hasLs) ctx.letterSpacing = '0px';
}
const CRC_TABLE = (() => { const tb = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let j = 0; j < 8; j++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; tb[n] = c >>> 0; } return tb; })();
function crc32(bytes) { let c = 0xFFFFFFFF; for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function withDpi(png, dpi) {
  const dv = new DataView(png.buffer, png.byteOffset, png.byteLength);
  for (let off = 8; off + 8 <= png.length;) {
    const len = dv.getUint32(off), type = String.fromCharCode(...png.subarray(off + 4, off + 8));
    if (type === 'pHYs') return png;
    if (type === 'IDAT') break;
    off += 12 + len;
  }
  const ppm = Math.round(dpi / 0.0254);
  const chunk = new Uint8Array(21), cv = new DataView(chunk.buffer);
  cv.setUint32(0, 9); chunk.set([0x70, 0x48, 0x59, 0x73], 4);
  cv.setUint32(8, ppm); cv.setUint32(12, ppm); chunk[16] = 1;
  cv.setUint32(17, crc32(chunk.subarray(4, 17)));
  const out = new Uint8Array(png.length + 21);
  out.set(png.subarray(0, 33)); out.set(chunk, 33); out.set(png.subarray(33), 54);
  return out;
}
export function labelCanvas(item, settings = getLabelSettings(), dpi = 300) {
  const lbl = buildLabel(item, settings);
  const k = dpi / 25.4;
  const cv = document.createElement('canvas');
  cv.width = Math.round(lbl.W * k); cv.height = Math.round(lbl.H * k);
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
  listToCanvas(ctx, lbl.list, k);
  return { canvas: cv, lbl };
}
export async function downloadLabelPngs(items, settings = getLabelSettings()) {
  for (const it of items) {
    const { canvas, lbl } = labelCanvas(it, settings);
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const name = `${it.code}-${String(it.title || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)}-${r3(lbl.W)}x${r3(lbl.H)}mm.png`;
    downloadBlob(name, new Blob([withDpi(bytes, 300)], { type: 'image/png' }));
    if (items.length > 1) await new Promise((r) => setTimeout(r, 350));
  }
}
export function printLabels(items, settings = getLabelSettings()) {
  const pg = pageGeom(settings);
  const copies = clamp(parseInt(settings.copies, 10) || 1, 1, 50);
  let st = document.getElementById('printStyle');
  if (!st) { st = document.createElement('style'); st.id = 'printStyle'; document.head.appendChild(st); }
  st.textContent = `@page{size:${r3(pg.pw)}mm ${r3(pg.ph)}mm;margin:0}@media print{.print-page{width:${r3(pg.pw)}mm;height:${r3(pg.ph - 0.3)}mm}}`;
  let area = document.getElementById('printArea');
  if (!area) { area = document.createElement('div'); area.id = 'printArea'; document.body.appendChild(area); }
  const pages = [];
  for (const it of items) {
    const svg = printSvg(buildLabel(it, settings), pg);
    for (let i = 0; i < copies; i++) pages.push(`<div class="print-page">${svg}</div>`);
  }
  area.innerHTML = pages.join('');
  const clear = () => { area.innerHTML = ''; window.removeEventListener('afterprint', clear); };
  window.addEventListener('afterprint', clear);
  setTimeout(() => window.print(), 80);
}
export function labelQrQuality(item, settings = getLabelSettings()) {
  return buildLabel(item, settings).qrInfo;
}

// Dialog: Vorschau, Rolle wählen, drucken (Brother QL-800 oder PDF) oder PNG
export async function openLabelDialog(items) {
  items = (items || []).filter(Boolean);
  if (!items.length) return;
  if (!(await ensureQrLib())) { toast(t('labels.noQr'), 'error'); return; }
  let settings = getLabelSettings();
  let idx = 0;
  const body = `
    <div class="stack">
      <div data-preview style="background:repeating-conic-gradient(var(--surface-3) 0 25%, var(--surface) 0 50%) 0 0/16px 16px;border-radius:10px;padding:18px;display:flex;justify-content:center"></div>
      <div class="row" style="justify-content:space-between">
        <span class="muted small" data-count></span>
        <span class="row" data-nav ${items.length > 1 ? '' : 'hidden'}>
          <button type="button" class="btn sm" data-prev aria-label="‹">‹</button>
          <button type="button" class="btn sm" data-next aria-label="›">›</button>
        </span>
      </div>
      <p class="small" data-qr></p>
      <div class="form">
        <div class="field full"><label for="lbl-fmt">${esc(t('labels.format'))}</label>
          <select id="lbl-fmt">${Object.keys(LABEL_FORMATS).map((k) => `<option value="${k}" ${k === settings.format ? 'selected' : ''}>${esc(formatName(k))}</option>`).join('')}</select></div>
        <div class="field" data-lenfield><label for="lbl-len">${esc(t('labels.length'))}</label><input id="lbl-len" type="number" min="40" max="200" step="5" value="${esc(settings.contLen)}"></div>
        <div class="field"><label for="lbl-copies">${esc(t('labels.copies'))}</label><input id="lbl-copies" type="number" min="1" max="50" value="${esc(settings.copies)}"></div>
        <label class="check field full"><input type="checkbox" id="lbl-flip" ${settings.flip ? 'checked' : ''}> ${esc(t('labels.flip'))}</label>
      </div>
      <p class="hint">${esc(t('labels.printHint'))}</p>
    </div>`;
  await sheet({
    title: t('labels.title'),
    wide: true,
    body,
    actions: [
      { label: t('labels.png'), kind: '', icon: 'download', onClick: async () => { await downloadLabelPngs(items, settings); return false; } },
      { label: t('labels.print'), kind: 'primary', icon: 'print', onClick: async () => { printLabels(items, settings); return true; } },
    ],
    onOpen: (el) => {
      const pv = el.querySelector('[data-preview]');
      const update = () => {
        const it = items[idx];
        const d = designDims(settings);
        pv.innerHTML = `<div style="width:${d.W < d.H ? Math.round(240 * d.W / d.H) + 'px' : '100%'};max-width:460px">${labelPreviewSvg(it, settings)}</div>`;
        el.querySelector('[data-count]').textContent = `${items.length > 1 ? (idx + 1) + ' / ' : ''}${t('labels.count', { n: items.length * (parseInt(settings.copies, 10) || 1) })}`;
        const q = buildLabel(it, settings).qrInfo;
        const fmt = LABEL_FORMATS[settings.format] || {};
        el.querySelector('[data-qr]').textContent = q ? [q.dots >= 4 ? t('labels.qrOk', { mm: String(q.mod.toFixed(2)).replace('.', ',') }) : t('labels.qrSmall'),
          fmt.shortQr ? t('labels.shortQr') : ''].filter(Boolean).join(' ') : '';
        el.querySelector('[data-lenfield]').hidden = !!fmt.len;
      };
      el.querySelector('#lbl-fmt').addEventListener('change', (e) => { settings = setLabelSettings({ format: e.target.value }); update(); });
      el.querySelector('#lbl-len').addEventListener('input', (e) => { settings = setLabelSettings({ contLen: e.target.value }); update(); });
      el.querySelector('#lbl-copies').addEventListener('input', (e) => { settings = setLabelSettings({ copies: e.target.value }); update(); });
      el.querySelector('#lbl-flip').addEventListener('change', (e) => { settings = setLabelSettings({ flip: e.target.checked }); update(); });
      const prev = el.querySelector('[data-prev]'), next = el.querySelector('[data-next]');
      if (prev) prev.addEventListener('click', () => { idx = (idx - 1 + items.length) % items.length; update(); });
      if (next) next.addEventListener('click', () => { idx = (idx + 1) % items.length; update(); });
      try { update(); } catch (err) { toast(errorText(err), 'error'); }
    },
  });
}
