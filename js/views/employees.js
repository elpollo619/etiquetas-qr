// Mitarbeiter: Liste, Freigabe, Rollen, Detail mit Ausleihen und Materialbewegungen
import { t, registerStrings, LANGS, fmtDate, fmtDateTime, fmtElapsed, fmtQty } from '../i18n.js';
import {
  esc, clean, can, icon, emptyHtml, errorText, toast, sheet, confirmSheet, roleLabel, conditionLabel,
  routeForCode, debounce,
} from '../util.js';

registerStrings({
  de: {
    'employees.title': 'Mitarbeiter',
    'employees.howTitle': 'So kommen neue Mitarbeiter dazu',
    'employees.howText': 'Neue Mitarbeiter öffnen die App, tippen auf «Konto erstellen» und registrieren sich mit ihrer E-Mail-Adresse. Danach erscheinen sie hier unter «Wartet auf Freigabe». Ein Administrator gibt das Konto frei und wählt die Rolle.',
    'employees.appLink': 'Link zur App',
    'employees.copy': 'Link kopieren',
    'employees.copied': 'Link kopiert.',
    'employees.pending': 'Wartet auf Freigabe',
    'employees.pendingHint': 'Neue oder gesperrte Konten. Erst nach der Freigabe kann die Person Maschinen ausleihen und Material buchen.',
    'employees.activeList': 'Aktive Mitarbeiter',
    'employees.search': 'Name oder E-Mail suchen…',
    'employees.none': 'Keine Mitarbeiter gefunden.',
    'employees.approve': 'Freigeben',
    'employees.approveTitle': 'Konto freigeben',
    'employees.approveText': '{name} ({email}) erhält Zugang zur App. Bitte die Rolle wählen.',
    'employees.approved': 'Konto freigegeben.',
    'employees.deactivate': 'Deaktivieren',
    'employees.deactivateTitle': 'Konto deaktivieren',
    'employees.deactivateText': '{name} kann danach nichts mehr ausleihen oder buchen. Der Verlauf bleibt erhalten. Das Konto kann später wieder freigegeben werden.',
    'employees.deactivated': 'Konto deaktiviert.',
    'employees.edit': 'Bearbeiten',
    'employees.editTitle': 'Mitarbeiter bearbeiten',
    'employees.saved': 'Mitarbeiter gespeichert.',
    'employees.name': 'Vor- und Nachname',
    'employees.role': 'Rolle',
    'employees.activeLabel': 'Konto aktiv (darf die App benutzen)',
    'employees.selfHint': 'Dein eigenes Konto kannst du nicht deaktivieren.',
    'employees.roleDesc.admin': 'Alles, inkl. Mitarbeiter verwalten, Löschen und Ausleihen korrigieren.',
    'employees.roleDesc.lagerverantwortlicher': 'Stammdaten, Status, Umlagerung, Inventur abschliessen, Etiketten und Protokoll.',
    'employees.roleDesc.mitarbeiter': 'Maschinen ausleihen und zurückgeben, Material entnehmen, Inventur zählen.',
    'employees.st.active': 'Aktiv',
    'employees.st.inactive': 'Nicht freigegeben',
    'employees.onLoan': '{n} ausgeliehen',
    'employees.overdueN': '{n} überfällig',
    'employees.email': 'E-Mail',
    'employees.lang': 'Sprache',
    'employees.registered': 'Registriert',
    'employees.status': 'Status',
    'employees.current': 'Aktuell ausgeliehen',
    'employees.currentNone': 'Hat zurzeit keine Maschine ausgeliehen.',
    'employees.usage': 'Nutzungsverlauf',
    'employees.usageNone': 'Noch keine Ausleihen.',
    'employees.movements': 'Materialbewegungen',
    'employees.movementsNone': 'Noch keine Materialbewegungen.',
    'employees.colMachine': 'Maschine',
    'employees.colOut': 'Ausgeliehen',
    'employees.colBack': 'Zurückgegeben',
    'employees.colDuration': 'Dauer',
    'employees.colStatus': 'Status',
    'employees.colReturnedBy': 'Zurückgegeben von',
    'employees.colDate': 'Datum',
    'employees.colArticle': 'Artikel',
    'employees.colType': 'Art',
    'employees.colQty': 'Menge',
    'employees.colStock': 'Bestand danach',
    'employees.colNote': 'Bemerkung',
    'employees.open': 'offen',
    'employees.overdue': 'überfällig',
    'employees.corrected': 'korrigiert',
    'employees.dueOn': 'Rückgabe bis {d}',
    'employees.since': 'seit {t}',
    'employees.notFound': 'Mitarbeiter nicht gefunden.',
    'employees.back': 'Alle Mitarbeiter',
    'employees.readOnly': 'Nur Administratoren können Mitarbeiter bearbeiten.',
    'employees.you': 'du',
    'employees.loansCount': '{n} Ausleihen',
  },
  pt: {
    'employees.title': 'Colaboradores',
    'employees.howTitle': 'Como entram novos colaboradores',
    'employees.howText': 'Os novos colaboradores abrem a app, tocam em «Criar conta» e registam-se com o seu e-mail. Depois aparecem aqui em «À espera de aprovação». Um administrador aprova a conta e escolhe a função.',
    'employees.appLink': 'Link da app',
    'employees.copy': 'Copiar link',
    'employees.copied': 'Link copiado.',
    'employees.pending': 'À espera de aprovação',
    'employees.pendingHint': 'Contas novas ou bloqueadas. Só depois da aprovação a pessoa pode levantar máquinas e registar material.',
    'employees.activeList': 'Colaboradores ativos',
    'employees.search': 'Pesquisar nome ou e-mail…',
    'employees.none': 'Nenhum colaborador encontrado.',
    'employees.approve': 'Aprovar',
    'employees.approveTitle': 'Aprovar conta',
    'employees.approveText': '{name} ({email}) passa a ter acesso à app. Escolhe a função.',
    'employees.approved': 'Conta aprovada.',
    'employees.deactivate': 'Desativar',
    'employees.deactivateTitle': 'Desativar conta',
    'employees.deactivateText': '{name} deixa de poder levantar máquinas ou registar movimentos. O histórico mantém-se. A conta pode voltar a ser aprovada mais tarde.',
    'employees.deactivated': 'Conta desativada.',
    'employees.edit': 'Editar',
    'employees.editTitle': 'Editar colaborador',
    'employees.saved': 'Colaborador guardado.',
    'employees.name': 'Nome e apelido',
    'employees.role': 'Função',
    'employees.activeLabel': 'Conta ativa (pode usar a app)',
    'employees.selfHint': 'Não podes desativar a tua própria conta.',
    'employees.roleDesc.admin': 'Tudo, incluindo gerir colaboradores, eliminar e corrigir empréstimos.',
    'employees.roleDesc.lagerverantwortlicher': 'Dados mestre, estados, transferências, fechar inventários, etiquetas e registo.',
    'employees.roleDesc.mitarbeiter': 'Levantar e devolver máquinas, retirar material, contar no inventário.',
    'employees.st.active': 'Ativo',
    'employees.st.inactive': 'Não aprovado',
    'employees.onLoan': '{n} emprestadas',
    'employees.overdueN': '{n} em atraso',
    'employees.email': 'E-mail',
    'employees.lang': 'Idioma',
    'employees.registered': 'Registado',
    'employees.status': 'Estado',
    'employees.current': 'Emprestadas neste momento',
    'employees.currentNone': 'Não tem nenhuma máquina emprestada.',
    'employees.usage': 'Histórico de utilização',
    'employees.usageNone': 'Ainda não há empréstimos.',
    'employees.movements': 'Movimentos de material',
    'employees.movementsNone': 'Ainda não há movimentos de material.',
    'employees.colMachine': 'Máquina',
    'employees.colOut': 'Levantada',
    'employees.colBack': 'Devolvida',
    'employees.colDuration': 'Duração',
    'employees.colStatus': 'Estado',
    'employees.colReturnedBy': 'Devolvida por',
    'employees.colDate': 'Data',
    'employees.colArticle': 'Artigo',
    'employees.colType': 'Tipo',
    'employees.colQty': 'Quantidade',
    'employees.colStock': 'Stock depois',
    'employees.colNote': 'Observação',
    'employees.open': 'em aberto',
    'employees.overdue': 'em atraso',
    'employees.corrected': 'corrigido',
    'employees.dueOn': 'Devolver até {d}',
    'employees.since': 'há {t}',
    'employees.notFound': 'Colaborador não encontrado.',
    'employees.back': 'Todos os colaboradores',
    'employees.readOnly': 'Só os administradores podem editar colaboradores.',
    'employees.you': 'tu',
    'employees.loansCount': '{n} empréstimos',
  },
  es: {
    'employees.title': 'Empleados',
    'employees.howTitle': 'Cómo se incorporan nuevos empleados',
    'employees.howText': 'Los nuevos empleados abren la app, pulsan «Crear cuenta» y se registran con su correo electrónico. Después aparecen aquí en «Pendiente de aprobación». Un administrador aprueba la cuenta y elige el rol.',
    'employees.appLink': 'Enlace a la app',
    'employees.copy': 'Copiar enlace',
    'employees.copied': 'Enlace copiado.',
    'employees.pending': 'Pendiente de aprobación',
    'employees.pendingHint': 'Cuentas nuevas o bloqueadas. Solo después de la aprobación la persona puede retirar máquinas y registrar material.',
    'employees.activeList': 'Empleados activos',
    'employees.search': 'Buscar nombre o correo…',
    'employees.none': 'No se han encontrado empleados.',
    'employees.approve': 'Aprobar',
    'employees.approveTitle': 'Aprobar cuenta',
    'employees.approveText': '{name} ({email}) tendrá acceso a la app. Elige el rol.',
    'employees.approved': 'Cuenta aprobada.',
    'employees.deactivate': 'Desactivar',
    'employees.deactivateTitle': 'Desactivar cuenta',
    'employees.deactivateText': '{name} ya no podrá retirar máquinas ni registrar movimientos. El historial se conserva. La cuenta se puede volver a aprobar más adelante.',
    'employees.deactivated': 'Cuenta desactivada.',
    'employees.edit': 'Editar',
    'employees.editTitle': 'Editar empleado',
    'employees.saved': 'Empleado guardado.',
    'employees.name': 'Nombre y apellido',
    'employees.role': 'Rol',
    'employees.activeLabel': 'Cuenta activa (puede usar la app)',
    'employees.selfHint': 'No puedes desactivar tu propia cuenta.',
    'employees.roleDesc.admin': 'Todo, incluido gestionar empleados, eliminar y corregir préstamos.',
    'employees.roleDesc.lagerverantwortlicher': 'Datos maestros, estados, traslados, cerrar inventarios, etiquetas y registro.',
    'employees.roleDesc.mitarbeiter': 'Retirar y devolver máquinas, retirar material, contar en el inventario.',
    'employees.st.active': 'Activo',
    'employees.st.inactive': 'Sin aprobar',
    'employees.onLoan': '{n} prestadas',
    'employees.overdueN': '{n} con retraso',
    'employees.email': 'Correo electrónico',
    'employees.lang': 'Idioma',
    'employees.registered': 'Registrado',
    'employees.status': 'Estado',
    'employees.current': 'Prestadas actualmente',
    'employees.currentNone': 'No tiene ninguna máquina prestada.',
    'employees.usage': 'Historial de uso',
    'employees.usageNone': 'Aún no hay préstamos.',
    'employees.movements': 'Movimientos de material',
    'employees.movementsNone': 'Aún no hay movimientos de material.',
    'employees.colMachine': 'Máquina',
    'employees.colOut': 'Retirada',
    'employees.colBack': 'Devuelta',
    'employees.colDuration': 'Duración',
    'employees.colStatus': 'Estado',
    'employees.colReturnedBy': 'Devuelta por',
    'employees.colDate': 'Fecha',
    'employees.colArticle': 'Artículo',
    'employees.colType': 'Tipo',
    'employees.colQty': 'Cantidad',
    'employees.colStock': 'Stock después',
    'employees.colNote': 'Observación',
    'employees.open': 'pendiente',
    'employees.overdue': 'con retraso',
    'employees.corrected': 'corregido',
    'employees.dueOn': 'Devolver antes del {d}',
    'employees.since': 'desde hace {t}',
    'employees.notFound': 'Empleado no encontrado.',
    'employees.back': 'Todos los empleados',
    'employees.readOnly': 'Solo los administradores pueden editar empleados.',
    'employees.you': 'tú',
    'employees.loansCount': '{n} préstamos',
  },
});

