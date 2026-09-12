(function () {
  function writeThemeCookie(value) {
    var consentMatch = document.cookie.match(/(?:^|; )simplicity-consent=([^;]*)/);
    var consent = consentMatch ? decodeURIComponent(consentMatch[1]) : null;
    try {
      if (sessionStorage.getItem('simplicity-consent') === 'rejected') return;
    } catch (error) {
      // Continue with the cookie check if session storage is unavailable.
    }
    if (consent === 'rejected') return;
    var date = new Date();
    date.setTime(date.getTime() + 365 * 24 * 60 * 60 * 1000);
    document.cookie = 'simplicity-theme=' + encodeURIComponent(value) + '; expires=' + date.toUTCString() + '; path=/; SameSite=Lax';
  }

  function setupThemeToggle() {
    var buttons = document.querySelectorAll('#theme-toggle, #mobile-theme-toggle');
    buttons.forEach(function (button) {
      button.setAttribute('aria-pressed', document.documentElement.getAttribute('data-theme') === 'dark' ? 'true' : 'false');
      button.addEventListener('click', function () {
        var root = document.documentElement;
        var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        root.setAttribute('data-theme', next);
        buttons.forEach(function (item) { item.setAttribute('aria-pressed', next === 'dark' ? 'true' : 'false'); });
        writeThemeCookie(next);
      });
    });
  }

  function setupNavDropdowns() {
    var dropdowns = document.querySelectorAll('.nav-dropdown');
    if (!dropdowns.length) return;

    function setOpen(dropdown, isOpen) {
      var trigger = dropdown.querySelector('.nav-dropdown-trigger');
      var panel = dropdown.querySelector('.nav-dropdown-panel');
      dropdown.classList.toggle('is-open', isOpen);
      trigger.setAttribute('aria-expanded', String(isOpen));
      panel.setAttribute('aria-hidden', String(!isOpen));
    }

    dropdowns.forEach(function (dropdown) {
      var trigger = dropdown.querySelector('.nav-dropdown-trigger');
      trigger.addEventListener('click', function (event) {
        event.stopPropagation();
        var isOpen = dropdown.classList.contains('is-open');
        dropdowns.forEach(function (item) { setOpen(item, false); });
        setOpen(dropdown, !isOpen);
      });
      trigger.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') {
          setOpen(dropdown, false);
          trigger.focus();
        }
      });
    });

    document.addEventListener('click', function (event) {
      dropdowns.forEach(function (dropdown) {
        if (!dropdown.contains(event.target)) setOpen(dropdown, false);
      });
    });
  }

  function setupSettingsDropdown() {
    var wrap = document.getElementById('settings-dropdown');
    var toggle = document.getElementById('settings-toggle');
    if (!wrap || !toggle) return;

    function setOpen(isOpen) {
      wrap.classList.toggle('is-open', isOpen);
      toggle.setAttribute('aria-expanded', String(isOpen));
    }

    toggle.addEventListener('click', function (event) {
      event.stopPropagation();
      setOpen(!wrap.classList.contains('is-open'));
    });
    document.addEventListener('click', function (event) {
      if (!wrap.contains(event.target)) setOpen(false);
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') setOpen(false);
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
      if (isOpen) {
        var firstLink = menu.querySelector('a');
        if (firstLink) firstLink.focus();
      } else {
        toggle.focus();
      }
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
        setupNavDropdowns();
        setupMobileMenu();
        setupSettingsDropdown();
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

  function loadCookieUI() {
    var tasks = [];
    if (!document.getElementById('cookie-banner')) {
      tasks.push(loadInto('/sections/cookie-banner.html', 'end'));
    }
    if (!document.getElementById('cookie-modal-overlay')) {
      tasks.push(loadInto('/sections/cookie-modal.html', 'end'));
    }
    return Promise.all(tasks)
      .then(function () {
        return loadScript('/scripts/consent.js');
      })
      .catch(function (error) {
        console.error(error);
      });
  }

  function init() {
    loadNav();
    loadFooter();
    loadCookieUI();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
