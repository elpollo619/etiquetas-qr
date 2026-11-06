// Lager organisieren: «Fotos importieren» (inkl. KI-Ergebnis importieren) und «KI-Erkennung prüfen».
// Routen: 'organisieren/import' (?ort=<L-Code>, ?teil=analyse springt zum KI-Ergebnis),
//         'organisieren/pruefen' (?raum=<L-Code>)
// Ehrlich: Die App hat keinen eigenen KI-Dienst. Erkennungen sind Vorschläge, bis jemand sie bestätigt.
import { t, registerStrings, fmtDateTime, fmtDate, fmtNum, fmtQty, unitLabel } from '../i18n.js';
import {
  esc, icon, toast, errorText, can, sheet, confirmSheet, openLightbox, emptyHtml, debounce, numOrNull, locTypeLabel,
} from '../util.js';
import {
  KINDS, CONFIDENCES, LOCATION_TYPES, confidencePill, confidenceLabel, kindLabel, detectionStatusLabel,
  categoryOptionsHtml, categorySubtreeIds, locationDisplayCode, suggestShortCode, normShortCode, sha256Hex,
} from '../org-common.js';
import { listZipEntries, readZipEntry, isImageName, splitPath, ZipError } from '../zip.js';
import { labelItem, openLabelDialog } from '../labels.js';

