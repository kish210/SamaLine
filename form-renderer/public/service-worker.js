/**
 * سرویس‌ورکر رندرر فرم.
 *
 * هدف: پاسخ‌دهنده در شبکه‌ی ضعیف یا قطعی موقت، فرم را از دست ندهد.
 * - دارایی‌های اپ با راهبرد «کش، سپس شبکه» سرو می‌شوند تا اپ آفلاین باز شود.
 * - درخواست‌های API هرگز کش نمی‌شوند: پاسخ کهنه‌ی فرم یا منطق، بدتر از
 *   خطای شبکه است.
 */
const CACHE_NAME = 'samaline-renderer-v1';
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      // شکست یک فایل نباید کل نصب را خراب کند.
      .then((cache) => Promise.allSettled(APP_SHELL.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // درخواست‌های API و مبدا دیگر دست‌نخورده به شبکه می‌روند.
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api')) {
    return;
  }

  // پیمایش صفحات: اول شبکه، در قطعی از کش (اپ تک‌صفحه‌ای است).
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match('/index.html').then((cached) => cached ?? Response.error()),
      ),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request).then((response) => {
        // فقط پاسخ‌های سالم و هم‌مبدا کش می‌شوند.
        if (response.ok && response.type === 'basic') {
          const copy = response.clone();
          void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    }),
  );
});
