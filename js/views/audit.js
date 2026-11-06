// Protokoll (Audit-Log): alle Änderungen und Buchungen – nur Lagerverantwortliche und Administratoren
import { t, has, registerStrings, fmtDateTime, fmtQty, unitLabel } from '../i18n.js';
import {
  esc, can, icon, emptyHtml, errorText, toast, roleLabel, conditionLabel, routeForCode, downloadCsv, debounce, today,
} from '../util.js';

registerStrings({
  de: {
    'audit.title': 'Protokoll',
    'audit.intro': 'Alle Änderungen und Buchungen, neueste zuerst (die letzten 300 Einträge).',
    'audit.noAccess': 'Das Protokoll können nur Lagerverantwortliche und Administratoren ansehen.',
    'audit.search': 'Suchen (Mitarbeiter, Objekt, Details)…',
    'audit.area': 'Bereich',
    'audit.allAreas': 'Alle Bereiche',
    'audit.colTime': 'Zeit',
    'audit.colUser': 'Mitarbeiter',
    'audit.colAction': 'Aktion',
    'audit.colArea': 'Bereich',
    'audit.colObject': 'Objekt',
    'audit.colDetails': 'Details',
    'audit.count': '{n} von {total} Einträgen',
    'audit.none': 'Keine Einträge für diesen Filter.',
    'audit.empty': 'Noch keine Einträge.',
    'audit.system': 'System',
    'audit.a.insert': 'Angelegt',
    'audit.a.update': 'Geändert',
    'audit.a.delete': 'Gelöscht',
    'audit.a.ausleihen': 'Ausgeliehen',
    'audit.a.zurueckgeben': 'Zurückgegeben',
    'audit.a.status': 'Status geändert',
    'audit.a.korrektur': 'Korrektur',
    'audit.a.mitarbeiter': 'Mitarbeiter geändert',
    'audit.a.inventur': 'Inventur abgeschlossen',
    'audit.e.machines': 'Maschinen',
    'audit.e.articles': 'Artikel',
    'audit.e.locations': 'Lagerorte',
    'audit.e.loans': 'Ausleihen',
    'audit.e.profiles': 'Mitarbeiter',
    'audit.e.inventories': 'Inventuren',
    'audit.e.attachments': 'Fotos & Dokumente',
    'audit.d.to': 'an {name}',
    'audit.d.due': 'Rückgabe bis {d}',
    'audit.d.borrower': 'Ausleiher: {name}',
    'audit.d.condition': 'Zustand: {c}',
    'audit.d.onBehalf': 'stellvertretend zurückgegeben',
    'audit.d.reason': 'Grund: {r}',
    'audit.d.booked': 'Differenzen gebucht',
    'audit.d.notBooked': 'ohne Buchung abgeschlossen',
    'audit.d.note': 'Bemerkung: {n}',
    'audit.d.loan': 'Ausleihe',
    'audit.d.of': 'zu {name}',
    'audit.k.photo': 'Foto',
    'audit.k.document': 'Dokument',
    'audit.k.damage': 'Schadenfoto',
    'audit.f.name': 'Name', 'audit.f.full_name': 'Name', 'audit.f.code': 'Code', 'audit.f.description': 'Beschreibung',
    'audit.f.art_no': 'Artikelnummer', 'audit.f.category': 'Kategorie', 'audit.f.brand': 'Marke', 'audit.f.model': 'Modell',
    'audit.f.size': 'Grösse', 'audit.f.color': 'Farbe', 'audit.f.usage': 'Verwendung', 'audit.f.label_text': 'Etikettentext',
    'audit.f.unit': 'Einheit', 'audit.f.stock': 'Bestand', 'audit.f.min_stock': 'Mindestbestand', 'audit.f.location_id': 'Lagerort',
    'audit.f.home_location_id': 'Standort', 'audit.f.parent_id': 'Übergeordneter Lagerort', 'audit.f.notes': 'Bemerkungen',
    'audit.f.note': 'Bemerkung', 'audit.f.archived': 'Archiviert', 'audit.f.status': 'Status', 'audit.f.condition': 'Zustand',
    'audit.f.condition_note': 'Zustandsbemerkung', 'audit.f.serial_no': 'Seriennummer', 'audit.f.inventory_no': 'Inventarnummer',
    'audit.f.type': 'Typ', 'audit.f.checked_out_at': 'Ausgeliehen am', 'audit.f.due_at': 'Rückgabe bis',
    'audit.f.returned_at': 'Zurückgegeben am', 'audit.f.rolle': 'Rolle', 'audit.f.role': 'Rolle', 'audit.f.aktiv': 'Aktiv',
    'audit.f.active': 'Aktiv', 'audit.f.kind': 'Art', 'audit.f.is_primary': 'Hauptfoto', 'audit.f.file_name': 'Datei', 'audit.f.lang': 'Sprache',
  },
  pt: {
    'audit.title': 'Registo',
    'audit.intro': 'Todas as alterações e movimentos, os mais recentes primeiro (últimos 300 registos).',
    'audit.noAccess': 'Só os responsáveis de armazém e os administradores podem ver o registo.',
    'audit.search': 'Pesquisar (colaborador, objeto, detalhes)…',
    'audit.area': 'Área',
    'audit.allAreas': 'Todas as áreas',
    'audit.colTime': 'Hora',
    'audit.colUser': 'Colaborador',
    'audit.colAction': 'Ação',
    'audit.colArea': 'Área',
    'audit.colObject': 'Objeto',
    'audit.colDetails': 'Detalhes',
    'audit.count': '{n} de {total} registos',
    'audit.none': 'Nenhum registo para este filtro.',
    'audit.empty': 'Ainda não há registos.',
    'audit.system': 'Sistema',
    'audit.a.insert': 'Criado',
    'audit.a.update': 'Alterado',
    'audit.a.delete': 'Eliminado',
    'audit.a.ausleihen': 'Levantada',
    'audit.a.zurueckgeben': 'Devolvida',
    'audit.a.status': 'Estado alterado',
    'audit.a.korrektur': 'Correção',
    'audit.a.mitarbeiter': 'Colaborador alterado',
    'audit.a.inventur': 'Inventário fechado',
    'audit.e.machines': 'Máquinas',
    'audit.e.articles': 'Artigos',
    'audit.e.locations': 'Localizações',
    'audit.e.loans': 'Empréstimos',
    'audit.e.profiles': 'Colaboradores',
    'audit.e.inventories': 'Inventários',
    'audit.e.attachments': 'Fotos e documentos',
    'audit.d.to': 'para {name}',
    'audit.d.due': 'devolver até {d}',
    'audit.d.borrower': 'Levantada por: {name}',
    'audit.d.condition': 'Condição: {c}',
    'audit.d.onBehalf': 'devolvida em nome de outra pessoa',
    'audit.d.reason': 'Motivo: {r}',
    'audit.d.booked': 'diferenças registadas',
    'audit.d.notBooked': 'fechado sem registo',
    'audit.d.note': 'Observação: {n}',
    'audit.d.loan': 'Empréstimo',
    'audit.d.of': 'de {name}',
    'audit.k.photo': 'Foto',
    'audit.k.document': 'Documento',
    'audit.k.damage': 'Foto de dano',
    'audit.f.name': 'Nome', 'audit.f.full_name': 'Nome', 'audit.f.code': 'Código', 'audit.f.description': 'Descrição',
    'audit.f.art_no': 'N.º de artigo', 'audit.f.category': 'Categoria', 'audit.f.brand': 'Marca', 'audit.f.model': 'Modelo',
    'audit.f.size': 'Tamanho', 'audit.f.color': 'Cor', 'audit.f.usage': 'Utilização', 'audit.f.label_text': 'Texto da etiqueta',
    'audit.f.unit': 'Unidade', 'audit.f.stock': 'Stock', 'audit.f.min_stock': 'Stock mínimo', 'audit.f.location_id': 'Localização',
    'audit.f.home_location_id': 'Localização', 'audit.f.parent_id': 'Localização superior', 'audit.f.notes': 'Observações',
    'audit.f.note': 'Observação', 'audit.f.archived': 'Arquivado', 'audit.f.status': 'Estado', 'audit.f.condition': 'Condição',
    'audit.f.condition_note': 'Nota sobre a condição', 'audit.f.serial_no': 'N.º de série', 'audit.f.inventory_no': 'N.º de inventário',
    'audit.f.type': 'Tipo', 'audit.f.checked_out_at': 'Levantada em', 'audit.f.due_at': 'Devolver até',
    'audit.f.returned_at': 'Devolvida em', 'audit.f.rolle': 'Função', 'audit.f.role': 'Função', 'audit.f.aktiv': 'Ativo',
    'audit.f.active': 'Ativo', 'audit.f.kind': 'Tipo', 'audit.f.is_primary': 'Foto principal', 'audit.f.file_name': 'Ficheiro', 'audit.f.lang': 'Idioma',
  },
  es: {
    'audit.title': 'Registro',
    'audit.intro': 'Todos los cambios y movimientos, los más recientes primero (últimas 300 entradas).',
    'audit.noAccess': 'Solo los responsables de almacén y los administradores pueden ver el registro.',
    'audit.search': 'Buscar (empleado, objeto, detalles)…',
    'audit.area': 'Área',
    'audit.allAreas': 'Todas las áreas',
    'audit.colTime': 'Hora',
    'audit.colUser': 'Empleado',
    'audit.colAction': 'Acción',
    'audit.colArea': 'Área',
    'audit.colObject': 'Objeto',
    'audit.colDetails': 'Detalles',
    'audit.count': '{n} de {total} entradas',
    'audit.none': 'No hay entradas para este filtro.',
    'audit.empty': 'Aún no hay entradas.',
    'audit.system': 'Sistema',
    'audit.a.insert': 'Creado',
    'audit.a.update': 'Modificado',
    'audit.a.delete': 'Eliminado',
    'audit.a.ausleihen': 'Retirada',
    'audit.a.zurueckgeben': 'Devuelta',
    'audit.a.status': 'Estado cambiado',
    'audit.a.korrektur': 'Corrección',
    'audit.a.mitarbeiter': 'Empleado modificado',
    'audit.a.inventur': 'Inventario cerrado',
    'audit.e.machines': 'Máquinas',
    'audit.e.articles': 'Artículos',
    'audit.e.locations': 'Ubicaciones',
    'audit.e.loans': 'Préstamos',
    'audit.e.profiles': 'Empleados',
    'audit.e.inventories': 'Inventarios',
    'audit.e.attachments': 'Fotos y documentos',
    'audit.d.to': 'para {name}',
    'audit.d.due': 'devolver antes del {d}',
    'audit.d.borrower': 'Retirada por: {name}',
    'audit.d.condition': 'Condición: {c}',
    'audit.d.onBehalf': 'devuelta en nombre de otra persona',
    'audit.d.reason': 'Motivo: {r}',
    'audit.d.booked': 'diferencias registradas',
    'audit.d.notBooked': 'cerrado sin registrar',
    'audit.d.note': 'Observación: {n}',
    'audit.d.loan': 'Préstamo',
    'audit.d.of': 'de {name}',
    'audit.k.photo': 'Foto',
    'audit.k.document': 'Documento',
    'audit.k.damage': 'Foto de daño',
    'audit.f.name': 'Nombre', 'audit.f.full_name': 'Nombre', 'audit.f.code': 'Código', 'audit.f.description': 'Descripción',
    'audit.f.art_no': 'N.º de artículo', 'audit.f.category': 'Categoría', 'audit.f.brand': 'Marca', 'audit.f.model': 'Modelo',
    'audit.f.size': 'Tamaño', 'audit.f.color': 'Color', 'audit.f.usage': 'Uso', 'audit.f.label_text': 'Texto de la etiqueta',
    'audit.f.unit': 'Unidad', 'audit.f.stock': 'Stock', 'audit.f.min_stock': 'Stock mínimo', 'audit.f.location_id': 'Ubicación',
    'audit.f.home_location_id': 'Ubicación', 'audit.f.parent_id': 'Ubicación superior', 'audit.f.notes': 'Observaciones',
    'audit.f.note': 'Observación', 'audit.f.archived': 'Archivado', 'audit.f.status': 'Estado', 'audit.f.condition': 'Condición',
    'audit.f.condition_note': 'Nota sobre la condición', 'audit.f.serial_no': 'N.º de serie', 'audit.f.inventory_no': 'N.º de inventario',
    'audit.f.type': 'Tipo', 'audit.f.checked_out_at': 'Retirada el', 'audit.f.due_at': 'Devolver antes del',
    'audit.f.returned_at': 'Devuelta el', 'audit.f.rolle': 'Rol', 'audit.f.role': 'Rol', 'audit.f.aktiv': 'Activo',
    'audit.f.active': 'Activo', 'audit.f.kind': 'Tipo', 'audit.f.is_primary': 'Foto principal', 'audit.f.file_name': 'Archivo', 'audit.f.lang': 'Idioma',
  },
});

