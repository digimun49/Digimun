// Sidebar Include Script - Dynamically loads sidebar.html into any page
(function() {
  // Inject badge CSS if not already present
  if (!document.querySelector('link[href*="user-badges.css"]')) {
    const badgesCss = document.createElement('link');
    badgesCss.rel = 'stylesheet';
    badgesCss.href = '/user-badges.css';
    document.head.appendChild(badgesCss);
  }
  
  // Load badge system module
  if (!document.querySelector('script[src*="user-badges.js"]')) {
    const badgesScript = document.createElement('script');
    badgesScript.type = 'module';
    badgesScript.src = '/user-badges.js';
    document.head.appendChild(badgesScript);
  }
  
  // Load contact system module
  if (!document.querySelector('script[src*="user-contact.js"]')) {
    const contactScript = document.createElement('script');
    contactScript.type = 'module';
    contactScript.src = '/user-contact.js';
    document.head.appendChild(contactScript);
  }
  
  // Inject contact CSS if not present
  if (!document.querySelector('link[href*="user-contact.css"]')) {
    const contactCss = document.createElement('link');
    contactCss.rel = 'stylesheet';
    contactCss.href = '/user-contact.css';
    document.head.appendChild(contactCss);
  }
  
  fetch('/sidebar.html')
    .then(response => response.text())
    .then(html => {
      const container = document.createElement('div');
      container.id = 'sidebar-container';
      container.innerHTML = html;
      document.body.insertBefore(container, document.body.firstChild);
      
      // Execute any scripts in the sidebar HTML
      const scripts = container.querySelectorAll('script');
      scripts.forEach(script => {
        const newScript = document.createElement('script');
        if (script.src) {
          newScript.src = script.src;
        } else {
          newScript.textContent = script.textContent;
        }
        document.body.appendChild(newScript);
      });
    })
    .catch(err => console.log('Sidebar load error:', err));
})();
