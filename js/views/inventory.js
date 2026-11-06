// Inventur: Liste, Zählen der Artikel, Prüfen der Maschinen, Abschliessen, Export
import { t, registerStrings, locale, fmtDate, fmtDateTime, fmtNum, fmtQty, unitLabel } from '../i18n.js';
import {
  esc, clean, can, icon, emptyHtml, errorText, toast, sheet, statusPill, parseScanned,
  downloadCsv, numOrNull, debounce, thumbHtml, hydrateThumbs,
} from '../util.js';

registerStrings({
  de: {
    'inventory.title': 'Inventur',
    'inventory.new': 'Neue Inventur',
    'inventory.defaultName': 'Inventur {month}',
    'inventory.name': 'Bezeichnung',
    'inventory.note': 'Bemerkung',
    'inventory.newHint': 'Zählen können alle Mitarbeiter. Abschliessen kann nur ein Lagerverantwortlicher.',
    'inventory.create': 'Inventur starten',
    'inventory.started': 'Inventur gestartet.',
    'inventory.intro': 'Bei der Inventur zählst du jeden Artikel (Ist-Menge) und prüfst jede Maschine. Am Schluss bucht ein Lagerverantwortlicher die Differenzen.',
    'inventory.none': 'Noch keine Inventur.',
    'inventory.st.offen': 'Offen',
    'inventory.st.abgeschlossen': 'Abgeschlossen',
    'inventory.startedAt': 'Begonnen {d}',
    'inventory.startedBy': 'von {name}',
    'inventory.closedAt': 'Abgeschlossen {d}',
    'inventory.countedOf': '{n} von {total} Artikeln gezählt',
    'inventory.countedN': '{n} Artikel gezählt',
    'inventory.checkedN': '{n} Maschinen geprüft',
    'inventory.applied': 'Differenzen gebucht',
    'inventory.notApplied': 'Ohne Buchung abgeschlossen',
    'inventory.tabArticles': 'Artikel',
    'inventory.tabMachines': 'Maschinen',
    'inventory.scan': 'Scannen',
    'inventory.scanTitle': 'Inventur scannen',
    'inventory.scanHint': 'Artikel scannen und danach die gezählte Menge eingeben. Maschinen werden direkt als «vorhanden» erfasst.',
    'inventory.export': 'Export',
    'inventory.exportArticles': 'Artikel (Excel)',
    'inventory.exportMachines': 'Maschinen (Excel)',
    'inventory.exportPdf': 'PDF / Drucken',
    'inventory.close': 'Abschliessen',
    'inventory.closeTitle': 'Inventur abschliessen',
    'inventory.closeApply': 'Differenzen buchen und fehlende/defekte Maschinen markieren',
    'inventory.closeApplyHint': '{diff} Differenzen werden als Inventur-Bewegung gebucht. {missing} fehlende Maschinen werden auf «Verloren», {defect} defekte auf «Defekt» gesetzt (ausgeliehene Maschinen bleiben unverändert).',
    'inventory.closeOpenWarn': '{n} Artikel wurden nicht gezählt – ihr Bestand bleibt unverändert.',
    'inventory.closeFinal': 'Danach kann nicht mehr gezählt werden. Die Inventur bleibt im Verlauf erhalten.',
    'inventory.closeBtn': 'Inventur abschliessen',
    'inventory.closed': 'Inventur abgeschlossen.',
    'inventory.closedInfo': 'Abgeschlossen am {d} von {name}.',
    'inventory.readOnly': 'Diese Inventur ist abgeschlossen und kann nur noch angesehen werden.',
    'inventory.soll': 'Soll',
    'inventory.ist': 'Ist',
    'inventory.diff': 'Differenz',
    'inventory.istFor': 'Ist-Menge für {name}',
    'inventory.countedBy': 'gezählt von {name}',
    'inventory.countedByCol': 'gezählt von',
    'inventory.countedAtCol': 'gezählt am',
    'inventory.saving': 'Wird gespeichert…',
    'inventory.saved': 'Gespeichert',
    'inventory.filter': 'Filter',
    'inventory.f.all': 'Alle',
    'inventory.f.counted': 'Gezählt',
    'inventory.f.open': 'Offen',
    'inventory.f.diff': 'Differenzen',
    'inventory.f.checked': 'Geprüft',
    'inventory.f.problems': 'Fehlt / defekt',
    'inventory.f.onLoan': 'Ausgeliehen',
    'inventory.searchArticles': 'Artikel suchen…',
    'inventory.searchMachines': 'Maschinen suchen…',
    'inventory.locFilter': 'Lagerort: {path}',
    'inventory.clearLoc': 'Lagerort-Filter entfernen',
    'inventory.res.vorhanden': 'Vorhanden',
    'inventory.res.fehlt': 'Fehlt',
    'inventory.res.defekt': 'Defekt',
    'inventory.res.ausgeliehen': 'Ausgeliehen',
    'inventory.result': 'Ergebnis',
    'inventory.resultFor': 'Ergebnis für {name}',
    'inventory.onLoanBy': 'ausgeliehen bei {name} seit {d}',
    'inventory.notChecked': 'Noch nicht geprüft',
    'inventory.checkedBy': 'geprüft von {name}, {d}',
    'inventory.checkedByCol': 'geprüft von',
    'inventory.checkedAtCol': 'geprüft am',
    'inventory.noteHint': 'Optional: z. B. «Kabel beschädigt» oder «zuletzt auf Baustelle X gesehen».',
    'inventory.markLoaned': 'Alle ausgeliehenen markieren ({n})',
    'inventory.sumCounted': 'Artikel gezählt',
    'inventory.sumDiff': 'Differenzen',
    'inventory.sumChecked': 'Maschinen geprüft',
    'inventory.sumMissing': 'Fehlende Maschinen',
    'inventory.sumDefect': '+ {n} defekt',
    'inventory.scanMachineOk': '{code} {name}: vorhanden',
    'inventory.scanNotFound': 'Code {code} nicht gefunden.',
    'inventory.scanLocation': 'Lagerort {path}: Artikel gefiltert.',
    'inventory.notFound': 'Inventur nicht gefunden.',
    'inventory.backToList': 'Alle Inventuren',
    'inventory.noArticles': 'Keine Artikel für diesen Filter.',
    'inventory.noMachines': 'Keine Maschinen für diesen Filter.',
    'inventory.printTitle': 'Inventur: {name}',
    'inventory.printed': 'Gedruckt am {d}',
    'inventory.uncounted': 'nicht gezählt',
    'inventory.archived': 'archiviert',
    'inventory.colLocation': 'Lagerort',
    'inventory.signCount': 'Visum Zählung',
    'inventory.signApprove': 'Visum Lagerverantwortlicher',
    'inventory.overdue': 'überfällig',
  },
  pt: {
    'inventory.title': 'Inventário',
    'inventory.new': 'Novo inventário',
    'inventory.defaultName': 'Inventário {month}',
    'inventory.name': 'Designação',
    'inventory.note': 'Observação',
    'inventory.newHint': 'Todos os colaboradores podem contar. Só um responsável de armazém pode fechar o inventário.',
    'inventory.create': 'Iniciar inventário',
    'inventory.started': 'Inventário iniciado.',
    'inventory.intro': 'No inventário contas cada artigo (quantidade real) e verificas cada máquina. No fim, um responsável de armazém regista as diferenças.',
    'inventory.none': 'Ainda não há inventários.',
    'inventory.st.offen': 'Em curso',
    'inventory.st.abgeschlossen': 'Fechado',
    'inventory.startedAt': 'Iniciado a {d}',
    'inventory.startedBy': 'por {name}',
    'inventory.closedAt': 'Fechado a {d}',
    'inventory.countedOf': '{n} de {total} artigos contados',
    'inventory.countedN': '{n} artigos contados',
    'inventory.checkedN': '{n} máquinas verificadas',
    'inventory.applied': 'Diferenças registadas',
    'inventory.notApplied': 'Fechado sem registo',
    'inventory.tabArticles': 'Artigos',
    'inventory.tabMachines': 'Máquinas',
    'inventory.scan': 'Ler QR',
    'inventory.scanTitle': 'Ler para o inventário',
    'inventory.scanHint': 'Lê um artigo e introduz depois a quantidade contada. As máquinas ficam logo registadas como «presente».',
    'inventory.export': 'Exportar',
    'inventory.exportArticles': 'Artigos (Excel)',
    'inventory.exportMachines': 'Máquinas (Excel)',
    'inventory.exportPdf': 'PDF / Imprimir',
    'inventory.close': 'Fechar',
    'inventory.closeTitle': 'Fechar inventário',
    'inventory.closeApply': 'Registar as diferenças e marcar as máquinas em falta/avariadas',
    'inventory.closeApplyHint': '{diff} diferenças serão registadas como movimento de inventário. {missing} máquinas em falta passam a «Perdida» e {defect} avariadas a «Avariada» (as máquinas emprestadas não são alteradas).',
    'inventory.closeOpenWarn': '{n} artigos não foram contados – o seu stock não é alterado.',
    'inventory.closeFinal': 'Depois já não é possível contar. O inventário fica guardado no histórico.',
    'inventory.closeBtn': 'Fechar inventário',
    'inventory.closed': 'Inventário fechado.',
    'inventory.closedInfo': 'Fechado a {d} por {name}.',
    'inventory.readOnly': 'Este inventário está fechado e só pode ser consultado.',
    'inventory.soll': 'Previsto',
    'inventory.ist': 'Real',
    'inventory.diff': 'Diferença',
    'inventory.istFor': 'Quantidade real de {name}',
    'inventory.countedBy': 'contado por {name}',
    'inventory.countedByCol': 'contado por',
    'inventory.countedAtCol': 'contado em',
    'inventory.saving': 'A guardar…',
    'inventory.saved': 'Guardado',
    'inventory.filter': 'Filtro',
    'inventory.f.all': 'Todos',
    'inventory.f.counted': 'Contados',
    'inventory.f.open': 'Por contar',
    'inventory.f.diff': 'Diferenças',
    'inventory.f.checked': 'Verificadas',
    'inventory.f.problems': 'Em falta / avariadas',
    'inventory.f.onLoan': 'Emprestadas',
    'inventory.searchArticles': 'Pesquisar artigos…',
    'inventory.searchMachines': 'Pesquisar máquinas…',
    'inventory.locFilter': 'Localização: {path}',
    'inventory.clearLoc': 'Remover filtro de localização',
    'inventory.res.vorhanden': 'Presente',
    'inventory.res.fehlt': 'Em falta',
    'inventory.res.defekt': 'Avariada',
    'inventory.res.ausgeliehen': 'Emprestada',
    'inventory.result': 'Resultado',
    'inventory.resultFor': 'Resultado para {name}',
    'inventory.onLoanBy': 'emprestada a {name} desde {d}',
    'inventory.notChecked': 'Ainda não verificada',
    'inventory.checkedBy': 'verificada por {name}, {d}',
    'inventory.checkedByCol': 'verificada por',
    'inventory.checkedAtCol': 'verificada em',
    'inventory.noteHint': 'Opcional: p. ex. «cabo danificado» ou «vista pela última vez na obra X».',
    'inventory.markLoaned': 'Marcar todas as emprestadas ({n})',
    'inventory.sumCounted': 'Artigos contados',
    'inventory.sumDiff': 'Diferenças',
    'inventory.sumChecked': 'Máquinas verificadas',
    'inventory.sumMissing': 'Máquinas em falta',
    'inventory.sumDefect': '+ {n} avariadas',
    'inventory.scanMachineOk': '{code} {name}: presente',
    'inventory.scanNotFound': 'Código {code} não encontrado.',
    'inventory.scanLocation': 'Localização {path}: artigos filtrados.',
    'inventory.notFound': 'Inventário não encontrado.',
    'inventory.backToList': 'Todos os inventários',
    'inventory.noArticles': 'Nenhum artigo para este filtro.',
    'inventory.noMachines': 'Nenhuma máquina para este filtro.',
    'inventory.printTitle': 'Inventário: {name}',
    'inventory.printed': 'Impresso a {d}',
    'inventory.uncounted': 'não contado',
    'inventory.archived': 'arquivado',
    'inventory.colLocation': 'Localização',
    'inventory.signCount': 'Visto da contagem',
    'inventory.signApprove': 'Visto do responsável de armazém',
    'inventory.overdue': 'em atraso',
  },
  es: {
    'inventory.title': 'Inventario',
    'inventory.new': 'Nuevo inventario',
    'inventory.defaultName': 'Inventario {month}',
    'inventory.name': 'Nombre',
    'inventory.note': 'Observación',
    'inventory.newHint': 'Todos los empleados pueden contar. Solo un responsable de almacén puede cerrar el inventario.',
    'inventory.create': 'Iniciar inventario',
    'inventory.started': 'Inventario iniciado.',
    'inventory.intro': 'En el inventario cuentas cada artículo (cantidad real) y compruebas cada máquina. Al final, un responsable de almacén registra las diferencias.',
    'inventory.none': 'Aún no hay inventarios.',
    'inventory.st.offen': 'En curso',
    'inventory.st.abgeschlossen': 'Cerrado',
    'inventory.startedAt': 'Iniciado el {d}',
    'inventory.startedBy': 'por {name}',
    'inventory.closedAt': 'Cerrado el {d}',
    'inventory.countedOf': '{n} de {total} artículos contados',
    'inventory.countedN': '{n} artículos contados',
    'inventory.checkedN': '{n} máquinas comprobadas',
    'inventory.applied': 'Diferencias registradas',
    'inventory.notApplied': 'Cerrado sin registrar',
    'inventory.tabArticles': 'Artículos',
    'inventory.tabMachines': 'Máquinas',
    'inventory.scan': 'Escanear',
    'inventory.scanTitle': 'Escanear para el inventario',
    'inventory.scanHint': 'Escanea un artículo e introduce después la cantidad contada. Las máquinas se registran directamente como «presente».',
    'inventory.export': 'Exportar',
    'inventory.exportArticles': 'Artículos (Excel)',
    'inventory.exportMachines': 'Máquinas (Excel)',
    'inventory.exportPdf': 'PDF / Imprimir',
    'inventory.close': 'Cerrar',
    'inventory.closeTitle': 'Cerrar inventario',
    'inventory.closeApply': 'Registrar las diferencias y marcar las máquinas que faltan o están defectuosas',
    'inventory.closeApplyHint': '{diff} diferencias se registrarán como movimiento de inventario. {missing} máquinas que faltan pasarán a «Perdida» y {defect} defectuosas a «Defectuosa» (las máquinas prestadas no se modifican).',
    'inventory.closeOpenWarn': '{n} artículos no se han contado: su stock no cambia.',
    'inventory.closeFinal': 'Después ya no se podrá contar. El inventario se conserva en el historial.',
    'inventory.closeBtn': 'Cerrar inventario',
    'inventory.closed': 'Inventario cerrado.',
    'inventory.closedInfo': 'Cerrado el {d} por {name}.',
    'inventory.readOnly': 'Este inventario está cerrado y solo se puede consultar.',
    'inventory.soll': 'Teórico',
    'inventory.ist': 'Real',
    'inventory.diff': 'Diferencia',
    'inventory.istFor': 'Cantidad real de {name}',
    'inventory.countedBy': 'contado por {name}',
    'inventory.countedByCol': 'contado por',
    'inventory.countedAtCol': 'contado el',
    'inventory.saving': 'Guardando…',
    'inventory.saved': 'Guardado',
    'inventory.filter': 'Filtro',
    'inventory.f.all': 'Todos',
    'inventory.f.counted': 'Contados',
    'inventory.f.open': 'Pendientes',
    'inventory.f.diff': 'Diferencias',
    'inventory.f.checked': 'Comprobadas',
    'inventory.f.problems': 'Faltan / defectuosas',
    'inventory.f.onLoan': 'Prestadas',
    'inventory.searchArticles': 'Buscar artículos…',
    'inventory.searchMachines': 'Buscar máquinas…',
    'inventory.locFilter': 'Ubicación: {path}',
    'inventory.clearLoc': 'Quitar el filtro de ubicación',
    'inventory.res.vorhanden': 'Presente',
    'inventory.res.fehlt': 'Falta',
    'inventory.res.defekt': 'Defectuosa',
    'inventory.res.ausgeliehen': 'Prestada',
    'inventory.result': 'Resultado',
    'inventory.resultFor': 'Resultado para {name}',
    'inventory.onLoanBy': 'prestada a {name} desde el {d}',
    'inventory.notChecked': 'Aún sin comprobar',
    'inventory.checkedBy': 'comprobada por {name}, {d}',
    'inventory.checkedByCol': 'comprobada por',
    'inventory.checkedAtCol': 'comprobada el',
    'inventory.noteHint': 'Opcional: p. ej. «cable dañado» o «vista por última vez en la obra X».',
    'inventory.markLoaned': 'Marcar todas las prestadas ({n})',
    'inventory.sumCounted': 'Artículos contados',
    'inventory.sumDiff': 'Diferencias',
    'inventory.sumChecked': 'Máquinas comprobadas',
    'inventory.sumMissing': 'Máquinas que faltan',
    'inventory.sumDefect': '+ {n} defectuosas',
    'inventory.scanMachineOk': '{code} {name}: presente',
    'inventory.scanNotFound': 'Código {code} no encontrado.',
    'inventory.scanLocation': 'Ubicación {path}: artículos filtrados.',
    'inventory.notFound': 'Inventario no encontrado.',
    'inventory.backToList': 'Todos los inventarios',
    'inventory.noArticles': 'Ningún artículo para este filtro.',
    'inventory.noMachines': 'Ninguna máquina para este filtro.',
    'inventory.printTitle': 'Inventario: {name}',
    'inventory.printed': 'Impreso el {d}',
    'inventory.uncounted': 'sin contar',
    'inventory.archived': 'archivado',
    'inventory.colLocation': 'Ubicación',
    'inventory.signCount': 'Visto bueno del recuento',
    'inventory.signApprove': 'Visto bueno del responsable de almacén',
    'inventory.overdue': 'con retraso',
  },
});

