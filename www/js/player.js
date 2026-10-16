// NEXORA – Luajtësi i videos (HLS me hls.js, MPEG-TS me mpegts.js, MP4 direkt)
// Nëse një format dështon, provon automatikisht formatin tjetër (.m3u8 ⇄ .ts).
let hls = null;
let ts = null;
let session = 0;

export function stop(video) {
  session++;
  if (hls) { try { hls.destroy(); } catch {} hls = null; }
  if (ts) { try { ts.destroy(); } catch {} ts = null; }
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

// Për kanalet live të Xtream: /live/u/p/123.m3u8 ⇄ /live/u/p/123.ts
function alternates(url) {
  const list = [url];
  const [path, q] = url.split('?');
  const qs = q ? '?' + q : '';
  if (/\.m3u8$/i.test(path)) list.push(path.replace(/\.m3u8$/i, '.ts') + qs);
  else if (/\.ts$/i.test(path)) list.push(path.replace(/\.ts$/i, '.m3u8') + qs);
  else if (/\/live\/[^/]+\/[^/]+\/\d+$/i.test(path)) list.push(path + '.ts' + qs, path + '.m3u8' + qs);
  return list;
}

function tryHls(video, url, id) {
  return new Promise((ok, fail) => {
    if (!(window.Hls && window.Hls.isSupported())) return fail('HLS nuk mbështetet');
    let netRetry = 0, mediaRetry = 0, started = false;
    hls = new window.Hls({
      enableWorker: true,
      lowLatencyMode: false,
      manifestLoadingMaxRetry: 2,
      levelLoadingMaxRetry: 2,
      fragLoadingMaxRetry: 3,
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
      stashInitialSize: 384 * 1024,
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

// Pret deri 15 sekonda që të fillojë transmetimi; përndryshe kalon te formati tjetër.
function withTimeout(p, ms) {
  return Promise.race([p, new Promise((_, f) => setTimeout(() => f('koha mbaroi'), ms))]);
}

function cleanup(video) {
  if (hls) { try { hls.destroy(); } catch {} hls = null; }
  if (ts) { try { ts.destroy(); } catch {} ts = null; }
  video.onerror = null;
  video.onplaying = null;
  video.removeAttribute('src');
  video.load();
}

export async function play(video, url, onError = () => {}) {
  stop(video);
  const id = session;
  if (!url) { onError('Ky element nuk ka adresë transmetimi.'); return; }
  if (location.protocol === 'https:' && /^http:/i.test(url)) {
    onError('Ky transmetim përdor http:// dhe shfletuesi e bllokon në faqe https. Përdor versionin desktop.');
    return;
  }

  const reasons = [];
  for (const u of alternates(url)) {
    if (id !== session) return; // përdoruesi zgjodhi kanal tjetër
    const k = kind(u);
    try {
      const attempt = k === 'ts' ? tryTs(video, u, id) : k === 'file' ? tryFile(video, u, id) : tryHls(video, u, id);
      await withTimeout(attempt, 15000);
      return; // po luhet
    } catch (e) {
      reasons.push(String(e));
      if (id !== session) return;
      cleanup(video);
    }
  }
  if (id !== session) return;
  console.warn('[NEXORA] Transmetimi dështoi:', url, reasons);
  const all = reasons.join(' · ');
  let msg = 'Transmetimi nuk mund të luhet.';
  if (/\b(401|403)\b/.test(all)) msg += ' Serveri refuzoi qasjen (403) – kontrollo llogarinë ose numrin e lidhjeve të lejuara.';
  else if (/\b(404|5\d\d)\b/.test(all)) msg += ' Kanali është jashtë funksionit te ofruesi.';
  else if (/bufferAppend|codec|MEDIA|VIDEO: [34]/i.test(all)) msg += ' Formati i videos (p.sh. HEVC/H.265 te kanalet 4K) nuk mbështetet në këtë pajisje – provo versionin FHD/HD.';
  else msg += ' Kanali mund të jetë jashtë funksionit.';
  onError(msg + `\n(${all})`);
}