// ---------------------------------------------------------------------------
// Texte (de-CH ohne Eszett, pt-PT, es)
// ---------------------------------------------------------------------------
registerStrings({
  de: {
    // Fotos importieren
    'review.import.title': 'Fotos importieren',
    'review.import.sub': 'Fotos eines Raums oder Lagerorts hochladen, zur KI-Analyse vormerken und das Ergebnis einlesen.',
    'review.import.staffOnly': 'Fotos und KI-Ergebnisse importieren können nur Lagerverantwortliche und Administratoren.',
    'review.import.noSpace': 'Es gibt noch keinen Raum. Lege zuerst unter «Lager organisieren» einen Raum an (z. B. Werkstatt oder Büro).',
    'review.import.toOrganize': 'Zu «Lager organisieren»',
    'review.import.toReview': 'Erkennungen prüfen',
    'review.import.target': 'Ziel-Lagerort',
    'review.import.targetHint': 'Alle Fotos dieser Auswahl werden diesem Raum bzw. Lagerort zugeordnet.',
    'review.import.targetPick': '– Lagerort wählen –',
    'review.import.targetMissing': 'Der Lagerort {code} wurde nicht gefunden. Bitte den Ziel-Lagerort wählen.',
    'review.import.sources': 'Fotos wählen',
    'review.import.src.photos': 'Fotos',
    'review.import.src.photosHint': 'Mehrere auf einmal',
    'review.import.src.folder': 'Ganzer Ordner',
    'review.import.src.folderHint': 'Unterordner bleiben als Ordnerpfad erhalten',
    'review.import.src.zip': 'ZIP-Datei',
    'review.import.src.zipHint': 'JPG, PNG, WebP, HEIC aus dem Archiv',
    'review.import.src.camera': 'Kamera',
    'review.import.src.cameraHint': 'Direkt mit dem Handy fotografieren',
    'review.import.drop': 'Oder Fotos bzw. ZIP-Dateien hierher ziehen.',
    'review.import.dropFolder': 'Ordner bitte über «Ganzer Ordner» wählen.',
    'review.import.reading': 'ZIP-Datei «{name}» wird gelesen…',
    'review.import.files': 'Dateien',
    'review.import.noFiles': 'Noch keine Fotos ausgewählt.',
    'review.import.selected': '{n} Dateien in der Auswahl',
    'review.import.clear': 'Auswahl leeren',
    'review.import.start': '{n} Fotos importieren',
    'review.import.nothing': 'Keine Fotos zum Importieren in der Auswahl.',
    'review.import.needTarget': 'Bitte zuerst den Ziel-Lagerort wählen.',
    'review.import.phase.hash': 'Dateien prüfen (SHA-256)',
    'review.import.phase.upload': 'Hochladen',
    'review.import.progress': '{x} von {y}',
    'review.import.cancel': 'Abbrechen',
    'review.import.cancelling': 'Wird abgebrochen – laufende Uploads werden noch beendet…',
    'review.import.keepOpen': 'Du kannst in der App weiterarbeiten – der Import läuft weiter, solange die App geöffnet bleibt.',
    'review.import.retry': 'Fehlgeschlagene erneut versuchen ({n})',
    'review.import.resume': 'Abgebrochene fortsetzen ({n})',
    'review.import.more': 'Mehr anzeigen ({n} weitere)',
    'review.import.st.wartet': 'Wartet',
    'review.import.st.pruefen': 'Wird geprüft',
    'review.import.st.laeuft': 'Läuft',
    'review.import.st.importiert': 'Importiert',
    'review.import.st.vorhanden': 'Bereits vorhanden (Duplikat)',
    'review.import.st.doppelt': 'Doppelt in dieser Auswahl',
    'review.import.st.uebersprungen': 'Übersprungen (kein Bild)',
    'review.import.st.fehler': 'Fehler',
    'review.import.st.abgebrochen': 'Abgebrochen',
    'review.import.sameAs': 'gleiche Datei wie «{name}»',
    'review.import.existingAt': 'schon vorhanden in {path}',
    'review.import.inZip': 'aus {zip}',
    'review.import.summary': 'Zusammenfassung',
    'review.import.doneOk': 'Import abgeschlossen.',
    'review.import.doneCancelled': 'Import abgebrochen. Bereits importierte Fotos bleiben erhalten.',
    'review.import.queue': 'Importierte Fotos zur KI-Analyse vormerken',
    'review.import.queued': '{n} Fotos zur KI-Analyse vorgemerkt.',
    'review.import.queuedNone': 'Keine Änderung: Die Fotos waren bereits vorgemerkt oder schon analysiert.',
    'review.import.aiHonest': 'Die App hat keinen eigenen KI-Dienst. Die Analyse erstellt Claude (Anthropic) aus den Originalfotos; das Ergebnis wird unten als Datei importiert. Jede Erkennung bleibt ein Vorschlag, bis jemand sie prüft.',
    'review.import.zipErr.zip_invalid': 'Die ZIP-Datei ist beschädigt oder keine ZIP-Datei.',
    'review.import.zipErr.zip64': 'ZIP64-Archive (über 4 GB oder sehr viele Dateien) werden nicht unterstützt. Bitte in kleinere ZIP-Dateien aufteilen oder den Ordner direkt wählen.',
    'review.import.zipErr.zip_encrypted': 'Mit Passwort verschlüsselt – wird nicht unterstützt. Bitte ohne Passwort packen.',
    'review.import.zipErr.zip_method': 'Unbekannte Kompressionsmethode – bitte als normale ZIP-Datei packen.',
    'review.import.zipErr.zip_unsupported': 'Dieser Browser kann ZIP-Dateien nicht entpacken. Bitte den Ordner oder die Fotos direkt wählen.',
    'review.import.zipErr.zip_crc': 'Die Datei im ZIP ist beschädigt (Prüfsumme stimmt nicht).',
    'review.import.zipEmpty': 'Die ZIP-Datei enthält keine Dateien.',
    // KI-Ergebnis importieren
    'review.ana.title': 'KI-Ergebnis importieren',
    'review.ana.intro': 'Wähle die JSON-Datei mit dem Analyse-Ergebnis (Format «lgr-photo-analysis/1»). Die Zuordnung zu den Fotos erfolgt über die SHA-256-Prüfsumme der Originaldatei. Mehrfaches Importieren erzeugt keine doppelten Objekte.',
    'review.ana.pick': 'JSON-Datei wählen',
    'review.ana.other': 'Andere Datei wählen',
    'review.ana.invalidJson': 'Die Datei ist kein gültiges JSON ({msg}).',
    'review.ana.invalidShape': 'Unbekanntes Format: erwartet wird ein Objekt mit «photos» oder eine Liste von Fotos.',
    'review.ana.schemaWarn': 'Kein oder unbekanntes «schema» ({schema}). Empfohlen ist «lgr-photo-analysis/1». Die Datei kann trotzdem importiert werden.',
    'review.ana.empty': 'Die Datei enthält keine Fotos.',
    'review.ana.preview': 'Vorschau: {file}',
    'review.ana.photos': 'Fotos in der Datei',
    'review.ana.objects': 'Erkannte Objekte',
    'review.ana.errPhotos': 'Fotos mit Analysefehler',
    'review.ana.dupPhotos': 'Als Duplikat markiert',
    'review.ana.known': 'Schon in der App',
    'review.ana.unknown': 'Noch nicht importiert',
    'review.ana.knownNa': 'Abgleich mit den Fotos der App nicht möglich.',
    'review.ana.noSha': '{n} Einträge ohne gültige SHA-256 – sie können keinem Foto zugeordnet werden.',
    'review.ana.badItems': '{n} Einträge sind keine Objekte und werden als ungültig gezählt.',
    'review.ana.badObjects': '{n} Objekte ohne Schlüssel («key») oder Name werden als ungültig gezählt.',
    'review.ana.byConf': 'Objekte nach Sicherheit',
    'review.ana.col.file': 'Datei',
    'review.ana.col.status': 'Status',
    'review.ana.col.objects': 'Objekte',
    'review.ana.col.inApp': 'In der App',
    'review.ana.st.analysiert': 'Analysiert',
    'review.ana.st.fehler': 'Fehler',
    'review.ana.st.duplikat': 'Duplikat',
    'review.ana.source': 'Quelle der Analyse',
    'review.ana.sourceHint': 'Wird bei jedem Foto als Herkunft der Analyse gespeichert.',
    'review.ana.sourcePh': 'z. B. Claude (Anthropic) – Sitzung 06.11.2026',
    'review.ana.sourceFromFile': 'Angabe in der Datei: «{source}»',
    'review.ana.start': 'Ergebnis importieren ({n} Fotos)',
    'review.ana.packet': 'Paket {x} von {y}',
    'review.ana.packets': 'Wird in {n} Paket(en) zu höchstens {size} Fotos gesendet.',
    'review.ana.sending': 'KI-Ergebnis wird importiert',
    'review.ana.result': 'Ergebnis des Imports',
    'review.ana.r.matched': 'Fotos zugeordnet',
    'review.ana.r.created': 'Neue Objekte',
    'review.ana.r.existing': 'Schon vorhanden',
    'review.ana.r.failed': 'Fehlgeschlagen (Analyse)',
    'review.ana.r.duplicates': 'Duplikate',
    'review.ana.r.invalid': 'Ungültig',
    'review.ana.r.unmatched': 'Nicht zugeordnet',
    'review.ana.unmatchedTitle': 'Nicht zugeordnete Dateien',
    'review.ana.unmatchedHint': 'Diese Fotos sind noch nicht in der App. Zuerst die Fotos importieren, dann diese Datei erneut importieren – es entstehen keine Doppelten.',
    'review.ana.packetErrors': '{n} Pakete konnten nicht importiert werden:',
    'review.ana.retryPackets': 'Fehlgeschlagene Pakete erneut senden',
    // KI-Erkennung prüfen
    'review.title': 'KI-Erkennung prüfen',
    'review.sub': 'Vorschläge aus der Fotoanalyse. Erst nach deiner Bestätigung entstehen Inventar, Codes und Etiketten.',
    'review.readOnly': 'Du kannst die Vorschläge ansehen. Prüfen und bestätigen können nur Lagerverantwortliche und Administratoren.',
    'review.toImport': 'Fotos / KI-Ergebnis importieren',
    'review.spaceMissing': 'Der Raum {code} wurde nicht gefunden. Es werden alle Räume angezeigt.',
    'review.f.space': 'Raum',
    'review.f.allSpaces': 'Alle Räume',
    'review.f.status': 'Status',
    'review.f.conf': 'Sicherheit',
    'review.f.allConf': 'Alle',
    'review.f.kind': 'Art',
    'review.f.allKinds': 'Alle Arten',
    'review.f.cat': 'Kategorie',
    'review.f.allCats': 'Alle Kategorien',
    'review.f.noCat': 'Ohne Kategorie',
    'review.f.search': 'Suchen',
    'review.f.searchPh': 'Name, Marke, Modell, gelesener Text…',
    'review.f.reset': 'Filter zurücksetzen',
    'review.count': '{n} Objekte · {m} Erkennungen',
    'review.empty': 'Keine Erkennungen für diese Filter.',
    'review.emptyAll': 'Noch keine KI-Erkennungen. Zuerst Fotos importieren und das KI-Ergebnis einlesen.',
    'review.more': 'Mehr anzeigen ({n} weitere)',
    'review.photoN': 'Foto {i} von {n}',
    'review.onPhotos': 'Dasselbe Objekt auf {n} Fotos',
    'review.zoom': 'Foto vergrössern',
    'review.photoAlt': 'Foto {file}',
    'review.noPos': 'Ohne Positionsangabe im Foto',
    'review.markerHint': 'Markierung = ungefähre Position im Foto',
    'review.serial': 'Seriennummer',
    'review.kind': 'Art',
    'review.qty': 'Menge',
    'review.qtyUncertain': 'unsicher',
    'review.qtyUnknown': 'nicht erkannt',
    'review.conf': 'Sicherheit',
    'review.textRead': 'Gelesene Texte',
    'review.target': 'Ziel-Lagerort',
    'review.photoLoc': 'wie Foto',
    'review.catSuggested': 'KI-Vorschlag «{text}» (keine passende Kategorie gefunden)',
    'review.product': 'Produktinfo',
    'review.maker': 'Herstellerseite',
    'review.manual': 'Anleitung',
    'review.productSource': 'Quelle: {src}',
    'review.productChecked': 'Geprüft am {date}',
    'review.condition': 'Zustand',
    'review.partOf': 'Gehört zu',
    'review.dupTitle': 'Mögliche Duplikate im Inventar',
    'review.dupReason.model': 'gleiche Marke und gleiches Modell',
    'review.dupReason.serial': 'gleiche Seriennummer',
    'review.dupReason.name': 'sehr ähnlicher Name',
    'review.link': 'Mit bestehendem verknüpfen',
    'review.linkQ': 'Mit bestehendem Eintrag verknüpfen?',
    'review.linkText': '«{name}» wird mit {code} «{target}» verknüpft. Es wird nichts Neues angelegt.',
    'review.linked': 'Mit {code} verknüpft',
    'review.reviewedBy': 'Geprüft von {name} · {date}',
    'review.created': 'Erfasst als',
    'review.mergedInto': 'Zusammengeführt mit «{name}»',
    'review.act.confirm': 'Bestätigen',
    'review.act.edit': 'Bearbeiten',
    'review.act.merge': 'Zusammenführen',
    'review.act.location': 'Lagerort ändern',
    'review.act.later': 'Später prüfen',
    'review.act.reject': 'Ablehnen',
    'review.act.reopen': 'Wieder öffnen',
    'review.act.label': 'Etikett drucken',
    'review.act.split': 'Wieder trennen',
    'review.splitHint': 'Dieses Foto wurde zugeordnet. Falls es ein anderes Objekt zeigt: wieder als eigenen Vorschlag öffnen.',
    'review.c.title': 'Bestätigen und erfassen',
    'review.c.kind': 'Was ist es?',
    'review.c.name': 'Name',
    'review.c.loc': 'Lagerort',
    'review.c.parent': 'Liegt in (übergeordneter Lagerort)',
    'review.c.qty': 'Gezählte Menge',
    'review.c.qtyAi': 'KI-Schätzung: {qty} (unsicher) – bitte zählen und die echte Menge eintragen.',
    'review.c.qtyNone': 'Keine Menge erkannt – bitte zählen und eintragen.',
    'review.c.qtySure': 'Menge sicher erkannt – bei Bedarf korrigieren.',
    'review.c.qtyEach': 'Jedes Stück bekommt eine eigene Nummer und ein eigenes Etikett (höchstens 50).',
    'review.c.withoutStock': 'Ohne Bestand übernehmen (später zählen)',
    'review.c.withoutStockHint': 'Der Artikel wird mit Bestand 0 angelegt und als «Menge noch nicht gezählt» markiert.',
    'review.c.locType': 'Art des Lagerorts',
    'review.c.short': 'Kurzcode',
    'review.c.shortHint': 'Vorschlag nach Konvention (z. B. RG01). Darf leer bleiben.',
    'review.c.needKind': 'Bitte wählen, was es ist.',
    'review.c.needQty': 'Bitte die gezählte Menge eintragen.',
    'review.c.qtyRange': 'Bitte eine ganze Zahl von 1 bis 50 eintragen.',
    'review.c.qtyInvalid': 'Bitte eine gültige Menge eintragen (0 oder mehr).',
    'review.c.group': 'Dieses Objekt ist auf {n} Fotos zu sehen – es wird nur einmal erfasst.',
    'review.ok.title': 'Erfasst',
    'review.ok.machine': '{n} Maschine(n) / Einzelinventar angelegt:',
    'review.ok.article': 'Artikel angelegt:',
    'review.ok.location': 'Lagerort angelegt:',
    'review.ok.merged': '{n} weitere Fotos desselben Objekts wurden zugeordnet.',
    'review.ok.labelHint': 'Drucke jetzt das Etikett und klebe es auf.',
    'review.ok.continue': 'Weiter prüfen',
    'review.e.title': 'Vorschlag bearbeiten',
    'review.e.qtyCertain': 'Menge ist gezählt (sicher)',
    'review.e.allPhotos': 'Die Änderungen gelten für alle {n} Fotos dieses Objekts.',
    'review.e.done': 'Gespeichert',
    'review.m.title': 'Zusammenführen',
    'review.m.text': 'Ist das dasselbe Objekt wie ein anderer Vorschlag in diesem Raum? Wähle den anderen Vorschlag – dieses Foto wird ihm zugeordnet.',
    'review.m.none': 'Im selben Raum gibt es keinen anderen Vorschlag.',
    'review.m.search': 'Vorschläge durchsuchen',
    'review.m.pick': 'Bitte einen Vorschlag wählen.',
    'review.m.done': 'Zusammengeführt',
    'review.l.title': 'Lagerort ändern',
    'review.l.photo': '– wie Foto ({path}) –',
    'review.l.done': 'Lagerort geändert',
    'review.later.done': 'Für später vorgemerkt',
    'review.r.title': 'Vorschlag ablehnen',
    'review.r.text': 'Abgelehnte Vorschläge werden nicht ins Inventar übernommen. Sie können wieder geöffnet werden.',
    'review.r.reason': 'Grund',
    'review.r.reasonPh': 'z. B. kein Inventar, falsch erkannt',
    'review.r.q.noInventory': 'Kein Inventar',
    'review.r.q.wrong': 'Falsch erkannt',
    'review.r.q.notOurs': 'Gehört nicht der Firma',
    'review.r.q.double': 'Doppelt erfasst',
    'review.r.done': 'Abgelehnt',
    'review.reopen.done': 'Wieder geöffnet',
    'review.b.btn': 'Alle sicheren bestätigen ({n})',
    'review.b.title': 'Sichere Vorschläge bestätigen',
    'review.b.text': 'Nur Vorschläge, die sicher erkannt sind und eine Art, eine gezählte Menge und eine Kategorie haben und keinem bestehenden Eintrag ähneln. Unsichere Mengen werden nie automatisch bestätigt.',
    'review.b.submit': 'Ausgewählte bestätigen',
    'review.b.none': 'Bitte mindestens einen Vorschlag auswählen.',
    'review.b.report': '{ok} bestätigt, {fail} fehlgeschlagen.',
    'review.b.labels': 'Etiketten drucken ({n})',
    'review.b.selected': '{n} ausgewählt',
  },
  pt: {
    'review.import.title': 'Importar fotos',
    'review.import.sub': 'Envia fotos de uma sala ou localização, marca-as para análise por IA e importa o resultado.',
    'review.import.staffOnly': 'Só responsáveis de armazém e administradores podem importar fotos e resultados de IA.',
    'review.import.noSpace': 'Ainda não existe nenhuma sala. Cria primeiro uma sala em «Organizar armazém» (p. ex. oficina ou escritório).',
    'review.import.toOrganize': 'Ir para «Organizar armazém»',
    'review.import.toReview': 'Verificar deteções',
    'review.import.target': 'Localização de destino',
    'review.import.targetHint': 'Todas as fotos desta seleção ficam associadas a esta sala ou localização.',
    'review.import.targetPick': '– escolher localização –',
    'review.import.targetMissing': 'A localização {code} não foi encontrada. Escolhe a localização de destino.',
    'review.import.sources': 'Escolher fotos',
    'review.import.src.photos': 'Fotos',
    'review.import.src.photosHint': 'Várias de uma vez',
    'review.import.src.folder': 'Pasta inteira',
    'review.import.src.folderHint': 'As subpastas ficam guardadas como caminho',
    'review.import.src.zip': 'Ficheiro ZIP',
    'review.import.src.zipHint': 'JPG, PNG, WebP, HEIC do arquivo',
    'review.import.src.camera': 'Câmara',
    'review.import.src.cameraHint': 'Fotografar diretamente com o telemóvel',
    'review.import.drop': 'Ou arrasta fotos ou ficheiros ZIP para aqui.',
    'review.import.dropFolder': 'Para pastas usa «Pasta inteira».',
    'review.import.reading': 'A ler o ficheiro ZIP «{name}»…',
    'review.import.files': 'Ficheiros',
    'review.import.noFiles': 'Ainda não escolheste fotos.',
    'review.import.selected': '{n} ficheiros na seleção',
    'review.import.clear': 'Limpar seleção',
    'review.import.start': 'Importar {n} fotos',
    'review.import.nothing': 'Não há fotos para importar na seleção.',
    'review.import.needTarget': 'Escolhe primeiro a localização de destino.',
    'review.import.phase.hash': 'A verificar ficheiros (SHA-256)',
    'review.import.phase.upload': 'A enviar',
    'review.import.progress': '{x} de {y}',
    'review.import.cancel': 'Cancelar',
    'review.import.cancelling': 'A cancelar – os envios em curso ainda vão terminar…',
    'review.import.keepOpen': 'Podes continuar a trabalhar na app – a importação continua enquanto a app estiver aberta.',
    'review.import.retry': 'Tentar de novo as que falharam ({n})',
    'review.import.resume': 'Continuar as canceladas ({n})',
    'review.import.more': 'Mostrar mais ({n})',
    'review.import.st.wartet': 'À espera',
    'review.import.st.pruefen': 'A verificar',
    'review.import.st.laeuft': 'A enviar',
    'review.import.st.importiert': 'Importada',
    'review.import.st.vorhanden': 'Já existe (duplicado)',
    'review.import.st.doppelt': 'Repetida nesta seleção',
    'review.import.st.uebersprungen': 'Ignorado (não é imagem)',
    'review.import.st.fehler': 'Erro',
    'review.import.st.abgebrochen': 'Cancelada',
    'review.import.sameAs': 'mesmo ficheiro que «{name}»',
    'review.import.existingAt': 'já existe em {path}',
    'review.import.inZip': 'de {zip}',
    'review.import.summary': 'Resumo',
    'review.import.doneOk': 'Importação concluída.',
    'review.import.doneCancelled': 'Importação cancelada. As fotos já importadas mantêm-se.',
    'review.import.queue': 'Marcar fotos importadas para análise por IA',
    'review.import.queued': '{n} fotos marcadas para análise por IA.',
    'review.import.queuedNone': 'Sem alterações: as fotos já estavam marcadas ou já foram analisadas.',
    'review.import.aiHonest': 'A app não tem um serviço de IA próprio. A análise é feita pelo Claude (Anthropic) a partir das fotos originais; o resultado é importado abaixo como ficheiro. Cada deteção continua a ser uma sugestão até alguém a verificar.',
    'review.import.zipErr.zip_invalid': 'O ficheiro ZIP está danificado ou não é um ficheiro ZIP.',
    'review.import.zipErr.zip64': 'Arquivos ZIP64 (mais de 4 GB ou muitos ficheiros) não são suportados. Divide-o em ficheiros ZIP mais pequenos ou escolhe a pasta diretamente.',
    'review.import.zipErr.zip_encrypted': 'Protegido com palavra-passe – não suportado. Cria o ZIP sem palavra-passe.',
    'review.import.zipErr.zip_method': 'Método de compressão desconhecido – cria um ficheiro ZIP normal.',
    'review.import.zipErr.zip_unsupported': 'Este navegador não consegue descomprimir ficheiros ZIP. Escolhe a pasta ou as fotos diretamente.',
    'review.import.zipErr.zip_crc': 'O ficheiro dentro do ZIP está danificado (soma de verificação errada).',
    'review.import.zipEmpty': 'O ficheiro ZIP não contém ficheiros.',
    'review.ana.title': 'Importar resultado da IA',
    'review.ana.intro': 'Escolhe o ficheiro JSON com o resultado da análise (formato «lgr-photo-analysis/1»). A associação às fotos é feita pela soma SHA-256 do ficheiro original. Importar várias vezes não cria objetos duplicados.',
    'review.ana.pick': 'Escolher ficheiro JSON',
    'review.ana.other': 'Escolher outro ficheiro',
    'review.ana.invalidJson': 'O ficheiro não é JSON válido ({msg}).',
    'review.ana.invalidShape': 'Formato desconhecido: espera-se um objeto com «photos» ou uma lista de fotos.',
    'review.ana.schemaWarn': '«schema» em falta ou desconhecido ({schema}). Recomendado: «lgr-photo-analysis/1». O ficheiro pode ser importado na mesma.',
    'review.ana.empty': 'O ficheiro não contém fotos.',
    'review.ana.preview': 'Pré-visualização: {file}',
    'review.ana.photos': 'Fotos no ficheiro',
    'review.ana.objects': 'Objetos detetados',
    'review.ana.errPhotos': 'Fotos com erro de análise',
    'review.ana.dupPhotos': 'Marcadas como duplicado',
    'review.ana.known': 'Já na app',
    'review.ana.unknown': 'Ainda não importadas',
    'review.ana.knownNa': 'Não foi possível comparar com as fotos da app.',
    'review.ana.noSha': '{n} entradas sem SHA-256 válido – não podem ser associadas a nenhuma foto.',
    'review.ana.badItems': '{n} entradas não são objetos e contam como inválidas.',
    'review.ana.badObjects': '{n} objetos sem chave («key») ou nome contam como inválidos.',
    'review.ana.byConf': 'Objetos por grau de certeza',
    'review.ana.col.file': 'Ficheiro',
    'review.ana.col.status': 'Estado',
    'review.ana.col.objects': 'Objetos',
    'review.ana.col.inApp': 'Na app',
    'review.ana.st.analysiert': 'Analisada',
    'review.ana.st.fehler': 'Erro',
    'review.ana.st.duplikat': 'Duplicado',
    'review.ana.source': 'Origem da análise',
    'review.ana.sourceHint': 'Fica guardada em cada foto como origem da análise.',
    'review.ana.sourcePh': 'p. ex. Claude (Anthropic) – sessão 06.11.2026',
    'review.ana.sourceFromFile': 'Indicado no ficheiro: «{source}»',
    'review.ana.start': 'Importar resultado ({n} fotos)',
    'review.ana.packet': 'Pacote {x} de {y}',
    'review.ana.packets': 'É enviado em {n} pacote(s) de no máximo {size} fotos.',
    'review.ana.sending': 'A importar o resultado da IA',
    'review.ana.result': 'Resultado da importação',
    'review.ana.r.matched': 'Fotos associadas',
    'review.ana.r.created': 'Objetos novos',
    'review.ana.r.existing': 'Já existiam',
    'review.ana.r.failed': 'Falharam (análise)',
    'review.ana.r.duplicates': 'Duplicados',
    'review.ana.r.invalid': 'Inválidos',
    'review.ana.r.unmatched': 'Não associadas',
    'review.ana.unmatchedTitle': 'Ficheiros não associados',
    'review.ana.unmatchedHint': 'Estas fotos ainda não estão na app. Importa primeiro as fotos e depois volta a importar este ficheiro – não são criados duplicados.',
    'review.ana.packetErrors': '{n} pacotes não puderam ser importados:',
    'review.ana.retryPackets': 'Reenviar os pacotes que falharam',
    'review.title': 'Verificar deteções da IA',
    'review.sub': 'Sugestões da análise de fotos. Só depois da tua confirmação são criados inventário, códigos e etiquetas.',
    'review.readOnly': 'Podes ver as sugestões. Só responsáveis de armazém e administradores as podem verificar e confirmar.',
    'review.toImport': 'Importar fotos / resultado da IA',
    'review.spaceMissing': 'A sala {code} não foi encontrada. São mostradas todas as salas.',
    'review.f.space': 'Sala',
    'review.f.allSpaces': 'Todas as salas',
    'review.f.status': 'Estado',
    'review.f.conf': 'Certeza',
    'review.f.allConf': 'Todas',
    'review.f.kind': 'Tipo',
    'review.f.allKinds': 'Todos os tipos',
    'review.f.cat': 'Categoria',
    'review.f.allCats': 'Todas as categorias',
    'review.f.noCat': 'Sem categoria',
    'review.f.search': 'Pesquisar',
    'review.f.searchPh': 'Nome, marca, modelo, texto lido…',
    'review.f.reset': 'Limpar filtros',
    'review.count': '{n} objetos · {m} deteções',
    'review.empty': 'Sem deteções para estes filtros.',
    'review.emptyAll': 'Ainda não há deteções da IA. Importa primeiro as fotos e o resultado da IA.',
    'review.more': 'Mostrar mais ({n})',
    'review.photoN': 'Foto {i} de {n}',
    'review.onPhotos': 'O mesmo objeto em {n} fotos',
    'review.zoom': 'Ampliar foto',
    'review.photoAlt': 'Foto {file}',
    'review.noPos': 'Sem posição indicada na foto',
    'review.markerHint': 'Marca = posição aproximada na foto',
    'review.serial': 'N.º de série',
    'review.kind': 'Tipo',
    'review.qty': 'Quantidade',
    'review.qtyUncertain': 'incerta',
    'review.qtyUnknown': 'não detetada',
    'review.conf': 'Certeza',
    'review.textRead': 'Textos lidos',
    'review.target': 'Localização de destino',
    'review.photoLoc': 'igual à foto',
    'review.catSuggested': 'Sugestão da IA «{text}» (nenhuma categoria correspondente)',
    'review.product': 'Informação do produto',
    'review.maker': 'Página do fabricante',
    'review.manual': 'Manual',
    'review.productSource': 'Fonte: {src}',
    'review.productChecked': 'Verificado em {date}',
    'review.condition': 'Condição',
    'review.partOf': 'Faz parte de',
    'review.dupTitle': 'Possíveis duplicados no inventário',
    'review.dupReason.model': 'mesma marca e mesmo modelo',
    'review.dupReason.serial': 'mesmo n.º de série',
    'review.dupReason.name': 'nome muito parecido',
    'review.link': 'Associar ao existente',
    'review.linkQ': 'Associar a um registo existente?',
    'review.linkText': '«{name}» vai ser associado a {code} «{target}». Não é criado nada novo.',
    'review.linked': 'Associado a {code}',
    'review.reviewedBy': 'Verificado por {name} · {date}',
    'review.created': 'Registado como',
    'review.mergedInto': 'Fundido com «{name}»',
    'review.act.confirm': 'Confirmar',
    'review.act.edit': 'Editar',
    'review.act.merge': 'Fundir',
    'review.act.location': 'Mudar localização',
    'review.act.later': 'Verificar mais tarde',
    'review.act.reject': 'Rejeitar',
    'review.act.reopen': 'Reabrir',
    'review.act.label': 'Imprimir etiqueta',
    'review.act.split': 'Separar novamente',
    'review.splitHint': 'Esta foto foi associada. Se mostrar outro objeto: reabrir como sugestão própria.',
    'review.c.title': 'Confirmar e registar',
    'review.c.kind': 'O que é?',
    'review.c.name': 'Nome',
    'review.c.loc': 'Localização',
    'review.c.parent': 'Fica em (localização superior)',
    'review.c.qty': 'Quantidade contada',
    'review.c.qtyAi': 'Estimativa da IA: {qty} (incerta) – conta e introduz a quantidade real.',
    'review.c.qtyNone': 'Nenhuma quantidade detetada – conta e introduz o valor.',
    'review.c.qtySure': 'Quantidade detetada com certeza – corrige se necessário.',
    'review.c.qtyEach': 'Cada unidade recebe um número e uma etiqueta próprios (no máximo 50).',
    'review.c.withoutStock': 'Registar sem stock (contar mais tarde)',
    'review.c.withoutStockHint': 'O artigo é criado com stock 0 e marcado como «quantidade ainda não contada».',
    'review.c.locType': 'Tipo de localização',
    'review.c.short': 'Código curto',
    'review.c.shortHint': 'Sugestão segundo a convenção (p. ex. RG01). Pode ficar vazio.',
    'review.c.needKind': 'Escolhe o que é.',
    'review.c.needQty': 'Introduz a quantidade contada.',
    'review.c.qtyRange': 'Introduz um número inteiro de 1 a 50.',
    'review.c.qtyInvalid': 'Introduz uma quantidade válida (0 ou mais).',
    'review.c.group': 'Este objeto aparece em {n} fotos – é registado apenas uma vez.',
    'review.ok.title': 'Registado',
    'review.ok.machine': '{n} máquina(s) / artigo(s) individual(is) criado(s):',
    'review.ok.article': 'Artigo criado:',
    'review.ok.location': 'Localização criada:',
    'review.ok.merged': 'Foram associadas mais {n} fotos do mesmo objeto.',
    'review.ok.labelHint': 'Imprime agora a etiqueta e cola-a.',
    'review.ok.continue': 'Continuar a verificar',
    'review.e.title': 'Editar sugestão',
    'review.e.qtyCertain': 'A quantidade foi contada (certa)',
    'review.e.allPhotos': 'As alterações aplicam-se às {n} fotos deste objeto.',
    'review.e.done': 'Guardado',
    'review.m.title': 'Fundir',
    'review.m.text': 'É o mesmo objeto que outra sugestão nesta sala? Escolhe a outra sugestão – esta foto fica associada a ela.',
    'review.m.none': 'Não há outra sugestão na mesma sala.',
    'review.m.search': 'Pesquisar sugestões',
    'review.m.pick': 'Escolhe uma sugestão.',
    'review.m.done': 'Fundido',
    'review.l.title': 'Mudar localização',
    'review.l.photo': '– igual à foto ({path}) –',
    'review.l.done': 'Localização alterada',
    'review.later.done': 'Marcado para mais tarde',
    'review.r.title': 'Rejeitar sugestão',
    'review.r.text': 'As sugestões rejeitadas não entram no inventário. Podem ser reabertas.',
    'review.r.reason': 'Motivo',
    'review.r.reasonPh': 'p. ex. não é inventário, deteção errada',
    'review.r.q.noInventory': 'Não é inventário',
    'review.r.q.wrong': 'Deteção errada',
    'review.r.q.notOurs': 'Não pertence à empresa',
    'review.r.q.double': 'Registado em duplicado',
    'review.r.done': 'Rejeitado',
    'review.reopen.done': 'Reaberto',
    'review.b.btn': 'Confirmar todas as certas ({n})',
    'review.b.title': 'Confirmar sugestões certas',
    'review.b.text': 'Só sugestões detetadas com certeza, com tipo, quantidade contada e categoria, e que não se parecem com nenhum registo existente. Quantidades incertas nunca são confirmadas automaticamente.',
    'review.b.submit': 'Confirmar as selecionadas',
    'review.b.none': 'Seleciona pelo menos uma sugestão.',
    'review.b.report': '{ok} confirmadas, {fail} falharam.',
    'review.b.labels': 'Imprimir etiquetas ({n})',
    'review.b.selected': '{n} selecionadas',
  },
  es: {
    'review.import.title': 'Importar fotos',
    'review.import.sub': 'Sube fotos de una sala o ubicación, márcalas para el análisis con IA e importa el resultado.',
    'review.import.staffOnly': 'Solo los responsables de almacén y los administradores pueden importar fotos y resultados de IA.',
    'review.import.noSpace': 'Todavía no hay ninguna sala. Crea primero una sala en «Organizar almacén» (p. ej. taller u oficina).',
    'review.import.toOrganize': 'Ir a «Organizar almacén»',
    'review.import.toReview': 'Revisar detecciones',
    'review.import.target': 'Ubicación de destino',
    'review.import.targetHint': 'Todas las fotos de esta selección se asignan a esta sala o ubicación.',
    'review.import.targetPick': '– elegir ubicación –',
    'review.import.targetMissing': 'No se ha encontrado la ubicación {code}. Elige la ubicación de destino.',
    'review.import.sources': 'Elegir fotos',
    'review.import.src.photos': 'Fotos',
    'review.import.src.photosHint': 'Varias a la vez',
    'review.import.src.folder': 'Carpeta completa',
    'review.import.src.folderHint': 'Las subcarpetas se guardan como ruta',
    'review.import.src.zip': 'Archivo ZIP',
    'review.import.src.zipHint': 'JPG, PNG, WebP, HEIC del archivo',
    'review.import.src.camera': 'Cámara',
    'review.import.src.cameraHint': 'Hacer fotos directamente con el móvil',
    'review.import.drop': 'O arrastra aquí fotos o archivos ZIP.',
    'review.import.dropFolder': 'Para carpetas usa «Carpeta completa».',
    'review.import.reading': 'Leyendo el archivo ZIP «{name}»…',
    'review.import.files': 'Archivos',
    'review.import.noFiles': 'Todavía no has elegido fotos.',
    'review.import.selected': '{n} archivos en la selección',
    'review.import.clear': 'Vaciar selección',
    'review.import.start': 'Importar {n} fotos',
    'review.import.nothing': 'No hay fotos para importar en la selección.',
    'review.import.needTarget': 'Elige primero la ubicación de destino.',
    'review.import.phase.hash': 'Comprobando archivos (SHA-256)',
    'review.import.phase.upload': 'Subiendo',
    'review.import.progress': '{x} de {y}',
    'review.import.cancel': 'Cancelar',
    'review.import.cancelling': 'Cancelando: las subidas en curso todavía terminarán…',
    'review.import.keepOpen': 'Puedes seguir trabajando en la app: la importación continúa mientras la app esté abierta.',
    'review.import.retry': 'Reintentar las fallidas ({n})',
    'review.import.resume': 'Continuar las canceladas ({n})',
    'review.import.more': 'Mostrar más ({n})',
    'review.import.st.wartet': 'En espera',
    'review.import.st.pruefen': 'Comprobando',
    'review.import.st.laeuft': 'Subiendo',
    'review.import.st.importiert': 'Importada',
    'review.import.st.vorhanden': 'Ya existe (duplicado)',
    'review.import.st.doppelt': 'Repetida en esta selección',
    'review.import.st.uebersprungen': 'Omitido (no es imagen)',
    'review.import.st.fehler': 'Error',
    'review.import.st.abgebrochen': 'Cancelada',
    'review.import.sameAs': 'mismo archivo que «{name}»',
    'review.import.existingAt': 'ya existe en {path}',
    'review.import.inZip': 'de {zip}',
    'review.import.summary': 'Resumen',
    'review.import.doneOk': 'Importación terminada.',
    'review.import.doneCancelled': 'Importación cancelada. Las fotos ya importadas se conservan.',
    'review.import.queue': 'Marcar las fotos importadas para el análisis con IA',
    'review.import.queued': '{n} fotos marcadas para el análisis con IA.',
    'review.import.queuedNone': 'Sin cambios: las fotos ya estaban marcadas o ya se han analizado.',
    'review.import.aiHonest': 'La app no tiene un servicio de IA propio. El análisis lo hace Claude (Anthropic) a partir de las fotos originales; el resultado se importa abajo como archivo. Cada detección sigue siendo una propuesta hasta que alguien la revise.',
    'review.import.zipErr.zip_invalid': 'El archivo ZIP está dañado o no es un archivo ZIP.',
    'review.import.zipErr.zip64': 'Los archivos ZIP64 (más de 4 GB o muchísimos archivos) no son compatibles. Divídelo en archivos ZIP más pequeños o elige la carpeta directamente.',
    'review.import.zipErr.zip_encrypted': 'Protegido con contraseña: no es compatible. Crea el ZIP sin contraseña.',
    'review.import.zipErr.zip_method': 'Método de compresión desconocido: crea un archivo ZIP normal.',
    'review.import.zipErr.zip_unsupported': 'Este navegador no puede descomprimir archivos ZIP. Elige la carpeta o las fotos directamente.',
    'review.import.zipErr.zip_crc': 'El archivo dentro del ZIP está dañado (la suma de comprobación no coincide).',
    'review.import.zipEmpty': 'El archivo ZIP no contiene archivos.',
    'review.ana.title': 'Importar resultado de la IA',
    'review.ana.intro': 'Elige el archivo JSON con el resultado del análisis (formato «lgr-photo-analysis/1»). La asignación a las fotos se hace con la suma SHA-256 del archivo original. Importar varias veces no crea objetos duplicados.',
    'review.ana.pick': 'Elegir archivo JSON',
    'review.ana.other': 'Elegir otro archivo',
    'review.ana.invalidJson': 'El archivo no es JSON válido ({msg}).',
    'review.ana.invalidShape': 'Formato desconocido: se espera un objeto con «photos» o una lista de fotos.',
    'review.ana.schemaWarn': '«schema» ausente o desconocido ({schema}). Se recomienda «lgr-photo-analysis/1». El archivo se puede importar igualmente.',
    'review.ana.empty': 'El archivo no contiene fotos.',
    'review.ana.preview': 'Vista previa: {file}',
    'review.ana.photos': 'Fotos en el archivo',
    'review.ana.objects': 'Objetos detectados',
    'review.ana.errPhotos': 'Fotos con error de análisis',
    'review.ana.dupPhotos': 'Marcadas como duplicado',
    'review.ana.known': 'Ya en la app',
    'review.ana.unknown': 'Aún no importadas',
    'review.ana.knownNa': 'No se pudo comparar con las fotos de la app.',
    'review.ana.noSha': '{n} entradas sin SHA-256 válido: no se pueden asignar a ninguna foto.',
    'review.ana.badItems': '{n} entradas no son objetos y cuentan como no válidas.',
    'review.ana.badObjects': '{n} objetos sin clave («key») o nombre cuentan como no válidos.',
    'review.ana.byConf': 'Objetos por grado de seguridad',
    'review.ana.col.file': 'Archivo',
    'review.ana.col.status': 'Estado',
    'review.ana.col.objects': 'Objetos',
    'review.ana.col.inApp': 'En la app',
    'review.ana.st.analysiert': 'Analizada',
    'review.ana.st.fehler': 'Error',
    'review.ana.st.duplikat': 'Duplicado',
    'review.ana.source': 'Origen del análisis',
    'review.ana.sourceHint': 'Se guarda en cada foto como origen del análisis.',
    'review.ana.sourcePh': 'p. ej. Claude (Anthropic) – sesión 06.11.2026',
    'review.ana.sourceFromFile': 'Indicado en el archivo: «{source}»',
    'review.ana.start': 'Importar resultado ({n} fotos)',
    'review.ana.packet': 'Paquete {x} de {y}',
    'review.ana.packets': 'Se envía en {n} paquete(s) de como máximo {size} fotos.',
    'review.ana.sending': 'Importando el resultado de la IA',
    'review.ana.result': 'Resultado de la importación',
    'review.ana.r.matched': 'Fotos asignadas',
    'review.ana.r.created': 'Objetos nuevos',
    'review.ana.r.existing': 'Ya existían',
    'review.ana.r.failed': 'Fallidas (análisis)',
    'review.ana.r.duplicates': 'Duplicados',
    'review.ana.r.invalid': 'No válidos',
    'review.ana.r.unmatched': 'Sin asignar',
    'review.ana.unmatchedTitle': 'Archivos sin asignar',
    'review.ana.unmatchedHint': 'Estas fotos todavía no están en la app. Importa primero las fotos y luego vuelve a importar este archivo: no se crean duplicados.',
    'review.ana.packetErrors': 'No se pudieron importar {n} paquetes:',
    'review.ana.retryPackets': 'Reenviar los paquetes fallidos',
    'review.title': 'Revisar detecciones de la IA',
    'review.sub': 'Propuestas del análisis de fotos. Solo después de tu confirmación se crean inventario, códigos y etiquetas.',
    'review.readOnly': 'Puedes ver las propuestas. Solo los responsables de almacén y los administradores pueden revisarlas y confirmarlas.',
    'review.toImport': 'Importar fotos / resultado de la IA',
    'review.spaceMissing': 'No se ha encontrado la sala {code}. Se muestran todas las salas.',
    'review.f.space': 'Sala',
    'review.f.allSpaces': 'Todas las salas',
    'review.f.status': 'Estado',
    'review.f.conf': 'Seguridad',
    'review.f.allConf': 'Todas',
    'review.f.kind': 'Tipo',
    'review.f.allKinds': 'Todos los tipos',
    'review.f.cat': 'Categoría',
    'review.f.allCats': 'Todas las categorías',
    'review.f.noCat': 'Sin categoría',
    'review.f.search': 'Buscar',
    'review.f.searchPh': 'Nombre, marca, modelo, texto leído…',
    'review.f.reset': 'Quitar filtros',
    'review.count': '{n} objetos · {m} detecciones',
    'review.empty': 'No hay detecciones con estos filtros.',
    'review.emptyAll': 'Todavía no hay detecciones de la IA. Importa primero las fotos y el resultado de la IA.',
    'review.more': 'Mostrar más ({n})',
    'review.photoN': 'Foto {i} de {n}',
    'review.onPhotos': 'El mismo objeto en {n} fotos',
    'review.zoom': 'Ampliar foto',
    'review.photoAlt': 'Foto {file}',
    'review.noPos': 'Sin posición indicada en la foto',
    'review.markerHint': 'Marca = posición aproximada en la foto',
    'review.serial': 'N.º de serie',
    'review.kind': 'Tipo',
    'review.qty': 'Cantidad',
    'review.qtyUncertain': 'insegura',
    'review.qtyUnknown': 'no detectada',
    'review.conf': 'Seguridad',
    'review.textRead': 'Textos leídos',
    'review.target': 'Ubicación de destino',
    'review.photoLoc': 'igual que la foto',
    'review.catSuggested': 'Propuesta de la IA «{text}» (no hay categoría que coincida)',
    'review.product': 'Información del producto',
    'review.maker': 'Página del fabricante',
    'review.manual': 'Manual',
    'review.productSource': 'Fuente: {src}',
    'review.productChecked': 'Comprobado el {date}',
    'review.condition': 'Estado',
    'review.partOf': 'Forma parte de',
    'review.dupTitle': 'Posibles duplicados en el inventario',
    'review.dupReason.model': 'misma marca y mismo modelo',
    'review.dupReason.serial': 'mismo n.º de serie',
    'review.dupReason.name': 'nombre muy parecido',
    'review.link': 'Vincular con el existente',
    'review.linkQ': '¿Vincular con un registro existente?',
    'review.linkText': '«{name}» se vinculará con {code} «{target}». No se crea nada nuevo.',
    'review.linked': 'Vinculado con {code}',
    'review.reviewedBy': 'Revisado por {name} · {date}',
    'review.created': 'Registrado como',
    'review.mergedInto': 'Fusionado con «{name}»',
    'review.act.confirm': 'Confirmar',
    'review.act.edit': 'Editar',
    'review.act.merge': 'Fusionar',
    'review.act.location': 'Cambiar ubicación',
    'review.act.later': 'Revisar más tarde',
    'review.act.reject': 'Rechazar',
    'review.act.reopen': 'Reabrir',
    'review.act.label': 'Imprimir etiqueta',
    'review.act.split': 'Volver a separar',
    'review.splitHint': 'Esta foto se ha asignado. Si muestra otro objeto: reabrir como propuesta propia.',
    'review.c.title': 'Confirmar y registrar',
    'review.c.kind': '¿Qué es?',
    'review.c.name': 'Nombre',
    'review.c.loc': 'Ubicación',
    'review.c.parent': 'Está en (ubicación superior)',
    'review.c.qty': 'Cantidad contada',
    'review.c.qtyAi': 'Estimación de la IA: {qty} (insegura). Cuenta e introduce la cantidad real.',
    'review.c.qtyNone': 'No se ha detectado ninguna cantidad. Cuenta e introduce el valor.',
    'review.c.qtySure': 'Cantidad detectada con seguridad; corrígela si hace falta.',
    'review.c.qtyEach': 'Cada unidad recibe su propio número y su propia etiqueta (máximo 50).',
    'review.c.withoutStock': 'Registrar sin stock (contar más tarde)',
    'review.c.withoutStockHint': 'El artículo se crea con stock 0 y se marca como «cantidad aún no contada».',
    'review.c.locType': 'Tipo de ubicación',
    'review.c.short': 'Código corto',
    'review.c.shortHint': 'Propuesta según la convención (p. ej. RG01). Puede quedar vacío.',
    'review.c.needKind': 'Elige qué es.',
    'review.c.needQty': 'Introduce la cantidad contada.',
    'review.c.qtyRange': 'Introduce un número entero de 1 a 50.',
    'review.c.qtyInvalid': 'Introduce una cantidad válida (0 o más).',
    'review.c.group': 'Este objeto aparece en {n} fotos: se registra una sola vez.',
    'review.ok.title': 'Registrado',
    'review.ok.machine': '{n} máquina(s) / activo(s) individual(es) creado(s):',
    'review.ok.article': 'Artículo creado:',
    'review.ok.location': 'Ubicación creada:',
    'review.ok.merged': 'Se han asignado {n} fotos más del mismo objeto.',
    'review.ok.labelHint': 'Imprime ahora la etiqueta y pégala.',
    'review.ok.continue': 'Seguir revisando',
    'review.e.title': 'Editar propuesta',
    'review.e.qtyCertain': 'La cantidad está contada (segura)',
    'review.e.allPhotos': 'Los cambios se aplican a las {n} fotos de este objeto.',
    'review.e.done': 'Guardado',
    'review.m.title': 'Fusionar',
    'review.m.text': '¿Es el mismo objeto que otra propuesta de esta sala? Elige la otra propuesta: esta foto se le asignará.',
    'review.m.none': 'No hay otra propuesta en la misma sala.',
    'review.m.search': 'Buscar propuestas',
    'review.m.pick': 'Elige una propuesta.',
    'review.m.done': 'Fusionado',
    'review.l.title': 'Cambiar ubicación',
    'review.l.photo': '– igual que la foto ({path}) –',
    'review.l.done': 'Ubicación cambiada',
    'review.later.done': 'Marcado para más tarde',
    'review.r.title': 'Rechazar propuesta',
    'review.r.text': 'Las propuestas rechazadas no pasan al inventario. Se pueden reabrir.',
    'review.r.reason': 'Motivo',
    'review.r.reasonPh': 'p. ej. no es inventario, detección errónea',
    'review.r.q.noInventory': 'No es inventario',
    'review.r.q.wrong': 'Detección errónea',
    'review.r.q.notOurs': 'No es de la empresa',
    'review.r.q.double': 'Registrado dos veces',
    'review.r.done': 'Rechazado',
    'review.reopen.done': 'Reabierto',
    'review.b.btn': 'Confirmar todas las seguras ({n})',
    'review.b.title': 'Confirmar propuestas seguras',
    'review.b.text': 'Solo propuestas detectadas con seguridad, con tipo, cantidad contada y categoría, y que no se parecen a ningún registro existente. Las cantidades inseguras nunca se confirman automáticamente.',
    'review.b.submit': 'Confirmar las seleccionadas',
    'review.b.none': 'Selecciona al menos una propuesta.',
    'review.b.report': '{ok} confirmadas, {fail} fallidas.',
    'review.b.labels': 'Imprimir etiquetas ({n})',
    'review.b.selected': '{n} seleccionadas',
  },
});

