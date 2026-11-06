// Kategorien verwalten – gemeinsam für alle Bereiche (Werkstatt, Büro, IT, Lager …).
// Baum mit Anzahl Bestandsartikel / Einzelinventar (inkl. Unterkategorien). Lagerverantwortliche: anlegen, umbenennen,
// verschieben, sortieren, archivieren. Administratoren: löschen (nur unbenutzte). Klick auf eine Kategorie → #/suche?kat=<id>.
// Route: 'kategorien' (Query: ?q=<Filter> &arch=1)
import { t, registerStrings, fmtNum } from '../i18n.js';
import { esc, clean, icon, errorText, toast, sheet, confirmSheet, can, emptyHtml } from '../util.js';

registerStrings({
  de: {
    'categories.sub': 'Gemeinsam für alle Bereiche – Werkstatt, Büro, IT, Lager …',
    'categories.info': 'Kategorien gelten für alle Räume und Bereiche gemeinsam; eine Änderung wirkt überall. Bitte Schweizer Schreibweise verwenden (ohne «ß», z. B. «Strasse», «Grösse»).',
    'categories.readOnly': 'Kategorien bearbeiten dürfen Lagerverantwortliche und Administratoren.',
    'categories.newTop': 'Neue Hauptkategorie',
    'categories.newSub': 'Neue Unterkategorie',
    'categories.parent': 'Übergeordnet: {path}',
    'categories.addSub': 'Unterkategorie anlegen',
    'categories.rename': 'Umbenennen',
    'categories.move': 'Verschieben',
    'categories.moveTo': 'Neue übergeordnete Kategorie',
    'categories.topLevel': '– Oberste Ebene (Hauptkategorie) –',
    'categories.up': 'Nach oben',
    'categories.down': 'Nach unten',
    'categories.showItems': 'Zugeordnete Objekte anzeigen',
    'categories.name': 'Name der Kategorie',
    'categories.nameHint': 'Kurz und eindeutig, z. B. «HDMI-Kabel». «ß» wird automatisch zu «ss».',
    'categories.filter': 'Kategorie suchen',
    'categories.expandAll': 'Alle aufklappen',
    'categories.collapseAll': 'Alle zuklappen',
    'categories.legend': 'Anzahl inkl. Unterkategorien:',
    'categories.articles': 'Bestandsartikel',
    'categories.machines': 'Einzelinventar',
    'categories.count': '{n} Kategorien',
    'categories.none': 'Noch keine Kategorien.',
    'categories.noneFilter': 'Keine Kategorie passt zu «{q}».',
    'categories.first': 'Erste Kategorie anlegen',
    'categories.toggle': 'Unterkategorien von «{name}» ein- oder ausblenden',
    'categories.actionsFor': 'Aktionen für «{name}»',
    'categories.created': 'Kategorie angelegt.',
    'categories.renamed': 'Kategorie umbenannt.',
    'categories.moved': 'Kategorie verschoben.',
    'categories.sorted': 'Reihenfolge gespeichert.',
    'categories.archivedOk': 'Kategorie archiviert.',
    'categories.restored': 'Kategorie wiederhergestellt.',
    'categories.deleted': 'Kategorie gelöscht.',
    'categories.dupName': 'Auf dieser Ebene gibt es bereits eine Kategorie «{name}».',
    'categories.archiveTitle': '«{name}» archivieren?',
    'categories.archiveText': 'Die Kategorie wird ausgeblendet und kann neuen Objekten nicht mehr zugeordnet werden. Zugeordnete Objekte behalten ihre Kategorie. Du kannst sie jederzeit wiederherstellen.',
    'categories.archiveSubs': 'Auch die {n} Unterkategorien werden archiviert.',
    'categories.deleteTitle': '«{name}» löschen?',
    'categories.deleteText': 'Die Kategorie wird endgültig gelöscht. Das kann nicht rückgängig gemacht werden.',
    'categories.inUseTitle': '«{name}» kann nicht gelöscht werden',
    'categories.inUseText': 'Die Kategorie wird noch verwendet:',
    'categories.inUseArticles': '{n} Bestandsartikel (inkl. archivierte)',
    'categories.inUseMachines': '{n} Einzelinventar (inkl. archivierte)',
    'categories.inUseChildren': '{n} Unterkategorien',
    'categories.inUseServer': 'Die Datenbank meldet, dass die Kategorie noch verwendet wird – zum Beispiel von archivierten Objekten oder Unterkategorien.',
    'categories.inUseHelp': 'Ordne die Objekte zuerst einer anderen Kategorie zu und verschiebe oder lösche die Unterkategorien. Oder archiviere die Kategorie – dann bleibt alles erhalten.',
    'categories.archiveInstead': 'Stattdessen archivieren',
    'categories.countsFailed': 'Die Anzahl Objekte je Kategorie konnte nicht geladen werden.',
  },
  pt: {
    'categories.sub': 'Comuns a todas as áreas – oficina, escritório, TI, armazém …',
    'categories.info': 'As categorias são comuns a todas as divisões e áreas; uma alteração aplica-se em todo o lado. Os nomes são em alemão da Suíça (sem «ß», p. ex. «Strasse», «Grösse»).',
    'categories.readOnly': 'Só responsáveis de armazém e administradores podem editar categorias.',
    'categories.newTop': 'Nova categoria principal',
    'categories.newSub': 'Nova subcategoria',
    'categories.parent': 'Categoria superior: {path}',
    'categories.addSub': 'Criar subcategoria',
    'categories.rename': 'Mudar o nome',
    'categories.move': 'Mover',
    'categories.moveTo': 'Nova categoria superior',
    'categories.topLevel': '– Nível superior (categoria principal) –',
    'categories.up': 'Para cima',
    'categories.down': 'Para baixo',
    'categories.showItems': 'Mostrar objetos atribuídos',
    'categories.name': 'Nome da categoria',
    'categories.nameHint': 'Curto e claro, p. ex. «HDMI-Kabel». «ß» passa automaticamente a «ss».',
    'categories.filter': 'Procurar categoria',
    'categories.expandAll': 'Expandir tudo',
    'categories.collapseAll': 'Recolher tudo',
    'categories.legend': 'Quantidade incl. subcategorias:',
    'categories.articles': 'Material com stock',
    'categories.machines': 'Artigos individuais',
    'categories.count': '{n} categorias',
    'categories.none': 'Ainda não há categorias.',
    'categories.noneFilter': 'Nenhuma categoria corresponde a «{q}».',
    'categories.first': 'Criar a primeira categoria',
    'categories.toggle': 'Mostrar ou ocultar subcategorias de «{name}»',
    'categories.actionsFor': 'Ações para «{name}»',
    'categories.created': 'Categoria criada.',
    'categories.renamed': 'Nome da categoria alterado.',
    'categories.moved': 'Categoria movida.',
    'categories.sorted': 'Ordem guardada.',
    'categories.archivedOk': 'Categoria arquivada.',
    'categories.restored': 'Categoria restaurada.',
    'categories.deleted': 'Categoria eliminada.',
    'categories.dupName': 'Já existe uma categoria «{name}» neste nível.',
    'categories.archiveTitle': 'Arquivar «{name}»?',
    'categories.archiveText': 'A categoria fica oculta e deixa de poder ser atribuída a novos objetos. Os objetos atribuídos mantêm a categoria. Podes restaurá-la a qualquer momento.',
    'categories.archiveSubs': 'As {n} subcategorias também são arquivadas.',
    'categories.deleteTitle': 'Eliminar «{name}»?',
    'categories.deleteText': 'A categoria é eliminada definitivamente. Isto não pode ser anulado.',
    'categories.inUseTitle': 'Não é possível eliminar «{name}»',
    'categories.inUseText': 'A categoria ainda está a ser usada:',
    'categories.inUseArticles': '{n} materiais com stock (incl. arquivados)',
    'categories.inUseMachines': '{n} artigos individuais (incl. arquivados)',
    'categories.inUseChildren': '{n} subcategorias',
    'categories.inUseServer': 'A base de dados indica que a categoria ainda está a ser usada – por exemplo por objetos arquivados ou subcategorias.',
    'categories.inUseHelp': 'Atribui primeiro os objetos a outra categoria e move ou elimina as subcategorias. Ou arquiva a categoria – assim tudo se mantém.',
    'categories.archiveInstead': 'Arquivar em vez disso',
    'categories.countsFailed': 'Não foi possível carregar a quantidade de objetos por categoria.',
  },
  es: {
    'categories.sub': 'Comunes a todas las áreas: taller, oficina, TI, almacén …',
    'categories.info': 'Las categorías son comunes a todas las salas y áreas; un cambio se aplica en todas partes. Los nombres van en alemán de Suiza (sin «ß», p. ej. «Strasse», «Grösse»).',
    'categories.readOnly': 'Solo los responsables de almacén y los administradores pueden editar categorías.',
    'categories.newTop': 'Nueva categoría principal',
    'categories.newSub': 'Nueva subcategoría',
    'categories.parent': 'Categoría superior: {path}',
    'categories.addSub': 'Crear subcategoría',
    'categories.rename': 'Cambiar nombre',
    'categories.move': 'Mover',
    'categories.moveTo': 'Nueva categoría superior',
    'categories.topLevel': '– Nivel superior (categoría principal) –',
    'categories.up': 'Subir',
    'categories.down': 'Bajar',
    'categories.showItems': 'Mostrar objetos asignados',
    'categories.name': 'Nombre de la categoría',
    'categories.nameHint': 'Corto y claro, p. ej. «HDMI-Kabel». «ß» se convierte automáticamente en «ss».',
    'categories.filter': 'Buscar categoría',
    'categories.expandAll': 'Desplegar todo',
    'categories.collapseAll': 'Plegar todo',
    'categories.legend': 'Cantidad incl. subcategorías:',
    'categories.articles': 'Material con stock',
    'categories.machines': 'Activos individuales',
    'categories.count': '{n} categorías',
    'categories.none': 'Aún no hay categorías.',
    'categories.noneFilter': 'Ninguna categoría coincide con «{q}».',
    'categories.first': 'Crear la primera categoría',
    'categories.toggle': 'Mostrar u ocultar subcategorías de «{name}»',
    'categories.actionsFor': 'Acciones para «{name}»',
    'categories.created': 'Categoría creada.',
    'categories.renamed': 'Nombre de la categoría cambiado.',
    'categories.moved': 'Categoría movida.',
    'categories.sorted': 'Orden guardado.',
    'categories.archivedOk': 'Categoría archivada.',
    'categories.restored': 'Categoría restaurada.',
    'categories.deleted': 'Categoría eliminada.',
    'categories.dupName': 'Ya existe una categoría «{name}» en este nivel.',
    'categories.archiveTitle': '¿Archivar «{name}»?',
    'categories.archiveText': 'La categoría se oculta y ya no se puede asignar a nuevos objetos. Los objetos asignados conservan su categoría. Puedes restaurarla en cualquier momento.',
    'categories.archiveSubs': 'También se archivan sus {n} subcategorías.',
    'categories.deleteTitle': '¿Eliminar «{name}»?',
    'categories.deleteText': 'La categoría se elimina definitivamente. No se puede deshacer.',
    'categories.inUseTitle': 'No se puede eliminar «{name}»',
    'categories.inUseText': 'La categoría todavía se usa:',
    'categories.inUseArticles': '{n} materiales con stock (incl. archivados)',
    'categories.inUseMachines': '{n} activos individuales (incl. archivados)',
    'categories.inUseChildren': '{n} subcategorías',
    'categories.inUseServer': 'La base de datos indica que la categoría todavía se usa, por ejemplo por objetos archivados o subcategorías.',
    'categories.inUseHelp': 'Asigna primero los objetos a otra categoría y mueve o elimina las subcategorías. O archiva la categoría: así se conserva todo.',
    'categories.archiveInstead': 'Archivar en su lugar',
    'categories.countsFailed': 'No se pudo cargar la cantidad de objetos por categoría.',
  },
});

