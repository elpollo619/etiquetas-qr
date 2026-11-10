// Einkaufsliste ('einkauf'): was gekauft werden muss – gemeinsam für alle aktiven Mitarbeiter.
//   • Verbrauchsmaterial (Artikel mit Mindestbestand) kommt automatisch dazu, sobald eine Entnahme es auf/unter den
//     Mindestbestand bringt (Datenbank-Trigger); ein Zugang darüber hakt es ab.
//   • «Vorschläge»: Artikel unter dem Mindestbestand, die (noch) nicht auf der Liste stehen – einzeln oder alle übernehmen.
//   • Gekauft → bei Artikeln gleich als Zugang einbuchen. «Bestellt» merkt, dass jemand es schon besorgt.
//   • Bewusst KEIN Bestellmodul: keine Lieferanten, Preise, Bestellungen oder Rechnungen.
import { t, registerStrings, fmtQty, fmtNum, fmtDate, unitLabel } from '../i18n.js';
import { esc, clean, uuid, toast, sheet, errorText, emptyHtml, thumbHtml, hydrateThumbs, icon, debounce, numOrNull, itemThumbHtml } from '../util.js';
import { consumptionMap, coverDays, coverText, suggestQty } from '../consumption.js';

registerStrings({
  de: {
    'shop.title': 'Einkaufsliste',
    'shop.sub': 'Was gekauft werden muss. Verbrauchsmaterial unter dem Mindestbestand kommt automatisch dazu.',
    'shop.add': 'Hinzufügen', 'shop.what': 'Was fehlt?', 'shop.whatPh': 'z. B. Papier A4, Kaffee, Toner …',
    'shop.qty': 'Menge', 'shop.unit': 'Einheit', 'shop.note': 'Bemerkung (optional)', 'shop.name': 'Bezeichnung',
    'shop.open': 'Zu besorgen ({n})', 'shop.ordered': 'Bestellt – kommt noch ({n})',
    'shop.sugg': 'Vorschläge: unter dem Mindestbestand ({n})',
    'shop.suggSub': 'Diese Artikel haben ihren Mindestbestand erreicht, stehen aber noch nicht auf der Liste.',
    'shop.takeAll': 'Alle übernehmen', 'shop.take': 'Übernehmen',
    'shop.done': 'Zuletzt besorgt', 'shop.again': 'Nochmals',
    'shop.empty': 'Nichts zu besorgen. 🎉', 'shop.noneDone': 'Noch nichts besorgt.',
    'shop.bought': 'Gekauft', 'shop.arrived': 'Angekommen', 'shop.markOrdered': 'Bestellt', 'shop.backToOpen': 'Doch nicht bestellt',
    'shop.more': 'Mehr zu {name}', 'shop.edit': 'Eintrag bearbeiten', 'shop.remove': 'Von der Liste nehmen',
    'shop.auto': 'automatisch', 'shop.shopLink': 'Shop',
    'shop.stockLine': 'Bestand {stock} · Mindestens {min}',
    'shop.by': 'eingetragen von {name}, {date}', 'shop.byAuto': 'automatisch, {date}',
    'shop.orderedBy': 'bestellt von {name}, {date}', 'shop.doneBy': 'besorgt von {name}, {date}',
    'shop.dropped': 'verworfen von {name}, {date}',
    'shop.added': '«{name}» steht auf der Liste.', 'shop.addedN': '{n} Einträge übernommen.',
    'shop.checked': '«{name}» abgehakt.', 'shop.booked': '«{name}» abgehakt – {qty} eingebucht, Bestand jetzt {now}.',
    'shop.orderedToast': '«{name}» als bestellt markiert.', 'shop.removed': '«{name}» von der Liste genommen.',
    'shop.boughtTitle': 'Gekauft: {name}', 'shop.bookIn': 'Gleich im Lager einbuchen (Zugang)',
    'shop.bookQty': 'Menge einbuchen ({unit})', 'shop.bookHint': 'Lagerort: {loc}', 'shop.doneBtn': 'Abhaken',
    'shop.share': 'Liste teilen', 'shop.shareTitle': 'Einkaufsliste {date}', 'shop.copied': 'Liste kopiert.',
    'shop.copyHere': 'Text markieren und kopieren:',
    'shop.matches': 'Passende Artikel – antippen zum Hinzufügen',
    'shop.uncounted': '{n} Verbrauchsmaterialien sind noch nicht gezählt und können deshalb noch nicht nachbestellt werden.',
    'shop.countNow': 'Jetzt zählen',
    'shop.archived': 'Artikel archiviert', 'shop.isListed': 'Schon auf der Liste',
  },
  pt: {
    'shop.title': 'Lista de compras',
    'shop.sub': 'O que é preciso comprar. Consumíveis abaixo do stock mínimo entram automaticamente.',
    'shop.add': 'Adicionar', 'shop.what': 'O que falta?', 'shop.whatPh': 'p. ex. papel A4, café, toner …',
    'shop.qty': 'Quantidade', 'shop.unit': 'Unidade', 'shop.note': 'Observação (opcional)', 'shop.name': 'Designação',
    'shop.open': 'Para comprar ({n})', 'shop.ordered': 'Encomendado – a caminho ({n})',
    'shop.sugg': 'Sugestões: abaixo do stock mínimo ({n})',
    'shop.suggSub': 'Estes artigos atingiram o stock mínimo, mas ainda não estão na lista.',
    'shop.takeAll': 'Adicionar todos', 'shop.take': 'Adicionar',
    'shop.done': 'Comprado recentemente', 'shop.again': 'Outra vez',
    'shop.empty': 'Nada para comprar. 🎉', 'shop.noneDone': 'Ainda nada comprado.',
    'shop.bought': 'Comprado', 'shop.arrived': 'Chegou', 'shop.markOrdered': 'Encomendado', 'shop.backToOpen': 'Afinal não encomendado',
    'shop.more': 'Mais sobre {name}', 'shop.edit': 'Editar entrada', 'shop.remove': 'Tirar da lista',
    'shop.auto': 'automático', 'shop.shopLink': 'Loja',
    'shop.stockLine': 'Stock {stock} · Mínimo {min}',
    'shop.by': 'adicionado por {name}, {date}', 'shop.byAuto': 'automático, {date}',
    'shop.orderedBy': 'encomendado por {name}, {date}', 'shop.doneBy': 'comprado por {name}, {date}',
    'shop.dropped': 'descartado por {name}, {date}',
    'shop.added': '«{name}» está na lista.', 'shop.addedN': '{n} entradas adicionadas.',
    'shop.checked': '«{name}» riscado.', 'shop.booked': '«{name}» riscado – {qty} lançado, stock agora {now}.',
    'shop.orderedToast': '«{name}» marcado como encomendado.', 'shop.removed': '«{name}» tirado da lista.',
    'shop.boughtTitle': 'Comprado: {name}', 'shop.bookIn': 'Lançar já no armazém (entrada)',
    'shop.bookQty': 'Quantidade a lançar ({unit})', 'shop.bookHint': 'Local: {loc}', 'shop.doneBtn': 'Riscar',
    'shop.share': 'Partilhar lista', 'shop.shareTitle': 'Lista de compras {date}', 'shop.copied': 'Lista copiada.',
    'shop.copyHere': 'Selecione e copie o texto:',
    'shop.matches': 'Artigos correspondentes – toque para adicionar',
    'shop.uncounted': '{n} consumíveis ainda não foram contados e por isso ainda não podem ser repostos.',
    'shop.countNow': 'Contar agora',
    'shop.archived': 'Artigo arquivado', 'shop.isListed': 'Já está na lista',
  },
  es: {
    'shop.title': 'Lista de compras',
    'shop.sub': 'Lo que hay que comprar. Los consumibles bajo el stock mínimo se añaden solos.',
    'shop.add': 'Añadir', 'shop.what': '¿Qué falta?', 'shop.whatPh': 'p. ej. papel A4, café, tóner …',
    'shop.qty': 'Cantidad', 'shop.unit': 'Unidad', 'shop.note': 'Nota (opcional)', 'shop.name': 'Nombre',
    'shop.open': 'Por comprar ({n})', 'shop.ordered': 'Pedido – en camino ({n})',
    'shop.sugg': 'Sugerencias: bajo el stock mínimo ({n})',
    'shop.suggSub': 'Estos artículos llegaron a su stock mínimo, pero aún no están en la lista.',
    'shop.takeAll': 'Añadir todos', 'shop.take': 'Añadir',
    'shop.done': 'Comprado hace poco', 'shop.again': 'Otra vez',
    'shop.empty': 'Nada que comprar. 🎉', 'shop.noneDone': 'Aún no se ha comprado nada.',
    'shop.bought': 'Comprado', 'shop.arrived': 'Llegó', 'shop.markOrdered': 'Pedido', 'shop.backToOpen': 'Al final no pedido',
    'shop.more': 'Más sobre {name}', 'shop.edit': 'Editar entrada', 'shop.remove': 'Quitar de la lista',
    'shop.auto': 'automático', 'shop.shopLink': 'Tienda',
    'shop.stockLine': 'Stock {stock} · Mínimo {min}',
    'shop.by': 'añadido por {name}, {date}', 'shop.byAuto': 'automático, {date}',
    'shop.orderedBy': 'pedido por {name}, {date}', 'shop.doneBy': 'comprado por {name}, {date}',
    'shop.dropped': 'descartado por {name}, {date}',
    'shop.added': '«{name}» está en la lista.', 'shop.addedN': '{n} entradas añadidas.',
    'shop.checked': '«{name}» tachado.', 'shop.booked': '«{name}» tachado – {qty} registrado, stock ahora {now}.',
    'shop.orderedToast': '«{name}» marcado como pedido.', 'shop.removed': '«{name}» quitado de la lista.',
    'shop.boughtTitle': 'Comprado: {name}', 'shop.bookIn': 'Registrar ya en el almacén (entrada)',
    'shop.bookQty': 'Cantidad a registrar ({unit})', 'shop.bookHint': 'Lugar: {loc}', 'shop.doneBtn': 'Tachar',
    'shop.share': 'Compartir lista', 'shop.shareTitle': 'Lista de compras {date}', 'shop.copied': 'Lista copiada.',
    'shop.copyHere': 'Selecciona y copia el texto:',
    'shop.matches': 'Artículos que coinciden – toca para añadir',
    'shop.uncounted': '{n} consumibles aún no se han contado y por eso todavía no se pueden reponer.',
    'shop.countNow': 'Contar ahora',
    'shop.archived': 'Artículo archivado', 'shop.isListed': 'Ya está en la lista',
  },
});

