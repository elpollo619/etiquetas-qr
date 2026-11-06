// Shell, Router und Anmeldung der Lagerverwaltung
import { api } from './api.js';
import { t, initLang, setLang, getLang, LANGS } from './i18n.js';
import { esc, icon, toast, errorText, can, routeForCode, parseScanned, sheet } from './util.js';
import { openScanner } from './scanner.js';

const VIEW_MODULES = ['dashboard', 'machines', 'articles', 'locations', 'inventory', 'employees', 'audit', 'labels-page', 'profile'];
const routes = [];
let me = null;                // eigenes Profil
let recoveryMode = false;     // Passwort-Zurücksetzen über E-Mail-Link
let shellLang = null;
let renderSeq = 0;
let lastPath = null;
let hiddenAt = 0;
const $app = () => document.getElementById('app');

// ---------------------------------------------------------------------------
// Routen
// ---------------------------------------------------------------------------
function addRoutes(map) {
  for (const [pattern, handler] of Object.entries(map || {})) {
    const keys = [];
    const re = new RegExp('^' + pattern.split('/').map((p) => {
      if (p.startsWith(':')) { keys.push(p.slice(1)); return '([^/]+)'; }
      return p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }).join('/') + '$');
    routes.push({ pattern, keys, re, handler });
  }
}
addRoutes({ scan: scanView });

