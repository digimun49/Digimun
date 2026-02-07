(function() {
  var FIREBASE_CDN = 'https://www.gstatic.com/firebasejs/10.12.2/';

  function loadScript(src, cb) {
    var s = document.createElement('script');
    s.src = src;
    s.onload = cb;
    s.onerror = function() { cb(); };
    document.head.appendChild(s);
  }

  function initTracker() {
    var firebaseConfig = {
      apiKey: "AIzaSyAM6Irl7vHJrk3-bUOduGEmsq5X5up-4xQ",
      authDomain: "digimun-chat.firebaseapp.com",
      databaseURL: "https://digimun-chat-default-rtdb.firebaseio.com",
      projectId: "digimun-chat",
      storageBucket: "digimun-chat.appspot.com",
      messagingSenderId: "264126525018",
      appId: "1:264126525018:web:e2c3fe4b32f5af29ff3263"
    };

    var app;
    if (!firebase.apps.length) {
      app = firebase.initializeApp(firebaseConfig, 'visitor-tracker');
    } else {
      app = firebase.apps.find(function(a) { return a.name === 'visitor-tracker'; }) || firebase.apps[0];
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
    }).catch(function(e) { });

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
        if (typeof firebase !== 'undefined') initTracker();
      });
    });
  }
})();
