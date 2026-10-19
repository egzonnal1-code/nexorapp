// NEXORA – Luajtësi i videos
// - Android / Android TV: luajtësi vendas ExoPlayer (HEVC/4K, zë Dolby, dekoderi i pajisjes)
// - Windows: ffmpeg brenda programit e kthen zërin (AC3/E-AC3/MP2) në AAC → luhet çdo kanal
// - Të tjerat (Samsung, LG, shfletues): hls.js / mpegts.js / MP4 direkt
// - Kanali hapet fillimisht si .ts (fillon më shpejt), nëse jo → .m3u8
// - Rilidhje automatike kur transmetimi ndalet në mes
// - Mesazhe të qarta: ofruesi, llogaria, kanali apo pajisja
import { tr } from './i18n.js';

let hls = null;
let ts = null;
let session = 0;
let watchdog = null;

// Buffer automatik: fillon shpejt, por mban mjaft rezervë që të mos ngecë
const BUF = { hlsSync: 3, hlsAhead: 30, tsStash: 128 * 1024 };

function clearWatchdog() {
  if (watchdog) { clearInterval(watchdog); watchdog = null; }
}

function destroyEngines(video) {
  if (hls) { try { hls.destroy(); } catch (e) {} hls = null; }
  if (ts) { try { ts.destroy(); } catch (e) {} ts = null; }
  if (video) {
    video.onerror = null;
    video.onplaying = null;
    video.removeAttribute('src');
    video.load();
  }
}

const kind = (url) => {
  const p = url.split('?')[0].toLowerCase();
  if (p.endsWith('.ts')) return 'ts';
  if (/\.(mp4|mkv|webm|mov|avi|m4v)$/.test(p)) return 'file';
  return 'hls';
};
const isXtreamLive = (url) => /\/live\//i.test(url.split('?')[0]) && kind(url) !== 'file';
const isVodUrl = (url) => kind(url) === 'file' || /\/(movie|series)\//i.test(url.split('?')[0]);

// ---------- Formati i preferuar për çdo kanal ----------
// Kanalet që luajnë vetëm si .m3u8 mbahen mend, që herën tjetër të hapen menjëherë
const FMT_KEY = 'nexora.fmt';
const keyOf = (url) => url.split('?')[0].replace(/\.(m3u8|ts)$/i, '');
function hlsOnly() {
  try { return JSON.parse(localStorage.getItem(FMT_KEY) || '[]'); } catch (e) { return []; }
}
function remember(url, needsHls) {
  try {
    const k = keyOf(url);
    let l = hlsOnly().filter((x) => x !== k);
    if (needsHls) l.push(k);
    if (l.length > 300) l = l.slice(-300);
    localStorage.setItem(FMT_KEY, JSON.stringify(l));
  } catch (e) { /* ruajtja nuk punon */ }
}
const tsOk = () => !!(window.mpegts && window.mpegts.getFeatureList().mseLivePlayback);

// Për kanalet live të Xtream: /live/u/p/123.ts ⇄ /live/u/p/123.m3u8
// .ts fillon zakonisht brenda 1–2 sekondash, ndërsa .m3u8 te shumë ofrues pret
// derisa serveri të përgatisë segmentet (5–10 s) – prandaj provohet i pari .ts.
function liveOrder(url, canTs) {
  const [path, q] = url.split('?');
  const qs = q ? '?' + q : '';
  const bare = path.replace(/\.(m3u8|ts)$/i, '');
  const tsU = bare + '.ts' + qs;
  const hlsU = bare + '.m3u8' + qs;
  if (!canTs || hlsOnly().includes(bare)) return [hlsU, tsU];
  return [tsU, hlsU];
}
function alternates(url) {
  if (isXtreamLive(url)) return liveOrder(url, tsOk());
  const [path, q] = url.split('?');
  const qs = q ? '?' + q : '';
  const list = [url];
  if (/\.m3u8$/i.test(path)) list.push(path.replace(/\.m3u8$/i, '.ts') + qs);
  else if (/\.ts$/i.test(path)) list.push(path.replace(/\.ts$/i, '.m3u8') + qs);
  return list;
}

// ---------- Windows: ffmpeg brenda programit ----------
let remuxBase = null;
if (location.protocol === 'app:') {
  fetch('app://nexora/__nx.json').then((r) => r.json()).then((j) => {
    if (j && j.remux) remuxBase = `http://127.0.0.1:${j.remux}/remux?`;
  }).catch(() => {});
}
const remuxUrl = (u, transcode) => `${remuxBase}u=${encodeURIComponent(u)}${transcode ? '&tx=1' : ''}`;

