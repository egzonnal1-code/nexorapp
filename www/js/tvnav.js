// NEXORA – navigim me telekomandë / tastierë (shigjetat) për Android TV dhe PC
const DIRS = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
// TV-të e vjetra (Samsung/LG) dërgojnë vetëm keyCode
const CODES = { 38: [0, -1], 40: [0, 1], 37: [-1, 0], 39: [1, 0] };
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([type=hidden]):not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

// I dukshëm dhe i fokusueshëm (jo display:none, visibility:hidden apo zero madhësi)
function visible(el) {
  if (!el.getClientRects().length) return false;
  const cs = getComputedStyle(el);
  return cs.visibility !== 'hidden' && cs.display !== 'none' && !el.closest('[hidden], [inert]');
}

document.addEventListener('keydown', (e) => {
  const dir = DIRS[e.key] || CODES[e.keyCode];
  if (!dir || e.altKey || e.ctrlKey || e.metaKey) return;
  const a = document.activeElement;
  // brenda fushave të tekstit shigjetat majtas/djathtas lëvizin kursorin
  if (a && a.tagName === 'INPUT' && !['checkbox', 'radio'].includes(a.type) && dir[1] === 0) return;

  const overlay = document.getElementById('overlay');
  const scope = overlay && !overlay.hidden ? overlay : document;
  const items = [...scope.querySelectorAll(FOCUSABLE)].filter(visible);
  if (!items.length) return;
  if (!a || a === document.body || !scope.contains(a) || !visible(a)) {
    e.preventDefault();
    // fillo nga elementi i parë që shihet në ekran (jo nga diçka e fshehur)
    const first = items.find((el) => { const q = el.getBoundingClientRect(); return q.bottom > 0 && q.top < innerHeight; }) || items[0];
    first.focus();
    first.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    return;
  }

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
    if (dx * dir[0] + dy * dir[1] <= 1) continue; // jo në atë drejtim
    // distanca nga skaji te skaji: elementet në të njëjtin rresht/kolonë kanë përparësi
    const along = dir[1] ? Math.max(0, dir[1] > 0 ? q.top - r.bottom : r.top - q.bottom)
                         : Math.max(0, dir[0] > 0 ? q.left - r.right : r.left - q.right);
    const across = dir[1] ? Math.max(0, q.left - r.right, r.left - q.right)
                          : Math.max(0, q.top - r.bottom, r.top - q.bottom);
    const score = along + across * 3 + Math.abs(dir[1] ? dx : dy) * 0.05;
    if (score < bestScore) { bestScore = score; best = el; }
  }
  e.preventDefault();
  if (best) {
    best.focus();
    best.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  } else if (dir[1] !== 0) {
    // asgjë më poshtë/lart: lëviz faqen që të shihet pjesa tjetër
    window.scrollBy({ top: dir[1] * innerHeight * 0.6, behavior: 'smooth' });
  }
});

// ── Butoni "Back" i telekomandës: Samsung Tizen (10009), LG webOS (461) ──
const BACK = [10009, 461];
const isBack = (e) => BACK.includes(e.keyCode) || e.key === 'GoBack' || e.key === 'BrowserBack';

document.addEventListener('keydown', (e) => {
  if (!isBack(e)) return;
  e.preventDefault();
  const overlay = document.getElementById('overlay');
  if (overlay && !overlay.hidden) { const c = document.getElementById('ov-close'); if (c) c.click(); return; }
  const fs = document.fullscreenElement || document.webkitFullscreenElement;
  if (fs) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
  const a = document.activeElement;
  if (a && a.tagName === 'INPUT') { a.blur(); return; }
  if (location.hash && location.hash !== '#/' && location.hash !== '#') { history.back(); return; }
  // në faqen kryesore: dil nga aplikacioni
  try {
    if (window.tizen && tizen.application) tizen.application.getCurrentApplication().exit();
    else window.close();
  } catch (err) { /* asgjë */ }
});

// Samsung: regjistro butonat e medias që të vijnë te aplikacioni
try {
  if (window.tizen && tizen.tvinputdevice) {
    ['MediaPlayPause', 'MediaPlay', 'MediaPause', 'MediaStop', 'ChannelUp', 'ChannelDown'].forEach((k) => {
      try { tizen.tvinputdevice.registerKey(k); } catch (err) { /* nuk mbështetet */ }
    });
  }
} catch (err) { /* jo Samsung */ }