// ---------- private Hilfen ----------
// «Lager organisieren»: Aktionen, Bereiche und Felder der neuen Tabellen
registerStrings({
  de: {
    'audit.a.ki_import': 'KI-Ergebnis importiert', 'audit.a.ki_bearbeitet': 'Erkennung bearbeitet', 'audit.a.ki_bestaetigen': 'Erkennung bestätigt',
    'audit.a.ki_spaeter': 'Erkennung später prüfen', 'audit.a.ki_ablehnen': 'Erkennung abgelehnt', 'audit.a.ki_wiederoeffnen': 'Erkennung wieder geöffnet',
    'audit.a.ki_zusammenfuehren': 'Erkennungen zusammengeführt', 'audit.a.organisiert': 'Organisationsstatus',
    'audit.e.categories': 'Kategorien', 'audit.e.photos': 'Fotos (Import)', 'audit.e.detections': 'KI-Erkennungen',
    'audit.e.org_tasks': 'Organisationsaufgaben', 'audit.e.photo_hotspots': 'Bereiche auf Fotos', 'audit.e.set_components': 'Set-Komponenten',
    'audit.f.short_code': 'Kurzcode', 'audit.f.responsible_id': 'Verantwortlich', 'audit.f.cover_photo_id': 'Übersichtsfoto',
    'audit.f.category_id': 'Kategorie', 'audit.f.is_set': 'Set', 'audit.f.product_url': 'Herstellerseite', 'audit.f.title': 'Titel',
    'audit.f.details': 'Details', 'audit.f.assigned_to': 'Zugewiesen an', 'audit.f.sort': 'Reihenfolge', 'audit.f.label': 'Beschriftung',
    'audit.f.qty': 'Menge', 'audit.f.organisiert': 'Organisiert', 'audit.f.quelle': 'Quelle', 'audit.f.datei': 'Datei',
    'audit.f.neue_objekte': 'Neue Objekte', 'audit.f.erfasst': 'Erfasst als', 'audit.f.codes': 'Codes', 'audit.f.verknuepft': 'Verknüpft',
  },
  pt: {
    'audit.a.ki_import': 'Resultado IA importado', 'audit.a.ki_bearbeitet': 'Deteção editada', 'audit.a.ki_bestaetigen': 'Deteção confirmada',
    'audit.a.ki_spaeter': 'Deteção para mais tarde', 'audit.a.ki_ablehnen': 'Deteção rejeitada', 'audit.a.ki_wiederoeffnen': 'Deteção reaberta',
    'audit.a.ki_zusammenfuehren': 'Deteções fundidas', 'audit.a.organisiert': 'Estado de organização',
    'audit.e.categories': 'Categorias', 'audit.e.photos': 'Fotos (importação)', 'audit.e.detections': 'Deteções IA',
    'audit.e.org_tasks': 'Tarefas de organização', 'audit.e.photo_hotspots': 'Áreas nas fotos', 'audit.e.set_components': 'Componentes de conjunto',
    'audit.f.short_code': 'Código curto', 'audit.f.responsible_id': 'Responsável', 'audit.f.cover_photo_id': 'Foto geral',
    'audit.f.category_id': 'Categoria', 'audit.f.is_set': 'Conjunto', 'audit.f.product_url': 'Página do fabricante', 'audit.f.title': 'Título',
    'audit.f.details': 'Detalhes', 'audit.f.assigned_to': 'Atribuída a', 'audit.f.sort': 'Ordem', 'audit.f.label': 'Rótulo',
    'audit.f.qty': 'Quantidade', 'audit.f.organisiert': 'Organizado', 'audit.f.quelle': 'Fonte', 'audit.f.datei': 'Ficheiro',
    'audit.f.neue_objekte': 'Objetos novos', 'audit.f.erfasst': 'Registado como', 'audit.f.codes': 'Códigos', 'audit.f.verknuepft': 'Ligados',
  },
  es: {
    'audit.a.ki_import': 'Resultado de IA importado', 'audit.a.ki_bearbeitet': 'Detección editada', 'audit.a.ki_bestaetigen': 'Detección confirmada',
    'audit.a.ki_spaeter': 'Detección para más tarde', 'audit.a.ki_ablehnen': 'Detección rechazada', 'audit.a.ki_wiederoeffnen': 'Detección reabierta',
    'audit.a.ki_zusammenfuehren': 'Detecciones fusionadas', 'audit.a.organisiert': 'Estado de organización',
    'audit.e.categories': 'Categorías', 'audit.e.photos': 'Fotos (importación)', 'audit.e.detections': 'Detecciones IA',
    'audit.e.org_tasks': 'Tareas de organización', 'audit.e.photo_hotspots': 'Áreas en fotos', 'audit.e.set_components': 'Componentes de set',
    'audit.f.short_code': 'Código corto', 'audit.f.responsible_id': 'Responsable', 'audit.f.cover_photo_id': 'Foto general',
    'audit.f.category_id': 'Categoría', 'audit.f.is_set': 'Set', 'audit.f.product_url': 'Página del fabricante', 'audit.f.title': 'Título',
    'audit.f.details': 'Detalles', 'audit.f.assigned_to': 'Asignada a', 'audit.f.sort': 'Orden', 'audit.f.label': 'Etiqueta',
    'audit.f.qty': 'Cantidad', 'audit.f.organisiert': 'Organizado', 'audit.f.quelle': 'Fuente', 'audit.f.datei': 'Archivo',
    'audit.f.neue_objekte': 'Objetos nuevos', 'audit.f.erfasst': 'Registrado como', 'audit.f.codes': 'Códigos', 'audit.f.verknuepft': 'Vinculados',
  },
});