// Lista e provave: [{ url, eng: 'ts' | 'hls' | 'file', fmt?: url-i origjinal për kujtesën }]
function candidates(url) {
  const direct = alternates(url).map((u) => ({ url: u, eng: kind(u), fmt: u }));
  if (!remuxBase || !/^https?:/i.test(url)) return direct;
  if (isVodUrl(url)) {
    // filmat: direkt (me kërkim në kohë); nëse formati nuk luhet → përmes ffmpeg
    return [...direct, { url: remuxUrl(url), eng: 'ts' }];
  }
  const src = isXtreamLive(url) ? liveOrder(url, true)[0] : url;
  return [{ url: remuxUrl(src), eng: 'ts' }, ...direct, { url: remuxUrl(src, true), eng: 'ts' }];
}

function tryHls(video, url, id) {
  return new Promise((ok, fail) => {
    if (!(window.Hls && window.Hls.isSupported())) return fail('HLS nuk mbështetet');
    let netRetry = 0, mediaRetry = 0, started = false;
    hls = new window.Hls({
      enableWorker: true,
      lowLatencyMode: false,
      startFragPrefetch: true,
      initialLiveManifestSize: 1,
      liveSyncDurationCount: BUF.hlsSync,
      maxBufferLength: BUF.hlsAhead,
      maxMaxBufferLength: BUF.hlsAhead * 2,
      manifestLoadingMaxRetry: 2,
      levelLoadingMaxRetry: 3,
      fragLoadingMaxRetry: 4,
    });
    hls.on(window.Hls.Events.MANIFEST_PARSED, () => video.play().catch(() => {}));
    hls.on(window.Hls.Events.FRAG_BUFFERED, () => { if (!started) { started = true; ok(); } });
    hls.on(window.Hls.Events.ERROR, (_e, d) => {
      if (id !== session || !d.fatal) return;
      if (d.type === window.Hls.ErrorTypes.MEDIA_ERROR && mediaRetry++ < 2) { hls.recoverMediaError(); return; }
      if (d.type === window.Hls.ErrorTypes.NETWORK_ERROR && started && netRetry++ < 3) { hls.startLoad(); return; }
      const code = d.response && d.response.code ? ` ${d.response.code}` : '';
      fail(`HLS: ${d.details}${code}`);
    });
    hls.loadSource(url);
    hls.attachMedia(video);
  });
}

function tryTs(video, url, id) {
  return new Promise((ok, fail) => {
    const m = window.mpegts;
    if (!(m && m.getFeatureList().mseLivePlayback)) return fail('MPEG-TS nuk mbështetet');
    ts = m.createPlayer({ type: 'mpegts', isLive: true, url }, {
      enableStashBuffer: true,
      stashInitialSize: BUF.tsStash,
      liveBufferLatencyChasing: false,
      autoCleanupSourceBuffer: true,
    });
    ts.attachMediaElement(video);
    ts.on(m.Events.ERROR, (type, detail, info) => {
      if (id !== session) return;
      const code = info && info.code ? ` ${info.code}` : '';
      fail(`TS: ${detail || type}${code}`);
    });
    const onPlaying = () => { video.removeEventListener('playing', onPlaying); ok(); };
    video.addEventListener('playing', onPlaying);
    ts.load();
    Promise.resolve(ts.play()).catch(() => {});
  });
}

function tryFile(video, url, id) {
  return new Promise((ok, fail) => {
    video.onerror = () => { if (id === session) fail('VIDEO: ' + (video.error ? video.error.code : '?')); };
    video.onplaying = () => { video.onplaying = null; ok(); };
    video.src = url;
    video.play().catch(() => {});
  });
}

function withTimeout(p, ms) {
  return Promise.race([p, new Promise((_, f) => setTimeout(() => f('koha mbaroi'), ms))]);
}

// Mesazh i qartë për përdoruesin sipas arsyes teknike
function explain(reasons) {
  const all = reasons.join(' · ');
  if (/\b(401|403)\b/.test(all)) {
    return 'Ofruesi refuzoi qasjen (403). Kontrollo llogarinë: mund të ketë skaduar ose është hapur në shumë pajisje njëkohësisht.';
  }
  if (/\b404\b/.test(all)) return 'Ky kanal nuk ekziston më te ofruesi ose është jashtë funksionit.';
  if (/bufferAppend|codec|MEDIA|VIDEO: [34]|DECOD|FORMAT_UNSUPPORTED|EXCEEDS_CAPABILITIES/i.test(all)) {
    return 'Kjo pajisje nuk e luan dot formatin e këtij kanali (p.sh. HEVC/4K). Provo versionin FHD/HD.';
  }
  if (/\b5\d\d\b|koha mbaroi|LoadError|LoadTimeOut|NetworkError|Exception|nuk përgjigjet|IO_/i.test(all)) {
    return 'Serveri i ofruesit nuk përgjigjet. Ky problem është te ofruesi, jo te NEXORA – provo pas pak ose kontakto ofruesin.';
  }
  return 'Transmetimi nuk mund të luhet. Kanali mund të jetë jashtë funksionit te ofruesi.';
}