// ---------- private Hilfen ----------
const ROLES = ['admin', 'lagerverantwortlicher', 'mitarbeiter'];
const href = (code) => '#/' + routeForCode(code);
const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const ts = (iso) => { const n = new Date(iso || 0).getTime(); return Number.isFinite(n) ? n : 0; };
const langLabel = (code) => (LANGS.find((l) => l.code === code) || {}).label || code || '–';

function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return ((parts[0][0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}
function avatar(name) {
  return `<span class="avatar" aria-hidden="true" style="cursor:default;flex:none">${esc(initials(name))}</span>`;
}
function appUrl() {
  return location.origin + location.pathname;
}
function errorPage(ctx, err, backHtml = '') {
  toast(errorText(err), 'error');
  ctx.el.innerHTML = `<div class="page">${backHtml}
    <div class="alert danger" role="alert">${icon('alert')}<div>${esc(errorText(err))}</div></div>
    <div><button type="button" class="btn" data-retry>${icon('history')}${esc(t('btn.retry'))}</button></div></div>`;
  ctx.el.querySelector('[data-retry]').addEventListener('click', () => ctx.reload());
}
function signedQty(q, unit) {
  const n = Number(q) || 0;
  return (n > 0 ? '+' : n < 0 ? '−' : '±') + fmtQty(Math.abs(n), unit);
}

function roleRadios(current, name = 'role') {
  return `<fieldset class="radio-cards" style="border:0;padding:0;margin:0">
    <legend class="sr-only">${esc(t('employees.role'))}</legend>
    ${ROLES.map((r) => `<label class="radio-card"><input type="radio" name="${name}" value="${r}" ${r === current ? 'checked' : ''}>
      <span><b>${esc(roleLabel(r))}</b><small>${esc(t('employees.roleDesc.' + r))}</small></span></label>`).join('')}
  </fieldset>`;
}

// Bearbeiten / Freigeben (nur Administratoren). Gibt das gespeicherte Profil zurück oder undefined.
function editSheet(ctx, p, { approve = false } = {}) {
  const self = ctx.user && p.id === ctx.user.id;
  const body = approve
    ? `<p>${esc(t('employees.approveText', { name: p.full_name, email: p.email || '–' }))}</p>${roleRadios(p.role || 'mitarbeiter')}`
    : `<div class="field"><label for="emp-name">${esc(t('employees.name'))}</label>
        <input id="emp-name" type="text" required maxlength="120" value="${esc(p.full_name || '')}" autocomplete="off"></div>
      <div class="field"><span class="lbl">${esc(t('employees.role'))}</span>${roleRadios(p.role)}</div>
      <label class="check"><input type="checkbox" id="emp-active" ${p.active ? 'checked' : ''} ${self ? 'disabled' : ''}>
        <span>${esc(t('employees.activeLabel'))}</span></label>
      ${self ? `<p class="hint">${esc(t('employees.selfHint'))}</p>` : ''}`;
  return sheet({
    title: approve ? t('employees.approveTitle') : t('employees.editTitle'),
    body,
    actions: [
      { label: t('btn.cancel'), kind: 'ghost', value: undefined },
      {
        label: approve ? t('employees.approve') : t('btn.save'), kind: 'primary', icon: approve ? 'check' : '',
        onClick: async (sh) => {
          const role = (sh.querySelector('input[name="role"]:checked') || {}).value || p.role;
          const full_name = approve ? p.full_name : clean(sh.querySelector('#emp-name').value);
          if (!full_name) throw Object.assign(new Error('name_required'), { code: 'name_required' });
          const active = approve ? true : (self ? p.active : sh.querySelector('#emp-active').checked);
          const saved = await ctx.api.adminUpdateProfile(p.id, { full_name, role, active });
          return saved || Object.assign({}, p, { full_name, role, active });
        },
      },
    ],
  });
}

async function deactivate(ctx, p) {
  const ok = await confirmSheet(t('employees.deactivateTitle'), t('employees.deactivateText', { name: p.full_name }),
    { okLabel: t('employees.deactivate'), danger: true });
  if (!ok) return false;
  try {
    await ctx.api.adminUpdateProfile(p.id, { full_name: p.full_name, role: p.role, active: false });
    toast(t('employees.deactivated'));
    return true;
  } catch (err) {
    toast(errorText(err), 'error');
    return false;
  }
}

// ---------- Liste ----------
async function listRoute(ctx) {
  const { el, api, user } = ctx;
  if (ctx.setTitle) ctx.setTitle(t('employees.title'));
  const admin = can(user, 'admin');
  const staff = can(user, 'staff');
  const head = `<div class="page-head"><h1>${esc(t('employees.title'))}</h1></div>`;
  el.innerHTML = `<div class="page">${head}<p class="muted" role="status">${esc(t('common.loading'))}</p></div>`;

  let profiles, openLoans;
  try {
    [profiles, openLoans] = await Promise.all([api.listProfiles(), api.listLoans({ open: true })]);
  } catch (err) { errorPage(ctx, err); return; }
  profiles = profiles || [];
  const loanCount = new Map();
  const overdueCount = new Map();
  for (const l of openLoans || []) {
    loanCount.set(l.borrower_id, (loanCount.get(l.borrower_id) || 0) + 1);
    if (l.overdue) overdueCount.set(l.borrower_id, (overdueCount.get(l.borrower_id) || 0) + 1);
  }
  const pending = profiles.filter((p) => !p.active);
  const active = profiles.filter((p) => p.active);

  const how = `<div class="alert" role="note">${icon('users')}<div>
      <strong>${esc(t('employees.howTitle'))}</strong>
      <p style="margin:2px 0 6px">${esc(t('employees.howText'))}</p>
      <div class="row"><span class="small">${esc(t('employees.appLink'))}:</span> <span class="mono small" style="overflow-wrap:anywhere">${esc(appUrl())}</span>
        <button type="button" class="btn sm" data-copy>${icon('file')}${esc(t('employees.copy'))}</button></div>
    </div></div>`;

  const pendingHtml = (staff && pending.length) ? `<section class="section">
      <div class="section-head"><h2>${esc(t('employees.pending'))} (${pending.length})</h2></div>
      <p class="hint" style="margin:0">${esc(t('employees.pendingHint'))}</p>
      <div class="list">${pending.map((p) => `<div class="list-item" data-pid="${esc(p.id)}">
        ${avatar(p.full_name)}
        <div class="li-main"><a class="li-title" href="#/mitarbeiter/${encodeURIComponent(p.id)}">${esc(p.full_name)}</a>
          <span class="li-sub">${esc(p.email || '–')}${p.created_at ? ' · ' + esc(t('employees.registered')) + ' ' + esc(fmtDate(p.created_at)) : ''}</span></div>
        <div class="li-end">${admin
          ? `<button type="button" class="btn sm primary" data-approve>${icon('check')}${esc(t('employees.approve'))}</button>`
          : `<span class="pill pill-warn">${esc(t('employees.st.inactive'))}</span>`}</div>
      </div>`).join('')}</div>
    </section>` : '';

  el.innerHTML = `<div class="page">${head}
    ${how}
    ${pendingHtml}
    <section class="section">
      <div class="section-head"><h2>${esc(t('employees.activeList'))} (${active.length})</h2></div>
      <div class="searchbar">${icon('search')}<input type="search" data-search placeholder="${esc(t('employees.search'))}" aria-label="${esc(t('employees.search'))}"></div>
      <div class="list" data-list></div>
      <div data-empty hidden>${emptyHtml(t('employees.none'))}</div>
    </section>
    ${admin ? '' : `<p class="muted small">${esc(t('employees.readOnly'))}</p>`}
  </div>`;

  const listEl = el.querySelector('[data-list]');
  const render = (query) => {
    const qq = norm(query);
    const rows = active.filter((p) => !qq || norm(`${p.full_name} ${p.email || ''} ${roleLabel(p.role)}`).includes(qq));
    listEl.innerHTML = rows.map((p) => {
      const n = loanCount.get(p.id) || 0;
      const o = overdueCount.get(p.id) || 0;
      return `<a class="list-item" href="#/mitarbeiter/${encodeURIComponent(p.id)}">
        ${avatar(p.full_name)}
        <div class="li-main"><span class="li-title">${esc(p.full_name)}${user && p.id === user.id ? ` <span class="muted">(${esc(t('employees.you'))})</span>` : ''}</span>
          <span class="li-sub">${esc(roleLabel(p.role))}${p.email ? ' · ' + esc(p.email) : ''}</span></div>
        <div class="li-end">${n ? `<span class="pill pill-info">${icon('machine')}${esc(t('employees.onLoan', { n }))}</span>` : ''}
          ${o ? `<span class="pill pill-danger">${esc(t('employees.overdueN', { n: o }))}</span>` : ''}</div>
      </a>`;
    }).join('');
    listEl.hidden = rows.length === 0;
    el.querySelector('[data-empty]').hidden = rows.length > 0;
  };
  render('');
  el.querySelector('[data-search]').addEventListener('input', debounce((e) => render(e.target.value), 150));

  const copyBtn = el.querySelector('[data-copy]');
  if (copyBtn) copyBtn.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(appUrl()); toast(t('employees.copied')); } catch (e) { toast(appUrl(), 'info'); }
  });
  el.querySelectorAll('[data-approve]').forEach((b) => b.addEventListener('click', async () => {
    const p = profiles.find((x) => x.id === b.closest('[data-pid]').dataset.pid);
    if (!p) return;
    const saved = await editSheet(ctx, p, { approve: true });
    if (saved) { toast(t('employees.approved')); ctx.reload(); }
  }));
}

