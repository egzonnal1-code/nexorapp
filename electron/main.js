// NEXORA – programi për Windows / macOS (Electron)
// Në program nuk ka kufizime CORS dhe luhen edhe transmetimet http://.
const { app, BrowserWindow, protocol, net, shell, Menu, session } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');
const { pathToFileURL } = require('url');

const ROOT = path.join(__dirname, '..', 'www');

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
]);

// Emri u ndryshua në "NEXORA" – listat e ruajtura mbeten te dosja e vjetër
app.setPath('userData', path.join(app.getPath('appData'), 'NEXORA Player'));

if (!app.requestSingleInstanceLock()) app.quit();

let win = null;

// Shumë serverë IPTV refuzojnë kërkesat që vijnë me "Origin/Referer" të shfletuesit
// ose me User-Agent të Chrome. I heqim ato dhe dërgojmë UA si një player IPTV.
const IPTV_UA = 'VLC/3.0.20 LibVLC/3.0.20';
const KEEP_BROWSER_HOSTS = /(^|\.)(googleapis\.com|gstatic\.com|cloudflare\.com|jsdelivr\.net)$/i;

function setupIptvHeaders() {
  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: ['http://*/*', 'https://*/*'] },
    (details, cb) => {
      let host = '';
      try { host = new URL(details.url).hostname; } catch {}
      if (KEEP_BROWSER_HOSTS.test(host)) return cb({ requestHeaders: details.requestHeaders });
      const h = { ...details.requestHeaders };
      for (const k of Object.keys(h)) {
        if (/^(origin|referer|sec-fetch-.*|sec-ch-ua.*)$/i.test(k)) delete h[k];
      }
      h['User-Agent'] = IPTV_UA;
      cb({ requestHeaders: h });
    }
  );
}

// ---------- ffmpeg: kthen zërin Dolby/MP2 në AAC (dhe, si mundësi e fundit, videon HEVC në H.264) ----------
// Luajtësi i programit merr një transmetim të pastër MPEG-TS nga http://127.0.0.1:PORT/remux?u=...
let remuxPort = 0;
function ffmpegPath() {
  const packed = path.join(process.resourcesPath || '', 'ffmpeg.exe');
  if (app.isPackaged && fs.existsSync(packed)) return packed;
  try {
    const p = require('ffmpeg-static');
    return p && fs.existsSync(p) ? p : null;
  } catch { return null; }
}
function startRemux() {
  const bin = ffmpegPath();
  if (!bin) return;
  const srv = http.createServer((req, res) => {
    const q = new URL(req.url, 'http://127.0.0.1');
    const src = q.searchParams.get('u') || '';
    if (q.pathname !== '/remux' || !/^https?:\/\//i.test(src)) { res.writeHead(404); res.end(); return; }
    const tx = q.searchParams.get('tx') === '1';
    const args = [
      '-hide_banner', '-loglevel', 'error', '-nostdin',
      '-user_agent', IPTV_UA,
      '-reconnect', '1', '-reconnect_streamed', '1', '-reconnect_on_network_error', '1', '-reconnect_delay_max', '4',
      '-rw_timeout', '15000000',
      '-fflags', '+genpts+discardcorrupt', '-probesize', '2000000', '-analyzeduration', '2000000',
      '-i', src,
      '-map', '0:v:0?', '-map', '0:a:0?', '-sn', '-dn',
      ...(tx
        ? ['-c:v', 'libx264', '-preset', 'ultrafast', '-tune', 'zerolatency', '-crf', '23', '-vf', 'scale=-2:min(ih\\,1080)', '-pix_fmt', 'yuv420p']
        : ['-c:v', 'copy']),
      '-c:a', 'aac', '-b:a', '192k', '-ac', '2',
      '-f', 'mpegts', '-muxdelay', '0', 'pipe:1',
    ];
    const ff = spawn(bin, args, { windowsHide: true });
    let errText = '';
    let started = false;
    ff.stderr.on('data', (d) => { errText = (errText + d).slice(-4000); });
    ff.stdout.once('data', (first) => {
      started = true;
      res.writeHead(200, { 'Content-Type': 'video/mp2t', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' });
      res.write(first);
      ff.stdout.pipe(res);
    });
    ff.on('close', () => {
      if (started) { res.end(); return; }
      // ffmpeg u ndal para se të dërgonte video → kthe arsyen si kod HTTP
      const m = errText.match(/Server returned (\d{3})|HTTP error (\d{3})|(\d{3}) (?:Forbidden|Not Found|Unauthorized)/i);
      const code = m ? Number(m[1] || m[2] || m[3]) : 502;
      res.writeHead(code >= 400 && code < 600 ? code : 502, { 'Access-Control-Allow-Origin': '*' });
      res.end(errText.slice(-300));
    });
    ff.on('error', () => { if (!started) { res.writeHead(502); res.end(); } });
    req.on('close', () => { try { ff.kill('SIGKILL'); } catch {} });
  });
  srv.on('error', () => { remuxPort = 0; });
  srv.listen(0, '127.0.0.1', () => { remuxPort = srv.address().port; });
}

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: '#0B0B0D',
    title: 'NEXORA',
    icon: path.join(__dirname, '..', 'build', 'installer-icon.ico'),
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: false, // lejon listat/EPG pa CORS dhe video http:// (vetëm për përmbajtjen e përdoruesit)
    },
  });
  win.once('ready-to-show', () => win.show());
  win.loadURL('app://nexora/index.html');

  // Lidhjet e jashtme hapen në shfletues, jo brenda programit
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('app://')) {
      e.preventDefault();
      if (/^https?:/i.test(url)) shell.openExternal(url);
    }
  });
  // F11 = ekran i plotë
  win.webContents.on('before-input-event', (_e, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') win.setFullScreen(!win.isFullScreen());
  });
}

app.on('second-instance', () => {
  if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
});

app.whenReady().then(() => {
  startRemux();
  protocol.handle('app', (req) => {
    let p = decodeURIComponent(new URL(req.url).pathname);
    if (p === '/__nx.json') {
      return new Response(JSON.stringify({ remux: remuxPort }), { headers: { 'Content-Type': 'application/json' } });
    }
    if (!p || p === '/') p = '/index.html';
    const file = path.normalize(path.join(ROOT, p));
    if (!file.startsWith(ROOT)) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });
  setupIptvHeaders();
  Menu.setApplicationMenu(null);
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
