// Ansicht «Artikel» (Material mit Lagerbestand):
//   'artikel'            Liste mit Suche, Filtern, Export und Import der bisherigen Etiketten-App
//   'a/:code'            Artikelkarte (nach dem Scannen): Bestand, Entnahme/Zugang, Verwaltung, Bewegungen, Fotos
//   'artikel/neu'        Formular (neu, auch «Duplizieren» über ?from=CODE)
//   'a/:code/bearbeiten' Formular (bearbeiten)
import { t, registerStrings, fmtQty, fmtNum, fmtDateTime, unitLabel, locale } from '../i18n.js';
import {
  esc, clean, uuid, debounce, can, toast, sheet, confirmSheet, errorText, emptyHtml, thumbHtml,
  hydrateThumbs, downloadCsv, today, formData, nullIfEmpty, numOrNull, icon, openLightbox,
} from '../util.js';
import * as media from '../media.js';
import * as labels from '../labels.js';
import { consumptionMap, coverDays, coverText, coverSpanDays, suggestQty } from '../consumption.js';
import { mountUsedFor } from '../supplies.js';
import { categoryOptionsHtml, categorySubtreeIds, confidencePill, sourceLabel } from '../org-common.js';

// ---------------------------------------------------------------------------
// Texte
// ---------------------------------------------------------------------------
registerStrings({
  de: {
    'articles.title': 'Artikel',
    'articles.new': 'Neuer Artikel',
    'articles.searchLabel': 'Artikel suchen',
    'articles.searchPh': 'Name, Code, Art.-Nr., Marke, Lagerort…',
    'articles.allCategories': 'Alle Kategorien',
    'articles.categoryLabel': 'Nach Kategorie filtern',
    'articles.filterLabel': 'Nach Bestand filtern',
    'articles.chipAll': 'Alle',
    'articles.chipLow': 'Wenig Bestand',
    'articles.low': 'Wenig',
    'articles.count1': '1 Artikel',
    'articles.countN': '{n} Artikel',
    'articles.countLow': 'Wenig Bestand: {n}',
    'articles.empty': 'Keine Artikel gefunden.',
    'articles.emptyAll': 'Noch keine Artikel erfasst.',
    'articles.showMore': 'Weitere anzeigen ({n})',
    'articles.import': 'Import (CSV/JSON)',
    'articles.exportFile': 'artikel',
    'articles.f.code': 'Code',
    'articles.f.name': 'Name',
    'articles.f.description': 'Beschreibung',
    'articles.f.artNo': 'Art.-Nr.',
    'articles.f.category': 'Kategorie',
    'articles.f.brand': 'Marke',
    'articles.f.model': 'Modell',
    'articles.f.brandModel': 'Marke / Modell',
    'articles.f.size': 'Grösse',
    'articles.f.color': 'Farbe',
    'articles.f.unit': 'Einheit',
    'articles.f.stock': 'Lagerbestand',
    'articles.f.initialStock': 'Anfangsbestand',
    'articles.f.minStock': 'Mindestbestand',
    'articles.f.location': 'Lagerort',
    'articles.f.usage': 'Verwendung',
    'articles.f.labelText': 'Etikettentext',
    'articles.f.notes': 'Bemerkungen',
    'articles.h.code': 'Leer lassen = automatisch (INV-xxxx).',
    'articles.h.initialStock': 'Danach ändert sich der Bestand nur noch über Bewegungen (Entnahme, Zugang, Korrektur).',
    'articles.h.minStock': 'Bei diesem Bestand oder weniger gilt der Artikel als «Wenig Bestand».',
    'articles.h.labelText': 'Kurzer Text für das Etikett (optional).',
    'articles.h.category': 'Bestehende Kategorie wählen oder eine neue eingeben.',
    'articles.noLocation': '– kein Lagerort –',
    'articles.newTitle': 'Neuer Artikel',
    'articles.editTitle': 'Artikel bearbeiten',
    'articles.duplicateHint': 'Kopie von {code}. Code und Bestand werden nicht übernommen.',
    'articles.created': 'Artikel {code} angelegt',
    'articles.printNow': 'Möchtest du jetzt das Etikett drucken?',
    'articles.printLabel': 'Etikett drucken',
    'articles.later': 'Später',
    'articles.notFound': 'Artikel {code} wurde nicht gefunden.',
    'articles.toList': 'Zur Artikelliste',
    'articles.archivedNote': 'Dieser Artikel ist archiviert. Entnahmen und Zugänge sind nicht möglich.',
    'articles.stockNow': 'Aktueller Bestand',
    'articles.minStockLine': 'Mindestbestand {qty}',
    'articles.lowAlert': 'Wenig Bestand: Der Mindestbestand von {qty} ist erreicht. Bitte nachbestellen.',
    'articles.f.reorderQty': 'Nachkaufmenge', 'articles.h.reorderQty': 'So viel kommt auf die Einkaufsliste, wenn der Mindestbestand erreicht ist (z. B. 1 Karton = 5 Pkg). Leer = bis zum doppelten Mindestbestand.',
    'articles.reorderLine': 'Nachkaufmenge {qty}', 'articles.toShop': 'Auf die Einkaufsliste', 'articles.onShop': 'Steht auf der Einkaufsliste',
    'articles.onShopOpen': 'Zur Einkaufsliste', 'articles.shopAdded': '«{name}» steht jetzt auf der Einkaufsliste.',
    'articles.take': 'Entnahme',
    'articles.add': 'Zugang',
    'articles.move': 'Umlagern',
    'articles.correct': 'Korrektur',
    'articles.takeTitle': 'Entnahme: {name}',
    'articles.addTitle': 'Zugang: {name}',
    'articles.moveTitle': 'Umlagern: {name}',
    'articles.correctTitle': 'Korrektur: {name}',
    'articles.takeBtn': 'Entnehmen',
    'articles.addBtn': 'Hinzufügen',
    'articles.moveBtn': 'Umlagern',
    'articles.correctBtn': 'Bestand korrigieren',
    'articles.qty': 'Menge',
    'articles.qtyLess': 'Menge verringern',
    'articles.qtyMore': 'Menge erhöhen',
    'articles.quick': 'Schnellwahl',
    'articles.note': 'Bemerkung (optional)',
    'articles.notePh': 'z. B. Baustelle oder Auftrag',
    'articles.newStock': 'Neuer Bestand: {stock}',
    'articles.diff': 'Differenz: {diff}',
    'articles.wholeNumber': 'Bitte eine ganze Zahl eingeben.',
    'articles.toastTake': '{qty} entnommen – neuer Bestand {stock}',
    'articles.toastAdd': '{qty} hinzugefügt – neuer Bestand {stock}',
    'articles.toastMove': 'Umgelagert nach {path}',
    'articles.toastCorrect': 'Bestand korrigiert: {from} → {to}',
    'articles.moveCurrent': 'Aktueller Lagerort',
    'articles.moveTarget': 'Neuer Lagerort',
    'articles.moveChoose': '– bitte wählen –',
    'articles.moveNeedTarget': 'Bitte einen neuen Lagerort wählen.',
    'articles.moveSame': 'Der Artikel liegt bereits an diesem Lagerort.',
    'articles.moveHint': 'Der ganze Bestand wird an den neuen Lagerort verschoben.',
    'articles.correctNew': 'Neuer Bestand (gezählt)',
    'articles.correctReason': 'Begründung',
    'articles.correctReasonPh': 'z. B. nachgezählt, Bruch, Fehlbuchung',
    'articles.correctHint': 'Der Bestand wird auf diese Menge gesetzt. Die Differenz wird als Korrektur gebucht.',
    'articles.correctSame': 'Die Menge entspricht bereits dem aktuellen Bestand.',
    'articles.manage': 'Verwaltung',
    'articles.archiveQ': 'Artikel archivieren?',
    'articles.archiveMsg': '«{name}» wird archiviert und in der Liste ausgeblendet. Der Verlauf bleibt erhalten.',
    'articles.archivedToast': 'Artikel archiviert.',
    'articles.unarchivedToast': 'Artikel wiederhergestellt.',
    'articles.deleteQ': 'Artikel endgültig löschen?',
    'articles.deleteMsg': '«{name}» wird endgültig gelöscht. Das kann nicht rückgängig gemacht werden.',
    'articles.deleted': 'Artikel gelöscht.',
    'articles.inUseTitle': 'Löschen nicht möglich',
    'articles.inUseMsg': 'Für diesen Artikel gibt es bereits Bewegungen. Er kann deshalb nicht gelöscht, aber archiviert werden. Jetzt archivieren?',
    'articles.inUseArchived': 'Für diesen Artikel gibt es bereits Bewegungen. Er kann deshalb nicht gelöscht werden.',
    'articles.movements': 'Bewegungen',
    'articles.mv.date': 'Datum',
    'articles.mv.type': 'Art',
    'articles.mv.qty': 'Menge',
    'articles.mv.after': 'Bestand danach',
    'articles.mv.user': 'Mitarbeiter',
    'articles.mv.note': 'Bemerkung / Lagerort',
    'articles.mv.none': 'Noch keine Bewegungen.',
    'articles.mv.more': 'Ältere Bewegungen anzeigen',
    'articles.mv.error': 'Die Bewegungen konnten nicht geladen werden.',
    'articles.qrAlt': 'QR-Code für {code}',
    'articles.photoAlt': 'Foto von {name}',
    'articles.imp.title': 'Artikel importieren',
    'articles.imp.intro': 'Einträge in «{file}»: {n}',
    'articles.imp.new': 'Neue Artikel: {n}',
    'articles.imp.exists': 'Übersprungen – Code existiert bereits: {n}',
    'articles.imp.existsCodes': 'Bereits vorhandene Codes: {codes}',
    'articles.imp.dupInFile': 'Übersprungen – Code mehrfach in der Datei: {n}',
    'articles.imp.noName': 'Übersprungen – ohne Namen: {n}',
    'articles.imp.oldLoc': 'Alter Ortstext unter «Bemerkungen» übernommen («Ort (alt): …»): {n}',
    'articles.imp.codesKept': 'Vorhandene Codes (z. B. INV-0001) werden übernommen – alte QR-Etiketten funktionieren weiter.',
    'articles.imp.start': 'Importieren',
    'articles.imp.nothing': 'Es gibt nichts zu importieren.',
    'articles.imp.progress': 'Importiere {i} von {n}…',
    'articles.imp.doneTitle': 'Import abgeschlossen',
    'articles.imp.done': 'Importiert: {n}',
    'articles.imp.failed': 'Nicht importiert: {n}',
    'articles.imp.aborted': 'Wegen eines Verbindungsproblems abgebrochen – {n} Einträge wurden nicht importiert. Starte den Import einfach noch einmal: bereits importierte Codes werden übersprungen.',
    'articles.imp.badFile': 'Die Datei konnte nicht gelesen werden. Erwartet wird inventario.json oder eine CSV-Datei mit einer Spalte «Name».',
    'articles.f.productUrl': 'Herstellerseite',
    'articles.h.productUrl': 'Nur ein Link zur Produktseite (http/https). Es werden keine fremden Bilder geladen.',
    'articles.productUrlInvalid': 'Bitte eine vollständige Adresse eingeben, die mit http:// oder https:// beginnt.',
    'articles.productHint': 'Produktbild: nur Link, Nutzungsrechte nicht geprüft',
    'articles.categoryLegacy': 'Bisherige Kategorie (Freitext): «{text}». Wähle eine Kategorie aus der Liste – sonst bleibt der Freitext erhalten.',
    'articles.catLink': 'Alles in dieser Kategorie anzeigen',
    'articles.codePath': 'Lesbarer Code {code}',
    'articles.legacyCats': 'Bisherige Kategorien (Freitext)',
    'articles.det.title': 'Originalfotos aus der Fotoanalyse',
    'articles.det.intro': 'Aus diesen Fotos wurde der Eintrag erkannt. Foto antippen = gross.',
    'articles.det.file': 'Datei',
    'articles.det.place': 'Aufgenommen in',
    'articles.det.conf': 'Sicherheit',
    'articles.det.source': 'Herkunft',
    'articles.det.as': 'Erkannt als',
    'articles.det.qty': 'Gezählte Menge',
    'articles.det.qtyUncertain': '(unsicher)',
    'articles.det.zoom': 'Foto «{name}» vergrössern',
  },
  pt: {
    'articles.title': 'Artigos',
    'articles.new': 'Novo artigo',
    'articles.searchLabel': 'Pesquisar artigos',
    'articles.searchPh': 'Nome, código, referência, marca, localização…',
    'articles.allCategories': 'Todas as categorias',
    'articles.categoryLabel': 'Filtrar por categoria',
    'articles.filterLabel': 'Filtrar por stock',
    'articles.chipAll': 'Todos',
    'articles.chipLow': 'Stock baixo',
    'articles.low': 'Baixo',
    'articles.count1': '1 artigo',
    'articles.countN': '{n} artigos',
    'articles.countLow': 'Stock baixo: {n}',
    'articles.empty': 'Nenhum artigo encontrado.',
    'articles.emptyAll': 'Ainda não há artigos registados.',
    'articles.showMore': 'Mostrar mais ({n})',
    'articles.import': 'Importar (CSV/JSON)',
    'articles.exportFile': 'artigos',
    'articles.f.code': 'Código',
    'articles.f.name': 'Nome',
    'articles.f.description': 'Descrição',
    'articles.f.artNo': 'Referência',
    'articles.f.category': 'Categoria',
    'articles.f.brand': 'Marca',
    'articles.f.model': 'Modelo',
    'articles.f.brandModel': 'Marca / modelo',
    'articles.f.size': 'Tamanho',
    'articles.f.color': 'Cor',
    'articles.f.unit': 'Unidade',
    'articles.f.stock': 'Stock',
    'articles.f.initialStock': 'Stock inicial',
    'articles.f.minStock': 'Stock mínimo',
    'articles.f.location': 'Localização',
    'articles.f.usage': 'Utilização',
    'articles.f.labelText': 'Texto da etiqueta',
    'articles.f.notes': 'Observações',
    'articles.h.code': 'Deixa em branco = automático (INV-xxxx).',
    'articles.h.initialStock': 'Depois disto, o stock só muda através de movimentos (saída, entrada, correção).',
    'articles.h.minStock': 'Com este stock ou menos, o artigo fica marcado como «stock baixo».',
    'articles.h.labelText': 'Texto curto para a etiqueta (opcional).',
    'articles.h.category': 'Escolhe uma categoria existente ou escreve uma nova.',
    'articles.noLocation': '– sem localização –',
    'articles.newTitle': 'Novo artigo',
    'articles.editTitle': 'Editar artigo',
    'articles.duplicateHint': 'Cópia de {code}. O código e o stock não são copiados.',
    'articles.created': 'Artigo {code} criado',
    'articles.printNow': 'Queres imprimir a etiqueta agora?',
    'articles.printLabel': 'Imprimir etiqueta',
    'articles.later': 'Mais tarde',
    'articles.notFound': 'O artigo {code} não foi encontrado.',
    'articles.toList': 'Ir para a lista de artigos',
    'articles.archivedNote': 'Este artigo está arquivado. Não é possível registar saídas nem entradas.',
    'articles.stockNow': 'Stock atual',
    'articles.minStockLine': 'Stock mínimo {qty}',
    'articles.lowAlert': 'Stock baixo: atingiu-se o stock mínimo de {qty}. É preciso encomendar.',
    'articles.f.reorderQty': 'Quantidade a repor', 'articles.h.reorderQty': 'Quanto entra na lista de compras quando se atinge o stock mínimo (p. ex. 1 caixa = 5 pacotes). Vazio = até ao dobro do stock mínimo.',
    'articles.reorderLine': 'Quantidade a repor {qty}', 'articles.toShop': 'Para a lista de compras', 'articles.onShop': 'Está na lista de compras',
    'articles.onShopOpen': 'Ver lista de compras', 'articles.shopAdded': '«{name}» está agora na lista de compras.',
    'articles.take': 'Saída',
    'articles.add': 'Entrada',
    'articles.move': 'Transferir',
    'articles.correct': 'Correção',
    'articles.takeTitle': 'Saída: {name}',
    'articles.addTitle': 'Entrada: {name}',
    'articles.moveTitle': 'Transferir: {name}',
    'articles.correctTitle': 'Correção: {name}',
    'articles.takeBtn': 'Retirar',
    'articles.addBtn': 'Adicionar',
    'articles.moveBtn': 'Transferir',
    'articles.correctBtn': 'Corrigir stock',
    'articles.qty': 'Quantidade',
    'articles.qtyLess': 'Diminuir quantidade',
    'articles.qtyMore': 'Aumentar quantidade',
    'articles.quick': 'Escolha rápida',
    'articles.note': 'Observação (opcional)',
    'articles.notePh': 'p. ex. obra ou encomenda',
    'articles.newStock': 'Novo stock: {stock}',
    'articles.diff': 'Diferença: {diff}',
    'articles.wholeNumber': 'Introduz um número inteiro.',
    'articles.toastTake': 'Saída de {qty} registada – novo stock {stock}',
    'articles.toastAdd': 'Entrada de {qty} registada – novo stock {stock}',
    'articles.toastMove': 'Transferido para {path}',
    'articles.toastCorrect': 'Stock corrigido: {from} → {to}',
    'articles.moveCurrent': 'Localização atual',
    'articles.moveTarget': 'Nova localização',
    'articles.moveChoose': '– escolhe –',
    'articles.moveNeedTarget': 'Escolhe a nova localização.',
    'articles.moveSame': 'O artigo já está nesta localização.',
    'articles.moveHint': 'Todo o stock é transferido para a nova localização.',
    'articles.correctNew': 'Novo stock (contado)',
    'articles.correctReason': 'Motivo',
    'articles.correctReasonPh': 'p. ex. recontagem, quebra, erro de registo',
    'articles.correctHint': 'O stock passa a ser esta quantidade. A diferença fica registada como correção.',
    'articles.correctSame': 'A quantidade já é igual ao stock atual.',
    'articles.manage': 'Gestão',
    'articles.archiveQ': 'Arquivar o artigo?',
    'articles.archiveMsg': '«{name}» é arquivado e deixa de aparecer na lista. O histórico mantém-se.',
    'articles.archivedToast': 'Artigo arquivado.',
    'articles.unarchivedToast': 'Artigo restaurado.',
    'articles.deleteQ': 'Eliminar o artigo definitivamente?',
    'articles.deleteMsg': '«{name}» é eliminado definitivamente. Esta ação não pode ser anulada.',
    'articles.deleted': 'Artigo eliminado.',
    'articles.inUseTitle': 'Não é possível eliminar',
    'articles.inUseMsg': 'Este artigo já tem movimentos, por isso não pode ser eliminado, mas pode ser arquivado. Arquivar agora?',
    'articles.inUseArchived': 'Este artigo já tem movimentos, por isso não pode ser eliminado.',
    'articles.movements': 'Movimentos',
    'articles.mv.date': 'Data',
    'articles.mv.type': 'Tipo',
    'articles.mv.qty': 'Quantidade',
    'articles.mv.after': 'Stock depois',
    'articles.mv.user': 'Colaborador',
    'articles.mv.note': 'Observação / localização',
    'articles.mv.none': 'Ainda não há movimentos.',
    'articles.mv.more': 'Mostrar movimentos anteriores',
    'articles.mv.error': 'Não foi possível carregar os movimentos.',
    'articles.qrAlt': 'Código QR de {code}',
    'articles.photoAlt': 'Foto de {name}',
    'articles.imp.title': 'Importar artigos',
    'articles.imp.intro': 'Registos em «{file}»: {n}',
    'articles.imp.new': 'Artigos novos: {n}',
    'articles.imp.exists': 'Ignorados – o código já existe: {n}',
    'articles.imp.existsCodes': 'Códigos já existentes: {codes}',
    'articles.imp.dupInFile': 'Ignorados – código repetido no ficheiro: {n}',
    'articles.imp.noName': 'Ignorados – sem nome: {n}',
    'articles.imp.oldLoc': 'Texto de localização antigo guardado em «Observações» («Ort (alt): …»): {n}',
    'articles.imp.codesKept': 'Os códigos existentes (p. ex. INV-0001) são mantidos – as etiquetas QR antigas continuam a funcionar.',
    'articles.imp.start': 'Importar',
    'articles.imp.nothing': 'Não há nada para importar.',
    'articles.imp.progress': 'A importar {i} de {n}…',
    'articles.imp.doneTitle': 'Importação concluída',
    'articles.imp.done': 'Importados: {n}',
    'articles.imp.failed': 'Não importados: {n}',
    'articles.imp.aborted': 'Interrompido por um problema de ligação – {n} registos não foram importados. Volta a iniciar a importação: os códigos já importados são ignorados.',
    'articles.imp.badFile': 'Não foi possível ler o ficheiro. Espera-se o inventario.json ou um ficheiro CSV com uma coluna «Nome».',
    'articles.f.productUrl': 'Página do fabricante',
    'articles.h.productUrl': 'Só uma ligação para a página do produto (http/https). Não são carregadas imagens externas.',
    'articles.productUrlInvalid': 'Introduz um endereço completo que comece por http:// ou https://.',
    'articles.productHint': 'Imagem do produto: só ligação, direitos de utilização não verificados',
    'articles.categoryLegacy': 'Categoria anterior (texto livre): «{text}». Escolhe uma categoria da lista – caso contrário, o texto livre mantém-se.',
    'articles.catLink': 'Ver tudo nesta categoria',
    'articles.codePath': 'Código legível {code}',
    'articles.legacyCats': 'Categorias anteriores (texto livre)',
    'articles.det.title': 'Fotos originais da análise de fotos',
    'articles.det.intro': 'O registo foi reconhecido a partir destas fotos. Toca na foto para ampliar.',
    'articles.det.file': 'Ficheiro',
    'articles.det.place': 'Tirada em',
    'articles.det.conf': 'Certeza',
    'articles.det.source': 'Origem',
    'articles.det.as': 'Reconhecido como',
    'articles.det.qty': 'Quantidade contada',
    'articles.det.qtyUncertain': '(incerta)',
    'articles.det.zoom': 'Ampliar a foto «{name}»',
  },
  es: {
    'articles.title': 'Artículos',
    'articles.new': 'Nuevo artículo',
    'articles.searchLabel': 'Buscar artículos',
    'articles.searchPh': 'Nombre, código, n.º de artículo, marca, ubicación…',
    'articles.allCategories': 'Todas las categorías',
    'articles.categoryLabel': 'Filtrar por categoría',
    'articles.filterLabel': 'Filtrar por stock',
    'articles.chipAll': 'Todos',
    'articles.chipLow': 'Poco stock',
    'articles.low': 'Poco',
    'articles.count1': '1 artículo',
    'articles.countN': '{n} artículos',
    'articles.countLow': 'Poco stock: {n}',
    'articles.empty': 'No se han encontrado artículos.',
    'articles.emptyAll': 'Todavía no hay artículos.',
    'articles.showMore': 'Mostrar más ({n})',
    'articles.import': 'Importar (CSV/JSON)',
    'articles.exportFile': 'articulos',
    'articles.f.code': 'Código',
    'articles.f.name': 'Nombre',
    'articles.f.description': 'Descripción',
    'articles.f.artNo': 'N.º de artículo',
    'articles.f.category': 'Categoría',
    'articles.f.brand': 'Marca',
    'articles.f.model': 'Modelo',
    'articles.f.brandModel': 'Marca / modelo',
    'articles.f.size': 'Tamaño',
    'articles.f.color': 'Color',
    'articles.f.unit': 'Unidad',
    'articles.f.stock': 'Stock',
    'articles.f.initialStock': 'Stock inicial',
    'articles.f.minStock': 'Stock mínimo',
    'articles.f.location': 'Ubicación',
    'articles.f.usage': 'Uso',
    'articles.f.labelText': 'Texto de la etiqueta',
    'articles.f.notes': 'Observaciones',
    'articles.h.code': 'Déjalo vacío = automático (INV-xxxx).',
    'articles.h.initialStock': 'Después, el stock solo cambia mediante movimientos (retirada, entrada, corrección).',
    'articles.h.minStock': 'Con este stock o menos, el artículo se marca como «poco stock».',
    'articles.h.labelText': 'Texto corto para la etiqueta (opcional).',
    'articles.h.category': 'Elige una categoría existente o escribe una nueva.',
    'articles.noLocation': '– sin ubicación –',
    'articles.newTitle': 'Nuevo artículo',
    'articles.editTitle': 'Editar artículo',
    'articles.duplicateHint': 'Copia de {code}. No se copian ni el código ni el stock.',
    'articles.created': 'Artículo {code} creado',
    'articles.printNow': '¿Quieres imprimir la etiqueta ahora?',
    'articles.printLabel': 'Imprimir etiqueta',
    'articles.later': 'Más tarde',
    'articles.notFound': 'No se ha encontrado el artículo {code}.',
    'articles.toList': 'Ir a la lista de artículos',
    'articles.archivedNote': 'Este artículo está archivado. No se pueden registrar retiradas ni entradas.',
    'articles.stockNow': 'Stock actual',
    'articles.minStockLine': 'Stock mínimo {qty}',
    'articles.lowAlert': 'Poco stock: se ha alcanzado el stock mínimo de {qty}. Hay que pedir más.',
    'articles.f.reorderQty': 'Cantidad a reponer', 'articles.h.reorderQty': 'Lo que entra en la lista de compras al llegar al stock mínimo (p. ej. 1 caja = 5 paquetes). Vacío = hasta el doble del stock mínimo.',
    'articles.reorderLine': 'Cantidad a reponer {qty}', 'articles.toShop': 'A la lista de compras', 'articles.onShop': 'Está en la lista de compras',
    'articles.onShopOpen': 'Ver lista de compras', 'articles.shopAdded': '«{name}» está ahora en la lista de compras.',
    'articles.take': 'Retirada',
    'articles.add': 'Entrada',
    'articles.move': 'Trasladar',
    'articles.correct': 'Corrección',
    'articles.takeTitle': 'Retirada: {name}',
    'articles.addTitle': 'Entrada: {name}',
    'articles.moveTitle': 'Trasladar: {name}',
    'articles.correctTitle': 'Corrección: {name}',
    'articles.takeBtn': 'Retirar',
    'articles.addBtn': 'Añadir',
    'articles.moveBtn': 'Trasladar',
    'articles.correctBtn': 'Corregir stock',
    'articles.qty': 'Cantidad',
    'articles.qtyLess': 'Reducir cantidad',
    'articles.qtyMore': 'Aumentar cantidad',
    'articles.quick': 'Selección rápida',
    'articles.note': 'Observación (opcional)',
    'articles.notePh': 'p. ej. obra o pedido',
    'articles.newStock': 'Nuevo stock: {stock}',
    'articles.diff': 'Diferencia: {diff}',
    'articles.wholeNumber': 'Introduce un número entero.',
    'articles.toastTake': 'Retirada de {qty} registrada – nuevo stock {stock}',
    'articles.toastAdd': 'Entrada de {qty} registrada – nuevo stock {stock}',
    'articles.toastMove': 'Trasladado a {path}',
    'articles.toastCorrect': 'Stock corregido: {from} → {to}',
    'articles.moveCurrent': 'Ubicación actual',
    'articles.moveTarget': 'Nueva ubicación',
    'articles.moveChoose': '– elige –',
    'articles.moveNeedTarget': 'Elige la nueva ubicación.',
    'articles.moveSame': 'El artículo ya está en esta ubicación.',
    'articles.moveHint': 'Todo el stock se traslada a la nueva ubicación.',
    'articles.correctNew': 'Nuevo stock (contado)',
    'articles.correctReason': 'Motivo',
    'articles.correctReasonPh': 'p. ej. recuento, rotura, error de registro',
    'articles.correctHint': 'El stock pasa a ser esta cantidad. La diferencia se registra como corrección.',
    'articles.correctSame': 'La cantidad ya coincide con el stock actual.',
    'articles.manage': 'Gestión',
    'articles.archiveQ': '¿Archivar el artículo?',
    'articles.archiveMsg': '«{name}» se archivará y dejará de aparecer en la lista. El historial se conserva.',
    'articles.archivedToast': 'Artículo archivado.',
    'articles.unarchivedToast': 'Artículo restaurado.',
    'articles.deleteQ': '¿Eliminar el artículo definitivamente?',
    'articles.deleteMsg': '«{name}» se eliminará definitivamente. No se puede deshacer.',
    'articles.deleted': 'Artículo eliminado.',
    'articles.inUseTitle': 'No se puede eliminar',
    'articles.inUseMsg': 'Este artículo ya tiene movimientos, así que no se puede eliminar, pero sí archivar. ¿Archivarlo ahora?',
    'articles.inUseArchived': 'Este artículo ya tiene movimientos, así que no se puede eliminar.',
    'articles.movements': 'Movimientos',
    'articles.mv.date': 'Fecha',
    'articles.mv.type': 'Tipo',
    'articles.mv.qty': 'Cantidad',
    'articles.mv.after': 'Stock después',
    'articles.mv.user': 'Empleado',
    'articles.mv.note': 'Observación / ubicación',
    'articles.mv.none': 'Todavía no hay movimientos.',
    'articles.mv.more': 'Mostrar movimientos anteriores',
    'articles.mv.error': 'No se han podido cargar los movimientos.',
    'articles.qrAlt': 'Código QR de {code}',
    'articles.photoAlt': 'Foto de {name}',
    'articles.imp.title': 'Importar artículos',
    'articles.imp.intro': 'Registros en «{file}»: {n}',
    'articles.imp.new': 'Artículos nuevos: {n}',
    'articles.imp.exists': 'Omitidos – el código ya existe: {n}',
    'articles.imp.existsCodes': 'Códigos ya existentes: {codes}',
    'articles.imp.dupInFile': 'Omitidos – código repetido en el archivo: {n}',
    'articles.imp.noName': 'Omitidos – sin nombre: {n}',
    'articles.imp.oldLoc': 'Texto de ubicación antiguo guardado en «Observaciones» («Ort (alt): …»): {n}',
    'articles.imp.codesKept': 'Se conservan los códigos existentes (p. ej. INV-0001): las etiquetas QR antiguas siguen funcionando.',
    'articles.imp.start': 'Importar',
    'articles.imp.nothing': 'No hay nada que importar.',
    'articles.imp.progress': 'Importando {i} de {n}…',
    'articles.imp.doneTitle': 'Importación terminada',
    'articles.imp.done': 'Importados: {n}',
    'articles.imp.failed': 'No importados: {n}',
    'articles.imp.aborted': 'Interrumpido por un problema de conexión: {n} registros no se han importado. Vuelve a iniciar la importación; los códigos ya importados se omiten.',
    'articles.imp.badFile': 'No se ha podido leer el archivo. Se espera inventario.json o un archivo CSV con una columna «Nombre».',
    'articles.f.productUrl': 'Página del fabricante',
    'articles.h.productUrl': 'Solo un enlace a la página del producto (http/https). No se cargan imágenes externas.',
    'articles.productUrlInvalid': 'Introduce una dirección completa que empiece por http:// o https://.',
    'articles.productHint': 'Imagen del producto: solo enlace, derechos de uso no comprobados',
    'articles.categoryLegacy': 'Categoría anterior (texto libre): «{text}». Elige una categoría de la lista; si no, se conserva el texto libre.',
    'articles.catLink': 'Ver todo en esta categoría',
    'articles.codePath': 'Código legible {code}',
    'articles.legacyCats': 'Categorías anteriores (texto libre)',
    'articles.det.title': 'Fotos originales del análisis de fotos',
    'articles.det.intro': 'La entrada se reconoció a partir de estas fotos. Toca la foto para ampliarla.',
    'articles.det.file': 'Archivo',
    'articles.det.place': 'Tomada en',
    'articles.det.conf': 'Seguridad',
    'articles.det.source': 'Origen',
    'articles.det.as': 'Reconocido como',
    'articles.det.qty': 'Cantidad contada',
    'articles.det.qtyUncertain': '(incierta)',
    'articles.det.zoom': 'Ampliar la foto «{name}»',
  },
});

