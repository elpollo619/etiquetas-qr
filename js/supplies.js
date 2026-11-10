// Bedarf je Maschine: welches Verbrauchsmaterial/Zubehör ein Gerät braucht (Staubsaugerbeutel, Toner, Sägeblätter …).
//   mountSupplies(el, ctx, machine)  Abschnitt auf der Maschinenkarte: Bestand je Material, «−1» (Entnahme, alle aktiven
//                                    Mitarbeiter), verknüpfen/lösen (Lagerverantwortliche, Admins).
//   mountUsedFor(el, ctx, article)   Abschnitt auf der Artikelkarte: «Wird gebraucht für» (Liste der Geräte).
// Fällt ein Material durch die Entnahme unter den Mindestbestand, kommt es automatisch auf die Einkaufsliste (Datenbank).
import { t, registerStrings, fmtQty, unitLabel } from './i18n.js';
import { esc, clean, uuid, can, toast, sheet, errorText, thumbHtml, hydrateThumbs, icon, debounce } from './util.js';
import { stockState, STATE_PILL, STATE_LABEL } from './consumption.js';

registerStrings({
  de: {
    'supply.title': 'Braucht dieses Material',
    'supply.sub': 'Verbrauchsmaterial und Zubehör für dieses Gerät. «−1» bucht eine Entnahme; wird es knapp, kommt es auf die Einkaufsliste.',
    'supply.none': 'Noch kein Material verknüpft.',
    'supply.add': 'Material verknüpfen', 'supply.addTitle': 'Material für {name}',
    'supply.search': 'Artikel suchen (Name oder Code)…', 'supply.typeToSearch': 'Tippen, um einen Artikel zu suchen.',
    'supply.noneFound': 'Nichts gefunden.', 'supply.link': 'Verknüpfen', 'supply.linked': 'Schon verknüpft',
    'supply.note': 'Hinweis (z. B. Typ oder Grösse)', 'supply.added': '«{name}» verknüpft.',
    'supply.removeAria': 'Verknüpfung mit {name} lösen', 'supply.removeAsk': '«{name}» von diesem Gerät lösen? Der Artikel bleibt erhalten.',
    'supply.removeTitle': 'Verknüpfung lösen', 'supply.removed': 'Verknüpfung gelöst.',
    'supply.take': '−1', 'supply.takeAria': '1 {unit} {name} entnehmen', 'supply.taken': '{name}: 1 entnommen – noch {qty}',
    'supply.noStock': 'Kein Bestand mehr – zuerst nachfüllen oder zählen.',
    'supply.stock': 'Bestand {qty}', 'supply.min': 'Mindestens {qty}', 'supply.usedFor': 'Wird gebraucht für',
  },
  pt: {
    'supply.title': 'Precisa deste material',
    'supply.sub': 'Consumíveis e acessórios para este aparelho. «−1» regista uma saída; se ficar pouco, entra na lista de compras.',
    'supply.none': 'Ainda sem material associado.',
    'supply.add': 'Associar material', 'supply.addTitle': 'Material para {name}',
    'supply.search': 'Pesquisar artigo (nome ou código)…', 'supply.typeToSearch': 'Escreve para procurar um artigo.',
    'supply.noneFound': 'Nada encontrado.', 'supply.link': 'Associar', 'supply.linked': 'Já associado',
    'supply.note': 'Nota (p. ex. tipo ou tamanho)', 'supply.added': '«{name}» associado.',
    'supply.removeAria': 'Remover a associação com {name}', 'supply.removeAsk': 'Remover «{name}» deste aparelho? O artigo mantém-se.',
    'supply.removeTitle': 'Remover associação', 'supply.removed': 'Associação removida.',
    'supply.take': '−1', 'supply.takeAria': 'Retirar 1 {unit} de {name}', 'supply.taken': '{name}: 1 retirado – restam {qty}',
    'supply.noStock': 'Sem stock – repor ou contar primeiro.',
    'supply.stock': 'Stock {qty}', 'supply.min': 'Mínimo {qty}', 'supply.usedFor': 'É usado em',
  },
  es: {
    'supply.title': 'Necesita este material',
    'supply.sub': 'Consumibles y accesorios para este aparato. «−1» registra una salida; si queda poco, entra en la lista de compras.',
    'supply.none': 'Aún no hay material vinculado.',
    'supply.add': 'Vincular material', 'supply.addTitle': 'Material para {name}',
    'supply.search': 'Buscar artículo (nombre o código)…', 'supply.typeToSearch': 'Escribe para buscar un artículo.',
    'supply.noneFound': 'Nada encontrado.', 'supply.link': 'Vincular', 'supply.linked': 'Ya vinculado',
    'supply.note': 'Nota (p. ej. tipo o tamaño)', 'supply.added': '«{name}» vinculado.',
    'supply.removeAria': 'Quitar el vínculo con {name}', 'supply.removeAsk': '¿Quitar «{name}» de este aparato? El artículo se conserva.',
    'supply.removeTitle': 'Quitar vínculo', 'supply.removed': 'Vínculo quitado.',
    'supply.take': '−1', 'supply.takeAria': 'Retirar 1 {unit} de {name}', 'supply.taken': '{name}: 1 retirado – quedan {qty}',
    'supply.noStock': 'Sin stock: reponer o contar primero.',
    'supply.stock': 'Stock {qty}', 'supply.min': 'Mínimo {qty}', 'supply.usedFor': 'Se usa en',
  },
});

