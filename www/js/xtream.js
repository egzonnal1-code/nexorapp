// NEXORA – Lidhja me Xtream Codes API (server + përdorues + fjalëkalim)
import { fetchJson } from './net.js';

export function normBase(server) {
  let s = String(server || '').trim().replace(/\/+$/, '');
  s = s.replace(/\/(player_api\.php|get\.php).*$/i, '');
  if (!/^https?:\/\//i.test(s)) s = 'http://' + s;
  return s;
}

function urls(pl) {
  const base = normBase(pl.server);
  const u = encodeURIComponent(pl.user);
  const p = encodeURIComponent(pl.pass);
  return {
    base, u, p,
    api: (action = '', extra = '') =>
      `${base}/player_api.php?username=${u}&password=${p}${action ? `&action=${action}` : ''}${extra}`,
  };
}

// Shumë ofrues japin "M3U" si link Xtream: http://server/get.php?username=…&password=…
// Kjo listë mund të jetë qindra MB (mijëra filma/seriale). E ngarkojmë përmes API-së
// së Xtream – shumë më e shpejtë dhe pa kufi madhësie.
export function fromM3uUrl(m3uUrl) {
  try {
    const u = new URL(String(m3uUrl || '').trim());
    if (!/\/(get|player_api)\.php$/i.test(u.pathname)) return null;
    const user = u.searchParams.get('username');
    const pass = u.searchParams.get('password');
    if (!user || !pass) return null;
    const server = u.origin + u.pathname.replace(/\/(get|player_api)\.php$/i, '');
    return { server, user, pass };
  } catch { return null; }
}

// Kthen të dhënat Xtream për një listë (Xtream ose M3U me link get.php), ose null
export function credsOf(pl) {
  if (!pl) return null;
  if (pl.type === 'xtream') return pl;
  if (pl.type === 'm3u') {
    const c = fromM3uUrl(pl.m3uUrl);
    return c ? { ...pl, ...c } : null;
  }
  return null;
}

const arr = (x) => (Array.isArray(x) ? x : []);

export async function load(pl) {
  const { base, u, p, api } = urls(pl);
  const info = await fetchJson(api());
  if (!info || !info.user_info || Number(info.user_info.auth) !== 1) {
    throw new Error('Të dhënat e Xtream nuk u pranuan nga serveri.');
  }
  if (info.user_info.status && info.user_info.status !== 'Active') {
    throw new Error(`Llogaria nuk është aktive (status: ${info.user_info.status}).`);
  }
  const formats = arr(info.user_info.allowed_output_formats);
  const ext = formats.length === 0 || formats.includes('m3u8') ? 'm3u8' : 'ts';

  const safe = (a) => fetchJson(api(a)).catch(() => []);
  const [lc, ls, vc, vs, sc, ss] = await Promise.all([
    safe('get_live_categories'), safe('get_live_streams'),
    safe('get_vod_categories'), safe('get_vod_streams'),
    safe('get_series_categories'), safe('get_series'),
  ]);
  const catName = (list) => {
    const m = new Map();
    arr(list).forEach((c) => m.set(String(c.category_id), c.category_name));
    return (id) => m.get(String(id)) || 'Të tjera';
  };
  const lcN = catName(lc), vcN = catName(vc), scN = catName(sc);

  const live = arr(ls).map((s, i) => ({
    id: 'x' + s.stream_id,
    streamId: s.stream_id,
    num: s.num || i + 1,
    name: s.name || 'Pa emër',
    logo: s.stream_icon || '',
    group: lcN(s.category_id),
    epgId: s.epg_channel_id || '',
    url: `${base}/live/${u}/${p}/${s.stream_id}.${ext}`,
    catchup: Number(s.tv_archive) === 1,
  }));
  const movies = arr(vs).map((s) => ({
    id: 'v' + s.stream_id,
    name: s.name || 'Pa emër',
    logo: s.stream_icon || '',
    group: vcN(s.category_id),
    rating: s.rating || '',
    url: `${base}/movie/${u}/${p}/${s.stream_id}.${s.container_extension || 'mp4'}`,
  }));
  const series = arr(ss).map((s) => ({
    id: 's' + s.series_id,
    seriesId: s.series_id,
    name: s.name || 'Pa emër',
    logo: s.cover || '',
    group: scN(s.category_id),
    plot: s.plot || '',
  }));

  return {
    live, movies, series,
    epgUrl: `${base}/xmltv.php?username=${u}&password=${p}`,
    account: {
      expires: info.user_info.exp_date ? Number(info.user_info.exp_date) * 1000 : null,
      maxConnections: info.user_info.max_connections || null,
    },
  };
}

export async function seriesInfo(pl, seriesId) {
  const { base, u, p, api } = urls(pl);
  const data = await fetchJson(api('get_series_info', `&series_id=${encodeURIComponent(seriesId)}`));
  const seasons = [];
  const eps = data && data.episodes ? data.episodes : {};
  Object.keys(eps).sort((a, b) => Number(a) - Number(b)).forEach((season) => {
    seasons.push({
      season,
      episodes: arr(eps[season]).map((e) => ({
        id: e.id,
        title: e.title || `Episodi ${e.episode_num}`,
        num: e.episode_num,
        url: `${base}/series/${u}/${p}/${e.id}.${e.container_extension || 'mp4'}`,
      })),
    });
  });
  return { plot: data?.info?.plot || '', seasons };
}

function b64(s) {
  try {
    const bin = atob(s || '');
    return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  } catch { return s || ''; }
}

export async function shortEpg(pl, streamId) {
  const { api } = urls(pl);
  const data = await fetchJson(api('get_short_epg', `&stream_id=${encodeURIComponent(streamId)}&limit=12`));
  return arr(data && data.epg_listings).map((e) => ({
    start: Number(e.start_timestamp) * 1000,
    stop: Number(e.stop_timestamp) * 1000,
    title: b64(e.title),
    desc: b64(e.description),
  })).filter((e) => e.start && e.stop).sort((a, b) => a.start - b.start);
}
