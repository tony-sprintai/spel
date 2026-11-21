// Service worker: gör spelet spelbart utan nät efter första besöket.
// Sidan och spelets egna skriptfiler hämtas från nätet först (så nya versioner kommer fram
// och hör ihop), allt annat från cachen först.
const CACHE = 'spel-borgvaktaren-20261121-173554';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './manifest.webmanifest', './ikon-192.png'])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const egetSkript = new URL(req.url).origin === self.location.origin && /\.m?js$/.test(new URL(req.url).pathname);
  if (req.mode === 'navigate' || egetSkript) {
    // 'no-cache' frågar alltid servern om filen ändrats. Annars visar webbläsarens egen cache
    // den gamla sidan i upp till tio minuter efter en publicering, och sida och skript kan hamna i otakt.
    e.respondWith(fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }).then((svar) => {
      // Ett omdirigerat svar får inte lämnas till en sidnavigering; packa om det.
      const res = svar.redirected
        ? new Response(svar.body, { status: svar.status, statusText: svar.statusText, headers: svar.headers })
        : svar;
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
      return res;
    }).catch(() => caches.match(req).then((r) => r || caches.match('./'))));
    return;
  }
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
    if (res.ok || res.type === 'opaque') {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
    }
    return res;
  })));
});