const AREAS = ['machines', 'articles', 'locations', 'loans', 'profiles', 'inventories', 'attachments',
  'categories', 'photos', 'detections', 'org_tasks', 'photo_hotspots', 'set_components'];
const ACTION_PILL = {
  insert: 'pill-ok', update: 'pill-info', delete: 'pill-danger', ausleihen: 'pill-ausgeliehen', zurueckgeben: 'pill-verfuegbar',
  status: 'pill-warn', korrektur: 'pill-warn', mitarbeiter: 'pill-reserviert', inventur: 'pill-info',
};
const SKIP_FIELDS = new Set(['id', 'updated_at', 'created_at', 'created_by', 'uploaded_by', 'started_by', 'path', 'mime',
  'size_bytes', 'entity', 'entity_id', 'loan_id', 'request_id', 'checkout_request', 'return_request']);
const INSERT_FIELDS = ['category', 'brand', 'model', 'type', 'stock', 'min_stock', 'location_id', 'home_location_id', 'parent_id', 'status'];
const LOC_FIELDS = new Set(['location_id', 'home_location_id', 'parent_id', 'target_location_id']);
const PERSON_FIELDS = new Set(['responsible_id', 'assigned_to', 'done_by', 'organized_by', 'reviewed_by']);
const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const isIsoDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v);

