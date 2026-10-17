const LANG_KEY = 'nexora.language';
const LANGUAGES = ['sq', 'de', 'en'];
const ORIGINAL_TEXT = new WeakMap();
const ORIGINAL_ATTR = new WeakMap();

const MESSAGES = {
  '☆ Të preferuarat': ['☆ Favoriten', '☆ Favorites'],
  '★ Hiq': ['★ Entfernen', '★ Remove'],
  'Luajtja': ['Wiedergabe', 'Playback'],
  'Buffer-i (sa video ngarkohet përpara)': ['Puffer (wie viel Video vorgeladen wird)', 'Buffer (how much video is loaded ahead)'],
  'I vogël – fillon shpejt': ['Klein – startet schnell', 'Small – starts fast'],
  'Normal': ['Normal', 'Normal'],
  'I madh – ngec më rrallë': ['Gross – weniger Ruckler', 'Large – fewer stalls'],
  'Nëse kanalet ngecin shpesh, zgjidh “I madh”. Kanali fillon pak më ngadalë, por ngec më rrallë. Kur transmetimi ndalet, NEXORA rilidhet vetë.': ['Wenn Sender oft ruckeln, wähle „Gross“. Der Sender startet etwas langsamer, ruckelt aber seltener. Bricht der Stream ab, verbindet sich NEXORA automatisch neu.', 'If channels stall often, choose “Large”. The channel starts a little slower but stalls less. If the stream stops, NEXORA reconnects automatically.'],
  'Ofruesi refuzoi qasjen (403). Kontrollo llogarinë: mund të ketë skaduar ose është hapur në shumë pajisje njëkohësisht.': ['Der Anbieter hat den Zugriff verweigert (403). Prüfe dein Konto: Es ist evtl. abgelaufen oder auf zu vielen Geräten gleichzeitig offen.', 'The provider denied access (403). Check your account: it may have expired or be open on too many devices at once.'],
  'Ky kanal nuk ekziston më te ofruesi ose është jashtë funksionit.': ['Dieser Sender existiert beim Anbieter nicht mehr oder ist ausser Betrieb.', 'This channel no longer exists at the provider or is offline.'],
  'Kjo pajisje nuk e luan dot formatin e këtij kanali (p.sh. HEVC/4K). Provo versionin FHD/HD.': ['Dieses Gerät kann das Format dieses Senders nicht abspielen (z. B. HEVC/4K). Versuche die FHD/HD-Version.', 'This device can’t play this channel’s format (e.g. HEVC/4K). Try the FHD/HD version.'],
  'Serveri i ofruesit nuk përgjigjet. Ky problem është te ofruesi, jo te NEXORA – provo pas pak ose kontakto ofruesin.': ['Der Server des Anbieters antwortet nicht. Das Problem liegt beim Anbieter, nicht bei NEXORA – versuche es später oder kontaktiere den Anbieter.', 'The provider’s server is not responding. The problem is with the provider, not NEXORA – try again later or contact your provider.'],
  'Transmetimi nuk mund të luhet. Kanali mund të jetë jashtë funksionit te ofruesi.': ['Der Stream kann nicht abgespielt werden. Der Sender ist beim Anbieter evtl. ausser Betrieb.', 'The stream can’t be played. The channel may be offline at the provider.'],
  'Transmetimi u ndërpre disa herë. Serveri i ofruesit ose interneti nuk është i qëndrueshëm – provo pas pak.': ['Der Stream wurde mehrmals unterbrochen. Der Server des Anbieters oder das Internet ist instabil – versuche es später.', 'The stream was interrupted several times. The provider’s server or the internet is unstable – try again later.'],
  'Kryefaqja': ['Startseite', 'Home'],
  'NEXORA – Kryefaqja': ['NEXORA – Startseite', 'NEXORA – Home'],
  'Gjuha': ['Sprache', 'Language'],
  'Menyja': ['Menü', 'Menu'],
  'Guida': ['Programm', 'Guide'],
  'Filma': ['Filme', 'Movies'],
  'Seriale': ['Serien', 'Series'],
  'Listat dhe cilësimet': ['Playlists und Einstellungen', 'Playlists and settings'],
  'NEXORA është vetëm luajtës – nuk ofron, shet apo ruan kanale ose përmbajtje.': ['NEXORA ist nur ein Player – es bietet, verkauft oder speichert keine Sender oder Inhalte.', 'NEXORA is only a player – it does not provide, sell, or store channels or content.'],
  'Kushtet & Privatësia': ['Nutzungsbedingungen & Datenschutz', 'Terms & Privacy'],
  'Impressum': ['Impressum', 'Legal notice'],
  'Mbyll': ['Schließen', 'Close'],
  'Të veçuara': ['Highlights', 'Featured'],
  'Kategoritë': ['Kategorien', 'Categories'],
  'LIVE TV': ['LIVE-TV', 'LIVE TV'],
  'SPORT': ['SPORT', 'SPORT'],
  'FILMA': ['FILME', 'MOVIES'],
  'SERIALE': ['SERIEN', 'SERIES'],
  'SHQIP': ['ALBANISCH', 'ALBANIAN'],
  'Live tani': ['Jetzt live', 'Live now'],
  'Të gjitha': ['Alle', 'All'],
  'Grupet e kanaleve': ['Sendergruppen', 'Channel groups'],
  'Zgjidh një grup për të parë kanalet.': ['Wählen Sie eine Gruppe, um die Sender zu sehen.', 'Choose a group to view its channels.'],
  'Të preferuarat': ['Favoriten', 'Favorites'],
  'Sport': ['Sport', 'Sports'],
  'Shqip': ['Albanisch', 'Albanian'],
  'Pa kategori': ['Ohne Kategorie', 'Uncategorized'],
  'Grupet': ['Gruppen', 'Groups'],
  'Lista e kanaleve': ['Senderliste', 'Channel list'],
  'Kërko kanal': ['Sender suchen', 'Search channels'],
  'Kërko kanal…': ['Sender suchen…', 'Search channels…'],
  'Luajtësi': ['Player', 'Player'],
  'Zgjidh një kanal nga lista.': ['Wählen Sie einen Sender aus der Liste.', 'Select a channel from the list.'],
  'Asnjë kanal në këtë kategori.': ['Keine Sender in dieser Kategorie.', 'No channels in this category.'],
  'Përdor kërkimin.': ['Verwenden Sie die Suche.', 'Use search to find more.'],
  'kanale të tjera – përdor kërkimin.': ['weitere Sender – verwenden Sie die Suche.', 'more channels – use search.'],
  'Nuk ka të dhëna EPG për këtë kanal.': ['Keine EPG-Daten für diesen Sender.', 'No EPG data for this channel.'],
  'Hiq nga të preferuarat': ['Aus Favoriten entfernen', 'Remove from favorites'],
  '★ Hiq nga të preferuarat': ['★ Aus Favoriten entfernen', '★ Remove from favorites'],
  'Shto te të preferuarat': ['Zu Favoriten hinzufügen', 'Add to favorites'],
  '☆ Shto te të preferuarat': ['☆ Zu Favoriten hinzufügen', '☆ Add to favorites'],
  'Ekran i plotë': ['Vollbild', 'Full screen'],
  'Në vazhdim:': ['Als Nächstes:', 'Up next:'],
  'Pa të dhëna EPG': ['Keine EPG-Daten', 'No EPG data'],
  'Guida e programeve': ['Programmübersicht', 'TV Guide'],
  'EPG e ngarkuar': ['EPG geladen', 'EPG loaded'],
  'EPG ende nuk është ngarkuar': ['EPG noch nicht geladen', 'EPG has not loaded yet'],
  'shfaqen 120 kanalet e para, zgjidh kategorinë': ['die ersten 120 Sender werden angezeigt, Kategorie auswählen', 'showing the first 120 channels; choose a category'],
  'Kanali': ['Sender', 'Channel'],
  'Asnjë kanal në këtë kategori': ['Keine Sender in dieser Kategorie', 'No channels in this category'],
  'Për guidë të plotë shto “URL e EPG” (XMLTV) te Listat. Për Xtream, guida shkarkohet automatikisht nga serveri.': ['Für den vollständigen Programmführer fügen Sie unter Playlists die „EPG-URL“ (XMLTV) hinzu. Bei Xtream wird der Programmführer automatisch vom Server geladen.', 'For the full guide, add the “EPG URL” (XMLTV) under Playlists. With Xtream, the guide is downloaded automatically from the server.'],
  'Kërko': ['Suchen', 'Search'],
  'Kërko filma…': ['Filme suchen…', 'Search movies…'],
  'Kërko seriale…': ['Serien suchen…', 'Search series…'],
  'Kategoria': ['Kategorie', 'Category'],
  'Të gjitha kategoritë': ['Alle Kategorien', 'All categories'],
  'tituj': ['Titel', 'titles'],
  'Përdor kërkimin ose kategoritë.': ['Verwenden Sie die Suche oder Kategorien.', 'Use search or categories.'],
  'Duke ngarkuar episodet…': ['Episoden werden geladen…', 'Loading episodes…'],
  'Nuk u gjet asnjë episod.': ['Keine Episoden gefunden.', 'No episodes found.'],
  'Sezoni': ['Staffel', 'Season'],
  'Ndrysho listën': ['Playlist bearbeiten', 'Edit playlist'],
  'Zgjidh mënyrën e lidhjes me ofruesin tënd.': ['Wählen Sie die Verbindungsmethode Ihres Anbieters.', 'Choose how to connect to your provider.'],
  'Mënyra e lidhjes': ['Verbindungsmethode', 'Connection method'],
  'M3U URL': ['M3U-URL', 'M3U URL'],
  'Emri i listës': ['Name der Playlist', 'Playlist name'],
  'p.sh. Shtëpia': ['z. B. Zuhause', 'e.g. Home'],
  'URL e serverit': ['Server-URL', 'Server URL'],
  'Përdoruesi': ['Benutzername', 'Username'],
  'Fjalëkalimi': ['Passwort', 'Password'],
  'URL e listës M3U': ['M3U-Playlist-URL', 'M3U playlist URL'],
  'URL e API-së': ['API-URL', 'API URL'],
  'URL e EPG – guida (opsionale)': ['EPG-URL – Programmführer (optional)', 'EPG URL – guide (optional)'],
  'lëre bosh – merret nga serveri': ['leer lassen – wird vom Server abgerufen', 'leave blank – fetched from server'],
  'Konfirmoj që kjo listë është imja ose e ofruesit tim të licencuar dhe që kam të drejtë ligjore ta shikoj këtë përmbajtje. (': ['Ich bestätige, dass diese Playlist mir oder meinem lizenzierten Anbieter gehört und ich berechtigt bin, diese Inhalte anzusehen. (', 'I confirm that this playlist belongs to me or my licensed provider and that I am legally entitled to view this content. ('],
  'Kushtet': ['Bedingungen', 'Terms'],
  'Duke u lidhur…': ['Verbindung wird hergestellt…', 'Connecting…'],
  'Ruaj ndryshimet': ['Änderungen speichern', 'Save changes'],
  'Lidhu': ['Verbinden', 'Connect'],
  'Anulo': ['Abbrechen', 'Cancel'],
  'NEXORA është vetëm luajtës – nuk ofron kanale. Të dhënat ruhen vetëm në këtë pajisje.': ['NEXORA ist nur ein Player und stellt keine Sender bereit. Ihre Daten werden nur auf diesem Gerät gespeichert.', 'NEXORA is only a player and does not provide channels. Your data is stored only on this device.'],
  'Listat e mia': ['Meine Playlists', 'My playlists'],
  'Llogaria Xtream skadon më:': ['Xtream-Konto läuft ab am:', 'Xtream account expires:'],
  'Shto listë': ['Playlist hinzufügen', 'Add playlist'],
  '+ Shto listë': ['+ Playlist hinzufügen', '+ Add playlist'],
  'aktive': ['aktiv', 'active'],
  'Përdor': ['Verwenden', 'Use'],
  'Rifresko': ['Aktualisieren', 'Refresh'],
  'Ndrysho': ['Bearbeiten', 'Edit'],
  'Fshi': ['Löschen', 'Delete'],
  'Të dhënat ruhen vetëm në këtë pajisje. NEXORA nuk i merr dhe nuk i ruan në server.': ['Ihre Daten werden nur auf diesem Gerät gespeichert. NEXORA erhält oder speichert sie nicht auf einem Server.', 'Your data is stored only on this device. NEXORA does not receive or store it on a server.'],
  'Kushtet, Privatësia & Impressum': ['Nutzungsbedingungen, Datenschutz & Impressum', 'Terms, Privacy & Legal Notice'],
  'Çfarë është NEXORA': ['Was ist NEXORA?', 'What is NEXORA?'],
  'Përgjegjësia e përdoruesit': ['Verantwortung der Nutzer', 'User responsibility'],
  'Privatësia': ['Datenschutz', 'Privacy'],
  'Ofruesit e përmbajtjes': ['Inhaltsanbieter', 'Content providers'],
  'NEXORA është një luajtës mediash (softuer). Ai': ['NEXORA ist ein Mediaplayer (Software). Er', 'NEXORA is a media player (software). It'],
  'nuk ofron, nuk shet, nuk transmeton dhe nuk ruan': ['bietet, verkauft, überträgt oder speichert keine', 'does not provide, sell, stream, or store'],
  'asnjë kanal televiziv, film, serial apo përmbajtje tjetër. Aplikacioni nuk përmban asnjë listë kanalesh të parainstaluar.': ['Fernsehsender, Filme, Serien oder sonstige Inhalte. Die Anwendung enthält keine vorinstallierten Senderlisten.', 'TV channels, movies, series, or other content. The app does not include any preinstalled channel lists.'],
  'Ti shton vetë listën tënde (M3U ose Xtream Codes) nga ofruesi yt, direkt në program.': ['Sie fügen die Playlist Ihres Anbieters (M3U oder Xtream Codes) selbst direkt in der App hinzu.', 'You add your provider’s playlist (M3U, Xtream Codes, or API token) directly in the app.'],
  'Përdor vetëm lista dhe përmbajtje për të cilat ke të drejtë ligjore (p.sh. abonim te një ofrues i licencuar, kanale falas/FTA, lista të tuat).': ['Verwenden Sie nur Playlists und Inhalte, zu deren Nutzung Sie berechtigt sind (z. B. ein Abonnement bei einem lizenzierten Anbieter, frei empfangbare Sender oder eigene Playlists).', 'Only use playlists and content you are legally entitled to access (for example, a subscription to a licensed provider, free-to-air channels, or your own playlists).'],
  'Shikimi ose shpërndarja e përmbajtjes pa licencë mund të shkelë ligjin për të drejtat e autorit (në Zvicër: URG). NEXORA nuk mban përgjegjësi për përmbajtjen që shton përdoruesi.': ['Das Ansehen oder Verbreiten nicht lizenzierter Inhalte kann gegen das Urheberrecht verstoßen (in der Schweiz: URG). NEXORA ist nicht für von Nutzern hinzugefügte Inhalte verantwortlich.', 'Viewing or sharing unlicensed content may violate copyright law (in Switzerland: URG). NEXORA is not responsible for content added by users.'],
  'Listat dhe të dhënat e hyrjes ruhen': ['Playlists und Zugangsdaten werden', 'Playlists and login details are stored'],
  'vetëm lokalisht': ['nur lokal', 'locally only'],
  'në pajisjen tënde. NEXORA nuk ka server me të dhënat e klientëve.': ['auf Ihrem Gerät gespeichert. NEXORA betreibt keinen Server mit Kundendaten.', 'on your device. NEXORA does not store customer data on its servers.'],
  'Fshirja: te “Listat e mia” fshin çdo listë; ose çinstalo programin / pastro të dhënat e faqes.': ['Löschen: Entfernen Sie Playlists unter „Meine Playlists“ oder deinstallieren Sie die App / löschen Sie die Websitedaten.', 'To delete: remove playlists under “My playlists,” or uninstall the app / clear the site data.'],
  'Kur serveri i ofruesit nuk lejon qasje direkte nga shfletuesi (CORS), lista/EPG mund të kalojë përmes një proxy teknik në Netlify. Proxy nuk ruan dhe nuk regjistron përmbajtje. Videoja nuk kalon kurrë përmes serverëve të NEXORA.': ['Wenn der Server des Anbieters keinen direkten Browserzugriff erlaubt (CORS), können Playlist/EPG über einen technischen Netlify-Proxy geladen werden. Der Proxy speichert oder protokolliert keine Inhalte. Videos werden niemals über NEXORA-Server übertragen.', 'If the provider’s server blocks direct browser access (CORS), the playlist/EPG may be fetched through a technical Netlify proxy. The proxy does not store or log content. Video is never routed through NEXORA servers.'],
  'Nuk përdorim cookies për reklama apo gjurmim.': ['Wir verwenden keine Cookies für Werbung oder Tracking.', 'We do not use cookies for advertising or tracking.'],
  'Markat dhe emrat e kanaleve që mund të shfaqen në listën tënde u përkasin pronarëve përkatës. NEXORA nuk ka lidhje me ta.': ['Marken und Sendernamen in Ihrer Playlist gehören den jeweiligen Rechteinhabern. NEXORA ist nicht mit ihnen verbunden.', 'Brands and channel names shown in your playlist belong to their respective owners. NEXORA is not affiliated with them.'],
  'Shto listën tënde': ['Playlist hinzufügen', 'Add your playlist'],
  'Lidh listën tënde TV dhe shiko Live TV, filma dhe seriale në çdo pajisje.': ['Verbinden Sie Ihre TV-Playlist und schauen Sie Live-TV, Filme und Serien auf jedem Gerät.', 'Connect your TV playlist and watch live TV, movies, and series on any device.'],
  'Duke ngarkuar listën…': ['Playlist wird geladen…', 'Loading playlist…'],
  'Lista nuk u ngarkua.': ['Playlist konnte nicht geladen werden.', 'Playlist could not be loaded.'],
  'Gabim i panjohur.': ['Unbekannter Fehler.', 'Unknown error.'],
  'Provo përsëri': ['Erneut versuchen', 'Try again'],
  'Playlistat': ['Playlists', 'Playlists'],
  'Kjo listë nuk ka kanale live.': ['Diese Playlist enthält keine Live-Sender.', 'This playlist has no live channels.'],
  'Kjo listë nuk ka filma.': ['Diese Playlist enthält keine Filme.', 'This playlist has no movies.'],
  'Kjo listë nuk ka seriale.': ['Diese Playlist enthält keine Serien.', 'This playlist has no series.'],
  'Duke ngarkuar guidën e programeve (EPG)…': ['Programmführer (EPG) wird geladen…', 'Loading TV guide (EPG)…'],
  'Guida (EPG) nuk u ngarkua: ': ['Programmführer (EPG) konnte nicht geladen werden: ', 'TV guide (EPG) failed to load: '],
  'Lidhja dështoi: ': ['Verbindung fehlgeschlagen: ', 'Connection failed: '],
  'Ta fshij këtë listë nga kjo pajisje?': ['Diese Playlist von diesem Gerät löschen?', 'Delete this playlist from this device?'],
  'Duke ngarkuar “': ['„', '“'],
  'Serveri nuk lejon qasje nga shfletuesi (CORS) dhe proxy nuk është i disponueshëm.': ['Der Server blockiert den Browserzugriff (CORS) und der Proxy ist nicht verfügbar.', 'The server blocks browser access (CORS) and the proxy is unavailable.'],
  'Serveri nuk lejon qasje direkte nga shfletuesi (CORS). Hape aplikacionin nga Netlify që të punojë proxy-ja.': ['Der Server blockiert den direkten Browserzugriff (CORS). Öffnen Sie die App über Netlify, damit der Proxy funktioniert.', 'The server blocks direct browser access (CORS). Open the app through Netlify to use its proxy.'],
  'Përgjigja e serverit nuk është JSON i vlefshëm.': ['Die Serverantwort ist kein gültiges JSON.', 'The server response is not valid JSON.'],
  'Serveri i ofruesit nuk mund të arrihej.': ['Der Server des Anbieters konnte nicht erreicht werden.', 'The provider server could not be reached.'],
  'Serveri i ofruesit nuk u përgjigj në kohë.': ['Der Server des Anbieters hat nicht rechtzeitig geantwortet.', 'The provider server did not respond in time.'],
  'Të dhënat e Xtream nuk u pranuan nga serveri.': ['Die Xtream-Zugangsdaten wurden vom Server nicht akzeptiert.', 'The Xtream credentials were rejected by the server.'],
  'Ky host nuk lejohet.': ['Dieser Host ist nicht zulässig.', 'This host is not allowed.'],
  'URL e pavlefshme.': ['Ungültige URL.', 'Invalid URL.'],
  'Lejohen vetëm http dhe https.': ['Nur http und https sind zulässig.', 'Only http and https are allowed.'],
  'API ktheu JSON të pavlefshëm.': ['Die API hat ungültiges JSON zurückgegeben.', 'The API returned invalid JSON.'],
  'URL duhet të fillojë me http:// ose https://': ['Die URL muss mit http:// oder https:// beginnen.', 'URL must start with http:// or https://'],
  'Serveri refuzoi qasjen': ['Der Server hat den Zugriff verweigert', 'The server denied access'],
  'Skedari është shumë i madh për t’u hapur në shfletues.': ['Die Datei ist zu groß, um im Browser geöffnet zu werden.', 'The file is too large to open in the browser.'],
  'Skedari është shumë i madh për t\'u hapur në shfletues.': ['Die Datei ist zu groß, um im Browser geöffnet zu werden.', 'The file is too large to open in the browser.'],
  'Skedari nuk duket si listë M3U e vlefshme.': ['Die Datei scheint keine gültige M3U-Playlist zu sein.', 'This file does not appear to be a valid M3U playlist.'],
  'Lista është bosh – nuk u gjet asnjë kanal.': ['Die Playlist ist leer – es wurden keine Sender gefunden.', 'The playlist is empty – no channels were found.'],
  'Skedari EPG nuk është XMLTV i vlefshëm.': ['Die EPG-Datei ist kein gültiges XMLTV.', 'The EPG file is not valid XMLTV.'],
  'Ky shfletues nuk mund të hapë skedarë .gz. Përdor URL-në e EPG pa .gz.': ['Dieser Browser kann keine .gz-Dateien öffnen. Verwenden Sie die EPG-URL ohne .gz.', 'This browser cannot open .gz files. Use the EPG URL without .gz.'],
  'Ky transmetim përdor http:// dhe shfletuesi e bllokon në faqe https. Përdor versionin desktop.': ['Dieser Stream verwendet http:// und wird auf einer https-Seite vom Browser blockiert. Verwenden Sie die Desktop-Version.', 'This stream uses http:// and is blocked by the browser on an https page. Use the desktop app.'],
  'Ky element nuk ka adresë transmetimi.': ['Für dieses Element ist keine Stream-Adresse vorhanden.', 'This item has no stream URL.'],
  'Transmetimi nuk mund të luhet. Kanali mund të jetë jashtë funksionit ose serveri bllokon shfletuesin.': ['Der Stream kann nicht wiedergegeben werden. Der Sender ist möglicherweise nicht verfügbar oder der Server blockiert den Browser.', 'The stream could not be played. The channel may be offline or the server may be blocking the browser.'],
  'Transmetimi nuk mund të luhet (serveri nuk përgjigjet ose formati nuk mbështetet).': ['Der Stream kann nicht wiedergegeben werden (Server antwortet nicht oder Format wird nicht unterstützt).', 'The stream could not be played (the server is not responding or the format is unsupported).'],
  'Ky video nuk mund të luhet në këtë shfletues.': ['Dieses Video kann in diesem Browser nicht wiedergegeben werden.', 'This video cannot be played in this browser.'],
  'Formati MKV shpesh nuk mbështetet nga shfletuesi. Provo versionin desktop.': ['Das MKV-Format wird von Browsern oft nicht unterstützt. Verwenden Sie die Desktop-Version.', 'Browsers often do not support MKV. Try the desktop app.'],
  'API nuk ktheu asnjë kanal.': ['Die API hat keine Sender zurückgegeben.', 'The API returned no channels.'],
};

