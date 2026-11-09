// Ansicht «Lager organisieren»
//   'organisieren'  Zentrale: Kennzahlen (nur echte Zahlen), Hauptaktionen, Raumkarten, «Raum hinzufügen»
//   'o/:code'       Raum oder Lagerort visuell: Übersichtsfoto mit Bereichen (Hotspots), Reiter Unterorte / Inhalt /
//                   Fotos / Plan, «Mit KI organisieren» (ehrlich: Ablauf mit Live-Zahlen) und «Was soll ich hier verbessern?»
//   'organisieren/plan'  Gebäudeplan: Grundriss je Stockwerk mit den Räumen als Bereiche (?plan=<id>)
// Alles aus echten Daten. Erkennungen bleiben Vorschläge, bis jemand sie prüft. Keine erfundenen Positionen oder Zahlen.
import { t, registerStrings, fmtNum, fmtQty, fmtDate, locale } from '../i18n.js';
import {
  esc, clean, can, toast, sheet, confirmSheet, errorText, emptyHtml, thumbHtml, hydrateThumbs, icon, statusPill,
  locTypeLabel, debounce, openLightbox,
} from '../util.js';
import {
  LOCATION_TYPES, SPACE_PRESETS, suggestShortCode, normShortCode, orgStatusPill, confidencePill, confidenceLabel,
  detectionStatusLabel, kindLabel, photoStatusLabel, taskStatusLabel, sourceLabel, locationSubtreeIds, locationDisplayCode,
  ORG_STATUSES, orgStatusLabel, sha256Hex, siteOptionsHtml,
} from '../org-common.js';
import * as labels from '../labels.js';

