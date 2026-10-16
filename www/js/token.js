// NEXORA – Lidhja me API Token
// Aplikacioni dërgon:  GET <URL e API-së>
//   - mënyra "header":  Authorization: Bearer <token>
//   - mënyra "query":   <URL>?token=<token>
// Serveri mund të kthejë ose një listë M3U, ose JSON në formatin e përshkruar në README.
import { fetchText } from './net.js';
import { parseM3U } from './m3u.js';

const arr = (x) => (Array.isArray(x) ? x : []);

function withToken(url, token) {
  const u = new URL(url);
  u.searchParams.set('token', token);
  return u.toString();
}

export async function loadToken(pl) {
  const url = pl.tokenMode === 'query' ? withToken(pl.apiUrl, pl.token) : pl.apiUrl;
  const headers = pl.tokenMode === 'query' ? {} : { Authorization: `Bearer ${pl.token}` };
  const { text, contentType } = await fetchText(url, { headers });
  const t = text.trim();

  if (/json/i.test(contentType) || t.startsWith('{') || t.startsWith('[')) {
    let j;
    try { j = JSON.parse(t); } catch { throw new Error('API ktheu JSON të pavlefshëm.'); }
    if (Array.isArray(j)) j = { channels: j };
    const live = arr(j.channels || j.live).map((c, i) => ({
      id: 't' + (c.id ?? i),
      num: c.number || c.num || i + 1,
      name: c.name || 'Pa emër',
      logo: c.logo || '',
      group: c.group || c.category || 'Të tjera',
      epgId: c.epg_id || c.epgId || c.tvg_id || '',
      url: c.url || c.stream_url || '',
    })).filter((c) => c.url);
    const movies = arr(j.movies || j.vod).map((m, i) => ({
      id: 'tv' + (m.id ?? i),
      name: m.name || 'Pa emër',
      logo: m.logo || m.poster || '',
      group: m.group || m.category || 'Të tjera',
      url: m.url || m.stream_url || '',
    })).filter((m) => m.url);
    const series = arr(j.series).map((s, i) => ({
      id: 'ts' + (s.id ?? i),
      name: s.name || 'Pa emër',
      logo: s.logo || s.poster || '',
      group: s.group || s.category || 'Të tjera',
      seasons: arr(s.seasons).map((se) => ({
        season: se.season ?? se.number ?? '',
        episodes: arr(se.episodes).map((e, k) => ({
          id: e.id ?? k, title: e.title || e.name || `Episodi ${k + 1}`, url: e.url || '',
        })).filter((e) => e.url),
      })),
    }));
    if (!live.length && !movies.length && !series.length) throw new Error('API nuk ktheu asnjë kanal.');
    return { live, movies, series, epgUrl: j.epg_url || j.epgUrl || null };
  }

  return parseM3U(text);
}
