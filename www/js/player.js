// NEXORA – Luajtësi i videos (HLS me hls.js, MPEG-TS me mpegts.js, MP4 direkt)
// - Nëse një format dështon, provon automatikisht formatin tjetër (.m3u8 ⇄ .ts)
// - Buffer i zgjedhshëm (i vogël / normal / i madh)
// - Rilidhje automatike kur transmetimi ndalet në mes
// - Mesazhe të qarta: ofruesi, llogaria, kanali apo pajisja
let hls = null;
let ts = null;
let session = 0;
let watchdog = null;

// ---------- Cilësimet e buffer-it ----------
const BUF_KEY = 'nexora.buffer';
export const BUFFERS = {
  small: { label: 'I vogël – fillon shpejt', hlsSync: 2, hlsAhead: 15, tsStash: 64 * 1024 },
  normal: { label: 'Normal', hlsSync: 3, hlsAhead: 30, tsStash: 128 * 1024 },
  large: { label: 'I madh – ngec më rrallë', hlsSync: 6, hlsAhead: 60, tsStash: 1024 * 1024 },
};
export function getBuffer() {
  try { const v = localStorage.getItem(BUF_KEY); return BUFFERS[v] ? v : 'normal'; } catch (e) { return 'normal'; }
}
export function setBuffer(v) {
  try { if (BUFFERS[v]) localStorage.setItem(BUF_KEY, v); } catch (e) { /* ruajtja nuk punon */ }
}

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

export function stop(video) {
  session++;
  clearWatchdog();
  destroyEngines(null);
  if (video) {
    video.onerror = null;
    video.pause();
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
// .ts (transmetim i drejtpërdrejtë) fillon zakonisht brenda 1–2 sekondash, ndërsa .m3u8 te shumë
// ofrues pret derisa serveri të përgatisë segmentet (5–10 s) – prandaj provohet i pari .ts.
function alternates(url) {
  const [path, q] = url.split('?');
  const qs = q ? '?' + q : '';
  if (!/\/live\//i.test(path) || /\.(mp4|mkv|webm|mov|avi|m4v)$/i.test(path)) {
    const list = [url];
    if (/\.m3u8$/i.test(path)) list.push(path.replace(/\.m3u8$/i, '.ts') + qs);
    else if (/\.ts$/i.test(path)) list.push(path.replace(/\.ts$/i, '.m3u8') + qs);
    return list;
  }
  const bare = path.replace(/\.(m3u8|ts)$/i, '');
  const tsU = bare + '.ts' + qs;
  const hlsU = bare + '.m3u8' + qs;
  if (!tsOk() || hlsOnly().includes(bare)) return [hlsU, tsU];
  return [tsU, hlsU];
}

function tryHls(video, url, id, buf) {
  return new Promise((ok, fail) => {
    if (!(window.Hls && window.Hls.isSupported())) return fail('HLS nuk mbështetet');
    let netRetry = 0, mediaRetry = 0, started = false;
    hls = new window.Hls({
      enableWorker: true,
      lowLatencyMode: false,
      startFragPrefetch: true,
      initialLiveManifestSize: 1,
      liveSyncDurationCount: buf.hlsSync,
      maxBufferLength: buf.hlsAhead,
      maxMaxBufferLength: buf.hlsAhead * 2,
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

function tryTs(video, url, id, buf) {
  return new Promise((ok, fail) => {
    const m = window.mpegts;
    if (!(m && m.getFeatureList().mseLivePlayback)) return fail('MPEG-TS nuk mbështetet');
    ts = m.createPlayer({ type: 'mpegts', isLive: true, url }, {
      enableStashBuffer: true,
      stashInitialSize: buf.tsStash,
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
  if (/bufferAppend|codec|MEDIA|VIDEO: [34]/i.test(all)) {
    return 'Kjo pajisje nuk e luan dot formatin e këtij kanali (p.sh. HEVC/4K). Provo versionin FHD/HD.';
  }
  if (/\b5\d\d\b|koha mbaroi|LoadError|LoadTimeOut|NetworkError|Exception|nuk përgjigjet/i.test(all)) {
    return 'Serveri i ofruesit nuk përgjigjet. Ky problem është te ofruesi, jo te NEXORA – provo pas pak ose kontakto ofruesin.';
  }
  return 'Transmetimi nuk mund të luhet. Kanali mund të jetë jashtë funksionit te ofruesi.';
}

async function start(video, url, id, buf) {
  const reasons = [];
  const list = alternates(url);
  for (let i = 0; i < list.length; i++) {
    const u = list[i];
    if (id !== session) return { ok: false, reasons };
    const k = kind(u);
    try {
      const attempt = k === 'ts' ? tryTs(video, u, id, buf) : k === 'file' ? tryFile(video, u, id) : tryHls(video, u, id, buf);
      // nëse ka format rezervë, mos prit gjatë te i pari
      await withTimeout(attempt, i < list.length - 1 ? 7000 : 15000);
      if (/\/live\//i.test(u) && (k === 'ts' || i > 0)) remember(u, k === 'hls');
      return { ok: true, reasons, url: u, live: k !== 'file' };
    } catch (e) {
      reasons.push(String(e));
      if (id !== session) return { ok: false, reasons };
      destroyEngines(video);
    }
  }
  return { ok: false, reasons };
}

// onError(mesazh) – gabim përfundimtar; onStatus(mesazh|'') – njoftim i përkohshëm (p.sh. rilidhje)
export async function play(video, url, onError = () => {}, onStatus = () => {}) {
  stop(video);
  const id = session;
  if (!url) { onError('Ky element nuk ka adresë transmetimi.'); return; }
  if (location.protocol === 'https:' && /^http:/i.test(url)) {
    onError('Ky transmetim përdor http:// dhe shfletuesi e bllokon në faqe https. Përdor aplikacionin.');
    return;
  }
  const buf = BUFFERS[getBuffer()];
  const res = await start(video, url, id, buf);
  if (id !== session) return;
  if (!res.ok) {
    console.warn('[NEXORA] Transmetimi dështoi:', url, res.reasons);
    onError(explain(res.reasons));
    return;
  }
  onStatus('');
  if (res.live) watch(video, url, id, buf, onError, onStatus);
}

// ---------- Rilidhja automatike ----------
// Nëse figura ngec mbi 12 sekonda (pa e ndalur përdoruesi), rinis kanalin vetë – deri në 5 herë.
function watch(video, url, id, buf, onError, onStatus) {
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
    const res = await start(video, url, id, buf);
    if (id !== session) return;
    busy = false;
    stuckSince = 0;
    lastTime = video.currentTime;
    if (res.ok) onStatus('');
  }, 2000);
}
