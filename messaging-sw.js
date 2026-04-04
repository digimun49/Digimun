try {
  importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');
} catch (e) {
  console.warn('SW: Failed to load Firebase scripts:', e.message);
}

try {
  importScripts('/config.js');
} catch (e) {
  console.warn('SW: Failed to load config:', e.message);
}

try {
  if (typeof firebase !== 'undefined' && self.PLATFORM_CONFIG) {
    firebase.initializeApp(self.PLATFORM_CONFIG);
  }
} catch (e) {
  console.warn('SW: Firebase init error:', e.message);
}

var messaging = null;
try {
  if (typeof firebase !== 'undefined' && firebase.messaging) {
    messaging = firebase.messaging();
  }
} catch (e) {
  console.warn('SW: Firebase messaging init error:', e.message);
}

if (messaging) {
  messaging.onBackgroundMessage(function(payload) {
    var data = payload.notification || payload.data || {};
    var title = data.title || 'Digimun Pro';
    var options = {
      body: data.body || 'You have a new notification',
      icon: '/assets/web-app-manifest-192x192.png',
      badge: '/assets/web-app-manifest-192x192.png',
      vibrate: [100, 50, 100],
      data: {
        url: data.click_action || (payload.data && payload.data.url) || '/'
      },
      actions: [
        { action: 'open', title: 'Open' }
      ]
    };
    return self.registration.showNotification(title, options);
  });
}

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