// ---------------------------------------------------------------------------
// Konstanten und kleine Helfer
// ---------------------------------------------------------------------------
const UPLOAD_PARALLEL = 3;
const HASH_PARALLEL = 2;
const PACKET = 25;
const PAGE = 20;
const LIST_LIMIT = 200;
const IMG_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const UNITS = ['Stk', 'm', 'm²', 'kg', 'l', 'Rolle', 'Pkg', 'Paar', 'Set'];
const SUB_TYPES = LOCATION_TYPES.filter((x) => x !== 'lager' && x !== 'raum');
const CONF_RANK = { sicher: 0, wahrscheinlich: 1, unbekannt: 2 };
const STATUS_FILTERS = ['offen', 'spaeter', 'bestaetigt', 'abgelehnt', 'alle'];
const BULK_KINDS = ['einzelinventar', 'bestandsartikel', 'set'];
const SS_FILTER = 'lgr.review.filter';
const IMP_STATUSES = ['wartet', 'pruefen', 'laeuft', 'importiert', 'vorhanden', 'doppelt', 'uebersprungen', 'fehler', 'abgebrochen'];
const IMP_PILL = {
  wartet: 'pill-muted', pruefen: 'pill-info', laeuft: 'pill-info', importiert: 'pill-ok', vorhanden: 'pill-warn',
  doppelt: 'pill-muted', uebersprungen: 'pill-muted', fehler: 'pill-danger', abgebrochen: 'pill-warn',
};

function mount(ctx) {
  const root = document.createElement('div');
  root.className = 'page';
  ctx.el.replaceChildren(root);
  return root;
}
function qget(ctx, key) {
  const q = ctx.query;
  if (!q) return null;
  const v = typeof q.get === 'function' ? q.get(key) : q[key];
  return v === undefined || v === null || v === '' ? null : String(v);
}
function loadingHtml() { return `<div class="empty"><p>${esc(t('common.loading'))}</p></div>`; }
function errorBlock(err) {
  return emptyHtml(errorText(err), `<button type="button" class="btn" data-act="retry">${icon('history')}${esc(t('btn.retry'))}</button>`);
}
function ssGet(key) { try { return JSON.parse(sessionStorage.getItem(key) || 'null'); } catch (e) { return null; } }
function ssSet(key, v) { try { sessionStorage.setItem(key, JSON.stringify(v)); } catch (e) { /* ohne Speicher */ } }
/** Suchtext ohne Gross/Klein und ohne Akzente */
function norm(s) { return String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim(); }
const compact = (s) => norm(s).replace(/[^a-z0-9]/g, '');
function fmtBytes(n) {
  const v = Number(n) || 0;
  if (v < 1024) return `${v} B`;
  if (v < 1024 * 1024) return `${fmtNum(Math.round(v / 1024))} KB`;
  return `${fmtNum(Math.round(v / 1024 / 102.4) / 10)} MB`;
}
function safeUrl(u) {
  try { const x = new URL(String(u)); return x.protocol === 'http:' || x.protocol === 'https:' ? x.href : null; } catch (e) { return null; }
}
function hostOf(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } }
function progressHtml(x, y, label) {
  const pct = y > 0 ? Math.round((x / y) * 100) : 0;
  return `<div class="rv-progress">
    <div class="rv-progress-label"><span>${esc(label)}</span><span>${esc(t('review.import.progress', { x, y }))}</span></div>
    <div class="rv-bar" role="progressbar" aria-label="${esc(label)}" aria-valuemin="0" aria-valuemax="${y}" aria-valuenow="${x}"><span style="width:${pct}%"></span></div>
  </div>`;
}
async function pool(items, n, fn) {
  let i = 0;
  const worker = async () => { while (i < items.length) { const it = items[i++]; await fn(it); } };
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
}
function zipErrorText(err) {
  if (err instanceof ZipError || (err && /^zip/.test(err.code || ''))) {
    const k = 'review.import.zipErr.' + err.code;
    const s = t(k);
    return s === k ? t('review.import.zipErr.zip_invalid') : s;
  }
  return errorText(err);
}
/** Lagerorte als <option>-Liste (Pfad + lesbarer Code), nur nicht archivierte */
function locationOptionsHtml(locs, selectedId, emptyLabel) {
  return (emptyLabel !== null && emptyLabel !== undefined ? `<option value="">${esc(emptyLabel)}</option>` : '')
    + (locs || []).filter((l) => !l.archived || l.id === selectedId).map((l) => {
      const code = locationDisplayCode(l);
      return `<option value="${esc(l.id)}"${l.id === selectedId ? ' selected' : ''}>${esc(l.path || l.name)}${code ? ` (${esc(code)})` : ''}</option>`;
    }).join('');
}