// ---------------------------------------------------------------------------
// Texte
// ---------------------------------------------------------------------------
registerStrings({
  de: {
    'organize.title': 'Lager organisieren',
    'organize.sub': 'Alle Gegenstände strukturiert, visuell und geprüft erfassen.',
    'organize.importPhotos': 'Fotos importieren',
    'organize.reviewN': 'KI-Erkennung prüfen ({n})',
    'organize.viewDetN': 'Erkennungen ansehen ({n})',
    'organize.searchLabel': 'Im ganzen Lager suchen',
    'organize.searchPh': 'Gegenstand, Code, Marke, Lagerort…',
    'organize.figures': 'Stand der Organisation',
    'organize.stat.photosOf': 'Fotos analysiert (von {b})',
    'organize.stat.failed': '{n} fehlgeschlagen',
    'organize.stat.detected': 'Objekte erkannt',
    'organize.stat.identified': 'Identifiziert',
    'organize.stat.confirmed': 'Inventarisiert (bestätigt)',
    'organize.stat.unknown': 'Unbekannt',
    'organize.stat.noLocation': 'Ohne Lagerort',
    'organize.stat.locations': 'Lagerorte erfasst',
    'organize.stat.proposed': 'Lagerorte vorgeschlagen',
    'organize.stat.duplicates': 'Mögliche Duplikate',
    'organize.stat.tasks': 'Offene Aufgaben',
    'organize.stat.spacesOf': 'Räume organisiert (von {b})',
    'organize.spaces': 'Räume',
    'organize.addSpace': 'Raum hinzufügen',
    'organize.noSpaces': 'Noch keine Räume erfasst. Lege zuerst die Räume an (z. B. Hauptlager, Werkstatt) und importiere dann Fotos davon.',
    'organize.noSpacesRead': 'Noch keine Räume erfasst. Lagerverantwortliche können sie hier anlegen.',
    'organize.howto.title': 'So funktioniert’s',
    'organize.howto.t1': 'Fotos', 'organize.howto.d1': 'Räume, Regale und Schränke fotografieren und hier importieren.',
    'organize.howto.t2': 'Analyse', 'organize.howto.d2': 'Neue Fotos zur Analyse vormerken. Claude (Anthropic) erkennt die Gegenstände auf den Originalfotos; das Ergebnis wird als Datei importiert.',
    'organize.howto.t3': 'Prüfen', 'organize.howto.d3': 'Jede Erkennung ist ein Vorschlag. Erst wenn jemand sie bestätigt, wird daraus Inventar.',
    'organize.howto.t4': 'Plan', 'organize.howto.d4': 'Aus den Daten einen Organisationsvorschlag erstellen und die Aufgaben abarbeiten.',
    'organize.howto.t5': 'Etiketten', 'organize.howto.d5': 'QR-Etiketten für Lagerorte und Gegenstände drucken und anbringen.',
    'organize.howto.t6': 'Abschliessen', 'organize.howto.d6': 'Wenn nichts mehr offen ist, den Raum als organisiert abschliessen.',
    'organize.items1': '1 Gegenstand', 'organize.itemsN': '{n} Gegenstände',
    'organize.subs1': '1 Unterort', 'organize.subsN': '{n} Unterorte',
    'organize.open1': '1 offener Punkt', 'organize.openN': '{n} offene Punkte',
    'organize.noOpen': 'Nichts offen',
    'organize.progressOf': '{a} von {b} erledigt',
    'organize.progressNone': 'Noch keine Punkte erfasst',
    'organize.progressOrganized': 'Organisiert',
    'organize.progressLabel': 'Fortschritt der Organisation',
    'organize.inventory': 'Inventar',
    'organize.inventoryAria': 'Inventar von «{name}»',
    'organize.photoAlt': 'Foto von {name}',
    'organize.noPhoto': 'Noch kein Foto',
    'organize.tasksNone': 'Keine offenen Aufgaben.',
    'organize.noLocTitle': 'Gegenstände ohne Lagerort',
    'organize.noLocNone': 'Alle Gegenstände haben einen Lagerort.',
    'organize.add.presets': 'Vorschläge',
    'organize.add.presetsHint': 'Mehrere auswählen möglich. Angelegt wird nur, was du auswählst.',
    'organize.add.allExist': 'Alle Vorschläge sind schon angelegt.',
    'organize.add.custom': 'Eigener Raum',
    'organize.add.nothing': 'Bitte einen Vorschlag auswählen oder einen Namen eingeben.',
    'organize.add.created1': 'Raum «{name}» angelegt',
    'organize.add.createdN': '{n} Räume angelegt',
    'organize.add.save': 'Anlegen',
    'organize.f.name': 'Name',
    'organize.f.type': 'Typ',
    'organize.f.short': 'Kurzcode',
    'organize.f.shortHint': 'A–Z und 0–9, max. 10 Zeichen. Ergibt den lesbaren Code (z. B. HL-RG01-FA02).',
    'organize.f.namePh': 'z. B. Regal A',
    'organize.f.spacePh': 'z. B. Lager Halle 2',
    'organize.notFound': 'Lagerort {code} wurde nicht gefunden.',
    'organize.toHub': 'Zu «Lager organisieren»',
    'organize.path': 'Pfad',
    'organize.responsible': 'Verantwortlich: {name}',
    'organize.internalCode': 'Interner Code',
    'organize.readableCode': 'Lesbarer Code',
    'organize.label': 'QR-Etikett',
    'organize.masterData': 'Stammdaten',
    'organize.stocktake': 'Inventur',
    'organize.aiOrganize': 'Mit KI organisieren',
    'organize.improve': 'Was soll ich hier verbessern?',
    'organize.archivedNote': 'Dieser Lagerort ist archiviert.',
    'organize.organizedSince': 'Organisiert seit {date}',
    'organize.organizedBy': 'Organisiert seit {date} ({name})',
    'organize.partialLoad': 'Ein Teil der Daten konnte nicht geladen werden: {msg}',
    'organize.visual': 'Übersicht',
    'organize.noCover': 'Noch kein Übersichtsfoto. Wähle ein importiertes Foto als Übersichtsfoto – dann kannst du darauf Bereiche (Regale, Schränke …) einzeichnen und direkt dorthin springen.',
    'organize.noCoverRead': 'Für diesen Lagerort gibt es noch kein Übersichtsfoto.',
    'organize.noPhotos': 'Für diesen Lagerort gibt es noch keine importierten Fotos. Importiere zuerst Fotos und wähle dann eines als Übersichtsfoto.',
    'organize.attachmentOnly': 'Dieses Foto ist ein Anhang. Bereiche lassen sich nur auf importierten Fotos einzeichnen – wähle dafür ein Übersichtsfoto.',
    'organize.chooseCover': 'Übersichtsfoto wählen',
    'organize.changeCover': 'Übersichtsfoto ändern',
    'organize.editAreas': 'Bereiche bearbeiten',
    'organize.doneEditing': 'Fertig',
    'organize.editHint': 'Ziehe mit Finger oder Maus ein Rechteck über einen Bereich. Ein kurzer Tipp setzt einen Punkt. Tippe einen bestehenden Bereich an, um ihn zu ändern oder zu löschen.',
    'organize.areas1': '1 Bereich', 'organize.areasN': '{n} Bereiche',
    'organize.areasNone': 'Noch keine Bereiche eingezeichnet.',
    'organize.areasNoneStaff': 'Noch keine Bereiche eingezeichnet. Mit «Bereiche bearbeiten» markierst du Regale, Schränke usw. auf dem Foto.',
    'organize.areasTap': 'Tippe einen Bereich an, um ihn zu öffnen.',
    'organize.hs.openAria': '{name} ({code}) öffnen',
    'organize.hs.editAria': 'Bereich «{name}» bearbeiten',
    'organize.hs.newTitle': 'Neuer Bereich',
    'organize.hs.editTitle': 'Bereich bearbeiten',
    'organize.hs.shapePoint': 'Punkt auf dem Foto',
    'organize.hs.shapeRect': 'Rechteck auf dem Foto',
    'organize.hs.existing': 'Bestehenden Unterort wählen',
    'organize.hs.new': 'Neuen Unterort anlegen',
    'organize.hs.noSubs': 'Es gibt noch keine Unterorte – lege hier einen neuen an.',
    'organize.hs.location': 'Lagerort',
    'organize.hs.label': 'Beschriftung auf dem Foto',
    'organize.hs.labelHint': 'Leer lassen = Name des Lagerorts.',
    'organize.hs.saved': 'Bereich gespeichert',
    'organize.hs.deleted': 'Bereich gelöscht',
    'organize.hs.deleteQ': 'Bereich löschen?',
    'organize.hs.deleteMsg': 'Der Bereich «{name}» wird vom Foto entfernt. Der Lagerort selbst bleibt bestehen.',
    'organize.hs.open': 'Lagerort öffnen',
    'organize.f.shortSuggest': 'Vorschlag nach Typ: {code}',
    'organize.cover.hint': 'Das Übersichtsfoto zeigt den ganzen Lagerort. Darauf zeichnest du die Bereiche ein.',
    'organize.cover.remove': 'Übersichtsfoto entfernen',
    'organize.cover.saved': 'Übersichtsfoto gespeichert',
    'organize.cover.removed': 'Übersichtsfoto entfernt',
    'organize.cover.current': 'Aktuell',
    'organize.cover.more': 'Weitere Fotos importieren',
    'organize.cover.noPhotos': 'Noch keine importierten Fotos in diesem Lagerort.',
    'organize.cover.pick': '{name} als Übersichtsfoto wählen',
    'organize.tabs': 'Bereiche dieses Lagerorts',
    'organize.tab.subs': 'Unterorte', 'organize.tab.content': 'Inhalt', 'organize.tab.photos': 'Fotos', 'organize.tab.plan': 'Plan',
    'organize.view.label': 'Darstellung',
    'organize.view.cards': 'Karten', 'organize.view.list': 'Liste', 'organize.view.tree': 'Baum',
    'organize.subs.none': 'Noch keine Unterorte. Lege Regale, Schränke oder Bereiche an – oder zeichne sie direkt auf dem Übersichtsfoto ein.',
    'organize.subs.noneRead': 'Noch keine Unterorte.',
    'organize.subs.quickAdd': 'Unterort anlegen',
    'organize.subs.added': 'Unterort «{name}» angelegt',
    'organize.subs.shortCodes': 'Kurzcodes vergeben',
    'organize.noShort': 'ohne Kurzcode',
    'organize.content.none': 'In diesem Lagerort ist noch nichts erfasst.',
    'organize.content.filter': 'Inhalt filtern',
    'organize.content.filterPh': 'Name, Code, Marke, Kategorie…',
    'organize.content.noMatch': 'Nichts gefunden.',
    'organize.content.machines': 'Maschinen und Geräte',
    'organize.content.articles': 'Artikel',
    'organize.content.low': 'Wenig',
    'organize.content.here': 'direkt hier',
    'organize.photos.none': 'Noch keine Fotos importiert.',
    'organize.photos.det': '{n} erkannt',
    'organize.photos.open': '{n} offen',
    'organize.photos.openAria': 'Foto {name} öffnen',
    'organize.photos.filter': 'Fotos nach Status filtern',
    'organize.viewer.dets': 'Erkannte Objekte',
    'organize.viewer.noDets': 'Auf diesem Foto sind keine Objekte erfasst.',
    'organize.viewer.noPos': 'ohne Position im Foto',
    'organize.viewer.tapHint': 'Tippe einen Punkt oder ein Objekt in der Liste an, um zu sehen, was erkannt wurde.',
    'organize.viewer.toReview': 'Zur Prüfung',
    'organize.viewer.useCover': 'Als Übersichtsfoto verwenden',
    'organize.viewer.scene': 'Szene',
    'organize.viewer.findings': 'Befunde',
    'organize.viewer.qtyUncertain': 'Menge unsicher',
    'organize.viewer.error': 'Analyse fehlgeschlagen: {error}',
    'organize.viewer.dotAria': '{name} – {conf}',
    'organize.viewer.zoom': 'Foto gross anzeigen',
    'organize.plan.none': 'Noch keine Aufgaben.',
    'organize.plan.noneStaff': 'Noch keine Aufgaben. Erstelle einen Organisationsvorschlag aus den Daten oder füge selbst Aufgaben hinzu.',
    'organize.plan.add': 'Aufgabe hinzufügen',
    'organize.plan.title': 'Aufgabe',
    'organize.plan.titlePh': 'z. B. Regal B beschriften',
    'organize.plan.assign': 'Zuteilen an',
    'organize.plan.nobody': '– niemand –',
    'organize.plan.propose': 'Organisationsvorschlag erstellen',
    'organize.plan.doneAria': '«{title}» erledigt',
    'organize.plan.edit': 'Aufgabe bearbeiten',
    'organize.plan.editAria': 'Aufgabe «{title}» bearbeiten',
    'organize.plan.doneBy': 'erledigt von {name}, {date}',
    'organize.plan.assigned': 'zugeteilt: {name}',
    'organize.plan.doneN': 'Erledigt ({n})',
    'organize.plan.droppedN': 'Verworfen ({n})',
    'organize.plan.saved': 'Aufgabe gespeichert',
    'organize.plan.added': 'Aufgabe hinzugefügt',
    'organize.plan.in': 'in {path}',
    'organize.plan.details': 'Details',
    'organize.plan.status': 'Status',
    'organize.plan.source': 'Quelle: {src}',
    'organize.ki.honest': 'Die App hat keinen eigenen KI-Dienst. Die Erkennung macht Claude (Anthropic) aus den Originalfotos in einer eigenen Sitzung; das Ergebnis wird als Datei hier importiert. Alles bleibt ein Vorschlag, bis jemand es prüft und bestätigt.',
    'organize.ki.s1': 'Fotos',
    'organize.ki.s1n': 'Fotos in diesem Lagerort: {n}',
    'organize.ki.s2': 'Zur Analyse vormerken',
    'organize.ki.s2hint': 'Vormerken startet keine Analyse. Es kennzeichnet die Fotos, die in der Claude-Sitzung analysiert werden sollen.',
    'organize.ki.cNew': 'neu', 'organize.ki.cQueued': 'vorgemerkt', 'organize.ki.cDone': 'analysiert', 'organize.ki.cFailed': 'fehlgeschlagen',
    'organize.ki.queueNew': 'Alle neuen Fotos vormerken ({n})',
    'organize.ki.requeue': 'Fehlgeschlagene erneut vormerken ({n})',
    'organize.ki.queued': 'Zur Analyse vorgemerkt: {n}',
    'organize.ki.s3': 'KI-Ergebnis importieren',
    'organize.ki.s3hint': 'Die Ergebnisdatei aus der Claude-Sitzung (lgr-photo-analysis) importieren. Die Fotos werden über ihre SHA-256-Prüfsumme zugeordnet.',
    'organize.ki.s4': 'Erkennungen prüfen',
    'organize.ki.s4n': '{open} zu prüfen · {total} erkannt',
    'organize.ki.s4btn': 'Erkennungen prüfen ({n})',
    'organize.ki.s5': 'Organisationsplan',
    'organize.ki.s5n': '{open} offene · {done} erledigte Aufgaben',
    'organize.ki.s6': 'Etiketten für Lagerorte',
    'organize.ki.s6n': 'Lagerorte (dieser und alle Unterorte): {n}',
    'organize.ki.s6btn': 'Etiketten drucken',
    'organize.ki.s7': 'Abschliessen',
    'organize.ki.s7open': 'Noch offen – Erkennungen: {det}, Aufgaben: {tasks}.',
    'organize.ki.s7ready': 'Nichts mehr offen.',
    'organize.ki.s7btn': 'Als organisiert abschliessen',
    'organize.ki.reopen': 'Wieder öffnen',
    'organize.ki.closed': 'Als organisiert abgeschlossen',
    'organize.ki.reopened': 'Wieder geöffnet',
    'organize.ki.readOnly': 'Die Schritte ausführen können Lagerverantwortliche und Administratoren.',
    'organize.ki.done': 'erledigt',
    'organize.prop.title': 'Organisationsvorschlag',
    'organize.prop.intro': 'Dieser Vorschlag ist aus den Daten dieses Lagerorts abgeleitet (Erkennungen, Inventar, Unterorte) – nichts davon ist erfunden. Wähle aus, was in den Plan soll.',
    'organize.prop.none': 'Aus den aktuellen Daten ergibt sich kein neuer Vorschlag – alles Abgeleitete steht schon im Plan.',
    'organize.prop.area': 'Bereich für {cat} festlegen und beschriften ({n} Objekte: {names})',
    'organize.prop.areaWhy': '{n} erkannte oder inventarisierte Objekte gehören zur Kategorie «{cat}».',
    'organize.prop.newLoc': 'Lagerort «{name}» anlegen und Kurzcode vergeben',
    'organize.prop.newLocWhy': 'Auf einem Foto als Lagerort/Einrichtung erkannt, aber noch nicht angelegt.',
    'organize.prop.review1': '1 erkanntes Objekt prüfen', 'organize.prop.reviewN': '{n} erkannte Objekte prüfen',
    'organize.prop.reviewWhy': 'Erkennungen sind Vorschläge und werden erst nach der Prüfung zu Inventar.',
    'organize.prop.count': 'Mengen zählen: {names}',
    'organize.prop.countWhy': 'Bei diesen Bestandsartikeln ist die erkannte Menge unsicher.',
    'organize.prop.codes': 'Kurzcodes vergeben und QR-Etiketten drucken',
    'organize.prop.codesWhy': 'Ohne Kurzcode: {names}',
    'organize.prop.covers': 'Übersichtsfotos aufnehmen: {names}',
    'organize.prop.coversWhy': 'Diese Unterorte haben noch kein Übersichtsfoto.',
    'organize.prop.confirm': 'Organisation bestätigen',
    'organize.prop.confirmWhy': 'Zum Schluss prüfen, ob alles am richtigen Ort liegt und beschriftet ist, und den Lagerort abschliessen.',
    'organize.prop.add': 'In den Plan übernehmen',
    'organize.prop.added': 'In den Plan übernommen: {n}',
    'organize.prop.nothingChecked': 'Bitte mindestens einen Punkt auswählen.',
    'organize.imp.photoRecs': 'Empfehlungen aus der Fotoanalyse',
    'organize.imp.photoNone': 'Die Fotoanalyse enthält für diesen Lagerort keine Empfehlungen.',
    'organize.imp.finding': 'Befund: {text}',
    'organize.imp.onPhotos': 'auf {n} Fotos',
    'organize.imp.adopt': 'Als Aufgabe übernehmen',
    'organize.imp.adopted': 'Als Aufgabe übernommen',
    'organize.imp.inPlan': 'Schon im Plan',
    'organize.imp.source': 'Quelle: {src}',
    'organize.imp.dataChecks': 'Prüfungen der Daten',
    'organize.imp.dataNone': 'In den Daten dieses Lagerorts wurden keine Auffälligkeiten gefunden.',
    'organize.imp.open': 'Noch nicht geprüfte Erkennungen: {n}',
    'organize.imp.openWhy': 'Erkennungen bleiben Vorschläge, bis jemand sie prüft – vorher sind sie kein Inventar.',
    'organize.imp.unknown': 'Nicht identifizierte Objekte: {n}',
    'organize.imp.unknownWhy': 'Die Fotoanalyse konnte nicht sicher sagen, was es ist: {names}',
    'organize.imp.qty': 'Bestandsartikel mit unsicherer Menge: {n}',
    'organize.imp.qtyWhy': 'Die Menge auf dem Foto ist nicht sicher – vor dem Bestätigen zählen: {names}',
    'organize.imp.dupDet': 'Objekte auf mehreren Fotos: {n}',
    'organize.imp.dupDetWhy': 'Gleiches Objekt auf mehreren Fotos – beim Prüfen zusammenführen, damit es nicht doppelt ins Inventar kommt: {names}',
    'organize.imp.dupInv': 'Mögliche Duplikate im Inventar ({n})',
    'organize.imp.dupInvWhy': 'Gleiche Marke und gleiches Modell mehrfach erfasst – prüfen, ob es wirklich mehrere Stück sind.',
    'organize.imp.noCat': 'Gegenstände ohne Kategorie: {n}',
    'organize.imp.noCatWhy': 'Ohne Kategorie lassen sie sich schlecht finden und gruppieren.',
    'organize.imp.direct': 'Direkt in «{name}» abgelegt: {n}',
    'organize.imp.directWhy': 'Es gibt Unterorte – genauer ablegen (Regal, Fach, Box), damit man sie schneller findet.',
    'organize.imp.noShort': 'Unterorte ohne Kurzcode: {n}',
    'organize.imp.noShortWhy': 'Ohne Kurzcode fehlt der lesbare Code (z. B. HL-RG01) auf Etiketten: {names}',
    'organize.imp.failed': 'Fehlgeschlagene Fotoanalysen: {n}',
    'organize.imp.failedWhy': 'Diese Fotos wurden nicht ausgewertet: {names}',
    'organize.imp.low': 'Artikel unter Mindestbestand: {n}',
    'organize.imp.lowWhy': 'Bestand ist gleich oder unter dem Mindestbestand.',
    'organize.imp.review': 'Prüfen',
    'organize.imp.requeue': 'Erneut vormerken',
    'organize.imp.more': '+{n} weitere',
    'organize.codes.hint': 'Je Ebene eindeutig, A–Z und 0–9, max. 10 Zeichen. Vorschläge nach Typ (Regal RG01, Fach FA01 …). Leere Felder bleiben ohne Kurzcode.',
    'organize.codes.none': 'Alle Unterorte haben einen Kurzcode.',
    'organize.codes.saved': 'Kurzcodes gespeichert: {n}',
    'organize.codes.invalid': 'Ungültiger Kurzcode: {code}',
    'organize.codes.dup': 'Kurzcode {code} kommt auf derselben Ebene doppelt vor.',
    'organize.labelsNone': 'Hier gibt es keine Lagerorte für Etiketten.',
    'organize.sel.start': 'Fotos auswählen',
    'organize.sel.done': 'Fertig',
    'organize.sel.count': 'Ausgewählt: {n}',
    'organize.sel.all': 'Alle auswählen',
    'organize.sel.clear': 'Auswahl aufheben',
    'organize.sel.move': 'Verschieben nach …',
    'organize.sel.pickAria': 'Foto {name} auswählen',
    'organize.sel.hint': 'Tippe Fotos an, um sie auszuwählen.',
    'organize.move.title': 'Fotos verschieben',
    'organize.move.intro': 'Fotos: {n}. Wähle den Lagerort, zu dem sie gehören. Die Erkennungen der Fotos ziehen mit; bereits bestätigtes Inventar behält seinen Lagerort.',
    'organize.move.filter': 'Lagerort suchen',
    'organize.move.filterPh': 'Name, Code oder Pfad…',
    'organize.move.current': 'aktuell',
    'organize.move.pick': 'Bitte einen Ziel-Lagerort wählen.',
    'organize.move.go': 'Verschieben',
    'organize.move.progress': 'Verschoben: {done} von {n} …',
    'organize.move.doneAll': 'Nach «{name}» verschoben: {n}',
    'organize.move.skipped': 'Lagen schon dort: {n}',
    'organize.move.report': 'Bericht: Fotos verschieben',
    'organize.move.reportText': 'Verschoben: {ok} · nicht verschoben: {failed}',
    'organize.move.noMatch': 'Kein Lagerort gefunden.',
    'organize.viewer.move': 'In anderen Lagerort verschieben',
    'organize.viewer.delete': 'Foto löschen',
    'organize.del.q': 'Foto löschen?',
    'organize.del.msg': '«{name}» wird endgültig gelöscht – zusammen mit seinen Erkennungen (Vorschlägen) und Bereichen. Das kann nicht rückgängig gemacht werden.',
    'organize.del.done': 'Foto gelöscht',
    'organize.del.inUseTitle': 'Foto bleibt erhalten',
    'organize.del.inUse': 'Dieses Foto hat bestätigte Objekte und bleibt als Herkunftsnachweis erhalten. Falls es falsch zugeordnet ist, verschiebe es in den richtigen Lagerort.',
    'organize.fp.title': 'Gebäudeplan',
    'organize.fp.sub': 'Grundriss je Stockwerk mit den Räumen. Tippe einen Raum an, um ihn zu öffnen.',
    'organize.fp.cardN': 'Pläne: {n} · Räume verknüpft: {linked} von {areas}',
    'organize.fp.cardNone': 'Noch kein Plan. Lade einen Grundriss hoch und zeichne die Räume ein.',
    'organize.fp.none': 'Noch kein Gebäudeplan. Lade für jedes Stockwerk einen Grundriss (Bild) hoch und zeichne darauf die Räume ein.',
    'organize.fp.noneRead': 'Noch kein Gebäudeplan vorhanden. Lagerverantwortliche können Pläne hochladen.',
    'organize.fp.add': 'Plan hinzufügen',
    'organize.fp.file': 'Planbild',
    'organize.fp.fileHint': 'Grundriss als Bild (PNG oder JPG). Wird nicht verkleinert, damit die Beschriftung scharf bleibt.',
    'organize.fp.name': 'Name (Stockwerk)',
    'organize.fp.namePh': 'z. B. EG, UG, 1. OG',
    'organize.fp.sort': 'Reihenfolge',
    'organize.fp.sortHint': 'Kleinere Zahl = weiter vorne.',
    'organize.fp.notes': 'Bemerkungen',
    'organize.fp.fileRequired': 'Bitte ein Planbild wählen.',
    'organize.fp.added': 'Plan «{name}» hinzugefügt',
    'organize.fp.edit': 'Umbenennen / sortieren',
    'organize.fp.saved': 'Plan gespeichert',
    'organize.fp.delete': 'Plan löschen',
    'organize.fp.deleteQ': 'Plan löschen?',
    'organize.fp.deleteMsg': 'Der Plan «{name}» wird mit dem Planbild und allen eingezeichneten Bereichen gelöscht. Die Räume selbst bleiben bestehen.',
    'organize.fp.deleted': 'Plan gelöscht',
    'organize.fp.editRooms': 'Räume bearbeiten',
    'organize.fp.editHint': 'Ziehe ein Rechteck über einen Raum (kurzer Tipp = Punkt). Bereich ziehen = verschieben, an den Ecken ziehen = Grösse ändern, antippen = bearbeiten oder löschen.',
    'organize.fp.tabs': 'Stockwerke',
    'organize.fp.planAlt': 'Grundriss {name}',
    'organize.fp.legend': 'Legende',
    'organize.fp.lgLinked': 'Raum angelegt (Farbe = Stand)',
    'organize.fp.lgUnlinked': 'Nur beschriftet – Raum noch nicht angelegt',
    'organize.fp.rooms': 'Räume auf diesem Plan',
    'organize.fp.roomsNone': 'Auf diesem Plan sind noch keine Räume eingezeichnet.',
    'organize.fp.roomsNoneStaff': 'Auf diesem Plan sind noch keine Räume eingezeichnet. Mit «Räume bearbeiten» ziehst du Rechtecke über die Räume.',
    'organize.fp.notCreated': 'noch nicht angelegt',
    'organize.fp.createLink': 'Raum anlegen und verknüpfen',
    'organize.fp.createIntro': 'Legt einen neuen Raum (obersten Lagerort) an und verknüpft ihn mit dem Bereich «{label}» auf dem Plan.',
    'organize.fp.created': 'Raum «{name}» angelegt und verknüpft',
    'organize.fp.linked': 'Mit «{name}» verknüpft',
    'organize.fp.area': 'Raum auf dem Plan',
    'organize.fp.newArea': 'Neuer Raum auf dem Plan',
    'organize.fp.mode.label': 'Nur beschriften (Raum noch nicht angelegt)',
    'organize.fp.mode.existing': 'Mit bestehendem Raum verknüpfen',
    'organize.fp.mode.new': 'Neuen Raum anlegen',
    'organize.fp.label': 'Beschriftung',
    'organize.fp.labelHint': 'Name auf dem Plan, z. B. «Kellerabteil 3». Bei verknüpften Räumen leer lassen = Name des Raums.',
    'organize.fp.labelRequired': 'Bitte eine Beschriftung eingeben.',
    'organize.fp.space': 'Raum',
    'organize.fp.noSpaces': 'Es gibt noch keine Räume.',
    'organize.fp.areaSaved': 'Bereich gespeichert',
    'organize.fp.areaDeleted': 'Bereich gelöscht',
    'organize.fp.areaDeleteMsg': 'Der Bereich «{name}» wird vom Plan entfernt. Ein verknüpfter Raum bleibt bestehen.',
    'organize.fp.openAria': '{name} öffnen – {status}',
    'organize.fp.itemAria': '{name} öffnen – {code}',
    'organize.fp.items': 'Möbel: {n}',
    'organize.fp.zoom': 'Zoom',
    'organize.fp.zoomIn': 'Plan vergrössern',
    'organize.fp.zoomOut': 'Plan verkleinern',
    'organize.fp.zoomFit': 'Ganzer Plan',
    'organize.fp.mode.existingLoc': 'Mit bestehendem Lagerort verknüpfen',
    'organize.fp.locField': 'Raum oder Möbel',
    'organize.fp.unlinkedAria': '{name} – noch nicht angelegt',
    'organize.fp.linkedLabel': 'verknüpft',
    'organize.fp.onPlan': 'Auf dem Plan',
    'organize.fp.onPlanAria': 'Auf dem Gebäudeplan «{name}» anzeigen',
    'organize.fp.shapeRect': 'Rechteck auf dem Plan',
    'organize.fp.shapePoint': 'Punkt auf dem Plan',
    'organize.open': 'Öffnen',
  },
  pt: {
    'organize.title': 'Organizar armazém',
    'organize.sub': 'Registar todos os objetos de forma estruturada, visual e verificada.',
    'organize.importPhotos': 'Importar fotos',
    'organize.reviewN': 'Verificar reconhecimento IA ({n})',
    'organize.viewDetN': 'Ver reconhecimentos ({n})',
    'organize.searchLabel': 'Pesquisar em todo o armazém',
    'organize.searchPh': 'Objeto, código, marca, localização…',
    'organize.figures': 'Estado da organização',
    'organize.stat.photosOf': 'Fotos analisadas (de {b})',
    'organize.stat.failed': '{n} falharam',
    'organize.stat.detected': 'Objetos reconhecidos',
    'organize.stat.identified': 'Identificados',
    'organize.stat.confirmed': 'Inventariados (confirmados)',
    'organize.stat.unknown': 'Desconhecidos',
    'organize.stat.noLocation': 'Sem localização',
    'organize.stat.locations': 'Localizações registadas',
    'organize.stat.proposed': 'Localizações propostas',
    'organize.stat.duplicates': 'Possíveis duplicados',
    'organize.stat.tasks': 'Tarefas abertas',
    'organize.stat.spacesOf': 'Espaços organizados (de {b})',
    'organize.spaces': 'Espaços',
    'organize.addSpace': 'Adicionar espaço',
    'organize.noSpaces': 'Ainda não há espaços. Cria primeiro os espaços (p. ex. armazém principal, oficina) e depois importa fotos deles.',
    'organize.noSpacesRead': 'Ainda não há espaços. Os responsáveis do armazém podem criá-los aqui.',
    'organize.howto.title': 'Como funciona',
    'organize.howto.t1': 'Fotos', 'organize.howto.d1': 'Fotografar espaços, estantes e armários e importar as fotos aqui.',
    'organize.howto.t2': 'Análise', 'organize.howto.d2': 'Marcar as fotos novas para análise. O Claude (Anthropic) reconhece os objetos nas fotos originais; o resultado é importado como ficheiro.',
    'organize.howto.t3': 'Verificar', 'organize.howto.d3': 'Cada reconhecimento é uma proposta. Só depois de alguém o confirmar passa a ser inventário.',
    'organize.howto.t4': 'Plano', 'organize.howto.d4': 'Criar uma proposta de organização a partir dos dados e cumprir as tarefas.',
    'organize.howto.t5': 'Etiquetas', 'organize.howto.d5': 'Imprimir e colar etiquetas QR para localizações e objetos.',
    'organize.howto.t6': 'Concluir', 'organize.howto.d6': 'Quando não houver nada em aberto, concluir o espaço como organizado.',
    'organize.items1': '1 objeto', 'organize.itemsN': '{n} objetos',
    'organize.subs1': '1 sublocalização', 'organize.subsN': '{n} sublocalizações',
    'organize.open1': '1 ponto em aberto', 'organize.openN': '{n} pontos em aberto',
    'organize.noOpen': 'Nada em aberto',
    'organize.progressOf': '{a} de {b} concluídos',
    'organize.progressNone': 'Ainda sem pontos registados',
    'organize.progressOrganized': 'Organizado',
    'organize.progressLabel': 'Progresso da organização',
    'organize.inventory': 'Inventário',
    'organize.inventoryAria': 'Inventário de «{name}»',
    'organize.photoAlt': 'Foto de {name}',
    'organize.noPhoto': 'Ainda sem foto',
    'organize.tasksNone': 'Não há tarefas abertas.',
    'organize.noLocTitle': 'Objetos sem localização',
    'organize.noLocNone': 'Todos os objetos têm localização.',
    'organize.add.presets': 'Sugestões',
    'organize.add.presetsHint': 'Podes escolher vários. Só é criado o que escolheres.',
    'organize.add.allExist': 'Todas as sugestões já foram criadas.',
    'organize.add.custom': 'Espaço próprio',
    'organize.add.nothing': 'Escolhe uma sugestão ou introduz um nome.',
    'organize.add.created1': 'Espaço «{name}» criado',
    'organize.add.createdN': '{n} espaços criados',
    'organize.add.save': 'Criar',
    'organize.f.name': 'Nome',
    'organize.f.type': 'Tipo',
    'organize.f.short': 'Código curto',
    'organize.f.shortHint': 'A–Z e 0–9, máx. 10 caracteres. Forma o código legível (p. ex. HL-RG01-FA02).',
    'organize.f.namePh': 'p. ex. Estante A',
    'organize.f.spacePh': 'p. ex. Armazém Pavilhão 2',
    'organize.notFound': 'A localização {code} não foi encontrada.',
    'organize.toHub': 'Ir para «Organizar armazém»',
    'organize.path': 'Caminho',
    'organize.responsible': 'Responsável: {name}',
    'organize.internalCode': 'Código interno',
    'organize.readableCode': 'Código legível',
    'organize.label': 'Etiqueta QR',
    'organize.masterData': 'Dados base',
    'organize.stocktake': 'Inventário físico',
    'organize.aiOrganize': 'Organizar com IA',
    'organize.improve': 'O que devo melhorar aqui?',
    'organize.archivedNote': 'Esta localização está arquivada.',
    'organize.organizedSince': 'Organizado desde {date}',
    'organize.organizedBy': 'Organizado desde {date} ({name})',
    'organize.partialLoad': 'Não foi possível carregar parte dos dados: {msg}',
    'organize.visual': 'Vista geral',
    'organize.noCover': 'Ainda não há foto geral. Escolhe uma foto importada como foto geral – depois podes marcar nela zonas (estantes, armários …) e saltar diretamente para elas.',
    'organize.noCoverRead': 'Esta localização ainda não tem foto geral.',
    'organize.noPhotos': 'Esta localização ainda não tem fotos importadas. Importa primeiro fotos e depois escolhe uma como foto geral.',
    'organize.attachmentOnly': 'Esta foto é um anexo. Só é possível marcar zonas em fotos importadas – escolhe uma foto geral.',
    'organize.chooseCover': 'Escolher foto geral',
    'organize.changeCover': 'Mudar foto geral',
    'organize.editAreas': 'Editar zonas',
    'organize.doneEditing': 'Concluído',
    'organize.editHint': 'Arrasta com o dedo ou o rato um retângulo sobre uma zona. Um toque curto marca um ponto. Toca numa zona existente para a alterar ou eliminar.',
    'organize.areas1': '1 zona', 'organize.areasN': '{n} zonas',
    'organize.areasNone': 'Ainda não há zonas marcadas.',
    'organize.areasNoneStaff': 'Ainda não há zonas marcadas. Com «Editar zonas» marcas estantes, armários, etc. na foto.',
    'organize.areasTap': 'Toca numa zona para a abrir.',
    'organize.hs.openAria': 'Abrir {name} ({code})',
    'organize.hs.editAria': 'Editar zona «{name}»',
    'organize.hs.newTitle': 'Nova zona',
    'organize.hs.editTitle': 'Editar zona',
    'organize.hs.shapePoint': 'Ponto na foto',
    'organize.hs.shapeRect': 'Retângulo na foto',
    'organize.hs.existing': 'Escolher sublocalização existente',
    'organize.hs.new': 'Criar nova sublocalização',
    'organize.hs.noSubs': 'Ainda não há sublocalizações – cria aqui uma nova.',
    'organize.hs.location': 'Localização',
    'organize.hs.label': 'Legenda na foto',
    'organize.hs.labelHint': 'Em branco = nome da localização.',
    'organize.hs.saved': 'Zona guardada',
    'organize.hs.deleted': 'Zona eliminada',
    'organize.hs.deleteQ': 'Eliminar zona?',
    'organize.hs.deleteMsg': 'A zona «{name}» é removida da foto. A localização em si mantém-se.',
    'organize.hs.open': 'Abrir localização',
    'organize.f.shortSuggest': 'Sugestão pelo tipo: {code}',
    'organize.cover.hint': 'A foto geral mostra toda a localização. É nela que marcas as zonas.',
    'organize.cover.remove': 'Remover foto geral',
    'organize.cover.saved': 'Foto geral guardada',
    'organize.cover.removed': 'Foto geral removida',
    'organize.cover.current': 'Atual',
    'organize.cover.more': 'Importar mais fotos',
    'organize.cover.noPhotos': 'Ainda não há fotos importadas nesta localização.',
    'organize.cover.pick': 'Escolher {name} como foto geral',
    'organize.tabs': 'Secções desta localização',
    'organize.tab.subs': 'Sublocalizações', 'organize.tab.content': 'Conteúdo', 'organize.tab.photos': 'Fotos', 'organize.tab.plan': 'Plano',
    'organize.view.label': 'Apresentação',
    'organize.view.cards': 'Cartões', 'organize.view.list': 'Lista', 'organize.view.tree': 'Árvore',
    'organize.subs.none': 'Ainda não há sublocalizações. Cria estantes, armários ou zonas – ou marca-os diretamente na foto geral.',
    'organize.subs.noneRead': 'Ainda não há sublocalizações.',
    'organize.subs.quickAdd': 'Criar sublocalização',
    'organize.subs.added': 'Sublocalização «{name}» criada',
    'organize.subs.shortCodes': 'Atribuir códigos curtos',
    'organize.noShort': 'sem código curto',
    'organize.content.none': 'Ainda não há nada registado nesta localização.',
    'organize.content.filter': 'Filtrar conteúdo',
    'organize.content.filterPh': 'Nome, código, marca, categoria…',
    'organize.content.noMatch': 'Nada encontrado.',
    'organize.content.machines': 'Máquinas e equipamentos',
    'organize.content.articles': 'Artigos',
    'organize.content.low': 'Baixo',
    'organize.content.here': 'diretamente aqui',
    'organize.photos.none': 'Ainda não há fotos importadas.',
    'organize.photos.det': '{n} reconhecidos',
    'organize.photos.open': '{n} em aberto',
    'organize.photos.openAria': 'Abrir foto {name}',
    'organize.photos.filter': 'Filtrar fotos por estado',
    'organize.viewer.dets': 'Objetos reconhecidos',
    'organize.viewer.noDets': 'Não há objetos registados nesta foto.',
    'organize.viewer.noPos': 'sem posição na foto',
    'organize.viewer.tapHint': 'Toca num ponto ou num objeto da lista para ver o que foi reconhecido.',
    'organize.viewer.toReview': 'Para a verificação',
    'organize.viewer.useCover': 'Usar como foto geral',
    'organize.viewer.scene': 'Cena',
    'organize.viewer.findings': 'Constatações',
    'organize.viewer.qtyUncertain': 'Quantidade incerta',
    'organize.viewer.error': 'A análise falhou: {error}',
    'organize.viewer.dotAria': '{name} – {conf}',
    'organize.viewer.zoom': 'Ver foto em grande',
    'organize.plan.none': 'Ainda não há tarefas.',
    'organize.plan.noneStaff': 'Ainda não há tarefas. Cria uma proposta de organização a partir dos dados ou adiciona tarefas tu mesmo.',
    'organize.plan.add': 'Adicionar tarefa',
    'organize.plan.title': 'Tarefa',
    'organize.plan.titlePh': 'p. ex. etiquetar a estante B',
    'organize.plan.assign': 'Atribuir a',
    'organize.plan.nobody': '– ninguém –',
    'organize.plan.propose': 'Criar proposta de organização',
    'organize.plan.doneAria': '«{title}» concluída',
    'organize.plan.edit': 'Editar tarefa',
    'organize.plan.editAria': 'Editar tarefa «{title}»',
    'organize.plan.doneBy': 'concluída por {name}, {date}',
    'organize.plan.assigned': 'atribuída a: {name}',
    'organize.plan.doneN': 'Concluídas ({n})',
    'organize.plan.droppedN': 'Descartadas ({n})',
    'organize.plan.saved': 'Tarefa guardada',
    'organize.plan.added': 'Tarefa adicionada',
    'organize.plan.in': 'em {path}',
    'organize.plan.details': 'Detalhes',
    'organize.plan.status': 'Estado',
    'organize.plan.source': 'Origem: {src}',
    'organize.ki.honest': 'A app não tem um serviço de IA próprio. O reconhecimento é feito pelo Claude (Anthropic) a partir das fotos originais, numa sessão própria; o resultado é importado aqui como ficheiro. Tudo fica como proposta até alguém verificar e confirmar.',
    'organize.ki.s1': 'Fotos',
    'organize.ki.s1n': 'Fotos nesta localização: {n}',
    'organize.ki.s2': 'Marcar para análise',
    'organize.ki.s2hint': 'Marcar não inicia nenhuma análise. Apenas assinala as fotos que devem ser analisadas na sessão do Claude.',
    'organize.ki.cNew': 'novas', 'organize.ki.cQueued': 'marcadas', 'organize.ki.cDone': 'analisadas', 'organize.ki.cFailed': 'falharam',
    'organize.ki.queueNew': 'Marcar todas as fotos novas ({n})',
    'organize.ki.requeue': 'Marcar de novo as que falharam ({n})',
    'organize.ki.queued': 'Marcadas para análise: {n}',
    'organize.ki.s3': 'Importar resultado da IA',
    'organize.ki.s3hint': 'Importar o ficheiro de resultado da sessão do Claude (lgr-photo-analysis). As fotos são associadas pela soma SHA-256.',
    'organize.ki.s4': 'Verificar reconhecimentos',
    'organize.ki.s4n': '{open} por verificar · {total} reconhecidos',
    'organize.ki.s4btn': 'Verificar reconhecimentos ({n})',
    'organize.ki.s5': 'Plano de organização',
    'organize.ki.s5n': '{open} tarefas abertas · {done} concluídas',
    'organize.ki.s6': 'Etiquetas para localizações',
    'organize.ki.s6n': 'Localizações (esta e todas as sublocalizações): {n}',
    'organize.ki.s6btn': 'Imprimir etiquetas',
    'organize.ki.s7': 'Concluir',
    'organize.ki.s7open': 'Ainda em aberto – reconhecimentos: {det}, tarefas: {tasks}.',
    'organize.ki.s7ready': 'Já nada está em aberto.',
    'organize.ki.s7btn': 'Concluir como organizado',
    'organize.ki.reopen': 'Reabrir',
    'organize.ki.closed': 'Concluído como organizado',
    'organize.ki.reopened': 'Reaberto',
    'organize.ki.readOnly': 'Os passos podem ser executados pelos responsáveis do armazém e administradores.',
    'organize.ki.done': 'concluído',
    'organize.prop.title': 'Proposta de organização',
    'organize.prop.intro': 'Esta proposta é derivada dos dados desta localização (reconhecimentos, inventário, sublocalizações) – nada é inventado. Escolhe o que deve entrar no plano.',
    'organize.prop.none': 'Os dados atuais não dão origem a nenhuma proposta nova – tudo o que foi derivado já está no plano.',
    'organize.prop.area': 'Definir e identificar zona para {cat} ({n} objetos: {names})',
    'organize.prop.areaWhy': '{n} objetos reconhecidos ou inventariados pertencem à categoria «{cat}».',
    'organize.prop.newLoc': 'Criar a localização «{name}» e atribuir código curto',
    'organize.prop.newLocWhy': 'Reconhecida numa foto como localização/mobiliário, mas ainda não criada.',
    'organize.prop.review1': 'Verificar 1 objeto reconhecido', 'organize.prop.reviewN': 'Verificar {n} objetos reconhecidos',
    'organize.prop.reviewWhy': 'Os reconhecimentos são propostas e só passam a inventário depois da verificação.',
    'organize.prop.count': 'Contar quantidades: {names}',
    'organize.prop.countWhy': 'Nestes materiais com stock a quantidade reconhecida é incerta.',
    'organize.prop.codes': 'Atribuir códigos curtos e imprimir etiquetas QR',
    'organize.prop.codesWhy': 'Sem código curto: {names}',
    'organize.prop.covers': 'Tirar fotos gerais: {names}',
    'organize.prop.coversWhy': 'Estas sublocalizações ainda não têm foto geral.',
    'organize.prop.confirm': 'Confirmar a organização',
    'organize.prop.confirmWhy': 'No fim, verificar se tudo está no sítio certo e identificado, e concluir a localização.',
    'organize.prop.add': 'Passar para o plano',
    'organize.prop.added': 'Passadas para o plano: {n}',
    'organize.prop.nothingChecked': 'Escolhe pelo menos um ponto.',
    'organize.imp.photoRecs': 'Recomendações da análise de fotos',
    'organize.imp.photoNone': 'A análise de fotos não tem recomendações para esta localização.',
    'organize.imp.finding': 'Constatação: {text}',
    'organize.imp.onPhotos': 'em {n} fotos',
    'organize.imp.adopt': 'Criar tarefa',
    'organize.imp.adopted': 'Tarefa criada',
    'organize.imp.inPlan': 'Já está no plano',
    'organize.imp.source': 'Origem: {src}',
    'organize.imp.dataChecks': 'Verificações dos dados',
    'organize.imp.dataNone': 'Não foram encontradas anomalias nos dados desta localização.',
    'organize.imp.open': 'Reconhecimentos ainda por verificar: {n}',
    'organize.imp.openWhy': 'Os reconhecimentos ficam como propostas até alguém os verificar – antes disso não são inventário.',
    'organize.imp.unknown': 'Objetos não identificados: {n}',
    'organize.imp.unknownWhy': 'A análise de fotos não conseguiu dizer com certeza o que é: {names}',
    'organize.imp.qty': 'Materiais com stock com quantidade incerta: {n}',
    'organize.imp.qtyWhy': 'A quantidade na foto não é segura – contar antes de confirmar: {names}',
    'organize.imp.dupDet': 'Objetos em várias fotos: {n}',
    'organize.imp.dupDetWhy': 'O mesmo objeto em várias fotos – fundir na verificação para não entrar duas vezes no inventário: {names}',
    'organize.imp.dupInv': 'Possíveis duplicados no inventário ({n})',
    'organize.imp.dupInvWhy': 'A mesma marca e o mesmo modelo registados várias vezes – verificar se são mesmo várias unidades.',
    'organize.imp.noCat': 'Objetos sem categoria: {n}',
    'organize.imp.noCatWhy': 'Sem categoria são difíceis de encontrar e agrupar.',
    'organize.imp.direct': 'Arrumados diretamente em «{name}»: {n}',
    'organize.imp.directWhy': 'Existem sublocalizações – arrumar com mais precisão (estante, compartimento, caixa) para os encontrar mais depressa.',
    'organize.imp.noShort': 'Sublocalizações sem código curto: {n}',
    'organize.imp.noShortWhy': 'Sem código curto falta o código legível (p. ex. HL-RG01) nas etiquetas: {names}',
    'organize.imp.failed': 'Análises de fotos falhadas: {n}',
    'organize.imp.failedWhy': 'Estas fotos não foram avaliadas: {names}',
    'organize.imp.low': 'Artigos abaixo do stock mínimo: {n}',
    'organize.imp.lowWhy': 'O stock está igual ou abaixo do mínimo.',
    'organize.imp.review': 'Verificar',
    'organize.imp.requeue': 'Marcar de novo',
    'organize.imp.more': '+{n} outros',
    'organize.codes.hint': 'Único por nível, A–Z e 0–9, máx. 10 caracteres. Sugestões pelo tipo (estante RG01, compartimento FA01 …). Campos vazios ficam sem código curto.',
    'organize.codes.none': 'Todas as sublocalizações têm código curto.',
    'organize.codes.saved': 'Códigos curtos guardados: {n}',
    'organize.codes.invalid': 'Código curto inválido: {code}',
    'organize.codes.dup': 'O código curto {code} aparece duas vezes no mesmo nível.',
    'organize.labelsNone': 'Aqui não há localizações para etiquetas.',
    'organize.sel.start': 'Selecionar fotos',
    'organize.sel.done': 'Concluído',
    'organize.sel.count': 'Selecionadas: {n}',
    'organize.sel.all': 'Selecionar todas',
    'organize.sel.clear': 'Limpar seleção',
    'organize.sel.move': 'Mover para …',
    'organize.sel.pickAria': 'Selecionar foto {name}',
    'organize.sel.hint': 'Toca nas fotos para as selecionar.',
    'organize.move.title': 'Mover fotos',
    'organize.move.intro': 'Fotos: {n}. Escolhe a localização a que pertencem. Os reconhecimentos das fotos acompanham-nas; o inventário já confirmado mantém a sua localização.',
    'organize.move.filter': 'Procurar localização',
    'organize.move.filterPh': 'Nome, código ou caminho…',
    'organize.move.current': 'atual',
    'organize.move.pick': 'Escolhe uma localização de destino.',
    'organize.move.go': 'Mover',
    'organize.move.progress': 'Movidas: {done} de {n} …',
    'organize.move.doneAll': 'Movidas para «{name}»: {n}',
    'organize.move.skipped': 'Já estavam lá: {n}',
    'organize.move.report': 'Relatório: mover fotos',
    'organize.move.reportText': 'Movidas: {ok} · não movidas: {failed}',
    'organize.move.noMatch': 'Nenhuma localização encontrada.',
    'organize.viewer.move': 'Mover para outra localização',
    'organize.viewer.delete': 'Eliminar foto',
    'organize.del.q': 'Eliminar a foto?',
    'organize.del.msg': '«{name}» é eliminada definitivamente – juntamente com os seus reconhecimentos (propostas) e zonas. Esta ação não pode ser anulada.',
    'organize.del.done': 'Foto eliminada',
    'organize.del.inUseTitle': 'A foto mantém-se',
    'organize.del.inUse': 'Esta foto tem objetos confirmados e mantém-se como prova de origem. Se estiver mal atribuída, move-a para a localização certa.',
    'organize.fp.title': 'Planta do edifício',
    'organize.fp.sub': 'Planta de cada piso com os espaços. Toca num espaço para o abrir.',
    'organize.fp.cardN': 'Plantas: {n} · espaços ligados: {linked} de {areas}',
    'organize.fp.cardNone': 'Ainda não há planta. Carrega uma planta e marca nela os espaços.',
    'organize.fp.none': 'Ainda não há planta do edifício. Carrega uma planta (imagem) por piso e marca nela os espaços.',
    'organize.fp.noneRead': 'Ainda não há planta do edifício. Os responsáveis do armazém podem carregar plantas.',
    'organize.fp.add': 'Adicionar planta',
    'organize.fp.file': 'Imagem da planta',
    'organize.fp.fileHint': 'Planta como imagem (PNG ou JPG). Não é reduzida, para que a legenda fique nítida.',
    'organize.fp.name': 'Nome (piso)',
    'organize.fp.namePh': 'p. ex. R/C, Cave, 1.º andar',
    'organize.fp.sort': 'Ordem',
    'organize.fp.sortHint': 'Número menor = mais à frente.',
    'organize.fp.notes': 'Observações',
    'organize.fp.fileRequired': 'Escolhe uma imagem da planta.',
    'organize.fp.added': 'Planta «{name}» adicionada',
    'organize.fp.edit': 'Mudar nome / ordem',
    'organize.fp.saved': 'Planta guardada',
    'organize.fp.delete': 'Eliminar planta',
    'organize.fp.deleteQ': 'Eliminar a planta?',
    'organize.fp.deleteMsg': 'A planta «{name}» é eliminada com a imagem e todas as zonas marcadas. Os espaços em si mantêm-se.',
    'organize.fp.deleted': 'Planta eliminada',
    'organize.fp.editRooms': 'Editar espaços',
    'organize.fp.editHint': 'Arrasta um retângulo sobre um espaço (toque curto = ponto). Arrastar uma zona = mover, arrastar os cantos = mudar o tamanho, tocar = editar ou eliminar.',
    'organize.fp.tabs': 'Pisos',
    'organize.fp.planAlt': 'Planta {name}',
    'organize.fp.legend': 'Legenda',
    'organize.fp.lgLinked': 'Espaço criado (cor = estado)',
    'organize.fp.lgUnlinked': 'Só legendado – espaço ainda não criado',
    'organize.fp.rooms': 'Espaços nesta planta',
    'organize.fp.roomsNone': 'Ainda não há espaços marcados nesta planta.',
    'organize.fp.roomsNoneStaff': 'Ainda não há espaços marcados nesta planta. Com «Editar espaços» arrastas retângulos sobre os espaços.',
    'organize.fp.notCreated': 'ainda não criado',
    'organize.fp.createLink': 'Criar espaço e ligar',
    'organize.fp.createIntro': 'Cria um novo espaço (localização de nível superior) e liga-o à zona «{label}» da planta.',
    'organize.fp.created': 'Espaço «{name}» criado e ligado',
    'organize.fp.linked': 'Ligado a «{name}»',
    'organize.fp.area': 'Espaço na planta',
    'organize.fp.newArea': 'Novo espaço na planta',
    'organize.fp.mode.label': 'Só legendar (espaço ainda não criado)',
    'organize.fp.mode.existing': 'Ligar a um espaço existente',
    'organize.fp.mode.new': 'Criar novo espaço',
    'organize.fp.label': 'Legenda',
    'organize.fp.labelHint': 'Nome na planta, p. ex. «Arrecadação 3». Em espaços ligados, em branco = nome do espaço.',
    'organize.fp.labelRequired': 'Introduz uma legenda.',
    'organize.fp.space': 'Espaço',
    'organize.fp.noSpaces': 'Ainda não há espaços.',
    'organize.fp.areaSaved': 'Zona guardada',
    'organize.fp.areaDeleted': 'Zona eliminada',
    'organize.fp.areaDeleteMsg': 'A zona «{name}» é removida da planta. Um espaço ligado mantém-se.',
    'organize.fp.openAria': 'Abrir {name} – {status}',
    'organize.fp.itemAria': 'Abrir {name} – {code}',
    'organize.fp.items': 'Móveis: {n}',
    'organize.fp.zoom': 'Zoom',
    'organize.fp.zoomIn': 'Ampliar a planta',
    'organize.fp.zoomOut': 'Reduzir a planta',
    'organize.fp.zoomFit': 'Planta inteira',
    'organize.fp.mode.existingLoc': 'Ligar a uma localização existente',
    'organize.fp.locField': 'Espaço ou móvel',
    'organize.fp.unlinkedAria': '{name} – ainda não criado',
    'organize.fp.linkedLabel': 'ligado',
    'organize.fp.onPlan': 'Na planta',
    'organize.fp.onPlanAria': 'Mostrar na planta «{name}»',
    'organize.fp.shapeRect': 'Retângulo na planta',
    'organize.fp.shapePoint': 'Ponto na planta',
    'organize.open': 'Abrir',
  },
  es: {
    'organize.title': 'Organizar almacén',
    'organize.sub': 'Registrar todos los objetos de forma estructurada, visual y revisada.',
    'organize.importPhotos': 'Importar fotos',
    'organize.reviewN': 'Revisar reconocimiento IA ({n})',
    'organize.viewDetN': 'Ver reconocimientos ({n})',
    'organize.searchLabel': 'Buscar en todo el almacén',
    'organize.searchPh': 'Objeto, código, marca, ubicación…',
    'organize.figures': 'Estado de la organización',
    'organize.stat.photosOf': 'Fotos analizadas (de {b})',
    'organize.stat.failed': '{n} fallidas',
    'organize.stat.detected': 'Objetos reconocidos',
    'organize.stat.identified': 'Identificados',
    'organize.stat.confirmed': 'Inventariados (confirmados)',
    'organize.stat.unknown': 'Desconocidos',
    'organize.stat.noLocation': 'Sin ubicación',
    'organize.stat.locations': 'Ubicaciones registradas',
    'organize.stat.proposed': 'Ubicaciones propuestas',
    'organize.stat.duplicates': 'Posibles duplicados',
    'organize.stat.tasks': 'Tareas abiertas',
    'organize.stat.spacesOf': 'Espacios organizados (de {b})',
    'organize.spaces': 'Espacios',
    'organize.addSpace': 'Añadir espacio',
    'organize.noSpaces': 'Todavía no hay espacios. Crea primero los espacios (p. ej. almacén principal, taller) y después importa fotos de ellos.',
    'organize.noSpacesRead': 'Todavía no hay espacios. Los responsables del almacén pueden crearlos aquí.',
    'organize.howto.title': 'Cómo funciona',
    'organize.howto.t1': 'Fotos', 'organize.howto.d1': 'Fotografiar espacios, estanterías y armarios e importar las fotos aquí.',
    'organize.howto.t2': 'Análisis', 'organize.howto.d2': 'Marcar las fotos nuevas para análisis. Claude (Anthropic) reconoce los objetos en las fotos originales; el resultado se importa como archivo.',
    'organize.howto.t3': 'Revisar', 'organize.howto.d3': 'Cada reconocimiento es una propuesta. Solo cuando alguien lo confirma se convierte en inventario.',
    'organize.howto.t4': 'Plan', 'organize.howto.d4': 'Crear una propuesta de organización a partir de los datos y completar las tareas.',
    'organize.howto.t5': 'Etiquetas', 'organize.howto.d5': 'Imprimir y pegar etiquetas QR para ubicaciones y objetos.',
    'organize.howto.t6': 'Cerrar', 'organize.howto.d6': 'Cuando no quede nada pendiente, cerrar el espacio como organizado.',
    'organize.items1': '1 objeto', 'organize.itemsN': '{n} objetos',
    'organize.subs1': '1 sububicación', 'organize.subsN': '{n} sububicaciones',
    'organize.open1': '1 punto pendiente', 'organize.openN': '{n} puntos pendientes',
    'organize.noOpen': 'Nada pendiente',
    'organize.progressOf': '{a} de {b} hechos',
    'organize.progressNone': 'Todavía sin puntos registrados',
    'organize.progressOrganized': 'Organizado',
    'organize.progressLabel': 'Progreso de la organización',
    'organize.inventory': 'Inventario',
    'organize.inventoryAria': 'Inventario de «{name}»',
    'organize.photoAlt': 'Foto de {name}',
    'organize.noPhoto': 'Todavía sin foto',
    'organize.tasksNone': 'No hay tareas abiertas.',
    'organize.noLocTitle': 'Objetos sin ubicación',
    'organize.noLocNone': 'Todos los objetos tienen ubicación.',
    'organize.add.presets': 'Sugerencias',
    'organize.add.presetsHint': 'Puedes elegir varias. Solo se crea lo que elijas.',
    'organize.add.allExist': 'Todas las sugerencias ya están creadas.',
    'organize.add.custom': 'Espacio propio',
    'organize.add.nothing': 'Elige una sugerencia o introduce un nombre.',
    'organize.add.created1': 'Espacio «{name}» creado',
    'organize.add.createdN': '{n} espacios creados',
    'organize.add.save': 'Crear',
    'organize.f.name': 'Nombre',
    'organize.f.type': 'Tipo',
    'organize.f.short': 'Código corto',
    'organize.f.shortHint': 'A–Z y 0–9, máx. 10 caracteres. Forma el código legible (p. ej. HL-RG01-FA02).',
    'organize.f.namePh': 'p. ej. Estantería A',
    'organize.f.spacePh': 'p. ej. Almacén nave 2',
    'organize.notFound': 'No se ha encontrado la ubicación {code}.',
    'organize.toHub': 'Ir a «Organizar almacén»',
    'organize.path': 'Ruta',
    'organize.responsible': 'Responsable: {name}',
    'organize.internalCode': 'Código interno',
    'organize.readableCode': 'Código legible',
    'organize.label': 'Etiqueta QR',
    'organize.masterData': 'Datos maestros',
    'organize.stocktake': 'Inventario físico',
    'organize.aiOrganize': 'Organizar con IA',
    'organize.improve': '¿Qué debería mejorar aquí?',
    'organize.archivedNote': 'Esta ubicación está archivada.',
    'organize.organizedSince': 'Organizado desde {date}',
    'organize.organizedBy': 'Organizado desde {date} ({name})',
    'organize.partialLoad': 'No se pudo cargar una parte de los datos: {msg}',
    'organize.visual': 'Vista general',
    'organize.noCover': 'Todavía no hay foto general. Elige una foto importada como foto general: después podrás marcar en ella zonas (estanterías, armarios …) e ir directamente a ellas.',
    'organize.noCoverRead': 'Esta ubicación todavía no tiene foto general.',
    'organize.noPhotos': 'Esta ubicación todavía no tiene fotos importadas. Importa primero fotos y después elige una como foto general.',
    'organize.attachmentOnly': 'Esta foto es un adjunto. Solo se pueden marcar zonas en fotos importadas: elige una foto general.',
    'organize.chooseCover': 'Elegir foto general',
    'organize.changeCover': 'Cambiar foto general',
    'organize.editAreas': 'Editar zonas',
    'organize.doneEditing': 'Listo',
    'organize.editHint': 'Arrastra con el dedo o el ratón un rectángulo sobre una zona. Un toque corto marca un punto. Toca una zona existente para cambiarla o eliminarla.',
    'organize.areas1': '1 zona', 'organize.areasN': '{n} zonas',
    'organize.areasNone': 'Todavía no hay zonas marcadas.',
    'organize.areasNoneStaff': 'Todavía no hay zonas marcadas. Con «Editar zonas» marcas estanterías, armarios, etc. en la foto.',
    'organize.areasTap': 'Toca una zona para abrirla.',
    'organize.hs.openAria': 'Abrir {name} ({code})',
    'organize.hs.editAria': 'Editar zona «{name}»',
    'organize.hs.newTitle': 'Nueva zona',
    'organize.hs.editTitle': 'Editar zona',
    'organize.hs.shapePoint': 'Punto en la foto',
    'organize.hs.shapeRect': 'Rectángulo en la foto',
    'organize.hs.existing': 'Elegir una sububicación existente',
    'organize.hs.new': 'Crear una sububicación nueva',
    'organize.hs.noSubs': 'Todavía no hay sububicaciones: crea aquí una nueva.',
    'organize.hs.location': 'Ubicación',
    'organize.hs.label': 'Rótulo en la foto',
    'organize.hs.labelHint': 'Vacío = nombre de la ubicación.',
    'organize.hs.saved': 'Zona guardada',
    'organize.hs.deleted': 'Zona eliminada',
    'organize.hs.deleteQ': '¿Eliminar la zona?',
    'organize.hs.deleteMsg': 'La zona «{name}» se quita de la foto. La ubicación en sí se mantiene.',
    'organize.hs.open': 'Abrir ubicación',
    'organize.f.shortSuggest': 'Sugerencia según el tipo: {code}',
    'organize.cover.hint': 'La foto general muestra toda la ubicación. En ella marcas las zonas.',
    'organize.cover.remove': 'Quitar foto general',
    'organize.cover.saved': 'Foto general guardada',
    'organize.cover.removed': 'Foto general quitada',
    'organize.cover.current': 'Actual',
    'organize.cover.more': 'Importar más fotos',
    'organize.cover.noPhotos': 'Todavía no hay fotos importadas en esta ubicación.',
    'organize.cover.pick': 'Elegir {name} como foto general',
    'organize.tabs': 'Secciones de esta ubicación',
    'organize.tab.subs': 'Sububicaciones', 'organize.tab.content': 'Contenido', 'organize.tab.photos': 'Fotos', 'organize.tab.plan': 'Plan',
    'organize.view.label': 'Vista',
    'organize.view.cards': 'Tarjetas', 'organize.view.list': 'Lista', 'organize.view.tree': 'Árbol',
    'organize.subs.none': 'Todavía no hay sububicaciones. Crea estanterías, armarios o zonas, o márcalas directamente en la foto general.',
    'organize.subs.noneRead': 'Todavía no hay sububicaciones.',
    'organize.subs.quickAdd': 'Crear sububicación',
    'organize.subs.added': 'Sububicación «{name}» creada',
    'organize.subs.shortCodes': 'Asignar códigos cortos',
    'organize.noShort': 'sin código corto',
    'organize.content.none': 'Todavía no hay nada registrado en esta ubicación.',
    'organize.content.filter': 'Filtrar contenido',
    'organize.content.filterPh': 'Nombre, código, marca, categoría…',
    'organize.content.noMatch': 'No se ha encontrado nada.',
    'organize.content.machines': 'Máquinas y equipos',
    'organize.content.articles': 'Artículos',
    'organize.content.low': 'Poco',
    'organize.content.here': 'directamente aquí',
    'organize.photos.none': 'Todavía no hay fotos importadas.',
    'organize.photos.det': '{n} reconocidos',
    'organize.photos.open': '{n} pendientes',
    'organize.photos.openAria': 'Abrir foto {name}',
    'organize.photos.filter': 'Filtrar fotos por estado',
    'organize.viewer.dets': 'Objetos reconocidos',
    'organize.viewer.noDets': 'No hay objetos registrados en esta foto.',
    'organize.viewer.noPos': 'sin posición en la foto',
    'organize.viewer.tapHint': 'Toca un punto o un objeto de la lista para ver qué se ha reconocido.',
    'organize.viewer.toReview': 'A la revisión',
    'organize.viewer.useCover': 'Usar como foto general',
    'organize.viewer.scene': 'Escena',
    'organize.viewer.findings': 'Observaciones',
    'organize.viewer.qtyUncertain': 'Cantidad incierta',
    'organize.viewer.error': 'El análisis falló: {error}',
    'organize.viewer.dotAria': '{name} – {conf}',
    'organize.viewer.zoom': 'Ver la foto en grande',
    'organize.plan.none': 'Todavía no hay tareas.',
    'organize.plan.noneStaff': 'Todavía no hay tareas. Crea una propuesta de organización a partir de los datos o añade tareas tú mismo.',
    'organize.plan.add': 'Añadir tarea',
    'organize.plan.title': 'Tarea',
    'organize.plan.titlePh': 'p. ej. rotular la estantería B',
    'organize.plan.assign': 'Asignar a',
    'organize.plan.nobody': '– nadie –',
    'organize.plan.propose': 'Crear propuesta de organización',
    'organize.plan.doneAria': '«{title}» hecha',
    'organize.plan.edit': 'Editar tarea',
    'organize.plan.editAria': 'Editar la tarea «{title}»',
    'organize.plan.doneBy': 'hecha por {name}, {date}',
    'organize.plan.assigned': 'asignada a: {name}',
    'organize.plan.doneN': 'Hechas ({n})',
    'organize.plan.droppedN': 'Descartadas ({n})',
    'organize.plan.saved': 'Tarea guardada',
    'organize.plan.added': 'Tarea añadida',
    'organize.plan.in': 'en {path}',
    'organize.plan.details': 'Detalles',
    'organize.plan.status': 'Estado',
    'organize.plan.source': 'Origen: {src}',
    'organize.ki.honest': 'La app no tiene un servicio de IA propio. El reconocimiento lo hace Claude (Anthropic) a partir de las fotos originales en una sesión aparte; el resultado se importa aquí como archivo. Todo queda como propuesta hasta que alguien lo revise y lo confirme.',
    'organize.ki.s1': 'Fotos',
    'organize.ki.s1n': 'Fotos en esta ubicación: {n}',
    'organize.ki.s2': 'Marcar para análisis',
    'organize.ki.s2hint': 'Marcar no inicia ningún análisis. Solo señala las fotos que se deben analizar en la sesión de Claude.',
    'organize.ki.cNew': 'nuevas', 'organize.ki.cQueued': 'marcadas', 'organize.ki.cDone': 'analizadas', 'organize.ki.cFailed': 'fallidas',
    'organize.ki.queueNew': 'Marcar todas las fotos nuevas ({n})',
    'organize.ki.requeue': 'Volver a marcar las fallidas ({n})',
    'organize.ki.queued': 'Marcadas para análisis: {n}',
    'organize.ki.s3': 'Importar el resultado de la IA',
    'organize.ki.s3hint': 'Importar el archivo de resultado de la sesión de Claude (lgr-photo-analysis). Las fotos se asignan por su suma SHA-256.',
    'organize.ki.s4': 'Revisar reconocimientos',
    'organize.ki.s4n': '{open} por revisar · {total} reconocidos',
    'organize.ki.s4btn': 'Revisar reconocimientos ({n})',
    'organize.ki.s5': 'Plan de organización',
    'organize.ki.s5n': '{open} tareas abiertas · {done} hechas',
    'organize.ki.s6': 'Etiquetas para ubicaciones',
    'organize.ki.s6n': 'Ubicaciones (esta y todas las sububicaciones): {n}',
    'organize.ki.s6btn': 'Imprimir etiquetas',
    'organize.ki.s7': 'Cerrar',
    'organize.ki.s7open': 'Pendiente – reconocimientos: {det}, tareas: {tasks}.',
    'organize.ki.s7ready': 'Ya no queda nada pendiente.',
    'organize.ki.s7btn': 'Cerrar como organizado',
    'organize.ki.reopen': 'Volver a abrir',
    'organize.ki.closed': 'Cerrado como organizado',
    'organize.ki.reopened': 'Abierto de nuevo',
    'organize.ki.readOnly': 'Los pasos los pueden ejecutar los responsables del almacén y los administradores.',
    'organize.ki.done': 'hecho',
    'organize.prop.title': 'Propuesta de organización',
    'organize.prop.intro': 'Esta propuesta se deriva de los datos de esta ubicación (reconocimientos, inventario, sububicaciones): nada es inventado. Elige qué debe entrar en el plan.',
    'organize.prop.none': 'Los datos actuales no generan ninguna propuesta nueva: todo lo derivado ya está en el plan.',
    'organize.prop.area': 'Definir y rotular una zona para {cat} ({n} objetos: {names})',
    'organize.prop.areaWhy': '{n} objetos reconocidos o inventariados pertenecen a la categoría «{cat}».',
    'organize.prop.newLoc': 'Crear la ubicación «{name}» y asignar código corto',
    'organize.prop.newLocWhy': 'Reconocida en una foto como ubicación/mobiliario, pero todavía no creada.',
    'organize.prop.review1': 'Revisar 1 objeto reconocido', 'organize.prop.reviewN': 'Revisar {n} objetos reconocidos',
    'organize.prop.reviewWhy': 'Los reconocimientos son propuestas y solo se convierten en inventario después de la revisión.',
    'organize.prop.count': 'Contar cantidades: {names}',
    'organize.prop.countWhy': 'En estos materiales con stock la cantidad reconocida es incierta.',
    'organize.prop.codes': 'Asignar códigos cortos e imprimir etiquetas QR',
    'organize.prop.codesWhy': 'Sin código corto: {names}',
    'organize.prop.covers': 'Hacer fotos generales: {names}',
    'organize.prop.coversWhy': 'Estas sububicaciones todavía no tienen foto general.',
    'organize.prop.confirm': 'Confirmar la organización',
    'organize.prop.confirmWhy': 'Al final, comprobar que todo está en su sitio y rotulado, y cerrar la ubicación.',
    'organize.prop.add': 'Pasar al plan',
    'organize.prop.added': 'Pasadas al plan: {n}',
    'organize.prop.nothingChecked': 'Elige al menos un punto.',
    'organize.imp.photoRecs': 'Recomendaciones del análisis de fotos',
    'organize.imp.photoNone': 'El análisis de fotos no contiene recomendaciones para esta ubicación.',
    'organize.imp.finding': 'Observación: {text}',
    'organize.imp.onPhotos': 'en {n} fotos',
    'organize.imp.adopt': 'Crear tarea',
    'organize.imp.adopted': 'Tarea creada',
    'organize.imp.inPlan': 'Ya está en el plan',
    'organize.imp.source': 'Origen: {src}',
    'organize.imp.dataChecks': 'Comprobaciones de los datos',
    'organize.imp.dataNone': 'No se han encontrado anomalías en los datos de esta ubicación.',
    'organize.imp.open': 'Reconocimientos sin revisar: {n}',
    'organize.imp.openWhy': 'Los reconocimientos siguen siendo propuestas hasta que alguien los revisa; antes no son inventario.',
    'organize.imp.unknown': 'Objetos sin identificar: {n}',
    'organize.imp.unknownWhy': 'El análisis de fotos no pudo decir con seguridad qué es: {names}',
    'organize.imp.qty': 'Materiales con stock con cantidad incierta: {n}',
    'organize.imp.qtyWhy': 'La cantidad en la foto no es segura; contar antes de confirmar: {names}',
    'organize.imp.dupDet': 'Objetos en varias fotos: {n}',
    'organize.imp.dupDetWhy': 'El mismo objeto en varias fotos: fusionarlo al revisar para que no entre dos veces en el inventario: {names}',
    'organize.imp.dupInv': 'Posibles duplicados en el inventario ({n})',
    'organize.imp.dupInvWhy': 'La misma marca y el mismo modelo registrados varias veces: comprobar si de verdad son varias unidades.',
    'organize.imp.noCat': 'Objetos sin categoría: {n}',
    'organize.imp.noCatWhy': 'Sin categoría cuesta encontrarlos y agruparlos.',
    'organize.imp.direct': 'Guardados directamente en «{name}»: {n}',
    'organize.imp.directWhy': 'Hay sububicaciones: guardarlos con más precisión (estantería, compartimento, caja) para encontrarlos antes.',
    'organize.imp.noShort': 'Sububicaciones sin código corto: {n}',
    'organize.imp.noShortWhy': 'Sin código corto falta el código legible (p. ej. HL-RG01) en las etiquetas: {names}',
    'organize.imp.failed': 'Análisis de fotos fallidos: {n}',
    'organize.imp.failedWhy': 'Estas fotos no se han evaluado: {names}',
    'organize.imp.low': 'Artículos por debajo del stock mínimo: {n}',
    'organize.imp.lowWhy': 'El stock es igual o inferior al mínimo.',
    'organize.imp.review': 'Revisar',
    'organize.imp.requeue': 'Volver a marcar',
    'organize.imp.more': '+{n} más',
    'organize.codes.hint': 'Único por nivel, A–Z y 0–9, máx. 10 caracteres. Sugerencias según el tipo (estantería RG01, compartimento FA01 …). Los campos vacíos quedan sin código corto.',
    'organize.codes.none': 'Todas las sububicaciones tienen código corto.',
    'organize.codes.saved': 'Códigos cortos guardados: {n}',
    'organize.codes.invalid': 'Código corto no válido: {code}',
    'organize.codes.dup': 'El código corto {code} aparece dos veces en el mismo nivel.',
    'organize.labelsNone': 'Aquí no hay ubicaciones para etiquetas.',
    'organize.sel.start': 'Seleccionar fotos',
    'organize.sel.done': 'Listo',
    'organize.sel.count': 'Seleccionadas: {n}',
    'organize.sel.all': 'Seleccionar todas',
    'organize.sel.clear': 'Quitar selección',
    'organize.sel.move': 'Mover a …',
    'organize.sel.pickAria': 'Seleccionar foto {name}',
    'organize.sel.hint': 'Toca las fotos para seleccionarlas.',
    'organize.move.title': 'Mover fotos',
    'organize.move.intro': 'Fotos: {n}. Elige la ubicación a la que pertenecen. Los reconocimientos de las fotos se mueven con ellas; el inventario ya confirmado mantiene su ubicación.',
    'organize.move.filter': 'Buscar ubicación',
    'organize.move.filterPh': 'Nombre, código o ruta…',
    'organize.move.current': 'actual',
    'organize.move.pick': 'Elige una ubicación de destino.',
    'organize.move.go': 'Mover',
    'organize.move.progress': 'Movidas: {done} de {n} …',
    'organize.move.doneAll': 'Movidas a «{name}»: {n}',
    'organize.move.skipped': 'Ya estaban allí: {n}',
    'organize.move.report': 'Informe: mover fotos',
    'organize.move.reportText': 'Movidas: {ok} · no movidas: {failed}',
    'organize.move.noMatch': 'No se ha encontrado ninguna ubicación.',
    'organize.viewer.move': 'Mover a otra ubicación',
    'organize.viewer.delete': 'Eliminar foto',
    'organize.del.q': '¿Eliminar la foto?',
    'organize.del.msg': '«{name}» se eliminará definitivamente, junto con sus reconocimientos (propuestas) y zonas. No se puede deshacer.',
    'organize.del.done': 'Foto eliminada',
    'organize.del.inUseTitle': 'La foto se conserva',
    'organize.del.inUse': 'Esta foto tiene objetos confirmados y se conserva como prueba de origen. Si está mal asignada, muévela a la ubicación correcta.',
    'organize.fp.title': 'Plano del edificio',
    'organize.fp.sub': 'Plano de cada planta con los espacios. Toca un espacio para abrirlo.',
    'organize.fp.cardN': 'Planos: {n} · espacios vinculados: {linked} de {areas}',
    'organize.fp.cardNone': 'Todavía no hay plano. Sube un plano y marca en él los espacios.',
    'organize.fp.none': 'Todavía no hay plano del edificio. Sube un plano (imagen) por planta y marca en él los espacios.',
    'organize.fp.noneRead': 'Todavía no hay plano del edificio. Los responsables del almacén pueden subir planos.',
    'organize.fp.add': 'Añadir plano',
    'organize.fp.file': 'Imagen del plano',
    'organize.fp.fileHint': 'Plano como imagen (PNG o JPG). No se reduce, para que los rótulos se lean bien.',
    'organize.fp.name': 'Nombre (planta)',
    'organize.fp.namePh': 'p. ej. PB, Sótano, 1.ª planta',
    'organize.fp.sort': 'Orden',
    'organize.fp.sortHint': 'Número menor = más adelante.',
    'organize.fp.notes': 'Observaciones',
    'organize.fp.fileRequired': 'Elige una imagen del plano.',
    'organize.fp.added': 'Plano «{name}» añadido',
    'organize.fp.edit': 'Renombrar / ordenar',
    'organize.fp.saved': 'Plano guardado',
    'organize.fp.delete': 'Eliminar plano',
    'organize.fp.deleteQ': '¿Eliminar el plano?',
    'organize.fp.deleteMsg': 'El plano «{name}» se eliminará con su imagen y todas las zonas marcadas. Los espacios en sí se mantienen.',
    'organize.fp.deleted': 'Plano eliminado',
    'organize.fp.editRooms': 'Editar espacios',
    'organize.fp.editHint': 'Arrastra un rectángulo sobre un espacio (toque corto = punto). Arrastrar una zona = mover, arrastrar las esquinas = cambiar el tamaño, tocar = editar o eliminar.',
    'organize.fp.tabs': 'Plantas',
    'organize.fp.planAlt': 'Plano {name}',
    'organize.fp.legend': 'Leyenda',
    'organize.fp.lgLinked': 'Espacio creado (color = estado)',
    'organize.fp.lgUnlinked': 'Solo rotulado – espacio todavía no creado',
    'organize.fp.rooms': 'Espacios en este plano',
    'organize.fp.roomsNone': 'Todavía no hay espacios marcados en este plano.',
    'organize.fp.roomsNoneStaff': 'Todavía no hay espacios marcados en este plano. Con «Editar espacios» arrastras rectángulos sobre los espacios.',
    'organize.fp.notCreated': 'todavía no creado',
    'organize.fp.createLink': 'Crear espacio y vincular',
    'organize.fp.createIntro': 'Crea un espacio nuevo (ubicación de nivel superior) y lo vincula con la zona «{label}» del plano.',
    'organize.fp.created': 'Espacio «{name}» creado y vinculado',
    'organize.fp.linked': 'Vinculado con «{name}»',
    'organize.fp.area': 'Espacio en el plano',
    'organize.fp.newArea': 'Nuevo espacio en el plano',
    'organize.fp.mode.label': 'Solo rotular (espacio todavía no creado)',
    'organize.fp.mode.existing': 'Vincular con un espacio existente',
    'organize.fp.mode.new': 'Crear un espacio nuevo',
    'organize.fp.label': 'Rótulo',
    'organize.fp.labelHint': 'Nombre en el plano, p. ej. «Trastero 3». En espacios vinculados, vacío = nombre del espacio.',
    'organize.fp.labelRequired': 'Introduce un rótulo.',
    'organize.fp.space': 'Espacio',
    'organize.fp.noSpaces': 'Todavía no hay espacios.',
    'organize.fp.areaSaved': 'Zona guardada',
    'organize.fp.areaDeleted': 'Zona eliminada',
    'organize.fp.areaDeleteMsg': 'La zona «{name}» se quita del plano. Un espacio vinculado se mantiene.',
    'organize.fp.openAria': 'Abrir {name} – {status}',
    'organize.fp.itemAria': 'Abrir {name} – {code}',
    'organize.fp.items': 'Muebles: {n}',
    'organize.fp.zoom': 'Zoom',
    'organize.fp.zoomIn': 'Ampliar el plano',
    'organize.fp.zoomOut': 'Reducir el plano',
    'organize.fp.zoomFit': 'Plano completo',
    'organize.fp.mode.existingLoc': 'Vincular con una ubicación existente',
    'organize.fp.locField': 'Espacio o mueble',
    'organize.fp.unlinkedAria': '{name} – todavía no creado',
    'organize.fp.linkedLabel': 'vinculado',
    'organize.fp.onPlan': 'En el plano',
    'organize.fp.onPlanAria': 'Mostrar en el plano «{name}»',
    'organize.fp.shapeRect': 'Rectángulo en el plano',
    'organize.fp.shapePoint': 'Punto en el plano',
    'organize.open': 'Abrir',
  },
});