const enc = encodeURIComponent;
const norm = (s) => clean(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const hasVal = (v) => v !== null && v !== undefined && v !== '';
const asArticle = (r) => ({ stock: r.article_stock, min_stock: r.article_min_stock, notes: r.article_notes });

export async function mountSupplies(el, ctx, machine) {
  if (!el || !machine) return;
  const { api, user } = ctx;
  const staff = can(user, 'staff');
  const active = can(user);
  let rows;
  try { rows = await api.listSupplies({ machineId: machine.id }); } catch (err) { el.hidden = true; return; }   // ältere Datenbank
  rows = rows || [];
  if (!el.isConnected) return;

  const rowHtml = (r) => {
    const st = stockState(asArticle(r));
    const showPill = hasVal(r.article_min_stock) || st === 'empty' || st === 'uncounted';
    const line = [t('supply.stock', { qty: st === 'uncounted' ? '?' : fmtQty(r.article_stock, r.article_unit) }),
      hasVal(r.article_min_stock) ? t('supply.min', { qty: fmtQty(r.article_min_stock, r.article_unit) }) : ''].filter(Boolean).join(' · ');
    return `<li class="list-item supply-row" data-id="${esc(r.id)}">
      ${thumbHtml(r.article_photo_path, '', 'thumb', 'box')}
      <a class="li-main" href="#/a/${enc(r.article_code)}">
        <span class="li-title">${esc(r.article_name)}</span>
        <span class="li-sub">${esc([r.article_code, r.article_location_path].filter(Boolean).join(' · '))}</span>
        <span class="li-sub">${esc(line)}</span>
        ${r.note ? `<span class="li-sub"><em>${esc(r.note)}</em></span>` : ''}
      </a>
      <div class="li-end supply-end">
        ${showPill ? `<span class="pill ${STATE_PILL[st]}">${esc(t(STATE_LABEL[st]))}</span>` : ''}
        <div class="row" style="gap:6px;flex-wrap:nowrap">
          ${active && !r.article_archived ? `<button type="button" class="btn sm" data-take aria-label="${esc(t('supply.takeAria', { unit: unitLabel(r.article_unit || 'Stk'), name: r.article_name }))}"${Number(r.article_stock) > 0 ? '' : ' disabled'}>${esc(t('supply.take'))}</button>` : ''}
          ${staff ? `<button type="button" class="icon-btn" data-remove aria-label="${esc(t('supply.removeAria', { name: r.article_name }))}">${icon('x')}</button>` : ''}
        </div>
      </div>
    </li>`;
  };
  const render = () => {
    if (!rows.length && !staff) { el.hidden = true; el.innerHTML = ''; return; }
    el.hidden = false;
    el.innerHTML = `<section class="section" aria-labelledby="sup-h">
      <h2 id="sup-h">${esc(t('supply.title'))}</h2>
      <div class="card stack" style="gap:10px">
        <p class="small muted" style="margin:0">${esc(t('supply.sub'))}</p>
        ${rows.length ? `<ul class="list supply-list">${rows.map(rowHtml).join('')}</ul>` : `<p class="muted" style="margin:0">${esc(t('supply.none'))}</p>`}
        ${staff && !machine.archived ? `<div><button type="button" class="btn sm" data-add>${icon('plus')}${esc(t('supply.add'))}</button></div>` : ''}
      </div>
    </section>`;
    hydrateThumbs(el, api);
  };
  const reload = async () => {
    try { rows = (await api.listSupplies({ machineId: machine.id })) || []; } catch (err) { toast(errorText(err), 'error'); }
    if (el.isConnected) render();
  };

  el.addEventListener('click', async (e) => {
    const li = e.target.closest('[data-id]');
    if (e.target.closest('[data-add]')) { if (await addSheet(ctx, machine, rows)) await reload(); return; }
    if (!li) return;
    const r = rows.find((x) => x.id === li.dataset.id);
    if (!r) return;
    const take = e.target.closest('[data-take]');
    if (take) {
      e.preventDefault();
      if (!(Number(r.article_stock) > 0)) { toast(t('supply.noStock'), 'error'); return; }
      take.disabled = true;
      try {
        await api.moveStock(r.article_id, { type: 'entnahme', qty: 1, requestId: uuid(), note: machine.code });
        await reload();
        const now = rows.find((x) => x.id === r.id);
        toast(t('supply.taken', { name: r.article_name, qty: fmtQty(now ? now.article_stock : Number(r.article_stock) - 1, r.article_unit) }));
      } catch (err) { toast(errorText(err), 'error'); take.disabled = false; }
      return;
    }
    if (e.target.closest('[data-remove]')) {
      e.preventDefault();
      const ok = await sheet({
        title: t('supply.removeTitle'),
        body: `<p>${esc(t('supply.removeAsk', { name: r.article_name }))}</p>`,
        actions: [{ label: t('btn.cancel'), kind: 'ghost', value: false },
          { label: t('supply.removeTitle'), kind: 'danger', onClick: async () => { await api.deleteSupply(r.id); return true; } }],
      });
      if (ok === true) { toast(t('supply.removed')); await reload(); }
    }
  });
  render();
}

// Dialog: Artikel suchen und mit dem Gerät verknüpfen (mehrere nacheinander möglich)
async function addSheet(ctx, machine, linkedRows) {
  const { api } = ctx;
  let arts = null;
  const linked = new Set((linkedRows || []).map((r) => r.article_id));
  let changed = false;
  await sheet({
    title: t('supply.addTitle', { name: machine.name }),
    body: `<div class="stack" style="gap:10px">
      <label class="searchbar">${icon('search')}<input type="search" data-q aria-label="${esc(t('supply.search'))}" placeholder="${esc(t('supply.search'))}" autocomplete="off"></label>
      <div class="field" style="margin:0"><label for="sup-note">${esc(t('supply.note'))}</label><input id="sup-note" type="text" maxlength="300" autocomplete="off"></div>
      <ul class="list" data-res><li class="muted small">${esc(t('supply.typeToSearch'))}</li></ul>
    </div>`,
    actions: [{ label: t('btn.close'), kind: 'primary', value: true }],
    onOpen: (el) => {
      const q = el.querySelector('[data-q]'), res = el.querySelector('[data-res]');
      const render = async () => {
        const words = norm(q.value).split(' ').filter(Boolean);
        if (!words.length) { res.innerHTML = `<li class="muted small">${esc(t('supply.typeToSearch'))}</li>`; return; }
        if (!arts) {
          try { arts = ((await api.listArticles({})) || []).filter((a) => !a.archived); }
          catch (err) { res.innerHTML = `<li class="muted small">${esc(errorText(err))}</li>`; return; }
        }
        const hits = arts.filter((a) => { const h = norm([a.name, a.code, a.brand, a.art_no].join(' ')); return words.every((w) => h.includes(w)); }).slice(0, 12);
        res.innerHTML = hits.length ? hits.map((a) => `<li class="list-item">${thumbHtml(a.photo_path, '', 'thumb', 'box')}
          <div class="li-main"><span class="li-title">${esc(a.name)}</span><span class="li-sub">${esc([a.code, fmtQty(a.stock, a.unit), a.location_path].filter(Boolean).join(' · '))}</span></div>
          <div class="li-end">${linked.has(a.id) ? `<span class="pill pill-ok">${esc(t('supply.linked'))}</span>`
            : `<button type="button" class="btn sm primary" data-pick="${esc(a.id)}">${icon('plus')}${esc(t('supply.link'))}</button>`}</div></li>`).join('')
          : `<li class="muted small">${esc(t('supply.noneFound'))}</li>`;
        hydrateThumbs(res, api);
      };
      q.addEventListener('input', debounce(render, 150));
      res.addEventListener('click', async (e) => {
        const b = e.target.closest('[data-pick]');
        if (!b) return;
        const a = arts.find((x) => x.id === b.dataset.pick);
        if (!a) return;
        b.disabled = true;
        try {
          await api.saveSupply({ machine_id: machine.id, article_id: a.id, note: clean(el.querySelector('#sup-note').value) || null });
          linked.add(a.id); changed = true;
          toast(t('supply.added', { name: a.name }));
          render();
        } catch (err) { toast(errorText(err), 'error'); b.disabled = false; }
      });
    },
  });
  return changed;
}

export async function mountUsedFor(el, ctx, article) {
  if (!el || !article) return;
  let rows;
  try { rows = await ctx.api.listSupplies({ articleId: article.id }); } catch (err) { el.hidden = true; return; }
  rows = (rows || []).filter((r) => !r.machine_archived);
  if (!el.isConnected) return;
  if (!rows.length) { el.hidden = true; return; }
  el.hidden = false;
  el.innerHTML = `<section class="section" aria-labelledby="usedfor-h">
    <h2 id="usedfor-h">${esc(t('supply.usedFor'))}</h2>
    <ul class="list">${rows.map((r) => `<li class="list-item">${thumbHtml(r.machine_photo_path, '', 'thumb', 'machine')}
      <a class="li-main" href="#/m/${enc(r.machine_code)}"><span class="li-title">${esc(r.machine_name)}</span>
        <span class="li-sub">${esc([r.machine_code, r.machine_location_path].filter(Boolean).join(' · '))}</span>
        ${r.note ? `<span class="li-sub"><em>${esc(r.note)}</em></span>` : ''}</a></li>`).join('')}</ul>
  </section>`;
  hydrateThumbs(el, ctx.api);
}
