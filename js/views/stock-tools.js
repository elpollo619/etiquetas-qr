// Zwei Werkzeuge für den Alltag im Lager:
//   'verbrauch'   Verbrauchsmaterial: alles mit Mindestbestand (Papier, Stifte, Toner …) – Entnahme mit einem Tipp,
//                 Zugang erfassen, rot = nachfüllen. Entnahme/Zugang dürfen alle aktiven Mitarbeiter.
//   'einraeumen'  Einräumen/Umlagern per QR: Ziel-Lagerort scannen oder wählen, dann Maschinen/Artikel scannen oder suchen –
//                 sie werden sofort dorthin verschoben (mit «Rückgängig»). Nur Lagerverantwortliche/Admins.
import { t, registerStrings, fmtQty, fmtNum, unitLabel } from '../i18n.js';
import { esc, clean, uuid, can, toast, sheet, errorText, emptyHtml, thumbHtml, hydrateThumbs, icon, debounce, numOrNull } from '../util.js';
import { consumptionMap, coverDays, coverText, suggestQty } from '../consumption.js';

registerStrings({
  de: {
    'stock.title': 'Verbrauchsmaterial',
    'stock.sub': 'Material, das aufgebraucht wird. Bei Entnahme «−1» tippen; rot heisst nachfüllen.',
    'stock.search': 'Material oder Ort suchen…',
    'stock.f.all': 'Alle', 'stock.f.refill': 'Nachfüllen', 'stock.f.uncounted': 'Noch nicht gezählt',
    'stock.min': 'Mindestens {qty}', 'stock.refill': 'Nachfüllen', 'stock.empty': 'Leer', 'stock.ok': 'Genug', 'stock.low': 'Knapp',
    'stock.onList': 'Auf der Einkaufsliste', 'stock.toList': 'Auf die Liste', 'stock.toListAria': '{name} auf die Einkaufsliste setzen',
    'stock.listed': '«{name}» steht auf der Einkaufsliste.', 'stock.openList': 'Einkaufsliste',
    'stock.uncounted': 'Noch nicht gezählt',
    'stock.take': '−1', 'stock.takeAria': '1 {unit} {name} entnehmen', 'stock.add': 'Zugang', 'stock.addAria': 'Zugang für {name} erfassen',
    'stock.taken': '{name}: 1 entnommen – noch {qty}', 'stock.added': '{name}: {qty} dazu – jetzt {now}',
    'stock.addTitle': 'Zugang: {name}', 'stock.addQty': 'Menge ({unit})', 'stock.addNote': 'Bemerkung (optional)',
    'stock.addBtn': 'Erfassen', 'stock.noStock': 'Kein Bestand mehr – zuerst nachfüllen oder zählen.',
    'stock.none': 'Noch kein Verbrauchsmaterial. Ein Artikel erscheint hier, sobald er einen Mindestbestand hat (Artikel → Bearbeiten → Mindestbestand).',
    'stock.noneFound': 'Nichts gefunden.',
    'stock.summary': '{n} Materialien · {refill} nachfüllen · {unc} noch nicht gezählt · {listed} auf der Einkaufsliste',
    'stock.openArticles': 'Alle Artikel',
    'stock.group.other': 'Weiteres',
    'putaway.title': 'Einräumen',
    'putaway.sub': 'Ziel wählen oder dessen Etikett scannen – dann Maschinen und Artikel scannen oder suchen. Sie werden sofort dorthin verschoben.',
    'putaway.noAccess': 'Einräumen können nur Lagerverantwortliche und Administratoren.',
    'putaway.target': 'Ziel-Lagerort', 'putaway.targetNone': 'Noch kein Ziel gewählt.',
    'putaway.choose': '– Lagerort wählen –', 'putaway.scanTarget': 'Ziel scannen', 'putaway.scanItems': 'Gegenstände scannen',
    'putaway.scanTargetHint': 'Etikett eines Regals, Schranks, einer Box oder eines Raums scannen.',
    'putaway.scanItemsHint': 'Etiketten der Maschinen und Artikel nacheinander scannen. Ein Lagerort-Etikett wechselt das Ziel.',
    'putaway.search': 'Maschine oder Artikel suchen (Name oder Code)…', 'putaway.here': 'Hierher',
    'putaway.moved': '{name} → {to}', 'putaway.already': '{name} ist schon hier.',
    'putaway.notFound': 'Code {code} nicht gefunden.', 'putaway.targetSet': 'Ziel: {name}',
    'putaway.needTarget': 'Bitte zuerst ein Ziel wählen.', 'putaway.done': 'In dieser Sitzung verschoben ({n})',
    'putaway.undo': 'Rückgängig', 'putaway.isHere': 'Schon hier', 'putaway.wasUndone': 'Rückgängig gemacht', 'putaway.undone': '{name} zurück nach {to}',
    'putaway.machine': 'Maschine', 'putaway.article': 'Artikel', 'putaway.from': 'von {from}',
    'putaway.open': 'Ziel öffnen',
  },
  pt: {
    'stock.title': 'Consumíveis',
    'stock.sub': 'Material que se gasta. Ao retirar, toca em «−1»; vermelho significa repor.',
    'stock.search': 'Pesquisar material ou local…',
    'stock.f.all': 'Todos', 'stock.f.refill': 'Repor', 'stock.f.uncounted': 'Ainda não contado',
    'stock.min': 'Mínimo {qty}', 'stock.refill': 'Repor', 'stock.empty': 'Vazio', 'stock.ok': 'Suficiente', 'stock.low': 'Pouco',
    'stock.onList': 'Na lista de compras', 'stock.toList': 'Para a lista', 'stock.toListAria': 'Pôr {name} na lista de compras',
    'stock.listed': '«{name}» está na lista de compras.', 'stock.openList': 'Lista de compras',
    'stock.uncounted': 'Ainda não contado',
    'stock.take': '−1', 'stock.takeAria': 'Retirar 1 {unit} de {name}', 'stock.add': 'Entrada', 'stock.addAria': 'Registar entrada de {name}',
    'stock.taken': '{name}: 1 retirado – restam {qty}', 'stock.added': '{name}: +{qty} – agora {now}',
    'stock.addTitle': 'Entrada: {name}', 'stock.addQty': 'Quantidade ({unit})', 'stock.addNote': 'Nota (opcional)',
    'stock.addBtn': 'Registar', 'stock.noStock': 'Sem stock – repõe ou conta primeiro.',
    'stock.none': 'Ainda não há consumíveis. Um artigo aparece aqui quando tem stock mínimo (Artigo → Editar → Stock mínimo).',
    'stock.noneFound': 'Nada encontrado.',
    'stock.summary': '{n} materiais · {refill} para repor · {unc} por contar · {listed} na lista de compras',
    'stock.openArticles': 'Todos os artigos',
    'stock.group.other': 'Outros',
    'putaway.title': 'Arrumar',
    'putaway.sub': 'Escolhe o destino ou lê a sua etiqueta – depois lê ou pesquisa máquinas e artigos. São movidos logo para lá.',
    'putaway.noAccess': 'Só responsáveis de armazém e administradores podem arrumar.',
    'putaway.target': 'Destino', 'putaway.targetNone': 'Ainda não há destino.',
    'putaway.choose': '– escolher localização –', 'putaway.scanTarget': 'Ler destino', 'putaway.scanItems': 'Ler objetos',
    'putaway.scanTargetHint': 'Lê a etiqueta de uma estante, armário, caixa ou espaço.',
    'putaway.scanItemsHint': 'Lê as etiquetas das máquinas e artigos, uma a uma. Uma etiqueta de localização muda o destino.',
    'putaway.search': 'Pesquisar máquina ou artigo (nome ou código)…', 'putaway.here': 'Para aqui',
    'putaway.moved': '{name} → {to}', 'putaway.already': '{name} já está aqui.',
    'putaway.notFound': 'Código {code} não encontrado.', 'putaway.targetSet': 'Destino: {name}',
    'putaway.needTarget': 'Escolhe primeiro um destino.', 'putaway.done': 'Movidos nesta sessão ({n})',
    'putaway.undo': 'Anular', 'putaway.isHere': 'Já está aqui', 'putaway.wasUndone': 'Anulado', 'putaway.undone': '{name} de volta para {to}',
    'putaway.machine': 'Máquina', 'putaway.article': 'Artigo', 'putaway.from': 'de {from}',
    'putaway.open': 'Abrir destino',
  },
  es: {
    'stock.title': 'Consumibles',
    'stock.sub': 'Material que se gasta. Al coger algo, toca «−1»; rojo significa reponer.',
    'stock.search': 'Buscar material o lugar…',
    'stock.f.all': 'Todos', 'stock.f.refill': 'Reponer', 'stock.f.uncounted': 'Sin contar',
    'stock.min': 'Mínimo {qty}', 'stock.refill': 'Reponer', 'stock.empty': 'Vacío', 'stock.ok': 'Suficiente', 'stock.low': 'Poco',
    'stock.onList': 'En la lista de compras', 'stock.toList': 'A la lista', 'stock.toListAria': 'Poner {name} en la lista de compras',
    'stock.listed': '«{name}» está en la lista de compras.', 'stock.openList': 'Lista de compras',
    'stock.uncounted': 'Sin contar',
    'stock.take': '−1', 'stock.takeAria': 'Coger 1 {unit} de {name}', 'stock.add': 'Entrada', 'stock.addAria': 'Registrar entrada de {name}',
    'stock.taken': '{name}: 1 cogido – quedan {qty}', 'stock.added': '{name}: +{qty} – ahora {now}',
    'stock.addTitle': 'Entrada: {name}', 'stock.addQty': 'Cantidad ({unit})', 'stock.addNote': 'Nota (opcional)',
    'stock.addBtn': 'Registrar', 'stock.noStock': 'Sin stock – repón o cuenta primero.',
    'stock.none': 'Todavía no hay consumibles. Un artículo aparece aquí cuando tiene stock mínimo (Artículo → Editar → Stock mínimo).',
    'stock.noneFound': 'No se encontró nada.',
    'stock.summary': '{n} materiales · {refill} para reponer · {unc} sin contar · {listed} en la lista de compras',
    'stock.openArticles': 'Todos los artículos',
    'stock.group.other': 'Otros',
    'putaway.title': 'Colocar',
    'putaway.sub': 'Elige el destino o escanea su etiqueta; después escanea o busca máquinas y artículos. Se mueven allí al momento.',
    'putaway.noAccess': 'Solo responsables de almacén y administradores pueden colocar.',
    'putaway.target': 'Destino', 'putaway.targetNone': 'Todavía no hay destino.',
    'putaway.choose': '– elegir lugar –', 'putaway.scanTarget': 'Escanear destino', 'putaway.scanItems': 'Escanear objetos',
    'putaway.scanTargetHint': 'Escanea la etiqueta de una estantería, armario, caja o espacio.',
    'putaway.scanItemsHint': 'Escanea las etiquetas de máquinas y artículos una tras otra. Una etiqueta de lugar cambia el destino.',
    'putaway.search': 'Buscar máquina o artículo (nombre o código)…', 'putaway.here': 'Aquí',
    'putaway.moved': '{name} → {to}', 'putaway.already': '{name} ya está aquí.',
    'putaway.notFound': 'Código {code} no encontrado.', 'putaway.targetSet': 'Destino: {name}',
    'putaway.needTarget': 'Elige primero un destino.', 'putaway.done': 'Movidos en esta sesión ({n})',
    'putaway.undo': 'Deshacer', 'putaway.isHere': 'Ya está aquí', 'putaway.wasUndone': 'Deshecho', 'putaway.undone': '{name} de vuelta a {to}',
    'putaway.machine': 'Máquina', 'putaway.article': 'Artículo', 'putaway.from': 'de {from}',
    'putaway.open': 'Abrir destino',
  },
});