// ---------------------------------------------------------------------------
// Konstanten und kleine Hilfen
// ---------------------------------------------------------------------------
const enc = encodeURIComponent;
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const norm = (s) => clean(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const plural = (base, n, vars = {}) => t(n === 1 ? base + '1' : base + 'N', { ...vars, n: fmtNum(n) });
const clamp01 = (v) => Math.max(0, Math.min(1, Number(v) || 0));
const pct = (v) => (clamp01(v) * 100).toFixed(3) + '%';
const clip = (s, n) => { const x = clean(s); return x.length > n ? x.slice(0, n - 1) + '…' : x; };
const isOpenDet = (d) => d && (d.status === 'offen' || d.status === 'spaeter');
const topCat = (path) => clean(String(path || '').split(/\s*[›>]\s*/)[0]);
function collator() {
  const c = new Intl.Collator(locale(), { numeric: true, sensitivity: 'base' });
  return (a, b) => c.compare(String(a ?? ''), String(b ?? ''));
}
/** «a, b, c …» – nur echte Namen, ohne Wiederholungen */
function nameList(names, max = 3) {
  const u = [...new Set((names || []).map(clean).filter(Boolean))];
  return u.slice(0, max).join(', ') + (u.length > max ? ' …' : '');
}
// Vorschlag für den Typ eines neuen Unterorts
const NEXT_TYPE = {
  lager: 'regal', raum: 'regal', bereich: 'regal', regal: 'tablar', schrank: 'tablar', tablar: 'box', fach: 'box',
  schublade: 'box', box: 'box', behaelter: 'box', werkzeugwand: 'halterung', halterung: 'halterung',
  arbeitsplatz: 'schublade', fahrzeug: 'box', container: 'regal', temporaer: 'box',
};
const TYPE_ICON = { lager: 'home', raum: 'location', bereich: 'grid', regal: 'list', schrank: 'layers', fahrzeug: 'move', temporaer: 'clock', werkzeugwand: 'wrench' };
const typeIcon = (ty) => icon(TYPE_ICON[ty] || 'box');
const TABS = ['unterorte', 'inhalt', 'fotos', 'plan'];
const TAB_KEYS = { unterorte: 'organize.tab.subs', inhalt: 'organize.tab.content', fotos: 'organize.tab.photos', plan: 'organize.tab.plan' };
const SUBVIEW_KEY = 'lgr-org-subview';
const IMPORT_HREF = (code) => '#/organisieren/import' + (code ? '?ort=' + enc(code) : '');
// Ein zweites «#» im Hash würde nicht geroutet – die Import-Seite springt mit ?teil=analyse zum Abschnitt «KI-Ergebnis»
const IMPORT_ANALYSIS_HREF = (code) => '#/organisieren/import?' + (code ? 'ort=' + enc(code) + '&' : '') + 'teil=analyse';
const REVIEW_HREF = (rootCode) => '#/organisieren/pruefen' + (rootCode ? '?raum=' + enc(rootCode) : '');

// Zustand, der ein Neuladen der Seite überdauert (z. B. «Bereiche bearbeiten» bleibt aktiv)
const ui = { editingFor: null };
function getSubView() {
  try { const v = localStorage.getItem(SUBVIEW_KEY); return ['cards', 'list', 'tree'].includes(v) ? v : 'cards'; } catch (e) { return 'cards'; }
}
function setSubView(v) { try { localStorage.setItem(SUBVIEW_KEY, v); } catch (e) { /* ohne Speicher */ } }

function qget(ctx, key) {
  const q = ctx.query;
  if (q && typeof q.get === 'function') return q.get(key);
  return q && q[key] !== undefined ? q[key] : null;
}
function routeCode(ctx) {
  let c = (ctx.params && ctx.params.code) || '';
  try { c = decodeURIComponent(c); } catch (e) { /* bereits dekodiert */ }
  return clean(c).toUpperCase();
}
const loadingHtml = () => `<div class="page"><p class="muted" role="status">${esc(t('common.loading'))}</p></div>`;
function showError(ctx, err) {
  toast(errorText(err), 'error');
  ctx.el.innerHTML = `<div class="page">${emptyHtml(errorText(err),
    `<button type="button" class="btn" data-retry>${icon('history')}${esc(t('btn.retry'))}</button>`)}</div>`;
  const b = ctx.el.querySelector('[data-retry]');
  if (b) b.addEventListener('click', () => ctx.reload());
}
function profileOptions(profiles, selected) {
  const rows = (profiles || []).filter((p) => p.active || p.id === selected);
  return `<option value="">${esc(t('organize.plan.nobody'))}</option>` + rows.map((p) =>
    `<option value="${esc(p.id)}"${p.id === selected ? ' selected' : ''}>${esc(p.full_name || p.email || '–')}</option>`).join('');
}
function typeOptions(selected) {
  return LOCATION_TYPES.map((ty) => `<option value="${ty}"${ty === selected ? ' selected' : ''}>${esc(locTypeLabel(ty))}</option>`).join('');
}
/** Fehlermeldung in einem Dialog anzeigen und Dialog offen lassen */
function sheetError(el, msg) {
  const b = el.querySelector('.sheet-error');
  if (b) { b.textContent = msg; b.hidden = false; }
  return false;
}
/** Klick auf einen internen Link im Dialog schliesst den Dialog (die Seite wechselt ohnehin) */
function closeOnNav(el, close) {
  el.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#/"]');
    if (a) close(undefined);
  });
}
async function printLocationLabels(rows) {
  const items = (rows || []).filter(Boolean).map((r) => labels.labelItem('location', r)).filter(Boolean);
  if (!items.length) { toast(t('organize.labelsNone'), 'info'); return; }
  try { await labels.openLabelDialog(items); } catch (err) { toast(errorText(err), 'error'); }
}
function progressHtml(pr, done, total, organized) {
  const p = Math.max(0, Math.min(100, Math.round(num(pr))));
  const txt = total ? t('organize.progressOf', { a: fmtNum(done), b: fmtNum(total) })
    : t(organized ? 'organize.progressOrganized' : 'organize.progressNone');
  return `<div class="org-progress-wrap">
    <div class="org-progress${p >= 100 ? ' full' : ''}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${p}"
      aria-label="${esc(t('organize.progressLabel'))}" aria-valuetext="${esc(p + ' % – ' + txt)}"><span style="width:${p}%"></span></div>
    <div class="org-progress-text small"><b>${p} %</b> <span class="muted">${esc(txt)}</span></div>
  </div>`;
}

