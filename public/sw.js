const CACHE_NAME = 'elshamadan-wc26-v3'; // ← غيّرنا الاسم + استراتيجية Network-First للصفحات

const APP_SHELL = ['/', '/Shedan_logo.png', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // ── API و Supabase: مباشر من السيرفر دايماً (داتا حيّة، مش بتتخزن) ──
  if (url.pathname.startsWith('/api/') || url.hostname.includes('supabase')) return;

  // ── الأصول الثابتة (صور/خطوط): Cache-First — سريعة ونادراً ما تتغير ──
  const isStaticAsset = /\.(png|jpe?g|svg|ico|webp|gif|woff2?|ttf)$/i.test(url.pathname);

  if (isStaticAsset) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request)
          .then((response) => {
            if (response.ok && event.request.url.startsWith(self.location.origin)) {
              const cloned = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned));
            }
            return response;
          })
          .catch(() => caches.match('/'));
      })
    );
    return;
  }

  // ── الصفحات والـ JS/CSS: Network-First — نجيب آخر نسخة من النت الأول ──
  // كده التعديلات توصل للأعضاء فوراً مع أول refresh، ولو النت فشل نرجع للكاش (offline)
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (
          response.ok &&
          event.request.url.startsWith(self.location.origin) &&
          !event.request.url.includes('_next/webpack-hmr')
        ) {
          const cloned = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned));
        }
        return response;
      })
      .catch(() =>
        caches.match(event.request).then((cached) => cached || caches.match('/'))
      )
  );
});

// ══ PUSH NOTIFICATIONS ══

self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title || '⚽ دوري الشمعدان', {
      body: data.body || 'لديك توقعات لم تكملها!',
      icon: '/Shedan_logo.png',
      badge: '/Shedan_logo.png',
      dir: 'rtl',
      lang: 'ar',
      data: { url: data.url || '/dashboard' },
      actions: [
        { action: 'open', title: '⚽ توقع الآن' },
        { action: 'dismiss', title: 'لاحقاً' }
      ]
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const url = event.notification.data?.url || '/dashboard';
      const existing = list.find((c) => c.url.includes('/dashboard'));
      if (existing) return existing.focus();
      return clients.openWindow(url);
    })
  );
});