// Etiketten für neu erfasste Einträge (codes aus reviewDetection)
async function printCodes(api, created) {
  const items = [];
  for (const c of created) {
    try {
      const row = c.entity === 'machine' ? await api.getMachineByCode(c.code)
        : c.entity === 'article' ? await api.getArticleByCode(c.code)
          : c.entity === 'location' ? await api.getLocationByCode(c.code) : null;
      const it = row ? labelItem(c.entity, row) : null;
      if (it) items.push(it);
    } catch (err) { toast(errorText(err), 'error'); }
  }
  if (!items.length) return;
  try { await openLabelDialog(items); } catch (err) { toast(errorText(err), 'error'); }
}
const entityHref = (entity, code) => (entity === 'machine' ? '#/m/' : entity === 'article' ? '#/a/' : '#/o/') + encodeURIComponent(code);

// ===========================================================================
// 1) Fotos importieren – Zustand bleibt erhalten, auch wenn die Ansicht neu gezeichnet wird
// ===========================================================================
const IMP = {
  items: [], seq: 0, locationId: null, running: false, cancel: false, phase: null, done: 0, total: 0,
  finished: false, wasCancelled: false, queued: null, reading: null, listFilter: 'alle', limit: LIST_LIMIT,
  listeners: new Set(),
};
const impNotify = () => { for (const fn of [...IMP.listeners]) fn(); };

function impAdd(o) {
  IMP.items.push({ id: ++IMP.seq, status: 'wartet', error: null, sha: null, dupOf: null, photoId: null, existingPath: null, fatal: false, ...o });
}
const isZipFile = (f) => /\.zip$/i.test(f.name || '') || f.type === 'application/zip' || f.type === 'application/x-zip-compressed';
const isImageFile = (f) => isImageName(f.name) || IMG_MIME.includes(String(f.type || '').toLowerCase());

async function impAddFiles(files, { fromFolder = false } = {}) {
  for (const f of files) {
    if (!fromFolder && isZipFile(f)) { await impAddZip(f); continue; }
    const rel = fromFolder ? (f.webkitRelativePath || '') : '';
    impAdd({ name: f.name, folder: rel ? splitPath(rel).folder : '', size: f.size, file: f, status: isImageFile(f) ? 'wartet' : 'uebersprungen' });
  }
  IMP.finished = false;
  impNotify();
}
async function impAddZip(f) {
  IMP.reading = f.name;
  impNotify();
  try {
    const entries = (await listZipEntries(f)).filter((e) => !e.isDir);
    if (!entries.length) impAdd({ name: f.name, folder: '', size: f.size, status: 'fehler', error: t('review.import.zipEmpty'), fatal: true });
    for (const e of entries) {
      const img = isImageName(e.name);
      impAdd({
        name: e.name, folder: e.folder, size: e.size, zip: f, entry: e, zipName: f.name,
        status: !img ? 'uebersprungen' : e.encrypted ? 'fehler' : 'wartet',
        error: img && e.encrypted ? t('review.import.zipErr.zip_encrypted') : null, fatal: img && e.encrypted,
      });
    }
  } catch (err) {
    const msg = zipErrorText(err);
    impAdd({ name: f.name, folder: '', size: f.size, status: 'fehler', error: msg, fatal: true });
    toast(`${f.name}: ${msg}`, 'error');
  } finally {
    IMP.reading = null;
  }
}
const impBlob = (it) => (it.file ? Promise.resolve(it.file) : readZipEntry(it.zip, it.entry));

function impMarkSelectionDuplicates() {
  const first = new Map();
  for (const it of IMP.items) {
    if (!it.sha || it.status === 'doppelt') continue;
    const f = first.get(it.sha);
    if (!f) { first.set(it.sha, it); continue; }
    if (it.status === 'wartet') { it.status = 'doppelt'; it.dupOf = f.id; }
  }
}

async function impRun(api, onlyIds = null) {
  if (IMP.running) return;
  const locationId = IMP.locationId;
  if (!locationId) { toast(t('review.import.needTarget'), 'error'); return; }
  const sel = IMP.items.filter((it) => (onlyIds ? onlyIds.has(it.id) : it.status === 'wartet'));
  if (!sel.length) { toast(t('review.import.nothing'), 'info'); return; }
  for (const it of sel) { it.status = 'wartet'; it.error = null; }
  Object.assign(IMP, { running: true, cancel: false, finished: false, wasCancelled: false, queued: null });
  try {
    // 1) SHA-256 der Originaldateien (Zuordnung des KI-Ergebnisses, Duplikate)
    const needHash = sel.filter((it) => !it.sha);
    Object.assign(IMP, { phase: 'hash', done: 0, total: needHash.length });
    impNotify();
    await pool(needHash, HASH_PARALLEL, async (it) => {
      if (IMP.cancel) { it.status = 'abgebrochen'; IMP.done++; impNotify(); return; }
      it.status = 'pruefen';
      impNotify();
      try {
        it.sha = await sha256Hex(await impBlob(it));
        it.status = 'wartet';
      } catch (err) {
        it.status = 'fehler';
        it.error = zipErrorText(err);
        if (err instanceof ZipError) it.fatal = true;
      }
      IMP.done++;
      impNotify();
    });
    // 2) gleiche Datei mehrfach in der Auswahl
    impMarkSelectionDuplicates();
    // 3) hochladen (2–3 gleichzeitig)
    const up = sel.filter((it) => it.status === 'wartet' && it.sha);
    Object.assign(IMP, { phase: 'upload', done: 0, total: up.length });
    impNotify();
    await pool(up, UPLOAD_PARALLEL, async (it) => {
      if (IMP.cancel) { it.status = 'abgebrochen'; IMP.done++; impNotify(); return; }
      it.status = 'laeuft';
      impNotify();
      try {
        const file = await impBlob(it);
        const res = await api.importPhoto(file, { locationId, folder: it.folder || null, sha256: it.sha });
        const photo = res && res.photo;
        it.photoId = photo ? photo.id : null;
        if (res && res.duplicate) {
          it.status = 'vorhanden';
          it.existingPath = (photo && photo.location_path) || null;
        } else {
          it.status = 'importiert';
        }
      } catch (err) {
        it.status = 'fehler';
        it.error = zipErrorText(err);
        if (err instanceof ZipError) it.fatal = true;
      }
      IMP.done++;
      impNotify();
    });
  } finally {
    Object.assign(IMP, { running: false, phase: null, finished: true, wasCancelled: IMP.cancel, cancel: false });
    impNotify();
  }
}

function impCounts() {
  const c = Object.fromEntries(IMP_STATUSES.map((s) => [s, 0]));
  for (const it of IMP.items) c[it.status] = (c[it.status] || 0) + 1;
  return c;
}

// ---------- KI-Ergebnis (Zustand ebenfalls dauerhaft für die Sitzung) ----------
const ANA = {
  fileName: null, parsed: null, error: null, source: '', known: null, knownError: false,
  running: false, done: 0, total: 0, result: null, failedPackets: [], listeners: new Set(),
};
const anaNotify = () => { for (const fn of [...ANA.listeners]) fn(); };
const emptyResult = () => ({ matched: 0, created: 0, existing: 0, failed: 0, duplicates: 0, invalid: 0, unmatched: [] });

function parseAnalysis(text) {
  let data;
  try { data = JSON.parse(String(text).replace(/^﻿/, '')); } catch (e) { return { error: t('review.ana.invalidJson', { msg: e.message }) }; }
  let photos; let schema = null; let source = '';
  if (Array.isArray(data)) photos = data;
  else if (data && typeof data === 'object' && Array.isArray(data.photos)) {
    photos = data.photos;
    schema = data.schema === undefined ? null : data.schema;
    source = typeof data.source === 'string' ? data.source.trim() : '';
  } else return { error: t('review.ana.invalidShape') };
  if (!photos.length) return { error: t('review.ana.empty') };
  const st = { photos: photos.length, objects: 0, byConf: { sicher: 0, wahrscheinlich: 0, unbekannt: 0 }, errPhotos: 0, dupPhotos: 0,
    noSha: 0, badItems: 0, badObjects: 0 };
  const rows = photos.map((p) => {
    if (!p || typeof p !== 'object' || Array.isArray(p)) { st.badItems++; return null; }
    const sha = String(p.sha256 || '').trim().toLowerCase();
    const okSha = /^[0-9a-f]{64}$/.test(sha);
    if (!okSha) st.noSha++;
    const status = p.status === 'fehler' ? 'fehler' : p.status === 'duplikat' ? 'duplikat' : 'analysiert';
    if (status === 'fehler') st.errPhotos++;
    if (status === 'duplikat') st.dupPhotos++;
    const conf = { sicher: 0, wahrscheinlich: 0, unbekannt: 0 };
    let n = 0;
    if (status === 'analysiert' && Array.isArray(p.objects)) {
      for (const o of p.objects) {
        if (!o || typeof o !== 'object' || !String(o.key || '').trim() || !String(o.name || '').trim()) { st.badObjects++; continue; }
        const c = CONFIDENCES.includes(o.confidence) ? o.confidence : 'unbekannt';
        conf[c]++; st.byConf[c]++; n++; st.objects++;
      }
    }
    return { file: String(p.file || sha || '?'), folder: typeof p.folder === 'string' ? p.folder : '', sha: okSha ? sha : null, status,
      error: status === 'fehler' ? String(p.error || '') : '', objects: n, conf };
  });
  return { photos, rows, schema, source, stats: st };
}

async function anaLoadKnown(api) {
  ANA.known = null; ANA.knownError = false;
  try {
    const photos = await api.listPhotos({});
    ANA.known = new Set((photos || []).map((p) => String(p.sha256 || '').toLowerCase()));
  } catch (e) { ANA.knownError = true; }
  anaNotify();
}

async function anaRun(api, onlyPackets = null) {
  if (ANA.running || !ANA.parsed) return;
  const items = ANA.parsed.photos;
  const all = Array.from({ length: Math.ceil(items.length / PACKET) }, (_, i) => i);
  const todo = onlyPackets || all;
  if (!onlyPackets) { ANA.result = emptyResult(); ANA.failedPackets = []; }
  Object.assign(ANA, { running: true, done: 0, total: todo.length });
  anaNotify();
  const source = String(ANA.source || '').trim();
  try {
    for (const p of todo) {
      const chunk = items.slice(p * PACKET, (p + 1) * PACKET);
      try {
        const r = (await api.importAnalysis(chunk, source)) || {};
        const R = ANA.result;
        for (const k of ['matched', 'created', 'existing', 'failed', 'duplicates', 'invalid']) R[k] += Number(r[k]) || 0;
        if (Array.isArray(r.unmatched)) R.unmatched.push(...r.unmatched.map(String));
        ANA.failedPackets = ANA.failedPackets.filter((f) => f.packet !== p);
      } catch (err) {
        ANA.failedPackets = ANA.failedPackets.filter((f) => f.packet !== p);
        ANA.failedPackets.push({ packet: p, error: errorText(err) });
      }
      ANA.done++;
      anaNotify();
    }
  } finally {
    ANA.running = false;
    ANA.failedPackets.sort((a, b) => a.packet - b.packet);
    anaNotify();
  }
}

