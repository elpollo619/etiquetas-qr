// Maschinen: Liste, Maschinenkarte (Ziel nach dem Scannen), Ausleihen/Zurückgeben, Formular, ausgeliehene Maschinen.
// Routen: 'maschinen', 'maschinen/neu', 'm/:code', 'm/:code/bearbeiten', 'ausgeliehen'
import { t, registerStrings, fmtDateTime, fmtElapsed, fmtNum, fmtQty, locale } from '../i18n.js';
import {
  esc, clean, uuid, debounce, can, statusPill, conditionLabel, emptyHtml, errorText, toast, sheet,
  confirmSheet, openLightbox, thumbHtml, hydrateThumbs, downloadCsv, formData, toLocalInput, fromLocalInput, icon, numOrNull,
} from '../util.js';
import { categoryOptionsHtml, categorySubtreeIds, confidencePill, sourceLabel } from '../org-common.js';
import { mountSupplies } from '../supplies.js';

// ---------------------------------------------------------------------------
// Texte (de-CH ohne Eszett, pt-PT, es)
// ---------------------------------------------------------------------------
registerStrings({
  de: {
    'machines.title': 'Maschinen',
    'machines.new': 'Neue Maschine',
    'machines.machineNo': 'Maschine Nr. {code}',
    'machines.inventoryNo': 'Inventar-Nr.',
    'machines.serialNo': 'Seriennummer',
    'machines.usage': 'Nutzung',
    'machines.currentlyWith': 'Aktuell bei',
    'machines.since': 'Ausgeliehen seit',
    'machines.due': 'Rückgabe',
    'machines.dueOpen': 'Noch offen',
    'machines.lastUser': 'Letzter Benutzer',
    'machines.checkedOutAt': 'Ausgeliehen am',
    'machines.returnedAt': 'Zurückgegeben am',
    'machines.returnedBy': 'Zurückgegeben von',
    'machines.condition': 'Zustand',
    'machines.neverLent': 'Noch nie ausgeliehen',
    'machines.overdue': 'Überfällig',
    'machines.overdueSince': 'Überfällig seit {date} ({elapsed}). Bitte so bald wie möglich zurückgeben.',
    'machines.withBorrower': 'bei {name} · seit {elapsed}',
    'machines.withMe': 'bei dir · seit {elapsed}',
    'machines.checkout': 'Maschine ausleihen',
    'machines.return': 'Maschine zurückgeben',
    'machines.returnFor': 'Du gibst sie für {name} zurück.',
    'machines.reservedStaff': 'Reserviert – als Lagerverantwortlicher kannst du sie trotzdem ausleihen.',
    'machines.blocked.wartung': 'Diese Maschine ist in Wartung und kann im Moment nicht ausgeliehen werden.',
    'machines.blocked.defekt': 'Diese Maschine ist defekt und kann nicht ausgeliehen werden. Bitte beim Lagerverantwortlichen melden.',
    'machines.blocked.verloren': 'Diese Maschine ist als verloren gemeldet. Falls du sie gefunden hast, melde dich beim Lagerverantwortlichen.',
    'machines.blocked.archived': 'Diese Maschine ist archiviert und kann nicht ausgeliehen werden.',
    'machines.blocked.inactive': 'Dein Konto ist noch nicht freigegeben. Danach kannst du Maschinen ausleihen und zurückgeben.',
    'machines.isArchived': 'Diese Maschine ist archiviert.',
    'machines.photoZoom': 'Foto vergrössern',
    'machines.co.due': 'Geplante Rückgabe',
    'machines.co.today': 'Heute 17:00',
    'machines.co.tomorrow17': 'Morgen 17:00',
    'machines.co.tomorrow': 'Morgen',
    'machines.co.dayAfter': 'Übermorgen',
    'machines.co.week': 'In 1 Woche',
    'machines.co.none': 'Ohne Datum',
    'machines.co.pick': 'Datum wählen',
    'machines.co.pickLabel': 'Rückgabe am',
    'machines.co.until': 'Rückgabe bis {date}',
    'machines.co.noDue': 'Ohne festes Rückgabedatum',
    'machines.co.for': 'Für Mitarbeiter',
    'machines.co.me': 'Mich selbst ({name})',
    'machines.co.notePh': 'z. B. Baustelle oder Zweck',
    'machines.co.confirm': 'Ausleihen bestätigen',
    'machines.co.done': 'Maschine ausgeliehen',
    'machines.co.doneFor': 'Für {name} ausgeliehen',
    'machines.ret.cond': 'Zustand bei der Rückgabe',
    'machines.ret.ok': 'Alles in Ordnung, funktioniert einwandfrei.',
    'machines.ret.maengel': 'Funktioniert, aber etwas ist beschädigt, abgenutzt oder fehlt.',
    'machines.ret.defekt': 'Funktioniert nicht. Die Maschine wird auf «Defekt» gesetzt.',
    'machines.ret.noteReq': 'Was ist beschädigt oder fehlt?',
    'machines.ret.noteHint': 'Pflichtfeld bei Mängeln oder Defekt.',
    'machines.ret.lentBy': 'Ausgeliehen von {name} seit {date} ({elapsed})',
    'machines.ret.confirm': 'Rückgabe bestätigen',
    'machines.ret.done': 'Maschine zurückgegeben',
    'machines.ret.doneDefect': 'Zurückgegeben – die Maschine ist jetzt als defekt markiert.',
    'machines.hist.title': 'Nutzungsverlauf',
    'machines.hist.out': 'Ausgeliehen',
    'machines.hist.back': 'Zurückgegeben',
    'machines.hist.by': 'Zurückgegeben von',
    'machines.hist.note': 'Bemerkung',
    'machines.hist.until': 'bis {date}',
    'machines.hist.bookedBy': 'gebucht von {name}',
    'machines.hist.empty': 'Diese Maschine wurde noch nie ausgeliehen.',
    'machines.hist.count': '{n} Ausleihen',
    'machines.hist.noteOut': 'Ausleihe',
    'machines.hist.noteBack': 'Rückgabe',
    'machines.hist.corrected': 'korrigiert',
    'machines.hist.correct': 'Korrigieren',
    'machines.hist.actions': 'Aktionen',
    'machines.loan.open': 'Offen',
    'machines.loan.returned': 'Zurück',
    'machines.loan.overdue': 'Überfällig',
    'machines.corr.title': 'Ausleihe korrigieren',
    'machines.corr.out': 'Ausgeliehen am',
    'machines.corr.due': 'Geplante Rückgabe',
    'machines.corr.back': 'Zurückgegeben am',
    'machines.corr.backHint': 'Leer lassen = noch ausgeliehen.',
    'machines.corr.reason': 'Begründung',
    'machines.corr.reasonHint': 'Pflichtfeld – wird im Protokoll gespeichert.',
    'machines.corr.done': 'Ausleihe korrigiert',
    'machines.damage': 'Schäden / Bemerkungen',
    'machines.noDamage': 'Keine Schäden gemeldet.',
    'machines.damageReports': 'Gemeldete Schäden',
    'machines.noDetails': 'Keine Details erfasst.',
    'machines.manage': 'Verwaltung',
    'machines.printLabel': 'Etikett drucken',
    'machines.setStatus': 'Status ändern',
    'machines.onLoanHint': 'Status ändern und Archivieren sind erst nach der Rückgabe möglich.',
    'machines.st.new': 'Neuer Status',
    'machines.st.verfuegbar': 'Kann ausgeliehen werden.',
    'machines.st.reserviert': 'Nur Lagerverantwortliche können sie ausleihen.',
    'machines.st.wartung': 'Wird gewartet oder repariert.',
    'machines.st.defekt': 'Funktioniert nicht.',
    'machines.st.verloren': 'Nicht auffindbar.',
    'machines.st.notePh': 'z. B. Grund oder Reparaturauftrag',
    'machines.st.done': 'Status geändert',
    'machines.archiveQ': 'Maschine archivieren?',
    'machines.archiveText': 'Archivierte Maschinen erscheinen nicht mehr in der Liste und können nicht ausgeliehen werden. Der Verlauf bleibt erhalten.',
    'machines.archivedOk': 'Maschine archiviert',
    'machines.unarchivedOk': 'Maschine wiederhergestellt',
    'machines.deleteQ': 'Maschine endgültig löschen?',
    'machines.deleteText': '«{name}» ({code}) wird endgültig gelöscht. Das kann nicht rückgängig gemacht werden.',
    'machines.deleted': 'Maschine gelöscht',
    'machines.inUseTitle': 'Löschen nicht möglich',
    'machines.notFound': 'Keine Maschine mit dem Code {code} gefunden.',
    'machines.createWithCode': 'Maschine mit diesem Code anlegen',
    'machines.toList': 'Zur Maschinenliste',
    'machines.created': 'Maschine {code} angelegt. Drucke jetzt das QR-Etikett und klebe es auf die Maschine.',
    'machines.searchLabel': 'Maschinen durchsuchen',
    'machines.searchPh': 'Name, Code, Marke, Seriennummer, Mitarbeiter…',
    'machines.statusFilter': 'Nach Status filtern',
    'machines.allLocations': 'Alle Standorte',
    'machines.empty': 'Keine Maschinen für diese Filter gefunden.',
    'machines.emptyAll': 'Noch keine Maschinen erfasst.',
    'machines.count': '{n} Maschinen',
    'machines.countOne': '1 Maschine',
    'machines.showMore': 'Mehr anzeigen ({n} weitere)',
    'machines.resetFilters': 'Filter zurücksetzen',
    'machines.form.newTitle': 'Neue Maschine',
    'machines.form.editTitle': 'Maschine bearbeiten',
    'machines.form.namePh': 'z. B. Bohrhammer Hilti TE 30',
    'machines.form.codeAuto': 'automatisch (M-xxxx)',
    'machines.form.codeHint': 'Leer lassen = nächste freie Nummer. Der Code steht im QR-Etikett und kann später nicht geändert werden.',
    'machines.form.codeFixed': 'Der Code steht im QR-Etikett und kann nicht geändert werden.',
    'machines.form.codeInvalid': 'Ungültiger Code. Beispiel: M-0028 (oder nur die Nummer).',
    'machines.form.initialStatus': 'Anfangsstatus',
    'machines.form.homeHint': 'Wo die Maschine normalerweise gelagert wird.',
    'machines.form.noLocation': '– kein Standort –',
    'machines.form.conditionNote': 'Bemerkung zum Zustand',
    'machines.form.notAuthorized': 'Nur Lagerverantwortliche und Administratoren können Maschinen anlegen oder bearbeiten.',
    'machines.form.create': 'Maschine anlegen',
    'machines.form.createdToast': 'Maschine {code} angelegt',
    'machines.loans.title': 'Ausgeliehene Maschinen',
    'machines.loans.tabOpen': 'Aktuell ausgeliehen',
    'machines.loans.tabHistory': 'Verlauf',
    'machines.loans.overdueOne': '1 Rückgabe überfällig',
    'machines.loans.overdueMany': '{n} Rückgaben überfällig',
    'machines.loans.show': 'Anzeigen',
    'machines.loans.allOpen': 'Alle offen',
    'machines.loans.dueToday': 'Heute fällig',
    'machines.loans.noDate': 'Ohne Datum',
    'machines.loans.all': 'Alle',
    'machines.loans.open': 'Offen',
    'machines.loans.returned': 'Zurückgegeben',
    'machines.loans.allEmployees': 'Alle Mitarbeiter',
    'machines.loans.search': 'Maschine suchen',
    'machines.loans.searchPh': 'Name oder Code der Maschine…',
    'machines.loans.from': 'Ausgeliehen ab',
    'machines.loans.to': 'Ausgeliehen bis',
    'machines.loans.filterLabel': 'Nach Status filtern',
    'machines.loans.since': 'seit {date} · {elapsed}',
    'machines.loans.until': 'bis {date}',
    'machines.loans.empty': 'Im Moment ist keine Maschine ausgeliehen.',
    'machines.loans.emptyFiltered': 'Keine Einträge für diese Filter.',
    'machines.loans.emptyHistory': 'Noch keine Ausleihen erfasst.',
    'machines.loans.limitHint': 'Es werden höchstens {n} Einträge geladen. Grenze Zeitraum oder Mitarbeiter ein, um ältere Einträge zu sehen.',
    'machines.loans.planned': 'Geplante Rückgabe',
    'machines.loans.duration': 'Dauer',
    'machines.loans.inactive': 'inaktiv',
    'machines.loans.count': '{n} Einträge',
    'machines.loans.csvFile': 'ausleihen',
    'machines.loans.csvCode': 'Maschinen-Nr.',
    'machines.loans.csvNoteOut': 'Bemerkung Ausleihe',
    'machines.loans.csvNoteBack': 'Bemerkung Rückgabe',
    'machines.loans.csvCorrected': 'Korrigiert',
    'machines.allCategories': 'Alle Kategorien',
    'machines.catLink': 'Alles in dieser Kategorie anzeigen',
    'machines.responsible': 'Verantwortlich',
    'machines.noResponsible': '– niemand –',
    'machines.productUrl': 'Herstellerseite',
    'machines.productHint': 'Produktbild: nur Link, Nutzungsrechte nicht geprüft',
    'machines.codePath': 'Lesbarer Code {code}',
    'machines.set': 'Set',
    'machines.form.categoryLegacy': 'Bisherige Kategorie (Freitext): «{text}». Wähle eine Kategorie aus der Liste – sonst bleibt der Freitext erhalten.',
    'machines.form.responsibleHint': 'Zugeteilte Person, z. B. bei einem Laptop oder Firmenhandy.',
    'machines.form.productUrlPh': 'https://…',
    'machines.form.productUrlHint': 'Nur ein Link zur Produktseite (http/https). Es werden keine fremden Bilder geladen.',
    'machines.form.productUrlInvalid': 'Bitte eine vollständige Adresse eingeben, die mit http:// oder https:// beginnt.',
    'machines.form.isSet': 'Ist ein Set (mit Komponenten)',
    'machines.form.isSetHint': 'Zusammengehörige Teile, z. B. Koffer mit Akkus und Ladegerät. Die Komponenten erfasst du danach auf der Maschinenkarte.',
    'machines.comp.title': 'Komponenten',
    'machines.comp.count1': '1 Komponente',
    'machines.comp.countN': '{n} Komponenten',
    'machines.comp.empty': 'Noch keine Komponenten erfasst.',
    'machines.comp.add': 'Komponente hinzufügen',
    'machines.comp.kind': 'Art der Komponente',
    'machines.comp.kindArticle': 'Artikel',
    'machines.comp.kindMachine': 'Maschine',
    'machines.comp.kindFree': 'Freier Name',
    'machines.comp.search': 'Suchen',
    'machines.comp.searchPh': 'Name oder Code…',
    'machines.comp.noResults': 'Nichts gefunden.',
    'machines.comp.chooseHint': 'Bitte einen Eintrag aus der Liste wählen.',
    'machines.comp.freeName': 'Name der Komponente',
    'machines.comp.freeNamePh': 'z. B. Ladegerät 18 V',
    'machines.comp.qty': 'Menge',
    'machines.comp.note': 'Notiz',
    'machines.comp.notePh': 'z. B. Fach links im Koffer',
    'machines.comp.saved': 'Komponente gespeichert',
    'machines.comp.edit': 'Menge ändern',
    'machines.comp.editTitle': 'Komponente: {name}',
    'machines.comp.remove': 'Entfernen',
    'machines.comp.removeQ': 'Komponente entfernen?',
    'machines.comp.removeText': '«{name}» wird aus der Komponentenliste entfernt. Die Maschine bzw. der Artikel selbst bleibt erhalten.',
    'machines.comp.removed': 'Komponente entfernt',
    'machines.comp.check': 'Komponenten prüfen ({n})',
    'machines.comp.checkHint': 'Zum Abhaken vor Ort, damit nichts fehlt – wird nicht gespeichert.',
    'machines.comp.checked': '{n} von {total} abgehakt',
    'machines.comp.checkNone': 'Für dieses Set sind noch keine Komponenten erfasst.',
    'machines.det.title': 'Originalfotos aus der Fotoanalyse',
    'machines.det.intro': 'Aus diesen Fotos wurde der Eintrag erkannt. Foto antippen = gross.',
    'machines.det.file': 'Datei',
    'machines.det.place': 'Aufgenommen in',
    'machines.det.conf': 'Sicherheit',
    'machines.det.source': 'Herkunft',
    'machines.det.as': 'Erkannt als',
    'machines.det.zoom': 'Foto «{name}» vergrössern',
  },
  pt: {
    'machines.title': 'Máquinas',
    'machines.new': 'Nova máquina',
    'machines.machineNo': 'Máquina n.º {code}',
    'machines.inventoryNo': 'N.º de inventário',
    'machines.serialNo': 'N.º de série',
    'machines.usage': 'Utilização',
    'machines.currentlyWith': 'Atualmente com',
    'machines.since': 'Emprestada desde',
    'machines.due': 'Devolução',
    'machines.dueOpen': 'Sem data prevista',
    'machines.lastUser': 'Último utilizador',
    'machines.checkedOutAt': 'Levantada em',
    'machines.returnedAt': 'Devolvida em',
    'machines.returnedBy': 'Devolvida por',
    'machines.condition': 'Condição',
    'machines.neverLent': 'Nunca foi emprestada',
    'machines.overdue': 'Em atraso',
    'machines.overdueSince': 'Em atraso desde {date} ({elapsed}). Devolve-a o mais depressa possível.',
    'machines.withBorrower': 'com {name} · há {elapsed}',
    'machines.withMe': 'contigo · há {elapsed}',
    'machines.checkout': 'Levantar máquina',
    'machines.return': 'Devolver máquina',
    'machines.returnFor': 'Estás a devolvê-la em nome de {name}.',
    'machines.reservedStaff': 'Reservada – como responsável de armazém podes levantá-la na mesma.',
    'machines.blocked.wartung': 'Esta máquina está em manutenção e não pode ser levantada de momento.',
    'machines.blocked.defekt': 'Esta máquina está avariada e não pode ser levantada. Fala com o responsável de armazém.',
    'machines.blocked.verloren': 'Esta máquina foi dada como perdida. Se a encontraste, avisa o responsável de armazém.',
    'machines.blocked.archived': 'Esta máquina está arquivada e não pode ser levantada.',
    'machines.blocked.inactive': 'A tua conta ainda não foi aprovada. Depois poderás levantar e devolver máquinas.',
    'machines.isArchived': 'Esta máquina está arquivada.',
    'machines.photoZoom': 'Ampliar foto',
    'machines.co.due': 'Devolução prevista',
    'machines.co.today': 'Hoje 17:00',
    'machines.co.tomorrow17': 'Amanhã 17:00',
    'machines.co.tomorrow': 'Amanhã',
    'machines.co.dayAfter': 'Depois de amanhã',
    'machines.co.week': 'Daqui a 1 semana',
    'machines.co.none': 'Sem data',
    'machines.co.pick': 'Escolher data',
    'machines.co.pickLabel': 'Devolver em',
    'machines.co.until': 'Devolução até {date}',
    'machines.co.noDue': 'Sem data de devolução definida',
    'machines.co.for': 'Para o colaborador',
    'machines.co.me': 'Eu próprio ({name})',
    'machines.co.notePh': 'ex.: obra ou finalidade',
    'machines.co.confirm': 'Confirmar levantamento',
    'machines.co.done': 'Máquina levantada',
    'machines.co.doneFor': 'Levantada para {name}',
    'machines.ret.cond': 'Condição na devolução',
    'machines.ret.ok': 'Tudo em ordem, funciona perfeitamente.',
    'machines.ret.maengel': 'Funciona, mas algo está danificado, gasto ou em falta.',
    'machines.ret.defekt': 'Não funciona. A máquina passa a «Avariada».',
    'machines.ret.noteReq': 'O que está danificado ou em falta?',
    'machines.ret.noteHint': 'Obrigatório em caso de defeitos ou avaria.',
    'machines.ret.lentBy': 'Levantada por {name} desde {date} ({elapsed})',
    'machines.ret.confirm': 'Confirmar devolução',
    'machines.ret.done': 'Máquina devolvida',
    'machines.ret.doneDefect': 'Devolvida – a máquina está agora marcada como avariada.',
    'machines.hist.title': 'Histórico de utilização',
    'machines.hist.out': 'Levantada',
    'machines.hist.back': 'Devolvida',
    'machines.hist.by': 'Devolvida por',
    'machines.hist.note': 'Observação',
    'machines.hist.until': 'até {date}',
    'machines.hist.bookedBy': 'registado por {name}',
    'machines.hist.empty': 'Esta máquina nunca foi emprestada.',
    'machines.hist.count': '{n} empréstimos',
    'machines.hist.noteOut': 'Levantamento',
    'machines.hist.noteBack': 'Devolução',
    'machines.hist.corrected': 'corrigido',
    'machines.hist.correct': 'Corrigir',
    'machines.hist.actions': 'Ações',
    'machines.loan.open': 'Em aberto',
    'machines.loan.returned': 'Devolvida',
    'machines.loan.overdue': 'Em atraso',
    'machines.corr.title': 'Corrigir empréstimo',
    'machines.corr.out': 'Levantada em',
    'machines.corr.due': 'Devolução prevista',
    'machines.corr.back': 'Devolvida em',
    'machines.corr.backHint': 'Deixar vazio = ainda emprestada.',
    'machines.corr.reason': 'Motivo',
    'machines.corr.reasonHint': 'Obrigatório – fica guardado no registo.',
    'machines.corr.done': 'Empréstimo corrigido',
    'machines.damage': 'Danos / observações',
    'machines.noDamage': 'Sem danos registados.',
    'machines.damageReports': 'Danos comunicados',
    'machines.noDetails': 'Sem detalhes registados.',
    'machines.manage': 'Gestão',
    'machines.printLabel': 'Imprimir etiqueta',
    'machines.setStatus': 'Alterar estado',
    'machines.onLoanHint': 'Alterar o estado e arquivar só é possível depois da devolução.',
    'machines.st.new': 'Novo estado',
    'machines.st.verfuegbar': 'Pode ser levantada.',
    'machines.st.reserviert': 'Só os responsáveis de armazém a podem levantar.',
    'machines.st.wartung': 'Em manutenção ou reparação.',
    'machines.st.defekt': 'Não funciona.',
    'machines.st.verloren': 'Não se encontra.',
    'machines.st.notePh': 'ex.: motivo ou ordem de reparação',
    'machines.st.done': 'Estado alterado',
    'machines.archiveQ': 'Arquivar a máquina?',
    'machines.archiveText': 'As máquinas arquivadas deixam de aparecer na lista e não podem ser levantadas. O histórico mantém-se.',
    'machines.archivedOk': 'Máquina arquivada',
    'machines.unarchivedOk': 'Máquina restaurada',
    'machines.deleteQ': 'Eliminar a máquina definitivamente?',
    'machines.deleteText': '«{name}» ({code}) será eliminada definitivamente. Esta ação não pode ser anulada.',
    'machines.deleted': 'Máquina eliminada',
    'machines.inUseTitle': 'Não é possível eliminar',
    'machines.notFound': 'Não foi encontrada nenhuma máquina com o código {code}.',
    'machines.createWithCode': 'Criar máquina com este código',
    'machines.toList': 'Ir para a lista de máquinas',
    'machines.created': 'Máquina {code} criada. Imprime agora a etiqueta QR e cola-a na máquina.',
    'machines.searchLabel': 'Pesquisar máquinas',
    'machines.searchPh': 'Nome, código, marca, n.º de série, colaborador…',
    'machines.statusFilter': 'Filtrar por estado',
    'machines.allLocations': 'Todas as localizações',
    'machines.empty': 'Nenhuma máquina encontrada com estes filtros.',
    'machines.emptyAll': 'Ainda não há máquinas registadas.',
    'machines.count': '{n} máquinas',
    'machines.countOne': '1 máquina',
    'machines.showMore': 'Mostrar mais ({n})',
    'machines.resetFilters': 'Limpar filtros',
    'machines.form.newTitle': 'Nova máquina',
    'machines.form.editTitle': 'Editar máquina',
    'machines.form.namePh': 'ex.: Martelo perfurador Hilti TE 30',
    'machines.form.codeAuto': 'automático (M-xxxx)',
    'machines.form.codeHint': 'Deixar vazio = próximo número livre. O código fica na etiqueta QR e não pode ser alterado depois.',
    'machines.form.codeFixed': 'O código está na etiqueta QR e não pode ser alterado.',
    'machines.form.codeInvalid': 'Código inválido. Exemplo: M-0028 (ou só o número).',
    'machines.form.initialStatus': 'Estado inicial',
    'machines.form.homeHint': 'Onde a máquina é normalmente guardada.',
    'machines.form.noLocation': '– sem localização –',
    'machines.form.conditionNote': 'Observação sobre a condição',
    'machines.form.notAuthorized': 'Só responsáveis de armazém e administradores podem criar ou editar máquinas.',
    'machines.form.create': 'Criar máquina',
    'machines.form.createdToast': 'Máquina {code} criada',
    'machines.loans.title': 'Máquinas emprestadas',
    'machines.loans.tabOpen': 'Emprestadas agora',
    'machines.loans.tabHistory': 'Histórico',
    'machines.loans.overdueOne': '1 devolução em atraso',
    'machines.loans.overdueMany': '{n} devoluções em atraso',
    'machines.loans.show': 'Ver',
    'machines.loans.allOpen': 'Todas em aberto',
    'machines.loans.dueToday': 'Para devolver hoje',
    'machines.loans.noDate': 'Sem data',
    'machines.loans.all': 'Todos',
    'machines.loans.open': 'Em aberto',
    'machines.loans.returned': 'Devolvidas',
    'machines.loans.allEmployees': 'Todos os colaboradores',
    'machines.loans.search': 'Pesquisar máquina',
    'machines.loans.searchPh': 'Nome ou código da máquina…',
    'machines.loans.from': 'Levantadas desde',
    'machines.loans.to': 'Levantadas até',
    'machines.loans.filterLabel': 'Filtrar por estado',
    'machines.loans.since': 'desde {date} · {elapsed}',
    'machines.loans.until': 'até {date}',
    'machines.loans.empty': 'De momento não há máquinas emprestadas.',
    'machines.loans.emptyFiltered': 'Sem registos para estes filtros.',
    'machines.loans.emptyHistory': 'Ainda não há empréstimos registados.',
    'machines.loans.limitHint': 'São carregados no máximo {n} registos. Limita o período ou o colaborador para ver registos mais antigos.',
    'machines.loans.planned': 'Devolução prevista',
    'machines.loans.duration': 'Duração',
    'machines.loans.inactive': 'inativo',
    'machines.loans.count': '{n} registos',
    'machines.loans.csvFile': 'emprestimos',
    'machines.loans.csvCode': 'N.º máquina',
    'machines.loans.csvNoteOut': 'Observação levantamento',
    'machines.loans.csvNoteBack': 'Observação devolução',
    'machines.loans.csvCorrected': 'Corrigido',
    'machines.allCategories': 'Todas as categorias',
    'machines.catLink': 'Ver tudo nesta categoria',
    'machines.responsible': 'Responsável',
    'machines.noResponsible': '– ninguém –',
    'machines.productUrl': 'Página do fabricante',
    'machines.productHint': 'Imagem do produto: só ligação, direitos de utilização não verificados',
    'machines.codePath': 'Código legível {code}',
    'machines.set': 'Conjunto',
    'machines.form.categoryLegacy': 'Categoria anterior (texto livre): «{text}». Escolhe uma categoria da lista – caso contrário, o texto livre mantém-se.',
    'machines.form.responsibleHint': 'Pessoa atribuída, p. ex. para um portátil ou telemóvel da empresa.',
    'machines.form.productUrlPh': 'https://…',
    'machines.form.productUrlHint': 'Só uma ligação para a página do produto (http/https). Não são carregadas imagens externas.',
    'machines.form.productUrlInvalid': 'Introduz um endereço completo que comece por http:// ou https://.',
    'machines.form.isSet': 'É um conjunto (com componentes)',
    'machines.form.isSetHint': 'Peças que pertencem juntas, p. ex. mala com baterias e carregador. Os componentes registam-se depois na ficha da máquina.',
    'machines.comp.title': 'Componentes',
    'machines.comp.count1': '1 componente',
    'machines.comp.countN': '{n} componentes',
    'machines.comp.empty': 'Ainda não há componentes registados.',
    'machines.comp.add': 'Adicionar componente',
    'machines.comp.kind': 'Tipo de componente',
    'machines.comp.kindArticle': 'Artigo',
    'machines.comp.kindMachine': 'Máquina',
    'machines.comp.kindFree': 'Nome livre',
    'machines.comp.search': 'Pesquisar',
    'machines.comp.searchPh': 'Nome ou código…',
    'machines.comp.noResults': 'Nada encontrado.',
    'machines.comp.chooseHint': 'Escolhe um registo da lista.',
    'machines.comp.freeName': 'Nome do componente',
    'machines.comp.freeNamePh': 'ex.: Carregador 18 V',
    'machines.comp.qty': 'Quantidade',
    'machines.comp.note': 'Nota',
    'machines.comp.notePh': 'ex.: compartimento esquerdo da mala',
    'machines.comp.saved': 'Componente guardado',
    'machines.comp.edit': 'Alterar quantidade',
    'machines.comp.editTitle': 'Componente: {name}',
    'machines.comp.remove': 'Remover',
    'machines.comp.removeQ': 'Remover o componente?',
    'machines.comp.removeText': '«{name}» é removido da lista de componentes. A máquina ou o artigo em si mantém-se.',
    'machines.comp.removed': 'Componente removido',
    'machines.comp.check': 'Verificar componentes ({n})',
    'machines.comp.checkHint': 'Para marcar no local, para que nada falte – não é guardado.',
    'machines.comp.checked': '{n} de {total} marcados',
    'machines.comp.checkNone': 'Este conjunto ainda não tem componentes registados.',
    'machines.det.title': 'Fotos originais da análise de fotos',
    'machines.det.intro': 'O registo foi reconhecido a partir destas fotos. Toca na foto para ampliar.',
    'machines.det.file': 'Ficheiro',
    'machines.det.place': 'Tirada em',
    'machines.det.conf': 'Certeza',
    'machines.det.source': 'Origem',
    'machines.det.as': 'Reconhecido como',
    'machines.det.zoom': 'Ampliar a foto «{name}»',
  },
  es: {
    'machines.title': 'Máquinas',
    'machines.new': 'Nueva máquina',
    'machines.machineNo': 'Máquina n.º {code}',
    'machines.inventoryNo': 'N.º de inventario',
    'machines.serialNo': 'N.º de serie',
    'machines.usage': 'Uso',
    'machines.currentlyWith': 'Ahora la tiene',
    'machines.since': 'Prestada desde',
    'machines.due': 'Devolución',
    'machines.dueOpen': 'Sin fecha prevista',
    'machines.lastUser': 'Último usuario',
    'machines.checkedOutAt': 'Retirada el',
    'machines.returnedAt': 'Devuelta el',
    'machines.returnedBy': 'Devuelta por',
    'machines.condition': 'Condición',
    'machines.neverLent': 'Nunca se ha prestado',
    'machines.overdue': 'Atrasada',
    'machines.overdueSince': 'Atrasada desde {date} ({elapsed}). Devuélvela lo antes posible.',
    'machines.withBorrower': 'con {name} · hace {elapsed}',
    'machines.withMe': 'contigo · hace {elapsed}',
    'machines.checkout': 'Retirar máquina',
    'machines.return': 'Devolver máquina',
    'machines.returnFor': 'La devuelves en nombre de {name}.',
    'machines.reservedStaff': 'Reservada: como responsable de almacén puedes retirarla igualmente.',
    'machines.blocked.wartung': 'Esta máquina está en mantenimiento y ahora no se puede retirar.',
    'machines.blocked.defekt': 'Esta máquina está averiada y no se puede retirar. Habla con el responsable de almacén.',
    'machines.blocked.verloren': 'Esta máquina figura como perdida. Si la has encontrado, avisa al responsable de almacén.',
    'machines.blocked.archived': 'Esta máquina está archivada y no se puede retirar.',
    'machines.blocked.inactive': 'Tu cuenta aún no está aprobada. Después podrás retirar y devolver máquinas.',
    'machines.isArchived': 'Esta máquina está archivada.',
    'machines.photoZoom': 'Ampliar foto',
    'machines.co.due': 'Devolución prevista',
    'machines.co.today': 'Hoy 17:00',
    'machines.co.tomorrow17': 'Mañana 17:00',
    'machines.co.tomorrow': 'Mañana',
    'machines.co.dayAfter': 'Pasado mañana',
    'machines.co.week': 'En 1 semana',
    'machines.co.none': 'Sin fecha',
    'machines.co.pick': 'Elegir fecha',
    'machines.co.pickLabel': 'Devolver el',
    'machines.co.until': 'Devolución hasta {date}',
    'machines.co.noDue': 'Sin fecha de devolución fija',
    'machines.co.for': 'Para el empleado',
    'machines.co.me': 'Yo mismo ({name})',
    'machines.co.notePh': 'p. ej. obra o finalidad',
    'machines.co.confirm': 'Confirmar retirada',
    'machines.co.done': 'Máquina retirada',
    'machines.co.doneFor': 'Retirada para {name}',
    'machines.ret.cond': 'Condición al devolver',
    'machines.ret.ok': 'Todo en orden, funciona perfectamente.',
    'machines.ret.maengel': 'Funciona, pero algo está dañado, desgastado o falta.',
    'machines.ret.defekt': 'No funciona. La máquina pasará a «Defectuosa».',
    'machines.ret.noteReq': '¿Qué está dañado o qué falta?',
    'machines.ret.noteHint': 'Obligatorio si hay desperfectos o avería.',
    'machines.ret.lentBy': 'Retirada por {name} desde {date} ({elapsed})',
    'machines.ret.confirm': 'Confirmar devolución',
    'machines.ret.done': 'Máquina devuelta',
    'machines.ret.doneDefect': 'Devuelta: la máquina queda marcada como defectuosa.',
    'machines.hist.title': 'Historial de uso',
    'machines.hist.out': 'Retirada',
    'machines.hist.back': 'Devuelta',
    'machines.hist.by': 'Devuelta por',
    'machines.hist.note': 'Observación',
    'machines.hist.until': 'hasta {date}',
    'machines.hist.bookedBy': 'registrado por {name}',
    'machines.hist.empty': 'Esta máquina nunca se ha prestado.',
    'machines.hist.count': '{n} préstamos',
    'machines.hist.noteOut': 'Retirada',
    'machines.hist.noteBack': 'Devolución',
    'machines.hist.corrected': 'corregido',
    'machines.hist.correct': 'Corregir',
    'machines.hist.actions': 'Acciones',
    'machines.loan.open': 'Abierto',
    'machines.loan.returned': 'Devuelta',
    'machines.loan.overdue': 'Atrasada',
    'machines.corr.title': 'Corregir préstamo',
    'machines.corr.out': 'Retirada el',
    'machines.corr.due': 'Devolución prevista',
    'machines.corr.back': 'Devuelta el',
    'machines.corr.backHint': 'Dejar vacío = sigue prestada.',
    'machines.corr.reason': 'Motivo',
    'machines.corr.reasonHint': 'Obligatorio: se guarda en el registro.',
    'machines.corr.done': 'Préstamo corregido',
    'machines.damage': 'Daños / observaciones',
    'machines.noDamage': 'Sin daños registrados.',
    'machines.damageReports': 'Daños comunicados',
    'machines.noDetails': 'Sin detalles registrados.',
    'machines.manage': 'Gestión',
    'machines.printLabel': 'Imprimir etiqueta',
    'machines.setStatus': 'Cambiar estado',
    'machines.onLoanHint': 'Cambiar el estado y archivar solo es posible tras la devolución.',
    'machines.st.new': 'Nuevo estado',
    'machines.st.verfuegbar': 'Se puede retirar.',
    'machines.st.reserviert': 'Solo los responsables de almacén pueden retirarla.',
    'machines.st.wartung': 'En mantenimiento o reparación.',
    'machines.st.defekt': 'No funciona.',
    'machines.st.verloren': 'No se encuentra.',
    'machines.st.notePh': 'p. ej. motivo u orden de reparación',
    'machines.st.done': 'Estado cambiado',
    'machines.archiveQ': '¿Archivar la máquina?',
    'machines.archiveText': 'Las máquinas archivadas ya no aparecen en la lista y no se pueden retirar. El historial se conserva.',
    'machines.archivedOk': 'Máquina archivada',
    'machines.unarchivedOk': 'Máquina restaurada',
    'machines.deleteQ': '¿Eliminar la máquina definitivamente?',
    'machines.deleteText': '«{name}» ({code}) se eliminará definitivamente. No se puede deshacer.',
    'machines.deleted': 'Máquina eliminada',
    'machines.inUseTitle': 'No se puede eliminar',
    'machines.notFound': 'No se ha encontrado ninguna máquina con el código {code}.',
    'machines.createWithCode': 'Crear máquina con este código',
    'machines.toList': 'Ir a la lista de máquinas',
    'machines.created': 'Máquina {code} creada. Imprime ahora la etiqueta QR y pégala en la máquina.',
    'machines.searchLabel': 'Buscar máquinas',
    'machines.searchPh': 'Nombre, código, marca, n.º de serie, empleado…',
    'machines.statusFilter': 'Filtrar por estado',
    'machines.allLocations': 'Todas las ubicaciones',
    'machines.empty': 'No hay máquinas con estos filtros.',
    'machines.emptyAll': 'Todavía no hay máquinas registradas.',
    'machines.count': '{n} máquinas',
    'machines.countOne': '1 máquina',
    'machines.showMore': 'Mostrar más ({n})',
    'machines.resetFilters': 'Quitar filtros',
    'machines.form.newTitle': 'Nueva máquina',
    'machines.form.editTitle': 'Editar máquina',
    'machines.form.namePh': 'p. ej. Martillo perforador Hilti TE 30',
    'machines.form.codeAuto': 'automático (M-xxxx)',
    'machines.form.codeHint': 'Dejar vacío = siguiente número libre. El código va en la etiqueta QR y no se puede cambiar después.',
    'machines.form.codeFixed': 'El código está en la etiqueta QR y no se puede cambiar.',
    'machines.form.codeInvalid': 'Código no válido. Ejemplo: M-0028 (o solo el número).',
    'machines.form.initialStatus': 'Estado inicial',
    'machines.form.homeHint': 'Dónde se guarda normalmente la máquina.',
    'machines.form.noLocation': '– sin ubicación –',
    'machines.form.conditionNote': 'Observación sobre la condición',
    'machines.form.notAuthorized': 'Solo los responsables de almacén y los administradores pueden crear o editar máquinas.',
    'machines.form.create': 'Crear máquina',
    'machines.form.createdToast': 'Máquina {code} creada',
    'machines.loans.title': 'Máquinas prestadas',
    'machines.loans.tabOpen': 'Prestadas ahora',
    'machines.loans.tabHistory': 'Historial',
    'machines.loans.overdueOne': '1 devolución atrasada',
    'machines.loans.overdueMany': '{n} devoluciones atrasadas',
    'machines.loans.show': 'Ver',
    'machines.loans.allOpen': 'Todas abiertas',
    'machines.loans.dueToday': 'Vencen hoy',
    'machines.loans.noDate': 'Sin fecha',
    'machines.loans.all': 'Todos',
    'machines.loans.open': 'Abiertos',
    'machines.loans.returned': 'Devueltas',
    'machines.loans.allEmployees': 'Todos los empleados',
    'machines.loans.search': 'Buscar máquina',
    'machines.loans.searchPh': 'Nombre o código de la máquina…',
    'machines.loans.from': 'Retiradas desde',
    'machines.loans.to': 'Retiradas hasta',
    'machines.loans.filterLabel': 'Filtrar por estado',
    'machines.loans.since': 'desde {date} · {elapsed}',
    'machines.loans.until': 'hasta {date}',
    'machines.loans.empty': 'Ahora mismo no hay máquinas prestadas.',
    'machines.loans.emptyFiltered': 'No hay registros con estos filtros.',
    'machines.loans.emptyHistory': 'Todavía no hay préstamos registrados.',
    'machines.loans.limitHint': 'Se cargan como máximo {n} registros. Limita el periodo o el empleado para ver registros más antiguos.',
    'machines.loans.planned': 'Devolución prevista',
    'machines.loans.duration': 'Duración',
    'machines.loans.inactive': 'inactivo',
    'machines.loans.count': '{n} registros',
    'machines.loans.csvFile': 'prestamos',
    'machines.loans.csvCode': 'N.º máquina',
    'machines.loans.csvNoteOut': 'Observación retirada',
    'machines.loans.csvNoteBack': 'Observación devolución',
    'machines.loans.csvCorrected': 'Corregido',
    'machines.allCategories': 'Todas las categorías',
    'machines.catLink': 'Ver todo en esta categoría',
    'machines.responsible': 'Responsable',
    'machines.noResponsible': '– nadie –',
    'machines.productUrl': 'Página del fabricante',
    'machines.productHint': 'Imagen del producto: solo enlace, derechos de uso no comprobados',
    'machines.codePath': 'Código legible {code}',
    'machines.set': 'Set',
    'machines.form.categoryLegacy': 'Categoría anterior (texto libre): «{text}». Elige una categoría de la lista; si no, se conserva el texto libre.',
    'machines.form.responsibleHint': 'Persona asignada, p. ej. para un portátil o un móvil de empresa.',
    'machines.form.productUrlPh': 'https://…',
    'machines.form.productUrlHint': 'Solo un enlace a la página del producto (http/https). No se cargan imágenes externas.',
    'machines.form.productUrlInvalid': 'Introduce una dirección completa que empiece por http:// o https://.',
    'machines.form.isSet': 'Es un set (con componentes)',
    'machines.form.isSetHint': 'Piezas que van juntas, p. ej. maletín con baterías y cargador. Los componentes se registran después en la ficha de la máquina.',
    'machines.comp.title': 'Componentes',
    'machines.comp.count1': '1 componente',
    'machines.comp.countN': '{n} componentes',
    'machines.comp.empty': 'Todavía no hay componentes registrados.',
    'machines.comp.add': 'Añadir componente',
    'machines.comp.kind': 'Tipo de componente',
    'machines.comp.kindArticle': 'Artículo',
    'machines.comp.kindMachine': 'Máquina',
    'machines.comp.kindFree': 'Nombre libre',
    'machines.comp.search': 'Buscar',
    'machines.comp.searchPh': 'Nombre o código…',
    'machines.comp.noResults': 'No se ha encontrado nada.',
    'machines.comp.chooseHint': 'Elige una entrada de la lista.',
    'machines.comp.freeName': 'Nombre del componente',
    'machines.comp.freeNamePh': 'p. ej. Cargador 18 V',
    'machines.comp.qty': 'Cantidad',
    'machines.comp.note': 'Nota',
    'machines.comp.notePh': 'p. ej. compartimento izquierdo del maletín',
    'machines.comp.saved': 'Componente guardado',
    'machines.comp.edit': 'Cambiar cantidad',
    'machines.comp.editTitle': 'Componente: {name}',
    'machines.comp.remove': 'Quitar',
    'machines.comp.removeQ': '¿Quitar el componente?',
    'machines.comp.removeText': '«{name}» se quita de la lista de componentes. La máquina o el artículo en sí se conserva.',
    'machines.comp.removed': 'Componente quitado',
    'machines.comp.check': 'Comprobar componentes ({n})',
    'machines.comp.checkHint': 'Para marcar en el sitio y que no falte nada; no se guarda.',
    'machines.comp.checked': '{n} de {total} marcados',
    'machines.comp.checkNone': 'Este set todavía no tiene componentes registrados.',
    'machines.det.title': 'Fotos originales del análisis de fotos',
    'machines.det.intro': 'La entrada se reconoció a partir de estas fotos. Toca la foto para ampliarla.',
    'machines.det.file': 'Archivo',
    'machines.det.place': 'Tomada en',
    'machines.det.conf': 'Seguridad',
    'machines.det.source': 'Origen',
    'machines.det.as': 'Reconocido como',
    'machines.det.zoom': 'Ampliar la foto «{name}»',
  },
});