// ---------------------------------------------------------------------------
// Konstanten und private Hilfen
// ---------------------------------------------------------------------------
const UNITS = ['Stk', 'm', 'm²', 'kg', 'l', 'Rolle', 'Pkg', 'Paar', 'Set'];
const DECIMAL_UNITS = new Set(['m', 'm²', 'kg', 'l']);
const PAGE_SIZE = 200;          // so viele Zeilen rendert die Liste auf einmal (Handy)
const MV_LIMIT = 100;           // Bewegungen beim ersten Laden
const MV_LIMIT_ALL = 2000;
const OLD_LOC_PREFIX = 'Ort (alt): ';   // fester Text in den Daten (nicht übersetzt)

const enc = encodeURIComponent;
const norm = (s) => clean(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const hkey = (s) => norm(s).replace(/[^a-z0-9]/g, '');
const isDec = (unit) => DECIMAL_UNITS.has(unit);
const round3 = (n) => Math.round(Number(n) * 1000) / 1000;
const multi = (v) => { const s = String(v ?? '').replace(/\r\n?/g, '\n').trim(); return s === '' ? null : s; };
const hasValue = (v) => v !== null && v !== undefined && v !== '';
const plural = (base, n) => t(n === 1 ? base + '1' : base + 'N', { n });
function cmp(a, b) {
  return new Intl.Collator(locale(), { numeric: true, sensitivity: 'base' }).compare(String(a ?? ''), String(b ?? ''));
}

function routeCode(ctx) {
  let c = (ctx.params && ctx.params.code) || '';
  try { c = decodeURIComponent(c); } catch (e) { /* bereits dekodiert */ }
  return clean(c).toUpperCase();
}
// ctx.query kann ein Objekt oder URLSearchParams sein; zur Sicherheit auch aus dem Hash lesen
function queryParam(ctx, key) {
  const q = ctx.query;
  if (q) {
    if (typeof q.get === 'function') { const v = q.get(key); if (v !== null && v !== undefined) return v; }
    else if (q[key] !== undefined && q[key] !== null) return q[key];
  }
  try {
    const h = window.location.hash || '';
    const i = h.indexOf('?');
    if (i >= 0) return new URLSearchParams(h.slice(i + 1)).get(key);
  } catch (e) { /* egal */ }
  return null;
}

const loadingHtml = () => `<div class="page"><p class="muted" role="status">${esc(t('common.loading'))}</p></div>`;
function showError(ctx, err) {
  toast(errorText(err), 'error');
  ctx.el.innerHTML = `<div class="page">${emptyHtml(errorText(err),
    `<button type="button" class="btn" data-retry>${icon('history')}${esc(t('btn.retry'))}</button>`)}</div>`;
  const b = ctx.el.querySelector('[data-retry]');
  if (b) b.addEventListener('click', () => ctx.reload());
}
function showNotFound(ctx, code) {
  ctx.el.innerHTML = `<div class="page">${emptyHtml(t('articles.notFound', { code }),
    `<a class="btn" href="#/artikel">${icon('back')}${esc(t('articles.toList'))}</a>`)}</div>`;
}
function setErr(root, msg) {
  const b = root.querySelector('[data-err]');
  if (!b) return;
  b.textContent = msg || '';
  b.hidden = !msg;
}
// Enter in einem Eingabefeld eines Dialogs = Hauptaktion
function enterSubmits(el) {
  el.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || !e.target.matches('input')) return;
    e.preventDefault();
    const b = el.querySelector('.sheet-actions .btn.primary');
    if (b && !b.disabled) b.click();
  });
}