// ---------- private Hilfen ----------
const RESULTS = ['vorhanden', 'fehlt', 'defekt', 'ausgeliehen'];
const RES_PILL = { vorhanden: 'pill-ok', fehlt: 'pill-danger', defekt: 'pill-warn', ausgeliehen: 'pill-info' };
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const ts = (iso) => { const n = new Date(iso || 0).getTime(); return Number.isFinite(n) ? n : 0; };
const q = (ctx, k) => (ctx.query instanceof URLSearchParams ? ctx.query.get(k) : ctx.query && ctx.query[k]);
const slug = (s) => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'inventur';

function statusPillInv(st) {
  return `<span class="pill ${st === 'offen' ? 'pill-info' : 'pill-muted'}">${esc(t('inventory.st.' + st))}</span>`;
}
function diffText(d, unit) {
  if (d === 0) return '±0';
  return (d > 0 ? '+' : '−') + fmtQty(Math.abs(d), unit);
}
function diffPill(d, unit) {
  const cls = d === 0 ? 'pill-ok' : d > 0 ? 'pill-warn' : 'pill-danger';
  return `<span class="pill ${cls}" title="${esc(t('inventory.diff'))}">${esc(diffText(d, unit))}</span>`;
}
function errorPage(ctx, err, backHtml = '') {
  toast(errorText(err), 'error');
  ctx.el.innerHTML = `<div class="page">${backHtml}
    <div class="alert danger" role="alert">${icon('alert')}<div>${esc(errorText(err))}</div></div>
    <div><button type="button" class="btn" data-retry>${icon('history')}${esc(t('btn.retry'))}</button></div></div>`;
  ctx.el.querySelector('[data-retry]').addEventListener('click', () => ctx.reload());
}
function printArea() {
  let pa = document.getElementById('printArea');
  if (!pa) {
    pa = document.createElement('div');
    pa.id = 'printArea';
    pa.setAttribute('aria-hidden', 'true');
    document.body.appendChild(pa);
  }
  return pa;
}

