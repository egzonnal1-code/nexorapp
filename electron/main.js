// NEXORA – programi për Windows / macOS (Electron)
// Në program nuk ka kufizime CORS dhe luhen edhe transmetimet http://.
const { app, BrowserWindow, protocol, net, shell, Menu, session } = require('electron');
const path = require('path');
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
  protocol.handle('app', (req) => {
    let p = decodeURIComponent(new URL(req.url).pathname);
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
