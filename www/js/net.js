// NEXORA – Shkarkimi i listave, EPG dhe API-ve.
// Provon direkt; nëse serveri bllokon (CORS) ose faqja është https e lista http,
// përdor proxy-n e Netlify (vetëm për tekst: lista, EPG, API – jo për video).

const PROXY = '/.netlify/functions/proxy';
const MAX_BYTES = 400 * 1024 * 1024;

class HttpError extends Error {
  constructor(status) {
    super(status === 401 || status === 403
      ? `Serveri refuzoi qasjen (${status}). Kontrollo të dhënat e hyrjes / tokenin.`
      : `Serveri u përgjigj me gabim ${status}.`);
    this.status = status;
  }
}

async function gunzip(bytes) {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('Ky shfletues nuk mund të hapë skedarë .gz. Përdor URL-në e EPG pa .gz.');
  }
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function readBody(res) {
  const len = Number(res.headers.get('content-length') || 0);
  if (len > MAX_BYTES) throw new Error('Lista është shumë e madhe (mbi 400 MB). Përdor lidhjen “Xtream Codes” me server, përdorues dhe fjalëkalim.');
  let bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) bytes = await gunzip(bytes);
  return { text: new TextDecoder('utf-8').decode(bytes), contentType: res.headers.get('content-type') || '' };
}

export async function fetchText(url, { headers = {} } = {}) {
  if (!/^https?:\/\//i.test(url)) throw new Error('URL duhet të fillojë me http:// ose https://');
  const mixed = location.protocol === 'https:' && /^http:/i.test(url);

  if (!mixed) {
    try {
      const res = await fetch(url, { headers, cache: 'no-store' });
      if (!res.ok) throw new HttpError(res.status);
      return await readBody(res);
    } catch (e) {
      if (!(e instanceof TypeError)) throw e;
      // përndryshe: ka shumë gjasa CORS → provo proxy
    }
  }

  const proxHeaders = {};
  if (headers.Authorization) proxHeaders['x-nexora-auth'] = headers.Authorization;
  let res;
  try {
    res = await fetch(`${PROXY}?url=${encodeURIComponent(url)}`, { headers: proxHeaders, cache: 'no-store' });
  } catch {
    throw new Error('Serveri nuk lejon qasje nga shfletuesi (CORS) dhe proxy nuk është i disponueshëm.');
  }
  if (res.status === 404) {
    throw new Error('Serveri nuk lejon qasje direkte nga shfletuesi (CORS). Hape aplikacionin nga Netlify që të punojë proxy-ja.');
  }
  if (!res.ok) {
    const msg = await res.text().catch(() => '');
    throw new Error(msg || `Proxy u përgjigj me gabim ${res.status}.`);
  }
  return readBody(res);
}

export async function fetchJson(url, opts) {
  const { text } = await fetchText(url, opts);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Përgjigja e serverit nuk është JSON i vlefshëm.');
  }
}