export function getLanguage() {
  try {
    const stored = localStorage.getItem(LANG_KEY);
    if (LANGUAGES.includes(stored)) return stored;
  } catch {}
  return 'sq';
}

function translateText(value, language) {
  if (language === 'sq') return value;
  const trimmed = value.trim();
  const message = MESSAGES[trimmed];
  if (message) return value.replace(trimmed, message[language === 'de' ? 0 : 1]);

  const count = trimmed.match(/^(\d+) grupe · (\d+) kanale$/);
  if (count) {
    const groups = count[1] === '1'
      ? (language === 'de' ? 'Gruppe' : 'group')
      : (language === 'de' ? 'Gruppen' : 'groups');
    const channels = count[2] === '1' ? 'channel' : 'channels';
    const translated = language === 'de'
      ? `${count[1]} ${groups} · ${count[2]} ${count[2] === '1' ? 'Sender' : 'Sender'}`
      : `${count[1]} ${groups} · ${count[2]} ${channels}`;
    return value.replace(trimmed, translated);
  }
  const reconn = trimmed.match(/^Transmetimi u ndal – po rilidhet… \((\d)\/5\)$/);
  if (reconn) {
    return value.replace(trimmed, language === 'de'
      ? `Stream unterbrochen – verbinde neu… (${reconn[1]}/5)`
      : `Stream stopped – reconnecting… (${reconn[1]}/5)`);
  }
  const channelCount = trimmed.match(/^(\d+) kanale?$/);
  if (channelCount) {
    const translated = language === 'de'
      ? `${channelCount[1]} ${channelCount[1] === '1' ? 'Sender' : 'Sender'}`
      : `${channelCount[1]} ${channelCount[1] === '1' ? 'channel' : 'channels'}`;
    return value.replace(trimmed, translated);
  }
  const titleCount = trimmed.match(/^(\d+) tituj$/);
  if (titleCount) return value.replace(trimmed, `${titleCount[1]} ${language === 'de' ? 'Titel' : 'titles'}`);
  const season = trimmed.match(/^Sezoni (.+)$/);
  if (season) return value.replace(trimmed, `${language === 'de' ? 'Staffel' : 'Season'} ${season[1]}`);
  const loading = trimmed.match(/^Duke ngarkuar “(.+)”…$/);
  if (loading) {
    return value.replace(trimmed, language === 'de'
      ? `„${loading[1]}“ wird geladen…`
      : `Loading “${loading[1]}”…`);
  }
  const connection = trimmed.match(/^Lidhja dështoi: (.+)$/);
  if (connection) {
    return value.replace(trimmed, `${language === 'de' ? 'Verbindung fehlgeschlagen: ' : 'Connection failed: '}${translateText(connection[1], language).trim()}`);
  }
  const moreChannels = trimmed.match(/^\+ (\d+) kanale të tjera – përdor kërkimin\.$/);
  if (moreChannels) {
    return value.replace(trimmed, language === 'de'
      ? `+ ${moreChannels[1]} weitere Sender – verwenden Sie die Suche.`
      : `+ ${moreChannels[1]} more channels – use search.`);
  }
  const limited = trimmed.match(/^Shfaqen (\d+) nga (\d+)\. Përdor kërkimin ose kategoritë\.$/);
  if (limited) {
    return value.replace(trimmed, language === 'de'
      ? `Es werden ${limited[1]} von ${limited[2]} angezeigt. Verwenden Sie die Suche oder Kategorien.`
      : `Showing ${limited[1]} of ${limited[2]}. Use search or categories.`);
  }
  const allCount = trimmed.match(/^Të gjitha \((\d+)\)$/);
  if (allCount) return value.replace(trimmed, `${language === 'de' ? 'Alle' : 'All'} (${allCount[1]})`);
  const expires = trimmed.match(/^Llogaria Xtream skadon më: (.+)$/);
  if (expires) {
    return value.replace(trimmed, `${language === 'de' ? 'Xtream-Konto läuft ab am: ' : 'Xtream account expires: '}${expires[1]}`);
  }
  return value;
}

