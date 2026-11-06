// Profil: Name, Sprache, Rolle, Passwort, Demo-Benutzer, Abmelden, Installations-Tipp
import { t, registerStrings, LANGS, getLang, setLang } from '../i18n.js';
import { esc, clean, icon, errorText, toast, roleLabel } from '../util.js';

registerStrings({
  de: {
    'profile.title': 'Profil',
    'profile.mine': 'Mein Profil',
    'profile.name': 'Vor- und Nachname',
    'profile.email': 'E-Mail',
    'profile.lang': 'Sprache',
    'profile.langHint': 'Die App erscheint in dieser Sprache – auf allen deinen Geräten.',
    'profile.role': 'Rolle',
    'profile.roleHint': 'Die Rolle vergibt ein Administrator.',
    'profile.roleDesc.admin': 'Du darfst alles, inkl. Mitarbeiter verwalten, Löschen und Ausleihen korrigieren.',
    'profile.roleDesc.lagerverantwortlicher': 'Du verwaltest Stammdaten, Status, Umlagerungen, Inventuren, Etiketten und siehst das Protokoll.',
    'profile.roleDesc.mitarbeiter': 'Du kannst Maschinen ausleihen und zurückgeben, Material entnehmen und bei der Inventur zählen.',
    'profile.saved': 'Profil gespeichert.',
    'profile.password': 'Passwort ändern',
    'profile.newPassword': 'Neues Passwort',
    'profile.repeatPassword': 'Neues Passwort wiederholen',
    'profile.pwMismatch': 'Die beiden Passwörter stimmen nicht überein.',
    'profile.pwSave': 'Passwort speichern',
    'profile.demo': 'Demo: Benutzer wechseln',
    'profile.demoHint': 'Im Demo-Modus kannst du ausprobieren, was die verschiedenen Rollen sehen und dürfen.',
    'profile.current': 'aktuell',
    'profile.logout': 'Abmelden',
    'profile.logoutHint': 'Auf geteilten Geräten bitte immer abmelden.',
    'profile.installTitle': 'Auf dem Handy installieren',
    'profile.installIos': 'iPhone (Safari): Teilen-Symbol antippen → «Zum Home-Bildschirm».',
    'profile.installAndroid': 'Android (Chrome): Menü ⋮ → «App installieren» bzw. «Zum Startbildschirm hinzufügen».',
    'profile.installText': 'Danach startet die App direkt vom Startbildschirm – ideal zum schnellen Scannen.',
    'profile.installed': 'Die App ist auf diesem Gerät bereits installiert.',
  },
  pt: {
    'profile.title': 'Perfil',
    'profile.mine': 'O meu perfil',
    'profile.name': 'Nome e apelido',
    'profile.email': 'E-mail',
    'profile.lang': 'Idioma',
    'profile.langHint': 'A app aparece neste idioma – em todos os teus dispositivos.',
    'profile.role': 'Função',
    'profile.roleHint': 'A função é atribuída por um administrador.',
    'profile.roleDesc.admin': 'Podes fazer tudo, incluindo gerir colaboradores, eliminar e corrigir empréstimos.',
    'profile.roleDesc.lagerverantwortlicher': 'Geres dados mestre, estados, transferências, inventários e etiquetas, e vês o registo.',
    'profile.roleDesc.mitarbeiter': 'Podes levantar e devolver máquinas, retirar material e contar no inventário.',
    'profile.saved': 'Perfil guardado.',
    'profile.password': 'Alterar palavra-passe',
    'profile.newPassword': 'Nova palavra-passe',
    'profile.repeatPassword': 'Repetir a nova palavra-passe',
    'profile.pwMismatch': 'As duas palavras-passe não coincidem.',
    'profile.pwSave': 'Guardar palavra-passe',
    'profile.demo': 'Demo: mudar de utilizador',
    'profile.demoHint': 'No modo de demonstração podes experimentar o que cada função vê e pode fazer.',
    'profile.current': 'atual',
    'profile.logout': 'Terminar sessão',
    'profile.logoutHint': 'Em dispositivos partilhados, termina sempre a sessão.',
    'profile.installTitle': 'Instalar no telemóvel',
    'profile.installIos': 'iPhone (Safari): toca no ícone Partilhar → «Adicionar ao ecrã principal».',
    'profile.installAndroid': 'Android (Chrome): menu ⋮ → «Instalar app» ou «Adicionar ao ecrã principal».',
    'profile.installText': 'Depois a app abre diretamente a partir do ecrã principal – ideal para ler códigos QR rapidamente.',
    'profile.installed': 'A app já está instalada neste dispositivo.',
  },
  es: {
    'profile.title': 'Perfil',
    'profile.mine': 'Mi perfil',
    'profile.name': 'Nombre y apellido',
    'profile.email': 'Correo electrónico',
    'profile.lang': 'Idioma',
    'profile.langHint': 'La app aparece en este idioma, en todos tus dispositivos.',
    'profile.role': 'Rol',
    'profile.roleHint': 'El rol lo asigna un administrador.',
    'profile.roleDesc.admin': 'Puedes hacerlo todo, incluido gestionar empleados, eliminar y corregir préstamos.',
    'profile.roleDesc.lagerverantwortlicher': 'Gestionas datos maestros, estados, traslados, inventarios y etiquetas, y ves el registro.',
    'profile.roleDesc.mitarbeiter': 'Puedes retirar y devolver máquinas, retirar material y contar en el inventario.',
    'profile.saved': 'Perfil guardado.',
    'profile.password': 'Cambiar contraseña',
    'profile.newPassword': 'Nueva contraseña',
    'profile.repeatPassword': 'Repetir la nueva contraseña',
    'profile.pwMismatch': 'Las dos contraseñas no coinciden.',
    'profile.pwSave': 'Guardar contraseña',
    'profile.demo': 'Demo: cambiar de usuario',
    'profile.demoHint': 'En el modo demostración puedes probar qué ve y qué puede hacer cada rol.',
    'profile.current': 'actual',
    'profile.logout': 'Cerrar sesión',
    'profile.logoutHint': 'En dispositivos compartidos, cierra siempre la sesión.',
    'profile.installTitle': 'Instalar en el móvil',
    'profile.installIos': 'iPhone (Safari): toca el icono Compartir → «Añadir a pantalla de inicio».',
    'profile.installAndroid': 'Android (Chrome): menú ⋮ → «Instalar aplicación» o «Añadir a pantalla de inicio».',
    'profile.installText': 'Después la app se abre directamente desde la pantalla de inicio: ideal para escanear rápido.',
    'profile.installed': 'La app ya está instalada en este dispositivo.',
  },
});