// ---------------------------------------------------------------------------
// Konstanten und kleine Helfer
// ---------------------------------------------------------------------------
const SS_LIST = 'lgr.machines.list';
const SS_LOANS = 'lgr.machines.loans';
const SS_CREATED = 'lgr.machines.created';
const LIST_PAGE = 60;
const HIST_PAGE = 50;
const LOAN_LIMIT = 1000;
const SET_STATUSES = ['verfuegbar', 'reserviert', 'wartung', 'defekt', 'verloren'];
const NEW_STATUSES = ['verfuegbar', 'reserviert', 'wartung', 'defekt'];
const CONDITIONS = ['ok', 'maengel', 'defekt'];
const LIST_FILTERS = ['all', 'verfuegbar', 'ausgeliehen', 'overdue', 'reserviert', 'wartung', 'defekt', 'verloren'];
const OPEN_CHIPS = ['all', 'overdue', 'today', 'nodue'];
const HIST_CHIPS = ['all', 'open', 'returned', 'overdue'];

// Fehler mit bekanntem Code (Anzeige über errorText → err.*)
function fail(code) { const e = new Error(code); e.code = code; return e; }

function mount(ctx) {
  const root = document.createElement('div');
  root.className = 'page';
  ctx.el.replaceChildren(root);
  return root;
}
function setTitle(ctx, s) { try { if (ctx.setTitle) ctx.setTitle(s); } catch (e) { /* egal */ } }
function loadingHtml() { return `<div class="empty"><p>${esc(t('common.loading'))}</p></div>`; }
function errorBlock(err) {
  return emptyHtml(errorText(err), `<button type="button" class="btn" data-act="retry">${icon('history')}${esc(t('btn.retry'))}</button>`);
}

