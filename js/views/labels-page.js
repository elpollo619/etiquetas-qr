// Etiketten: Maschinen, Artikel oder Lagerorte auswählen und QR-Etiketten erstellen
import { t, registerStrings } from '../i18n.js';
import { esc, can, icon, emptyHtml, errorText, toast, debounce, thumbHtml, hydrateThumbs, locTypeLabel } from '../util.js';

registerStrings({
  de: {
    'labelsPage.title': 'Etiketten',
    'labelsPage.noAccess': 'Etiketten können nur Lagerverantwortliche und Administratoren erstellen.',
    'labelsPage.tabMachines': 'Maschinen',
    'labelsPage.tabArticles': 'Artikel',
    'labelsPage.tabLocations': 'Lagerorte',
    'labelsPage.search': 'Name, Code oder Ort suchen…',
    'labelsPage.selectAll': 'Alle auswählen',
    'labelsPage.clear': 'Auswahl aufheben',
    'labelsPage.selected': '{n} ausgewählt',
    'labelsPage.selectedTotal': 'Total ausgewählt: {n}',
    'labelsPage.create': 'Etiketten erstellen',
    'labelsPage.createN': 'Etiketten erstellen ({n})',
    'labelsPage.nothing': 'Bitte zuerst mindestens einen Eintrag auswählen.',
    'labelsPage.none': 'Keine Einträge gefunden.',
    'labelsPage.howTitle': 'So funktionieren die Etiketten',
    'labelsPage.how1': 'Der QR-Code enthält nur den dauerhaften Link mit dem Code (z. B. «…?c=M-0028»). Name und Ort stehen als Text daneben.',
    'labelsPage.how2': 'Ein Nachdruck ändert nie die Identität: Alte und neue Etiketten führen zur gleichen Karte. Beschädigte Etiketten einfach neu drucken.',
    'labelsPage.how3': 'Drucken auf dem Brother QL-800 (passende Etikettenrolle wählen) oder im Druckdialog «Als PDF speichern».',
    'labelsPage.loadError': 'Die Liste konnte nicht geladen werden.',
  },
  pt: {
    'labelsPage.title': 'Etiquetas',
    'labelsPage.noAccess': 'Só os responsáveis de armazém e os administradores podem criar etiquetas.',
    'labelsPage.tabMachines': 'Máquinas',
    'labelsPage.tabArticles': 'Artigos',
    'labelsPage.tabLocations': 'Localizações',
    'labelsPage.search': 'Pesquisar nome, código ou local…',
    'labelsPage.selectAll': 'Selecionar todos',
    'labelsPage.clear': 'Limpar seleção',
    'labelsPage.selected': '{n} selecionados',
    'labelsPage.selectedTotal': 'Total selecionado: {n}',
    'labelsPage.create': 'Criar etiquetas',
    'labelsPage.createN': 'Criar etiquetas ({n})',
    'labelsPage.nothing': 'Seleciona primeiro pelo menos um registo.',
    'labelsPage.none': 'Nenhum registo encontrado.',
    'labelsPage.howTitle': 'Como funcionam as etiquetas',
    'labelsPage.how1': 'O código QR contém apenas o link permanente com o código (p. ex. «…?c=M-0028»). O nome e o local aparecem ao lado como texto.',
    'labelsPage.how2': 'Reimprimir nunca muda a identidade: as etiquetas antigas e as novas levam à mesma ficha. Se uma etiqueta estiver danificada, basta imprimi-la de novo.',
    'labelsPage.how3': 'Imprime na Brother QL-800 (escolhe o rolo de etiquetas certo) ou, na janela de impressão, «Guardar como PDF».',
    'labelsPage.loadError': 'Não foi possível carregar a lista.',
  },
  es: {
    'labelsPage.title': 'Etiquetas',
    'labelsPage.noAccess': 'Solo los responsables de almacén y los administradores pueden crear etiquetas.',
    'labelsPage.tabMachines': 'Máquinas',
    'labelsPage.tabArticles': 'Artículos',
    'labelsPage.tabLocations': 'Ubicaciones',
    'labelsPage.search': 'Buscar nombre, código o ubicación…',
    'labelsPage.selectAll': 'Seleccionar todo',
    'labelsPage.clear': 'Quitar selección',
    'labelsPage.selected': '{n} seleccionados',
    'labelsPage.selectedTotal': 'Total seleccionado: {n}',
    'labelsPage.create': 'Crear etiquetas',
    'labelsPage.createN': 'Crear etiquetas ({n})',
    'labelsPage.nothing': 'Selecciona primero al menos una entrada.',
    'labelsPage.none': 'No se han encontrado entradas.',
    'labelsPage.howTitle': 'Cómo funcionan las etiquetas',
    'labelsPage.how1': 'El código QR solo contiene el enlace permanente con el código (p. ej. «…?c=M-0028»). El nombre y la ubicación aparecen al lado como texto.',
    'labelsPage.how2': 'Reimprimir nunca cambia la identidad: las etiquetas antiguas y las nuevas llevan a la misma ficha. Si una etiqueta se estropea, basta con imprimirla de nuevo.',
    'labelsPage.how3': 'Imprime en la Brother QL-800 (elige el rollo de etiquetas adecuado) o, en el cuadro de impresión, «Guardar como PDF».',
    'labelsPage.loadError': 'No se ha podido cargar la lista.',
  },
});