// ---------------------------------------------------------------------------
// Zentrale ('organisieren')
// ---------------------------------------------------------------------------
async function hubView(ctx) {
  const { api, user } = ctx;
  const staff = can(user, 'staff');
  ctx.setTitle(t('organize.title'));
  ctx.el.innerHTML = loadingHtml();
  let stats, spaces, plans, sites;
  try {
    [stats, spaces, plans, sites] = await Promise.all([api.orgStats(), api.listSpaces(),
      // Gebäudeplan ist nicht kritisch: ohne Pläne-Methode (oder bei Fehler) bleibt die Karte weg
      typeof api.listFloorPlans === 'function' ? api.listFloorPlans().catch(() => null) : null,
      typeof api.listSites === 'function' ? api.listSites().catch(() => []) : []]);
  } catch (err) { showError(ctx, err); return; }
  stats = stats || {};
  spaces = spaces || [];
  sites = sites || [];
  // Standorte (Adressen): Räume gruppieren; Filter über ?site=<id> bzw. ?site=none
  const siteById = new Map(sites.map((x) => [x.id, x]));
  const groupOf = (sp) => (sp.site_id && siteById.has(sp.site_id) ? sp.site_id : 'none');
  const siteQ = qget(ctx, 'site');
  const curSite = siteQ === 'none' || siteById.has(siteQ) ? siteQ : null;
  const shown = curSite ? spaces.filter((sp) => groupOf(sp) === curSite) : spaces;
  const S = (k) => num(stats[k]);
  const openDet = S('detections_open');

  const tiles = [
    { n: S('photos_analyzed'), label: t('organize.stat.photosOf', { b: fmtNum(S('photos_total')) }),
      sub: S('photos_failed') ? t('organize.stat.failed', { n: fmtNum(S('photos_failed')) }) : '',
      href: staff ? '#/organisieren/import' : '', cls: S('photos_failed') ? 'warn' : '' },
    { n: S('detections_total'), label: t('organize.stat.detected'), href: '#/organisieren/pruefen' },
    { n: S('detections_identified'), label: t('organize.stat.identified'), href: '#/organisieren/pruefen' },
    { n: S('detections_confirmed'), label: t('organize.stat.confirmed'), href: '#/organisieren/pruefen', cls: S('detections_confirmed') ? 'ok' : '' },
    { n: S('detections_unknown'), label: t('organize.stat.unknown'), href: '#/organisieren/pruefen', cls: S('detections_unknown') ? 'danger' : '' },
    { n: S('items_without_location'), label: t('organize.stat.noLocation'), act: 'noloc', cls: S('items_without_location') ? 'warn' : '' },
    { n: S('locations_total'), label: t('organize.stat.locations'), href: '#/lagerorte' },
    { n: S('locations_proposed'), label: t('organize.stat.proposed'), href: '#/organisieren/pruefen', cls: S('locations_proposed') ? 'info' : '' },
    { n: S('duplicate_groups'), label: t('organize.stat.duplicates'), href: '#/organisieren/pruefen', cls: S('duplicate_groups') ? 'warn' : '' },
    { n: S('tasks_open'), label: t('organize.stat.tasks'), act: 'tasks', cls: S('tasks_open') ? 'info' : '' },
    { n: S('spaces_organized'), label: t('organize.stat.spacesOf', { b: fmtNum(S('spaces_total')) }), cls: S('spaces_organized') ? 'ok' : '' },
  ];
  const tileHtml = (x) => {
    const inner = `<span class="stat-num">${esc(fmtNum(x.n))}</span><span class="stat-label">${esc(x.label)}</span>${x.sub ? `<span class="stat-sub small">${esc(x.sub)}</span>` : ''}`;
    if (x.href) return `<a class="stat ${x.cls || ''}" href="${esc(x.href)}">${inner}</a>`;
    if (x.act) return `<button type="button" class="stat org-stat-btn ${x.cls || ''}" data-tile="${x.act}">${inner}</button>`;
    return `<div class="stat ${x.cls || ''}">${inner}</div>`;
  };

  const spaceCard = (s) => {
    const items = num(s.articles) + num(s.machines);
    const done = num(s.detections_done) + num(s.tasks_done);
    const open = num(s.detections_open) + num(s.tasks_open);
    const short = s.code_path || s.short_code;
    const media = s.photo_path
      ? thumbHtml(s.photo_path, t('organize.photoAlt', { name: s.name }), 'org-space-img', 'location')
      : `<div class="org-space-img org-noimg" aria-hidden="true">${icon('image')}<span class="small">${esc(t('organize.noPhoto'))}</span></div>`;
    return `<article class="org-space">
      <div class="org-space-media">${media}<span class="org-space-status">${orgStatusPill(s.org_status)}</span></div>
      <div class="org-space-body">
        <h3><a class="org-space-link" href="#/o/${enc(s.code)}">${esc(s.name)}</a></h3>
        <div class="org-codes small">${short ? `<span class="mono org-code" title="${esc(t('organize.readableCode'))}">${esc(short)}</span>` : ''}
          <span class="mono muted" title="${esc(t('organize.internalCode'))}">${esc(s.code)}</span></div>
        <div class="small muted">${esc(plural('organize.items', items))} · ${esc(plural('organize.subs', num(s.sublocations)))}</div>
        ${progressHtml(s.progress, done, done + open, !!s.organized_at)}
        <div class="org-space-foot">
          <span class="small ${open ? 'org-open' : 'muted'}">${open ? icon('alert') : ''}${esc(open ? plural('organize.open', open) : t('organize.noOpen'))}</span>
          <a class="btn sm org-space-inv" href="#/o/${enc(s.code)}?tab=inhalt" aria-label="${esc(t('organize.inventoryAria', { name: s.name }))}">${icon('list')}${esc(t('organize.inventory'))}</a>
        </div>
      </div>
    </article>`;
  };

  const howto = [1, 2, 3, 4, 5, 6].map((i) =>
    `<li><b>${esc(t('organize.howto.t' + i))}</b> – ${esc(t('organize.howto.d' + i))}</li>`).join('');

  // Karte «Gebäudeplan» (vor den Raumkarten); für Mitarbeiter nur, wenn es Pläne gibt
  let planCard = '';
  // Mit Adress-Filter nur die Pläne dieser Adresse
  if (Array.isArray(plans) && curSite) plans = plans.filter((p) => (p.site_id && siteById.has(p.site_id) ? p.site_id : 'none') === curSite);
  if (Array.isArray(plans) && (plans.length || (staff && !curSite))) {
    const areas = plans.reduce((s, p) => s + num(p.area_count), 0);
    const linked = plans.reduce((s, p) => s + num(p.linked_count), 0);
    planCard = `<article class="org-space org-fp-card">
      <div class="org-space-media">${plans.length && plans[0].photo_path
        ? thumbHtml(plans[0].photo_path, t('organize.fp.planAlt', { name: plans[0].name }), 'org-space-img org-fp-thumb', 'layers')
        : `<div class="org-space-img org-noimg" aria-hidden="true">${icon('layers')}</div>`}</div>
      <div class="org-space-body">
        <h3><a class="org-space-link" href="#/organisieren/plan${plans.length && curSite ? '?plan=' + enc(plans[0].id) : ''}">${icon('layers')} ${esc(t('organize.fp.title'))}</a></h3>
        <div class="small muted">${esc(plans.length ? t('organize.fp.cardN', { n: fmtNum(plans.length), linked: fmtNum(linked), areas: fmtNum(areas) }) : t('organize.fp.cardNone'))}</div>
        ${plans.length ? `<div class="row">${plans.map((p) => `<span class="pill pill-muted">${esc(p.name)}</span>`).join('')}</div>` : ''}
      </div>
    </article>`;
  }

  const countIn = (g) => spaces.filter((sp) => groupOf(sp) === g).length;
  const noneN = countIn('none');
  const chip = (href, label, on) => `<a class="btn sm${on ? ' primary' : ''}" href="${esc(href)}"${on ? ' aria-current="page"' : ''}>${esc(label)}</a>`;
  const siteNav = sites.length ? `<nav class="row org-site-nav" aria-label="${esc(t('site.manage'))}">
      ${chip('#/organisieren', `${t('site.all')} (${fmtNum(spaces.length)})`, !curSite)}
      ${sites.map((x) => chip('#/organisieren?site=' + enc(x.id), `${x.name} (${fmtNum(countIn(x.id))})`, curSite === x.id)).join('')}
      ${noneN ? chip('#/organisieren?site=none', `${t('site.noneGroup')} (${fmtNum(noneN)})`, curSite === 'none') : ''}
    </nav>` : '';
  const groupHead = (g) => {
    const x = siteById.get(g);
    return `<h3 class="org-site-h">${icon('pin')}<span>${esc(x ? x.name : t('site.noneGroup'))}</span>${x && x.address && x.address !== x.name ? `<small class="muted">${esc(x.address)}</small>` : ''}</h3>`;
  };
  let cardsHtml;
  if (!sites.length) cardsHtml = planCard || shown.length ? `<div class="org-spaces">${planCard}${shown.map(spaceCard).join('')}</div>` : '';
  else {
    const order = curSite ? [curSite] : [...sites.map((x) => x.id), 'none'];
    cardsHtml = (planCard ? `<div class="org-spaces">${planCard}</div>` : '') + order.map((g) => {
      const list = shown.filter((sp) => groupOf(sp) === g);
      return list.length ? `<div class="org-site-group">${groupHead(g)}<div class="org-spaces">${list.map(spaceCard).join('')}</div></div>` : '';
    }).join('');
  }

  ctx.el.innerHTML = `<div class="page org">
    <div class="page-head">
      <div><h1>${esc(t('organize.title'))}</h1><div class="sub">${esc(t('organize.sub'))}</div></div>
    </div>
    <div class="org-hub-actions">
      ${staff ? `<a class="btn primary" href="#/organisieren/import">${icon('upload')}${esc(t('organize.importPhotos'))}</a>` : ''}
      <a class="btn${openDet ? ' org-attn' : ''}" href="#/organisieren/pruefen">${icon('sparkle')}${esc(t(staff ? 'organize.reviewN' : 'organize.viewDetN', { n: fmtNum(openDet) }))}</a>
      <form class="searchbar org-search" role="search" data-search>
        ${icon('search')}<input type="search" name="q" aria-label="${esc(t('organize.searchLabel'))}" placeholder="${esc(t('organize.searchPh'))}" enterkeyhint="search" autocomplete="off">
      </form>
    </div>
    <details class="card org-howto">
      <summary>${icon('alert')}<span>${esc(t('organize.howto.title'))}</span></summary>
      <ol>${howto}</ol>
    </details>
    <section class="section" aria-labelledby="org-fig-h">
      <h2 id="org-fig-h">${esc(t('organize.figures'))}</h2>
      <div class="stats org-stats">${tiles.map(tileHtml).join('')}</div>
    </section>
    <section class="section" aria-labelledby="org-sp-h">
      <div class="section-head"><h2 id="org-sp-h">${esc(t('organize.spaces'))} (${fmtNum(shown.length)})</h2>
        <div class="row">
          ${staff || sites.length ? `<button type="button" class="btn sm" data-sites>${icon('pin')}${esc(t('site.manage'))}</button>` : ''}
          ${staff ? `<button type="button" class="btn sm" data-add-space>${icon('plus')}${esc(t('organize.addSpace'))}</button>` : ''}
        </div></div>
      ${siteNav}
      ${cardsHtml}
      ${curSite && !shown.length && spaces.length ? emptyHtml(t('site.noRooms'), staff
          ? `<button type="button" class="btn primary" data-add-space>${icon('plus')}${esc(t('organize.addSpace'))}</button>` : '') : ''}
      ${spaces.length ? '' : emptyHtml(t(staff ? 'organize.noSpaces' : 'organize.noSpacesRead'), staff
          ? `<button type="button" class="btn primary" data-add-space>${icon('plus')}${esc(t('organize.addSpace'))}</button>` : '')}
    </section>
  </div>`;
  const root = ctx.el.firstElementChild;
  hydrateThumbs(root, api);

  root.querySelector('[data-search]').addEventListener('submit', (e) => {
    e.preventDefault();
    const q = clean(e.target.elements.q.value);
    ctx.go('suche' + (q ? '?q=' + enc(q) : ''));
  });
  root.querySelectorAll('[data-add-space]').forEach((b) => b.addEventListener('click', () => addSpaceSheet(ctx, spaces, sites, curSite)));
  const sb = root.querySelector('[data-sites]');
  if (sb) sb.addEventListener('click', () => sitesSheet(ctx, sites, staff, can(user, 'admin')));
  root.querySelectorAll('[data-tile]').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.tile === 'tasks') openTasksSheet(ctx, spaces);
    else if (b.dataset.tile === 'noloc') noLocationSheet(ctx);
  }));
}

async function openTasksSheet(ctx, spaces) {
  let tasks;
  try { tasks = await ctx.api.listTasks({ status: 'offen' }); } catch (err) { toast(errorText(err), 'error'); return; }
  tasks = (tasks || []).filter((x) => x.status === 'offen');
  const byId = new Map(spaces.map((s) => [s.id, s]));
  const groups = new Map();
  for (const x of tasks) {
    const k = x.root_id || x.location_id;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(x);
  }
  const body = !tasks.length ? `<p class="muted">${esc(t('organize.tasksNone'))}</p>` : [...groups].map(([rid, list]) => {
    const sp = byId.get(rid);
    const head = sp ? `<div class="group-label"><a href="#/o/${enc(sp.code)}?tab=plan">${esc(sp.name)}</a></div>` : '';
    const tag = sp ? 'a' : 'div';
    return head + list.map((x) => `<${tag} class="list-item"${sp ? ` href="#/o/${enc(sp.code)}?tab=plan"` : ''}>
        <div class="li-main"><span class="li-title org-wrap">${esc(x.title)}</span>
          <span class="li-sub">${esc([x.location_path, sourceLabel(x.source), x.assigned_name ? t('organize.plan.assigned', { name: x.assigned_name }) : ''].filter(Boolean).join(' · '))}</span></div>
      </${tag}>`).join('');
  }).join('');
  await sheet({
    title: `${t('organize.stat.tasks')} (${fmtNum(tasks.length)})`,
    body: tasks.length ? `<div class="list">${body}</div>` : body,
    onOpen: (el, close) => closeOnNav(el, close),
  });
}

async function noLocationSheet(ctx) {
  let arts, machs;
  try { [arts, machs] = await Promise.all([ctx.api.listArticles({}), ctx.api.listMachines({})]); } catch (err) { toast(errorText(err), 'error'); return; }
  const rows = [
    ...(machs || []).filter((m) => !m.home_location_id && !m.archived).map((m) => ({ href: '#/m/' + enc(m.code), name: m.name, code: m.code, path: m.photo_path, ic: 'machine' })),
    ...(arts || []).filter((a) => !a.location_id && !a.archived).map((a) => ({ href: '#/a/' + enc(a.code), name: a.name, code: a.code, path: a.photo_path, ic: 'box' })),
  ].sort((a, b) => collator()(a.name, b.name));
  await sheet({
    title: `${t('organize.noLocTitle')} (${fmtNum(rows.length)})`,
    body: rows.length ? `<div class="list">${rows.map((r) => `<a class="list-item" href="${r.href}">${thumbHtml(r.path, '', 'thumb', r.ic)}
      <div class="li-main"><span class="li-title">${esc(r.name)}</span><span class="li-sub mono">${esc(r.code)}</span></div></a>`).join('')}</div>`
      : `<p class="muted">${esc(t('organize.noLocNone'))}</p>`,
    onOpen: (el, close) => { closeOnNav(el, close); hydrateThumbs(el, ctx.api); },
  });
}

/** Standorte (Adressen) anzeigen; Lagerverantwortliche legen an und ändern, Admins löschen */
async function sitesSheet(ctx, sites, staff, admin) {
  const row = (x) => `<li><div class="list-item">
      <span class="org-head-ic" aria-hidden="true">${icon('pin')}</span>
      <div class="li-main"><span class="li-title">${esc(x.name)}</span>
        <span class="li-sub">${esc([x.address, t('site.counts', { s: fmtNum(num(x.space_count)), p: fmtNum(num(x.plan_count)) })].filter(Boolean).join(' · '))}</span></div>
      <div class="li-end"><a class="btn sm" href="#/organisieren?site=${enc(x.id)}">${esc(t('organize.spaces'))}</a>
        ${staff ? `<button type="button" class="btn sm" data-edit-site="${esc(x.id)}" aria-label="${esc(t('site.edit') + ': ' + x.name)}">${icon('edit')}</button>` : ''}</div>
    </div></li>`;
  const r = await sheet({
    title: t('site.manage'), wide: true,
    body: `<p class="small">${esc(t('site.intro'))}</p>
      ${sites.length ? `<ul class="list">${sites.map(row).join('')}</ul>` : `<p class="muted">${esc(t('site.none.list'))}</p>`}`,
    actions: staff ? [{ label: t('site.add'), kind: 'primary', icon: 'plus', value: 'add' }] : [],
    onOpen: (el, close) => {
      el.querySelectorAll('[data-edit-site]').forEach((b) => b.addEventListener('click', () => close('edit:' + b.dataset.editSite)));
      el.querySelectorAll('a[href^="#/organisieren"]').forEach((a) => a.addEventListener('click', () => close(null)));
    },
  });
  if (r === 'add') siteEditSheet(ctx, null, admin, sites);
  else if (typeof r === 'string' && r.startsWith('edit:')) siteEditSheet(ctx, sites.find((x) => x.id === r.slice(5)) || null, admin, sites);
}
async function siteEditSheet(ctx, site, admin, sites) {
  const nextSort = sites.reduce((m, x) => Math.max(m, num(x.sort)), 0) + 10;
  const body = `<div class="form">
    <div class="field full"><label for="st-name">${esc(t('site.name'))} <span aria-hidden="true">*</span></label>
      <input id="st-name" type="text" maxlength="80" autocomplete="off" placeholder="${esc(t('site.namePh'))}" value="${esc(site ? site.name : '')}"></div>
    <div class="field full"><label for="st-addr">${esc(t('site.address'))}</label>
      <input id="st-addr" type="text" maxlength="200" autocomplete="street-address" placeholder="${esc(t('site.addressPh'))}" value="${esc(site && site.address ? site.address : '')}"></div>
    <div class="field"><label for="st-sort">${esc(t('site.sort'))}</label>
      <input id="st-sort" type="number" step="1" value="${esc(site ? num(site.sort) : nextSort)}"></div>
    <div class="field full"><label for="st-notes">${esc(t('site.notes'))}</label><textarea id="st-notes" maxlength="2000">${esc(site && site.notes ? site.notes : '')}</textarea></div>
  </div>`;
  const actions = [];
  if (site && admin) actions.push({ label: t('btn.delete'), kind: 'danger', icon: 'trash', value: 'delete' });
  actions.push({ label: t('btn.save'), kind: 'primary', icon: 'check', onClick: async (el) => {
    const name = clean(el.querySelector('#st-name').value);
    if (!name) { el.querySelector('#st-name').focus(); return sheetError(el, t('err.name_required')); }
    await ctx.api.saveSite({ ...(site ? { id: site.id } : {}), name, address: clean(el.querySelector('#st-addr').value) || null,
      sort: Math.round(num(el.querySelector('#st-sort').value)), notes: String(el.querySelector('#st-notes').value || '').trim() || null });
    return 'saved';
  } });
  const r = await sheet({ title: t(site ? 'site.edit' : 'site.add'), body, actions });
  if (r === 'saved') { toast(t('site.saved')); ctx.reload(); return; }
  if (r === 'delete' && site) {
    if (!(await confirmSheet(t('site.deleteQ'), t('site.deleteMsg', { name: site.name }), { okLabel: t('btn.delete'), danger: true }))) return;
    try { await ctx.api.deleteSite(site.id); toast(t('site.deleted')); ctx.go('organisieren'); } catch (err) {
      toast(err && err.code === 'in_use' ? t('site.inUse') : errorText(err), 'error');
    }
  }
}

async function addSpaceSheet(ctx, spaces, sites = [], curSite = null) {
  const names = new Set(spaces.map((s) => norm(s.name)));
  const usedShort = new Set(spaces.map((s) => s.short_code).filter(Boolean));
  const presets = SPACE_PRESETS.filter((p) => !names.has(norm(p.name)));
  const body = `
    ${sites.length ? `<div class="field"><label for="sp-site">${esc(t('site.label'))}</label>
      <select id="sp-site" aria-describedby="sp-site-h">${siteOptionsHtml(sites, curSite && curSite !== 'none' ? curSite : (sites.length === 1 ? sites[0].id : ''))}</select>
      <span class="hint" id="sp-site-h">${esc(t('site.hint'))}</span></div>` : ''}
    <fieldset class="org-fieldset"><legend>${esc(t('organize.add.presets'))}</legend>
      ${presets.length ? `<p class="hint">${esc(t('organize.add.presetsHint'))}</p>
        <div class="org-presets">${presets.map((p, i) => `<label class="org-preset"><input type="checkbox" name="preset" value="${i}" aria-label="${esc(`${p.name} (${p.short})`)}">
          <span><b>${esc(p.name)}</b><small><span class="mono">${esc(p.short)}</span> · ${esc(locTypeLabel(p.type))}</small></span></label>`).join('')}</div>`
        : `<p class="muted small">${esc(t('organize.add.allExist'))}</p>`}
    </fieldset>
    <fieldset class="org-fieldset"><legend>${esc(t('organize.add.custom'))}</legend>
      <div class="form">
        <div class="field full"><label for="sp-name">${esc(t('organize.f.name'))}</label>
          <input id="sp-name" name="name" type="text" maxlength="120" autocomplete="off" placeholder="${esc(t('organize.f.spacePh'))}"></div>
        <div class="field"><label for="sp-short">${esc(t('organize.f.short'))} (${esc(t('common.optional'))})</label>
          <input id="sp-short" name="short" type="text" maxlength="10" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-describedby="sp-short-h"></div>
        <div class="field"><label for="sp-type">${esc(t('organize.f.type'))}</label><select id="sp-type" name="type">${typeOptions('raum')}</select></div>
        <div class="hint field full" id="sp-short-h">${esc(t('organize.f.shortHint'))}</div>
      </div>
    </fieldset>`;
  const created = await sheet({
    title: t('organize.addSpace'),
    body,
    actions: [
      { label: t('btn.cancel'), kind: 'ghost', value: null },
      { label: t('organize.add.save'), kind: 'primary', icon: 'plus', onClick: async (el, close) => {
        const picked = [...el.querySelectorAll('input[name=preset]:checked')].map((c) => presets[+c.value]).filter(Boolean);
        const name = clean(el.querySelector('#sp-name').value);
        const shortRaw = el.querySelector('#sp-short').value;
        const short = normShortCode(shortRaw);
        const type = el.querySelector('#sp-type').value || 'raum';
        if (!picked.length && !name) return sheetError(el, t('organize.add.nothing'));
        if (clean(shortRaw) && short !== clean(shortRaw).toUpperCase()) return sheetError(el, t('organize.codes.invalid', { code: clean(shortRaw) }));
        if (name && short && usedShort.has(short)) return sheetError(el, t('err.duplicate_code'));
        const todo = picked.map((p) => ({ name: p.name, type: p.type, short_code: usedShort.has(p.short) ? null : p.short }));
        if (name) todo.push({ name, type, short_code: short || null });
        const rows = [];
        for (const x of todo) {
          try {
            const siteSel = el.querySelector('#sp-site');
            const row = await ctx.api.saveLocation({ name: x.name, type: x.type, short_code: x.short_code, parent_id: null,
              ...(siteSel ? { site_id: siteSel.value || null } : {}) });
            rows.push(row || { name: x.name });
            if (x.short_code) usedShort.add(x.short_code);
          } catch (err) {
            if (!rows.length) return sheetError(el, errorText(err));
            toast(errorText(err), 'error');
            close(rows);
            return false;
          }
        }
        return rows;
      } },
    ],
  });
  if (!created || !created.length) return;
  toast(created.length === 1 ? t('organize.add.created1', { name: created[0].name }) : t('organize.add.createdN', { n: created.length }));
  if (created.length === 1 && created[0].code) ctx.go('o/' + enc(created[0].code));
  else ctx.reload();
}

// ---------------------------------------------------------------------------
// Raum / Lagerort visuell ('o/:code')
// ---------------------------------------------------------------------------
function buildTree(locs) {
  const byId = new Map(locs.map((l) => [l.id, l]));
  const kids = new Map();
  for (const l of locs) {
    if (l.parent_id && l.parent_id !== l.id && byId.has(l.parent_id)) {
      if (!kids.has(l.parent_id)) kids.set(l.parent_id, []);
      kids.get(l.parent_id).push(l);
    }
  }
  const cmp = collator();
  kids.forEach((arr) => arr.sort((a, b) => cmp(a.name, b.name) || cmp(a.short_code, b.short_code)));
  return { byId, kids };
}
function descendantsWithDepth(kids, id, { includeArchived = false } = {}) {
  const out = [];
  const seen = new Set([id]);
  const walk = (pid, depth) => {
    for (const c of kids.get(pid) || []) {
      if (seen.has(c.id) || (c.archived && !includeArchived)) continue;
      seen.add(c.id);
      out.push({ l: c, depth });
      walk(c.id, depth + 1);
    }
  };
  walk(id, 0);
  return out;
}
function ancestorsOf(loc, byId) {
  const out = [];
  const seen = new Set([loc.id]);
  let cur = loc.parent_id ? byId.get(loc.parent_id) : null;
  while (cur && !seen.has(cur.id)) { seen.add(cur.id); out.unshift(cur); cur = cur.parent_id ? byId.get(cur.parent_id) : null; }
  return out;
}

async function loadSpace(ctx, code) {
  const { api, user } = ctx;
  const staff = can(user, 'staff');
  const [loc, all0] = await Promise.all([api.getLocationByCode(code), api.listLocations({ includeArchived: true })]);
  if (!loc) return null;
  const all = all0 || [];
  if (!all.some((l) => l.id === loc.id)) all.push(loc);
  const { byId, kids } = buildTree(all);
  const anc = ancestorsOf(loc, byId);
  const rootId = loc.root_id || (anc[0] && anc[0].id) || loc.id;
  const root = byId.get(rootId) || loc;
  const sub = locationSubtreeIds(all, loc.id);

  const warn = [];
  const soft = (p, fallback) => Promise.resolve(p).catch((err) => { warn.push(err); return fallback; });
  const [arts, machs, photos, tasks, spaces, hotspots, profiles] = await Promise.all([
    api.listArticles({}),
    api.listMachines({}),
    soft(api.listPhotos({ spaceId: rootId }), []),
    soft(api.listTasks({ spaceId: rootId }), []),
    loc.parent_id ? [] : soft(api.listSpaces(), []),
    loc.cover_photo_id ? soft(api.listHotspots({ photoId: loc.cover_photo_id }), []) : [],
    staff ? soft(api.listProfiles(), []) : [],
  ]);
  // Liegt dieser Lagerort auf einem Gebäudeplan? (Bereiche, die auf ihn zeigen, auf einem Planbild)
  let onPlan = null;
  if (typeof api.listFloorPlans === 'function') {
    const mine = await soft(api.listHotspots({ locationId: loc.id }), []);
    if ((mine || []).length) {
      const plans = (await Promise.resolve(api.listFloorPlans()).catch(() => [])) || [];
      for (const pl of plans) {
        const h = mine.find((x) => x.photo_id === pl.photo_id && x.location_id === loc.id);
        if (h) { onPlan = { plan: pl, h }; break; }
      }
    }
  }
  const myPhotos = (photos || []).filter((p) => sub.has(p.location_id));
  let cover = null;
  if (loc.cover_photo_id) {
    cover = (photos || []).find((p) => p.id === loc.cover_photo_id) || null;
    if (!cover) {
      const r = await soft(api.listPhotos({ ids: [loc.cover_photo_id] }), []);
      cover = (r || []).find((p) => p.id === loc.cover_photo_id) || null;
    }
  }
  const cmp = collator();
  const S = {
    loc, all, byId, kids, anc, root, rootId, sub, staff, admin: can(user, 'admin'),
    desc: descendantsWithDepth(kids, loc.id),
    children: (kids.get(loc.id) || []).filter((c) => !c.archived),
    articles: (arts || []).filter((a) => a.location_id && sub.has(a.location_id)).sort((a, b) => cmp(a.name, b.name)),
    machines: (machs || []).filter((m) => m.home_location_id && sub.has(m.home_location_id)).sort((a, b) => cmp(a.name, b.name)),
    photos: myPhotos,
    photoIds: new Set(myPhotos.map((p) => p.id)),
    tasks: sortTasks((tasks || []).filter((x) => sub.has(x.location_id))),
    space: loc.parent_id ? null : (spaces || []).find((s) => s.id === loc.id) || null,
    hotspots: hotspots || [],
    profiles: profiles || [],
    cover,
    onPlan,
    warn,
  };
  // Gegenstände je Lagerort (direkt) – für Zähler der Unterorte
  S.direct = new Map();
  for (const a of S.articles) S.direct.set(a.location_id, (S.direct.get(a.location_id) || 0) + 1);
  for (const m of S.machines) S.direct.set(m.home_location_id, (S.direct.get(m.home_location_id) || 0) + 1);
  return S;
}
function sortTasks(list) {
  const rank = { offen: 0, erledigt: 1, verworfen: 2 };
  return [...list].sort((a, b) => (rank[a.status] ?? 3) - (rank[b.status] ?? 3)
    || num(a.sort) - num(b.sort) || String(a.created_at || '').localeCompare(String(b.created_at || '')));
}
function subtreeItemCount(S, id) {
  let n = S.direct.get(id) || 0;
  for (const { l } of descendantsWithDepth(S.kids, id)) n += S.direct.get(l.id) || 0;
  return n;
}
function relPath(S, id) {
  const names = [];
  let cur = S.byId.get(id);
  let guard = 0;
  while (cur && cur.id !== S.loc.id && guard++ < 60) { names.unshift(cur.name); cur = cur.parent_id ? S.byId.get(cur.parent_id) : null; }
  return names.join(' / ');
}
async function loadDetections(ctx, S) {
  const rows = await ctx.api.listDetections({ spaceId: S.rootId });
  return (rows || []).filter((d) => S.sub.has(d.photo_location_id) || S.photoIds.has(d.photo_id));
}

async function spaceView(ctx) {
  const code = routeCode(ctx);
  ctx.setTitle(code || t('organize.title'));
  ctx.el.innerHTML = loadingHtml();
  let S;
  try { S = await loadSpace(ctx, code); } catch (err) { showError(ctx, err); return; }
  if (!S) {
    ctx.el.innerHTML = `<div class="page">${emptyHtml(t('organize.notFound', { code }),
      `<a class="btn" href="#/organisieren">${icon('back')}${esc(t('organize.toHub'))}</a>`)}</div>`;
    return;
  }
  const { loc, staff } = S;
  ctx.setTitle(loc.name);
  if (S.warn.length) toast(t('organize.partialLoad', { msg: errorText(S.warn[0]) }), 'error');
  let tab = qget(ctx, 'tab');
  if (!TABS.includes(tab)) tab = 'unterorte';

  const readable = loc.code_path || loc.short_code;
  const sp = S.space;
  const crumbs = [`<a href="#/organisieren">${esc(t('organize.title'))}</a>`,
    ...S.anc.map((p) => `<a href="#/o/${enc(p.code)}">${esc(p.name)}</a>`),
    `<span aria-current="page">${esc(loc.name)}</span>`];
  const organizedTxt = loc.organized_at
    ? (loc.organized_by_name ? t('organize.organizedBy', { date: fmtDate(loc.organized_at), name: loc.organized_by_name }) : t('organize.organizedSince', { date: fmtDate(loc.organized_at) }))
    : '';
  const spProgress = sp ? progressHtml(sp.progress, num(sp.detections_done) + num(sp.tasks_done),
    num(sp.detections_done) + num(sp.tasks_done) + num(sp.detections_open) + num(sp.tasks_open), !!sp.organized_at) : '';

  ctx.el.innerHTML = `<div class="page org">
    <nav class="org-crumbs small" aria-label="${esc(t('organize.path'))}">${crumbs.join('<span aria-hidden="true">›</span>')}</nav>
    <section class="card org-head">
      <div class="org-head-top">
        ${S.onPlan ? onPlanPreviewHtml(S.onPlan.plan, S.onPlan.h) : ''}
        <span class="org-head-ic" aria-hidden="true">${typeIcon(loc.type)}</span>
        <div class="org-head-main">
          <h1>${esc(loc.name)}</h1>
          <div class="org-codes">
            <span>${esc(locTypeLabel(loc.type))}</span>
            ${readable ? `<span class="mono org-code" title="${esc(t('organize.readableCode'))}">${esc(readable)}</span>` : ''}
            <span class="mono muted" title="${esc(t('organize.internalCode'))}">${esc(loc.code)}</span>
            ${loc.site_name ? `<span class="org-site-tag" title="${esc(t('site.label'))}">${icon('pin')}${esc(loc.site_name)}</span>` : ''}
          </div>
          <div class="row small">
            ${sp ? orgStatusPill(sp.org_status) : ''}
            ${loc.responsible_name ? `<span class="muted">${icon('user')}${esc(t('organize.responsible', { name: loc.responsible_name }))}</span>` : ''}
            ${organizedTxt ? `<span class="pill pill-ok">${icon('check')}${esc(organizedTxt)}</span>` : ''}
            ${loc.archived ? `<span class="pill pill-muted">${esc(t('common.archived'))}</span>` : ''}
          </div>
        </div>
      </div>
      ${spProgress}
      <div class="org-head-actions">
        ${staff ? `<button type="button" class="btn sm" data-act="label">${icon('print')}${esc(t('organize.label'))}</button>` : ''}
        <a class="btn sm" href="#/l/${enc(loc.code)}">${icon('edit')}${esc(t('organize.masterData'))}</a>
        <a class="btn sm" href="#/inventur?ort=${enc(loc.code)}">${icon('clipboard')}${esc(t('organize.stocktake'))}</a>
      </div>
      <div class="org-ai-actions">
        <button type="button" class="btn primary" data-act="ki">${icon('sparkle')}${esc(t('organize.aiOrganize'))}</button>
        <button type="button" class="btn" data-act="improve">${icon('wrench')}${esc(t('organize.improve'))}</button>
      </div>
      ${loc.archived ? `<div class="alert">${icon('box')}<span>${esc(t('organize.archivedNote'))}</span></div>` : ''}
    </section>
    <section class="section org-visual" aria-labelledby="org-vis-h" data-visual></section>
    <div class="tabs org-tabs" role="tablist" aria-label="${esc(t('organize.tabs'))}">
      ${TABS.map((k) => `<button type="button" class="tab" role="tab" id="org-tab-${k}" data-tab="${k}" aria-controls="org-panel"
        aria-selected="${k === tab}" tabindex="${k === tab ? 0 : -1}">${esc(t(TAB_KEYS[k]))}${tabCount(S, k)}</button>`).join('')}
    </div>
    <div class="org-panel" id="org-panel" role="tabpanel" aria-labelledby="org-tab-${tab}" data-panel></div>
  </div>`;
  const root = ctx.el.firstElementChild;
  if (S.onPlan) hydrateThumbs(root.querySelector('.org-onplan'), ctx.api);

  renderVisual(ctx, S, root.querySelector('[data-visual]'));

  const panel = root.querySelector('[data-panel]');
  const tabBtns = [...root.querySelectorAll('[data-tab]')];
  const selectTab = (k, focus) => {
    tab = k;
    tabBtns.forEach((b) => { const on = b.dataset.tab === k; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; if (on && focus) b.focus(); });
    panel.setAttribute('aria-labelledby', 'org-tab-' + k);
    try { history.replaceState(null, '', '#/o/' + enc(loc.code) + (k === 'unterorte' ? '' : '?tab=' + k)); } catch (e) { /* egal */ }
    renderPanel(ctx, S, panel, k);
  };
  tabBtns.forEach((b, i) => {
    b.addEventListener('click', () => selectTab(b.dataset.tab));
    b.addEventListener('keydown', (e) => {
      let j = null;
      if (e.key === 'ArrowRight') j = (i + 1) % tabBtns.length;
      else if (e.key === 'ArrowLeft') j = (i - 1 + tabBtns.length) % tabBtns.length;
      else if (e.key === 'Home') j = 0;
      else if (e.key === 'End') j = tabBtns.length - 1;
      if (j !== null) { e.preventDefault(); selectTab(tabBtns[j].dataset.tab, true); }
    });
  });
  renderPanel(ctx, S, panel, tab);

  root.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => {
    const act = b.dataset.act;
    if (act === 'label') printLocationLabels([loc]);
    else if (act === 'ki') kiSheet(ctx, S);
    else if (act === 'improve') improveSheet(ctx, S);
  }));
}
function tabCount(S, k) {
  let n = null;
  if (k === 'unterorte') n = S.desc.length;
  else if (k === 'inhalt') n = S.articles.length + S.machines.length;
  else if (k === 'fotos') n = S.photos.length;
  else if (k === 'plan') n = S.tasks.filter((x) => x.status === 'offen').length;
  return n ? ` <span class="org-tab-n">${esc(fmtNum(n))}</span>` : '';
}