// ---------- Neue Inventur ----------
async function newInventorySheet(ctx) {
  const month = new Intl.DateTimeFormat(locale(), { month: 'long', year: 'numeric' }).format(new Date());
  const def = t('inventory.defaultName', { month });
  const res = await sheet({
    title: t('inventory.new'),
    body: `<form class="stack" novalidate>
      <div class="field"><label for="inv-name">${esc(t('inventory.name'))}</label>
        <input id="inv-name" name="name" type="text" required maxlength="120" value="${esc(def)}" autocomplete="off"></div>
      <div class="field"><label for="inv-note">${esc(t('inventory.note'))} <span class="muted">(${esc(t('common.optional'))})</span></label>
        <textarea id="inv-note" name="note" rows="2"></textarea></div>
      <p class="hint">${esc(t('inventory.newHint'))}</p>
    </form>`,
    actions: [
      { label: t('btn.cancel'), kind: 'ghost', value: null },
      {
        label: t('inventory.create'), kind: 'primary', icon: 'clipboard',
        onClick: async (sh) => {
          const name = clean(sh.querySelector('#inv-name').value);
          if (!name) throw Object.assign(new Error('name_required'), { code: 'name_required' });
          const note = clean(sh.querySelector('#inv-note').value) || null;
          const inv = await ctx.api.createInventory({ name, note });
          return inv || null;
        },
      },
    ],
    onOpen: (sh) => {
      sh.querySelector('form').addEventListener('submit', (e) => {
        e.preventDefault();
        sh.querySelector('.sheet-actions .primary').click();
      });
    },
  });
  if (res && res.id) {
    toast(t('inventory.started'));
    ctx.go('inventur/' + res.id);
  }
}

