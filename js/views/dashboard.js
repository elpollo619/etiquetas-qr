// Übersicht (Startseite): eigene Ausleihen, Kennzahlen, Schnellzugriff, Listen und Aktivität
import { t, registerStrings, fmtDate, fmtDateTime, fmtElapsed, fmtNum, fmtQty } from '../i18n.js';
import { esc, can, icon, errorText, toast, routeForCode, conditionLabel } from '../util.js';

registerStrings({
  de: {
    'dashboard.morning': 'Guten Morgen', 'dashboard.day': 'Guten Tag', 'dashboard.evening': 'Guten Abend',
    'dashboard.greeting': '{greet}, {name}',
    'dashboard.sub': 'Was möchtest du tun?',
    'dashboard.myLoansOne': 'Du hast 1 Maschine ausgeliehen:',
    'dashboard.myLoansMany': 'Du hast {n} Maschinen ausgeliehen:',
    'dashboard.giveBack': 'zurückgeben',
    'dashboard.since': 'seit {t}',
    'dashboard.dueOn': 'Rückgabe bis {d}',
    'dashboard.overdueSince': 'überfällig seit {t}',
    'dashboard.figures': 'Zahlen',
    'dashboard.shortcuts': 'Schnellzugriff',
    'dashboard.statArticles': 'Artikel total',
    'dashboard.statMachines': 'Maschinen total',
    'dashboard.statAvailable': 'Verfügbar',
    'dashboard.statLoaned': 'Ausgeliehen',
    'dashboard.statOverdue': 'Überfällig',
    'dashboard.statDefect': 'Defekt',
    'dashboard.statLow': 'Wenig Bestand',
    'dashboard.overdueTitle': 'Überfällige Rückgaben',
    'dashboard.overdueNone': 'Keine überfälligen Rückgaben.',
    'dashboard.lowTitle': 'Wenig Bestand',
    'dashboard.lowNone': 'Alle Artikel haben genügend Bestand.',
    'dashboard.movementsTitle': 'Letzte Bewegungen',
    'dashboard.movementsNone': 'Noch keine Bewegungen.',
    'dashboard.returnsTitle': 'Letzte Rückgaben',
    'dashboard.returnsNone': 'Noch keine Rückgaben.',
    'dashboard.activityTitle': 'Aktivität der Mitarbeiter',
    'dashboard.activityNone': 'Noch keine Aktivität.',
    'dashboard.showAll': 'Alle anzeigen',
    'dashboard.minStock': 'Min. {n}',
    'dashboard.returnedBy': 'zurückgegeben von {name}',
    'dashboard.borrowedBy': 'ausgeliehen von {name}',
    'dashboard.someone': 'Jemand',
    'dashboard.act.checkout': '{name} hat {item} ausgeliehen',
    'dashboard.act.checkoutFor': '{name} hat {item} für {other} ausgeliehen',
    'dashboard.act.return': '{name} hat {item} zurückgegeben',
    'dashboard.act.returnFor': '{name} hat {item} für {other} zurückgegeben',
    'dashboard.act.zugang': '{name} hat {qty} {item} zugebucht',
    'dashboard.act.entnahme': '{name} hat {qty} {item} entnommen',
    'dashboard.act.umlagerung': '{name} hat {item} umgelagert',
    'dashboard.act.korrektur': '{name} hat den Bestand von {item} korrigiert',
    'dashboard.act.inventur': '{name} hat den Bestand von {item} per Inventur angepasst',
    'dashboard.act.anlage': '{name} hat {item} mit {qty} angelegt',
    'dashboard.justNow': 'gerade eben',
    'dashboard.agoMin': 'vor {n} Min',
    'dashboard.agoH': 'vor {n} Std',
    'dashboard.agoDay': 'vor 1 Tag',
    'dashboard.agoDays': 'vor {n} Tagen',
  },
  pt: {
    'dashboard.morning': 'Bom dia', 'dashboard.day': 'Boa tarde', 'dashboard.evening': 'Boa noite',
    'dashboard.greeting': '{greet}, {name}',
    'dashboard.sub': 'O que queres fazer?',
    'dashboard.myLoansOne': 'Tens 1 máquina emprestada:',
    'dashboard.myLoansMany': 'Tens {n} máquinas emprestadas:',
    'dashboard.giveBack': 'devolver',
    'dashboard.since': 'há {t}',
    'dashboard.dueOn': 'Devolver até {d}',
    'dashboard.overdueSince': 'em atraso há {t}',
    'dashboard.figures': 'Números',
    'dashboard.shortcuts': 'Acesso rápido',
    'dashboard.statArticles': 'Total de artigos',
    'dashboard.statMachines': 'Total de máquinas',
    'dashboard.statAvailable': 'Disponíveis',
    'dashboard.statLoaned': 'Emprestadas',
    'dashboard.statOverdue': 'Em atraso',
    'dashboard.statDefect': 'Avariadas',
    'dashboard.statLow': 'Stock baixo',
    'dashboard.overdueTitle': 'Devoluções em atraso',
    'dashboard.overdueNone': 'Não há devoluções em atraso.',
    'dashboard.lowTitle': 'Stock baixo',
    'dashboard.lowNone': 'Todos os artigos têm stock suficiente.',
    'dashboard.movementsTitle': 'Últimos movimentos',
    'dashboard.movementsNone': 'Ainda não há movimentos.',
    'dashboard.returnsTitle': 'Últimas devoluções',
    'dashboard.returnsNone': 'Ainda não há devoluções.',
    'dashboard.activityTitle': 'Atividade dos colaboradores',
    'dashboard.activityNone': 'Ainda não há atividade.',
    'dashboard.showAll': 'Ver tudo',
    'dashboard.minStock': 'Mín. {n}',
    'dashboard.returnedBy': 'devolvida por {name}',
    'dashboard.borrowedBy': 'levantada por {name}',
    'dashboard.someone': 'Alguém',
    'dashboard.act.checkout': '{name} levantou {item}',
    'dashboard.act.checkoutFor': '{name} levantou {item} para {other}',
    'dashboard.act.return': '{name} devolveu {item}',
    'dashboard.act.returnFor': '{name} devolveu {item} em nome de {other}',
    'dashboard.act.zugang': '{name} deu entrada de {qty} {item}',
    'dashboard.act.entnahme': '{name} retirou {qty} {item}',
    'dashboard.act.umlagerung': '{name} transferiu {item}',
    'dashboard.act.korrektur': '{name} corrigiu o stock de {item}',
    'dashboard.act.inventur': '{name} ajustou o stock de {item} no inventário',
    'dashboard.act.anlage': '{name} criou {item} com {qty}',
    'dashboard.justNow': 'agora mesmo',
    'dashboard.agoMin': 'há {n} min',
    'dashboard.agoH': 'há {n} h',
    'dashboard.agoDay': 'há 1 dia',
    'dashboard.agoDays': 'há {n} dias',
  },
  es: {
    'dashboard.morning': 'Buenos días', 'dashboard.day': 'Buenas tardes', 'dashboard.evening': 'Buenas noches',
    'dashboard.greeting': '{greet}, {name}',
    'dashboard.sub': '¿Qué quieres hacer?',
    'dashboard.myLoansOne': 'Tienes 1 máquina prestada:',
    'dashboard.myLoansMany': 'Tienes {n} máquinas prestadas:',
    'dashboard.giveBack': 'devolver',
    'dashboard.since': 'desde hace {t}',
    'dashboard.dueOn': 'Devolver antes del {d}',
    'dashboard.overdueSince': 'con retraso desde hace {t}',
    'dashboard.figures': 'Cifras',
    'dashboard.shortcuts': 'Accesos rápidos',
    'dashboard.statArticles': 'Artículos en total',
    'dashboard.statMachines': 'Máquinas en total',
    'dashboard.statAvailable': 'Disponibles',
    'dashboard.statLoaned': 'Prestadas',
    'dashboard.statOverdue': 'Con retraso',
    'dashboard.statDefect': 'Defectuosas',
    'dashboard.statLow': 'Stock bajo',
    'dashboard.overdueTitle': 'Devoluciones con retraso',
    'dashboard.overdueNone': 'No hay devoluciones con retraso.',
    'dashboard.lowTitle': 'Stock bajo',
    'dashboard.lowNone': 'Todos los artículos tienen stock suficiente.',
    'dashboard.movementsTitle': 'Últimos movimientos',
    'dashboard.movementsNone': 'Aún no hay movimientos.',
    'dashboard.returnsTitle': 'Últimas devoluciones',
    'dashboard.returnsNone': 'Aún no hay devoluciones.',
    'dashboard.activityTitle': 'Actividad de los empleados',
    'dashboard.activityNone': 'Aún no hay actividad.',
    'dashboard.showAll': 'Ver todo',
    'dashboard.minStock': 'Mín. {n}',
    'dashboard.returnedBy': 'devuelta por {name}',
    'dashboard.borrowedBy': 'retirada por {name}',
    'dashboard.someone': 'Alguien',
    'dashboard.act.checkout': '{name} ha retirado {item}',
    'dashboard.act.checkoutFor': '{name} ha retirado {item} para {other}',
    'dashboard.act.return': '{name} ha devuelto {item}',
    'dashboard.act.returnFor': '{name} ha devuelto {item} en nombre de {other}',
    'dashboard.act.zugang': '{name} ha dado entrada a {qty} {item}',
    'dashboard.act.entnahme': '{name} ha retirado {qty} {item}',
    'dashboard.act.umlagerung': '{name} ha trasladado {item}',
    'dashboard.act.korrektur': '{name} ha corregido el stock de {item}',
    'dashboard.act.inventur': '{name} ha ajustado el stock de {item} en el inventario',
    'dashboard.act.anlage': '{name} ha creado {item} con {qty}',
    'dashboard.justNow': 'ahora mismo',
    'dashboard.agoMin': 'hace {n} min',
    'dashboard.agoH': 'hace {n} h',
    'dashboard.agoDay': 'hace 1 día',
    'dashboard.agoDays': 'hace {n} días',
  },
});