// ---------- Übersichtsfoto mit Bereichen ----------
function stageHtml(path, alt, ar) {
  const r = ar && Number.isFinite(ar) && ar > 0 ? ar : 4 / 3;
  return `<div class="org-stage-wrap"><div class="org-stage" data-stage style="--ar:${r.toFixed(5)}">
    ${thumbHtml(path, alt, 'org-stage-img', 'image')}<div class="org-layer" data-layer></div></div></div>`;
}
/** Seitenverhältnis aus dem geladenen Bild übernehmen (falls Breite/Höhe des Fotos nicht bekannt sind) */
function bindStageImage(stage, onLoad) {
  const img = stage.querySelector('img');
  if (!img) return;
  img.draggable = false;
  const apply = () => {
    if (img.naturalWidth && img.naturalHeight) stage.style.setProperty('--ar', (img.naturalWidth / img.naturalHeight).toFixed(5));
    stage.classList.add('loaded');
    if (onLoad) onLoad(img);
  };
  if (img.complete && img.naturalWidth) apply(); else img.addEventListener('load', apply, { once: true });
}
function hotspotLabel(S, h) {
  const l = S.byId.get(h.location_id);
  return clean(h.label) || (l && l.name) || h.location_name || '?';
}
/** Geometrie eines Bereichs (relativ 0–1); Rechteck oder Punkt (w/h null) – immer innerhalb des Bildes */
function hsGeom(h) {
  const x = clamp01(h.x), y = clamp01(h.y);
  return num(h.w) > 0 && num(h.h) > 0
    ? { x, y, w: Math.min(num(h.w), 1 - x) || 0.01, h: Math.min(num(h.h), 1 - y) || 0.01 }
    : { x, y, w: null, h: null };
}
const geomStyle = (g) => (g.w ? `left:${pct(g.x)};top:${pct(g.y)};width:${pct(g.w)};height:${pct(g.h)}` : `left:${pct(g.x)};top:${pct(g.y)}`);
const geomData = (g) => `data-x="${g.x}" data-y="${g.y}" data-w="${g.w ?? ''}" data-h="${g.h ?? ''}"`;
const HANDLES = ['nw', 'ne', 'sw', 'se'].map((c) => `<span class="org-hs-handle ${c}" data-handle="${c}" aria-hidden="true"></span>`).join('');

function hotspotHtml(S, h, editing) {
  const l = S.byId.get(h.location_id);
  const label = hotspotLabel(S, h);
  const code = (l && l.code) || h.location_code || '';
  const g = hsGeom(h);
  const cls = `org-hs ${g.w ? 'rect' : 'pt'}${g.x > 0.7 ? ' lbl-left' : ''}`;
  const inner = `<span class="org-hs-label">${esc(label)}</span>`;
  if (editing) {
    return `<button type="button" class="${cls}" style="${geomStyle(g)}" data-hs="${esc(h.id)}" ${geomData(g)}
      aria-label="${esc(t('organize.hs.editAria', { name: label }))}">${inner}${g.w ? HANDLES : ''}</button>`;
  }
  const readable = l ? locationDisplayCode(l) : code;
  return `<a class="${cls}" style="${geomStyle(g)}" href="#/o/${enc(code)}" aria-label="${esc(t('organize.hs.openAria', { name: label, code: readable }))}">${inner}</a>`;
}

function renderVisual(ctx, S, box) {
  const { loc, staff } = S;
  const coverPath = loc.cover_photo_id ? (loc.cover_photo_path || (S.cover && S.cover.path)) : null;
  const path = coverPath || loc.photo_path;
  const editing = !!coverPath && staff && ui.editingFor === loc.id;
  const nAreas = S.hotspots.length;
  const tools = staff ? `<div class="row">
      ${coverPath ? `<button type="button" class="btn sm${editing ? ' primary' : ''}" data-edit aria-pressed="${editing}">${icon(editing ? 'check' : 'edit')}${esc(t(editing ? 'organize.doneEditing' : 'organize.editAreas'))}</button>` : ''}
      ${S.photos.length ? `<button type="button" class="btn sm" data-cover>${icon('image')}${esc(t(coverPath ? 'organize.changeCover' : 'organize.chooseCover'))}</button>` : ''}
      ${!S.photos.length ? `<a class="btn sm" href="${IMPORT_HREF(loc.code)}">${icon('upload')}${esc(t('organize.importPhotos'))}</a>` : ''}
    </div>` : '';

  let content;
  if (path) {
    const ar = coverPath && S.cover && num(S.cover.width) && num(S.cover.height) ? num(S.cover.width) / num(S.cover.height) : null;
    let note = '';
    if (!coverPath) note = staff ? `<div class="alert">${icon('image')}<span>${esc(t('organize.attachmentOnly'))}</span></div>` : '';
    else if (editing) note = `<div class="alert warn" role="status">${icon('edit')}<span>${esc(t('organize.editHint'))}</span></div>`;
    else note = `<p class="small muted org-areas-note">${esc(nAreas ? plural('organize.areas', nAreas) + ' · ' + t('organize.areasTap') : t(staff ? 'organize.areasNoneStaff' : 'organize.areasNone'))}</p>`;
    content = `${note}${stageHtml(path, t('organize.photoAlt', { name: loc.name }), ar)}`;
  } else {
    const msg = !S.photos.length ? (staff ? t('organize.noPhotos') : t('organize.noCoverRead')) : (staff ? t('organize.noCover') : t('organize.noCoverRead'));
    content = `<div class="org-nophoto">${icon('image')}<p>${esc(msg)}</p>
      ${staff ? `<div class="row">${S.photos.length ? `<button type="button" class="btn primary" data-cover>${icon('image')}${esc(t('organize.chooseCover'))}</button>` : ''}
        <a class="btn${S.photos.length ? '' : ' primary'}" href="${IMPORT_HREF(loc.code)}">${icon('upload')}${esc(t('organize.importPhotos'))}</a></div>` : ''}</div>`;
  }
  box.innerHTML = `<div class="section-head"><h2 id="org-vis-h">${esc(t('organize.visual'))}</h2>${path ? tools : ''}</div>${content}`;

  const stage = box.querySelector('[data-stage]');
  if (stage) {
    const layer = stage.querySelector('[data-layer]');
    const drawHotspots = () => {
      layer.innerHTML = coverPath ? S.hotspots.map((h) => hotspotHtml(S, h, editing)).join('') : '';
    };
    drawHotspots();
    stage.classList.toggle('editing', editing);
    bindStageImage(stage);
    hydrateThumbs(box, ctx.api);
    if (!editing) {
      // Klick auf das Foto (nicht auf einen Bereich) → gross anzeigen
      stage.addEventListener('click', (e) => {
        if (e.target.closest('.org-hs')) return;
        const img = stage.querySelector('img[src]');
        if (img) openLightbox(img.src, loc.name);
      });
    } else {
      bindAreaEditor(stage, layer, {
        onDraw: (shape) => newHotspotSheet(ctx, S, shape),
        onEdit: (id) => { const h = S.hotspots.find((x) => x.id === id); if (h) editHotspotSheet(ctx, S, h); },
        onChange: (id, g, revert) => saveGeometry(ctx, S.hotspots, id, g, revert),
      });
    }
  }
  const editBtn = box.querySelector('[data-edit]');
  if (editBtn) editBtn.addEventListener('click', () => {
    ui.editingFor = ui.editingFor === loc.id ? null : loc.id;
    renderVisual(ctx, S, box);
    const b = box.querySelector('[data-edit]');
    if (b) b.focus();
  });
  box.querySelectorAll('[data-cover]').forEach((b) => b.addEventListener('click', () => coverSheet(ctx, S)));
}

/** Neue Geometrie eines Bereichs speichern (nach Verschieben/Grösse ändern); bei Fehler zurücksetzen. */
async function saveGeometry(ctx, list, id, g, revert) {
  try {
    await ctx.api.saveHotspot({ id, x: g.x, y: g.y, w: g.w, h: g.h });
    const h = list.find((x) => x.id === id);
    if (h) Object.assign(h, { x: g.x, y: g.y, w: g.w, h: g.h });
  } catch (err) { revert(); toast(errorText(err), 'error'); }
}

/** Bereichs-Editor (Übersichtsfoto und Gebäudeplan): auf freier Fläche Rechteck ziehen oder kurz tippen (= Punkt);
 *  bestehenden Bereich ziehen = verschieben, an den Ecken ziehen = Grösse ändern, antippen = bearbeiten.
 *  Koordinaten relativ 0–1 zur Bildfläche. Tastatur: Enter/Leertaste auf einem Bereich öffnet «bearbeiten». */
function bindAreaEditor(stage, layer, { onDraw, onEdit, onChange }) {
  let op = null;
  const at = (e) => {
    const r = stage.getBoundingClientRect();
    return { x: clamp01((e.clientX - r.left) / r.width), y: clamp01((e.clientY - r.top) / r.height), cx: e.clientX, cy: e.clientY };
  };
  const readG = (el) => ({ x: +el.dataset.x, y: +el.dataset.y, w: el.dataset.w ? +el.dataset.w : null, h: el.dataset.h ? +el.dataset.h : null });
  const apply = (el, g) => {
    el.setAttribute('style', geomStyle(g) + (el.dataset.c ? `;--c:${el.dataset.c}` : ''));
    el.dataset.x = g.x; el.dataset.y = g.y; el.dataset.w = g.w ?? ''; el.dataset.h = g.h ?? '';
    el.classList.toggle('lbl-left', g.x > 0.7);
  };
  const finish = () => {
    if (!op) return null;
    const o = op;
    op = null;
    if (o.draft) o.draft.remove();
    if (o.el) o.el.classList.remove('dragging');
    try { stage.releasePointerCapture(o.pid); } catch (e) { /* egal */ }
    return o;
  };
  stage.addEventListener('pointerdown', (e) => {
    if (op || (e.button !== undefined && e.button !== 0)) return;
    if (!stage.querySelector('img[src]')) return;
    const handle = e.target.closest('[data-handle]');
    const el = e.target.closest('[data-hs]');
    e.preventDefault();
    const p = at(e);
    if (el) op = { kind: handle ? 'resize' : 'move', corner: handle ? handle.dataset.handle : null, el, orig: readG(el) };
    else {
      const d = document.createElement('div');
      d.className = 'org-draft';
      d.style.left = pct(p.x); d.style.top = pct(p.y);
      layer.appendChild(d);
      op = { kind: 'draw', draft: d };
    }
    Object.assign(op, { start: p, pid: e.pointerId, moved: false, cur: null });
    try { stage.setPointerCapture(e.pointerId); } catch (err) { /* egal */ }
  });
  stage.addEventListener('pointermove', (e) => {
    if (!op || e.pointerId !== op.pid) return;
    const p = at(e);
    if (!op.moved && Math.hypot(p.cx - op.start.cx, p.cy - op.start.cy) > 6) { op.moved = true; if (op.el) op.el.classList.add('dragging'); }
    if (op.kind === 'draw') {
      const s = op.start;
      Object.assign(op.draft.style, { left: pct(Math.min(s.x, p.x)), top: pct(Math.min(s.y, p.y)), width: pct(Math.abs(p.x - s.x)), height: pct(Math.abs(p.y - s.y)) });
      return;
    }
    if (!op.moved) return;
    const o = op.orig;
    const dx = p.x - op.start.x, dy = p.y - op.start.y;
    let g;
    if (op.kind === 'move') {
      g = o.w ? { ...o, x: Math.max(0, Math.min(1 - o.w, o.x + dx)), y: Math.max(0, Math.min(1 - o.h, o.y + dy)) }
        : { ...o, x: clamp01(o.x + dx), y: clamp01(o.y + dy) };
    } else {
      let x1 = o.x, y1 = o.y, x2 = o.x + o.w, y2 = o.y + o.h;
      if (op.corner.includes('w')) x1 = p.x; else x2 = p.x;
      if (op.corner.includes('n')) y1 = p.y; else y2 = p.y;
      const x = Math.min(x1, x2), y = Math.min(y1, y2);
      g = { x, y, w: Math.max(0.01, Math.min(Math.abs(x2 - x1), 1 - x)), h: Math.max(0.01, Math.min(Math.abs(y2 - y1), 1 - y)) };
    }
    op.cur = g;
    apply(op.el, g);
  });
  stage.addEventListener('pointerup', (e) => {
    if (!op || e.pointerId !== op.pid) return;
    const p = at(e);
    const o = finish();
    if (o.kind === 'draw') {
      const s = o.start;
      const w = Math.abs(p.x - s.x), h = Math.abs(p.y - s.y);
      if (!o.moved || Math.hypot(p.cx - s.cx, p.cy - s.cy) < 12 || w < 0.01 || h < 0.01) onDraw({ x: s.x, y: s.y, w: null, h: null });
      else onDraw({ x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), w, h });
    } else if (o.moved && o.cur) onChange(o.el.dataset.hs, o.cur, () => apply(o.el, o.orig));
    else onEdit(o.el.dataset.hs);
  });
  stage.addEventListener('pointercancel', () => {
    const o = finish();
    if (o && o.el && o.moved) apply(o.el, o.orig);
  });
  // Tastatur (Klick ohne Zeiger, detail 0): Bereich bearbeiten
  layer.addEventListener('click', (e) => {
    if (e.detail !== 0) return;
    const el = e.target.closest('[data-hs]');
    if (el) onEdit(el.dataset.hs);
  });
  stage.addEventListener('dragstart', (e) => e.preventDefault());
}

function locationSelectOptions(S, selectedId) {
  const opts = S.desc.map(({ l, depth }) => `<option value="${esc(l.id)}"${l.id === selectedId ? ' selected' : ''}>${'  '.repeat(depth)}${esc(l.name)}${l.short_code ? ' · ' + esc(l.code_path || l.short_code) : ''}</option>`);
  if (selectedId && !S.desc.some((d) => d.l.id === selectedId)) {
    const l = S.byId.get(selectedId);
    if (l) opts.unshift(`<option value="${esc(l.id)}" selected>${esc(l.path || l.name)}</option>`);
  }
  return opts.join('');
}
function newLocFieldsHtml(S, idp) {
  const type = NEXT_TYPE[S.loc.type] || 'box';
  return `<div class="form">
    <div class="field"><label for="${idp}-type">${esc(t('organize.f.type'))}</label><select id="${idp}-type" name="type">${typeOptions(type)}</select></div>
    <div class="field"><label for="${idp}-short">${esc(t('organize.f.short'))}</label>
      <input id="${idp}-short" name="short" type="text" maxlength="10" autocomplete="off" autocapitalize="characters" spellcheck="false"
        value="${esc(suggestShortCode(type, S.children))}" aria-describedby="${idp}-short-h"></div>
    <div class="field full"><label for="${idp}-name">${esc(t('organize.f.name'))} <span aria-hidden="true">*</span></label>
      <input id="${idp}-name" name="name" type="text" maxlength="120" autocomplete="off" placeholder="${esc(t('organize.f.namePh'))}"></div>
    <div class="hint field full" id="${idp}-short-h">${esc(t('organize.f.shortHint'))}</div>
  </div>`;
}
/** Kurzcode-Vorschlag folgt dem Typ, bis jemand selbst etwas eingibt */
function bindShortSuggest(root, S, idp) {
  const typeSel = root.querySelector(`#${idp}-type`);
  const shortInp = root.querySelector(`#${idp}-short`);
  if (!typeSel || !shortInp) return;
  let touched = false;
  shortInp.addEventListener('input', () => { touched = true; });
  typeSel.addEventListener('change', () => { if (!touched) shortInp.value = suggestShortCode(typeSel.value, S.children); });
}
function readNewLoc(root, idp) {
  const name = clean(root.querySelector(`#${idp}-name`).value);
  const rawShort = clean(root.querySelector(`#${idp}-short`).value);
  const short = normShortCode(rawShort);
  const type = root.querySelector(`#${idp}-type`).value;
  if (!name) return { error: t('err.name_required'), field: `#${idp}-name` };
  if (rawShort && short !== rawShort.toUpperCase()) return { error: t('organize.codes.invalid', { code: rawShort }), field: `#${idp}-short` };
  return { name, type: LOCATION_TYPES.includes(type) ? type : 'box', short_code: short || null };
}

async function newHotspotSheet(ctx, S, shape) {
  const hasSubs = S.desc.length > 0;
  let createdId = null;     // bei Wiederholung nach Fehler nicht doppelt anlegen
  const body = `
    <p class="small muted">${icon(shape.w ? 'grid' : 'pin')} ${esc(t(shape.w ? 'organize.hs.shapeRect' : 'organize.hs.shapePoint'))}</p>
    <div class="radio-cards" role="radiogroup">
      <label class="radio-card"><input type="radio" name="mode" value="existing"${hasSubs ? ' checked' : ' disabled'}>
        <span><b>${esc(t('organize.hs.existing'))}</b>${hasSubs ? '' : `<small>${esc(t('organize.hs.noSubs'))}</small>`}</span></label>
      <label class="radio-card"><input type="radio" name="mode" value="new"${hasSubs ? '' : ' checked'}>
        <span><b>${esc(t('organize.hs.new'))}</b></span></label>
    </div>
    <div class="field" data-existing${hasSubs ? '' : ' hidden'}><label for="hs-loc">${esc(t('organize.hs.location'))}</label>
      <select id="hs-loc">${locationSelectOptions(S, null)}</select></div>
    <div data-new${hasSubs ? ' hidden' : ''}>${newLocFieldsHtml(S, 'hsn')}</div>
    <div class="field"><label for="hs-label">${esc(t('organize.hs.label'))} (${esc(t('common.optional'))})</label>
      <input id="hs-label" type="text" maxlength="80" autocomplete="off" aria-describedby="hs-label-h">
      <span class="hint" id="hs-label-h">${esc(t('organize.hs.labelHint'))}</span></div>`;
  const saved = await sheet({
    title: t('organize.hs.newTitle'),
    body,
    actions: [
      { label: t('btn.cancel'), kind: 'ghost', value: false },
      { label: t('btn.save'), kind: 'primary', icon: 'check', onClick: async (el) => {
        const mode = (el.querySelector('input[name=mode]:checked') || {}).value || 'new';
        let locationId = null;
        if (mode === 'existing') locationId = el.querySelector('#hs-loc').value || null;
        else if (createdId) locationId = createdId;
        else {
          const r = readNewLoc(el, 'hsn');
          if (r.error) { const f = el.querySelector(r.field); if (f) f.focus(); return sheetError(el, r.error); }
          const row = await ctx.api.saveLocation({ name: r.name, type: r.type, short_code: r.short_code, parent_id: S.loc.id });
          createdId = row && row.id;
          locationId = createdId;
        }
        if (!locationId) return sheetError(el, t('err.invalid_location'));
        await ctx.api.saveHotspot({
          photo_id: S.loc.cover_photo_id, location_id: locationId,
          x: shape.x, y: shape.y, w: shape.w || null, h: shape.h || null,
          label: clean(el.querySelector('#hs-label').value) || null,
        });
        return true;
      } },
    ],
    onOpen: (el) => {
      const ex = el.querySelector('[data-existing]');
      const nw = el.querySelector('[data-new]');
      el.querySelectorAll('input[name=mode]').forEach((r) => r.addEventListener('change', () => {
        const isNew = r.value === 'new' && r.checked;
        if (!r.checked) return;
        ex.hidden = isNew; nw.hidden = !isNew;
        if (isNew) { const n = el.querySelector('#hsn-name'); if (n) n.focus(); }
      }));
      bindShortSuggest(el, S, 'hsn');
    },
  });
  if (saved === true) { toast(t('organize.hs.saved')); ctx.reload(); }
  else if (createdId) ctx.reload();   // Unterort wurde angelegt, Bereich nicht – Seite trotzdem aktualisieren
}

async function editHotspotSheet(ctx, S, h) {
  const label = hotspotLabel(S, h);
  const l = S.byId.get(h.location_id);
  const code = (l && l.code) || h.location_code;
  const body = `
    ${code ? `<a class="btn" href="#/o/${enc(code)}">${icon('location')}${esc(t('organize.hs.open'))}</a>` : ''}
    <div class="field"><label for="hse-loc">${esc(t('organize.hs.location'))}</label><select id="hse-loc">${locationSelectOptions(S, h.location_id)}</select></div>
    <div class="field"><label for="hse-label">${esc(t('organize.hs.label'))}</label>
      <input id="hse-label" type="text" maxlength="80" autocomplete="off" value="${esc(h.label || '')}" placeholder="${esc((l && l.name) || '')}" aria-describedby="hse-label-h">
      <span class="hint" id="hse-label-h">${esc(t('organize.hs.labelHint'))}</span></div>`;
  const r = await sheet({
    title: t('organize.hs.editTitle'),
    body,
    actions: [
      { label: t('btn.delete'), kind: 'danger', icon: 'trash', value: 'delete' },
      { label: t('btn.save'), kind: 'primary', icon: 'check', onClick: async (el) => {
        await ctx.api.saveHotspot({ id: h.id, location_id: el.querySelector('#hse-loc').value || h.location_id,
          label: clean(el.querySelector('#hse-label').value) || null });
        return 'saved';
      } },
    ],
    onOpen: (el, close) => closeOnNav(el, close),
  });
  if (r === 'saved') { toast(t('organize.hs.saved')); ctx.reload(); return; }
  if (r === 'delete') {
    if (!(await confirmSheet(t('organize.hs.deleteQ'), t('organize.hs.deleteMsg', { name: label }), { okLabel: t('btn.delete'), danger: true }))) return;
    try { await ctx.api.deleteHotspot(h.id); toast(t('organize.hs.deleted')); ctx.reload(); } catch (err) { toast(errorText(err), 'error'); }
  }
}

async function coverSheet(ctx, S) {
  const { loc } = S;
  const photos = [...S.photos].sort((a, b) => (a.location_id === loc.id ? 0 : 1) - (b.location_id === loc.id ? 0 : 1));
  const body = `<p class="small muted">${esc(t('organize.cover.hint'))}</p>
    ${photos.length ? `<div class="org-cover-grid">${photos.map((p) => {
      const cur = p.id === loc.cover_photo_id;
      const where = p.location_id === loc.id ? '' : relPath(S, p.location_id);
      return `<button type="button" class="org-cover-pick${cur ? ' current' : ''}" data-pick="${esc(p.id)}" aria-pressed="${cur}"
          aria-label="${esc(t('organize.cover.pick', { name: p.file_name || '' }))}">
        ${thumbHtml(p.path, '', 'org-cover-img', 'image')}
        <span class="small org-ellipsis">${cur ? `<b>${esc(t('organize.cover.current'))}</b> · ` : ''}${esc(where || p.file_name || '')}</span></button>`;
    }).join('')}</div>` : `<p class="muted">${esc(t('organize.cover.noPhotos'))}</p>`}
    <a class="btn" href="${IMPORT_HREF(loc.code)}">${icon('upload')}${esc(t('organize.cover.more'))}</a>`;
  const actions = loc.cover_photo_id ? [{ label: t('organize.cover.remove'), kind: 'danger-outline', icon: 'x', onClick: async () => {
    await ctx.api.saveLocation({ id: loc.id, cover_photo_id: null });
    return 'removed';
  } }] : [];
  const r = await sheet({
    title: t('organize.chooseCover'), wide: true, body, actions,
    onOpen: (el, close) => {
      closeOnNav(el, close);
      hydrateThumbs(el, ctx.api);
      el.querySelectorAll('[data-pick]').forEach((b) => b.addEventListener('click', async () => {
        if (b.dataset.pick === loc.cover_photo_id) { close(null); return; }
        el.querySelectorAll('[data-pick]').forEach((x) => { x.disabled = true; });
        try {
          await ctx.api.saveLocation({ id: loc.id, cover_photo_id: b.dataset.pick });
          close('saved');
        } catch (err) {
          el.querySelectorAll('[data-pick]').forEach((x) => { x.disabled = false; });
          sheetError(el, errorText(err));
        }
      }));
    },
  });
  if (r === 'saved') { toast(t('organize.cover.saved')); ctx.reload(); }
  else if (r === 'removed') { toast(t('organize.cover.removed')); ctx.reload(); }
}

// ---------- Reiter ----------
function renderPanel(ctx, S, panel, tab) {
  if (tab === 'inhalt') renderContent(ctx, S, panel);
  else if (tab === 'fotos') renderPhotos(ctx, S, panel);
  else if (tab === 'plan') renderPlan(ctx, S, panel);
  else renderSubs(ctx, S, panel);
}

function renderSubs(ctx, S, panel) {
  const { loc, staff } = S;
  const view = getSubView();
  const kids = S.children;
  const info = (l) => {
    const n = subtreeItemCount(S, l.id);
    const nSub = descendantsWithDepth(S.kids, l.id).length;
    return [locTypeLabel(l.type), nSub ? plural('organize.subs', nSub) : '', n ? plural('organize.items', n) : ''].filter(Boolean).join(' · ');
  };
  const codeHtml = (l) => (l.code_path || l.short_code
    ? `<span class="mono org-code">${esc(l.code_path || l.short_code)}</span>`
    : `<span class="muted small">${esc(t('organize.noShort'))}</span>`);
  let list = '';
  if (!S.desc.length) {
    list = emptyHtml(t(staff ? 'organize.subs.none' : 'organize.subs.noneRead'));
  } else if (view === 'cards') {
    list = `<div class="org-subcards">${kids.map((c) => `<a class="org-subcard" href="#/o/${enc(c.code)}">
      ${c.photo_path ? thumbHtml(c.photo_path, t('organize.photoAlt', { name: c.name }), 'org-subcard-img', 'location')
        : `<div class="org-subcard-img org-noimg" aria-hidden="true">${typeIcon(c.type)}</div>`}
      <span class="org-subcard-body"><b class="org-ellipsis">${esc(c.name)}</b>${codeHtml(c)}<span class="small muted">${esc(info(c))}</span></span></a>`).join('')}</div>`;
  } else if (view === 'list') {
    list = `<div class="list">${kids.map((c) => `<a class="list-item" href="#/o/${enc(c.code)}">
      ${c.photo_path ? thumbHtml(c.photo_path, '', 'thumb', 'location') : `<div class="thumb thumb-empty" aria-hidden="true">${typeIcon(c.type)}</div>`}
      <div class="li-main"><span class="li-title">${esc(c.name)}</span><span class="li-sub">${esc(info(c))}</span></div>
      <div class="li-end">${codeHtml(c)}</div></a>`).join('')}</div>`;
  } else {
    list = `<ul class="org-tree" role="tree" aria-label="${esc(t('organize.tab.subs'))}">${S.desc.map(({ l, depth }) => `<li role="treeitem" aria-level="${depth + 1}" style="--d:${depth}">
      <a href="#/o/${enc(l.code)}"><span class="muted" aria-hidden="true">${typeIcon(l.type)}</span><span class="org-ellipsis">${esc(l.name)}</span>
        ${codeHtml(l)}<span class="small muted org-tree-n">${esc(subtreeItemCount(S, l.id) ? fmtNum(subtreeItemCount(S, l.id)) : '')}</span></a></li>`).join('')}</ul>`;
  }
  const missingShort = S.desc.filter(({ l }) => !l.short_code).length;
  const quick = staff && !loc.archived ? `<form class="card org-quick" data-quick novalidate>
      <h3>${icon('plus')}${esc(t('organize.subs.quickAdd'))}</h3>
      ${newLocFieldsHtml(S, 'qa')}
      <div class="alert danger" data-err role="alert" hidden></div>
      <div class="row"><button type="submit" class="btn primary">${icon('plus')}${esc(t('organize.add.save'))}</button></div>
    </form>` : '';
  panel.innerHTML = `<div class="stack">
    ${S.desc.length ? `<div class="row org-panel-tools">
      <div class="chips" role="group" aria-label="${esc(t('organize.view.label'))}">
        ${['cards', 'list', 'tree'].map((v) => `<button type="button" class="chip" data-view="${v}" aria-pressed="${v === view}">${icon(v === 'cards' ? 'grid' : v === 'list' ? 'list' : 'tree')}${esc(t('organize.view.' + v))}</button>`).join('')}
      </div>
      ${staff && missingShort ? `<button type="button" class="btn sm" data-codes>${icon('tag')}${esc(t('organize.subs.shortCodes'))} (${fmtNum(missingShort)})</button>` : ''}
    </div>` : ''}
    ${list}
    ${quick}
  </div>`;
  hydrateThumbs(panel, ctx.api);
  panel.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => {
    setSubView(b.dataset.view);
    renderSubs(ctx, S, panel);
    const nb = panel.querySelector(`[data-view="${b.dataset.view}"]`);
    if (nb) nb.focus();
  }));
  const codesBtn = panel.querySelector('[data-codes]');
  if (codesBtn) codesBtn.addEventListener('click', () => shortCodesSheet(ctx, S));
  const form = panel.querySelector('[data-quick]');
  if (form) {
    bindShortSuggest(form, S, 'qa');
    const err = form.querySelector('[data-err]');
    let busy = false;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (busy) return;
      err.hidden = true;
      const r = readNewLoc(form, 'qa');
      if (r.error) { err.textContent = r.error; err.hidden = false; const f = form.querySelector(r.field); if (f) f.focus(); return; }
      busy = true;
      const btn = form.querySelector('button[type=submit]');
      btn.disabled = true;
      try {
        await ctx.api.saveLocation({ name: r.name, type: r.type, short_code: r.short_code, parent_id: loc.id });
        toast(t('organize.subs.added', { name: r.name }));
        ctx.reload();
      } catch (ex) {
        err.textContent = errorText(ex); err.hidden = false;
        toast(errorText(ex), 'error');
      } finally { busy = false; btn.disabled = false; }
    });
  }
}

async function shortCodesSheet(ctx, S) {
  const missing = S.desc.filter(({ l }) => !l.short_code).map(({ l }) => l);
  if (!missing.length) { toast(t('organize.codes.none'), 'info'); return; }
  // Vorschläge je Ebene, ohne innerhalb dieser Liste doppelt zu vergeben
  const taken = new Map();
  const usedOf = (pid) => {
    if (!taken.has(pid)) taken.set(pid, new Set(S.all.filter((x) => x.parent_id === pid && x.short_code).map((x) => x.short_code)));
    return taken.get(pid);
  };
  const rows = missing.map((l) => {
    const used = usedOf(l.parent_id);
    const code = suggestShortCode(l.type, [...used].map((c) => ({ short_code: c })));
    if (code) used.add(code);
    return { l, code };
  });
  const body = `<p class="small muted">${esc(t('organize.codes.hint'))}</p>
    <div class="org-codes-list">${rows.map(({ l, code }, i) => `<div class="org-codes-row">
      <label for="sc-${i}"><b>${esc(relPath(S, l.id) || l.name)}</b><small class="muted">${esc(locTypeLabel(l.type))} · <span class="mono">${esc(l.code)}</span></small></label>
      <input id="sc-${i}" data-sc="${esc(l.id)}" data-parent="${esc(l.parent_id || '')}" type="text" maxlength="10" value="${esc(code)}"
        autocomplete="off" autocapitalize="characters" spellcheck="false" class="mono"></div>`).join('')}</div>`;
  let saved = 0;
  const n = await sheet({
    title: t('organize.subs.shortCodes'), body,
    actions: [
      { label: t('btn.cancel'), kind: 'ghost', value: 0 },
      { label: t('btn.save'), kind: 'primary', icon: 'check', onClick: async (el) => {
        const inputs = [...el.querySelectorAll('[data-sc]')];
        const seen = new Map();
        const todo = [];
        for (const inp of inputs) {
          const raw = clean(inp.value);
          if (!raw) continue;
          const c = normShortCode(raw);
          if (c !== raw.toUpperCase()) { inp.focus(); return sheetError(el, t('organize.codes.invalid', { code: raw })); }
          const key = inp.dataset.parent + '|' + c;
          if (seen.has(key)) { inp.focus(); return sheetError(el, t('organize.codes.dup', { code: c })); }
          seen.set(key, true);
          todo.push({ id: inp.dataset.sc, short_code: c, inp });
        }
        for (const x of todo) {
          if (x.inp.disabled) continue;      // schon gespeichert (Wiederholung nach Fehler)
          try { await ctx.api.saveLocation({ id: x.id, short_code: x.short_code }); saved++; x.inp.disabled = true; } catch (err) {
            x.inp.focus();
            return sheetError(el, `${x.short_code}: ${errorText(err)}`);
          }
        }
        return saved;
      } },
    ],
  });
  if (saved) { toast(t('organize.codes.saved', { n: fmtNum(saved) })); ctx.reload(); }
  else if (n) ctx.reload();
}

