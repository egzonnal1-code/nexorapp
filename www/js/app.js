// NEXORA – aplikacioni kryesor
import { loadDb, saveDb } from './store.js';
import { parseM3U } from './m3u.js';
import * as Xtream from './xtream.js';
import { fetchText } from './net.js';
import { Epg } from './epg.js';
import * as Player from './player.js';
import './tvnav.js';
import { getLanguage } from './i18n.js';

const $ = (s, r = document) => r.querySelector(s);
const view = $('#view');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeImg = (u) => (/^https?:\/\//i.test(u || '') ? esc(u) : '');
const locale = () => ({ sq: 'sq-AL', de: 'de-CH', en: 'en-US' })[getLanguage()];
const hhmm = (t) => new Date(t).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' });
const initials = (n) => esc(String(n || '?').replace(/[^\p{L}\p{N} ]/gu, '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '•');
const LIMIT = 400;

const ICONS = {
  tv: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M8 2l4 4 4-4M10 10l4 2.5-4 2.5z"/>',
  ball: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5l3.5 2.5-1.3 4h-4.4l-1.3-4zM12 3v4.5M15.5 10l5-1.5M14.2 14l3 4.5M9.8 14l-3 4.5M8.5 10l-5-1.5"/>',
  film: '<rect x="3" y="9" width="18" height="12" rx="1.5"/><path d="M3 9l16-5 1 3.2M7 7.7l2.5 2.8M12 6.2l2.5 2.8M10 13l5 2-5 2z"/>',
  series: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M10 9l5 3-5 3z"/>',
  star: '<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
};
const icon = (k, s = 48) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">${ICONS[k]}</svg>`;

let db = loadDb();
const S = {
  data: null,
  epg: new Epg(),
  loading: false,
  err: '',
  live: { group: '', q: '', sel: null },
  vod: { group: '', q: '' },
  ser: { group: '', q: '' },
  guide: { group: '' },
  tab: 'xtream',
  editId: null,
  formErr: '',
  draft: null,
  shortTried: new Set(),
};

const active = () => db.playlists.find((p) => p.id === db.activeId) || null;
const isFav = (id) => db.favorites.includes(id);

// ---------- Statusi ----------
function setStatus(msg, isErr = false) {
  const el = $('#status');
  el.hidden = !msg;
  el.textContent = msg || '';
  el.classList.toggle('err', isErr);
}

// ---------- Ngarkimi i listës ----------
async function loadActive({ quiet = false, silent = false } = {}) {
  const pl = active();
  S.data = null; S.err = ''; S.epg = new Epg(); S.shortTried.clear();
  S.live = { group: '', q: '', sel: null };
  if (!pl) { render(); return; }
  S.loading = true;
  setStatus(`Duke ngarkuar “${pl.name}”…`);
  if (!quiet) render(); else if (!silent) setup();
  try {
    let data;
    if (pl.type === 'xtream') data = await Xtream.load(pl);
    else if (pl.type === 'token') throw new Error('Lidhja me API Token nuk mbështetet më. Fshije këtë listë dhe shtoje si Xtream Codes ose M3U.');
    else if (Xtream.credsOf(pl)) data = await Xtream.load(Xtream.credsOf(pl));
    else { const { text } = await fetchText(pl.m3uUrl); data = parseM3U(text); }
    if (pl.epgUrl) data.epgUrl = pl.epgUrl;
    S.data = data;
    setStatus('');
    if (data.epgUrl) loadEpg(data.epgUrl);
  } catch (e) {
    S.err = e.message || String(e);
    setStatus('');
  }
  S.loading = false;
  if (!quiet) render();
}

async function loadEpg(url) {
  setStatus('Duke ngarkuar guidën e programeve (EPG)…');
  try {
    const { text } = await fetchText(url);
    S.epg.parse(text);
    setStatus('');
  } catch (e) {
    setStatus('Guida (EPG) nuk u ngarkua: ' + e.message, true);
    setTimeout(() => setStatus(''), 8000);
  }
  refreshEpg();
}

function refreshEpg() {
  const r = route();
  if (r === 'live') { renderChannelList(); renderLiveInfo(); }
  else if (r === '' || r === 'guida') render();
}

// Xtream: nëse mungon EPG e plotë, merr EPG të shkurtër për kanalin
async function ensureShortEpg(ch) {
  const pl = Xtream.credsOf(active());
  if (!pl || !ch.streamId || S.shortTried.has(ch.id)) return;
  if (S.epg.forChannel(ch).length) return;
  S.shortTried.add(ch.id);
  try {
    S.epg.setShort(ch, await Xtream.shortEpg(pl, ch.streamId));
    if (S.live.sel === ch.id) renderLiveInfo();
  } catch {}
}

// ---------- Router ----------
function route() { return location.hash.replace(/^#\/?/, '').split('?')[0]; }
const routes = { '': home, live, guida: guide, filma: movies, seriale: series, listat: lists, shto: setup, ligjore: legal };

const locked = () => !db.playlists.length;

function render() {
  const r = route();
  const vid = $('#live-video');
  if (vid && r !== 'live') Player.stop(vid);
  document.body.classList.toggle('locked', locked());
  document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('on', a.dataset.nav === r));
  // Pa playlistë: vetëm ekrani i aktivizimit (dhe faqja ligjore)
  // Pa listë: faqja e parë është "Shto listën tënde"
  if (locked() && r !== 'ligjore') { setup(); return; }
  (routes[r] || home)();
}

function needList() {
  if (S.loading) { view.innerHTML = '<div class="empty">Duke ngarkuar listën…</div>'; return true; }
  if (!active()) { setup(); return true; }
  if (S.err || !S.data) {
    view.innerHTML = `<div class="err-box"><strong>Lista nuk u ngarkua.</strong><br>${esc(S.err || 'Gabim i panjohur.')}</div>
      <div class="toolbar"><button class="btn" data-act="reload">Provo përsëri</button><a class="btn ghost" href="#/listat">Playlistat</a></div>`;
    return true;
  }
  return false;
}

// ---------- Kryefaqja ----------
function chLogo(ch) {
  const src = safeImg(ch.logo);
  return `<span class="logo-box">${src ? `<img src="${src}" alt="" loading="lazy" onerror="this.remove()">` : ''}${src ? '' : initials(ch.name)}</span>`;
}

function liveFilter(list, key) {
  if (key === '__fav') return list.filter((c) => isFav(c.id));
  if (key === '__sport') return list.filter((c) => /sport/i.test(c.group + ' ' + c.name));
  if (key === '__shqip') return list.filter((c) => /\b(al|alb|shqip|albania|kosov[eoa]|ks)\b|shqip|albani|kosov/i.test(c.group));
  if (key) return list.filter((c) => c.group === key);
  return list;
}

function home() {
  if (needList()) return;
  const { live, movies, series } = S.data;
  const favs = live.filter((c) => isFav(c.id));
  const top = (favs.length ? favs : []).concat(live.filter((c) => !isFav(c.id))).slice(0, 10);
  // Kanali kryesor në kryefaqe: gjithmonë SuperSport 1 (nëse ekziston në listë)
  const ss1 = live.filter((c) => /super\s*sport\s*1(?!\d)/i.test(c.name));
  const isAlb = (c) => /\b(alb|al)\b|shqip|albani|kosov/i.test(c.name + ' ' + c.group);
  const lead = ss1.find((c) => isAlb(c) && c.logo) || ss1.find(isAlb) || ss1.find((c) => c.logo) || ss1[0] || top[0];
  const vod = movies.filter((m) => m.logo).slice(0, 3);
  const fill = vod.length < 3 ? series.filter((m) => m.logo).slice(0, 3 - vod.length).map((s) => ({ ...s, isSeries: true })) : [];
  const side = vod.concat(fill);

  let heroHtml = '';
  if (lead) {
    const nn = S.epg.nowNext(lead);
    const logo = safeImg(lead.logo);
    heroHtml += `<button class="tile big ph" data-ch="${esc(lead.id)}">
      ${logo ? `<img class="mark" src="${logo}" alt="" onerror="this.remove()">` : ''}
      <span class="badge-live" style="align-self:flex-start">● LIVE</span>
      <span class="t-title">${esc(nn.cur ? nn.cur.title : lead.name)}</span>
      <span class="t-meta">${esc(lead.name)}${nn.cur ? ` · ${hhmm(nn.cur.start)}–${hhmm(nn.cur.stop)}` : ''}</span>
    </button>`;
  }
  side.forEach((m) => {
    heroHtml += `<button class="tile ph" ${m.isSeries ? `data-series="${esc(m.id)}"` : `data-movie="${esc(m.id)}"`}>
      <img class="cover" src="${safeImg(m.logo)}" alt="" loading="lazy" onerror="this.remove()">
      <span class="t-meta">${esc(m.group)}</span></button>`;
  });
  for (let i = side.length; i < 3 && lead; i++) {
    const c = top.filter((x) => x !== lead)[i];
    if (!c) break;
    heroHtml += `<button class="tile ph" data-ch="${esc(c.id)}"><span class="t-title">${esc(c.name)}</span><span class="t-meta">${esc(c.group)}</span></button>`;
  }

  view.innerHTML = `
    ${heroHtml ? `<section class="hero" aria-label="Të veçuara">${heroHtml}</section>` : ''}
    <section class="cats" aria-label="Kategoritë">
      <button class="cat cat-live" data-go="live" data-filter="">${icon('tv')}<span>LIVE TV</span></button>
      <button class="cat cat-sport" data-go="live" data-filter="__sport">${icon('ball')}<span>SPORT</span></button>
      <button class="cat cat-film" data-go="filma">${icon('film')}<span>FILMA</span></button>
      <button class="cat cat-series" data-go="seriale">${icon('series')}<span>SERIALE</span></button>
      <button class="cat cat-sq" data-go="live" data-filter="__shqip">${icon('star')}<span>SHQIP</span></button>
    </section>
    ${top.length ? `<section class="sec" aria-labelledby="h-now">
      <div class="sec-head"><h2 id="h-now">Live tani</h2><a href="#/live">Të gjitha (${live.length})</a></div>
      <div class="now-grid">${top.map((c) => {
        const nn = S.epg.nowNext(c);
        return `<button class="now-card" data-ch="${esc(c.id)}">${chLogo(c)}
          <span class="txt"><span class="ell">${esc(c.name)}</span>
          <span class="sub ell">${esc(nn.cur ? nn.cur.title : c.group)}</span>
          ${nn.cur ? `<span class="bar"><i style="width:${nn.pct}%"></i></span>` : ''}</span></button>`;
      }).join('')}</div></section>` : ''}`;
}

// ---------- Live TV ----------
function groupsOf(list, skipFixed = false) {
  const g = [...new Set(list.map((c) => c.group))];
  return skipFixed ? g.filter((x) => !['sport', 'shqip'].includes(x.trim().toLowerCase())) : g;
}

function liveGroupsList(chs) {
  const fixed = [
    { key: '', name: 'Të gjitha', count: chs.length },
    { key: '__fav', name: 'Të preferuarat', count: liveFilter(chs, '__fav').length },
    { key: '__sport', name: 'Sport', count: liveFilter(chs, '__sport').length },
    { key: '__shqip', name: 'Shqip', count: liveFilter(chs, '__shqip').length },
  ].filter((g) => g.key === '' || g.key === '__fav' || g.count);
  const groups = groupsOf(chs, true).map((name) => ({
    key: name, name: name || 'Pa kategori', count: chs.filter((ch) => ch.group === name).length,
  }));
  return fixed.concat(groups);
}

function renderGroupList() {
  const box = $('#lv-groups');
  if (!box || !S.data) return;
  box.innerHTML = liveGroupsList(S.data.live).map((g) => `<button class="lv-g ${S.live.group === g.key ? 'on' : ''}" data-lgroup="${esc(g.key)}">
      <span class="ell">${esc(g.name)}</span><span class="cnt">${g.count}</span></button>`).join('');
}

function live() {
  if (needList()) return;
  const chs = S.data.live;
  if (!chs.length) { view.innerHTML = '<div class="empty">Kjo listë nuk ka kanale live.</div>'; return; }
  view.innerHTML = `
    <div class="lv">
      <nav class="lv-col lv-groups" id="lv-groups" aria-label="Grupet e kanaleve"></nav>
      <aside class="lv-col lv-chs" aria-label="Lista e kanaleve">
        <label class="search">${icon('search', 18)}<span class="sr">Kërko kanal</span>
          <input type="search" id="live-q" placeholder="Kërko kanal…" value="${esc(S.live.q)}"></label>
        <div class="ch-list" id="ch-list"></div>
      </aside>
      <section class="lv-player" aria-label="Luajtësi">
        <div class="player">
          <video id="live-video" controls playsinline></video>
          <span class="badge-live">● LIVE</span>
          <div class="player-msg" id="player-msg">Zgjidh një kanal nga lista.</div>
          <div class="player-status" id="player-status" hidden></div>
        </div>
        <div class="live-info" id="live-info"></div>
        <div class="mini-epg" id="live-epg"></div>
      </section>
    </div>`;
  renderGroupList();
  renderChannelList();
  const sel = chs.find((c) => c.id === S.live.sel);
  if (sel) playChannel(sel); else renderLiveInfo();
}

function filteredChannels() {
  const q = S.live.q.trim().toLowerCase();
  let list = liveFilter(S.data.live, S.live.group);
  if (q) list = list.filter((c) => c.name.toLowerCase().includes(q) || String(c.num) === q);
  return list;
}

function renderChannelList() {
  const box = $('#ch-list');
  if (!box || !S.data) return;
  const list = filteredChannels();
  if (!list.length) { box.innerHTML = '<div class="more">Asnjë kanal në këtë kategori.</div>'; return; }
  box.innerHTML = list.slice(0, LIMIT).map((c) => {
    const nn = S.epg.nowNext(c);
    return `<button class="ch ${S.live.sel === c.id ? 'on' : ''}" data-ch="${esc(c.id)}">
      <span class="n">${esc(c.num)}</span>${chLogo(c)}
      <span class="txt"><span class="ell">${esc(c.name)}${isFav(c.id) ? ' <span class="fav">★</span>' : ''}</span>
      <span class="sub ell">${esc(nn.cur ? nn.cur.title : c.group)}</span></span></button>`;
  }).join('') + (list.length > LIMIT ? `<div class="more">+ ${list.length - LIMIT} kanale të tjera – përdor kërkimin.</div>` : '');
}

function renderLiveInfo() {
  const info = $('#live-info');
  const box = $('#live-epg');
  if (!info || !box) return;
  const ch = S.data.live.find((c) => c.id === S.live.sel);
  if (!ch) { info.innerHTML = ''; box.innerHTML = ''; box.hidden = true; return; }
  const nn = S.epg.nowNext(ch);
  info.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:6px;min-width:0">
      <span class="sub"><span class="mono">${esc(ch.num)}</span> · ${esc(ch.name)} · ${esc(ch.group)}</span>
      <h1>${esc(nn.cur ? nn.cur.title : ch.name)}</h1>
      ${nn.cur ? `<span class="sub mono">${hhmm(nn.cur.start)} – ${hhmm(nn.cur.stop)}</span><span class="bar" style="max-width:420px"><i style="width:${nn.pct}%"></i></span>` : '<span class="sub">Nuk ka të dhëna EPG për këtë kanal.</span>'}
      ${nn.next ? `<span class="sub">Në vazhdim: ${hhmm(nn.next.start)} ${esc(nn.next.title)}</span>` : ''}
    </div>
    <div class="toolbar">
      <button class="btn ghost small" data-fav="${esc(ch.id)}">${isFav(ch.id) ? '★ Hiq nga të preferuarat' : '☆ Shto te të preferuarat'}</button>
      <button class="btn ghost small" data-act="fullscreen">Ekran i plotë</button>
      <button class="btn ghost small" data-act="live-search">Kërko</button>
    </div>`;
  const now = Date.now();
  const upcoming = nn.list.filter((p) => p.stop > now).slice(0, 6);
  box.hidden = !upcoming.length;
  box.innerHTML = upcoming.map((p) => `<div class="row ${p.start <= now ? 'on' : ''}">
    <span class="tm">${hhmm(p.start)}</span>
    <span style="display:flex;flex-direction:column;gap:2px;min-width:0"><span>${esc(p.title)}</span>${p.desc ? `<span class="sub">${esc(p.desc.slice(0, 180))}${p.desc.length > 180 ? '…' : ''}</span>` : ''}</span></div>`).join('');
}

function playChannel(ch) {
  S.live.sel = ch.id;
  const video = $('#live-video');
  const msg = $('#player-msg');
  document.querySelectorAll('.ch.on').forEach((b) => b.classList.remove('on'));
  const btn = document.querySelector(`.ch[data-ch="${CSS.escape(ch.id)}"]`);
  if (btn) { btn.classList.add('on'); btn.scrollIntoView({ block: 'nearest' }); }
  msg.hidden = true;
  const status = $('#player-status');
  if (status) status.hidden = true;
  Player.play(video, ch.url, (m) => { msg.textContent = m; msg.hidden = false; if (status) status.hidden = true; },
    (m) => { if (status) { status.textContent = m; status.hidden = !m; } });
  renderLiveInfo();
  ensureShortEpg(ch);
}

// ---------- Guida ----------
function guide() {
  if (needList()) return;
  const chs = S.data.live;
  const groups = groupsOf(chs, true);
  const span = 3 * 3600e3;
  const now = Date.now();
  const ws = Math.floor(now / 1800e3) * 1800e3 - 1800e3;
  const we = ws + span;
  const list = liveFilter(chs, S.guide.group).slice(0, 120);
  const pos = (t) => ((Math.min(Math.max(t, ws), we) - ws) / span) * 100;
  const chip = (key, label) => `<button class="chip ${S.guide.group === key ? 'on' : ''}" data-ggroup="${esc(key)}">${esc(label)}</button>`;
  const times = Array.from({ length: 6 }, (_, i) => `<span>${hhmm(ws + i * 1800e3)}</span>`).join('');
  const rows = list.map((c) => {
    const progs = S.epg.forChannel(c).filter((p) => p.stop > ws && p.start < we);
    const cells = progs.map((p) => {
      const on = p.start <= now && p.stop > now;
      return `<button class="g-prog ${on ? 'on' : ''}" data-ch="${esc(c.id)}" style="left:calc(${pos(p.start)}% + 2px);width:calc(${pos(p.stop) - pos(p.start)}% - 4px)" title="${esc(p.title)}">
        <span class="ell">${esc(p.title)}</span><span class="tm">${hhmm(p.start)}–${hhmm(p.stop)}</span></button>`;
    }).join('');
    return `<div class="g-row"><button class="g-name" data-ch="${esc(c.id)}">${chLogo(c)}<span class="ell">${esc(c.name)}</span></button>
      <div class="g-track">${cells || '<span class="g-none">Pa të dhëna EPG</span>'}<span class="g-now" style="left:${pos(now)}%"></span></div></div>`;
  }).join('');
  view.innerHTML = `
    <div class="sec-head"><h2>Guida e programeve</h2><span class="sub">${S.epg.loaded ? 'EPG e ngarkuar' : 'EPG ende nuk është ngarkuar'}${chs.length > 120 && !S.guide.group ? ' · shfaqen 120 kanalet e para, zgjidh kategorinë' : ''}</span></div>
    <div class="chips" role="group" aria-label="Kategoritë">${chip('', 'Të gjitha')}${chip('__fav', '★ Të preferuarat')}${chip('__sport', 'Sport')}${chip('__shqip', 'Shqip')}${groups.map((g) => chip(g, g)).join('')}</div>
    <div class="guide"><div class="guide-in">
      <div class="g-head"><span class="g-name sub">Kanali</span><div class="g-times">${times}</div></div>
      ${rows || '<div class="more">Asnjë kanal në këtë kategori.</div>'}
    </div></div>
    ${!S.epg.loaded ? `<p class="hint">Për guidë të plotë shto “URL e EPG” (XMLTV) te Listat. Për Xtream, guida shkarkohet automatikisht nga serveri.</p>` : ''}`;
}

// ---------- Filma & Seriale ----------
function gridView(kind) {
  if (needList()) return;
  const st = kind === 'movies' ? S.vod : S.ser;
  const all = S.data[kind];
  if (!all.length) { view.innerHTML = `<div class="empty">Kjo listë nuk ka ${kind === 'movies' ? 'filma' : 'seriale'}.</div>`; return; }
  const groups = groupsOf(all);
  const q = st.q.trim().toLowerCase();
  let list = st.group ? all.filter((m) => m.group === st.group) : all;
  if (q) list = list.filter((m) => m.name.toLowerCase().includes(q));
  const attr = kind === 'movies' ? 'data-movie' : 'data-series';
  view.innerHTML = `
    <div class="toolbar">
      <label class="search">${icon('search', 18)}<span class="sr">Kërko</span>
        <input type="search" id="grid-q" data-kind="${kind}" placeholder="Kërko ${kind === 'movies' ? 'filma' : 'seriale'}…" value="${esc(st.q)}"></label>
      <label class="field" style="flex:0 1 280px"><span class="sr">Kategoria</span>
        <select id="grid-group" data-kind="${kind}"><option value="">Të gjitha kategoritë</option>
        ${groups.map((g) => `<option ${g === st.group ? 'selected' : ''}>${esc(g)}</option>`).join('')}</select></label>
      <span class="sub">${list.length} tituj</span>
    </div>
    <div class="posters">${list.slice(0, LIMIT).map((m) => {
      const src = safeImg(m.logo);
      return `<button class="poster" ${attr}="${esc(m.id)}"><span class="pic ph">${src ? `<img src="${src}" alt="" loading="lazy" onerror="this.remove()">` : 'NEXORA'}</span>
        <span class="ell">${esc(m.name)}</span><span class="sub ell" style="margin-top:-6px">${esc(m.group)}</span></button>`;
    }).join('')}</div>
    ${list.length > LIMIT ? `<p class="hint">Shfaqen ${LIMIT} nga ${list.length}. Përdor kërkimin ose kategoritë.</p>` : ''}`;
}
function movies() { gridView('movies'); }
function series() { gridView('series'); }

// ---------- Dritarja e luajtjes ----------
function openOverlay(title, html) {
  $('#ov-title').textContent = title;
  $('#ov-body').innerHTML = html;
  $('#overlay').hidden = false;
  $('#ov-close').focus();
}
function closeOverlay() {
  const v = $('#ov-video');
  if (v) Player.stop(v);
  $('#overlay').hidden = true;
  $('#ov-body').innerHTML = '';
}
function playInOverlay(title, url) {
  openOverlay(title, `<div class="player"><video id="ov-video" controls playsinline autoplay></video><div class="player-msg" id="ov-msg" hidden></div><div class="player-status" id="ov-status" hidden></div></div>`);
  Player.play($('#ov-video'), url, (m) => { const el = $('#ov-msg'); el.textContent = m; el.hidden = false; },
    (m) => { const st = $('#ov-status'); if (st) { st.textContent = m; st.hidden = !m; } });
}
async function openSeries(s) {
  const pl = active();
  let info = s.seasons ? { plot: s.plot || '', seasons: s.seasons } : null;
  if (!info && s.seriesId && Xtream.credsOf(pl)) {
    openOverlay(s.name, '<div class="more">Duke ngarkuar episodet…</div>');
    try { info = await Xtream.seriesInfo(Xtream.credsOf(pl), s.seriesId); } catch (e) {
      $('#ov-body').innerHTML = `<div class="err-box">${esc(e.message)}</div>`; return;
    }
  }
  if (!info) { playInOverlay(s.name, s.url); return; }
  if (!info.seasons.length) { openOverlay(s.name, '<div class="more">Nuk u gjet asnjë episod.</div>'); return; }
  openOverlay(s.name, `${info.plot ? `<p class="hint">${esc(info.plot)}</p>` : ''}
    ${info.seasons.map((se) => `<div class="sec"><h3>Sezoni ${esc(se.season)}</h3><div class="eps">
      ${se.episodes.map((e) => `<button class="ep" data-ep="${esc(e.url)}" data-title="${esc(s.name + ' – ' + e.title)}"><span class="mono sub">${esc(e.num ?? '')}</span><span>${esc(e.title)}</span></button>`).join('')}
    </div></div>`).join('')}`);
}

// ---------- Shto listën tënde (faqja e parë) ----------
const TYPE_NAME = { m3u: 'M3U URL', xtream: 'Xtream Codes', token: 'API Token (jo më)' };

function setup() {
  const pl = S.editId ? db.playlists.find((p) => p.id === S.editId) : null;
  const tab = pl ? pl.type : S.tab;
  const src = pl || (S.draft && S.draft.type === tab ? S.draft : null);
  const v = (k) => esc(src ? src[k] || '' : '');
  const first = !db.playlists.some((p) => !S.draft || p.id !== S.draft.id);
  view.innerHTML = `
    <div class="setup">
      <section class="setup-form" aria-labelledby="h-add">
        <div class="setup-inner">
          <div class="setup-head">
            <h2 id="h-add">${pl ? 'Ndrysho listën' : 'Shto listën tënde'}</h2>
            <p>Zgjidh mënyrën e lidhjes me ofruesin tënd.</p>
          </div>
          <div class="seg" role="tablist" aria-label="Mënyra e lidhjes">
            ${['xtream', 'm3u'].map((t) => `<button type="button" role="tab" aria-selected="${tab === t}" class="${tab === t ? 'on' : ''}" data-tab="${t}" ${pl ? 'disabled' : ''}>${TYPE_NAME[t]}</button>`).join('')}
          </div>
          <form class="form" id="pl-form" autocomplete="off">
            <label class="field">Emri i listës<input name="name" required maxlength="60" placeholder="p.sh. Shtëpia" value="${v('name')}"></label>
            ${tab === 'xtream' ? `
              <label class="field">URL e serverit<input class="mono" name="server" required placeholder="http://server.com:8080" value="${v('server')}"></label>
              <div class="two">
                <label class="field">Përdoruesi<input name="user" required autocomplete="off" value="${v('user')}"></label>
                <label class="field">Fjalëkalimi<input name="pass" type="password" required autocomplete="new-password" value="${v('pass')}"></label>
              </div>` : ''}
            ${tab === 'm3u' ? `
              <label class="field">URL e listës M3U<input class="mono" name="m3uUrl" type="url" required placeholder="https://…/playlist.m3u" value="${v('m3uUrl')}"></label>` : ''}
            ${tab === 'm3u' ? `<label class="field">URL e EPG – guida (opsionale)<input class="mono" name="epgUrl" type="url" placeholder="https://…/epg.xml.gz" value="${v('epgUrl')}"></label>` : ''}
            <label class="check"><input type="checkbox" name="legal" required ${src ? 'checked' : ''}>
              <span>Konfirmoj që kjo listë është imja ose e ofruesit tim të licencuar dhe që kam të drejtë ligjore ta shikoj këtë përmbajtje. (<a href="#/ligjore" style="text-decoration:underline">Kushtet</a>)</span></label>
            ${S.formErr ? `<div class="err-box" role="alert">${esc(S.formErr)}</div>` : ''}
            <button class="btn accent big" type="submit" ${S.loading ? 'disabled' : ''}>${S.loading ? 'Duke u lidhur…' : (pl ? 'Ruaj ndryshimet' : 'Lidhu')}</button>
            ${!first ? `<a class="btn ghost" href="#/listat" data-act="cancel-edit">Anulo</a>` : ''}
          </form>
          <p class="hint">NEXORA është vetëm luajtës – nuk ofron kanale. Të dhënat ruhen vetëm në këtë pajisje.</p>
        </div>
      </section>
    </div>`;
}

async function saveForm(form) {
  const f = Object.fromEntries(new FormData(form).entries());
  const old = S.editId ? db.playlists.find((p) => p.id === S.editId) : null;
  const type = old ? old.type : S.tab;
  const pl = { id: old ? old.id : 'p' + Date.now(), type, name: (f.name || '').trim(), epgUrl: (f.epgUrl || '').trim() };
  if (type === 'm3u') pl.m3uUrl = f.m3uUrl.trim();
  if (type === 'xtream') Object.assign(pl, { server: f.server.trim(), user: f.user.trim(), pass: f.pass });

  // Provo lidhjen para se ta ruash, që klienti ta dijë menjëherë nëse të dhënat janë gabim
  const prev = { playlists: db.playlists, activeId: db.activeId };
  db.playlists = old ? db.playlists.map((p) => (p.id === old.id ? pl : p)) : [...db.playlists, pl];
  db.activeId = pl.id;
  S.formErr = '';
  S.draft = old ? null : pl;
  await loadActive({ quiet: true });
  if (S.err) {
    S.formErr = 'Lidhja dështoi: ' + S.err;
    db.playlists = prev.playlists;
    db.activeId = prev.activeId;
    S.err = '';
    S.data = null;
    if (prev.activeId) loadActive({ quiet: true, silent: true });
    render();
    return;
  }
  S.editId = null;
  S.draft = null;
  saveDb(db);
  if (location.hash === '#/' || location.hash === '') render(); else location.hash = '#/';
}

// ---------- Listat e mia ----------
function lists() {
  view.innerHTML = `
    <section class="card" aria-labelledby="h-saved" style="max-width:820px">
      <div class="sec-head"><h2 id="h-saved">Listat e mia</h2><a class="btn accent small" href="#/shto" data-act="new-list">+ Shto listë</a></div>
      ${db.playlists.map((p) => `
        <div class="pl ${p.id === db.activeId ? 'on' : ''}">
          <span class="txt"><span class="ell" style="display:block">${esc(p.name)}</span><span class="sub">${TYPE_NAME[p.type] || p.type}${p.id === db.activeId ? ' · aktive' : ''}</span></span>
          ${p.id !== db.activeId ? `<button class="btn small" data-pl-use="${esc(p.id)}">Përdor</button>` : `<button class="btn ghost small" data-act="reload">Rifresko</button>`}
          <button class="btn ghost small" data-pl-edit="${esc(p.id)}">Ndrysho</button>
          <button class="btn ghost small" data-pl-del="${esc(p.id)}" aria-label="Fshi ${esc(p.name)}">Fshi</button>
        </div>`).join('')}
      ${S.data && S.data.account && S.data.account.expires ? `<p class="hint">Llogaria Xtream skadon më: ${new Date(S.data.account.expires).toLocaleDateString(locale())}</p>` : ''}
      <p class="hint">Të dhënat ruhen vetëm në këtë pajisje. NEXORA nuk i merr dhe nuk i ruan në server.</p>
    </section>
    <section class="card" aria-labelledby="h-play" style="max-width:820px">
      <div class="sec-head"><h2 id="h-play">Luajtja</h2></div>
      <div class="field"><span>Buffer-i (sa video ngarkohet përpara)</span>
        <div class="seg seg-3" role="radiogroup" aria-label="Buffer-i">
          ${Object.entries(Player.BUFFERS).map(([k, b]) => `<button type="button" role="radio" aria-checked="${Player.getBuffer() === k}" class="${Player.getBuffer() === k ? 'on' : ''}" data-buffer="${k}">${b.label}</button>`).join('')}
        </div>
      </div>
      <p class="hint">Nëse kanalet ngecin shpesh, zgjidh “I madh”. Kanali fillon pak më ngadalë, por ngec më rrallë. Kur transmetimi ndalet, NEXORA rilidhet vetë.</p>
    </section>`;
}

// ---------- Ligjore ----------
function legal() {
  view.innerHTML = `<article class="legal">
    <h1>Kushtet, Privatësia &amp; Impressum</h1>
    <h2>Çfarë është NEXORA</h2>
    <p>NEXORA është një luajtës mediash (softuer). Ai <strong>nuk ofron, nuk shet, nuk transmeton dhe nuk ruan</strong> asnjë kanal televiziv, film, serial apo përmbajtje tjetër. Aplikacioni nuk përmban asnjë listë kanalesh të parainstaluar.</p>
    <h2>Përgjegjësia e përdoruesit</h2>
    <ul>
      <li>Ti shton vetë listën tënde (M3U ose Xtream Codes) nga ofruesi yt, direkt në program.</li>
      <li>Përdor vetëm lista dhe përmbajtje për të cilat ke të drejtë ligjore (p.sh. abonim te një ofrues i licencuar, kanale falas/FTA, lista të tuat).</li>
      <li>Shikimi ose shpërndarja e përmbajtjes pa licencë mund të shkelë ligjin për të drejtat e autorit (në Zvicër: URG). NEXORA nuk mban përgjegjësi për përmbajtjen që shton përdoruesi.</li>
    </ul>
    <h2>Privatësia</h2>
    <ul>
      <li>Listat dhe të dhënat e hyrjes ruhen <strong>vetëm lokalisht</strong> në pajisjen tënde. NEXORA nuk ka server me të dhënat e klientëve.</li>
      <li>Fshirja: te “Listat e mia” fshin çdo listë; ose çinstalo programin / pastro të dhënat e faqes.</li>
      <li>Kur serveri i ofruesit nuk lejon qasje direkte nga shfletuesi (CORS), lista/EPG mund të kalojë përmes një proxy teknik në Netlify. Proxy nuk ruan dhe nuk regjistron përmbajtje. Videoja nuk kalon kurrë përmes serverëve të NEXORA.</li>
      <li>Nuk përdorim cookies për reklama apo gjurmim.</li>
    </ul>
    <h2>Ofruesit e përmbajtjes</h2>
    <p>Markat dhe emrat e kanaleve që mund të shfaqen në listën tënde u përkasin pronarëve përkatës. NEXORA nuk ka lidhje me ta.</p>
    <h2>Impressum</h2>
    <p>NEXORA – Webdesign &amp; Software<br>Egzon Aliti<br>5600 Lenzburg, Zvicër<br>E-mail: <a href="mailto:egz0nn@live.com" style="text-decoration:underline">egz0nn@live.com</a><br>Web: <a href="https://nexoraweb.ch" style="text-decoration:underline">nexoraweb.ch</a></p>
  </article>`;
}

// ---------- Ngjarjet ----------
view.addEventListener('click', (e) => {
  const t = e.target.closest('button, a');
  if (!t) return;
  const d = t.dataset;
  if (d.ch !== undefined) {
    const ch = S.data && S.data.live.find((c) => c.id === d.ch);
    if (!ch) return;
    if (route() === 'live') { if (S.live.sel === ch.id) toggleFull(true); else playChannel(ch); }
    else { S.live.group = ''; S.live.sel = ch.id; location.hash = '#/live'; }
  } else if (d.go !== undefined) {
    if (d.filter !== undefined) { S.live.group = d.filter; S.live.q = ''; }
        location.hash = '#/' + d.go;
    if (d.go === 'live' && route() === 'live') live();
  } else if (d.lgroup !== undefined) {
    S.live.group = d.lgroup;
    S.live.q = '';
    const q = $('#live-q'); if (q) q.value = '';
    renderGroupList();
    renderChannelList();
  } else if (d.ggroup !== undefined) {
    S.guide.group = d.ggroup; guide();
  } else if (d.fav !== undefined) {
    db.favorites = isFav(d.fav) ? db.favorites.filter((x) => x !== d.fav) : [...db.favorites, d.fav];
    saveDb(db); renderLiveInfo(); renderChannelList();
  } else if (d.movie !== undefined) {
    const m = S.data.movies.find((x) => x.id === d.movie);
    if (m) playInOverlay(m.name, m.url);
  } else if (d.series !== undefined) {
    const s = S.data.series.find((x) => x.id === d.series);
    if (s) openSeries(s);
  } else if (d.tab) {
    S.tab = d.tab; S.formErr = ''; setup();
  } else if (d.plUse) {
    db.activeId = d.plUse; saveDb(db); location.hash = '#/'; loadActive();
  } else if (d.plEdit) {
    S.editId = d.plEdit; S.formErr = ''; S.draft = null;
    if (route() === 'shto') setup(); else location.hash = '#/shto';
  } else if (d.plDel) {
    if (!confirm('Ta fshij këtë listë nga kjo pajisje?')) return;
    db.playlists = db.playlists.filter((p) => p.id !== d.plDel);
    if (db.activeId === d.plDel) { db.activeId = db.playlists[0]?.id || null; saveDb(db); loadActive(); }
    else { saveDb(db); lists(); }
  } else if (d.act === 'new-list' || d.act === 'cancel-edit') {
    S.editId = null; S.formErr = ''; S.draft = null;
  } else if (d.act === 'reload') {
    loadActive();
  } else if (d.buffer) {
    Player.setBuffer(d.buffer); lists();
  } else if (d.act === 'live-search') {
    const q = $('#live-q'); if (q) { q.focus(); q.select(); }
  } else if (d.act === 'fullscreen') {
    toggleFull(true);
  }
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('a[data-nav="live"]')) return;
  S.live.q = '';
  if (route() === 'live') live();
});

view.addEventListener('input', (e) => {
  if (e.target.id === 'live-q') { S.live.q = e.target.value; renderChannelList(); }
  if (e.target.id === 'grid-q') {
    const st = e.target.dataset.kind === 'movies' ? S.vod : S.ser;
    st.q = e.target.value;
    const pos = e.target.selectionStart;
    gridView(e.target.dataset.kind);
    const inp = $('#grid-q'); inp.focus(); inp.setSelectionRange(pos, pos);
  }
});
view.addEventListener('submit', (e) => {
  if (e.target.id === 'pl-form') { e.preventDefault(); saveForm(e.target); }
});
view.addEventListener('change', (e) => {
  if (e.target.id === 'grid-group') {
    (e.target.dataset.kind === 'movies' ? S.vod : S.ser).group = e.target.value;
    gridView(e.target.dataset.kind);
  }
});

$('#ov-close').addEventListener('click', closeOverlay);
$('#overlay').addEventListener('click', (e) => {
  if (e.target.id === 'overlay') closeOverlay();
  const ep = e.target.closest('[data-ep]');
  if (ep) playInOverlay(ep.dataset.title, ep.dataset.ep);
});
// Ekran i plotë (punon njësoj në TV, telefon dhe PC)
function toggleFull(on) {
  const isOn = document.body.classList.contains('tvfull');
  const want = on === undefined ? !isOn : on;
  if (want && !$('#live-video')) return;
  document.body.classList.toggle('tvfull', want);
  if (!want) {
    const btn = document.querySelector(`.ch[data-ch="${CSS.escape(S.live.sel || '')}"]`);
    if (btn) btn.focus();
  }
}
window.addEventListener('hashchange', () => toggleFull(false));

document.addEventListener('keydown', (e) => {
  if (document.body.classList.contains('tvfull')) {
    const k = e.key || '';
    if (k === 'Escape' || k === 'Enter' || e.keyCode === 13) { e.preventDefault(); toggleFull(false); return; }
    if (k === 'ArrowUp' || e.keyCode === 38 || k === 'ArrowDown' || e.keyCode === 40) {
      e.preventDefault();
      const list = filteredChannels();
      const i = list.findIndex((c) => c.id === S.live.sel);
      const next = list[(i + (k === 'ArrowUp' || e.keyCode === 38 ? -1 : 1) + list.length) % list.length];
      if (next) playChannel(next);
      return;
    }
  }
  if (e.key === 'Escape' && !$('#overlay').hidden) closeOverlay();
  // Kanali +/- në telekomandë (Samsung 427/428, LG/Android PageUp/PageDown)
  const step = [427, 33].includes(e.keyCode) || e.key === 'ChannelUp' ? -1
    : [428, 34].includes(e.keyCode) || e.key === 'ChannelDown' ? 1 : 0;
  if (step && route() === 'live' && S.data) {
    const list = filteredChannels();
    if (!list.length) return;
    e.preventDefault();
    const i = list.findIndex((c) => c.id === S.live.sel);
    const next = list[(i + step + list.length) % list.length];
    if (next) playChannel(next);
  }
});

// Ora dhe rifreskimi i EPG çdo minutë
function tick() {
  $('#clock').textContent = hhmm(Date.now());
}
window.addEventListener('languagechange', () => { tick(); render(); });
tick();
setInterval(() => {
  tick();
  if (S.data && S.epg.loaded && ['live', ''].includes(route())) refreshEpg();
}, 60000);

window.addEventListener('hashchange', render);
loadActive();

// Instalimi si aplikacion (PWA) – vetëm në web, jo brenda programit Windows/Android
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !window.Capacitor && location.hostname !== 'localhost') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