async function loadViews() {
  await Promise.all(VIEW_MODULES.map((m) =>
    import(`./views/${m}.js`).then((mod) => addRoutes(mod.routes)).catch((err) => {
      console.warn(`Ansicht ${m} konnte nicht geladen werden`, err);
    })));
}
function matchRoute(path) {
  for (const r of routes) {
    const m = r.re.exec(path);
    if (m) {
      const params = {};
      try {
        r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
      } catch (e) {
        return null;   // kaputte %-Kodierung → «Seite nicht gefunden» statt Absturz
      }
      return { route: r, params };
    }
  }
  return null;
}
function parseHash() {
  const h = location.hash || '';
  if (/access_token=|error_description=|[#&]type=recovery/.test(h)) return { path: '', query: new URLSearchParams() };
  const raw = h.replace(/^#\/?/, '');
  const qi = raw.indexOf('?');
  const p = qi >= 0 ? raw.slice(0, qi) : raw;
  const q = qi >= 0 ? raw.slice(qi + 1) : '';
  return { path: p.replace(/\/+$/, ''), query: new URLSearchParams(q) };
}
export function go(path) {
  const target = '#/' + String(path || '').replace(/^#?\/?/, '');
  if (location.hash === target) render({ keepScroll: false });
  else location.hash = target;
}
function setTitle(text) {
  const el = document.getElementById('pageTitle');
  if (el) el.textContent = text || '';
  document.title = text ? `${text} · ${t('app.name')}` : t('app.tagline');
}

// QR-Link (?c=CODE oder alt ?id=INV-0001) → interne Route; Adresse bereinigen
function captureDeepLink() {
  const sp = new URLSearchParams(location.search);
  const code = sp.get('c') || sp.get('id');
  if (!code) return;
  const route = routeForCode(code);
  history.replaceState(null, '', location.pathname + (route ? '#/' + route : location.hash));
}

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------
function navItems() {
  const staff = can(me, 'staff');
  return [
    { path: '', ic: 'home', label: t('nav.home') },
    { path: 'scan', ic: 'scan', label: t('nav.scan'), scan: true },
    { path: 'maschinen', ic: 'machine', label: t('nav.machines') },
    { path: 'ausgeliehen', ic: 'handoff', label: t('nav.loans') },
    { path: 'artikel', ic: 'box', label: t('nav.articles') },
    { path: 'lagerorte', ic: 'location', label: t('nav.locations') },
    { path: 'inventur', ic: 'clipboard', label: t('nav.inventory') },
    { path: 'mitarbeiter', ic: 'users', label: t('nav.employees') },
    staff && { path: 'etiketten', ic: 'label', label: t('nav.labels') },
    staff && { path: 'protokoll', ic: 'history', label: t('nav.audit') },
    { path: 'profil', ic: 'user', label: t('nav.profile') },
  ].filter(Boolean);
}
function sectionOf(path) {
  const first = path.split('/')[0];
  if (first === 'm' || first === 'maschinen') return 'maschinen';
  if (first === 'a' || first === 'artikel') return 'artikel';
  if (first === 'l' || first === 'lagerorte') return 'lagerorte';
  return first;
}
function initials(name) {
  return String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0].toUpperCase()).join('') || '?';
}

function renderShell() {
  shellLang = getLang();
  const items = navItems();
  const demo = api.mode === 'demo';
  $app().innerHTML = `
    <div class="shell">
      ${demo ? `<div class="demo-bar" role="note">${icon('alert')}<span>${esc(t('common.demo'))}</span>
        <label>${esc(t('common.demoUser'))} <select id="demoUser" aria-label="${esc(t('common.demoUser'))}"></select></label></div>` : ''}
      <header class="topbar">
        <a class="brand" href="#/" aria-label="${esc(t('nav.home'))}"><span class="brand-mark">${icon('box')}</span></a>
        <div class="title" id="pageTitle"></div>
        <div class="top-actions">
          <a class="icon-btn" href="#/scan" aria-label="${esc(t('nav.scan'))}" title="${esc(t('nav.scan'))}">${icon('scan')}</a>
          <a class="avatar" href="#/profil" title="${esc(me.full_name)}" aria-label="${esc(t('nav.profile'))}">${esc(initials(me.full_name))}</a>
        </div>
      </header>
      <div class="layout">
        <nav class="sidebar" aria-label="${esc(t('nav.menu'))}">
          ${items.map((n) => `<a href="#/${n.path}" data-sec="${n.path}" class="${n.scan ? 'side-scan' : ''}">${icon(n.ic)}<span>${esc(n.label)}</span></a>`).join('')}
        </nav>
        <main id="view" tabindex="-1"></main>
      </div>
      <nav class="bottom-nav" aria-label="${esc(t('nav.menu'))}">
        <a href="#/" data-sec="">${icon('home')}<span>${esc(t('nav.home'))}</span></a>
        <a href="#/maschinen" data-sec="maschinen">${icon('machine')}<span>${esc(t('nav.machines'))}</span></a>
        <a href="#/scan" data-sec="scan" class="scan-item" aria-label="${esc(t('nav.scan'))}"><span class="scan-fab">${icon('scan')}</span></a>
        <a href="#/artikel" data-sec="artikel">${icon('box')}<span>${esc(t('nav.articles'))}</span></a>
        <button type="button" id="btnMore" aria-expanded="false">${icon('more')}<span>${esc(t('nav.more'))}</span></button>
      </nav>
    </div>`;
  document.getElementById('btnMore').addEventListener('click', openMoreMenu);
  if (demo) fillDemoUsers();
}
async function fillDemoUsers() {
  const sel = document.getElementById('demoUser');
  if (!sel || !api.demoUsers) return;
  try {
    const users = await api.demoUsers();
    sel.innerHTML = users.map((u) => `<option value="${esc(u.id)}" ${u.id === me.id ? 'selected' : ''}>${esc(u.full_name)} · ${esc(t('role.' + u.role))}${u.active ? '' : ' (–)'}</option>`).join('');
    sel.addEventListener('change', async () => {
      try { await api.demoSwitchUser(sel.value); await refreshAuth(true); } catch (e) { toast(errorText(e), 'error'); }
    });
  } catch (e) { /* egal */ }
}
function openMoreMenu() {
  const btn = document.getElementById('btnMore');
  btn.setAttribute('aria-expanded', 'true');
  const hidden = new Set(['', 'scan', 'maschinen', 'artikel']);
  const links = navItems().filter((n) => !hidden.has(n.path));
  sheet({
    title: t('nav.more'),
    body: `<nav class="more-menu">${links.map((n) => `<a href="#/${n.path}">${icon(n.ic)}<span>${esc(n.label)}</span></a>`).join('')}</nav>
      <div class="row"><span class="muted small">${esc(t('lang.label'))}</span>${langSwitchHtml()}</div>`,
    onOpen: (el, close) => {
      el.querySelectorAll('.more-menu a').forEach((a) => a.addEventListener('click', () => close()));
      bindLangSwitch(el, () => { close(); applyLangChange(); });
    },
  }).then(() => btn.setAttribute('aria-expanded', 'false'));
}
function updateNavCurrent(path) {
  const sec = path === 'scan' ? 'scan' : sectionOf(path);
  document.querySelectorAll('[data-sec]').forEach((a) => {
    if (a.dataset.sec === sec) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}
function langSwitchHtml() {
  return `<div class="lang-switch" role="group" aria-label="${esc(t('lang.label'))}">${LANGS.map((l) =>
    `<button type="button" data-lang="${l.code}" aria-pressed="${l.code === getLang()}" title="${esc(l.label)}">${l.code.toUpperCase()}</button>`).join('')}</div>`;
}
function bindLangSwitch(root, after) {
  root.querySelectorAll('[data-lang]').forEach((b) => b.addEventListener('click', () => {
    setLang(b.dataset.lang);
    if (after) after(b.dataset.lang);
  }));
}
async function applyLangChange() {
  if (me && me.active) {
    try { me = await api.updateMyProfile({ full_name: me.full_name, lang: getLang() }); } catch (e) { /* lokal reicht */ }
    renderShell();
    render({ keepScroll: true });
  }
}

// ---------------------------------------------------------------------------
// Seiten darstellen
// ---------------------------------------------------------------------------
async function render({ keepScroll = false } = {}) {
  if (!me || !me.active || recoveryMode) return;
  if (shellLang !== getLang() || !document.getElementById('view')) {
    try { me = (await api.getMyProfile()) || me; } catch (e) { /* egal */ }
    renderShell();
  }
  const { path, query } = parseHash();
  const seq = ++renderSeq;
  const view = document.getElementById('view');
  updateNavCurrent(path);
  const match = matchRoute(path);
  const el = document.createElement('div');
  el.className = 'page-root';
  el.innerHTML = `<div class="empty">${esc(t('common.loading'))}</div>`;
  const y = window.scrollY;
  view.replaceChildren(el);
  if (!keepScroll && path !== lastPath) window.scrollTo(0, 0);
  lastPath = path;
  if (!match) {
    setTitle(t('page.notFound'));
    el.innerHTML = `<div class="empty">${icon('alert')}<p>${esc(t('page.notFound'))}</p><a class="btn" href="#/">${esc(t('page.goHome'))}</a></div>`;
    return;
  }
  const ctx = {
    el, params: match.params, query, user: me, api, go,
    reload: () => render({ keepScroll: true }),
    setTitle,
  };
  try {
    await match.route.handler(ctx);
    if (keepScroll && seq === renderSeq) window.scrollTo(0, y);
  } catch (err) {
    console.error(err);
    if (seq !== renderSeq) return;
    el.innerHTML = `<div class="alert danger">${icon('alert')}<div><p>${esc(errorText(err))}</p>
      <button type="button" class="btn sm" id="btnRetry">${esc(t('btn.retry'))}</button></div></div>`;
    el.querySelector('#btnRetry').addEventListener('click', () => render({ keepScroll: true }));
  }
}

// Route «scan»: Kamera öffnen, Code → passende Karte
async function scanView(ctx) {
  ctx.setTitle(t('scan.title'));
  ctx.el.innerHTML = `
    <div class="page">
      <div class="page-head"><h1>${esc(t('scan.title'))}</h1></div>
      <p class="muted">${esc(t('scan.hint'))}</p>
      <button type="button" class="btn primary block" id="btnStartScan">${icon('camera')}${esc(t('btn.scan'))}</button>
      <form class="row" id="manualForm" autocomplete="off">
        <input type="text" name="code" placeholder="${esc(t('scan.manual'))}" aria-label="${esc(t('scan.manual'))}" style="flex:1 1 200px" autocapitalize="characters">
        <button type="submit" class="btn">${esc(t('scan.go'))}</button>
      </form>
    </div>`;
  const open = (code) => { location.replace('#/' + routeForCode(code)); };
  const start = () => openScanner({ title: t('scan.title'), hint: t('scan.hint'), onCode: async (code) => open(code) });
  ctx.el.querySelector('#btnStartScan').addEventListener('click', start);
  ctx.el.querySelector('#manualForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = e.target.elements.code.value;
    const code = parseScanned(v) || String(v || '').trim().toUpperCase();
    if (code) open(code);
  });
  start();
}

// ---------------------------------------------------------------------------
// Anmeldung, Registrierung, Freigabe, Passwort
// ---------------------------------------------------------------------------
function pendingTargetCode() {
  const { path } = parseHash();
  const m = /^(?:m|a|l)\/(.+)$/.exec(path);
  if (!m) return null;
  try { return decodeURIComponent(m[1]); } catch (e) { return null; }
}
function renderAuth(mode = 'login', message = '') {
  const target = pendingTargetCode();
  const isReg = mode === 'register', isForgot = mode === 'forgot', isRecovery = mode === 'recovery';
  const heading = isReg ? t('auth.register') : isForgot ? t('auth.forgot') : isRecovery ? t('auth.newPassword') : t('auth.title');
  setTitle(heading);
  $app().innerHTML = `
    <div class="auth-wrap"><div class="auth-card card">
      <div class="brand-row"><span class="brand-mark">${icon('box')}</span>
        <div style="flex:1"><h1>${esc(t('app.name'))}</h1><div class="muted small">${esc(t('app.tagline'))}</div></div>
        ${langSwitchHtml()}</div>
      ${target && !isRecovery ? `<div class="alert">${icon('scan')}<span>${esc(t('auth.afterLogin', { code: target }))}</span></div>` : ''}
      ${message ? `<div class="alert ok">${icon('check')}<span>${esc(message)}</span></div>` : ''}
      <h2>${esc(heading)}</h2>
      <form id="authForm" novalidate>
        ${isReg ? `<div class="field"><label for="f-name">${esc(t('auth.name'))}</label><input id="f-name" name="name" type="text" autocomplete="name" required></div>` : ''}
        ${!isRecovery ? `<div class="field"><label for="f-email">${esc(t('auth.email'))}</label><input id="f-email" name="email" type="email" autocomplete="email" inputmode="email" required></div>` : ''}
        ${!isForgot ? `<div class="field"><label for="f-pw">${esc(isRecovery ? t('auth.newPassword') : t('auth.password'))}</label>
          <input id="f-pw" name="password" type="password" autocomplete="${isReg || isRecovery ? 'new-password' : 'current-password'}" required minlength="${isReg || isRecovery ? 8 : 1}">
          ${isReg || isRecovery ? `<span class="hint">${esc(t('auth.minLength'))}</span>` : ''}</div>` : ''}
        <div class="alert danger" id="authErr" hidden></div>
        <button type="submit" class="btn primary block">${esc(isReg ? t('auth.register') : isForgot ? t('auth.sendReset') : isRecovery ? t('auth.setPassword') : t('auth.login'))}</button>
      </form>
      ${isRecovery ? '' : `<div class="stack" style="gap:2px">
        ${mode !== 'login' ? `<button type="button" class="link-btn" data-mode="login">${esc(t('auth.toLogin'))}</button>` : ''}
        ${mode !== 'register' ? `<button type="button" class="link-btn" data-mode="register">${esc(t('auth.toRegister'))}</button>` : ''}
        ${mode === 'login' ? `<button type="button" class="link-btn" data-mode="forgot">${esc(t('auth.forgot'))}</button>` : ''}
      </div>`}
    </div></div>`;
  const root = $app();
  bindLangSwitch(root, () => renderAuth(mode, message));
  root.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => renderAuth(b.dataset.mode)));
  const form = root.querySelector('#authForm');
  const err = root.querySelector('#authErr');
  const first = form.querySelector('input');
  if (first) first.focus();
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.hidden = true;
    const btn = form.querySelector('button[type=submit]');
    const f = form.elements;
    btn.disabled = true;
    try {
      if (isReg) {
        if (!f.name.value.trim()) throw Object.assign(new Error(), { code: 'name_required' });
        if (f.password.value.length < 8) throw Object.assign(new Error(), { code: 'weak_password' });
        const r = await api.signUp({ fullName: f.name.value.trim(), email: f.email.value.trim(), password: f.password.value, lang: getLang() });
        if (r && r.needsConfirmation) { renderAuth('login', t('auth.confirmSent')); return; }
        await refreshAuth(true);
      } else if (isForgot) {
        await api.resetPassword(f.email.value.trim());
        renderAuth('login', t('auth.resetSent'));
      } else if (isRecovery) {
        if (f.password.value.length < 8) throw Object.assign(new Error(), { code: 'weak_password' });
        await api.updatePassword(f.password.value);
        recoveryMode = false;
        toast(t('auth.passwordSaved'));
        if (location.hash.includes('access_token')) history.replaceState(null, '', location.pathname);
        await refreshAuth(true);
      } else {
        await api.signIn(f.email.value.trim(), f.password.value);
        await refreshAuth(true);
      }
    } catch (ex) {
      err.textContent = errorText(ex);
      err.hidden = false;
    } finally {
      btn.disabled = false;
    }
  });
}
function renderPending() {
  setTitle(t('auth.pendingTitle'));
  $app().innerHTML = `
    <div class="auth-wrap"><div class="auth-card card">
      <div class="brand-row"><span class="brand-mark">${icon('box')}</span><div style="flex:1"><h1>${esc(t('app.name'))}</h1></div>${langSwitchHtml()}</div>
      <div class="alert warn">${icon('clock')}<div><b>${esc(t('auth.pendingTitle'))}</b><p>${esc(t('auth.pendingText'))}</p></div></div>
      <p class="muted small">${esc(me ? me.full_name + ' · ' + (me.email || '') : '')}</p>
      <div class="row">
        <button type="button" class="btn primary" id="btnRecheck">${esc(t('btn.retry'))}</button>
        <button type="button" class="btn ghost" id="btnOut">${icon('logout')}${esc(t('btn.logout'))}</button>
      </div>
    </div></div>`;
  const root = $app();
  bindLangSwitch(root, () => renderPending());
  root.querySelector('#btnRecheck').addEventListener('click', () => refreshAuth(true));
  root.querySelector('#btnOut').addEventListener('click', async () => { await api.signOut(); await refreshAuth(true); });
}

