// Fotos und Dokumente zu Maschinen, Artikeln und Lagerorten
import { t, registerStrings, fmtDateTime } from './i18n.js';
import { esc, icon, toast, errorText, can, openLightbox, confirmSheet, sheet } from './util.js';

const MAX_BYTES = 25 * 1024 * 1024;

registerStrings({
  de: {
    'media.noPhotos': 'Noch keine Fotos.', 'media.noDocs': 'Keine Dokumente (z. B. Bedienungsanleitung als PDF).',
    'media.addPhoto': 'Foto', 'media.addDoc': 'Dokument', 'media.uploaded': 'Hochgeladen',
    'media.deleteConfirm': 'Diese Datei endgültig löschen?', 'media.deleted': 'Gelöscht',
    'media.tooBig': 'Datei zu gross (max. 25 MB): {name}', 'media.primarySet': 'Hauptfoto gesetzt',
    'media.damageTitle': 'Foto vom Schaden', 'media.damageText': 'Ein Foto hilft, den Schaden später zu beurteilen.',
    'media.damageTake': 'Foto aufnehmen', 'media.skip': 'Überspringen', 'media.open': 'Öffnen',
  },
  pt: {
    'media.noPhotos': 'Ainda sem fotos.', 'media.noDocs': 'Sem documentos (p. ex. manual em PDF).',
    'media.addPhoto': 'Foto', 'media.addDoc': 'Documento', 'media.uploaded': 'Enviado',
    'media.deleteConfirm': 'Eliminar este ficheiro definitivamente?', 'media.deleted': 'Eliminado',
    'media.tooBig': 'Ficheiro demasiado grande (máx. 25 MB): {name}', 'media.primarySet': 'Foto principal definida',
    'media.damageTitle': 'Foto do dano', 'media.damageText': 'Uma foto ajuda a avaliar o dano mais tarde.',
    'media.damageTake': 'Tirar foto', 'media.skip': 'Saltar', 'media.open': 'Abrir',
  },
  es: {
    'media.noPhotos': 'Todavía no hay fotos.', 'media.noDocs': 'Sin documentos (p. ej. manual en PDF).',
    'media.addPhoto': 'Foto', 'media.addDoc': 'Documento', 'media.uploaded': 'Subido',
    'media.deleteConfirm': '¿Eliminar este archivo definitivamente?', 'media.deleted': 'Eliminado',
    'media.tooBig': 'Archivo demasiado grande (máx. 25 MB): {name}', 'media.primarySet': 'Foto principal establecida',
    'media.damageTitle': 'Foto del daño', 'media.damageText': 'Una foto ayuda a valorar el daño más tarde.',
    'media.damageTake': 'Hacer foto', 'media.skip': 'Omitir', 'media.open': 'Abrir',
  },
});

function pickFiles({ accept, multiple = true, capture = false }) {
  return new Promise((resolve) => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = accept;
    inp.multiple = multiple;
    if (capture) inp.setAttribute('capture', 'environment');
    inp.style.display = 'none';
    let done = false;
    const finish = (files) => { if (done) return; done = true; inp.remove(); resolve(files); };
    inp.addEventListener('change', () => finish([...(inp.files || [])]));
    inp.addEventListener('cancel', () => finish([]));
    document.body.appendChild(inp);
    inp.click();
  });
}

async function uploadMany(ctx, entity, entityId, files, opts) {
  let ok = 0;
  for (const f of files) {
    if (f.size > MAX_BYTES) { toast(t('media.tooBig', { name: f.name }), 'error'); continue; }
    try { await ctx.api.uploadAttachment(entity, entityId, f, opts); ok++; } catch (err) { toast(errorText(err), 'error'); }
  }
  if (ok) toast(`${t('media.uploaded')}: ${ok}`);
  return ok;
}