// ---------- Liste ----------
async function listRoute(ctx) {
  const { el, api, user } = ctx;
  if (ctx.setTitle) ctx.setTitle(t('inventory.title'));
  const staff = can(user, 'staff');
  const head = `<div class="page-head"><h1>${esc(t('inventory.title'))}</h1>
    ${staff ? `<div class="actions"><button type="button" class="btn primary" data-new>${icon('plus')}${esc(t('inventory.new'))}</button></div>` : ''}</div>
    <p class="muted" style="margin:0">${esc(t('inventory.intro'))}</p>`;
  el.innerHTML = `<div class="page">${head}<p class="muted" role="status">${esc(t('common.loading'))}</p></div>`;

  let inventories, profiles, articles;
  try {
    [inventories, profiles, articles] = await Promise.all([
      api.listInventories(),
      api.listProfiles().catch(() => []),
      api.listArticles().catch(() => []),
    ]);
  } catch (err) { errorPage(ctx, err); return; }
  inventories = inventories || [];
  const names = new Map((profiles || []).map((p) => [p.id, p.full_name]));
  const totalArticles = (articles || []).length;

  // Zähler (gezählte Artikel / geprüfte Maschinen) für die neuesten Inventuren
  const details = await Promise.allSettled(inventories.slice(0, 15).map((i) => api.getInventory(i.id)));
  const stats = new Map();
  details.forEach((d, i) => {
    if (d.status === 'fulfilled' && d.value) {
      stats.set(inventories[i].id, { counts: (d.value.counts || []).length, checks: (d.value.checks || []).length });
    }
  });

  const items = inventories.map((inv) => {
    const st = stats.get(inv.id);
    const who = names.get(inv.started_by);
    const sub1 = [t('inventory.startedAt', { d: fmtDate(inv.started_at) }) + (who ? ' ' + t('inventory.startedBy', { name: who }) : '')];
    if (inv.closed_at) sub1.push(t('inventory.closedAt', { d: fmtDate(inv.closed_at) }));
    let sub2 = '';
    if (st) {
      sub2 = (inv.status === 'offen' && totalArticles
        ? t('inventory.countedOf', { n: st.counts, total: totalArticles })
        : t('inventory.countedN', { n: st.counts })) + ' · ' + t('inventory.checkedN', { n: st.checks });
    }
    return `<a class="list-item" href="#/inventur/${encodeURIComponent(inv.id)}">
      <span class="thumb thumb-empty" aria-hidden="true">${icon('clipboard')}</span>
      <div class="li-main"><span class="li-title">${esc(inv.name)}</span>
        <span class="li-sub">${esc(sub1.join(' · '))}</span>
        ${sub2 ? `<span class="li-sub">${esc(sub2)}</span>` : ''}</div>
      <div class="li-end">${statusPillInv(inv.status)}
        ${inv.status === 'abgeschlossen' ? `<span class="muted">${esc(inv.applied ? t('inventory.applied') : t('inventory.notApplied'))}</span>` : ''}</div>
    </a>`;
  }).join('');

  el.innerHTML = `<div class="page">${head}
    ${inventories.length ? `<div class="list">${items}</div>`
      : emptyHtml(t('inventory.none'), staff ? `<button type="button" class="btn primary" data-new>${icon('plus')}${esc(t('inventory.new'))}</button>` : '')}
  </div>`;
  el.querySelectorAll('[data-new]').forEach((b) => b.addEventListener('click', () => newInventorySheet(ctx)));
}