const actionLabel = (a) => (has('audit.a.' + a) ? t('audit.a.' + a) : a);
const areaLabel = (e) => (has('audit.e.' + e) ? t('audit.e.' + e) : e);
const fieldLabel = (k) => (has('audit.f.' + k) ? t('audit.f.' + k) : k);

function short(s, n = 90) {
  const x = String(s);
  return x.length > n ? x.slice(0, n - 1) + '…' : x;
}

function makeFmt(maps, entity, unit) {
  return function fmtVal(key, v) {
    if (v === null || v === undefined || v === '') return '–';
    if (typeof v === 'boolean') return v ? t('common.yes') : t('common.no');
    if (LOC_FIELDS.has(key)) return maps.locations.get(v) || short(v, 10);
    if (PERSON_FIELDS.has(key)) return maps.profiles.get(v) || short(v, 10);
    if (key === 'status' && has('status.' + v)) return t('status.' + v);
    if ((key === 'condition' || key === 'return_condition') && has('cond.' + v)) return conditionLabel(v);
    if ((key === 'rolle' || key === 'role') && has('role.' + v)) return roleLabel(v);
    if (key === 'type' && entity === 'locations' && has('loc.' + v)) return t('loc.' + v);
    if (key === 'unit') return unitLabel(v);
    if ((key === 'stock' || key === 'min_stock') && unit) return fmtQty(v, unit);
    if (key === 'kind' && has('audit.k.' + v)) return t('audit.k.' + v);
    if (key === 'lang') return String(v).toUpperCase();
    if (isIsoDate(v)) return fmtDateTime(v);
    if (typeof v === 'object') return short(JSON.stringify(v));
    return short(v);
  };
}

