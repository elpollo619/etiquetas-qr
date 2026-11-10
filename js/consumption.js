// Verbrauch und Reichweite: «reicht noch ca. …» aus den Entnahmen der letzten 90 Tage (api.listConsumption).
// Schätzung: Verbrauch pro Tag = Entnahmen / Zeitraum (seit Anlage des Artikels, höchstens 90, mindestens 7 Tage).
// Erst ab zwei Entnahmen – mit weniger Daten zeigt die App keine Schätzung (lieber nichts als etwas Erfundenes).
import { t, registerStrings, fmtNum } from './i18n.js';

registerStrings({
  de: {
    'cover.days': 'reicht noch ca. {n} Tage', 'cover.day': 'reicht noch ca. 1 Tag', 'cover.lessDay': 'reicht weniger als 1 Tag',
    'cover.weeks': 'reicht noch ca. {n} Wochen', 'cover.months': 'reicht noch ca. {n} Monate',
    'cover.title': 'Schätzung aus {takes} Entnahmen ({used}) der letzten {days} Tage',
  },
  pt: {
    'cover.days': 'dura ainda cerca de {n} dias', 'cover.day': 'dura ainda cerca de 1 dia', 'cover.lessDay': 'dura menos de 1 dia',
    'cover.weeks': 'dura ainda cerca de {n} semanas', 'cover.months': 'dura ainda cerca de {n} meses',
    'cover.title': 'Estimativa a partir de {takes} saídas ({used}) dos últimos {days} dias',
  },
  es: {
    'cover.days': 'alcanza aún para unos {n} días', 'cover.day': 'alcanza aún para 1 día', 'cover.lessDay': 'alcanza para menos de 1 día',
    'cover.weeks': 'alcanza aún para unas {n} semanas', 'cover.months': 'alcanza aún para unos {n} meses',
    'cover.title': 'Estimación con {takes} salidas ({used}) de los últimos {days} días',
  },
});

const DAY = 86400000;

/** Map article_id → Verbrauchszeile. */
export function consumptionMap(rows) {
  return new Map((rows || []).map((r) => [r.article_id, r]));
}

/** Reichweite in Tagen oder null (zu wenig Daten / kein Verbrauch / kein Bestand bekannt). */
export function coverDays(article, cons, now = Date.now()) {
  if (!article || !cons) return null;
  const takes = Number(cons.takes_90d), used = Number(cons.used_90d), stock = Number(article.stock);
  if (!(takes >= 2) || !(used > 0) || !Number.isFinite(stock) || stock < 0) return null;
  const created = Date.parse(article.created_at || '') || 0;
  const start = Math.max(now - 90 * DAY, created);
  const span = Math.min(90, Math.max(7, (now - start) / DAY));
  const perDay = used / span;
  return perDay > 0 ? stock / perDay : null;
}

export function coverSpanDays(article, now = Date.now()) {
  const created = Date.parse((article && article.created_at) || '') || 0;
  return Math.round(Math.min(90, Math.max(7, (now - Math.max(now - 90 * DAY, created)) / DAY)));
}

/** Kurzer Text («reicht noch ca. 3 Wochen») oder ''. */
export function coverText(days) {
  if (days === null || days === undefined || !Number.isFinite(days)) return '';
  if (days < 1) return t('cover.lessDay');
  if (days < 1.5) return t('cover.day');
  if (days < 14) return t('cover.days', { n: fmtNum(Math.round(days)) });
  if (days < 70) return t('cover.weeks', { n: fmtNum(Math.round(days / 7)) });
  return t('cover.months', { n: fmtNum(Math.round(days / 30)) });
}

/** Vorgeschlagene Einkaufsmenge: Nachkaufmenge, sonst bis zum doppelten Mindestbestand (wie der Datenbank-Trigger). */
export function suggestQty(a) {
  const r = Number(a && a.reorder_qty);
  if (a && a.reorder_qty !== null && a.reorder_qty !== undefined && a.reorder_qty !== '' && Number.isFinite(r) && r > 0) return r;
  const min = Number(a && a.min_stock) || 0, stock = Number(a && a.stock) || 0;
  return Math.min(Math.max(Math.ceil(min * 2 - stock), 1), 999999999);
}

// Zustand eines Bestandsartikels: 'uncounted' (0 + Notiz «Menge noch nicht gezählt»), 'empty', 'refill' (<= Mindestbestand,
// wie article_overview.low_stock), 'low' (bis 25 % darüber), 'ok'. Texte: stock.* (js/views/stock-tools.js).
const UNCOUNTED_RE = /Menge noch nicht gezählt/;
const n0 = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
export function isUncounted(a) { return n0(a && a.stock) <= 0 && UNCOUNTED_RE.test((a && a.notes) || ''); }
export function stockState(a) {
  const s = n0(a && a.stock);
  const hasMin = a && a.min_stock !== null && a.min_stock !== undefined && a.min_stock !== '';
  const min = n0(a && a.min_stock);
  if (isUncounted(a)) return 'uncounted';
  if (s <= 0) return 'empty';
  if (!hasMin) return 'ok';
  if (s <= min) return 'refill';
  if (s <= min * 1.25) return 'low';
  return 'ok';
}
export const STATE_PILL = { ok: 'pill-ok', low: 'pill-info', refill: 'pill-warn', empty: 'pill-danger', uncounted: 'pill-muted' };
export const STATE_LABEL = { ok: 'stock.ok', low: 'stock.low', refill: 'stock.refill', empty: 'stock.empty', uncounted: 'stock.uncounted' };