// Ansichtszustand für die Sitzung (bleibt beim Neu-Laden nach einer Änderung erhalten)
const expanded = new Set();
let focusAfter = null;

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const fold = (s) => String(s ?? '').toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
  .replace(/ß/g, 'ss').normalize('NFD').replace(/[̀-ͯ]/g, '');
const normName = (s) => clean(s).replace(/ß/g, 'ss').slice(0, 80);
const sameName = (a, b) => fold(a) === fold(b);
const indent = (d) => '   '.repeat(Math.max(0, d));

function countBy(rows, key, onlyActive) {
  const m = new Map();
  for (const r of rows || []) {
    if (onlyActive && r.archived) continue;
    const k = r[key];
    if (k) m.set(k, (m.get(k) || 0) + 1);
  }
  return m;
}

/** Baum aus den Zeilen von api.listCategories (parent_id, sort, name); Summen inkl. Unterkategorien. */
function buildTree(cats, counts) {
  const nodes = new Map(cats.map((c) => [c.id, { c, children: [], parent: null, a: 0, m: 0 }]));
  const roots = [];
  for (const n of nodes.values()) {
    const p = n.c.parent_id ? nodes.get(n.c.parent_id) : null;
    if (p && p !== n) { n.parent = p; p.children.push(n); } else roots.push(n);
  }
  const cmp = (x, y) => (num(x.c.sort) - num(y.c.sort))
    || String(x.c.name).localeCompare(String(y.c.name), 'de', { sensitivity: 'base', numeric: true });
  const seen = new Set();
  const walk = (list, parentPath, depth) => {
    list.sort(cmp);
    for (const n of list) {
      if (seen.has(n)) continue;
      seen.add(n);
      n.depth = depth;
      n.path = parentPath ? parentPath + ' › ' + n.c.name : n.c.name;
      walk(n.children, n.path, depth + 1);
      n.a = (counts ? counts.a.get(n.c.id) || 0 : 0) + n.children.reduce((s, k) => s + k.a, 0);
      n.m = (counts ? counts.m.get(n.c.id) || 0 : 0) + n.children.reduce((s, k) => s + k.m, 0);
    }
  };
  walk(roots, '', 0);
  return { nodes, roots };
}
const descendants = (n) => n.children.flatMap((k) => [k, ...descendants(k)]);
const ancestors = (n) => { const out = []; for (let p = n.parent; p; p = p.parent) out.push(p); return out; };
const hiddenByArchive = (n) => n.c.archived || ancestors(n).some((p) => p.c.archived);

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------
async function categoriesRoute(ctx) {
  const { el, api, user } = ctx;
  if (ctx.setTitle) ctx.setTitle(t('nav.categories'));
  const staff = can(user, 'staff');
  const admin = can(user, 'admin');
  const qp = (k) => {
    const q = ctx.query;
    const v = q && (typeof q.get === 'function' ? q.get(k) : q[k]);
    return v === null || v === undefined ? '' : String(v);
  };
  const st = { q: qp('q'), arch: qp('arch') === '1' };

  const head = `<div class="page-head">
      <div><h1>${esc(t('nav.categories'))}</h1><div class="sub">${esc(t('categories.sub'))}</div></div>
      ${staff ? `<div class="actions"><button type="button" class="btn primary" data-new>${icon('plus')}${esc(t('categories.newTop'))}</button></div>` : ''}
    </div>`;
  el.innerHTML = `<div class="page">${head}<p class="muted" role="status">${esc(t('common.loading'))}</p></div>`;

  // Kategorien sind nötig; die Anzahlen sind eine Zusatzinformation.
  const settle = (fn) => Promise.resolve().then(fn).then((v) => ({ ok: true, v: v || [] }), (err) => ({ ok: false, err }));
  const [cR, mR, aR] = await Promise.all([
    settle(() => api.listCategories({ includeArchived: true })),
    settle(() => api.listMachines({ includeArchived: true })),
    settle(() => api.listArticles({ includeArchived: true })),
  ]);
  if (!cR.ok) {
    toast(errorText(cR.err), 'error');
    el.innerHTML = `<div class="page">${head}${emptyHtml(errorText(cR.err),
      `<button type="button" class="btn" data-retry>${icon('history')}${esc(t('btn.retry'))}</button>`)}</div>`;
    el.querySelector('[data-retry]').addEventListener('click', () => ctx.reload());
    return;
  }
  const countsOk = mR.ok && aR.ok;
  if (!countsOk) toast(errorText((!mR.ok ? mR : aR).err), 'error');
  const cats = cR.v;
  const shown = countsOk ? { a: countBy(aR.v, 'category_id', true), m: countBy(mR.v, 'category_id', true) } : null;
  const usage = countsOk ? { a: countBy(aR.v, 'category_id', false), m: countBy(mR.v, 'category_id', false) } : null;
  const { nodes, roots } = buildTree(cats, shown);

  el.innerHTML = `<div class="page cat-page">
    ${head}
    <div class="alert" role="note">${icon('layers')}<div>${esc(t('categories.info'))}${staff ? '' : ' ' + esc(t('categories.readOnly'))}</div></div>
    ${countsOk ? '' : `<div class="alert warn" role="status">${icon('alert')}<div>${esc(t('categories.countsFailed'))}</div></div>`}
    ${cats.length ? `<div class="cat-tools">
      <div class="searchbar">${icon('search')}<input type="search" id="cat-q" aria-label="${esc(t('categories.filter'))}" placeholder="${esc(t('categories.filter'))} …" value="${esc(st.q)}" autocomplete="off"></div>
      <div class="row">
        <button type="button" class="btn sm ghost" data-expand>${icon('plus')}${esc(t('categories.expandAll'))}</button>
        <button type="button" class="btn sm ghost" data-collapse>${icon('minus')}${esc(t('categories.collapseAll'))}</button>
        <label class="check"><input type="checkbox" data-arch ${st.arch ? 'checked' : ''}>${esc(t('common.showArchived'))}</label>
      </div>
    </div>
    <p class="small muted cat-legend">${esc(t('categories.legend'))}
      <span class="cat-count">${icon('box')}${esc(t('categories.articles'))}</span>
      <span class="cat-count">${icon('machine')}${esc(t('categories.machines'))}</span>
      <span data-total></span></p>` : ''}
    <div data-tree></div>
  </div>`;

  const treeEl = el.querySelector('[data-tree]');
  const qInput = el.querySelector('#cat-q');

  // ----- Darstellung -----
  function visibleIds() {
    const terms = fold(clean(st.q)).split(' ').filter(Boolean);
    const vis = new Set();
    for (const n of nodes.values()) {
      if (!st.arch && hiddenByArchive(n)) continue;
      if (terms.length && !terms.every((x) => fold(n.path).includes(x))) continue;
      vis.add(n.c.id);
      if (terms.length) for (const p of ancestors(n)) vis.add(p.c.id);
    }
    return vis;
  }
  const countHtml = (n) => {
    const v = (x) => (shown ? fmtNum(x) : '–');
    return `<span class="cat-counts">
      <span class="cat-count" title="${esc(t('categories.articles'))}">${icon('box')}<span>${esc(v(n.a))}</span><span class="sr-only"> ${esc(t('categories.articles'))}</span></span>
      <span class="cat-count" title="${esc(t('categories.machines'))}">${icon('machine')}<span>${esc(v(n.m))}</span><span class="sr-only"> ${esc(t('categories.machines'))}</span></span>
    </span>`;
  };
  function nodeHtml(n, vis, filtering) {
    const id = n.c.id;
    const kids = n.children.filter((k) => vis.has(k.c.id));
    const open = filtering || expanded.has(id);
    const name = n.c.name;
    return `<li class="cat-node${n.c.archived ? ' is-archived' : ''}${n.depth === 0 ? ' is-root' : ''}">
      <div class="cat-row" style="--depth:${n.depth}">
        ${kids.length ? `<button type="button" class="icon-btn cat-toggle" data-toggle="${esc(id)}" aria-expanded="${open}"
          aria-controls="cc-${esc(id)}" aria-label="${esc(t('categories.toggle', { name }))}">${icon('chevron')}</button>`
          : '<span class="cat-toggle-space" aria-hidden="true"></span>'}
        <a class="cat-link" href="#/suche?kat=${encodeURIComponent(id)}" title="${esc(n.path)}">
          <span class="cat-name">${esc(name)}</span>
          ${n.c.archived ? `<span class="pill pill-muted">${esc(t('common.archived'))}</span>` : ''}
          ${countHtml(n)}
        </a>
        ${staff ? `<button type="button" class="icon-btn" data-menu="${esc(id)}" aria-haspopup="dialog" aria-label="${esc(t('categories.actionsFor', { name }))}">${icon('more')}</button>` : ''}
      </div>
      ${kids.length ? `<ul class="cat-children" id="cc-${esc(id)}"${open ? '' : ' hidden'}>${kids.map((k) => nodeHtml(k, vis, filtering)).join('')}</ul>` : ''}
    </li>`;
  }
  function renderTree() {
    if (!cats.length) {
      treeEl.innerHTML = emptyHtml(t('categories.none'),
        staff ? `<button type="button" class="btn primary" data-new>${icon('plus')}${esc(t('categories.first'))}</button>` : '');
      return;
    }
    const vis = visibleIds();
    const filtering = !!clean(st.q);
    const total = el.querySelector('[data-total]');
    if (total) total.textContent = '· ' + t('categories.count', { n: fmtNum(vis.size) });
    const top = roots.filter((n) => vis.has(n.c.id));
    treeEl.innerHTML = top.length
      ? `<ul class="cat-tree">${top.map((n) => nodeHtml(n, vis, filtering)).join('')}</ul>`
      : emptyHtml(t('categories.noneFilter', { q: clean(st.q) }));
    if (focusAfter) {
      const b = [...treeEl.querySelectorAll('[data-menu]')].find((x) => x.dataset.menu === focusAfter);
      if (b) b.focus();
      focusAfter = null;
    }
  }
  function syncUrl() {
    const p = new URLSearchParams();
    if (clean(st.q)) p.set('q', clean(st.q));
    if (st.arch) p.set('arch', '1');
    const target = '#/kategorien' + (p.toString() ? '?' + p : '');
    if (location.hash !== target) try { history.replaceState(history.state, '', target); } catch (e) { /* egal */ }
  }
  renderTree();

  // ----- Änderungen -----
  const siblingsOf = (parentId) => (parentId ? (nodes.get(parentId) || { children: [] }).children : roots);
  const nextSort = (parentId) => siblingsOf(parentId).reduce((mx, s) => Math.max(mx, num(s.c.sort)), 0) + 10;
  const dupIn = (parentId, name, selfId) => siblingsOf(parentId).some((s) => s.c.id !== selfId && sameName(s.c.name, name));
  const payload = (c, patch) => Object.assign({ id: c.id, parent_id: c.parent_id || null, name: c.name, sort: num(c.sort), archived: !!c.archived }, patch);
  const done = (msg, id) => {
    toast(msg);
    if (id) {
      focusAfter = id;
      const n = nodes.get(id);
      if (n) ancestors(n).forEach((p) => expanded.add(p.c.id));
    }
    ctx.reload();
  };
  const showError = (box, msg) => { box.textContent = msg; box.hidden = false; return false; };
  const enterSubmits = (sheetEl) => sheetEl.querySelectorAll('input[type=text]').forEach((i) => i.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); const b = sheetEl.querySelector('.sheet-actions .primary'); if (b && !b.disabled) b.click(); }
  }));

  async function nameDialog({ title, initial = '', parentId, selfId, parentPath, onSave }) {
    return sheet({
      title,
      body: `${parentPath ? `<p class="small muted" style="margin:0">${esc(t('categories.parent', { path: parentPath }))}</p>` : ''}
        <div class="field"><label for="cat-name">${esc(t('categories.name'))}</label>
          <input id="cat-name" type="text" maxlength="80" required autocomplete="off" value="${esc(initial)}" aria-describedby="cat-name-h">
          <span class="hint" id="cat-name-h">${esc(t('categories.nameHint'))}</span></div>`,
      onOpen: (sEl) => enterSubmits(sEl),
      actions: [
        { label: t('btn.cancel'), kind: 'ghost', value: null },
        {
          label: t('btn.save'), kind: 'primary', icon: 'check',
          onClick: async (sEl) => {
            const inp = sEl.querySelector('#cat-name');
            const name = normName(inp.value);
            if (!name) { inp.setAttribute('aria-invalid', 'true'); inp.focus(); throw Object.assign(new Error('name_required'), { code: 'name_required' }); }
            if (dupIn(parentId, name, selfId)) {
              inp.setAttribute('aria-invalid', 'true');
              return showError(sEl.querySelector('.sheet-error'), t('categories.dupName', { name }));
            }
            return (await onSave(name)) || true;
          },
        },
      ],
    });
  }

  async function createCategory(parent) {
    const parentId = parent ? parent.c.id : null;
    const row = await nameDialog({
      title: parent ? t('categories.newSub') : t('categories.newTop'),
      parentId, parentPath: parent ? parent.path : '',
      onSave: (name) => api.saveCategory({ parent_id: parentId, name, sort: nextSort(parentId), archived: false }),
    });
    if (!row) return;
    if (parent) expanded.add(parent.c.id);
    done(t('categories.created'), row && row.id ? row.id : null);
  }

  async function renameCategory(n) {
    const row = await nameDialog({
      title: t('categories.rename'), initial: n.c.name, parentId: n.c.parent_id || null, selfId: n.c.id,
      parentPath: n.parent ? n.parent.path : '',
      onSave: (name) => (name === n.c.name ? { id: n.c.id } : api.saveCategory(payload(n.c, { name }))),
    });
    if (row) done(t('categories.renamed'), n.c.id);
  }

  async function moveCategory(n) {
    const blocked = new Set([n.c.id, ...descendants(n).map((d) => d.c.id)]);
    const options = [];
    const walk = (list) => list.forEach((x) => {
      if (blocked.has(x.c.id)) return;
      if (!hiddenByArchive(x) || x.c.id === n.c.parent_id) {
        options.push(`<option value="${esc(x.c.id)}"${x.c.id === n.c.parent_id ? ' selected' : ''}>${esc(indent(x.depth) + x.c.name)}</option>`);
      }
      walk(x.children);
    });
    walk(roots);
    const moved = await sheet({
      title: t('categories.move') + ': ' + n.c.name,
      body: `<p class="small muted" style="margin:0">${esc(n.path)}</p>
        <div class="field"><label for="cat-parent">${esc(t('categories.moveTo'))}</label>
          <select id="cat-parent"><option value=""${n.c.parent_id ? '' : ' selected'}>${esc(t('categories.topLevel'))}</option>${options.join('')}</select></div>`,
      actions: [
        { label: t('btn.cancel'), kind: 'ghost', value: false },
        {
          label: t('categories.move'), kind: 'primary', icon: 'move',
          onClick: async (sEl) => {
            const target = sEl.querySelector('#cat-parent').value || null;
            if ((target || null) === (n.c.parent_id || null)) return 'same';
            if (dupIn(target, n.c.name, n.c.id)) return showError(sEl.querySelector('.sheet-error'), t('categories.dupName', { name: n.c.name }));
            await api.saveCategory(payload(n.c, { parent_id: target, sort: nextSort(target) }));
            if (target) expanded.add(target);
            return 'moved';
          },
        },
      ],
    });
    if (moved === 'moved') done(t('categories.moved'), n.c.id);
  }

  async function reorder(n, dir) {
    const all = siblingsOf(n.c.parent_id || null);
    const vis = visibleIds();
    const visible = all.filter((s) => vis.has(s.c.id));
    const vi = visible.indexOf(n);
    const neighbor = visible[vi + dir];
    if (!neighbor) return;
    const order = all.filter((s) => s !== n);
    const ni = order.indexOf(neighbor);
    order.splice(dir < 0 ? ni : ni + 1, 0, n);
    try {
      for (let i = 0; i < order.length; i++) {
        const want = (i + 1) * 10;
        if (num(order[i].c.sort) !== want) await api.saveCategory(payload(order[i].c, { sort: want }));
      }
      done(t('categories.sorted'), n.c.id);
    } catch (err) {
      toast(errorText(err), 'error');
      ctx.reload();
    }
  }

  async function setArchived(n, archived) {
    let list;
    if (archived) {
      list = [n, ...descendants(n)].filter((x) => !x.c.archived);
      const subs = list.length - 1;
      const ok = await confirmSheet(t('categories.archiveTitle', { name: n.c.name }),
        t('categories.archiveText') + (subs > 0 ? ' ' + t('categories.archiveSubs', { n: subs }) : ''),
        { okLabel: t('btn.archive') });
      if (!ok) return;
    } else {
      list = [...ancestors(n).reverse(), n, ...descendants(n)].filter((x) => x.c.archived);
    }
    try {
      for (const x of list) await api.saveCategory(payload(x.c, { archived }));
      if (archived && !st.arch) { focusAfter = null; toast(t('categories.archivedOk')); ctx.reload(); return; }
      done(archived ? t('categories.archivedOk') : t('categories.restored'), n.c.id);
    } catch (err) {
      toast(errorText(err), 'error');
      ctx.reload();
    }
  }

  async function inUseDialog(n, use) {
    const items = use ? [
      use.a ? t('categories.inUseArticles', { n: fmtNum(use.a) }) : '',
      use.m ? t('categories.inUseMachines', { n: fmtNum(use.m) }) : '',
      use.ch ? t('categories.inUseChildren', { n: fmtNum(use.ch) }) : '',
    ].filter(Boolean) : [];
    const act = await sheet({
      title: t('categories.inUseTitle', { name: n.c.name }),
      body: `<div class="alert warn" role="alert">${icon('alert')}<div>${items.length
        ? `${esc(t('categories.inUseText'))}<ul class="cat-inuse">${items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`
        : esc(t('categories.inUseServer'))}</div></div>
        <p style="margin:0">${esc(t('categories.inUseHelp'))}</p>
        ${use && use.a + use.m > 0 ? `<a class="btn ghost sm" data-show href="#/suche?kat=${encodeURIComponent(n.c.id)}&arch=1">${icon('search')}${esc(t('categories.showItems'))}</a>` : ''}`,
      onOpen: (sEl, close) => { const a = sEl.querySelector('[data-show]'); if (a) a.addEventListener('click', () => close(null)); },
      actions: [
        { label: t('btn.close'), kind: 'ghost', value: null },
        ...(n.c.archived ? [] : [{ label: t('categories.archiveInstead'), kind: 'primary', value: 'archive' }]),
      ],
    });
    if (act === 'archive') await setArchived(n, true);
  }

  async function deleteCategory(n) {
    if (usage) {
      const use = { a: usage.a.get(n.c.id) || 0, m: usage.m.get(n.c.id) || 0, ch: n.children.length };
      if (use.a || use.m || use.ch) { await inUseDialog(n, use); return; }
    }
    const ok = await confirmSheet(t('categories.deleteTitle', { name: n.c.name }), t('categories.deleteText'),
      { okLabel: t('btn.delete'), danger: true });
    if (!ok) return;
    try {
      await api.deleteCategory(n.c.id);
      expanded.delete(n.c.id);
      done(t('categories.deleted'), n.parent ? n.parent.c.id : null);
    } catch (err) {
      if (err && err.code === 'in_use') { await inUseDialog(n, null); return; }
      toast(errorText(err), 'error');
    }
  }

  async function openMenu(n) {
    const all = siblingsOf(n.c.parent_id || null);
    const vis = visibleIds();
    const visible = all.filter((s) => vis.has(s.c.id));
    const i = visible.indexOf(n);
    const items = [
      !n.c.archived && { act: 'sub', ic: 'plus', label: t('categories.addSub') },
      { act: 'rename', ic: 'edit', label: t('categories.rename') },
      { act: 'move', ic: 'move', label: t('categories.move') },
      i > 0 && { act: 'up', ic: 'arrowOut', label: t('categories.up') },
      i >= 0 && i < visible.length - 1 && { act: 'down', ic: 'arrowIn', label: t('categories.down') },
      n.c.archived ? { act: 'restore', ic: 'history', label: t('btn.unarchive') } : { act: 'archive', ic: 'box', label: t('btn.archive') },
      admin && { act: 'delete', ic: 'trash', label: t('btn.delete'), danger: true },
    ].filter(Boolean);
    const act = await sheet({
      title: n.c.name,
      body: `<p class="small muted" style="margin:0">${esc(n.path)}${shown ? ' · ' + esc(`${fmtNum(n.a)} ${t('categories.articles')} · ${fmtNum(n.m)} ${t('categories.machines')}`) : ''}</p>
        <div class="cat-menu">
          <a class="cat-menu-item" data-show href="#/suche?kat=${encodeURIComponent(n.c.id)}">${icon('search')}<span>${esc(t('categories.showItems'))}</span></a>
          ${items.map((x) => `<button type="button" class="cat-menu-item${x.danger ? ' danger' : ''}" data-act="${x.act}">${icon(x.ic)}<span>${esc(x.label)}</span></button>`).join('')}
        </div>`,
      onOpen: (sEl, close) => {
        sEl.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => close(b.dataset.act)));
        sEl.querySelector('[data-show]').addEventListener('click', () => close(null));
      },
    });
    if (!act) return;
    if (act === 'sub') await createCategory(n);
    else if (act === 'rename') await renameCategory(n);
    else if (act === 'move') await moveCategory(n);
    else if (act === 'up') await reorder(n, -1);
    else if (act === 'down') await reorder(n, 1);
    else if (act === 'archive') await setArchived(n, true);
    else if (act === 'restore') await setArchived(n, false);
    else if (act === 'delete') await deleteCategory(n);
  }

  // ----- Ereignisse -----
  el.addEventListener('click', (ev) => {
    const tg = ev.target.closest('[data-toggle]');
    if (tg) {
      const id = tg.dataset.toggle;
      const open = tg.getAttribute('aria-expanded') !== 'true';
      tg.setAttribute('aria-expanded', String(open));
      const ul = tg.closest('.cat-node').querySelector(':scope > .cat-children');
      if (ul) ul.hidden = !open;
      if (open) expanded.add(id); else expanded.delete(id);
      return;
    }
    const mb = ev.target.closest('[data-menu]');
    if (mb) { const n = nodes.get(mb.dataset.menu); if (n) openMenu(n); return; }
    if (ev.target.closest('[data-new]')) { createCategory(null); return; }
    if (ev.target.closest('[data-expand]')) {
      for (const n of nodes.values()) if (n.children.length) expanded.add(n.c.id);
      renderTree();
      return;
    }
    if (ev.target.closest('[data-collapse]')) { expanded.clear(); renderTree(); }
  });
  if (qInput) {
    qInput.addEventListener('input', () => { st.q = qInput.value; renderTree(); syncUrl(); });
  }
  const archBox = el.querySelector('[data-arch]');
  if (archBox) archBox.addEventListener('change', () => { st.arch = archBox.checked; renderTree(); syncUrl(); });
}

export const routes = {
  'kategorien': categoriesRoute,
};
