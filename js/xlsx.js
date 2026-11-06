// Kleiner Excel-Writer (.xlsx) ohne Fremdbibliothek: ZIP «stored» (ohne Kompression) mit CRC32.
// Inhalt: [Content_Types].xml, _rels/.rels, xl/workbook.xml, xl/_rels/workbook.xml.rels, xl/styles.xml,
// xl/worksheets/sheetN.xml (Text als inlineStr, Zahlen als Zahl, fette Kopfzeile, erste Zeile fixiert).
// Öffnet in Excel, LibreOffice und Numbers. Bewusst ohne Abhängigkeiten (auch in Node testbar).
//
//   import { xlsxBlob } from './xlsx.js';
//   downloadBlob('inventur.xlsx', xlsxBlob([{ name: 'Artikel', rows: [['Code', 'Menge'], ['INV-0001', 3]] }]));
//
// rows: Array von Zeilen; Zelle = String | Zahl | null/undefined (leer) | Boolean (als Text «1»/«0» vermeiden → selbst übersetzen).

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// ---------- CRC32 (IEEE 802.3) ----------
let crcTable = null;
function makeCrcTable() {
  const tbl = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    tbl[n] = c >>> 0;
  }
  return tbl;
}
export function crc32(bytes) {
  if (!crcTable) crcTable = makeCrcTable();
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = crcTable[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

// ---------- ZIP (Methode 0 = stored) ----------
function dosDateTime(d) {
  const year = Math.max(1980, d.getFullYear());
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2);
  const date = ((year - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { time: time & 0xFFFF, date: date & 0xFFFF };
}
/** files: [{ name, data: Uint8Array }] → Uint8Array (ZIP-Archiv) */
export function zipStored(files, when = new Date()) {
  const enc = new TextEncoder();
  const { time, date } = dosDateTime(when);
  const parts = [];
  const central = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name);
    const data = f.data;
    const crc = crc32(data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034B50, true);   // Local file header
    local.setUint16(4, 20, true);           // Version needed (2.0)
    local.setUint16(6, 0x0800, true);       // Flag: Dateiname UTF-8
    local.setUint16(8, 0, true);            // stored
    local.setUint16(10, time, true);
    local.setUint16(12, date, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, data.length, true);
    local.setUint16(26, name.length, true);
    local.setUint16(28, 0, true);
    parts.push(new Uint8Array(local.buffer), name, data);

    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014B50, true);      // Central directory header
    cd.setUint16(4, 20, true);              // Version made by
    cd.setUint16(6, 20, true);              // Version needed
    cd.setUint16(8, 0x0800, true);
    cd.setUint16(10, 0, true);
    cd.setUint16(12, time, true);
    cd.setUint16(14, date, true);
    cd.setUint32(16, crc, true);
    cd.setUint32(20, data.length, true);
    cd.setUint32(24, data.length, true);
    cd.setUint16(28, name.length, true);
    cd.setUint16(30, 0, true);              // extra
    cd.setUint16(32, 0, true);              // comment
    cd.setUint16(34, 0, true);              // disk
    cd.setUint16(36, 0, true);              // internal attrs
    cd.setUint32(38, 0, true);              // external attrs
    cd.setUint32(42, offset, true);         // Offset des Local headers
    central.push(new Uint8Array(cd.buffer), name);

    offset += 30 + name.length + data.length;
  }
  const cdSize = central.reduce((s, p) => s + p.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054B50, true);       // End of central directory
  end.setUint16(4, 0, true);
  end.setUint16(6, 0, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, cdSize, true);
  end.setUint32(16, offset, true);
  end.setUint16(20, 0, true);
  const all = [...parts, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(all.reduce((s, p) => s + p.length, 0));
  let pos = 0;
  for (const p of all) { out.set(p, pos); pos += p.length; }
  return out;
}

// ---------- SpreadsheetML ----------
// Nur in XML erlaubte Zeichen behalten (Steuerzeichen ausser Tab/LF/CR entfernen) und maskieren
function xmlText(s) {
  return String(s)
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '$1')   // einzelne Surrogates
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function colName(i) {        // 0 → A, 25 → Z, 26 → AA
  let s = '';
  let n = i + 1;
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}
function sheetName(name, i, used) {
  let s = String(name || `Tabelle${i + 1}`).replace(/[[\]:*?/\\]/g, ' ').replace(/^'+|'+$/g, '').trim().slice(0, 31) || `Tabelle${i + 1}`;
  let k = 2;
  const base = s;
  while (used.has(s.toLowerCase())) s = `${base.slice(0, 28)} ${k++}`;
  used.add(s.toLowerCase());
  return s;
}
function cellXml(ref, v, style) {
  const st = style ? ` s="${style}"` : '';
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return '';
    return `<c r="${ref}"${st}><v>${v}</v></c>`;
  }
  if (v === null || v === undefined || v === '') return '';
  let s = String(v);
  if (s.length > 32767) s = s.slice(0, 32767);   // Grenze einer Excel-Zelle
  return `<c r="${ref}"${st} t="inlineStr"><is><t xml:space="preserve">${xmlText(s)}</t></is></c>`;
}
function colWidths(rows, given) {
  if (Array.isArray(given) && given.length) return given;
  const w = [];
  for (const r of rows.slice(0, 500)) {
    (r || []).forEach((v, i) => {
      const len = v === null || v === undefined ? 0 : String(v).split('\n').reduce((m, x) => Math.max(m, x.length), 0);
      w[i] = Math.max(w[i] || 6, Math.min(60, len + 2));
    });
  }
  return w;
}
function worksheetXml({ rows = [], widths, header = true }) {
  const ws = colWidths(rows, widths);
  const cols = ws.length
    ? `<cols>${ws.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${Math.max(4, Math.min(100, Number(w) || 10))}" customWidth="1"/>`).join('')}</cols>`
    : '';
  const body = rows.map((r, ri) => {
    const cells = (r || []).map((v, ci) => cellXml(colName(ci) + (ri + 1), v, header && ri === 0 ? 1 : 0)).join('');
    return `<row r="${ri + 1}">${cells}</row>`;
  }).join('');
  const maxCols = rows.reduce((m, r) => Math.max(m, (r || []).length), 0);
  const lastCol = colName(Math.max(0, maxCols - 1));
  const dim = rows.length ? `<dimension ref="A1:${lastCol}${rows.length}"/>` : '<dimension ref="A1"/>';
  const views = header && rows.length > 1
    ? '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
    : '<sheetViews><sheetView workbookViewId="0"/></sheetViews>';
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
    + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
    + `${dim}${views}<sheetFormatPr defaultRowHeight="15"/>${cols}<sheetData>${body}</sheetData>`
    + '<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/></worksheet>';
}

const STYLES_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
  + '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
  + '<fonts count="2"><font><sz val="11"/><name val="Calibri"/><family val="2"/></font>'
  + '<font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font></fonts>'
  + '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>'
  + '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
  + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
  + '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
  + '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>'
  + '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
  + '</styleSheet>';

/**
 * Erzeugt die .xlsx-Datei als Bytes.
 * @param {Array<{name:string, rows:Array<Array<string|number|null>>, widths?:number[], header?:boolean}>|Array<Array>} sheets
 *        Liste von Tabellenblättern – oder direkt ein rows-Array (ein Blatt «Tabelle1»).
 * @returns {Uint8Array}
 */
export function xlsxBytes(sheets, { when = new Date() } = {}) {
  let list = sheets;
  if (Array.isArray(sheets) && (sheets.length === 0 || Array.isArray(sheets[0]))) list = [{ name: 'Tabelle1', rows: sheets }];
  if (!Array.isArray(list) || !list.length) list = [{ name: 'Tabelle1', rows: [] }];
  const used = new Set();
  const named = list.map((s, i) => ({ ...s, name: sheetName(s.name, i, used) }));
  const enc = new TextEncoder();
  const u = (s) => enc.encode(s);

  const contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
    + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    + '<Default Extension="xml" ContentType="application/xml"/>'
    + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
    + named.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')
    + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
    + '</Types>';
  const rootRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
    + '</Relationships>';
  const workbook = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
    + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
    + '<bookViews><workbookView/></bookViews><sheets>'
    + named.map((s, i) => `<sheet name="${xmlText(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')
    + '</sheets></workbook>';
  const wbRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + named.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')
    + `<Relationship Id="rId${named.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`
    + '</Relationships>';

  const files = [
    { name: '[Content_Types].xml', data: u(contentTypes) },
    { name: '_rels/.rels', data: u(rootRels) },
    { name: 'xl/workbook.xml', data: u(workbook) },
    { name: 'xl/_rels/workbook.xml.rels', data: u(wbRels) },
    { name: 'xl/styles.xml', data: u(STYLES_XML) },
    ...named.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: u(worksheetXml(s)) })),
  ];
  return zipStored(files, when);
}

/** Wie xlsxBytes, aber als Blob (Browser) – zum Herunterladen mit downloadBlob(filename, blob) aus util.js. */
export function xlsxBlob(sheets, opts) {
  return new Blob([xlsxBytes(sheets, opts)], { type: XLSX_MIME });
}
