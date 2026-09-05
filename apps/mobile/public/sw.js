/*
 * Service worker: riceve le notifiche quando l'app e chiusa.
 *
 * Sta in public/ perche l'export di Expo copia questa cartella nella radice del
 * sito. Deve restare alla radice: un service worker puo controllare solo le
 * pagine sotto il proprio percorso, e da /sw.js controlla tutto il sito.
 *
 * Niente build, niente import: e servito com'e scritto qui.
 */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (e) => {
  let d = {};
  try {
    d = e.data ? e.data.json() : {};
  } catch (_) {
    d = { titolo: 'Il Tifo della Daunia', testo: e.data ? e.data.text() : '' };
  }

  const titolo = d.titolo || 'Il Tifo della Daunia';
  const opzioni = {
    body: d.testo || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    // stesso tag = la notifica nuova sostituisce quella vecchia invece di
    // impilarsi: durante una partita arrivano piu aggiornamenti sullo stesso
    // fatto, e tre righe uguali in centro notifiche sono rumore
    tag: d.tag || 'partita',
    renotify: Boolean(d.tag),
    data: { rotta: d.rotta || '/' },
    vibrate: d.tipo === 'gol' ? [200, 80, 200] : undefined,
  };

  e.waitUntil(self.registration.showNotification(titolo, opzioni));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const rotta = (e.notification.data && e.notification.data.rotta) || '/';

  e.waitUntil((async () => {
    const aperte = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    // se l'app e gia aperta si porta in primo piano invece di aprirne un'altra
    for (const c of aperte) {
      if ('focus' in c) {
        await c.focus();
        if ('navigate' in c) { try { await c.navigate(rotta); } catch (_) { /* stessa pagina */ } }
        return;
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow(rotta);
  })());
});
