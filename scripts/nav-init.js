(function () {
  function setupThemeToggle() {
    var buttons = document.querySelectorAll('#theme-toggle, #mobile-theme-toggle');
    buttons.forEach(function (button) {
      button.addEventListener('click', function () {
        var root = document.documentElement;
        var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        root.setAttribute('data-theme', next);
        localStorage.setItem('simplicity-theme', next);
      });
    });
  }

  function setupMobileMenu() {
    var toggle = document.getElementById('mobile-menu-toggle');
    var menu = document.getElementById('mobile-menu');
    if (!toggle || !menu) return;

    function setOpen(isOpen) {
      toggle.setAttribute('aria-expanded', String(isOpen));
      toggle.setAttribute('aria-label', isOpen ? 'Close navigation menu' : 'Open navigation menu');
      menu.setAttribute('aria-hidden', String(!isOpen));
      menu.classList.toggle('is-open', isOpen);
    }

    toggle.addEventListener('click', function () {
      setOpen(toggle.getAttribute('aria-expanded') !== 'true');
    });
    menu.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () { setOpen(false); });
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') setOpen(false);
    });
  }

  function loadInto(path, position) {
    return fetch(path)
      .then(function (response) {
        if (!response.ok) throw new Error('Could not load ' + path);
        return response.text();
      })
      .then(function (html) {
        var template = document.createElement('template');
        template.innerHTML = html.trim();
        if (position === 'start') {
          document.body.insertBefore(template.content, document.body.firstChild);
        } else {
          document.body.appendChild(template.content);
        }
      });
  }

  function loadNav() {
    return loadInto('/sections/nav.html', 'start')
      .then(function () {
        setupThemeToggle();
        setupMobileMenu();
      })
      .catch(function (error) {
        console.error(error);
      });
  }

  function loadScript(path) {
    return new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = path;
      script.onload = resolve;
      script.onerror = function () { reject(new Error('Could not load ' + path)); };
      document.body.appendChild(script);
    });
  }

  function loadFooter() {
    var mount = document.querySelector('[data-footer]');
    if (!mount) return Promise.resolve();
    return fetch('/sections/footer.html')
      .then(function (response) {
        if (!response.ok) throw new Error('Could not load footer');
        return response.text();
      })
      .then(function (html) {
        mount.outerHTML = html;
        return loadScript('/scripts/footer-wordmark.js');
      })
      .catch(function (error) {
        console.error(error);
      });
  }

  function init() {
    loadNav();
    loadFooter();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