export async function mediaSection(container, { ctx, entity, entityId, kinds = ['photo', 'document'], allowUpload = true } = {}) {
  const staff = can(ctx.user, 'staff');
  const active = can(ctx.user);
  const mayUpload = allowUpload && active;

  async function load() {
    let atts = [];
    try {
      atts = await ctx.api.listAttachments(entity, entityId);
    } catch (err) {
      container.innerHTML = `<div class="alert danger">${icon('alert')}<span>${esc(errorText(err))}</span></div>`;
      return;
    }
    const photos = atts.filter((a) => a.kind === 'photo' || a.kind === 'damage');
    const docs = atts.filter((a) => a.kind === 'document');
    let urls = new Map();
    try { urls = await ctx.api.fileUrls(atts.map((a) => a.path)); } catch (e) { /* ohne Vorschau */ }

    const photoHtml = photos.length ? `<div class="gallery">${photos.map((a) => `
        <figure data-id="${esc(a.id)}">
          ${a.is_primary ? `<span class="badge-primary">${esc(t('common.primary'))}</span>` : ''}
          <img src="${esc(urls.get(a.path) || '')}" alt="${esc(a.note || a.file_name || '')}" data-full="${esc(urls.get(a.path) || '')}" loading="lazy">
          <figcaption>${a.kind === 'damage' ? `<b>${esc(t('common.damage'))}</b> · ` : ''}${esc(a.note || '')}${a.note ? ' · ' : ''}${esc(fmtDateTime(a.created_at))}
            ${staff ? `<span class="row" style="gap:2px;margin-top:2px">
              ${a.kind === 'photo' && !a.is_primary ? `<button type="button" class="btn ghost sm" data-primary="${esc(a.id)}" title="${esc(t('common.setPrimary'))}">${icon('check')}</button>` : ''}
              <button type="button" class="btn ghost sm" data-del="${esc(a.id)}" title="${esc(t('btn.delete'))}" aria-label="${esc(t('btn.delete'))}">${icon('trash')}</button></span>` : ''}
          </figcaption>
        </figure>`).join('')}</div>` : `<p class="muted small">${esc(t('media.noPhotos'))}</p>`;

    const docHtml = docs.length ? `<div class="list">${docs.map((a) => `
        <div class="list-item">
          <div class="thumb thumb-empty">${icon('file')}</div>
          <div class="li-main"><a class="li-title" href="${esc(urls.get(a.path) || '#')}" target="_blank" rel="noopener">${esc(a.file_name || t('common.document'))}</a>
            <span class="li-sub">${esc(fmtDateTime(a.created_at))}${a.note ? ' · ' + esc(a.note) : ''}</span></div>
          ${staff ? `<div class="li-end"><button type="button" class="btn ghost sm" data-del="${esc(a.id)}" aria-label="${esc(t('btn.delete'))}">${icon('trash')}</button></div>` : ''}
        </div>`).join('')}</div>` : `<p class="muted small">${esc(t('media.noDocs'))}</p>`;

    container.innerHTML = `
      ${kinds.includes('photo') ? `<section class="section">
        <div class="section-head"><h2>${esc(t('common.photos'))}</h2>
          ${mayUpload ? `<button type="button" class="btn sm" data-add="photo">${icon('camera')}${esc(t('media.addPhoto'))}</button>` : ''}</div>
        ${photoHtml}</section>` : ''}
      ${kinds.includes('document') ? `<section class="section">
        <div class="section-head"><h2>${esc(t('common.documents'))}</h2>
          ${mayUpload ? `<button type="button" class="btn sm" data-add="document">${icon('file')}${esc(t('media.addDoc'))}</button>` : ''}</div>
        ${docHtml}</section>` : ''}`;

    container.querySelectorAll('.gallery img').forEach((img) => img.addEventListener('click', () => {
      if (img.dataset.full) openLightbox(img.dataset.full, img.alt);
    }));
    container.querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', async () => {
      const isPhoto = b.dataset.add === 'photo';
      const files = await pickFiles({
        accept: isPhoto ? 'image/*' : 'application/pdf,image/*,.doc,.docx,.xls,.xlsx,.txt,.csv',
      });
      if (!files.length) return;
      b.disabled = true;
      const old = b.innerHTML;
      b.textContent = t('common.uploading');
      await uploadMany(ctx, entity, entityId, files, { kind: isPhoto ? 'photo' : 'document' });
      b.disabled = false; b.innerHTML = old;
      load();
    }));
    container.querySelectorAll('[data-primary]').forEach((b) => b.addEventListener('click', async () => {
      try { await ctx.api.setPrimaryAttachment(b.dataset.primary); toast(t('media.primarySet')); load(); }
      catch (err) { toast(errorText(err), 'error'); }
    }));
    container.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
      const att = atts.find((a) => a.id === b.dataset.del);
      if (!att || !(await confirmSheet(t('btn.delete'), t('media.deleteConfirm'), { danger: true, okLabel: t('btn.delete') }))) return;
      try { await ctx.api.deleteAttachment(att); toast(t('media.deleted')); load(); }
      catch (err) { toast(errorText(err), 'error'); }
    }));
  }
  container.innerHTML = `<p class="muted small">${esc(t('common.loading'))}</p>`;
  await load();
}

// Nach der Rückgabe mit Mangel/Defekt: optional ein Schadenfoto aufnehmen (Knopf = Benutzeraktion für die Kamera)
export function uploadDamagePhoto(ctx, entity, entityId, { note = null, loanId = null } = {}) {
  return sheet({
    title: t('media.damageTitle'),
    body: `<p class="muted">${esc(t('media.damageText'))}</p>`,
    actions: [
      { label: t('media.skip'), kind: 'ghost', value: null },
      {
        label: t('media.damageTake'), kind: 'primary', icon: 'camera',
        onClick: async () => {
          const files = await pickFiles({ accept: 'image/*', multiple: true, capture: true });
          if (!files.length) return false;
          let last = null;
          for (const f of files) {
            if (f.size > MAX_BYTES) { toast(t('media.tooBig', { name: f.name }), 'error'); continue; }
            last = await ctx.api.uploadAttachment(entity, entityId, f, { kind: 'damage', note, loanId });
          }
          if (last) toast(t('media.uploaded'));
          return last;
        },
      },
    ],
  }).then((v) => v || null);
}