async function start(video, url, id) {
  const reasons = [];
  const list = candidates(url);
  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    if (id !== session) return { ok: false, reasons };
    try {
      const attempt = c.eng === 'ts' ? tryTs(video, c.url, id) : c.eng === 'file' ? tryFile(video, c.url, id) : tryHls(video, c.url, id);
      // nëse ka format rezervë, mos prit gjatë te i pari
      await withTimeout(attempt, i < list.length - 1 ? 6000 : 15000);
      if (c.fmt && isXtreamLive(c.fmt) && (c.eng === 'ts' || i > 0)) remember(c.fmt, c.eng === 'hls');
      return { ok: true, reasons, live: c.eng !== 'file' };
    } catch (e) {
      reasons.push(String(e));
      if (id !== session) return { ok: false, reasons };
      destroyEngines(video);
    }
  }
  return { ok: false, reasons };
}

// ---------- Android: luajtësi vendas (ExoPlayer) ----------
function nativePlugin() {
  const C = window.Capacitor;
  if (!C || !C.getPlatform || C.getPlatform() !== 'android') return null;
  if (C.isPluginAvailable && !C.isPluginAvailable('NexoraPlayer')) return null;
  const p = C.Plugins && C.Plugins.NexoraPlayer;
  return p && typeof p.play === 'function' ? p : null;
}

let nat = null; // { video, id, live }
let natHandler = null;
let natListening = false;
let rectTimer = null;
let lastRect = '';

function natListen(p) {
  if (natListening) return;
  natListening = true;
  ['ready', 'error', 'ended', 'retry'].forEach((ev) => p.addListener(ev, (d) => { if (natHandler) natHandler(ev, d || {}); }));
  // Klikimi mbi video (telefon / mi) → ekran i plotë
  p.addListener('click', () => window.dispatchEvent(new CustomEvent('nexora:videoclick')));
}

function rectOf(el) {
  if (!el || !el.isConnected) return { visible: false };
  const ov = document.getElementById('overlay');
  if (ov && !ov.hidden && !ov.contains(el)) return { visible: false };
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return { visible: false };
  return { visible: true, x: r.left, y: r.top, w: r.width, h: r.height };
}

function syncRect() {
  const p = nativePlugin();
  if (!p || !nat || !nat.live) return;
  const r = rectOf(nat.video);
  const k = JSON.stringify(r);
  if (k === lastRect) return;
  lastRect = k;
  p.setRect(r).catch(() => {});
}
function startRectLoop() {
  stopRectLoop();
  rectTimer = setInterval(syncRect, 250);
}
function stopRectLoop() {
  if (rectTimer) { clearInterval(rectTimer); rectTimer = null; }
}
window.addEventListener('resize', syncRect);
if (window.MutationObserver) {
  // ekran i plotë / dritaret → përshtat menjëherë pamjen e videos
  const mo = new MutationObserver(() => requestAnimationFrame(syncRect));
  const watchEls = () => {
    mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    const ov = document.getElementById('overlay');
    if (ov) mo.observe(ov, { attributes: true, attributeFilter: ['hidden'] });
  };
  if (document.body) watchEls(); else document.addEventListener('DOMContentLoaded', watchEls);
}

function nativeCandidates(url) {
  if (isXtreamLive(url)) return liveOrder(url, true).map((u) => ({ url: u, hls: /\.m3u8$/i.test(u.split('?')[0]) }));
  const path = url.split('?')[0];
  if (/\.m3u8$/i.test(path)) return [{ url, hls: true }];
  if (/\.ts$/i.test(path) || kind(url) === 'file') return [{ url, hls: false }];
  return [{ url, hls: false }, { url, hls: true }];
}