const enc = encodeURIComponent;
const loadingHtml = () => `<div class="page"><p class="muted" role="status">${esc(t('common.loading'))}</p></div>`;
const norm = (s) => clean(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
function showError(ctx, err) {
  ctx.el.innerHTML = `<div class="page"><div class="alert danger" role="alert">${icon('alert')}<span>${esc(errorText(err))}</span></div></div>`;
}
const UNCOUNTED_RE = /Menge noch nicht gezählt/;
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

// ---------------------------------------------------------------------------
// Verbrauchsmaterial
// ---------------------------------------------------------------------------
function stockState(a) {
  const s = num(a.stock), min = num(a.min_stock);
  if (s <= 0 && UNCOUNTED_RE.test(a.notes || '')) return 'uncounted';
  if (s <= 0) return 'empty';
  if (s <= min) return 'refill';
  if (s <= min * 1.25) return 'low';
  return 'ok';
}
const STATE_PILL = { ok: 'pill-ok', low: 'pill-info', refill: 'pill-warn', empty: 'pill-danger', uncounted: 'pill-muted' };
const STATE_LABEL = { ok: 'stock.ok', low: 'stock.low', refill: 'stock.refill', empty: 'stock.empty', uncounted: 'stock.uncounted' };
const uiStock = { q: '', filter: 'all' };

async function stockView(ctx) {
  const { api } = ctx;
  ctx.setTitle(t('stock.title'));
  ctx.el.innerHTML = loadingHtml();
  let arts, shop, cons;
  try {
    [arts, shop, cons] = await Promise.all([api.listArticles({}),
      api.listShopping({ status: 'open' }).catch(() => []), api.listConsumption().catch(() => [])]);
  } catch (err) { showError(ctx, err); return; }
  const listed = new Set((shop || []).filter((x) => x.article_id).map((x) => x.article_id));
  const consMap = consumptionMap(cons);
  let rows = (arts || []).filter((a) => !a.archived && a.min_stock !== null && a.min_stock !== undefined && a.min_stock !== '');
  const groupOf = (a) => clean(String(a.category_path || a.category || '').split('›')[0]) || t('stock.group.other');

  ctx.el.innerHTML = `<div class="page stock">
    <div class="page-head">
      <div><h1>${esc(t('stock.title'))}</h1><div class="sub">${esc(t('stock.sub'))}</div></div>
      <div class="actions"><a class="btn" href="#/einkauf">${icon('cart')}${esc(t('stock.openList'))}</a>
        <a class="btn" href="#/artikel">${icon('box')}${esc(t('stock.openArticles'))}</a></div>
    </div>
    <div class="card stack" style="gap:10px">
      <label class="searchbar">${icon('search')}<input type="search" data-q aria-label="${esc(t('stock.search'))}" placeholder="${esc(t('stock.search'))}" value="${esc(uiStock.q)}" autocomplete="off"></label>
      <div class="chips" role="group" aria-label="${esc(t('stock.title'))}">
        ${['all', 'refill', 'uncounted'].map((f) => `<button type="button" class="chip" data-f="${f}" aria-pressed="${uiStock.filter === f}">${esc(t('stock.f.' + f))}</button>`).join('')}
      </div>
      <div class="small muted" data-sum aria-live="polite"></div>
    </div>
    <div data-list></div>
  </div>`;
  const root = ctx.el.firstElementChild;
  const listEl = root.querySelector('[data-list]');
  const sumEl = root.querySelector('[data-sum]');

  const render = () => {
    const words = norm(uiStock.q).split(' ').filter(Boolean);
    const shown = rows.filter((a) => {
      const st = stockState(a);
      if (uiStock.filter === 'refill' && !(st === 'refill' || st === 'empty')) return false;
      if (uiStock.filter === 'uncounted' && st !== 'uncounted') return false;
      if (!words.length) return true;
      const h = norm([a.name, a.code, a.location_path, a.category_path, a.brand].join(' '));
      return words.every((w) => h.includes(w));
    });
    const refill = rows.filter((a) => ['refill', 'empty'].includes(stockState(a))).length;
    const unc = rows.filter((a) => stockState(a) === 'uncounted').length;
    sumEl.textContent = t('stock.summary', { n: fmtNum(rows.length), refill: fmtNum(refill), unc: fmtNum(unc),
      listed: fmtNum(rows.filter((a) => listed.has(a.id)).length) });
    if (!rows.length) { listEl.innerHTML = emptyHtml(t('stock.none')); return; }
    if (!shown.length) { listEl.innerHTML = emptyHtml(t('stock.noneFound')); return; }
    const groups = new Map();
    for (const a of shown.sort((x, y) => String(x.name).localeCompare(String(y.name), 'de'))) {
      const g = groupOf(a);
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(a);
    }
    listEl.innerHTML = [...groups].sort((x, y) => x[0].localeCompare(y[0], 'de')).map(([g, list]) => `
      <section class="section"><h2>${esc(g)} (${fmtNum(list.length)})</h2>
        <ul class="list stock-list">${list.map((a) => {
          const st = stockState(a);
          const unit = unitLabel(a.unit || 'Stk');
          return `<li class="list-item stock-row st-${st}" data-id="${esc(a.id)}">
            ${thumbHtml(a.photo_path, '', 'thumb', 'box')}
            <a class="li-main" href="#/a/${enc(a.code)}">
              <span class="li-title">${esc(a.name)}</span>
              <span class="li-sub">${esc([a.code, a.location_path].filter(Boolean).join(' · '))}</span>
              <span class="li-sub">${esc([t('stock.min', { qty: fmtQty(a.min_stock, a.unit) }),
                st === 'uncounted' ? '' : coverText(coverDays(a, consMap.get(a.id)))].filter(Boolean).join(' · '))}</span>
              ${listed.has(a.id) ? `<span class="li-sub"><span class="pill pill-info">${icon('cart')}${esc(t('stock.onList'))}</span></span>` : ''}
            </a>
            <div class="li-end stock-end">
              <span class="stock-qty">${esc(st === 'uncounted' ? '?' : fmtQty(a.stock, a.unit))}</span>
              <span class="pill ${STATE_PILL[st]}">${esc(t(STATE_LABEL[st]))}</span>
              <div class="row stock-btns">
                <button type="button" class="btn sm" data-take aria-label="${esc(t('stock.takeAria', { unit, name: a.name }))}"${num(a.stock) <= 0 ? ' disabled' : ''}>${esc(t('stock.take'))}</button>
                <button type="button" class="btn sm" data-add aria-label="${esc(t('stock.addAria', { name: a.name }))}">${icon('plus')}${esc(t('stock.add'))}</button>
                ${!listed.has(a.id) && ['refill', 'empty', 'low'].includes(st) ? `<button type="button" class="btn sm" data-tolist aria-label="${esc(t('stock.toListAria', { name: a.name }))}">${icon('cart')}${esc(t('stock.toList'))}</button>` : ''}
              </div>
            </div>
          </li>`;
        }).join('')}</ul></section>`).join('');
    hydrateThumbs(listEl, ctx.api);
  };

  const replace = (row) => { rows = rows.map((a) => (a.id === row.id ? { ...a, ...row } : a)); };
  const reloadOne = async (id) => {
    try { const fresh = await ctx.api.getArticle(id); if (fresh) replace(fresh); } catch (e) { /* Liste bleibt */ }
    try {
      const open = await ctx.api.listShopping({ status: 'open' });
      listed.clear();
      (open || []).forEach((x) => { if (x.article_id) listed.add(x.article_id); });
    } catch (e) { /* Liste bleibt */ }
  };
  listEl.addEventListener('click', async (e) => {
    const li = e.target.closest('[data-id]');
    if (!li) return;
    const a = rows.find((x) => x.id === li.dataset.id);
    if (!a) return;
    if (e.target.closest('[data-tolist]')) {
      const b = e.target.closest('[data-tolist]');
      b.disabled = true;
      try {
        await ctx.api.saveShoppingItem({ article_id: a.id, qty: suggestQty(a) });
        listed.add(a.id);
        toast(t('stock.listed', { name: a.name }));
        render();
      } catch (err) {
        if (err && err.code === 'already_on_list') { listed.add(a.id); render(); }
        toast(errorText(err), 'error'); b.disabled = false;
      }
      return;
    }
    if (e.target.closest('[data-take]')) {
      const b = e.target.closest('[data-take]');
      if (num(a.stock) <= 0) { toast(t('stock.noStock'), 'error'); return; }
      b.disabled = true;
      try {
        await ctx.api.moveStock(a.id, { type: 'entnahme', qty: 1, requestId: uuid() });
        await reloadOne(a.id);
        const now = rows.find((x) => x.id === a.id);
        toast(t('stock.taken', { name: a.name, qty: fmtQty(now ? now.stock : num(a.stock) - 1, a.unit) }));
        render();
        const again = listEl.querySelector(`[data-id="${CSS.escape(a.id)}"] [data-take]`);
        if (again && !again.disabled) again.focus();
      } catch (err) { toast(errorText(err), 'error'); b.disabled = false; }
      return;
    }
    if (e.target.closest('[data-add]')) {
      const unit = unitLabel(a.unit || 'Stk');
      const res = await sheet({
        title: t('stock.addTitle', { name: a.name }),
        body: `<div class="form">
          <div class="field"><label for="sa-qty">${esc(t('stock.addQty', { unit }))}</label>
            <input id="sa-qty" type="text" inputmode="decimal" autocomplete="off" value="1"></div>
          <div class="field full"><label for="sa-note">${esc(t('stock.addNote'))}</label>
            <input id="sa-note" type="text" maxlength="200" autocomplete="off"></div>
        </div>`,
        actions: [
          { label: t('btn.cancel'), kind: 'ghost', value: null },
          { label: t('stock.addBtn'), kind: 'primary', icon: 'plus', onClick: async (el) => {
            const q = numOrNull(el.querySelector('#sa-qty').value);
            if (q === null || !(q > 0)) { const f = el.querySelector('#sa-qty'); f.setAttribute('aria-invalid', 'true'); f.focus(); throw Object.assign(new Error(t('err.invalid_qty')), { code: 'invalid_qty' }); }
            await ctx.api.moveStock(a.id, { type: 'zugang', qty: q, requestId: uuid(), note: clean(el.querySelector('#sa-note').value) || null });
            return q;
          } },
        ],
      });
      if (typeof res === 'number') {
        await reloadOne(a.id);
        const now = rows.find((x) => x.id === a.id);
        toast(t('stock.added', { name: a.name, qty: fmtQty(res, a.unit), now: fmtQty(now ? now.stock : res, a.unit) }));
        render();
      }
    }
  });
  root.querySelector('[data-q]').addEventListener('input', debounce((e) => { uiStock.q = e.target.value; render(); }, 150));
  root.querySelectorAll('[data-f]').forEach((b) => b.addEventListener('click', () => {
    uiStock.filter = b.dataset.f;
    root.querySelectorAll('[data-f]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.f === uiStock.filter)));
    render();
  }));
  render();
}

// ---------------------------------------------------------------------------
// Einräumen / Umlagern per QR
// ---------------------------------------------------------------------------
async function putawayView(ctx) {
  const { api, user } = ctx;
  ctx.setTitle(t('putaway.title'));
  if (!can(user, 'staff')) {
    ctx.el.innerHTML = `<div class="page">${emptyHtml(t('putaway.noAccess'))}</div>`;
    return;
  }
  ctx.el.innerHTML = loadingHtml();
  let locs, arts, machs;
  try {
    [locs, arts, machs] = await Promise.all([api.listLocations(), api.listArticles({}), api.listMachines({})]);
  } catch (err) { showError(ctx, err); return; }
  locs = (locs || []).filter((l) => !l.archived);
  arts = (arts || []).filter((a) => !a.archived);
  machs = (machs || []).filter((m) => !m.archived);
  const byId = new Map(locs.map((l) => [l.id, l]));
  const byCode = new Map(locs.map((l) => [String(l.code).toUpperCase(), l]));
  const label = (l) => (l ? [l.code_path || l.code, l.name].filter(Boolean).join(' · ') : '–');
  const pathOf = (l) => (l ? (l.path || l.name) : '–');
  const q = ctx.query;
  const initial = q && typeof q.get === 'function' ? q.get('ziel') : null;
  let target = initial ? byCode.get(String(initial).toUpperCase()) || null : null;
  const moved = [];   // { kind, id, name, from, to }

  const options = [...locs].sort((a, b) => String(a.path || a.name).localeCompare(String(b.path || b.name), 'de'))
    .map((l) => `<option value="${esc(l.id)}">${esc((l.code_path ? l.code_path + ' · ' : '') + (l.path || l.name))}</option>`).join('');
  ctx.el.innerHTML = `<div class="page putaway">
    <div class="page-head"><div><h1>${esc(t('putaway.title'))}</h1><div class="sub">${esc(t('putaway.sub'))}</div></div></div>
    <section class="card stack" style="gap:10px" aria-labelledby="pa-t">
      <h2 id="pa-t" style="margin:0;font-size:1rem">${esc(t('putaway.target'))}</h2>
      <div data-target aria-live="polite"></div>
      <div class="row" style="flex-wrap:wrap;gap:8px">
        <label class="sr-only" for="pa-sel">${esc(t('putaway.target'))}</label>
        <select id="pa-sel" style="flex:1;min-width:220px"><option value="">${esc(t('putaway.choose'))}</option>${options}</select>
        <button type="button" class="btn" data-scan-target>${icon('scan')}${esc(t('putaway.scanTarget'))}</button>
      </div>
    </section>
    <section class="card stack" style="gap:10px">
      <button type="button" class="btn primary block" data-scan-items>${icon('scan')}${esc(t('putaway.scanItems'))}</button>
      <label class="searchbar">${icon('search')}<input type="search" data-find aria-label="${esc(t('putaway.search'))}" placeholder="${esc(t('putaway.search'))}" autocomplete="off"></label>
      <ul class="list" data-results></ul>
    </section>
    <section class="section"><h2 data-done-h>${esc(t('putaway.done', { n: 0 }))}</h2><ul class="list" data-done></ul></section>
  </div>`;
  const root = ctx.el.firstElementChild;
  const sel = root.querySelector('#pa-sel');
  const tgtEl = root.querySelector('[data-target]');
  const resEl = root.querySelector('[data-results]');
  const doneEl = root.querySelector('[data-done]');
  const doneH = root.querySelector('[data-done-h]');

  const renderTarget = () => {
    sel.value = target ? target.id : '';
    tgtEl.innerHTML = target
      ? `<div class="list-item" style="padding:8px 0">${icon('location')}<div class="li-main"><span class="li-title">${esc(target.name)}</span>
          <span class="li-sub mono">${esc(target.code_path || target.code)}</span><span class="li-sub">${esc(pathOf(target))}</span></div>
          <div class="li-end"><a class="btn sm" href="#/l/${enc(target.code)}">${esc(t('putaway.open'))}</a></div></div>`
      : `<p class="muted" style="margin:0">${esc(t('putaway.targetNone'))}</p>`;
  };
  const renderDone = () => {
    doneH.textContent = t('putaway.done', { n: moved.length });
    doneEl.innerHTML = moved.map((m, i) => `<li class="list-item">
      ${icon(m.kind === 'machine' ? 'machine' : 'box')}
      <div class="li-main"><span class="li-title">${esc(m.name)}</span>
        <span class="li-sub">${esc(t('putaway.moved', { name: t(m.kind === 'machine' ? 'putaway.machine' : 'putaway.article'), to: label(byId.get(m.to)) }))} · ${esc(t('putaway.from', { from: label(byId.get(m.from)) }))}</span></div>
      <div class="li-end">${m.undone ? `<span class="pill pill-muted">${esc(t('putaway.wasUndone'))}</span>` : `<button type="button" class="btn sm" data-undo="${i}">${esc(t('putaway.undo'))}</button>`}</div>
    </li>`).reverse().join('');
  };
  const setTarget = (l, announce) => {
    target = l;
    renderTarget();
    renderResults();
    if (announce && l) toast(t('putaway.targetSet', { name: label(l) }));
    try { history.replaceState(null, '', '#/einraeumen' + (l ? '?ziel=' + enc(l.code) : '')); } catch (e) { /* egal */ }
  };

  async function moveTo(kind, item, toId, { undo = false } = {}) {
    if (kind === 'machine') {
      await api.saveMachine({ id: item.id, home_location_id: toId });
      item.home_location_id = toId;
    } else {
      await api.moveStock(item.id, { type: 'umlagerung', qty: num(item.stock), requestId: uuid(), toLocationId: toId,
        note: undo ? t('putaway.undo') : t('putaway.title') });
      item.location_id = toId;
    }
  }
  async function place(kind, item) {
    if (!target) { toast(t('putaway.needTarget'), 'error'); sel.focus(); return false; }
    const from = kind === 'machine' ? item.home_location_id : item.location_id;
    if (from === target.id) { toast(t('putaway.already', { name: item.name })); return false; }
    try {
      await moveTo(kind, item, target.id);
      moved.push({ kind, id: item.id, name: `${item.code} · ${item.name}`, from, to: target.id, item });
      renderDone();
      toast(t('putaway.moved', { name: item.name, to: label(target) }));
      return true;
    } catch (err) { toast(errorText(err), 'error'); return false; }
  }
  async function handleCode(code) {
    const c = String(code || '').toUpperCase();
    const loc = byCode.get(c);
    if (loc) { setTarget(loc, true); return; }
    const m = machs.find((x) => String(x.code).toUpperCase() === c);
    if (m) { await place('machine', m); return; }
    const a = arts.find((x) => String(x.code).toUpperCase() === c);
    if (a) { await place('article', a); return; }
    toast(t('putaway.notFound', { code: c }), 'error');
  }
  async function openScan(forTarget) {
    let mod;
    try { mod = await import('../scanner.js'); } catch (err) { toast(t('err.camera'), 'error'); return; }
    mod.openScanner({
      title: t(forTarget ? 'putaway.scanTarget' : 'putaway.scanItems'),
      hint: t(forTarget ? 'putaway.scanTargetHint' : 'putaway.scanItemsHint'),
      continuous: !forTarget,
      onCode: (code) => {
        if (forTarget) {
          const l = byCode.get(String(code).toUpperCase());
          if (l) setTarget(l, true); else toast(t('putaway.notFound', { code }), 'error');
          return;
        }
        return handleCode(code);
      },
    });
  }

  sel.addEventListener('change', () => setTarget(byId.get(sel.value) || null, false));
  root.querySelector('[data-scan-target]').addEventListener('click', () => openScan(true));
  root.querySelector('[data-scan-items]').addEventListener('click', () => { if (!target) { toast(t('putaway.needTarget'), 'error'); sel.focus(); return; } openScan(false); });
  const findInp = root.querySelector('[data-find]');
  const pool = () => [...machs.map((m) => ({ kind: 'machine', item: m })), ...arts.map((a) => ({ kind: 'article', item: a }))];
  const renderResults = () => {
    const words = norm(findInp.value).split(' ').filter(Boolean);
    if (!words.length) { resEl.innerHTML = ''; return; }
    const hits = pool().filter(({ item }) => {
      const h = norm([item.code, item.name, item.brand, item.model].join(' '));
      return words.every((w) => h.includes(w));
    }).slice(0, 25);
    resEl.innerHTML = hits.length ? hits.map(({ kind, item }) => {
      const whereId = kind === 'machine' ? item.home_location_id : item.location_id;
      const where = byId.get(whereId);
      const isHere = !!target && whereId === target.id;
      return `<li class="list-item">${icon(kind === 'machine' ? 'machine' : 'box')}
        <div class="li-main"><span class="li-title">${esc(item.name)}</span><span class="li-sub">${esc(item.code)} · ${esc(label(where))}</span></div>
        <div class="li-end">${isHere ? `<span class="pill pill-ok">${esc(t('putaway.isHere'))}</span>`
          : `<button type="button" class="btn sm primary" data-place="${esc(kind)}:${esc(item.id)}">${icon('arrowIn')}${esc(t('putaway.here'))}</button>`}</div></li>`;
    }).join('') : `<li class="muted small">${esc(t('stock.noneFound'))}</li>`;
  };
  findInp.addEventListener('input', debounce(renderResults, 150));
  resEl.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-place]');
    if (!b) return;
    const [kind, id] = b.dataset.place.split(':');
    const item = (kind === 'machine' ? machs : arts).find((x) => x.id === id);
    if (!item) return;
    b.disabled = true;
    if (await place(kind, item)) renderResults(); else b.disabled = false;
  });
  doneEl.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-undo]');
    if (!b) return;
    const m = moved[Number(b.dataset.undo)];
    if (!m || m.undone || !m.from) return;
    b.disabled = true;
    try {
      await moveTo(m.kind, m.item, m.from, { undo: true });
      m.undone = true;
      renderDone();
      renderResults();
      toast(t('putaway.undone', { name: m.item.name, to: label(byId.get(m.from)) }));
    } catch (err) { toast(errorText(err), 'error'); b.disabled = false; }
  });
  renderTarget();
  renderDone();
}

export const routes = {
  'verbrauch': (ctx) => stockView(ctx),
  'einraeumen': (ctx) => putawayView(ctx),
};
