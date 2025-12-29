// public/sw.js
const CACHE_NAME = 'fintrack-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Пропускаем запросы к API
  if (event.request.url.includes('/api/') || 
      event.request.url.includes('supabase')) {
    return;
  }
  
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});