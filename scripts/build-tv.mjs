// NEXORA – ndërton versionet për Smart TV (Samsung Tizen dhe LG webOS) nga dosja www/.
// Përdorim: npm i --no-save esbuild hls.js mpegts.js && node scripts/build-tv.mjs
// Rezultati: build-tv/tizen/ dhe build-tv/webos/
import { build } from 'esbuild';
import { cpSync, rmSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const OUT = join(ROOT, 'build-tv');
const WWW = join(ROOT, 'www');

rmSync(OUT, { recursive: true, force: true });

// Një skedar JS i vetëm, i përkthyer për shfletuesit e vjetër të TV-ve (Samsung 2018+, LG webOS 4+)
const bundle = await build({
  entryPoints: [join(WWW, 'js', 'app.js')],
  bundle: true,
  format: 'iife',
  target: ['chrome56'],
  minify: true,
  write: false,
  legalComments: 'none',
});
const appJs = bundle.outputFiles[0].text;

const hls = join(ROOT, 'node_modules', 'hls.js', 'dist', 'hls.min.js');
const mpegtsCandidates = ['mpegts.min.js', 'mpegts.js'].map((f) => join(ROOT, 'node_modules', 'mpegts.js', 'dist', f));
const mpegts = mpegtsCandidates.find(existsSync);
if (!existsSync(hls) || !mpegts) throw new Error('Mungon hls.js ose mpegts.js në node_modules');

for (const platform of ['tizen', 'webos']) {
  const dir = join(OUT, platform);
  mkdirSync(dir, { recursive: true });
  // skedarët e app-it (pa JS-të e veçanta dhe pa service worker)
  cpSync(join(WWW, 'css'), join(dir, 'css'), { recursive: true });
  cpSync(join(WWW, 'assets'), join(dir, 'assets'), { recursive: true });
  mkdirSync(join(dir, 'js'), { recursive: true });
  mkdirSync(join(dir, 'vendor'), { recursive: true });
  writeFileSync(join(dir, 'js', 'app.js'), appJs);
  copyFileSync(hls, join(dir, 'vendor', 'hls.min.js'));
  copyFileSync(mpegts, join(dir, 'vendor', 'mpegts.min.js'));

  let html = readFileSync(join(WWW, 'index.html'), 'utf8');
  html = html
    .replace(/<script src="https:\/\/cdnjs[^"]*hls[^"]*"[^>]*><\/script>/, '<script src="vendor/hls.min.js"></script>')
    .replace(/<script src="https:\/\/cdn\.jsdelivr\.net[^"]*mpegts[^"]*"[^>]*><\/script>/, '<script src="vendor/mpegts.min.js"></script>')
    .replace('<script type="module" src="js/app.js"></script>', '<script src="js/app.js" defer></script>')
    .replace(/<link rel="manifest"[^>]*>\n?/, '');
  if (!html.includes('vendor/hls.min.js') || !html.includes('src="js/app.js" defer')) {
    throw new Error('index.html nuk u përshtat për TV – kontrollo etiketat <script>');
  }
  writeFileSync(join(dir, 'index.html'), html);

  // skedarët e platformës (config.xml / appinfo.json / ikonat)
  cpSync(join(ROOT, 'tv', platform), dir, { recursive: true });

  // versioni nga package.json
  const version = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version;
  if (platform === 'webos') {
    const p = join(dir, 'appinfo.json');
    const info = JSON.parse(readFileSync(p, 'utf8'));
    info.version = version;
    writeFileSync(p, JSON.stringify(info, null, 2));
  } else {
    const p = join(dir, 'config.xml');
    writeFileSync(p, readFileSync(p, 'utf8').replace(/(<widget[^>]*\sversion=")[^"]*"/, `$1${version}"`));
  }
  console.log(`✓ ${platform}: ${dir}`);
}