// ---------- private Hilfen ----------
const TYPES = [
  { key: 'machine', tab: 'labelsPage.tabMachines', ic: 'machine' },
  { key: 'article', tab: 'labelsPage.tabArticles', ic: 'box' },
  { key: 'location', tab: 'labelsPage.tabLocations', ic: 'location' },
];
const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const q = (ctx, k) => (ctx.query instanceof URLSearchParams ? ctx.query.get(k) : ctx.query && ctx.query[k]);

function loader(api, type) {
  if (type === 'machine') return api.listMachines();
  if (type === 'article') return api.listArticles();
  return api.listLocations();
}
function subLine(type, r) {
  if (type === 'location') return [r.path && r.path !== r.name ? r.path : '', locTypeLabel(r.type)].filter(Boolean).join(' · ');
  return [r.location_path, r.category].filter(Boolean).join(' · ');
}
function hay(type, r) {
  return norm(`${r.code} ${r.name} ${type === 'location' ? r.path || '' : r.location_path || ''} ${r.category || ''} ${r.brand || ''} ${r.model || ''}`);
}

// ---------- Route ----------
async function labelsRoute(ctx) {
  const { el, api, user } = ctx;
  if (ctx.setTitle) ctx.setTitle(t('labelsPage.title'));
  if (!can(user, 'staff')) {
    el.innerHTML = `<div class="page"><div class="page-head"><h1>${esc(t('labelsPage.title'))}</h1></div>
      <div class="alert warn" role="alert">${icon('alert')}<div>${esc(t('labelsPage.noAccess'))}</div></div></div>`;
    return;
  }

  const cache = new Map();                                     // type → rows
  const selected = new Map(TYPES.map((x) => [x.key, new Map()])); // type → Map(id → row)
  const qType = q(ctx, 'type');
  let type = TYPES.some((x) => x.key === qType) ? qType : 'machine';
  let search = '';
  const preCodes = new Set(String(q(ctx, 'codes') || q(ctx, 'code') || '').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean));

  el.innerHTML = `<div class="page">
    <div class="page-head"><h1>${esc(t('labelsPage.title'))}</h1>
      <div class="actions"><button type="button" class="btn primary" data-create>${icon('label')}<span data-createlbl>${esc(t('labelsPage.create'))}</span></button></div></div>
    <div class="tabs" role="tablist" aria-label="${esc(t('labelsPage.title'))}">
      ${TYPES.map((x) => `<button type="button" class="tab" role="tab" id="lbl-tab-${x.key}" aria-controls="lbl-panel" data-type="${x.key}"></button>`).join('')}
    </div>
    <div id="lbl-panel" role="tabpanel" class="stack">
      <div class="searchbar">${icon('search')}<input type="search" data-search placeholder="${esc(t('labelsPage.search'))}" aria-label="${esc(t('labelsPage.search'))}"></div>
      <div class="row" style="justify-content:space-between">
        <label class="check"><input type="checkbox" data-all> <span>${esc(t('labelsPage.selectAll'))}</span></label>
        <div class="row"><span class="muted small" data-count role="status"></span>
          <button type="button" class="btn ghost sm" data-clear>${icon('x')}${esc(t('labelsPage.clear'))}</button></div>
      </div>
      <div data-body></div>
    </div>
    <div class="alert" role="note">${icon('label')}<div><strong>${esc(t('labelsPage.howTitle'))}</strong>
      <ul style="margin:4px 0 0;padding-left:18px">
        <li>${esc(t('labelsPage.how1'))}</li><li>${esc(t('labelsPage.how2'))}</li><li>${esc(t('labelsPage.how3'))}</li>
      </ul></div></div>
    <div class="big-action"><button type="button" class="btn primary block" data-create>${icon('print')}<span data-createlbl>${esc(t('labelsPage.create'))}</span></button></div>
  </div>`;

  const $ = (s) => el.querySelector(s);
  const bodyEl = $('[data-body]');
  const allBox = $('[data-all]');

  const total = () => [...selected.values()].reduce((n, m) => n + m.size, 0);
  const visibleRows = () => {
    const rows = cache.get(type) || [];
    const qq = norm(search);
    return qq ? rows.filter((r) => hay(type, r).includes(qq)) : rows;
  };

  function updateCounts() {
    TYPES.forEach((x) => {
      const b = $('#lbl-tab-' + x.key);
      const n = selected.get(x.key).size;
      b.textContent = t(x.tab) + (n ? ` (${n})` : '');
      const on = x.key === type;
      b.setAttribute('aria-selected', on ? 'true' : 'false');
      b.tabIndex = on ? 0 : -1;
    });
    $('#lbl-panel').setAttribute('aria-labelledby', 'lbl-tab-' + type);
    const n = total();
    el.querySelectorAll('[data-createlbl]').forEach((s) => { s.textContent = n ? t('labelsPage.createN', { n }) : t('labelsPage.create'); });
    const cur = selected.get(type).size;
    $('[data-count]').textContent = n > cur ? `${t('labelsPage.selected', { n: cur })} · ${t('labelsPage.selectedTotal', { n })}` : t('labelsPage.selected', { n: cur });
    $('[data-clear]').hidden = n === 0;
    const vis = visibleRows();
    const sel = selected.get(type);
    const selVis = vis.filter((r) => sel.has(r.id)).length;
    allBox.disabled = vis.length === 0;
    allBox.checked = vis.length > 0 && selVis === vis.length;
    allBox.indeterminate = selVis > 0 && selVis < vis.length;
  }

  function renderList() {
    const rows = cache.get(type);
    if (!rows) return;
    const vis = visibleRows();
    const sel = selected.get(type);
    const ic = TYPES.find((x) => x.key === type).ic;
    bodyEl.innerHTML = vis.length ? `<div class="list">${vis.map((r) => `
      <label class="list-item" style="cursor:pointer">
        ${thumbHtml(r.photo_path, '', 'thumb', ic)}
        <span class="li-main"><span class="li-title">${esc(r.name)}</span>
          <span class="li-sub"><span class="mono">${esc(r.code)}</span>${subLine(type, r) ? ' · ' + esc(subLine(type, r)) : ''}</span></span>
        <span class="li-end"><input type="checkbox" data-id="${esc(r.id)}" ${sel.has(r.id) ? 'checked' : ''} style="width:22px;height:22px;accent-color:var(--primary)"></span>
      </label>`).join('')}</div>` : emptyHtml(search ? t('labelsPage.none') : t('common.none'));
    hydrateThumbs(bodyEl, api);
    updateCounts();
  }

  async function show(newType) {
    type = newType;
    updateCounts();
    if (cache.has(type)) { renderList(); return; }
    bodyEl.innerHTML = `<p class="muted" role="status">${esc(t('common.loading'))}</p>`;
    try {
      const rows = (await loader(api, type)) || [];
      cache.set(type, rows);
      if (preCodes.size) rows.forEach((r) => { if (preCodes.has(String(r.code).toUpperCase())) selected.get(type).set(r.id, r); });
    } catch (err) {
      toast(errorText(err), 'error');
      if (type !== newType) return;
      bodyEl.innerHTML = `<div class="alert danger" role="alert">${icon('alert')}<div>${esc(t('labelsPage.loadError'))} ${esc(errorText(err))}</div></div>
        <div><button type="button" class="btn" data-retry>${icon('history')}${esc(t('btn.retry'))}</button></div>`;
      bodyEl.querySelector('[data-retry]').addEventListener('click', () => show(type));
      return;
    }
    if (type === newType) renderList();
  }

  async function create() {
    const n = total();
    if (!n) { toast(t('labelsPage.nothing'), 'info'); return; }
    let mod;
    try { mod = await import('../labels.js'); } catch (err) { toast(errorText(err), 'error'); return; }
    try {
      const items = [];
      for (const x of TYPES) for (const r of selected.get(x.key).values()) items.push(mod.labelItem(x.key, r));
      await mod.openLabelDialog(items);
    } catch (err) {
      toast(errorText(err), 'error');
    }
  }

  // ----- Ereignisse -----
  const tabs = el.querySelector('.tabs');
  tabs.addEventListener('click', (e) => {
    const b = e.target.closest('[data-type]');
    if (b && b.dataset.type !== type) show(b.dataset.type);
  });
  tabs.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const i = TYPES.findIndex((x) => x.key === type);
    const next = TYPES[(i + (e.key === 'ArrowRight' ? 1 : TYPES.length - 1)) % TYPES.length].key;
    show(next).then(() => $('#lbl-tab-' + next).focus());
  });
  $('[data-search]').addEventListener('input', debounce((e) => { search = e.target.value; renderList(); }, 150));
  bodyEl.addEventListener('change', (e) => {
    const cb = e.target.closest('input[data-id]');
    if (!cb) return;
    const row = (cache.get(type) || []).find((r) => String(r.id) === cb.dataset.id);
    if (!row) return;
    if (cb.checked) selected.get(type).set(row.id, row); else selected.get(type).delete(row.id);
    updateCounts();
  });
  allBox.addEventListener('change', () => {
    const vis = visibleRows();
    const sel = selected.get(type);
    const all = vis.length > 0 && vis.every((r) => sel.has(r.id));
    vis.forEach((r) => { if (all) sel.delete(r.id); else sel.set(r.id, r); });
    renderList();
  });
  $('[data-clear]').addEventListener('click', () => {
    selected.forEach((m) => m.clear());
    renderList();
  });
  el.querySelectorAll('[data-create]').forEach((b) => b.addEventListener('click', create));

  await show(type);
}

export const routes = {
  'etiketten': labelsRoute,
};