// Etiketten / QR / Fotos: Module des Leads, defensiv aufgerufen
function printLabels(makeItems) {
  try {
    const r = labels.openLabelDialog(makeItems());
    if (r && typeof r.catch === 'function') r.catch((err) => toast(errorText(err), 'error'));
  } catch (err) { toast(errorText(err), 'error'); }
}
async function fillQr(box, code) {
  try {
    if (typeof labels.ensureQrLib === 'function') await labels.ensureQrLib();
    const svg = await labels.qrSvg(labels.qrUrl(code), { margin: 1 });
    if (!svg) return;
    box.classList.remove('thumb-empty');
    box.style.background = '#fff';
    box.style.padding = '5px';
    box.innerHTML = svg;
    const s = box.querySelector('svg');
    if (s) { s.setAttribute('width', '100%'); s.setAttribute('height', '100%'); s.setAttribute('aria-hidden', 'true'); s.setAttribute('focusable', 'false'); }
  } catch (e) { /* QR ist nur Anzeige */ }
}
function mountMedia(container, opts) {
  try {
    if (!container || typeof media.mediaSection !== 'function') return;
    const r = media.mediaSection(container, opts);
    if (r && typeof r.catch === 'function') r.catch(() => { /* Fotos sind nicht kritisch */ });
  } catch (e) { /* Fotos sind nicht kritisch */ }
}

// ---------------------------------------------------------------------------
// Erweiterung «Lager organisieren»: Kategorie, Herstellerseite, Originalfotos
// ---------------------------------------------------------------------------
async function safeList(fn) {
  try { const r = await fn(); return Array.isArray(r) ? r : []; } catch (e) { return []; }
}
// Nur http/https als Link zulassen (Daten können aus einem Import stammen)
function safeUrl(v) {
  const s = String(v ?? '').trim();
  if (!s || /\s/.test(s)) return null;
  try {
    const u = new URL(s);
    return (u.protocol === 'http:' || u.protocol === 'https:') && u.hostname ? u.href : null;
  } catch (e) { return null; }
}
// «bosch.de/…» → «https://bosch.de/…»
function urlInput(v) {
  const s = clean(v);
  if (s && !/^[a-z][a-z0-9+.-]*:/i.test(s) && /^[\w-]+(\.[\w-]+)+(\/|$)/.test(s)) return 'https://' + s;
  return s;
}
function productLinkHtml(url) {
  const href = safeUrl(url);
  if (!href) return '';
  let host = href;
  try { host = new URL(href).hostname.replace(/^www\./, ''); } catch (e) { /* egal */ }
  return `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer nofollow">${esc(host)}</a>
    <div class="small muted" style="font-weight:400">${esc(t('articles.productHint'))}</div>`;
}
const catText = (a) => a.category_path || a.category || '';