// ---------- private Hilfen ----------
function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return ((parts[0][0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}
function isStandalone() {
  try {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  } catch (e) { return false; }
}

// ---------- Route ----------
async function profileRoute(ctx) {
  const { el, api } = ctx;
  const user = ctx.user || {};
  if (ctx.setTitle) ctx.setTitle(t('profile.title'));

  let email = user.email || '';
  if (!email) {
    try { const s = await api.getSession(); email = (s && s.email) || ''; } catch (e) { /* ohne E-Mail */ }
  }
  let demoUsers = [];
  if (api.mode === 'demo' && typeof api.demoUsers === 'function') {
    try { demoUsers = (await api.demoUsers()) || []; } catch (e) { demoUsers = []; }
  }
  const lang = user.lang || getLang();
  const role = user.role || 'mitarbeiter';

  el.innerHTML = `<div class="page">
    <div class="page-head">
      <div class="row" style="flex-wrap:nowrap;min-width:0">
        <span class="avatar" aria-hidden="true" style="width:48px;height:48px;font-size:16px;cursor:default">${esc(initials(user.full_name))}</span>
        <div style="min-width:0"><h1>${esc(user.full_name || t('profile.title'))}</h1>
          <div class="sub">${esc(roleLabel(role))}${email ? ' · ' + esc(email) : ''}</div></div>
      </div>
    </div>
    ${user.active === false ? `<div class="alert warn" role="status">${icon('alert')}<div><strong>${esc(t('auth.pendingTitle'))}</strong><br>${esc(t('auth.pendingText'))}</div></div>` : ''}

    <section class="section" aria-labelledby="pf-h-mine">
      <h2 id="pf-h-mine">${esc(t('profile.mine'))}</h2>
      <div class="card stack">
        <form class="stack" data-nameform novalidate>
          <div class="field"><label for="pf-name">${esc(t('profile.name'))}</label>
            <input id="pf-name" type="text" required maxlength="120" autocomplete="name" value="${esc(user.full_name || '')}"></div>
          <div><button type="submit" class="btn primary">${icon('check')}${esc(t('btn.save'))}</button></div>
        </form>
        <div class="divider"></div>
        <div class="field">
          <span class="lbl" id="pf-lang-l">${esc(t('profile.lang'))}</span>
          <div class="lang-switch" role="group" aria-labelledby="pf-lang-l" style="align-self:flex-start">
            ${LANGS.map((l) => `<button type="button" data-lang="${esc(l.code)}" lang="${esc(l.code)}" aria-pressed="${l.code === lang ? 'true' : 'false'}">${esc(l.label)}</button>`).join('')}
          </div>
          <span class="hint">${esc(t('profile.langHint'))}</span>
        </div>
        <div class="divider"></div>
        <dl class="kv">
          <dt>${esc(t('profile.role'))}</dt><dd>${esc(roleLabel(role))}</dd>
          <dt>${esc(t('profile.email'))}</dt><dd>${esc(email || '–')}</dd>
        </dl>
        <p class="hint" style="margin:0">${esc(t('profile.roleDesc.' + role))} ${esc(t('profile.roleHint'))}</p>
      </div>
    </section>

    <section class="section" aria-labelledby="pf-h-pw">
      <h2 id="pf-h-pw">${esc(t('profile.password'))}</h2>
      <form class="card stack" data-pwform novalidate>
        <input type="text" name="username" autocomplete="username" value="${esc(email)}" hidden>
        <div class="field"><label for="pf-pw1">${esc(t('profile.newPassword'))}</label>
          <input id="pf-pw1" type="password" autocomplete="new-password" minlength="8" required aria-describedby="pf-pw-hint">
          <span class="hint" id="pf-pw-hint">${esc(t('auth.minLength'))}</span></div>
        <div class="field"><label for="pf-pw2">${esc(t('profile.repeatPassword'))}</label>
          <input id="pf-pw2" type="password" autocomplete="new-password" minlength="8" required></div>
        <div class="alert danger" data-pwerr role="alert" hidden></div>
        <div><button type="submit" class="btn primary">${icon('check')}${esc(t('profile.pwSave'))}</button></div>
      </form>
    </section>

    ${demoUsers.length ? `<section class="section" aria-labelledby="pf-h-demo">
      <h2 id="pf-h-demo">${esc(t('profile.demo'))}</h2>
      <p class="hint" style="margin:0">${esc(t('profile.demoHint'))}</p>
      <div class="list">${demoUsers.map((u) => {
        const cur = u.id === user.id;
        return `<button type="button" class="list-item" data-demo="${esc(u.id)}" ${cur ? 'aria-current="true" disabled' : ''}>
          <span class="avatar" aria-hidden="true" style="cursor:inherit">${esc(initials(u.full_name || u.name))}</span>
          <span class="li-main"><span class="li-title">${esc(u.full_name || u.name || u.email || u.id)}</span>
            <span class="li-sub">${esc(roleLabel(u.role))}${u.active === false ? ' · ' + esc(t('auth.pendingTitle')) : ''}</span></span>
          <span class="li-end">${cur ? `<span class="pill pill-ok">${esc(t('profile.current'))}</span>` : icon('chevron')}</span>
        </button>`;
      }).join('')}</div>
    </section>` : ''}

    <section class="section" aria-labelledby="pf-h-inst">
      <h2 id="pf-h-inst">${esc(t('profile.installTitle'))}</h2>
      <div class="card stack">
        ${isStandalone() ? `<div class="alert ok">${icon('check')}<div>${esc(t('profile.installed'))}</div></div>` : ''}
        <p style="margin:0">${esc(t('profile.installIos'))}</p>
        <p style="margin:0">${esc(t('profile.installAndroid'))}</p>
        <p class="hint" style="margin:0">${esc(t('profile.installText'))}</p>
      </div>
    </section>

    <section class="section">
      <button type="button" class="btn danger-outline block" data-logout>${icon('logout')}${esc(t('profile.logout'))}</button>
      <p class="hint" style="margin:0;text-align:center">${esc(t('profile.logoutHint'))}</p>
    </section>
  </div>`;

  const $ = (s) => el.querySelector(s);

  async function saveProfile(fullName, newLang) {
    const saved = await api.updateMyProfile({ full_name: fullName, lang: newLang });
    const next = Object.assign({}, saved || {}, { full_name: (saved && saved.full_name) || fullName, lang: (saved && saved.lang) || newLang });
    if (ctx.user) Object.assign(ctx.user, { full_name: next.full_name, lang: next.lang });
    setLang(next.lang);
    toast(t('profile.saved'));
    ctx.reload();
  }

  // Name speichern
  $('[data-nameform]').addEventListener('submit', async (e) => {
    e.preventDefault();
    const inp = $('#pf-name');
    const name = clean(inp.value);
    if (!name) { inp.setAttribute('aria-invalid', 'true'); inp.focus(); toast(t('err.name_required'), 'error'); return; }
    inp.removeAttribute('aria-invalid');
    const btn = e.submitter || $('[data-nameform] button[type=submit]');
    btn.disabled = true;
    try { await saveProfile(name, user.lang || getLang()); } catch (err) { toast(errorText(err), 'error'); } finally { btn.disabled = false; }
  });

  // Sprache wählen (sofort speichern)
  el.querySelectorAll('[data-lang]').forEach((b) => b.addEventListener('click', async () => {
    const l = b.dataset.lang;
    if (l === (user.lang || getLang())) return;
    const name = clean($('#pf-name').value) || user.full_name;
    el.querySelectorAll('[data-lang]').forEach((x) => { x.disabled = true; });
    try { await saveProfile(name, l); } catch (err) {
      toast(errorText(err), 'error');
      el.querySelectorAll('[data-lang]').forEach((x) => { x.disabled = false; });
    }
  }));

  // Passwort ändern
  $('[data-pwform]').addEventListener('submit', async (e) => {
    e.preventDefault();
    const p1 = $('#pf-pw1');
    const p2 = $('#pf-pw2');
    const errBox = $('[data-pwerr]');
    const fail = (msg, field) => {
      errBox.textContent = msg;
      errBox.hidden = false;
      if (field) { field.setAttribute('aria-invalid', 'true'); field.focus(); }
    };
    errBox.hidden = true;
    p1.removeAttribute('aria-invalid');
    p2.removeAttribute('aria-invalid');
    if (p1.value.length < 8) { fail(t('err.weak_password'), p1); return; }
    if (p1.value !== p2.value) { fail(t('profile.pwMismatch'), p2); return; }
    const btn = e.submitter || $('[data-pwform] button[type=submit]');
    btn.disabled = true;
    try {
      await api.updatePassword(p1.value);
      p1.value = ''; p2.value = '';
      toast(t('auth.passwordSaved'));
    } catch (err) {
      fail(errorText(err));
      toast(errorText(err), 'error');
    } finally { btn.disabled = false; }
  });

  // Demo: Benutzer wechseln
  el.querySelectorAll('[data-demo]').forEach((b) => b.addEventListener('click', async () => {
    el.querySelectorAll('[data-demo]').forEach((x) => { x.disabled = true; });
    try {
      await api.demoSwitchUser(b.dataset.demo);
      location.reload();
    } catch (err) {
      toast(errorText(err), 'error');
      el.querySelectorAll('[data-demo]').forEach((x) => { x.disabled = x.hasAttribute('aria-current'); });
    }
  }));

  // Abmelden
  $('[data-logout]').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    try {
      await api.signOut();
      // app.js reagiert auf SIGNED_OUT; falls nicht, neu laden (zeigt dann die Anmeldung)
      setTimeout(() => { if (el.isConnected && el.querySelector('[data-logout]')) location.reload(); }, 1500);
    } catch (err) {
      btn.disabled = false;
      toast(errorText(err), 'error');
    }
  });
}

export const routes = {
  'profil': profileRoute,
};