// ---------- private Hilfen ----------
const href = (code) => '#/' + routeForCode(code);
const ts = (iso) => { const n = new Date(iso || 0).getTime(); return Number.isFinite(n) ? n : 0; };

function ago(iso) {
  if (!iso) return '–';
  const ms = Date.now() - ts(iso);
  const min = Math.max(0, Math.floor(ms / 60000));
  if (min < 1) return t('dashboard.justNow');
  if (min < 60) return t('dashboard.agoMin', { n: min });
  const h = Math.floor(min / 60);
  if (h < 24) return t('dashboard.agoH', { n: h });
  const d = Math.floor(h / 24);
  if (d === 1) return t('dashboard.agoDay');
  if (d < 14) return t('dashboard.agoDays', { n: d });
  return fmtDate(iso);
}

function greetWord() {
  const h = new Date().getHours();
  if (h < 12) return t('dashboard.morning');
  if (h < 18) return t('dashboard.day');
  return t('dashboard.evening');
}

function firstName(full) {
  const s = String(full || '').trim();
  return s ? s.split(/\s+/)[0] : '';
}

function section(title, inner, moreHref) {
  return `<section class="section" aria-label="${esc(title)}">
    <div class="section-head"><h2>${esc(title)}</h2>${moreHref
      ? `<a class="btn ghost sm" href="${esc(moreHref)}">${esc(t('dashboard.showAll'))}${icon('chevron')}</a>` : ''}</div>
    ${inner}
  </section>`;
}
const noneCard = (text) => `<div class="card"><p class="muted small" style="margin:0">${esc(text)}</p></div>`;