// ---------- Ansicht «organisieren/import» ----------
async function importPage(ctx) {
  const { api } = ctx;
  const root = mount(ctx);
  ctx.setTitle(t('review.import.title'));
  const back = `<a class="back-link" href="#/organisieren">${icon('back')}${esc(t('nav.organize'))}</a>`;
  if (!can(ctx.user, 'staff')) {
    root.innerHTML = `${back}<div class="page-head"><h1>${esc(t('review.import.title'))}</h1></div>
      <div class="alert warn">${icon('alert')}<span>${esc(t('review.import.staffOnly'))}</span></div>
      <div><a class="btn" href="#/organisieren/pruefen">${icon('list')}${esc(t('review.import.toReview'))}</a></div>`;
    return;
  }
  root.innerHTML = loadingHtml();
  let locs;
  try {
    locs = await api.listLocations();
  } catch (err) {
    if (!root.isConnected) return;
    root.innerHTML = back + errorBlock(err);
    root.querySelector('[data-act="retry"]').addEventListener('click', () => ctx.reload());
    toast(errorText(err), 'error');
    return;
  }
  if (!root.isConnected) return;
  locs = (locs || []).filter((l) => !l.archived);
  const rooms = locs.filter((l) => !l.parent_id);

  // Ziel aus ?ort= (interner Code L-…) – sonst bisherige Wahl dieser Sitzung
  const ortCode = (qget(ctx, 'ort') || '').toUpperCase();
  let missing = null;
  if (ortCode) {
    const hit = locs.find((l) => String(l.code).toUpperCase() === ortCode || String(l.code_path || '').toUpperCase() === ortCode);
    if (hit && !IMP.running) IMP.locationId = hit.id;
    if (!hit) missing = ortCode;
  }
  if (IMP.locationId && !locs.some((l) => l.id === IMP.locationId)) IMP.locationId = null;
  const rootOf = (id) => { const l = locs.find((x) => x.id === id); return l ? (locs.find((x) => x.id === (l.root_id || l.id)) || l) : null; };
  const reviewHref = () => { const r = IMP.locationId ? rootOf(IMP.locationId) : null; return '#/organisieren/pruefen' + (r ? '?raum=' + encodeURIComponent(r.code) : ''); };

  const folderOk = 'webkitdirectory' in document.createElement('input');
  root.innerHTML = `
    ${back}
    <div class="page-head">
      <div><h1>${esc(t('review.import.title'))}</h1><div class="sub">${esc(t('review.import.sub'))}</div></div>
      <div class="actions rv-head-actions"><a class="btn" href="${reviewHref()}" data-review-link>${icon('list')}${esc(t('review.import.toReview'))}</a></div>
    </div>
    ${rooms.length ? `
    <section class="section" aria-labelledby="imp-target-h">
      <h2 id="imp-target-h">${esc(t('review.import.target'))}</h2>
      <div class="card stack">
        ${missing ? `<div class="alert warn">${icon('alert')}<span>${esc(t('review.import.targetMissing', { code: missing }))}</span></div>` : ''}
        <div class="field">
          <label for="imp-target">${esc(t('review.import.target'))}</label>
          <select id="imp-target" aria-describedby="imp-target-hint">${locationOptionsHtml(locs, IMP.locationId, t('review.import.targetPick'))}</select>
          <span class="hint" id="imp-target-hint">${esc(t('review.import.targetHint'))}</span>
        </div>
      </div>
    </section>
    <section class="section" aria-labelledby="imp-src-h">
      <h2 id="imp-src-h">${esc(t('review.import.sources'))}</h2>
      <div class="card stack imp-drop" data-drop>
        <div class="imp-sources">
          <button type="button" class="imp-src" data-pick="photos">${icon('image')}<span><b>${esc(t('review.import.src.photos'))}</b><small>${esc(t('review.import.src.photosHint'))}</small></span></button>
          ${folderOk ? `<button type="button" class="imp-src" data-pick="folder">${icon('folder')}<span><b>${esc(t('review.import.src.folder'))}</b><small>${esc(t('review.import.src.folderHint'))}</small></span></button>` : ''}
          <button type="button" class="imp-src" data-pick="zip">${icon('box')}<span><b>${esc(t('review.import.src.zip'))}</b><small>${esc(t('review.import.src.zipHint'))}</small></span></button>
          <button type="button" class="imp-src" data-pick="camera">${icon('camera')}<span><b>${esc(t('review.import.src.camera'))}</b><small>${esc(t('review.import.src.cameraHint'))}</small></span></button>
        </div>
        <p class="hint imp-drop-hint">${esc(t('review.import.drop'))}</p>
        <input type="file" data-in="photos" accept="image/*,.heic,.zip" multiple hidden>
        ${folderOk ? '<input type="file" data-in="folder" webkitdirectory multiple hidden>' : ''}
        <input type="file" data-in="zip" accept=".zip,application/zip,application/x-zip-compressed" multiple hidden>
        <input type="file" data-in="camera" accept="image/*" capture="environment" hidden>
      </div>
    </section>
    <section class="section" aria-labelledby="imp-run-h">
      <h2 id="imp-run-h">${esc(t('review.import.files'))}</h2>
      <div data-imp></div>
    </section>` : `
    <div class="alert warn">${icon('alert')}<div class="stack" style="gap:8px"><span>${esc(t('review.import.noSpace'))}</span>
      <div><a class="btn sm" href="#/organisieren">${icon('plus')}${esc(t('review.import.toOrganize'))}</a></div></div></div>`}
    <section class="section" id="analyse" aria-labelledby="ana-h">
      <h2 id="ana-h">${esc(t('review.ana.title'))}</h2>
      <div data-ana></div>
      <input type="file" data-in="json" accept="application/json,.json" hidden>
    </section>`;

  const impEl = root.querySelector('[data-imp]');
  const anaEl = root.querySelector('[data-ana]');
  const targetSel = root.querySelector('#imp-target');

  // ---------- Fotos: Darstellung ----------
  function renderImp() {
    if (!impEl) return;
    const c = impCounts();
    const total = IMP.items.length;
    const waiting = c.wartet;
    const retryN = IMP.items.filter((it) => it.status === 'fehler' && !it.fatal).length;
    const resumeN = c.abgebrochen;
    if (targetSel) targetSel.disabled = IMP.running;
    root.querySelectorAll('[data-pick]').forEach((b) => { b.disabled = IMP.running; });
    const link = root.querySelector('[data-review-link]');
    if (link) link.setAttribute('href', reviewHref());

    let html = '';
    if (IMP.reading) html += `<div class="alert" role="status">${icon('clock')}<span>${esc(t('review.import.reading', { name: IMP.reading }))}</span></div>`;
    if (IMP.running) {
      const label = IMP.phase === 'hash' ? t('review.import.phase.hash') : t('review.import.phase.upload');
      html += `<div class="card stack" aria-live="polite">${progressHtml(IMP.done, IMP.total, label)}
        ${IMP.cancel ? `<p class="small muted" style="margin:0">${esc(t('review.import.cancelling'))}</p>`
          : `<p class="small muted" style="margin:0">${esc(t('review.import.keepOpen'))}</p>`}
        <div class="row"><button type="button" class="btn danger-outline" data-act="cancel"${IMP.cancel ? ' disabled' : ''}>${icon('x')}${esc(t('review.import.cancel'))}</button></div>
      </div>`;
    } else if (total) {
      html += `<div class="row imp-actions">
        ${waiting ? `<button type="button" class="btn primary" data-act="start"${IMP.locationId ? '' : ' disabled'}>${icon('upload')}${esc(t('review.import.start', { n: waiting }))}</button>` : ''}
        ${retryN ? `<button type="button" class="btn" data-act="retry-failed">${icon('history')}${esc(t('review.import.retry', { n: retryN }))}</button>` : ''}
        ${resumeN ? `<button type="button" class="btn" data-act="resume">${icon('history')}${esc(t('review.import.resume', { n: resumeN }))}</button>` : ''}
        <button type="button" class="btn ghost" data-act="clear">${icon('trash')}${esc(t('review.import.clear'))}</button>
      </div>
      ${waiting && !IMP.locationId ? `<p class="hint" style="margin:0">${esc(t('review.import.needTarget'))}</p>` : ''}`;
    }
    // Zusammenfassung nach einem Lauf
    if (IMP.finished && !IMP.running && total) {
      const okIds = IMP.items.filter((it) => (it.status === 'importiert' || it.status === 'vorhanden') && it.photoId);
      html += `<div class="card stack imp-summary">
        <h3>${esc(t('review.import.summary'))}</h3>
        <div class="alert ${IMP.wasCancelled ? 'warn' : c.fehler ? 'warn' : 'ok'}" role="status">${icon(IMP.wasCancelled || c.fehler ? 'alert' : 'check')}<span>${esc(IMP.wasCancelled ? t('review.import.doneCancelled') : t('review.import.doneOk'))}</span></div>
        <div class="imp-tiles">${['importiert', 'vorhanden', 'doppelt', 'uebersprungen', 'fehler', 'abgebrochen', 'wartet'].filter((s) => c[s]).map((s) =>
          `<div class="imp-tile ${s}"><b>${fmtNum(c[s])}</b><span>${esc(t('review.import.st.' + s))}</span></div>`).join('')}</div>
        ${okIds.length ? (IMP.queued
          ? `<div class="alert ok" role="status">${icon('check')}<span>${esc(IMP.queued.n ? t('review.import.queued', { n: IMP.queued.n }) : t('review.import.queuedNone'))}</span></div>`
          : `<div><button type="button" class="btn primary" data-act="queue">${icon('sparkle')}${esc(t('review.import.queue'))} (${fmtNum(new Set(okIds.map((i) => i.photoId)).size)})</button></div>`) : ''}
        <p class="small muted imp-honest">${icon('alert')}<span>${esc(t('review.import.aiHonest'))}</span></p>
      </div>`;
    }
    // Dateiliste mit Status (nichts wird still weggelassen)
    if (total) {
      const filters = ['alle', ...IMP_STATUSES.filter((s) => c[s])];
      if (!filters.includes(IMP.listFilter)) IMP.listFilter = 'alle';
      const rows = IMP.items.filter((it) => IMP.listFilter === 'alle' || it.status === IMP.listFilter);
      const shown = rows.slice(0, IMP.limit);
      const byId = new Map(IMP.items.map((it) => [it.id, it]));
      html += `<div class="stack">
        <div class="row imp-listhead"><span class="small muted">${esc(t('review.import.selected', { n: total }))}</span></div>
        <div class="chips" role="group" aria-label="${esc(t('common.status'))}">${filters.map((s) =>
          `<button type="button" class="chip" data-imp-filter="${s}" aria-pressed="${IMP.listFilter === s}">${esc(s === 'alle' ? t('common.all') : t('review.import.st.' + s))} (${fmtNum(s === 'alle' ? total : c[s])})</button>`).join('')}</div>
        <ul class="imp-list">${shown.map((it) => {
          const dup = it.dupOf ? byId.get(it.dupOf) : null;
          const sub = [it.folder, it.zipName ? t('review.import.inZip', { zip: it.zipName }) : '', fmtBytes(it.size)].filter(Boolean).join(' · ');
          const note = it.status === 'fehler' ? it.error
            : it.status === 'doppelt' && dup ? t('review.import.sameAs', { name: dup.name })
              : it.status === 'vorhanden' && it.existingPath ? t('review.import.existingAt', { path: it.existingPath }) : '';
          return `<li class="imp-row st-${it.status}">
            <div class="imp-main"><span class="imp-name">${esc(it.name)}</span><span class="imp-sub">${esc(sub)}</span>
              ${note ? `<span class="imp-note${it.status === 'fehler' ? ' err' : ''}">${esc(note)}</span>` : ''}</div>
            <span class="pill ${IMP_PILL[it.status] || 'pill-muted'}">${esc(t('review.import.st.' + it.status))}</span></li>`;
        }).join('')}</ul>
        ${rows.length > shown.length ? `<button type="button" class="btn" data-act="imp-more">${esc(t('review.import.more', { n: rows.length - shown.length }))}</button>` : ''}
      </div>`;
    }
    if (!total && !IMP.reading) html = `<p class="muted small" style="margin:0">${esc(t('review.import.noFiles'))}</p>`;
    impEl.innerHTML = html;
  }
  let raf = 0;
  const schedule = () => {
    if (!root.isConnected) { IMP.listeners.delete(schedule); return; }
    if (raf) return;
    raf = requestAnimationFrame(() => { raf = 0; if (root.isConnected) renderImp(); else IMP.listeners.delete(schedule); });
    // Hintergrund-Tab: requestAnimationFrame pausiert – trotzdem aktuell halten
    setTimeout(() => { if (raf) { cancelAnimationFrame(raf); raf = 0; if (root.isConnected) renderImp(); } }, 400);
  };
  IMP.listeners.add(schedule);

  if (targetSel) {
    targetSel.addEventListener('change', () => { IMP.locationId = targetSel.value || null; renderImp(); });
    const input = (k) => root.querySelector(`[data-in="${k}"]`);
    root.querySelectorAll('[data-pick]').forEach((b) => b.addEventListener('click', () => { const i = input(b.dataset.pick); if (i) i.click(); }));
    for (const k of ['photos', 'folder', 'zip', 'camera']) {
      const i = input(k);
      if (!i) continue;
      i.addEventListener('change', async () => {
        const files = [...(i.files || [])];
        i.value = '';
        if (files.length) await impAddFiles(files, { fromFolder: k === 'folder' });
      });
    }
    // Ziehen und Ablegen (Fotos und ZIP-Dateien)
    const drop = root.querySelector('[data-drop]');
    drop.addEventListener('dragover', (e) => { if (IMP.running) return; e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', async (e) => {
      e.preventDefault();
      drop.classList.remove('over');
      if (IMP.running) return;
      const dt = e.dataTransfer;
      const items = [...(dt.items || [])];
      const hasDir = items.some((x) => x.webkitGetAsEntry && x.webkitGetAsEntry() && x.webkitGetAsEntry().isDirectory);
      const files = [...(dt.files || [])].filter((f, idx) => {
        const en = items[idx] && items[idx].webkitGetAsEntry ? items[idx].webkitGetAsEntry() : null;
        return !(en && en.isDirectory);
      });
      if (hasDir) toast(t('review.import.dropFolder'), 'info');
      if (files.length) await impAddFiles(files);
    });
  }
  if (impEl) {
    impEl.addEventListener('click', async (e) => {
      const f = e.target.closest('[data-imp-filter]');
      if (f) { IMP.listFilter = f.dataset.impFilter; IMP.limit = LIST_LIMIT; renderImp(); return; }
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const act = b.dataset.act;
      if (act === 'start') impRun(api);
      else if (act === 'cancel') { IMP.cancel = true; impNotify(); }
      else if (act === 'retry-failed') impRun(api, new Set(IMP.items.filter((it) => it.status === 'fehler' && !it.fatal).map((it) => it.id)));
      else if (act === 'resume') impRun(api, new Set(IMP.items.filter((it) => it.status === 'abgebrochen').map((it) => it.id)));
      else if (act === 'imp-more') { IMP.limit += LIST_LIMIT; renderImp(); }
      else if (act === 'clear') {
        if (IMP.running) return;
        Object.assign(IMP, { items: [], finished: false, queued: null, listFilter: 'alle', limit: LIST_LIMIT });
        renderImp();
      } else if (act === 'queue') {
        const ids = [...new Set(IMP.items.filter((it) => (it.status === 'importiert' || it.status === 'vorhanden') && it.photoId).map((it) => it.photoId))];
        b.disabled = true;
        try {
          const n = await api.setPhotoStatus(ids, 'in_analyse');
          IMP.queued = { n: Number(n) || 0 };
          toast(IMP.queued.n ? t('review.import.queued', { n: IMP.queued.n }) : t('review.import.queuedNone'), IMP.queued.n ? 'ok' : 'info');
        } catch (err) {
          toast(errorText(err), 'error');
        }
        renderImp();
      }
    });
    renderImp();
  }

  // ---------- KI-Ergebnis: Darstellung ----------
  const jsonIn = root.querySelector('[data-in="json"]');
  function renderAna() {
    if (!anaEl.isConnected) return;
    const P = ANA.parsed;
    let html = `<div class="card stack">`;
    if (!P) {
      html += `<p style="margin:0">${esc(t('review.ana.intro'))}</p>
        ${ANA.error ? `<div class="alert danger" role="alert">${icon('alert')}<span>${ANA.fileName ? `<b>${esc(ANA.fileName)}</b>: ` : ''}${esc(ANA.error)}</span></div>` : ''}
        <div><button type="button" class="btn primary" data-act="ana-pick">${icon('file')}${esc(t('review.ana.pick'))}</button></div>`;
    } else {
      const s = P.stats;
      const knownN = ANA.known ? P.rows.filter((r) => r && r.sha && ANA.known.has(r.sha)).length : null;
      const unknownN = ANA.known ? P.rows.filter((r) => r && r.sha && !ANA.known.has(r.sha)).length : null;
      const packets = Math.ceil(P.photos.length / PACKET);
      html += `<div class="section-head"><h3>${esc(t('review.ana.preview', { file: ANA.fileName || '' }))}</h3>
          <button type="button" class="btn sm ghost" data-act="ana-pick"${ANA.running ? ' disabled' : ''}>${icon('file')}${esc(t('review.ana.other'))}</button></div>
        ${P.schema !== 'lgr-photo-analysis/1' ? `<div class="alert warn">${icon('alert')}<span>${esc(t('review.ana.schemaWarn', { schema: P.schema === null ? '–' : String(P.schema) }))}</span></div>` : ''}
        <div class="imp-tiles">
          <div class="imp-tile"><b>${fmtNum(s.photos)}</b><span>${esc(t('review.ana.photos'))}</span></div>
          <div class="imp-tile"><b>${fmtNum(s.objects)}</b><span>${esc(t('review.ana.objects'))}</span></div>
          <div class="imp-tile fehler"><b>${fmtNum(s.errPhotos)}</b><span>${esc(t('review.ana.errPhotos'))}</span></div>
          <div class="imp-tile"><b>${fmtNum(s.dupPhotos)}</b><span>${esc(t('review.ana.dupPhotos'))}</span></div>
          ${knownN !== null ? `<div class="imp-tile importiert"><b>${fmtNum(knownN)}</b><span>${esc(t('review.ana.known'))}</span></div>
            <div class="imp-tile ${unknownN ? 'abgebrochen' : ''}"><b>${fmtNum(unknownN)}</b><span>${esc(t('review.ana.unknown'))}</span></div>` : ''}
        </div>
        ${ANA.knownError ? `<p class="hint" style="margin:0">${esc(t('review.ana.knownNa'))}</p>` : ''}
        <div class="stack" style="gap:6px"><span class="small muted">${esc(t('review.ana.byConf'))}</span>
          <div class="row">${CONFIDENCES.map((c) => `${confidencePill(c)} <b>${fmtNum(s.byConf[c])}</b>`).join('<span class="muted">·</span>')}</div></div>
        ${s.noSha ? `<div class="alert warn">${icon('alert')}<span>${esc(t('review.ana.noSha', { n: s.noSha }))}</span></div>` : ''}
        ${s.badItems ? `<div class="alert warn">${icon('alert')}<span>${esc(t('review.ana.badItems', { n: s.badItems }))}</span></div>` : ''}
        ${s.badObjects ? `<div class="alert warn">${icon('alert')}<span>${esc(t('review.ana.badObjects', { n: s.badObjects }))}</span></div>` : ''}
        <div class="table-wrap ana-table"><table class="table">
          <thead><tr><th>${esc(t('review.ana.col.file'))}</th><th>${esc(t('review.ana.col.status'))}</th><th class="num">${esc(t('review.ana.col.objects'))}</th><th>${esc(t('review.ana.col.inApp'))}</th></tr></thead>
          <tbody>${P.rows.map((r) => (r ? `<tr>
            <td class="wrap">${esc(r.file)}${r.folder ? `<div class="small muted">${esc(r.folder)}</div>` : ''}</td>
            <td class="wrap"><span class="pill ${r.status === 'fehler' ? 'pill-danger' : r.status === 'duplikat' ? 'pill-muted' : 'pill-ok'}">${esc(t('review.ana.st.' + r.status))}</span>
              ${r.error ? `<div class="small" style="color:var(--danger)">${esc(r.error)}</div>` : ''}</td>
            <td class="num">${fmtNum(r.objects)}${r.objects ? `<div class="ana-conf">${CONFIDENCES.filter((c) => r.conf[c]).map((c) =>
              `<span class="c-${c}" title="${esc(confidenceLabel(c))}">${fmtNum(r.conf[c])}<span class="sr-only"> ${esc(confidenceLabel(c))}</span></span>`).join('')}</div>` : ''}</td>
            <td>${!r.sha ? `<span class="pill pill-danger">SHA-256 ?</span>` : ANA.known ? (ANA.known.has(r.sha) ? `<span class="pill pill-ok">${icon('check')}${esc(t('common.yes'))}</span>` : `<span class="pill pill-warn">${esc(t('common.no'))}</span>`) : '–'}</td>
          </tr>` : `<tr><td colspan="4"><span class="pill pill-danger">${esc(t('review.ana.r.invalid'))}</span></td></tr>`)).join('')}</tbody>
        </table></div>
        <div class="field">
          <label for="ana-source">${esc(t('review.ana.source'))}</label>
          <input type="text" id="ana-source" maxlength="200" value="${esc(ANA.source)}" placeholder="${esc(t('review.ana.sourcePh'))}"${ANA.running ? ' disabled' : ''} aria-describedby="ana-source-hint">
          <span class="hint" id="ana-source-hint">${esc(t('review.ana.sourceHint'))}${P.source ? ' ' + esc(t('review.ana.sourceFromFile', { source: P.source })) : ''}</span>
        </div>
        ${ANA.running ? `<div aria-live="polite">${progressHtml(ANA.done, ANA.total, t('review.ana.sending'))}</div>`
          : `<div class="row"><button type="button" class="btn primary" data-act="ana-start">${icon('upload')}${esc(t('review.ana.start', { n: s.photos }))}</button>
              <span class="small muted">${esc(t('review.ana.packets', { n: packets, size: PACKET }))}</span></div>`}`;
      const R = ANA.result;
      if (R && !ANA.running) {
        html += `<div class="stack ana-result" aria-live="polite">
          <h3>${esc(t('review.ana.result'))}</h3>
          <div class="imp-tiles">
            <div class="imp-tile importiert"><b>${fmtNum(R.matched)}</b><span>${esc(t('review.ana.r.matched'))}</span></div>
            <div class="imp-tile importiert"><b>${fmtNum(R.created)}</b><span>${esc(t('review.ana.r.created'))}</span></div>
            <div class="imp-tile"><b>${fmtNum(R.existing)}</b><span>${esc(t('review.ana.r.existing'))}</span></div>
            <div class="imp-tile ${R.failed ? 'fehler' : ''}"><b>${fmtNum(R.failed)}</b><span>${esc(t('review.ana.r.failed'))}</span></div>
            <div class="imp-tile"><b>${fmtNum(R.duplicates)}</b><span>${esc(t('review.ana.r.duplicates'))}</span></div>
            <div class="imp-tile ${R.invalid ? 'fehler' : ''}"><b>${fmtNum(R.invalid)}</b><span>${esc(t('review.ana.r.invalid'))}</span></div>
            <div class="imp-tile ${R.unmatched.length ? 'abgebrochen' : ''}"><b>${fmtNum(R.unmatched.length)}</b><span>${esc(t('review.ana.r.unmatched'))}</span></div>
          </div>
          ${ANA.failedPackets.length ? `<div class="alert danger" role="alert">${icon('alert')}<div class="stack" style="gap:6px">
              <span>${esc(t('review.ana.packetErrors', { n: ANA.failedPackets.length }))}</span>
              <ul class="ana-list">${ANA.failedPackets.map((f) => `<li>${esc(t('review.ana.packet', { x: f.packet + 1, y: packets }))}: ${esc(f.error)}</li>`).join('')}</ul>
              <div><button type="button" class="btn sm" data-act="ana-retry">${icon('history')}${esc(t('review.ana.retryPackets'))}</button></div></div></div>` : ''}
          ${R.unmatched.length ? `<div class="alert warn">${icon('alert')}<div class="stack" style="gap:6px">
              <b>${esc(t('review.ana.unmatchedTitle'))} (${fmtNum(R.unmatched.length)})</b>
              <ul class="ana-list">${R.unmatched.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
              <span>${esc(t('review.ana.unmatchedHint'))}</span></div></div>` : ''}
          <div class="row"><a class="btn primary" href="${reviewHref()}">${icon('list')}${esc(t('review.import.toReview'))}</a></div>
        </div>`;
      }
    }
    html += '</div>';
    anaEl.innerHTML = html;
  }
  const anaSchedule = () => { if (!root.isConnected) { ANA.listeners.delete(anaSchedule); return; } renderAna(); };
  ANA.listeners.add(anaSchedule);
  anaEl.addEventListener('input', (e) => { if (e.target.id === 'ana-source') ANA.source = e.target.value; });
  anaEl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    if (b.dataset.act === 'ana-pick') jsonIn.click();
    else if (b.dataset.act === 'ana-start') anaRun(api);
    else if (b.dataset.act === 'ana-retry') anaRun(api, ANA.failedPackets.map((f) => f.packet));
  });
  jsonIn.addEventListener('change', async () => {
    const f = jsonIn.files && jsonIn.files[0];
    jsonIn.value = '';
    if (!f || ANA.running) return;
    let text = '';
    try { text = await f.text(); } catch (err) { text = ''; }
    const p = parseAnalysis(text);
    Object.assign(ANA, { fileName: f.name, result: null, failedPackets: [] });
    if (p.error) { Object.assign(ANA, { parsed: null, error: p.error }); renderAna(); return; }
    Object.assign(ANA, { parsed: p, error: null, source: p.source || '' });
    renderAna();
    anaLoadKnown(api);
  });
  renderAna();
  if (ANA.parsed && !ANA.running) anaLoadKnown(api);

  if (qget(ctx, 'teil') === 'analyse' || (ctx.query && typeof ctx.query.has === 'function' && ctx.query.has('analyse'))) {
    setTimeout(() => { const sec = root.querySelector('#analyse'); if (sec && sec.isConnected) sec.scrollIntoView({ block: 'start' }); }, 0);
  }
}

