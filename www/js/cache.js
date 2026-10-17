// NEXORA – ruajtja e listës në pajisje (IndexedDB), që app-i të hapet menjëherë.
// Lista shfaqet nga memoria dhe rifreskohet në sfond nga serveri i ofruesit.
const DB = 'nexora-cache';
const STORE = 'lists';

function open() {
  return new Promise((ok, fail) => {
    if (!window.indexedDB) { fail(new Error('pa IndexedDB')); return; }
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => ok(req.result);
    req.onerror = () => fail(req.error);
  });
}

function tx(mode, fn) {
  return open().then((db) => new Promise((ok, fail) => {
    const t = db.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    const res = fn(store);
    t.oncomplete = () => { db.close(); ok(res && 'result' in res ? res.result : undefined); };
    t.onerror = () => { db.close(); fail(t.error); };
    t.onabort = () => { db.close(); fail(t.error); };
  }));
}

// Nënshkrimi i listës: nëse ndryshon serveri/përdoruesi/URL, memoria e vjetër nuk përdoret
export function signature(pl) {
  return JSON.stringify([pl.type, pl.server || '', pl.user || '', pl.pass || '', pl.m3uUrl || '', pl.epgUrl || '']);
}

export async function getList(pl) {
  try {
    const rec = await tx('readonly', (s) => s.get(pl.id));
    return rec && rec.sig === signature(pl) ? rec.data : null;
  } catch (e) { return null; }
}

export async function putList(pl, data) {
  try { await tx('readwrite', (s) => s.put({ sig: signature(pl), t: Date.now(), data }, pl.id)); } catch (e) { /* pa hapësirë */ }
}

export async function removeList(id) {
  try { await tx('readwrite', (s) => s.delete(id)); } catch (e) { /* asgjë */ }
}
