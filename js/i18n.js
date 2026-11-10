// Mehrsprachigkeit: Deutsch (Schweiz) als Hauptsprache, dazu Portugiesisch und Spanisch.
const dicts = { de: {}, pt: {}, es: {} };
const LOCALES = { de: 'de-CH', pt: 'pt-PT', es: 'es-ES' };
export const LANGS = [
  { code: 'de', label: 'Deutsch' },
  { code: 'pt', label: 'Português' },
  { code: 'es', label: 'Español' },
];
let lang = 'de';

export function registerStrings(d) {
  for (const l of Object.keys(dicts)) Object.assign(dicts[l], (d && d[l]) || {});
}
export function getLang() { return lang; }
export function locale() { return LOCALES[lang] || 'de-CH'; }
export function setLang(l) {
  if (!dicts[l]) return;
  lang = l;
  document.documentElement.lang = l === 'de' ? 'de-CH' : l;
  try { localStorage.setItem('lgr-lang', l); } catch (e) { /* ohne Speicher */ }
}
export function initLang() {
  let l = null;
  try { l = localStorage.getItem('lgr-lang'); } catch (e) { /* ohne Speicher */ }
  if (!l) {
    const nav = (navigator.language || 'de').slice(0, 2).toLowerCase();
    l = dicts[nav] ? nav : 'de';
  }
  setLang(l);
}
export function t(key, vars) {
  let s = dicts[lang][key];
  if (s === undefined) s = dicts.de[key];
  if (s === undefined) return key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] === undefined || vars[k] === null ? '' : String(vars[k])));
  return s;
}
export function has(key) { return dicts[lang][key] !== undefined || dicts.de[key] !== undefined; }