// ===========================================================================
// 2) KI-Erkennung prüfen
// ===========================================================================
function loadFilter() {
  const f = ssGet(SS_FILTER) || {};
  return {
    status: STATUS_FILTERS.includes(f.status) ? f.status : 'offen',
    conf: CONFIDENCES.includes(f.conf) ? f.conf : '',
    kind: KINDS.includes(f.kind) ? f.kind : '',
    cat: typeof f.cat === 'string' ? f.cat : '',
    q: typeof f.q === 'string' ? f.q : '',
  };
}

// Ähnlichkeit zweier Namen (Bigramme, Dice-Koeffizient)
function dice(a, b) {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const grams = (s) => { const m = new Map(); for (let i = 0; i < s.length - 1; i++) { const g = s.slice(i, i + 2); m.set(g, (m.get(g) || 0) + 1); } return m; };
  const A = grams(a); const B = grams(b);
  let inter = 0;
  for (const [g, n] of A) inter += Math.min(n, B.get(g) || 0);
  return (2 * inter) / (a.length - 1 + b.length - 1);
}

/** Gruppen bilden: gleiche obj_key im selben Raum (und gleicher Status) = ein Objekt auf mehreren Fotos. */
function buildGroups(dets) {
  const byId = new Map(dets.map((d) => [d.id, d]));
  const groups = new Map();
  const merged = [];
  for (const d of dets) {
    if (d.status === 'zusammengefuehrt' && d.merged_into && byId.has(d.merged_into)) { merged.push(d); continue; }
    const key = `${d.space_id || '-'}|${d.obj_key}|${d.status}`;
    let g = groups.get(key);
    if (!g) { g = { key, members: [], extra: [] }; groups.set(key, g); }
    g.members.push(d);
  }
  const groupOf = new Map();
  for (const g of groups.values()) for (const m of g.members) groupOf.set(m.id, g);
  for (const d of merged) {
    let target = byId.get(d.merged_into);
    for (let i = 0; i < 10 && target && target.status === 'zusammengefuehrt' && target.merged_into && byId.has(target.merged_into); i++) {
      target = byId.get(target.merged_into);
    }
    const g = target && groupOf.get(target.id);
    if (g) g.extra.push(d);
    else {
      const key = `${d.space_id || '-'}|${d.obj_key}|zusammengefuehrt`;
      let og = groups.get(key);
      if (!og) { og = { key, members: [], extra: [] }; groups.set(key, og); }
      og.members.push(d);
    }
  }
  const rank = (d) => (CONF_RANK[d.confidence] ?? 3) * 10 + (d.pos_x !== null && d.pos_x !== undefined ? 0 : 1);
  for (const g of groups.values()) {
    g.members.sort((a, b) => rank(a) - rank(b) || String(a.created_at || '').localeCompare(String(b.created_at || '')));
    g.primary = g.members[0];
    g.status = g.primary.status;
    g.photos = [...g.members, ...g.extra];
    g.hay = norm(g.photos.map((d) => [d.name, d.brand, d.model, d.serial_no, d.category_path, d.category_text, d.notes, d.photo_file_name,
      ...(Array.isArray(d.text_read) ? d.text_read : [])].filter(Boolean).join(' ')));
  }
  return [...groups.values()].sort((a, b) => {
    const pa = a.primary; const pb = b.primary;
    return String(pa.photo_location_path || '').localeCompare(String(pb.photo_location_path || ''))
      || String(pa.photo_file_name || '').localeCompare(String(pb.photo_file_name || ''))
      || (Number(pa.pos_y) || 0) - (Number(pb.pos_y) || 0) || (Number(pa.pos_x) || 0) - (Number(pb.pos_x) || 0)
      || String(pa.name).localeCompare(String(pb.name));
  });
}