// Originalfotos aus der Fotoanalyse (detection_overview) – zeigt, woher der Eintrag stammt
function detectionsHtml(list, name, unit) {
  const seen = new Set();
  const rows = list.filter((d) => d.photo_path && !seen.has(d.photo_id || d.photo_path) && seen.add(d.photo_id || d.photo_path));
  if (!rows.length) return '';
  const kv = (k, v) => (v ? `<dt>${esc(k)}</dt><dd>${v}</dd>` : '');
  const fig = (d, i) => {
    const hasPos = d.pos_x !== null && d.pos_x !== undefined && d.pos_y !== null && d.pos_y !== undefined
      && Number.isFinite(Number(d.pos_x)) && Number.isFinite(Number(d.pos_y));
    const px = hasPos ? Math.min(100, Math.max(0, Number(d.pos_x) * 100)) : 0;
    const py = hasPos ? Math.min(100, Math.max(0, Number(d.pos_y) * 100)) : 0;
    const qty = hasValue(d.quantity) && Number.isFinite(Number(d.quantity))
      ? `<span style="font-weight:500">${esc(fmtQty(Number(d.quantity), d.unit || unit))}${d.quantity_certain === false ? ` <span class="muted">${esc(t('articles.det.qtyUncertain'))}</span>` : ''}</span>` : '';
    return `<figure class="card" style="margin:0;padding:8px;display:flex;flex-direction:column;gap:8px">
      <button type="button" data-detzoom="${i}" aria-label="${esc(t('articles.det.zoom', { name: d.photo_file_name || name }))}"
        style="position:relative;display:block;width:100%;padding:0;border:0;background:none;cursor:zoom-in;border-radius:10px;overflow:hidden">
        <img data-path="${esc(d.photo_path)}" alt="" loading="lazy" style="display:block;width:100%;height:auto;min-height:120px;background:var(--surface-3)">
        ${hasPos ? `<span aria-hidden="true" style="position:absolute;left:${px}%;top:${py}%;width:26px;height:26px;margin:-13px 0 0 -13px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 0 2px var(--danger),0 1px 6px rgba(0,0,0,.5)"></span>` : ''}
      </button>
      <figcaption><dl class="kv left small" style="gap:4px 10px">
        ${kv(t('articles.det.file'), d.photo_file_name ? `<span style="font-weight:500;overflow-wrap:anywhere">${esc(d.photo_file_name)}</span>` : '')}
        ${kv(t('articles.det.place'), d.photo_location_path ? `<span style="font-weight:500">${esc(d.photo_location_path)}</span>` : '')}
        ${kv(t('articles.det.conf'), confidencePill(d.confidence))}
        ${kv(t('articles.det.source'), `<span style="font-weight:500">${esc(sourceLabel(d.source))}</span>`)}
        ${d.name && d.name !== name ? kv(t('articles.det.as'), `<span style="font-weight:500">${esc(d.name)}</span>`) : ''}
        ${kv(t('articles.det.qty'), qty)}
      </dl></figcaption>
    </figure>`;
  };
  return `<p class="hint" style="margin:0 0 8px">${esc(t('articles.det.intro'))}</p>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,240px),1fr));gap:12px">${rows.map(fig).join('')}</div>`;
}
function mountDetections(section, api, articleId, name, unit, ownPhoto) {
  if (!section || typeof api.listDetections !== 'function') return;
  Promise.resolve()
    .then(() => api.listDetections({ articleId }))
    .then((rows) => {
      if (!section.isConnected) return;
      const html = detectionsHtml(Array.isArray(rows) ? rows : [], name, unit);
      if (!html) return;   // von Hand erfasst → kein Abschnitt
      const box = section.querySelector('[data-det-body]');
      box.innerHTML = html;
      section.hidden = false;
      // Eintrag hat ein eigenes Bild (Anhang) → Originalfotos stehen eingeklappt darunter (nicht alles doppelt).
      // Ist das Hauptbild selbst ein Originalfoto, bleibt der Abschnitt offen: nur dort zeigt der Punkt, wo das Objekt steht.
      const cnt = section.querySelector('[data-det-count]');
      if (cnt) cnt.textContent = '(' + box.querySelectorAll('figure').length + ')';
      const more = section.querySelector('details.det-more');
      if (more) more.open = (Array.isArray(rows) ? rows : []).some((d) => d.photo_path && d.photo_path === ownPhoto);
      hydrateThumbs(box, api);
      box.addEventListener('click', (e) => {
        const b = e.target.closest('[data-detzoom]');
        const img = b && b.querySelector('img');
        if (img && img.src) openLightbox(img.src, name);
      });
    })
    .catch(() => { /* Originalfotos sind nicht kritisch */ });
}

// Alle bearbeitbaren Felder (nie stock, nie code) – damit ein Update nichts leert
function articlePayload(a) {
  const pick = (k) => (hasValue(a[k]) ? a[k] : null);
  return {
    id: a.id, name: a.name, description: pick('description'), art_no: pick('art_no'), category: pick('category'),
    brand: pick('brand'), model: pick('model'), size: pick('size'), color: pick('color'), usage: pick('usage'),
    label_text: pick('label_text'), unit: a.unit || 'Stk', min_stock: hasValue(a.min_stock) ? Number(a.min_stock) : null,
    location_id: pick('location_id'), notes: pick('notes'), archived: !!a.archived,
  };
}