function signedQty(q, unit) {
  const n = Number(q) || 0;
  return (n > 0 ? '+' : n < 0 ? '−' : '±') + fmtQty(Math.abs(n), unit);
}

// ---------- Bausteine ----------
function myLoansHtml(mine) {
  if (!mine.length) return '';
  const anyOverdue = mine.some((l) => l.overdue);
  const head = mine.length === 1 ? t('dashboard.myLoansOne') : t('dashboard.myLoansMany', { n: mine.length });
  const items = mine.map((l) => {
    const when = l.overdue
      ? t('dashboard.overdueSince', { t: fmtElapsed(l.due_at) })
      : t('dashboard.since', { t: fmtElapsed(l.checked_out_at) });
    return `<li><a href="${esc(href(l.machine_code))}"><b>${esc(l.machine_name)}</b> <span class="mono">(${esc(l.machine_code)})</span> – ${esc(t('dashboard.giveBack'))}</a>
      <span class="small"> · ${esc(when)}</span></li>`;
  }).join('');
  return `<div class="alert${anyOverdue ? ' danger' : ''}" role="status">${icon(anyOverdue ? 'alert' : 'handoff')}
    <div><strong>${esc(head)}</strong><ul style="margin:4px 0 0;padding-left:18px">${items}</ul></div></div>`;
}