function renderContent(ctx, S, panel) {
  const total = S.articles.length + S.machines.length;
  if (!total) { panel.innerHTML = emptyHtml(t('organize.content.none')); return; }
  const where = (id) => (id === S.loc.id ? t('organize.content.here') : relPath(S, id));
  const machineRow = (m) => `<a class="list-item" href="#/m/${enc(m.code)}" data-hay="${esc(norm([m.name, m.code, m.brand, m.model, m.category_path, m.serial_no].join(' ')))}">
      ${thumbHtml(m.photo_path, '', 'thumb', 'machine')}
      <div class="li-main"><span class="li-title">${esc(m.name)}</span>
        <span class="li-sub">${esc([m.code, [m.brand, m.model].map(clean).filter(Boolean).join(' '), where(m.home_location_id)].filter(Boolean).join(' · '))}</span>
        ${m.category_path ? `<span class="li-sub">${esc(m.category_path)}</span>` : ''}</div>
      <div class="li-end">${statusPill(m.status)}</div></a>`;
  const articleRow = (a) => `<a class="list-item" href="#/a/${enc(a.code)}" data-hay="${esc(norm([a.name, a.code, a.brand, a.model, a.size, a.category_path, a.art_no].join(' ')))}">
      ${thumbHtml(a.photo_path, '', 'thumb', 'box')}
      <div class="li-main"><span class="li-title">${esc(a.name)}${a.size ? ` <span class="muted">· ${esc(a.size)}</span>` : ''}</span>
        <span class="li-sub">${esc([a.code, where(a.location_id)].filter(Boolean).join(' · '))}</span>
        ${a.category_path ? `<span class="li-sub">${esc(a.category_path)}</span>` : ''}</div>
      <div class="li-end"><span class="org-qty">${esc(fmtQty(a.stock, a.unit))}</span>
        ${a.low_stock ? `<span class="pill pill-danger">${esc(t('organize.content.low'))}</span>` : ''}</div></a>`;
  panel.innerHTML = `<div class="stack">
    ${total > 6 ? `<div class="searchbar">${icon('search')}<input type="search" data-filter aria-label="${esc(t('organize.content.filter'))}" placeholder="${esc(t('organize.content.filterPh'))}" autocomplete="off"></div>` : ''}
    ${S.machines.length ? `<section class="section" data-group><h2>${esc(t('organize.content.machines'))} (<span data-n>${fmtNum(S.machines.length)}</span>)</h2>
      <div class="list">${S.machines.map(machineRow).join('')}</div></section>` : ''}
    ${S.articles.length ? `<section class="section" data-group><h2>${esc(t('organize.content.articles'))} (<span data-n>${fmtNum(S.articles.length)}</span>)</h2>
      <div class="list">${S.articles.map(articleRow).join('')}</div></section>` : ''}
    <p class="muted" data-nomatch hidden>${esc(t('organize.content.noMatch'))}</p>
  </div>`;
  hydrateThumbs(panel, ctx.api);
  const f = panel.querySelector('[data-filter]');
  if (f) f.addEventListener('input', debounce(() => {
    const words = norm(f.value).split(' ').filter(Boolean);
    let any = false;
    panel.querySelectorAll('[data-group]').forEach((g) => {
      let n = 0;
      g.querySelectorAll('[data-hay]').forEach((r) => { const ok = words.every((w) => r.dataset.hay.includes(w)); r.hidden = !ok; if (ok) n++; });
      g.hidden = !n;
      g.querySelector('[data-n]').textContent = fmtNum(n);
      if (n) any = true;
    });
    panel.querySelector('[data-nomatch]').hidden = any;
  }, 120));
}

const photoFilter = { status: '' };
function renderPhotos(ctx, S, panel) {
  const { loc, staff } = S;
  if (!S.photos.length) {
    panel.innerHTML = emptyHtml(t('organize.photos.none'), staff ? `<a class="btn primary" href="${IMPORT_HREF(loc.code)}">${icon('upload')}${esc(t('organize.importPhotos'))}</a>` : '');
    return;
  }
  const counts = {};
  S.photos.forEach((p) => { counts[p.status] = (counts[p.status] || 0) + 1; });
  const statuses = ['neu', 'in_analyse', 'analysiert', 'fehler'].filter((s) => counts[s]);
  if (photoFilter.status && !counts[photoFilter.status]) photoFilter.status = '';
  const shown = S.photos.filter((p) => !photoFilter.status || p.status === photoFilter.status);
  const pillCls = { neu: 'pill-muted', in_analyse: 'pill-warn', analysiert: 'pill-ok', fehler: 'pill-danger' };
  // Auswahlmodus (nur Lagerverantwortliche/Admins); Auswahl gilt je Lagerort und übersteht Filterwechsel
  if (photoSel.locId !== loc.id) { photoSel.locId = loc.id; photoSel.on = false; photoSel.ids = new Set(); }
  const valid = new Set(S.photos.map((p) => p.id));
  photoSel.ids = new Set([...photoSel.ids].filter((id) => valid.has(id)));
  const selecting = staff && photoSel.on;
  const tileInner = (p) => `${thumbHtml(p.path, '', 'org-photo-img', 'image')}
      <span class="org-photo-pill"><span class="pill ${pillCls[p.status] || 'pill-muted'}">${esc(photoStatusLabel(p.status))}</span></span>
      ${p.id === loc.cover_photo_id ? `<span class="org-photo-cover" title="${esc(t('organize.visual'))}">${icon('image')}</span>` : ''}
      <span class="org-photo-cap small"><span class="org-ellipsis">${esc(p.location_id === loc.id ? (p.file_name || '') : relPath(S, p.location_id))}</span>
        <span class="muted">${num(p.detection_count) ? esc(t('organize.photos.det', { n: fmtNum(p.detection_count) })) : ''}${num(p.open_count) ? ' · ' + esc(t('organize.photos.open', { n: fmtNum(p.open_count) })) : ''}</span></span>`;
  const tile = (p) => (selecting
    ? `<label class="org-photo selecting${photoSel.ids.has(p.id) ? ' checked' : ''}">
        <input type="checkbox" class="org-photo-check" data-sel="${esc(p.id)}"${photoSel.ids.has(p.id) ? ' checked' : ''} aria-label="${esc(t('organize.sel.pickAria', { name: p.file_name || '' }))}">
        ${tileInner(p)}</label>`
    : `<button type="button" class="org-photo" data-photo="${esc(p.id)}" aria-label="${esc(t('organize.photos.openAria', { name: p.file_name || '' }))}">${tileInner(p)}</button>`);
  panel.innerHTML = `<div class="stack">
    <div class="row org-panel-tools">
      ${statuses.length > 1 ? `<div class="chips" role="group" aria-label="${esc(t('organize.photos.filter'))}">
        <button type="button" class="chip" data-st="" aria-pressed="${!photoFilter.status}">${esc(t('common.all'))} (${fmtNum(S.photos.length)})</button>
        ${statuses.map((s) => `<button type="button" class="chip" data-st="${s}" aria-pressed="${photoFilter.status === s}">${esc(photoStatusLabel(s))} (${fmtNum(counts[s])})</button>`).join('')}
      </div>` : ''}
      ${staff ? `<div class="row">
        <button type="button" class="btn sm${selecting ? ' primary' : ''}" data-selmode aria-pressed="${selecting}">${icon(selecting ? 'check' : 'grid')}${esc(t(selecting ? 'organize.sel.done' : 'organize.sel.start'))}</button>
        ${selecting ? '' : `<a class="btn sm" href="${IMPORT_HREF(loc.code)}">${icon('upload')}${esc(t('organize.importPhotos'))}</a>`}
      </div>` : ''}
    </div>
    ${selecting ? `<p class="small muted">${esc(t('organize.sel.hint'))}</p>` : ''}
    <div class="org-photos${selecting ? ' selecting' : ''}">${shown.map(tile).join('')}</div>
    ${selecting ? `<div class="org-selbar" role="region" aria-label="${esc(t('organize.sel.start'))}">
      <span class="org-selbar-n" data-seln aria-live="polite"></span>
      <button type="button" class="btn sm" data-selall></button>
      <button type="button" class="btn sm primary" data-selmove>${icon('move')}${esc(t('organize.sel.move'))}</button>
    </div>` : ''}
  </div>`;
  hydrateThumbs(panel, ctx.api);
  panel.querySelectorAll('[data-st]').forEach((b) => b.addEventListener('click', () => {
    photoFilter.status = b.dataset.st;
    renderPhotos(ctx, S, panel);
    const nb = panel.querySelector(`[data-st="${b.dataset.st}"]`);
    if (nb) nb.focus();
  }));
  panel.querySelectorAll('[data-photo]').forEach((b) => b.addEventListener('click', () => {
    const p = S.photos.find((x) => x.id === b.dataset.photo);
    if (p) photoViewer(ctx, S, p);
  }));
  const modeBtn = panel.querySelector('[data-selmode]');
  if (modeBtn) modeBtn.addEventListener('click', () => {
    photoSel.on = !photoSel.on;
    if (!photoSel.on) photoSel.ids.clear();
    renderPhotos(ctx, S, panel);
    const nb = panel.querySelector('[data-selmode]');
    if (nb) nb.focus();
  });
  if (!selecting) return;
  const updateBar = () => {
    const n = photoSel.ids.size;
    const allShown = shown.length > 0 && shown.every((p) => photoSel.ids.has(p.id));
    panel.querySelector('[data-seln]').textContent = t('organize.sel.count', { n: fmtNum(n) });
    panel.querySelector('[data-selall]').textContent = t(allShown ? 'organize.sel.clear' : 'organize.sel.all');
    panel.querySelector('[data-selmove]').disabled = !n;
  };
  panel.querySelectorAll('[data-sel]').forEach((c) => c.addEventListener('change', () => {
    if (c.checked) photoSel.ids.add(c.dataset.sel); else photoSel.ids.delete(c.dataset.sel);
    c.closest('.org-photo').classList.toggle('checked', c.checked);
    updateBar();
  }));
  panel.querySelector('[data-selall]').addEventListener('click', () => {
    const allShown = shown.every((p) => photoSel.ids.has(p.id));
    shown.forEach((p) => { if (allShown) photoSel.ids.delete(p.id); else photoSel.ids.add(p.id); });
    panel.querySelectorAll('[data-sel]').forEach((c) => { c.checked = photoSel.ids.has(c.dataset.sel); c.closest('.org-photo').classList.toggle('checked', c.checked); });
    updateBar();
  });
  panel.querySelector('[data-selmove]').addEventListener('click', async () => {
    const photos = S.photos.filter((p) => photoSel.ids.has(p.id));
    if (!photos.length) return;
    const res = await movePhotosSheet(ctx, photos);
    if (res) res.movedIds.forEach((id) => photoSel.ids.delete(id));
    await reportMove(ctx, res);
  });
  updateBar();
}
const photoSel = { locId: null, on: false, ids: new Set() };

/** Fotos in einen anderen Lagerort verschieben: Ziel wählen (mit Pfad), nacheinander verschieben, Fortschritt anzeigen. */
async function movePhotosSheet(ctx, photos) {
  let locs;
  try { locs = await ctx.api.listLocations({}); } catch (err) { toast(errorText(err), 'error'); return null; }
  const cmp = collator();
  locs = (locs || []).filter((l) => !l.archived).sort((a, b) => cmp(a.path || a.name, b.path || b.name));
  const here = new Set(photos.map((p) => p.location_id));
  const body = `<p class="small">${esc(t('organize.move.intro', { n: fmtNum(photos.length) }))}</p>
    <div class="searchbar">${icon('search')}<input type="search" data-mfilter aria-label="${esc(t('organize.move.filter'))}" placeholder="${esc(t('organize.move.filterPh'))}" autocomplete="off"></div>
    <div class="org-move-list" role="radiogroup" aria-label="${esc(t('organize.hs.location'))}">${locs.map((l) => `<label class="org-move-row"
        data-hay="${esc(norm([l.path, l.name, l.code, l.code_path].join(' ')))}">
      <input type="radio" name="target" value="${esc(l.id)}">
      <span class="org-move-main"><b>${esc(l.path || l.name)}</b>
        <small class="muted">${esc(locTypeLabel(l.type))} · <span class="mono">${esc([l.code_path, l.code].filter(Boolean).join(' · '))}</span></small></span>
      ${here.size === 1 && here.has(l.id) ? `<span class="pill pill-muted">${esc(t('organize.move.current'))}</span>` : ''}
    </label>`).join('')}</div>
    <p class="small muted" data-mnone hidden>${esc(t('organize.move.noMatch'))}</p>
    <p class="small" data-mprog aria-live="polite"></p>`;
  return sheet({
    title: t('organize.move.title'), wide: true, body,
    actions: [
      { label: t('btn.cancel'), kind: 'ghost', value: null },
      { label: t('organize.move.go'), kind: 'primary', icon: 'move', onClick: async (el) => {
        const r = el.querySelector('input[name=target]:checked');
        if (!r) return sheetError(el, t('organize.move.pick'));
        const target = locs.find((l) => l.id === r.value);
        el.querySelectorAll('input').forEach((x) => { x.disabled = true; });
        const prog = el.querySelector('[data-mprog]');
        const res = { target, ok: 0, skipped: 0, failed: [], movedIds: [] };
        let i = 0;
        for (const p of photos) {
          i++;
          if (p.location_id === target.id) { res.skipped++; continue; }
          try {
            await ctx.api.movePhoto(p.id, target.id);
            res.ok++; res.movedIds.push(p.id);
          } catch (err) { res.failed.push({ photo: p, err }); }
          prog.textContent = t('organize.move.progress', { done: fmtNum(i), n: fmtNum(photos.length) });
        }
        return res;
      } },
    ],
    onOpen: (el) => {
      const f = el.querySelector('[data-mfilter]');
      f.addEventListener('input', debounce(() => {
        const words = norm(f.value).split(' ').filter(Boolean);
        let any = false;
        el.querySelectorAll('.org-move-row').forEach((row) => {
          const ok = words.every((w) => row.dataset.hay.includes(w));
          row.hidden = !ok && !row.querySelector('input').checked;
          if (!row.hidden) any = true;
        });
        el.querySelector('[data-mnone]').hidden = any;
      }, 120));
    },
  }).then((v) => (v && typeof v === 'object' ? v : null));
}
async function reportMove(ctx, res) {
  if (!res) return;
  const name = res.target ? (res.target.path || res.target.name) : '';
  if (res.failed.length) {
    await sheet({
      title: t('organize.move.report'),
      body: `<p>${esc(t('organize.move.reportText', { ok: fmtNum(res.ok), failed: fmtNum(res.failed.length) }))}</p>
        ${res.skipped ? `<p class="small muted">${esc(t('organize.move.skipped', { n: fmtNum(res.skipped) }))}</p>` : ''}
        <ul class="org-report">${res.failed.map((f) => `<li><b>${esc(f.photo.file_name || f.photo.id)}</b>: ${esc(errorText(f.err))}</li>`).join('')}</ul>`,
      actions: [{ label: t('btn.close'), kind: 'primary', value: true }],
    });
  } else {
    toast(t('organize.move.doneAll', { name, n: fmtNum(res.ok) }) + (res.skipped ? ' · ' + t('organize.move.skipped', { n: fmtNum(res.skipped) }) : ''));
  }
  if (res.ok) ctx.reload();
}

async function photoViewer(ctx, S, photo) {
  const { loc, staff } = S;
  const rootCode = S.root && S.root.code;
  const ar = num(photo.width) && num(photo.height) ? num(photo.width) / num(photo.height) : null;
  const obs = Array.isArray(photo.observations) ? photo.observations.map(clean).filter(Boolean) : [];
  const pillCls = { neu: 'pill-muted', in_analyse: 'pill-warn', analysiert: 'pill-ok', fehler: 'pill-danger' };
  const body = `
    <div class="row small"><span class="pill ${pillCls[photo.status] || 'pill-muted'}">${esc(photoStatusLabel(photo.status))}</span>
      <span class="muted org-ellipsis">${esc([photo.location_path, photo.file_name].filter(Boolean).join(' · '))}</span></div>
    ${photo.status === 'fehler' && photo.analysis_error ? `<div class="alert danger">${icon('alert')}<span>${esc(t('organize.viewer.error', { error: photo.analysis_error }))}</span></div>` : ''}
    ${stageHtml(photo.path, t('organize.photoAlt', { name: photo.file_name || '' }), ar)}
    <div class="org-legend small" aria-hidden="true">
      <span><i class="org-dot-sw c-sicher"></i>${esc(confidenceLabel('sicher'))}</span>
      <span><i class="org-dot-sw c-wahrscheinlich"></i>${esc(confidenceLabel('wahrscheinlich'))}</span>
      <span><i class="org-dot-sw c-unbekannt"></i>${esc(confidenceLabel('unbekannt'))}</span>
    </div>
    <div class="org-det-info" data-info aria-live="polite"><p class="small muted">${esc(t('common.loading'))}</p></div>
    <div data-dets></div>
    ${photo.scene || obs.length ? `<div class="org-photo-meta small">
      ${photo.scene ? `<p><b>${esc(t('organize.viewer.scene'))}:</b> ${esc(photo.scene)}${photo.area ? ' · ' + esc(photo.area) : ''}</p>` : ''}
      ${obs.length ? `<p><b>${esc(t('organize.viewer.findings'))}:</b></p><ul>${obs.map((o) => `<li>${esc(o)}</li>`).join('')}</ul>` : ''}
    </div>` : ''}`;
  const actions = [];
  if (staff) {
    actions.push({ label: t('organize.viewer.delete'), kind: 'danger-outline', icon: 'trash', value: 'delete' });
    actions.push({ label: t('organize.viewer.move'), kind: '', icon: 'move', value: 'move' });
  }
  if (staff && photo.id !== loc.cover_photo_id) {
    actions.push({ label: t('organize.viewer.useCover'), kind: '', icon: 'image', onClick: async () => {
      await ctx.api.saveLocation({ id: loc.id, cover_photo_id: photo.id });
      return 'cover';
    } });
  }
  actions.push({ label: t('btn.close'), kind: 'primary', value: null });
  const r = await sheet({
    title: photo.file_name || t('organize.tab.photos'), wide: true, body, actions,
    onOpen: async (el, close) => {
      closeOnNav(el, close);
      const stage = el.querySelector('[data-stage]');
      const layer = stage.querySelector('[data-layer]');
      bindStageImage(stage);
      hydrateThumbs(el, ctx.api);
      stage.addEventListener('click', (e) => {
        if (e.target.closest('.org-dot')) return;
        const img = stage.querySelector('img[src]');
        if (img) openLightbox(img.src, photo.file_name || '');
      });
      const info = el.querySelector('[data-info]');
      const listBox = el.querySelector('[data-dets]');
      let dets = [];
      try { dets = await ctx.api.listDetections({ photoId: photo.id }); } catch (err) {
        info.innerHTML = `<div class="alert danger">${icon('alert')}<span>${esc(errorText(err))}</span></div>`;
        return;
      }
      dets = (dets || []).filter((d) => d.status !== 'abgelehnt' && d.status !== 'zusammengefuehrt');
      if (!dets.length) { info.innerHTML = `<p class="small muted">${esc(t('organize.viewer.noDets'))}</p>`; return; }
      const withPos = dets.filter((d) => d.pos_x !== null && d.pos_x !== undefined && d.pos_y !== null && d.pos_y !== undefined);
      layer.innerHTML = withPos.map((d) => `<button type="button" class="org-dot c-${esc(d.confidence || 'unbekannt')}" data-det="${esc(d.id)}"
        style="left:${pct(d.pos_x)};top:${pct(d.pos_y)}" aria-pressed="false" aria-label="${esc(t('organize.viewer.dotAria', { name: d.name, conf: confidenceLabel(d.confidence) }))}"></button>`).join('');
      listBox.innerHTML = `<h3 class="org-subh">${esc(t('organize.viewer.dets'))} (${fmtNum(dets.length)})</h3>
        <div class="org-det-list">${dets.map((d) => `<button type="button" class="org-det-btn" data-det="${esc(d.id)}" aria-pressed="false">
          <i class="org-dot-sw c-${esc(d.confidence || 'unbekannt')}" aria-hidden="true"></i><span class="org-ellipsis">${esc(d.name)}</span>
          ${withPos.includes(d) ? '' : `<small class="muted">${esc(t('organize.viewer.noPos'))}</small>`}</button>`).join('')}</div>`;
      const show = (id) => {
        const d = dets.find((x) => x.id === id);
        el.querySelectorAll('[data-det]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.det === id)));
        if (!d) return;
        const bm = [d.brand, d.model].map(clean).filter(Boolean).join(' ');
        const qty = d.quantity !== null && d.quantity !== undefined
          ? `${fmtQty(d.quantity, d.unit)}${d.quantity_certain ? '' : ' (' + t('organize.viewer.qtyUncertain') + ')'}` : '';
        const inv = d.machine_code ? `<a href="#/m/${enc(d.machine_code)}">${esc(d.machine_name || d.machine_code)}</a>`
          : d.article_code ? `<a href="#/a/${enc(d.article_code)}">${esc(d.article_name || d.article_code)}</a>`
            : d.location_ref_code ? `<a href="#/o/${enc(d.location_ref_code)}">${esc(d.location_ref_name || d.location_ref_code)}</a>` : '';
        info.innerHTML = `<div class="card org-det-card">
          <h3>${esc(d.name)}</h3>
          ${bm ? `<p class="small">${esc(bm)}</p>` : ''}
          <div class="row small">${confidencePill(d.confidence)}<span class="pill ${isOpenDet(d) ? 'pill-warn' : 'pill-ok'}">${esc(detectionStatusLabel(d.status))}</span>
            ${d.kind && d.kind !== 'unbekannt' ? `<span class="muted">${esc(kindLabel(d.kind))}</span>` : ''}</div>
          ${d.category_path || d.category_text ? `<p class="small muted">${esc(d.category_path || d.category_text)}</p>` : ''}
          ${qty ? `<p class="small">${esc(t('common.quantity'))}: ${esc(qty)}</p>` : ''}
          ${inv ? `<p class="small">${esc(t('organize.inventory'))}: ${inv}</p>` : ''}
          ${isOpenDet(d) ? `<a class="btn sm" href="${REVIEW_HREF(rootCode)}">${icon('check')}${esc(t('organize.viewer.toReview'))}</a>` : ''}
        </div>`;
      };
      el.querySelectorAll('[data-det]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); show(b.dataset.det); }));
      info.innerHTML = `<p class="small muted">${esc(t('organize.viewer.tapHint'))}</p>`;
    },
  });
  if (r === 'cover') { toast(t('organize.cover.saved')); ctx.reload(); return; }
  if (r === 'move') { await reportMove(ctx, await movePhotosSheet(ctx, [photo])); return; }
  if (r === 'delete') {
    if (!(await confirmSheet(t('organize.del.q'), t('organize.del.msg', { name: photo.file_name || '' }), { okLabel: t('btn.delete'), danger: true }))) return;
    try {
      await ctx.api.deletePhoto(photo);
      toast(t('organize.del.done'));
      ctx.reload();
    } catch (err) {
      if (err && err.code === 'in_use') {
        await sheet({ title: t('organize.del.inUseTitle'), body: `<p>${esc(t('organize.del.inUse'))}</p>`,
          actions: [{ label: t('organize.viewer.move'), kind: '', icon: 'move', value: 'move' }, { label: t('btn.close'), kind: 'primary', value: null }] })
          .then(async (v) => { if (v === 'move') await reportMove(ctx, await movePhotosSheet(ctx, [photo])); });
      } else toast(errorText(err), 'error');
    }
  }
}

function renderPlan(ctx, S, panel) {
  const { staff } = S;
  const open = S.tasks.filter((x) => x.status === 'offen');
  const done = S.tasks.filter((x) => x.status === 'erledigt');
  const dropped = S.tasks.filter((x) => x.status === 'verworfen');
  const row = (x) => {
    const meta = [
      sourceLabel(x.source),
      x.location_id !== S.loc.id ? t('organize.plan.in', { path: relPath(S, x.location_id) }) : '',
      x.assigned_name ? t('organize.plan.assigned', { name: x.assigned_name }) : '',
      x.status === 'erledigt' && x.done_at ? t('organize.plan.doneBy', { name: x.done_by_name || '–', date: fmtDate(x.done_at) }) : '',
    ].filter(Boolean).join(' · ');
    const check = x.status === 'verworfen' ? `<span class="org-task-ic muted" aria-hidden="true">${icon('x')}</span>`
      : staff ? `<input type="checkbox" class="org-task-check" data-toggle="${esc(x.id)}"${x.status === 'erledigt' ? ' checked' : ''} aria-label="${esc(t('organize.plan.doneAria', { title: x.title }))}">`
        : `<span class="org-task-ic${x.status === 'erledigt' ? ' ok' : ''}" aria-hidden="true">${icon(x.status === 'erledigt' ? 'check' : 'clock')}</span>`;
    return `<li class="org-task${x.status !== 'offen' ? ' is-done' : ''}">
      ${check}
      <div class="org-task-main"><span class="org-task-title">${esc(x.title)}</span>
        ${x.details ? `<span class="small org-task-details">${esc(x.details)}</span>` : ''}
        <span class="small muted">${esc(meta)}</span></div>
      ${staff ? `<button type="button" class="icon-btn" data-edit-task="${esc(x.id)}" aria-label="${esc(t('organize.plan.editAria', { title: x.title }))}">${icon('edit')}</button>` : ''}
    </li>`;
  };
  panel.innerHTML = `<div class="stack">
    ${staff ? `<div class="row org-panel-tools"><button type="button" class="btn" data-propose>${icon('sparkle')}${esc(t('organize.plan.propose'))}</button></div>` : ''}
    ${S.tasks.length ? '' : `<p class="muted">${esc(t(staff ? 'organize.plan.noneStaff' : 'organize.plan.none'))}</p>`}
    ${open.length ? `<ul class="org-tasks">${open.map(row).join('')}</ul>` : ''}
    ${done.length ? `<details class="org-more"${open.length ? '' : ' open'}><summary>${esc(t('organize.plan.doneN', { n: fmtNum(done.length) }))}</summary>
      <ul class="org-tasks">${done.map(row).join('')}</ul></details>` : ''}
    ${dropped.length ? `<details class="org-more"><summary>${esc(t('organize.plan.droppedN', { n: fmtNum(dropped.length) }))}</summary>
      <ul class="org-tasks">${dropped.map(row).join('')}</ul></details>` : ''}
    ${staff ? `<form class="card org-quick" data-add-task novalidate>
      <h3>${icon('plus')}${esc(t('organize.plan.add'))}</h3>
      <div class="form">
        <div class="field full"><label for="tk-title">${esc(t('organize.plan.title'))} <span aria-hidden="true">*</span></label>
          <input id="tk-title" name="title" type="text" maxlength="300" autocomplete="off" placeholder="${esc(t('organize.plan.titlePh'))}"></div>
        <div class="field"><label for="tk-assign">${esc(t('organize.plan.assign'))}</label><select id="tk-assign" name="assigned_to">${profileOptions(S.profiles, null)}</select></div>
        <div class="field" style="justify-content:flex-end"><button type="submit" class="btn primary">${icon('plus')}${esc(t('organize.plan.add'))}</button></div>
      </div>
      <div class="alert danger" data-err role="alert" hidden></div>
    </form>` : ''}
  </div>`;
  panel.querySelectorAll('[data-toggle]').forEach((c) => c.addEventListener('change', async () => {
    c.disabled = true;
    try {
      await ctx.api.saveTask({ id: c.dataset.toggle, status: c.checked ? 'erledigt' : 'offen' });
      ctx.reload();
    } catch (err) { c.checked = !c.checked; c.disabled = false; toast(errorText(err), 'error'); }
  }));
  panel.querySelectorAll('[data-edit-task]').forEach((b) => b.addEventListener('click', () => {
    const x = S.tasks.find((y) => y.id === b.dataset.editTask);
    if (x) editTaskSheet(ctx, S, x);
  }));
  const pb = panel.querySelector('[data-propose]');
  if (pb) pb.addEventListener('click', () => proposalSheet(ctx, S));
  const form = panel.querySelector('[data-add-task]');
  if (form) {
    const err = form.querySelector('[data-err]');
    let busy = false;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (busy) return;
      err.hidden = true;
      const title = clean(form.elements.title.value);
      if (!title) { err.textContent = t('err.invalid_input'); err.hidden = false; form.elements.title.focus(); return; }
      busy = true;
      try {
        await ctx.api.saveTask({ location_id: S.loc.id, title, source: 'manuell', assigned_to: form.elements.assigned_to.value || null,
          sort: S.tasks.reduce((m, x) => Math.max(m, num(x.sort)), 0) + 1 });
        toast(t('organize.plan.added'));
        ctx.reload();
      } catch (ex) { err.textContent = errorText(ex); err.hidden = false; } finally { busy = false; }
    });
  }
}

async function editTaskSheet(ctx, S, x) {
  const body = `<div class="form">
    <div class="field full"><label for="te-title">${esc(t('organize.plan.title'))}</label>
      <input id="te-title" type="text" maxlength="300" value="${esc(x.title)}" autocomplete="off"></div>
    <div class="field full"><label for="te-details">${esc(t('organize.plan.details'))}</label>
      <textarea id="te-details" maxlength="2000">${esc(x.details || '')}</textarea></div>
    <div class="field"><label for="te-assign">${esc(t('organize.plan.assign'))}</label><select id="te-assign">${profileOptions(S.profiles, x.assigned_to)}</select></div>
    <div class="field"><label for="te-status">${esc(t('organize.plan.status'))}</label>
      <select id="te-status">${['offen', 'erledigt', 'verworfen'].map((s) => `<option value="${s}"${s === x.status ? ' selected' : ''}>${esc(taskStatusLabel(s))}</option>`).join('')}</select></div>
    <p class="small muted field full">${esc(t('organize.plan.source', { src: sourceLabel(x.source) }))}${x.created_by_name ? ' · ' + esc(x.created_by_name) : ''}</p>
  </div>`;
  const ok = await sheet({
    title: t('organize.plan.edit'), body,
    actions: [
      { label: t('btn.cancel'), kind: 'ghost', value: false },
      { label: t('btn.save'), kind: 'primary', icon: 'check', onClick: async (el) => {
        const title = clean(el.querySelector('#te-title').value);
        if (!title) return sheetError(el, t('err.invalid_input'));
        const details = String(el.querySelector('#te-details').value || '').trim();
        await ctx.api.saveTask({ id: x.id, title, details: details || null, assigned_to: el.querySelector('#te-assign').value || null,
          status: el.querySelector('#te-status').value });
        return true;
      } },
    ],
  });
  if (ok === true) { toast(t('organize.plan.saved')); ctx.reload(); }
}

