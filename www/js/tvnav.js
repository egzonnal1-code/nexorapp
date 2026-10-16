// NEXORA – navigim me telekomandë / tastierë (shigjetat) për Android TV dhe PC
const DIRS = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([type=hidden]), select';

document.addEventListener('keydown', (e) => {
  const dir = DIRS[e.key];
  if (!dir || e.altKey || e.ctrlKey || e.metaKey) return;
  const a = document.activeElement;
  // brenda fushave të tekstit shigjetat lëvizin kursorin
  if (a && ((a.tagName === 'INPUT' && !['checkbox', 'radio'].includes(a.type) && dir[1] === 0) || a.tagName === 'SELECT')) return;

  const overlay = document.getElementById('overlay');
  const scope = overlay && !overlay.hidden ? overlay : document;
  const items = [...scope.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
  if (!items.length) return;
  if (!a || a === document.body || !scope.contains(a)) { e.preventDefault(); items[0].focus(); return; }

  const r = a.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  let best = null;
  let bestScore = Infinity;
  for (const el of items) {
    if (el === a) continue;
    const q = el.getBoundingClientRect();
    const dx = q.left + q.width / 2 - cx;
    const dy = q.top + q.height / 2 - cy;
    const along = dx * dir[0] + dy * dir[1];
    if (along <= 1) continue;
    const across = Math.abs(dx * dir[1] + dy * dir[0]);
    const score = along + across * 2.5;
    if (score < bestScore) { bestScore = score; best = el; }
  }
  if (best) {
    e.preventDefault();
    best.focus();
    best.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
});