function objectInfo(row, maps) {
  const d = (row.details && typeof row.details === 'object') ? row.details : {};
  const e = row.entity;
  const id = row.entity_id;
  const pick = (map) => map.get(id) || null;
  if (e === 'machines' || e === 'articles' || e === 'locations') {
    const o = pick(maps[e]) || {};
    const code = o.code || d.code || '';
    const name = o.name || d.name || '';
    return { label: [code, name].filter(Boolean).join(' '), href: code ? '#/' + routeForCode(code) : '' };
  }
  if (e === 'profiles') {
    const name = maps.profiles.get(id) || (d.neu && d.neu.name) || d.full_name || '';
    return { label: name, href: id ? '#/mitarbeiter/' + encodeURIComponent(id) : '' };
  }
  if (e === 'inventories') {
    return { label: maps.inventories.get(id) || '', href: id ? '#/inventur/' + encodeURIComponent(id) : '' };
  }
  if (e === 'attachments') {
    const parentMap = { machine: maps.machines, article: maps.articles, location: maps.locations }[d.entity];
    const parent = parentMap && parentMap.get(d.entity_id);
    return {
      label: d.file_name || '',
      parent: parent ? [parent.code, parent.name].filter(Boolean).join(' ') : '',
      href: parent && parent.code ? '#/' + routeForCode(parent.code) : '',
    };
  }
  if (e === 'loans') return { label: t('audit.d.loan'), href: '' };
  if (e === 'categories') return { label: (typeof d.name === 'string' ? d.name : (d.name && typeof d.name.neu === 'string' ? d.name.neu : '')), href: id ? '#/suche?kat=' + encodeURIComponent(id) : '' };
  if (e === 'photos') return { label: (typeof d.datei === 'string' ? d.datei : (d.datei && typeof d.datei.neu === 'string' ? d.datei.neu : '')) || (typeof d.file_name === 'string' ? d.file_name : (d.file_name && typeof d.file_name.neu === 'string' ? d.file_name.neu : '')), href: '' };
  if (e === 'detections') return { label: (typeof d.name === 'string' ? d.name : (d.name && typeof d.name.neu === 'string' ? d.name.neu : '')), href: '#/organisieren/pruefen' };
  if (e === 'org_tasks') return { label: (typeof d.title === 'string' ? d.title : (d.title && typeof d.title.neu === 'string' ? d.title.neu : '')), href: '' };
  if (e === 'photo_hotspots') return { label: (typeof d.label === 'string' ? d.label : (d.label && typeof d.label.neu === 'string' ? d.label.neu : '')), href: '' };
  if (e === 'set_components') return { label: (typeof d.name === 'string' ? d.name : (d.name && typeof d.name.neu === 'string' ? d.name.neu : '')), href: '' };
  return { label: '', href: '' };
}