// Mengenfeld mit −/+ (gross, für das Handy)
function qtyFieldHtml(id, value, unit, label) {
  return `<div class="field">
    <label for="${id}">${esc(label)} (${esc(unitLabel(unit) || unit)})</label>
    <div class="qty-stepper">
      <button type="button" class="btn" data-step="-1" aria-label="${esc(t('articles.qtyLess'))}">${icon('minus')}</button>
      <input id="${id}" name="qty" type="text" inputmode="${isDec(unit) ? 'decimal' : 'numeric'}" autocomplete="off" value="${esc(value)}">
      <button type="button" class="btn" data-step="1" aria-label="${esc(t('articles.qtyMore'))}">${icon('plus')}</button>
    </div>
  </div>`;
}
function readNum(v) { return numOrNull(String(v ?? '').replace(/[\s'’]/g, '')); }
function bindQty(root, { positive, onChange }) {
  const inp = root.querySelector('input[name=qty]');
  const changed = () => { if (onChange) onChange(readNum(inp.value)); };
  const set = (v) => { inp.value = String(round3(v)); changed(); };
  root.querySelectorAll('[data-step]').forEach((b) => b.addEventListener('click', () => {
    const cur = readNum(inp.value) ?? 0;
    let v = round3(cur + Number(b.dataset.step));
    if (positive && v <= 0) v = cur > 0 ? cur : 1;
    if (!positive && v < 0) v = 0;
    set(v);
  }));
  root.querySelectorAll('[data-quick]').forEach((b) => b.addEventListener('click', () => set(Number(b.dataset.quick))));
  inp.addEventListener('input', changed);
  inp.addEventListener('focus', () => { try { inp.select(); } catch (e) { /* egal */ } });
  changed();
  return () => readNum(inp.value);
}
function checkQty(n, unit, allowZero) {
  if (n === null || !Number.isFinite(n) || n < 0 || (!allowZero && n === 0)) return t('err.invalid_qty');
  if (!isDec(unit) && !Number.isInteger(n)) return t('articles.wholeNumber');
  return '';
}
const signed = (n, unit) => (n > 0 ? '+' : n < 0 ? '−' : '±') + fmtQty(Math.abs(n), unit);

// ---------------------------------------------------------------------------
// Liste
// ---------------------------------------------------------------------------
const listState = { q: '', cat: '', low: false, archived: false, limit: PAGE_SIZE };

async function listView(ctx) {
  const { api, user } = ctx;
  const staff = can(user, 'staff');
  ctx.setTitle(t('articles.title'));
  if (queryParam(ctx, 'filter') === 'low' || queryParam(ctx, 'low')) listState.low = true;
  const qq = queryParam(ctx, 'q');
  if (qq) listState.q = String(qq);
  const qk = queryParam(ctx, 'kat');
  if (qk) listState.cat = String(qk);
  listState.limit = PAGE_SIZE;

  ctx.el.innerHTML = loadingHtml();
  let rows, catRows;
  try {
    [rows, catRows] = await Promise.all([
      api.listArticles({ includeArchived: staff }),
      safeList(() => api.listCategories({})),
    ]);
    rows = rows || [];
  } catch (err) { showError(ctx, err); return; }

  const hay = new Map(rows.map((r) => [r, norm([r.name, r.code, r.art_no, r.brand, r.model, r.category, r.category_path,
    r.location_path, r.location_code_path, r.size, r.label_text].join(' '))]));
  // Kategorie-Filter: Kategorien aus der Liste (inkl. Unterkategorien) + bisherige Freitexte ohne category_id
  const cats = [...new Set(rows.filter((r) => !r.category_id).map((r) => clean(r.category)).filter(Boolean))].sort(cmp);
  const catValues = new Set([...catRows.map((c) => c.id), ...cats.map((c) => 'txt:' + c)]);
  if (listState.cat && !catValues.has(listState.cat)) listState.cat = '';
  const catSubtree = () => (listState.cat && !listState.cat.startsWith('txt:') ? categorySubtreeIds(catRows, listState.cat) : null);
  const lowCount = rows.filter((r) => r.low_stock && !r.archived).length;

  ctx.el.innerHTML = `<div class="page">
    <div class="page-head">
      <div><h1>${esc(t('articles.title'))}</h1><div class="sub" data-count aria-live="polite"></div></div>
      ${staff ? `<div class="actions">
        <a class="btn primary" href="#/artikel/neu">${icon('plus')}${esc(t('articles.new'))}</a>
        <button type="button" class="btn" data-export>${icon('download')}${esc(t('btn.export'))}</button>
        <button type="button" class="btn" data-import>${icon('file')}${esc(t('articles.import'))}</button>
        <input type="file" data-file accept=".json,.csv,application/json,text/csv" hidden>
      </div>` : ''}
    </div>
    <div class="filters">
      <div class="searchbar" style="flex:1 1 240px">${icon('search')}<input type="search" data-q value="${esc(listState.q)}"
        aria-label="${esc(t('articles.searchLabel'))}" placeholder="${esc(t('articles.searchPh'))}" autocomplete="off" enterkeyhint="search"></div>
      ${catRows.length || cats.length ? `<select data-cat aria-label="${esc(t('articles.categoryLabel'))}" style="flex:1 1 180px;max-width:100%">
        ${catRows.length ? categoryOptionsHtml(catRows, listState.cat || null, { emptyLabel: t('articles.allCategories') }) : `<option value="">${esc(t('articles.allCategories'))}</option>`}
        ${cats.length ? `<optgroup label="${esc(t('articles.legacyCats'))}">
          ${cats.map((c) => `<option value="${esc('txt:' + c)}"${'txt:' + c === listState.cat ? ' selected' : ''}>${esc(c)}</option>`).join('')}
        </optgroup>` : ''}
      </select>` : ''}
      ${staff ? `<label class="check"><input type="checkbox" data-arch${listState.archived ? ' checked' : ''}>${esc(t('common.showArchived'))}</label>` : ''}
      <div class="chips" role="group" aria-label="${esc(t('articles.filterLabel'))}">
        <button type="button" class="chip" data-low="0" aria-pressed="${!listState.low}">${esc(t('articles.chipAll'))}</button>
        <button type="button" class="chip" data-low="1" aria-pressed="${listState.low}">${esc(t('articles.chipLow'))}${lowCount ? ` (${lowCount})` : ''}</button>
      </div>
    </div>
    <div class="stack" data-list></div>
  </div>`;
  const root = ctx.el.firstElementChild;
  const listEl = root.querySelector('[data-list]');
  const countEl = root.querySelector('[data-count]');

  const filtered = () => {
    const words = norm(listState.q).split(' ').filter(Boolean);
    const sub = catSubtree();
    const txt = listState.cat.startsWith('txt:') ? listState.cat.slice(4) : null;
    return rows.filter((r) => {
      if (r.archived && !(staff && listState.archived)) return false;
      if (sub && !sub.has(r.category_id)) return false;
      if (txt !== null && (r.category_id || clean(r.category) !== txt)) return false;
      if (listState.low && !r.low_stock) return false;
      if (words.length) { const h = hay.get(r); return words.every((w) => h.includes(w)); }
      return true;
    });
  };
  const rowHtml = (r) => `<a class="list-item" href="#/a/${enc(r.code)}">
      ${thumbHtml(r.photo_path, '', 'thumb', 'box')}
      <div class="li-main">
        <span class="li-title">${esc(r.name)}${r.size ? ` <span class="muted">· ${esc(r.size)}</span>` : ''}</span>
        <span class="li-sub">${esc(r.code)}${r.location_path ? ' · ' + esc(r.location_path) : ''}</span>
        ${catText(r) ? `<span class="li-sub">${esc(catText(r))}</span>` : ''}
      </div>
      <div class="li-end">
        <span class="nowrap" style="font-size:18px;font-weight:750;font-variant-numeric:tabular-nums">${esc(fmtQty(r.stock, r.unit))}</span>
        ${r.low_stock ? `<span class="pill pill-danger">${esc(t('articles.low'))}</span>` : ''}
        ${r.archived ? `<span class="pill pill-muted">${esc(t('common.archived'))}</span>` : ''}
      </div>
    </a>`;

  let current = [];
  const render = (focusIndex) => {
    current = filtered();
    const lowShown = current.filter((r) => r.low_stock).length;
    countEl.textContent = plural('articles.count', current.length) + (lowShown && !listState.low ? ' · ' + t('articles.countLow', { n: lowShown }) : '');
    if (!current.length) {
      listEl.innerHTML = emptyHtml(rows.length ? t('articles.empty') : t('articles.emptyAll'),
        staff && !rows.length ? `<a class="btn primary" href="#/artikel/neu">${icon('plus')}${esc(t('articles.new'))}</a>` : '');
      return;
    }
    const shown = current.slice(0, listState.limit);
    const rest = current.length - shown.length;
    listEl.innerHTML = `<div class="list">${shown.map(rowHtml).join('')}</div>
      ${rest > 0 ? `<button type="button" class="btn" data-more>${esc(t('articles.showMore', { n: rest }))}</button>` : ''}`;
    hydrateThumbs(listEl, api);
    if (focusIndex !== undefined) { const a = listEl.querySelectorAll('a.list-item')[focusIndex]; if (a) a.focus(); }
  };
  render();

  const qInput = root.querySelector('[data-q]');
  const onSearch = debounce(() => { listState.q = qInput.value; listState.limit = PAGE_SIZE; render(); }, 150);
  qInput.addEventListener('input', onSearch);
  qInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); listState.q = qInput.value; render(); } });
  const catSel = root.querySelector('[data-cat]');
  if (catSel) catSel.addEventListener('change', () => { listState.cat = catSel.value; listState.limit = PAGE_SIZE; render(); });
  const arch = root.querySelector('[data-arch]');
  if (arch) arch.addEventListener('change', () => { listState.archived = arch.checked; listState.limit = PAGE_SIZE; render(); });
  root.querySelectorAll('[data-low]').forEach((b) => b.addEventListener('click', () => {
    listState.low = b.dataset.low === '1';
    listState.limit = PAGE_SIZE;
    root.querySelectorAll('[data-low]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    render();
  }));
  listEl.addEventListener('click', (e) => {
    if (!e.target.closest('[data-more]')) return;
    const prev = listState.limit;
    listState.limit += PAGE_SIZE;
    render(prev);
  });

  if (staff) {
    root.querySelector('[data-export]').addEventListener('click', () => exportCsv(current));
    const file = root.querySelector('[data-file]');
    root.querySelector('[data-import]').addEventListener('click', () => file.click());
    file.addEventListener('change', async () => {
      const f = file.files && file.files[0];
      file.value = '';
      if (f) await importFlow(ctx, f);
    });
  }
}

function exportCsv(list) {
  const head = ['articles.f.code', 'articles.f.name', 'articles.f.size', 'articles.f.category', 'articles.f.brand',
    'articles.f.model', 'articles.f.artNo', 'articles.f.color', 'articles.f.stock', 'articles.f.unit', 'articles.f.minStock',
    'articles.chipLow', 'articles.f.location', 'articles.f.usage', 'articles.f.description', 'articles.f.labelText',
    'articles.f.notes', 'common.archived'].map((k) => t(k));
  const val = (v) => (hasValue(v) ? v : '');
  const data = list.map((r) => [
    r.code, r.name, val(r.size), val(catText(r)), val(r.brand), val(r.model), val(r.art_no), val(r.color),
    val(r.stock), unitLabel(r.unit), val(r.min_stock), r.low_stock ? t('common.yes') : '', val(r.location_path),
    val(r.usage), val(r.description), val(r.label_text), val(r.notes), r.archived ? t('common.yes') : '',
  ]);
  downloadCsv(`${t('articles.exportFile')}-${today()}.csv`, [head, ...data]);
}

// ---------------------------------------------------------------------------
// Import aus der bisherigen Etiketten-App (inventario.json oder CSV mit denselben Spalten)
// ---------------------------------------------------------------------------
const IMPORT_ALIASES = {
  code: ['id', 'code', 'codigo'],
  name: ['name', 'nombre', 'nome', 'producto', 'produto', 'articulo', 'artigo', 'bezeichnung', 'artikel', 'item', 'designacao'],
  short: ['short', 'textoetiqueta', 'etiqueta', 'kurztext', 'labeltext', 'etikettentext', 'textodaetiqueta', 'textodelaetiqueta'],
  size: ['size', 'tamano', 'tamanho', 'medida', 'grosse', 'groesse', 'lange', 'laenge', 'dimensao'],
  category: ['category', 'categoria', 'kategorie'],
  location: ['location', 'locationid', 'locationpath', 'ubicacion', 'lugar', 'localizacao', 'standort', 'ort', 'lagerort'],
  use: ['use', 'usage', 'uso', 'paraquesirve', 'verwendung', 'zweck', 'utilizacao'],
  details: ['details', 'detalles', 'detalhes', 'specs', 'description', 'beschreibung', 'descripcion', 'descricao'],
  color: ['color', 'colour', 'farbe', 'cor'],
  brand: ['brand', 'marca', 'proveedor', 'fornecedor', 'marke', 'hersteller', 'lieferant'],
  model: ['model', 'modell', 'modelo'],
  art: ['art', 'artno', 'artnr', 'artikelnr', 'artikelnummer', 'narticulo', 'noarticulo', 'numeroarticulo', 'nartculo',
    'ndearticulo', 'nodearticulo', 'sku', 'itemno', 'referencia', 'ref'],
  qty: ['qty', 'quantity', 'cantidad', 'quantidade', 'menge', 'anzahl', 'stock', 'bestand', 'lagerbestand', 'anfangsbestand'],
  min: ['min', 'minstock', 'minimo', 'stockminimo', 'mindestbestand', 'avisarsibajade'],
  notes: ['notes', 'notas', 'notizen', 'bemerkung', 'bemerkungen', 'observaciones', 'observacoes'],
  unit: ['unit', 'einheit', 'unidad', 'unidade'],
};
// Spaltentitel des eigenen Exports (aktuelle Sprache) werden ebenfalls erkannt
const EXPORT_LABELS = {
  code: 'articles.f.code', name: 'articles.f.name', short: 'articles.f.labelText', size: 'articles.f.size',
  category: 'articles.f.category', location: 'articles.f.location', use: 'articles.f.usage', details: 'articles.f.description',
  color: 'articles.f.color', brand: 'articles.f.brand', model: 'articles.f.model', art: 'articles.f.artNo',
  qty: 'articles.f.stock', min: 'articles.f.minStock', notes: 'articles.f.notes', unit: 'articles.f.unit',
};
function headerMap() {
  const m = new Map();
  for (const [f, list] of Object.entries(IMPORT_ALIASES)) for (const k of list) m.set(k, f);
  for (const [f, key] of Object.entries(EXPORT_LABELS)) { const k = hkey(t(key)); if (k && !m.has(k)) m.set(k, f); }
  return m;
}
function parseCsv(text) {
  const first = text.split(/\r?\n/, 1)[0] || '';
  const count = (ch) => first.split(ch).length - 1;
  const delim = [';', '\t', ','].sort((x, y) => count(y) - count(x))[0];
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === delim) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}
function parseImportFile(text, fileName) {
  text = String(text || '').replace(/^﻿/, '');
  const hmap = headerMap();
  if (/\.json$/i.test(fileName) || /^\s*[[{]/.test(text)) {
    const d = JSON.parse(text);
    const arr = Array.isArray(d) ? d : (d && Array.isArray(d.items) ? d.items : null);
    if (!arr) throw new Error('format');
    return arr.filter((o) => o && typeof o === 'object').map((o) => {
      const raw = {};
      for (const [k, v] of Object.entries(o)) {
        const f = hmap.get(hkey(k));
        if (f && !hasValue(raw[f])) raw[f] = v === null || v === undefined ? '' : String(v);
      }
      return raw;
    });
  }
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const keys = rows[0].map((h) => hmap.get(hkey(h)) || null);
  if (!keys.includes('name') && !keys.includes('short')) throw new Error('format');
  return rows.slice(1).map((r) => {
    const raw = {};
    keys.forEach((k, i) => { if (k && r[i] !== undefined && !hasValue(raw[k])) raw[k] = r[i]; });
    return raw;
  });
}
function resolveUnit(v) {
  const n = norm(v);
  if (!n) return 'Stk';
  return UNITS.find((u) => norm(u) === n || norm(unitLabel(u)) === n) || 'Stk';
}
function locationIndex(locs) {
  const m = new Map();
  for (const l of locs) for (const k of [l.id, l.code, l.path]) {
    if (!k) continue;
    const nk = norm(k);
    if (!m.has(nk)) m.set(nk, l);
  }
  return m;
}
function toArticle(raw, locIdx) {
  const one = (k) => clean(raw[k]);
  const name = one('name') || one('short');
  const code = one('code').toUpperCase().replace(/\s+/g, '');
  let notes = multi(raw.notes);
  let locationId = null;
  let oldLoc = false;
  const locText = one('location');
  if (locText) {
    const l = locIdx.get(norm(locText));
    if (l) locationId = l.id;
    else { oldLoc = true; notes = notes ? `${notes}\n${OLD_LOC_PREFIX}${locText}` : OLD_LOC_PREFIX + locText; }
  }
  let stock = readNum(raw.qty);
  if (stock === null || stock < 0) stock = 0;
  let min = readNum(raw.min);
  if (min !== null && min < 0) min = null;
  const obj = {
    name,
    description: multi(raw.details),
    art_no: nullIfEmpty(raw.art),
    category: nullIfEmpty(raw.category),
    brand: nullIfEmpty(raw.brand),
    model: nullIfEmpty(raw.model),
    size: nullIfEmpty(raw.size),
    color: nullIfEmpty(raw.color),
    usage: multi(raw.use),
    label_text: nullIfEmpty(raw.short),
    unit: resolveUnit(raw.unit),
    stock: round3(stock),
    min_stock: min === null ? null : round3(min),
    location_id: locationId,
    notes,
  };
  if (code) obj.code = code;
  return { obj, code, name, oldLoc };
}

async function importFlow(ctx, file) {
  const { api } = ctx;
  let items;
  try { items = parseImportFile(await file.text(), file.name || ''); } catch (e) { toast(t('articles.imp.badFile'), 'error'); return; }
  if (!items.length) { toast(t('articles.imp.badFile'), 'error'); return; }

  let existing, locs;
  try {
    [existing, locs] = await Promise.all([api.listArticles({ includeArchived: true }), api.listLocations({ includeArchived: true })]);
  } catch (err) { toast(errorText(err), 'error'); return; }
  const existingCodes = new Set((existing || []).map((a) => String(a.code || '').toUpperCase()));
  const locIdx = locationIndex(locs || []);

  const create = [];
  const exists = [];
  const dupInFile = [];
  let noName = 0;
  let oldLoc = 0;
  const seen = new Set();
  for (const raw of items) {
    const a = toArticle(raw, locIdx);
    if (!a.name) { noName++; continue; }
    if (a.code) {
      if (existingCodes.has(a.code)) { exists.push(a.code); continue; }
      if (seen.has(a.code)) { dupInFile.push(a.code); continue; }
      seen.add(a.code);
    }
    if (a.oldLoc) oldLoc++;
    create.push(a);
  }
  // Zuerst die mit festem Code, dann die automatischen (sonst könnte ein neuer automatischer Code kollidieren)
  const order = [...create.filter((a) => a.code), ...create.filter((a) => !a.code)];

  const line = (key, n) => (n ? `<li>${esc(t(key, { n }))}</li>` : '');
  const body = `<div class="stack">
    <p><b>${esc(t('articles.imp.intro', { file: file.name || '', n: items.length }))}</b></p>
    <ul class="stack" style="margin:0;padding-left:20px;gap:4px">
      <li>${esc(t('articles.imp.new', { n: order.length }))}</li>
      ${line('articles.imp.exists', exists.length)}
      ${line('articles.imp.dupInFile', dupInFile.length)}
      ${line('articles.imp.noName', noName)}
      ${line('articles.imp.oldLoc', oldLoc)}
    </ul>
    <div class="alert">${icon('label')}<span>${esc(t('articles.imp.codesKept'))}</span></div>
    ${order.length ? '' : `<p class="muted">${esc(t('articles.imp.nothing'))}</p>`}
    <p class="muted small" data-progress aria-live="polite"></p>
  </div>`;

  const result = await sheet({
    title: t('articles.imp.title'),
    body,
    actions: order.length ? [
      { label: t('btn.cancel'), kind: 'ghost', value: false },
      {
        label: t('articles.imp.start'), kind: 'primary', icon: 'arrowIn',
        onClick: async (el) => {
          const prog = el.querySelector('[data-progress]');
          let ok = 0;
          let aborted = 0;
          const failed = [];
          const lateExists = [];
          for (let i = 0; i < order.length; i++) {
            prog.textContent = t('articles.imp.progress', { i: i + 1, n: order.length });
            try {
              await api.saveArticle(order[i].obj);
              ok++;
            } catch (err) {
              if (err && err.code === 'network') { aborted = order.length - i; break; }
              if (err && err.code === 'duplicate_code' && order[i].code) lateExists.push(order[i].code);
              else failed.push({ label: order[i].code || order[i].name, msg: errorText(err) });
            }
          }
          return { ok, aborted, failed, lateExists };
        },
      },
    ] : [{ label: t('btn.close'), kind: 'primary', value: false }],
  });
  if (!result || typeof result !== 'object') return;

  const allExists = [...exists, ...result.lateExists];
  const codes = allExists.slice(0, 40).join(', ') + (allExists.length > 40 ? ' …' : '');
  const summary = `<div class="stack">
    <p><b>${esc(t('articles.imp.done', { n: result.ok }))}</b></p>
    ${allExists.length ? `<p>${esc(t('articles.imp.exists', { n: allExists.length }))}</p>
      <p class="small muted" style="overflow-wrap:anywhere">${esc(t('articles.imp.existsCodes', { codes }))}</p>` : ''}
    ${dupInFile.length ? `<p>${esc(t('articles.imp.dupInFile', { n: dupInFile.length }))}</p>` : ''}
    ${noName ? `<p>${esc(t('articles.imp.noName', { n: noName }))}</p>` : ''}
    ${oldLoc && result.ok ? `<p class="small muted">${esc(t('articles.imp.oldLoc', { n: oldLoc }))}</p>` : ''}
    ${result.failed.length ? `<p>${esc(t('articles.imp.failed', { n: result.failed.length }))}</p>
      <ul class="small" style="margin:0;padding-left:20px">${result.failed.slice(0, 30).map((f) =>
        `<li>${esc(f.label)}: ${esc(f.msg)}</li>`).join('')}</ul>` : ''}
    ${result.aborted ? `<div class="alert warn">${icon('alert')}<span>${esc(t('articles.imp.aborted', { n: result.aborted }))}</span></div>` : ''}
  </div>`;
  if (result.ok) ctx.reload();
  await sheet({ title: t('articles.imp.doneTitle'), body: summary, actions: [{ label: t('btn.close'), kind: 'primary', value: true }] });
}

// ---------------------------------------------------------------------------
// Artikelkarte (nach dem Scannen)
// ---------------------------------------------------------------------------
async function cardView(ctx) {
  const { api, user } = ctx;
  const code = routeCode(ctx);
  const active = can(user);
  const staff = can(user, 'staff');
  const admin = can(user, 'admin');
  ctx.setTitle(code || t('articles.title'));
  ctx.el.innerHTML = loadingHtml();

  let a;
  let movements = [];
  let mvErr = null;
  let loc = null;
  try {
    a = await api.getArticleByCode(code);
    if (a) {
      [movements, loc] = await Promise.all([
        api.listMovements({ articleId: a.id, limit: MV_LIMIT }).catch((err) => { mvErr = err; return []; }),
        a.location_id ? api.getLocation(a.location_id).catch(() => null) : Promise.resolve(null),
      ]);
    }
  } catch (err) { showError(ctx, err); return; }
  if (!a) { showNotFound(ctx, code); return; }
  ctx.setTitle(a.name);
  let shopEntry = null, consRow = null;
  if (active && !a.archived) {
    const [shop, cons] = await Promise.all([api.listShopping({ status: 'open' }).catch(() => []), api.listConsumption().catch(() => [])]);
    shopEntry = (shop || []).find((x) => x.article_id === a.id) || null;
    consRow = consumptionMap(cons).get(a.id) || null;
  }
  const cover = coverText(coverDays(a, consRow));

  const stock = Number(a.stock) || 0;
  const low = !!a.low_stock;
  const hasMin = hasValue(a.min_stock);
  const canMove = active && !a.archived;

  // Details
  const locText = a.location_path || (loc && (loc.path || loc.name)) || '';
  const codePath = a.location_code_path || (loc && loc.code_path) || '';
  const locHtml = locText
    ? (loc && loc.code ? `<a href="#/l/${enc(loc.code)}">${esc(locText)}</a>` : esc(locText))
      + (codePath ? `<div class="small muted mono" style="font-weight:400">${esc(t('articles.codePath', { code: codePath }))}</div>` : '')
    : '<span class="muted">–</span>';
  const kv = [[t('articles.f.location'), locHtml]];
  const product = productLinkHtml(a.product_url);
  if (product) kv.push([t('articles.f.productUrl'), product]);
  const brandModel = [a.brand, a.model].map(clean).filter(Boolean).join(' / ');
  if (brandModel) kv.push([t('articles.f.brandModel'), esc(brandModel)]);
  if (a.art_no) kv.push([t('articles.f.artNo'), esc(a.art_no)]);
  if (a.size) kv.push([t('articles.f.size'), esc(a.size)]);
  if (a.color) kv.push([t('articles.f.color'), esc(a.color)]);
  kv.push([t('articles.f.unit'), esc(unitLabel(a.unit))]);
  if (a.label_text) kv.push([t('articles.f.labelText'), esc(a.label_text)]);
  const longs = [['articles.f.usage', a.usage], ['articles.f.description', a.description], ['articles.f.notes', a.notes]]
    .filter(([, v]) => clean(v));

  const hero = a.photo_path
    ? thumbHtml(a.photo_path, t('articles.photoAlt', { name: a.name }), 'thumb lg', 'box')
    : `<div class="thumb lg thumb-empty" data-qr role="img" aria-label="${esc(t('articles.qrAlt', { code: a.code }))}">${icon('label')}</div>`;

  ctx.el.innerHTML = `<div class="page">
    <a class="back-link" href="#/artikel">${icon('back')}${esc(t('articles.title'))}</a>
    <div class="card stack">
      <div class="machine-hero">
        <div data-hero>${hero}</div>
        <div>
          <h1>${esc(a.name)}</h1>
          <div class="code mono">${esc(a.code)}${a.size ? ' · ' + esc(a.size) : ''}</div>
          <div class="row">
            ${catText(a) ? (a.category_id
              ? `<a class="pill" href="#/suche?kat=${enc(a.category_id)}" title="${esc(t('articles.catLink'))}" style="white-space:normal">${esc(catText(a))}</a>`
              : `<span class="pill">${esc(catText(a))}</span>`) : ''}
            ${a.archived ? `<span class="pill pill-muted">${esc(t('common.archived'))}</span>` : ''}
          </div>
        </div>
      </div>
      <div class="usage-box" style="margin-top:4px">
        <div class="muted small">${esc(t('articles.stockNow'))}</div>
        <div class="row" style="align-items:baseline;gap:12px">
          <span style="font-size:44px;font-weight:750;line-height:1.05;font-variant-numeric:tabular-nums">${esc(fmtQty(stock, a.unit))}</span>
          ${low ? `<span class="pill pill-danger">${esc(t('articles.low'))}</span>` : ''}
        </div>
        ${hasMin ? `<div class="muted" style="margin-top:4px">${esc([t('articles.minStockLine', { qty: fmtQty(a.min_stock, a.unit) }),
          hasValue(a.reorder_qty) ? t('articles.reorderLine', { qty: fmtQty(a.reorder_qty, a.unit) }) : ''].filter(Boolean).join(' · '))}</div>` : ''}
        ${cover ? `<div class="muted small" style="margin-top:2px" title="${esc(t('cover.title', { takes: fmtNum(consRow.takes_90d), used: fmtQty(consRow.used_90d, a.unit), days: fmtNum(coverSpanDays(a)) }))}">${icon('clock')} ${esc(cover)}</div>` : ''}
      </div>
      ${low ? `<div class="alert warn">${icon('alert')}<span>${esc(t('articles.lowAlert', { qty: fmtQty(a.min_stock, a.unit) }))}</span></div>` : ''}
      ${a.archived ? `<div class="alert">${icon('box')}<span>${esc(t('articles.archivedNote'))}</span></div>` : ''}
    </div>

    ${canMove ? `<div class="big-action">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <button type="button" class="btn primary block" data-act="entnahme">${icon('minus')}${esc(t('articles.take'))}</button>
        <button type="button" class="btn block" data-act="zugang">${icon('plus')}${esc(t('articles.add'))}</button>
      </div>
      <div style="margin-top:10px">${shopEntry
        ? `<a class="btn block" href="#/einkauf">${icon('cart')}${esc(t('articles.onShop'))}${shopEntry.qty ? ' · ' + esc(fmtQty(shopEntry.qty, shopEntry.unit)) : ''}</a>`
        : `<button type="button" class="btn block" data-act="shop">${icon('cart')}${esc(t('articles.toShop'))}</button>`}</div>
    </div>` : ''}

    ${staff ? `<section class="section" aria-labelledby="art-manage-h">
      <h2 id="art-manage-h">${esc(t('articles.manage'))}</h2>
      <div class="row">
        ${!a.archived ? `<button type="button" class="btn sm" data-act="umlagerung">${icon('move')}${esc(t('articles.move'))}</button>
        <button type="button" class="btn sm" data-act="korrektur">${icon('clipboard')}${esc(t('articles.correct'))}</button>` : ''}
        <a class="btn sm" href="#/a/${enc(a.code)}/bearbeiten">${icon('edit')}${esc(t('btn.edit'))}</a>
        <a class="btn sm" href="#/artikel/neu?from=${enc(a.code)}">${icon('file')}${esc(t('btn.duplicate'))}</a>
        <button type="button" class="btn sm" data-act="label">${icon('print')}${esc(t('articles.printLabel'))}</button>
        <button type="button" class="btn sm" data-act="archive">${icon(a.archived ? 'history' : 'box')}${esc(t(a.archived ? 'btn.unarchive' : 'btn.archive'))}</button>
        ${admin ? `<button type="button" class="btn sm danger-outline" data-act="delete">${icon('trash')}${esc(t('btn.delete'))}</button>` : ''}
      </div>
    </section>` : ''}

    <section class="section" aria-labelledby="art-details-h">
      <h2 id="art-details-h">${esc(t('common.details'))}</h2>
      <div class="card stack">
        <dl class="kv">${kv.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join('')}</dl>
        ${longs.length ? '<div class="divider"></div>' : ''}
        ${longs.map(([k, v]) => `<div><div class="muted small">${esc(t(k))}</div>
          <div style="white-space:pre-line;overflow-wrap:anywhere">${esc(v)}</div></div>`).join('')}
      </div>
    </section>

    <section class="section" aria-labelledby="art-mv-h">
      <h2 id="art-mv-h">${esc(t('articles.movements'))}</h2>
      <div class="stack" data-mv></div>
    </section>

    <section class="section" aria-labelledby="art-det-h" data-det hidden>
      ${a.photo_path
    ? `<details class="det-more"><summary>${icon('chevron')}<h2 id="art-det-h">${esc(t('articles.det.title'))}</h2><span class="muted small" data-det-count></span></summary><div data-det-body></div></details>`
    : `<h2 id="art-det-h">${esc(t('articles.det.title'))}</h2>
      <div data-det-body></div>`}
    </section>

    <div data-usedfor hidden></div>
    <div data-media></div>
  </div>`;
  const root = ctx.el.firstElementChild;
  mountDetections(root.querySelector('[data-det]'), api, a.id, a.name, a.unit, a.photo_path);
  mountUsedFor(root.querySelector('[data-usedfor]'), ctx, a);

  // Hero: Foto (antippen = gross) oder QR-Code
  const qrBox = root.querySelector('[data-qr]');
  if (qrBox) fillQr(qrBox, a.code);
  Promise.resolve(hydrateThumbs(root, api)).then(() => {
    const img = root.querySelector('[data-hero] img[src]');
    if (img) { img.style.cursor = 'zoom-in'; img.addEventListener('click', () => openLightbox(img.src, a.name)); }
  });

  // Bewegungen
  const mvEl = root.querySelector('[data-mv]');
  const renderMv = (list, err, canMore) => {
    if (err) { mvEl.innerHTML = `<div class="alert danger">${icon('alert')}<span>${esc(t('articles.mv.error'))}</span></div>`; return; }
    mvEl.innerHTML = movementsHtml(list, a.unit)
      + (canMore ? `<div><button type="button" class="btn sm" data-mv-more>${icon('history')}${esc(t('articles.mv.more'))}</button></div>` : '');
    const more = mvEl.querySelector('[data-mv-more]');
    if (more) more.addEventListener('click', async () => {
      more.disabled = true;
      try {
        const all = await api.listMovements({ articleId: a.id, limit: MV_LIMIT_ALL });
        renderMv(all || [], null, false);
      } catch (e2) { toast(errorText(e2), 'error'); more.disabled = false; }
    });
  };
  renderMv(movements || [], mvErr, (movements || []).length >= MV_LIMIT);

  mountMedia(root.querySelector('[data-media]'), { ctx, entity: 'article', entityId: a.id, kinds: ['photo', 'document'] });

  // Aktionen
  root.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', async () => {
    const act = b.dataset.act;
    if (act === 'entnahme' || act === 'zugang') { if (await stockSheet(ctx, a, act)) ctx.reload(); }
    else if (act === 'umlagerung') { if (await moveSheet(ctx, a)) ctx.reload(); }
    else if (act === 'korrektur') { if (await correctSheet(ctx, a)) ctx.reload(); }
    else if (act === 'shop') {
      b.disabled = true;
      try {
        await api.saveShoppingItem({ article_id: a.id, qty: hasMin ? suggestQty(a) : (hasValue(a.reorder_qty) ? Number(a.reorder_qty) : null) });
        toast(t('articles.shopAdded', { name: a.name }));
        ctx.reload();
      } catch (err) { toast(errorText(err), 'error'); b.disabled = false; }
    }
    else if (act === 'label') printLabels(() => [labels.labelItem('article', a)]);
    else if (act === 'archive') await setArchived(ctx, a, !a.archived);
    else if (act === 'delete') await removeArticle(ctx, a);
  }));
}

