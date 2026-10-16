// NEXORA – Ruajtja lokale (vetëm në këtë pajisje – asgjë nuk dërgohet te NEXORA)
const KEY = 'nexora.player.v1';
const empty = () => ({ playlists: [], activeId: null, favorites: [] });

export function loadDb() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    return d && Array.isArray(d.playlists) ? { ...empty(), ...d } : empty();
  } catch {
    return empty();
  }
}

export function saveDb(db) {
  try { localStorage.setItem(KEY, JSON.stringify(db)); } catch {}
}