function detailText(row, maps) {
  const d = (row.details && typeof row.details === 'object') ? row.details : {};
  const e = row.entity;
  const person = (pid) => maps.profiles.get(pid) || (pid ? short(pid, 10) : '–');
  const unitOf = () => {
    const o = e === 'articles' ? maps.articles.get(row.entity_id) : null;
    if (o && o.unit) return o.unit;
    if (typeof d.unit === 'string') return d.unit;
    if (d.unit && typeof d.unit === 'object') return d.unit.neu || d.unit.alt || '';
    return '';
  };
  const fmtVal = makeFmt(maps, e, unitOf());
  const parts = [];
  const diffPairs = (alt, neu) => {
    const keys = new Set([...Object.keys(alt || {}), ...Object.keys(neu || {})]);
    for (const k of keys) {
      const a = alt ? alt[k] : undefined;
      const n = neu ? neu[k] : undefined;
      if (JSON.stringify(a) === JSON.stringify(n)) continue;
      parts.push(`${fieldLabel(k)}: ${fmtVal(k, a)} → ${fmtVal(k, n)}`);
    }
  };

  switch (row.action) {
    case 'insert': {
      if (e === 'attachments') {
        if (d.kind) parts.push(fmtVal('kind', d.kind));
        if (d.note) parts.push(t('audit.d.note', { n: short(d.note) }));
        break;
      }
      for (const k of INSERT_FIELDS) {
        if (d[k] !== undefined && d[k] !== null && d[k] !== '') parts.push(`${fieldLabel(k)}: ${fmtVal(k, d[k])}`);
      }
      break;
    }
    case 'update': {
      for (const [k, v] of Object.entries(d)) {
        if (SKIP_FIELDS.has(k)) continue;
        if (v && typeof v === 'object' && ('alt' in v || 'neu' in v)) parts.push(`${fieldLabel(k)}: ${fmtVal(k, v.alt)} → ${fmtVal(k, v.neu)}`);
        else parts.push(`${fieldLabel(k)}: ${fmtVal(k, v)}`);
      }
      break;
    }
    case 'delete': {
      if (e === 'attachments' && d.kind) parts.push(fmtVal('kind', d.kind));
      else if (d.code) parts.push(`${fieldLabel('code')}: ${d.code}`);
      break;
    }
    case 'ausleihen': {
      if (d.borrower) parts.push(t('audit.d.to', { name: person(d.borrower) }));
      if (d.due) parts.push(t('audit.d.due', { d: fmtDateTime(d.due) }));
      break;
    }
    case 'zurueckgeben': {
      if (d.borrower) parts.push(t('audit.d.borrower', { name: person(d.borrower) }));
      if (d.condition) parts.push(t('audit.d.condition', { c: conditionLabel(d.condition) }));
      if (d.note) parts.push(t('audit.d.note', { n: short(d.note) }));
      if (d.stellvertretend) parts.push(t('audit.d.onBehalf'));
      break;
    }
    case 'status': {
      parts.push(`${fieldLabel('status')}: ${fmtVal('status', d.alt)} → ${fmtVal('status', d.neu)}`);
      if (d.note) parts.push(t('audit.d.note', { n: short(d.note) }));
      break;
    }
    case 'korrektur': {
      if (d.grund) parts.push(t('audit.d.reason', { r: short(d.grund, 140) }));
      diffPairs(d.alt, d.neu);
      break;
    }
    case 'mitarbeiter': {
      diffPairs(d.alt, d.neu);
      break;
    }
    case 'inventur': {
      parts.push(d.gebucht ? t('audit.d.booked') : t('audit.d.notBooked'));
      break;
    }
    default: {
      if (Object.keys(d).length) parts.push(short(JSON.stringify(d), 160));
    }
  }
  return parts.join(' · ');
}

