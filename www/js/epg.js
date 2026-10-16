// NEXORA – Guida elektronike e programeve (XMLTV)

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9ëç]+/g, '');

// "20261016200000 +0200" → milisekonda
export function parseXmltvTime(s) {
  const m = /^(\d{4})(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)?\s*([+-]\d{4})?/.exec(String(s || '').trim());
  if (!m) return 0;
  const [, Y, Mo, D, h, mi, se = '00', tz] = m;
  let t = Date.UTC(+Y, +Mo - 1, +D, +h, +mi, +se);
  if (tz) {
    const sign = tz[0] === '-' ? -1 : 1;
    t -= sign * (Number(tz.slice(1, 3)) * 60 + Number(tz.slice(3, 5))) * 60000;
  }
  return t;
}

export class Epg {
  constructor() {
    this.map = new Map();   // id i kanalit → [{start, stop, title, desc}]
    this.names = new Map(); // emër i normalizuar → id
    this.loaded = false;
  }

  parse(xml) {
    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    if (doc.getElementsByTagName('parsererror').length) {
      throw new Error('Skedari EPG nuk është XMLTV i vlefshëm.');
    }
    for (const c of doc.getElementsByTagName('channel')) {
      const id = c.getAttribute('id');
      for (const d of c.getElementsByTagName('display-name')) this.names.set(norm(d.textContent), id);
    }
    const from = Date.now() - 6 * 3600e3;
    const to = Date.now() + 36 * 3600e3;
    for (const p of doc.getElementsByTagName('programme')) {
      const start = parseXmltvTime(p.getAttribute('start'));
      const stop = parseXmltvTime(p.getAttribute('stop'));
      if (!start || !stop || stop < from || start > to) continue;
      const id = p.getAttribute('channel');
      const item = {
        start, stop,
        title: p.getElementsByTagName('title')[0]?.textContent || '',
        desc: p.getElementsByTagName('desc')[0]?.textContent || '',
      };
      if (!this.map.has(id)) this.map.set(id, []);
      this.map.get(id).push(item);
    }
    for (const list of this.map.values()) list.sort((a, b) => a.start - b.start);
    this.loaded = true;
  }

  setShort(ch, items) {
    if (items.length) this.map.set('xs:' + ch.streamId, items);
  }

  forChannel(ch) {
    return this.map.get(ch.epgId)
      || this.map.get(this.names.get(norm(ch.epgId)))
      || this.map.get(this.names.get(norm(ch.name)))
      || this.map.get('xs:' + ch.streamId)
      || [];
  }

  nowNext(ch, t = Date.now()) {
    const list = this.forChannel(ch);
    const i = list.findIndex((p) => p.start <= t && p.stop > t);
    const cur = i >= 0 ? list[i] : null;
    const next = i >= 0 ? list[i + 1] || null : list.find((p) => p.start > t) || null;
    const pct = cur ? Math.round(((t - cur.start) / (cur.stop - cur.start)) * 100) : 0;
    return { cur, next, pct, list };
  }
}
