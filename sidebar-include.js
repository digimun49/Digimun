// Sidebar Include Script - Dynamically loads sidebar.html into any page
(function() {
  fetch('sidebar.html')
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