// ---------- Route ----------
async function auditRoute(ctx) {
  const { el, api, user } = ctx;
  if (ctx.setTitle) ctx.setTitle(t('audit.title'));
  const head = `<div class="page-head"><div><h1>${esc(t('audit.title'))}</h1><div class="sub">${esc(t('audit.intro'))}</div></div>
    <div class="actions"><button type="button" class="btn" data-export disabled>${icon('download')}${esc(t('btn.export'))}</button></div></div>`;

  if (!can(user, 'staff')) {
    el.innerHTML = `<div class="page"><div class="page-head"><h1>${esc(t('audit.title'))}</h1></div>
      <div class="alert warn" role="alert">${icon('alert')}<div>${esc(t('audit.noAccess'))}</div></div></div>`;
    return;
  }
  el.innerHTML = `<div class="page">${head}<p class="muted" role="status">${esc(t('common.loading'))}</p></div>`;

  let audit, profiles, machines, articles, locations, inventories;
  try {
    [audit, profiles, machines, articles, locations, inventories] = await Promise.all([
      api.listAudit({ limit: 300 }),
      api.listProfiles().catch(() => []),
      api.listMachines({ includeArchived: true }).catch(() => []),
      api.listArticles({ includeArchived: true }).catch(() => []),
      api.listLocations({ includeArchived: true }).catch(() => []),
      api.listInventories().catch(() => []),
    ]);
  } catch (err) {
    toast(errorText(err), 'error');
    el.innerHTML = `<div class="page">${head}
      <div class="alert danger" role="alert">${icon('alert')}<div>${esc(errorText(err))}</div></div>
      <div><button type="button" class="btn" data-retry>${icon('history')}${esc(t('btn.retry'))}</button></div></div>`;
    el.querySelector('[data-retry]').addEventListener('click', () => ctx.reload());
    return;
  }

  const maps = {
    profiles: new Map((profiles || []).map((p) => [p.id, p.full_name])),
    machines: new Map((machines || []).map((m) => [m.id, m])),
    articles: new Map((articles || []).map((a) => [a.id, a])),
    locations: new Map((locations || []).map((l) => [l.id, l])),
    inventories: new Map((inventories || []).map((i) => [i.id, i.name])),
  };
  // Lagerorte für Feldwerte als Pfad anzeigen
  const locPaths = new Map((locations || []).map((l) => [l.id, l.path || l.name]));
  const fmtMaps = Object.assign({}, maps, { locations: locPaths });

  const rows = (audit || []).map((r) => {
    const obj = objectInfo(r, maps);
    const details = detailText(r, fmtMaps);
    const userName = r.user_id ? (maps.profiles.get(r.user_id) || short(r.user_id, 10)) : t('audit.system');
    const objText = [obj.label, obj.parent ? t('audit.d.of', { name: obj.parent }) : ''].filter(Boolean).join(' ');
    return {
      r, obj, objText, details, userName,
      time: fmtDateTime(r.at),
      action: actionLabel(r.action),
      area: areaLabel(r.entity),
      hay: norm(`${fmtDateTime(r.at)} ${userName} ${actionLabel(r.action)} ${areaLabel(r.entity)} ${objText} ${details}`),
    };
  });

  const present = AREAS.filter((a) => rows.some((x) => x.r.entity === a))
    .concat([...new Set(rows.map((x) => x.r.entity))].filter((a) => !AREAS.includes(a)));

  el.innerHTML = `<div class="page">${head}
    <div class="filters">
      <div class="searchbar">${icon('search')}<input type="search" data-search placeholder="${esc(t('audit.search'))}" aria-label="${esc(t('audit.search'))}"></div>
      <div class="field"><label class="sr-only" for="audit-area">${esc(t('audit.area'))}</label>
        <select id="audit-area" data-area><option value="">${esc(t('audit.allAreas'))}</option>
          ${present.map((a) => `<option value="${esc(a)}">${esc(areaLabel(a))}</option>`).join('')}</select></div>
    </div>
    <p class="muted small" data-count role="status" style="margin:0"></p>
    <div class="table-wrap" data-wrap><table class="table">
      <thead><tr><th scope="col">${esc(t('audit.colTime'))}</th><th scope="col">${esc(t('audit.colUser'))}</th>
        <th scope="col">${esc(t('audit.colAction'))}</th><th scope="col">${esc(t('audit.colArea'))}</th>
        <th scope="col">${esc(t('audit.colDetails'))}</th></tr></thead>
      <tbody data-body></tbody></table></div>
    <div data-empty hidden>${emptyHtml(rows.length ? t('audit.none') : t('audit.empty'))}</div>
  </div>`;

  const body = el.querySelector('[data-body]');
  const exportBtn = el.querySelector('[data-export]');
  let area = '', query = '', current = rows;

  const render = () => {
    const qq = norm(query);
    current = rows.filter((x) => (!area || x.r.entity === area) && (!qq || x.hay.includes(qq)));
    body.innerHTML = current.map((x) => {
      const objHtml = x.obj.label
        ? (x.obj.href ? `<a href="${esc(x.obj.href)}"><b>${esc(x.obj.label)}</b></a>` : `<b>${esc(x.obj.label)}</b>`)
        : '';
      const parentHtml = x.obj.parent
        ? ` <span class="muted">${x.obj.href ? `<a href="${esc(x.obj.href)}">${esc(t('audit.d.of', { name: x.obj.parent }))}</a>` : esc(t('audit.d.of', { name: x.obj.parent }))}</span>` : '';
      return `<tr>
        <td><time datetime="${esc(x.r.at)}">${esc(x.time)}</time></td>
        <td>${esc(x.userName)}</td>
        <td><span class="pill ${ACTION_PILL[x.r.action] || 'pill-muted'}">${esc(x.action)}</span></td>
        <td>${esc(x.area)}</td>
        <td class="wrap">${objHtml}${parentHtml}${x.details ? `${objHtml || parentHtml ? '<br>' : ''}<span class="small">${esc(x.details)}</span>` : ''}</td>
      </tr>`;
    }).join('');
    el.querySelector('[data-wrap]').hidden = current.length === 0;
    el.querySelector('[data-empty]').hidden = current.length > 0;
    el.querySelector('[data-count]').textContent = t('audit.count', { n: current.length, total: rows.length });
    exportBtn.disabled = current.length === 0;
  };
  render();

  el.querySelector('[data-search]').addEventListener('input', debounce((e) => { query = e.target.value; render(); }, 150));
  el.querySelector('[data-area]').addEventListener('change', (e) => { area = e.target.value; render(); });
  exportBtn.addEventListener('click', () => {
    const out = [[t('audit.colTime'), t('audit.colUser'), t('audit.colAction'), t('audit.colArea'), t('audit.colObject'), t('audit.colDetails')]];
    for (const x of current) out.push([x.time, x.userName, x.action, x.area, x.objText, x.details]);
    downloadCsv(`protokoll-${today()}.csv`, out);
  });
}

export const routes = {
  'protokoll': auditRoute,
};