function qget(ctx, key) {
  const q = ctx.query;
  if (!q) return null;
  const v = typeof q.get === 'function' ? q.get(key) : q[key];
  return v === undefined || v === null || v === '' ? null : String(v);
}
function ssGet(key) { try { return JSON.parse(sessionStorage.getItem(key) || 'null'); } catch (e) { return null; } }
function ssSet(key, v) { try { sessionStorage.setItem(key, JSON.stringify(v)); } catch (e) { /* ohne Speicher */ } }

function decodeCode(raw) {
  let s = String(raw ?? '');
  try { s = decodeURIComponent(s); } catch (e) { /* schon dekodiert */ }
  return clean(s.split('?')[0]).toUpperCase();
}
const codeHref = (code) => '#/m/' + encodeURIComponent(code);
const codeRoute = (code) => 'm/' + encodeURIComponent(code);

// Suchtext ohne Gross/Klein und ohne Akzente
function norm(s) { return String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
function terms(q) { return norm(q).split(/\s+/).filter(Boolean); }
function textOrNull(v) { const s = String(v ?? '').trim(); return s === '' ? null : s; }   // Zeilenumbrüche bleiben

function localDay(iso) { return iso ? toLocalInput(iso).slice(0, 10) : ''; }
function todayLocal() { return localDay(new Date().toISOString()); }
function at17(addDays) { const d = new Date(); d.setDate(d.getDate() + addDays); d.setHours(17, 0, 0, 0); return d; }
function fmtDue(d) {
  try {
    return new Intl.DateTimeFormat(locale(), { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d);
  } catch (e) { return fmtDateTime(d); }
}
// «2 T», «3 Std», «45 Min» (nur die grösste Einheit, für Listen)
function shortElapsed(from) {
  const ms = Date.now() - new Date(from).getTime();
  if (!isFinite(ms)) return '–';
  const min = Math.max(0, Math.floor(ms / 60000)), h = Math.floor(min / 60), d = Math.floor(h / 24);
  if (d > 0) return `${d} ${t('time.d')}`;
  if (h > 0) return `${h} ${t('time.h')}`;
  return `${min} ${t('time.min')}`;
}
// Datum für Excel (CH/DE): «06.11.2026 07:30»
function csvDate(iso) {
  const v = iso ? toLocalInput(iso) : '';
  return v ? `${v.slice(8, 10)}.${v.slice(5, 7)}.${v.slice(0, 4)} ${v.slice(11, 16)}` : '';
}

function isOnLoan(m) { return m.status === 'ausgeliehen' || !!m.open_loan_id; }
function machineOverdue(m) {
  if (!isOnLoan(m)) return false;
  if (m.overdue === true) return true;
  return !!m.open_due_at && new Date(m.open_due_at).getTime() < Date.now();
}
function loanOverdue(l) {
  if (l.returned_at) return false;
  if (l.overdue === true) return true;
  return !!l.due_at && new Date(l.due_at).getTime() < Date.now();
}
function loanState(l) { return l.returned_at ? 'returned' : loanOverdue(l) ? 'overdue' : 'open'; }
function loanPill(state) {
  const cls = state === 'overdue' ? 'pill-danger' : state === 'open' ? 'pill-ausgeliehen' : 'pill-ok';
  return `<span class="pill ${cls}">${esc(t('machines.loan.' + state))}</span>`;
}
function condPill(c) {
  if (!c) return '<span class="muted">–</span>';
  const cls = c === 'ok' ? 'pill-ok' : c === 'maengel' ? 'pill-warn' : 'pill-danger';
  return `<span class="pill ${cls}">${esc(conditionLabel(c))}</span>`;
}
function personHtml(ctx, id, name) {
  const mine = !!(ctx.user && id && ctx.user.id === id);
  return `${esc(name || '–')}${mine ? ` <span class="muted">(${esc(t('common.you'))})</span>` : ''}`;
}
function countLabel(n) { return n === 1 ? t('machines.countOne') : t('machines.count', { n }); }

// Gemeinsame Module des Leads: dynamisch laden, damit diese Ansicht auch ohne sie funktioniert
let modsCache = null;
function loadMods() {
  if (modsCache) return modsCache;
  const p = Promise.all([
    import('../media.js').catch((e) => { console.warn('[machines] media.js', e); return null; }),
    import('../labels.js').catch((e) => { console.warn('[machines] labels.js', e); return null; }),
  ]).then(([media, labels]) => {
    if (!media || !labels) modsCache = null;   // beim nächsten Mal erneut versuchen
    return { media, labels };
  });
  modsCache = p;
  return p;
}
async function printLabel(m) {
  const { labels } = await loadMods();
  if (!labels || !labels.openLabelDialog) { toast(t('err.unknown'), 'error'); return; }
  try { await labels.openLabelDialog([labels.labelItem('machine', m)]); } catch (err) { toast(errorText(err), 'error'); }
}

// ---------------------------------------------------------------------------
// Erweiterung «Lager organisieren»: Kategorie, Herstellerseite, Originalfotos, Sets
// ---------------------------------------------------------------------------
// Nur http/https als Link zulassen (Daten können aus einem Import stammen)
function safeUrl(v) {
  const s = String(v ?? '').trim();
  if (!s || /\s/.test(s)) return null;
  try {
    const u = new URL(s);
    return (u.protocol === 'http:' || u.protocol === 'https:') && u.hostname ? u.href : null;
  } catch (e) { return null; }
}
function productLinkHtml(url) {
  const href = safeUrl(url);
  if (!href) return '';
  let host = href;
  try { host = new URL(href).hostname.replace(/^www\./, ''); } catch (e) { /* egal */ }
  return `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer nofollow">${esc(host)} ${icon('arrowOut')}</a>
    <div class="small muted" style="font-weight:400">${esc(t('machines.productHint'))}</div>`;
}
// Kategorie: Pfad als Link zur Suche (#/suche?kat=<id>), sonst bisheriger Freitext
function categoryHtml(m) {
  if (m.category_id && (m.category_path || m.category)) {
    return `<a href="#/suche?kat=${encodeURIComponent(m.category_id)}" title="${esc(t('machines.catLink'))}">${esc(m.category_path || m.category)}</a>`;
  }
  return m.category ? esc(m.category) : '';
}
function catText(m) { return m.category_path || m.category || ''; }
async function safeList(fn) {
  try { const r = await fn(); return Array.isArray(r) ? r : []; } catch (e) { return []; }
}

// Komponenten eines Sets (Zeilen aus api.listComponents)
function compName(c) { return c.machine_name || c.article_name || c.name || '–'; }
function compCode(c) { return c.machine_code || c.article_code || ''; }
function compHref(c) {
  if (c.machine_id && c.machine_code) return '#/m/' + encodeURIComponent(c.machine_code);
  if (c.article_id && c.article_code) return '#/a/' + encodeURIComponent(c.article_code);
  return '';
}
function compQty(c) {
  const n = Number(c.qty);
  const q = Number.isFinite(n) ? n : 1;
  return c.article_id && c.unit ? fmtQty(q, c.unit) : `${fmtNum(q)} ×`;
}
function compCountLabel(n) { return n === 1 ? t('machines.comp.count1') : t('machines.comp.countN', { n }); }

// Checkliste der Komponenten im Ausleih-/Rückgabedialog (nur Anzeige zum Abhaken, keine Speicherung)
function setChecklistHtml() {
  return `<fieldset class="field" data-setcheck style="border:0;padding:0;margin:0;min-width:0">
    <legend class="lbl" style="padding:0;margin-bottom:5px" data-setcheck-title>${esc(t('machines.comp.title'))}</legend>
    <div data-setcheck-body><p class="small muted" style="margin:0">${esc(t('common.loading'))}</p></div>
  </fieldset>`;
}
function fillSetChecklist(el, ctx, m) {
  const box = el.querySelector('[data-setcheck]');
  if (!box) return;
  const body = box.querySelector('[data-setcheck-body]');
  const title = box.querySelector('[data-setcheck-title]');
  Promise.resolve()
    .then(() => ctx.api.listComponents(m.id))
    .then((rows) => {
      if (!box.isConnected) return;
      const list = Array.isArray(rows) ? rows : [];
      if (!list.length) { body.innerHTML = `<p class="small muted" style="margin:0">${esc(t('machines.comp.checkNone'))}</p>`; return; }
      title.textContent = t('machines.comp.check', { n: list.length });
      body.innerHTML = `<p class="hint" style="margin:0 0 6px">${esc(t('machines.comp.checkHint'))}</p>
        <div class="stack" style="gap:4px">${list.map((c, i) => `
          <label class="check" style="align-items:flex-start;min-height:36px">
            <input type="checkbox" data-setitem="${i}">
            <span><b class="nowrap">${esc(compQty(c))}</b> ${esc(compName(c))}${compCode(c) ? ` <span class="muted mono small">${esc(compCode(c))}</span>` : ''}
              ${c.note ? `<span class="small muted" style="display:block">${esc(c.note)}</span>` : ''}</span>
          </label>`).join('')}</div>
        <p class="small muted" style="margin:6px 0 0" data-setcheck-progress aria-live="polite">${esc(t('machines.comp.checked', { n: 0, total: list.length }))}</p>`;
      const prog = body.querySelector('[data-setcheck-progress]');
      body.addEventListener('change', () => {
        const n = body.querySelectorAll('[data-setitem]:checked').length;
        prog.textContent = t('machines.comp.checked', { n, total: list.length });
      });
    })
    .catch((err) => { if (box.isConnected) body.innerHTML = `<p class="small" style="margin:0;color:var(--danger)">${esc(errorText(err))}</p>`; });
}

// Originalfotos aus der Fotoanalyse (detection_overview) – zeigt, woher der Eintrag stammt
function detectionsHtml(list, name) {
  const seen = new Set();
  const rows = list.filter((d) => d.photo_path && !seen.has(d.photo_id || d.photo_path) && seen.add(d.photo_id || d.photo_path));
  if (!rows.length) return '';
  const kv = (k, v) => (v ? `<dt>${esc(k)}</dt><dd>${v}</dd>` : '');
  const fig = (d, i) => {
    const hasPos = d.pos_x !== null && d.pos_x !== undefined && d.pos_y !== null && d.pos_y !== undefined
      && Number.isFinite(Number(d.pos_x)) && Number.isFinite(Number(d.pos_y));
    const px = hasPos ? Math.min(100, Math.max(0, Number(d.pos_x) * 100)) : 0;
    const py = hasPos ? Math.min(100, Math.max(0, Number(d.pos_y) * 100)) : 0;
    return `<figure class="card" style="margin:0;padding:8px;display:flex;flex-direction:column;gap:8px">
      <button type="button" data-detzoom="${i}" aria-label="${esc(t('machines.det.zoom', { name: d.photo_file_name || name }))}"
        style="position:relative;display:block;width:100%;padding:0;border:0;background:none;cursor:zoom-in;border-radius:10px;overflow:hidden">
        <img data-path="${esc(d.photo_path)}" alt="" loading="lazy" style="display:block;width:100%;height:auto;min-height:120px;background:var(--surface-3)">
        ${hasPos ? `<span aria-hidden="true" style="position:absolute;left:${px}%;top:${py}%;width:26px;height:26px;margin:-13px 0 0 -13px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 0 2px var(--danger),0 1px 6px rgba(0,0,0,.5)"></span>` : ''}
      </button>
      <figcaption><dl class="kv left small" style="gap:4px 10px">
        ${kv(t('machines.det.file'), d.photo_file_name ? `<span style="font-weight:500;overflow-wrap:anywhere">${esc(d.photo_file_name)}</span>` : '')}
        ${kv(t('machines.det.place'), d.photo_location_path ? `<span style="font-weight:500">${esc(d.photo_location_path)}</span>` : '')}
        ${kv(t('machines.det.conf'), confidencePill(d.confidence))}
        ${kv(t('machines.det.source'), `<span style="font-weight:500">${esc(sourceLabel(d.source))}</span>`)}
        ${d.name && d.name !== name ? kv(t('machines.det.as'), `<span style="font-weight:500">${esc(d.name)}</span>`) : ''}
      </dl></figcaption>
    </figure>`;
  };
  return `<p class="hint" style="margin:0 0 8px">${esc(t('machines.det.intro'))}</p>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,240px),1fr));gap:12px">${rows.map(fig).join('')}</div>`;
}
function mountDetections(section, ctx, filter, name) {
  if (!section || typeof ctx.api.listDetections !== 'function') return;
  Promise.resolve()
    .then(() => ctx.api.listDetections(filter))
    .then((rows) => {
      if (!section.isConnected) return;
      const html = detectionsHtml(Array.isArray(rows) ? rows : [], name);
      if (!html) return;   // von Hand erfasst → kein Abschnitt
      const box = section.querySelector('[data-det-body]');
      box.innerHTML = html;
      section.hidden = false;
      // Eintrag hat ein eigenes Bild → Originalfotos stehen eingeklappt darunter (nicht alles doppelt); Anzahl im Titel
      const cnt = section.querySelector('[data-det-count]');
      if (cnt) cnt.textContent = '(' + box.querySelectorAll('figure').length + ')';
      hydrateThumbs(box, ctx.api);
      box.addEventListener('click', (e) => {
        const b = e.target.closest('[data-detzoom]');
        const img = b && b.querySelector('img');
        if (img && img.src) openLightbox(img.src, name);
      });
    })
    .catch(() => { /* Originalfotos sind nicht kritisch */ });
}

// Unterlagerorte einschliessen (Filter «Hauptlager» zeigt auch «Hauptlager / Regal B»)
function descendants(locs, id) {
  const kids = new Map();
  for (const l of locs) {
    const p = l.parent_id || '';
    if (!kids.has(p)) kids.set(p, []);
    kids.get(p).push(l.id);
  }
  const out = new Set([id]);
  const stack = [id];
  while (stack.length) {
    for (const k of kids.get(stack.pop()) || []) if (!out.has(k)) { out.add(k); stack.push(k); }
  }
  return out;
}

// ===========================================================================
// 1) Maschinenkarte «m/:code» – alles auf einen Blick, eine grosse Hauptaktion
// ===========================================================================
async function machineCard(ctx) {
  const code = decodeCode(ctx.params.code);
  const root = mount(ctx);
  setTitle(ctx, code);
  root.innerHTML = loadingHtml();
  root.addEventListener('click', (e) => { if (e.target.closest('[data-act="retry"]')) ctx.reload(); });

  let m, mods;
  try {
    [m, mods] = await Promise.all([ctx.api.getMachineByCode(code), loadMods()]);
  } catch (err) {
    if (!root.isConnected) return;
    root.innerHTML = `<a class="back-link" href="#/maschinen">${icon('back')}${esc(t('machines.title'))}</a>${errorBlock(err)}`;
    toast(errorText(err), 'error');
    return;
  }
  if (!root.isConnected) return;
  if (!m) {
    const staff = can(ctx.user, 'staff');
    root.innerHTML = `
      <a class="back-link" href="#/maschinen">${icon('back')}${esc(t('machines.title'))}</a>
      ${emptyHtml(t('machines.notFound', { code }), `<div class="row" style="justify-content:center">
        <a class="btn" href="#/maschinen">${esc(t('machines.toList'))}</a>
        ${staff && /^M-\d{1,8}$/.test(code) ? `<a class="btn primary" href="#/maschinen/neu?code=${encodeURIComponent(code)}">${icon('plus')}${esc(t('machines.createWithCode'))}</a>` : ''}
      </div>`)}`;
    return;
  }
  setTitle(ctx, m.name);
  renderMachineCard(ctx, root, m, mods);
}

function renderMachineCard(ctx, root, m, mods) {
  const { api, user } = ctx;
  const me = user ? user.id : null;
  const active = can(user);
  const staff = can(user, 'staff');
  const admin = can(user, 'admin');
  const onLoan = isOnLoan(m);
  const overdue = machineOverdue(m);
  const mine = onLoan && !!me && m.open_borrower_id === me;
  const canCheckout = active && !onLoan && !m.archived && (m.status === 'verfuegbar' || (m.status === 'reserviert' && staff));
  const profilesP = canCheckout && staff ? api.listProfiles().catch(() => []) : null;
  let loans = [];
  let histShown = HIST_PAGE;

  let created = false;
  try { if (sessionStorage.getItem(SS_CREATED) === m.code) { created = true; sessionStorage.removeItem(SS_CREATED); } } catch (e) { /* egal */ }

  // --- Kopf: Foto oder QR, Name, Nummer, Status ---
  const heroMedia = m.photo_path
    ? `<button type="button" data-act="zoom" aria-label="${esc(t('machines.photoZoom'))}" style="padding:0;border:0;background:none;cursor:zoom-in;border-radius:12px">${thumbHtml(m.photo_path, m.name, 'thumb lg', 'machine')}</button>`
    : `<div class="thumb lg" data-qr role="img" aria-label="${esc(t('common.qr'))} ${esc(m.code)}" style="background:#fff;padding:4px"></div>`;
  const codeLine = esc(t('machines.machineNo', { code: m.code }))
    + (m.inventory_no ? ` · ${esc(t('machines.inventoryNo'))} ${esc(m.inventory_no)}` : '');
  const pills = statusPill(m.status)
    + (overdue ? ` <span class="pill pill-danger">${esc(t('machines.overdue'))}</span>` : '')
    + (m.is_set ? ` <span class="pill pill-info">${esc(t('machines.set'))}</span>` : '')
    + (m.archived ? ` <span class="pill pill-muted">${esc(t('common.archived'))}</span>` : '');
  const locHtml = m.location_path
    ? `${esc(m.location_path)}${m.location_code_path ? `<div class="small muted mono" style="font-weight:400">${esc(t('machines.codePath', { code: m.location_code_path }))}</div>` : ''}`
    : '–';

  // --- Nutzung (dl.kv) ---
  const kv = (label, value) => `<dt>${esc(label)}</dt><dd>${value}</dd>`;
  const usage = [];
  if (onLoan) {
    usage.push(kv(t('common.status'), statusPill('ausgeliehen')));
    usage.push(kv(t('machines.currentlyWith'), personHtml(ctx, m.open_borrower_id, m.open_borrower_name)));
    usage.push(kv(t('machines.since'), m.open_since
      ? `${esc(fmtDateTime(m.open_since))}<div class="small muted" style="font-weight:400">${esc(fmtElapsed(m.open_since))}</div>` : '–'));
    usage.push(kv(t('machines.due'), m.open_due_at
      ? `<span${overdue ? ' style="color:var(--danger)"' : ''}>${esc(fmtDateTime(m.open_due_at))}</span>`
      : esc(t('machines.dueOpen'))));
  } else {
    usage.push(kv(t('common.status'), statusPill(m.status)));
    if (m.last_borrower_name || m.last_returned_at) {
      usage.push(kv(t('machines.lastUser'), personHtml(ctx, m.last_borrower_id, m.last_borrower_name)));
      usage.push(kv(t('machines.checkedOutAt'), esc(fmtDateTime(m.last_checked_out_at))));
      usage.push(kv(t('machines.returnedAt'), esc(fmtDateTime(m.last_returned_at))));
      if (m.last_returned_by_name && m.last_returned_by_name !== m.last_borrower_name) {
        usage.push(kv(t('machines.returnedBy'), esc(m.last_returned_by_name)));
      }
    } else {
      usage.push(kv(t('machines.lastUser'), `<span class="muted" style="font-weight:400">${esc(t('machines.neverLent'))}</span>`));
    }
    usage.push(kv(t('common.location'), locHtml));
    const condColor = m.condition === 'defekt' ? 'var(--danger)' : m.condition === 'maengel' ? 'var(--warn)' : '';
    usage.push(kv(t('machines.condition'), `<span${condColor ? ` style="color:${condColor}"` : ''}>${esc(conditionLabel(m.condition || 'ok'))}</span>`
      + (m.condition_note ? `<div class="small muted" style="font-weight:400;white-space:pre-wrap">${esc(m.condition_note)}</div>` : '')));
  }
  if (m.responsible_name) usage.push(kv(t('machines.responsible'), personHtml(ctx, m.responsible_id, m.responsible_name)));
  const notices = [];
  if (overdue && m.open_due_at) {
    notices.push(`<div class="alert danger" role="alert">${icon('alert')}<span>${esc(t('machines.overdueSince', { date: fmtDateTime(m.open_due_at), elapsed: fmtElapsed(m.open_due_at) }))}</span></div>`);
  }
  if (onLoan && active && !mine && m.open_borrower_name) {
    notices.push(`<div class="alert">${icon('user')}<span>${esc(t('machines.returnFor', { name: m.open_borrower_name }))}</span></div>`);
  }
  if (m.archived) notices.push(`<div class="alert warn">${icon('alert')}<span>${esc(t('machines.isArchived'))}</span></div>`);

  // --- Grosse Hauptaktion ---
  let actionHtml;
  if (!active) {
    actionHtml = `<div class="alert warn">${icon('clock')}<span>${esc(t('machines.blocked.inactive'))}</span></div>`;
  } else if (onLoan) {
    actionHtml = `<div class="big-action"><button type="button" class="btn primary block" data-act="return">${icon('arrowIn')}${esc(t('machines.return'))}</button></div>`;
  } else if (canCheckout) {
    actionHtml = `${m.status === 'reserviert' ? `<div class="alert warn">${icon('alert')}<span>${esc(t('machines.reservedStaff'))}</span></div>` : ''}
      <div class="big-action"><button type="button" class="btn primary block" data-act="checkout">${icon('arrowOut')}${esc(t('machines.checkout'))}</button></div>`;
  } else {
    const why = m.archived ? t('machines.blocked.archived')
      : m.status === 'reserviert' ? t('err.reserved')
        : t('machines.blocked.' + m.status);
    const cls = m.status === 'defekt' || m.status === 'verloren' ? 'danger' : 'warn';
    actionHtml = `<div class="stack">
      <button type="button" class="btn block" disabled aria-describedby="mc-why">${icon('arrowOut')}${esc(t('machines.checkout'))}</button>
      <div class="alert ${cls}" id="mc-why">${icon('alert')}<span>${esc(why)}</span></div></div>`;
  }

  // --- Details ---
  const details = [
    ['common.category', categoryHtml(m)], ['common.brand', esc(m.brand)], ['common.model', esc(m.model)],
    ['machines.serialNo', esc(m.serial_no)], ['machines.inventoryNo', esc(m.inventory_no)],
    ['machines.productUrl', productLinkHtml(m.product_url)],
  ].filter(([, v]) => clean(v));
  const detailsHtml = (details.length || m.notes)
    ? `${details.length ? `<dl class="kv">${details.map(([k, v]) => kv(t(k), v)).join('')}</dl>` : ''}
       ${m.notes ? `<div${details.length ? ' style="margin-top:12px"' : ''}><div class="small muted" style="font-weight:650">${esc(t('common.notes'))}</div><p style="white-space:pre-wrap;margin:4px 0 0">${esc(m.notes)}</p></div>` : ''}`
    : `<p class="muted" style="margin:0">${esc(t('machines.noDetails'))}</p>`;

  // --- Verwaltung (Lagerverantwortliche / Admin) ---
  const manageHtml = staff ? `
    <section class="section" aria-labelledby="mc-man-h">
      <h2 id="mc-man-h">${esc(t('machines.manage'))}</h2>
      <div class="card stack">
        <div class="row">
          <a class="btn" href="${codeHref(m.code)}/bearbeiten">${icon('edit')}${esc(t('btn.edit'))}</a>
          <button type="button" class="btn" data-act="label">${icon('print')}${esc(t('machines.printLabel'))}</button>
          <button type="button" class="btn" data-act="status"${onLoan ? ' disabled aria-describedby="mc-loanhint"' : ''}>${icon('wrench')}${esc(t('machines.setStatus'))}</button>
          ${m.archived
            ? `<button type="button" class="btn" data-act="unarchive">${icon('history')}${esc(t('btn.unarchive'))}</button>`
            : `<button type="button" class="btn" data-act="archive"${onLoan ? ' disabled aria-describedby="mc-loanhint"' : ''}>${icon('box')}${esc(t('btn.archive'))}</button>`}
          ${admin ? `<button type="button" class="btn danger-outline" data-act="delete">${icon('trash')}${esc(t('btn.delete'))}</button>` : ''}
        </div>
        ${onLoan ? `<p class="hint" id="mc-loanhint" style="margin:0">${esc(t('machines.onLoanHint'))}</p>` : ''}
      </div>
    </section>` : '';

  root.innerHTML = `
    <a class="back-link" href="#/maschinen">${icon('back')}${esc(t('machines.title'))}</a>
    ${created ? `<div class="alert ok" role="status">${icon('check')}<div class="stack" style="gap:8px"><span>${esc(t('machines.created', { code: m.code }))}</span>
      <div><button type="button" class="btn sm" data-act="label">${icon('print')}${esc(t('machines.printLabel'))}</button></div></div></div>` : ''}
    <div class="card">
      <div class="machine-hero">
        ${heroMedia}
        <div style="min-width:0">
          <h1>${esc(m.name)}</h1>
          <div class="code">${codeLine}</div>
          <div class="row" style="gap:6px">${pills}</div>
        </div>
      </div>
      <div class="usage-box">
        <h2>${esc(t('machines.usage'))}</h2>
        <dl class="kv" data-usage>${usage.join('')}</dl>
        ${notices.length ? `<div class="stack" style="margin-top:12px">${notices.join('')}</div>` : ''}
      </div>
    </div>
    ${actionHtml}
    ${m.is_set ? `<section class="section" aria-labelledby="mc-comp-h">
      <div class="section-head"><h2 id="mc-comp-h">${esc(t('machines.comp.title'))}</h2><span class="small muted" data-comp-count></span></div>
      <div class="stack" data-comp>${loadingHtml()}</div>
    </section>` : ''}
    <section class="section" aria-labelledby="mc-hist-h">
      <div class="section-head"><h2 id="mc-hist-h">${esc(t('machines.hist.title'))}</h2><span class="small muted" data-hist-count></span></div>
      <div data-hist>${loadingHtml()}</div>
    </section>
    <section class="section" aria-labelledby="mc-dmg-h">
      <h2 id="mc-dmg-h">${esc(t('machines.damage'))}</h2>
      <div class="stack" data-damage>${damageHtml(m, [])}</div>
    </section>
    <section class="section" aria-labelledby="mc-det-h">
      <h2 id="mc-det-h">${esc(t('common.details'))}</h2>
      <div class="card">${detailsHtml}</div>
    </section>
    <section class="section" aria-labelledby="mc-det-photos-h" data-det hidden>
      ${m.photo_path
    ? `<details class="det-more"><summary>${icon('chevron')}<h2 id="mc-det-photos-h">${esc(t('machines.det.title'))}</h2><span class="muted small" data-det-count></span></summary><div data-det-body></div></details>`
    : `<h2 id="mc-det-photos-h">${esc(t('machines.det.title'))}</h2>
      <div data-det-body></div>`}
    </section>
    <div data-supplies hidden></div>
    <div class="stack" data-media></div>
    ${manageHtml}`;

  hydrateThumbs(root, api);
  mountDetections(root.querySelector('[data-det]'), ctx, { machineId: m.id }, m.name);

  // Komponenten (nur Sets)
  let comps = [];
  const compEl = root.querySelector('[data-comp]');
  const renderComps = () => {
    if (!compEl) return;
    root.querySelector('[data-comp-count]').textContent = comps.length ? compCountLabel(comps.length) : '';
    const rows = comps.map((c) => {
      const href = compHref(c);
      const title = href ? `<a href="${href}">${esc(compName(c))}</a>` : esc(compName(c));
      const sub = [compCode(c), c.note].filter(Boolean).map(esc).join(' · ');
      return `<div class="list-item" style="flex-wrap:wrap">
        <span class="nowrap" style="min-width:56px;font-size:17px;font-weight:750;font-variant-numeric:tabular-nums">${esc(compQty(c))}</span>
        <div class="li-main" style="flex:1 1 160px">
          <span class="li-title" style="white-space:normal">${title}</span>
          ${sub ? `<span class="li-sub" style="white-space:normal">${sub}</span>` : ''}
        </div>
        ${staff ? `<div class="row" style="gap:6px;margin-left:auto">
          <button type="button" class="btn sm" data-act="comp-edit" data-comp-id="${esc(c.id)}">${icon('edit')}${esc(t('machines.comp.edit'))}</button>
          <button type="button" class="btn sm danger-outline" data-act="comp-del" data-comp-id="${esc(c.id)}" aria-label="${esc(t('machines.comp.remove'))}: ${esc(compName(c))}">${icon('trash')}${esc(t('machines.comp.remove'))}</button>
        </div>` : ''}
      </div>`;
    }).join('');
    compEl.innerHTML = (comps.length ? `<div class="list">${rows}</div>` : `<p class="muted" style="margin:0">${esc(t('machines.comp.empty'))}</p>`)
      + (staff ? `<div><button type="button" class="btn" data-act="comp-add">${icon('plus')}${esc(t('machines.comp.add'))}</button></div>` : '');
  };
  const loadComps = async () => {
    if (!compEl) return;
    try {
      const rows = await api.listComponents(m.id);
      comps = Array.isArray(rows) ? rows : [];
    } catch (err) {
      if (compEl.isConnected) compEl.innerHTML = emptyHtml(errorText(err), `<button type="button" class="btn" data-act="comp-retry">${esc(t('btn.retry'))}</button>`);
      return;
    }
    if (compEl.isConnected) renderComps();
  };
  loadComps();

  // QR-Code anzeigen, wenn es kein Foto gibt
  const qrBox = root.querySelector('[data-qr]');
  if (qrBox) {
    (async () => {
      const L = mods && mods.labels;
      let svg = '';
      try {
        if (L && L.ensureQrLib) await L.ensureQrLib();
        svg = L && L.qrSvg ? L.qrSvg(L.qrUrl(m.code), { size: 76, margin: 1 }) : '';
      } catch (e) { svg = ''; }
      if (!qrBox.isConnected) return;
      if (svg) {
        qrBox.innerHTML = svg;
        const s = qrBox.querySelector('svg');
        if (s) { s.setAttribute('width', '100%'); s.setAttribute('height', '100%'); s.style.display = 'block'; }
      } else {
        qrBox.classList.add('thumb-empty');
        qrBox.style.background = '';
        qrBox.innerHTML = icon('machine');
      }
    })();
  }

  // Bedarf: Verbrauchsmaterial/Zubehör dieses Geräts
  mountSupplies(root.querySelector('[data-supplies]'), ctx, m);

  // Fotos und Dokumente (Schadenfotos erscheinen in der Galerie)
  const mediaEl = root.querySelector('[data-media]');
  if (mods && mods.media && mods.media.mediaSection) {
    Promise.resolve()
      .then(() => mods.media.mediaSection(mediaEl, { ctx, entity: 'machine', entityId: m.id, kinds: ['photo', 'document'] }))
      .catch((err) => { if (mediaEl.isConnected) mediaEl.innerHTML = `<div class="alert danger">${icon('alert')}<span>${esc(errorText(err))}</span></div>`; });
  } else {
    mediaEl.remove();
  }

  // Nutzungsverlauf laden (Karte ist schon sichtbar)
  const histEl = root.querySelector('[data-hist]');
  const histCount = root.querySelector('[data-hist-count]');
  const renderHist = () => {
    histEl.innerHTML = historyHtml(ctx, loans, histShown);
    histCount.textContent = loans.length ? t('machines.hist.count', { n: loans.length }) : '';
  };
  const loadHist = async () => {
    histEl.innerHTML = loadingHtml();
    try {
      loans = await api.listLoans({ machineId: m.id, limit: LOAN_LIMIT });
    } catch (err) {
      if (histEl.isConnected) histEl.innerHTML = emptyHtml(errorText(err), `<button type="button" class="btn" data-act="hist-retry">${esc(t('btn.retry'))}</button>`);
      return;
    }
    if (!root.isConnected) return;
    loans = Array.isArray(loans) ? loans : [];
    renderHist();
    root.querySelector('[data-damage]').innerHTML = damageHtml(m, loans);
    // Bemerkung der offenen Ausleihe in der Nutzungsübersicht zeigen
    const open = loans.find((l) => !l.returned_at);
    if (onLoan && open && open.checkout_note) {
      root.querySelector('[data-usage]').insertAdjacentHTML('beforeend',
        kv(t('common.note'), `<span style="font-weight:400;white-space:pre-wrap">${esc(open.checkout_note)}</span>`));
    }
  };
  loadHist();

  // --- Aktionen ---
  root.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || !root.contains(b) || b.disabled) return;
    const act = b.dataset.act;
    if (act === 'checkout') openCheckout(ctx, m, profilesP);
    else if (act === 'return') openReturn(ctx, m, mods);
    else if (act === 'zoom') {
      const img = b.querySelector('img');
      if (img && img.src) openLightbox(img.src, m.name);
    } else if (act === 'label') printLabel(m);
    else if (act === 'status') openStatus(ctx, m);
    else if (act === 'archive') archiveMachine(ctx, m, true);
    else if (act === 'unarchive') archiveMachine(ctx, m, false);
    else if (act === 'delete') deleteMachine(ctx, m);
    else if (act === 'hist-more') { histShown += HIST_PAGE * 4; renderHist(); }
    else if (act === 'hist-retry') loadHist();
    else if (act === 'comp-retry') { compEl.innerHTML = loadingHtml(); loadComps(); }
    else if (act === 'comp-add') { if (await openComponentAdd(ctx, m, comps)) loadComps(); }
    else if (act === 'comp-edit' || act === 'comp-del') {
      const c = comps.find((x) => String(x.id) === b.dataset.compId);
      if (!c) return;
      if (act === 'comp-edit' ? await openComponentEdit(ctx, c) : await removeComponent(ctx, c)) loadComps();
    }
    else if (act === 'correct') {
      const loan = loans.find((l) => String(l.id) === b.dataset.loan);
      if (loan) openCorrection(ctx, loan);
    }
  });
}