function statsHtml({ machines, articles, openLoans }) {
  const cnt = (st) => machines.filter((m) => m.status === st).length;
  const overdue = openLoans.filter((l) => l.overdue).length;
  const low = articles.filter((a) => a.low_stock).length;
  const tiles = [
    { n: articles.length, label: t('dashboard.statArticles'), href: '#/artikel' },
    { n: machines.length, label: t('dashboard.statMachines'), href: '#/maschinen' },
    { n: cnt('verfuegbar'), label: t('dashboard.statAvailable'), href: '#/maschinen?status=verfuegbar', cls: 'ok' },
    { n: cnt('ausgeliehen'), label: t('dashboard.statLoaned'), href: '#/ausgeliehen', cls: 'info' },
    { n: overdue, label: t('dashboard.statOverdue'), href: '#/ausgeliehen?filter=overdue', cls: overdue ? 'danger' : '' },
    { n: cnt('defekt'), label: t('dashboard.statDefect'), href: '#/maschinen?status=defekt' },
    { n: low, label: t('dashboard.statLow'), href: '#/artikel?filter=low', cls: low ? 'warn' : '' },
  ];
  return `<section class="section" aria-label="${esc(t('dashboard.figures'))}"><h2 class="sr-only">${esc(t('dashboard.figures'))}</h2>
    <div class="stats">${tiles.map((x) => `<a class="stat ${x.cls || ''}" href="${esc(x.href)}">
      <span class="stat-num">${esc(fmtNum(x.n))}</span><span class="stat-label">${esc(x.label)}</span></a>`).join('')}</div></section>`;
}

function shortcutsHtml(user) {
  const items = [
    { href: '#/scan', ic: 'scan', label: t('btn.scan'), cls: 'primary' },
    { href: '#/artikel', ic: 'box', label: t('nav.articles') },
    { href: '#/maschinen', ic: 'machine', label: t('nav.machines') },
    { href: '#/lagerorte', ic: 'location', label: t('nav.locations') },
    { href: '#/ausgeliehen', ic: 'handoff', label: t('nav.loans') },
    { href: '#/inventur', ic: 'clipboard', label: t('nav.inventory') },
  ];
  if (can(user, 'staff')) items.push({ href: '#/mitarbeiter', ic: 'users', label: t('nav.employees') });
  return `<section class="section" aria-label="${esc(t('dashboard.shortcuts'))}"><h2>${esc(t('dashboard.shortcuts'))}</h2>
    <nav class="shortcuts">${items.map((s) => `<a class="shortcut ${s.cls || ''}" href="${esc(s.href)}">${icon(s.ic)}<span>${esc(s.label)}</span></a>`).join('')}</nav></section>`;
}

function overdueHtml(openLoans) {
  const list = openLoans.filter((l) => l.overdue).sort((a, b) => ts(a.due_at) - ts(b.due_at));
  if (!list.length) return section(t('dashboard.overdueTitle'), noneCard(t('dashboard.overdueNone')));
  return section(t('dashboard.overdueTitle'), `<div class="list">${list.slice(0, 8).map((l) => `
    <a class="list-item" href="${esc(href(l.machine_code))}">
      <div class="li-main"><span class="li-title">${esc(l.machine_name)}</span>
        <span class="li-sub"><span class="mono">${esc(l.machine_code)}</span> · ${esc(l.borrower_name || '–')} · ${esc(t('dashboard.dueOn', { d: fmtDateTime(l.due_at) }))}</span></div>
      <div class="li-end"><span class="pill pill-danger">${esc(t('dashboard.overdueSince', { t: fmtElapsed(l.due_at) }))}</span></div>
    </a>`).join('')}</div>`, list.length > 8 ? '#/ausgeliehen?filter=overdue' : '');
}

