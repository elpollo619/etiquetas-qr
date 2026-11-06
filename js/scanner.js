// QR-Scanner im Vollbild: BarcodeDetector (Android/Chrome) oder jsQR (iPhone, Desktop), Eingabe von Hand als Ersatz
import { t } from './i18n.js';
import { esc, icon, parseScanned } from './util.js';

let jsqrPromise = null;
function loadJsQR() {
  if (window.jsQR) return Promise.resolve(window.jsQR);
  if (!jsqrPromise) {
    jsqrPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = new URL('./vendor/jsQR.js', import.meta.url).href;
      s.onload = () => (window.jsQR ? resolve(window.jsQR) : reject(new Error('jsQR')));
      s.onerror = () => { jsqrPromise = null; reject(new Error('jsQR')); };
      document.head.appendChild(s);
    });
  }
  return jsqrPromise;
}
async function makeDetector() {
  if ('BarcodeDetector' in window) {
    try {
      const formats = await window.BarcodeDetector.getSupportedFormats();
      if (formats.includes('qr_code')) {
        const d = new window.BarcodeDetector({ formats: ['qr_code'] });
        return async (video) => { const r = await d.detect(video); return r.length ? r[0].rawValue : null; };
      }
    } catch (e) { /* weiter mit jsQR */ }
  }
  const jsQR = await loadJsQR();
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  return async (video) => {
    const vw = video.videoWidth, vh = video.videoHeight;
    if (!vw || !vh) return null;
    const scale = Math.min(1, 720 / Math.max(vw, vh));
    canvas.width = Math.round(vw * scale); canvas.height = Math.round(vh * scale);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const r = jsQR(img.data, canvas.width, canvas.height, { inversionAttempts: 'dontInvert' });
    return r ? r.data : null;
  };
}

export function openScanner({ title, hint, continuous = false, onCode } = {}) {
  const ov = document.createElement('div');
  ov.className = 'scanner';
  ov.setAttribute('role', 'dialog');
  ov.setAttribute('aria-modal', 'true');
  ov.setAttribute('aria-label', title || t('scan.title'));
  ov.innerHTML = `
    <video playsinline muted autoplay></video>
    <div class="scan-frame" aria-hidden="true"></div>
    <div class="scan-top">
      <strong>${esc(title || t('scan.title'))}</strong>
      <div class="row">
        <button type="button" class="icon-btn" data-torch hidden aria-label="${esc(t('scan.torch'))}" title="${esc(t('scan.torch'))}">${icon('alert')}</button>
        <button type="button" class="icon-btn" data-close aria-label="${esc(t('btn.close'))}">${icon('x')}</button>
      </div>
    </div>
    <div class="scan-bottom">
      <div class="scan-msg" aria-live="polite">${esc(t('scan.starting'))}</div>
      <div class="scan-hint">${esc(hint || t('scan.hint'))}</div>
      <form class="scan-manual" autocomplete="off">
        <input type="text" name="code" placeholder="${esc(t('scan.manual'))}" aria-label="${esc(t('scan.manual'))}" autocapitalize="characters">
        <button type="submit" class="btn">${esc(t('scan.go'))}</button>
      </form>
    </div>`;
  document.body.appendChild(ov);
  document.body.classList.add('no-scroll');
  const video = ov.querySelector('video');
  const msg = ov.querySelector('.scan-msg');
  const frame = ov.querySelector('.scan-frame');
  let stream = null, closed = false, busy = false, timer = 0, lastCode = '', lastAt = 0, lastBad = 0;

  function close() {
    if (closed) return;
    closed = true;
    clearTimeout(timer);
    if (stream) stream.getTracks().forEach((tr) => tr.stop());
    ov.remove();
    document.removeEventListener('keydown', onKey);
    if (!document.querySelector('.sheet-backdrop')) document.body.classList.remove('no-scroll');
  }
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  ov.querySelector('[data-close]').addEventListener('click', close);

  async function handle(text) {
    const code = parseScanned(text);
    if (!code) {
      if (Date.now() - lastBad > 2500) { lastBad = Date.now(); msg.textContent = t('scan.unknown', { text: String(text).slice(0, 40) }); }
      return;
    }
    if (code === lastCode && Date.now() - lastAt < 2500) return;
    lastCode = code; lastAt = Date.now();
    if (navigator.vibrate) try { navigator.vibrate(60); } catch (e) { /* egal */ }
    frame.classList.add('hit');
    setTimeout(() => frame.classList.remove('hit'), 500);
    msg.textContent = code;
    busy = true;
    try {
      if (!continuous) close();
      if (onCode) await onCode(code, text);
    } finally {
      busy = false;
    }
  }

  ov.querySelector('.scan-manual').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = e.target.elements.code.value;
    const code = parseScanned(v) || String(v || '').trim().toUpperCase();
    if (code) { e.target.elements.code.value = ''; lastCode = ''; handle(code); }
  });

  (async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('no camera');
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      if (closed) { stream.getTracks().forEach((tr) => tr.stop()); return; }
      video.srcObject = stream;
      await video.play().catch(() => {});
      const track = stream.getVideoTracks()[0];
      const caps = track && track.getCapabilities ? track.getCapabilities() : {};
      if (caps && caps.torch) {
        const b = ov.querySelector('[data-torch]');
        let on = false;
        b.hidden = false;
        b.addEventListener('click', async () => {
          on = !on;
          try { await track.applyConstraints({ advanced: [{ torch: on }] }); } catch (e) { /* egal */ }
        });
      }
      const detect = await makeDetector();
      msg.textContent = '';
      const loop = async () => {
        if (closed) return;
        if (!busy && video.readyState >= 2) {
          try {
            const text = await detect(video);
            if (text && !closed) await handle(text);
          } catch (e) { /* nächster Versuch */ }
        }
        if (!closed) timer = setTimeout(loop, 140);
      };
      loop();
    } catch (err) {
      msg.textContent = t('err.camera');
      const inp = ov.querySelector('.scan-manual input');
      if (inp) inp.focus();
    }
  })();

  return { close };
}