// --- Komponenten (Sets) hinzufügen / ändern / entfernen ---
function qtyValid(v) {
  const n = numOrNull(v);
  return n !== null && n > 0 && n < 1e6 ? Math.round(n * 1000) / 1000 : null;
}
async function openComponentAdd(ctx, m, existing) {
  const { api } = ctx;
  let kind = 'article';
  let chosen = null;            // { type: 'article'|'machine', row }
  let pool = { article: null, machine: null };
  const body = `
    <p class="muted" style="margin:0"><b style="color:var(--text)">${esc(m.name)}</b> · ${esc(m.code)}</p>
    <div class="field">
      <span class="lbl" id="mc-ck-l">${esc(t('machines.comp.kind'))}</span>
      <div class="chips" role="group" aria-labelledby="mc-ck-l">
        <button type="button" class="chip" data-ckind="article" aria-pressed="true">${icon('box')}${esc(t('machines.comp.kindArticle'))}</button>
        <button type="button" class="chip" data-ckind="machine" aria-pressed="false">${icon('machine')}${esc(t('machines.comp.kindMachine'))}</button>
        <button type="button" class="chip" data-ckind="free" aria-pressed="false">${icon('edit')}${esc(t('machines.comp.kindFree'))}</button>
      </div>
    </div>
    <div class="field" data-cpick>
      <label for="mc-cq">${esc(t('machines.comp.search'))}</label>
      <input type="search" id="mc-cq" placeholder="${esc(t('machines.comp.searchPh'))}" autocomplete="off" enterkeyhint="search">
      <div class="list" data-cres role="listbox" aria-label="${esc(t('machines.comp.search'))}" style="max-height:260px;overflow:auto;margin-top:6px"></div>
    </div>
    <div class="field" data-cfree hidden>
      <label for="mc-cname">${esc(t('machines.comp.freeName'))} <span aria-hidden="true">*</span></label>
      <input type="text" id="mc-cname" maxlength="200" placeholder="${esc(t('machines.comp.freeNamePh'))}" autocomplete="off">
    </div>
    <div class="field">
      <label for="mc-cqty">${esc(t('machines.comp.qty'))}</label>
      <input type="text" id="mc-cqty" inputmode="decimal" value="1" autocomplete="off" style="max-width:140px">
    </div>
    <div class="field">
      <label for="mc-cnote">${esc(t('machines.comp.note'))} <span class="muted">(${esc(t('common.optional'))})</span></label>
      <input type="text" id="mc-cnote" maxlength="500" placeholder="${esc(t('machines.comp.notePh'))}" autocomplete="off">
    </div>`;
  const res = await sheet({
    title: t('machines.comp.add'),
    body,
    onOpen: (el) => {
      const q = el.querySelector('#mc-cq');
      const resEl = el.querySelector('[data-cres]');
      const load = async (k) => {
        if (pool[k]) return pool[k];
        resEl.innerHTML = `<p class="small muted" style="margin:6px 0">${esc(t('common.loading'))}</p>`;
        const rows = k === 'article' ? await safeList(() => api.listArticles({})) : await safeList(() => api.listMachines({}));
        pool[k] = rows.filter((r) => !r.archived && r.id !== m.id)
          .map((r) => ({ r, hay: norm(`${r.name} ${r.code} ${r.brand || ''} ${r.model || ''} ${r.category_path || r.category || ''}`) }))
          .sort((a, b) => String(a.r.name).localeCompare(String(b.r.name), locale()));
        return pool[k];
      };
      const render = async () => {
        if (kind === 'free') return;
        const k = kind;
        const list = await load(k);
        if (k !== kind || !resEl.isConnected) return;
        const tm = terms(q.value);
        const hits = list.filter((x) => !tm.length || tm.every((w) => x.hay.includes(w))).slice(0, 30);
        if (!hits.length) { resEl.innerHTML = `<p class="small muted" style="margin:6px 0">${esc(t('machines.comp.noResults'))}</p>`; return; }
        resEl.innerHTML = hits.map(({ r }) => {
          const on = chosen && chosen.type === k && chosen.row.id === r.id;
          const used = existing.some((c) => (k === 'article' ? c.article_id : c.machine_id) === r.id);
          return `<button type="button" class="list-item" role="option" aria-selected="${on}" data-cpick-id="${esc(r.id)}"
            style="width:100%;text-align:left;cursor:pointer;${on ? 'box-shadow:inset 4px 0 0 var(--primary);background:var(--accent-soft)' : ''}">
            <div class="li-main"><span class="li-title">${esc(r.name)}</span>
              <span class="li-sub"><span class="mono">${esc(r.code)}</span>${r.location_path ? ' · ' + esc(r.location_path) : ''}</span></div>
            <div class="li-end">${on ? icon('check') : used ? `<span class="pill pill-muted">${esc(t('machines.comp.title'))}</span>` : ''}</div>
          </button>`;
        }).join('');
      };
      el.querySelectorAll('[data-ckind]').forEach((b) => b.addEventListener('click', () => {
        kind = b.dataset.ckind;
        el.querySelectorAll('[data-ckind]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        el.querySelector('[data-cpick]').hidden = kind === 'free';
        el.querySelector('[data-cfree]').hidden = kind !== 'free';
        if (chosen && chosen.type !== kind) chosen = null;
        if (kind === 'free') el.querySelector('#mc-cname').focus();
        else { render(); q.focus(); }
      }));
      q.addEventListener('input', debounce(render, 120));
      q.addEventListener('keydown', (e) => { if (e.key === 'Enter') e.preventDefault(); });
      resEl.addEventListener('click', (e) => {
        const b = e.target.closest('[data-cpick-id]');
        if (!b) return;
        const hit = (pool[kind] || []).find((x) => x.r.id === b.dataset.cpickId);
        if (hit) { chosen = { type: kind, row: hit.r }; render(); }
      });
      render();
    },
    actions: [
      { label: t('btn.cancel'), kind: 'ghost', value: null },
      {
        label: t('btn.save'), kind: 'primary', icon: 'check',
        onClick: async (el) => {
          const qty = qtyValid(el.querySelector('#mc-cqty').value);
          if (qty === null) { el.querySelector('#mc-cqty').focus(); throw fail('invalid_qty'); }
          const note = textOrNull(clean(el.querySelector('#mc-cnote').value));
          const sort = existing.reduce((mx, c) => Math.max(mx, Number(c.sort) || 0), 0) + 1;
          const obj = { set_id: m.id, qty, note, sort };
          if (kind === 'free') {
            const name = clean(el.querySelector('#mc-cname').value);
            if (!name) { el.querySelector('#mc-cname').focus(); throw fail('name_required'); }
            obj.name = name;
          } else {
            if (!chosen || chosen.type !== kind) {
              el.querySelector('#mc-cq').focus();
              const box = el.querySelector('.sheet-error');
              box.textContent = t('machines.comp.chooseHint'); box.hidden = false;
              return false;
            }
            if (kind === 'article') obj.article_id = chosen.row.id; else obj.machine_id = chosen.row.id;
          }
          return api.saveComponent(obj);
        },
      },
    ],
  });
  if (!res) return false;
  toast(t('machines.comp.saved'));
  return true;
}
async function openComponentEdit(ctx, c) {
  const res = await sheet({
    title: t('machines.comp.editTitle', { name: compName(c) }),
    body: `
      <div class="field">
        <label for="mc-ceqty">${esc(t('machines.comp.qty'))}</label>
        <input type="text" id="mc-ceqty" inputmode="decimal" value="${esc(String(c.qty ?? 1))}" autocomplete="off" style="max-width:140px">
      </div>
      <div class="field">
        <label for="mc-cenote">${esc(t('machines.comp.note'))} <span class="muted">(${esc(t('common.optional'))})</span></label>
        <input type="text" id="mc-cenote" maxlength="500" value="${esc(c.note || '')}" placeholder="${esc(t('machines.comp.notePh'))}" autocomplete="off">
      </div>`,
    actions: [
      { label: t('btn.cancel'), kind: 'ghost', value: null },
      {
        label: t('btn.save'), kind: 'primary', icon: 'check',
        onClick: async (el) => {
          const qty = qtyValid(el.querySelector('#mc-ceqty').value);
          if (qty === null) { el.querySelector('#mc-ceqty').focus(); throw fail('invalid_qty'); }
          return ctx.api.saveComponent({ id: c.id, qty, note: textOrNull(clean(el.querySelector('#mc-cenote').value)) });
        },
      },
    ],
  });
  if (!res) return false;
  toast(t('machines.comp.saved'));
  return true;
}
async function removeComponent(ctx, c) {
  const ok = await confirmSheet(t('machines.comp.removeQ'), t('machines.comp.removeText', { name: compName(c) }), { okLabel: t('machines.comp.remove'), danger: true });
  if (!ok) return false;
  try {
    await ctx.api.deleteComponent(c.id);
    toast(t('machines.comp.removed'));
    return true;
  } catch (err) { toast(errorText(err), 'error'); return false; }
}

function damageHtml(m, loans) {
  const parts = [];
  if ((m.condition && m.condition !== 'ok') || m.condition_note) {
    const cls = m.condition === 'defekt' ? 'danger' : m.condition === 'maengel' ? 'warn' : '';
    parts.push(`<div class="alert ${cls}">${icon('alert')}<div><b>${esc(t('machines.condition'))}: ${esc(conditionLabel(m.condition || 'ok'))}</b>
      ${m.condition_note ? `<div style="white-space:pre-wrap">${esc(m.condition_note)}</div>` : ''}</div></div>`);
  }
  const reports = loans.filter((l) => l.returned_at && l.return_condition && l.return_condition !== 'ok').slice(0, 5);
  if (reports.length) {
    parts.push(`<div class="small muted" style="font-weight:650">${esc(t('machines.damageReports'))}</div>
      <div class="list">${reports.map((l) => `
        <div class="list-item">
          <div class="li-main">
            <span class="li-title" style="white-space:normal">${esc(l.return_note || '–')}</span>
            <span class="li-sub">${esc(fmtDateTime(l.returned_at))} · ${esc(l.returned_by_name || l.borrower_name || '–')}</span>
          </div>
          <div class="li-end">${condPill(l.return_condition)}</div>
        </div>`).join('')}</div>`);
  }
  if (!parts.length) parts.push(`<p class="muted" style="margin:0">${esc(t('machines.noDamage'))}</p>`);
  return parts.join('');
}

function historyHtml(ctx, loans, shown) {
  if (!loans.length) return emptyHtml(t('machines.hist.empty'));
  const admin = can(ctx.user, 'admin');
  const showBy = loans.some((l) => l.returned_at && l.returned_by && l.returned_by !== l.borrower_id);
  const rows = loans.slice(0, shown).map((l) => {
    const st = loanState(l);
    const cls = st === 'overdue' ? 'is-overdue' : st === 'open' ? 'is-open' : '';
    const booked = l.created_by && l.created_by !== l.borrower_id && l.created_by_name
      ? `<div class="small muted">${esc(t('machines.hist.bookedBy', { name: l.created_by_name }))}</div>` : '';
    const out = `${esc(fmtDateTime(l.checked_out_at))}${l.due_at ? `<div class="small muted">${esc(t('machines.hist.until', { date: fmtDateTime(l.due_at) }))}</div>` : ''}`;
    const back = l.returned_at
      ? `${esc(fmtDateTime(l.returned_at))}<div class="small muted">${esc(fmtElapsed(l.checked_out_at, l.returned_at))}</div>`
      : `<span class="muted">–</span><div class="small muted">${esc(fmtElapsed(l.checked_out_at))}</div>`;
    const byOther = l.returned_at && l.returned_by && l.returned_by !== l.borrower_id;
    const notes = [
      l.checkout_note ? `<div><span class="muted">${esc(t('machines.hist.noteOut'))}:</span> ${esc(l.checkout_note)}</div>` : '',
      l.return_note ? `<div><span class="muted">${esc(t('machines.hist.noteBack'))}:</span> ${esc(l.return_note)}</div>` : '',
    ].join('') || '<span class="muted">–</span>';
    return `<tr class="${cls}">
      <td>${personHtml(ctx, l.borrower_id, l.borrower_name)}${booked}</td>
      <td>${out}</td>
      <td>${back}</td>
      ${showBy ? `<td>${byOther ? personHtml(ctx, l.returned_by, l.returned_by_name) : ''}</td>` : ''}
      <td>${l.returned_at ? condPill(l.return_condition) : '<span class="muted">–</span>'}</td>
      <td>${loanPill(st)}${l.corrected ? ` <span class="pill pill-muted">${esc(t('machines.hist.corrected'))}</span>` : ''}</td>
      <td class="wrap">${notes}</td>
      ${admin ? `<td><button type="button" class="btn sm" data-act="correct" data-loan="${esc(l.id)}">${icon('edit')}${esc(t('machines.hist.correct'))}</button></td>` : ''}
    </tr>`;
  }).join('');
  const rest = loans.length - shown;
  return `<div class="table-wrap" style="position:relative"><table class="table">
      <caption class="sr-only">${esc(t('machines.hist.title'))}</caption>
      <thead><tr>
        <th scope="col">${esc(t('common.employee'))}</th>
        <th scope="col">${esc(t('machines.hist.out'))}</th>
        <th scope="col">${esc(t('machines.hist.back'))}</th>
        ${showBy ? `<th scope="col">${esc(t('machines.hist.by'))}</th>` : ''}
        <th scope="col">${esc(t('machines.condition'))}</th>
        <th scope="col">${esc(t('common.status'))}</th>
        <th scope="col">${esc(t('machines.hist.note'))}</th>
        ${admin ? `<th scope="col"><span class="sr-only">${esc(t('machines.hist.actions'))}</span></th>` : ''}
      </tr></thead>
      <tbody>${rows}</tbody></table></div>
    ${rest > 0 ? `<div><button type="button" class="btn ghost" data-act="hist-more">${icon('chevron')}${esc(t('machines.showMore', { n: rest }))}</button></div>` : ''}`;
}

// --- Ausleihen (≤ 2 Tipps: Knopf → Bestätigen) ---
function dueChoices() {
  const late = Date.now() >= at17(0).getTime();
  const list = late
    ? [{ key: 'd1', label: t('machines.co.tomorrow17'), days: 1 }, { key: 'd2', label: t('machines.co.dayAfter'), days: 2 }]
    : [{ key: 'd0', label: t('machines.co.today'), days: 0 }, { key: 'd1', label: t('machines.co.tomorrow'), days: 1 }];
  list.push({ key: 'd7', label: t('machines.co.week'), days: 7 },
    { key: 'none', label: t('machines.co.none') },
    { key: 'pick', label: t('machines.co.pick') });
  return list;
}
function dueDate(choice, pickValue) {
  if (choice.key === 'none') return null;
  if (choice.key === 'pick') {
    const d = pickValue ? new Date(pickValue) : null;
    return d && !isNaN(d) ? d : undefined;
  }
  let d = at17(choice.days);
  if (d.getTime() <= Date.now()) d = at17(choice.days + 1);   // Dialog lange offen → nicht in der Vergangenheit
  return d;
}

function openCheckout(ctx, m, profilesP) {
  const staff = can(ctx.user, 'staff');
  const requestId = uuid();                // bei Wiederholung derselben Ausleihe wiederverwenden
  const choices = dueChoices();
  let choice = choices[0];
  const meName = ctx.user ? ctx.user.full_name : '';
  const body = `
    <p class="muted" style="margin:0"><b style="color:var(--text)">${esc(m.name)}</b> · ${esc(m.code)}</p>
    ${m.status === 'reserviert' ? `<div class="alert warn">${icon('alert')}<span>${esc(t('status.reserviert'))}</span></div>` : ''}
    <div class="field">
      <span class="lbl" id="mc-due-l">${esc(t('machines.co.due'))}</span>
      <div class="chips" role="group" aria-labelledby="mc-due-l">
        ${choices.map((c, i) => `<button type="button" class="chip" data-due="${c.key}" aria-pressed="${i === 0}"${i === 0 ? ' autofocus' : ''}>${esc(c.label)}</button>`).join('')}
      </div>
      <div class="hint" data-due-hint aria-live="polite"></div>
    </div>
    <div class="field" data-pick hidden>
      <label for="mc-co-pick">${esc(t('machines.co.pickLabel'))}</label>
      <input type="datetime-local" id="mc-co-pick" value="${esc(toLocalInput(at17(1).toISOString()))}" min="${esc(toLocalInput(new Date().toISOString()))}">
    </div>
    ${staff ? `<div class="field">
      <label for="mc-co-for">${esc(t('machines.co.for'))}</label>
      <select id="mc-co-for"><option value="">${esc(t('machines.co.me', { name: meName }))}</option></select>
    </div>` : ''}
    <div class="field">
      <label for="mc-co-note">${esc(t('common.note'))} <span class="muted">(${esc(t('common.optional'))})</span></label>
      <textarea id="mc-co-note" rows="2" maxlength="500" placeholder="${esc(t('machines.co.notePh'))}"></textarea>
    </div>
    ${m.is_set ? setChecklistHtml() : ''}`;

  return sheet({
    title: t('machines.checkout'),
    body,
    onOpen: (el) => {
      if (m.is_set) fillSetChecklist(el, ctx, m);
      const hint = el.querySelector('[data-due-hint]');
      const pick = el.querySelector('#mc-co-pick');
      const update = () => {
        const d = dueDate(choice, pick.value);
        hint.textContent = d === null ? t('machines.co.noDue') : d ? t('machines.co.until', { date: fmtDue(d) }) : '';
      };
      el.querySelectorAll('[data-due]').forEach((btn) => btn.addEventListener('click', () => {
        choice = choices.find((c) => c.key === btn.dataset.due) || choices[0];
        el.querySelectorAll('[data-due]').forEach((x) => x.setAttribute('aria-pressed', String(x === btn)));
        el.querySelector('[data-pick]').hidden = choice.key !== 'pick';
        update();
        if (choice.key === 'pick') pick.focus();
      }));
      pick.addEventListener('input', update);
      update();
      if (profilesP) {
        profilesP.then((list) => {
          const sel = el.querySelector('#mc-co-for');
          if (!sel) return;
          sel.insertAdjacentHTML('beforeend', (list || [])
            .filter((p) => p.active && p.id !== (ctx.user && ctx.user.id))
            .map((p) => `<option value="${esc(p.id)}">${esc(p.full_name)}</option>`).join(''));
        });
      }
    },
    actions: [
      { label: t('btn.cancel'), kind: 'ghost', value: null },
      {
        label: t('machines.co.confirm'), kind: 'primary', icon: 'check',
        onClick: async (el) => {
          const d = dueDate(choice, el.querySelector('#mc-co-pick').value);
          if (d === undefined) throw fail('invalid_dates');
          if (d && d.getTime() < Date.now()) throw fail('due_in_past');
          const sel = el.querySelector('#mc-co-for');
          const borrowerId = sel && sel.value ? sel.value : null;
          const note = textOrNull(el.querySelector('#mc-co-note').value);
          const loan = await ctx.api.checkoutMachine(m.id, { requestId, dueAt: d ? d.toISOString() : null, note, borrowerId });
          return { loan, forName: borrowerId ? sel.selectedOptions[0].textContent : null };
        },
      },
    ],
  }).then((res) => {
    if (!res || !res.loan) return;
    toast(res.forName ? t('machines.co.doneFor', { name: res.forName }) : t('machines.co.done'));
    ctx.reload();
  });
}

// --- Zurückgeben ---
function openReturn(ctx, m, mods) {
  const requestId = uuid();
  const me = ctx.user ? ctx.user.id : null;
  const mine = !!me && m.open_borrower_id === me;
  const body = `
    <p class="muted" style="margin:0"><b style="color:var(--text)">${esc(m.name)}</b> · ${esc(m.code)}</p>
    ${!mine && m.open_borrower_name ? `<div class="alert">${icon('user')}<span>${esc(t('machines.returnFor', { name: m.open_borrower_name }))}</span></div>` : ''}
    ${m.open_since ? `<p class="small muted" style="margin:0">${esc(t('machines.ret.lentBy', { name: m.open_borrower_name || '–', date: fmtDateTime(m.open_since), elapsed: fmtElapsed(m.open_since) }))}</p>` : ''}
    ${m.is_set ? setChecklistHtml() : ''}
    <fieldset class="field" style="border:0;padding:0;margin:0;min-width:0">
      <legend class="lbl" style="padding:0;margin-bottom:5px">${esc(t('machines.ret.cond'))}</legend>
      <div class="radio-cards">
        ${CONDITIONS.map((c, i) => `<label class="radio-card">
          <input type="radio" name="mc-cond" value="${c}"${i === 0 ? ' checked autofocus' : ''}>
          <span><b>${esc(conditionLabel(c))}</b><small>${esc(t('machines.ret.' + c))}</small></span>
        </label>`).join('')}
      </div>
    </fieldset>
    <div class="field">
      <label for="mc-ret-note" data-note-label>${esc(t('common.note'))} <span class="muted">(${esc(t('common.optional'))})</span></label>
      <textarea id="mc-ret-note" rows="3" maxlength="1000"></textarea>
      <div class="hint" data-note-hint hidden>${esc(t('machines.ret.noteHint'))}</div>
    </div>`;
  let cond = 'ok', note = null;
  return sheet({
    title: t('machines.return'),
    body,
    onOpen: (el) => {
      if (m.is_set) fillSetChecklist(el, ctx, m);
      const lbl = el.querySelector('[data-note-label]');
      const hint = el.querySelector('[data-note-hint]');
      const ta = el.querySelector('#mc-ret-note');
      el.querySelectorAll('input[name="mc-cond"]').forEach((r) => r.addEventListener('change', () => {
        const need = r.value !== 'ok';
        lbl.innerHTML = need
          ? `${esc(t('machines.ret.noteReq'))} <span aria-hidden="true">*</span>`
          : `${esc(t('common.note'))} <span class="muted">(${esc(t('common.optional'))})</span>`;
        hint.hidden = !need;
        ta.required = need;
        ta.setAttribute('aria-required', String(need));
      }));
    },
    actions: [
      { label: t('btn.cancel'), kind: 'ghost', value: null },
      {
        label: t('machines.ret.confirm'), kind: 'primary', icon: 'check',
        onClick: async (el) => {
          const r = el.querySelector('input[name="mc-cond"]:checked');
          cond = r ? r.value : 'ok';
          note = textOrNull(el.querySelector('#mc-ret-note').value);
          if (cond !== 'ok' && !note) { el.querySelector('#mc-ret-note').focus(); throw fail('note_required'); }
          return ctx.api.returnMachine(m.id, { requestId, condition: cond, note });
        },
      },
    ],
  }).then(async (loan) => {
    if (!loan) return;
    toast(cond === 'defekt' ? t('machines.ret.doneDefect') : t('machines.ret.done'));
    // Bei Mangel/Defekt: optional Schadenfoto (eigener Dialog mit Knopf = Benutzeraktion für die Kamera)
    if (cond !== 'ok') {
      const media = (mods && mods.media) || (await loadMods()).media;
      if (media && media.uploadDamagePhoto) {
        try { await media.uploadDamagePhoto(ctx, 'machine', m.id, { note, loanId: loan.id || null }); }
        catch (err) { toast(errorText(err), 'error'); }
      }
    }
    ctx.reload();
  });
}

// --- Ausleihe korrigieren (Admin) ---
function openCorrection(ctx, l) {
  const v = (iso) => esc(toLocalInput(iso));
  const body = `
    <p class="muted" style="margin:0">${esc(l.borrower_name || '–')} · ${esc(fmtDateTime(l.checked_out_at))}</p>
    <div class="field"><label for="mc-c-out">${esc(t('machines.corr.out'))}</label>
      <input type="datetime-local" id="mc-c-out" value="${v(l.checked_out_at)}" required></div>
    <div class="field"><label for="mc-c-due">${esc(t('machines.corr.due'))}</label>
      <input type="datetime-local" id="mc-c-due" value="${v(l.due_at)}"></div>
    <div class="field"><label for="mc-c-back">${esc(t('machines.corr.back'))}</label>
      <input type="datetime-local" id="mc-c-back" value="${v(l.returned_at)}" aria-describedby="mc-c-back-h">
      <span class="hint" id="mc-c-back-h">${esc(t('machines.corr.backHint'))}</span></div>
    <div class="field"><label for="mc-c-reason">${esc(t('machines.corr.reason'))} <span aria-hidden="true">*</span></label>
      <textarea id="mc-c-reason" rows="2" required aria-required="true" aria-describedby="mc-c-reason-h"></textarea>
      <span class="hint" id="mc-c-reason-h">${esc(t('machines.corr.reasonHint'))}</span></div>`;
  // Unveränderte Felder behalten ihren genauen Zeitpunkt (datetime-local hat keine Sekunden)
  const keep = (val, orig) => (val && orig && val === toLocalInput(orig) ? orig : fromLocalInput(val));
  return sheet({
    title: t('machines.corr.title'),
    body,
    actions: [
      { label: t('btn.cancel'), kind: 'ghost', value: null },
      {
        label: t('btn.save'), kind: 'primary', icon: 'check',
        onClick: async (el) => {
          const out = el.querySelector('#mc-c-out').value;
          const due = el.querySelector('#mc-c-due').value;
          const back = el.querySelector('#mc-c-back').value;
          const reason = textOrNull(el.querySelector('#mc-c-reason').value);
          if (!reason) { el.querySelector('#mc-c-reason').focus(); throw fail('reason_required'); }
          if (!out || (back && new Date(back) < new Date(out))) throw fail('invalid_dates');
          return ctx.api.correctLoan(l.id, {
            checked_out_at: keep(out, l.checked_out_at),
            due_at: keep(due, l.due_at),
            returned_at: keep(back, l.returned_at),
            reason,
          });
        },
      },
    ],
  }).then((res) => {
    if (!res) return;
    toast(t('machines.corr.done'));
    ctx.reload();
  });
}

// --- Status ändern (Lagerverantwortliche) ---
function openStatus(ctx, m) {
  const current = SET_STATUSES.includes(m.status) ? m.status : 'verfuegbar';
  const body = `
    <fieldset class="field" style="border:0;padding:0;margin:0;min-width:0">
      <legend class="lbl" style="padding:0;margin-bottom:5px">${esc(t('machines.st.new'))}</legend>
      <div class="radio-cards">
        ${SET_STATUSES.map((s) => `<label class="radio-card">
          <input type="radio" name="mc-st" value="${s}"${s === current ? ' checked autofocus' : ''}>
          <span><b>${esc(t('status.' + s))}</b><small>${esc(t('machines.st.' + s))}</small></span>
        </label>`).join('')}
      </div>
    </fieldset>
    <div class="field">
      <label for="mc-st-note">${esc(t('common.note'))} <span class="muted">(${esc(t('common.optional'))})</span></label>
      <textarea id="mc-st-note" rows="2" maxlength="1000" placeholder="${esc(t('machines.st.notePh'))}"></textarea>
    </div>`;
  return sheet({
    title: t('machines.setStatus'),
    body,
    actions: [
      { label: t('btn.cancel'), kind: 'ghost', value: null },
      {
        label: t('btn.save'), kind: 'primary', icon: 'check',
        onClick: async (el) => {
          const r = el.querySelector('input[name="mc-st"]:checked');
          const status = r ? r.value : current;
          const note = textOrNull(el.querySelector('#mc-st-note').value);
          if (status === m.status && !note) return 'unchanged';
          return ctx.api.setMachineStatus(m.id, status, note);
        },
      },
    ],
  }).then((res) => {
    if (!res || res === 'unchanged') return;
    toast(t('machines.st.done'));
    ctx.reload();
  });
}

async function archiveMachine(ctx, m, archived, ask = true) {
  if (archived && ask && !(await confirmSheet(t('machines.archiveQ'), t('machines.archiveText'), { okLabel: t('btn.archive') }))) return;
  try {
    await ctx.api.saveMachine({ id: m.id, archived });
    toast(archived ? t('machines.archivedOk') : t('machines.unarchivedOk'));
    ctx.reload();
  } catch (err) { toast(errorText(err), 'error'); }
}

async function deleteMachine(ctx, m) {
  const ok = await confirmSheet(t('machines.deleteQ'), t('machines.deleteText', { name: m.name, code: m.code }), { okLabel: t('btn.delete'), danger: true });
  if (!ok) return;
  try {
    await ctx.api.deleteMachine(m.id);
    toast(t('machines.deleted'));
    ctx.go('maschinen');
  } catch (err) {
    if (err && err.code === 'in_use') {
      // Verlauf vorhanden → Archivieren vorschlagen
      if (m.archived) { toast(errorText(err), 'error'); return; }
      const arch = await confirmSheet(t('machines.inUseTitle'), t('err.in_use'), { okLabel: t('btn.archive') });
      if (arch) archiveMachine(ctx, m, true, false).catch(() => {});   // schon bestätigt
      return;
    }
    toast(errorText(err), 'error');
  }
}

// ===========================================================================
// 2) Liste «maschinen»
// ===========================================================================
function normListStatus(s) {
  if (!s) return 'all';
  const v = String(s).toLowerCase();
  if (v === 'ueberfaellig' || v === 'überfällig' || v === 'overdue') return 'overdue';
  return LIST_FILTERS.includes(v) ? v : 'all';
}
function matchListStatus(m, s) {
  if (s === 'all') return true;
  if (s === 'overdue') return machineOverdue(m);
  if (s === 'ausgeliehen') return isOnLoan(m);
  return m.status === s;
}

async function machineList(ctx) {
  const { api } = ctx;
  const root = mount(ctx);
  const staff = can(ctx.user, 'staff');
  setTitle(ctx, t('machines.title'));

  const saved = ssGet(SS_LIST) || {};
  const qs = qget(ctx, 'status'), qq = qget(ctx, 'q'), ql = qget(ctx, 'loc'), qk = qget(ctx, 'kat');
  const fromQuery = qs !== null || qq !== null || ql !== null || qk !== null;
  const st = {
    q: fromQuery ? (qq || '') : (saved.q || ''),
    status: normListStatus(fromQuery ? qs : saved.status),
    loc: fromQuery ? (ql || '') : (saved.loc || ''),
    cat: fromQuery ? (qk || '') : (saved.cat || ''),
    archived: staff && !!saved.archived,
    limit: LIST_PAGE,
  };
  const persist = () => ssSet(SS_LIST, { q: st.q, status: st.status, loc: st.loc, cat: st.cat, archived: st.archived });
  persist();

  root.innerHTML = `
    <div class="page-head">
      <h1>${esc(t('machines.title'))}</h1>
      <div class="actions">
        <a class="btn" href="#/ausgeliehen">${icon('handoff')}${esc(t('nav.loansShort'))}</a>
        ${staff ? `<a class="btn primary" href="#/maschinen/neu">${icon('plus')}${esc(t('machines.new'))}</a>` : ''}
      </div>
    </div>
    <div class="stack">
      <div class="searchbar">${icon('search')}
        <label class="sr-only" for="ml-q">${esc(t('machines.searchLabel'))}</label>
        <input type="search" id="ml-q" value="${esc(st.q)}" placeholder="${esc(t('machines.searchPh'))}" autocomplete="off" enterkeyhint="search">
      </div>
      <div class="filters">
        <div class="field">
          <label for="ml-loc">${esc(t('common.location'))}</label>
          <select id="ml-loc"><option value="">${esc(t('machines.allLocations'))}</option></select>
        </div>
        <div class="field" data-catfield hidden>
          <label for="ml-cat">${esc(t('common.category'))}</label>
          <select id="ml-cat"></select>
        </div>
        ${staff ? `<label class="check" style="flex:0 1 auto"><input type="checkbox" id="ml-arch"${st.archived ? ' checked' : ''}> ${esc(t('common.showArchived'))}</label>` : ''}
        <div class="chips" role="group" aria-label="${esc(t('machines.statusFilter'))}">
          ${LIST_FILTERS.map((s) => `<button type="button" class="chip" data-status="${s}" aria-pressed="${s === st.status}">${esc(s === 'all' ? t('btn.all') : s === 'overdue' ? t('machines.overdue') : t('status.' + s))} <span data-n style="opacity:.7"></span></button>`).join('')}
        </div>
      </div>
    </div>
    <div class="row" style="justify-content:space-between">
      <span class="small muted" data-count aria-live="polite"></span>
      <button type="button" class="btn sm ghost" data-act="reset" hidden>${icon('x')}${esc(t('machines.resetFilters'))}</button>
    </div>
    <div data-list>${loadingHtml()}</div>`;

  const listEl = root.querySelector('[data-list]');
  const countEl = root.querySelector('[data-count]');
  const resetBtn = root.querySelector('[data-act="reset"]');
  const qInput = root.querySelector('#ml-q');
  const locSel = root.querySelector('#ml-loc');
  const catSel = root.querySelector('#ml-cat');
  const archBox = root.querySelector('#ml-arch');
  root.addEventListener('click', (e) => { if (e.target.closest('[data-act="retry"]')) ctx.reload(); });

  let machines = [], locs = [], cats = [];
  try {
    [machines, locs, cats] = await Promise.all([
      api.listMachines({ includeArchived: staff }),
      api.listLocations({}).catch(() => []),
      safeList(() => api.listCategories({})),
    ]);
  } catch (err) {
    if (!root.isConnected) return;
    listEl.innerHTML = errorBlock(err);
    toast(errorText(err), 'error');
    return;
  }
  if (!root.isConnected) return;
  machines = Array.isArray(machines) ? machines : [];
  locs = (Array.isArray(locs) ? locs : []).filter((l) => !l.archived);

  locSel.insertAdjacentHTML('beforeend', locs.map((l) => `<option value="${esc(l.id)}">${esc(l.path || l.name)}</option>`).join(''));
  if (st.loc && !locs.some((l) => l.id === st.loc)) st.loc = '';
  locSel.value = st.loc;
  if (st.cat && !cats.some((c) => c.id === st.cat)) st.cat = '';
  if (cats.length) {
    catSel.innerHTML = categoryOptionsHtml(cats, st.cat || null, { emptyLabel: t('machines.allCategories') });
    catSel.value = st.cat;
    root.querySelector('[data-catfield]').hidden = false;
  }

  const hay = new Map(machines.map((m) => [m.id, norm([
    m.name, m.code, m.brand, m.model, m.serial_no, m.inventory_no, m.category, m.category_path, m.location_path,
    m.location_code_path, m.open_borrower_name, m.responsible_name,
  ].filter(Boolean).join(' '))]));

  const rowHtml = (m) => {
    const onLoan = isOnLoan(m);
    const od = machineOverdue(m);
    const mine = onLoan && ctx.user && m.open_borrower_id === ctx.user.id;
    const loanLine = onLoan
      ? `<span class="li-sub"${od ? ' style="color:var(--danger);font-weight:600"' : ''}>${esc(mine
        ? t('machines.withMe', { elapsed: shortElapsed(m.open_since) })
        : t('machines.withBorrower', { name: m.open_borrower_name || '–', elapsed: shortElapsed(m.open_since) }))}</span>` : '';
    return `<a class="list-item" href="${codeHref(m.code)}">
      ${thumbHtml(m.photo_path, '', 'thumb', 'machine')}
      <div class="li-main">
        <span class="li-title">${esc(m.name)}</span>
        <span class="li-sub">${esc(m.code)}${m.location_path ? ' · ' + esc(m.location_path) : ''}</span>
        ${catText(m) ? `<span class="li-sub">${esc(catText(m))}</span>` : ''}
        ${loanLine}
      </div>
      <div class="li-end">${statusPill(m.status)}${od ? `<span class="pill pill-danger">${esc(t('machines.overdue'))}</span>` : ''}${m.is_set ? `<span class="pill pill-info">${esc(t('machines.set'))}</span>` : ''}${m.archived ? `<span class="pill pill-muted">${esc(t('common.archived'))}</span>` : ''}</div>
    </a>`;
  };

  function render() {
    const tm = terms(st.q);
    const locSet = st.loc ? descendants(locs, st.loc) : null;
    const catSet = st.cat ? categorySubtreeIds(cats, st.cat) : null;
    const base = machines.filter((m) => (st.archived || !m.archived)
      && (!locSet || locSet.has(m.home_location_id))
      && (!catSet || catSet.has(m.category_id))
      && (!tm.length || tm.every((x) => hay.get(m.id).includes(x))));
    root.querySelectorAll('[data-status]').forEach((b) => {
      const s = b.dataset.status;
      b.setAttribute('aria-pressed', String(s === st.status));
      b.querySelector('[data-n]').textContent = String(base.filter((m) => matchListStatus(m, s)).length);
    });
    const rows = base.filter((m) => matchListStatus(m, st.status));
    countEl.textContent = countLabel(rows.length);
    const filtered = !!(st.q || st.loc || st.cat || st.status !== 'all');
    resetBtn.hidden = !filtered;
    if (!machines.length) {
      listEl.innerHTML = emptyHtml(t('machines.emptyAll'), staff ? `<a class="btn primary" href="#/maschinen/neu">${icon('plus')}${esc(t('machines.new'))}</a>` : '');
      return;
    }
    if (!rows.length) {
      listEl.innerHTML = emptyHtml(t('machines.empty'), `<button type="button" class="btn" data-act="reset">${icon('x')}${esc(t('machines.resetFilters'))}</button>`);
      return;
    }
    const shown = rows.slice(0, st.limit);
    const rest = rows.length - shown.length;
    listEl.innerHTML = `<div class="list">${shown.map(rowHtml).join('')}</div>
      ${rest > 0 ? `<div style="margin-top:10px"><button type="button" class="btn block" data-act="more">${esc(t('machines.showMore', { n: rest }))}</button></div>` : ''}`;
    hydrateThumbs(listEl, api);
  }

  const onSearch = debounce(() => { st.q = qInput.value; st.limit = LIST_PAGE; persist(); render(); }, 150);
  qInput.addEventListener('input', onSearch);
  qInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); qInput.blur(); } });
  locSel.addEventListener('change', () => { st.loc = locSel.value; st.limit = LIST_PAGE; persist(); render(); });
  catSel.addEventListener('change', () => { st.cat = catSel.value; st.limit = LIST_PAGE; persist(); render(); });
  if (archBox) archBox.addEventListener('change', () => { st.archived = archBox.checked; st.limit = LIST_PAGE; persist(); render(); });
  root.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-status]');
    if (chip) { st.status = chip.dataset.status; st.limit = LIST_PAGE; persist(); render(); return; }
    const b = e.target.closest('[data-act]');
    if (!b) return;
    if (b.dataset.act === 'more') { st.limit += LIST_PAGE * 2; render(); }
    else if (b.dataset.act === 'reset') {
      st.q = ''; st.loc = ''; st.cat = ''; st.status = 'all'; st.limit = LIST_PAGE;
      qInput.value = ''; locSel.value = ''; catSel.value = '';
      persist(); render();
    }
  });
  render();
}

