/* 飯飯食堂：ホーム画面アプリ用のしくみ（Service Worker）
 * - ページ・記事データは「まずネット、だめなら前回の分」。電波がなくても前回の内容が見られる
 * - 記事の写真・フォントは一度見たものを取っておく（数に上限あり）
 * - ホットペッパーのお店データは規約（24時間以内に更新）に合わせて取っておかない
 */
const BUILD = '__BUILD__';
const CORE = 'meshi-core-v1';
const MEDIA = 'meshi-media-v1';
const MEDIA_MAX = 150;
const PRECACHE = [
  './', 'index.html', 'gacha.html', 'manifest.webmanifest',
  'assets/style.css', 'assets/app.js', 'assets/config.js',
  'assets/icon.svg', 'assets/icon-192.png', 'data/news.json',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CORE)
      .then((c) => Promise.all(PRECACHE.map((u) => c.add(new Request(u, { cache: 'reload' })).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('meshi-') && k !== CORE && k !== MEDIA).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function trim(cacheName, max) {
  const c = await caches.open(cacheName);
  const keys = await c.keys();
  for (let i = 0; i < keys.length - max; i++) await c.delete(keys[i]);
}

// まずネット。つながらなければ前回の分（?v= や ?t= の違いは無視して探す）
async function networkFirst(req) {
  const cache = await caches.open(CORE);
  const url = new URL(req.url);
  const key = url.origin + url.pathname;
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(key, res.clone());
    return res;
  } catch (err) {
    const hit = (await cache.match(key)) || (req.mode === 'navigate' && (await cache.match(new URL('./', self.registration.scope).href)));
    if (!hit) throw err;
    // 前回の分を返したことをページに伝える
    const headers = new Headers(hit.headers);
    headers.set('X-Meshi-Offline', '1');
    return new Response(await hit.blob(), { status: 200, headers });
  }
}

// 写真やフォント：取っておいた分があればそれを使い、裏で新しくする
async function cacheFirst(req) {
  const cache = await caches.open(MEDIA);
  const hit = await cache.match(req);
  const fresh = fetch(req).then((res) => {
    if (res && (res.ok || res.type === 'opaque')) {
      cache.put(req, res.clone()).then(() => trim(MEDIA, MEDIA_MAX));
    }
    return res;
  }).catch(() => hit);
  return hit || fresh;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  if (sameOrigin) {
    if (url.pathname.includes('/data/shops/')) return;   // お店データは取っておかない
    if (url.pathname.endsWith('/sw.js')) return;
    e.respondWith(networkFirst(req));
    return;
  }
  if (req.destination === 'image' || url.hostname.endsWith('fonts.gstatic.com') || url.hostname.endsWith('fonts.googleapis.com')) {
    e.respondWith(cacheFirst(req));
  }
});
