// Kleiner ZIP-Leser für den Fotoimport (ohne Bibliothek).
// Unterstützt: Methode 0 («stored») und 8 («deflate», über DecompressionStream('deflate-raw')),
// Dateinamen in UTF-8 (Flag 11 oder Info-ZIP-Unicode-Feld) und sonst CP437 (Windows-Explorer).
// Nicht unterstützt (klare Fehler statt stillem Weglassen): ZIP64, verschlüsselte Einträge, andere Methoden,
// mehrteilige Archive. Liest nur die benötigten Teile (Blob.slice) – grosse ZIP-Dateien landen nicht ganz im Speicher.
//
//   const entries = await listZipEntries(file);            // Inhaltsverzeichnis
//   const img = await readZipEntry(file, entries[0]);      // → File (Name ohne Ordner, MIME nach Endung)
//
// Fehler: ZipError mit code ∈ zip_invalid, zip64, zip_encrypted, zip_method, zip_unsupported, zip_crc.

export const ZIP_IMAGE_EXT = ['jpg', 'jpeg', 'png', 'webp', 'heic'];
const MIME = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic' };

export class ZipError extends Error {
  constructor(code, detail = null) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = 'ZipError';
    this.code = code;
    this.detail = detail;
  }
}

const SIG_EOCD = 0x06054b50;
const SIG_EOCD64_LOCATOR = 0x07064b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_LOCAL = 0x04034b50;
const MAX_COMMENT = 0xffff;

/** Endung (klein, ohne Punkt) eines Datei- oder Pfadnamens */
export function extOf(name) {
  const base = String(name || '').split('/').pop();
  const i = base.lastIndexOf('.');
  return i > 0 ? base.slice(i + 1).toLowerCase() : '';
}
export const isImageName = (name) => ZIP_IMAGE_EXT.includes(extOf(name));
export const mimeForName = (name) => MIME[extOf(name)] || 'application/octet-stream';

/** Pfad bereinigen: Schrägstriche, keine «..», kein Laufwerk, keine leeren Teile. */
export function normalizePath(p) {
  const parts = String(p || '').replace(/\\/g, '/').replace(/^[a-zA-Z]:/, '').split('/');
  const out = [];
  for (const s of parts) {
    if (!s || s === '.') continue;
    if (s === '..') { out.pop(); continue; }
    out.push(s);
  }
  return out.join('/');
}
/** «Büro/Regal A/foto.jpg» → { folder: 'Büro/Regal A', name: 'foto.jpg' } */
export function splitPath(p) {
  const n = normalizePath(p);
  const i = n.lastIndexOf('/');
  return i < 0 ? { folder: '', name: n } : { folder: n.slice(0, i), name: n.slice(i + 1) };
}

// CP437 (Zeichen 0x80–0xFF) – Standard für ZIP-Namen ohne UTF-8-Flag (z. B. «Büro» aus dem Windows-Explorer)
const CP437_HIGH = 'ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ ';
export function decodeCp437(bytes) {
  let s = '';
  for (const b of bytes) s += b < 0x80 ? String.fromCharCode(b) : CP437_HIGH[b - 0x80];
  return s;
}
const utf8Strict = () => new TextDecoder('utf-8', { fatal: true });
function decodeName(bytes, utf8Flag, extra) {
  if (utf8Flag) return new TextDecoder('utf-8').decode(bytes);
  // Info-ZIP Unicode Path Extra Field (0x7075): Version 1, CRC32 des Originalnamens, UTF-8-Name
  const up = extra.get(0x7075);
  if (up && up.length > 5 && up[0] === 1) {
    const dv = new DataView(up.buffer, up.byteOffset, up.byteLength);
    if (dv.getUint32(1, true) === crc32(bytes)) {
      try { return utf8Strict().decode(up.subarray(5)); } catch (e) { /* weiter */ }
    }
  }
  // reines ASCII oder gültiges UTF-8 (viele Programme setzen das Flag nicht) – sonst CP437
  if (bytes.every((b) => b < 0x80)) return decodeCp437(bytes);
  try { return utf8Strict().decode(bytes); } catch (e) { return decodeCp437(bytes); }
}
function parseExtra(bytes) {
  const map = new Map();
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let p = 0;
  while (p + 4 <= bytes.length) {
    const id = dv.getUint16(p, true);
    const len = dv.getUint16(p + 2, true);
    if (p + 4 + len > bytes.length) break;
    map.set(id, bytes.subarray(p + 4, p + 4 + len));
    p += 4 + len;
  }
  return map;
}
function dosDate(date, time) {
  if (!date) return null;
  const d = new Date(1980 + (date >> 9), ((date >> 5) & 15) - 1, date & 31, time >> 11, (time >> 5) & 63, (time & 31) * 2);
  return isNaN(d) ? null : d;
}

