// NEXORA – Parser për lista M3U / M3U8 (format IPTV me #EXTINF)

function parseAttrs(line) {
  const out = {};
  const re = /([\w-]+)="([^"]*)"/g;
  let m;
  while ((m = re.exec(line))) out[m[1].toLowerCase()] = m[2];
  return out;
}

// Emri i kanalit vjen pas presjes së parë që nuk është brenda thonjëzave
function nameAfterComma(line) {
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') inQ = !inQ;
    else if (c === ',' && !inQ) return line.slice(i + 1).trim();
  }
  return '';
}

function classify(url, group) {
  const u = url.toLowerCase().split('?')[0];
  if (/\/movie\//.test(u)) return 'movies';
  if (/\/series\//.test(u)) return 'series';
  if (/\.(mp4|mkv|avi|mov|webm)$/.test(u)) {
    return /seri|series|sezon|season/i.test(group) ? 'series' : 'movies';
  }
  return 'live';
}

export function parseM3U(text) {
  if (!/#EXTM3U|#EXTINF/i.test(text.slice(0, 5000))) {
    throw new Error('Skedari nuk duket si listë M3U e vlefshme.');
  }
  const out = { live: [], movies: [], series: [], epgUrl: null };
  const lines = text.split(/\r?\n/);
  let cur = null;
  let grp = null;
  let n = 0;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('#EXTM3U')) {
      const a = parseAttrs(line);
      const e = a['url-tvg'] || a['x-tvg-url'] || a['tvg-url'];
      if (e) out.epgUrl = e.split(',')[0].trim();
      continue;
    }
    if (line.startsWith('#EXTINF')) {
      const a = parseAttrs(line);
      cur = {
        name: nameAfterComma(line) || a['tvg-name'] || 'Pa emër',
        logo: a['tvg-logo'] || '',
        group: a['group-title'] || '',
        epgId: a['tvg-id'] || '',
      };
      continue;
    }
    if (line.startsWith('#EXTGRP:')) { grp = line.slice(8).trim(); continue; }
    if (line.startsWith('#')) continue;
    if (cur) {
      cur.url = line;
      if (!cur.group) cur.group = grp || 'Të tjera';
      cur.id = 'm' + n++;
      out[classify(line, cur.group)].push(cur);
      cur = null;
      grp = null;
    }
  }
  out.live.forEach((c, i) => (c.num = i + 1));
  if (!out.live.length && !out.movies.length && !out.series.length) {
    throw new Error('Lista është bosh – nuk u gjet asnjë kanal.');
  }
  return out;
}