// ---------- «Mit KI organisieren» ----------
function photoCounts(photos) {
  const c = { total: photos.length, neu: 0, in_analyse: 0, analysiert: 0, fehler: 0, det: 0, open: 0 };
  for (const p of photos) {
    if (c[p.status] !== undefined) c[p.status]++;
    c.det += num(p.detection_count);
    c.open += num(p.open_count);
  }
  return c;
}
async function kiSheet(ctx, S) {
  const { loc, staff } = S;
  const rootCode = S.root && S.root.code;
  const st = { photos: S.photos, organized_at: loc.organized_at, dirty: false, closeErr: '' };
  const labelRows = [loc, ...S.desc.map((d) => d.l)];
  const step = (n, done, title, inner) => `<li class="org-step${done ? ' done' : ''}">
      <span class="org-step-n" aria-hidden="true">${done ? icon('check') : n}</span>
      <div class="org-step-body"><h3>${esc(title)}${done ? ` <span class="sr-only">(${esc(t('organize.ki.done'))})</span>` : ''}</h3>${inner}</div></li>`;
  const html = () => {
    const c = photoCounts(st.photos);
    const tOpen = S.tasks.filter((x) => x.status === 'offen').length;
    const tDone = S.tasks.filter((x) => x.status === 'erledigt').length;
    const counters = `<div class="org-counters">
      <span><b>${fmtNum(c.neu)}</b> ${esc(t('organize.ki.cNew'))}</span><span><b>${fmtNum(c.in_analyse)}</b> ${esc(t('organize.ki.cQueued'))}</span>
      <span><b>${fmtNum(c.analysiert)}</b> ${esc(t('organize.ki.cDone'))}</span><span class="${c.fehler ? 'org-bad' : ''}"><b>${fmtNum(c.fehler)}</b> ${esc(t('organize.ki.cFailed'))}</span></div>`;
    return `<ol class="org-steps">
      ${step(1, c.total > 0, t('organize.ki.s1'), `<p class="small">${esc(t('organize.ki.s1n', { n: fmtNum(c.total) }))}</p>
        ${staff ? `<a class="btn sm" href="${IMPORT_HREF(loc.code)}">${icon('upload')}${esc(t('organize.importPhotos'))}</a>` : ''}`)}
      ${step(2, c.total > 0 && !c.neu && !c.fehler, t('organize.ki.s2'), `${counters}<p class="hint">${esc(t('organize.ki.s2hint'))}</p>
        ${staff ? `<div class="row"><button type="button" class="btn sm" data-ki="queue"${c.neu ? '' : ' disabled'}>${icon('clock')}${esc(t('organize.ki.queueNew', { n: fmtNum(c.neu) }))}</button>
          ${c.fehler ? `<button type="button" class="btn sm" data-ki="requeue">${icon('history')}${esc(t('organize.ki.requeue', { n: fmtNum(c.fehler) }))}</button>` : ''}</div>` : ''}`)}
      ${step(3, c.analysiert > 0 && !c.in_analyse, t('organize.ki.s3'), `<p class="hint">${esc(t('organize.ki.s3hint'))}</p>
        ${staff ? `<a class="btn sm" href="${IMPORT_ANALYSIS_HREF(loc.code)}">${icon('file')}${esc(t('organize.ki.s3'))}</a>` : ''}`)}
      ${step(4, c.det > 0 && !c.open, t('organize.ki.s4'), `<p class="small">${esc(t('organize.ki.s4n', { open: fmtNum(c.open), total: fmtNum(c.det) }))}</p>
        <a class="btn sm${c.open ? ' primary' : ''}" href="${REVIEW_HREF(rootCode)}">${icon('check')}${esc(t('organize.ki.s4btn', { n: fmtNum(c.open) }))}</a>`)}
      ${step(5, S.tasks.length > 0 && !tOpen, t('organize.ki.s5'), `<p class="small">${esc(t('organize.ki.s5n', { open: fmtNum(tOpen), done: fmtNum(tDone) }))}</p>
        ${staff ? `<button type="button" class="btn sm" data-ki="propose">${icon('sparkle')}${esc(t('organize.plan.propose'))}</button>` : ''}`)}
      ${step(6, false, t('organize.ki.s6'), `<p class="small">${esc(t('organize.ki.s6n', { n: fmtNum(labelRows.length) }))}</p>
        ${staff ? `<button type="button" class="btn sm" data-ki="labels">${icon('print')}${esc(t('organize.ki.s6btn'))}</button>` : ''}`)}
      ${step(7, !!st.organized_at, t('organize.ki.s7'), `${st.organized_at
        ? `<p class="small"><span class="pill pill-ok">${icon('check')}${esc(t('organize.organizedSince', { date: fmtDate(st.organized_at) }))}</span></p>
           ${staff ? `<button type="button" class="btn sm" data-ki="reopen">${icon('history')}${esc(t('organize.ki.reopen'))}</button>` : ''}`
        : `<p class="small">${esc(c.open || tOpen ? t('organize.ki.s7open', { det: fmtNum(c.open), tasks: fmtNum(tOpen) }) : t('organize.ki.s7ready'))}</p>
           ${st.closeErr ? `<div class="alert danger" role="alert">${icon('alert')}<span>${esc(st.closeErr)}</span></div>` : ''}
           ${staff ? `<button type="button" class="btn sm${c.open || tOpen ? '' : ' primary'}" data-ki="close">${icon('check')}${esc(t('organize.ki.s7btn'))}</button>` : ''}`}`)}
    </ol>
    ${staff ? '' : `<p class="small muted">${esc(t('organize.ki.readOnly'))}</p>`}`;
  };
  const refreshPhotos = async () => {
    const rows = await ctx.api.listPhotos({ spaceId: S.rootId });
    st.photos = (rows || []).filter((p) => S.sub.has(p.location_id));
  };
  const next = await sheet({
    title: t('organize.aiOrganize'), wide: true,
    body: `<div class="alert">${icon('sparkle')}<span>${esc(t('organize.ki.honest'))}</span></div><div data-steps></div>`,
    actions: [{ label: t('btn.close'), kind: 'ghost', value: null }],
    onOpen: (el, close) => {
      closeOnNav(el, close);
      const box = el.querySelector('[data-steps]');
      const render = () => { box.innerHTML = html(); };
      render();
      box.addEventListener('click', async (e) => {
        const b = e.target.closest('[data-ki]');
        if (!b || b.disabled) return;
        const act = b.dataset.ki;
        if (act === 'propose') { close('propose'); return; }
        if (act === 'labels') { close('labels'); return; }
        b.disabled = true;
        try {
          if (act === 'queue' || act === 'requeue') {
            const ids = st.photos.filter((p) => p.status === (act === 'queue' ? 'neu' : 'fehler')).map((p) => p.id);
            const n = await ctx.api.setPhotoStatus(ids, 'in_analyse');
            toast(t('organize.ki.queued', { n: fmtNum(typeof n === 'number' ? n : ids.length) }));
            st.dirty = true;
            await refreshPhotos();
          } else if (act === 'close') {
            st.closeErr = '';
            try {
              const row = await ctx.api.setLocationOrganized(loc.id, true);
              st.organized_at = (row && row.organized_at) || new Date().toISOString();
              st.dirty = true;
              toast(t('organize.ki.closed'));
            } catch (err) { st.closeErr = errorText(err); }
          } else if (act === 'reopen') {
            await ctx.api.setLocationOrganized(loc.id, false);
            st.organized_at = null;
            st.dirty = true;
            toast(t('organize.ki.reopened'));
          }
        } catch (err) { toast(errorText(err), 'error'); }
        render();
        const again = box.querySelector(`[data-ki="${act}"]`);
        if (again && !again.disabled) again.focus();
      });
    },
  });
  if (next === 'propose') { await proposalSheet(ctx, S); if (st.dirty) ctx.reload(); return; }
  if (next === 'labels') { await printLocationLabels(labelRows); }
  if (st.dirty) ctx.reload();
}

// ---------- Organisationsvorschlag (regelbasiert aus echten Daten) ----------
function buildProposal(S, dets) {
  const existing = new Set(S.tasks.map((x) => norm(x.title)));
  const out = [];
  const add = (title, details, extra = {}) => {
    const tt = clip(title, 300);
    if (out.some((o) => norm(o.title) === norm(tt))) return;
    out.push({ title: tt, details: clip(details, 1000), exists: existing.has(norm(tt)), ...extra });
  };
  const open = dets.filter(isOpenDet);
  // 1) je Oberkategorie mit ≥ 3 Objekten (inventarisiert + noch offene Erkennungen; bestätigte sind schon Inventar)
  const groups = new Map();
  const push = (path, name) => { const k = topCat(path); if (!k || !clean(name)) return; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(clean(name)); };
  S.machines.forEach((m) => push(m.category_path, m.name));
  S.articles.forEach((a) => push(a.category_path, a.name));
  const seenKey = new Set();
  open.filter((d) => d.kind !== 'einrichtung').forEach((d) => {
    if (d.obj_key && seenKey.has(d.obj_key)) return;    // gleiches Objekt auf mehreren Fotos nur einmal zählen
    if (d.obj_key) seenKey.add(d.obj_key);
    push(d.category_path || d.category_text, d.name);
  });
  [...groups].filter(([, names]) => names.length >= 3).sort((a, b) => b[1].length - a[1].length).forEach(([cat, names]) => {
    add(t('organize.prop.area', { cat, n: fmtNum(names.length), names: nameList(names, 3) }), t('organize.prop.areaWhy', { n: fmtNum(names.length), cat }));
  });
  // 2) vorgeschlagene Lagerorte (offene Erkennungen «Einrichtung»)
  const seenLoc = new Set();
  open.filter((d) => d.kind === 'einrichtung').forEach((d) => {
    const k = d.obj_key || norm(d.name);
    if (seenLoc.has(k)) return;
    seenLoc.add(k);
    add(t('organize.prop.newLoc', { name: clean(d.name) }), t('organize.prop.newLocWhy') + (d.photo_file_name ? ` (${d.photo_file_name})` : ''), { photo_id: d.photo_id });
  });
  // 3) offene Erkennungen prüfen
  if (open.length) add(plural('organize.prop.review', open.length), t('organize.prop.reviewWhy'));
  // 4) unsichere Mengen
  const unc = open.filter((d) => d.kind === 'bestandsartikel' && !d.quantity_certain);
  if (unc.length) add(t('organize.prop.count', { names: nameList(unc.map((d) => d.name), 5) }), t('organize.prop.countWhy'));
  // 5) Unterorte ohne Kurzcode
  const noShort = S.desc.filter(({ l }) => !l.short_code).map(({ l }) => l.name);
  if (noShort.length) add(t('organize.prop.codes'), t('organize.prop.codesWhy', { names: nameList(noShort, 8) }));
  // 6) Unterorte ohne Übersichtsfoto
  const noCover = S.children.filter((c) => !c.cover_photo_id).map((c) => c.name);
  if (noCover.length) add(t('organize.prop.covers', { names: nameList(noCover, 5) }), t('organize.prop.coversWhy'));
  // 7) zuletzt: Organisation bestätigen
  if (!S.loc.organized_at) add(t('organize.prop.confirm'), t('organize.prop.confirmWhy'));
  return out;
}

async function proposalSheet(ctx, S) {
  if (!S.staff) return;
  let dets;
  try { dets = await loadDetections(ctx, S); } catch (err) { toast(errorText(err), 'error'); return; }
  const all = buildProposal(S, dets);
  const fresh = all.filter((x) => !x.exists);
  const body = `<p class="small">${esc(t('organize.prop.intro'))}</p>
    <p class="small muted">${esc(t('organize.plan.source', { src: sourceLabel('regel') }))}</p>
    ${fresh.length ? `<ul class="org-prop">${fresh.map((x, i) => `<li><label class="org-prop-item">
      <input type="checkbox" data-i="${i}" checked><span><b>${esc(x.title)}</b><small class="muted">${esc(x.details)}</small></span></label></li>`).join('')}</ul>`
      : `<div class="alert ok">${icon('check')}<span>${esc(t('organize.prop.none'))}</span></div>`}
    ${all.length > fresh.length ? `<details class="org-more"><summary>${esc(t('organize.imp.inPlan'))} (${fmtNum(all.length - fresh.length)})</summary>
      <ul class="org-prop muted">${all.filter((x) => x.exists).map((x) => `<li><span class="small">${esc(x.title)}</span></li>`).join('')}</ul></details>` : ''}`;
  const n = await sheet({
    title: t('organize.prop.title'), wide: true, body,
    actions: fresh.length ? [
      { label: t('btn.cancel'), kind: 'ghost', value: 0 },
      { label: t('organize.prop.add'), kind: 'primary', icon: 'check', onClick: async (el) => {
        const picked = [...el.querySelectorAll('input[data-i]:checked')].map((c) => fresh[+c.dataset.i]);
        if (!picked.length) return sheetError(el, t('organize.prop.nothingChecked'));
        let sort = S.tasks.reduce((m, x) => Math.max(m, num(x.sort)), 0);
        let done = 0;
        for (const x of picked) {
          try {
            await ctx.api.saveTask({ location_id: S.loc.id, title: x.title, details: x.details || null, source: 'regel', photo_id: x.photo_id || null, sort: ++sort });
            done++;
            const box = el.querySelector(`input[data-i="${fresh.indexOf(x)}"]`);
            if (box) { box.checked = false; box.disabled = true; }
          } catch (err) {
            if (done) { toast(t('organize.prop.added', { n: fmtNum(done) })); ctx.reload(); }
            return sheetError(el, errorText(err));
          }
        }
        return done;
      } },
    ] : [{ label: t('btn.close'), kind: 'primary', value: 0 }],
  });
  if (n) {
    toast(t('organize.prop.added', { n: fmtNum(n) }));
    try { history.replaceState(null, '', '#/o/' + enc(S.loc.code) + '?tab=plan'); } catch (e) { /* egal */ }
    ctx.reload();
  }
}

// ---------- «Was soll ich hier verbessern?» ----------
// Wortstämme (erste 6 Buchstaben), damit «beschriften» und «beschriftet» zusammenpassen
const stems = (s) => new Set(norm(s).split(/[^a-z0-9]+/).filter((w) => w.length > 3).map((w) => w.slice(0, 6)));
/** Passender Befund zu einer Empfehlung: grösste Überschneidung der Wortstämme (bei Gleichstand gleiche Position);
 *  ohne Überschneidung nur dann die gleiche Position, wenn beide Listen gleich lang sind. Nie erfunden. */
function matchingFinding(rec, observations, idx, nRecs) {
  const obs = (observations || []).map(clean).filter(Boolean);
  if (!obs.length) return '';
  const rw = stems(rec);
  let best = -1;
  let score = 0;
  obs.forEach((o, i) => {
    let s = 0;
    stems(o).forEach((w) => { if (rw.has(w)) s++; });
    if (s > score || (s > 0 && s === score && i === idx)) { score = s; best = i; }
  });
  if (best >= 0) return obs[best];
  return obs.length === nRecs ? (obs[idx] || '') : '';
}
function collectRecommendations(S) {
  const groups = new Map();
  for (const p of S.photos) {
    const recs = Array.isArray(p.recommendations) ? p.recommendations.map(clean).filter(Boolean) : [];
    recs.forEach((r, i) => {
      const k = norm(r);
      if (!groups.has(k)) groups.set(k, { text: r, items: [] });
      groups.get(k).items.push({ photo: p, finding: matchingFinding(r, p.observations, i, recs.length) });
    });
  }
  return [...groups.values()].sort((a, b) => b.items.length - a.items.length);
}
function linkList(rows, max = 5) {
  const shown = rows.slice(0, max).map((r) => `<a href="${r.href}">${esc(r.name)}</a>`).join(', ');
  return shown + (rows.length > max ? ` <span class="muted">${esc(t('organize.imp.more', { n: fmtNum(rows.length - max) }))}</span>` : '');
}
function dataChecks(S, dets) {
  const out = [];
  const rootCode = S.root && S.root.code;
  const review = { label: t('organize.imp.review'), href: REVIEW_HREF(rootCode) };
  const open = dets.filter(isOpenDet);
  const machineSet = new Set(S.machines);
  const isMachine = (x) => machineSet.has(x);
  const itemRef = (x) => (isMachine(x) ? { href: '#/m/' + enc(x.code), name: x.name } : { href: '#/a/' + enc(x.code), name: x.name });
  if (open.length) out.push({ title: t('organize.imp.open', { n: fmtNum(open.length) }), why: t('organize.imp.openWhy'), actions: [review] });
  const unknown = open.filter((d) => d.confidence === 'unbekannt');
  if (unknown.length) out.push({ title: t('organize.imp.unknown', { n: fmtNum(unknown.length) }), why: t('organize.imp.unknownWhy', { names: nameList(unknown.map((d) => d.name), 5) }), actions: [review] });
  const unc = open.filter((d) => d.kind === 'bestandsartikel' && !d.quantity_certain);
  if (unc.length) out.push({ title: t('organize.imp.qty', { n: fmtNum(unc.length) }), why: t('organize.imp.qtyWhy', { names: nameList(unc.map((d) => d.name), 5) }), actions: [review] });
  const dupKeys = new Map();
  open.filter((d) => num(d.same_key_count) > 0).forEach((d) => { if (!dupKeys.has(d.obj_key)) dupKeys.set(d.obj_key, d.name); });
  if (dupKeys.size) out.push({ title: t('organize.imp.dupDet', { n: fmtNum(dupKeys.size) }), why: t('organize.imp.dupDetWhy', { names: nameList([...dupKeys.values()], 5) }), actions: [review] });
  const inv = [...S.machines, ...S.articles];
  const byBM = new Map();
  inv.forEach((x) => {
    const b = norm(x.brand), m = norm(x.model);
    if (!b || !m) return;
    const k = b + '|' + m + '|' + (isMachine(x) ? 'm' : 'a:' + norm(x.size));
    if (!byBM.has(k)) byBM.set(k, []);
    byBM.get(k).push(x);
  });
  const dupInv = [...byBM.values()].filter((g) => g.length > 1);
  if (dupInv.length) {
    out.push({ title: t('organize.imp.dupInv', { n: fmtNum(dupInv.length) }), why: t('organize.imp.dupInvWhy'),
      links: dupInv.flat().map(itemRef) });
  }
  const noCat = inv.filter((x) => !x.category_id);
  if (noCat.length) out.push({ title: t('organize.imp.noCat', { n: fmtNum(noCat.length) }), why: t('organize.imp.noCatWhy'), links: noCat.map(itemRef) });
  if (S.children.length) {
    const direct = inv.filter((x) => (isMachine(x) ? x.home_location_id : x.location_id) === S.loc.id);
    if (direct.length) out.push({ title: t('organize.imp.direct', { n: fmtNum(direct.length), name: S.loc.name }), why: t('organize.imp.directWhy'), links: direct.map(itemRef) });
  }
  const noShort = S.desc.filter(({ l }) => !l.short_code).map(({ l }) => l);
  if (noShort.length) out.push({ title: t('organize.imp.noShort', { n: fmtNum(noShort.length) }), why: t('organize.imp.noShortWhy', { names: nameList(noShort.map((l) => l.name), 6) }),
    actions: S.staff ? [{ label: t('organize.subs.shortCodes'), act: 'codes' }] : [] });
  const failed = S.photos.filter((p) => p.status === 'fehler');
  if (failed.length) out.push({ title: t('organize.imp.failed', { n: fmtNum(failed.length) }),
    why: t('organize.imp.failedWhy', { names: nameList(failed.map((p) => p.file_name + (p.analysis_error ? ` (${p.analysis_error})` : '')), 4) }),
    actions: S.staff ? [{ label: t('organize.imp.requeue'), act: 'requeue' }] : [] });
  const low = S.articles.filter((a) => a.low_stock);
  if (low.length) out.push({ title: t('organize.imp.low', { n: fmtNum(low.length) }), why: t('organize.imp.lowWhy'), links: low.map(itemRef) });
  return out;
}

async function improveSheet(ctx, S) {
  let dets = [];
  let detErr = null;
  try { dets = await loadDetections(ctx, S); } catch (err) { detErr = err; }
  const recs = collectRecommendations(S);
  const checks = dataChecks(S, dets);
  const titles = new Set(S.tasks.map((x) => norm(x.title)));
  let dirty = false;
  let adopted = 0;
  const recHtml = (g, i) => {
    const first = g.items[0];
    const inPlan = titles.has(norm(clip(g.text, 300)));
    return `<li class="org-rec">
      <div class="org-rec-thumbs">${g.items.slice(0, 3).map((it) => thumbHtml(it.photo.path, it.photo.file_name || '', 'thumb', 'image')).join('')}</div>
      <div class="org-rec-main">
        <b>${esc(g.text)}</b>
        ${first.finding ? `<span class="small">${esc(t('organize.imp.finding', { text: first.finding }))}</span>` : ''}
        <span class="small muted">${esc([sourceLabel('ki'), g.items.length > 1 ? t('organize.imp.onPhotos', { n: fmtNum(g.items.length) }) : (first.photo.file_name || ''),
          first.photo.location_id !== S.loc.id ? relPath(S, first.photo.location_id) : ''].filter(Boolean).join(' · '))}</span>
        ${inPlan ? `<span class="small org-ok">${icon('check')}${esc(t('organize.imp.inPlan'))}</span>`
          : S.staff ? `<div><button type="button" class="btn sm" data-adopt="${i}">${icon('plus')}${esc(t('organize.imp.adopt'))}</button></div>` : ''}
      </div></li>`;
  };
  const checkHtml = (c, i) => `<li class="org-check">
      <span class="org-check-ic" aria-hidden="true">${icon('alert')}</span>
      <div class="org-rec-main"><b>${esc(c.title)}</b><span class="small">${esc(c.why)}</span>
        ${c.links && c.links.length ? `<span class="small">${linkList(c.links)}</span>` : ''}
        ${(c.actions || []).length ? `<div class="row">${c.actions.map((a) => (a.href
          ? `<a class="btn sm" href="${a.href}">${esc(a.label)}</a>`
          : `<button type="button" class="btn sm" data-check="${i}" data-act="${a.act}">${esc(a.label)}</button>`)).join('')}</div>` : ''}
      </div></li>`;
  const body = `
    <section class="stack">
      <h3 class="org-subh">${icon('sparkle')}${esc(t('organize.imp.photoRecs'))}</h3>
      <p class="small muted">${esc(t('organize.imp.source', { src: sourceLabel('ki') }))}</p>
      ${recs.length ? `<ul class="org-recs">${recs.map(recHtml).join('')}</ul>` : `<p class="small muted">${esc(t('organize.imp.photoNone'))}</p>`}
    </section>
    <section class="stack">
      <h3 class="org-subh">${icon('list')}${esc(t('organize.imp.dataChecks'))}</h3>
      <p class="small muted">${esc(t('organize.imp.source', { src: sourceLabel('regel') }))}</p>
      ${detErr ? `<div class="alert danger">${icon('alert')}<span>${esc(errorText(detErr))}</span></div>` : ''}
      ${checks.length ? `<ul class="org-recs">${checks.map(checkHtml).join('')}</ul>` : `<div class="alert ok">${icon('check')}<span>${esc(t('organize.imp.dataNone'))}</span></div>`}
    </section>`;
  const next = await sheet({
    title: t('organize.improve'), wide: true, body,
    actions: [{ label: t('btn.close'), kind: 'primary', value: null }],
    onOpen: (el, close) => {
      closeOnNav(el, close);
      hydrateThumbs(el, ctx.api);
      el.querySelectorAll('[data-adopt]').forEach((b) => b.addEventListener('click', async () => {
        const g = recs[+b.dataset.adopt];
        const first = g.items[0];
        b.disabled = true;
        try {
          await ctx.api.saveTask({
            location_id: S.sub.has(first.photo.location_id) ? first.photo.location_id : S.loc.id,
            title: clip(g.text, 300),
            details: first.finding ? clip(t('organize.imp.finding', { text: first.finding }), 1000) : null,
            source: 'foto_analyse', photo_id: first.photo.id,
            sort: S.tasks.reduce((m, x) => Math.max(m, num(x.sort)), 0) + 1 + (++adopted),
          });
          titles.add(norm(clip(g.text, 300)));
          dirty = true;
          const span = document.createElement('span');
          span.className = 'small org-ok';
          span.innerHTML = `${icon('check')}${esc(t('organize.imp.adopted'))}`;
          b.parentElement.replaceWith(span);
        } catch (err) { b.disabled = false; toast(errorText(err), 'error'); }
      }));
      el.querySelectorAll('[data-check]').forEach((b) => b.addEventListener('click', async () => {
        if (b.dataset.act === 'codes') { close('codes'); return; }
        if (b.dataset.act === 'requeue') {
          b.disabled = true;
          try {
            const ids = S.photos.filter((p) => p.status === 'fehler').map((p) => p.id);
            const n = await ctx.api.setPhotoStatus(ids, 'in_analyse');
            toast(t('organize.ki.queued', { n: fmtNum(typeof n === 'number' ? n : ids.length) }));
            dirty = true;
          } catch (err) { b.disabled = false; toast(errorText(err), 'error'); }
        }
      }));
    },
  });
  if (next === 'codes') { await shortCodesSheet(ctx, S); return; }
  if (dirty) ctx.reload();
}

// ---------------------------------------------------------------------------
// Gebäudeplan ('organisieren/plan') – Grundriss je Stockwerk, Räume als Bereiche auf dem Planbild
// ---------------------------------------------------------------------------
// Farben je Organisationsstand. Der Plan ist immer eine Strichzeichnung auf Weiss (auch im Dunkel-Modus),
// deshalb feste Farben statt Themenvariablen.
const STATUS_COLOR = {
  nicht_erfasst: '#7d7b74', fotos_vorhanden: '#4f7396', in_analyse: '#b87d00',
  zu_pruefen: '#c0392b', in_organisation: '#1e6fb0', organisiert: '#1f8a4c',
};
const LINKED_COLOR = '#4f7396';
const planUi = { editing: null, zoom: 1 };
const PLAN_HREF = (id) => '#/organisieren/plan' + (id ? '?plan=' + enc(id) : '');

/** Kurzcode-Vorschlag für einen neuen Raum aus dem Namen («Kellerabteil 3» → «K3», «Büro» → «BU»), frei auf oberster Ebene */
function suggestRoomCode(name, used) {
  const words = norm(name).toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim().split(' ').filter(Boolean);
  let base = words.length >= 2 ? words.slice(0, 3).map((w) => w[0]).join('') : (words[0] || '').slice(0, 2);
  base = base.slice(0, 8);
  if (!base) return '';
  if (!used.has(base)) return base;
  for (let n = 2; n < 100; n++) { const c = (base + n).slice(0, 10); if (!used.has(c)) return c; }
  return '';
}
/** Möbel (oder anderer Unterort) auf dem Plan: verknüpft, aber kein Raum (oberster Lagerort) – sonst null */
function planItemLoc(P, h) {
  if (!h.location_id || P.spaceById.has(h.location_id)) return null;
  const l = P.locById.get(h.location_id);
  return l && l.parent_id ? l : null;
}
function planAreaName(P, h) {
  const sp = h.location_id ? P.spaceById.get(h.location_id) : null;
  const it = sp ? null : planItemLoc(P, h);
  return clean(h.label) || (sp && sp.name) || (it && it.name) || h.location_name || '?';
}
function planAreaColor(P, h) {
  if (!h.location_id) return null;
  const sp = P.spaceById.get(h.location_id);
  if (sp) return STATUS_COLOR[sp.org_status] || LINKED_COLOR;
  // Möbel in der Farbe ihres Raums
  const it = planItemLoc(P, h);
  const room = it && it.root_id ? P.spaceById.get(it.root_id) : null;
  return (room && STATUS_COLOR[room.org_status]) || LINKED_COLOR;
}
/** Grössere Bereiche zuerst zeichnen, damit Möbel (klein) über ihrem Raum liegen und anklickbar bleiben */
const areaSize = (h) => { const g = hsGeom(h); return g.w ? g.w * g.h : 0; };
/** Räume, in deren linker oberer Ecke ein kleinerer Raum liegt (z. B. WC im Büro): Beschriftung oben rechts,
 *  sonst verdecken sich die beiden Beschriftungen */
function planAltLabelIds(P, areas) {
  const rooms = areas.filter((h) => hsGeom(h).w && !planItemLoc(P, h));
  const ids = new Set();
  for (const r of rooms) {
    const g = hsGeom(r);
    const px = g.x + 0.004, py = g.y + 0.006;
    if (rooms.some((o) => { if (o === r || areaSize(o) >= areaSize(r)) return false; const q = hsGeom(o); return px >= q.x && px <= q.x + q.w && py >= q.y && py <= q.y + q.h; })) ids.add(r.id);
  }
  return ids;
}
function planAreaHtml(P, h, editing, ar = 1.414, altLabel = false) {
  const g = hsGeom(h);
  const sp = h.location_id ? P.spaceById.get(h.location_id) : null;
  const it = sp ? null : planItemLoc(P, h);
  const name = planAreaName(P, h);
  const color = planAreaColor(P, h);
  // schmale, hohe Möbel (Regal an der Wand) bekommen eine senkrechte Beschriftung
  const tall = !!(it && g.w && g.h && g.h / (g.w * ar) > 1.6);
  const cls = `org-hs org-fp ${g.w ? 'rect' : 'pt'} ${h.location_id ? 'linked' : 'unlinked'}${it ? ' item' : ''}${tall ? ' tall' : ''}${altLabel ? ' lbl-alt' : ''}${g.x > 0.7 ? ' lbl-left' : ''}`;
  const style = geomStyle(g) + (color ? `;--c:${color}` : '');
  const short = it ? (clean(h.label) || it.short_code || name) : name;
  const inner = `<span class="org-hs-label">${esc(short)}</span>`;
  if (editing) {
    return `<button type="button" class="${cls}" style="${style}" data-hs="${esc(h.id)}" ${geomData(g)}${color ? ` data-c="${color}"` : ''}
      aria-label="${esc(t('organize.hs.editAria', { name }))}"${it ? ` title="${esc(name)}"` : ''}>${inner}${g.w ? HANDLES : ''}</button>`;
  }
  const code = (sp && sp.code) || (it && it.code) || h.location_code;
  if (h.location_id && code && it) {
    const readable = it.code_path || it.short_code || code;
    return `<a class="${cls}" style="${style}" href="#/o/${enc(code)}" title="${esc(name + ' · ' + readable)}"
      aria-label="${esc(t('organize.fp.itemAria', { name, code: readable }))}">${inner}</a>`;
  }
  if (h.location_id && code) {
    return `<a class="${cls}" style="${style}" href="#/o/${enc(code)}"
      aria-label="${esc(t('organize.fp.openAria', { name, status: sp ? orgStatusLabel(sp.org_status) : t('organize.fp.linkedLabel') }))}">${inner}</a>`;
  }
  if (P.staff) return `<button type="button" class="${cls}" style="${style}" data-unlinked="${esc(h.id)}" aria-label="${esc(t('organize.fp.unlinkedAria', { name }))}">${inner}</button>`;
  return `<span class="${cls}" style="${style}" role="img" aria-label="${esc(t('organize.fp.unlinkedAria', { name }))}">${inner}</span>`;
}
const planAr = (plan) => (num(plan.photo_width) && num(plan.photo_height) ? num(plan.photo_width) / num(plan.photo_height) : 1.414);
const PLAN_ZOOMS = [1, 1.5, 2, 3, 4];
function planStageHtml(plan, inner, extraCls = '') {
  const ar = planAr(plan);
  return `<div class="org-plan-stage${extraCls}" data-stage style="--ar:${ar.toFixed(5)};--zoom:${planUi.zoom || 1}">
    ${thumbHtml(plan.photo_path, t('organize.fp.planAlt', { name: plan.name }), 'org-plan-img', 'layers')}<div class="org-layer" data-layer>${inner}</div></div>`;
}

/** Zoom des Plans (− / + / Ganzer Plan). Beim ersten Vergrössern wird waagrecht auf die eingezeichneten Bereiche
 *  geschwenkt, danach bleibt die Mitte des sichtbaren Ausschnitts stehen. Die Seite selbst wird nicht gescrollt,
 *  damit die Zoom-Knöpfe unter dem Finger/Mauszeiger bleiben (sonst öffnet ein zweiter Klick einen Raum). */