async function playNative(p, video, url, id, onError, onStatus) {
  natListen(p);
  const live = !(video.id === 'ov-video' && isVodUrl(url));
  nat = { video, id, live };
  const list = nativeCandidates(url);
  const reasons = [];
  if (live) startRectLoop();
  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    if (id !== session) return;
    const res = await new Promise((done) => {
      let fin = false;
      let t = null;
      const finish = (v) => { if (!fin) { fin = true; clearTimeout(t); done(v); } };
      t = setTimeout(() => finish({ ok: false, reason: 'koha mbaroi' }), i < list.length - 1 ? 6000 : 20000);
      natHandler = (ev, d) => {
        if (id !== session) return;
        if (ev === 'ready') finish({ ok: true });
        else if (ev === 'error') finish({ ok: false, reason: `${d.code || ''} ${d.http || ''}` });
      };
      const r = live ? rectOf(video) : { visible: true, full: true };
      lastRect = JSON.stringify(r);
      p.play({ url: c.url, hls: c.hls, live, controls: !live, ...r }).catch((e) => finish({ ok: false, reason: String(e) }));
    });
    if (id !== session) return;
    if (res.ok) {
      if (isXtreamLive(c.url) && (!c.hls || i > 0)) remember(c.url, c.hls);
      onStatus('');
      natHandler = (ev, d) => {
        if (id !== session) return;
        if (ev === 'retry') {
          const m = `Transmetimi u ndal – po rilidhet… (${Math.min(d.attempt || 1, 5)}/5)`;
          onStatus(m);
          p.setText({ text: tr(m) }).catch(() => {});
        } else if (ev === 'ready') {
          onStatus('');
        } else if (ev === 'error') {
          stopNative();
          onError(live
            ? 'Transmetimi u ndërpre disa herë. Serveri i ofruesit ose interneti nuk është i qëndrueshëm – provo pas pak.'
            : explain([`${d.code || ''} ${d.http || ''}`]));
        }
      };
      return;
    }
    reasons.push(res.reason);
  }
  if (id !== session) return;
  stopNative();
  console.warn('[NEXORA] Transmetimi dështoi:', url, reasons);
  onError(explain(reasons));
}

function stopNative() {
  stopRectLoop();
  natHandler = null;
  if (!nat) return;
  nat = null;
  const p = nativePlugin();
  if (p) p.stop().catch(() => {});
}

// ---------- API ----------
export function stop(video) {
  session++;
  clearWatchdog();
  stopNative();
  destroyEngines(null);
  if (video) {
    video.onerror = null;
    video.pause();
    video.removeAttribute('src');
    video.load();
  }
}

// A përdoret luajtësi vendas (Android)?
export function isNative() { return !!nativePlugin(); }

// onError(mesazh) – gabim përfundimtar; onStatus(mesazh|'') – njoftim i përkohshëm (p.sh. rilidhje)
export async function play(video, url, onError = () => {}, onStatus = () => {}) {
  stop(video);
  const id = session;
  if (!url) { onError('Ky element nuk ka adresë transmetimi.'); return; }
  const np = nativePlugin();
  if (np) { await playNative(np, video, url, id, onError, onStatus); return; }
  if (location.protocol === 'https:' && /^http:/i.test(url)) {
    onError('Ky transmetim përdor http:// dhe shfletuesi e bllokon në faqe https. Përdor aplikacionin.');
    return;
  }
  const res = await start(video, url, id);
  if (id !== session) return;
  if (!res.ok) {
    console.warn('[NEXORA] Transmetimi dështoi:', url, res.reasons);
    onError(explain(res.reasons));
    return;
  }
  onStatus('');
  if (res.live) watch(video, url, id, onError, onStatus);
}

// ---------- Rilidhja automatike (Windows / Samsung / LG / shfletues) ----------
// Nëse figura ngec mbi 12 sekonda (pa e ndalur përdoruesi), rinis kanalin vetë – deri në 5 herë.
function watch(video, url, id, onError, onStatus) {
  clearWatchdog();
  let lastTime = video.currentTime;
  let stuckSince = 0;
  let attempts = 0;
  let busy = false;
  watchdog = setInterval(async () => {
    if (id !== session) { clearWatchdog(); return; }
    if (busy || video.paused) { stuckSince = 0; lastTime = video.currentTime; return; }
    if (video.currentTime !== lastTime) {
      lastTime = video.currentTime;
      if (stuckSince) onStatus('');
      stuckSince = 0;
      return;
    }
    if (!stuckSince) { stuckSince = Date.now(); return; }
    if (Date.now() - stuckSince < 12000) return;
    if (attempts >= 5) {
      clearWatchdog();
      onError('Transmetimi u ndërpre disa herë. Serveri i ofruesit ose interneti nuk është i qëndrueshëm – provo pas pak.');
      return;
    }
    attempts++;
    busy = true;
    onStatus(`Transmetimi u ndal – po rilidhet… (${attempts}/5)`);
    destroyEngines(video);
    await new Promise((r) => setTimeout(r, Math.min(2000 * attempts, 8000)));
    if (id !== session) return;
    const res = await start(video, url, id);
    if (id !== session) return;
    busy = false;
    stuckSince = 0;
    lastTime = video.currentTime;
    if (res.ok) onStatus('');
  }, 2000);
}
