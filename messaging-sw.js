self.addEventListener('push', function(event) {
  var data = {};
  try { data = event.data.json(); } catch (e) { /* empty payload */ }

  var notification = data.notification || {};
  var extra = data.data || {};
  var title = notification.title || 'Digimun Pro';
  var options = {
    body: notification.body || 'You have a new notification',
    icon: notification.icon || '/assets/web-app-manifest-192x192.png',
    badge: '/assets/web-app-manifest-192x192.png',
    vibrate: [100, 50, 100],
    data: {
      url: notification.click_action || extra.url || '/'
    },
    actions: [
      { action: 'open', title: 'Open' }
    ]
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  var url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (var i = 0; i < clientList.length; i++) {
        if (clientList[i].url.includes(self.location.origin) && 'focus' in clientList[i]) {
          clientList[i].navigate(url);
          return clientList[i].focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