function bindPlanZoom(panel, stage, areas) {
  const sc = stage.closest('.org-plan-scroll');
  const val = panel.querySelector('[data-zoomval]');
  const btns = [...panel.querySelectorAll('[data-zoom]')];
  const update = () => {
    const i = PLAN_ZOOMS.indexOf(planUi.zoom);
    for (const b of btns) {
      const d = Number(b.dataset.zoom);
      b.disabled = d > 0 ? i >= PLAN_ZOOMS.length - 1 : i <= 0;
    }
    if (val) val.textContent = Math.round(planUi.zoom * 100) + ' %';
  };
  const bboxCenterX = () => {
    let x0 = 1, x1 = 0;
    for (const h of areas) { const g = hsGeom(h); x0 = Math.min(x0, g.x); x1 = Math.max(x1, g.x + (g.w || 0)); }
    return x1 > x0 ? (x0 + x1) / 2 : null;
  };
  for (const b of btns) b.addEventListener('click', () => {
    const d = Number(b.dataset.zoom);
    const i = Math.max(0, PLAN_ZOOMS.indexOf(planUi.zoom));
    const prev = planUi.zoom;
    const next = d === 0 ? 1 : PLAN_ZOOMS[Math.max(0, Math.min(PLAN_ZOOMS.length - 1, i + d))];
    if (next === prev) return;
    const w = stage.getBoundingClientRect().width;
    let cx = sc && w ? (sc.scrollLeft + sc.clientWidth / 2) / w : 0.5;
    if (prev === 1) { const c = bboxCenterX(); if (c !== null) cx = c; }
    planUi.zoom = next;
    stage.style.setProperty('--zoom', String(next));
    if (sc) sc.scrollLeft = next === 1 ? 0 : Math.max(0, cx * stage.getBoundingClientRect().width - sc.clientWidth / 2);
    update();
    if (b.disabled) { const o = btns.find((x) => !x.disabled); if (o) o.focus(); }
  });
  update();
}

async function planView(ctx) {
  const { api, user } = ctx;
  const staff = can(user, 'staff');
  ctx.setTitle(t('organize.fp.title'));
  ctx.el.innerHTML = loadingHtml();
  let plans, spaces, locs, sites;
  try {
    [plans, spaces, locs, sites] = await Promise.all([api.listFloorPlans(), api.listSpaces(),
      Promise.resolve(api.listLocations()).catch(() => []),
      typeof api.listSites === 'function' ? Promise.resolve(api.listSites()).catch(() => []) : []]);
  } catch (err) { showError(ctx, err); return; }
  sites = sites || [];
  plans = plans || [];
  spaces = spaces || [];
  locs = locs || [];
  let hotspots = [];
  if (plans.length) {
    try { hotspots = (await api.listHotspots({ photoIds: plans.map((p) => p.photo_id) })) || []; } catch (err) { toast(errorText(err), 'error'); }
  }
  const P = { plans, spaces, spaceById: new Map(spaces.map((s) => [s.id, s])), locs, locById: new Map(locs.map((l) => [l.id, l])),
    hotspots, staff, admin: can(user, 'admin'), sites };
  let cur = plans.find((p) => p.id === qget(ctx, 'plan')) || plans[0] || null;
  // Pläne je Standort: gibt es Pläne mehrerer Standorte, wählt man zuerst den Standort, dann das Stockwerk
  const siteById = new Map(sites.map((x) => [x.id, x]));
  const gOf = (pl) => (pl.site_id && siteById.has(pl.site_id) ? pl.site_id : 'none');
  const groups = [...sites.map((x) => x.id), 'none'].filter((g) => plans.some((pl) => gOf(pl) === g));
  const tabPlans = cur ? plans.filter((pl) => gOf(pl) === gOf(cur)) : [];
  const siteNav = groups.length > 1 ? `<nav class="row org-site-nav" aria-label="${esc(t('site.manage'))}">${groups.map((g) => {
    const first = plans.find((pl) => gOf(pl) === g);
    const on = cur && gOf(cur) === g;
    const x = siteById.get(g);
    return `<a class="btn sm${on ? ' primary' : ''}" href="${PLAN_HREF(first.id)}"${on ? ' aria-current="page"' : ''}>${icon('pin')}${esc(x ? x.name : t('site.noneGroup'))}</a>`;
  }).join('')}</nav>` : '';
  const curSiteObj = cur ? siteById.get(cur.site_id) : null;

  ctx.el.innerHTML = `<div class="page org">
    <a class="back-link" href="#/organisieren">${icon('back')}${esc(t('organize.title'))}</a>
    <div class="page-head">
      <div><h1>${esc(t('organize.fp.title'))}</h1><div class="sub">${esc(t('organize.fp.sub'))}</div></div>
      ${staff ? `<div class="actions"><button type="button" class="btn${plans.length ? '' : ' primary'}" data-addplan>${icon('plus')}${esc(t('organize.fp.add'))}</button></div>` : ''}
    </div>
    ${siteNav}
    ${curSiteObj && groups.length <= 1 ? `<p class="small muted org-site-line">${icon('pin')}${esc(curSiteObj.name)}${curSiteObj.address && curSiteObj.address !== curSiteObj.name ? ' – ' + esc(curSiteObj.address) : ''}</p>` : ''}
    ${plans.length ? `<div class="tabs org-tabs" role="tablist" aria-label="${esc(t('organize.fp.tabs'))}">
      ${tabPlans.map((p) => `<button type="button" class="tab" role="tab" id="fp-tab-${esc(p.id)}" data-plan="${esc(p.id)}" aria-controls="fp-panel"
        aria-selected="${p.id === cur.id}" tabindex="${p.id === cur.id ? 0 : -1}">${esc(p.name)}</button>`).join('')}
    </div>
    <div class="org-panel" id="fp-panel" role="tabpanel" aria-labelledby="fp-tab-${esc(cur.id)}" data-panel></div>`
    : emptyHtml(t(staff ? 'organize.fp.none' : 'organize.fp.noneRead'), staff
      ? `<button type="button" class="btn primary" data-addplan>${icon('plus')}${esc(t('organize.fp.add'))}</button>` : '')}
  </div>`;
  const root = ctx.el.firstElementChild;
  root.querySelectorAll('[data-addplan]').forEach((b) => b.addEventListener('click', () => addPlanSheet(ctx, P)));
  if (!cur) return;
  const panel = root.querySelector('[data-panel]');
  const tabs = [...root.querySelectorAll('[data-plan]')];
  const select = (id, focus) => {
    cur = plans.find((p) => p.id === id) || cur;
    tabs.forEach((b) => { const on = b.dataset.plan === cur.id; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; if (on && focus) b.focus(); });
    panel.setAttribute('aria-labelledby', 'fp-tab-' + cur.id);
    try { history.replaceState(null, '', PLAN_HREF(cur.id)); } catch (e) { /* egal */ }
    renderPlanPanel(ctx, P, panel, cur);
  };
  tabs.forEach((b, i) => {
    b.addEventListener('click', () => select(b.dataset.plan));
    b.addEventListener('keydown', (e) => {
      let j = null;
      if (e.key === 'ArrowRight') j = (i + 1) % tabs.length;
      else if (e.key === 'ArrowLeft') j = (i - 1 + tabs.length) % tabs.length;
      else if (e.key === 'Home') j = 0;
      else if (e.key === 'End') j = tabs.length - 1;
      if (j !== null) { e.preventDefault(); select(tabs[j].dataset.plan, true); }
    });
  });
  renderPlanPanel(ctx, P, panel, cur);
}

function renderPlanPanel(ctx, P, panel, plan) {
  P.curPlan = plan;
  const editing = P.staff && planUi.editing === plan.id;
  const areas = P.hotspots.filter((h) => h.photo_id === plan.photo_id).sort((a, b) => areaSize(b) - areaSize(a));
  const cmp = collator();
  // Liste: nur Räume (Möbel sind über ihren Raum erreichbar); Zahl der Möbel je Raum
  const itemsPerRoom = new Map();
  const rooms = [];
  for (const h of areas) {
    const it = planItemLoc(P, h);
    if (it) { if (it.root_id) itemsPerRoom.set(it.root_id, (itemsPerRoom.get(it.root_id) || 0) + 1); } else rooms.push(h);
  }
  const sorted = rooms.sort((a, b) => cmp(planAreaName(P, a), planAreaName(P, b)));
  const ar = planAr(plan);
  const altLbl = planAltLabelIds(P, areas);
  const zi = Math.max(0, PLAN_ZOOMS.indexOf(planUi.zoom));
  const legend = `<div class="org-fp-legend small" aria-label="${esc(t('organize.fp.legend'))}">
      <span><i class="org-fp-sw linked" style="--c:${LINKED_COLOR}"></i>${esc(t('organize.fp.lgLinked'))}</span>
      <span><i class="org-fp-sw unlinked"></i>${esc(t('organize.fp.lgUnlinked'))}</span>
      ${ORG_STATUSES.map((s) => `<span><i class="org-fp-sw linked" style="--c:${STATUS_COLOR[s]}"></i>${esc(orgStatusLabel(s))}</span>`).join('')}
    </div>`;
  const roomRow = (h) => {
    const sp = h.location_id ? P.spaceById.get(h.location_id) : null;
    const name = planAreaName(P, h);
    const code = (sp && sp.code) || h.location_code;
    const sw = `<i class="org-fp-sw ${h.location_id ? 'linked' : 'unlinked'}"${h.location_id ? ` style="--c:${planAreaColor(P, h)}"` : ''} aria-hidden="true"></i>`;
    if (h.location_id && code) {
      const nItems = itemsPerRoom.get(h.location_id) || 0;
      return `<li><a class="list-item" href="#/o/${enc(code)}">${sw}<div class="li-main"><span class="li-title">${esc(name)}</span>
        <span class="li-sub">${esc([sp && (sp.code_path || sp.short_code), code, nItems ? t('organize.fp.items', { n: fmtNum(nItems) }) : ''].filter(Boolean).join(' · '))}</span></div>
        <div class="li-end">${sp ? orgStatusPill(sp.org_status) : ''}</div></a></li>`;
    }
    return `<li><div class="list-item">${sw}<div class="li-main"><span class="li-title">${esc(name)}</span>
      <span class="li-sub">${esc(t('organize.fp.notCreated'))}</span></div>
      ${P.staff ? `<div class="li-end"><button type="button" class="btn sm" data-create="${esc(h.id)}">${icon('plus')}${esc(t('organize.fp.createLink'))}</button></div>` : ''}</div></li>`;
  };
  panel.innerHTML = `<div class="stack">
    ${P.staff ? `<div class="row org-panel-tools">
      <button type="button" class="btn sm${editing ? ' primary' : ''}" data-fpedit aria-pressed="${editing}">${icon(editing ? 'check' : 'edit')}${esc(t(editing ? 'organize.doneEditing' : 'organize.fp.editRooms'))}</button>
      <div class="row">
        <button type="button" class="btn sm" data-fprename>${icon('edit')}${esc(t('organize.fp.edit'))}</button>
        ${P.admin ? `<button type="button" class="btn sm danger-outline" data-fpdelete>${icon('trash')}${esc(t('organize.fp.delete'))}</button>` : ''}
      </div>
    </div>` : ''}
    ${editing ? `<div class="alert warn" role="status">${icon('edit')}<span>${esc(t('organize.fp.editHint'))}</span></div>` : ''}
    ${plan.notes ? `<p class="small muted org-pre">${esc(plan.notes)}</p>` : ''}
    <div class="row org-fp-zoom" role="group" aria-label="${esc(t('organize.fp.zoom'))}">
      <button type="button" class="btn sm icon-only" data-zoom="-1" aria-label="${esc(t('organize.fp.zoomOut'))}" title="${esc(t('organize.fp.zoomOut'))}"${zi === 0 ? ' disabled' : ''}>−</button>
      <span class="small mono" data-zoomval aria-live="polite">${Math.round(PLAN_ZOOMS[zi] * 100)} %</span>
      <button type="button" class="btn sm icon-only" data-zoom="1" aria-label="${esc(t('organize.fp.zoomIn'))}" title="${esc(t('organize.fp.zoomIn'))}"${zi === PLAN_ZOOMS.length - 1 ? ' disabled' : ''}>+</button>
      <button type="button" class="btn sm" data-zoom="0"${zi === 0 ? ' disabled' : ''}>${esc(t('organize.fp.zoomFit'))}</button>
    </div>
    <div class="org-plan-scroll">${planStageHtml(plan, areas.map((h) => planAreaHtml(P, h, editing, ar, altLbl.has(h.id))).join(''), editing ? ' editing' : '')}</div>
    ${legend}
    <section class="section">
      <h2>${esc(t('organize.fp.rooms'))} (${fmtNum(sorted.length)})</h2>
      ${sorted.length ? `<ul class="list org-fp-rooms">${sorted.map(roomRow).join('')}</ul>`
        : `<p class="muted small">${esc(t(P.staff ? 'organize.fp.roomsNoneStaff' : 'organize.fp.roomsNone'))}</p>`}
    </section>
  </div>`;
  hydrateThumbs(panel, ctx.api);
  const stage = panel.querySelector('[data-stage]');
  const layer = stage.querySelector('[data-layer]');
  bindStageImage(stage);
  bindPlanZoom(panel, stage, areas);
  if (editing) {
    bindAreaEditor(stage, layer, {
      onDraw: (shape) => planAreaSheet(ctx, P, plan, { shape }),
      onEdit: (id) => { const h = P.hotspots.find((x) => x.id === id); if (h) planAreaSheet(ctx, P, plan, { h }); },
      onChange: (id, g, revert) => saveGeometry(ctx, P.hotspots, id, g, revert),
    });
  } else {
    layer.addEventListener('click', (e) => {
      const b = e.target.closest('[data-unlinked]');
      if (!b) return;
      const h = P.hotspots.find((x) => x.id === b.dataset.unlinked);
      if (h) linkRoomSheet(ctx, P, h);
    });
  }
  panel.querySelectorAll('[data-create]').forEach((b) => b.addEventListener('click', () => {
    const h = P.hotspots.find((x) => x.id === b.dataset.create);
    if (h) linkRoomSheet(ctx, P, h);
  }));
  const eb = panel.querySelector('[data-fpedit]');
  if (eb) eb.addEventListener('click', () => {
    planUi.editing = planUi.editing === plan.id ? null : plan.id;
    renderPlanPanel(ctx, P, panel, plan);
    const nb = panel.querySelector('[data-fpedit]');
    if (nb) nb.focus();
  });
  const rb = panel.querySelector('[data-fprename]');
  if (rb) rb.addEventListener('click', () => editPlanSheet(ctx, plan, P));
  const db = panel.querySelector('[data-fpdelete]');
  if (db) db.addEventListener('click', async () => {
    if (!(await confirmSheet(t('organize.fp.deleteQ'), t('organize.fp.deleteMsg', { name: plan.name }), { okLabel: t('btn.delete'), danger: true }))) return;
    try {
      await ctx.api.deleteFloorPlan(plan.id);
      toast(t('organize.fp.deleted'));
      ctx.go('organisieren/plan');
    } catch (err) { toast(errorText(err), 'error'); }
  });
}

function newRoomFieldsHtml(P, idp, name) {
  const used = new Set(P.spaces.map((s) => s.short_code).filter(Boolean));
  return `<div class="form">
    <div class="field full"><label for="${idp}-name">${esc(t('organize.f.name'))} <span aria-hidden="true">*</span></label>
      <input id="${idp}-name" type="text" maxlength="120" autocomplete="off" value="${esc(name || '')}"></div>
    <div class="field"><label for="${idp}-short">${esc(t('organize.f.short'))}</label>
      <input id="${idp}-short" type="text" maxlength="10" autocomplete="off" autocapitalize="characters" spellcheck="false"
        value="${esc(suggestRoomCode(name || '', used))}" aria-describedby="${idp}-short-h"></div>
    <div class="field"><label for="${idp}-type">${esc(t('organize.f.type'))}</label><select id="${idp}-type">${typeOptions('raum')}</select></div>
    <div class="hint field full" id="${idp}-short-h">${esc(t('organize.f.shortHint'))}</div>
    ${P.sites && P.sites.length ? `<div class="field full"><label for="${idp}-site">${esc(t('site.label'))}</label>
      <select id="${idp}-site">${siteOptionsHtml(P.sites, (P.curPlan && P.curPlan.site_id) || '')}</select></div>` : ''}
  </div>`;
}
/** Kurzcode-Vorschlag folgt dem Namen, bis jemand selbst einen Kurzcode eingibt */
function bindRoomCodeSuggest(root, P, idp) {
  const used = new Set(P.spaces.map((s) => s.short_code).filter(Boolean));
  const nameInp = root.querySelector(`#${idp}-name`);
  const shortInp = root.querySelector(`#${idp}-short`);
  let touched = false;
  shortInp.addEventListener('input', () => { touched = true; });
  nameInp.addEventListener('input', () => { if (!touched) shortInp.value = suggestRoomCode(nameInp.value, used); });
}
async function createRoom(ctx, root, idp) {
  const r = readNewLoc(root, idp);
  if (r.error) { const f = root.querySelector(r.field); if (f) f.focus(); throw Object.assign(new Error(r.error), { msg: r.error }); }
  const siteSel = root.querySelector(`#${idp}-site`);
  return ctx.api.saveLocation({ name: r.name, type: r.type, short_code: r.short_code, parent_id: null,
    ...(siteSel ? { site_id: siteSel.value || null } : {}) });
}
function spaceOptions(P, selected) {
  return P.spaces.map((s) => `<option value="${esc(s.id)}"${s.id === selected ? ' selected' : ''}>${esc(s.name)}${s.short_code ? ' · ' + esc(s.short_code) : ''}</option>`).join('');
}
/** Räume mit ihren Unterorten (Möbel, Tablare …) eingerückt – für Bereiche, die auch ein Möbel zeigen dürfen */
function locationOptions(P, selected) {
  const cmp = collator();
  const byRoot = new Map();
  for (const l of P.locs) {
    if (!l.parent_id || !l.root_id) continue;
    if (!byRoot.has(l.root_id)) byRoot.set(l.root_id, []);
    byRoot.get(l.root_id).push(l);
  }
  const opt = (l, depth, label) => `<option value="${esc(l.id)}"${l.id === selected ? ' selected' : ''}>${' '.repeat(depth)}${esc(label)}</option>`;
  return P.spaces.map((s) => {
    const subs = (byRoot.get(s.id) || []).sort((a, b) => cmp(a.code_path || a.path || a.name, b.code_path || b.path || b.name));
    return opt(s, 0, s.name + (s.short_code ? ' · ' + s.short_code : ''))
      + subs.map((l) => opt(l, Math.max(1, num(l.depth)), l.name + (l.code_path || l.short_code ? ' · ' + (l.code_path || l.short_code) : ''))).join('');
  }).join('');
}

/** Nur beschrifteter Raum → Raum anlegen (oberster Lagerort) oder mit bestehendem Raum verknüpfen */
async function linkRoomSheet(ctx, P, h) {
  if (!P.staff) return;
  const label = planAreaName(P, h);
  let createdId = null;
  const body = `<p class="small">${esc(t('organize.fp.createIntro', { label }))}</p>
    <div class="radio-cards" role="radiogroup">
      <label class="radio-card"><input type="radio" name="lmode" value="new" checked><span><b>${esc(t('organize.fp.mode.new'))}</b></span></label>
      <label class="radio-card"><input type="radio" name="lmode" value="existing"${P.spaces.length ? '' : ' disabled'}>
        <span><b>${esc(t('organize.fp.mode.existing'))}</b>${P.spaces.length ? '' : `<small>${esc(t('organize.fp.noSpaces'))}</small>`}</span></label>
    </div>
    <div data-new>${newRoomFieldsHtml(P, 'lr', label)}</div>
    <div class="field" data-existing hidden><label for="lr-space">${esc(t('organize.fp.space'))}</label><select id="lr-space">${spaceOptions(P, null)}</select></div>`;
  const res = await sheet({
    title: t('organize.fp.createLink'), body,
    actions: [
      { label: t('btn.cancel'), kind: 'ghost', value: null },
      { label: t('btn.save'), kind: 'primary', icon: 'check', onClick: async (el) => {
        const mode = el.querySelector('input[name=lmode]:checked').value;
        let locId, name;
        if (mode === 'existing') {
          locId = el.querySelector('#lr-space').value;
          name = (P.spaceById.get(locId) || {}).name;
        } else if (createdId) { locId = createdId; name = clean(el.querySelector('#lr-name').value); } else {
          let row;
          try { row = await createRoom(ctx, el, 'lr'); } catch (err) { if (err.msg) return sheetError(el, err.msg); throw err; }
          createdId = row.id; locId = row.id; name = row.name;
        }
        if (!locId) return sheetError(el, t('err.invalid_location'));
        await ctx.api.saveHotspot({ id: h.id, location_id: locId });
        return { mode, name };
      } },
    ],
    onOpen: (el) => {
      bindRoomCodeSuggest(el, P, 'lr');
      el.querySelectorAll('input[name=lmode]').forEach((r) => r.addEventListener('change', () => {
        if (!r.checked) return;
        el.querySelector('[data-new]').hidden = r.value !== 'new';
        el.querySelector('[data-existing]').hidden = r.value !== 'existing';
      }));
    },
  });
  if (res && res.name !== undefined) {
    toast(res.mode === 'new' ? t('organize.fp.created', { name: res.name }) : t('organize.fp.linked', { name: res.name || '' }));
    ctx.reload();
  } else if (createdId) ctx.reload();
}

/** Bereich auf dem Plan: neu (gezeichnet) oder bestehend – nur beschriften / mit Raum verknüpfen / neuen Raum anlegen */
async function planAreaSheet(ctx, P, plan, { shape, h }) {
  const isNew = !h;
  const curMode = h ? (h.location_id ? 'existing' : 'label') : 'label';
  let createdId = null;
  const modes = ['label', 'existing', 'new'];
  const body = `
    ${isNew ? `<p class="small muted">${icon(shape.w ? 'grid' : 'pin')} ${esc(t(shape.w ? 'organize.fp.shapeRect' : 'organize.fp.shapePoint'))}</p>` : ''}
    <div class="field"><label for="pa-label">${esc(t('organize.fp.label'))}</label>
      <input id="pa-label" type="text" maxlength="80" autocomplete="off" value="${esc(h ? h.label || '' : '')}" aria-describedby="pa-label-h">
      <span class="hint" id="pa-label-h">${esc(t('organize.fp.labelHint'))}</span></div>
    <div class="radio-cards" role="radiogroup">${modes.map((m) => `<label class="radio-card">
      <input type="radio" name="pmode" value="${m}"${m === curMode ? ' checked' : ''}${m === 'existing' && !P.spaces.length ? ' disabled' : ''}>
      <span><b>${esc(t(m === 'existing' ? 'organize.fp.mode.existingLoc' : 'organize.fp.mode.' + m))}</b></span></label>`).join('')}</div>
    <div class="field" data-pm="existing"${curMode === 'existing' ? '' : ' hidden'}><label for="pa-space">${esc(t('organize.fp.locField'))}</label>
      <select id="pa-space">${locationOptions(P, h && h.location_id)}</select></div>
    <div data-pm="new" hidden>${newRoomFieldsHtml(P, 'pn', h ? h.label || '' : '')}</div>`;
  const actions = [];
  if (!isNew) actions.push({ label: t('btn.delete'), kind: 'danger', icon: 'trash', value: 'delete' });
  actions.push({ label: t('btn.save'), kind: 'primary', icon: 'check', onClick: async (el) => {
    const mode = el.querySelector('input[name=pmode]:checked').value;
    const label = clean(el.querySelector('#pa-label').value) || null;
    let locId = null;
    if (mode === 'existing') locId = el.querySelector('#pa-space').value || null;
    else if (mode === 'new') {
      if (createdId) locId = createdId;
      else {
        let row;
        try { row = await createRoom(ctx, el, 'pn'); } catch (err) { if (err.msg) return sheetError(el, err.msg); throw err; }
        createdId = row.id; locId = row.id;
      }
    }
    if (!locId && !label) { el.querySelector('#pa-label').focus(); return sheetError(el, t('organize.fp.labelRequired')); }
    if (isNew) {
      await ctx.api.saveHotspot({ photo_id: plan.photo_id, location_id: locId, x: shape.x, y: shape.y, w: shape.w || null, h: shape.h || null, label });
    } else {
      await ctx.api.saveHotspot({ id: h.id, location_id: locId, label });
    }
    return 'saved';
  } });
  const r = await sheet({
    title: t(isNew ? 'organize.fp.newArea' : 'organize.fp.area'), body, actions,
    onOpen: (el) => {
      bindRoomCodeSuggest(el, P, 'pn');
      const labelInp = el.querySelector('#pa-label');
      const nameInp = el.querySelector('#pn-name');
      labelInp.addEventListener('input', () => { if (!nameInp.dataset.touched) { nameInp.value = labelInp.value; nameInp.dispatchEvent(new Event('input')); } });
      nameInp.addEventListener('keydown', () => { nameInp.dataset.touched = '1'; });
      el.querySelectorAll('input[name=pmode]').forEach((x) => x.addEventListener('change', () => {
        if (!x.checked) return;
        el.querySelectorAll('[data-pm]').forEach((b) => { b.hidden = b.dataset.pm !== x.value; });
      }));
    },
  });
  if (r === 'saved') { toast(t('organize.fp.areaSaved')); ctx.reload(); return; }
  if (createdId) { ctx.reload(); return; }
  if (r === 'delete') {
    if (!(await confirmSheet(t('organize.hs.deleteQ'), t('organize.fp.areaDeleteMsg', { name: planAreaName(P, h) }), { okLabel: t('btn.delete'), danger: true }))) return;
    try { await ctx.api.deleteHotspot(h.id); toast(t('organize.fp.areaDeleted')); ctx.reload(); } catch (err) { toast(errorText(err), 'error'); }
  }
}

async function addPlanSheet(ctx, P) {
  const nextSort = P.plans.reduce((m, p) => Math.max(m, num(p.sort)), 0) + (P.plans.length ? 1 : 0);
  let photoId = null;   // bei Wiederholung nicht erneut hochladen
  const body = `<div class="form">
    <div class="field full"><label for="fp-file">${esc(t('organize.fp.file'))} <span aria-hidden="true">*</span></label>
      <input id="fp-file" type="file" accept="image/png,image/jpeg,image/webp,image/gif" aria-describedby="fp-file-h">
      <span class="hint" id="fp-file-h">${esc(t('organize.fp.fileHint'))}</span></div>
    <div class="field"><label for="fp-name">${esc(t('organize.fp.name'))} <span aria-hidden="true">*</span></label>
      <input id="fp-name" type="text" maxlength="60" autocomplete="off" placeholder="${esc(t('organize.fp.namePh'))}"></div>
    <div class="field"><label for="fp-sort">${esc(t('organize.fp.sort'))}</label>
      <input id="fp-sort" type="number" step="1" value="${nextSort}" aria-describedby="fp-sort-h"><span class="hint" id="fp-sort-h">${esc(t('organize.fp.sortHint'))}</span></div>
    ${P.sites.length ? `<div class="field full"><label for="fp-site">${esc(t('site.label'))}</label>
      <select id="fp-site">${siteOptionsHtml(P.sites, (P.curPlan && P.curPlan.site_id) || (P.sites.length === 1 ? P.sites[0].id : ''))}</select></div>` : ''}
  </div>`;
  const row = await sheet({
    title: t('organize.fp.add'), body,
    actions: [
      { label: t('btn.cancel'), kind: 'ghost', value: null },
      { label: t('btn.save'), kind: 'primary', icon: 'upload', onClick: async (el) => {
        const file = el.querySelector('#fp-file').files[0];
        const name = clean(el.querySelector('#fp-name').value);
        if (!file && !photoId) return sheetError(el, t('organize.fp.fileRequired'));
        if (!name) { el.querySelector('#fp-name').focus(); return sheetError(el, t('err.name_required')); }
        if (!photoId) {
          const r = await ctx.api.importPhoto(file, { kind: 'plan', sha256: await sha256Hex(file) });
          photoId = r && r.photo && r.photo.id;
        }
        if (!photoId) return sheetError(el, t('err.invalid_file'));
        const siteSel = el.querySelector('#fp-site');
        return ctx.api.saveFloorPlan({ name, sort: Math.round(num(el.querySelector('#fp-sort').value)), photo_id: photoId,
          ...(siteSel ? { site_id: siteSel.value || null } : {}) });
      } },
    ],
    onOpen: (el) => {
      const f = el.querySelector('#fp-file');
      const n = el.querySelector('#fp-name');
      f.addEventListener('change', () => { photoId = null; if (!n.value && f.files[0]) n.value = f.files[0].name.replace(/\.[^.]+$/, '').toUpperCase().slice(0, 60); });
    },
  });
  if (row && row.id) { toast(t('organize.fp.added', { name: row.name })); ctx.go('organisieren/plan?plan=' + enc(row.id)); }
}

async function editPlanSheet(ctx, plan, P = { sites: [] }) {
  const body = `<div class="form">
    <div class="field"><label for="fe-name">${esc(t('organize.fp.name'))}</label>
      <input id="fe-name" type="text" maxlength="60" autocomplete="off" value="${esc(plan.name)}"></div>
    <div class="field"><label for="fe-sort">${esc(t('organize.fp.sort'))}</label>
      <input id="fe-sort" type="number" step="1" value="${esc(num(plan.sort))}" aria-describedby="fe-sort-h"><span class="hint" id="fe-sort-h">${esc(t('organize.fp.sortHint'))}</span></div>
    ${P.sites.length ? `<div class="field full"><label for="fe-site">${esc(t('site.label'))}</label>
      <select id="fe-site">${siteOptionsHtml(P.sites, plan.site_id || '')}</select></div>` : ''}
    <div class="field full"><label for="fe-notes">${esc(t('organize.fp.notes'))}</label><textarea id="fe-notes" maxlength="2000">${esc(plan.notes || '')}</textarea></div>
  </div>`;
  const ok = await sheet({
    title: t('organize.fp.edit'), body,
    actions: [
      { label: t('btn.cancel'), kind: 'ghost', value: false },
      { label: t('btn.save'), kind: 'primary', icon: 'check', onClick: async (el) => {
        const name = clean(el.querySelector('#fe-name').value);
        if (!name) return sheetError(el, t('err.name_required'));
        const siteSel = el.querySelector('#fe-site');
        await ctx.api.saveFloorPlan({ id: plan.id, name, sort: Math.round(num(el.querySelector('#fe-sort').value)),
          notes: String(el.querySelector('#fe-notes').value || '').trim() || null, ...(siteSel ? { site_id: siteSel.value || null } : {}) });
        return true;
      } },
    ],
  });
  if (ok === true) { toast(t('organize.fp.saved')); ctx.reload(); }
}

/** Kleines Vorschaubild «Auf dem Plan»: Ausschnitt um den Raum, Raum hervorgehoben */
function onPlanPreviewHtml(plan, h) {
  const g = hsGeom(h);
  const cx = g.w ? g.x + g.w / 2 : g.x, cy = g.w ? g.y + g.h / 2 : g.y;
  const z = Math.max(1, Math.min(4, 0.45 / Math.max(g.w || 0.08, g.h || 0.08)));
  const left = Math.max(1 - z, Math.min(0, 0.5 - cx * z)) * 100;
  const top = Math.max(1 - z, Math.min(0, 0.5 - cy * z)) * 100;
  const ar = num(plan.photo_width) && num(plan.photo_height) ? num(plan.photo_width) / num(plan.photo_height) : 1.414;
  return `<a class="org-onplan" href="${PLAN_HREF(plan.id)}" aria-label="${esc(t('organize.fp.onPlanAria', { name: plan.name }))}">
    <span class="org-onplan-view" style="--ar:${ar.toFixed(5)}">
      <span class="org-onplan-inner" style="width:${(z * 100).toFixed(2)}%;height:${(z * 100).toFixed(2)}%;left:${left.toFixed(2)}%;top:${top.toFixed(2)}%">
        ${thumbHtml(plan.photo_path, '', 'org-plan-img', 'layers')}
        <span class="org-onplan-mark ${g.w ? 'rect' : 'pt'}" style="${geomStyle(g)}"></span>
      </span>
    </span>
    <span class="small"><b>${esc(t('organize.fp.onPlan'))}</b> · ${esc(plan.name)} ${icon('chevron')}</span>
  </a>`;
}

// ---------------------------------------------------------------------------
// Routen
// ---------------------------------------------------------------------------
export const routes = {
  'organisieren': (ctx) => hubView(ctx),
  'organisieren/plan': (ctx) => planView(ctx),
  'o/:code': (ctx) => spaceView(ctx),
};