function lowStockHtml(articles) {
  const list = articles.filter((a) => a.low_stock)
    .sort((a, b) => (Number(a.stock) - Number(a.min_stock || 0)) - (Number(b.stock) - Number(b.min_stock || 0)));
  if (!list.length) return section(t('dashboard.lowTitle'), noneCard(t('dashboard.lowNone')));
  return section(t('dashboard.lowTitle'), `<div class="list">${list.slice(0, 8).map((a) => `
    <a class="list-item" href="${esc(href(a.code))}">
      <div class="li-main"><span class="li-title">${esc(a.name)}</span>
        <span class="li-sub"><span class="mono">${esc(a.code)}</span>${a.location_path ? ' · ' + esc(a.location_path) : ''}</span></div>
      <div class="li-end"><span class="pill pill-warn">${esc(fmtQty(a.stock, a.unit))}</span>
        <span class="muted">${esc(t('dashboard.minStock', { n: fmtNum(a.min_stock) }))}</span></div>
    </a>`).join('')}</div>`, '#/artikel?filter=low');
}

function movementsHtml(movements) {
  const list = movements.slice(0, 8);
  if (!list.length) return section(t('dashboard.movementsTitle'), noneCard(t('dashboard.movementsNone')));
  return section(t('dashboard.movementsTitle'), `<div class="list">${list.map((m) => `
    <a class="list-item" href="${esc(href(m.article_code))}">
      <div class="li-main"><span class="li-title">${esc(m.article_name)}</span>
        <span class="li-sub">${esc(t('mv.' + m.type))} · ${esc(m.user_name || '–')} · ${esc(ago(m.created_at))}</span></div>
      <div class="li-end"><span class="pill ${Number(m.qty) < 0 ? 'pill-warn' : Number(m.qty) > 0 ? 'pill-ok' : 'pill-muted'}">${esc(signedQty(m.qty, m.unit))}</span></div>
    </a>`).join('')}</div>`);
}

function returnsHtml(returns) {
  const list = returns.slice(0, 8);
  if (!list.length) return section(t('dashboard.returnsTitle'), noneCard(t('dashboard.returnsNone')));
  return section(t('dashboard.returnsTitle'), `<div class="list">${list.map((l) => {
    const cond = l.return_condition || 'ok';
    const pill = cond === 'ok' ? 'pill-ok' : cond === 'maengel' ? 'pill-warn' : 'pill-danger';
    const who = l.returned_by && l.returned_by !== l.borrower_id
      ? `${t('dashboard.returnedBy', { name: l.returned_by_name || '–' })} · ${t('dashboard.borrowedBy', { name: l.borrower_name || '–' })}`
      : t('dashboard.returnedBy', { name: l.returned_by_name || l.borrower_name || '–' });
    return `<a class="list-item" href="${esc(href(l.machine_code))}">
      <div class="li-main"><span class="li-title">${esc(l.machine_name)}</span>
        <span class="li-sub">${esc(who)} · ${esc(ago(l.returned_at))}</span></div>
      <div class="li-end"><span class="pill ${pill}">${esc(conditionLabel(cond))}</span></div>
    </a>`;
  }).join('')}</div>`, '#/ausgeliehen');
}

