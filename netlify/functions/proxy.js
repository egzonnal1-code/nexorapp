// NEXORA – proxy teknik vetëm për TEKST (lista M3U, EPG XMLTV, JSON i API-së).
// Përdoret kur serveri i ofruesit nuk lejon CORS ose ka vetëm http://.
// Nuk kalon video, nuk ruan dhe nuk regjistron asgjë.
const zlib = require('zlib');

const MAX = 5.5 * 1024 * 1024; // kufiri i Netlify Functions (~6 MB)
const BLOCKED_HOST = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.|\[?::1\]?|\[?f[cd]|metadata\.)/i;
const BLOCKED_EXT = /\.(ts|mp4|mkv|avi|mov|webm|m4s|aac)(\?|$)/i;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'x-nexora-auth',
  'Cache-Control': 'no-store',
};
const fail = (statusCode, msg) => ({ statusCode, headers: { ...cors, 'Content-Type': 'text/plain; charset=utf-8' }, body: msg });

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' };
  if (event.httpMethod !== 'GET') return fail(405, 'Lejohet vetëm GET.');

  const raw = (event.queryStringParameters || {}).url || '';
  let target;
  try { target = new URL(raw); } catch { return fail(400, 'URL e pavlefshme.'); }
  if (!/^https?:$/.test(target.protocol)) return fail(400, 'Lejohen vetëm http dhe https.');
  if (BLOCKED_HOST.test(target.hostname)) return fail(403, 'Ky host nuk lejohet.');
  if (BLOCKED_EXT.test(target.pathname)) return fail(403, 'Proxy nuk kalon video.');

  const headers = { 'User-Agent': 'NEXORA-Player/1.0', Accept: '*/*' };
  const auth = event.headers['x-nexora-auth'];
  if (auth) headers.Authorization = auth;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 9000);
  try {
    const res = await fetch(target, { headers, redirect: 'follow', signal: ctrl.signal });
    const ct = res.headers.get('content-type') || '';
    if (/^(video|audio\/(?!x-mpegurl))/i.test(ct)) return fail(403, 'Proxy nuk kalon video.');
    let buf = Buffer.from(await res.arrayBuffer());
    if (buf[0] === 0x1f && buf[1] === 0x8b) buf = zlib.gunzipSync(buf);
    if (buf.length > MAX) {
      return fail(413, 'Skedari është më i madh se 5.5 MB dhe nuk kalon nga proxy. Përdor një URL që lejon CORS, ose EPG më të vogël.');
    }
    return {
      statusCode: res.status,
      headers: { ...cors, 'Content-Type': ct.includes('json') ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8' },
      body: buf.toString('utf8'),
    };
  } catch (e) {
    return fail(502, e.name === 'AbortError' ? 'Serveri i ofruesit nuk u përgjigj në kohë.' : 'Serveri i ofruesit nuk mund të arrihej.');
  } finally {
    clearTimeout(timer);
  }
};
