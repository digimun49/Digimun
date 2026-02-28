// ✅ Install event
self.addEventListener('install', function(e) {
  self.skipWaiting(); // activates immediately
});

// ✅ Activate event
self.addEventListener('activate', function(e) {
});

// ✅ Fetch event — cache fallback (basic)
self.addEventListener('fetch', function(event) {
  event.respondWith(
    fetch(event.request).catch(() => {
      // If fetch fails (e.g., offline), fallback logic here (optional)
      return new Response("⚠ You're offline or request failed.", {
        headers: { 'Content-Type': 'text/html' }
      });
    })
  );
});