// ---------- Detail ----------
async function detailRoute(ctx) {
  const { el, api, user, params } = ctx;
  if (ctx.setTitle) ctx.setTitle(t('employees.title'));
  const admin = can(user, 'admin');
  const back = `<a class="back-link" href="#/mitarbeiter">${icon('back')}${esc(t('employees.back'))}</a>`;
  el.innerHTML = `<div class="page">${back}<p class="muted" role="status">${esc(t('common.loading'))}</p></div>`;

  let profiles, loans, movements;
  try {
    [profiles, loans, movements] = await Promise.all([
      api.listProfiles(),
      api.listLoans({ borrowerId: params.id }),
      api.listMovements({ userId: params.id, limit: 200 }),
    ]);
  } catch (err) { errorPage(ctx, err, back); return; }
  const p = (profiles || []).find((x) => x.id === params.id);
  if (!p) { el.innerHTML = `<div class="page">${back}${emptyHtml(t('employees.notFound'))}</div>`; return; }
  if (ctx.setTitle) ctx.setTitle(p.full_name);
  loans = (loans || []).filter((l) => l.borrower_id === p.id);
  movements = movements || [];
  const self = user && p.id === user.id;
  const openLoans = loans.filter((l) => !l.returned_at).sort((a, b) => ts(a.checked_out_at) - ts(b.checked_out_at));

  const actions = admin ? `<div class="actions">
      ${p.active ? '' : `<button type="button" class="btn primary" data-approve>${icon('check')}${esc(t('employees.approve'))}</button>`}
      <button type="button" class="btn" data-edit>${icon('edit')}${esc(t('employees.edit'))}</button>
      ${p.active && !self ? `<button type="button" class="btn danger-outline" data-deactivate>${icon('x')}${esc(t('employees.deactivate'))}</button>` : ''}
    </div>` : '';

  const info = `<div class="card"><dl class="kv">
      <dt>${esc(t('employees.email'))}</dt><dd>${p.email ? `<a href="mailto:${esc(p.email)}">${esc(p.email)}</a>` : '–'}</dd>
      <dt>${esc(t('employees.role'))}</dt><dd>${esc(roleLabel(p.role))}</dd>
      <dt>${esc(t('employees.status'))}</dt><dd>${p.active
        ? `<span class="pill pill-ok">${esc(t('employees.st.active'))}</span>`
        : `<span class="pill pill-warn">${esc(t('employees.st.inactive'))}</span>`}</dd>
      <dt>${esc(t('employees.lang'))}</dt><dd>${esc(langLabel(p.lang))}</dd>
      ${p.created_at ? `<dt>${esc(t('employees.registered'))}</dt><dd>${esc(fmtDate(p.created_at))}</dd>` : ''}
    </dl><p class="hint" style="margin:10px 0 0">${esc(t('employees.roleDesc.' + p.role))}</p></div>`;

  const current = `<section class="section"><h2>${esc(t('employees.current'))} (${openLoans.length})</h2>
    ${openLoans.length ? `<div class="list">${openLoans.map((l) => `
      <a class="list-item" href="${esc(href(l.machine_code))}">
        <span class="thumb thumb-empty" aria-hidden="true">${icon('machine')}</span>
        <div class="li-main"><span class="li-title">${esc(l.machine_name)}</span>
          <span class="li-sub"><span class="mono">${esc(l.machine_code)}</span> · ${esc(fmtDateTime(l.checked_out_at))} · ${esc(t('employees.since', { t: fmtElapsed(l.checked_out_at) }))}</span>
          ${l.due_at ? `<span class="li-sub">${esc(t('employees.dueOn', { d: fmtDateTime(l.due_at) }))}</span>` : ''}</div>
        <div class="li-end">${l.overdue ? `<span class="pill pill-danger">${esc(t('employees.overdue'))}</span>` : `<span class="pill pill-info">${esc(t('status.ausgeliehen'))}</span>`}</div>
      </a>`).join('')}</div>`
      : `<div class="card"><p class="muted small" style="margin:0">${esc(t('employees.currentNone'))}</p></div>`}
  </section>`;

  const usageRows = loans.slice().sort((a, b) => ts(b.checked_out_at) - ts(a.checked_out_at)).map((l) => {
    const cls = !l.returned_at ? (l.overdue ? 'is-overdue' : 'is-open') : '';
    let status;
    if (!l.returned_at) status = l.overdue ? `<span class="pill pill-danger">${esc(t('employees.overdue'))}</span>` : `<span class="pill pill-info">${esc(t('employees.open'))}</span>`;
    else {
      const c = l.return_condition || 'ok';
      status = `<span class="pill ${c === 'ok' ? 'pill-ok' : c === 'maengel' ? 'pill-warn' : 'pill-danger'}">${esc(conditionLabel(c))}</span>`;
    }
    if (l.corrected) status += ` <span class="pill pill-muted">${esc(t('employees.corrected'))}</span>`;
    const other = l.returned_at && l.returned_by && l.returned_by !== l.borrower_id ? (l.returned_by_name || '–') : '';
    return `<tr class="${cls}">
      <td><a href="${esc(href(l.machine_code))}">${esc(l.machine_name)}</a> <span class="muted mono">${esc(l.machine_code)}</span></td>
      <td>${esc(fmtDateTime(l.checked_out_at))}</td>
      <td>${l.returned_at ? esc(fmtDateTime(l.returned_at)) : '–'}</td>
      <td>${esc(fmtElapsed(l.checked_out_at, l.returned_at || undefined))}</td>
      <td>${status}</td>
      <td>${esc(other)}</td>
    </tr>`;
  }).join('');
  const usage = `<section class="section"><h2>${esc(t('employees.usage'))} (${loans.length})</h2>
    ${loans.length ? `<div class="table-wrap"><table class="table">
      <thead><tr><th scope="col">${esc(t('employees.colMachine'))}</th><th scope="col">${esc(t('employees.colOut'))}</th>
        <th scope="col">${esc(t('employees.colBack'))}</th><th scope="col">${esc(t('employees.colDuration'))}</th>
        <th scope="col">${esc(t('employees.colStatus'))}</th><th scope="col">${esc(t('employees.colReturnedBy'))}</th></tr></thead>
      <tbody>${usageRows}</tbody></table></div>`
      : `<div class="card"><p class="muted small" style="margin:0">${esc(t('employees.usageNone'))}</p></div>`}
  </section>`;

  const mvRows = movements.map((m) => `<tr>
      <td>${esc(fmtDateTime(m.created_at))}</td>
      <td><a href="${esc(href(m.article_code))}">${esc(m.article_name)}</a> <span class="muted mono">${esc(m.article_code)}</span></td>
      <td>${esc(t('mv.' + m.type))}</td>
      <td class="num">${esc(signedQty(m.qty, m.unit))}</td>
      <td class="num">${esc(fmtQty(m.stock_after, m.unit))}</td>
      <td class="wrap">${esc(m.note || '')}</td>
    </tr>`).join('');
  const mv = `<section class="section"><h2>${esc(t('employees.movements'))} (${movements.length})</h2>
    ${movements.length ? `<div class="table-wrap"><table class="table">
      <thead><tr><th scope="col">${esc(t('employees.colDate'))}</th><th scope="col">${esc(t('employees.colArticle'))}</th>
        <th scope="col">${esc(t('employees.colType'))}</th><th scope="col" class="num">${esc(t('employees.colQty'))}</th>
        <th scope="col" class="num">${esc(t('employees.colStock'))}</th><th scope="col">${esc(t('employees.colNote'))}</th></tr></thead>
      <tbody>${mvRows}</tbody></table></div>`
      : `<div class="card"><p class="muted small" style="margin:0">${esc(t('employees.movementsNone'))}</p></div>`}
  </section>`;

  el.innerHTML = `<div class="page">
    ${back}
    <div class="page-head">
      <div class="row" style="flex-wrap:nowrap;min-width:0">${avatar(p.full_name)}
        <div style="min-width:0"><h1>${esc(p.full_name)}${self ? ` <span class="muted small">(${esc(t('employees.you'))})</span>` : ''}</h1>
          <div class="sub">${esc(roleLabel(p.role))} · ${esc(t('employees.loansCount', { n: loans.length }))}</div></div></div>
      ${actions}
    </div>
    ${!p.active ? `<div class="alert warn" role="status">${icon('alert')}<div>${esc(t('employees.pending'))}. ${esc(t('employees.pendingHint'))}</div></div>` : ''}
    ${info}
    ${current}
    ${usage}
    ${mv}
  </div>`;

  const on = (sel, fn) => { const b = el.querySelector(sel); if (b) b.addEventListener('click', fn); };
  on('[data-approve]', async () => {
    const saved = await editSheet(ctx, p, { approve: true });
    if (saved) { toast(t('employees.approved')); ctx.reload(); }
  });
  on('[data-edit]', async () => {
    const saved = await editSheet(ctx, p);
    if (saved) {
      toast(t('employees.saved'));
      if (self && ctx.user) Object.assign(ctx.user, { full_name: saved.full_name, role: saved.role, active: saved.active });
      ctx.reload();
    }
  });
  on('[data-deactivate]', async () => {
    if (await deactivate(ctx, p)) ctx.reload();
  });
}

export const routes = {
  'mitarbeiter': listRoute,
  'mitarbeiter/:id': detailRoute,
};
