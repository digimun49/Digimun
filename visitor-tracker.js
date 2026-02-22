(function() {
  var FIREBASE_CDN = 'https://www.gstatic.com/firebasejs/10.12.2/';
  var TRACKER_APP_NAME = 'visitor-tracker-app';

  function loadScript(src, cb) {
    var existing = document.querySelector('script[src="' + src + '"]');
    if (existing) { cb(); return; }
    var s = document.createElement('script');
    s.src = src;
    s.onload = cb;
    s.onerror = function() { cb(); };
    document.head.appendChild(s);
  }

  function initTracker() {
    if (typeof firebase === 'undefined' || !firebase.firestore) return;

    var firebaseConfig = {
      apiKey: "AIzaSyACACrfmp0EpnsuVClv57VmDz5uMQ39qdM",
      authDomain: "digimun-49.firebaseapp.com",
      databaseURL: "https://digimun-49-default-rtdb.firebaseio.com",
      projectId: "digimun-49",
      storageBucket: "digimun-49.firebasestorage.app",
      messagingSenderId: "624588089371",
      appId: "1:624588089371:web:3d932c99fef512213c70be"
    };

    var app;
    try {
      app = firebase.initializeApp(firebaseConfig, TRACKER_APP_NAME);
    } catch(e) {
      try { app = firebase.app(TRACKER_APP_NAME); } catch(e2) {
        try { app = firebase.app(); } catch(e3) { return; }
      }
    }

    var db = firebase.firestore(app);
    var pageName = window.location.pathname.replace(/^\/|\.html$/g, '') || 'home';
    var visitorId = 'v_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

    db.collection('pageVisits').add({
      page: pageName,
      source: 'website',
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      visitorId: visitorId,
      userAgent: navigator.userAgent,
      referrer: document.referrer || 'direct'
    }).then(function() {
      console.log('Page visit tracked: /' + pageName);
    }).catch(function(e) {
      console.error('Visitor tracker write FAILED:', e.code, e.message);
    });

    var activeRef = db.collection('activeVisitors').doc(visitorId);
    function updateActive() {
      activeRef.set({
        page: pageName,
        source: 'website',
        lastSeen: firebase.firestore.FieldValue.serverTimestamp()
      }).catch(function() {});
    }
    updateActive();
    var interval = setInterval(updateActive, 30000);

    window.addEventListener('beforeunload', function() {
      activeRef.delete().catch(function() {});
      clearInterval(interval);
    });
  }

  if (typeof firebase !== 'undefined' && firebase.firestore) {
    initTracker();
  } else {
    loadScript(FIREBASE_CDN + 'firebase-app-compat.js', function() {
      loadScript(FIREBASE_CDN + 'firebase-firestore-compat.js', function() {
        initTracker();
      });
    });
  }
})();