function translateTree(root, language) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    if (node.parentElement?.closest('#language-select')) continue;
    if (!ORIGINAL_TEXT.has(node)) ORIGINAL_TEXT.set(node, node.nodeValue);
    const original = ORIGINAL_TEXT.get(node);
    const translated = translateText(original, language);
    if (node.nodeValue !== translated) node.nodeValue = translated;
  }

  const elements = root.nodeType === Node.ELEMENT_NODE
    ? [root, ...root.querySelectorAll('*')]
    : [...root.querySelectorAll('*')];
  elements.forEach((element) => {
    for (const attribute of ['placeholder', 'aria-label', 'title']) {
      if (!element.hasAttribute(attribute)) continue;
      let original = ORIGINAL_ATTR.get(element);
      if (!original) {
        original = {};
        ORIGINAL_ATTR.set(element, original);
      }
      if (!(attribute in original)) original[attribute] = element.getAttribute(attribute);
      const translated = translateText(original[attribute], language);
      if (element.getAttribute(attribute) !== translated) element.setAttribute(attribute, translated);
    }
  });
}

export function setLanguage(language) {
  if (!LANGUAGES.includes(language)) return;
  try { localStorage.setItem(LANG_KEY, language); } catch {}
  document.documentElement.lang = language;
  translateTree(document.body, language);
  const select = document.getElementById('language-select');
  if (select) select.value = language;
  window.dispatchEvent(new CustomEvent('languagechange', { detail: { language } }));
}

const observer = new MutationObserver((records) => {
  const language = getLanguage();
  for (const record of records) {
    if (record.type === 'characterData') {
      let original = ORIGINAL_TEXT.get(record.target);
      if (original === undefined || record.target.nodeValue !== translateText(original, language)) {
        original = record.target.nodeValue;
        ORIGINAL_TEXT.set(record.target, original);
      }
      const translated = translateText(original, language);
      if (record.target.nodeValue !== translated) record.target.nodeValue = translated;
    } else {
      record.addedNodes.forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          ORIGINAL_TEXT.set(node, node.nodeValue);
          const translated = translateText(node.nodeValue, language);
          if (node.nodeValue !== translated) node.nodeValue = translated;
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          translateTree(node, language);
        }
      });
      if (record.type === 'attributes') translateTree(record.target, language);
    }
  }
});

document.documentElement.lang = getLanguage();
const languageSelect = document.getElementById('language-select');
if (languageSelect) languageSelect.value = getLanguage();
translateTree(document.body, getLanguage());
observer.observe(document.body, { subtree: true, childList: true, characterData: true, characterDataOldValue: true });

document.getElementById('language-select')?.addEventListener('change', (event) => {
  setLanguage(event.target.value);
});
