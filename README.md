# NEXORA – Setup për Windows, Android, iPhone dhe Web

Një projekt për të gjitha pajisjet:

| Platforma | Si instalohet | Skedari |
|---|---|---|
| **Windows** | Setup klasik (Next → Next → Finish), ikonë në Desktop | `NEXORA-Player-Setup-1.0.0.exe` |
| **Android / Android TV / Fire TV** | APK | `NEXORA-Player.apk` |
| **iPhone / iPad** | Nga Safari → “Shto në ekranin bazë” | (web, pa App Store) |
| **Web** (çdo pajisje) | Netlify | dosja `www/` |

Setup-in për Windows dhe APK-në për Android **i ndërton GitHub automatikisht dhe falas**. S'ke nevojë të instalosh asgjë në kompjuter.

---

## Si funksionon

1. Klienti instalon programin.
2. **Faqja e parë** është **“Shto listën tënde”**: zgjedh **Xtream Codes** ose **M3U URL**, shkruan të dhënat dhe klikon **Lidhu**.
3. Programi e provon lidhjen menjëherë. Nëse të dhënat janë gabim, shfaq gabimin dhe nuk e ruan listën.
4. Pas lidhjes hapen **Ballina → Live TV → Guida → Filma → Seriale**.
5. Te ⚙ (**Listat e mia**) mund të shtosh lista të tjera, t’i ndryshosh ose t’i fshish.

Të dhënat ruhen **vetëm në pajisjen e klientit**. Nuk ka server me playlista, prandaj s’ke përgjegjësi për ruajtjen e tyre.

## HAPI 1 – Vendose projektin në GitHub (një herë)

1. Krijo llogari në <https://github.com> (falas).
2. Kliko **New repository** → emri `nexora-player` → **Private** → **Create**.
3. Kliko **uploading an existing file** dhe tërhiq **të gjithë përmbajtjen** e kësaj dosjeje. Përfshi edhe dosjen `.github`. Në Windows aktivizo “Show hidden files” që ta shohësh.
4. **Commit changes**.

## HAPI 2 – Ndërto setup-in (.exe) dhe APK-në

1. Në GitHub hap repo-n → tab-i **Actions**. Nëse pyet, kliko “I understand… enable”.
2. Majtas zgjidh **Ndërto NEXORA** → **Run workflow** → **Run workflow**.
3. Prit rreth 8–12 minuta, derisa del ✅ e gjelbër.
4. Hape run-in → poshtë te **Artifacts** shkarko:
   - `NEXORA-Player-Windows` → brenda është **NEXORA-Player-Setup-1.0.0.exe**
   - `NEXORA-Player-Android` → brenda është **NEXORA-Player.apk**

Versionet e reja: ndrysho `"version"` te `package.json` (p.sh. `1.0.1`) dhe nis përsëri **Run workflow**. Nëse krijon një *tag* `v1.0.1` (Releases → Draft new release), skedarët dalin vetë te **Releases**, me link të përhershëm për shkarkim.

## HAPI 3 – Instalimi

### Windows
1. Hap `NEXORA-Player-Setup-1.0.0.exe`.
2. Windows SmartScreen mund të thotë “Windows protected your PC”, sepse programi ende nuk ka certifikatë. Kliko **More info → Run anyway**.
3. Zgjidh dosjen → **Install**. Ikona **NEXORA** del në Desktop dhe në Start.
4. **F11** hap ekranin e plotë.

### Android (telefon / tablet)
1. Dërgoje `NEXORA-Player.apk` në telefon (WhatsApp, e-mail, Google Drive ose kabllo).
2. Hape. Lejo **“Instalo nga burime të panjohura”** për aplikacionin që e hap (p.sh. Files ose Chrome).
3. **Instalo** → NEXORA del te aplikacionet.

### Android TV / Fire TV Stick / Box
1. Në TV instalo aplikacionin **Downloader** (nga Play Store / Amazon Appstore).
2. Ngarko APK-në diku me link (Google Drive me link publik, GitHub Releases ose nexoraweb.ch) dhe hape linkun në Downloader.
3. Lejo “Unknown sources” për Downloader → **Install**.
4. NEXORA del në listën e aplikacioneve. Lëvizet me shigjetat e telekomandës, OK hap, Back kthen prapa.

### iPhone / iPad
Apple nuk lejon instalim APK/EXE. Ka dy rrugë:
- **Tani, falas**: publiko web-in (Hapi 4) → hape linkun në **Safari** → butoni **Share (Ndaj)** → **Add to Home Screen / Shto në ekranin bazë**. NEXORA del si aplikacion me ikonë, në ekran të plotë.
  Kufizim: në iPhone luhen vetëm transmetimet `https://`.
- **App Store (më vonë)**: duhet Mac + Xcode + Apple Developer Account (99 USD/vit). Projekti është gati për këtë: `npm install` → `npm run ios:add` → `npm run ios:open` → Archive në Xcode.

## HAPI 4 – Web (Netlify), opsionale

1. Netlify → **Add new site → Import from Git** → zgjidh repo-n `nexora-player`.
2. Netlify i lexon cilësimet vetë nga `netlify.toml` (publish = `www`, proxy = `netlify/functions`). → **Deploy**.
3. Domeni: p.sh. `player.nexoraweb.ch` (CNAME te hosttech).
4. Në Chrome/Edge (PC dhe Android) shfaqet ikona **Instalo**. Në iPhone përdor “Shto në ekranin bazë”.

---

## Dallimet midis versioneve

| | Windows (.exe) | Android (.apk) | Web / iPhone |
|---|---|---|---|
| Lista M3U / Xtream | ✅ | ✅ | ✅ |
| EPG | ✅ | ✅ | ✅ (EPG e madhe kalon nga proxy vetëm deri në 5.5 MB) |
| Transmetime `http://` | ✅ | ✅ | ❌ vetëm `https://` |
| Serverë pa CORS | ✅ | ✅ | ✅ përmes proxy-t në Netlify |
| Telekomandë / shigjeta | ✅ | ✅ (Android TV) | ✅ |

## Ndërtimi në kompjuterin tënd (opsionale, për zhvillues)

Duhet **Node.js 20** (<https://nodejs.org>).

```bash
npm install
npm start              # hap programin desktop për test
npm run build:win      # krijon dist/NEXORA-Player-Setup-1.0.0.exe (në Windows)
npm run android:add    # vetëm herën e parë (duhet Android Studio)
npm run android:icons
npm run android:sync
npm run android:open   # Android Studio → Build → Build APK
```

## Struktura

```
www/                     – aplikacioni (i njëjti për të gjitha platformat)
electron/main.js         – programi Windows/macOS
capacitor.config.json    – aplikacioni Android/iOS
assets/                  – ikona dhe splash për Android/iOS
build/icon.png           – ikona e setup-it për Windows
netlify/functions/       – proxy vetëm për tekst (web)
.github/workflows/       – ndërtimi automatik i .exe dhe .apk
```

## Ligjore

- NEXORA është **vetëm luajtës**: nuk ofron, nuk shet dhe nuk transmeton kanale. Klienti shton listën e vet në program dhe konfirmon që ka të drejtë ligjore për të.
- Mos e lidh programin me reklama që shesin kanale me pagesë (Sky, DAZN, Netflix etj.) pa licencë.