const dtCache = new Map();
function fmt(opts) {
  const k = locale() + JSON.stringify(opts);
  if (!dtCache.has(k)) dtCache.set(k, new Intl.DateTimeFormat(locale(), opts));
  return dtCache.get(k);
}
export function fmtDateTime(v) {
  if (!v) return '–';
  const d = new Date(v);
  if (isNaN(d)) return '–';
  return fmt({ day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d);
}
export function fmtDate(v) {
  if (!v) return '–';
  const d = new Date(v);
  if (isNaN(d)) return '–';
  return fmt({ day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
}
export function fmtTime(v) {
  if (!v) return '–';
  return fmt({ hour: '2-digit', minute: '2-digit' }).format(new Date(v));
}
// Dauer seit/bis: «2 T 3 Std», «45 Min»
export function fmtElapsed(from, to) {
  if (!from) return '–';
  let ms = (to ? new Date(to) : new Date()) - new Date(from);
  if (!isFinite(ms)) return '–';
  ms = Math.max(0, ms);
  const min = Math.floor(ms / 60000), h = Math.floor(min / 60), d = Math.floor(h / 24);
  if (d > 0) return `${d} ${t('time.d')} ${h % 24} ${t('time.h')}`;
  if (h > 0) return `${h} ${t('time.h')} ${min % 60} ${t('time.min')}`;
  return `${min} ${t('time.min')}`;
}
export function fmtNum(n) {
  if (n === null || n === undefined || n === '') return '–';
  return new Intl.NumberFormat(locale(), { maximumFractionDigits: 3 }).format(Number(n));
}
export function fmtQty(n, unit) {
  return `${fmtNum(n)} ${unitLabel(unit)}`.trim();
}
export function unitLabel(u) {
  if (!u) return '';
  const k = 'unit.' + u;
  return has(k) ? t(k) : u;
}

// ---------------------------------------------------------------------------
// Gemeinsame Texte (Ansichten registrieren ihre eigenen Texte selbst)
// ---------------------------------------------------------------------------
registerStrings({
  de: {
    'app.name': 'Lager',
    'app.tagline': 'Lagerverwaltung',
    'nav.home': 'Übersicht', 'nav.scan': 'Scannen', 'nav.machines': 'Maschinen', 'nav.articles': 'Artikel',
    'nav.locations': 'Lagerorte', 'nav.loans': 'Ausgeliehene Maschinen', 'nav.loansShort': 'Ausgeliehen',
    'nav.inventory': 'Inventur', 'nav.employees': 'Mitarbeiter', 'nav.labels': 'Etiketten', 'nav.audit': 'Protokoll',
    'nav.profile': 'Profil', 'nav.more': 'Mehr', 'nav.menu': 'Menü', 'nav.material': 'Material',
    'nav.group.daily': 'Alltag', 'nav.group.manage': 'Verwalten',
    'nav.organize': 'Lager organisieren', 'nav.search': 'Suche', 'nav.categories': 'Kategorien', 'nav.consumables': 'Verbrauchsmaterial', 'nav.putaway': 'Einräumen', 'nav.shopping': 'Einkaufsliste',
    'btn.save': 'Speichern', 'btn.cancel': 'Abbrechen', 'btn.edit': 'Bearbeiten', 'btn.delete': 'Löschen',
    'btn.archive': 'Archivieren', 'btn.unarchive': 'Wiederherstellen', 'btn.back': 'Zurück', 'btn.new': 'Neu',
    'btn.close': 'Schliessen', 'btn.confirm': 'Bestätigen', 'btn.yes': 'Ja', 'btn.no': 'Nein', 'btn.search': 'Suchen',
    'btn.print': 'Drucken', 'btn.export': 'Export (Excel)', 'btn.addPhoto': 'Foto hinzufügen', 'btn.takePhoto': 'Foto aufnehmen',
    'btn.addDocument': 'Dokument hinzufügen', 'btn.retry': 'Erneut versuchen', 'btn.duplicate': 'Duplizieren',
    'btn.logout': 'Abmelden', 'btn.scan': 'QR scannen', 'btn.more': 'Mehr anzeigen', 'btn.all': 'Alle',
    'common.loading': 'Wird geladen…', 'common.saved': 'Gespeichert', 'common.none': 'Keine Einträge',
    'common.search': 'Suchen…', 'common.all': 'Alle', 'common.code': 'Code', 'common.name': 'Name',
    'common.category': 'Kategorie', 'common.location': 'Standort', 'common.brand': 'Marke', 'common.model': 'Modell',
    'common.notes': 'Bemerkungen', 'common.note': 'Bemerkung', 'common.description': 'Beschreibung', 'common.status': 'Status',
    'common.date': 'Datum', 'common.from': 'Von', 'common.to': 'Bis', 'common.employee': 'Mitarbeiter',
    'common.machine': 'Maschine', 'common.article': 'Artikel', 'common.quantity': 'Menge', 'common.unit': 'Einheit',
    'common.photos': 'Fotos', 'common.documents': 'Dokumente', 'common.history': 'Verlauf', 'common.details': 'Details',
    'common.archived': 'Archiviert', 'common.showArchived': 'Archivierte anzeigen', 'common.optional': 'optional',
    'common.required': 'Pflichtfeld', 'common.yes': 'Ja', 'common.no': 'Nein', 'common.total': 'Total',
    'common.you': 'du', 'common.qr': 'QR-Code', 'common.open': 'Offen', 'common.back': 'Zurück',
    'common.noPhoto': 'Kein Foto', 'common.primary': 'Hauptfoto', 'common.setPrimary': 'Als Hauptfoto',
    'common.damage': 'Schaden', 'common.document': 'Dokument', 'common.uploading': 'Wird hochgeladen…',
    'common.demo': 'Demo-Modus – Daten nur in diesem Browser.', 'common.demoUser': 'Angemeldet als',
    'time.d': 'T', 'time.h': 'Std', 'time.min': 'Min',
    'status.verfuegbar': 'Verfügbar', 'status.ausgeliehen': 'Ausgeliehen', 'status.reserviert': 'Reserviert',
    'status.wartung': 'In Wartung', 'status.defekt': 'Defekt', 'status.verloren': 'Verloren',
    'cond.ok': 'In Ordnung', 'cond.maengel': 'Mängel', 'cond.defekt': 'Defekt',
    'role.admin': 'Administrator', 'role.lagerverantwortlicher': 'Lagerverantwortlicher', 'role.mitarbeiter': 'Mitarbeiter',
    'loc.lager': 'Lager', 'loc.raum': 'Raum', 'loc.regal': 'Regal', 'loc.fach': 'Fach', 'loc.box': 'Box',
    'loc.behaelter': 'Behälter', 'loc.fahrzeug': 'Fahrzeug', 'loc.temporaer': 'Temporär',
    'loc.bereich': 'Bereich', 'loc.schrank': 'Schrank', 'loc.tablar': 'Tablar', 'loc.schublade': 'Schublade',
    'loc.werkzeugwand': 'Werkzeugwand', 'loc.halterung': 'Halterung', 'loc.arbeitsplatz': 'Arbeitsplatz', 'loc.container': 'Container',
    'mv.anlage': 'Anfangsbestand', 'mv.zugang': 'Zugang', 'mv.entnahme': 'Entnahme', 'mv.umlagerung': 'Umlagerung',
    'mv.korrektur': 'Korrektur', 'mv.inventur': 'Inventur',
    'unit.Stk': 'Stk', 'unit.m': 'm', 'unit.m²': 'm²', 'unit.kg': 'kg', 'unit.l': 'l', 'unit.Rolle': 'Rolle',
    'unit.Pkg': 'Pkg', 'unit.Paar': 'Paar', 'unit.Set': 'Set',
    'err.not_authorized': 'Keine Berechtigung für diese Aktion.',
    'err.not_found': 'Nicht gefunden.',
    'err.not_available': 'Diese Maschine ist nicht verfügbar ({status}).',
    'err.reserved': 'Diese Maschine ist reserviert. Bitte beim Lagerverantwortlichen melden.',
    'err.not_on_loan': 'Diese Maschine ist nicht ausgeliehen.',
    'err.on_loan': 'Die Maschine ist ausgeliehen – zuerst zurückgeben.',
    'err.note_required': 'Bitte beschreibe den Mangel oder Defekt.',
    'err.reason_required': 'Bitte gib eine Begründung an.',
    'err.insufficient_stock': 'Nicht genügend Lagerbestand.',
    'err.invalid_qty': 'Ungültige Menge.',
    'err.invalid_location': 'Ungültiger Lagerort.',
    'err.location_cycle': 'Ein Lagerort kann nicht in sich selbst liegen.',
    'err.code_immutable': 'Der Code kann nicht geändert werden.',
    'err.inventory_closed': 'Diese Inventur ist bereits abgeschlossen.',
    'err.last_admin': 'Es muss mindestens ein aktiver Administrator bleiben.',
    'err.invalid_dates': 'Die Datumsangaben sind ungültig.',
    'err.due_in_past': 'Das Rückgabedatum liegt in der Vergangenheit.',
    'err.name_required': 'Bitte einen Namen eingeben.',
    'err.already_on_list': 'Steht schon auf der Einkaufsliste.',
    'err.network': 'Keine Verbindung. Bitte erneut versuchen.',
    'err.duplicate_code': 'Dieser Code existiert bereits.',
    'err.in_use': 'Kann nicht gelöscht werden, weil es einen Verlauf gibt. Bitte archivieren.',
    'err.auth_invalid': 'E-Mail oder Passwort ist falsch.',
    'err.auth_exists': 'Für diese E-Mail gibt es bereits ein Konto.',
    'err.weak_password': 'Das Passwort ist zu kurz (mindestens 8 Zeichen).',
    'err.email_not_confirmed': 'Bitte bestätige zuerst deine E-Mail-Adresse über den Link in der E-Mail.',
    'err.rate_limited': 'Zu viele Versuche. Bitte warte ein paar Minuten.',
    'err.same_password': 'Das neue Passwort muss sich vom alten unterscheiden.',
    'err.file_too_large': 'Die Datei ist zu gross (max. 25 MB).',
    'err.file_type': 'Dieser Dateityp ist nicht erlaubt. Erlaubt: Fotos, PDF, Word, Excel, Text.',
    'err.file_required': 'Bitte eine Datei auswählen.',
    'err.duplicate': 'Dieser Eintrag existiert bereits.',
    'err.signup_disabled': 'Die Registrierung ist im Moment deaktiviert. Bitte beim Administrator melden.',
    'err.invalid_code': 'Ungültiger Code (z. B. M-0028, INV-0001, L-0003).',
    'err.invalid_email': 'Bitte eine gültige E-Mail-Adresse eingeben.',
    'err.invalid': 'Ungültige Eingabe.',
    'err.unknown': 'Unbekannter Fehler. Bitte erneut versuchen.',
    'err.category_cycle': 'Eine Kategorie kann nicht in sich selbst liegen.',
    'err.quantity_uncertain': 'Die Menge ist nicht sicher. Bitte zuerst zählen und eintragen.',
    'err.kind_required': 'Bitte zuerst festlegen, was es ist (Einzelinventar, Bestandsartikel, Set oder Lagerort).',
    'err.already_reviewed': 'Dieses Objekt wurde bereits geprüft.',
    'err.open_items': 'Es gibt noch offene Punkte (zu prüfende Objekte / offene Aufgaben: {status}).',
    'err.invalid_input': 'Ungültige Eingabe.',
    'err.too_many': 'Zu viele Einträge auf einmal.',
    'err.invalid_file': 'Die Datei konnte nicht gelesen werden.',
    'err.duplicate_short_code': 'Dieser Kurzcode ist auf dieser Ebene schon vergeben.',
    'err.invalid_short_code': 'Kurzcode: nur Grossbuchstaben und Ziffern, max. 10 Zeichen (z. B. RG01).',
    'err.invalid_url': 'Bitte eine vollständige Adresse mit https:// eingeben.',
    'err.camera': 'Kamera nicht verfügbar. Gib den Code von Hand ein.',
    'auth.title': 'Anmelden', 'auth.email': 'E-Mail', 'auth.password': 'Passwort', 'auth.name': 'Vor- und Nachname',
    'auth.login': 'Anmelden', 'auth.register': 'Konto erstellen', 'auth.toRegister': 'Noch kein Konto? Registrieren',
    'auth.toLogin': 'Schon ein Konto? Anmelden', 'auth.forgot': 'Passwort vergessen?', 'auth.sendReset': 'Link senden',
    'auth.resetSent': 'Wir haben dir eine E-Mail zum Zurücksetzen geschickt.',
    'auth.confirmSent': 'Fast fertig: Bestätige deine E-Mail-Adresse über den Link, den wir dir geschickt haben.',
    'auth.pendingTitle': 'Konto wartet auf Freigabe',
    'auth.pendingText': 'Ein Administrator muss dein Konto zuerst freigeben. Danach kannst du Maschinen ausleihen und zurückgeben.',
    'auth.newPassword': 'Neues Passwort', 'auth.setPassword': 'Passwort speichern', 'auth.passwordSaved': 'Passwort gespeichert.',
    'auth.afterLogin': 'Nach dem Anmelden geht es direkt weiter zu {code}.',
    'auth.minLength': 'Mindestens 8 Zeichen',
    'scan.title': 'QR-Code scannen', 'scan.hint': 'Halte den QR-Code der Maschine, des Artikels oder des Lagerorts in den Rahmen.',
    'scan.manual': 'Code eingeben (z. B. M-0028)', 'scan.go': 'Öffnen', 'scan.unknown': 'Kein gültiger Code: {text}',
    'scan.starting': 'Kamera wird gestartet…', 'scan.torch': 'Licht',
    'page.notFound': 'Seite nicht gefunden.', 'page.goHome': 'Zur Übersicht',
    'setup.title': 'Noch nicht mit der Datenbank verbunden',
    'setup.text': 'Die App läuft im Demo-Modus. Für den echten Betrieb Supabase einrichten (siehe Anleitung) und die Werte in js/config.js eintragen.',
    'lang.label': 'Sprache',
  },
  pt: {
    'app.name': 'Armazém',
    'app.tagline': 'Gestão de armazém',
    'nav.home': 'Resumo', 'nav.scan': 'Ler QR', 'nav.machines': 'Máquinas', 'nav.articles': 'Artigos',
    'nav.locations': 'Localizações', 'nav.loans': 'Máquinas emprestadas', 'nav.loansShort': 'Emprestadas',
    'nav.inventory': 'Inventário', 'nav.employees': 'Colaboradores', 'nav.labels': 'Etiquetas', 'nav.audit': 'Registo',
    'nav.profile': 'Perfil', 'nav.more': 'Mais', 'nav.menu': 'Menu', 'nav.material': 'Material',
    'nav.group.daily': 'Dia a dia', 'nav.group.manage': 'Gerir',
    'nav.organize': 'Organizar armazém', 'nav.search': 'Pesquisa', 'nav.categories': 'Categorias', 'nav.consumables': 'Consumíveis', 'nav.putaway': 'Arrumar', 'nav.shopping': 'Lista de compras',
    'btn.save': 'Guardar', 'btn.cancel': 'Cancelar', 'btn.edit': 'Editar', 'btn.delete': 'Eliminar',
    'btn.archive': 'Arquivar', 'btn.unarchive': 'Restaurar', 'btn.back': 'Voltar', 'btn.new': 'Novo',
    'btn.close': 'Fechar', 'btn.confirm': 'Confirmar', 'btn.yes': 'Sim', 'btn.no': 'Não', 'btn.search': 'Pesquisar',
    'btn.print': 'Imprimir', 'btn.export': 'Exportar (Excel)', 'btn.addPhoto': 'Adicionar foto', 'btn.takePhoto': 'Tirar foto',
    'btn.addDocument': 'Adicionar documento', 'btn.retry': 'Tentar de novo', 'btn.duplicate': 'Duplicar',
    'btn.logout': 'Terminar sessão', 'btn.scan': 'Ler QR', 'btn.more': 'Mostrar mais', 'btn.all': 'Todos',
    'common.loading': 'A carregar…', 'common.saved': 'Guardado', 'common.none': 'Sem registos',
    'common.search': 'Pesquisar…', 'common.all': 'Todos', 'common.code': 'Código', 'common.name': 'Nome',
    'common.category': 'Categoria', 'common.location': 'Localização', 'common.brand': 'Marca', 'common.model': 'Modelo',
    'common.notes': 'Observações', 'common.note': 'Observação', 'common.description': 'Descrição', 'common.status': 'Estado',
    'common.date': 'Data', 'common.from': 'De', 'common.to': 'Até', 'common.employee': 'Colaborador',
    'common.machine': 'Máquina', 'common.article': 'Artigo', 'common.quantity': 'Quantidade', 'common.unit': 'Unidade',
    'common.photos': 'Fotos', 'common.documents': 'Documentos', 'common.history': 'Histórico', 'common.details': 'Detalhes',
    'common.archived': 'Arquivado', 'common.showArchived': 'Mostrar arquivados', 'common.optional': 'opcional',
    'common.required': 'Obrigatório', 'common.yes': 'Sim', 'common.no': 'Não', 'common.total': 'Total',
    'common.you': 'tu', 'common.qr': 'Código QR', 'common.open': 'Em aberto', 'common.back': 'Voltar',
    'common.noPhoto': 'Sem foto', 'common.primary': 'Foto principal', 'common.setPrimary': 'Definir como principal',
    'common.damage': 'Dano', 'common.document': 'Documento', 'common.uploading': 'A enviar…',
    'common.demo': 'Modo de demonstração – dados só neste navegador.', 'common.demoUser': 'Sessão de',
    'time.d': 'd', 'time.h': 'h', 'time.min': 'min',
    'status.verfuegbar': 'Disponível', 'status.ausgeliehen': 'Emprestada', 'status.reserviert': 'Reservada',
    'status.wartung': 'Em manutenção', 'status.defekt': 'Avariada', 'status.verloren': 'Perdida',
    'cond.ok': 'Em ordem', 'cond.maengel': 'Com defeitos', 'cond.defekt': 'Avariada',
    'role.admin': 'Administrador', 'role.lagerverantwortlicher': 'Responsável de armazém', 'role.mitarbeiter': 'Colaborador',
    'loc.lager': 'Armazém', 'loc.raum': 'Sala', 'loc.regal': 'Estante', 'loc.fach': 'Compartimento', 'loc.box': 'Caixa',
    'loc.behaelter': 'Contentor', 'loc.fahrzeug': 'Veículo', 'loc.temporaer': 'Temporário',
    'loc.bereich': 'Zona', 'loc.schrank': 'Armário', 'loc.tablar': 'Prateleira', 'loc.schublade': 'Gaveta',
    'loc.werkzeugwand': 'Painel de ferramentas', 'loc.halterung': 'Suporte', 'loc.arbeitsplatz': 'Posto de trabalho', 'loc.container': 'Contentor',
    'mv.anlage': 'Stock inicial', 'mv.zugang': 'Entrada', 'mv.entnahme': 'Saída', 'mv.umlagerung': 'Transferência',
    'mv.korrektur': 'Correção', 'mv.inventur': 'Inventário',
    'unit.Stk': 'un.', 'unit.Rolle': 'rolo', 'unit.Pkg': 'emb.', 'unit.Paar': 'par', 'unit.Set': 'conjunto',
    'err.not_authorized': 'Sem permissão para esta ação.',
    'err.not_found': 'Não encontrado.',
    'err.not_available': 'Esta máquina não está disponível ({status}).',
    'err.reserved': 'Esta máquina está reservada. Fala com o responsável de armazém.',
    'err.not_on_loan': 'Esta máquina não está emprestada.',
    'err.on_loan': 'A máquina está emprestada – devolve-a primeiro.',
    'err.note_required': 'Descreve o defeito ou a avaria.',
    'err.reason_required': 'Indica um motivo.',
    'err.insufficient_stock': 'Stock insuficiente.',
    'err.invalid_qty': 'Quantidade inválida.',
    'err.invalid_location': 'Localização inválida.',
    'err.location_cycle': 'Uma localização não pode estar dentro de si própria.',
    'err.code_immutable': 'O código não pode ser alterado.',
    'err.inventory_closed': 'Este inventário já está fechado.',
    'err.last_admin': 'Tem de ficar pelo menos um administrador ativo.',
    'err.invalid_dates': 'As datas não são válidas.',
    'err.due_in_past': 'A data de devolução já passou.',
    'err.name_required': 'Introduz um nome.',
    'err.already_on_list': 'Já está na lista de compras.',
    'err.network': 'Sem ligação. Tenta de novo.',
    'err.duplicate_code': 'Este código já existe.',
    'err.in_use': 'Não é possível eliminar porque existe histórico. Arquiva-o.',
    'err.auth_invalid': 'E-mail ou palavra-passe incorretos.',
    'err.auth_exists': 'Já existe uma conta com este e-mail.',
    'err.weak_password': 'A palavra-passe é demasiado curta (mínimo 8 caracteres).',
    'err.email_not_confirmed': 'Primeiro confirma o teu e-mail através do link que recebeste.',
    'err.rate_limited': 'Demasiadas tentativas. Espera alguns minutos.',
    'err.same_password': 'A nova palavra-passe tem de ser diferente da anterior.',
    'err.file_too_large': 'O ficheiro é demasiado grande (máx. 25 MB).',
    'err.file_type': 'Este tipo de ficheiro não é permitido. Permitidos: fotos, PDF, Word, Excel, texto.',
    'err.file_required': 'Escolhe um ficheiro.',
    'err.duplicate': 'Este registo já existe.',
    'err.signup_disabled': 'O registo está desativado de momento. Fala com o administrador.',
    'err.invalid_code': 'Código inválido (ex.: M-0028, INV-0001, L-0003).',
    'err.invalid_email': 'Introduz um endereço de e-mail válido.',
    'err.invalid': 'Dados inválidos.',
    'err.unknown': 'Erro desconhecido. Tenta de novo.',
    'err.category_cycle': 'Uma categoria não pode estar dentro de si própria.',
    'err.quantity_uncertain': 'A quantidade não é segura. Conta primeiro e introduz o valor.',
    'err.kind_required': 'Indica primeiro o tipo (artigo individual, material com stock, conjunto ou localização).',
    'err.already_reviewed': 'Este objeto já foi verificado.',
    'err.open_items': 'Ainda há pontos em aberto (objetos por verificar / tarefas: {status}).',
    'err.invalid_input': 'Dados inválidos.',
    'err.too_many': 'Demasiadas entradas de uma vez.',
    'err.invalid_file': 'Não foi possível ler o ficheiro.',
    'err.duplicate_short_code': 'Este código curto já existe neste nível.',
    'err.invalid_short_code': 'Código curto: só maiúsculas e algarismos, máx. 10 caracteres (p. ex. RG01).',
    'err.invalid_url': 'Introduz um endereço completo com https://.',
    'err.camera': 'Câmara indisponível. Introduz o código à mão.',
    'auth.title': 'Iniciar sessão', 'auth.email': 'E-mail', 'auth.password': 'Palavra-passe', 'auth.name': 'Nome e apelido',
    'auth.login': 'Entrar', 'auth.register': 'Criar conta', 'auth.toRegister': 'Ainda não tens conta? Regista-te',
    'auth.toLogin': 'Já tens conta? Entrar', 'auth.forgot': 'Esqueceste a palavra-passe?', 'auth.sendReset': 'Enviar link',
    'auth.resetSent': 'Enviámos-te um e-mail para repor a palavra-passe.',
    'auth.confirmSent': 'Quase pronto: confirma o teu e-mail através do link que te enviámos.',
    'auth.pendingTitle': 'Conta à espera de aprovação',
    'auth.pendingText': 'Um administrador tem de aprovar a tua conta. Depois já podes levantar e devolver máquinas.',
    'auth.newPassword': 'Nova palavra-passe', 'auth.setPassword': 'Guardar palavra-passe', 'auth.passwordSaved': 'Palavra-passe guardada.',
    'auth.afterLogin': 'Depois de entrares, abrimos diretamente {code}.',
    'auth.minLength': 'Mínimo 8 caracteres',
    'scan.title': 'Ler código QR', 'scan.hint': 'Aponta para o código QR da máquina, do artigo ou da localização.',
    'scan.manual': 'Introduzir código (ex.: M-0028)', 'scan.go': 'Abrir', 'scan.unknown': 'Código inválido: {text}',
    'scan.starting': 'A iniciar a câmara…', 'scan.torch': 'Luz',
    'page.notFound': 'Página não encontrada.', 'page.goHome': 'Ir para o resumo',
    'setup.title': 'Ainda sem ligação à base de dados',
    'setup.text': 'A app está em modo de demonstração. Para uso real, configura o Supabase (ver instruções) e preenche js/config.js.',
    'lang.label': 'Idioma',
  },
  es: {
    'app.name': 'Almacén',
    'app.tagline': 'Gestión de almacén',
    'nav.home': 'Resumen', 'nav.scan': 'Escanear', 'nav.machines': 'Máquinas', 'nav.articles': 'Artículos',
    'nav.locations': 'Ubicaciones', 'nav.loans': 'Máquinas prestadas', 'nav.loansShort': 'Prestadas',
    'nav.inventory': 'Inventario', 'nav.employees': 'Empleados', 'nav.labels': 'Etiquetas', 'nav.audit': 'Registro',
    'nav.profile': 'Perfil', 'nav.more': 'Más', 'nav.menu': 'Menú', 'nav.material': 'Material',
    'nav.group.daily': 'Día a día', 'nav.group.manage': 'Gestionar',
    'nav.organize': 'Organizar almacén', 'nav.search': 'Búsqueda', 'nav.categories': 'Categorías', 'nav.consumables': 'Consumibles', 'nav.putaway': 'Colocar', 'nav.shopping': 'Lista de compras',
    'btn.save': 'Guardar', 'btn.cancel': 'Cancelar', 'btn.edit': 'Editar', 'btn.delete': 'Eliminar',
    'btn.archive': 'Archivar', 'btn.unarchive': 'Restaurar', 'btn.back': 'Volver', 'btn.new': 'Nuevo',
    'btn.close': 'Cerrar', 'btn.confirm': 'Confirmar', 'btn.yes': 'Sí', 'btn.no': 'No', 'btn.search': 'Buscar',
    'btn.print': 'Imprimir', 'btn.export': 'Exportar (Excel)', 'btn.addPhoto': 'Añadir foto', 'btn.takePhoto': 'Hacer foto',
    'btn.addDocument': 'Añadir documento', 'btn.retry': 'Reintentar', 'btn.duplicate': 'Duplicar',
    'btn.logout': 'Cerrar sesión', 'btn.scan': 'Escanear QR', 'btn.more': 'Mostrar más', 'btn.all': 'Todos',
    'common.loading': 'Cargando…', 'common.saved': 'Guardado', 'common.none': 'Sin registros',
    'common.search': 'Buscar…', 'common.all': 'Todos', 'common.code': 'Código', 'common.name': 'Nombre',
    'common.category': 'Categoría', 'common.location': 'Ubicación', 'common.brand': 'Marca', 'common.model': 'Modelo',
    'common.notes': 'Observaciones', 'common.note': 'Observación', 'common.description': 'Descripción', 'common.status': 'Estado',
    'common.date': 'Fecha', 'common.from': 'Desde', 'common.to': 'Hasta', 'common.employee': 'Empleado',
    'common.machine': 'Máquina', 'common.article': 'Artículo', 'common.quantity': 'Cantidad', 'common.unit': 'Unidad',
    'common.photos': 'Fotos', 'common.documents': 'Documentos', 'common.history': 'Historial', 'common.details': 'Detalles',
    'common.archived': 'Archivado', 'common.showArchived': 'Mostrar archivados', 'common.optional': 'opcional',
    'common.required': 'Obligatorio', 'common.yes': 'Sí', 'common.no': 'No', 'common.total': 'Total',
    'common.you': 'tú', 'common.qr': 'Código QR', 'common.open': 'Pendiente', 'common.back': 'Volver',
    'common.noPhoto': 'Sin foto', 'common.primary': 'Foto principal', 'common.setPrimary': 'Usar como principal',
    'common.damage': 'Daño', 'common.document': 'Documento', 'common.uploading': 'Subiendo…',
    'common.demo': 'Modo demostración – datos solo en este navegador.', 'common.demoUser': 'Sesión de',
    'time.d': 'd', 'time.h': 'h', 'time.min': 'min',
    'status.verfuegbar': 'Disponible', 'status.ausgeliehen': 'Prestada', 'status.reserviert': 'Reservada',
    'status.wartung': 'En mantenimiento', 'status.defekt': 'Defectuosa', 'status.verloren': 'Perdida',
    'cond.ok': 'En buen estado', 'cond.maengel': 'Con desperfectos', 'cond.defekt': 'Defectuosa',
    'role.admin': 'Administrador', 'role.lagerverantwortlicher': 'Responsable de almacén', 'role.mitarbeiter': 'Empleado',
    'loc.lager': 'Almacén', 'loc.raum': 'Sala', 'loc.regal': 'Estantería', 'loc.fach': 'Compartimento', 'loc.box': 'Caja',
    'loc.behaelter': 'Contenedor', 'loc.fahrzeug': 'Vehículo', 'loc.temporaer': 'Temporal',
    'loc.bereich': 'Zona', 'loc.schrank': 'Armario', 'loc.tablar': 'Balda', 'loc.schublade': 'Cajón',
    'loc.werkzeugwand': 'Panel de herramientas', 'loc.halterung': 'Soporte', 'loc.arbeitsplatz': 'Puesto de trabajo', 'loc.container': 'Contenedor',
    'mv.anlage': 'Stock inicial', 'mv.zugang': 'Entrada', 'mv.entnahme': 'Retirada', 'mv.umlagerung': 'Traslado',
    'mv.korrektur': 'Corrección', 'mv.inventur': 'Inventario',
    'unit.Stk': 'ud.', 'unit.Rolle': 'rollo', 'unit.Pkg': 'paq.', 'unit.Paar': 'par', 'unit.Set': 'juego',
    'err.not_authorized': 'No tienes permiso para esta acción.',
    'err.not_found': 'No encontrado.',
    'err.not_available': 'Esta máquina no está disponible ({status}).',
    'err.reserved': 'Esta máquina está reservada. Habla con el responsable de almacén.',
    'err.not_on_loan': 'Esta máquina no está prestada.',
    'err.on_loan': 'La máquina está prestada: primero hay que devolverla.',
    'err.note_required': 'Describe el desperfecto o la avería.',
    'err.reason_required': 'Indica un motivo.',
    'err.insufficient_stock': 'No hay suficiente stock.',
    'err.invalid_qty': 'Cantidad no válida.',
    'err.invalid_location': 'Ubicación no válida.',
    'err.location_cycle': 'Una ubicación no puede estar dentro de sí misma.',
    'err.code_immutable': 'El código no se puede cambiar.',
    'err.inventory_closed': 'Este inventario ya está cerrado.',
    'err.last_admin': 'Debe quedar al menos un administrador activo.',
    'err.invalid_dates': 'Las fechas no son válidas.',
    'err.due_in_past': 'La fecha de devolución ya ha pasado.',
    'err.name_required': 'Introduce un nombre.',
    'err.already_on_list': 'Ya está en la lista de compras.',
    'err.network': 'Sin conexión. Inténtalo de nuevo.',
    'err.duplicate_code': 'Este código ya existe.',
    'err.in_use': 'No se puede eliminar porque tiene historial. Archívalo.',
    'err.auth_invalid': 'Correo o contraseña incorrectos.',
    'err.auth_exists': 'Ya existe una cuenta con este correo.',
    'err.weak_password': 'La contraseña es demasiado corta (mínimo 8 caracteres).',
    'err.email_not_confirmed': 'Primero confirma tu correo con el enlace que te hemos enviado.',
    'err.rate_limited': 'Demasiados intentos. Espera unos minutos.',
    'err.same_password': 'La nueva contraseña tiene que ser distinta de la anterior.',
    'err.file_too_large': 'El archivo es demasiado grande (máx. 25 MB).',
    'err.file_type': 'Este tipo de archivo no está permitido. Se admiten fotos, PDF, Word, Excel y texto.',
    'err.file_required': 'Elige un archivo.',
    'err.duplicate': 'Este registro ya existe.',
    'err.signup_disabled': 'El registro está desactivado ahora mismo. Habla con el administrador.',
    'err.invalid_code': 'Código no válido (p. ej. M-0028, INV-0001, L-0003).',
    'err.invalid_email': 'Introduce un correo electrónico válido.',
    'err.invalid': 'Datos no válidos.',
    'err.unknown': 'Error desconocido. Inténtalo de nuevo.',
    'err.category_cycle': 'Una categoría no puede estar dentro de sí misma.',
    'err.quantity_uncertain': 'La cantidad no es segura. Cuenta primero e introduce el valor.',
    'err.kind_required': 'Indica primero qué es (activo individual, material con stock, set o ubicación).',
    'err.already_reviewed': 'Este objeto ya se ha revisado.',
    'err.open_items': 'Todavía hay puntos abiertos (objetos por revisar / tareas: {status}).',
    'err.invalid_input': 'Datos no válidos.',
    'err.too_many': 'Demasiadas entradas a la vez.',
    'err.invalid_file': 'No se pudo leer el archivo.',
    'err.duplicate_short_code': 'Este código corto ya existe en este nivel.',
    'err.invalid_short_code': 'Código corto: solo mayúsculas y cifras, máx. 10 caracteres (p. ej. RG01).',
    'err.invalid_url': 'Introduce una dirección completa con https://.',
    'err.camera': 'Cámara no disponible. Escribe el código a mano.',
    'auth.title': 'Iniciar sesión', 'auth.email': 'Correo electrónico', 'auth.password': 'Contraseña', 'auth.name': 'Nombre y apellido',
    'auth.login': 'Entrar', 'auth.register': 'Crear cuenta', 'auth.toRegister': '¿No tienes cuenta? Regístrate',
    'auth.toLogin': '¿Ya tienes cuenta? Entrar', 'auth.forgot': '¿Has olvidado la contraseña?', 'auth.sendReset': 'Enviar enlace',
    'auth.resetSent': 'Te hemos enviado un correo para restablecer la contraseña.',
    'auth.confirmSent': 'Casi listo: confirma tu correo con el enlace que te hemos enviado.',
    'auth.pendingTitle': 'Cuenta pendiente de aprobación',
    'auth.pendingText': 'Un administrador tiene que aprobar tu cuenta. Después podrás retirar y devolver máquinas.',
    'auth.newPassword': 'Nueva contraseña', 'auth.setPassword': 'Guardar contraseña', 'auth.passwordSaved': 'Contraseña guardada.',
    'auth.afterLogin': 'Al entrar, abriremos directamente {code}.',
    'auth.minLength': 'Mínimo 8 caracteres',
    'scan.title': 'Escanear código QR', 'scan.hint': 'Enfoca el código QR de la máquina, del artículo o de la ubicación.',
    'scan.manual': 'Escribir código (p. ej. M-0028)', 'scan.go': 'Abrir', 'scan.unknown': 'Código no válido: {text}',
    'scan.starting': 'Iniciando la cámara…', 'scan.torch': 'Luz',
    'page.notFound': 'Página no encontrada.', 'page.goHome': 'Ir al resumen',
    'setup.title': 'Todavía sin conexión a la base de datos',
    'setup.text': 'La app funciona en modo demostración. Para el uso real, configura Supabase (ver instrucciones) y rellena js/config.js.',
    'lang.label': 'Idioma',
  },
});
