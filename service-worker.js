const CACHE_NAME = 'gymbn-v65';

const PRECACHE_URLS = [
  './',
  './index.html',
  './admin.html',
  './coach.html',
  './join.html',
  './style.css',
  './manifest.json',
  './js/app.js',
  './js/router.js',
  './js/storage.js',
  './js/util.js',
  './js/auth.js',
  './js/cloudSync.js',
  './js/bulkParse.js',
  './js/adminApp.js',
  './js/coachApp.js',
  './js/joinApp.js',
  './js/shared/firebaseClient.js',
  './js/shared/loginForm.js',
  './js/roster/rosterUi.js',
  './js/admin/adminCloud.js',
  './js/admin/coachRoster.js',
  './js/admin/exerciseCatalog.js',
  './js/admin/targetRegions.js',
  './js/coach/coachCloud.js',
  './js/coach/studentRoster.js',
  './js/coach/studentDetail.js',
  './js/coach/assignProgram.js',
  './js/coach/studentMeasurements.js',
  './js/coach/studentPayments.js',
  './js/coach/studentSchedule.js',
  './js/coach/paymentCycle.js',
  './js/views/dashboard.js',
  './js/views/week.js',
  './js/views/weekSummary.js',
  './js/views/weekSummaryDesktop.js',
  './js/views/bulkAdd.js',
  './js/views/dayEntry.js',
  './js/views/exerciseLibrary.js',
  './js/views/dayTypeLibrary.js',
  './js/views/history.js',
  './js/views/payments.js',
  './js/views/more.js',
  './js/components/setRows.js',
  './js/components/restTimer.js',
  './js/components/countdownTimer.js',
  './js/components/picker.js',
  './js/components/libraryList.js',
  './js/components/confirmSheet.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    const isUpdate = keys.some((key) => key !== CACHE_NAME);
    await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();
    if (isUpdate) {
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach((client) => client.navigate(client.url));
    }
  })());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return; // Firebase/Google trafiğine dokunma
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