const enc = encodeURIComponent;
const norm = (s) => clean(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const hasNum = (v) => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));
const UNCOUNTED_RE = /Menge noch nicht gezählt/;
const UNITS = ['Stk', 'Pkg', 'Rolle', 'Karton', 'kg', 'l', 'm', 'Set', 'Paar'];

const isUncounted = (a) => num(a.stock) <= 0 && UNCOUNTED_RE.test(a.notes || '');
const qtyText = (it) => (hasNum(it.qty) ? fmtQty(it.qty, it.unit || '') : '');

async function shoppingView(ctx) {
  const { api } = ctx;
  ctx.setTitle(t('shop.title'));
  ctx.el.innerHTML = `<div class="page"><p class="muted" role="status">${esc(t('common.loading'))}</p></div>`;
  let open, done, arts, cons;
  try {
    [open, done, arts, cons] = await Promise.all([
      api.listShopping({ status: 'open' }), api.listShopping({ status: 'done' }),
      api.listArticles({}), api.listConsumption().catch(() => []),
    ]);
  } catch (err) {
    ctx.el.innerHTML = `<div class="page"><div class="alert danger" role="alert">${icon('alert')}<span>${esc(errorText(err))}</span></div></div>`;
    return;
  }
  arts = (arts || []).filter((a) => !a.archived);
  const artById = new Map(arts.map((a) => [a.id, a]));
  let consMap = consumptionMap(cons);

  ctx.el.innerHTML = `<div class="page shop">
    <div class="page-head">
      <div><h1>${esc(t('shop.title'))}</h1><div class="sub">${esc(t('shop.sub'))}</div></div>
      <div class="actions"><button type="button" class="btn" data-share>${icon('arrowOut')}${esc(t('shop.share'))}</button></div>
    </div>
    <form class="card stack shop-add" data-add style="gap:10px" autocomplete="off">
      <div class="shop-add-row">
        <div class="field" style="flex:1;min-width:180px;margin:0"><label for="sh-name">${esc(t('shop.what'))}</label>
          <input id="sh-name" name="name" type="text" maxlength="200" placeholder="${esc(t('shop.whatPh'))}" aria-describedby="sh-match-h"></div>
        <div class="field" style="width:96px;margin:0"><label for="sh-qty">${esc(t('shop.qty'))}</label>
          <input id="sh-qty" name="qty" type="text" inputmode="decimal" maxlength="12"></div>
        <div class="field" style="width:110px;margin:0"><label for="sh-unit">${esc(t('shop.unit'))}</label>
          <input id="sh-unit" name="unit" type="text" maxlength="20" list="sh-units"></div>
        <button type="submit" class="btn primary" style="align-self:flex-end">${icon('plus')}${esc(t('shop.add'))}</button>
      </div>
      <datalist id="sh-units">${UNITS.map((u) => `<option value="${esc(unitLabel(u))}"></option>`).join('')}</datalist>
      <div data-match hidden><div class="small muted" id="sh-match-h">${esc(t('shop.matches'))}</div><ul class="list" data-match-list></ul></div>
    </form>
    <section class="section"><h2 data-open-h></h2><ul class="list shop-list" data-open></ul></section>
    <section class="section" data-ordered-sec hidden><h2 data-ordered-h></h2><ul class="list shop-list" data-ordered></ul></section>
    <section class="section" data-sugg-sec hidden>
      <div class="row" style="justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
        <h2 data-sugg-h style="margin:0"></h2>
        <button type="button" class="btn sm" data-take-all>${icon('plus')}${esc(t('shop.takeAll'))}</button>
      </div>
      <p class="small muted">${esc(t('shop.suggSub'))}</p>
      <ul class="list shop-list" data-sugg></ul>
    </section>
    <div data-uncounted></div>
    <details class="section" data-done-sec><summary><h2 style="display:inline">${esc(t('shop.done'))}</h2></summary>
      <ul class="list shop-list" data-done></ul></details>
  </div>`;
  const root = ctx.el.firstElementChild;
  const $ = (s) => root.querySelector(s);
  const form = $('[data-add]');
  const nameInp = $('#sh-name'), qtyInp = $('#sh-qty'), unitInp = $('#sh-unit');

  const onList = () => new Set(open.filter((x) => x.article_id).map((x) => x.article_id));
  const suggestions = () => {
    const listed = onList();
    return arts.filter((a) => hasNum(a.min_stock) && num(a.stock) <= num(a.min_stock) && !isUncounted(a) && !listed.has(a.id))
      .sort((x, y) => String(x.name).localeCompare(String(y.name), 'de'));
  };

  const metaLines = (it) => {
    const lines = [];
    const a = it.article_id ? artById.get(it.article_id) : null;
    if (it.article_id) {
      const bits = [it.article_code, it.article_location_path].filter(Boolean);
      if (bits.length) lines.push(esc(bits.join(' · ')));
      if (it.article_archived) lines.push(`<span class="pill pill-muted">${esc(t('shop.archived'))}</span>`);
      else if (hasNum(it.article_stock)) {
        const st = t('shop.stockLine', { stock: fmtQty(it.article_stock, it.article_unit), min: hasNum(it.article_min_stock) ? fmtQty(it.article_min_stock, it.article_unit) : '–' });
        const cv = a ? coverText(coverDays(a, consMap.get(a.id))) : '';
        lines.push(esc(st + (cv ? ' · ' + cv : '')));
      }
    }
    if (it.note) lines.push(`<em>${esc(it.note)}</em>`);
    const who = [];
    who.push(it.source === 'automatisch' && !it.created_by_name ? t('shop.byAuto', { date: fmtDate(it.created_at) })
      : t('shop.by', { name: it.created_by_name || '–', date: fmtDate(it.created_at) }));
    if (it.status === 'bestellt' && it.ordered_at) who.push(t('shop.orderedBy', { name: it.ordered_by_name || '–', date: fmtDate(it.ordered_at) }));
    if (it.status === 'erledigt' && it.done_at) who.push(t('shop.doneBy', { name: it.done_by_name || '–', date: fmtDate(it.done_at) }));
    if (it.status === 'verworfen' && it.done_at) who.push(t('shop.dropped', { name: it.done_by_name || '–', date: fmtDate(it.done_at) }));
    lines.push(`<span class="muted">${esc(who.join(' · '))}</span>`);
    return lines.map((l) => `<span class="li-sub">${l}</span>`).join('');
  };
  const titleHtml = (it) => {
    const name = it.article_code
      ? `<a href="#/a/${enc(it.article_code)}">${esc(it.name)}</a>` : esc(it.name);
    const q = qtyText(it);
    return `<span class="li-title">${name}${q ? ` <span class="shop-qty">${esc(q)}</span>` : ''}
      ${it.source === 'automatisch' ? ` <span class="pill pill-info">${esc(t('shop.auto'))}</span>` : ''}</span>`;
  };
  const shopLink = (it) => (it.article_product_url && /^https?:\/\//i.test(it.article_product_url)
    ? `<a class="btn sm" href="${esc(it.article_product_url)}" target="_blank" rel="noopener noreferrer">${icon('globe')}${esc(t('shop.shopLink'))}</a>` : '');
  const itemRow = (it) => `<li class="list-item shop-row st-${esc(it.status)}" data-id="${esc(it.id)}">
      ${thumbHtml(it.article_photo_path, '', 'thumb', 'box')}
      <div class="li-main">${titleHtml(it)}${metaLines(it)}</div>
      <div class="li-end shop-btns">
        <button type="button" class="btn sm primary" data-bought>${icon('check')}${esc(t(it.status === 'bestellt' ? 'shop.arrived' : 'shop.bought'))}</button>
        ${it.status === 'offen' ? `<button type="button" class="btn sm" data-mark-ordered>${icon('clock')}${esc(t('shop.markOrdered'))}</button>` : ''}
        ${shopLink(it)}
        <button type="button" class="icon-btn" data-more aria-label="${esc(t('shop.more', { name: it.name }))}">${icon('more')}</button>
      </div>
    </li>`;

  const render = () => {
    const offen = open.filter((x) => x.status === 'offen');
    const bestellt = open.filter((x) => x.status === 'bestellt');
    $('[data-open-h]').textContent = t('shop.open', { n: fmtNum(offen.length) });
    $('[data-open]').innerHTML = offen.length ? offen.map(itemRow).join('') : `<li>${emptyHtml(t('shop.empty'))}</li>`;
    $('[data-ordered-sec]').hidden = !bestellt.length;
    $('[data-ordered-h]').textContent = t('shop.ordered', { n: fmtNum(bestellt.length) });
    $('[data-ordered]').innerHTML = bestellt.map(itemRow).join('');
    const sugg = suggestions();
    $('[data-sugg-sec]').hidden = !sugg.length;
    $('[data-sugg-h]').textContent = t('shop.sugg', { n: fmtNum(sugg.length) });
    $('[data-sugg]').innerHTML = sugg.map((a) => {
      const cv = coverText(coverDays(a, consMap.get(a.id)));
      return `<li class="list-item" data-art="${esc(a.id)}">${itemThumbHtml(a, '', 'thumb', 'box')}
        <a class="li-main" href="#/a/${enc(a.code)}"><span class="li-title">${esc(a.name)}</span>
          <span class="li-sub">${esc([a.code, a.location_path].filter(Boolean).join(' · '))}</span>
          <span class="li-sub">${esc(t('shop.stockLine', { stock: fmtQty(a.stock, a.unit), min: fmtQty(a.min_stock, a.unit) }) + (cv ? ' · ' + cv : ''))}</span></a>
        <div class="li-end"><button type="button" class="btn sm" data-take>${icon('plus')}${esc(t('shop.take'))} · ${esc(fmtQty(suggestQty(a), a.unit))}</button></div></li>`;
    }).join('');
    const unc = arts.filter((a) => hasNum(a.min_stock) && isUncounted(a)).length;
    $('[data-uncounted]').innerHTML = unc ? `<div class="alert">${icon('clipboard')}<span>${esc(t('shop.uncounted', { n: fmtNum(unc) }))}
      <a href="#/verbrauch">${esc(t('shop.countNow'))}</a></span></div>` : '';
    $('[data-done]').innerHTML = done.length ? done.map((it) => `<li class="list-item shop-row st-${esc(it.status)}" data-id="${esc(it.id)}" data-done-row>
        ${thumbHtml(it.article_photo_path, '', 'thumb', 'box')}
        <div class="li-main">${titleHtml(it)}${metaLines(it)}</div>
        <div class="li-end"><button type="button" class="btn sm" data-again>${icon('plus')}${esc(t('shop.again'))}</button></div></li>`).join('')
      : `<li class="muted small">${esc(t('shop.noneDone'))}</li>`;
    hydrateThumbs(root, api);
  };

  const refresh = async () => {
    try {
      const [o, d, as, c] = await Promise.all([api.listShopping({ status: 'open' }), api.listShopping({ status: 'done' }),
        api.listArticles({}), api.listConsumption().catch(() => null)]);
      open = o || []; done = d || [];
      arts = (as || []).filter((a) => !a.archived);
      artById.clear(); arts.forEach((a) => artById.set(a.id, a));
      if (c) consMap = consumptionMap(c);
    } catch (err) { toast(errorText(err), 'error'); }
    render();
  };

  // ---- Hinzufügen (frei oder als Artikel) ----
  const matchBox = $('[data-match]'), matchList = $('[data-match-list]');
  const renderMatches = () => {
    const words = norm(nameInp.value).split(' ').filter(Boolean);
    if (!words.length || norm(nameInp.value).length < 2) { matchBox.hidden = true; matchList.innerHTML = ''; return; }
    const hits = arts.filter((a) => { const h = norm([a.name, a.code, a.brand, a.art_no].join(' ')); return words.every((w) => h.includes(w)); }).slice(0, 6);
    matchBox.hidden = !hits.length;
    const listed = onList();
    matchList.innerHTML = hits.map((a) => `<li class="list-item">${itemThumbHtml(a, '', 'thumb', 'box')}
      <div class="li-main"><span class="li-title">${esc(a.name)}</span><span class="li-sub">${esc([a.code, fmtQty(a.stock, a.unit), a.location_path].filter(Boolean).join(' · '))}</span></div>
      <div class="li-end">${listed.has(a.id) ? `<span class="pill pill-ok">${esc(t('shop.isListed'))}</span>`
        : `<button type="button" class="btn sm primary" data-pick="${esc(a.id)}">${icon('plus')}${esc(t('shop.add'))}</button>`}</div></li>`).join('');
    hydrateThumbs(matchList, api);
  };
  nameInp.addEventListener('input', debounce(renderMatches, 150));
  const readQty = () => {
    if (!clean(qtyInp.value)) return null;
    const q = numOrNull(qtyInp.value);
    if (q === null || !(q > 0)) { qtyInp.setAttribute('aria-invalid', 'true'); qtyInp.focus(); throw Object.assign(new Error('invalid_qty'), { code: 'invalid_qty' }); }
    return q;
  };
  const addItem = async (obj) => {
    const row = await api.saveShoppingItem(obj);
    toast(t('shop.added', { name: row ? row.name : obj.name }));
    form.reset(); qtyInp.removeAttribute('aria-invalid'); matchBox.hidden = true; matchList.innerHTML = '';
    await refresh();
    nameInp.focus();
  };
  matchList.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-pick]');
    if (!b) return;
    const a = artById.get(b.dataset.pick);
    if (!a) return;
    b.disabled = true;
    try {
      const q = readQty();
      await addItem({ article_id: a.id, qty: q ?? suggestQty(a), note: null });
    } catch (err) { toast(errorText(err), 'error'); b.disabled = false; }
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = clean(nameInp.value);
    if (!name) { nameInp.setAttribute('aria-invalid', 'true'); nameInp.focus(); toast(t('err.name_required'), 'error'); return; }
    nameInp.removeAttribute('aria-invalid');
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
      const q = readQty();
      // genau ein Artikel mit diesem Namen → als Artikel eintragen (dann wirkt «Gekauft → einbuchen»)
      const exact = arts.filter((a) => norm(a.name) === norm(name));
      if (exact.length === 1) await addItem({ article_id: exact[0].id, qty: q ?? suggestQty(exact[0]) });
      else await addItem({ name, qty: q, unit: clean(unitInp.value) || null });
    } catch (err) { toast(errorText(err), 'error'); }
    finally { btn.disabled = false; }
  });

  // ---- Aktionen auf Einträgen ----
  const findItem = (id) => open.find((x) => x.id === id) || done.find((x) => x.id === id);
  async function bought(it) {
    const a = it.article_id && !it.article_archived ? artById.get(it.article_id) : null;
    if (!a) {
      await api.setShoppingStatus(it.id, 'erledigt');
      toast(t('shop.checked', { name: it.name }));
      return;
    }
    const unit = unitLabel(a.unit || 'Stk');
    const res = await sheet({
      title: t('shop.boughtTitle', { name: it.name }),
      body: `<div class="form">
        <label class="check full" style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="sb-book" checked> ${esc(t('shop.bookIn'))}</label>
        <div class="field"><label for="sb-qty">${esc(t('shop.bookQty', { unit }))}</label>
          <input id="sb-qty" type="text" inputmode="decimal" autocomplete="off" value="${esc(hasNum(it.qty) ? String(it.qty) : '1')}"></div>
        ${a.location_path ? `<div class="small muted full">${esc(t('shop.bookHint', { loc: a.location_path }))}</div>` : ''}
      </div>`,
      actions: [
        { label: t('btn.cancel'), kind: 'ghost', value: null },
        { label: t('shop.doneBtn'), kind: 'primary', icon: 'check', onClick: async (el) => {
          const book = el.querySelector('#sb-book').checked;
          let q = null;
          if (book) {
            q = numOrNull(el.querySelector('#sb-qty').value);
            if (q === null || !(q > 0)) { const f = el.querySelector('#sb-qty'); f.setAttribute('aria-invalid', 'true'); f.focus(); throw Object.assign(new Error('invalid_qty'), { code: 'invalid_qty' }); }
            await api.moveStock(a.id, { type: 'zugang', qty: q, requestId: uuid(), note: t('shop.title') });
          }
          await api.setShoppingStatus(it.id, 'erledigt');
          return { q };
        } },
      ],
    });
    if (res && typeof res === 'object') {
      if (res.q) {
        let now = null;
        try { now = await api.getArticle(a.id); } catch (e) { /* egal */ }
        toast(t('shop.booked', { name: it.name, qty: fmtQty(res.q, a.unit), now: now ? fmtQty(now.stock, now.unit) : '–' }));
      } else toast(t('shop.checked', { name: it.name }));
    }
    return res;
  }
  async function editItem(it) {
    const free = !it.article_id;
    const res = await sheet({
      title: t('shop.edit'),
      body: `<div class="form">
        ${free ? `<div class="field full"><label for="se-name">${esc(t('shop.name'))}</label><input id="se-name" type="text" maxlength="200" value="${esc(it.name)}"></div>`
          : `<p class="full" style="margin:0"><strong>${esc(it.name)}</strong></p>`}
        <div class="field"><label for="se-qty">${esc(t('shop.qty'))}</label><input id="se-qty" type="text" inputmode="decimal" maxlength="12" value="${esc(hasNum(it.qty) ? String(it.qty) : '')}"></div>
        ${free ? `<div class="field"><label for="se-unit">${esc(t('shop.unit'))}</label><input id="se-unit" type="text" maxlength="20" list="sh-units" value="${esc(it.unit || '')}"></div>` : ''}
        <div class="field full"><label for="se-note">${esc(t('shop.note'))}</label><input id="se-note" type="text" maxlength="500" value="${esc(it.note || '')}"></div>
        ${it.status === 'bestellt' ? `<button type="button" class="btn sm full" data-reopen>${icon('back')}${esc(t('shop.backToOpen'))}</button>` : ''}
      </div>`,
      onOpen: (el, close) => {
        const r = el.querySelector('[data-reopen]');
        if (r) r.addEventListener('click', async () => {
          r.disabled = true;
          try { await api.setShoppingStatus(it.id, 'offen'); close('reopened'); } catch (err) { toast(errorText(err), 'error'); r.disabled = false; }
        });
      },
      actions: [
        { label: t('shop.remove'), kind: 'danger', icon: 'trash', onClick: async () => { await api.setShoppingStatus(it.id, 'verworfen'); return 'removed'; } },
        { label: t('btn.cancel'), kind: 'ghost', value: null },
        { label: t('btn.save'), kind: 'primary', icon: 'check', onClick: async (el) => {
          const patch = { id: it.id };
          const qRaw = el.querySelector('#se-qty').value;
          if (clean(qRaw)) {
            const q = numOrNull(qRaw);
            if (q === null || !(q > 0)) { const f = el.querySelector('#se-qty'); f.setAttribute('aria-invalid', 'true'); f.focus(); throw Object.assign(new Error('invalid_qty'), { code: 'invalid_qty' }); }
            patch.qty = q;
          } else patch.qty = null;
          patch.note = clean(el.querySelector('#se-note').value) || null;
          if (free) {
            patch.name = clean(el.querySelector('#se-name').value);
            if (!patch.name) { const f = el.querySelector('#se-name'); f.setAttribute('aria-invalid', 'true'); f.focus(); throw Object.assign(new Error('name_required'), { code: 'name_required' }); }
            patch.unit = clean(el.querySelector('#se-unit').value) || null;
          }
          await api.saveShoppingItem(patch);
          return 'saved';
        } },
      ],
    });
    if (res === 'removed') toast(t('shop.removed', { name: it.name }));
    return res;
  }

  root.addEventListener('click', async (e) => {
    const li = e.target.closest('[data-id]');
    const sug = e.target.closest('[data-art]');
    if (e.target.closest('[data-share]')) { shareList(); return; }
    if (e.target.closest('[data-take-all]')) {
      const b = e.target.closest('[data-take-all]');
      b.disabled = true;
      let n = 0;
      for (const a of suggestions()) {
        try { await api.saveShoppingItem({ article_id: a.id, qty: suggestQty(a) }); n += 1; }
        catch (err) { if (err.code !== 'already_on_list') { toast(errorText(err), 'error'); break; } }
      }
      toast(t('shop.addedN', { n: fmtNum(n) }));
      b.disabled = false;
      await refresh();
      return;
    }
    if (sug && e.target.closest('[data-take]')) {
      const b = e.target.closest('[data-take]');
      const a = artById.get(sug.dataset.art);
      if (!a) return;
      b.disabled = true;
      try { await api.saveShoppingItem({ article_id: a.id, qty: suggestQty(a) }); toast(t('shop.added', { name: a.name })); await refresh(); }
      catch (err) { toast(errorText(err), 'error'); b.disabled = false; }
      return;
    }
    if (!li) return;
    const it = findItem(li.dataset.id);
    if (!it) return;
    const btn = e.target.closest('button');
    try {
      if (e.target.closest('[data-bought]')) {
        btn.disabled = true;
        const r = await bought(it);
        if (r === null || r === undefined) { if (it.article_id && !it.article_archived) { btn.disabled = false; return; } }
        await refresh();
      } else if (e.target.closest('[data-mark-ordered]')) {
        btn.disabled = true;
        await api.setShoppingStatus(it.id, 'bestellt');
        toast(t('shop.orderedToast', { name: it.name }));
        await refresh();
      } else if (e.target.closest('[data-more]')) {
        const r = await editItem(it);
        if (r) await refresh();
      } else if (e.target.closest('[data-again]')) {
        btn.disabled = true;
        await api.saveShoppingItem(it.article_id ? { article_id: it.article_id, qty: it.qty ?? null, note: it.note || null }
          : { name: it.name, qty: it.qty ?? null, unit: it.unit || null, note: it.note || null });
        toast(t('shop.added', { name: it.name }));
        await refresh();
      }
    } catch (err) { toast(errorText(err), 'error'); if (btn) btn.disabled = false; }
  });

  // ---- Teilen: Text der offenen Liste (z. B. in den Chat oder eine Mail) ----
  async function shareList() {
    const items = open.filter((x) => x.status === 'offen');
    const title = t('shop.shareTitle', { date: fmtDate(new Date()) });
    const text = [title, ...items.map((it) => `– ${it.name}${qtyText(it) ? ': ' + qtyText(it) : ''}${it.note ? ' (' + it.note + ')' : ''}`)].join('\n');
    if (navigator.share) {
      try { await navigator.share({ title, text }); return; } catch (err) { if (err && err.name === 'AbortError') return; }
    }
    if (navigator.clipboard && window.isSecureContext) {
      try { await navigator.clipboard.writeText(text); toast(t('shop.copied')); return; } catch (e) { /* weiter unten */ }
    }
    await sheet({
      title: t('shop.share'),
      body: `<p class="small muted">${esc(t('shop.copyHere'))}</p><textarea readonly rows="10" style="width:100%">${esc(text)}</textarea>`,
      onOpen: (el) => { const ta = el.querySelector('textarea'); ta.focus(); ta.select(); },
      actions: [{ label: t('btn.close'), kind: 'primary', value: true }],
    });
  }

  render();
}

export const routes = {
  'einkauf': (ctx) => shoppingView(ctx),
};