// CRC32 (IEEE) zur Prüfung entpackter Daten
let CRC_TABLE = null;
export function crc32(bytes, crc = 0) {
  if (!CRC_TABLE) {
    CRC_TABLE = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c >>> 0;
    }
  }
  let c = (crc ^ 0xffffffff) >>> 0;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

async function readBytes(blob, start, end) {
  return new Uint8Array(await blob.slice(start, end).arrayBuffer());
}

/**
 * Inhaltsverzeichnis eines ZIP-Archivs lesen.
 * @returns {Promise<Array<{ path, folder, name, isDir, method, encrypted, compressedSize, size, crc32, localOffset, modified }>>}
 */
export async function listZipEntries(blob) {
  if (!blob || typeof blob.slice !== 'function') throw new ZipError('zip_invalid', 'no file');
  const total = blob.size;
  if (total < 22) throw new ZipError('zip_invalid', 'too small');
  const tailStart = Math.max(0, total - (22 + MAX_COMMENT));
  const tail = await readBytes(blob, tailStart, total);
  const tv = new DataView(tail.buffer, tail.byteOffset, tail.byteLength);
  // Ende-Kennung von hinten suchen; bevorzugt die, deren Kommentarlänge genau bis zum Dateiende reicht
  let eocd = -1, fallback = -1;
  for (let i = tail.length - 22; i >= 0; i--) {
    if (tv.getUint32(i, true) !== SIG_EOCD) continue;
    if (fallback < 0) fallback = i;
    if (i + 22 + tv.getUint16(i + 20, true) === tail.length) { eocd = i; break; }
  }
  if (eocd < 0) eocd = fallback;
  if (eocd < 0) throw new ZipError('zip_invalid', 'no end record');

  const disk = tv.getUint16(eocd + 4, true);
  const cdDisk = tv.getUint16(eocd + 6, true);
  const countDisk = tv.getUint16(eocd + 8, true);
  const count = tv.getUint16(eocd + 10, true);
  const cdSize = tv.getUint32(eocd + 12, true);
  const cdOffset = tv.getUint32(eocd + 16, true);
  const hasZip64Locator = eocd >= 20 && tv.getUint32(eocd - 20, true) === SIG_EOCD64_LOCATOR;
  if (hasZip64Locator || count === 0xffff || countDisk === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) {
    throw new ZipError('zip64');
  }
  if (disk !== 0 || cdDisk !== 0 || countDisk !== count) throw new ZipError('zip_invalid', 'multi-disk');
  const eocdAbs = tailStart + eocd;
  if (cdOffset + cdSize > eocdAbs) throw new ZipError('zip_invalid', 'central directory out of range');

  const cd = await readBytes(blob, cdOffset, cdOffset + cdSize);
  const dv = new DataView(cd.buffer, cd.byteOffset, cd.byteLength);
  const entries = [];
  let p = 0;
  for (let n = 0; n < count; n++) {
    if (p + 46 > cd.length || dv.getUint32(p, true) !== SIG_CENTRAL) throw new ZipError('zip_invalid', 'central directory');
    const flags = dv.getUint16(p + 8, true);
    const method = dv.getUint16(p + 10, true);
    const time = dv.getUint16(p + 12, true);
    const date = dv.getUint16(p + 14, true);
    const crc = dv.getUint32(p + 16, true);
    const compressedSize = dv.getUint32(p + 20, true);
    const size = dv.getUint32(p + 24, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const commentLen = dv.getUint16(p + 32, true);
    const externalAttr = dv.getUint32(p + 38, true);
    const localOffset = dv.getUint32(p + 42, true);
    const end = p + 46 + nameLen + extraLen + commentLen;
    if (end > cd.length) throw new ZipError('zip_invalid', 'central directory');
    const nameBytes = cd.subarray(p + 46, p + 46 + nameLen);
    const extra = parseExtra(cd.subarray(p + 46 + nameLen, p + 46 + nameLen + extraLen));
    // ZIP64-Werte stehen nur im Zusatzfeld 0x0001, wenn die 32-Bit-Felder 0xFFFFFFFF enthalten
    if (compressedSize === 0xffffffff || size === 0xffffffff || localOffset === 0xffffffff) {
      throw new ZipError('zip64');
    }
    const raw = decodeName(nameBytes, (flags & 0x0800) !== 0, extra);
    const isDir = /[\\/]$/.test(raw) || (externalAttr & 0x10) !== 0;
    const path = normalizePath(raw);
    const { folder, name } = splitPath(path);
    entries.push({
      path, folder, name, isDir,
      method, flags,
      encrypted: (flags & 0x0001) !== 0 || (flags & 0x0040) !== 0,
      compressedSize, size, crc32: crc, localOffset,
      modified: dosDate(date, time),
    });
    p = end;
  }
  return entries;
}

/** Einen Eintrag entpacken → File (Name ohne Ordner). Prüft Grösse und CRC32. */
export async function readZipEntry(blob, entry, { verify = true } = {}) {
  if (entry.encrypted) throw new ZipError('zip_encrypted', entry.path);
  if (entry.method !== 0 && entry.method !== 8) throw new ZipError('zip_method', String(entry.method));
  const head = await readBytes(blob, entry.localOffset, entry.localOffset + 30);
  const hv = new DataView(head.buffer, head.byteOffset, head.byteLength);
  if (head.length < 30 || hv.getUint32(0, true) !== SIG_LOCAL) throw new ZipError('zip_invalid', 'local header');
  const start = entry.localOffset + 30 + hv.getUint16(26, true) + hv.getUint16(28, true);
  const end = start + entry.compressedSize;
  if (end > blob.size) throw new ZipError('zip_invalid', 'truncated');
  const slice = blob.slice(start, end);

  let data;
  if (entry.method === 0) {
    if (entry.compressedSize !== entry.size) throw new ZipError('zip_invalid', 'stored size');
    data = new Uint8Array(await slice.arrayBuffer());
  } else {
    let ds;
    try {
      if (typeof DecompressionStream === 'undefined') throw new Error('DecompressionStream');
      ds = new DecompressionStream('deflate-raw');
    } catch (e) {
      throw new ZipError('zip_unsupported', 'deflate-raw');
    }
    // Stückweise entpacken und abbrechen, sobald mehr Daten kommen als angegeben (Schutz vor «ZIP-Bomben»)
    const limit = entry.size;
    const out = new Uint8Array(limit);
    let got = 0;
    const reader = slice.stream().pipeThrough(ds).getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (got + value.length > limit) {
          try { await reader.cancel(); } catch (e) { /* egal */ }
          throw new ZipError('zip_invalid', 'size');
        }
        out.set(value, got);
        got += value.length;
      }
    } catch (e) {
      if (e instanceof ZipError) throw e;
      throw new ZipError('zip_invalid', 'deflate');
    }
    data = got === limit ? out : out.subarray(0, got);
  }
  if (verify) {
    if (data.length !== entry.size) throw new ZipError('zip_invalid', 'size');
    if (crc32(data) !== entry.crc32) throw new ZipError('zip_crc', entry.path);
  }
  const opts = { type: mimeForName(entry.name) };
  if (entry.modified) opts.lastModified = entry.modified.getTime();
  return new File([data], entry.name || 'datei', opts);
}