// ---------- Detail ----------
async function detailRoute(ctx) {
  const { el, api, user, params } = ctx;
  if (ctx.setTitle) ctx.setTitle(t('inventory.title'));
  const back = `<a class="back-link" href="#/inventur">${icon('back')}${esc(t('inventory.backToList'))}</a>`;
  el.innerHTML = `<div class="page">${back}<p class="muted" role="status">${esc(t('common.loading'))}</p></div>`;

  let data, articles, machines, profiles;
  try {
    [data, articles, machines, profiles] = await Promise.all([
      api.getInventory(params.id),
      api.listArticles({ includeArchived: true }),
      api.listMachines({ includeArchived: true }),
      api.listProfiles().catch(() => []),
    ]);
  } catch (err) { errorPage(ctx, err, back); return; }
  if (!data || !data.inventory) {
    el.innerHTML = `<div class="page">${back}${emptyHtml(t('inventory.notFound'))}</div>`;
    return;
  }

  const inv = data.inventory;
  const open = inv.status === 'offen';
  const staff = can(user, 'staff');
  const names = new Map((profiles || []).map((p) => [p.id, p.full_name]));
  const nameOf = (id) => names.get(id) || (user && id === user.id ? user.full_name : '') || '–';
  if (ctx.setTitle) ctx.setTitle(inv.name);

  const countBy = new Map((data.counts || []).map((c) => [c.article_id, c]));
  const checkBy = new Map((data.checks || []).map((c) => [c.machine_id, c]));
  const closedTs = inv.closed_at ? ts(inv.closed_at) : Infinity;
  const existed = (row) => !row.created_at || ts(row.created_at) <= closedTs;

  const aRows = (articles || [])
    .filter((a) => countBy.has(a.id) || (!a.archived && existed(a)))
    .map((a) => ({ a, c: countBy.get(a.id) || null }))
    .sort((x, y) => (x.a.location_path || '￿').localeCompare(y.a.location_path || '￿', locale())
      || String(x.a.name).localeCompare(String(y.a.name), locale()));
  const mRows = (machines || [])
    .filter((m) => checkBy.has(m.id) || (!m.archived && existed(m)))
    .map((m) => ({ m, ch: checkBy.get(m.id) || null }))
    .sort((x, y) => String(x.m.name).localeCompare(String(y.m.name), locale()));

  const soll = (r) => (r.c && r.c.expected !== undefined && r.c.expected !== null ? num(r.c.expected) : num(r.a.stock));
  const diffOf = (r) => (r.c ? num(r.c.counted) - soll(r) : null);
  const onLoan = (m) => m.status === 'ausgeliehen' || !!m.open_loan_id;

  // Zustand der Ansicht
  let tab = q(ctx, 'tab') === 'maschinen' ? 'm' : 'a';
  let aFilter = 'all', aSearch = '', locPath = '';
  let mFilter = 'all', mSearch = '';

  // ----- HTML -----
  const startedWho = nameOf(inv.started_by);
  const closedBlock = !open ? `<div class="alert ok" role="status">${icon('check')}<div>
      ${esc(t('inventory.closedInfo', { d: fmtDateTime(inv.closed_at), name: nameOf(inv.closed_by) }))}
      ${esc(inv.applied ? t('inventory.applied') : t('inventory.notApplied'))}.<br><span class="small">${esc(t('inventory.readOnly'))}</span></div></div>` : '';

  el.innerHTML = `<div class="page">
    ${back}
    <div class="page-head">
      <div><h1>${esc(inv.name)}</h1>
        <div class="sub">${statusPillInv(inv.status)} ${esc(t('inventory.startedAt', { d: fmtDateTime(inv.started_at) }))} ${esc(t('inventory.startedBy', { name: startedWho }))}</div></div>
      <div class="actions">
        ${open ? `<button type="button" class="btn primary" data-scan>${icon('scan')}${esc(t('inventory.scan'))}</button>` : ''}
        <button type="button" class="btn" data-export>${icon('download')}${esc(t('inventory.export'))}</button>
        ${open && staff ? `<button type="button" class="btn" data-close>${icon('check')}${esc(t('inventory.close'))}</button>` : ''}
      </div>
    </div>
    ${inv.note ? `<p class="muted" style="margin:0">${esc(inv.note)}</p>` : ''}
    ${closedBlock}
    <div class="stats" data-summary aria-live="polite"></div>
    <div class="tabs" role="tablist" aria-label="${esc(t('inventory.title'))}">
      <button type="button" class="tab" role="tab" id="inv-tab-a" aria-controls="inv-panel-a" data-tab="a"></button>
      <button type="button" class="tab" role="tab" id="inv-tab-m" aria-controls="inv-panel-m" data-tab="m"></button>
    </div>
    <div id="inv-panel-a" role="tabpanel" aria-labelledby="inv-tab-a" class="stack">
      <div class="filters">
        <div class="searchbar">${icon('search')}<input type="search" data-asearch placeholder="${esc(t('inventory.searchArticles'))}" aria-label="${esc(t('inventory.searchArticles'))}"></div>
        <div class="chips" role="group" aria-label="${esc(t('inventory.filter'))}" data-achips></div>
      </div>
      <div data-loc></div>
      <div class="list" data-alist>${aRows.map(aRowHtml).join('')}</div>
      <div data-aempty hidden>${emptyHtml(t('inventory.noArticles'))}</div>
    </div>
    <div id="inv-panel-m" role="tabpanel" aria-labelledby="inv-tab-m" class="stack" hidden>
      <div class="filters">
        <div class="searchbar">${icon('search')}<input type="search" data-msearch placeholder="${esc(t('inventory.searchMachines'))}" aria-label="${esc(t('inventory.searchMachines'))}"></div>
        <div class="chips" role="group" aria-label="${esc(t('inventory.filter'))}" data-mchips></div>
      </div>
      <div data-markloaned></div>
      <div class="list" data-mlist>${mRows.map(mRowHtml).join('')}</div>
      <div data-mempty hidden>${emptyHtml(t('inventory.noMachines'))}</div>
    </div>
  </div>`;

  const $ = (s) => el.querySelector(s);
  const aList = $('[data-alist]');
  const mList = $('[data-mlist]');
  aRows.forEach((r) => { r.el = aList.querySelector(`[data-aid="${CSS.escape(r.a.id)}"]`); });
  mRows.forEach((r) => { r.el = mList.querySelector(`[data-mid="${CSS.escape(r.m.id)}"]`); });
  if (!aRows.length) aList.hidden = true;
  if (!mRows.length) mList.hidden = true;
  hydrateThumbs(el, api);

  // ----- Zeilen -----
  function aInfoHtml(r) {
    const unit = r.a.unit;
    const parts = [`${esc(t('inventory.soll'))} <b>${esc(fmtQty(soll(r), unit))}</b>`];
    if (r.c) {
      parts.push(diffPill(diffOf(r), unit));
      parts.push(esc(t('inventory.countedBy', { name: nameOf(r.c.counted_by) })));
    } else {
      parts.push(`<span class="muted">${esc(t('inventory.uncounted'))}</span>`);
    }
    return parts.join(' · ');
  }
  function aRowHtml(r) {
    const a = r.a;
    const id = 'inv-ist-' + a.id;
    const ist = r.c ? num(r.c.counted) : null;
    return `<div class="list-item" data-aid="${esc(a.id)}" style="flex-wrap:wrap">
      ${thumbHtml(a.photo_path, '', 'thumb', 'box')}
      <div class="li-main" style="flex:1 1 190px">
        <span class="li-title" style="white-space:normal">${esc(a.name)}${a.archived ? ` <span class="pill pill-muted">${esc(t('inventory.archived'))}</span>` : ''}</span>
        <span class="li-sub"><span class="mono">${esc(a.code)}</span>${a.location_path ? ' · ' + esc(a.location_path) : ''}</span>
        <span class="li-sub" data-info style="white-space:normal">${aInfoHtml(r)}</span>
      </div>
      <div class="li-end" style="flex-direction:row;align-items:center;gap:6px;margin-left:auto">
        ${open
          ? `<label class="sr-only" for="${esc(id)}">${esc(t('inventory.istFor', { name: a.name }))}</label>
             <input id="${esc(id)}" data-ist type="number" inputmode="decimal" min="0" step="any" enterkeyhint="next"
               value="${ist === null ? '' : esc(String(ist))}" placeholder="${esc(t('inventory.ist'))}" style="width:92px;text-align:right">
             <span class="small muted" aria-hidden="true">${esc(unitLabel(a.unit))}</span>`
          : `<b>${ist === null ? '–' : esc(fmtQty(ist, a.unit))}</b>`}
        <span data-state role="status" style="display:inline-flex;width:22px;color:var(--ok)">${r.c ? icon('check') : ''}</span>
      </div>
    </div>`;
  }
  function checkInfo(r) {
    if (!r.ch) return `<span class="muted">${esc(t('inventory.notChecked'))}</span>`;
    const res = r.ch.result;
    let s = `<span class="pill ${RES_PILL[res] || 'pill-muted'}">${esc(t('inventory.res.' + res))}</span> `
      + esc(t('inventory.checkedBy', { name: nameOf(r.ch.checked_by), d: fmtDateTime(r.ch.checked_at) }));
    if (r.ch.note) s += ` · «${esc(r.ch.note)}»`;
    return s;
  }
  function resultsFor(r) {
    return RESULTS.filter((res) => res !== 'ausgeliehen' || onLoan(r.m) || (r.ch && r.ch.result === 'ausgeliehen'));
  }
  function chipsHtml(r) {
    return resultsFor(r).map((res) => `<button type="button" class="chip" data-res="${res}" aria-pressed="${r.ch && r.ch.result === res ? 'true' : 'false'}">${esc(t('inventory.res.' + res))}</button>`).join('');
  }
  function mRowHtml(r) {
    const m = r.m;
    const loanInfo = onLoan(m)
      ? `<span class="li-sub" style="white-space:normal;color:var(--info)">${icon('handoff')} ${esc(t('inventory.onLoanBy', { name: m.open_borrower_name || '–', d: fmtDateTime(m.open_since) }))}${m.overdue ? ` <span class="pill pill-danger">${esc(t('inventory.overdue'))}</span>` : ''}</span>`
      : '';
    return `<div class="list-item" data-mid="${esc(m.id)}" style="flex-wrap:wrap">
      ${thumbHtml(m.photo_path, '', 'thumb', 'machine')}
      <div class="li-main">
        <span class="li-title" style="white-space:normal">${esc(m.name)}${m.archived ? ` <span class="pill pill-muted">${esc(t('inventory.archived'))}</span>` : ''}</span>
        <span class="li-sub"><span class="mono">${esc(m.code)}</span>${m.location_path ? ' · ' + esc(m.location_path) : ''}</span>
        ${loanInfo}
        <span class="li-sub" data-minfo style="white-space:normal">${checkInfo(r)}</span>
      </div>
      <div class="li-end">${statusPill(m.status)}</div>
      ${open ? `<div class="chips" role="group" aria-label="${esc(t('inventory.resultFor', { name: m.name }))}" style="flex-basis:100%" data-mchip>${chipsHtml(r)}</div>` : ''}
    </div>`;
  }
  function refreshARow(r) {
    r.el.querySelector('[data-info]').innerHTML = aInfoHtml(r);
  }
  function refreshMRow(r) {
    r.el.querySelector('[data-minfo]').innerHTML = checkInfo(r);
    const chips = r.el.querySelector('[data-mchip]');
    if (chips) chips.innerHTML = chipsHtml(r);
  }

  // ----- Zusammenfassung, Chips, Tabs -----
  function counts() {
    const active = aRows.filter((r) => !r.a.archived || r.c);
    const counted = active.filter((r) => r.c).length;
    const diffs = aRows.filter((r) => r.c && diffOf(r) !== 0).length;
    const checked = mRows.filter((r) => r.ch).length;
    const missing = mRows.filter((r) => r.ch && r.ch.result === 'fehlt').length;
    const defect = mRows.filter((r) => r.ch && r.ch.result === 'defekt').length;
    const loaned = mRows.filter((r) => onLoan(r.m)).length;
    return { total: active.length, counted, open: active.length - counted, diffs, checked, mTotal: mRows.length, missing, defect, loaned };
  }
  function renderSummary() {
    const c = counts();
    $('[data-summary]').innerHTML = `
      <div class="stat${c.total && c.counted === c.total ? ' ok' : ''}"><span class="stat-num">${esc(fmtNum(c.counted))}/${esc(fmtNum(c.total))}</span><span class="stat-label">${esc(t('inventory.sumCounted'))}</span></div>
      <div class="stat${c.diffs ? ' warn' : ''}"><span class="stat-num">${esc(fmtNum(c.diffs))}</span><span class="stat-label">${esc(t('inventory.sumDiff'))}</span></div>
      <div class="stat${c.mTotal && c.checked === c.mTotal ? ' ok' : ''}"><span class="stat-num">${esc(fmtNum(c.checked))}/${esc(fmtNum(c.mTotal))}</span><span class="stat-label">${esc(t('inventory.sumChecked'))}</span></div>
      <div class="stat${c.missing ? ' danger' : ''}"><span class="stat-num">${esc(fmtNum(c.missing))}</span><span class="stat-label">${esc(t('inventory.sumMissing'))}${c.defect ? ' ' + esc(t('inventory.sumDefect', { n: c.defect })) : ''}</span></div>`;
    $('#inv-tab-a').textContent = `${t('inventory.tabArticles')} (${c.counted}/${c.total})`;
    $('#inv-tab-m').textContent = `${t('inventory.tabMachines')} (${c.checked}/${c.mTotal})`;
    const aChips = [['all', c.total], ['counted', c.counted], ['open', c.open], ['diff', c.diffs]];
    $('[data-achips]').innerHTML = aChips.map(([k, n]) => `<button type="button" class="chip" data-af="${k}" aria-pressed="${aFilter === k}">${esc(t('inventory.f.' + k))} (${n})</button>`).join('');
    const mChips = [['all', c.mTotal], ['checked', c.checked], ['open', c.mTotal - c.checked], ['problems', c.missing + c.defect]];
    if (c.loaned) mChips.push(['onLoan', c.loaned]);
    $('[data-mchips]').innerHTML = mChips.map(([k, n]) => `<button type="button" class="chip" data-mf="${k}" aria-pressed="${mFilter === k}">${esc(t('inventory.f.' + k))} (${n})</button>`).join('');
    const pendingLoaned = open ? mRows.filter((r) => onLoan(r.m) && !r.ch).length : 0;
    $('[data-markloaned]').innerHTML = pendingLoaned && mFilter === 'onLoan'
      ? `<button type="button" class="btn sm" data-markall>${icon('handoff')}${esc(t('inventory.markLoaned', { n: pendingLoaned }))}</button>` : '';
  }
  function selectTab(which, focus = false) {
    tab = which;
    ['a', 'm'].forEach((k) => {
      const b = $('#inv-tab-' + k);
      const on = k === which;
      b.setAttribute('aria-selected', on ? 'true' : 'false');
      b.tabIndex = on ? 0 : -1;
      $('#inv-panel-' + k).hidden = !on;
      if (on && focus) b.focus();
    });
  }
  function applyAFilter() {
    const qq = norm(aSearch);
    let shown = 0;
    for (const r of aRows) {
      let vis = true;
      if (aFilter === 'counted') vis = !!r.c;
      else if (aFilter === 'open') vis = !r.c;
      else if (aFilter === 'diff') vis = !!r.c && diffOf(r) !== 0;
      if (vis && locPath) {
        const p = r.a.location_path || '';
        vis = p === locPath || p.startsWith(locPath + ' / ');
      }
      if (vis && qq) vis = norm(`${r.a.name} ${r.a.code} ${r.a.location_path || ''} ${r.a.category || ''} ${r.a.brand || ''}`).includes(qq);
      r.el.hidden = !vis;
      if (vis) shown++;
    }
    aList.hidden = shown === 0;
    $('[data-aempty]').hidden = shown > 0;
    $('[data-loc]').innerHTML = locPath
      ? `<div class="chips"><button type="button" class="chip" aria-pressed="true" data-clearloc aria-label="${esc(t('inventory.clearLoc'))}">${icon('location')} ${esc(t('inventory.locFilter', { path: locPath }))} ${icon('x')}</button></div>` : '';
  }
  function applyMFilter() {
    const qq = norm(mSearch);
    let shown = 0;
    for (const r of mRows) {
      let vis = true;
      if (mFilter === 'checked') vis = !!r.ch;
      else if (mFilter === 'open') vis = !r.ch;
      else if (mFilter === 'problems') vis = !!r.ch && (r.ch.result === 'fehlt' || r.ch.result === 'defekt');
      else if (mFilter === 'onLoan') vis = onLoan(r.m);
      if (vis && qq) vis = norm(`${r.m.name} ${r.m.code} ${r.m.location_path || ''} ${r.m.brand || ''} ${r.m.open_borrower_name || ''}`).includes(qq);
      r.el.hidden = !vis;
      if (vis) shown++;
    }
    mList.hidden = shown === 0;
    $('[data-mempty]').hidden = shown > 0;
  }

  // ----- Speichern -----
  async function saveCount(r, inp) {
    const raw = String(inp.value || '').trim();
    if (raw === '') return false;
    const st = r.el.querySelector('[data-state]');
    const v = numOrNull(raw);
    if (v === null || v < 0) {
      inp.setAttribute('aria-invalid', 'true');
      st.style.color = 'var(--danger)';
      st.innerHTML = icon('alert');
      toast(t('err.invalid_qty'), 'error');
      return false;
    }
    inp.removeAttribute('aria-invalid');
    if (r.inflight === v) return true;
    if (r.inflight === undefined && r.c && num(r.c.counted) === v) return true;
    const seq = (r.seq = (r.seq || 0) + 1);
    r.inflight = v;
    st.style.color = 'var(--muted)';
    st.textContent = '…';
    st.title = t('inventory.saving');
    try {
      const c = await api.countArticle(inv.id, r.a.id, v);
      if (seq !== r.seq) return true;
      r.c = Object.assign({}, r.c || {}, c || {});
      r.c.counted = v;
      if (r.c.expected === undefined || r.c.expected === null) r.c.expected = r.a.stock;
      if (!r.c.counted_by) r.c.counted_by = user && user.id;
      if (!r.c.counted_at) r.c.counted_at = new Date().toISOString();
      st.style.color = 'var(--ok)';
      st.innerHTML = icon('check');
      st.title = t('inventory.saved');
      refreshARow(r);
      renderSummary();
      return true;
    } catch (err) {
      if (seq === r.seq) {
        st.style.color = 'var(--danger)';
        st.innerHTML = icon('alert');
        toast(errorText(err), 'error');
        if (err && err.code === 'inventory_closed') setTimeout(() => ctx.reload(), 1200);
      }
      return false;
    } finally {
      if (seq === r.seq) r.inflight = undefined;
    }
  }

  async function saveCheck(r, res, note) {
    const ch = await api.checkMachine(inv.id, r.m.id, res, note);
    r.ch = Object.assign({}, ch || {}, { result: res, note: note || null });
    if (!r.ch.checked_by) r.ch.checked_by = user && user.id;
    if (!r.ch.checked_at) r.ch.checked_at = new Date().toISOString();
    refreshMRow(r);
    renderSummary();
  }

  async function chooseResult(r, res) {
    if (r.ch && r.ch.result === res && res !== 'fehlt' && res !== 'defekt') return;
    if (res === 'fehlt' || res === 'defekt') {
      const prev = r.ch && r.ch.note ? r.ch.note : '';
      await sheet({
        title: `${t('inventory.res.' + res)} – ${r.m.name}`,
        body: `<div class="field"><label for="inv-mnote">${esc(t('common.note'))} <span class="muted">(${esc(t('common.optional'))})</span></label>
          <textarea id="inv-mnote" rows="3">${esc(prev)}</textarea><p class="hint">${esc(t('inventory.noteHint'))}</p></div>`,
        actions: [
          { label: t('btn.cancel'), kind: 'ghost', value: null },
          {
            label: t('btn.save'), kind: res === 'fehlt' ? 'danger' : 'primary',
            onClick: async (sh) => { await saveCheck(r, res, clean(sh.querySelector('#inv-mnote').value) || null); return true; },
          },
        ],
      });
      return;
    }
    try { await saveCheck(r, res, null); } catch (err) { toast(errorText(err), 'error'); }
  }

  function focusArticle(r, fromScan) {
    selectTab('a');
    if (r.el.hidden) {
      aFilter = 'all'; aSearch = '';
      const p = r.a.location_path || '';
      if (locPath && !(p === locPath || p.startsWith(locPath + ' / '))) locPath = '';
      $('[data-asearch]').value = '';
      renderSummary();
      applyAFilter();
    }
    r.fromScan = !!fromScan;
    r.el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    r.el.style.background = 'var(--accent-soft)';
    setTimeout(() => { r.el.style.background = ''; }, 1800);
    const inp = r.el.querySelector('[data-ist]');
    if (inp) setTimeout(() => { try { inp.focus({ preventScroll: true }); inp.select(); } catch (e) { /* egal */ } }, 300);
  }

  // ----- Scannen -----
  let scanner = null;
  function closeScanner() {
    if (scanner) { try { scanner.close(); } catch (e) { /* schon zu */ } }
    scanner = null;
  }
  async function handleCode(code, raw) {
    const c = String(code || parseScanned(raw) || '').trim().toUpperCase();
    if (!c) { toast(t('scan.unknown', { text: raw || '' }), 'error'); return; }
    if (c.startsWith('M-')) {
      const r = mRows.find((x) => String(x.m.code).toUpperCase() === c);
      if (!r) { toast(t('inventory.scanNotFound', { code: c }), 'error'); return; }
      try {
        await saveCheck(r, 'vorhanden', null);
        toast(t('inventory.scanMachineOk', { code: r.m.code, name: r.m.name }));
      } catch (err) { toast(errorText(err), 'error'); }
      return;
    }
    if (c.startsWith('L-')) {
      let loc = null;
      try { loc = await api.getLocationByCode(c); } catch (e) { loc = null; }
      if (!loc || !loc.path) { toast(t('inventory.scanNotFound', { code: c }), 'error'); return; }
      closeScanner();
      locPath = loc.path;
      aFilter = 'all';
      selectTab('a');
      renderSummary();
      applyAFilter();
      toast(t('inventory.scanLocation', { path: loc.path }), 'info');
      return;
    }
    const r = aRows.find((x) => String(x.a.code).toUpperCase() === c);
    if (!r) { toast(t('inventory.scanNotFound', { code: c }), 'error'); return; }
    closeScanner();
    focusArticle(r, true);
  }
  async function startScan() {
    let mod;
    try { mod = await import('../scanner.js'); } catch (err) { toast(t('err.camera'), 'error'); return; }
    closeScanner();
    scanner = mod.openScanner({
      title: t('inventory.scanTitle'),
      hint: t('inventory.scanHint'),
      continuous: true,
      onCode: (code, raw) => handleCode(code, raw),
    });
  }

  // ----- Export -----
  function exportArticles() {
    const rows = [[t('common.code'), t('common.name'), t('inventory.colLocation'), t('common.unit'), t('inventory.soll'),
      t('inventory.ist'), t('inventory.diff'), t('inventory.countedByCol'), t('inventory.countedAtCol')]];
    for (const r of aRows) {
      rows.push([r.a.code, r.a.name, r.a.location_path || '', unitLabel(r.a.unit), soll(r),
        r.c ? num(r.c.counted) : '', r.c ? diffOf(r) : '', r.c ? nameOf(r.c.counted_by) : '', r.c ? fmtDateTime(r.c.counted_at) : '']);
    }
    downloadCsv(`${slug(inv.name)}-${slug(t('inventory.tabArticles'))}.csv`, rows);
  }
  function exportMachines() {
    const rows = [[t('common.code'), t('common.name'), t('inventory.result'), t('common.note'),
      t('inventory.checkedByCol'), t('inventory.checkedAtCol'), t('common.status')]];
    for (const r of mRows) {
      rows.push([r.m.code, r.m.name, r.ch ? t('inventory.res.' + r.ch.result) : '', r.ch && r.ch.note ? r.ch.note : '',
        r.ch ? nameOf(r.ch.checked_by) : '', r.ch ? fmtDateTime(r.ch.checked_at) : '', t('status.' + r.m.status)]);
    }
    downloadCsv(`${slug(inv.name)}-${slug(t('inventory.tabMachines'))}.csv`, rows);
  }
  function printPdf() {
    const c = counts();
    const aBody = aRows.map((r) => {
      const d = diffOf(r);
      return `<tr><td>${esc(r.a.code)}</td><td>${esc(r.a.name)}</td><td>${esc(r.a.location_path || '')}</td>
        <td class="n">${esc(fmtQty(soll(r), r.a.unit))}</td><td class="n">${r.c ? esc(fmtQty(num(r.c.counted), r.a.unit)) : '–'}</td>
        <td class="n">${d === null ? '' : esc(diffText(d, r.a.unit))}</td><td>${r.c ? esc(nameOf(r.c.counted_by)) : ''}</td></tr>`;
    }).join('');
    const mBody = mRows.map((r) => `<tr><td>${esc(r.m.code)}</td><td>${esc(r.m.name)}</td>
      <td>${r.ch ? esc(t('inventory.res.' + r.ch.result)) : '–'}</td><td>${r.ch && r.ch.note ? esc(r.ch.note) : ''}</td>
      <td>${onLoan(r.m) ? esc(t('inventory.onLoanBy', { name: r.m.open_borrower_name || '–', d: fmtDate(r.m.open_since) })) : ''}</td>
      <td>${r.ch ? esc(nameOf(r.ch.checked_by)) : ''}</td></tr>`).join('');
    const meta = [
      t('inventory.st.' + inv.status),
      t('inventory.startedAt', { d: fmtDateTime(inv.started_at) }) + ' ' + t('inventory.startedBy', { name: startedWho }),
    ];
    if (!open) meta.push(t('inventory.closedInfo', { d: fmtDateTime(inv.closed_at), name: nameOf(inv.closed_by) }), inv.applied ? t('inventory.applied') : t('inventory.notApplied'));
    const pa = printArea();
    pa.innerHTML = `<style>
      @page { size: A4 portrait; margin: 12mm; }
      .inv-print { font: 9.5pt/1.35 "Segoe UI", Arial, sans-serif; color: #000; background: #fff; }
      .inv-print h1 { font-size: 16pt; margin: 0 0 4pt; }
      .inv-print h2 { font-size: 12pt; margin: 14pt 0 5pt; }
      .inv-print p { margin: 0 0 4pt; }
      .inv-print table { width: 100%; border-collapse: collapse; }
      .inv-print th, .inv-print td { border: 1px solid #999; padding: 2pt 4pt; text-align: left; vertical-align: top; }
      .inv-print th { background: #eee; }
      .inv-print td.n { text-align: right; white-space: nowrap; }
      .inv-print tr { break-inside: avoid; }
      .inv-print .sum { display: flex; flex-wrap: wrap; gap: 6pt 18pt; margin: 6pt 0; }
      .inv-print .sign { display: flex; gap: 36pt; margin-top: 28pt; }
      .inv-print .sign div { border-top: 1px solid #000; padding-top: 2pt; min-width: 170pt; }
    </style>
    <div class="inv-print">
      <h1>${esc(t('inventory.printTitle', { name: inv.name }))}</h1>
      <p>${esc(meta.join(' · '))}</p>
      ${inv.note ? `<p>${esc(inv.note)}</p>` : ''}
      <div class="sum">
        <span>${esc(t('inventory.sumCounted'))}: <b>${c.counted}/${c.total}</b></span>
        <span>${esc(t('inventory.sumDiff'))}: <b>${c.diffs}</b></span>
        <span>${esc(t('inventory.sumChecked'))}: <b>${c.checked}/${c.mTotal}</b></span>
        <span>${esc(t('inventory.sumMissing'))}: <b>${c.missing}</b>${c.defect ? ' ' + esc(t('inventory.sumDefect', { n: c.defect })) : ''}</span>
      </div>
      <h2>${esc(t('inventory.tabArticles'))}</h2>
      <table><thead><tr><th>${esc(t('common.code'))}</th><th>${esc(t('common.name'))}</th><th>${esc(t('inventory.colLocation'))}</th>
        <th>${esc(t('inventory.soll'))}</th><th>${esc(t('inventory.ist'))}</th><th>${esc(t('inventory.diff'))}</th><th>${esc(t('inventory.countedByCol'))}</th></tr></thead>
        <tbody>${aBody}</tbody></table>
      <h2>${esc(t('inventory.tabMachines'))}</h2>
      <table><thead><tr><th>${esc(t('common.code'))}</th><th>${esc(t('common.name'))}</th><th>${esc(t('inventory.result'))}</th>
        <th>${esc(t('common.note'))}</th><th>${esc(t('inventory.f.onLoan'))}</th><th>${esc(t('inventory.checkedByCol'))}</th></tr></thead>
        <tbody>${mBody}</tbody></table>
      <div class="sign"><div>${esc(t('inventory.signCount'))}</div><div>${esc(t('inventory.signApprove'))}</div></div>
      <p style="margin-top:10pt;color:#555">${esc(t('inventory.printed', { d: fmtDateTime(new Date().toISOString()) }))}</p>
    </div>`;
    const cleanup = () => { pa.innerHTML = ''; window.removeEventListener('afterprint', cleanup); };
    window.addEventListener('afterprint', cleanup);
    setTimeout(() => window.print(), 60);
  }
  function exportSheet() {
    sheet({
      title: t('inventory.export'),
      body: `<div class="stack">
        <button type="button" class="btn" data-x="a">${icon('download')}${esc(t('inventory.exportArticles'))}</button>
        <button type="button" class="btn" data-x="m">${icon('download')}${esc(t('inventory.exportMachines'))}</button>
        <button type="button" class="btn" data-x="p">${icon('print')}${esc(t('inventory.exportPdf'))}</button>
      </div>`,
      onOpen: (sh, close) => {
        sh.querySelectorAll('[data-x]').forEach((b) => b.addEventListener('click', () => {
          const x = b.dataset.x;
          close();
          setTimeout(() => {
            try {
              if (x === 'a') exportArticles();
              else if (x === 'm') exportMachines();
              else printPdf();
            } catch (err) { toast(errorText(err), 'error'); }
          }, 220);
        }));
      },
    });
  }

  // ----- Abschliessen -----
  async function closeSheet() {
    const diffN = aRows.filter((r) => r.c && !r.c.applied && diffOf(r) !== 0).length;
    const missing = mRows.filter((r) => r.ch && r.ch.result === 'fehlt' && r.m.status !== 'ausgeliehen').length;
    const defect = mRows.filter((r) => r.ch && r.ch.result === 'defekt' && r.m.status !== 'ausgeliehen').length;
    const uncounted = aRows.filter((r) => !r.c && !r.a.archived).length;
    const res = await sheet({
      title: t('inventory.closeTitle'),
      body: `${uncounted ? `<div class="alert warn">${icon('alert')}<div>${esc(t('inventory.closeOpenWarn', { n: uncounted }))}</div></div>` : ''}
        <label class="check" style="align-items:flex-start"><input type="checkbox" id="inv-apply" checked>
          <span><b>${esc(t('inventory.closeApply'))}</b></span></label>
        <p class="hint">${esc(t('inventory.closeApplyHint', { diff: diffN, missing, defect }))}</p>
        <p class="hint">${esc(t('inventory.closeFinal'))}</p>`,
      actions: [
        { label: t('btn.cancel'), kind: 'ghost', value: null },
        {
          label: t('inventory.closeBtn'), kind: 'primary', icon: 'check',
          onClick: async (sh) => {
            const apply = sh.querySelector('#inv-apply').checked;
            await api.closeInventory(inv.id, apply);
            return 'closed';
          },
        },
      ],
    });
    if (res === 'closed') {
      toast(t('inventory.closed'));
      ctx.reload();
    }
  }

  // ----- Ereignisse -----
  renderSummary();
  selectTab(tab);
  applyAFilter();
  applyMFilter();

  const tabs = el.querySelector('.tabs');
  tabs.addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]');
    if (b) selectTab(b.dataset.tab);
  });
  tabs.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      selectTab(tab === 'a' ? 'm' : 'a', true);
    }
  });
  $('[data-achips]').addEventListener('click', (e) => {
    const b = e.target.closest('[data-af]');
    if (!b) return;
    aFilter = b.dataset.af;
    renderSummary();
    applyAFilter();
  });
  $('[data-mchips]').addEventListener('click', (e) => {
    const b = e.target.closest('[data-mf]');
    if (!b) return;
    mFilter = b.dataset.mf;
    renderSummary();
    applyMFilter();
  });
  $('[data-loc]').addEventListener('click', (e) => {
    if (!e.target.closest('[data-clearloc]')) return;
    locPath = '';
    applyAFilter();
  });
  $('[data-asearch]').addEventListener('input', debounce((e) => { aSearch = e.target.value; applyAFilter(); }, 150));
  $('[data-msearch]').addEventListener('input', debounce((e) => { mSearch = e.target.value; applyMFilter(); }, 150));
  $('[data-markloaned]').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-markall]');
    if (!b) return;
    b.disabled = true;
    try {
      for (const r of mRows.filter((x) => onLoan(x.m) && !x.ch)) await saveCheck(r, 'ausgeliehen', null);
    } catch (err) { toast(errorText(err), 'error'); }
    renderSummary();
    applyMFilter();
  });

  if (open) {
    const rowOf = (node) => {
      const it = node.closest('[data-aid]');
      return it ? aRows.find((r) => r.a.id === it.dataset.aid) : null;
    };
    aList.addEventListener('change', (e) => {
      if (!e.target.matches('[data-ist]')) return;
      const r = rowOf(e.target);
      if (r) saveCount(r, e.target);
    });
    aList.addEventListener('keydown', async (e) => {
      if (e.key !== 'Enter' || !e.target.matches('[data-ist]')) return;
      e.preventDefault();
      const r = rowOf(e.target);
      if (!r) return;
      const ok = await saveCount(r, e.target);
      if (!ok) return;
      if (r.fromScan) {
        r.fromScan = false;
        e.target.blur();
        startScan();
        return;
      }
      const visible = aRows.filter((x) => !x.el.hidden);
      const i = visible.indexOf(r);
      const next = visible[i + 1] && visible[i + 1].el.querySelector('[data-ist]');
      if (next) { next.focus(); next.select(); } else e.target.blur();
    });
    mList.addEventListener('click', (e) => {
      const b = e.target.closest('[data-res]');
      if (!b) return;
      const it = b.closest('[data-mid]');
      const r = it && mRows.find((x) => x.m.id === it.dataset.mid);
      if (r) chooseResult(r, b.dataset.res);
    });
    const scanBtn = $('[data-scan]');
    if (scanBtn) scanBtn.addEventListener('click', startScan);
  }
  $('[data-export]').addEventListener('click', exportSheet);
  const closeBtn = $('[data-close]');
  if (closeBtn) closeBtn.addEventListener('click', closeSheet);
}

export const routes = {
  'inventur': listRoute,
  'inventur/:id': detailRoute,
};