// ===========================================================================
// 3) Formular «maschinen/neu» und «m/:code/bearbeiten»
// ===========================================================================
function normCode(v) {
  const s = clean(v).toUpperCase().replace(/\s+/g, '');
  if (!s) return '';
  const m = /^(?:M-?)?(\d{1,8})$/.exec(s);
  if (!m) return false;
  return 'M-' + m[1].padStart(4, '0');
}

async function machineForm(ctx, isNew) {
  const { api } = ctx;
  const root = mount(ctx);
  const staff = can(ctx.user, 'staff');
  const code = isNew ? null : decodeCode(ctx.params.code);
  const backHref = isNew ? '#/maschinen' : codeHref(code);
  setTitle(ctx, isNew ? t('machines.form.newTitle') : t('machines.form.editTitle'));
  const head = (sub) => `
    <a class="back-link" href="${backHref}">${icon('back')}${esc(t('btn.back'))}</a>
    <div class="page-head"><div><h1>${esc(isNew ? t('machines.form.newTitle') : t('machines.form.editTitle'))}</h1>
      ${sub ? `<div class="sub">${esc(sub)}</div>` : ''}</div></div>`;
  if (!staff) {
    root.innerHTML = head('') + emptyHtml(t('machines.form.notAuthorized'), `<a class="btn" href="${backHref}">${esc(t('btn.back'))}</a>`);
    return;
  }
  root.innerHTML = head(code || '') + loadingHtml();
  root.addEventListener('click', (e) => { if (e.target.closest('[data-act="retry"]')) ctx.reload(); });

  let locs, all, m = null, cats = [], profiles = [];
  try {
    [locs, all, m, cats, profiles] = await Promise.all([
      api.listLocations({}),
      api.listMachines({ includeArchived: true }).catch(() => []),
      isNew ? Promise.resolve(null) : api.getMachineByCode(code),
      safeList(() => api.listCategories({})),
      safeList(() => api.listProfiles()),
    ]);
  } catch (err) {
    if (!root.isConnected) return;
    root.innerHTML = head(code || '') + errorBlock(err);
    toast(errorText(err), 'error');
    return;
  }
  if (!root.isConnected) return;
  if (!isNew && !m) {
    root.innerHTML = head(code) + emptyHtml(t('machines.notFound', { code }), `<a class="btn" href="#/maschinen">${esc(t('machines.toList'))}</a>`);
    return;
  }
  locs = (Array.isArray(locs) ? locs : []).filter((l) => !l.archived || (m && l.id === m.home_location_id));
  const uniq = (key) => [...new Set((all || []).map((x) => clean(x[key])).filter(Boolean))].sort((a, b) => a.localeCompare(b, locale()));
  const v = (key) => esc(m && m[key] != null ? m[key] : '');
  const presetCode = isNew ? clean(qget(ctx, 'code') || '').toUpperCase() : '';
  const homeId = m ? m.home_location_id : '';
  const locOpts = `<option value="">${esc(t('machines.form.noLocation'))}</option>`
    + (homeId && !locs.some((l) => l.id === homeId) ? `<option value="${esc(homeId)}" selected>${esc(m.location_path || '?')}</option>` : '')
    + locs.map((l) => `<option value="${esc(l.id)}"${l.id === homeId ? ' selected' : ''}>${esc(l.path || l.name)}</option>`).join('');
  const catId = m && m.category_id ? m.category_id : null;
  const legacyCat = m && !m.category_id && clean(m.category) ? clean(m.category) : '';
  const respId = m && m.responsible_id ? m.responsible_id : '';
  const people = profiles.filter((p) => p.active !== false || p.id === respId);
  const respOpts = `<option value="">${esc(t('machines.noResponsible'))}</option>`
    + (respId && !people.some((p) => p.id === respId) ? `<option value="${esc(respId)}" selected>${esc(m.responsible_name || '?')}</option>` : '')
    + people.map((p) => `<option value="${esc(p.id)}"${p.id === respId ? ' selected' : ''}>${esc(p.full_name || p.email || '–')}</option>`).join('');

  root.innerHTML = head(m ? `${m.code} · ${m.name}` : '') + `
    <form class="card form" novalidate autocomplete="off">
      <div class="alert danger" role="alert" data-err hidden style="grid-column:1/-1"></div>
      <div class="field full">
        <label for="mf-name">${esc(t('common.name'))} <span aria-hidden="true">*</span></label>
        <input type="text" id="mf-name" name="name" required aria-required="true" maxlength="200" value="${v('name')}" placeholder="${esc(t('machines.form.namePh'))}">
      </div>
      ${isNew ? `
      <div class="field">
        <label for="mf-code">${esc(t('common.code'))} <span class="muted">(${esc(t('common.optional'))})</span></label>
        <input type="text" id="mf-code" name="code" value="${esc(presetCode)}" placeholder="${esc(t('machines.form.codeAuto'))}" autocapitalize="characters" spellcheck="false" aria-describedby="mf-code-h">
        <span class="hint" id="mf-code-h">${esc(t('machines.form.codeHint'))}</span>
      </div>
      <div class="field">
        <label for="mf-status">${esc(t('machines.form.initialStatus'))}</label>
        <select id="mf-status" name="status">${NEW_STATUSES.map((s) => `<option value="${s}">${esc(t('status.' + s))}</option>`).join('')}</select>
      </div>` : `
      <div class="field">
        <label for="mf-code">${esc(t('common.code'))}</label>
        <input type="text" id="mf-code" value="${v('code')}" disabled aria-describedby="mf-code-h">
        <span class="hint" id="mf-code-h">${esc(t('machines.form.codeFixed'))}</span>
      </div>
      <div class="field">
        <span class="lbl">${esc(t('common.status'))}</span>
        <div>${statusPill(m.status)}</div>
      </div>`}
      ${cats.length ? `<div class="field">
        <label for="mf-cat">${esc(t('common.category'))}</label>
        <select id="mf-cat" name="category_id"${legacyCat ? ' aria-describedby="mf-cat-h"' : ''}>${categoryOptionsHtml(cats, catId)}${catId && !cats.some((c) => c.id === catId)
          ? `<option value="${esc(catId)}" selected>${esc(m.category_path || m.category || '?')}</option>` : ''}</select>
        ${legacyCat ? `<span class="hint" id="mf-cat-h">${esc(t('machines.form.categoryLegacy', { text: legacyCat }))}</span>` : ''}
      </div>` : `<div class="field">
        <label for="mf-cat">${esc(t('common.category'))}</label>
        <input type="text" id="mf-cat" name="category" list="mf-cats" maxlength="100" value="${v('category')}">
        <datalist id="mf-cats">${uniq('category').map((c) => `<option value="${esc(c)}"></option>`).join('')}</datalist>
      </div>`}
      <div class="field">
        <label for="mf-brand">${esc(t('common.brand'))}</label>
        <input type="text" id="mf-brand" name="brand" list="mf-brands" maxlength="100" value="${v('brand')}">
        <datalist id="mf-brands">${uniq('brand').map((c) => `<option value="${esc(c)}"></option>`).join('')}</datalist>
      </div>
      <div class="field">
        <label for="mf-model">${esc(t('common.model'))}</label>
        <input type="text" id="mf-model" name="model" maxlength="100" value="${v('model')}">
      </div>
      <div class="field">
        <label for="mf-serial">${esc(t('machines.serialNo'))}</label>
        <input type="text" id="mf-serial" name="serial_no" maxlength="100" value="${v('serial_no')}" spellcheck="false">
      </div>
      <div class="field">
        <label for="mf-inv">${esc(t('machines.inventoryNo'))}</label>
        <input type="text" id="mf-inv" name="inventory_no" maxlength="100" value="${v('inventory_no')}" spellcheck="false">
      </div>
      <div class="field">
        <label for="mf-loc">${esc(t('common.location'))}</label>
        <select id="mf-loc" name="home_location_id" aria-describedby="mf-loc-h">${locOpts}</select>
        <span class="hint" id="mf-loc-h">${esc(t('machines.form.homeHint'))}</span>
      </div>
      <div class="field">
        <label for="mf-cond">${esc(t('machines.condition'))}</label>
        <select id="mf-cond" name="condition">${CONDITIONS.map((c) => `<option value="${c}"${(m ? m.condition : 'ok') === c ? ' selected' : ''}>${esc(conditionLabel(c))}</option>`).join('')}</select>
      </div>
      <div class="field">
        <label for="mf-cnote">${esc(t('machines.form.conditionNote'))}</label>
        <textarea id="mf-cnote" name="condition_note" rows="2" maxlength="1000">${v('condition_note')}</textarea>
      </div>
      <div class="field">
        <label for="mf-resp">${esc(t('machines.responsible'))}</label>
        <select id="mf-resp" name="responsible_id" aria-describedby="mf-resp-h">${respOpts}</select>
        <span class="hint" id="mf-resp-h">${esc(t('machines.form.responsibleHint'))}</span>
      </div>
      <div class="field">
        <label for="mf-url">${esc(t('machines.productUrl'))}</label>
        <input type="url" id="mf-url" name="product_url" maxlength="1000" value="${v('product_url')}" placeholder="${esc(t('machines.form.productUrlPh'))}" inputmode="url" spellcheck="false" autocapitalize="off" aria-describedby="mf-url-h">
        <span class="hint" id="mf-url-h">${esc(t('machines.form.productUrlHint'))}</span>
      </div>
      <div class="field full">
        <label class="check" style="align-items:flex-start"><input type="checkbox" id="mf-set" name="is_set"${m && m.is_set ? ' checked' : ''} aria-describedby="mf-set-h">
          <span><b>${esc(t('machines.form.isSet'))}</b><span class="hint" id="mf-set-h" style="display:block">${esc(t('machines.form.isSetHint'))}</span></span></label>
      </div>
      <div class="field full">
        <label for="mf-notes">${esc(t('common.notes'))}</label>
        <textarea id="mf-notes" name="notes" rows="3" maxlength="4000">${v('notes')}</textarea>
      </div>
      <div class="row" style="grid-column:1/-1;justify-content:flex-end">
        <a class="btn ghost" href="${backHref}">${esc(t('btn.cancel'))}</a>
        <button type="submit" class="btn primary">${icon('check')}${esc(isNew ? t('machines.form.create') : t('btn.save'))}</button>
      </div>
    </form>`;

  const form = root.querySelector('form');
  const errBox = form.querySelector('[data-err]');
  const showErr = (msg, focusEl) => {
    errBox.innerHTML = `${icon('alert')}<span>${esc(msg)}</span>`;
    errBox.hidden = false;
    if (focusEl) focusEl.focus();
    else errBox.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };
  const codeInput = isNew ? form.querySelector('#mf-code') : null;
  if (codeInput) codeInput.addEventListener('blur', () => { const c = normCode(codeInput.value); if (c) codeInput.value = c; });
  if (isNew) form.querySelector('#mf-name').focus();

  let busy = false;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (busy) return;
    errBox.hidden = true;
    const d = formData(form);
    const name = clean(d.name);
    if (!name) { showErr(t('err.name_required'), form.querySelector('#mf-name')); return; }
    let urlRaw = clean(d.product_url);
    if (urlRaw && !/^[a-z][a-z0-9+.-]*:/i.test(urlRaw) && /^[\w-]+(\.[\w-]+)+(\/|$)/.test(urlRaw)) urlRaw = 'https://' + urlRaw;   // «bosch.de/…»
    const productUrl = urlRaw ? safeUrl(urlRaw) : null;
    if (urlRaw && !productUrl) { showErr(t('machines.form.productUrlInvalid'), form.querySelector('#mf-url')); return; }
    const obj = {
      name,
      brand: textOrNull(clean(d.brand)),
      model: textOrNull(clean(d.model)),
      serial_no: textOrNull(clean(d.serial_no)),
      inventory_no: textOrNull(clean(d.inventory_no)),
      home_location_id: d.home_location_id || null,
      condition: CONDITIONS.includes(d.condition) ? d.condition : 'ok',
      condition_note: textOrNull(d.condition_note),
      notes: textOrNull(d.notes),
      responsible_id: d.responsible_id || null,
      product_url: productUrl ? urlRaw : null,
      is_set: !!d.is_set,
    };
    if (cats.length) {
      // Kategorie aus der Liste: category_id + bisheriges Textfeld (Name), damit Altdaten und Etiketten stimmen
      const sel = d.category_id || null;
      const c = sel ? cats.find((x) => x.id === sel) : null;
      if (sel) { obj.category_id = sel; obj.category = c ? c.name : (m && m.category) || null; }
      else if (isNew || (m && m.category_id)) { obj.category_id = null; obj.category = null; }
      // sonst: bisheriger Freitext ohne category_id bleibt unverändert
    } else {
      obj.category = textOrNull(clean(d.category));
    }
    if (isNew) {
      const c = normCode(d.code);
      if (c === false) { showErr(t('machines.form.codeInvalid'), codeInput); return; }
      if (c) obj.code = c;
      obj.status = NEW_STATUSES.includes(d.status) ? d.status : 'verfuegbar';
    } else {
      obj.id = m.id;
    }
    busy = true;
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
      const row = await api.saveMachine(obj);
      const newCode = (row && row.code) || obj.code || code;
      if (isNew) {
        try { if (newCode) sessionStorage.setItem(SS_CREATED, newCode); } catch (x) { /* egal */ }
        toast(t('machines.form.createdToast', { code: newCode || '' }));
      } else {
        toast(t('common.saved'));
      }
      ctx.go(newCode ? codeRoute(newCode) : 'maschinen');
    } catch (err) {
      showErr(errorText(err), err && err.code === 'duplicate_code' ? codeInput : null);
    } finally {
      busy = false;
      btn.disabled = false;
    }
  });
}

