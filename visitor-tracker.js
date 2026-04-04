import { db, collection, addDoc, doc, setDoc, deleteDoc, serverTimestamp } from "./platform.js";

(function initVisitorTracker() {
  try {
    const pageName = window.location.pathname.replace(/^\/|\.html$/g, '') || 'home';
    const visitorId = 'v_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

    addDoc(collection(db, 'pageVisits'), {
      page: pageName,
      source: 'website',
      timestamp: serverTimestamp(),
      visitorId: visitorId,
      userAgent: navigator.userAgent,
      referrer: document.referrer || 'direct'
    }).then(function() {
      console.log('Page visit tracked: /' + pageName);
    }).catch(function(e) {
      console.error('Visitor tracker write FAILED:', e.code, e.message);
    });

    const activeRef = doc(db, 'activeVisitors', visitorId);
    function updateActive() {
      setDoc(activeRef, {
        page: pageName,
        source: 'website',
        lastSeen: serverTimestamp()
      }).catch(function() {});
    }
    updateActive();
    const interval = setInterval(updateActive, 30000);

    window.addEventListener('beforeunload', function() {
      deleteDoc(activeRef).catch(function() {});
      clearInterval(interval);
    });
  } catch (e) {
    console.error('Visitor tracker init error:', e);
  }
})();