function activityEvents(recentLoans, returns, movements) {
  const ev = [];
  const seen = new Set();
  const b = (s) => `<b>${esc(s || t('dashboard.someone'))}</b>`;
  for (const l of recentLoans) {
    const k = 'o:' + l.id;
    if (!seen.has(k)) {
      seen.add(k);
      const other = l.created_by && l.created_by !== l.borrower_id;
      ev.push({
        at: l.checked_out_at, href: href(l.machine_code), ic: 'arrowOut',
        html: other
          ? t('dashboard.act.checkoutFor', { name: b(l.created_by_name), item: b(l.machine_name), other: esc(l.borrower_name || '–') })
          : t('dashboard.act.checkout', { name: b(l.borrower_name), item: b(l.machine_name) }),
      });
    }
  }
  for (const l of [...recentLoans, ...returns]) {
    if (!l.returned_at) continue;
    const k = 'r:' + l.id;
    if (seen.has(k)) continue;
    seen.add(k);
    const other = l.returned_by && l.returned_by !== l.borrower_id;
    ev.push({
      at: l.returned_at, href: href(l.machine_code), ic: 'arrowIn',
      html: other
        ? t('dashboard.act.returnFor', { name: b(l.returned_by_name), item: b(l.machine_name), other: esc(l.borrower_name || '–') })
        : t('dashboard.act.return', { name: b(l.returned_by_name || l.borrower_name), item: b(l.machine_name) }),
    });
  }
  for (const m of movements) {
    const key = 'dashboard.act.' + m.type;
    const qty = esc(fmtQty(Math.abs(Number(m.qty) || 0), m.unit));
    ev.push({
      at: m.created_at, href: href(m.article_code), ic: m.type === 'entnahme' ? 'minus' : m.type === 'umlagerung' ? 'move' : 'box',
      html: t(key, { name: b(m.user_name), item: b(m.article_name), qty }),
    });
  }
  return ev.sort((x, y) => ts(y.at) - ts(x.at)).slice(0, 12);
}

function activityHtml(events) {
  if (!events.length) return section(t('dashboard.activityTitle'), noneCard(t('dashboard.activityNone')));
  return section(t('dashboard.activityTitle'), `<div class="list">${events.map((e) => `
    <a class="list-item" href="${esc(e.href)}">
      <span class="thumb thumb-empty" aria-hidden="true">${icon(e.ic)}</span>
      <div class="li-main"><span class="li-title" style="white-space:normal;font-weight:500">${e.html}</span>
        <span class="li-sub"><time datetime="${esc(e.at)}" title="${esc(fmtDateTime(e.at))}">${esc(ago(e.at))}</time></span></div>
    </a>`).join('')}</div>`);
}

// ---------- Route ----------
export const routes = {
  '': async (ctx) => {
    const { el, api, user } = ctx;
    const name = firstName(user && user.full_name);
    const title = name ? t('dashboard.greeting', { greet: greetWord(), name }) : greetWord();
    if (ctx.setTitle) ctx.setTitle(t('nav.home'));
    const head = `<div class="page-head"><div><h1>${esc(title)}</h1><div class="sub">${esc(t('dashboard.sub'))}</div></div></div>`;
    el.innerHTML = `<div class="page">${head}<p class="muted" role="status">${esc(t('common.loading'))}</p></div>`;

    let machines, articles, openLoans, returned, recentLoans, movements;
    try {
      [machines, articles, openLoans, returned, recentLoans, movements] = await Promise.all([
        api.listMachines(),
        api.listArticles(),
        api.listLoans({ open: true }),
        api.listLoans({ open: false, limit: 20 }),
        api.listLoans({ limit: 20 }),
        api.listMovements({ limit: 20 }),
      ]);
    } catch (err) {
      toast(errorText(err), 'error');
      el.innerHTML = `<div class="page">${head}
        <div class="alert danger" role="alert">${icon('alert')}<div>${esc(errorText(err))}</div></div>
        <div><button type="button" class="btn" data-retry>${icon('history')}${esc(t('btn.retry'))}</button></div></div>`;
      el.querySelector('[data-retry]').addEventListener('click', () => ctx.reload());
      return;
    }
    machines = machines || []; articles = articles || []; openLoans = openLoans || [];
    movements = movements || []; recentLoans = recentLoans || [];
    const returns = (returned || []).filter((l) => l.returned_at).sort((a, b) => ts(b.returned_at) - ts(a.returned_at));
    const mine = openLoans.filter((l) => user && l.borrower_id === user.id)
      .sort((a, b) => ts(a.checked_out_at) - ts(b.checked_out_at));

    el.innerHTML = `<div class="page">
      ${head}
      ${myLoansHtml(mine)}
      ${statsHtml({ machines, articles, openLoans })}
      ${shortcutsHtml(user)}
      <div class="grid-2">
        ${overdueHtml(openLoans)}
        ${lowStockHtml(articles)}
      </div>
      <div class="grid-2">
        ${movementsHtml(movements)}
        ${returnsHtml(returns)}
      </div>
      ${activityHtml(activityEvents(recentLoans, returns, movements))}
    </div>`;
  },
};