// ===========================================================================
// 4) «ausgeliehen» – offene Ausleihen und Verlauf
// ===========================================================================
async function loansPage(ctx) {
  const { api } = ctx;
  const root = mount(ctx);
  setTitle(ctx, t('machines.loans.title'));

  const saved = ssGet(SS_LOANS) || {};
  const qTab = qget(ctx, 'tab');
  const qFilter = qget(ctx, 'filter') || qget(ctx, 'f');
  const fromQuery = qTab !== null || qFilter !== null;
  const st = {
    tab: (fromQuery ? qTab : saved.tab) === 'history' || (fromQuery ? qTab : saved.tab) === 'verlauf' ? 'history' : 'open',
    emp: fromQuery ? '' : (saved.emp || ''),
    q: fromQuery ? '' : (saved.q || ''),
    chip: fromQuery ? (qFilter || 'all') : (saved.chip || 'all'),
    from: fromQuery ? '' : (saved.from || ''),
    to: fromQuery ? '' : (saved.to || ''),
    limit: 100,
  };
  if (st.chip === 'ueberfaellig') st.chip = 'overdue';
  const chipsFor = (tab) => (tab === 'history' ? HIST_CHIPS : OPEN_CHIPS);
  if (!chipsFor(st.tab).includes(st.chip)) st.chip = 'all';
  const persist = () => ssSet(SS_LOANS, { tab: st.tab, emp: st.emp, q: st.q, chip: st.chip, from: st.from, to: st.to });
  persist();

  root.innerHTML = `
    <div class="page-head">
      <h1>${esc(t('machines.loans.title'))}</h1>
      <div class="actions"><button type="button" class="btn" data-act="export" disabled>${icon('download')}${esc(t('btn.export'))}</button></div>
    </div>
    <div data-summary></div>
    <div class="tabs" role="tablist" aria-label="${esc(t('machines.loans.title'))}">
      <button type="button" class="tab" role="tab" id="lp-tab-open" data-tab="open" aria-controls="lp-panel">${esc(t('machines.loans.tabOpen'))} <span data-open-n class="muted"></span></button>
      <button type="button" class="tab" role="tab" id="lp-tab-history" data-tab="history" aria-controls="lp-panel">${esc(t('machines.loans.tabHistory'))}</button>
    </div>
    <div class="filters">
      <div class="field">
        <label for="lp-emp">${esc(t('common.employee'))}</label>
        <select id="lp-emp"><option value="">${esc(t('machines.loans.allEmployees'))}</option></select>
      </div>
      <div class="field">
        <label for="lp-q">${esc(t('machines.loans.search'))}</label>
        <input type="search" id="lp-q" value="${esc(st.q)}" placeholder="${esc(t('machines.loans.searchPh'))}" autocomplete="off" enterkeyhint="search">
      </div>
      <div class="field">
        <label for="lp-from">${esc(t('machines.loans.from'))}</label>
        <input type="date" id="lp-from" value="${esc(st.from)}">
      </div>
      <div class="field">
        <label for="lp-to">${esc(t('machines.loans.to'))}</label>
        <input type="date" id="lp-to" value="${esc(st.to)}">
      </div>
      <div class="chips" role="group" aria-label="${esc(t('machines.loans.filterLabel'))}" data-chips></div>
    </div>
    <div class="row" style="justify-content:space-between">
      <span class="small muted" data-count aria-live="polite"></span>
      <button type="button" class="btn sm ghost" data-act="reset" hidden>${icon('x')}${esc(t('machines.resetFilters'))}</button>
    </div>
    <div id="lp-panel" role="tabpanel" data-content>${loadingHtml()}</div>`;

  const $ = (s) => root.querySelector(s);
  const content = $('[data-content]');
  const chipsEl = $('[data-chips]');
  const countEl = $('[data-count]');
  const empSel = $('#lp-emp');
  const exportBtn = $('[data-act="export"]');
  const resetBtn = $('[data-act="reset"]');
  const panel = $('#lp-panel');

  let openLoans = null, history = null, historyKey = '', histSeq = 0, histError = null, profiles = [];

  async function loadHistory() {
    const key = [st.emp, st.from, st.to].join('|');
    if (history && historyKey === key) return;
    const opts = { limit: LOAN_LIMIT };
    if (st.emp) opts.borrowerId = st.emp;
    if (st.from) opts.from = st.from;   // 'YYYY-MM-DD' (Ortszeit); die API nimmt bei «to» das Tagesende
    if (st.to) opts.to = st.to;
    const seq = ++histSeq;
    try {
      const rows = await api.listLoans(opts);
      if (seq !== histSeq) return;
      history = Array.isArray(rows) ? rows : [];
      historyKey = key;
      histError = null;
    } catch (err) {
      if (seq !== histSeq) return;
      history = null;
      histError = err;
    }
  }

  // Filter, die für beide Reiter gelten (Mitarbeiter, Maschine, Ausleihdatum)
  function applyCommon(list) {
    const tm = terms(st.q);
    return (list || []).filter((l) => (!st.emp || l.borrower_id === st.emp)
      && (!tm.length || tm.every((x) => norm(`${l.machine_name || ''} ${l.machine_code || ''}`).includes(x)))
      && (!st.from || localDay(l.checked_out_at) >= st.from)
      && (!st.to || localDay(l.checked_out_at) <= st.to));
  }
  const today = todayLocal();
  const chipTest = {
    open: {
      all: () => true,
      overdue: (l) => loanOverdue(l),
      today: (l) => !!l.due_at && localDay(l.due_at) === today,
      nodue: (l) => !l.due_at,
    },
    history: {
      all: () => true,
      open: (l) => !l.returned_at,
      returned: (l) => !!l.returned_at,
      overdue: (l) => loanOverdue(l),
    },
  };
  const chipLabel = (tab, c) => {
    if (tab === 'open') return t({ all: 'machines.loans.allOpen', overdue: 'machines.overdue', today: 'machines.loans.dueToday', nodue: 'machines.loans.noDate' }[c]);
    return t({ all: 'machines.loans.all', open: 'machines.loans.open', returned: 'machines.loans.returned', overdue: 'machines.overdue' }[c]);
  };

  function fillEmployees() {
    const map = new Map();
    for (const p of profiles || []) map.set(p.id, { id: p.id, name: p.full_name || '–', inactive: p.active === false });
    for (const l of [...(openLoans || []), ...(history || [])]) {
      if (l.borrower_id && !map.has(l.borrower_id)) map.set(l.borrower_id, { id: l.borrower_id, name: l.borrower_name || '–', inactive: false });
    }
    const list = [...map.values()].sort((a, b) => a.name.localeCompare(b.name, locale()));
    const keep = st.emp;
    empSel.innerHTML = `<option value="">${esc(t('machines.loans.allEmployees'))}</option>`
      + list.map((p) => `<option value="${esc(p.id)}">${esc(p.name)}${p.inactive ? ` (${esc(t('machines.loans.inactive'))})` : ''}</option>`).join('');
    empSel.value = keep && map.has(keep) ? keep : '';
    if (empSel.value !== keep) { st.emp = empSel.value; persist(); }
  }

  function summaryHtml() {
    const n = (openLoans || []).filter(loanOverdue).length;
    if (!n) return '';
    return `<div class="alert danger" role="status">${icon('alert')}
      <b style="flex:1">${esc(n === 1 ? t('machines.loans.overdueOne') : t('machines.loans.overdueMany', { n }))}</b>
      <button type="button" class="btn sm" data-act="show-overdue">${esc(t('machines.loans.show'))}</button></div>`;
  }

  function openRowHtml(l) {
    const od = loanOverdue(l);
    const dueToday = !!l.due_at && localDay(l.due_at) === today;
    const badge = od ? `<span class="pill pill-danger">${esc(t('machines.overdue'))}</span>`
      : dueToday ? `<span class="pill pill-warn">${esc(t('machines.loans.dueToday'))}</span>` : '';
    return `<a class="list-item" href="${codeHref(l.machine_code)}"${od ? ' style="box-shadow:inset 4px 0 0 var(--danger)"' : ''}>
      <div class="thumb thumb-empty" aria-hidden="true">${icon('machine')}</div>
      <div class="li-main">
        <span class="li-title">${esc(l.machine_name || l.machine_code)}</span>
        <span class="li-sub">${esc(l.machine_code)} · ${personHtml(ctx, l.borrower_id, l.borrower_name)}</span>
        <span class="li-sub">${esc(t('machines.loans.since', { date: fmtDateTime(l.checked_out_at), elapsed: fmtElapsed(l.checked_out_at) }))}</span>
      </div>
      <div class="li-end">
        ${badge}
        <span${od ? ' style="color:var(--danger);font-weight:650"' : ''}>${l.due_at ? esc(t('machines.loans.until', { date: fmtDateTime(l.due_at) })) : `<span class="muted">${esc(t('machines.loans.noDate'))}</span>`}</span>
      </div>
    </a>`;
  }

  function historyTableHtml(rows) {
    const shown = rows.slice(0, st.limit);
    const rest = rows.length - shown.length;
    return `<div class="table-wrap" style="position:relative"><table class="table">
      <caption class="sr-only">${esc(t('machines.loans.tabHistory'))}</caption>
      <thead><tr>
        <th scope="col">${esc(t('common.machine'))}</th>
        <th scope="col">${esc(t('common.employee'))}</th>
        <th scope="col">${esc(t('machines.hist.out'))}</th>
        <th scope="col">${esc(t('machines.loans.planned'))}</th>
        <th scope="col">${esc(t('machines.hist.back'))}</th>
        <th scope="col">${esc(t('machines.hist.by'))}</th>
        <th scope="col">${esc(t('machines.condition'))}</th>
        <th scope="col">${esc(t('common.status'))}</th>
      </tr></thead>
      <tbody>${shown.map((l) => {
        const s = loanState(l);
        const byOther = l.returned_at && l.returned_by && l.returned_by !== l.borrower_id;
        return `<tr class="${s === 'overdue' ? 'is-overdue' : s === 'open' ? 'is-open' : ''}" data-code="${esc(l.machine_code)}" style="cursor:pointer">
          <td><a href="${codeHref(l.machine_code)}">${esc(l.machine_name || l.machine_code)}</a><div class="small muted">${esc(l.machine_code)}</div></td>
          <td>${personHtml(ctx, l.borrower_id, l.borrower_name)}</td>
          <td>${esc(fmtDateTime(l.checked_out_at))}</td>
          <td>${l.due_at ? esc(fmtDateTime(l.due_at)) : '<span class="muted">–</span>'}</td>
          <td>${l.returned_at ? `${esc(fmtDateTime(l.returned_at))}<div class="small muted">${esc(fmtElapsed(l.checked_out_at, l.returned_at))}</div>` : `<span class="muted">–</span><div class="small muted">${esc(fmtElapsed(l.checked_out_at))}</div>`}</td>
          <td>${byOther ? personHtml(ctx, l.returned_by, l.returned_by_name) : ''}</td>
          <td>${l.returned_at ? condPill(l.return_condition) : '<span class="muted">–</span>'}</td>
          <td>${loanPill(s)}${l.corrected ? ` <span class="pill pill-muted">${esc(t('machines.hist.corrected'))}</span>` : ''}</td>
        </tr>`;
      }).join('')}</tbody></table></div>
      ${rest > 0 ? `<div style="margin-top:10px"><button type="button" class="btn block" data-act="more">${esc(t('machines.showMore', { n: rest }))}</button></div>` : ''}`;
  }

  let current = [];   // aktuell angezeigte (gefilterte) Zeilen → Export
  function render() {
    root.querySelector('[data-summary]').innerHTML = summaryHtml();
    root.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === st.tab)));
    panel.setAttribute('aria-labelledby', st.tab === 'history' ? 'lp-tab-history' : 'lp-tab-open');
    const openN = root.querySelector('[data-open-n]');
    if (openLoans) openN.textContent = `(${openLoans.length})`;
    const hadFocus = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.chip : null;

    const source = st.tab === 'history' ? history : openLoans;
    const chips = chipsFor(st.tab);
    const base = source ? applyCommon(source) : [];
    chipsEl.innerHTML = chips.map((c) => `<button type="button" class="chip" data-chip="${c}" aria-pressed="${c === st.chip}">${esc(chipLabel(st.tab, c))}${source ? ` <span style="opacity:.7">${base.filter(chipTest[st.tab][c]).length}</span>` : ''}</button>`).join('');
    if (hadFocus) { const f = chipsEl.querySelector(`[data-chip="${hadFocus}"]`); if (f) f.focus(); }
    resetBtn.hidden = !(st.emp || st.q || st.from || st.to || st.chip !== 'all');

    if (st.tab === 'history' && histError) {
      content.innerHTML = errorBlock(histError);
      countEl.textContent = '';
      exportBtn.disabled = true;
      current = [];
      return;
    }
    if (!source) {
      content.innerHTML = loadingHtml();
      countEl.textContent = '';
      exportBtn.disabled = true;
      return;
    }
    let rows = base.filter(chipTest[st.tab][st.chip] || (() => true));
    if (st.tab === 'open') {
      // Überfällige zuerst, dann nach geplanter Rückgabe, ohne Datum zuletzt
      const key = (l) => (l.due_at ? new Date(l.due_at).getTime() : Infinity);
      rows = rows.slice().sort((a, b) => (loanOverdue(b) - loanOverdue(a)) || (key(a) - key(b))
        || (new Date(b.checked_out_at) - new Date(a.checked_out_at)));
    }
    current = rows;
    exportBtn.disabled = !rows.length;
    countEl.textContent = t('machines.loans.count', { n: rows.length });
    if (!rows.length) {
      const emptyText = !source.length ? t(st.tab === 'open' ? 'machines.loans.empty' : 'machines.loans.emptyHistory') : t('machines.loans.emptyFiltered');
      content.innerHTML = emptyHtml(emptyText, resetBtn.hidden ? '' : `<button type="button" class="btn" data-act="reset">${icon('x')}${esc(t('machines.resetFilters'))}</button>`);
      return;
    }
    const limitHint = st.tab === 'history' && source.length >= LOAN_LIMIT
      ? `<div class="alert warn" style="margin-bottom:10px">${icon('alert')}<span>${esc(t('machines.loans.limitHint', { n: LOAN_LIMIT }))}</span></div>` : '';
    content.innerHTML = st.tab === 'open'
      ? `<div class="list">${rows.map(openRowHtml).join('')}</div>`
      : limitHint + historyTableHtml(rows);
  }

  function exportCsv() {
    if (!current.length) return;
    const head = [t('machines.loans.csvCode'), t('common.machine'), t('common.employee'), t('machines.hist.out'),
      t('machines.loans.planned'), t('machines.hist.back'), t('machines.hist.by'), t('machines.condition'), t('common.status'),
      t('machines.loans.duration'), t('machines.loans.csvNoteOut'), t('machines.loans.csvNoteBack'), t('machines.loans.csvCorrected')];
    const rows = current.map((l) => [
      l.machine_code, l.machine_name, l.borrower_name, csvDate(l.checked_out_at), csvDate(l.due_at), csvDate(l.returned_at),
      l.returned_at ? (l.returned_by_name || '') : '', l.returned_at && l.return_condition ? conditionLabel(l.return_condition) : '',
      t('machines.loan.' + loanState(l)), fmtElapsed(l.checked_out_at, l.returned_at || undefined),
      l.checkout_note || '', l.return_note || '', l.corrected ? t('common.yes') : '',
    ]);
    const suffix = st.tab === 'history' ? '' : '-' + t('machines.loans.open').toLowerCase();
    downloadCsv(`${t('machines.loans.csvFile')}${suffix}-${todayLocal()}.csv`, [head, ...rows]);
  }

  async function refreshHistory() {
    if (st.tab !== 'history') return;
    const key = [st.emp, st.from, st.to].join('|');
    if (!(history && historyKey === key)) {
      history = null;
      render();
      await loadHistory();
      if (!root.isConnected) return;
      fillEmployees();
    }
    render();
  }
  const refreshHistoryDebounced = debounce(refreshHistory, 300);

  // Ereignisse
  root.addEventListener('click', (e) => {
    const tab = e.target.closest('[data-tab]');
    if (tab) {
      if (st.tab === tab.dataset.tab) return;
      st.tab = tab.dataset.tab;
      if (!chipsFor(st.tab).includes(st.chip)) st.chip = 'all';
      st.limit = 100;
      persist();
      render();
      refreshHistory();
      return;
    }
    const chip = e.target.closest('[data-chip]');
    if (chip) { st.chip = chip.dataset.chip; st.limit = 100; persist(); render(); return; }
    const tr = e.target.closest('tr[data-code]');
    if (tr && !e.target.closest('a, button')) { ctx.go(codeRoute(tr.dataset.code)); return; }
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    if (act === 'export') exportCsv();
    else if (act === 'more') { st.limit += 200; render(); }
    else if (act === 'retry') ctx.reload();
    else if (act === 'show-overdue') {
      st.tab = 'open'; st.chip = 'overdue'; st.limit = 100; persist(); render();
    } else if (act === 'reset') {
      st.emp = ''; st.q = ''; st.from = ''; st.to = ''; st.chip = 'all'; st.limit = 100;
      empSel.value = ''; $('#lp-q').value = ''; $('#lp-from').value = ''; $('#lp-to').value = '';
      persist(); render(); refreshHistoryDebounced();
    }
  });
  // Tastatur für Reiter (Pfeiltasten)
  root.querySelector('[role="tablist"]').addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const next = root.querySelector(`[data-tab="${st.tab === 'open' ? 'history' : 'open'}"]`);
    next.focus(); next.click();
  });
  const onSearch = debounce(() => { st.q = $('#lp-q').value; st.limit = 100; persist(); render(); }, 150);
  $('#lp-q').addEventListener('input', onSearch);
  empSel.addEventListener('change', () => { st.emp = empSel.value; st.limit = 100; persist(); render(); refreshHistoryDebounced(); });
  $('#lp-from').addEventListener('change', (e) => { st.from = e.target.value; st.limit = 100; persist(); render(); refreshHistoryDebounced(); });
  $('#lp-to').addEventListener('change', (e) => { st.to = e.target.value; st.limit = 100; persist(); render(); refreshHistoryDebounced(); });

  // Daten parallel laden
  try {
    const [o, p] = await Promise.all([
      api.listLoans({ open: true, limit: LOAN_LIMIT }),
      api.listProfiles().catch(() => []),
      st.tab === 'history' ? loadHistory() : Promise.resolve(),
    ]);
    openLoans = Array.isArray(o) ? o : [];
    profiles = Array.isArray(p) ? p : [];
  } catch (err) {
    if (!root.isConnected) return;
    content.innerHTML = errorBlock(err);
    toast(errorText(err), 'error');
    return;
  }
  if (!root.isConnected) return;
  fillEmployees();
  render();
}

// ---------------------------------------------------------------------------
// Routen
// ---------------------------------------------------------------------------
export const routes = {
  'maschinen': machineList,
  'maschinen/neu': (ctx) => machineForm(ctx, true),
  'm/:code': machineCard,
  'm/:code/bearbeiten': (ctx) => machineForm(ctx, false),
  'ausgeliehen': loansPage,
};