async function refreshAuth(force = false) {
  let session = null;
  try { session = await api.getSession(); } catch (e) { session = null; }
  if (!session) { me = null; renderAuth('login'); return; }
  if (recoveryMode) { renderAuth('recovery'); return; }
  let profile = null;
  try { profile = await api.getMyProfile(); } catch (e) { profile = null; }
  if (!profile) { me = null; renderAuth('login'); return; }
  const changedUser = !me || me.id !== profile.id;
  me = profile;
  if (me.lang && me.lang !== getLang() && changedUser) setLang(me.lang);
  if (!me.active) { renderPending(); return; }
  if (force || changedUser || !document.getElementById('view')) renderShell();
  await render();
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
async function boot() {
  initLang();
  captureDeepLink();
  if (/type=recovery/.test(location.hash)) recoveryMode = true;
  try {
    await api.init();
  } catch (err) {
    $app().innerHTML = `<div class="auth-wrap"><div class="alert danger">${icon('alert')}<span>${esc(errorText(err))}</span></div></div>`;
    return;
  }
  await loadViews();
  api.onAuthChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') { recoveryMode = true; renderAuth('recovery'); return; }
    if (event === 'SIGNED_OUT') { me = null; renderAuth('login'); return; }
    if (event === 'SIGNED_IN' && (!me || !session || session.userId !== me.id)) refreshAuth(true);
  });
  window.addEventListener('hashchange', () => { if (me && me.active && !recoveryMode) render(); else if (!me) renderAuth('login'); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { hiddenAt = Date.now(); return; }
    // nach längerer Pause frische Daten anzeigen (z. B. wer hat die Maschine gerade?)
    if (hiddenAt && Date.now() - hiddenAt > 45000 && me && me.active && !document.querySelector('.sheet-backdrop, .scanner')
        && !(document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName))) {
      render({ keepScroll: true });
    }
  });
  await refreshAuth(true);
}
boot();