function movementsHtml(list, unit) {
  if (!list.length) return emptyHtml(t('articles.mv.none'));
  const rows = list.map((m) => {
    const q = Number(m.qty) || 0;
    const u = m.unit || unit;
    const qty = (m.type === 'umlagerung' || q === 0)
      ? '<span class="muted">–</span>'
      : `<span style="color:var(${q > 0 ? '--ok' : '--danger'});font-weight:650">${esc(signed(q, u))}</span>`;
    const parts = [];
    if (m.type === 'umlagerung') parts.push(`${m.from_path || '–'} → ${m.to_path || '–'}`);
    else if (m.type === 'anlage' && m.to_path) parts.push(m.to_path);
    if (m.note) parts.push(m.note);
    return `<tr>
      <td>${esc(fmtDateTime(m.created_at))}</td>
      <td>${esc(t('mv.' + m.type))}</td>
      <td class="num">${qty}</td>
      <td class="num">${esc(fmtQty(m.stock_after, u))}</td>
      <td>${esc(m.user_name || '–')}</td>
      <td class="wrap">${parts.length ? esc(parts.join(' · ')) : '<span class="muted">–</span>'}</td>
    </tr>`;
  }).join('');
  return `<div class="table-wrap"><table class="table">
    <caption class="sr-only">${esc(t('articles.movements'))}</caption>
    <thead><tr>
      <th scope="col">${esc(t('articles.mv.date'))}</th>
      <th scope="col">${esc(t('articles.mv.type'))}</th>
      <th scope="col" class="num">${esc(t('articles.mv.qty'))}</th>
      <th scope="col" class="num">${esc(t('articles.mv.after'))}</th>
      <th scope="col">${esc(t('articles.mv.user'))}</th>
      <th scope="col">${esc(t('articles.mv.note'))}</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
}

// Entnahme / Zugang – für alle aktiven Mitarbeiter
function stockSheet(ctx, a, type) {
  const take = type === 'entnahme';
  const unit = a.unit;
  const stock = Number(a.stock) || 0;
  const requestId = uuid();   // einmal pro Dialog: Wiederholung = gleiche Buchung
  const body = `<div class="stack">
    <p class="muted" style="margin:0">${esc(t('articles.stockNow'))}: <b>${esc(fmtQty(stock, unit))}</b></p>
    ${qtyFieldHtml('mv-qty', '1', unit, t('articles.qty'))}
    <div class="chips" role="group" aria-label="${esc(t('articles.quick'))}">
      ${[1, 5, 10].map((n) => `<button type="button" class="chip" data-quick="${n}" aria-pressed="${n === 1}">${n}</button>`).join('')}
    </div>
    <p class="small" data-prev aria-live="polite" style="margin:0"></p>
    <div class="field">
      <label for="mv-note">${esc(t('articles.note'))}</label>
      <input id="mv-note" name="note" type="text" maxlength="500" autocomplete="off" placeholder="${esc(t('articles.notePh'))}">
    </div>
    <div class="alert danger" data-err role="alert" hidden></div>
  </div>`;
  let read = () => null;
  return sheet({
    title: t(take ? 'articles.takeTitle' : 'articles.addTitle', { name: a.name }),
    body,
    actions: [
      { label: t('btn.cancel'), kind: 'ghost', value: false },
      {
        label: t(take ? 'articles.takeBtn' : 'articles.addBtn'), kind: 'primary', icon: take ? 'minus' : 'plus',
        onClick: async (el) => {
          const n = read();
          const msg = checkQty(n, unit, false);
          if (msg) { setErr(el, msg); el.querySelector('#mv-qty').focus(); return false; }
          setErr(el, '');
          const note = nullIfEmpty(el.querySelector('#mv-note').value);
          const mv = await ctx.api.moveStock(a.id, { type, qty: round3(n), requestId, note });
          const after = mv && hasValue(mv.stock_after) ? Number(mv.stock_after) : round3(stock + (take ? -n : n));
          toast(t(take ? 'articles.toastTake' : 'articles.toastAdd', { qty: fmtQty(n, unit), stock: fmtQty(after, unit) }));
          return true;
        },
      },
    ],
    onOpen: (el) => {
      const prev = el.querySelector('[data-prev]');
      read = bindQty(el, {
        positive: true,
        onChange: (n) => {
          el.querySelectorAll('[data-quick]').forEach((c) => c.setAttribute('aria-pressed', String(Number(c.dataset.quick) === n)));
          if (n === null || !(n > 0)) { prev.textContent = ''; return; }
          const next = round3(stock + (take ? -n : n));
          prev.textContent = t('articles.newStock', { stock: fmtQty(next, unit) });
          prev.style.color = next < 0 ? 'var(--danger)' : '';
          prev.style.fontWeight = next < 0 ? '650' : '';
        },
      });
      enterSubmits(el);
    },
  }).then((v) => v === true);
}

// Umlagerung – Lagerverantwortliche
async function moveSheet(ctx, a) {
  let locs;
  try { locs = ((await ctx.api.listLocations({})) || []).filter((l) => !l.archived); }
  catch (err) { toast(errorText(err), 'error'); return false; }
  const requestId = uuid();
  const body = `<div class="stack">
    <dl class="kv"><dt>${esc(t('articles.moveCurrent'))}</dt><dd>${esc(a.location_path || '–')}</dd></dl>
    <div class="field">
      <label for="mv-loc">${esc(t('articles.moveTarget'))}</label>
      <select id="mv-loc" name="loc" aria-describedby="mv-loc-h">
        <option value="">${esc(t('articles.moveChoose'))}</option>
        ${locs.map((l) => `<option value="${esc(l.id)}"${l.id === a.location_id ? ' disabled' : ''}>${esc(l.path || l.name)}</option>`).join('')}
      </select>
      <div class="hint" id="mv-loc-h">${esc(t('articles.moveHint'))}</div>
    </div>
    <div class="field">
      <label for="mv-note">${esc(t('articles.note'))}</label>
      <input id="mv-note" name="note" type="text" maxlength="500" autocomplete="off">
    </div>
    <div class="alert danger" data-err role="alert" hidden></div>
  </div>`;
  return sheet({
    title: t('articles.moveTitle', { name: a.name }),
    body,
    actions: [
      { label: t('btn.cancel'), kind: 'ghost', value: false },
      {
        label: t('articles.moveBtn'), kind: 'primary', icon: 'move',
        onClick: async (el) => {
          const sel = el.querySelector('#mv-loc');
          const to = sel.value;
          if (!to) { setErr(el, t('articles.moveNeedTarget')); sel.focus(); return false; }
          if (to === a.location_id) { setErr(el, t('articles.moveSame')); return false; }
          setErr(el, '');
          const note = nullIfEmpty(el.querySelector('#mv-note').value);
          await ctx.api.moveStock(a.id, { type: 'umlagerung', qty: Number(a.stock) || 0, requestId, note, toLocationId: to });
          const target = locs.find((l) => l.id === to);
          toast(t('articles.toastMove', { path: target ? (target.path || target.name) : '' }));
          return true;
        },
      },
    ],
    onOpen: (el) => enterSubmits(el),
  }).then((v) => v === true);
}

// Korrektur (neuer absoluter Bestand + Begründung) – Lagerverantwortliche
function correctSheet(ctx, a) {
  const unit = a.unit;
  const stock = Number(a.stock) || 0;
  const requestId = uuid();
  const body = `<div class="stack">
    <p class="muted" style="margin:0">${esc(t('articles.stockNow'))}: <b>${esc(fmtQty(stock, unit))}</b></p>
    ${qtyFieldHtml('mv-qty', String(round3(stock)), unit, t('articles.correctNew'))}
    <p class="small" data-prev aria-live="polite" style="margin:0"></p>
    <div class="field">
      <label for="mv-reason">${esc(t('articles.correctReason'))} <span aria-hidden="true">*</span></label>
      <textarea id="mv-reason" name="reason" required aria-required="true" maxlength="500"
        placeholder="${esc(t('articles.correctReasonPh'))}"></textarea>
    </div>
    <p class="hint" style="margin:0">${esc(t('articles.correctHint'))}</p>
    <div class="alert danger" data-err role="alert" hidden></div>
  </div>`;
  let read = () => null;
  return sheet({
    title: t('articles.correctTitle', { name: a.name }),
    body,
    actions: [
      { label: t('btn.cancel'), kind: 'ghost', value: false },
      {
        label: t('articles.correctBtn'), kind: 'primary', icon: 'check',
        onClick: async (el) => {
          const n = read();
          const msg = checkQty(n, unit, true);
          if (msg) { setErr(el, msg); el.querySelector('#mv-qty').focus(); return false; }
          if (round3(n) === round3(stock)) { setErr(el, t('articles.correctSame')); return false; }
          const reasonEl = el.querySelector('#mv-reason');
          const reason = multi(reasonEl.value);
          if (!reason) { setErr(el, t('err.reason_required')); reasonEl.focus(); return false; }
          setErr(el, '');
          const mv = await ctx.api.moveStock(a.id, { type: 'korrektur', qty: round3(n), requestId, note: reason });
          const after = mv && hasValue(mv.stock_after) ? Number(mv.stock_after) : round3(n);
          toast(t('articles.toastCorrect', { from: fmtQty(stock, unit), to: fmtQty(after, unit) }));
          return true;
        },
      },
    ],
    onOpen: (el) => {
      const prev = el.querySelector('[data-prev]');
      read = bindQty(el, {
        positive: false,
        onChange: (n) => {
          if (n === null || n < 0) { prev.textContent = ''; return; }
          const d = round3(n - stock);
          prev.textContent = d ? t('articles.diff', { diff: signed(d, unit) }) : '';
          prev.style.color = d > 0 ? 'var(--ok)' : d < 0 ? 'var(--danger)' : '';
        },
      });
      enterSubmits(el);
    },
  }).then((v) => v === true);
}

async function setArchived(ctx, a, archived) {
  if (archived && !(await confirmSheet(t('articles.archiveQ'), t('articles.archiveMsg', { name: a.name }), { okLabel: t('btn.archive') }))) return;
  try {
    await ctx.api.saveArticle({ ...articlePayload(a), archived });
    toast(t(archived ? 'articles.archivedToast' : 'articles.unarchivedToast'));
    ctx.reload();
  } catch (err) { toast(errorText(err), 'error'); }
}

async function removeArticle(ctx, a) {
  if (!(await confirmSheet(t('articles.deleteQ'), t('articles.deleteMsg', { name: a.name }), { okLabel: t('btn.delete'), danger: true }))) return;
  try {
    await ctx.api.deleteArticle(a.id);
    toast(t('articles.deleted'));
    ctx.go('artikel');
  } catch (err) {
    if (!err || err.code !== 'in_use') { toast(errorText(err), 'error'); return; }
    if (a.archived) {
      await sheet({ title: t('articles.inUseTitle'), body: `<p>${esc(t('articles.inUseArchived'))}</p>`,
        actions: [{ label: t('btn.close'), kind: 'primary', value: true }] });
      return;
    }
    // Löschen nicht möglich, weil es Bewegungen gibt → Archivieren anbieten
    if (await confirmSheet(t('articles.inUseTitle'), t('articles.inUseMsg'), { okLabel: t('btn.archive') })) {
      try {
        await ctx.api.saveArticle({ ...articlePayload(a), archived: true });
        toast(t('articles.archivedToast'));
        ctx.reload();
      } catch (e2) { toast(errorText(e2), 'error'); }
    }
  }
}

// ---------------------------------------------------------------------------
// Formular (neu / bearbeiten / duplizieren) – nur Lagerverantwortliche
// ---------------------------------------------------------------------------
async function formView(ctx, mode) {
  const { api, user } = ctx;
  const isNew = mode === 'new';
  ctx.setTitle(t(isNew ? 'articles.newTitle' : 'articles.editTitle'));
  if (!can(user, 'staff')) {
    ctx.el.innerHTML = `<div class="page">${emptyHtml(t('err.not_authorized'),
      `<a class="btn" href="#/artikel">${icon('back')}${esc(t('articles.toList'))}</a>`)}</div>`;
    return;
  }
  const code = isNew ? '' : routeCode(ctx);
  const fromCode = isNew ? clean(queryParam(ctx, 'from') || '').toUpperCase() : '';
  ctx.el.innerHTML = loadingHtml();

  let found = null;
  let locs = [];
  let all = [];
  let catRows = [];
  try {
    [found, locs, all, catRows] = await Promise.all([
      isNew ? (fromCode ? api.getArticleByCode(fromCode) : Promise.resolve(null)) : api.getArticleByCode(code),
      api.listLocations({ includeArchived: true }),
      api.listArticles({ includeArchived: true }),
      safeList(() => api.listCategories({})),
    ]);
  } catch (err) { showError(ctx, err); return; }
  if (!isNew && !found) { showNotFound(ctx, code); return; }
  const art = isNew ? null : found;      // wird bearbeitet
  const src = isNew ? found : null;      // Vorlage beim Duplizieren
  const v = art || src || {};
  const val = (k) => (hasValue(v[k]) ? String(v[k]) : '');

  const cats = [...new Set((all || []).map((r) => clean(r.category)).filter(Boolean))].sort(cmp);
  const catId = v.category_id || null;
  const legacyCat = !catId && clean(v.category) ? clean(v.category) : '';
  const curLoc = v.location_id || '';
  const locOptions = (locs || []).filter((l) => !l.archived || l.id === curLoc)
    .sort((x, y) => cmp(x.path || x.name, y.path || y.name));
  const unit = v.unit || 'Stk';
  const units = UNITS.includes(unit) ? UNITS : [...UNITS, unit];
  const back = isNew ? (src ? `#/a/${enc(src.code)}` : '#/artikel') : `#/a/${enc(art.code)}`;

  const field = (name, label, { type = 'text', full = false, hint = '', attrs = '', value } = {}) => {
    const id = 'af-' + name;
    const hid = hint ? ` aria-describedby="${id}-h"` : '';
    const v2 = value !== undefined ? value : val(name);
    const input = type === 'textarea'
      ? `<textarea id="${id}" name="${name}"${hid} ${attrs}>${esc(v2)}</textarea>`
      : `<input id="${id}" name="${name}" type="${type}" value="${esc(v2)}"${hid} ${attrs}>`;
    return `<div class="field${full ? ' full' : ''}"><label for="${id}">${esc(label)}</label>${input}
      ${hint ? `<div class="hint" id="${id}-h">${esc(hint)}</div>` : ''}</div>`;
  };

  ctx.el.innerHTML = `<div class="page">
    <a class="back-link" href="${back}">${icon('back')}${esc(t('btn.back'))}</a>
    <div class="page-head"><h1>${esc(t(isNew ? 'articles.newTitle' : 'articles.editTitle'))}</h1>
      ${art ? `<div class="sub mono">${esc(art.code)}</div>` : ''}</div>
    ${src ? `<div class="alert">${icon('file')}<span>${esc(t('articles.duplicateHint', { code: src.code }))}</span></div>` : ''}
    <form class="card form" data-form novalidate>
      <div class="field full">
        <label for="af-name">${esc(t('articles.f.name'))} <span aria-hidden="true">*</span></label>
        <input id="af-name" name="name" type="text" required aria-required="true" maxlength="200" autocomplete="off" value="${esc(val('name'))}">
      </div>
      ${isNew ? field('code', `${t('articles.f.code')} (${t('common.optional')})`, {
        hint: t('articles.h.code'), value: '', attrs: 'maxlength="30" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="INV-…"',
      }) : ''}
      ${isNew ? field('stock', t('articles.f.initialStock'), {
        hint: t('articles.h.initialStock'), value: '0', attrs: `inputmode="${isDec(unit) ? 'decimal' : 'numeric'}" autocomplete="off"`,
      }) : ''}
      ${catRows.length ? `<div class="field">
        <label for="af-category">${esc(t('articles.f.category'))}</label>
        <select id="af-category" name="category_id"${legacyCat ? ' aria-describedby="af-category-h"' : ''}>${categoryOptionsHtml(catRows, catId)}${catId && !catRows.some((c) => c.id === catId)
          ? `<option value="${esc(catId)}" selected>${esc(catText(v) || '?')}</option>` : ''}</select>
        ${legacyCat ? `<div class="hint" id="af-category-h">${esc(t('articles.categoryLegacy', { text: legacyCat }))}</div>` : ''}
      </div>` : `<div class="field">
        <label for="af-category">${esc(t('articles.f.category'))}</label>
        <input id="af-category" name="category" type="text" list="af-cats" maxlength="100" autocomplete="off" value="${esc(val('category'))}" aria-describedby="af-category-h">
        <datalist id="af-cats">${cats.map((c) => `<option value="${esc(c)}"></option>`).join('')}</datalist>
        <div class="hint" id="af-category-h">${esc(t('articles.h.category'))}</div>
      </div>`}
      <div class="field">
        <label for="af-unit">${esc(t('articles.f.unit'))}</label>
        <select id="af-unit" name="unit">${units.map((u) => `<option value="${esc(u)}"${u === unit ? ' selected' : ''}>${esc(unitLabel(u))}</option>`).join('')}</select>
      </div>
      <div class="field">
        <label for="af-location">${esc(t('articles.f.location'))}</label>
        <select id="af-location" name="location_id">
          <option value="">${esc(t('articles.noLocation'))}</option>
          ${locOptions.map((l) => `<option value="${esc(l.id)}"${l.id === curLoc ? ' selected' : ''}>${esc(l.path || l.name)}</option>`).join('')}
        </select>
      </div>
      ${field('min_stock', t('articles.f.minStock'), { hint: t('articles.h.minStock'), attrs: 'inputmode="decimal" autocomplete="off"' })}
      ${field('reorder_qty', t('articles.f.reorderQty'), { hint: t('articles.h.reorderQty'), attrs: 'inputmode="decimal" autocomplete="off"' })}
      ${field('brand', t('articles.f.brand'), { attrs: 'maxlength="100"' })}
      ${field('model', t('articles.f.model'), { attrs: 'maxlength="100"' })}
      ${field('art_no', t('articles.f.artNo'), { attrs: 'maxlength="100" autocomplete="off"' })}
      ${field('size', t('articles.f.size'), { attrs: 'maxlength="100"' })}
      ${field('color', t('articles.f.color'), { attrs: 'maxlength="100"' })}
      ${field('product_url', t('articles.f.productUrl'), { type: 'url', full: true, hint: t('articles.h.productUrl'),
        attrs: 'maxlength="1000" inputmode="url" spellcheck="false" autocapitalize="off" autocomplete="off" placeholder="https://…"' })}
      ${field('label_text', t('articles.f.labelText'), { full: true, hint: t('articles.h.labelText'), attrs: 'maxlength="120"' })}
      ${field('description', t('articles.f.description'), { type: 'textarea', full: true })}
      ${field('usage', t('articles.f.usage'), { type: 'textarea', full: true })}
      ${field('notes', t('articles.f.notes'), { type: 'textarea', full: true })}
      <div class="alert danger field full" data-err role="alert" hidden></div>
      <div class="field full"><div class="actions">
        <button type="submit" class="btn primary">${icon('check')}${esc(t('btn.save'))}</button>
        <a class="btn ghost" href="${back}">${esc(t('btn.cancel'))}</a>
      </div></div>
    </form>
  </div>`;
  const root = ctx.el.firstElementChild;
  const form = root.querySelector('[data-form]');
  const submitBtn = form.querySelector('button[type=submit]');
  const unitSel = form.querySelector('#af-unit');
  const stockInp = form.querySelector('#af-stock');
  if (stockInp) unitSel.addEventListener('change', () => { stockInp.inputMode = isDec(unitSel.value) ? 'decimal' : 'numeric'; });

  const fail = (msg, fieldName) => {
    setErr(form, msg);
    const f = fieldName && form.querySelector(`[name="${fieldName}"]`);
    if (f) { f.setAttribute('aria-invalid', 'true'); f.focus(); }
  };
  let busy = false;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (busy) return;
    form.querySelectorAll('[aria-invalid]').forEach((x) => x.removeAttribute('aria-invalid'));
    setErr(form, '');
    const d = formData(form);
    const name = clean(d.name);
    if (!name) { fail(t('err.name_required'), 'name'); return; }
    const u = d.unit || 'Stk';
    let minStock = null;
    if (clean(d.min_stock)) {
      minStock = readNum(d.min_stock);
      if (minStock === null || minStock < 0) { fail(t('err.invalid_qty'), 'min_stock'); return; }
      minStock = round3(minStock);
    }
    // Nachkaufmenge nur senden, wenn ausgefüllt oder bisher gesetzt (ältere Datenbank kennt die Spalte evtl. noch nicht)
    let reorderQty;
    if (clean(d.reorder_qty)) {
      reorderQty = readNum(d.reorder_qty);
      if (reorderQty === null || !(reorderQty > 0)) { fail(t('err.invalid_qty'), 'reorder_qty'); return; }
      reorderQty = round3(reorderQty);
    } else if (hasValue(v.reorder_qty) && !isNew) reorderQty = null;
    const urlRaw = urlInput(d.product_url);
    if (urlRaw && !safeUrl(urlRaw)) { fail(t('articles.productUrlInvalid'), 'product_url'); return; }
    const obj = {
      name,
      description: multi(d.description),
      art_no: nullIfEmpty(d.art_no),
      product_url: urlRaw || null,
      brand: nullIfEmpty(d.brand),
      model: nullIfEmpty(d.model),
      size: nullIfEmpty(d.size),
      color: nullIfEmpty(d.color),
      usage: multi(d.usage),
      label_text: nullIfEmpty(d.label_text),
      unit: u,
      min_stock: minStock,
      ...(reorderQty !== undefined ? { reorder_qty: reorderQty } : {}),
      location_id: d.location_id || null,
      notes: multi(d.notes),
    };
    if (catRows.length) {
      // Kategorie aus der Liste: category_id + bisheriges Textfeld (Name), damit Altdaten und Etiketten stimmen
      const sel = d.category_id || null;
      const c = sel ? catRows.find((x) => x.id === sel) : null;
      if (sel) { obj.category_id = sel; obj.category = c ? c.name : (v.category || null); }
      else if (isNew && legacyCat) obj.category = legacyCat;          // Duplikat einer Vorlage mit Freitext
      else if (isNew || (art && art.category_id)) { obj.category_id = null; obj.category = null; }
      // sonst: bisheriger Freitext ohne category_id bleibt unverändert
    } else {
      obj.category = nullIfEmpty(d.category);
    }
    if (isNew) {
      const c = clean(d.code).toUpperCase().replace(/\s+/g, '');
      if (c) obj.code = c;
      const st = clean(d.stock) === '' ? 0 : readNum(d.stock);
      const msg = checkQty(st, u, true);
      if (msg) { fail(msg, 'stock'); return; }
      obj.stock = round3(st);
    } else {
      obj.id = art.id;
      obj.archived = !!art.archived;   // Bestand wird hier nie gesendet – nur über Bewegungen
    }
    busy = true;
    submitBtn.disabled = true;
    try {
      const row = await api.saveArticle(obj);
      const savedCode = (row && row.code) || obj.code || (art && art.code);
      toast(t('common.saved'));
      if (savedCode) ctx.go('a/' + enc(savedCode)); else ctx.go('artikel');
      if (isNew && row) offerLabel(row);
    } catch (err) {
      const msg = errorText(err);
      const c = err && err.code;
      fail(msg, (c === 'duplicate_code' || c === 'invalid_code') && isNew ? 'code'
        : c === 'invalid_location' ? 'location_id' : c === 'name_required' ? 'name' : null);
      toast(msg, 'error');
    } finally {
      busy = false;
      submitBtn.disabled = false;
    }
  });
}

async function offerLabel(row) {
  const yes = await sheet({
    title: t('articles.created', { code: row.code }),
    body: `<p>${esc(t('articles.printNow'))}</p>`,
    actions: [
      { label: t('articles.later'), kind: 'ghost', value: false },
      { label: t('articles.printLabel'), kind: 'primary', icon: 'print', value: true },
    ],
  });
  if (yes === true) printLabels(() => [labels.labelItem('article', row)]);
}

// ---------------------------------------------------------------------------
// Routen
// ---------------------------------------------------------------------------
export const routes = {
  'artikel': (ctx) => listView(ctx),
  'artikel/neu': (ctx) => formView(ctx, 'new'),
  'a/:code': (ctx) => cardView(ctx),
  'a/:code/bearbeiten': (ctx) => formView(ctx, 'edit'),
};