async function reviewPage(ctx) {
  const { api } = ctx;
  const staff = can(ctx.user, 'staff');
  const root = mount(ctx);
  ctx.setTitle(t('review.title'));
  root.innerHTML = loadingHtml();
  root.addEventListener('click', (e) => { if (e.target.closest('[data-act="retry"]')) ctx.reload(); });
  const back = `<a class="back-link" href="#/organisieren">${icon('back')}${esc(t('nav.organize'))}</a>`;

  const raumCode = (qget(ctx, 'raum') || '').toUpperCase();
  const S = {
    filter: loadFilter(), shown: PAGE, urls: new Map(), dupCache: new Map(),
    spaces: [], space: null, dets: [], cats: [], locs: [], arts: [], machs: [], groups: [], groupMap: new Map(), view: [],
  };
  try {
    S.spaces = (await api.listSpaces()) || [];
  } catch (err) {
    if (!root.isConnected) return;
    root.innerHTML = back + errorBlock(err);
    toast(errorText(err), 'error');
    return;
  }
  S.space = raumCode ? S.spaces.find((s) => String(s.code).toUpperCase() === raumCode || String(s.code_path || '').toUpperCase() === raumCode) || null : null;

  async function fetchData() {
    const [dets, cats, locs, arts, machs] = await Promise.all([
      api.listDetections(S.space ? { spaceId: S.space.id } : {}),
      api.listCategories(), api.listLocations(), api.listArticles(), api.listMachines(),
    ]);
    Object.assign(S, { dets: dets || [], cats: cats || [], locs: (locs || []).filter((l) => !l.archived), arts: arts || [], machs: machs || [] });
    S.groups = buildGroups(S.dets);
    S.groupMap = new Map(S.groups.map((g) => [g.key, g]));
    S.dupCache = new Map();
  }
  try {
    await fetchData();
  } catch (err) {
    if (!root.isConnected) return;
    root.innerHTML = back + errorBlock(err);
    toast(errorText(err), 'error');
    return;
  }
  if (!root.isConnected) return;

  // ---------- mögliche Duplikate im bestehenden Inventar ----------
  function dupCandidates(g) {
    if (S.dupCache.has(g.key)) return S.dupCache.get(g.key);
    const d = g.primary;
    const out = [];
    if (d.status === 'offen' || d.status === 'spaeter') {
      const nb = compact(d.brand); const nm = compact(d.model); const sn = compact(d.serial_no); const nn = norm(d.name);
      const check = (x, entity) => {
        if ((entity === 'machine' && d.machine_id === x.id) || (entity === 'article' && d.article_id === x.id)) return;
        let reason = null;
        if (entity === 'machine' && sn && sn.length >= 4 && compact(x.serial_no) === sn) reason = 'serial';
        else if (nb && nm && compact(x.brand) === nb && compact(x.model) === nm) reason = 'model';
        else if (nn.length >= 4) {
          const xn = norm(x.name);
          if (xn && (xn === nn || dice(nn, xn) >= 0.85)) reason = 'name';
        }
        if (reason) out.push({ entity, row: x, reason });
      };
      for (const m of S.machs) check(m, 'machine');
      for (const a of S.arts) check(a, 'article');
      const order = { serial: 0, model: 1, name: 2 };
      out.sort((a, b) => order[a.reason] - order[b.reason]);
    }
    const res = out.slice(0, 5);
    S.dupCache.set(g.key, res);
    return res;
  }
  function bulkEligible(g) {
    const d = g.primary;
    if (g.status !== 'offen' || d.confidence !== 'sicher' || !BULK_KINDS.includes(d.kind)) return false;
    if (!d.quantity_certain || d.quantity === null || d.quantity === undefined || d.quantity === '') return false;
    const q = Number(d.quantity);
    if (!Number.isFinite(q) || q < 0) return false;
    if (d.kind !== 'bestandsartikel' && !(Number.isInteger(q) && q >= 1 && q <= 50)) return false;
    if (!d.category_id) return false;
    return dupCandidates(g).length === 0;
  }

  // ---------- Fotos (signierte URLs) ----------
  async function hydrate(el) {
    const imgs = [...el.querySelectorAll('img[data-path]:not([src])')];
    const need = [...new Set(imgs.map((i) => i.dataset.path))].filter((p) => !S.urls.has(p));
    if (need.length) {
      try { const m = await api.fileUrls(need); if (m && m.forEach) m.forEach((u, p) => S.urls.set(p, u)); } catch (e) { /* Fotos sind nicht kritisch */ }
    }
    for (const i of imgs) {
      const u = S.urls.get(i.dataset.path);
      if (!u) continue;
      if (i.hasAttribute('data-fit')) {
        i.addEventListener('load', () => {
          const st = i.closest('.rv-stage');
          if (st && i.naturalWidth && i.naturalHeight) st.style.setProperty('--ar', `${i.naturalWidth} / ${i.naturalHeight}`);
        }, { once: true });
      }
      i.src = u;
    }
  }

  // ---------- Darstellung einer Karte ----------
  const kindPill = (k) => `<span class="pill ${k === 'unbekannt' ? 'pill-danger' : 'pill-info'}">${esc(kindLabel(k))}</span>`;
  const statusPillDet = (s) => {
    const cls = { offen: 'pill-warn', spaeter: 'pill-muted', bestaetigt: 'pill-ok', zusammengefuehrt: 'pill-ok', abgelehnt: 'pill-danger' }[s] || 'pill-muted';
    return `<span class="pill ${cls}">${esc(detectionStatusLabel(s))}</span>`;
  };
  function stageHtml(d) {
    const w = Number(d.photo_width) || 0; const h = Number(d.photo_height) || 0;
    const ar = w > 0 && h > 0 ? `${w} / ${h}` : '4 / 3';
    const hasPos = d.pos_x !== null && d.pos_x !== undefined && d.pos_y !== null && d.pos_y !== undefined;
    const x = Math.min(1, Math.max(0, Number(d.pos_x))) * 100; const y = Math.min(1, Math.max(0, Number(d.pos_y))) * 100;
    return `<button type="button" class="rv-stage" style="--ar:${ar}" data-act="zoom" data-path="${esc(d.photo_path || '')}" aria-label="${esc(t('review.zoom'))}">
        ${d.photo_path ? `<img data-path="${esc(d.photo_path)}" alt="${esc(t('review.photoAlt', { file: d.photo_file_name || '' }))}" loading="lazy"${w && h ? '' : ' data-fit'}>` : `<span class="rv-nophoto">${icon('image')}</span>`}
        ${hasPos ? `<span class="rv-marker" style="left:${x.toFixed(2)}%;top:${y.toFixed(2)}%" aria-hidden="true"></span>` : ''}
      </button>
      <div class="rv-photo-meta small muted">${esc([d.photo_file_name, d.photo_location_path].filter(Boolean).join(' · '))}
        ${hasPos ? `<span class="sr-only">${esc(t('review.markerHint'))}</span>` : ` · ${esc(t('review.noPos'))}`}</div>
      ${staff && d.status === 'zusammengefuehrt' ? `<div class="rv-split"><span class="small muted">${esc(t('review.splitHint'))}</span>
        <button type="button" class="btn sm" data-act="split" data-id="${esc(d.id)}">${icon('history')}${esc(t('review.act.split'))}</button></div>` : ''}`;
  }
  function qtyHtml(d) {
    if (d.quantity === null || d.quantity === undefined || d.quantity === '') return `<span class="muted">${esc(t('review.qtyUnknown'))}</span>`;
    return `${esc(fmtQty(d.quantity, d.unit || 'Stk'))}${d.quantity_certain ? '' : ` <span class="pill pill-warn">${esc(t('review.qtyUncertain'))}</span>`}`;
  }
  function productHtml(p) {
    if (!p || typeof p !== 'object') return '';
    const url = safeUrl(p.url); const man = safeUrl(p.manual_url);
    const parts = [];
    if (url) parts.push(`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${icon('globe')}${esc(t('review.maker'))} <span class="muted">(${esc(hostOf(url))})</span></a>`);
    if (man) parts.push(`<a href="${esc(man)}" target="_blank" rel="noopener noreferrer">${icon('file')}${esc(t('review.manual'))} <span class="muted">(${esc(hostOf(man))})</span></a>`);
    let specs = '';
    if (Array.isArray(p.specs) && p.specs.length) specs = `<ul class="rv-specs">${p.specs.slice(0, 12).map((s) => `<li>${esc(typeof s === 'object' ? JSON.stringify(s) : s)}</li>`).join('')}</ul>`;
    else if (p.specs && typeof p.specs === 'object') {
      const ent = Object.entries(p.specs).slice(0, 12);
      if (ent.length) specs = `<ul class="rv-specs">${ent.map(([k, v]) => `<li><b>${esc(k)}:</b> ${esc(typeof v === 'object' ? JSON.stringify(v) : v)}</li>`).join('')}</ul>`;
    } else if (typeof p.specs === 'string' && p.specs.trim()) specs = `<p class="small" style="margin:0">${esc(p.specs)}</p>`;
    const str = (v) => (typeof v === 'string' || typeof v === 'number' ? String(v).trim() : '');
    const official = str(p.official_name); const purpose = str(p.purpose); const remark = str(p.remark); const checked = str(p.checked);
    if (!parts.length && !specs && !p.source && !p.image_note && !official && !purpose && !remark) return '';
    return `<div class="rv-product"><span class="rv-lbl">${esc(t('review.product'))}</span>
      ${official ? `<b>${esc(official)}</b>` : ''}
      ${purpose ? `<p class="small" style="margin:0">${esc(purpose)}</p>` : ''}
      ${parts.length ? `<div class="row">${parts.join('')}</div>` : ''}
      ${specs}
      ${p.source || checked ? `<span class="small muted">${esc([p.source ? t('review.productSource', { src: String(p.source) }) : '',
        checked ? t('review.productChecked', { date: /^\d{4}-\d{2}-\d{2}/.test(checked) ? fmtDate(checked) : checked }) : ''].filter(Boolean).join(' · '))}</span>` : ''}
      ${remark ? `<span class="small muted">${esc(remark)}</span>` : ''}
      ${p.image_note ? `<span class="small muted rv-imgnote">${icon('image')}<span>${esc(String(p.image_note))}</span></span>` : ''}</div>`;
  }
  function cardHtml(g) {
    const d = g.primary;
    const kv = (label, value) => `<dt>${esc(label)}</dt><dd>${value}</dd>`;
    const rows = [];
    if (d.brand) rows.push(kv(t('common.brand'), esc(d.brand)));
    if (d.model) rows.push(kv(t('common.model'), esc(d.model)));
    if (d.serial_no) rows.push(kv(t('review.serial'), `<span class="mono">${esc(d.serial_no)}</span>`));
    rows.push(kv(t('common.category'), d.category_path ? esc(d.category_path)
      : d.category_text ? `<span class="muted">${esc(t('review.catSuggested', { text: d.category_text }))}</span>` : `<span class="muted">${esc(t('org.noCategory'))}</span>`));
    rows.push(kv(t('review.kind'), kindPill(d.kind)));
    rows.push(kv(t('review.qty'), qtyHtml(d)));
    rows.push(kv(t('review.conf'), confidencePill(d.confidence)));
    if (d.condition) rows.push(kv(t('review.condition'), esc(d.condition)));
    rows.push(kv(t('review.target'), d.target_location_path ? esc(d.target_location_path)
      : `${esc(d.photo_location_path || '–')} <span class="muted small">(${esc(t('review.photoLoc'))})</span>`));
    if (d.part_of_key) {
      const parent = S.dets.find((x) => x.obj_key === d.part_of_key && x.space_id === d.space_id);
      rows.push(kv(t('review.partOf'), esc(parent ? parent.name : d.part_of_key)));
    }
    const texts = Array.isArray(d.text_read) ? d.text_read.filter((s) => s !== null && s !== undefined && String(s).trim()) : [];
    const n = g.photos.length;
    const cands = dupCandidates(g);
    const open = g.status === 'offen' || g.status === 'spaeter';
    const mergedTarget = g.status === 'zusammengefuehrt' && d.merged_into ? S.dets.find((x) => x.id === d.merged_into) : null;
    const entityLinks = [];
    if (d.machine_code) entityLinks.push({ entity: 'machine', code: d.machine_code, name: d.machine_name });
    if (d.article_code) entityLinks.push({ entity: 'article', code: d.article_code, name: d.article_name });
    if (d.location_ref_code) entityLinks.push({ entity: 'location', code: d.location_ref_code, name: d.location_ref_name });

    let actions = '';
    if (staff) {
      const b = (act, ic, label, cls = '') => `<button type="button" class="btn ${cls}" data-act="${act}">${icon(ic)}${esc(label)}</button>`;
      if (open) {
        actions = b('confirm', 'check', t('review.act.confirm'), 'primary') + b('edit', 'edit', t('review.act.edit'))
          + b('loc', 'location', t('review.act.location')) + b('merge', 'layers', t('review.act.merge'))
          + (g.status === 'offen' ? b('later', 'clock', t('review.act.later')) : b('reopen', 'history', t('review.act.reopen')))
          + b('reject', 'x', t('review.act.reject'), 'danger-outline');
      } else if (g.status === 'bestaetigt') {
        actions = entityLinks.length ? b('label', 'print', t('review.act.label')) : '';
      } else {
        actions = b('reopen', 'history', t('review.act.reopen'));
      }
    }
    return `<article class="card rv-card st-${esc(g.status)}" data-g="${esc(g.key)}" aria-labelledby="rv-h-${esc(d.id)}">
      <div class="rv-media">
        <div class="rv-stage-wrap" data-stage>${stageHtml(d)}</div>
        ${n > 1 ? `<div class="rv-thumbs" role="group" aria-label="${esc(t('review.onPhotos', { n }))}">
          <span class="small muted rv-thumbs-label">${esc(t('review.onPhotos', { n }))}</span>
          <div class="rv-thumb-row">${g.photos.map((p, i) => `<button type="button" class="rv-thumb" data-act="thumb" data-i="${i}" aria-pressed="${i === 0}"
            aria-label="${esc(t('review.photoN', { i: i + 1, n }))}: ${esc(p.photo_file_name || '')}">${p.photo_path ? `<img data-path="${esc(p.photo_path)}" alt="" loading="lazy">` : icon('image')}</button>`).join('')}</div></div>` : ''}
      </div>
      <div class="rv-body">
        <div class="rv-head">
          <h3 id="rv-h-${esc(d.id)}">${esc(d.name)}</h3>
          <div class="row" style="gap:6px">${statusPillDet(g.status)}${confidencePill(d.confidence)}</div>
        </div>
        <dl class="kv rv-kv">${rows.join('')}</dl>
        ${texts.length ? `<div class="stack" style="gap:6px"><span class="rv-lbl">${esc(t('review.textRead'))}</span>
          <div class="rv-texts">${texts.map((s) => `<span class="rv-text">${esc(s)}</span>`).join('')}</div></div>` : ''}
        ${d.notes ? `<div class="stack" style="gap:4px"><span class="rv-lbl">${esc(t('common.notes'))}</span><p class="rv-notes">${esc(d.notes)}</p></div>` : ''}
        ${productHtml(d.product)}
        ${open && cands.length ? `<div class="alert warn rv-dups">${icon('alert')}<div class="stack" style="gap:6px;min-width:0;flex:1">
            <b>${esc(t('review.dupTitle'))}</b>
            <ul class="rv-duplist">${cands.map((c) => `<li>
              <div class="rv-dup-main"><a href="${entityHref(c.entity, c.row.code)}">${esc(c.row.code)} · ${esc(c.row.name)}</a>
                <span class="small">${esc(t('review.dupReason.' + c.reason))}${c.row.location_path ? ' · ' + esc(c.row.location_path) : ''}</span></div>
              ${staff ? `<button type="button" class="btn sm" data-act="link" data-entity="${c.entity}" data-id="${esc(c.row.id)}">${icon('handoff')}${esc(t('review.link'))}</button>` : ''}
            </li>`).join('')}</ul></div></div>` : ''}
        ${g.status === 'bestaetigt' && entityLinks.length ? `<div class="rv-created"><span class="rv-lbl">${esc(t('review.created'))}</span>
          ${entityLinks.map((e) => `<a class="btn sm" href="${entityHref(e.entity, e.code)}">${icon(e.entity === 'machine' ? 'machine' : e.entity === 'article' ? 'box' : 'location')}${esc(e.code)}${e.name ? ' · ' + esc(e.name) : ''}</a>`).join('')}</div>` : ''}
        ${mergedTarget ? `<p class="small muted" style="margin:0">${esc(t('review.mergedInto', { name: mergedTarget.name }))}</p>` : ''}
        ${d.reviewed_by_name && g.status !== 'offen' ? `<p class="small muted" style="margin:0">${esc(t('review.reviewedBy', { name: d.reviewed_by_name, date: fmtDateTime(d.reviewed_at) }))}</p>` : ''}
        ${actions ? `<div class="rv-actions">${actions}</div>` : ''}
      </div>
    </article>`;
  }

  // ---------- Seite ----------
  const spaceOpts = `<option value="">${esc(t('review.f.allSpaces'))}</option>` + S.spaces.map((s) =>
    `<option value="${esc(s.code)}"${S.space && S.space.id === s.id ? ' selected' : ''}>${esc(s.name)}${locationDisplayCode(s) ? ` (${esc(locationDisplayCode(s))})` : ''}</option>`).join('');
  const F = S.filter;
  const importHref = '#/organisieren/import' + (S.space ? '?ort=' + encodeURIComponent(S.space.code) : '');
  root.innerHTML = `
    ${back}
    <div class="page-head">
      <div><h1>${esc(t('review.title'))}</h1><div class="sub">${esc(t('review.sub'))}</div></div>
      <div class="actions rv-head-actions">
        ${staff ? `<a class="btn" href="${importHref}">${icon('upload')}${esc(t('review.toImport'))}</a>
          <button type="button" class="btn primary" data-act="bulk" hidden>${icon('check')}<span data-bulk-label></span></button>` : ''}
      </div>
    </div>
    ${raumCode && !S.space ? `<div class="alert warn">${icon('alert')}<span>${esc(t('review.spaceMissing', { code: raumCode }))}</span></div>` : ''}
    ${staff ? '' : `<div class="alert">${icon('alert')}<span>${esc(t('review.readOnly'))}</span></div>`}
    <div class="card stack rv-filters">
      <div class="rv-filter-grid">
        <div class="field"><label for="rv-space">${esc(t('review.f.space'))}</label><select id="rv-space">${spaceOpts}</select></div>
        <div class="field"><label for="rv-conf">${esc(t('review.f.conf'))}</label><select id="rv-conf">
          <option value="">${esc(t('review.f.allConf'))}</option>${CONFIDENCES.map((c) => `<option value="${c}"${F.conf === c ? ' selected' : ''}>${esc(confidenceLabel(c))}</option>`).join('')}</select></div>
        <div class="field"><label for="rv-kind">${esc(t('review.f.kind'))}</label><select id="rv-kind">
          <option value="">${esc(t('review.f.allKinds'))}</option>${KINDS.map((k) => `<option value="${k}"${F.kind === k ? ' selected' : ''}>${esc(kindLabel(k))}</option>`).join('')}</select></div>
        <div class="field"><label for="rv-cat">${esc(t('review.f.cat'))}</label><select id="rv-cat">
          <option value="">${esc(t('review.f.allCats'))}</option><option value="__none">${esc(t('review.f.noCat'))}</option>
          ${categoryOptionsHtml(S.cats, F.cat && F.cat !== '__none' ? F.cat : null).replace(/^<option value="">[^<]*<\/option>/, '')}</select></div>
        <div class="field rv-q"><label for="rv-q">${esc(t('review.f.search'))}</label>
          <div class="searchbar">${icon('search')}<input type="search" id="rv-q" value="${esc(F.q)}" placeholder="${esc(t('review.f.searchPh'))}" autocomplete="off"></div></div>
      </div>
      <div class="chips" role="group" aria-label="${esc(t('review.f.status'))}" data-status-chips></div>
      <div class="row rv-countbar"><span class="small muted" data-count aria-live="polite"></span>
        <button type="button" class="btn ghost sm" data-act="reset">${icon('x')}${esc(t('review.f.reset'))}</button></div>
    </div>
    <div class="rv-list" data-list></div>
    <div data-more></div>`;
  const catSel = root.querySelector('#rv-cat');
  catSel.value = F.cat || '';
  if (catSel.value !== (F.cat || '')) { F.cat = ''; catSel.value = ''; }   // Kategorie gibt es nicht mehr

  const listEl = root.querySelector('[data-list]');
  const moreEl = root.querySelector('[data-more]');
  const chipsEl = root.querySelector('[data-status-chips]');
  const countEl = root.querySelector('[data-count]');
  const bulkBtn = root.querySelector('[data-act="bulk"]');

  function matcher() {
    const catIds = F.cat && F.cat !== '__none' ? categorySubtreeIds(S.cats, F.cat) : null;
    const words = norm(F.q).split(' ').filter(Boolean);
    return (g) => {
      const d = g.primary;
      if (F.conf && d.confidence !== F.conf) return false;
      if (F.kind && d.kind !== F.kind) return false;
      if (F.cat === '__none' && d.category_id) return false;
      if (catIds && (!d.category_id || !catIds.has(d.category_id))) return false;
      return words.every((w) => g.hay.includes(w));
    };
  }
  function renderList() {
    ssSet(SS_FILTER, F);
    const base = S.groups.filter(matcher());
    const counts = Object.fromEntries(STATUS_FILTERS.map((s) => [s, 0]));
    for (const g of base) { if (counts[g.status] !== undefined) counts[g.status]++; counts.alle++; }
    chipsEl.innerHTML = STATUS_FILTERS.map((s) => `<button type="button" class="chip" data-status="${s}" aria-pressed="${F.status === s}">${esc(s === 'alle' ? t('common.all') : detectionStatusLabel(s))} (${fmtNum(counts[s])})</button>`).join('');
    S.view = base.filter((g) => F.status === 'alle' || g.status === F.status);
    const detN = S.view.reduce((n, g) => n + g.photos.length, 0);
    countEl.textContent = t('review.count', { n: S.view.length, m: detN });
    if (!S.view.length) {
      listEl.innerHTML = emptyHtml(S.groups.length ? t('review.empty') : t('review.emptyAll'),
        !S.groups.length && staff ? `<a class="btn" href="${importHref}">${icon('upload')}${esc(t('review.toImport'))}</a>` : '');
    } else {
      listEl.innerHTML = S.view.slice(0, S.shown).map(cardHtml).join('');
    }
    const rest = S.view.length - Math.min(S.shown, S.view.length);
    moreEl.innerHTML = rest > 0 ? `<button type="button" class="btn block" data-act="more">${esc(t('review.more', { n: rest }))}</button>` : '';
    if (bulkBtn) {
      const n = S.view.filter(bulkEligible).length;
      bulkBtn.hidden = n === 0;
      bulkBtn.querySelector('[data-bulk-label]').textContent = t('review.b.btn', { n });
    }
    hydrate(listEl);
  }
  async function refresh() {
    const y = window.scrollY;
    try { await fetchData(); } catch (err) { toast(errorText(err), 'error'); return; }
    if (!root.isConnected) return;
    renderList();
    window.scrollTo(0, y);
  }

  // ---------- Filter ----------
  root.querySelector('#rv-space').addEventListener('change', (e) => {
    const code = e.target.value;
    ctx.go('organisieren/pruefen' + (code ? '?raum=' + encodeURIComponent(code) : ''));
  });
  const onSel = (id, key) => root.querySelector(id).addEventListener('change', (e) => { F[key] = e.target.value; S.shown = PAGE; renderList(); });
  onSel('#rv-conf', 'conf'); onSel('#rv-kind', 'kind'); onSel('#rv-cat', 'cat');
  root.querySelector('#rv-q').addEventListener('input', debounce((e) => { F.q = e.target.value; S.shown = PAGE; renderList(); }, 200));
  chipsEl.addEventListener('click', (e) => {
    const c = e.target.closest('[data-status]');
    if (!c) return;
    F.status = c.dataset.status; S.shown = PAGE; renderList();
  });

  // ---------- Aktionen ----------
  /** Aktion für alle Erkennungen einer Gruppe mit passendem Status (dasselbe Objekt auf mehreren Fotos) */
  async function forMembers(g, statuses, fn) {
    let ok = 0; let lastErr = null;
    for (const m of g.members.filter((x) => statuses.includes(x.status))) {
      try { await fn(m); ok++; } catch (err) { lastErr = err; }
    }
    if (lastErr && !ok) throw lastErr;
    if (lastErr) toast(errorText(lastErr), 'error');
    return ok;
  }
  async function simple(g, statuses, action, data, doneMsg) {
    try {
      await forMembers(g, statuses, (m) => api.reviewDetection(m.id, action, data));
      toast(doneMsg);
    } catch (err) { toast(errorText(err), 'error'); }
    await refresh();
  }

  root.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || !root.contains(b)) return;
    const act = b.dataset.act;
    if (act === 'more') { S.shown += PAGE; renderList(); return; }
    if (act === 'reset') {
      Object.assign(F, { status: 'offen', conf: '', kind: '', cat: '', q: '' });
      root.querySelector('#rv-conf').value = ''; root.querySelector('#rv-kind').value = '';
      catSel.value = ''; root.querySelector('#rv-q').value = '';
      S.shown = PAGE; renderList(); return;
    }
    if (act === 'bulk') { openBulk(); return; }
    const card = b.closest('[data-g]');
    const g = card ? S.groupMap.get(card.dataset.g) : null;
    if (act === 'zoom') {
      const u = S.urls.get(b.dataset.path);
      if (u) openLightbox(u, b.querySelector('img') ? b.querySelector('img').alt : '');
      return;
    }
    if (!g) return;
    if (act === 'thumb') {
      const i = Number(b.dataset.i) || 0;
      const d = g.photos[i];
      if (!d) return;
      card.querySelector('[data-stage]').innerHTML = stageHtml(d);
      card.querySelectorAll('.rv-thumb').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      hydrate(card);
      return;
    }
    if (!staff) return;
    if (act === 'confirm') openConfirm(g);
    else if (act === 'edit') openEdit(g);
    else if (act === 'loc') openLocation(g);
    else if (act === 'merge') openMerge(g);
    else if (act === 'reject') openReject(g);
    else if (act === 'later') { b.disabled = true; await simple(g, ['offen'], 'spaeter', {}, t('review.later.done')); }
    else if (act === 'reopen') { b.disabled = true; await simple(g, ['spaeter', 'abgelehnt', 'zusammengefuehrt'], 'wiederoeffnen', {}, t('review.reopen.done')); }
    else if (act === 'label') {
      const d = g.primary;
      const created = [];
      if (d.machine_code) created.push({ entity: 'machine', code: d.machine_code });
      if (d.article_code) created.push({ entity: 'article', code: d.article_code });
      if (d.location_ref_code) created.push({ entity: 'location', code: d.location_ref_code });
      await printCodes(api, created);
    } else if (act === 'link') openLink(g, b.dataset.entity, b.dataset.id);
    else if (act === 'split') {
      b.disabled = true;
      try { await api.reviewDetection(b.dataset.id, 'wiederoeffnen', {}); toast(t('review.reopen.done')); } catch (err) { toast(errorText(err), 'error'); }
      await refresh();
    }
  });

  // Mit bestehendem verknüpfen (bestaetigen, mode 'verknuepfen')
  async function openLink(g, entity, id) {
    const row = (entity === 'machine' ? S.machs : S.arts).find((x) => x.id === id);
    if (!row) return;
    const ok = await confirmSheet(t('review.linkQ'), t('review.linkText', { name: g.primary.name, code: row.code, target: row.name }), { okLabel: t('review.link') });
    if (!ok) return;
    try {
      await api.reviewDetection(g.primary.id, 'bestaetigen', { mode: 'verknuepfen', [entity === 'machine' ? 'machine_id' : 'article_id']: id });
      toast(t('review.linked', { code: row.code }));
    } catch (err) { toast(errorText(err), 'error'); }
    await refresh();
  }

  // Bestätigen (Sheet)
  function guessLocType(name) {
    const n = norm(name);
    const map = [['werkzeugwand', 'werkzeugwand'], ['lochwand', 'werkzeugwand'], ['schublade', 'schublade'], ['schrank', 'schrank'],
      ['regal', 'regal'], ['tablar', 'tablar'], ['fach', 'fach'], ['kiste', 'box'], ['box', 'box'], ['behalter', 'behaelter'],
      ['container', 'container'], ['halterung', 'halterung'], ['werkbank', 'arbeitsplatz'], ['arbeitsplatz', 'arbeitsplatz'], ['bereich', 'bereich']];
    const hit = map.find(([k]) => n.includes(k));
    return hit ? hit[1] : 'regal';
  }
  function openConfirm(g) {
    const d = g.primary;
    const qtyKnown = d.quantity !== null && d.quantity !== undefined && d.quantity !== '';
    const certain = !!d.quantity_certain && qtyKnown;
    const startKind = d.kind !== 'unbekannt' ? d.kind : '';
    const defLoc = d.target_location_id || d.photo_location_id || '';
    const unit = d.unit || 'Stk';
    const body = `<form class="stack" data-form novalidate>
      ${g.members.length > 1 ? `<div class="alert">${icon('layers')}<span>${esc(t('review.c.group', { n: g.members.length }))}</span></div>` : ''}
      <fieldset class="rv-fieldset"><legend class="rv-lbl">${esc(t('review.c.kind'))}</legend>
        <div class="radio-cards">${KINDS.filter((k) => k !== 'unbekannt').map((k) => `<label class="radio-card">
          <input type="radio" name="kind" value="${k}"${startKind === k ? ' checked' : ''}><span><b>${esc(kindLabel(k))}</b><small>${esc(t('org.kindHint.' + k))}</small></span></label>`).join('')}</div>
      </fieldset>
      <div class="field"><label for="c-name">${esc(t('review.c.name'))}</label><input id="c-name" name="name" type="text" maxlength="200" required value="${esc(d.name)}"></div>
      <div class="field"><label for="c-cat">${esc(t('common.category'))}</label><select id="c-cat" name="category_id">${categoryOptionsHtml(S.cats, d.category_id || null)}</select>
        ${!d.category_id && d.category_text ? `<span class="hint">${esc(t('review.catSuggested', { text: d.category_text }))}</span>` : ''}</div>
      <div class="field"><label for="c-loc" data-loc-label>${esc(t('review.c.loc'))}</label><select id="c-loc" name="target_location_id">${locationOptionsHtml(S.locs, defLoc, defLoc ? null : t('review.l.photo', { path: '–' }))}</select></div>
      <div class="stack" data-qty-box>
        <div class="field"><label for="c-qty">${esc(t('review.c.qty'))} (${esc(unitLabel(unit))})</label>
          <input id="c-qty" name="quantity" type="number" inputmode="decimal" min="0" step="any" value="${certain ? esc(String(d.quantity)) : ''}"
            placeholder="${qtyKnown ? esc(fmtNum(d.quantity)) : ''}" aria-describedby="c-qty-hint">
          <span class="hint" id="c-qty-hint">${esc(certain ? t('review.c.qtySure') : qtyKnown ? t('review.c.qtyAi', { qty: fmtQty(d.quantity, unit) }) : t('review.c.qtyNone'))}
            <span data-each> ${esc(t('review.c.qtyEach'))}</span></span>
        </div>
        ${!certain ? `<label class="check" data-without><input type="checkbox" name="without_stock"> <span>${esc(t('review.c.withoutStock'))}</span></label>
          <span class="hint" data-without>${esc(t('review.c.withoutStockHint'))}</span>` : ''}
      </div>
      <div class="form" data-loc-box>
        <div class="field"><label for="c-type">${esc(t('review.c.locType'))}</label><select id="c-type" name="loc_type">${SUB_TYPES.map((x) =>
          `<option value="${x}"${guessLocType(d.name) === x ? ' selected' : ''}>${esc(locTypeLabel(x))}</option>`).join('')}</select></div>
        <div class="field"><label for="c-short">${esc(t('review.c.short'))}</label><input id="c-short" name="short_code" type="text" maxlength="10" autocapitalize="characters">
          <span class="hint">${esc(t('review.c.shortHint'))}</span></div>
      </div>
      <div class="alert danger" data-err role="alert" hidden></div>
    </form>`;
    return sheet({
      title: t('review.c.title'), body, wide: true,
      actions: [
        { label: t('btn.cancel'), kind: 'ghost', value: null },
        {
          label: t('review.act.confirm'), kind: 'primary', icon: 'check',
          onClick: async (el) => {
            const form = el.querySelector('[data-form]');
            const errEl = el.querySelector('[data-err]');
            const showErr = (msg, focusEl) => { errEl.textContent = msg; errEl.hidden = false; if (focusEl) focusEl.focus(); return false; };
            errEl.hidden = true;
            const kindEl = form.querySelector('input[name="kind"]:checked');
            if (!kindEl) return showErr(t('review.c.needKind'), form.querySelector('input[name="kind"]'));
            const kind = kindEl.value;
            const name = form.elements.name.value.trim();
            if (!name) return showErr(t('err.name_required'), form.elements.name);
            const data = { mode: 'neu', name, kind, category_id: form.elements.category_id.value || null, target_location_id: form.elements.target_location_id.value || null };
            if (kind === 'einrichtung') {
              data.loc_type = form.elements.loc_type.value;
              const sc = normShortCode(form.elements.short_code.value);
              if (sc) data.short_code = sc;
            } else {
              const raw = form.elements.quantity.value.trim();
              const without = form.elements.without_stock && form.elements.without_stock.checked && kind === 'bestandsartikel';
              if (raw === '') {
                if (without) data.without_stock = true;
                else return showErr(t('review.c.needQty'), form.elements.quantity);
              } else {
                const q = numOrNull(raw);
                if (q === null || q < 0) return showErr(t('review.c.qtyInvalid'), form.elements.quantity);
                if (kind !== 'bestandsartikel' && !(Number.isInteger(q) && q >= 1 && q <= 50)) return showErr(t('review.c.qtyRange'), form.elements.quantity);
                data.quantity = q;
              }
            }
            const r = await api.reviewDetection(d.id, 'bestaetigen', data);
            return { r };
          },
        },
      ],
      onOpen: (el) => {
        const form = el.querySelector('[data-form]');
        const qtyBox = el.querySelector('[data-qty-box]');
        const locBox = el.querySelector('[data-loc-box]');
        const locLabel = el.querySelector('[data-loc-label]');
        const each = el.querySelector('[data-each]');
        const short = form.elements.short_code;
        let shortDirty = false;
        short.addEventListener('input', () => { shortDirty = true; });
        const suggest = () => {
          if (shortDirty) return;
          const parent = form.elements.target_location_id.value || null;
          short.value = suggestShortCode(form.elements.loc_type.value, S.locs.filter((l) => (l.parent_id || null) === parent));
        };
        const sync = () => {
          const k = (form.querySelector('input[name="kind"]:checked') || {}).value || '';
          const isLoc = k === 'einrichtung';
          qtyBox.hidden = isLoc;
          locBox.hidden = !isLoc;
          locLabel.textContent = isLoc ? t('review.c.parent') : t('review.c.loc');
          if (each) each.hidden = !(k === 'einzelinventar' || k === 'set');
          el.querySelectorAll('[data-without]').forEach((x) => { x.hidden = k !== 'bestandsartikel'; });
          const q = form.elements.quantity;
          if (q) q.step = k === 'bestandsartikel' ? 'any' : '1';
          if (isLoc) suggest();
        };
        form.addEventListener('change', (e) => {
          if (e.target.name === 'kind') sync();
          if (e.target.name === 'loc_type' || e.target.name === 'target_location_id') suggest();
        });
        form.addEventListener('submit', (e) => e.preventDefault());
        sync();
      },
    }).then(async (v) => {
      if (!v || !v.r) return;
      await refresh();
      showConfirmed(v.r);
    });
  }
  async function showConfirmed(r) {
    const codes = Array.isArray(r.codes) ? r.codes : [];
    const entity = r.entity;
    if (!entity || !codes.length) { toast(t('review.ok.title')); return; }
    const created = codes.map((code) => ({ entity, code }));
    const head = entity === 'article' ? t('review.ok.article') : entity === 'location' ? t('review.ok.location') : t('review.ok.machine', { n: codes.length });
    const v = await sheet({
      title: t('review.ok.title'),
      body: `<div class="alert ok" role="status">${icon('check')}<div class="stack" style="gap:8px"><b>${esc(head)}</b>
          <div class="row">${created.map((c) => `<a class="btn sm" href="${entityHref(c.entity, c.code)}">${esc(c.code)}</a>`).join('')}</div>
          ${r.merged ? `<span>${esc(t('review.ok.merged', { n: r.merged }))}</span>` : ''}
          <span>${esc(t('review.ok.labelHint'))}</span></div></div>`,
      actions: [
        { label: t('review.ok.continue'), kind: 'ghost', value: null },
        { label: t('review.act.label'), kind: 'primary', icon: 'print', value: 'label' },
      ],
      onOpen: (el, close) => el.querySelectorAll('.sheet-body a').forEach((a) => a.addEventListener('click', () => close(null))),
    });
    if (v === 'label') await printCodes(api, created);
  }

  // Bearbeiten
  function openEdit(g) {
    const d = g.primary;
    const units = UNITS.includes(d.unit || 'Stk') ? UNITS : [d.unit, ...UNITS];
    const body = `<form class="form" data-form novalidate>
      ${g.members.length > 1 ? `<div class="alert field full">${icon('layers')}<span>${esc(t('review.e.allPhotos', { n: g.members.length }))}</span></div>` : ''}
      <div class="field full"><label for="e-name">${esc(t('review.c.name'))}</label><input id="e-name" name="name" type="text" maxlength="200" value="${esc(d.name)}"></div>
      <div class="field"><label for="e-kind">${esc(t('review.kind'))}</label><select id="e-kind" name="kind">${KINDS.map((k) => `<option value="${k}"${d.kind === k ? ' selected' : ''}>${esc(kindLabel(k))}</option>`).join('')}</select></div>
      <div class="field"><label for="e-cat">${esc(t('common.category'))}</label><select id="e-cat" name="category_id">${categoryOptionsHtml(S.cats, d.category_id || null)}</select></div>
      <div class="field"><label for="e-brand">${esc(t('common.brand'))}</label><input id="e-brand" name="brand" type="text" maxlength="100" value="${esc(d.brand || '')}"></div>
      <div class="field"><label for="e-model">${esc(t('common.model'))}</label><input id="e-model" name="model" type="text" maxlength="100" value="${esc(d.model || '')}"></div>
      <div class="field"><label for="e-serial">${esc(t('review.serial'))}</label><input id="e-serial" name="serial_no" type="text" maxlength="100" value="${esc(d.serial_no || '')}"></div>
      <div class="field"><label for="e-loc">${esc(t('review.target'))}</label><select id="e-loc" name="target_location_id">${locationOptionsHtml(S.locs, d.target_location_id || '', t('review.l.photo', { path: d.photo_location_path || '–' }))}</select></div>
      <div class="field"><label for="e-qty">${esc(t('review.qty'))}</label><input id="e-qty" name="quantity" type="number" inputmode="decimal" min="0" step="any" value="${d.quantity === null || d.quantity === undefined ? '' : esc(String(d.quantity))}"></div>
      <div class="field"><label for="e-unit">${esc(t('common.unit'))}</label><select id="e-unit" name="unit">${units.map((u) => `<option value="${esc(u)}"${(d.unit || 'Stk') === u ? ' selected' : ''}>${esc(unitLabel(u))}</option>`).join('')}</select></div>
      <label class="check field full"><input type="checkbox" name="quantity_certain"${d.quantity_certain ? ' checked' : ''}> <span>${esc(t('review.e.qtyCertain'))}</span></label>
      <div class="field full"><label for="e-notes">${esc(t('common.notes'))}</label><textarea id="e-notes" name="notes" maxlength="1000">${esc(d.notes || '')}</textarea></div>
      <div class="alert danger field full" data-err role="alert" hidden></div>
    </form>`;
    return sheet({
      title: t('review.e.title'), body, wide: true,
      actions: [
        { label: t('btn.cancel'), kind: 'ghost', value: null },
        {
          label: t('btn.save'), kind: 'primary', icon: 'check',
          onClick: async (el) => {
            const f = el.querySelector('[data-form]').elements;
            const errEl = el.querySelector('[data-err]');
            errEl.hidden = true;
            const name = f.name.value.trim();
            if (!name) { errEl.textContent = t('err.name_required'); errEl.hidden = false; f.name.focus(); return false; }
            const rawQ = f.quantity.value.trim();
            const q = rawQ === '' ? null : numOrNull(rawQ);
            if (rawQ !== '' && (q === null || q < 0)) { errEl.textContent = t('review.c.qtyInvalid'); errEl.hidden = false; f.quantity.focus(); return false; }
            const data = {
              name, kind: f.kind.value, category_id: f.category_id.value || null, brand: f.brand.value, model: f.model.value,
              serial_no: f.serial_no.value, target_location_id: f.target_location_id.value || null, quantity: q,
              quantity_certain: q !== null && f.quantity_certain.checked, unit: f.unit.value, notes: f.notes.value,
            };
            await forMembers(g, ['offen', 'spaeter'], (m) => api.reviewDetection(m.id, 'bearbeiten', data));
            return true;
          },
        },
      ],
      onOpen: (el) => el.querySelector('[data-form]').addEventListener('submit', (e) => e.preventDefault()),
    }).then(async (v) => { if (v) { toast(t('review.e.done')); await refresh(); } });
  }

  // Lagerort ändern
  function openLocation(g) {
    const d = g.primary;
    return sheet({
      title: t('review.l.title'),
      body: `<div class="field"><label for="l-loc">${esc(t('review.target'))}</label>
        <select id="l-loc">${locationOptionsHtml(S.locs, d.target_location_id || '', t('review.l.photo', { path: d.photo_location_path || '–' }))}</select></div>`,
      actions: [
        { label: t('btn.cancel'), kind: 'ghost', value: null },
        {
          label: t('btn.save'), kind: 'primary', icon: 'location',
          onClick: async (el) => {
            const v = el.querySelector('#l-loc').value || null;
            await forMembers(g, ['offen', 'spaeter'], (m) => api.reviewDetection(m.id, 'lagerort', { target_location_id: v }));
            return true;
          },
        },
      ],
    }).then(async (v) => { if (v) { toast(t('review.l.done')); await refresh(); } });
  }

  // Zusammenführen (mit anderem Vorschlag im selben Raum)
  function openMerge(g) {
    const d = g.primary;
    const others = S.groups.filter((x) => x !== g && (x.primary.space_id || null) === (d.space_id || null)
      && ['offen', 'spaeter', 'bestaetigt'].includes(x.status));
    const rowHtml = (x) => {
      const p = x.primary;
      return `<label class="rv-pick" data-hay="${esc(x.hay)}">
        <input type="radio" name="into" value="${esc(x.key)}">
        ${p.photo_path ? `<img class="thumb" data-path="${esc(p.photo_path)}" alt="" loading="lazy">` : `<span class="thumb thumb-empty">${icon('image')}</span>`}
        <span class="rv-pick-main"><b>${esc(p.name)}</b><span class="small muted">${esc([kindLabel(p.kind), p.brand, p.model, p.photo_file_name].filter(Boolean).join(' · '))}</span></span>
        ${statusPillDet(x.status)}</label>`;
    };
    return sheet({
      title: t('review.m.title'), wide: true,
      body: `<p class="muted" style="margin:0">${esc(t('review.m.text'))}</p>
        ${others.length ? `<div class="searchbar">${icon('search')}<input type="search" data-msearch placeholder="${esc(t('review.m.search'))}" aria-label="${esc(t('review.m.search'))}"></div>
          <div class="rv-picklist" role="radiogroup" aria-label="${esc(t('review.m.title'))}">${others.map(rowHtml).join('')}</div>`
          : `<div class="alert">${icon('alert')}<span>${esc(t('review.m.none'))}</span></div>`}
        <div class="alert danger" data-err role="alert" hidden></div>`,
      actions: others.length ? [
        { label: t('btn.cancel'), kind: 'ghost', value: null },
        {
          label: t('review.m.title'), kind: 'primary', icon: 'layers',
          onClick: async (el) => {
            const sel = el.querySelector('input[name="into"]:checked');
            const errEl = el.querySelector('[data-err]');
            if (!sel) { errEl.textContent = t('review.m.pick'); errEl.hidden = false; return false; }
            const target = S.groupMap.get(sel.value);
            if (!target) return false;
            await forMembers(g, ['offen', 'spaeter'], (m) => api.reviewDetection(m.id, 'zusammenfuehren', { into: target.primary.id }));
            return true;
          },
        },
      ] : [{ label: t('btn.close'), kind: 'ghost', value: null }],
      onOpen: (el) => {
        hydrate(el);
        const s = el.querySelector('[data-msearch]');
        if (s) {
          s.addEventListener('input', () => {
            const words = norm(s.value).split(' ').filter(Boolean);
            el.querySelectorAll('.rv-pick').forEach((p) => { p.hidden = !words.every((w) => p.dataset.hay.includes(w)); });
          });
        }
      },
    }).then(async (v) => { if (v) { toast(t('review.m.done')); await refresh(); } });
  }

  // Ablehnen (mit Grund)
  function openReject(g) {
    const quick = ['noInventory', 'wrong', 'notOurs', 'double'];
    return sheet({
      title: t('review.r.title'),
      body: `<p class="muted" style="margin:0">${esc(t('review.r.text'))}</p>
        <div class="chips">${quick.map((q) => `<button type="button" class="chip" data-quick="${esc(t('review.r.q.' + q))}">${esc(t('review.r.q.' + q))}</button>`).join('')}</div>
        <div class="field"><label for="r-reason">${esc(t('review.r.reason'))}</label>
          <textarea id="r-reason" maxlength="300" placeholder="${esc(t('review.r.reasonPh'))}"></textarea></div>`,
      actions: [
        { label: t('btn.cancel'), kind: 'ghost', value: null },
        {
          label: t('review.act.reject'), kind: 'danger', icon: 'x',
          onClick: async (el) => {
            const reason = el.querySelector('#r-reason').value.trim();
            await forMembers(g, ['offen', 'spaeter'], (m) => api.reviewDetection(m.id, 'ablehnen', reason ? { reason } : {}));
            return true;
          },
        },
      ],
      onOpen: (el) => {
        const ta = el.querySelector('#r-reason');
        el.querySelectorAll('[data-quick]').forEach((c) => c.addEventListener('click', () => {
          ta.value = c.dataset.quick;
          el.querySelectorAll('[data-quick]').forEach((x) => x.setAttribute('aria-pressed', String(x === c)));
          ta.focus();
        }));
      },
    }).then(async (v) => { if (v) { toast(t('review.r.done')); await refresh(); } });
  }

  // Alle sicheren bestätigen (Vorschau → nacheinander → Bericht)
  function openBulk() {
    const list = S.view.filter(bulkEligible);
    if (!list.length) return;
    let closeFn = null;
    let ran = false;
    const created = [];
    const rowHtml = (g, i) => {
      const d = g.primary;
      return `<label class="rv-pick">
        <input type="checkbox" data-bi="${i}" checked>
        ${d.photo_path ? `<img class="thumb" data-path="${esc(d.photo_path)}" alt="" loading="lazy">` : `<span class="thumb thumb-empty">${icon('image')}</span>`}
        <span class="rv-pick-main"><b>${esc(d.name)}</b>
          <span class="small muted">${esc([kindLabel(d.kind), fmtQty(d.quantity, d.unit || 'Stk'), d.category_path].filter(Boolean).join(' · '))}</span>
          <span class="small muted">${esc(d.target_location_path || d.photo_location_path || '')}</span></span></label>`;
    };
    sheet({
      title: t('review.b.title'), wide: true,
      body: `<p class="muted" style="margin:0">${esc(t('review.b.text'))}</p>
        <div class="row"><span class="small" data-bsel>${esc(t('review.b.selected', { n: list.length }))}</span></div>
        <div class="rv-picklist" data-blist>${list.map(rowHtml).join('')}</div>
        <div data-bprog hidden></div>
        <div data-breport></div>
        <div class="alert danger" data-err role="alert" hidden></div>`,
      actions: [
        { label: t('btn.cancel'), kind: 'ghost', value: null },
        {
          label: t('review.b.submit'), kind: 'primary', icon: 'check',
          onClick: async (el) => {
            const chosen = [...el.querySelectorAll('[data-bi]')].filter((c) => c.checked).map((c) => list[Number(c.dataset.bi)]);
            const errEl = el.querySelector('[data-err]');
            if (!chosen.length) { errEl.textContent = t('review.b.none'); errEl.hidden = false; return false; }
            errEl.hidden = true;
            ran = true;
            el.querySelectorAll('[data-bi]').forEach((c) => { c.disabled = true; });
            const prog = el.querySelector('[data-bprog]');
            prog.hidden = false;
            const fails = [];
            let ok = 0;
            for (let i = 0; i < chosen.length; i++) {
              prog.innerHTML = progressHtml(i, chosen.length, t('review.b.title'));
              const g = chosen[i];
              try {
                const r = await api.reviewDetection(g.primary.id, 'bestaetigen', { mode: 'neu' });
                ok++;
                for (const code of (r && Array.isArray(r.codes) ? r.codes : [])) created.push({ entity: r.entity, code, name: g.primary.name });
              } catch (err) {
                fails.push({ name: g.primary.name, error: errorText(err) });
              }
            }
            prog.innerHTML = progressHtml(chosen.length, chosen.length, t('review.b.title'));
            el.querySelector('[data-blist]').hidden = true;
            el.querySelector('[data-bsel]').hidden = true;
            el.querySelector('[data-breport]').innerHTML = `
              <div class="alert ${fails.length ? 'warn' : 'ok'}" role="status">${icon(fails.length ? 'alert' : 'check')}<div class="stack" style="gap:8px">
                <b>${esc(t('review.b.report', { ok, fail: fails.length }))}</b>
                ${created.length ? `<div class="row">${created.map((c) => `<a class="btn sm" href="${entityHref(c.entity, c.code)}">${esc(c.code)}</a>`).join('')}</div>` : ''}
                ${fails.length ? `<ul class="ana-list">${fails.map((f) => `<li><b>${esc(f.name)}</b>: ${esc(f.error)}</li>`).join('')}</ul>` : ''}
                ${created.length ? `<div><button type="button" class="btn primary" data-blabels>${icon('print')}${esc(t('review.b.labels', { n: created.length }))}</button></div>` : ''}
              </div></div>`;
            const [cancelBtn, submitBtn] = el.querySelectorAll('.sheet-actions button');
            submitBtn.hidden = true;
            cancelBtn.textContent = t('btn.close');
            const lb = el.querySelector('[data-blabels]');
            if (lb) lb.addEventListener('click', () => closeFn && closeFn('labels'));
            el.querySelectorAll('[data-breport] a').forEach((a) => a.addEventListener('click', () => closeFn && closeFn(null)));
            return false;
          },
        },
      ],
      onOpen: (el, close) => {
        closeFn = close;
        hydrate(el);
        const upd = () => {
          const n = [...el.querySelectorAll('[data-bi]')].filter((c) => c.checked).length;
          el.querySelector('[data-bsel]').textContent = t('review.b.selected', { n });
        };
        el.querySelector('[data-blist]').addEventListener('change', upd);
      },
    }).then(async (v) => {
      if (ran) await refresh();
      if (v === 'labels' && created.length) await printCodes(api, created);
    });
  }

  renderList();
}

export const routes = {
  'organisieren/import': importPage,
  'organisieren/pruefen': reviewPage,
};
